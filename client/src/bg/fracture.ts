import {
  Color,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';
import type { WaveTheme } from '@lyrika/shared';
import { audioLevel } from '../audio/level';

/**
 * A grid of cells, flush at rest, that fractures further as the music gets
 * louder: each cell's depth and slight rotation come from a fixed per-cell
 * noise seed scaled by the audio level, and the crack lines between cells
 * (drawn as an edge-proximity glow in the fragment shader) brighten with it.
 * One InstancedMesh — a single draw call for the whole grid.
 */
const VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute float aGlow;
  varying vec2 vUv;
  varying float vGlow;

  void main() {
    vUv = uv;
    vGlow = aGlow;
    vec4 world = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uSurface;
  uniform vec3 uAtmosphere;
  uniform float uLevel;
  varying vec2 vUv;
  varying float vGlow;

  void main() {
    vec2 d = min(vUv, 1.0 - vUv);
    float edge = 1.0 - smoothstep(0.0, 0.09 + uLevel * 0.05, min(d.x, d.y));
    float fill = 0.05 + vGlow * 0.05;
    vec3 color = mix(uSurface * fill, uAtmosphere, edge * (0.35 + uLevel * 0.9));
    float alpha = fill + edge * (0.4 + uLevel * 0.6);
    gl_FragColor = vec4(color, alpha);
  }
`;

export interface FractureOptions {
  theme: WaveTheme;
  waveHeight: number;
  reactivity: number;
}

const COLS = 14;
const ROWS = 9;
const CELL = 1.0;
const GAP = 0.06;

export class FractureRenderer {
  #renderer: WebGLRenderer;
  #scene = new Scene();
  #camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  #material: ShaderMaterial;
  #mesh: InstancedMesh;
  #seeds: Float32Array;
  #frame = 0;
  #start = performance.now();
  #level = 0;
  #reactivity: number;
  #disposed = false;
  #tmp = new Object3D();

  constructor(canvas: HTMLCanvasElement, options: FractureOptions) {
    this.#renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.#reactivity = options.reactivity;
    this.#camera.position.set(0, 0, 10);
    this.#camera.lookAt(0, 0, 0);

    const count = COLS * ROWS;
    const geometry = new PlaneGeometry(CELL - GAP, CELL - GAP);

    this.#seeds = new Float32Array(count);
    const glow = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      this.#seeds[i] = Math.random();
      glow[i] = 0;
    }
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(this.#seeds, 1));
    const glowAttr = new InstancedBufferAttribute(glow, 1);
    glowAttr.setUsage(DynamicDrawUsage);
    geometry.setAttribute('aGlow', glowAttr);

    this.#material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uLevel: { value: 0 },
        uSurface: { value: new Color(options.theme.surface) },
        uAtmosphere: { value: new Color(options.theme.atmosphere) },
      },
    });

    this.#mesh = new InstancedMesh(geometry, this.#material, count);
    this.#mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const i = row * COLS + col;
        this.#tmp.position.set((col - (COLS - 1) / 2) * CELL, (row - (ROWS - 1) / 2) * CELL, 0);
        this.#tmp.updateMatrix();
        this.#mesh.setMatrixAt(i, this.#tmp.matrix);
      }
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
    this.#mesh.scale.setScalar(1 / ROWS);

    this.#scene.add(this.#mesh);
    this.#loop();
  }

  update(options: FractureOptions): void {
    (this.#material.uniforms.uSurface!.value as Color).set(options.theme.surface);
    (this.#material.uniforms.uAtmosphere!.value as Color).set(options.theme.atmosphere);
    this.#reactivity = options.reactivity;
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
  }

  dispose(): void {
    this.#disposed = true;
    cancelAnimationFrame(this.#frame);
    this.#mesh.geometry.dispose();
    this.#material.dispose();
    this.#renderer.dispose();
  }

  #loop = (): void => {
    if (this.#disposed) return;
    this.#frame = requestAnimationFrame(this.#loop);

    const target = audioLevel.value * this.#reactivity;
    this.#level += (target - this.#level) * 0.15;

    const t = (performance.now() - this.#start) / 1000;
    const matrix = new Matrix4();
    const glowAttr = this.#mesh.geometry.getAttribute('aGlow') as InstancedBufferAttribute;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const i = row * COLS + col;
        const seed = this.#seeds[i] ?? 0;
        const wobble = Math.sin(t * (0.6 + seed) + seed * 20.0);
        const z = wobble * (0.15 + this.#level * 1.4) * (0.4 + seed);
        this.#tmp.position.set((col - (COLS - 1) / 2) * CELL, (row - (ROWS - 1) / 2) * CELL, z);
        this.#tmp.rotation.set(wobble * 0.06 * this.#level, wobble * 0.06 * this.#level, 0);
        this.#tmp.updateMatrix();
        matrix.copy(this.#tmp.matrix);
        this.#mesh.setMatrixAt(i, matrix);
        glowAttr.setX(i, Math.max(0, wobble) * this.#level);
      }
    }
    this.#mesh.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true;
    this.#material.uniforms.uLevel!.value = this.#level;
    this.#renderer.render(this.#scene, this.#camera);
  };
}
