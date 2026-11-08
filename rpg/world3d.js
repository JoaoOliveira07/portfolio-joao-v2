/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — 3D WORLD
   Buildings, trees, bushes and the whole ground (asphalt, markings,
   sidewalks with curbs, grass, plazas, street furniture) as real 3D,
   rendered with three.js through the same 2:1 isometric camera as the
   rest of the game.

   • Ground: rendered once into one big canvas that replaces the SVG ground.
     The SVG "light" layer (lamp pools, zone halos, markings) stays on top.
   • Objects: each building/tree keeps its own DOM element (depth sorting,
     walking behind, x-ray all unchanged); its SVG is swapped for a canvas
     holding the 3D render + the animated SVG details (smoke, beams…).
   • Redrawn only when something changes (zone lit / near) or for the few
     animated models (port crane, tech-stack layers).
   No WebGL → nothing happens, the SVG city stays.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoomEnvironment } from './assets/vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './assets/vendor/RoundedBoxGeometry.js';

const CITY = window.CITY;
const COARSE = matchMedia('(pointer: coarse)').matches;
// light mode: phones / low-memory devices get 3D only for the portfolio buildings + ground
const LIGHT = COARSE || (navigator.deviceMemory && navigator.deviceMemory <= 4);
window.__world3dStarted = true;
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const DPR = COARSE ? 1.15 : Math.min(1.85, Math.max(1.35, (window.devicePixelRatio || 1) * 1.2));   // the camera zooms in ×1.35
const GROUND_DPR = COARSE ? 1 : Math.min(1.45, window.devicePixelRatio || 1);

/* ── tiny seeded RNG ── */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/* ── iso camera: world X = u, Z = v, Y = height; 1 unit = 1 css px ── */
function isoCamera(offset) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, offset * 2);
  const M = new THREE.Matrix4().set(
     1,    0,   -1,    0,
    -0.5,  1,   -0.5,  0,
     0.5,  0.5,  0.5, -offset,
     0,    0,    0,    1);
  cam.matrixAutoUpdate = false;
  cam.matrixWorld.copy(M).invert();
  cam.matrixWorldInverse.copy(M);
  return cam;
}
/* ── time of day: light rig + how strongly anything emissive glows ──
   night is the reference look; by day the sun takes over and neon/windows
   fade to a hint. EM = multiplier applied to every emissive material. */
const PERIODS = {
  night: { hemi: [0xa9c2ff, 0x1a1d24, 1.25], amb: [0x404858, 0.6], key: [0xe6edff, 1.9, [-60, 140, 90]], rim: [0xffa060, 0.6], EM: 1, clear: 0x07090d },
  dusk:  { hemi: [0xffc9a8, 0x2a1f2a, 1.45], amb: [0x5a4858, 0.7], key: [0xffad6b, 2.6, [-140, 60, 40]], rim: [0x8a7bff, 0.55], EM: 0.75, clear: 0x1a1420 },
  dawn:  { hemi: [0xffd9e6, 0x2a2430, 1.5], amb: [0x585068, 0.7], key: [0xffd2b8, 2.4, [120, 70, 120]], rim: [0x9ab8ff, 0.5], EM: 0.5, clear: 0x1d1a26 },
  day:   { hemi: [0xe4f0ff, 0x6d6858, 2.1], amb: [0x8a94a6, 0.9], key: [0xfff3e2, 3.3, [-80, 160, 60]], rim: [0xc4dcff, 0.7], EM: 0.16, clear: 0x3a4452 },
};
let PERIOD = 'night';
function lights(scene, strength = 1, period = PERIOD) {
  const P = PERIODS[period];
  const hemi = new THREE.HemisphereLight(P.hemi[0], P.hemi[1], P.hemi[2] * strength);
  const amb = new THREE.AmbientLight(P.amb[0], P.amb[1] * strength);
  const key = new THREE.DirectionalLight(P.key[0], P.key[1] * strength); key.position.set(...P.key[2]);
  const rim = new THREE.DirectionalLight(P.rim[0], P.rim[1] * strength); rim.position.set(90, 50, -70);
  scene.add(hemi, amb, key, rim);
  return { hemi, amb, key, rim, strength };
}
function setLights(L, period) {
  const P = PERIODS[period], k = L.strength;
  L.hemi.color.setHex(P.hemi[0]); L.hemi.groundColor.setHex(P.hemi[1]); L.hemi.intensity = P.hemi[2] * k;
  L.amb.color.setHex(P.amb[0]); L.amb.intensity = P.amb[1] * k;
  L.key.color.setHex(P.key[0]); L.key.intensity = P.key[1] * k; L.key.position.set(...P.key[2]);
  L.rim.color.setHex(P.rim[0]); L.rim.intensity = P.rim[1] * k;
}
// scale every emissive material in a model by the period's EM (remembering its own base)
function applyEM(root, extra = null) {
  const EM = PERIODS[PERIOD].EM;
  root.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.emissiveIntensity === undefined) continue;
      if (m.userData.e0 === undefined) m.userData.e0 = m.emissiveIntensity;
      m.emissiveIntensity = m.userData.e0 * EM * (extra && extra.has(m) ? extra.get(m) : 1);
    }
  });
}
function newRenderer(alpha) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.0;
  return r;
}

/* ── canvas textures ── */
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h));
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
// A wall with a grid of windows. Returns { map, emissiveMap } sized to the face (units → px).
function facade({ w, h, cols, rows, y0 = 8, top = 6, lit = 0.2, colors = ['#ffd9a0'], wall = '#2b313a', seed = 1, style = 'punched', floorLines = true }) {
  const K = Math.min(3, 900 / Math.max(w, h));
  const r = rng(seed);
  const cells = [];
  const cw = w / cols, rh = (h - y0 - top) / rows;
  for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
    const on = r() < lit;
    cells.push({ c, k, on, col: colors[Math.floor(r() * colors.length)], dim: 0.55 + r() * 0.45, blind: r() < 0.3 });
  }
  const rect = (cell) => {
    const padX = style === 'curtain' ? 0.06 : 0.2, padY = style === 'curtain' ? 0.08 : 0.24;
    const x = (cell.c * cw + cw * padX) * K, wpx = cw * (1 - 2 * padX) * K;
    const yTop = h - (y0 + (cell.k + 1) * rh) + rh * padY;              // canvas y from the top
    return [x, yTop * K, wpx, rh * (1 - 2 * padY) * K];
  };
  const map = canvasTex(w * K, h * K, (g, W, H) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    if (floorLines && style !== 'curtain') {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      for (let k = 0; k <= rows; k++) g.fillRect(0, (h - (y0 + k * rh)) * K - 1.5 * K, W, 1.2 * K);
    }
    if (style === 'curtain') {                                        // glass curtain: mullion grid
      g.strokeStyle = 'rgba(160,180,200,0.25)'; g.lineWidth = 1;
      for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(c * cw * K, top * K); g.lineTo(c * cw * K, (h - y0) * K); g.stroke(); }
    }
    for (const cell of cells) {
      const [x, y, ww, hh] = rect(cell);
      if (cell.on) {
        const gg = g.createLinearGradient(0, y, 0, y + hh);
        gg.addColorStop(0, cell.col); gg.addColorStop(1, shade(cell.col, -0.35));
        g.fillStyle = gg; g.fillRect(x, y, ww, hh);
        if (cell.blind) { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let t = y + 2; t < y + hh * 0.5; t += 3) g.fillRect(x, t, ww, 1); }
      } else {
        const gg = g.createLinearGradient(x, y, x + ww, y + hh);
        gg.addColorStop(0, '#162130'); gg.addColorStop(0.5, '#0b111a'); gg.addColorStop(1, '#101824');
        g.fillStyle = gg; g.fillRect(x, y, ww, hh);
        g.fillStyle = 'rgba(160,200,255,0.06)'; g.beginPath(); g.moveTo(x, y + hh); g.lineTo(x + ww * 0.35, y); g.lineTo(x + ww * 0.5, y); g.lineTo(x + ww * 0.15, y + hh); g.fill();
      }
      if (style !== 'curtain') { g.strokeStyle = 'rgba(190,205,220,0.22)'; g.lineWidth = Math.max(1, K * 0.4); g.strokeRect(x, y, ww, hh); }
    }
  });
  const emissiveMap = canvasTex(w * K, h * K, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (const cell of cells) if (cell.on) { const [x, y, ww, hh] = rect(cell); g.globalAlpha = cell.dim; g.fillStyle = cell.col; g.fillRect(x, y, ww, hh); }
    g.globalAlpha = 1;
  });
  return { map, emissiveMap };
}
function shade(hex, f) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + f * hsl.l)));
  return '#' + c.getHexString();
}
function textTex(text, w, h, color, { font = '700', size = 0.62, bg = null, frame = false, spacing = 0.06 } = {}) {
  const K = 6;
  return canvasTex(w * K, h * K, (g, W, H) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); } else g.clearRect(0, 0, W, H);
    if (frame) { g.strokeStyle = color; g.lineWidth = K * 0.8; g.strokeRect(K, K, W - 2 * K, H - 2 * K); }
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = H * size; g.font = `${font} ${fs}px "Courier New", monospace`;
    if ('letterSpacing' in g) g.letterSpacing = `${fs * spacing}px`;
    while (g.measureText(text).width > W * 0.9 && fs > 6) { fs *= 0.92; g.font = `${font} ${fs}px "Courier New", monospace`; }
    g.fillText(text, W / 2, H / 2 + fs * 0.04);
  });
}
function noiseTex(size, base, spread, dots = 0, dotCol = null, seed = 7) {
  const r = rng(seed);
  return canvasTex(size, size, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * spread; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    if (dots) { g.fillStyle = dotCol; for (let k = 0; k < dots; k++) g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  }, true);
}

/* ── geometry helpers ── */
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
// rounded box sitting on y0 (width along X = 2a, depth along Z = 2b)
function rbox(w, h, d, r, mat, x = 0, y0 = 0, z = 0) {
  const rr = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.max(0.01, rr)), mat, x, y0 + h / 2, z);
}
const box = (w, h, d, mat, x = 0, y0 = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y0 + h / 2, z);
function cyl(rt, rb, h, mat, x = 0, y0 = 0, z = 0, seg = 18) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y0 + h / 2, z); }
function tube(a, b, r, mat, seg = 6) { // cylinder between two points
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
// plane facing +Z (on a wall whose outward normal is +Z) or +X
function wallPlane(w, h, mat, face, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  if (face === 'X') m.rotation.y = Math.PI / 2;
  return m;
}
function edges(m, opacity = 0.18, angle = 35) {
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, angle), new THREE.LineBasicMaterial({ color: 0xe6eef6, transparent: true, opacity })));
  return m;
}

/* ── shared materials ── */
const M = {
  concrete: new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.92 }),
  concreteDark: new THREE.MeshStandardMaterial({ color: 0x343a44, roughness: 0.9 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x2c323b, roughness: 0.95 }),
  trim: new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.6, metalness: 0.4 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x6a737e, roughness: 0.35, metalness: 0.9 }),
  metalDark: new THREE.MeshStandardMaterial({ color: 0x2c323a, roughness: 0.45, metalness: 0.8 }),
  glassDark: new THREE.MeshPhysicalMaterial({ color: 0x0a121c, roughness: 0.06, metalness: 0.75, clearcoat: 1, envMapIntensity: 1.3 }),
  glassClear: new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, envMapIntensity: 1.5, depthWrite: false }),
  door: new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 0.5 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x4a3c31, roughness: 0.9 }),
  red: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff3030, emissiveIntensity: 2.5 }),
};
const glow = (hex, intensity = 1.4) => new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(hex), emissiveIntensity: intensity });
const signMat = (tex, intensity = 1.5) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: intensity, transparent: true, alphaMap: null, map: tex });
const WALLS = ['#3d4450', '#4a443e', '#3a433d', '#4d4540', '#373f4c', '#444851'];

/* ════════════════════════════ LOW-RISE ════════════════════════════ */
function buildLowrise(sp) {
  const g = new THREE.Group();
  const { a, b, h } = sp;
  const wall = WALLS[Math.floor(sp.tone * WALLS.length)];
  g.add(rbox(2 * a + 12, 4, 2 * b + 12, 1.6, M.concrete));
  const w0 = sp.shop ? 30 : 8;
  const rows = Math.max(1, Math.round((h - w0 - 10) / 22));
  const mk = (w, cols, seed) => {
    if (h <= 40) return new THREE.MeshStandardMaterial({ color: wall, roughness: 0.85 });
    const t = facade({ w, h: h - 4, cols, rows, y0: w0, top: 6, lit: 0.22, wall, seed, colors: ['#ffd9a0', '#ffe9c8', '#ffcf86', '#b9d4ff'] });
    return new THREE.MeshStandardMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emissiveMap, emissiveIntensity: 0.9, roughness: 0.8 });
  };
  const plain = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.85 });
  const fL = mk(2 * a, Math.max(2, Math.round(a / 15)), sp.seed), fR = mk(2 * b, Math.max(2, Math.round(b / 15)), sp.seed + 1);
  g.add(edges(rbox(2 * a, h - 4, 2 * b, 2.4, [fR, plain, M.roof, plain, fL, plain], 0, 4, 0), 0.14));
  // parapet
  for (const [w, d, x, z] of [[2 * a, 2, 0, -b + 1], [2 * a, 2, 0, b - 1], [2, 2 * b, -a + 1, 0], [2, 2 * b, a - 1, 0]]) g.add(box(w, 3, d, M.concreteDark, x, h, z));
  if (sp.shop) {
    const { col, name } = sp.shop;
    const s0 = -a * 0.7, s1 = a * 0.35, cx = (s0 + s1) / 2, sw = s1 - s0;
    g.add(wallPlane(sw, 13, new THREE.MeshStandardMaterial({ color: 0x0a0d12, emissive: new THREE.Color(col), emissiveIntensity: 0.4, roughness: 0.1, metalness: 0.4 }), 'Z', cx, 12.5, b + 0.15));
    g.add(box(sw + 4, 1.2, 6, M.trim, cx, 19.5, b + 3));                         // awning
    g.add(box(sw + 4, 0.5, 0.5, glow(col, 1.4), cx, 19.4, b + 6));
    g.add(wallPlane(sw, 10, signMat(textTex(name, sw, 10, col, { frame: true })), 'Z', cx, 27, b + 0.6));
    g.add(wallPlane(a * 0.2, 16, M.door, 'Z', a * 0.58, 12, b + 0.15));
  }
  if (sp.fireEscape) {
    const v0 = -b * 0.55, v1 = b * 0.15, zc = (v0 + v1) / 2, L = v1 - v0;
    for (let hh = 30; hh < h - 14; hh += 24) {
      g.add(box(6, 0.8, L, M.metalDark, a + 3, hh, zc));
      g.add(box(0.5, 6, L, M.metalDark, a + 6, hh, zc));
      if (hh + 24 < h - 14) g.add(tube([a + 3, hh + 1, v1], [a + 3, hh + 24, v0], 0.5, M.metalDark));
    }
  }
  if (sp.roof === 'box') g.add(rbox(Math.min(28, a * 0.6), 12, Math.min(28, b * 0.6), 1.5, M.concreteDark, -a * 0.3, h, -b * 0.3));
  else if (sp.roof === 'tank') {
    const x = -a * 0.3, z = -b * 0.3;
    for (const dx of [-7, 7]) for (const dz of [-7, 7]) g.add(cyl(0.7, 0.7, 14, M.metalDark, x + dx * 0.7, h, z + dz * 0.7, 6));
    g.add(cyl(11, 11, 22, new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.85 }), x, h + 14, z));
    g.add(mesh(new THREE.ConeGeometry(12, 8, 18), M.roof, x, h + 40, z));
  } else if (sp.roof === 'antenna') {
    g.add(cyl(0.6, 1, 40, M.metal, 0, h, 0, 6));
    const s = mesh(new THREE.SphereGeometry(1.6, 10, 8), M.red, 0, h + 41, 0); g.add(s);
  }
  for (const { du, dv } of sp.acs) {
    g.add(rbox(16, 8, 12, 1, M.metal, du, h, dv));
    g.add(mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.4, 16), M.trim, du, h + 8.2, dv));
  }
  return g;
}

/* ════════════════════════════ TREES ════════════════════════════ */
const LEAF = ['#24503a', '#1f4733', '#2a5a41', '#234d37'];
// organic foliage: an icosphere pushed around by cheap 3D noise, coloured per
// vertex (sunlit tops, darker undersides) so it reads as volume, not facets
function foliage(radius, base, r, opts = {}) {
  const seg = (opts.detail ?? 2) >= 2 ? [18, 13] : [11, 8];         // indexed sphere → smooth shading
  const geo = new THREE.SphereGeometry(radius, seg[0], seg[1]);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const o1 = r() * 10, o2 = r() * 10, o3 = r() * 10, amp = opts.amp ?? 0.16, sq = opts.squash ?? 1;
  const c0 = new THREE.Color(base), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), L = Math.hypot(x, y, z) || 1;
    const nx = x / L, ny = y / L, nz = z / L;
    const n = Math.sin(nx * 3.1 + o1) * Math.cos(ny * 2.7 + o2) + Math.sin(nz * 3.7 + o3) * 0.6 + Math.sin((nx + nz) * 6.3 + o1) * 0.25;
    const k = 1 + amp * n;
    pos.setXYZ(i, x * k, y * k * sq, z * k);
    const light = 0.62 + 0.5 * (ny * 0.5 + 0.5) + 0.06 * n;      // top lighter, belly darker
    c.copy(c0).multiplyScalar(light);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, opts.mat || FOLIAGE);
}
const FOLIAGE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
const BARK = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.95 });
const BARK_ARAU = new THREE.MeshStandardMaterial({ color: 0x6b4f3a, roughness: 0.9 });
const LEAF_GREENS = ['#2f6b45', '#356f3f', '#2b6249', '#3c7444', '#2e5e3c'];
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function groundShadow(rx, rz, x = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.4, z); return m;
}
function buildTree(sp) {
  const g = new THREE.Group();
  const r = rng(sp.seed);
  const k = sp.big ? 1.25 : 1;
  if (sp.pine) {                          // araucária: tall bare trunk, flat "candelabra" crown
    const H = (82 + r() * 10) * k;
    g.add(groundShadow(26 * k, 26 * k, 6, 6));
    g.add(cyl(1.5 * k, 2.8 * k, H, BARK_ARAU, 0, 0, 0, 10));
    const tiers = [[H * 0.70, 24, 7], [H * 0.80, 21, 7], [H * 0.89, 16, 6], [H * 0.97, 9, 5]];
    for (const [y, len, n] of tiers) for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + r() * 0.5, L = len * k * (0.85 + r() * 0.3);
      const tipX = Math.cos(a) * L, tipZ = Math.sin(a) * L, tipY = y + L * 0.42;     // branches curve up at the tips
      g.add(tube([0, y, 0], [tipX * 0.6, y + L * 0.1, tipZ * 0.6], 0.55 * k, BARK_ARAU, 5));
      g.add(tube([tipX * 0.6, y + L * 0.1, tipZ * 0.6], [tipX, tipY, tipZ], 0.45 * k, BARK_ARAU, 5));
      const tuft = foliage(5.2 * k, '#264f33', r, { detail: 1, amp: 0.22, squash: 0.55 });
      tuft.position.set(tipX, tipY + 1, tipZ); g.add(tuft);
    }
    const top = foliage(7 * k, '#2a5838', r, { detail: 1, amp: 0.2, squash: 0.5 }); top.position.y = H + 3 * k; g.add(top);
    return g;
  }
  // broadleaf (or ipê in bloom): trunk that forks into branches, a crown of lumpy clusters
  const H = (44 + r() * 8) * k, crownY = H + 14 * k;
  g.add(groundShadow(30 * k, 30 * k, 8, 8));
  g.add(cyl(1.9 * k, 3.1 * k, H * 0.55, BARK, 0, 0, 0, 10));
  const fork = [0, H * 0.55, 0];
  const branchTips = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + r() * 0.8, d = (8 + r() * 6) * k;
    const tip = [Math.cos(a) * d, H * 0.55 + (14 + r() * 10) * k, Math.sin(a) * d];
    g.add(tube(fork, tip, (1.1 - i * 0.08) * k, BARK, 6)); branchTips.push(tip);
  }
  const ipeCol = sp.ipe === 'pink' ? ['#d9579a', '#e66aa8', '#c8478a'] : sp.ipe === 'yellow' ? ['#f2c230', '#e8b520', '#f7d050'] : null;
  const pick = () => ipeCol ? ipeCol[Math.floor(r() * ipeCol.length)] : LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)];
  // clusters: one big core + satellites around the branch tips
  const core = foliage(17 * k, pick(), r, { squash: 0.82 }); core.position.set(0, crownY, 0); g.add(core);
  branchTips.forEach(([x, y, z]) => { const f = foliage((10 + r() * 4) * k, pick(), r, { squash: 0.85 }); f.position.set(x * 1.35, y + 4 * k, z * 1.35); g.add(f); });
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, d = (10 + r() * 8) * k;
    const f = foliage((7 + r() * 4) * k, pick(), r, { detail: 1 });
    f.position.set(Math.cos(a) * d, crownY + (r() * 14 - 2) * k, Math.sin(a) * d); g.add(f);
  }
  if (ipeCol) {                                   // fallen petals
    const pm = new THREE.MeshStandardMaterial({ color: ipeCol[0], roughness: 0.9 });
    const pg = new THREE.CircleGeometry(0.9, 6);
    for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 24 * k;
      const p = new THREE.Mesh(pg, pm); p.rotation.x = -Math.PI / 2; p.position.set(4 + Math.cos(a) * d, 0.5, 4 + Math.sin(a) * d); g.add(p); }
  }
  return g;
}
/* ════════════════════════ STREET FURNITURE ════════════════════════
   Must match city.js · signalShape / lampShape (SIG / LAMP constants). */
const POLE = new THREE.MeshStandardMaterial({ color: 0x3a414b, roughness: 0.38, metalness: 0.85 });
const POLE_DARK = new THREE.MeshStandardMaterial({ color: 0x1c2128, roughness: 0.5, metalness: 0.6 });
const HOUSING = new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.55, metalness: 0.3 });
const LENS = new THREE.MeshPhysicalMaterial({ color: 0x0b0e12, roughness: 0.1, metalness: 0.2, clearcoat: 1 });
const REFLECT = new THREE.MeshStandardMaterial({ color: 0x241f05, emissive: 0xffd400, emissiveIntensity: 0.25, roughness: 0.6 });
const BASE = 5.2;
function buildLamp(sp) {
  const g = new THREE.Group(), H = 92, R = 18 * sp.d;
  g.add(cyl(2.6, 3.2, 3, POLE_DARK, 0, BASE, 0, 16));                 // foot
  g.add(cyl(1.9, 2.4, 6, POLE, 0, BASE + 3, 0, 16));                   // access door section
  g.add(cyl(0.95, 1.6, H - 13, POLE, 0, BASE + 9, 0, 14));             // tapered shaft
  g.add(cyl(1.4, 1.4, 1.2, POLE_DARK, 0, BASE + 40, 0, 14));           // collar
  // curved arm: up then out over the road
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, BASE + H - 5, 0), new THREE.Vector3(0, BASE + H + 1, 0), new THREE.Vector3(R * 0.85, BASE + H, 0));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.75, 8), POLE));
  // LED head: slim, angled along the arm, glowing underside
  const head = new THREE.Group();
  head.add(rbox(12, 2.2, 5.2, 1, HOUSING, 0, -1.1, 0));
  head.add(box(10, 0.3, 3.8, glow(sp.warm ? '#ffcf8a' : '#cfe8ff', 2.6), 0, -1.35, 0));
  head.position.set(R, BASE + H, 0); head.rotation.z = 0.06 * sp.d;
  g.add(head);
  return g;
}
function buildSignal() {
  const g = new THREE.Group(), H = 84, ARM = 40, top = BASE + H;
  g.add(cyl(3, 3.6, 3, POLE_DARK, 0, BASE, 0, 16));
  g.add(cyl(1.5, 2, H, POLE, 0, BASE, 0, 16));
  g.add(cyl(1.7, 1.7, 1.4, POLE_DARK, 0, top - 1.4, 0, 16));
  // mast arm (+v) with a brace
  g.add(tube([0, top - 6, 0], [0, top - 6, ARM + 3], 0.95, POLE, 10));
  g.add(tube([0, top - 17, 0.8], [0, top - 6.5, 16], 0.55, POLE, 8));
  g.add(cyl(1.3, 1.3, 1, POLE, 0, top - 6.5, ARM + 3, 10));
  // main head hanging under the arm, lenses facing +u
  const head = (y0, h, z, faceX, lensY, r) => {
    const hg = new THREE.Group();
    const w = faceX ? 4.6 : 6, d = faceX ? 6 : 4.4;
    hg.add(rbox(w, h, d, 1, HOUSING, 0, y0, z));
    for (const y of lensY) {
      const lens = cyl(r, r, 0.6, LENS, 0, 0, 0, 16);
      const visor = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.5, 2.6, 16, 1, true, -Math.PI / 2, Math.PI), HOUSING);
      visor.material = HOUSING.clone(); visor.material.side = THREE.DoubleSide;
      if (faceX) { lens.rotation.z = Math.PI / 2; lens.position.set(w / 2 + 0.2, y, z); visor.rotation.set(0, 0, Math.PI / 2); visor.rotation.x = 0; visor.position.set(w / 2 + 1.3, y, z); visor.rotation.set(Math.PI / 2, 0, Math.PI / 2); }
      else { lens.rotation.x = Math.PI / 2; lens.position.set(0, y, z + d / 2 + 0.2); visor.rotation.set(Math.PI / 2, Math.PI / 2, 0); visor.position.set(0, y, z + d / 2 + 1.3); }
      hg.add(lens); hg.add(visor);
    }
    return hg;
  };
  const main = head(54, 21, ARM - 4, true, [70, 64.4, 58.8], 2.1);
  // backboard with the yellow reflective rim (very Brazilian avenue)
  main.add(box(0.5, 25, 11, HOUSING, -2.6, 52, ARM - 4));
  main.add(box(0.4, 26.4, 12.4, REFLECT, -2.8, 51.3, ARM - 4));
  main.add(cyl(0.5, 0.5, 9, POLE, 0, 75, ARM - 4, 8));
  g.add(main);
  g.add(head(38, 17, 3, false, [51.5, 47, 42.5], 1.8));
  return g;
}

function buildBush(sp) {
  const g = new THREE.Group(); const r = rng(sp.seed);
  g.add(groundShadow(15, 13, 2, 2));
  const base = LEAF_GREENS[Math.floor(r() * LEAF_GREENS.length)];
  const blobs = [[0, 8, 0, 9], [-7, 6, 3, 7], [7, 6, -3, 7], [3, 6, 7, 6.5], [-4, 6, -7, 6.5], [0, 13, 0, 6.5]];
  blobs.forEach(([x, y, z, rad]) => { const m = foliage(rad, base, r, { detail: 2, amp: 0.2, squash: 0.85 }); m.position.set(x, y, z); g.add(m); });
  if (sp.flowers) {
    const tone = ['#ff6fae', '#ffffff', '#ffb347', '#c08cff'][Math.floor(r() * 4)];
    const fm = new THREE.MeshStandardMaterial({ color: tone, roughness: 0.6, emissive: new THREE.Color(tone), emissiveIntensity: 0.12 });
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, el = r() * 1.2, R = 9.5;
      g.add(mesh(new THREE.IcosahedronGeometry(1.1, 0), fm, Math.cos(a) * Math.cos(el) * R, 7 + Math.sin(el) * R * 0.75, Math.sin(a) * Math.cos(el) * R));
    }
  }
  return g;
}

/* ════════════════════════════ ZONE BUILDINGS ════════════════════════════
   Same footprints/heights as the SVG designs in city.js. Materials whose
   glow depends on the zone being visited are collected in `zm`. */
function zoneBuilders(color) {
  const zm = [];
  const zglow = (base = 1.2, hex = color) => { const m = glow(hex, base); m.userData.base = base; zm.push(m); return m; };
  const zfacade = (opts) => { const t = facade(opts); const m = new THREE.MeshStandardMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emissiveMap, emissiveIntensity: 0.85, roughness: opts.style === 'curtain' ? 0.2 : 0.8, metalness: opts.style === 'curtain' ? 0.35 : 0.05 }); m.userData.base = 0.85; zm.push(m); return m; };
  const zsign = (text, w, h, opts) => { const m = signMat(textTex(text, w, h, color, opts)); m.userData.base = 1.5; zm.push(m); return m; };
  return { zm, zglow, zfacade, zsign };
}

const ZONE3D = {
  // GARAGE: glass showroom, João's cars on turntables (models from vehicles.js)
  garage(color) {
    // open-top showroom: tall back walls with the signs and spotlights, a low glass
    // front so the iso camera sees every vehicle; light polished floor so the black Clio pops
    const Z = zoneBuilders(color), g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a434e, roughness: 0.3, metalness: 0.85 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xcfeaff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
    const floorM = new THREE.MeshPhysicalMaterial({ color: 0x9aa4af, roughness: 0.28, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.08 });
    const A = 118, Bz = 98, H = 58, y0 = 6, HF = H;   // glass front now runs full height (closed glass box)
    g.add(rbox(A * 2 + 6, y0, Bz * 2 + 6, 2, M.concreteDark));
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(A * 2 - 2, Bz * 2 - 2), floorM); fl.rotation.x = -Math.PI / 2; fl.position.y = y0 + 0.05; g.add(fl);
    for (let x = -A + 30; x < A; x += 30) g.add(box(0.35, 0.06, Bz * 2 - 4, new THREE.MeshStandardMaterial({ color: 0x7d8792 }), x, y0 + 0.06, 0));
    for (let z = -Bz + 30; z < Bz; z += 30) g.add(box(A * 2 - 4, 0.06, 0.35, new THREE.MeshStandardMaterial({ color: 0x7d8792 }), 0, y0 + 0.06, z));
    // back walls (−X, −Z): tall, dark, with neon lines, the signs and a row of spotlights
    const wallM = new THREE.MeshStandardMaterial({ color: 0x1e252e, roughness: 0.6 });
    g.add(box(4, H, Bz * 2 + 4, wallM, -A - 1, y0, 0)); g.add(box(A * 2 + 4, H, 4, wallM, 0, y0, -Bz - 1));
    g.add(box(0.6, 1, Bz * 2 - 4, Z.zglow(1.8), -A + 1.4, y0 + 8, 0)); g.add(box(A * 2 - 4, 1, 0.6, Z.zglow(1.8), 0, y0 + 8, -Bz + 1.4));
    g.add(wallPlane(150, 22, Z.zsign('GARAGEM', 150, 22, { size: 0.82, spacing: 0.3 }), 'Z', -10, y0 + H - 18, -Bz + 1.2));
    g.add(wallPlane(130, 14, Z.zsign('OS CARROS DO JOÃO', 130, 14, { size: 0.62, spacing: 0.14 }), 'X', -A + 1.2, y0 + H - 16, 6));
    g.add(box(A * 2 + 8, 3, 8, steel, 0, y0 + H, -Bz + 1)); g.add(box(8, 3, Bz * 2 + 8, steel, -A + 1, y0 + H, 0));      // wall caps / light rails
    const spot = (x, z, rx, rz) => { const s = new THREE.Group(); s.add(cyl(2.2, 1.6, 4.5, M.metalDark, 0, -4.5, 0, 12)); s.add(cyl(1.7, 1.7, 0.3, glow('#fff6e0', 3), 0, -4.7, 0, 12)); s.position.set(x, y0 + H - 1, z); s.rotation.set(rx, 0, rz); g.add(s); };
    for (let x = -A + 30; x < A; x += 50) spot(x, -Bz + 5, 0.7, 0);
    for (let z = -Bz + 30; z < Bz; z += 50) spot(-A + 5, z, 0, -0.7);
    // low glass front (+X, +Z) with a steel handrail, corner posts and the entrance gap
    const front = (w, x, z, faceX) => { const p = wallPlane(w, HF, glass, faceX ? 'X' : 'Z', x, y0 + HF / 2, z); g.add(p); };
    front(A * 2 - 40, -20, Bz, false); front(Bz * 2, A, 0, true);
    g.add(box(A * 2, 1, 1.4, steel, 0, y0 + HF, Bz)); g.add(box(1.4, 1, Bz * 2, steel, A, y0 + HF, 0));
    // glass over the entrance (above the portal) + a glass roof on a light steel grid
    { const over = H - 34; g.add(wallPlane(40, over, glass, 'Z', A - 20, y0 + 34 + over / 2, Bz)); }
    { const roofGlass = glass.clone(); roofGlass.opacity = 0.1; roofGlass.envMapIntensity = 0.8;
      const rf = new THREE.Mesh(new THREE.PlaneGeometry(A * 2, Bz * 2), roofGlass); rf.rotation.x = -Math.PI / 2; rf.position.set(0, y0 + H + 1.6, 0); g.add(rf);
      for (let x = -A + 39; x < A; x += 39) g.add(box(0.5, 0.5, Bz * 2, steel, x, y0 + H + 1.3, 0));
      for (let z = -Bz + 39.2; z < Bz; z += 39.2) g.add(box(A * 2, 0.5, 0.5, steel, 0, y0 + H + 1.3, z));
      g.add(box(A * 2 + 4, 1.6, 2, steel, 0, y0 + H + 0.8, Bz)); g.add(box(2, 1.6, Bz * 2 + 4, steel, A, y0 + H + 0.8, 0)); }
    for (let x = -A; x <= A - 40; x += 39) g.add(box(1.6, HF, 1.6, steel, x, y0, Bz));
    for (let z = -Bz; z <= Bz; z += 39.2) g.add(box(1.6, HF, 1.6, steel, A, y0, z));
    g.add(box(2.4, H, 2.4, steel, A - 40, y0, Bz)); g.add(box(2.4, H, 2.4, steel, A, y0, Bz)); g.add(box(42, 3, 3, steel, A - 20, y0 + 34, Bz));   // entrance portal
    // glass double door filling the entrance: two framed leaves, vertical pull handles, threshold
    for (const k of [-1, 1]) {
      const cx = A - 20 + k * 9.6;
      g.add(wallPlane(18.4, 32.4, glass, 'Z', cx, y0 + 16.6, Bz));
      for (const dx of [-9.1, 9.1]) g.add(box(0.9, 32.4, 1.0, steel, cx + dx, y0 + 0.4, Bz));
      for (const y of [0.4, 32.4]) g.add(box(19.2, 0.9, 1.0, steel, cx, y0 + y, Bz));
      g.add(box(0.6, 10, 0.6, steel, A - 20 + k * 2.2, y0 + 12, Bz + 1.1));
    }
    g.add(box(40, 0.5, 2.2, steel, A - 20, y0, Bz));
    g.add(wallPlane(36, 5, Z.zsign('ENTRADA', 36, 5, { size: 0.7, spacing: 0.25 }), 'Z', A - 20, y0 + 30, Bz + 1.6));
    g.add(box(36, 0.3, 14, new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.9 }), A - 20, y0 + 0.1, Bz + 8));
    // turntables + vehicles (the bike sits on a raised plinth)
    const turn = [];                                     // turntables that spin, like the showroom
    const spots = [['cruze', -46, -40, 0.62, 0], ['hb20', 56, -44, 2.45, 0], ['clio', -50, 46, -0.62, 0], ['xtz', 62, 50, 2.5, 9]];
    for (const [id, x, z, ry, lift] of spots) {
      const R = id === 'xtz' ? 24 : 37;
      if (lift) g.add(cyl(R, R + 2, lift, new THREE.MeshPhysicalMaterial({ color: 0x4a5561, roughness: 0.3, metalness: 0.5, clearcoat: 1 }), x, y0, z, 40));
      g.add(cyl(R, R, 1.2, new THREE.MeshPhysicalMaterial({ color: 0x5c6773, roughness: 0.25, metalness: 0.5, clearcoat: 1 }), x, y0 + lift, z, 48));
      const rr = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 6, 64), Z.zglow(2.2)); rr.rotation.x = Math.PI / 2; rr.position.set(x, y0 + lift + 1.3, z); g.add(rr);
      const G = window.JOPES_GARAGE;
      if (G) { const v = G.build(id); v.visible = true;
        // centre it on its turntable (whatever its own origin is), then let it spin there
        const piv = new THREE.Group(); piv.position.set(x, y0 + lift + 1.2, z); piv.rotation.y = ry; g.add(piv);
        if (id === 'xtz') v.scale.setScalar(1.15);
        piv.add(v); piv.updateMatrixWorld(true);
        const bb = new THREE.Box3(); v.traverse(o => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') bb.expandByObject(o); });
        const c = piv.worldToLocal(bb.getCenter(new THREE.Vector3())); v.position.x -= c.x; v.position.z -= c.z;
        turn.push(piv); }
      const pl = new THREE.PointLight(0xfff4e6, 1.8, 140, 0); pl.position.set(x - 20, y0 + H, z - 20); g.add(pl);
    }
    return { g, zm: Z.zm, update: (t) => { turn.forEach((p, i) => { p.rotation.y = t * 0.35 + i * Math.PI / 2; }); return false; } };
  },

  main(color) {
    const Z = zoneBuilders(color), g = new THREE.Group();
    g.add(rbox(200, 14, 200, 3, M.concrete));
    const lobby = Z.zfacade({ w: 172, h: 38, cols: 6, rows: 1, y0: 4, top: 4, lit: 0.9, colors: ['#ffe9a8'], wall: '#1a1f27', seed: 3, style: 'curtain' });
    g.add(rbox(172, 38, 172, 2, [lobby, M.glassDark, M.roof, M.roof, lobby, M.glassDark], 0, 14, 0));
    g.add(rbox(68, 6, 28, 1.5, M.concreteDark, 0, 44, 104));
    g.add(box(68, 0.6, 0.6, Z.zglow(2.4), 0, 44, 118));
    const tw = Z.zfacade({ w: 140, h: 240, cols: 4, rows: 10, y0: 8, top: 8, lit: 0.45, colors: ['#ffe27a', '#ffd36b', '#fff1c4'], wall: '#22303f', seed: 11, style: 'curtain' });
    const tw2 = Z.zfacade({ w: 140, h: 240, cols: 4, rows: 10, y0: 8, top: 8, lit: 0.38, colors: ['#ffe27a', '#ffd36b', '#fff1c4'], wall: '#1d2a37', seed: 12, style: 'curtain' });
    g.add(edges(rbox(140, 240, 140, 2.5, [tw2, M.glassDark, M.roof, M.roof, tw, M.glassDark], 0, 52, 0), 0.12));
    g.add(box(1.4, 240, 1.4, Z.zglow(1.6), 70, 52, 70));                         // neon corner
    // glass elevator shaft bolted to the front (+v) face: steel frame, rails,
    // glass skin, machine room on top. The cab itself rides in city.js's fx layer.
    {
      const steel = new THREE.MeshStandardMaterial({ color: 0x59636f, roughness: 0.35, metalness: 0.9 });
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xa8d8ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
      const y0 = 52, y1 = 280, H = y1 - y0, zc = 75;   // stops under the crown: the JOPES sign stays clear
      g.add(box(18, H, 1, new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.4, metalness: 0.6 }), 0, y0, 70.6));   // dark back panel
      for (const x of [-6, 6]) g.add(box(1, H, 1, M.metal, x, y0, 71.8));                                              // guide rails
      for (const [x, z] of [[-10, 80], [10, 80], [10, 70.8], [-10, 70.8]]) g.add(box(1.8, H, 1.8, steel, x, y0, z));   // corner columns
      for (let y = y0; y <= y1; y += 26) {                                                                              // floor rings
        g.add(box(21.8, 1.4, 1.8, steel, 0, y, 80));
        for (const x of [-10, 10]) g.add(box(1.8, 1.4, 10.8, steel, x, y, zc + 0.4));
      }
      g.add(wallPlane(20, H, glass, 'Z', 0, y0 + H / 2, 80));
      const side = wallPlane(10, H, glass, 'X', 10, y0 + H / 2, zc); g.add(side);
      g.add(wallPlane(10, H, glass, 'X', -10, y0 + H / 2, zc));
      for (const x of [-10.9, 10.9]) g.add(box(0.5, H, 0.5, Z.zglow(1.5), x, y0, 80.9));                              // accent strips
      g.add(rbox(24, 10, 13, 1.2, M.concreteDark, 0, y1, zc));                                                          // machine room
      g.add(box(24.4, 1, 13.4, steel, 0, y1 + 10, zc));
      g.add(box(16, 0.6, 0.6, Z.zglow(2), 0, y1 + 5, zc + 6.6));
      g.add(rbox(28, 4, 16, 1, M.concreteDark, 0, y0 - 2, zc + 1));                                                     // pit cover at the lobby roof
    }
    const crown = rbox(116, 34, 116, 2, M.concreteDark, 0, 292, 0); g.add(edges(crown, 0.2));
    g.add(wallPlane(100, 22, Z.zsign('JOPES', 100, 22, { size: 0.8, spacing: 0.15 }), 'Z', 0, 309, 58.3));
    g.add(wallPlane(60, 22, Z.zsign('HQ', 60, 22, { size: 0.8 }), 'X', 58.3, 309, 0));
    // helipad
    const pad = new THREE.Mesh(new THREE.CircleGeometry(34, 40), new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.8 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(8, 326.2, 8); g.add(pad);
    const ring = new THREE.Mesh(new THREE.RingGeometry(31, 33, 48), Z.zglow(1.4)); ring.rotation.x = -Math.PI / 2; ring.position.set(8, 326.3, 8); g.add(ring);
    const H = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), Z.zsign('H', 26, 26, { size: 0.9 })); H.rotation.x = -Math.PI / 2; H.rotation.z = Math.PI / 4; H.position.set(8, 326.4, 8); g.add(H);
    g.add(cyl(1, 1.5, 74, M.metal, -44, 326, -44, 8));
    g.add(rbox(16, 10, 16, 1.5, M.metal, 44, 326, 44));
    return { g, zm: Z.zm };
  },

  projects(color) {
    const Z = zoneBuilders(color), g = new THREE.Group();
    // billboard
    for (const x of [-50, 50]) g.add(box(2, 128, 2, M.metalDark, x, 0, -78));
    g.add(box(168, 62, 3, M.trim, 0, 90, -79.5));
    g.add(wallPlane(160, 34, Z.zsign('</> PROJETOS', 160, 34, { size: 0.62 }), 'Z', 0, 128, -77.8));
    g.add(wallPlane(160, 14, Z.zsign('DEPLOY PORT · 08 REPOS', 160, 14, { size: 0.55, font: '400' }), 'Z', 0, 104, -77.8));
    // containers: 2 rows × 4, ribbed steel, painted, numbered on the roof
    const COLS = ['#b4313a', '#2c5c8f', '#c46a1c', '#2f7d6d', '#7b3fa0', '#a8933b', '#3d4f63', '#b23f7a'];
    const rows = [-24, 24], cols = [-114, -38, 38, 114];
    let n = 0;
    for (const z of rows) for (const x of cols) {
      const c = COLS[n];
      const rib = canvasTex(136, 68, (gx, W, H) => {
        gx.fillStyle = c; gx.fillRect(0, 0, W, H);
        for (let i = 0; i < W; i += 6) { gx.fillStyle = 'rgba(0,0,0,0.28)'; gx.fillRect(i, 0, 2, H); gx.fillStyle = 'rgba(255,255,255,0.08)'; gx.fillRect(i + 3, 0, 1, H); }
        gx.fillStyle = 'rgba(255,255,255,0.75)'; gx.font = 'bold 13px "Courier New", monospace'; gx.fillText('JOPES LINE', 8, 22);
      });
      const side = new THREE.MeshStandardMaterial({ map: rib, roughness: 0.6, metalness: 0.5 });
      const roofT = canvasTex(136, 72, (gx, W, H) => { gx.fillStyle = shade(c, -0.2); gx.fillRect(0, 0, W, H); gx.fillStyle = '#fff'; gx.font = 'bold 26px "Courier New", monospace'; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillText('P/00' + (n + 1), W / 2, H / 2); });
      const top = new THREE.MeshStandardMaterial({ map: roofT, roughness: 0.6, metalness: 0.4, emissive: 0xffffff, emissiveMap: roofT, emissiveIntensity: 0.25 });
      g.add(edges(box(68, 34, 36, [side, side, top, side, side, side], x, 0, z), 0.12));
      n++;
    }
    // gantry crane (moves along u)
    const crane = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: 0xd9b220, roughness: 0.5, metalness: 0.5 });
    for (const z of [-64, 64]) { crane.add(box(4, 118, 4, yellow, 0, 0, z)); crane.add(tube([0, 40, z], [0, 0, z * 0.62], 1, yellow)); }
    crane.add(box(8, 8, 140, yellow, 0, 116, 0));
    crane.add(rbox(18, 12, 18, 1, M.metalDark, 0, 104, 8));
    crane.add(cyl(0.4, 0.4, 26, M.metal, 0, 78, 8, 4));
    crane.add(edges(box(60, 26, 28, [Z.zglow(0.55), Z.zglow(0.55), Z.zglow(0.7), Z.zglow(0.55), Z.zglow(0.55), Z.zglow(0.55)], 0, 52, 8), 0.3));
    g.add(crane);
    return { g, zm: Z.zm, update: (t) => { crane.position.x = -100 * Math.cos(t * Math.PI * 2 / 14); } };
  },

  lab0(color) { // the plant
    const Z = zoneBuilders(color), g = new THREE.Group();
    const A = 92, B = 70, H = 70;
    g.add(cyl(11, 12, 120, M.metal, -70, 70, -52)); g.add(cyl(9, 10, 90, M.metal, -30, 70, -60));
    for (const [x, z, h] of [[-70, -52, 190], [-30, -60, 160]]) g.add(mesh(new THREE.TorusGeometry(10.5, 1.2, 6, 18), M.red, x, h - 6, z).rotateX(Math.PI / 2));
    const fL = Z.zfacade({ w: 2 * A, h: H, cols: 7, rows: 1, y0: 30, top: 10, lit: 0.85, colors: [shade(color, -0.25)], wall: '#3a414b', seed: 21 });
    const plain = new THREE.MeshStandardMaterial({ color: 0x3a414b, roughness: 0.85 });
    g.add(edges(rbox(2 * A, H, 2 * B, 2, [plain, plain, M.roof, plain, fL, plain]), 0.14));
    g.add(wallPlane(32, 30, M.door, 'Z', -30, 15, B + 0.2));
    for (let k = 0; k < 4; k++) {                                   // sawtooth roof, glazing faces +u
      const u0 = -A + k * (2 * A / 4), u1 = u0 + 2 * A / 4;
      const sh = new THREE.Shape(); sh.moveTo(u0, H); sh.lineTo(u1, H); sh.lineTo(u1, H + 30); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 2 * B, bevelEnabled: false }); geo.translate(0, 0, -B);
      g.add(edges(new THREE.Mesh(geo, M.roof), 0.18));
      g.add(wallPlane(2 * B - 4, 28, new THREE.MeshPhysicalMaterial({ color: 0x062a28, emissive: new THREE.Color(color), emissiveIntensity: 0.32, roughness: 0.1, metalness: 0.5 }), 'X', u1 + 0.3, H + 15, 0));
    }
    g.add(wallPlane(120, 10, Z.zsign('BACKEND LAB · R&D', 120, 10, { size: 0.6 }), 'Z', 0, 18, B + 0.4));
    return { g, zm: Z.zm };
  },
  lab1(color) { // glass reactors
    const Z = zoneBuilders(color), g = new THREE.Group();
    [[0, -40, 70], [0, 34, 82]].forEach(([x, z, lvl]) => {
      g.add(rbox(60, 8, 60, 1.5, M.concreteDark, x, 0, z));
      g.add(cyl(21, 21, lvl - 12, Z.zglow(0.38, shade(color, -0.35)), x, 12, z, 28));
      g.add(cyl(26, 26, 96, M.glassClear, x, 8, z, 32));
      g.add(cyl(27, 27, 4, M.metal, x, 104, z, 32));
      g.add(rbox(16, 12, 16, 1, M.metalDark, x, 104, z));
      g.add(tube([x, 120, z], [x - 70, 120, z], 2, M.metal)); g.add(tube([x, 112, z], [x, 120, z], 2, M.metal));
      for (const a of [0, 1, 2, 3]) g.add(box(1, 96, 1, M.metalDark, x + Math.cos(a * Math.PI / 2 + 0.4) * 26, 8, z + Math.sin(a * Math.PI / 2 + 0.4) * 26));
    });
    return { g, zm: Z.zm };
  },
  lab2(color) { // conveyor
    const Z = zoneBuilders(color), g = new THREE.Group();
    g.add(rbox(28, 6, 112, 1, M.metalDark, 0, 10, 0));
    g.add(box(24, 0.6, 108, new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.95 }), 0, 16, 0));
    for (const z of [-46, 0, 46]) for (const x of [-11, 11]) g.add(box(2, 10, 2, M.metal, x, 0, z));
    g.add(box(0.5, 0.5, 108, Z.zglow(2.2), 14.2, 13, 0));
    g.add(wallPlane(24, 6, Z.zsign('200 OK', 24, 6), 'Z', 0, 13, 56.2));
    return { g, zm: Z.zm };
  },

  about0(color) { // the house
    const Z = zoneBuilders(color), g = new THREE.Group();
    const a = 84, b = 68, H = 82, R = 140, o = 10;
    const wall = new THREE.MeshStandardMaterial({ color: 0x4f4c58, roughness: 0.9 });
    g.add(edges(rbox(2 * a, H, 2 * b, 1.5, wall), 0.12));
    const win = Z.zglow(0.9);
    for (const [u0, u1] of [[-62, -36], [-22, 4]]) {
      g.add(wallPlane(u1 - u0, 32, win, 'Z', (u0 + u1) / 2, 46, b + 0.2));
      g.add(box(u1 - u0 + 4, 5, 6, new THREE.MeshStandardMaterial({ color: 0x2a1f3c, roughness: 0.9 }), (u0 + u1) / 2, 24, b + 3));
      for (let i = 0; i < 4; i++) g.add(mesh(new THREE.SphereGeometry(1.6, 6, 4), glow(['#ff7ac8', '#ffd36b', '#9bff9b'][i % 3], 1.4), u0 + 4 + i * (u1 - u0 - 8) / 3, 30, b + 4));
    }
    g.add(wallPlane(24, 50, Z.zglow(1.2), 'Z', 42, 25, b + 0.2));
    for (const [v0, v1] of [[-46, -14], [14, 46]]) g.add(wallPlane(v1 - v0, 30, win, 'X', a + 0.2, 47, -(v0 + v1) / 2));
    // gable roof, ridge along X
    const sh = new THREE.Shape(); sh.moveTo(-b - o, H - 6); sh.lineTo(b + o, H - 6); sh.lineTo(0, R); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: 2 * a + 2 * o, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 });
    rg.translate(0, 0, -(a + o)); rg.rotateY(Math.PI / 2);
    const shingles = canvasTex(256, 256, (gx, W, Hh) => { gx.fillStyle = '#24222b'; gx.fillRect(0, 0, W, Hh); for (let y = 0; y < Hh; y += 10) { gx.fillStyle = 'rgba(0,0,0,0.35)'; gx.fillRect(0, y, W, 2); for (let x = (y / 10 % 2) * 8; x < W; x += 16) gx.fillRect(x, y, 1.5, 10); } }, true);
    shingles.repeat.set(0.04, 0.04);
    g.add(edges(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: shingles, roughness: 0.9 })), 0.16));
    g.add(rbox(20, 66, 20, 1, new THREE.MeshStandardMaterial({ color: 0x4a3a34, roughness: 0.9 }), -40, 96, -30));
    g.add(mesh(new THREE.SphereGeometry(2.2, 8, 6), glow('#ffd9a0', 3), 60, 56, b + 6));
    return { g, zm: Z.zm };
  },
  about1() { // mailbox
    const g = new THREE.Group();
    g.add(cyl(1, 1, 22, M.metalDark, 0, 0, 0, 6));
    g.add(rbox(18, 12, 10, 3, new THREE.MeshStandardMaterial({ color: 0x4b5a6b, roughness: 0.5, metalness: 0.6 }), 0, 22, 0));
    g.add(box(1, 12, 6, M.red, -6, 34, 5));
    return { g, zm: [] };
  },

  stack(color) {
    const Z = zoneBuilders(color), g = new THREE.Group();
    const names = ['AWS · TERRAFORM', 'POSTGRES · REDIS', 'KAFKA · RABBITMQ', 'SPRING BOOT 3', 'JAVA 17+'];
    const layers = [];
    names.forEach((name, k) => {
      const sz = 96 - k * 9, h0 = k * 46, L = new THREE.Group();
      const lbl = textTex(name, 2 * sz, 34, color, { size: 0.32, bg: '#262d38' });
      const faceL = new THREE.MeshStandardMaterial({ map: lbl, emissive: 0xffffff, emissiveMap: lbl, emissiveIntensity: 0.7, roughness: 0.7 }); faceL.userData.base = 0.7; Z.zm.push(faceL);
      const dark = new THREE.MeshStandardMaterial({ color: 0x262d38, roughness: 0.7 });
      L.add(edges(rbox(2 * sz, 34, 2 * sz, 2.5, [dark, dark, dark, dark, faceL, dark], 0, h0, 0), 0.18));
      L.add(rbox(2 * (sz - 7), 12, 2 * (sz - 7), 2, Z.zglow(0.42, shade(color, -0.3)), 0, h0 + 34, 0));
      g.add(L); layers.push(L);
    });
    const top = new THREE.Group();
    top.add(rbox(100, 10, 100, 2, new THREE.MeshStandardMaterial({ color: 0x262d38, roughness: 0.7 }), 0, 230, 0));
    top.add(rbox(24, 24, 24, 2, Z.zglow(0.6), 0, 240, 0));
    g.add(top); layers.push(top);
    let e = 0;
    return { g, zm: Z.zm, update: (t, dt, near) => {
      const target = near ? 1 : 0; const prev = e;
      e += (target - e) * Math.min(1, dt * 7); if (Math.abs(target - e) < 0.002) e = target;
      layers.forEach((L, k) => { L.position.y = k * 16 * e; });
      return Math.abs(prev - e) > 0.0005;   // still moving → keep redrawing
    } };
  },

  contact0(color) {
    const Z = zoneBuilders(color), g = new THREE.Group();
    const fL = Z.zfacade({ w: 152, h: 92, cols: 3, rows: 2, y0: 10, top: 8, lit: 0.7, colors: ['#ffb45c'], wall: '#3e424b', seed: 31 });
    const fR = Z.zfacade({ w: 152, h: 92, cols: 3, rows: 2, y0: 10, top: 8, lit: 0.6, colors: ['#ffb45c'], wall: '#393d45', seed: 32 });
    const plain = new THREE.MeshStandardMaterial({ color: 0x3e424b, roughness: 0.85 });
    g.add(edges(rbox(152, 92, 152, 2.2, [fR, plain, M.roof, plain, fL, plain]), 0.14));
    g.add(wallPlane(70, 10, Z.zsign('@ CONTATO', 70, 10, { size: 0.6 }), 'X', 76.3, 98, 0));
    // lattice mast
    const h0 = 92, h1 = 290, w0 = 28, w1 = 5, W = h => w0 + (w1 - w0) * (h - h0) / (h1 - h0);
    const steel = new THREE.MeshStandardMaterial({ color: 0xb7bec7, roughness: 0.4, metalness: 0.8 });
    for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(tube([cu * w0, h0, cv * w0], [cu * w1, h1, cv * w1], 1.1, steel));
    for (let h = h0; h < h1 - 10; h += 28) {
      const hn = Math.min(h + 28, h1), a0 = W(h), a1 = W(hn);
      for (const [p, q] of [[[-a0, h, a0], [a1, hn, a1]], [[a0, h, a0], [-a1, hn, a1]], [[a0, h, a0], [a1, hn, -a1]], [[a0, h, -a0], [a1, hn, a1]],
                            [[-a0, h, -a0], [a1, hn, -a1]], [[-a0, h, -a0], [-a1, hn, a1]]]) g.add(tube(p, q, 0.45, steel, 4));
    }
    g.add(mesh(new THREE.SphereGeometry(4, 12, 8), Z.zglow(3), 0, h1 + 6, 0));
    return { g, zm: Z.zm };
  },
  contact1(color) {
    const Z = zoneBuilders(color), g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: 0xc8611c, roughness: 0.45, metalness: 0.5 });
    g.add(rbox(28, 40, 24, 2, body));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 28, 20, 1, false, 0, Math.PI), body);
    top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.set(0, 40, 0); g.add(top);
    g.add(box(16, 1.2, 0.6, Z.zglow(2.4), 0, 30, 12.3));
    return { g, zm: Z.zm };
  },

  secret(color) {
    const Z = zoneBuilders(color), g = new THREE.Group();
    const conc = new THREE.MeshStandardMaterial({ map: noiseTex(128, '#3c3f43', 26, 60, 'rgba(0,0,0,0.3)', 5), roughness: 0.95 });
    g.add(edges(rbox(124, 30, 124, 3, conc), 0.12));
    const hz = canvasTex(256, 16, (gx, W, H) => { for (let x = -16; x < W; x += 16) { gx.fillStyle = '#d6b400'; gx.beginPath(); gx.moveTo(x, H); gx.lineTo(x + 8, 0); gx.lineTo(x + 16, 0); gx.lineTo(x + 8, H); gx.fill(); gx.fillStyle = '#111'; } });
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(112, 8), new THREE.MeshStandardMaterial({ map: hz, roughness: 0.8 }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 30.2, 54); g.add(strip);
    const door = Z.zglow(1.6); door.userData.base = 1.6;
    g.add(wallPlane(36, 24, door, 'Z', 0, 12, 62.2));
    g.add(wallPlane(36, 8, Z.zsign('.env', 36, 8, { size: 0.7 }), 'Z', 0, 6, 62.6));
    g.add(rbox(20, 22, 20, 2, M.concreteDark, -24, 30, -20));
    g.add(cyl(1.2, 1.2, 14, M.metalDark, -24, 52, -20, 8)); g.add(box(12, 6, 8, M.metalDark, -20, 62, -20));
    g.add(rbox(10, 8, 10, 1, M.metalDark, 20, 30, 20));
    return { g, zm: Z.zm };
  },
};

function buildZone(sp) {
  const key = { lab: ['lab0', 'lab1', 'lab2'], about: ['about0', 'about1'], contact: ['contact0', 'contact1'] }[sp.zone]?.[sp.part] || sp.zone;
  const res = ZONE3D[key](sp.color);
  res.keep = true;
  return res;
}

/* ════════════════════════════ PROJECT BILLBOARDS ════════════════════════════ */
const CAT_COLORS = { monolith: '#FFE600', frontend: '#2AFADF', mobile: '#9B7BFF', admin: '#FF8C00', integration: '#00FF88', 'event-driven': '#FF3CAC', iac: '#8cc8ff', automation: '#FF3CAC', sync: '#2AFADF' };
function buildBillboard(sp, info) {
  const g = new THREE.Group();
  const W = 96, H0 = 40, H1 = 136, CH = H1 - H0;
  const steel = M.metalDark, accent = CAT_COLORS[info.category] || '#FF3CAC';
  for (const x of [-30, 30]) { g.add(box(3.5, H0 + 6, 3.5, steel, x, 0, -3)); g.add(tube([x, 8, -3], [x, H0 - 6, -12], 1, steel)); }
  g.add(rbox(W + 8, CH + 8, 4, 1, M.trim, 0, H0 - 4, -4));                         // back box
  const face = info.tex
    ? new THREE.MeshStandardMaterial({ map: info.tex, emissive: 0xffffff, emissiveMap: info.tex, emissiveIntensity: 0.5, roughness: 0.55 })
    : new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.6 });
  g.add(wallPlane(W, CH, face, 'Z', 0, (H0 + H1) / 2, -1.6));
  for (const [w, h, x, y] of [[W + 4, 2, 0, H1 + 1], [W + 4, 2, 0, H0 - 1], [2, CH + 4, -W / 2 - 1, (H0 + H1) / 2], [2, CH + 4, W / 2 + 1, (H0 + H1) / 2]])
    g.add(mesh(new THREE.BoxGeometry(w, h, 2.5), steel, x, y, -1.2));
  g.add(box(W + 4, 0.7, 0.8, glow(accent, 1.3), 0, H0 - 2.4, 0.2));                // neon strip
  // catwalk + rail
  g.add(box(W + 6, 1, 9, steel, 0, H0 - 7, 3)); g.add(box(W + 6, 0.6, 0.6, steel, 0, H0 - 1, 7.4));
  // three floodlights on arms, aimed at the panel
  for (const x of [-34, 0, 34]) {
    g.add(tube([x, H1 + 4, -2], [x, H1 + 8, 10], 0.7, steel));
    const lamp = box(6, 2.4, 3.5, glow('#fff1cf', 1.8), x, H1 + 7, 11); lamp.rotation.x = 0.5; g.add(lamp);
  }
  // title plate under the panel
  if (info.title) g.add(wallPlane(W - 8, 9, signMat(textTex(info.title, W - 8, 9, '#e9eef5', { size: 0.5, bg: '#0b0e13', font: '700' }), 1.1), 'Z', 0, H0 - 13, 0.4));
  if (sp.face === 'u') g.rotation.y = Math.PI / 2;
  return g;
}

/* ════════════════════════════ METRO ════════════════════════════ */
const DECK_H = 70;
function buildViaduct(sp) {
  const g = new THREE.Group(), L = sp.len;
  if (sp.pillar) {
    g.add(rbox(10, DECK_H - 14, 10, 1.5, M.concrete, 0, 0, 0));
    g.add(rbox(26, 6, 18, 1.2, M.concrete, 0, DECK_H - 14, 0));
  }
  g.add(rbox(30, 8, L + 0.6, 0.8, M.concrete, 0, DECK_H - 8, 0));
  g.add(box(30, 0.5, L, new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.9 }), 0, DECK_H, 0));
  for (const x of [-5, 5]) g.add(box(1.2, 1.2, L, M.metal, x, DECK_H + 0.5, 0));             // rails
  for (const x of [-14.2, 14.2]) g.add(box(1, 4, L, M.concreteDark, x, DECK_H, 0));        // parapets
  g.add(box(0.6, 0.6, L, glow('#FFE600', 1), 15.2, DECK_H - 4, 0));                          // neon underline
  return g;
}
function buildStation() {
  const g = new THREE.Group();
  for (const x of [-30, 30]) {
    g.add(rbox(26, 6, 132, 1, M.concrete, x, DECK_H - 6, 0));
    g.add(box(1, 0.6, 128, glow('#FFE600', 1.4), x + (x < 0 ? 12.6 : -12.6), DECK_H, 0));    // platform edge line
    for (const z of [-56, 0, 56]) g.add(cyl(1, 1, 34, M.metal, x + (x < 0 ? -8 : 8), DECK_H, z, 8));
    g.add(edges(rbox(30, 3, 138, 1, new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.35, roughness: 0.1 }), x, DECK_H + 34, 0), 0.25));
    for (const z of [-30, 30]) g.add(box(10, 3.5, 3, M.metalDark, x + (x < 0 ? -4 : 4), DECK_H, z));   // benches
  }
  const sign = signMat(textTex('ESTAÇÃO JOPES · LINHA 1', 60, 7, '#FFE600', { size: 0.6, bg: '#0b0e13' }), 1.3);
  g.add(wallPlane(60, 7, sign, 'Z', -30, DECK_H + 26, 66.4));
  // stairs down to the street on the west side
  for (let k = 0; k < 10; k++) g.add(box(16, DECK_H / 10, 30 - k * 3, M.concrete, -56, k * DECK_H / 10, 52 + k * 1.5));
  g.add(box(1, DECK_H, 30, M.metalDark, -64.5, 0, 52));
  return g;
}

/* ════════════════════════════ GROUND ════════════════════════════ */
function buildGround(gd) {
  const scene = new THREE.Scene();
  lights(scene, 0.9, PERIOD);
  const { BLOCK, ROAD, LANE, half, minK, maxK } = gd;
  const lo = minK * BLOCK - 600, hi = maxK * BLOCK + 600, span = hi - lo;
  // asphalt
  const asph = noiseTex(256, '#24282f', 18, 260, 'rgba(255,255,255,0.05)', 3);
  asph.repeat.set(span / 180, span / 180);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(span, span), new THREE.MeshStandardMaterial({ map: asph, roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.position.set((lo + hi) / 2, 0, (lo + hi) / 2); scene.add(road);

  // lane dashes + zebras + manholes (instanced)
  const paint = new THREE.MeshStandardMaterial({ color: 0xc9ced5, roughness: 0.7 });
  const dashGeo = new THREE.PlaneGeometry(18, 2.2); dashGeo.rotateX(-Math.PI / 2);
  const dashes = [];
  for (let k = minK; k <= maxK; k++) for (let t = lo; t < hi; t += 40) {
    const local = ((t % BLOCK) + BLOCK) % BLOCK;
    if (local < ROAD / 2 + 26 || local > BLOCK - ROAD / 2 - 26) continue;  // keep junctions clear
    dashes.push([t, k * BLOCK, 0], [k * BLOCK, t, 1]);
  }
  const zeb = [];
  for (let ki = minK; ki <= maxK; ki++) for (let kj = minK; kj <= maxK; kj++) {
    const cu = ki * BLOCK, cv = kj * BLOCK;
    for (const sgn of [-1, 1]) for (let n = -ROAD / 2 + 10; n <= ROAD / 2 - 10; n += 12) {
      zeb.push([cu + sgn * (ROAD / 2 + 14), cv + n, 0], [cu + n, cv + sgn * (ROAD / 2 + 14), 1]);
    }
  }
  const inst = (geo, mat, list, place) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D();
    list.forEach((it, i) => { place(o, it); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
    scene.add(im); return im;
  };
  inst(dashGeo, paint, dashes, (o, [u, v, rot]) => { o.position.set(u, 0.15, v); o.rotation.set(0, rot ? Math.PI / 2 : 0, 0); });
  const zg = new THREE.PlaneGeometry(16, 5); zg.rotateX(-Math.PI / 2);
  inst(zg, paint, zeb, (o, [u, v, rot]) => { o.position.set(u, 0.12, v); o.rotation.set(0, rot ? Math.PI / 2 : 0, 0); });
  const holes = [];
  for (let k = minK; k <= maxK; k++) for (let m = minK; m < maxK; m++) holes.push([(m + 0.5) * BLOCK + 40, k * BLOCK - LANE]);
  inst(new THREE.CylinderGeometry(6, 6, 0.4, 18), new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.5, metalness: 0.7 }), holes, (o, [u, v]) => { o.position.set(u, 0.2, v); });

  // sidewalk blocks: rounded slab with curb, paver texture; inner fill by kind
  const pav = canvasTex(64, 64, (g, W, H) => { g.fillStyle = '#4a515b'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(0, 0, 32, 32); g.strokeRect(32, 32, 32, 32); g.strokeRect(32, 0, 32, 32); g.strokeRect(0, 32, 32, 32); }, true);
  pav.repeat.set(1 / 24, 1 / 24);
  const sidewalk = new THREE.MeshStandardMaterial({ map: pav, roughness: 0.9 });
  const curb = new THREE.MeshStandardMaterial({ color: 0x5c636d, roughness: 0.85 });
  const grassT = noiseTex(128, '#1f3a2a', 30, 400, 'rgba(120,200,140,0.12)', 9); grassT.repeat.set(1 / 60, 1 / 60);
  const grass = new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 });
  const stoneT = canvasTex(64, 64, (g, W, H) => { g.fillStyle = '#4c4a47'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < H; y += 16) for (let x = (y / 16 % 2) * 8; x < W; x += 16) g.strokeRect(x, y, 16, 16); }, true);
  stoneT.repeat.set(1 / 20, 1 / 20);
  const stone = new THREE.MeshStandardMaterial({ map: stoneT, roughness: 0.85 });
  const lotT = noiseTex(128, '#22262c', 14, 0, null, 4); lotT.repeat.set(1 / 80, 1 / 80);
  const lotM = new THREE.MeshStandardMaterial({ map: lotT, roughness: 0.95 });
  const roundRect = (u0, v0, u1, v1, r) => {
    const s = new THREE.Shape();           // shape coords: (u, -v) so that after rotateX(-π/2) we land on (X=u, Z=v)
    s.moveTo(u0 + r, -v0); s.lineTo(u1 - r, -v0); s.quadraticCurveTo(u1, -v0, u1, -v0 - r);
    s.lineTo(u1, -v1 + r); s.quadraticCurveTo(u1, -v1, u1 - r, -v1); s.lineTo(u0 + r, -v1);
    s.quadraticCurveTo(u0, -v1, u0, -v1 + r); s.lineTo(u0, -v0 - r); s.quadraticCurveTo(u0, -v0, u0 + r, -v0);
    return s;
  };
  const slab = (shape, depth, mats, y0 = 0, bevel = 0.8) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mats); m.position.y = y0; scene.add(m); return m;
  };
  const inset = 26;
  let airportDone = false;
  // the runway, terminal, control tower and hangar (drawn once, across both airport blocks)
  function buildAirport(R) {
    const y = 6.6, len = R.u1 - R.u0 + 60, cu = (R.u0 + R.u1) / 2, PX = 3;
    const rwT = canvasTex(Math.round(len * PX), Math.round(R.w * PX), (g, W, H) => {
      g.fillStyle = '#2b2e33'; g.fillRect(0, 0, W, H);
      const r = rng(17); for (let k = 0; k < 9000; k++) { const c = 36 + r() * 22 | 0; g.fillStyle = `rgb(${c},${c},${c + 3})`; g.fillRect(r() * W, r() * H, 2, 2); }
      for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(10,10,12,0.35)'; g.fillRect(W * 0.12 + r() * W * 0.2, H * 0.3 + r() * H * 0.4, 30 + r() * 60, 2); g.fillRect(W * 0.66 + r() * W * 0.2, H * 0.3 + r() * H * 0.4, 30 + r() * 60, 2); }   // tyre marks
      g.fillStyle = '#e9ecef';
      g.fillRect(0, 6, W, 3); g.fillRect(0, H - 9, W, 3);                                         // edge lines
      for (let x = 70 * PX; x < W - 70 * PX; x += 34 * PX) g.fillRect(x, H / 2 - 2, 18 * PX, 4);  // centreline
      for (const end of [0, 1]) {                                                                  // piano keys + numbers
        const x0 = end ? W - 8 * PX - 18 * PX : 8 * PX;
        for (let k = 0; k < 8; k++) { const yy = 14 + k * (H - 28) / 8; g.fillRect(x0, yy, 18 * PX, (H - 28) / 8 - 6); }
        g.save(); g.translate(end ? W - 40 * PX : 40 * PX, H / 2); g.rotate(end ? -Math.PI / 2 : Math.PI / 2);
        g.font = `bold ${16 * PX}px "Courier New", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(end ? '27' : '09', 0, 0); g.restore();
        g.fillRect(end ? W - 120 * PX : 100 * PX, 22, 22 * PX, 10); g.fillRect(end ? W - 120 * PX : 100 * PX, H - 32, 22 * PX, 10);   // touchdown zone bars
      }
    }, false);
    const rw = new THREE.Mesh(new THREE.BoxGeometry(len, 6.6, R.w), [M.concreteDark || new THREE.MeshStandardMaterial({ color: 0x3a3d42 }), M.concreteDark || new THREE.MeshStandardMaterial({ color: 0x3a3d42 }),
      new THREE.MeshStandardMaterial({ map: rwT, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x1c1e22 }), new THREE.MeshStandardMaterial({ color: 0x3a3d42 }), new THREE.MeshStandardMaterial({ color: 0x3a3d42 })]);
    rw.position.set(cu, y / 2 + 1.2, R.v); scene.add(rw);
    // shoulders + edge lights + approach lights at both ends
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(len, R.w + 16), new THREE.MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.95 })); sh.rotation.x = -Math.PI / 2; sh.position.set(cu, y + 1.0, R.v); scene.add(sh);
    const wl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c8, emissiveIntensity: 2 }), gl2 = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x30ff80, emissiveIntensity: 2 }), rl = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 });
    for (let x = R.u0 - 20; x <= R.u1 + 20; x += 34) for (const z of [-1, 1]) scene.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), wl, x, y + 1.9, R.v + z * (R.w / 2 + 3)));
    for (let k = -6; k <= 6; k++) { scene.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), gl2, R.u0 - 32, y + 0.7, R.v + k * 4.5)); scene.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), rl, R.u1 + 32, y + 0.7, R.v + k * 4.5)); }
    // taxiway from the runway to the apron (north side, by the terminal)
    const tw = new THREE.Mesh(new THREE.PlaneGeometry(36, 120), new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.9 })); tw.rotation.x = -Math.PI / 2; tw.position.set(R.u1 - 300, 7.25, R.v - R.w / 2 - 55); scene.add(tw);
    const ty = new THREE.Mesh(new THREE.PlaneGeometry(2, 120), new THREE.MeshStandardMaterial({ color: 0xffd400, emissive: 0x332a00 })); ty.rotation.x = -Math.PI / 2; ty.position.set(R.u1 - 300, 7.3, R.v - R.w / 2 - 55); scene.add(ty);
    // terminal (west block): long glass hall, white roof, jet bridge
    const tv = R.v - 230, tuC = 3.5 * gd.BLOCK;
    const glassT = canvasTex(256, 64, (g, W, H) => { g.fillStyle = '#5b7e98'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,240,200,0.55)'; for (let x = 0; x < W; x += 16) for (let yy = 8; yy < H; yy += 20) if ((x * 7 + yy) % 3) g.fillRect(x + 2, yy, 11, 9); g.strokeStyle = '#2a3440'; g.lineWidth = 2; for (let x = 0; x < W; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } }, true);
    glassT.repeat.set(4, 1);
    const glassM2 = new THREE.MeshStandardMaterial({ map: glassT, emissive: 0xffffff, emissiveMap: glassT, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.4 });
    const white = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.6 });
    scene.add(mesh(new THREE.BoxGeometry(250, 26, 56), [glassM2, glassM2, white, white, glassM2, glassM2], tuC, y + 13, tv));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(40, 40, 262, 24, 1, false, 0, Math.PI), white); roof.rotation.z = Math.PI / 2; roof.scale.set(0.25, 1, 1); roof.position.set(tuC, y + 26, tv); scene.add(roof);
    scene.add(mesh(new THREE.BoxGeometry(10, 8, 60), white, tuC + 60, y + 14, tv + 56));                    // jet bridge
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(90, 9), new THREE.MeshStandardMaterial({ map: canvasTex(360, 36, (g, W, H) => { g.fillStyle = '#0a0d12'; g.fillRect(0, 0, W, H); g.fillStyle = '#FFE600'; g.font = 'bold 24px "Courier New", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AEROPORTO JOPES', W / 2, H / 2 + 1); }, false), emissive: 0xffffff, emissiveIntensity: 0.6 }));
    sign.position.set(tuC, y + 22, tv + 28.2); scene.add(sign);
    // control tower (east block)
    const tx = 4.5 * gd.BLOCK + 110, tz = R.v - 250;
    scene.add(mesh(new THREE.CylinderGeometry(7, 9, 90, 16), white, tx, y + 45, tz));
    scene.add(mesh(new THREE.CylinderGeometry(15, 12, 14, 16), new THREE.MeshStandardMaterial({ color: 0x1e3a52, emissive: 0x0e2238, roughness: 0.1, metalness: 0.6 }), tx, y + 97, tz));
    scene.add(mesh(new THREE.CylinderGeometry(16, 16, 2, 16), M.metalDark, tx, y + 105, tz));
    scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 16, 6), M.metalDark, tx, y + 114, tz));
    scene.add(mesh(new THREE.SphereGeometry(1.4, 10, 8), rl, tx, y + 122, tz));
    // hangar (east block)
    const hx = 4.5 * gd.BLOCK - 70, hz = R.v - 240;
    const hang = new THREE.Mesh(new THREE.CylinderGeometry(42, 42, 110, 24, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8e99a6, roughness: 0.5, metalness: 0.6 }));
    hang.rotation.z = Math.PI / 2; hang.rotation.y = Math.PI / 2; hang.position.set(hx, y, hz); scene.add(hang);
    scene.add(mesh(new THREE.PlaneGeometry(70, 34), new THREE.MeshStandardMaterial({ color: 0x1c2026 }), hx, y + 17, hz + 55.2));
    // windsock
    scene.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 26, 6), M.metalDark, R.u0 + 40, y + 13, R.v + R.w / 2 + 30));
    const sock = new THREE.Mesh(new THREE.ConeGeometry(3, 14, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a00, side: THREE.DoubleSide })); sock.rotation.z = Math.PI / 2; sock.position.set(R.u0 + 47, y + 25, R.v + R.w / 2 + 30); scene.add(sock);
  }
  for (const b of gd.blocks) {
    const u0 = b.u - half, u1 = b.u + half, v0 = b.v - half, v1 = b.v + half;
    slab(roundRect(u0, v0, u1, v1, 18), 5.2, [sidewalk, curb]);
    const fill = b.kind === 'park' ? grass : b.kind === 'plaza' ? stone : b.kind === 'lot' ? lotM : null;
    if (fill) slab(roundRect(u0 + inset, v0 + inset, u1 - inset, v1 - inset, 10), 0.6, [fill, curb], 6, 0.3);
    if (b.kind === 'lot') {
      for (let n = -3; n <= 3; n++) for (const [a, c] of [[-120, -40], [40, 120]]) {
        const ln = new THREE.Mesh(new THREE.PlaneGeometry(c - a, 1.6), paint); ln.rotation.x = -Math.PI / 2; ln.position.set(b.u + (a + c) / 2, 7.2, b.v + n * 44); scene.add(ln);
      }
    }
    if (b.kind === 'airport') {
      // grass infield + concrete apron on the north (−v) half of each airport block
      slab(roundRect(u0 + inset, v0 + inset, u1 - inset, v1 - inset, 10), 0.6, [grass, curb], 6, 0.3);
      const apron = new THREE.MeshStandardMaterial({ map: lotT, color: 0xb9bcc0, roughness: 0.9 });
      const ap = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0 - 2 * inset - 10, 150), apron); ap.rotation.x = -Math.PI / 2; ap.position.set(b.u, 7.1, v0 + inset + 80); scene.add(ap);
      if (!airportDone) { airportDone = true; buildAirport(gd.RUNWAY); }
    }
    if (b.kind === 'field') {
      // football pitch: one painted texture (mowing stripes, wear, crisp markings), running track,
      // LED ad boards, dugouts, goals with nets, a covered stand and four floodlight towers
      const L = 296, Wd = 188, y = 6.15, cu = b.u, cv = b.v + 26;
      const PX = 4;                                    // texture px per unit
      const pitchT = canvasTex(L * PX, Wd * PX, (g, W, H) => {
        const st = 14;
        for (let k = 0; k < st; k++) { g.fillStyle = k % 2 ? '#2f7a37' : '#38883f'; g.fillRect(W / st * k, 0, W / st + 1, H); }
        const img = g.getImageData(0, 0, W, H), d = img.data, r = rng(91);
        for (let q = 0; q < d.length; q += 4) { const n = (r() - 0.5) * 18; d[q] += n * 0.6; d[q + 1] += n; d[q + 2] += n * 0.5; }
        g.putImageData(img, 0, 0);
        const wear = (x, yy, rx, ry) => { const gr = g.createRadialGradient(x, yy, 0, x, yy, rx); gr.addColorStop(0, 'rgba(120,105,70,0.45)'); gr.addColorStop(1, 'rgba(120,105,70,0)'); g.save(); g.scale(1, ry / rx); g.fillStyle = gr; g.beginPath(); g.arc(x, yy * rx / ry, rx, 0, 7); g.fill(); g.restore(); };
        wear(26, H / 2, 70, 40); wear(W - 26, H / 2, 70, 40); wear(W / 2, H / 2, 60, 40);
        g.strokeStyle = 'rgba(245,248,245,0.92)'; g.lineWidth = 6; const m = 14;
        const u = x => m + x * (W - 2 * m) / L, v = yy => m + yy * (H - 2 * m) / Wd;
        g.strokeRect(u(0), v(0), u(L) - u(0), v(Wd) - v(0));
        g.beginPath(); g.moveTo(u(L / 2), v(0)); g.lineTo(u(L / 2), v(Wd)); g.stroke();
        g.beginPath(); g.arc(u(L / 2), v(Wd / 2), 27 * PX, 0, 7); g.stroke();
        g.fillStyle = 'rgba(245,248,245,0.95)'; g.beginPath(); g.arc(u(L / 2), v(Wd / 2), 6, 0, 7); g.fill();
        for (const sd of [0, 1]) {
          const x0 = sd ? u(L) : u(0), dir = sd ? -1 : 1;
          g.strokeRect(Math.min(x0, x0 + dir * 46 * PX), v(Wd / 2 - 58), 46 * PX, 116 * PX);
          g.strokeRect(Math.min(x0, x0 + dir * 16 * PX), v(Wd / 2 - 26), 16 * PX, 52 * PX);
          g.beginPath(); g.arc(x0 + dir * 32 * PX, v(Wd / 2), 6, 0, 7); g.fill();
          g.beginPath(); g.arc(x0 + dir * 32 * PX, v(Wd / 2), 25 * PX, sd ? Math.PI * 0.7 : -Math.PI * 0.3, sd ? Math.PI * 1.3 : Math.PI * 0.3); g.stroke();
          for (const cy of [0, Wd]) { g.beginPath(); g.arc(x0, v(cy), 5 * PX, 0, 7); g.stroke(); }
        }
      }, false);
      const flat = (w, d, mat, x, z, yy) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.set(x, yy, z); scene.add(m); return m; };
      // running track (terracotta with lane lines) under the pitch
      const trackT = canvasTex(512, 340, (g, W, H) => { g.fillStyle = '#9a4a34'; g.fillRect(0, 0, W, H); const r = rng(5); for (let q = 0; q < 6000; q++) { g.fillStyle = `rgba(${60 + r() * 60},20,10,0.25)`; g.fillRect(r() * W, r() * H, 1.5, 1.5); }
        g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; for (let k = 1; k < 5; k++) { const pad = k * 5; g.beginPath(); g.roundRect(pad, pad, W - 2 * pad, H - 2 * pad, 60 - pad); g.stroke(); } }, false);
      flat(L + 50, Wd + 44, new THREE.MeshStandardMaterial({ map: trackT, roughness: 0.95 }), cu, cv, y - 0.04);
      flat(L + 14, Wd + 12, new THREE.MeshStandardMaterial({ color: 0x2c6a33, roughness: 1 }), cu, cv, y);
      flat(L, Wd, new THREE.MeshStandardMaterial({ map: pitchT, roughness: 0.92 }), cu, cv, y + 0.05);
      // LED ad boards round the pitch (glow in the zone colour of JOPES)
      const adT = canvasTex(512, 32, (g, W, H) => { g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H); g.font = 'bold 20px "Courier New", monospace'; g.textBaseline = 'middle';
        const words = ['JOPES.EXE', 'JAVA 17', 'SPRING BOOT', 'AWS', 'KAFKA', 'TERRAFORM']; let x = 8; for (let k = 0; k < 12; k++) { const w = words[k % words.length]; g.fillStyle = k % 2 ? '#FFE600' : '#4DA3FF'; g.fillText(w, x, H / 2 + 1); x += g.measureText(w).width + 26; } }, true);
      adT.wrapS = THREE.RepeatWrapping;
      const adM = new THREE.MeshStandardMaterial({ map: adT, emissive: 0xffffff, emissiveMap: adT, emissiveIntensity: 0.9, roughness: 0.4 });
      const board = (len, x, z, ry) => { const t = adT.clone(); t.repeat.set(len / 130, 1); t.needsUpdate = true; const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.4 });
        const bx = new THREE.Mesh(new THREE.BoxGeometry(len, 4, 0.8), [M.metalDark, M.metalDark, M.metalDark, M.metalDark, m, m]); bx.position.set(x, y + 2, z); bx.rotation.y = ry; scene.add(bx); };
      board(L - 10, cu, cv + Wd / 2 + 9, 0); board(L - 10, cu, cv - Wd / 2 - 9, Math.PI);
      for (const sd of [-1, 1]) for (const zz of [-1, 1]) board(Wd / 2 - 30, cu + sd * (L / 2 + 10), cv + zz * (Wd / 4 + 15), sd > 0 ? -Math.PI / 2 : Math.PI / 2);
      // goals: white posts, net with a mesh pattern
      const netT = canvasTex(64, 64, (g, W, H) => { g.clearRect(0, 0, W, H); g.strokeStyle = 'rgba(240,244,248,0.9)'; g.lineWidth = 1.5; for (let k = 0; k <= W; k += 8) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, H); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(W, k); g.stroke(); } }, true);
      const postM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
      for (const sd of [-1, 1]) { const gx = cu + sd * L / 2, gw = 30, gh = 13, gd = 10;
        for (const z of [-gw / 2, gw / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, gh, 10), postM); p.position.set(gx, y + gh / 2, cv + z); scene.add(p); }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, gw + 1.5, 10), postM); bar.rotation.x = Math.PI / 2; bar.position.set(gx, y + gh, cv); scene.add(bar);
        const nt = netT.clone(); nt.repeat.set(4, 2); nt.needsUpdate = true;
        const net = new THREE.MeshStandardMaterial({ map: nt, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 0.8 });
        const nb = new THREE.Mesh(new THREE.BoxGeometry(gd, gh, gw), [net, net, net, new THREE.MeshBasicMaterial({ visible: false }), net, net]); nb.position.set(gx + sd * gd / 2, y + gh / 2, cv); if (sd < 0) nb.rotation.y = Math.PI; scene.add(nb); }
      // dugouts on the near side
      const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
      for (const sd of [-1, 1]) { const dx = cu + sd * 40, dz = cv + Wd / 2 + 17;
        scene.add(mesh(new THREE.BoxGeometry(30, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x1d2a44, roughness: 0.6 }), dx, y + 3, dz));
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 32, 16, 1, true, -Math.PI / 2, Math.PI), glassM); roof.rotation.z = Math.PI / 2; roof.position.set(dx, y + 3, dz); scene.add(roof); }
      // covered stand on the far (−v) side: stepped concrete, rows of blue/yellow seats, roof on trusses, stairs
      const SL = L * 0.74, sv = cv - Wd / 2 - 24, rows = 6, rd = 6.5, rh = 4;
      const concrete = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.85 });
      const seatT = canvasTex(256, 16, (g, W, H) => { g.fillStyle = '#2a5fc9'; g.fillRect(0, 0, W, H); const r = rng(3); for (let x = 0; x < W; x += 4) { if (r() < 0.08) { g.fillStyle = '#FFE600'; g.fillRect(x, 0, 3, H); } g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 3, 0, 1, H); } }, true);
      for (let k = 0; k < rows; k++) {
        const hh = rh * (k + 1), z = sv - k * rd;
        scene.add(mesh(new THREE.BoxGeometry(SL, hh, rd), concrete, cu, y + hh / 2, z));
        const t = seatT.clone(); t.repeat.set(SL / 40, 1); t.needsUpdate = true;
        scene.add(mesh(new THREE.BoxGeometry(SL - 4, 1.6, 3), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), cu, y + hh + 0.8, z + 1.2));
      }
      for (const x of [-SL / 4, SL / 4]) for (let k = 0; k < rows; k++) scene.add(mesh(new THREE.BoxGeometry(5, rh * (k + 1) + 0.4, rd), concrete, cu + x, y + (rh * (k + 1) + 0.4) / 2, sv - k * rd));   // aisles
      const backZ = sv - (rows - 1) * rd - rd / 2;
      scene.add(mesh(new THREE.BoxGeometry(SL, rh * rows + 10, 2), concrete, cu, y + (rh * rows + 10) / 2, backZ - 1));
      const roofM = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.45, metalness: 0.5 });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(SL + 8, 1.4, rows * rd + 14), roofM); roof.position.set(cu, y + rh * rows + 16, sv - rows * rd / 2 + 4); roof.rotation.x = -0.06; scene.add(roof);
      for (let x = -SL / 2; x <= SL / 2 + 0.1; x += SL / 6) { scene.add(mesh(new THREE.BoxGeometry(1.4, rh * rows + 16, 1.4), M.metalDark, cu + x, y + (rh * rows + 16) / 2, backZ));
        const tr = new THREE.Mesh(new THREE.BoxGeometry(1, 1, rows * rd + 12), M.metalDark); tr.position.set(cu + x, y + rh * rows + 15, sv - rows * rd / 2 + 4); tr.rotation.x = -0.06; scene.add(tr); }
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(SL + 8, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0x0a0d12, emissive: 0xFFE600, emissiveIntensity: 0.35 })); fascia.position.set(cu, y + rh * rows + 14.5, sv + 10.5); scene.add(fascia);
      // floodlight towers: lattice mast + a head of glowing lamps aimed at the pitch
      const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 2.2 });
      for (const [du, dv] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const lx = cu + du * (L / 2 + 22), lz = cv + dv * (Wd / 2 + 18), H = 78;
        for (const [a, c] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) scene.add(mesh(new THREE.CylinderGeometry(0.35, 0.6, H, 6), M.metalDark, lx + a, y + H / 2, lz + c));
        for (let hy = 8; hy < H; hy += 9) scene.add(mesh(new THREE.BoxGeometry(3.2, 0.4, 3.2), M.metalDark, lx, y + hy, lz));
        const head = new THREE.Group(); head.position.set(lx, y + H + 3, lz); head.lookAt(cu, y, cv); scene.add(head);
        head.add(mesh(new THREE.BoxGeometry(14, 8, 1.2), M.metalDark, 0, 0, -0.8));
        for (let r2 = -1; r2 <= 1; r2++) for (let c2 = -2; c2 <= 2; c2++) head.add(mesh(new THREE.BoxGeometry(2.2, 2, 0.6), lampM, c2 * 2.7, r2 * 2.5, 0));
      }
    }
    if (b.kind === 'plaza') {
      const ring = new THREE.Mesh(new THREE.RingGeometry(140, 152, 64), new THREE.MeshStandardMaterial({ color: 0x5e5a52, roughness: 0.8 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(b.u, 7, b.v); scene.add(ring);
      for (const [du, dv, r] of [[110, 0, 0], [-110, 0, 0], [0, 110, 1], [0, -110, 1]]) {        // benches
        const bench = new THREE.Group();
        bench.add(box(26, 1.5, 7, new THREE.MeshStandardMaterial({ color: 0x6b4d36, roughness: 0.8 }), 0, 6, 0));
        bench.add(box(26, 6, 1.2, new THREE.MeshStandardMaterial({ color: 0x6b4d36, roughness: 0.8 }), 0, 8, -3.5));
        for (const x of [-11, 11]) bench.add(box(1.5, 6, 6, M.metalDark, x, 0, 0));
        bench.position.set(b.u + du, 6.6, b.v + dv); bench.rotation.y = r ? Math.PI / 2 : 0; scene.add(bench);
      }
    }
  }
  // street lamps + bins
  const binGeo = new THREE.CylinderGeometry(3, 2.6, 9, 12); binGeo.translate(0, 4.5, 0);
  inst(binGeo, new THREE.MeshStandardMaterial({ color: 0x2f5d48, roughness: 0.6, metalness: 0.4 }), gd.lamps.filter((_, i) => i % 3 === 0), (o, l) => { o.position.set(l.u + 10, 5.2, l.v - 10); });
  return scene;
}

/* ════════════════════════════ BOOT ════════════════════════════ */
async function boot() {
  if (!CITY || !CITY.attach3D) { emit('city3d:ready'); return; }
  let R;
  try { R = newRenderer(true); } catch (e) { console.warn('[world3d] sem WebGL, cidade fica em SVG'); emit('city3d:ready'); return; }
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(R);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  if (window.CITY_PERIOD && PERIODS[window.CITY_PERIOD]) PERIOD = window.CITY_PERIOD;   // set before the first render
  const LIGHTS = lights(scene);
  const cam = isoCamera(1500);

  // billboards need the portfolio data (title, category) and the screenshots as textures
  const bbInfo = {};
  try {
    const data = await Promise.race([window.PORTFOLIO, new Promise(r => setTimeout(() => r(null), 5000))]);
    if (data) {
      const loader = new THREE.TextureLoader();
      await Promise.all(data.projects.map((p, k) => new Promise(res => {
        bbInfo[k] = { title: p.title.pt, category: p.category };
        if (!p.image) return res();
        loader.load(p.image, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; bbInfo[k].tex = t; res(); }, undefined, () => res());
      })));
    }
  } catch (e) { console.warn('[world3d] dados do portfólio indisponíveis', e); }

  const list = CITY.attach3D(DPR, LIGHT ? (o => ['zone', 'billboard', 'lamp', 'signal'].includes(o.spec.kind)) : null);
  // work in whole device pixels: each object's canvas is pw×ph px and the camera covers exactly pw/DPR × ph/DPR
  const maxW = Math.max(...list.map(o => o.canvas.width)), maxH = Math.max(...list.map(o => o.canvas.height));
  R.setPixelRatio(1); R.setSize(maxW, maxH, false); R.setClearColor(0x000000, 0);
  R.setScissorTest(true);

  const t0 = performance.now();
  function draw(o, t, dt) {
    let rec = o.rec;
    if (!rec) {
      const sp = o.spec;
      rec = sp.kind === 'zone' ? buildZone(sp)
          : { g: sp.kind === 'lowrise' ? buildLowrise(sp) : sp.kind === 'tree' ? buildTree(sp) : sp.kind === 'billboard' ? buildBillboard(sp, bbInfo[sp.k] || {})
                 : sp.kind === 'viaduct' ? buildViaduct(sp) : sp.kind === 'station' ? buildStation() : sp.kind === 'lamp' ? buildLamp(sp) : sp.kind === 'signal' ? buildSignal() : buildBush(sp), zm: [] };
      if (rec.keep) o.rec = rec;
    }
    let zoneMul = null;
    if (rec.zm.length) {
      const lit = o.el.classList.contains('lit') || o.svgEl?.classList.contains('lit');
      const L = lit ? 1 : (o.spec.zone === 'secret' ? 0.1 : 0.45);
      zoneMul = new Map(rec.zm.map(m => { m.userData.e0 = m.userData.base ?? 2; return [m, L]; }));
    }
    applyEM(rec.g, zoneMul);
    const moving = rec.update ? !!rec.update(t, dt, o.el.classList.contains('near')) : false;
    const { x, y } = o.box, pw = o.canvas.width, ph = o.canvas.height;
    cam.left = x; cam.right = x + pw / DPR; cam.top = -y; cam.bottom = -(y + ph / DPR); cam.updateProjectionMatrix();
    R.setViewport(0, 0, pw, ph); R.setScissor(0, 0, pw, ph);
    scene.add(rec.g);
    R.render(scene, cam);
    scene.remove(rec.g);
    const ctx = o.canvas.getContext('2d');
    ctx.clearRect(0, 0, o.canvas.width, o.canvas.height);
    ctx.drawImage(R.domElement, 0, R.domElement.height - ph, pw, ph, 0, 0, pw, ph);
    if (!rec.keep) dispose(rec.g);
    CITY.show3D(o);
    return moving;
  }

  // first pass: nearest objects first, a few per frame so the game never freezes
  const queue = list.slice().sort((p, q) => Math.hypot(p.x - playerPos.x, p.y - playerPos.y) - Math.hypot(q.x - playerPos.x, q.y - playerPos.y));
  const zones = list.filter(o => o.spec.kind === 'zone');
  zones.forEach(o => { o.lastLit = null; o.lastNear = null; });
  let last = performance.now();
  const total = queue.length;
  let groundDone = false, objsDone = false;
  const maybeReady = () => { if (groundDone && objsDone) emit('city3d:ready'); };
  (function pump() {
    const start = performance.now();
    const budget = document.getElementById('boot') ? 45 : 14;   // go faster while the loading screen is up
    while (queue.length && performance.now() - start < budget) draw(queue.shift(), (performance.now() - t0) / 1000, 0);
    emit('city3d:progress', (total - queue.length) / Math.max(1, total) * 0.85 + (groundDone ? 0.15 : 0));
    if (queue.length) requestAnimationFrame(pump); else { objsDone = true; maybeReady(); }
  })();

  // the garage holds the real vehicles: rebuild it once vehicles.js (or the GLB files) are ready
  const regarage = () => { for (const o of list) if (o.spec.zone === 'garage') { o.rec = null; o.lastLit = null; if (o.drawn !== false) draw(o, (performance.now() - t0) / 1000, 0); } };
  window.addEventListener('garage:ready', regarage); window.addEventListener('garage:models', regarage);

  // live updates: lit/near changes, animated models while on screen
  (function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    for (const o of zones) {
      if (!o.rec) continue;                       // not drawn yet (first pass still running)
      const lit = o.el.classList.contains('lit'), near = o.el.classList.contains('near');
      let need = lit !== o.lastLit || near !== o.lastNear || o.animating;
      o.lastLit = lit; o.lastNear = near;
      if (o.spec.zone === 'garage' && now - (o.lastSpin || 0) > 66) {   // turntables spin while on screen (~15 fps)
        const r = o.el.getBoundingClientRect();
        if (r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight) { need = true; o.lastSpin = now; }
      }
      if (o.spec.zone === 'projects') {           // the crane keeps moving while it's on screen
        const r = o.el.getBoundingClientRect();
        if (r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight) need = true;
      }
      if (need) o.animating = draw(o, t, dt);
    }
  })(performance.now());

  // ground: one big render, copied to a 2D canvas, then the GL context is released
  function renderGround() {
    try {
      const gd = CITY.groundData;
      const GR = newRenderer(false);
      GR.setPixelRatio(GROUND_DPR); GR.setSize(gd.mapPx, gd.mapPx, false); GR.setClearColor(0x07090d, 1);
      GR.setClearColor(PERIODS[PERIOD].clear, 1);
      const gscene = buildGround(gd);
      applyEM(gscene);
      const gcam = isoCamera(6000);
      gcam.left = -gd.X0; gcam.right = gd.mapPx - gd.X0; gcam.top = 0; gcam.bottom = -gd.mapPx; gcam.updateProjectionMatrix();
      GR.render(gscene, gcam);
      const out = document.createElement('canvas');
      out.width = GR.domElement.width; out.height = GR.domElement.height;
      out.getContext('2d').drawImage(GR.domElement, 0, 0);
      out.style.width = gd.mapPx + 'px'; out.style.height = gd.mapPx + 'px';
      CITY.setGround3D(out);
      dispose(gscene); GR.dispose(); GR.forceContextLoss();
    } catch (e) { console.warn('[world3d] chão 3D falhou, mantendo SVG', e); }
  }
  setTimeout(() => { renderGround(); groundDone = true; maybeReady(); }, 60);

  // time of day changed → relight everything (nearest objects first, ground once)
  window.addEventListener('city:period', e => {
    if (!PERIODS[e.detail] || e.detail === PERIOD) return;
    PERIOD = e.detail;
    setLights(LIGHTS, PERIOD);
    renderGround();
    const again = list.filter(o => !queue.includes(o))
      .sort((p, q) => Math.hypot(p.x - playerPos.x, p.y - playerPos.y) - Math.hypot(q.x - playerPos.x, q.y - playerPos.y));
    queue.push(...again);
    if (queue.length === again.length) requestAnimationFrame(function pump2() {
      const start = performance.now();
      while (queue.length && performance.now() - start < 12) draw(queue.shift(), (performance.now() - t0) / 1000, 0);
      if (queue.length) requestAnimationFrame(pump2);
    });
  });
}
function dispose(root) {
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { if (Object.values(M).includes(m)) continue; for (const k of ['map', 'emissiveMap', 'alphaMap']) m[k]?.dispose?.(); m.dispose(); }
  });
}

boot();
