import { Color, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, WebGLRenderer } from 'three';
import type { WaveTheme } from '@lyrika/shared';
import { audioLevel } from '../audio/level';

/**
 * A single fullscreen shader pass: soft procedural light blobs (drawn as
 * radial falloffs in the fragment shader, no texture) seen through a
 * refraction field whose warp frequency/amplitude track the audio level —
 * a heat-shimmer/lens effect over the music rather than geometry of its own.
 */
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uLevel;
  uniform float uAspect;
  uniform vec3 uFog;
  uniform vec3 uSurface;
  uniform vec3 uAtmosphere;
  varying vec2 vUv;

  float blob(vec2 p, vec2 c, float r) {
    return r / (length(p - c) + 0.001);
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

    // Layered sine warp — frequency and amplitude both rise with the level,
    // so quiet passages sit nearly still and loud ones visibly bend the field.
    float warpAmp = 0.015 + uLevel * 0.05;
    vec2 warp;
    warp.x = sin(p.y * 6.0 + uTime * 0.6) * warpAmp;
    warp.y = cos(p.x * 5.0 - uTime * 0.5) * warpAmp;
    warp += sin((p.x + p.y) * 10.0 + uTime * 1.3) * warpAmp * 0.4;
    vec2 wp = p + warp;

    float b = 0.0;
    b += blob(wp, vec2(-0.32, 0.18) + 0.06 * vec2(sin(uTime * 0.31), cos(uTime * 0.27)), 0.05 + uLevel * 0.05);
    b += blob(wp, vec2(0.34, -0.1) + 0.05 * vec2(cos(uTime * 0.22), sin(uTime * 0.35)), 0.045 + uLevel * 0.04);
    b += blob(wp, vec2(0.0, 0.32) + 0.07 * vec2(sin(uTime * 0.18), cos(uTime * 0.24)), 0.04 + uLevel * 0.035);
    b = clamp(b * 0.06, 0.0, 1.0);

    vec3 color = mix(uFog, uSurface, b);
    color = mix(color, uAtmosphere, pow(b, 2.2) * 0.7);

    // Fade to fully transparent toward the frame edges so it reads as a
    // backdrop glow, not a hard-edged panel.
    float vign = smoothstep(0.75, 0.05, length(p));
    gl_FragColor = vec4(color, (0.22 + b * 0.55) * vign);
  }
`;

export interface RefractionOptions {
  theme: WaveTheme;
  waveHeight: number;
  reactivity: number;
}

export class RefractionRenderer {
  #renderer: WebGLRenderer;
  #scene = new Scene();
  #camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  #material: ShaderMaterial;
  #frame = 0;
  #start = performance.now();
  #level = 0;
  #reactivity: number;
  #disposed = false;

  constructor(canvas: HTMLCanvasElement, options: RefractionOptions) {
    this.#renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.#renderer.setClearColor(0x000000, 0);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.#reactivity = options.reactivity;

    this.#material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uLevel: { value: 0 },
        uAspect: { value: 1 },
        uFog: { value: new Color(options.theme.fog) },
        uSurface: { value: new Color(options.theme.surface) },
        uAtmosphere: { value: new Color(options.theme.atmosphere) },
      },
    });

    this.#scene.add(new Mesh(new PlaneGeometry(2, 2), this.#material));
    this.#loop();
  }

  update(options: RefractionOptions): void {
    (this.#material.uniforms.uFog!.value as Color).set(options.theme.fog);
    (this.#material.uniforms.uSurface!.value as Color).set(options.theme.surface);
    (this.#material.uniforms.uAtmosphere!.value as Color).set(options.theme.atmosphere);
    this.#reactivity = options.reactivity;
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#material.uniforms.uAspect!.value = width / height;
  }

  dispose(): void {
    this.#disposed = true;
    cancelAnimationFrame(this.#frame);
    this.#material.dispose();
    this.#renderer.dispose();
  }

  #loop = (): void => {
    if (this.#disposed) return;
    this.#frame = requestAnimationFrame(this.#loop);

    const target = audioLevel.value * this.#reactivity;
    this.#level += (target - this.#level) * 0.12;

    this.#material.uniforms.uTime!.value = (performance.now() - this.#start) / 1000;
    this.#material.uniforms.uLevel!.value = this.#level;
    this.#renderer.render(this.#scene, this.#camera);
  };
}
