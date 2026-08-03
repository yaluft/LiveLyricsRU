import {
  Color,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { audioLevel } from '../audio/level.js';
import type { OceanParams } from './params.js';

/** How many wave trains are summed. Must match WAVES in the vertex shader. */
const WAVE_COUNT = 5;

const VERTEX = /* glsl */ `
  #define WAVES ${WAVE_COUNT}

  uniform float uTime;
  uniform float uHeight;
  uniform float uSteepness;
  uniform float uWindDir;
  uniform float uChoppiness;
  uniform float uLevel;

  varying vec3 vWorld;
  varying float vFoam;

  /**
   * Gerstner wave: points move in a circle rather than only up and down, which
   * gathers them toward the crests. That is what gives sharp peaks and broad
   * flat troughs — the actual silhouette of water — where a sum of sines just
   * makes a rolling blanket.
   */
  vec3 gerstner(vec2 pos, vec2 dir, float steepness, float wavelength, float t, inout float foam) {
    float k = 6.28318530718 / wavelength;
    float c = sqrt(9.8 / k);
    vec2 d = normalize(dir);
    float f = k * (dot(d, pos) - c * t);
    float a = steepness / k;

    // Accumulated horizontal compression approximates the Jacobian, which is
    // where real foam forms: at the crests, where the surface folds in on itself.
    foam += steepness * cos(f);

    return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
  }

  void main() {
    vec2 p = position.xz;
    float t = uTime;

    // Audio widens the waves rather than only raising them, so a loud passage
    // changes the shape of the water and not just its scale.
    float amp = uHeight * (0.75 + uLevel * 0.9);
    float steep = uSteepness * (0.85 + uLevel * 0.45);

    vec3 offset = vec3(0.0);
    float foam = 0.0;

    // Descending wavelengths: a few long swells carry the shape, short ripples
    // carry the detail.
    for (int i = 0; i < WAVES; i++) {
      float fi = float(i);
      float spread = (fi - float(WAVES - 1) * 0.5) * uChoppiness * 0.9;
      float angle = uWindDir + spread;
      vec2 dir = vec2(cos(angle), sin(angle));

      float wavelength = 62.0 / pow(1.65, fi);
      float weight = 1.0 / pow(1.45, fi);

      offset += gerstner(p, dir, steep * weight, wavelength, t, foam) * amp * weight;
    }

    vFoam = foam;

    vec3 displaced = position + offset;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
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
  uniform vec3 uLightDir;
  uniform float uSpecularPower;
  uniform float uSpecularStrength;
  uniform float uFoamThreshold;
  uniform float uFoamAmount;
  uniform float uLevel;

  varying vec3 vWorld;
  varying float vFoam;

  void main() {
    // Screen-space derivatives give the normal without a second geometry pass
    // and without normals going stale when the vertex displacement changes.
    vec3 dx = dFdx(vWorld);
    vec3 dy = dFdy(vWorld);
    vec3 normal = normalize(cross(dy, dx));
    if (normal.y < 0.0) normal = -normal;

    vec3 viewDir = normalize(uCamera - vWorld);
    vec3 lightDir = normalize(uLightDir);

    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 3.0);
    float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
    float spec = pow(clamp(dot(reflect(-lightDir, normal), viewDir), 0.0, 1.0), uSpecularPower);

    // Weighted toward the fog colour on purpose: the water is a backdrop, and
    // the lyric column has to stay legible on top of it. This is the single
    // most important line for the app actually being usable.
    vec3 color = mix(uFog, uSurface, clamp(diffuse * 0.35 + fresnel * 0.2, 0.0, 1.0));
    color = mix(color, uAtmosphere, fresnel * 0.22);
    color += uAtmosphere * spec * uSpecularStrength * (0.5 + uLevel * 0.8);

    float foam = smoothstep(uFoamThreshold, uFoamThreshold + 0.35, vFoam) * uFoamAmount;
    color = mix(color, mix(uAtmosphere, vec3(1.0), 0.55), foam);

    // Fade the far field into the CSS sky so there is no hard horizon seam.
    float dist = length(vWorld.xz - uCamera.xz);
    float alpha = smoothstep(240.0, 30.0, dist) * smoothstep(0.0, 10.0, dist);

    gl_FragColor = vec4(color, alpha);
  }
`;

export class OceanRenderer {
  #renderer: WebGLRenderer;
  #scene = new Scene();
  #camera: PerspectiveCamera;
  #material: ShaderMaterial;
  #frame = 0;
  #start = performance.now();
  #lastFrame = performance.now();
  /**
   * Accumulated *wave* time, advanced by dt × windSpeed each frame rather than
   * read from the wall clock. Multiplying elapsed time by the speed instead
   * would make every change to the slider jump the surface to a different
   * point in its cycle.
   */
  #waveTime = 0;
  #level = 0;
  #reactivity: number;
  #windSpeed: number;
  #disposed = false;

  constructor(canvas: HTMLCanvasElement, params: OceanParams) {
    this.#renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.#renderer.setClearColor(0x000000, 0);
    // Capped: this is a background, and a 3× retina buffer costs real battery
    // for a surface nobody is looking at directly.
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

    this.#camera = new PerspectiveCamera(52, 1, 0.1, 600);
    this.#camera.position.set(0, 4.2, 16);
    // Pitched up so the horizon sits low and the water stays a bottom-of-frame
    // backdrop rather than filling the screen behind the text.
    this.#camera.lookAt(new Vector3(0, 11, -60));

    this.#reactivity = params.reactivity;
    this.#windSpeed = params.windSpeed;

    const geometry = new PlaneGeometry(520, 520, 240, 240);
    geometry.rotateX(-Math.PI / 2);

    this.#material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uLevel: { value: 0 },
        uHeight: { value: params.height },
        uSteepness: { value: params.steepness },
        uWindDir: { value: params.windDirection },
        uChoppiness: { value: params.choppiness },
        uFoamThreshold: { value: params.foamThreshold },
        uFoamAmount: { value: params.foamAmount },
        uFog: { value: new Color(params.fog) },
        uSurface: { value: new Color(params.surface) },
        uAtmosphere: { value: new Color(params.atmosphere) },
        uCamera: { value: this.#camera.position.clone() },
        uLightDir: { value: lightVector(params) },
        uSpecularPower: { value: params.specularPower },
        uSpecularStrength: { value: params.specularStrength },
        uResolution: { value: new Vector2(1, 1) },
      },
    });

    const mesh = new Mesh(geometry, this.#material);
    mesh.position.set(0, 0, -140);
    this.#scene.add(mesh);

    this.#loop();
  }

  update(params: OceanParams): void {
    const u = this.#material.uniforms;
    u.uHeight!.value = params.height;
    u.uSteepness!.value = params.steepness;
    u.uWindDir!.value = params.windDirection;
    u.uChoppiness!.value = params.choppiness;
    u.uFoamThreshold!.value = params.foamThreshold;
    u.uFoamAmount!.value = params.foamAmount;
    u.uSpecularPower!.value = params.specularPower;
    u.uSpecularStrength!.value = params.specularStrength;
    (u.uFog!.value as Color).set(params.fog);
    (u.uSurface!.value as Color).set(params.surface);
    (u.uAtmosphere!.value as Color).set(params.atmosphere);
    (u.uLightDir!.value as Vector3).copy(lightVector(params));
    this.#reactivity = params.reactivity;
    this.#windSpeed = params.windSpeed;
  }

  /** Seconds since construction — the clock the animated themes are sampled on. */
  elapsedSec(): number {
    return (performance.now() - this.#start) / 1000;
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    (this.#material.uniforms.uResolution!.value as Vector2).set(width, height);
  }

  dispose(): void {
    this.#disposed = true;
    cancelAnimationFrame(this.#frame);
    this.#material.dispose();
    this.#scene.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    this.#renderer.dispose();
  }

  #loop = (): void => {
    if (this.#disposed) return;
    this.#frame = requestAnimationFrame(this.#loop);

    const now = performance.now();
    // Clamped: a backgrounded tab resumes with a huge dt, which would otherwise
    // teleport the surface forward by however long the user was away.
    const dt = Math.min((now - this.#lastFrame) / 1000, 0.1);
    this.#lastFrame = now;
    this.#waveTime += dt * this.#windSpeed;

    const target = audioLevel.value * this.#reactivity;
    // Eased so a spiky analyser reading never jolts the water.
    this.#level += (target - this.#level) * 0.08;

    this.#material.uniforms.uTime!.value = this.#waveTime;
    this.#material.uniforms.uLevel!.value = this.#level;
    this.#renderer.render(this.#scene, this.#camera);
  };
}

function lightVector(params: OceanParams): Vector3 {
  const { lightAzimuth: az, lightElevation: el } = params;
  return new Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
}

export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
