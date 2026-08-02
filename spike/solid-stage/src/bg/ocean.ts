import {
  Color,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { WaveTheme } from '@lyrika/shared';
import { audioLevel } from '../audio/level';

const VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uLevel;

  varying vec3 vWorld;
  varying float vCrest;

  float ridge(vec2 p, vec2 dir, float freq, float speed, float t) {
    return sin(dot(p, dir) * freq + t * speed);
  }

  void main() {
    vec3 pos = position;
    vec2 p = pos.xz;
    float t = uTime;

    float h = 0.0;
    h += ridge(p, normalize(vec2(1.0, 0.32)), 0.085, 0.85, t) * 1.0;
    h += ridge(p, normalize(vec2(-0.55, 1.0)), 0.145, 1.15, t) * 0.58;
    h += ridge(p, normalize(vec2(0.4, -0.9)), 0.27, 1.65, t) * 0.28;
    h += ridge(p, normalize(vec2(1.0, 1.0)), 0.52, 2.4, t) * 0.12;

    float amp = uHeight * (0.7 + uLevel * 1.1);
    pos.y += h * amp;

    vCrest = clamp(h * 0.5 + 0.5, 0.0, 1.0);
    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uFog;
  uniform vec3 uSurface;
  uniform vec3 uAtmosphere;
  uniform vec3 uCamera;
  uniform float uLevel;

  varying vec3 vWorld;
  varying float vCrest;

  void main() {
    vec3 dx = dFdx(vWorld);
    vec3 dy = dFdy(vWorld);
    vec3 normal = normalize(cross(dy, dx));
    if (normal.y < 0.0) normal = -normal;

    vec3 viewDir = normalize(uCamera - vWorld);
    vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));

    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);
    float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-lightDir, normal), viewDir), 0.0, 1.0), 48.0);

    // Weighted toward the fog colour: the water is a backdrop, and the lyric
    // column has to stay legible on top of it.
    vec3 color = mix(uFog, uSurface, clamp(vCrest * 0.5 + diffuse * 0.22, 0.0, 1.0));
    color = mix(color, uAtmosphere, fresnel * 0.22);
    color += uAtmosphere * spec * (0.22 + uLevel * 0.45);
    color += uAtmosphere * pow(vCrest, 8.0) * 0.12;

    // Fade the far field into the CSS sky so there is no hard horizon seam.
    float dist = length(vWorld.xz - uCamera.xz);
    float alpha = smoothstep(240.0, 30.0, dist);
    alpha *= smoothstep(0.0, 10.0, dist);

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface OceanOptions {
  theme: WaveTheme;
  waveHeight: number;
  reactivity: number;
}

export class OceanRenderer {
  #renderer: WebGLRenderer;
  #scene = new Scene();
  #camera: PerspectiveCamera;
  #material: ShaderMaterial;
  #frame = 0;
  #start = performance.now();
  #level = 0;
  #reactivity: number;
  #disposed = false;

  constructor(canvas: HTMLCanvasElement, options: OceanOptions) {
    this.#renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.#camera = new PerspectiveCamera(52, 1, 0.1, 600);
    this.#camera.position.set(0, 4.2, 16);
    // Pitched slightly up so the horizon sits low and the water stays a
    // bottom-of-frame backdrop rather than filling the screen.
    this.#camera.lookAt(new Vector3(0, 11, -60));

    this.#reactivity = options.reactivity;

    const geometry = new PlaneGeometry(520, 520, 220, 220);
    geometry.rotateX(-Math.PI / 2);

    this.#material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uHeight: { value: options.waveHeight },
        uLevel: { value: 0 },
        uFog: { value: new Color(options.theme.fog) },
        uSurface: { value: new Color(options.theme.surface) },
        uAtmosphere: { value: new Color(options.theme.atmosphere) },
        uCamera: { value: this.#camera.position.clone() },
      },
    });

    const mesh = new Mesh(geometry, this.#material);
    mesh.position.set(0, 0, -140);
    this.#scene.add(mesh);

    this.#loop();
  }

  update(options: OceanOptions): void {
    this.#material.uniforms.uHeight!.value = options.waveHeight;
    (this.#material.uniforms.uFog!.value as Color).set(options.theme.fog);
    (this.#material.uniforms.uSurface!.value as Color).set(options.theme.surface);
    (this.#material.uniforms.uAtmosphere!.value as Color).set(options.theme.atmosphere);
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
    this.#material.dispose();
    this.#scene.traverse((obj) => {
      if (obj instanceof Mesh) obj.geometry.dispose();
    });
    this.#renderer.dispose();
  }

  #loop = (): void => {
    if (this.#disposed) return;
    this.#frame = requestAnimationFrame(this.#loop);

    const target = audioLevel.value * this.#reactivity;
    // Ease toward the target so a spiky analyser reading never jolts the water.
    this.#level += (target - this.#level) * 0.08;

    this.#material.uniforms.uTime!.value = (performance.now() - this.#start) / 1000;
    this.#material.uniforms.uLevel!.value = this.#level;
    this.#renderer.render(this.#scene, this.#camera);
  };
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
