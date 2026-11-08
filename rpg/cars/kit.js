/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — kit de montagem dos carros "de verdade" da garagem
   Tudo que é comum aos modelos detalhados (cars/cruze.js, cars/hb20.js…):
   • loft de seções (carroceria e teto/vidros), curvas monótonas
   • projetor de decalques: raios paralelos num grid 2D acelerado que acham a
     superfície real + normal suavizada (faróis, grades, vincos, frisos)
   • materiais, rodas de liga, interior, retrovisor, maçaneta, caixas de roda
   Escala ~15 un/m · frente = +X · chão y = 0 · direita = +Z
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from '../assets/vendor/BufferGeometryUtils.js';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// monotone cubic interpolation through [x, y] points (no overshoot)
export function mono(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0]), n = P.length;
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Catmull-Rom through 2D control points [y, z], fixed sample count per segment
export function crSection(ctrl, counts) {
  const out = [];
  const N = ctrl.length;
  for (let i = 0; i < N - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(N - 1, i + 2)];
    const n = counts[i];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), Math.max(0, f(p0[1], p1[1], p2[1], p3[1]))]);
    }
  }
  out.push([ctrl[N - 1][0], ctrl[N - 1][1]]);
  return out;
}

/* ── a lofted surface: stations along X, each a closed loop (half section mirrored) ──
   halfAt(x) → [[y, z]...] from bottom-centre to top-centre (z ≥ 0)
   post(v) mutates each vertex (sweep, arch clip)
   group(i, j) → material group of the quad between station i..i+1, loop j..j+1 (half index) */
export function loft(stations, halfAt, post, group, ngroups) {
  const pos = [], rows = [];
  let M = 0;
  for (const x of stations) {
    const h = halfAt(x); M = h.length - 1;
    const loop = [];
    for (let j = 0; j <= M; j++) loop.push([x, h[j][0], h[j][1]]);
    for (let j = M - 1; j >= 1; j--) loop.push([x, h[j][0], -h[j][1]]);
    const row = [];
    for (const v of loop) { const p = post(V3(v[0], v[1], v[2]), x); row.push(pos.length / 3); pos.push(p.x, p.y, p.z); }
    rows.push(row);
  }
  const L = 2 * M, buckets = Array.from({ length: ngroups }, () => []);
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < L; j++) {
    const a = rows[i][j], b = rows[i][(j + 1) % L], c = rows[i + 1][j], d = rows[i + 1][(j + 1) % L];
    const hj = j < M ? j : L - 1 - j;                 // half index of this strip (mirrored side maps back)
    const cx = (pos[a * 3] + pos[d * 3]) / 2, cy = (pos[a * 3 + 1] + pos[d * 3 + 1]) / 2, cz = (pos[a * 3 + 2] + pos[d * 3 + 2]) / 2;
    const g = group(i, hj, stations[i], stations[i + 1], cx, cy, cz);
    buckets[g].push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const idx = []; let off = 0;
  buckets.forEach((bk, gi) => { geo.addGroup(off, bk.length, gi); off += bk.length; for (const k of bk) idx.push(k); });
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ── projection grid: fast "ray along D" hits on a set of meshes ──
   frame: D (ray direction, into the surface), A/B (plane axes), all orthonormal */
export function frameFrom(D, upHint = V3(0, 1, 0)) {
  D = D.clone().normalize();
  let A = new THREE.Vector3().crossVectors(upHint, D);
  if (A.lengthSq() < 1e-6) A = new THREE.Vector3().crossVectors(V3(1, 0, 0), D);
  A.normalize();
  const B = new THREE.Vector3().crossVectors(D, A).normalize();
  return { D, A, B };
}
export const FR = {
  front: { D: V3(-1, 0, 0), A: V3(0, 0, 1), B: V3(0, 1, 0) },
  rear: { D: V3(1, 0, 0), A: V3(0, 0, 1), B: V3(0, 1, 0) },
  right: { D: V3(0, 0, -1), A: V3(1, 0, 0), B: V3(0, 1, 0) },
  left: { D: V3(0, 0, 1), A: V3(1, 0, 0), B: V3(0, 1, 0) },
  top: { D: V3(0, -1, 0), A: V3(1, 0, 0), B: V3(0, 0, 1) },
};
export const mirrorZ = f => ({ D: V3(f.D.x, f.D.y, -f.D.z), A: V3(f.A.x, f.A.y, -f.A.z), B: V3(f.B.x, f.B.y, -f.B.z) });

export function projector(meshes, F, cell = 0.6) {
  const tris = [];          // [u0,v0,u1,v1,u2,v2, d0,d1,d2, ia, ib, ic, meshIndex]
  const data = meshes.map(m => ({ pos: m.geometry.attributes.position, nrm: m.geometry.attributes.normal, idx: m.geometry.index.array }));
  const grid = new Map(), key = (i, j) => i * 100003 + j;
  const P = new THREE.Vector3();
  data.forEach((d, mi) => {
    const n = d.pos.count, pu = new Float32Array(n), pv = new Float32Array(n), pd = new Float32Array(n);
    for (let k = 0; k < n; k++) { P.fromBufferAttribute(d.pos, k); pu[k] = P.dot(F.A); pv[k] = P.dot(F.B); pd[k] = P.dot(F.D); }
    for (let t = 0; t < d.idx.length; t += 3) {
      const a = d.idx[t], b = d.idx[t + 1], c = d.idx[t + 2];
      const T = [pu[a], pv[a], pu[b], pv[b], pu[c], pv[c], pd[a], pd[b], pd[c], a, b, c, mi];
      const id = tris.length; tris.push(T);
      const u0 = Math.floor(Math.min(T[0], T[2], T[4]) / cell), u1 = Math.floor(Math.max(T[0], T[2], T[4]) / cell);
      const v0 = Math.floor(Math.min(T[1], T[3], T[5]) / cell), v1 = Math.floor(Math.max(T[1], T[3], T[5]) / cell);
      if ((u1 - u0 + 1) * (v1 - v0 + 1) > 400) continue;
      for (let i = u0; i <= u1; i++) for (let j = v0; j <= v1; j++) { const k = key(i, j); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push(id); }
    }
  });
  const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
  return (u, v, off = 0.06) => {
    const l = grid.get(key(Math.floor(u / cell), Math.floor(v / cell)));
    if (!l) return null;
    let best = null, bd = Infinity;
    for (const id of l) {
      const T = tris[id];
      const x0 = T[0], y0 = T[1], x1 = T[2], y1 = T[3], x2 = T[4], y2 = T[5];
      const det = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
      if (Math.abs(det) < 1e-12) continue;
      const l0 = ((y1 - y2) * (u - x2) + (x2 - x1) * (v - y2)) / det;
      const l1 = ((y2 - y0) * (u - x2) + (x0 - x2) * (v - y2)) / det;
      const l2 = 1 - l0 - l1;
      if (l0 < -1e-5 || l1 < -1e-5 || l2 < -1e-5) continue;
      const dd = l0 * T[6] + l1 * T[7] + l2 * T[8];
      if (dd < bd) { bd = dd; best = [T, l0, l1, l2]; }
    }
    if (!best) return null;
    const [T, l0, l1, l2] = best, d = data[T[12]];
    const p = new THREE.Vector3(), q = new THREE.Vector3();
    p.fromBufferAttribute(d.pos, T[9]).multiplyScalar(l0);
    p.add(q.fromBufferAttribute(d.pos, T[10]).multiplyScalar(l1));
    p.add(q.fromBufferAttribute(d.pos, T[11]).multiplyScalar(l2));
    nA.fromBufferAttribute(d.nrm, T[9]); nB.fromBufferAttribute(d.nrm, T[10]); nC.fromBufferAttribute(d.nrm, T[11]);
    const n = nA.multiplyScalar(l0).add(nB.multiplyScalar(l1)).add(nC.multiplyScalar(l2)).normalize().clone();
    return { p: p.addScaledVector(n, off), n, mesh: T[12] };
  };
}

// polygon (in frame u,v) → columns [u, lo, hi]
export function scanPoly(poly, nu) {
  const us = poly.map(p => p[0]), umin = Math.min(...us), umax = Math.max(...us);
  const cols = new Set();
  for (let i = 0; i <= nu; i++) cols.add(+(umin + (umax - umin) * i / nu).toFixed(5));
  for (const u of us) cols.add(+u.toFixed(5));
  const list = [...cols].sort((a, b) => a - b);
  const out = [];
  for (const u0 of list) {
    const u = clamp(u0, umin + 1e-4, umax - 1e-4);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if ((a[0] - u) * (b[0] - u) > 0 || a[0] === b[0]) continue;
      const t = (u - a[0]) / (b[0] - a[0]), v = a[1] + (b[1] - a[1]) * t;
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    if (lo <= hi) out.push([u0, lo, hi]);
  }
  return out;
}
// rounded-corner polygon helper (rect / generic) in 2D
export function roundPoly(pts, r, seg = 4) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const rr = Math.min(r, da / 2, db / 2);
    const pa = [p[0] + (a[0] - p[0]) / da * rr, p[1] + (a[1] - p[1]) / da * rr];
    const pb = [p[0] + (b[0] - p[0]) / db * rr, p[1] + (b[1] - p[1]) / db * rr];
    for (let k = 0; k <= seg; k++) { const t = k / seg; const x = (1 - t) * (1 - t) * pa[0] + 2 * (1 - t) * t * p[0] + t * t * pb[0], y = (1 - t) * (1 - t) * pa[1] + 2 * (1 - t) * t * p[1] + t * t * pb[1]; out.push([x, y]); }
  }
  return out;
}


// make triangle winding agree with the stored (outward) normals
export function orient(g) {
  const p = g.attributes.position, n = g.attributes.normal, ix = g.index.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  let score = 0;
  for (let t = 0; t < ix.length; t += 3) {
    a.fromBufferAttribute(p, ix[t]); b.fromBufferAttribute(p, ix[t + 1]); c.fromBufferAttribute(p, ix[t + 2]);
    const f = b.sub(a).cross(c.sub(a));
    m.fromBufferAttribute(n, ix[t]);
    score += Math.sign(f.dot(m));
  }
  if (score < 0) for (let t = 0; t < ix.length; t += 3) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; }
  g.index.needsUpdate = true;
  return g;
}

const texCache = {};
export function canvasTex(id, w, h, paint, repeat = true) {
  if (texCache[id]) return texCache[id];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (texCache[id] = t);
}

// photo-studio reflection map: dark room, long softboxes overhead, a bright horizon
// band and a darker floor — gives the paint the classic "horizon line" along the flanks
export function studioEnv() {
  return canvasTex('studioEnv', 1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#3a3f46'); gr.addColorStop(0.3, '#23272c'); gr.addColorStop(0.47, '#5d646c');
    gr.addColorStop(0.5, '#d9dee4'); gr.addColorStop(0.515, '#3a3e43'); gr.addColorStop(0.6, '#15171a'); gr.addColorStop(1, '#08090a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const box = (x, y, bw, bh, a) => { const r = g.createLinearGradient(0, y, 0, y + bh); r.addColorStop(0, `rgba(255,255,255,${a * 0.6})`); r.addColorStop(0.5, `rgba(255,255,255,${a})`); r.addColorStop(1, `rgba(255,255,255,${a * 0.6})`); g.fillStyle = r; g.fillRect(x, y, bw, bh); };
    box(0, 40, w, 26, 0.85);                         // long overhead strip (wraps all round)
    box(120, 120, 180, 60, 0.75); box(620, 110, 220, 70, 0.8);   // two big softboxes
    box(430, 170, 90, 50, 0.45);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 232, w, 6);
  }, false);
}

/* ════════════════════════════ THE CAR ════════════════════════════ */

/* ════════════════════════════ shared materials ════════════════════════════ */
export function carMaterials({ paint = 0xb0b5bb, tailOff, head } = {}) {
  const M = {};
  M.paint = new THREE.MeshPhysicalMaterial({ color: paint, metalness: 0.0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.25, vertexColors: true });
  { const env = studioEnv(); env.mapping = THREE.EquirectangularReflectionMapping; M.paint.envMap = env; M.paint.envMapIntensity = 1.0; }
  M.paintPlain = M.paint.clone(); M.paintPlain.vertexColors = false;
  M.glass = new THREE.MeshPhysicalMaterial({ color: 0x070b0f, metalness: 0.0, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.0, envMapIntensity: 1.2, transparent: true, opacity: 0.78, depthWrite: false });
  M.frit = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.35, metalness: 0.0, clearcoat: 1, envMapIntensity: 1.2 });
  M.pianoBlack = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.25, metalness: 0.0, clearcoat: 0.5, clearcoatRoughness: 0.1, envMapIntensity: 0.5 });
  M.satinBlack = new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.65, metalness: 0.1 });
  M.plasticTex = new THREE.MeshStandardMaterial({ color: 0x121315, roughness: 0.85, metalness: 0.0 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.16, metalness: 1, envMapIntensity: 2.4 });
  M.gap = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6, metalness: 0.0 });
  M.under = new THREE.MeshStandardMaterial({ color: 0x0a0b0c, roughness: 0.95, side: THREE.DoubleSide });
  M.lensClear = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.0, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.5, depthWrite: false });
  M.housing = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.25, metalness: 0.85, envMapIntensity: 1.6 });
  M.reflector = new THREE.MeshStandardMaterial({ color: 0xd5dbe2, roughness: 0.12, metalness: 1, envMapIntensity: 2 });
  M.drl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf4ff, emissiveIntensity: 2.6 });
  M.projGlass = head || new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1c6, emissiveIntensity: 2.0 });
  M.redLens = new THREE.MeshPhysicalMaterial({ color: 0xa00a14, roughness: 0.06, metalness: 0.0, clearcoat: 1, envMapIntensity: 1.4, emissive: 0x6a0006, emissiveIntensity: 0.9 });
  M.redDeep = new THREE.MeshPhysicalMaterial({ color: 0x5c0309, roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.5, emissive: 0x2a0003, emissiveIntensity: 1 });
  M.tailGlow = tailOff || new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a2a, emissiveIntensity: 1.1, side: THREE.DoubleSide });
  M.reverse = new THREE.MeshPhysicalMaterial({ color: 0xe9ecef, roughness: 0.05, metalness: 0.6, clearcoat: 1, envMapIntensity: 2 });
  M.amber = new THREE.MeshPhysicalMaterial({ color: 0xc86a10, roughness: 0.08, clearcoat: 1, emissive: 0x4a2000, emissiveIntensity: 0.8 });
  for (const k of ['frit', 'pianoBlack', 'satinBlack', 'plasticTex', 'chrome', 'gap', 'housing', 'reflector', 'drl', 'redLens', 'redDeep', 'reverse', 'lensClear', 'amber'])
    { const m = M[k]; m.side = THREE.DoubleSide; m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2; }
  const honey = canvasTex('honey', 64, 64, (g, w, h) => {
    g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2b2f35'; g.lineWidth = 3;
    const r = 10, dx = r * 1.732;
    for (let y = -r; y < h + r * 2; y += r * 1.5) for (let x = -dx; x < w + dx; x += dx) {
      const ox = (Math.round(y / (r * 1.5)) % 2) * dx / 2; g.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; g.lineTo(x + ox + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82); } g.closePath(); g.stroke();
    }
  });
  const decalStd = o => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...o });
  M.honey = decalStd({ map: honey, roughness: 0.5, metalness: 0.3 });
  const grainTex = canvasTex('grain', 64, 64, (g, w, h) => { g.fillStyle = '#141517'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 14 + Math.random() * 18 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } });
  M.grain = decalStd({ map: grainTex, roughness: 0.9 });
  M.decalStd = decalStd;
  return M;
}

/* ════════════════════════════ decals ════════════════════════════
   decal(pr, F, poly, material, offset, opts) — fills a polygon (frame u,v)
   line(pr, polyline, width, material, offset) — a strip along a polyline
   Both are merged by material in flush(). */
export const to2 = (F, pts) => pts.map(([x, y, z]) => [x * F.A.x + y * F.A.y + z * F.A.z, x * F.B.x + y * F.B.y + z * F.B.z]);
export const ellipse = (cu, cv, ru, rv, n = 28) => Array.from({ length: n }, (_, i) => [cu + Math.cos(i / n * Math.PI * 2) * ru, cv + Math.sin(i / n * Math.PI * 2) * rv]);
export function decalKit(car) {
  const proj = {}, decals = [];
  const P = (name, meshes, F) => proj[name] || (proj[name] = projector(meshes, F));
  function decal(pr, F, poly, material, off = 0.06, o = {}) {
    const cols = scanPoly(poly, o.nu || 40), nv = o.nv || 8;
    const pos = [], nrm = [], uv = [], grid = [];
    const uS = o.uvScale || 1;
    for (const [u, lo, hi] of cols) {
      const col = [];
      for (let j = 0; j <= nv; j++) { const v = lo + (hi - lo) * j / nv; const h = pr(u, v, off); col.push(h ? [h, u, v] : null); }
      if (col.some(Boolean)) grid.push(col);
    }
    if (grid.length < 2) return null;
    const any = grid.flat().find(Boolean)[0];
    for (const col of grid) for (const q of col) { const h = q ? q[0] : any, u = q ? q[1] : 0, v = q ? q[2] : 0; pos.push(h.p.x, h.p.y, h.p.z); nrm.push(h.n.x, h.n.y, h.n.z); uv.push(u * uS, v * uS); }
    const idx = [];
    for (let i = 0; i < grid.length - 1; i++) for (let j = 0; j < nv; j++) {
      if (!grid[i][j] || !grid[i][j + 1] || !grid[i + 1][j] || !grid[i + 1][j + 1]) continue;
      const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); orient(g);
    if (o.separate) { const m = new THREE.Mesh(g, material); car.add(m); return m; }
    decals.push([g, material]);
    return g;
  }
  function line(pr, polyline, width, material, off = 0.05, o = {}) {
    const pts = [];
    for (let i = 0; i < polyline.length - 1; i++) {
      const a = polyline[i], b = polyline[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
      for (let k = 0; k < n; k++) pts.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
    }
    pts.push(polyline[polyline.length - 1]);
    const pos = [], nrm = [], idx = [];
    let cnt = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const h1 = pr(pts[i][0] - ty * width / 2, pts[i][1] + tx * width / 2, off), h2 = pr(pts[i][0] + ty * width / 2, pts[i][1] - tx * width / 2, off);
      if (!h1 || !h2) { cnt = 0; continue; }
      pos.push(h1.p.x, h1.p.y, h1.p.z, h2.p.x, h2.p.y, h2.p.z); nrm.push(h1.n.x, h1.n.y, h1.n.z, h2.n.x, h2.n.y, h2.n.z);
      if (cnt > 0) { const base = pos.length / 3 - 4; idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); }
      cnt++;
    }
    if (idx.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length / 3 * 2).fill(0), 2));
    g.setIndex(idx); orient(g);
    if (o.separate) { const m = new THREE.Mesh(g, material); car.add(m); return m; }
    decals.push([g, material]);
    return g;
  }
  function flush(lateMats = []) {
    const byMat = new Map();
    for (const [g, m] of decals) { if (!byMat.has(m)) byMat.set(m, []); byMat.get(m).push(g); }
    for (const [m, gs] of byMat) { const merged = mergeGeometries(gs, false); if (merged) { const mm = new THREE.Mesh(merged, m); mm.renderOrder = lateMats.includes(m) ? 2 : 1; car.add(mm); } gs.forEach(g => g.dispose()); }
    decals.length = 0;
  }
  return { P, decal, line, flush };
}

/* ════════════════════════════ body helpers ════════════════════════════ */
// cosine-spaced stations with fine steps around the wheel arches (no slivers)
export function bodyStations(XF, XR, AX, ARCH, NX = 200) {
  const st = new Set();
  for (let i = 0; i <= NX; i++) { const t = i / NX; st.add(+((XF + XR) / 2 + (XF - XR) / 2 * Math.cos(Math.PI * t)).toFixed(4)); }
  for (const a of AX) for (let d = -ARCH - 0.6; d <= ARCH + 0.6; d += 0.25) st.add(+(a + d).toFixed(4));
  for (const a of AX) for (const d of [-ARCH, ARCH]) st.add(+(a + d).toFixed(4));
  const isEdge = x => AX.some(a => Math.abs(Math.abs(x - a) - ARCH) < 1e-3);
  const stations = [];
  for (const x of [...st].sort((a, b) => b - a)) if (!stations.length || stations[stations.length - 1] - x > 0.09 || isEdge(x)) stations.push(x);
  if (stations[stations.length - 1] !== XR) { if (stations[stations.length - 1] - XR < 0.05) stations.pop(); stations.push(XR); }
  for (const x of [...st]) if ((x > XF - 0.5 || x < XR + 0.5) && !stations.includes(x)) stations.push(x);
  return stations.sort((a, b) => b - a);
}
// arches cut AFTER normals (clean fender shading) + cheap AO in vertex colours
export function finishBody(geo, archY, AX, WR, ARCH) {
  const p = geo.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i); let y = p.getY(i);
    const ay = archY(x);
    if (y < ay) { y = ay; p.setY(i, y); }
    let ao = 1 - 0.32 * ss(6.5, 2.4, y);
    for (const a of AX) { const d = Math.hypot(x - a, y - WR); ao *= 1 - 0.28 * ss(ARCH + 1.6, ARCH, d); }
    col.push(ao, ao, ao);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}
export function whiteColors(geo) { geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count * 3).fill(1), 3)); }
export function uniformStations(a, b, step, keep = []) {
  const s = new Set(), n = Math.round((a - b) / step);
  for (let i = 0; i <= n; i++) { const x = a - (a - b) * i / n; if (keep.every(k => Math.abs(k - x) > 0.08)) s.add(+x.toFixed(4)); }
  for (const k of keep) s.add(k);
  return [...s].sort((p, q) => q - p);
}
export function wheelWells(car, M, AX, WR, ARCH, width, under = { len: 64, w: 22 }) {
  for (const a of AX) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(ARCH - 0.08, ARCH - 0.08, width, 32, 1, true, Math.PI / 2, Math.PI), M.under);
    w.rotation.x = Math.PI / 2; w.position.set(a, WR, 0); car.add(w);
    for (const s of [1, -1]) { const d = new THREE.Mesh(new THREE.CircleGeometry(ARCH - 0.1, 32, 0, Math.PI), M.under); d.position.set(a, WR, s * (width / 2 - 3.8)); car.add(d); }
    for (const dx of [-1, 1]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.4, WR - 3.0), M.under); wl.rotation.y = Math.PI / 2; wl.position.set(a + dx * (ARCH - 0.08), (WR + 3.0) / 2, 0); car.add(wl); }
  }
  const u = new THREE.Mesh(new THREE.PlaneGeometry(under.len, under.w), M.under); u.rotation.x = Math.PI / 2; u.position.y = 2.7; car.add(u);
}

/* ════════════════════════════ 3D parts ════════════════════════════ */
export function doorHandle(car, M, h, len = 2.3) {
  const g = new THREE.Group(); g.position.copy(h.p); g.lookAt(h.p.clone().add(h.n));
  const rec = new THREE.Mesh(new THREE.CircleGeometry(1, 20), M.satinBlack); rec.scale.set(len * 0.67, 0.55, 1); g.add(rec);
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, len, 4, 10), M.handle || M.chrome); bar.rotation.z = Math.PI / 2; bar.position.z = 0.22; bar.scale.set(1, 1, 0.75); g.add(bar);
  car.add(g); return g;
}
// body-colour cap on a black base at the door's front corner
export function sideMirror(car, M, s, { at, size = [1.35, 1.12, 2.1], base, stalkTo, capMat }) {
  const g = new THREE.Group(); g.position.set(at[0], at[1], s * at[2]);
  const capGeo = new THREE.SphereGeometry(1, 32, 20, 0, Math.PI); capGeo.rotateY(Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, capMat || M.paintPlain); cap.scale.set(...size); g.add(cap);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 40), M.satinBlack); rim.rotation.y = Math.PI / 2; rim.scale.set(1, size[1] * 1.04, size[2] * 0.96); g.add(rim);
  const mir = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshPhysicalMaterial({ color: 0x7d8894, metalness: 1, roughness: 0.03, envMapIntensity: 1.8 }));
  mir.rotation.y = -Math.PI / 2; mir.scale.set(size[2] * 0.93, size[1] * 0.95, 1); mir.position.x = -0.04; g.add(mir);
  const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), M.satinBlack); lower.scale.set(size[0] * 1.015, size[1] * 1.01, size[2] * 1.01); g.add(lower);
  g.rotation.y = s * 0.1;
  car.add(g);
  const A0 = base.clone(), A1 = V3(stalkTo[0], stalkTo[1], s * stalkTo[2]);
  const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, A0.distanceTo(A1) + 0.6), M.satinBlack);
  st.position.copy(A0).lerp(A1, 0.5); st.rotation.y = s * 0.1; car.add(st);
  return g;
}
// cabin seen through the glass. p: { tub:[x0,x1,h,w], dashX, wheelZ, frontSeatX, rearSeatX, seatW, shelf:[x, y] }
export function cabinInterior(car, M, p) {
  const trimI = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.8 });
  const tub = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.95, side: THREE.BackSide });
  const seatM = new THREE.MeshStandardMaterial({ color: p.seat || 0x0c0c0e, roughness: 0.7 });
  const stitch = new THREE.MeshStandardMaterial({ color: p.seat2 || 0x1a1b1e, roughness: 0.6 });
  const add = (geo, m, x, y, z, rz = 0, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(0, ry, rz); car.add(o); return o; };
  const [t0, t1, th, tw] = p.tub;
  add(new THREE.BoxGeometry(t0 - t1, th, tw), tub, (t0 + t1) / 2, 3.8 + th / 2, 0);
  const D = p.dashX, dw = p.dashW, dy = p.dashY ?? 13.6;
  add(new THREE.BoxGeometry(6.5, 2.6, dw), trimI, D, dy, 0);
  add(new THREE.BoxGeometry(5.0, 0.8, dw - 0.4), trimI, D - 0.8, dy + 1.3, 0, -0.12);
  add(new THREE.BoxGeometry(2.4, 1.3, 5.4), trimI, D - 1.2, dy + 2.3, -p.wheelZ);
  add(new THREE.BoxGeometry(0.2, 2.3, 3.6), new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.1, clearcoat: 1 }), D - 1.6, dy + 1.8, 0, 0.25);
  add(new THREE.BoxGeometry(3.4, 4.0, 3.4), trimI, D - 4, 8.4, 0);
  add(new THREE.BoxGeometry(7.5, 1.6, 3.0), trimI, p.frontSeatX + 0.5, 8.6, 0);
  const sw = new THREE.Group(); sw.position.set(D - 3.0, dy + 1.3, -p.wheelZ); sw.rotation.z = -0.5;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.24, 10, 32), seatM); ring.rotation.y = Math.PI / 2; sw.add(ring);
  const hubS = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 16), seatM); hubS.rotation.z = Math.PI / 2; sw.add(hubS);
  for (const a of [0, 2.2, -2.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.35), seatM); sp.position.set(0, Math.cos(a) * -0.8, Math.sin(a) * 0.8); sp.rotation.x = a; sw.add(sp); }
  car.add(sw);
  add(new THREE.CylinderGeometry(0.3, 0.35, 3.2, 10), trimI, D - 1.6, dy + 0.6, -p.wheelZ, Math.PI / 2 - 0.5);
  const F = p.frontSeatX;
  for (const z of [-p.wheelZ, p.wheelZ]) {
    add(new THREE.BoxGeometry(4.6, 1.6, 4.6), seatM, F, 7.0, z);
    const back = new THREE.Group(); back.position.set(F - 2.4, 7.6, z); back.rotation.z = 0.24; car.add(back);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 7.4, 4.6), seatM); bk.position.y = 3.7; back.add(bk);
    for (const dz of [-1.7, 1.7]) { const bol = new THREE.Mesh(new THREE.BoxGeometry(1.7, 6.4, 0.8), stitch); bol.position.set(0.2, 3.4, dz); back.add(bol); }
    const hr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 3.0), seatM); hr.position.set(-0.1, 8.5, 0); back.add(hr);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 1.6), M.chrome); post.position.set(0, 7.5, 0); back.add(post);
  }
  const R = p.rearSeatX, sw2 = p.seatW;
  add(new THREE.BoxGeometry(4.8, 1.6, sw2), seatM, R, 7.3, 0);
  const rb = new THREE.Group(); rb.position.set(R - 2.4, 7.9, 0); rb.rotation.z = 0.3; car.add(rb);
  const rbk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.0, sw2), seatM); rbk.position.y = 3.5; rb.add(rbk);
  for (const z of [-sw2 * 0.32, 0, sw2 * 0.32]) { const hr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 2.8), seatM); hr.position.set(-0.2, 7.7, z); rb.add(hr); }
  if (p.shelf) add(new THREE.BoxGeometry(p.shelf[2] || 6.5, 0.4, p.tub[3] - 1.1), trimI, p.shelf[0], p.shelf[1], 0, 0.12);
}
// wheels with lathe tyre, split-spoke alloy, disc + caliper
export function alloyWheels(p) {
  const { TW, RIM, R } = p;
  const tyreM = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.88 });
  const rimM = new THREE.MeshPhysicalMaterial({ color: p.rimColor ?? 0x6d737b, metalness: 0.85, roughness: 0.3, clearcoat: 0.6, envMapIntensity: 1.3 });
  const machined = new THREE.MeshStandardMaterial({ color: p.faceColor ?? 0xc4cad1, metalness: 1, roughness: 0.22, envMapIntensity: 1.5 });
  const discM = new THREE.MeshStandardMaterial({ color: 0x4a4e54, metalness: 0.9, roughness: 0.5 });
  const caliperM = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.4, roughness: 0.5 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 1 });
  const k = TW / 3.2, h = TW / 2;
  const tyreGeo = (() => {
    const side = [[RIM - 0.05, -1.35 * k], [RIM + 0.25, -1.5 * k], [lerp(RIM, R, 0.4), -h], [lerp(RIM, R, 0.75), -h * 0.99], [R - 0.13, -h * 0.9], [R - 0.02, -h * 0.72], [R, -h * 0.3]];
    const prof = [...side, ...side.slice().reverse().map(([r, z]) => [r, -z])];
    const g = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 56); g.rotateX(Math.PI / 2); return g;
  })();
  const grooveGeo = (() => { const g = new THREE.CylinderGeometry(R + 0.015, R + 0.015, 0.12, 56, 1, true); g.rotateX(Math.PI / 2); return g; })();
  const barrelGeo = (() => { const g = new THREE.CylinderGeometry(RIM - 0.1, RIM - 0.1, TW - 0.4, 40, 1, true); g.rotateX(Math.PI / 2); return g; })();
  const lipGeo = new THREE.TorusGeometry(RIM - 0.08, 0.13, 8, 48);
  const sp = p.spokes || { n: 5, split: 0.16, w0: 0.33, w1: 0.3 };
  const armShape = (sgn) => {
    const sh = new THREE.Shape(), r0 = 1.05, r1 = RIM - 0.18, a1 = sp.split * sgn;
    const P2 = (r, a, w) => [r * Math.cos(a) - w * Math.sin(a), r * Math.sin(a) + w * Math.cos(a)];
    const pts = sp.split ? [P2(r0, 0, sgn > 0 ? 0.03 : -sp.w0), P2(r1, a1, -sp.w1), P2(r1, a1, sp.w1), P2(r0, 0, sgn > 0 ? sp.w0 : -0.03)]
                         : [P2(r0, 0, -sp.w0), P2(r1, 0, -sp.w1), P2(r1, 0, sp.w1), P2(r0, 0, sp.w0)];
    sh.moveTo(...pts[0]); for (const q of pts.slice(1)) sh.lineTo(...q); sh.closePath();
    return sh;
  };
  const shapes = sp.split ? [armShape(1), armShape(-1)] : [armShape(1)];
  const dish = (g, z0) => { const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); pos.setZ(i, pos.getZ(i) + z0 - 0.42 * Math.pow(Math.max(0, (r - 0.9) / (RIM - 1.1)), 1.4)); } g.computeVertexNormals(); return g; };
  const spokeGeo = dish(new THREE.ExtrudeGeometry(shapes, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 2, curveSegments: 2, steps: 6 }), 0);
  const spokeFaceGeo = dish(new THREE.ShapeGeometry(shapes, 1), 0.5);
  return function wheel(front, s) {
    const g = new THREE.Group(), spin = new THREE.Group();
    spin.add(new THREE.Mesh(tyreGeo, tyreM));
    for (const z of [-0.17 * TW, 0.17 * TW]) { const gr = new THREE.Mesh(grooveGeo, darkM); gr.position.z = z; spin.add(gr); }
    spin.add(new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide })));
    const face = new THREE.Group(); face.position.z = s * (TW / 2 - 0.55); if (s < 0) face.rotation.y = Math.PI;
    const lip = new THREE.Mesh(lipGeo, machined); lip.position.z = 0.5; face.add(lip);
    const lip2 = new THREE.Mesh(new THREE.RingGeometry(RIM - 0.45, RIM - 0.05, 48), rimM); lip2.position.z = 0.42; face.add(lip2);
    for (let i = 0; i < sp.n; i++) {
      const a = i / sp.n * Math.PI * 2;
      const m1 = new THREE.Mesh(spokeGeo, rimM); m1.rotation.z = a; face.add(m1);
      const m2 = new THREE.Mesh(spokeFaceGeo, machined); m2.rotation.z = a; face.add(m2);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.5, 30), rimM); hub.rotation.x = Math.PI / 2; hub.position.z = 0.3; face.add(hub);
    const capC = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.24, 30), p.capMat || rimM); capC.rotation.x = Math.PI / 2; capC.position.z = 0.6; face.add(capC);
    const nuts = p.nuts || 5;
    for (let i = 0; i < nuts; i++) { const a = (i + 0.5) / nuts * Math.PI * 2; const n = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.25, 8), machined); n.rotation.x = Math.PI / 2; n.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.5); face.add(n); }
    spin.add(face);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(RIM * 0.8, RIM * 0.8, 0.35, 40), discM); disc.rotation.x = Math.PI / 2; disc.position.z = s * 0.2; spin.add(disc);
    const back = new THREE.Mesh(new THREE.CircleGeometry(RIM - 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9, side: THREE.DoubleSide })); back.position.z = -s * 0.6; spin.add(back);
    g.add(spin);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.9), caliperM); cal.position.set(front ? -RIM * 0.62 : RIM * 0.62, RIM * 0.3, s * 0.35); g.add(cal);
    g.userData.spin = spin; g.userData.front = front;
    return g;
  };
}
export function studioShadowPlane(car, tex, w, d) {
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; car.add(sh);
}
