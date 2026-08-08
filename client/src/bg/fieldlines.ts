import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { WaveTheme } from '@lyrika/shared';
import { audioLevel } from '../audio/level';

/**
 * Magnetic field-line background: a set of dipole arcs (the classic "iron
 * filings around a bar magnet" shape, r = L·sin²θ in spherical coordinates)
 * looping between two poles below the frame. All animation — pulse, wobble,
 * pole spread — lives in the vertex/fragment shader via uTime/uLevel, so the
 * tube geometry itself is built once at construction, not rebuilt per frame.
 */
const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  varying float vT;

  void main() {
    vT = uv.x;
    vec3 pos = position;
    // Perpendicular wobble along the tube's local frame, strongest at the
    // midpoint of each arc — reads as the line "reacting" to the music.
    float bulge = sin(vT * 3.14159265);
    float wobble = sin(vT * 18.0 + uTime * 2.2) * (0.35 + uLevel * 2.2) * bulge;
    pos += normal * wobble;
    vec4 world = modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uLevel;
  varying float vT;

  void main() {
    // A soft pulse travels along the arc from pole to pole.
    float travel = sin(vT * 10.0 - uTime * 1.6) * 0.5 + 0.5;
    float glow = 0.18 + travel * (0.35 + uLevel * 1.4);
    float edge = sin(vT * 3.14159265);
    gl_FragColor = vec4(uColor * glow, glow * edge * 0.8);
  }
`;

export interface FieldLinesOptions {
  theme: WaveTheme;
  waveHeight: number;
  reactivity: number;
}

const LINE_COUNT = 11;
const SHELLS = [1, 1.35, 1.7];

/** One dipole field-line arc at longitude `phi`, shell radius `shell`. */
function buildArc(phi: number, shell: number): Vector3[] {
  const points: Vector3[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i += 1) {
    const theta = 0.06 + (i / steps) * (Math.PI - 0.12);
    const r = shell * Math.sin(theta) * Math.sin(theta);
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta);
    const z = r * Math.sin(theta) * Math.sin(phi);
    points.push(new Vector3(x, y, z));
  }
  return points;
}

export class FieldLinesRenderer {
  #renderer: WebGLRenderer;
  #scene = new Scene();
  #camera: PerspectiveCamera;
  #group = new Group();
  #materials: ShaderMaterial[] = [];
  #frame = 0;
  #start = performance.now();
  #level = 0;
  #reactivity: number;
  #disposed = false;

  constructor(canvas: HTMLCanvasElement, options: FieldLinesOptions) {
    this.#renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.#camera = new PerspectiveCamera(50, 1, 0.1, 100);
    this.#camera.position.set(0, 2.4, 9.5);
    this.#camera.lookAt(new Vector3(0, 4.5, 0));

    this.#reactivity = options.reactivity;

    const colors = [options.theme.surface, options.theme.atmosphere];
    for (let s = 0; s < SHELLS.length; s += 1) {
      const shell = SHELLS[s] ?? 1;
      for (let i = 0; i < LINE_COUNT; i += 1) {
        const phi = (i / LINE_COUNT) * Math.PI * 2;
        const curve = new CatmullRomCurve3(buildArc(phi, shell));
        const geometry = new TubeGeometry(curve, 64, 0.012 + shell * 0.006, 6, false);
        const material = new ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          uniforms: {
            uTime: { value: 0 },
            uLevel: { value: 0 },
            uColor: { value: new Color(colors[(i + s) % colors.length] ?? options.theme.atmosphere) },
          },
        });
        this.#materials.push(material);
        this.#group.add(new Mesh(geometry, material));
      }
    }

    this.#group.scale.setScalar(3.4);
    this.#group.position.set(0, -1.2, -6);
    this.#scene.add(this.#group);

    this.#loop();
  }

  update(options: FieldLinesOptions): void {
    const colors = [options.theme.surface, options.theme.atmosphere];
    this.#materials.forEach((mat, i) => {
      (mat.uniforms.uColor!.value as Color).set(colors[i % colors.length] ?? options.theme.atmosphere);
    });
    this.#reactivity = options.reactivity;
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.#disposed = true;
    cancelAnimationFrame(this.#frame);
    this.#group.traverse((obj) => {
      if (obj instanceof Mesh) obj.geometry.dispose();
    });
    for (const mat of this.#materials) mat.dispose();
    this.#renderer.dispose();
  }

  #loop = (): void => {
    if (this.#disposed) return;
    this.#frame = requestAnimationFrame(this.#loop);

    const target = audioLevel.value * this.#reactivity;
    this.#level += (target - this.#level) * 0.1;

    const t = (performance.now() - this.#start) / 1000;
    this.#group.rotation.y = Math.sin(t * 0.05) * 0.25;
    for (const mat of this.#materials) {
      mat.uniforms.uTime!.value = t;
      mat.uniforms.uLevel!.value = this.#level;
    }
    this.#renderer.render(this.#scene, this.#camera);
  };
}
