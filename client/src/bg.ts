import * as THREE from 'three';

// ── Themes ──────────────────────────────────────────────
export interface Theme {
  name: string;
  surface: number; atmosphere: number; ring: number;
  fog: number; bgCss: string; wordCss: string; litCss: string;
}
export const THEMES: Theme[] = [
  { name:'Nebula',  surface:0x3a1060, atmosphere:0xb060ff, ring:0x8833dd, fog:0x080010, bgCss:'#060010', wordCss:'#e8e0ff', litCss:'#f0c8ff' },
  { name:'Lava',    surface:0x5a1000, atmosphere:0xff5520, ring:0xff8830, fog:0x100400, bgCss:'#0d0200', wordCss:'#ffe8d8', litCss:'#ffb090' },
  { name:'Ocean',   surface:0x002850, atmosphere:0x00aaff, ring:0x0066cc, fog:0x000812, bgCss:'#000810', wordCss:'#d0f0ff', litCss:'#80dfff' },
  { name:'Aurora',  surface:0x003830, atmosphere:0x00ffaa, ring:0x00dd88, fog:0x000c08, bgCss:'#000c08', wordCss:'#d0fff0', litCss:'#80ffcc' },
  { name:'Ember',   surface:0x301800, atmosphere:0xffcc00, ring:0xff9900, fog:0x0c0800, bgCss:'#0c0800', wordCss:'#fff8e0', litCss:'#ffe090' },
];
let activeTheme = THEMES[0];

// ── Renderer ────────────────────────────────────────────
const canvas = document.getElementById('bg') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 4, 28);
camera.lookAt(0, 0, 0);

// ── Shared starfield (all modes) ────────────────────────
const STARS = 2000;
const starPos = new Float32Array(STARS * 3);
for (let i = 0; i < STARS; i++) {
  const r = 120 + Math.random() * 80;
  const θ = Math.random() * Math.PI * 2;
  const φ = Math.acos(2 * Math.random() - 1);
  starPos[i*3]   = r * Math.sin(φ) * Math.cos(θ);
  starPos[i*3+1] = r * Math.sin(φ) * Math.sin(θ);
  starPos[i*3+2] = r * Math.cos(φ);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color:0xffffff, size:0.25, transparent:true, opacity:0.5 });
const stars = new THREE.Points(starGeo, starMat);

// ════════════════════════════════════════
// BG MODE: PLANET
// ════════════════════════════════════════
const PLANET_R = 7;
const planetGeo = new THREE.SphereGeometry(PLANET_R, 96, 64);
const pPos = planetGeo.attributes['position'] as THREE.BufferAttribute;
const pNrm = planetGeo.attributes['normal']   as THREE.BufferAttribute;
for (let i = 0; i < pPos.count; i++) {
  const x = pPos.getX(i), y = pPos.getY(i), z = pPos.getZ(i);
  const d = 0.22 * Math.sin(x*3.5+y*2.1)*Math.cos(z*2.7) + 0.12*Math.sin(x*7+z*5.3);
  pPos.setXYZ(i, x+pNrm.getX(i)*d, y+pNrm.getY(i)*d, z+pNrm.getZ(i)*d);
}
planetGeo.computeVertexNormals();
const planetMat = new THREE.MeshStandardMaterial({ color:activeTheme.surface, roughness:0.85, metalness:0.15, emissive:new THREE.Color(activeTheme.surface).multiplyScalar(0.12) });
const planet = new THREE.Mesh(planetGeo, planetMat);
const atmGeo  = new THREE.SphereGeometry(PLANET_R*1.08, 48, 32);
const atmMat  = new THREE.MeshBasicMaterial({ color:activeTheme.atmosphere, transparent:true, opacity:0.10, side:THREE.BackSide, blending:THREE.AdditiveBlending, depthWrite:false });
const atm     = new THREE.Mesh(atmGeo, atmMat);
const ringGeo = new THREE.TorusGeometry(PLANET_R*1.55, 0.12, 8, 120);
const ringMat = new THREE.MeshBasicMaterial({ color:activeTheme.ring, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending, depthWrite:false });
const ring    = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI*0.38;
const burstGeo = new THREE.TorusGeometry(PLANET_R, 0.06, 6, 80);
const burstMat = new THREE.MeshBasicMaterial({ color:activeTheme.atmosphere, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
const burst    = new THREE.Mesh(burstGeo, burstMat); burst.rotation.x = Math.PI*0.38;
const ambient  = new THREE.AmbientLight(0xffffff, 0.25);
const sunLight = new THREE.DirectionalLight(0xffffff, 2.2); sunLight.position.set(20,10,15);
const rimLight = new THREE.DirectionalLight(new THREE.Color(activeTheme.atmosphere), 1.0); rimLight.position.set(-12,-4,-8);
const planetGroup = new THREE.Group();
planetGroup.add(planet, atm, ring, burst);

// ════════════════════════════════════════
// BG MODE: COSMOS (nebula dust clouds)
// ════════════════════════════════════════
const COSMOS_N = 3000;
const cosmosPos = new Float32Array(COSMOS_N * 3);
const cosmosCol = new Float32Array(COSMOS_N * 3);
const cosmosSz  = new Float32Array(COSMOS_N);
for (let i = 0; i < COSMOS_N; i++) {
  // Dense core + sparse outer
  const layer = Math.random() < 0.4 ? Math.random()*18 : 18 + Math.random()*55;
  const θ = Math.random() * Math.PI * 2;
  const φ = (Math.random() - 0.5) * Math.PI * 0.6;
  cosmosPos[i*3]   = layer * Math.cos(θ) * Math.cos(φ);
  cosmosPos[i*3+1] = layer * Math.sin(φ) * (0.35 + Math.random()*0.4);
  cosmosPos[i*3+2] = layer * Math.sin(θ) * Math.cos(φ);
  cosmosSz[i] = 0.3 + Math.random() * 1.2;
  const t = Math.random();
  cosmosCol[i*3]   = 0.3 + t * 0.5;
  cosmosCol[i*3+1] = 0.05 + t * 0.1;
  cosmosCol[i*3+2] = 0.5 + t * 0.5;
}
const cosmosGeo = new THREE.BufferGeometry();
cosmosGeo.setAttribute('position', new THREE.BufferAttribute(cosmosPos, 3));
cosmosGeo.setAttribute('color', new THREE.BufferAttribute(cosmosCol, 3));
const cosmosMat = new THREE.PointsMaterial({ size:0.55, vertexColors:true, transparent:true, opacity:0.7, sizeAttenuation:true });
const cosmos = new THREE.Points(cosmosGeo, cosmosMat);
const cosmosWaveOffsets = new Float32Array(COSMOS_N).map(() => Math.random() * Math.PI * 2);
const cosmosBaseY = Float32Array.from(cosmosPos.filter((_, i) => i % 3 === 1));

// ════════════════════════════════════════
// BG MODE: STORM (electric arcs)
// ════════════════════════════════════════
function makeArc(radius: number): THREE.Line {
  const pts: THREE.Vector3[] = [];
  const steps = 18 + Math.floor(Math.random() * 14);
  let θ = Math.random() * Math.PI * 2;
  let φ = Math.random() * Math.PI;
  for (let i = 0; i < steps; i++) {
    θ += (Math.random() - 0.5) * 0.6;
    φ += (Math.random() - 0.5) * 0.4;
    const r = radius + (Math.random() - 0.5) * 3;
    pts.push(new THREE.Vector3(r*Math.sin(φ)*Math.cos(θ), r*Math.cos(φ), r*Math.sin(φ)*Math.sin(θ)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color:0x88ccff, transparent:true, opacity:0.0, blending:THREE.AdditiveBlending });
  return new THREE.Line(geo, mat);
}
const ARC_COUNT = 18;
const stormArcs: THREE.Line[] = Array.from({ length: ARC_COUNT }, () => makeArc(14 + Math.random()*10));
const stormGroup = new THREE.Group();
stormArcs.forEach(a => stormGroup.add(a));
// Thick sphere core for storm
const stormCoreMat = new THREE.MeshBasicMaterial({ color:0x112244, transparent:true, opacity:0.6 });
const stormCore = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 24), stormCoreMat);
stormGroup.add(stormCore);
const arcTimers = new Float32Array(ARC_COUNT).map(() => Math.random() * 2);

// ════════════════════════════════════════
// BG MODE: NEON CITY (grid + vertical lines)
// ════════════════════════════════════════
function makeGrid(): THREE.LineSegments {
  const geo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const cols:  number[] = [];
  const W = 80, D = 120, COLS = 22, ROWS = 30;
  for (let c = 0; c <= COLS; c++) {
    const x = -W/2 + (W/COLS)*c;
    verts.push(x,-8,0, x,-8,-D);
    const h = 0.4 + 0.6*(c/(COLS));
    cols.push(h,0.1,1-h*0.3, h,0.1,1-h*0.3);
  }
  for (let r = 0; r <= ROWS; r++) {
    const z = -(D/ROWS)*r;
    verts.push(-W/2,-8,z, W/2,-8,z);
    const h = 0.3 + 0.5*(r/ROWS);
    cols.push(0.2,0.1,h, 0.2,0.1,h);
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:0.55, blending:THREE.AdditiveBlending });
  return new THREE.LineSegments(geo, mat);
}
const neonGrid = makeGrid();
const BLDG_COUNT = 40;
const bldgGroup = new THREE.Group();
for (let i = 0; i < BLDG_COUNT; i++) {
  const h = 5 + Math.random() * 22;
  const g = new THREE.BoxGeometry(1.2 + Math.random()*2.5, h, 1.2 + Math.random()*2.5);
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.7+Math.random()*0.15, 1, 0.15), wireframe:true, transparent:true, opacity:0.4 });
  const b = new THREE.Mesh(g, m);
  b.position.set((Math.random()-0.5)*70, h/2-8, -10 - Math.random()*90);
  bldgGroup.add(b);
}
const neonGroup = new THREE.Group();
neonGroup.add(neonGrid, bldgGroup);
camera.position.set(0, 4, 28); // camera higher for neon

// ════════════════════════════════════════
// BG MODE: FLUID (wave mesh)
// ════════════════════════════════════════
const FLUID_W = 60, FLUID_H = 35, FLUID_SEG = 70;
const fluidGeo = new THREE.PlaneGeometry(FLUID_W, FLUID_H, FLUID_SEG, FLUID_SEG);
fluidGeo.rotateX(-Math.PI / 2.4);
const fluidMat = new THREE.MeshBasicMaterial({ color:activeTheme.atmosphere, wireframe:true, transparent:true, opacity:0.22, blending:THREE.AdditiveBlending });
const fluidMesh = new THREE.Mesh(fluidGeo, fluidMat);
fluidMesh.position.set(0, -6, -10);
const fluidBasePos = Float32Array.from((fluidGeo.attributes['position'] as THREE.BufferAttribute).array);

// ── Audio bands ─────────────────────────────────────────
export interface EnergyBands { bass:number; mid:number; treble:number; }
let bands: EnergyBands = { bass:0, mid:0, treble:0 };
export function setEnergyBands(b: EnergyBands): void { bands = b; }
export function setEnergy(v: number): void { bands = { bass:v, mid:v*0.6, treble:v*0.3 }; }

// ── Background mode ─────────────────────────────────────
export type BgMode = 'planet' | 'cosmos' | 'storm' | 'neon' | 'fluid';
let bgMode: BgMode = 'planet';

function rebuildScene(): void {
  // Clear scene (keep persistent objects)
  while (scene.children.length) scene.remove(scene.children[0]);

  scene.add(stars);

  switch (bgMode) {
    case 'planet':
      scene.background = new THREE.Color(activeTheme.fog);
      scene.add(ambient, sunLight, rimLight, planetGroup);
      camera.position.set(0, 4, 28); camera.lookAt(0, 0, 0);
      break;
    case 'cosmos':
      scene.background = new THREE.Color(0x02000c);
      scene.add(cosmos);
      camera.position.set(0, 8, 38); camera.lookAt(0, 0, 0);
      break;
    case 'storm':
      scene.background = new THREE.Color(0x010508);
      scene.add(stormGroup, new THREE.AmbientLight(0x334466, 1.0));
      camera.position.set(0, 0, 36); camera.lookAt(0, 0, 0);
      break;
    case 'neon':
      scene.background = new THREE.Color(0x00000a);
      scene.add(neonGroup);
      camera.position.set(0, 6, 20); camera.lookAt(0, -2, -40);
      break;
    case 'fluid':
      scene.background = new THREE.Color(activeTheme.fog);
      scene.add(new THREE.AmbientLight(0xffffff, 0.5), fluidMesh, stars);
      camera.position.set(0, 12, 30); camera.lookAt(0, 0, -5);
      break;
  }
}

export function setBgMode(m: BgMode): void { bgMode = m; rebuildScene(); }

// ── Theme ───────────────────────────────────────────────
export function setTheme(idx: number): void {
  activeTheme = THEMES[Math.max(0, Math.min(THEMES.length-1, idx))];
  planetMat.color.set(activeTheme.surface);
  planetMat.emissive.set(activeTheme.surface).multiplyScalar(0.12);
  atmMat.color.set(activeTheme.atmosphere);
  ringMat.color.set(activeTheme.ring);
  burstMat.color.set(activeTheme.atmosphere);
  rimLight.color.set(activeTheme.atmosphere);
  fluidMat.color.set(activeTheme.atmosphere);
  if (bgMode === 'planet' || bgMode === 'fluid') scene.background = new THREE.Color(activeTheme.fog);
  document.documentElement.style.setProperty('--word-color', activeTheme.wordCss);
  document.documentElement.style.setProperty('--lit-color', activeTheme.litCss);
  document.body.style.background = activeTheme.bgCss;
}

// ── Animate ─────────────────────────────────────────────
let t = 0, smoothBass = 0, burstScale = 1, burstAlpha = 0, prevBass = 0;

function animatePlanet(): void {
  smoothBass += (bands.bass - smoothBass) * 0.18;
  const spike = bands.bass - prevBass;
  if (spike > 0.12) { burstScale = 1.0; burstAlpha = 0.65 + bands.bass * 0.35; }
  prevBass = bands.bass;
  burstScale += (1.6 - burstScale) * 0.06;
  burstAlpha *= 0.88;
  burst.scale.setScalar(burstScale); burstMat.opacity = Math.max(0, burstAlpha);
  const breathe = 1 + smoothBass * 0.045;
  planet.scale.setScalar(breathe); atm.scale.setScalar(breathe * 1.015);
  atmMat.opacity = 0.08 + smoothBass * 0.18 + bands.mid * 0.06;
  planet.rotation.y  += 0.0012 + bands.mid * 0.003;
  planet.rotation.x   = Math.sin(t * 0.18) * 0.06;
  ring.rotation.z    += 0.0005 + bands.treble * 0.002;
  ringMat.opacity     = 0.40 + bands.treble * 0.35 + smoothBass * 0.20;
  rimLight.intensity  = 0.8 + bands.mid * 1.8 + smoothBass * 1.2;
  starMat.opacity     = 0.42 + Math.sin(t*1.1)*0.08 + bands.treble*0.15;
}

function animateCosmos(): void {
  const pos = cosmosGeo.attributes['position'].array as Float32Array;
  const amp  = 1.4 + bands.mid * 3.5;
  const energy = bands.bass * 0.5 + bands.mid * 0.5;
  for (let i = 0; i < COSMOS_N; i++) {
    pos[i*3+1] = cosmosBaseY[i] + Math.sin(t * 0.6 * (1+i*0.001) + cosmosWaveOffsets[i]) * amp;
  }
  cosmosGeo.attributes['position'].needsUpdate = true;
  cosmos.rotation.y += 0.0008 + bands.mid * 0.002;
  cosmosMat.opacity  = 0.55 + energy * 0.35;
  cosmosMat.size     = 0.42 + bands.bass * 0.4;
  starMat.opacity    = 0.35 + bands.treble * 0.2;
}

function animateStorm(): void {
  stormGroup.rotation.y += 0.003 + bands.mid * 0.005;
  for (let i = 0; i < ARC_COUNT; i++) {
    arcTimers[i] -= 0.016;
    const mat = (stormArcs[i].material as THREE.LineBasicMaterial);
    if (arcTimers[i] <= 0) {
      // Flash on beat or randomly
      const trigger = bands.bass > 0.35 || Math.random() < 0.02;
      if (trigger) {
        mat.opacity = 0.6 + bands.bass * 0.4;
        arcTimers[i] = 0.08 + Math.random() * 0.2;
      }
    } else {
      mat.opacity *= 0.88;
    }
  }
  stormCoreMat.opacity = 0.4 + bands.mid * 0.3;
  const col = new THREE.Color().setHSL(0.58 + bands.bass * 0.1, 0.9, 0.12 + bands.mid * 0.08);
  stormCoreMat.color.set(col);
}

function animateNeon(): void {
  // Camera drift like flying through city
  neonGroup.position.z -= 0.04 + bands.bass * 0.12;
  if (neonGroup.position.z < -60) neonGroup.position.z = 0;
  (neonGrid.material as THREE.LineBasicMaterial).opacity = 0.35 + bands.mid * 0.35;
  bldgGroup.children.forEach((b, i) => {
    const m = (b as THREE.Mesh).material as THREE.MeshBasicMaterial;
    m.opacity = 0.22 + bands.treble * 0.4 * (0.5 + 0.5 * Math.sin(t * 2 + i));
  });
  starMat.opacity = 0.2 + bands.treble * 0.25;
}

function animateFluid(): void {
  const pos = fluidGeo.attributes['position'].array as Float32Array;
  const count = pos.length / 3;
  for (let i = 0; i < count; i++) {
    const bx = fluidBasePos[i*3], bz = fluidBasePos[i*3+2];
    const wave = Math.sin(bx*0.25 + t*1.6 + bands.mid*2) * (1.5 + bands.bass * 5)
               + Math.sin(bz*0.18 + t*1.1 + bands.treble*1.5) * (0.8 + bands.mid * 3);
    pos[i*3+1] = fluidBasePos[i*3+1] + wave;
  }
  fluidGeo.attributes['position'].needsUpdate = true;
  fluidMat.opacity = 0.14 + bands.mid * 0.28 + bands.bass * 0.18;
  starMat.opacity  = 0.35 + Math.sin(t*1.2)*0.08;
}

function animate(): void {
  requestAnimationFrame(animate);
  t += 0.004;
  switch (bgMode) {
    case 'planet': animatePlanet(); break;
    case 'cosmos': animateCosmos(); break;
    case 'storm':  animateStorm();  break;
    case 'neon':   animateNeon();   break;
    case 'fluid':  animateFluid();  break;
  }
  renderer.render(scene, camera);
}

// Initialise
rebuildScene();
setTheme(0);
animate();

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
