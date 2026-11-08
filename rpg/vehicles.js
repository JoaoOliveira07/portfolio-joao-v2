/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — 3D VEHICLES
   Low-poly but "real" cars, helicopter and airliner, built with three.js and
   rendered through an orthographic camera that reproduces the city's exact
   2:1 isometric projection. One shared WebGL renderer draws each vehicle into
   its own little 2D <canvas>, so vehicles keep living in the DOM world layer
   (depth sorting, walking behind buildings, collisions — all unchanged).

   Only redrawn when something changes: the car you drive / the helicopter you
   fly every frame, parked and traffic cars once. If WebGL isn't available,
   nothing happens and the SVG vehicles from city.js stay.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { RoomEnvironment } from './assets/vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './assets/vendor/RoundedBoxGeometry.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { buildCruze } from './cars/cruze.js?v=2';
import { buildHB20 } from './cars/hb20.js?v=1';
import { buildClio } from './cars/clio.js?v=2';
import { buildXTZ } from './cars/xtz.js?v=1';

const W = 260, H = 170;                 // same box as CAR_VB in city.js (x −130…130, y −95…75)
const DPR = (window.devicePixelRatio || 1) >= 1.75 ? 2 : 1.5;   // 1.5 or 2 only: keeps every box a whole number of pixels
const HMAX = 205;                                               // tallest box (train), the GL canvas is W × HMAX

function boot() {
  const CITY = window.CITY;
  if (!CITY || !CITY.attachGL) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (e) { console.warn('[vehicles] WebGL indisponível, mantendo SVG', e); return; }
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, HMAX, false);
  renderer.setScissorTest(true);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // night lighting: cool sky fill, a moon key from the upper-left, warm street rim
  const hemi = new THREE.HemisphereLight(0x9ab8ff, 0x07090c, 0.7); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xdfe8ff, 1.6); key.position.set(-60, 140, 90); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa060, 0.7); rim.position.set(90, 40, -70); scene.add(rim);
  // time of day (same periods as world3d.js); city.js redraws the vehicles after this runs
  const VP = {
    night: [0x9ab8ff, 0x07090c, 0.7, 0xdfe8ff, 1.6, 0xffa060, 0.7],
    dusk:  [0xffc9a8, 0x1a1218, 1.0, 0xffad6b, 2.2, 0x8a7bff, 0.5],
    dawn:  [0xffd9e6, 0x1a1820, 1.0, 0xffd2b8, 2.0, 0x9ab8ff, 0.5],
    day:   [0xe4f0ff, 0x5d5848, 1.8, 0xfff3e2, 2.8, 0xc4dcff, 0.6],
  };
  const setPeriod = p => { const v = VP[p]; if (!v) return; hemi.color.setHex(v[0]); hemi.groundColor.setHex(v[1]); hemi.intensity = v[2]; key.color.setHex(v[3]); key.intensity = v[4]; rim.color.setHex(v[5]); rim.intensity = v[6]; };
  setPeriod(window.CITY_PERIOD || 'night');
  window.addEventListener('city:period', e => setPeriod(e.detail));

  /* ── camera: world X = iso u, Z = iso v, Y = height (1 unit = 1 px) ──
     screen x = u − v, screen y = (u+v)/2 − h  →  view y = h − (u+v)/2,
     depth grows toward the viewer (+u +v, up). */
  const camera = new THREE.OrthographicCamera(-130, 130, 95, -75, 1, 2000);
  const M = new THREE.Matrix4().set(
     1,    0,   -1,    0,
    -0.5,  1,   -0.5,  0,
     0.5,  0.5,  0.5, -800,
     0,    0,    0,    1);
  camera.matrixAutoUpdate = false;
  camera.matrixWorld.copy(M).invert();
  camera.matrixWorldInverse.copy(M);

  /* ── materials ── */
  const mat = {
    trim:  new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.55, metalness: 0.4 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x06090d, roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.6 }),
    tire:  new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.92 }),
    rim:   new THREE.MeshStandardMaterial({ color: 0x8d969f, roughness: 0.28, metalness: 1 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.35, metalness: 0.9 }),
    head:  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1c6, emissiveIntensity: 2.6 }),
    tailOn:  new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1e1e, emissiveIntensity: 3.6 }),
    tailOff: new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a2a, emissiveIntensity: 1.1 }),
    red:   new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff3030, emissiveIntensity: 3 }),
    green: new THREE.MeshStandardMaterial({ color: 0x003000, emissive: 0x30ff80, emissiveIntensity: 3 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.5 }),
    warmWin: new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffd48a, emissiveIntensity: 1.8 }),
    blade: new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.5, metalness: 0.6 }),
    blur:  new THREE.MeshBasicMaterial({ color: 0xcfd8e2, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }),
    edge:  new THREE.LineBasicMaterial({ color: 0xe8f0f8, transparent: true, opacity: 0.22 }),
  };
  const paint = (hex) => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.1 });
  const neon = (hex) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(hex), emissiveIntensity: 2.2 });

  const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
  const withEdges = (mesh, angle = 32) => { mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, angle), mat.edge)); return mesh; };
  // extrude a side profile (x forward, y up) symmetrically across z
  function profile(points, depth, bevel, curveSeg = 10) {
    const s = new THREE.Shape();
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.75, bevelSegments: 3, curveSegments: curveSeg });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }

  /* ════════════════════════════ CAR ════════════════════════════ */
  function wheel(front) {
    const g = new THREE.Group();          // yaw (steering) lives here
    const spin = new THREE.Group();       // roll lives here
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 4.4, 22), mat.tire);
    tire.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 4.6, 18), mat.rimDark);
    rim.rotation.x = Math.PI / 2;
    spin.add(tire, rim);
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
      const spoke = box(0.9, 6.8, 0.5, mat.rim, 0, 0, side * 2.35);
      spoke.rotation.z = k * Math.PI * 2 / 5;
      spin.add(spoke);
    }
    g.add(spin);
    g.userData.spin = spin; g.userData.front = front;
    return g;
  }

  function buildCar(color, special) {
    const car = new THREE.Group();
    const body = paint(color);
    // body shell: low wedge nose, flat beltline, short rounded tail
    const shell = withEdges(new THREE.Mesh(profile([
      [30.5, 7], [-29.5, 7], [-30.6, 10.4], [-30.3, 13.9, -25, 14.3], [9, 14.3], [22, 13.2, 31.2, 10.2], [30.5, 7],
    ], 23, 2.2), body));
    car.add(shell);
    // greenhouse: one sweep of dark glass, fast windshield, long rear glass
    const cab = withEdges(new THREE.Mesh(profile([
      [11, 14.2], [3, 19.6, -4, 20.6], [-14, 20.6], [-22, 19.6, -27, 14.4], [11, 14.2],
    ], 16.5, 1.6), mat.glass), 40);
    car.add(cab);
    // sills, bumpers, splitter, diffuser
    car.add(box(52, 2.6, 26.4, mat.trim, 0, 5.6, 0));
    car.add(box(2.2, 2.4, 22, mat.trim, 31.3, 6.4, 0));
    car.add(box(2.0, 2.6, 22, mat.trim, -31, 7, 0));
    // lights
    for (const z of [-8.5, 8.5]) { const h = box(1.2, 1.1, 6.5, mat.head, 30.9, 10.6, z); h.rotation.y = z > 0 ? -0.18 : 0.18; car.add(h); }
    const tail = box(0.9, 1.3, 21, mat.tailOff, -31.6, 12.1, 0); car.add(tail);
    // neon underglow strip along both sills (city accent)
    const glow = neon(color);
    for (const z of [-13.4, 13.4]) car.add(box(40, 0.5, 0.4, glow, 0, 4.5, z));
    // door shut-lines + mirrors
    for (const z of [-13.75, 13.75]) {
      car.add(box(0.25, 6.2, 0.2, mat.trim, -1.5, 10.6, z));
      car.add(box(2.4, 1.5, 2.2, body, 8.5, 15.2, z * 0.92));
    }
    if (special) {
      car.add(box(4, 1.6, 9, new THREE.MeshStandardMaterial({ color: 0x332b00, emissive: 0xffe600, emissiveIntensity: 3 }), -9, 21.6, 0));
    }
    const wheels = [];
    for (const [x, front] of [[19, true], [-19, false]]) for (const z of [-12.4, 12.4]) {
      const w = wheel(front); w.position.set(x, 5.8, z); car.add(w); wheels.push(w);
    }
    car.userData = { wheels, tail };
    car.visible = false;
    scene.add(car);
    return car;
  }


  /* ════════════════════════════ REAL CARS (the garage) ════════════════════════════
     João's own cars, modelled from photos at ~15 units per metre. Each body is a
     side profile (with the wheel arches cut out) extruded across the width and
     then bent: it narrows toward nose and tail, the greenhouse leans in
     (tumblehome) and roof/hood get a crown — so it reads as a car, not a brick.
     Forward = +X. No brand logos; plates are fictional. */
  function smooth(geo) {                       // merge by position → smooth normals across the mesh
    const pos = geo.attributes.position, map = new Map(), verts = [], index = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const key = Math.round(x * 100) + '|' + Math.round(y * 100) + '|' + Math.round(z * 100);
      let j = map.get(key);
      if (j === undefined) { j = verts.length / 3; map.set(key, j); verts.push(x, y, z); }
      index.push(j);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }
  // build a THREE.Shape from a path spec: [x,y] = line, [cx,cy,x,y] = quad, {arc:[cx,cy,r]} = wheel arch (over the top)
  function pathShape(spec) {
    const s = new THREE.Shape();
    spec.forEach((p, i) => {
      if (i === 0) return s.moveTo(p[0], p[1]);
      if (p.arc) { const [cx, cy, r] = p.arc; s.lineTo(cx + r, cy); s.absarc(cx, cy, r, 0, Math.PI, false); return; }
      if (p.arcR) { const [cx, cy, r] = p.arcR; s.lineTo(cx - r, cy); s.absarc(cx, cy, r, Math.PI, 0, true); return; }
      if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]);
    });
    // densify straight runs so the bending below has vertices to work with
    const pts = s.getPoints(10), out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.ceil(a.distanceTo(b) / 1.6);
      for (let k = 1; k <= n; k++) out.push(new THREE.Vector2(a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n));
    }
    return new THREE.Shape(out);
  }
  // squeeze factor across the width at (x, y): plan-view rounding at the ends + tumblehome
  function widthAt(B, x, y) {
    const ends = x > B.xc ? B.endF : B.endR;
    const d = Math.max(0, Math.abs(x - B.xc) - (B.half - ends[1])) / ends[1];
    let f = 1 - ends[0] * d * d;
    if (B.tumble) f *= 1 - B.tumble * Math.min(1, Math.max(0, (y - B.y0) / (B.y1 - B.y0)));
    if (B.tuck) f *= 1 - B.tuck * Math.min(1, Math.max(0, (B.tuckY - y) / B.tuckY));
    return f;
  }
  function bentMesh(spec, B, material) {
    const geo = new THREE.ExtrudeGeometry(pathShape(spec), { depth: B.W, steps: 10, bevelEnabled: true, bevelThickness: B.bevel, bevelSize: B.bevel * 0.8, bevelSegments: 3 });
    geo.translate(0, 0, -B.W / 2);
    const pos = geo.attributes.position, hw = B.W / 2;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const zn = Math.max(-1, Math.min(1, z / hw));
      if (B.crown) y += B.crown * (1 - zn * zn) * Math.min(1, Math.max(0, (y - B.y0) / (B.y1 - B.y0)));
      pos.setXYZ(i, x, y, z * widthAt(B, x, y));
    }
    const g = smooth(geo); geo.dispose();
    return new THREE.Mesh(g, material);
  }
  // greenhouse: glass all round, but the roof panel (between the A and C pillars) in paint
  function greenhouse(spec, B, glassM, roofM) {
    const m = bentMesh(spec, B, glassM), g = m.geometry, idx = g.index.array, pos = g.attributes.position;
    const roof = [], glass = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      a.fromBufferAttribute(pos, idx[t]); b.fromBufferAttribute(pos, idx[t + 1]); c.fromBufferAttribute(pos, idx[t + 2]);
      n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const cx = (a.x + b.x + c.x) / 3;
      (Math.abs(n.y) > 0.72 && cx < B.roof[1] && cx > B.roof[0] ? roof : glass).push(idx[t], idx[t + 1], idx[t + 2]);
    }
    g.setIndex([...roof, ...glass]);
    g.clearGroups(); g.addGroup(0, roof.length, 0); g.addGroup(roof.length, glass.length, 1);
    m.material = [roofM, glassM];
    return m;
  }

  /* ── loft: the car body as cross-sections along X ──
     top/bottom are sampled curves (y as a function of x); each section is a
     rounded-rect superellipse whose half-width comes from hwAt(x, y), so the
     body narrows at the ends (plan view) and leans in at the top (tumblehome).
     classify(x, sinφ, cosφ) → material group index for each face. */
  function sampleCurve(spec) {
    const pts = [];
    let cur = new THREE.Vector2(spec[0][0], spec[0][1]); pts.push(cur.clone());
    for (let i = 1; i < spec.length; i++) {
      const p = spec[i];
      if (p.length === 4) { const c = new THREE.QuadraticBezierCurve(cur.clone(), new THREE.Vector2(p[0], p[1]), new THREE.Vector2(p[2], p[3])); c.getPoints(16).slice(1).forEach(q => pts.push(q)); cur = new THREE.Vector2(p[2], p[3]); }
      else { cur = new THREE.Vector2(p[0], p[1]); pts.push(cur.clone()); }
    }
    pts.sort((a, b) => a.x - b.x);
    return x => {
      if (x <= pts[0].x) return pts[0].y;
      for (let i = 1; i < pts.length; i++) if (x <= pts[i].x) { const a = pts[i - 1], b = pts[i], t = (x - a.x) / Math.max(1e-6, b.x - a.x); return a.y + (b.y - a.y) * t; }
      return pts[pts.length - 1].y;
    };
  }
  function loft({ xF, xR, top, bot, hw, p = 0.32, nx = 110, nr = 44, caps = true, classify = () => 0, groups = 1 }) {
    const pos = [], rows = [];
    const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i <= nx; i++) {
      const t = i / nx, x = (xF + xR) / 2 + (xF - xR) / 2 * Math.cos(Math.PI * t);    // dense at the ends
      const yt = top(x), yb = bot(x), yc = (yt + yb) / 2, hh = Math.max(0.02, (yt - yb) / 2);
      const row = [];
      for (let j = 0; j < nr; j++) {
        const ph = -Math.PI / 2 + j / nr * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph);
        const y = yc + hh * sp(s, p);
        const z = hw(x, y) * sp(c, p);
        row.push(pos.length / 3); pos.push(x, y, z);
      }
      rows.push({ x, row });
    }
    const buckets = Array.from({ length: groups }, () => []);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nr; j++) {
      const a = rows[i].row[j], b = rows[i].row[(j + 1) % nr], c = rows[i + 1].row[j], d = rows[i + 1].row[(j + 1) % nr];
      const ph = -Math.PI / 2 + (j + 0.5) / nr * Math.PI * 2, xm = (rows[i].x + rows[i + 1].x) / 2;
      const gi = classify(xm, Math.sin(ph), Math.cos(ph));
      buckets[gi].push(a, b, c, b, d, c);
    }
    if (caps) for (const end of [0, nx]) {                        // flat fascia at nose and tail
      const r = rows[end].row, base = pos.length / 3;
      let cx = 0, cy = 0, cz = 0; r.forEach(k => { cx += pos[k * 3]; cy += pos[k * 3 + 1]; cz += pos[k * 3 + 2]; });
      pos.push(cx / r.length, cy / r.length, cz / r.length);
      r.forEach(k => pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]));
      for (let j = 0; j < nr; j++) { const a = base + 1 + j, b = base + 1 + (j + 1) % nr; buckets[0].push(base, b, a); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const idx = []; let off = 0;
    buckets.forEach((bk, gi) => { g.addGroup(off, bk.length, gi); off += bk.length; idx.push(...bk); });
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  const plateTex = (() => { const cache = {}; return text => {
    if (cache[text]) return cache[text];
    const c = document.createElement('canvas'); c.width = 128; c.height = 40; const g = c.getContext('2d');
    g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, 128, 40); g.fillStyle = '#1d4fa8'; g.fillRect(0, 0, 128, 10);
    g.fillStyle = '#fff'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.fillText('BRASIL', 64, 8);
    g.fillStyle = '#111'; g.font = 'bold 22px "Courier New", monospace'; g.fillText(text, 64, 33);
    g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 38);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (cache[text] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
  }; })();
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.12, metalness: 1 });
  const blackGloss = new THREE.MeshPhysicalMaterial({ color: 0x07080a, roughness: 0.25, metalness: 0.3, clearcoat: 0.8 });
  const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
  const rbx = (w, h, d, r, m, x, y, z) => mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)), m, x, y, z);

  // wheel with its own rim design; `side` = ±1 (which face points outward)
  function realWheel(front, side, W) {
    const g = new THREE.Group(), spin = new THREE.Group();
    const R = W.r, tw = W.w;
    const tire = mesh(new THREE.CylinderGeometry(R, R, tw, 28), mat.tire); tire.rotation.x = Math.PI / 2; spin.add(tire);
    const wall = mesh(new THREE.TorusGeometry(R - 0.55, 0.6, 8, 28), mat.tire, 0, 0, side * tw / 2); spin.add(wall);
    const rimM = W.rim === 'dark' ? new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.3, metalness: 0.9 }) : new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.16, metalness: 1, envMapIntensity: 1.6 });
    const rr = R * 0.72, face = side * (tw / 2 + 0.05);
    const barrel = mesh(new THREE.CylinderGeometry(rr, rr, tw - 0.9, 24), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5, metalness: 0.6 })); barrel.rotation.x = Math.PI / 2; spin.add(barrel);
    const lip = mesh(new THREE.TorusGeometry(rr, 0.32, 6, 28), rimM, 0, 0, face); spin.add(lip);
    const n = W.spokes, twin = W.twin;
    for (let k = 0; k < n; k++) for (const o of twin ? [-0.13, 0.13] : [0]) {
      const sp = mesh(new THREE.BoxGeometry(twin ? 0.7 : 0.85, rr - 0.7, 0.6), rimM);
      const a = k / n * Math.PI * 2 + o;
      sp.position.set(Math.cos(a + Math.PI / 2) * (rr / 2 + 0.2), Math.sin(a + Math.PI / 2) * (rr / 2 + 0.2), face);
      sp.rotation.z = a; spin.add(sp);
    }
    const hub = mesh(new THREE.CylinderGeometry(1, 1.1, 0.6, 16), rimM, 0, 0, face); hub.rotation.x = Math.PI / 2; spin.add(hub);
    if (W.rim === 'dark') { const cap = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.65, 12), chrome, 0, 0, face); cap.rotation.x = Math.PI / 2; spin.add(cap); }
    g.add(spin);
    g.userData.spin = spin; g.userData.front = front;
    return g;
  }

  const REAL = {
    clio: {
      name: 'Clio', year: '2010/2011', color: 'Preto', paint: 0x1a1d23, metal: 0.85, rough: 0.16, hw: 12.5,
      axle: [17.5, -19.5], wheel: { r: 5, w: 3.6, rim: 'silver', spokes: 10, twin: false }, arch: 6.2,
      xF: 29.5, xR: -29.2,
      top: [[29.5, 8.6], [29.7, 10.9, 27.2, 11.4], [19, 12.6, 11.5, 13.5], [-22.6, 15.1], [-27.9, 15.1, -28.7, 12.3], [-29.2, 7]],
      bot: [[29.5, 3.6], [26, 2.6], [-26, 2.6], [-29.2, 3.9]],
      plan: { xc: 0, half: 29.4, endF: [0.34, 9], endR: [0.2, 6] }, tumble: [9, 15.5, 0.06],
      gTop: [[11.8, 13.4], [6, 16.8, 0.2, 20.3], [-10, 21.5, -19.6, 20.7], [-23.7, 20.1, -25.4, 15.1]],
      gHw: 10.9, gTumble: 0.22, roof: [-19.4, -0.2], bPillar: null,
      doors: [[11.8, 4.5, 13.4], [-9.6, 4.6, 14.4]], molding: [8, 12, -15], plate: 'JOP1C10', lights: 'clio',
    },
    hb20: {
      name: 'HB20', year: '2016', color: 'Branco', paint: 0xeef1f4, metal: 0.1, rough: 0.26, hw: 12.8,
      axle: [18, -19.5], wheel: { r: 5.2, w: 3.8, rim: 'silver', spokes: 5, twin: true }, arch: 6.4,
      xF: 30.1, xR: -29.8,
      top: [[30.1, 8.4], [30.3, 10.8, 27.6, 11.6], [18, 13, 10.6, 14.1], [-23.4, 15.7], [-28.7, 15.9, -29.3, 12.6], [-29.8, 6.8]],
      bot: [[30.1, 3.4], [26.5, 2.6], [-26, 2.6], [-29.8, 4]],
      plan: { xc: 0, half: 30, endF: [0.36, 10], endR: [0.2, 6] }, tumble: [9, 16, 0.06],
      gTop: [[11.6, 14], [4.6, 18, -1.2, 21.6], [-11, 22.6, -20.6, 21.3], [-24.8, 20.4, -26.5, 15.8]],
      gHw: 11.1, gTumble: 0.22, roof: [-20.4, -1], bPillar: -3.4,
      doors: [[11.6, 4.6, 14], [-3.4, 4, 15], [-16.8, 4.6, 15.4]], plate: 'JOP2H16', lights: 'hb20',
    },
    cruze: {
      name: 'Cruze', year: '2016/2017', color: 'Branco', paint: 0xf1f2f4, metal: 0.32, rough: 0.22, hw: 13.5,
      axle: [22.5, -18], wheel: { r: 5.4, w: 4, rim: 'dark', spokes: 5, twin: true }, arch: 6.6,
      xF: 36, xR: -35.8,
      top: [[36, 8.2], [36.2, 10.1, 33.4, 10.9], [22, 12.2, 13.6, 13.4], [-21, 15.3], [-31.6, 15.9], [-35.3, 15.9, -35.6, 12.6], [-35.8, 6.6]],
      bot: [[36, 3.2], [32, 2.8], [-30, 2.8], [-35.8, 4.2]],
      plan: { xc: 0, half: 35.9, endF: [0.38, 12], endR: [0.24, 9] }, tumble: [9, 16, 0.06],
      gTop: [[14.6, 13.3], [6, 17.3, -0.6, 20.9], [-9, 21.8, -15.6, 21], [-22.2, 19.5, -27.2, 15.5]],
      gHw: 11.7, gTumble: 0.22, roof: [-15.6, -0.4], bPillar: -3.6,
      doors: [[13.8, 4.6, 13.4], [-3.6, 4.2, 15], [-19.6, 4.8, 15.4]], chromeBelt: true, fin: true, plate: 'JOP2Z17', lights: 'cruze',
    },
  };

  const studioShadow = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();

  /* ── ready-made models (e.g. generated from photos in Tripo3D) ──
     assets/garage/garage.json lists them: { "cruze": { "file": "cruze.glb", "rotY": 1.5708 } }.
     Each one is scaled to the real car's length, centred and put on the ground,
     facing +X. Without a file the hand-built model below is used. */
  const GLB = {};
  const GLB_LEN = { clio: 58.7, hb20: 59.9, cruze: 71.8, xtz: 32 };
  function normalizeGLB(root, id, c) {
    if (c.hide) { const H = new RegExp(c.hide), drop = []; root.traverse(o => { if (o.isMesh && H.test(o.name)) drop.push(o); }); drop.forEach(o => o.parent.remove(o)); }   // stray parts that break the size
    const wrap = new THREE.Group(), inner = new THREE.Group(); inner.add(root); wrap.add(inner);
    root.traverse(o => { if (o.isMesh && o.material) for (const m of [].concat(o.material)) { m.envMapIntensity = c.env ?? 1.1; if (c.rough !== undefined) m.roughness = c.rough; } });
    let box = new THREE.Box3().setFromObject(inner), size = box.getSize(new THREE.Vector3());
    inner.rotation.y = c.rotY ?? (size.z > size.x ? Math.PI / 2 : 0);
    box = new THREE.Box3().setFromObject(inner); size = box.getSize(new THREE.Vector3());
    inner.scale.setScalar((c.length || GLB_LEN[id] || 60) / size.x);
    box = new THREE.Box3().setFromObject(inner); const ctr = box.getCenter(new THREE.Vector3());
    inner.position.set(-ctr.x, -box.min.y, -ctr.z);
    // glass: plain transparency instead of transmission (transmission costs an extra full render per draw)
    root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = Math.min(m.opacity, 0.42); m.depthWrite = false; } });
    wrap.userData = { wheels: [], tails: [], glb: true, cfg: c };
    return wrap;
  }
  /* rig a downloaded model so it behaves like the hand-built ones:
     cfg.wheel  = regex of material names that make up a wheel (tyre, rim, disc…) → grouped per corner, spin
     cfg.tyre   = regex of the tyre material (its box gives the wheel centre)
     cfg.static = regex of wheel parts that steer but don't spin (calipers)
     cfg.brake  = regex of tail-lamp materials → glow brighter when braking */
  function rigGLB(g, cfg) {
    const wheels = [], tails = [];
    g.updateMatrixWorld(true);
    if (cfg.wheel) {
      const W = new RegExp(cfg.wheel, 'i'), T = new RegExp(cfg.tyre || cfg.wheel, 'i'), S = cfg.static ? new RegExp(cfg.static, 'i') : null;
      // a part matches by material name or mesh name; tyres first, then every other wheel part goes to the corner it sits in
      const hit = (R, o) => R.test(o.material.name) || R.test(o.name);
      const whole = new THREE.Box3().setFromObject(g), ws = whole.getSize(new THREE.Vector3());
      // some models merge a whole axle (or all four wheels) into one mesh: cut those into one mesh per wheel
      const splitWheels = () => {
        const todo = []; g.traverse(o => { if (o.isMesh && hit(W, o)) todo.push(o); });
        const mid = whole.getCenter(new THREE.Vector3());
        for (const o of todo) {
          const sz = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
          const cutZ = sz.z > ws.z * 0.6, cutX = sz.x > ws.x * 0.55;
          if (!cutZ && !cutX) continue;
          const geo = o.geometry, pos = geo.attributes.position, idx = geo.index ? geo.index.array : null, n = idx ? idx.length : pos.count;
          const buckets = {}, v = new THREE.Vector3(), cen = new THREE.Vector3();
          for (let t = 0; t < n; t += 3) {
            cen.set(0, 0, 0);
            for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, idx ? idx[t + k] : t + k).applyMatrix4(o.matrixWorld); cen.add(v); }
            cen.multiplyScalar(1 / 3);
            const key = (cutX ? (cen.x > mid.x ? 'F' : 'R') : '') + (cutZ ? (cen.z > mid.z ? '+' : '-') : '');
            (buckets[key] = buckets[key] || []).push(idx ? idx[t] : t, idx ? idx[t + 1] : t + 1, idx ? idx[t + 2] : t + 2);
          }
          for (const tris of Object.values(buckets)) {
            const ng = new THREE.BufferGeometry();
            for (const name in geo.attributes) ng.setAttribute(name, geo.attributes[name]);
            ng.setIndex(tris);
            const bb = new THREE.Box3(); for (const i of tris) bb.expandByPoint(v.fromBufferAttribute(pos, i));   // computeBoundingBox would ignore the index
            ng.boundingBox = bb; ng.boundingSphere = bb.getBoundingSphere(new THREE.Sphere());
            const m = o.isSkinnedMesh ? o : new THREE.Mesh(ng, o.material);
            m.name = o.name; m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale); m.matrixAutoUpdate = o.matrixAutoUpdate;
            o.parent.add(m);
          }
          o.parent.remove(o);
        }
        g.updateMatrixWorld(true);
      };
      splitWheels();
      const tyres = [], parts0 = [];
      g.traverse(o => { if (o.isMesh && hit(W, o)) (hit(T, o) ? tyres : parts0).push(o); });
      const centre = o => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
      const corners = {};
      for (const t of tyres) {                         // only things out at a corner of the car are tyres (not seals, hubs on the axis…)
        const c = centre(t);
        if (Math.abs(c.x) < ws.x * 0.1 || Math.abs(c.z) < ws.z * 0.2) continue;
        const k = (c.x > 0 ? 'F' : 'R') + (c.z > 0 ? '+' : '-');
        (corners[k] = corners[k] || { parts: [], box: new THREE.Box3() }).parts.push(t);
        corners[k].box.expandByObject(t);
      }
      const info = Object.entries(corners).map(([k, c]) => [k, c.box.getCenter(new THREE.Vector3()), c.box.getSize(new THREE.Vector3()).y / 2]);
      for (const o of parts0) { const c = centre(o); let best = null, bd = Infinity;
        for (const [k, tcen, r] of info) { const d = c.distanceTo(tcen); if (d < bd && d < r * 1.1) { bd = d; best = k; } }
        if (best) corners[best].parts.push(o); }
      for (const [k, { parts, box }] of Object.entries(corners)) {
        const ctr = box.getCenter(new THREE.Vector3());
        const pivot = new THREE.Group(), spin = new THREE.Group();
        pivot.position.copy(ctr); pivot.add(spin); g.add(pivot); pivot.updateMatrixWorld(true);
        for (const o of parts) (S && hit(S, o) ? pivot : spin).attach(o);
        pivot.userData = { spin, front: k[0] === 'F' };
        wheels.push(pivot);
      }
    }
    if (cfg.brake) {
      const B = new RegExp(cfg.brake, 'i');
      g.traverse(o => { if (!o.isMesh || !(B.test(o.material.name) || B.test(o.name))) return;
        const m = o.material = o.material.clone();                     // own copy per car (braking is per car)
        m.emissive = new THREE.Color(0xff1a1a); if (!m.emissiveMap) m.emissiveMap = m.map;
        const em = m.emissiveMap, set = on => { const map = on ? null : em; if (m.emissiveMap !== map) { m.emissiveMap = map; m.needsUpdate = true; } m.emissiveIntensity = on ? 3.2 : 0.35; };   // braking: a solid red glow over the whole lens
        set(false); o.userData.brake = set; tails.push(o); });
    }
    g.userData = { wheels, tails, tail: tails[0], glb: true, moto: !!cfg.moto };
  }
  async function loadGLBs() {
    let cfg = {};
    try { const r = await fetch('assets/garage/garage.json', { cache: 'no-cache' }); if (r.ok) cfg = await r.json(); } catch {}
    const loader = new GLTFLoader();
    const ids = Object.keys(cfg).filter(k => cfg[k] && cfg[k].file);
    await Promise.all(ids.map(async id => {
      try { const g = await loader.loadAsync('assets/garage/' + cfg[id].file); GLB[id] = normalizeGLB(g.scene, id, cfg[id]); }
      catch (e) { console.warn('[garage] não carregou', cfg[id].file, e); }
    }));
    if (!Object.keys(GLB).length) return;
    for (const k of [...carModels.keys()]) if (k.startsWith('real:')) { scene.remove(carModels.get(k)); carModels.delete(k); }
    for (const k in showModels) { scene.remove(showModels[k]); delete showModels[k]; }
    window.dispatchEvent(new Event('garage:models'));
  }


  /* ── Yamaha-style trail bike (XTZ 250 Lander, blue/white) — ~32 units long ── */
  function buildMoto(opts = {}) {
    const bike = new THREE.Group();
    const blue = new THREE.MeshPhysicalMaterial({ color: 0x1d3fe0, metalness: 0.35, roughness: 0.25, clearcoat: 1, envMapIntensity: 1.4 });
    const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, metalness: 0.05, roughness: 0.3, clearcoat: 0.8 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.5, metalness: 0.3 });
    const seatM = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8cfd6, roughness: 0.22, metalness: 1 });
    const tubeAB = (a, b, r, m) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 10), m); o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); return o; };
    const panel = (pts, depth, m, z = 0) => { const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 3 }); g.translate(0, 0, -depth / 2 + z); return new THREE.Mesh(g, m); };
    // wire-spoke wheels with knobby tyres
    const wheelM = (front) => {
      const R = front ? 5.2 : 4.8, g = new THREE.Group(), spin = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(R - 0.8, 0.85, 10, 36), mat.tire); spin.add(tire);
      for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, kn = mesh(new THREE.BoxGeometry(0.5, 0.5, 1.6), mat.tire, Math.cos(a) * (R - 0.05), Math.sin(a) * (R - 0.05), 0); kn.rotation.z = a; spin.add(kn); }
      spin.add(new THREE.Mesh(new THREE.TorusGeometry(R - 1.6, 0.18, 6, 36), steel));
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; spin.add(tubeAB([0, 0, (i % 2 ? 0.5 : -0.5)], [Math.cos(a) * (R - 1.6), Math.sin(a) * (R - 1.6), 0], 0.05, steel)); }
      const hub = mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 14), steel); hub.rotation.x = Math.PI / 2; spin.add(hub);
      const disc = mesh(new THREE.CylinderGeometry(front ? 2.4 : 2, front ? 2.4 : 2, 0.15, 24), new THREE.MeshStandardMaterial({ color: 0x9aa2ab, metalness: 1, roughness: 0.4 }), 0, 0, front ? 0.85 : -0.85); disc.rotation.x = Math.PI / 2; spin.add(disc);
      g.add(spin); g.userData = { spin, front }; return g;
    };
    const fw = wheelM(true), rw = wheelM(false);
    fw.position.set(12, 5.2, 0); rw.position.set(-10.5, 4.8, 0);
    bike.add(fw, rw);
    // fork (raked) + triple clamp + bars + mirrors
    bike.add(tubeAB([12, 5.2, 0.9], [9.3, 19.5, 0.9], 0.42, steel), tubeAB([12, 5.2, -0.9], [9.3, 19.5, -0.9], 0.42, steel));
    bike.add(tubeAB([11.4, 7.8, 0.9], [9.9, 14.8, 0.9], 0.62, black), tubeAB([11.4, 7.8, -0.9], [9.9, 14.8, -0.9], 0.62, black));   // fork gaiters
    bike.add(rbx(1.6, 0.8, 3.2, 0.3, black, 9.2, 19.8, 0));
    bike.add(tubeAB([8.8, 21.2, -6], [8.8, 21.2, 6], 0.32, black));
    for (const z of [-1, 1]) { bike.add(rbx(1.4, 0.8, 2.2, 0.35, black, 8.8, 21.2, z * 6.4)); bike.add(tubeAB([8.6, 21.4, z * 4.2], [8.2, 24.3, z * 5], 0.12, black)); const mr = mesh(new THREE.CylinderGeometry(1, 1, 0.3, 14), black, 8.2, 24.6, z * 5.1); mr.rotation.z = Math.PI / 2 - 0.2; bike.add(mr); }
    // front fender (high, blue) + headlight cowl with the white number plate look
    bike.add(panel([[15.5, 11.6], [12, 12.6], [8.6, 12.4], [8.8, 11.6], [12, 11.8], [15.3, 11]], 3.2, blue));
    bike.add(panel([[10.4, 15.6], [11.6, 18.2], [11.2, 21.4], [9.6, 21.8], [8.8, 16.4]], 3.6, blue));
    const lamp = mesh(new THREE.SphereGeometry(1.15, 16, 12), mat.head, 11.4, 18.8, 0); lamp.scale.set(0.5, 1.2, 1); bike.add(lamp);
    // frame
    for (const z of [-1.3, 1.3]) { bike.add(tubeAB([8.8, 17, z], [-1, 16.5, z], 0.35, black)); bike.add(tubeAB([8.6, 16, z], [3, 4.8, z], 0.35, black)); bike.add(tubeAB([-1, 16.5, z], [-1.4, 7.6, z], 0.35, black)); bike.add(tubeAB([-1, 16.5, z], [-12, 17.2, z], 0.28, black)); }
    // swingarm + shock
    for (const z of [-1.8, 1.8]) bike.add(tubeAB([-1.4, 7.4, z], [-10.5, 4.8, z], 0.45, steel));
    bike.add(tubeAB([-3, 15, 0], [-5.2, 7.6, 0], 0.5, new THREE.MeshStandardMaterial({ color: 0xd9a33a, metalness: 0.6, roughness: 0.3 })));
    // engine (finned cylinder, silver cases, black barrel)
    bike.add(rbx(7, 5.4, 4.2, 1, steel, 1.8, 6.8, 0));
    const barrel = rbx(3.4, 5.5, 3.4, 0.6, black, 4.6, 11.2, 0); barrel.rotation.z = -0.35; bike.add(barrel);
    for (let i = 0; i < 5; i++) { const fin = mesh(new THREE.BoxGeometry(4.4, 0.25, 4.2), black, 4.4 + i * 0.35, 9.4 + i * 1, 0); fin.rotation.z = -0.35; bike.add(fin); }
    const cover = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 20), steel, 0.8, 6.6, 2.4); cover.rotation.x = Math.PI / 2; bike.add(cover);
    // tank + shrouds (blue, white graphic), seat, white side panel, tail
    const tank = panel([[8.6, 16.2], [8.2, 19], [5.5, 19.6], [1.8, 18.4], [1.6, 16.2]], 4.4, blue); bike.add(tank);
    for (const z of [-1, 1]) {
      bike.add(panel([[9.4, 13.2], [9.6, 17.6], [6.4, 18.2], [3.6, 15.2], [5.2, 12.4]], 0.6, blue, z * 2.8));
      bike.add(panel([[8.6, 14.6], [8.8, 16.2], [5.6, 16.6], [4.6, 15.2]], 0.3, white, z * 3.25));       // white stripe
    }
    bike.add(panel([[2, 17.6], [-12.5, 18.4], [-13, 17.4], [-4, 16.6], [1.6, 16.4]], 3.6, seatM));
    for (const z of [-1, 1]) bike.add(panel([[-2.6, 16.6], [-11.6, 17.4], [-10, 13.4], [-3.4, 13]], 0.6, white, z * 2.2));
    bike.add(panel([[-11.4, 17.8], [-16.4, 17.6], [-16.6, 16.8], [-11, 16.4]], 2.6, blue));
    bike.add(panel([[-15.6, 16.6], [-17, 14.8], [-16.2, 14.6], [-14.6, 16.2]], 1.8, black));             // rear fender tip
    const tl = rbx(0.6, 0.7, 1.6, 0.25, mat.tailOff, -16.6, 16.9, 0); bike.add(tl);
    // exhaust: header down the right, black muffler with silver tip
    bike.add(tubeAB([6, 10, 1.4], [3, 4.2, 2.4], 0.42, steel), tubeAB([3, 4.2, 2.4], [-4, 5.4, 2.8], 0.42, steel), tubeAB([-4, 5.4, 2.8], [-8, 12, 3], 0.42, steel));
    const muf = mesh(new THREE.CylinderGeometry(1.25, 1.1, 7, 16), black); muf.position.set(-10.6, 13.2, 3); muf.rotation.z = Math.PI / 2 + 0.22; bike.add(muf);
    const tip = mesh(new THREE.CylinderGeometry(0.6, 0.6, 1, 12), steel); tip.position.set(-14.2, 14, 3); tip.rotation.z = Math.PI / 2 + 0.22; bike.add(tip);
    bike.add(tubeAB([-1, 6, -2], [-1, 1.6, -3.4], 0.2, black));                                              // side stand
    if (opts.studio) { const sh = mesh(new THREE.PlaneGeometry(42, 16), new THREE.MeshBasicMaterial({ map: studioShadow, transparent: true, depthWrite: false }), 0, 0.05, 0); sh.rotation.x = -Math.PI / 2; bike.add(sh); }
    bike.rotation.x = 0;
    bike.userData = { wheels: [fw, rw], tails: [tl], tail: tl, moto: true };
    fw.userData.front = true; rw.userData.front = false;
    return bike;
  }

  function buildRealCar(id, opts = {}) {
    if (GLB[id]) { const g = GLB[id].clone(true); rigGLB(g, GLB[id].userData.cfg || {});
      if (opts.studio) { const sh = mesh(new THREE.PlaneGeometry(GLB_LEN[id] * 1.25, GLB_LEN[id] * 0.55), new THREE.MeshBasicMaterial({ map: studioShadow, transparent: true, depthWrite: false }), 0, 0.05, 0); sh.rotation.x = -Math.PI / 2; g.add(sh); }
      return g; }
    // detailed models live in cars/*.js (REAL.* below stays for names / the garage list / fallback)
    const DETAILED = { cruze: buildCruze, hb20: buildHB20, clio: buildClio, xtz: buildXTZ };
    if (DETAILED[id]) return DETAILED[id]({ studio: opts.studio, tailOff: mat.tailOff, head: mat.head, plateTex, studioShadow });
    if (id === 'xtz') return buildMoto(opts);
    const C = REAL[id], car = new THREE.Group();
    const paintM = new THREE.MeshPhysicalMaterial({ color: C.paint, metalness: C.metal, roughness: C.rough, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: C.paint < 0x404040 ? 2.4 : 1.4 });
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0x0e141b, roughness: 0.02, metalness: 0.9, clearcoat: 1, envMapIntensity: 2.4 });
    const trimM = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.4, metalness: 0.3 });
    const top = sampleCurve(C.top), bot0 = sampleCurve(C.bot);
    const bot = x => { let y = bot0(x); for (const ax of C.axle) { const d = x - ax; if (Math.abs(d) < C.arch) y = Math.max(y, C.wheel.r + Math.sqrt(C.arch * C.arch - d * d) * 0.97); } return y; };
    const P = C.plan;
    const planF = x => { const e = x > P.xc ? P.endF : P.endR; const d = Math.max(0, Math.abs(x - P.xc) - (P.half - e[1])) / e[1]; return Math.sqrt(Math.max(0.05, 1 - e[0] * d * d * 1.6)); };
    const tum = (y, a, b, k) => 1 - k * Math.min(1, Math.max(0, (y - a) / (b - a)));
    const hwBody = (x, y) => C.hw * planF(x) * tum(y, C.tumble[0], C.tumble[1], C.tumble[2]) * (1 - 0.05 * Math.min(1, Math.max(0, (5 - y) / 3)));
    const bodyMesh = new THREE.Mesh(loft({ xF: C.xF, xR: C.xR, top, bot, hw: hwBody, p: 0.26 }), paintM); car.add(bodyMesh);
    // greenhouse: glass, roof + pillars in paint, B pillar black
    const gTop = sampleCurve(C.gTop), g0 = C.gTop[0], gl = C.gTop[C.gTop.length - 1], g1 = gl.length === 4 ? [gl[2], gl[3]] : gl;
    const belt = x => g0[1] + (g1[1] - g0[1]) * (x - g0[0]) / (g1[0] - g0[0]);
    const gPlan = x => { const t = (x - g1[0]) / (g0[0] - g1[0]); return Math.sqrt(Math.max(0.2, 1 - Math.pow(Math.abs(t - 0.5) * 2, 6) * 0.35)); };
    const hwG = (x, y) => C.gHw * gPlan(x) * tum(y, belt(x), top(x) + 8, 0) * (1 - C.gTumble * Math.min(1, Math.max(0, (y - belt(x)) / Math.max(1, gTop(x) - belt(x)))));
    const [rF, rR] = [C.roof[1], C.roof[0]];
    const classify = (x, s, c) => {
      if (s > 0.55 && x < rF + 0.6 && x > rR - 0.6) return 0;                       // roof
      if (C.bPillar !== null && Math.abs(x - C.bPillar) < 0.9 && Math.abs(c) > 0.4) return 2;   // B pillar
      if (x > rF && Math.abs(c) > 0.82 && s > -0.2) return 0;                          // A pillar
      if (x < rR && Math.abs(c) > 0.74 && s > -0.2) return 0;                          // C pillar
      if (s > 0.42 && s <= 0.55 && x < rF && x > rR) return 2;                         // window frame
      return 1;
    };
    const gh = new THREE.Mesh(loft({ xF: g0[0], xR: g1[0], top: gTop, bot: belt, hw: hwG, p: 0.4, nx: 80, nr: 40, caps: false, classify, groups: 3 }), [paintM, glassM, trimM]);
    car.add(gh);
    const sideZ = (x, y) => hwBody(x, y) + 0.05;
    // wheel wells (dark, upper half)
    for (const ax of C.axle) { const w = new THREE.Mesh(new THREE.CylinderGeometry(C.arch - 0.1, C.arch - 0.1, C.hw * 2 - 3, 24, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, side: THREE.DoubleSide })); w.rotation.x = Math.PI / 2; w.position.set(ax, C.wheel.r, 0); car.add(w); }
    // ── decals: lights, grilles, shut lines… projected onto the real body surface ──
    const rc = new THREE.Raycaster(), V = (x, y, z) => new THREE.Vector3(x, y, z);
    const hit = (o, d, off = 0.1) => { rc.set(o, d.normalize()); const h = rc.intersectObject(bodyMesh, false)[0]; return h ? { p: h.point.clone().addScaledVector(h.face.normal, off), n: h.face.normal.clone() } : null; };
    function decal(nu, nv, rayAt, m, off = 0.1) {
      const pos = [], grid = [];
      for (let i = 0; i <= nu; i++) { grid.push([]); for (let j = 0; j <= nv; j++) { const [o, d] = rayAt(i / nu, j / nv); const h = hit(o, d, off); grid[i].push(h ? h.p : null); } }
      for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) if (!grid[i][j]) { const q = grid[i].find(Boolean) || grid.flat().find(Boolean); grid[i][j] = q ? q.clone() : V(0, -999, 0); }
      grid.forEach(r => r.forEach(q => pos.push(q.x, q.y, q.z)));
      const idx = [];
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const mm = new THREE.Mesh(g, m); mm.material = m.clone ? m : m; mm.material.side = THREE.DoubleSide; car.add(mm); return mm;
    }
    // around a corner: θ=0 straight ahead (or behind), θ=π/2 straight out to the side
    const corner = (front, k, L, cz, th, y, slant = 0) => (u, v) => {
      const t = th[0] + (th[1] - th[0]) * u, yy = y[0] + (y[1] - y[0]) * v + slant * u;
      const cx = front ? C.xF - L : C.xR + L, dx = front ? Math.cos(t) : -Math.cos(t);
      return [V(cx + dx * 60, yy, k * (cz + Math.sin(t) * 60)), V(-dx, 0, -k * Math.sin(t))];
    };
    const faceRect = (front, z0, z1, y0, y1) => (u, v) => [V(front ? C.xF + 30 : C.xR - 30, y0 + (y1 - y0) * v, z0 + (z1 - z0) * u), V(front ? -1 : 1, 0, 0)];
    const sideRect = (k, x0, x1, y0, y1) => (u, v) => [V(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, k * 40), V(0, 0, -k)];
    const lensM = new THREE.MeshPhysicalMaterial({ color: 0x20262e, roughness: 0.04, metalness: 0.9, clearcoat: 1, envMapIntensity: 2.2 });
    const drlM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xd6ecff, emissiveIntensity: 3 });
    const meshM = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.55, metalness: 0.4 });
    const tails = [];
    const L = {
      clio:  { head: [7, 4.4, [0, 1.25], [7.9, 10.6], 0.8], proj: [[0.08, 0.5], [8.5, 10.1]], drl: null,
               tail: [4, 7.4, [0, 1.3], [10.2, 14.9], 0], grille: [[-3.6, 3.6, 7.9, 8.15], [-3.4, 3.4, 8.55, 8.8], [-3.2, 3.2, 9.2, 9.45]], grilleM: chrome,
               intake: [-7.2, 7.2, 3.9, 5.9], fogs: [7.6, 4.9], plateF: 6.6, plateR: 9.6 },
      hb20:  { head: [9, 5.4, [0, 1.35], [8.6, 10.3], 1.2], proj: [[0.06, 0.42], [9.0, 9.9]], drl: [[0.3, 1.25], [8.6, 8.9]],
               tail: [5, 6.6, [0.05, 1.4], [12.3, 14.4], 0.3], hex: [6, 3.8, 8.2],
               intake: null, fogs: [8.8, 4.8], plateF: 5.9, plateR: 9.4 },
      cruze: { head: [10.5, 6.6, [0, 1.38], [8.9, 10.1], 0.9], proj: [[0.06, 0.38], [9.2, 9.9]], drl: [[0.05, 1.3], [8.9, 9.15]],
               tail: [6, 5.6, [0, 1.38], [13.1, 15.1], -0.2], grille: [[-6.6, 6.6, 8.3, 9.3]], grilleM: blackGloss, bar: [8.68, 8.92, 7.4],
               intake: [-7.6, 7.6, 3.4, 7.4], fogs: [9.8, 4.6], plateF: 5.4, plateR: 10.6 },
    }[C.lights];
    for (const k of [-1, 1]) {
      const [hL, hz, hth, hy, hs] = L.head;
      decal(14, 4, corner(true, k, hL, hz, hth, hy, hs), lensM, 0.08);
      decal(4, 2, corner(true, k, hL, hz, L.proj[0], L.proj[1], hs * 0.3), mat.head, 0.14);
      if (L.drl) decal(14, 1, corner(true, k, hL, hz, L.drl[0], L.drl[1], hs), drlM, 0.16);
      const [tL, tz, tth, ty, ts] = L.tail;
      tails.push(decal(12, 4, corner(false, k, tL, tz, tth, ty, ts), mat.tailOff, 0.1));
      decal(8, 1, corner(false, k, tL, tz, [tth[0] + 0.15, tth[1] - 0.2], [ty[0] + 0.25, ty[0] + 0.55], ts), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.2 }), 0.14);   // reverse light strip
      // fog lamp
      const f = hit(V(C.xF + 30, L.fogs[1], k * L.fogs[0]), V(-1, 0, 0), 0.05);
      if (f) { const d = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 20), mat.head); d.position.copy(f.p); d.quaternion.setFromUnitVectors(V(0, 1, 0), f.n); car.add(d);
               const r = mesh(new THREE.TorusGeometry(1.2, 0.25, 6, 20), C.lights === 'cruze' ? chrome : meshM); r.position.copy(f.p); r.quaternion.setFromUnitVectors(V(0, 0, 1), f.n); car.add(r); }
    }
    (L.grille || []).forEach(([z0, z1, y0, y1]) => decal(6, 1, faceRect(true, z0, z1, y0, y1), L.grilleM, 0.1));
    if (L.bar) decal(8, 1, faceRect(true, -L.bar[2], L.bar[2], L.bar[0], L.bar[1]), chrome, 0.2);
    if (L.intake) { decal(8, 3, faceRect(true, ...L.intake), meshM, 0.08); for (let y = L.intake[2] + 0.6; y < L.intake[3] - 0.3; y += 0.8) decal(8, 1, faceRect(true, L.intake[0] * 0.92, L.intake[1] * 0.92, y, y + 0.18), new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.8, roughness: 0.35 }), 0.14); }
    if (L.hex) {                                                // HB20: hexagonal grille = rows that narrow toward the bottom
      const [w, y0, y1] = L.hex;
      decal(8, 4, faceRect(true, -w, w, y0, y1), meshM, 0.08);
      decal(10, 1, faceRect(true, -w * 0.85, w * 0.85, y1, y1 + 0.35), chrome, 0.14);
      for (let y = y0 + 0.5; y < y1 - 0.2; y += 0.85) { const ww = w * (0.72 + 0.28 * (y - y0) / (y1 - y0)); decal(8, 1, faceRect(true, -ww, ww, y, y + 0.22), chrome, 0.13); }
    }
    // plates (follow the fascia normal)
    for (const front of [true, false]) {
      const h = hit(V(front ? C.xF + 30 : C.xR - 30, front ? L.plateF : L.plateR, 0), V(front ? -1 : 1, 0, 0), 0.15);
      if (!h) continue;
      const pl = mesh(new THREE.PlaneGeometry(7, 2.2), plateTex(C.plate)); pl.position.copy(h.p); pl.lookAt(h.p.clone().add(h.n)); car.add(pl);
    }
    // shut lines, moldings, handles
    for (const [x, ya, yb] of C.doors) for (const k of [-1, 1]) decal(1, 6, sideRect(k, x - 0.12, x + 0.12, ya, yb), trimM, 0.06);
    if (C.molding) for (const k of [-1, 1]) { const [y, xa, xb] = C.molding; decal(16, 1, sideRect(k, xb, xa, y - 0.4, y + 0.4), blackGloss, 0.1); }
    const handles = C.doors.length > 2 ? [C.doors[0][0] - 5.5, C.doors[1][0] - 5.5] : [C.doors[1][0] + 5];
    for (const x of handles) for (const k of [-1, 1]) decal(3, 1, sideRect(k, x - 1.2, x + 1.2, 11.1, 11.6), id === 'clio' ? blackGloss : chrome, 0.12);
    if (C.chromeBelt) for (const s of [-1, 1]) {
      const pts = []; for (let x = g0[0] - 0.5; x >= g1[0] + 1; x -= 1) pts.push(new THREE.Vector3(x, belt(x) + 0.15, s * (hwG(x, belt(x)) + 0.12)));
      car.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.22, 6), chrome));
    }
    if (C.lights === 'cruze') decal(14, 1, faceRect(false, -8, 8, 13.1, 13.5), chrome, 0.12);    // trunk chrome strip
    // mirrors (on the door, just behind the A pillar)
    const mx = g0[0] - 3, my = belt(mx) + 1.8;
    for (const s of [-1, 1]) {
      const arm = mesh(new THREE.BoxGeometry(1.6, 0.8, 1.6), trimM, mx + 0.4, my - 0.9, s * (hwG(mx, my) + 0.6)); car.add(arm);
      const cap = rbx(2.2, 2, 3.2, 0.8, id === 'clio' ? blackGloss : paintM, mx, my, s * (hwG(mx, my) + 2)); cap.rotation.y = s * 0.12; car.add(cap);
    }
    if (C.fin) { const f = rbx(3.6, 1.3, 1.3, 0.55, paintM, C.roof[0] + 2.4, gTop(C.roof[0] + 2.4) + 0.9, 0); f.rotation.z = 0.25; car.add(f); }
    // third brake light / spoiler for the hatches
    if (id !== 'cruze') { const sp = rbx(3.2, 0.8, C.gHw * 1.5, 0.35, paintM, C.roof[0] - 0.8, gTop(C.roof[0]) + 0.2, 0); car.add(sp); }
    // wheels
    const wheels = [];
    for (const [i, x] of C.axle.entries()) for (const s of [-1, 1]) {
      const w = realWheel(i === 0, s, C.wheel); w.position.set(x, C.wheel.r, s * (C.hw - C.wheel.w / 2 - 0.4)); car.add(w); wheels.push(w);
    }
    if (opts.studio) { const sh = mesh(new THREE.PlaneGeometry((C.xF - C.xR) * 1.25, C.hw * 3.2), new THREE.MeshBasicMaterial({ map: studioShadow, transparent: true, depthWrite: false }), 0, 0.05, 0); sh.rotation.x = -Math.PI / 2; car.add(sh); }
    car.userData = { wheels, tails, tail: tails[0] };
    return car;
  }

  /* ════════════════════════════ HELICOPTER ════════════════════════════ */
  function buildHeli(color) {
    const heli = new THREE.Group();
    heli.rotation.order = 'YZX';
    const body = paint(color);
    const pod = withEdges(new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), body), 50);
    pod.scale.set(17, 9.5, 9.2); pod.position.set(1, 16.5, 0); heli.add(pod);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), mat.glass);
    canopy.scale.set(11.5, 9, 8.6); canopy.rotation.z = -Math.PI / 2.6; canopy.position.set(8.5, 17.5, 0); heli.add(canopy);
    heli.add(box(14, 4.5, 9, mat.trim, -3, 25.5, 0));                       // engine housing
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 3.4, 36, 14), body);
    boom.rotation.z = Math.PI / 2; boom.position.set(-30, 19, 0); heli.add(boom);
    const fin = box(7, 13, 1, body, -46, 25, 0); fin.rotation.z = 0.35; heli.add(fin);
    heli.add(box(5, 0.8, 13, body, -41, 19.5, 0));                          // stabiliser
    const tailRotor = new THREE.Group(); tailRotor.position.set(-47, 27, 1.6);
    for (let k = 0; k < 2; k++) { const b = box(0.9, 13, 0.4, mat.blade); b.rotation.z = k * Math.PI / 2; tailRotor.add(b); }
    heli.add(tailRotor);
    for (const z of [-9.5, 9.5]) {                                           // skids
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 36, 10), mat.trim);
      skid.rotation.z = Math.PI / 2; skid.position.set(1, 1.6, z); heli.add(skid);
      for (const x of [-8, 9]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 10, 8), mat.trim); st.position.set(x, 6.3, z * 0.85); st.rotation.x = z > 0 ? 0.35 : -0.35; heli.add(st); }
    }
    heli.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1.2, 5, 10), mat.trim).translateY(29));
    const rotor = new THREE.Group(); rotor.position.set(0, 31.5, 0);
    rotor.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 8), mat.rim));
    for (let k = 0; k < 4; k++) { const b = box(52, 0.5, 3.2, mat.blade, 26, 0, 0); const arm = new THREE.Group(); arm.rotation.y = k * Math.PI / 2; arm.add(b); rotor.add(arm); }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(53, 48), mat.blur); disc.rotation.x = -Math.PI / 2; disc.position.y = 31.6;
    heli.add(rotor, disc);
    const dot = (m, x, y, z, r = 1.1) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); s.position.set(x, y, z); heli.add(s); };
    dot(mat.red, 3, 15, -9.4); dot(mat.green, 3, 15, 9.4); dot(mat.red, -2, 7.4, 0, 1.3); dot(mat.white, -48, 21, 0, 0.9);
    dot(mat.head, 17.5, 12, 0, 1.4);                                          // nose searchlight
    heli.userData = { rotor, tailRotor, disc };
    heli.visible = false;
    scene.add(heli);
    return heli;
  }

  /* ════════════════════════════ AIRLINER ════════════════════════════ */
  function buildPlane() {
    const p = new THREE.Group();
    const white = new THREE.MeshPhysicalMaterial({ color: 0xe9eef3, roughness: 0.35, metalness: 0.2, clearcoat: 0.6 });
    const fus = withEdges(new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 66, 20), white), 40);
    fus.rotation.z = Math.PI / 2; fus.position.y = 30; p.add(fus);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 14), white); nose.scale.set(2.2, 1, 1); nose.position.set(33, 30, 0); p.add(nose);
    const tailCone = new THREE.Mesh(new THREE.ConeGeometry(5, 16, 20), white); tailCone.rotation.z = Math.PI / 2; tailCone.position.set(-41, 31, 0); p.add(tailCone);
    const wingShape = (span, root, sweep) => {
      const s = new THREE.Shape();
      s.moveTo(root / 2, 0); s.lineTo(root / 2 - sweep, span); s.lineTo(root / 2 - sweep - root * 0.45, span);
      s.lineTo(-root / 2, 0); s.lineTo(root / 2 - sweep - root * 0.45, -span); s.lineTo(root / 2 - sweep, -span); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false }); g.rotateX(Math.PI / 2); return g;
    };
    const wing = withEdges(new THREE.Mesh(wingShape(47, 20, 16), white), 30); wing.position.set(0, 28, 0); p.add(wing);
    const stab = new THREE.Mesh(wingShape(15, 10, 7), white); stab.position.set(-40, 32, 0); p.add(stab);
    const finS = new THREE.Shape(); finS.moveTo(-30, 0); finS.lineTo(-40, 17); finS.lineTo(-45, 17); finS.lineTo(-44, 0); finS.closePath();
    const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finS, { depth: 1, bevelEnabled: false }), white); fin.position.set(0, 33, -0.5); p.add(fin);
    p.add(box(10, 0.8, 1.1, neon('#FFE600'), -38, 44, 0));                  // tail logo stripe
    for (const z of [-16, 16]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.2, 10, 14), mat.trim); e.rotation.z = Math.PI / 2; e.position.set(2, 24.5, z); p.add(e); }
    for (let x = -24; x <= 24; x += 4) for (const z of [-5.05, 5.05]) p.add(box(1.6, 1.2, 0.2, mat.warmWin, x, 31.5, z));
    const dot = (m, x, y, z) => { const s = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), m); s.position.set(x, y, z); p.add(s); };
    dot(mat.red, -14, 28.5, -47); dot(mat.green, -14, 28.5, 47); dot(mat.white, -45, 50, 0); dot(mat.red, 0, 25, 0);
    p.visible = false;
    scene.add(p);
    return p;
  }

  /* ── drawing ── */
  const carModels = new Map();
  const carModel = (o) => {
    const key = o.model ? 'real:' + o.model : o.color + (o.special ? '*' : '');
    if (!carModels.has(key)) { const m = o.model ? buildRealCar(o.model) : buildCar(o.color, o.special); m.visible = false; scene.add(m); carModels.set(key, m); }
    return carModels.get(key);
  };
  const HELI_LEN = 135;                       // the EC135 is ~2.7× a car; the airliner (260) is still the biggest thing in the sky
  const heliModel = buildHeli('#FFE600');
  heliModel.scale.setScalar(1.3);
  /* the real helicopter: a yellow EC135 (assets/models/heli.glb). Its main and tail rotors get their
     own pivots so they still spin; the pilot figures that came with the model were removed. */
  new GLTFLoader().loadAsync('assets/models/heli.glb').then(g => {
    { // the exported model is not upright: pick the orientation where it is flattest (rotor disc horizontal)
      let best = null; for (const [ax, an] of [['x', 0], ['x', Math.PI / 2], ['x', -Math.PI / 2], ['z', Math.PI / 2], ['z', -Math.PI / 2]]) {
        g.scene.rotation.set(0, 0, 0); g.scene.rotation[ax] = an; g.scene.updateMatrixWorld(true);
        const sz = new THREE.Box3().setFromObject(g.scene).getSize(new THREE.Vector3()), f = sz.y / Math.max(sz.x, sz.z);
        if (!best || f < best[0]) best = [f, ax, an]; }
      g.scene.rotation.set(0, 0, 0); g.scene.rotation[best[1]] = best[2]; }
    const w = normalizeGLB(g.scene, 'heli', { length: HELI_LEN, rotY: window.HELI_ROTY ?? -Math.PI / 2, env: 1.2 });
    w.updateMatrixWorld(true);
    // the rotors are skinned: moving the mesh does nothing, the bones must turn (main = local Z, tail = local X)
    const bone = name => { let b = null; w.traverse(o => { if (o.name === name) b = o; }); return b || new THREE.Object3D(); };
    const rotor = bone('Rotor_Main_01_29'), tailRotor = bone('Rotor_Rear_02_27');
    heliModel.clear(); heliModel.add(w); heliModel.scale.setScalar(1);
    heliModel.userData = { rotor, tailRotor, disc: new THREE.Object3D(), rotorAxis: 'z', tailAxis: 'x', rotor0: rotor.rotation.z, tail0: tailRotor.rotation.x };
    if (lastHeli) drawHeli(lastHeli);
  }).catch(e => console.warn('[heli] modelo não carregou', e));
  const planeModel = buildPlane();
  /* the airliner: a real 737 in Gol colours (assets/models/plane.glb) replaces the simple one once loaded.
     Scale: the biggest thing in the sky — about twice the helicopter's length. */
  const PLANE = { file: 'assets/models/plane.glb', length: 260, rotY: window.PLANE_ROTY ?? -Math.PI / 2, alt: 4 };
  // its own, bigger drawing box: a 737 dwarfs everything else in town
  const PLANE_BOX = { x: -320, y: -260, w: 640, h: 440 };
  const planeCanvases = new Map();
  new GLTFLoader().loadAsync(PLANE.file).then(g => {
    const w = normalizeGLB(g.scene, 'plane', { length: PLANE.length, rotY: PLANE.rotY, env: 1.2 });
    w.position.y = PLANE.alt;
    planeModel.clear(); planeModel.add(w);
    planeCanvases.forEach((flip, cv) => drawPlane(cv, flip));
  }).catch(e => console.warn('[plane] modelo não carregou', e));

  // vb = the screen box the model is drawn in (css px, origin = the vehicle's ground point)
  const CAR_BOX = { x: -130, y: -95, w: 260, h: 170 };
  function render(model, vb, vw = vb.w, vh = vb.h) {   // vw×vh = viewport in css px (defaults to 1 unit = 1 px)
    camera.left = vb.x; camera.right = vb.x + vb.w; camera.top = -vb.y; camera.bottom = -(vb.y + vb.h); camera.updateProjectionMatrix();
    renderer.setViewport(0, 0, vw, vh); renderer.setScissor(0, 0, vw, vh);
    model.visible = true;
    renderer.render(scene, camera);
    model.visible = false;
  }
  function draw(model, canvas, vb = CAR_BOX, vw = vb.w, vh = vb.h) {
    render(model, vb, vw, vh);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sw = Math.round(vw * DPR), sh = Math.round(vh * DPR);
    ctx.drawImage(renderer.domElement, 0, renderer.domElement.height - sh, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  function drawCar(o) {
    const m = carModel(o);
    m.rotation.order = 'YXZ';
    m.rotation.y = -o.angle;
    m.rotation.x = m.userData.moto ? (o.steer || 0) * 0.55 * Math.min(1, Math.abs(o.speed || 0) / 260) : 0;   // the bike leans into turns
    const steer = o.steer || 0, roll = o.wheelRot || 0;
    for (const w of m.userData.wheels) {
      w.rotation.y = w.userData.front ? -steer * 0.9 : 0;
      w.userData.spin.rotation.z = -roll;
    }
    if (m.userData.moto) seatRider(m, o.el.classList.contains('driving'));
    const tm = o.el.classList.contains('braking') ? mat.tailOn : mat.tailOff;
    for (const t of m.userData.tails || [m.userData.tail]) { if (!t) continue; if (t.userData.brake) t.userData.brake(tm === mat.tailOn); else t.material = tm; }
    draw(m, o.canvas);
  }

  /* the player riding the bike: the same 3D person as the sprites, seated, at the bike's scale
     (a 1.75 m rider on a 2.1 m bike), torso leaning forward, hands on the bars, feet on the pegs */
  let rider = null;
  function seatRider(bike, on) {
    if (!rider) {
      rider = buildPerson(PEOPLE.joao); scene.remove(rider); rider.visible = true;
      const u = rider.userData, k = 0.5;
      rider.scale.setScalar(k);
      u.body.rotation.z = -0.32;                               // lean into the bars
      u.legL.rotation.set(-0.22, 0, 0.62); u.legR.rotation.set(0.22, 0, 0.62);   // feet forward/down to the pegs, knees out
      u.armL.rotation.set(-0.2, 0, 1.25); u.armR.rotation.set(0.2, 0, 1.25);     // reach for the grips
    }
    if (on && rider.parent !== bike) {
      // sit it on the seat: the seat is the top of the bike just behind the middle
      if (!bike.userData.seat) {                                  // measured once, with the bike upright and facing +x
        const ry = bike.rotation.y, rx = bike.rotation.x; bike.rotation.set(0, 0, 0); bike.updateMatrixWorld(true);
        const b = new THREE.Box3(); bike.traverse(q => { if (q.isMesh && q.geometry.type !== 'PlaneGeometry') b.expandByObject(q); });
        bike.rotation.y = ry; bike.rotation.x = rx;
        const L = b.max.x - b.min.x, H = b.max.y - b.min.y;
        bike.userData.seat = [(b.min.x + b.max.x) / 2 - L * 0.17, b.min.y + H * 0.6];
      }
      const [sx, sy] = bike.userData.seat;
      bike.add(rider);
      rider.position.set(sx, sy - 24 * 0.5, 0);
    }
    if (!on && rider.parent === bike) bike.remove(rider);
  }

  let lastHeli = null;
  function drawHeli(o) {
    lastHeli = o;
    const m = heliModel;
    m.rotation.y = -o.angle;
    const sp = Math.hypot(o.vx || 0, o.vy || 0);
    m.rotation.z = -Math.min(0.2, sp / 2600);                // nose dips with speed
    const spinning = o.el.classList.contains('spinning');
    const t = performance.now() / 1000;
    const u = m.userData, ra = u.rotorAxis || 'y', ta = u.tailAxis || 'z';
    u.rotor.rotation[ra] = (u.rotor0 || 0) + (spinning ? -t * 26 : 0.4);
    u.tailRotor.rotation[ta] = (u.tail0 || 0) + (spinning ? t * 40 : 0);
    m.userData.disc.visible = spinning;
    draw(m, o.canvas);
  }

  function drawPlane(canvas, flip = false) {
    planeCanvases.set(canvas, flip);
    planeModel.rotation.y = flip ? Math.PI : 0;
    renderer.setSize(PLANE_BOX.w, PLANE_BOX.h, false);
    draw(planeModel, canvas, PLANE_BOX);
    renderer.setSize(W, HMAX, false);
  }

  /* ════════════════════════════ CHARACTERS ════════════════════════════
     The player and the NPCs, modelled after their pixel-art sprites.
     Facing +X; frame -1 = idle, 0…5 = walk cycle. */
  const PEOPLE = {
    joao:     { skin: 0xc68a5e, hair: 0x3a2416, hairStyle: 'short', beard: 0x2a1a10, top: 'tee', topColor: 0x3d63a8, pants: 0x2b3a55, shoes: 0xe9edf2 },
    kauan:    { skin: 0xd9a07a, hair: 0x2a1d14, hairStyle: 'buzz', beard: 0x3a2a1e, top: 'puffer', topColor: 0x2b2e35, inner: 0x111214, pants: 0x22252b, shoes: 0xdfe4ea, shades: true },
    fernando: { skin: 0xe2b48f, hair: 0x1d2026, hairStyle: 'messy', top: 'puffer', topColor: 0x2f7a3a, inner: 'stripes', pants: 0x262c38, shoes: 0xdfe4ea },
    vargas:   { skin: 0xe8c0a0, hair: 0x5a3a28, hairStyle: 'swept', top: 'suit', topColor: 0x232b3d, inner: 0xe9edf2, tie: 0x7a2030, pants: 0x232b3d, shoes: 0x15171b },
    felipe:   { skin: 0xe6b894, hair: 0x2a1a12, hairStyle: 'curly', top: 'hoodie', topColor: 0x6b7480, pants: 0xb59f78, shoes: 0x2a2f38, glasses: true },
  };
  const PERSON_BOX = { x: -30, y: -66, w: 60, h: 72 };
  const PERSON_SCALE = 0.78;            // people in the city: a bit smaller so they don't rival the cars
  const BUST_BOX = { x: -11, y: -60, w: 22, h: 22 };
  const stripesTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 32; const g = c.getContext('2d'); for (let y = 0; y < 32; y += 4) { g.fillStyle = y % 8 ? '#1a1d22' : '#e9edf2'; g.fillRect(0, y, 16, 4); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  function buildPerson(P) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const m = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...extra });
    const skin = m(P.skin), top = m(P.topColor, P.top === 'puffer' ? { roughness: 0.45, metalness: 0.05 } : {});
    const sph = (r, mat, x, y, z, ws = 14, hs = 10) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat); o.position.set(x, y, z); return o; };
    const rb = (w, h, d, r, mat, x, y, z) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat); o.position.set(x, y, z); return o; };
    // legs + shoes (pivot at the hip)
    const leg = z => { const piv = new THREE.Group(); piv.position.set(0, 24, z);
      piv.add(rb(4.6, 22, 4.6, 1.4, m(P.pants), 0, -11, 0)); piv.add(rb(7.6, 3.2, 5, 1.2, m(P.shoes), 1.3, -22.4, 0)); body.add(piv); return piv; };
    const legL = leg(-2.9), legR = leg(2.9);
    // torso by outfit
    const bulk = P.top === 'puffer' ? 1.15 : P.top === 'hoodie' ? 1.08 : 1;
    body.add(rb(8 * bulk, 17, 13.5 * bulk, 2.2, top, 0, 32.5, 0));
    if (P.top === 'puffer') for (const y of [27, 32, 37]) body.add(rb(9.6, 1.1, 15.8, 0.5, m(P.topColor, { roughness: 0.6 }), 0, y, 0));
    if (P.top === 'puffer' || P.top === 'suit') {                        // open front shows the shirt
      const inner = P.inner === 'stripes' ? new THREE.MeshStandardMaterial({ map: stripesTex, roughness: 0.8 }) : m(P.inner);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(4, 15), inner); pl.rotation.y = Math.PI / 2; pl.position.set(4.7 * bulk, 32.5, 0); body.add(pl);
      body.add(rb(2.2, 4, 14 * bulk, 1, top, 0.5, 41.2, 0));            // collar
    }
    if (P.tie) { const t = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 11), m(P.tie)); t.rotation.y = Math.PI / 2; t.position.set(4.75, 34, 0); body.add(t); }
    if (P.top === 'tee') { const l = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3), m(0xe9edf2)); l.rotation.y = Math.PI / 2; l.position.set(4.05, 36, 0); body.add(l); }
    if (P.top === 'hoodie') { body.add(sph(5.2, top, -3.2, 43.5, 0)); body.add(rb(1, 6, 7, 0.4, m(0x555c66), 4.4, 30, 0)); }
    // arms (pivot at the shoulder) + hands
    const arm = z => { const piv = new THREE.Group(); piv.position.set(0, 39.5, z);
      piv.add(rb(4.2 * bulk, 15, 4.2 * bulk, 1.4, P.top === 'tee' ? skin : top, 0, -7.5, 0));
      if (P.top === 'tee') piv.add(rb(4.8, 5, 4.8, 1.4, top, 0, -2, 0));
      piv.add(sph(1.9, skin, 0, -15.6, 0, 8, 6)); body.add(piv); return piv; };
    const armL = arm(-8.6 * bulk), armR = arm(8.6 * bulk);
    // neck + head + face
    body.add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.9, 3, 10), skin).translateY(42.5));
    body.add(sph(5.4, skin, 0, 48.6, 0, 18, 14));
    for (const z of [-1.9, 1.9]) body.add(sph(0.6, m(0x111111), 4.95, 49.4, z, 6, 4));
    if (P.beard) { const b = sph(5.45, m(P.beard), 0.6, 47.6, 0, 16, 10); b.scale.set(1, 0.62, 1); b.geometry = new THREE.SphereGeometry(5.45, 16, 10, -Math.PI / 2, Math.PI, Math.PI * 0.5, Math.PI * 0.5); body.add(b); }
    if (P.shades) body.add(rb(1.2, 1.8, 7.6, 0.4, m(0x050505, { roughness: 0.1, metalness: 0.6 }), 5.2, 49.5, 0));
    if (P.glasses) for (const z of [-2, 2]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 6, 14), m(0x121212)); r.rotation.y = Math.PI / 2; r.position.set(5.25, 49.4, z); body.add(r); }
    // hair
    const hairM = m(P.hair, { roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(P.hairStyle === 'buzz' ? 5.55 : 5.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
    cap.position.set(-0.5, 49.2, 0); cap.rotation.z = 0.28; body.add(cap);
    if (P.hairStyle === 'messy') for (const [x, y, z] of [[1, 54.5, -2], [-1.5, 55, 1.5], [2.5, 53.8, 2], [-3, 53.5, -2.5]]) body.add(sph(2, hairM, x, y, z, 6, 5));
    if (P.hairStyle === 'swept') { const t = rb(5, 2.2, 9, 1, hairM, 2.2, 54.3, 0.6); t.rotation.z = -0.35; body.add(t); }
    if (P.hairStyle === 'curly') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; body.add(sph(1.9, hairM, -0.6 + Math.cos(a) * 3.8, 53.6 + (i % 2) * 0.6, Math.sin(a) * 4.4, 6, 5)); }
    if (P.hairStyle === 'short') body.add(rb(3, 2, 9.5, 1, hairM, 3.4, 53, 0));
    g.userData = { body, legL, legR, armL, armR };
    g.visible = false; scene.add(g);
    return g;
  }
  const personModels = {};
  const personCache = {};
  function posePerson(g, angle, frame, frames = 6) {
    const u = g.userData;
    g.rotation.y = -angle;
    const walk = frame >= 0, ph = walk ? frame / frames * Math.PI * 2 : 0, sw = walk ? Math.sin(ph) * 0.6 : 0;
    u.legL.rotation.z = sw; u.legR.rotation.z = -sw;
    u.armL.rotation.z = -sw * 0.75; u.armR.rotation.z = sw * 0.75;
    u.armL.rotation.x = walk ? 0 : -0.06; u.armR.rotation.x = walk ? 0 : 0.06;
    u.body.position.y = walk ? Math.abs(Math.cos(ph)) * 0.8 : 0;
  }
  /* ════════════════════════════ PEDESTRIANS ════════════════════════════
     Same person model as the characters, at the same scale as the player,
     with a handful of everyday outfits. 8 headings × 4 walk frames each. */
  const CROWD = [
    { skin: 0xe2b48f, hair: 0x2a1d14, hairStyle: 'short', top: 'tee', topColor: 0xc8423d, pants: 0x2b3240, shoes: 0xe9edf2 },
    { skin: 0x8d5a3b, hair: 0x0d0d0d, hairStyle: 'buzz', beard: 0x111111, top: 'hoodie', topColor: 0x2f5f9e, pants: 0x3a3a40, shoes: 0x1c1f24 },
    { skin: 0xf1c9a5, hair: 0x9a6a3a, hairStyle: 'swept', top: 'tee', topColor: 0xe0b13a, pants: 0x1f3a5c, shoes: 0xe9edf2 },
    { skin: 0xc58c62, hair: 0x1a1410, hairStyle: 'curly', top: 'puffer', topColor: 0x8a3d5c, inner: 0x16181c, pants: 0x22252b, shoes: 0xdfe4ea },
    { skin: 0xe8c0a0, hair: 0xc9a46a, hairStyle: 'messy', top: 'hoodie', topColor: 0x3fae7c, pants: 0x2a2a30, shoes: 0xe9edf2 },
    { skin: 0xd6a07a, hair: 0x3b2618, hairStyle: 'short', top: 'suit', topColor: 0x3a3f4a, inner: 0xe9edf2, tie: 0x24467a, pants: 0x3a3f4a, shoes: 0x15171b },
    { skin: 0x6e4630, hair: 0x0d0d0d, hairStyle: 'curly', top: 'tee', topColor: 0xe9edf2, pants: 0x3b4e6e, shoes: 0xd23c3c },
    { skin: 0xf0d0b4, hair: 0x5a3a28, hairStyle: 'swept', glasses: true, top: 'puffer', topColor: 0xd8d2c4, inner: 0x2a2d33, pants: 0x4a4038, shoes: 0x2a2f38 },
    { skin: 0xb98060, hair: 0x2a1a12, hairStyle: 'buzz', top: 'tee', topColor: 0x7b5bc4, pants: 0x1d2330, shoes: 0xe9edf2, shades: true },
    { skin: 0xdeb08a, hair: 0x6b4a2a, hairStyle: 'messy', beard: 0x4a3020, top: 'hoodie', topColor: 0xe07a3a, pants: 0x262c38, shoes: 0x1c1f24 },
  ];
  const crowdModels = [];
  let pedCache = {};
  function pedFrame(style, k, f) {
    const key = style + ':' + k + ':' + f;
    if (pedCache[key]) return pedCache[key];
    const i = style % CROWD.length;
    const g = crowdModels[i] || (crowdModels[i] = buildPerson(CROWD[i]));
    posePerson(g, k * Math.PI / 4, f, 4); g.scale.setScalar(PERSON_SCALE);
    const cv = document.createElement('canvas'); cv.width = Math.round(PERSON_BOX.w * DPR); cv.height = Math.round(PERSON_BOX.h * DPR);
    draw(g, cv, PERSON_BOX);
    return (pedCache[key] = cv);
  }

  function personFrame(id, angle, frame) {
    const key = id + ':' + Math.round(angle * 100) + ':' + frame;
    if (personCache[key]) return personCache[key];
    const g = personModels[id] || (personModels[id] = buildPerson(PEOPLE[id] || PEOPLE.joao));
    posePerson(g, angle, frame); g.scale.setScalar(PERSON_SCALE);
    const cv = document.createElement('canvas'); cv.width = Math.round(PERSON_BOX.w * DPR); cv.height = Math.round(PERSON_BOX.h * DPR);
    draw(g, cv, PERSON_BOX);
    return (personCache[key] = cv);
  }
  function personBust(id) {           // portrait for the dialog box: head & shoulders, facing the viewer
    const g = personModels[id] || (personModels[id] = buildPerson(PEOPLE[id] || PEOPLE.joao));
    posePerson(g, Math.PI / 4, -1); g.scale.setScalar(1);
    const px = Math.round(132 / DPR);                               // render at full resolution, no upscaling
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.round(px * DPR);
    draw(g, cv, BUST_BOX, px, px);
    return cv.toDataURL();
  }

  /* ════════════════════════════ METRO ════════════════════════════ */
  const TRAIN_BOX = { x: -130, y: -175, w: 260, h: 205 };
  function buildTrain(cab) {
    const g = new THREE.Group();
    const white = new THREE.MeshPhysicalMaterial({ color: 0xe8edf2, roughness: 0.35, metalness: 0.3, clearcoat: 0.6 });
    const y0 = 72;
    g.add(withEdges(new THREE.Mesh(new THREE.BoxGeometry(70, 20, 22), white), 30).translateY(y0 + 12));
    g.userData.body = g.children[0];
    g.add(box(70.4, 2, 22.4, neon('#FFE600'), 0, y0 + 6, 0));                 // JOPES line stripe
    for (const z of [-11.15, 11.15]) for (let x = -28; x <= 28; x += 9.5) g.add(box(7, 6, 0.3, mat.warmWin, x, y0 + 15, z));
    g.add(box(64, 3, 14, mat.trim, 0, y0 + 23.5, 0));                          // roof unit
    for (const x of [-24, 24]) g.add(box(16, 4, 18, mat.trim, x, y0 - 1, 0)); // bogies
    if (cab) {
      g.add(box(0.4, 9, 18, mat.glass, 35.2, y0 + 15, 0));
      for (const z of [-7, 7]) g.add(box(0.6, 1.6, 3, mat.head, 35.3, y0 + 6, z));
    }
    g.visible = false; scene.add(g);
    return g;
  }
  const trainModels = { cab: buildTrain(true), mid: buildTrain(false) };
  /* the real train: a CPTM Série 9000 car (assets/models/train.glb) replaces the boxes once loaded.
     Each car ~2x a car's length; the underframe/platform props that came with the model are hidden. */
  const TRAIN = { file: 'assets/models/train.glb', length: 130, deck: 71,
    hide: '^(Cubo00[1-35689]_0|Cubo01[02356]_0|Cilindro_0|corte_porta_0|Plano_0|Plano001_0)$' };
  new GLTFLoader().loadAsync(TRAIN.file).then(g => {
    const w = normalizeGLB(g.scene, 'train', { length: TRAIN.length, rotY: window.TRAIN_ROTY ?? Math.PI / 2, hide: TRAIN.hide, env: 1.2 });
    w.position.y = TRAIN.deck;
    for (const m of [trainModels.cab, trainModels.mid]) { m.userData.body = null; m.clear(); m.add(m === trainModels.cab ? w : w.clone(true)); }
    window.dispatchEvent(new Event('train:model'));
  }).catch(e => console.warn('[train] modelo não carregou', e));
  function drawTrain(o) {
    const m = o.cab ? trainModels.cab : trainModels.mid;
    // the front car's cab faces the direction of travel, the rear one faces backwards
    const flip = o.cab && o.idx === 0;
    m.rotation.y = -(o.angle + (flip ? Math.PI : 0));
    draw(m, o.canvas, TRAIN_BOX);
  }

  // garage showroom: big turntable renders of the real vehicles
  const GARAGE_IDS = [...Object.keys(REAL), 'xtz'];
  const showModels = {};
  // photo-style camera: low, perspective, like a car ad
  const showCam = new THREE.PerspectiveCamera(17, 2, 1, 4000);
  const studio = new THREE.Group();          // softbox key, fill and a rim light, like a photo studio
  { const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(80, 140, 120); studio.add(k);
    const f = new THREE.DirectionalLight(0xdfe8ff, 0.9); f.position.set(-120, 60, 40); studio.add(f);
    const r = new THREE.DirectionalLight(0xffffff, 1.4); r.position.set(-20, 80, -160); studio.add(r); }
  // showroom floor: soft lit floor, a dark glossy turntable and its blue glow ring (unit size, scaled per vehicle)
  const stage = new THREE.Group();
  { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(120,150,190,0.55)'); gr.addColorStop(0.45, 'rgba(60,90,130,0.28)'); gr.addColorStop(1, 'rgba(20,30,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.85; stage.add(floor);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.03, 0.8, 96), new THREE.MeshPhysicalMaterial({ color: 0x1c2330, metalness: 0.6, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));
    table.position.y = -0.42; stage.add(table);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 128), new THREE.MeshStandardMaterial({ color: 0x0a1a33, emissive: 0x4da3ff, emissiveIntensity: 2.4 }));
    ring.rotation.x = Math.PI / 2; stage.add(ring);
    for (let i = 0; i < 24; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.004), new THREE.MeshStandardMaterial({ color: 0x31435c, roughness: 0.5 })); const a = i / 24 * Math.PI * 2; d.position.set(Math.cos(a) * 0.93, 0, Math.sin(a) * 0.93); d.rotation.y = -a; stage.add(d); }
  }
  const fit = {};                            // per vehicle: length / height → turntable size + camera distance
  function showcase(id, canvas, angle = 0.6, opts = {}) {
    loadModels();
    const m = showModels[id] || (showModels[id] = (() => { const g = buildRealCar(id, { studio: true }); g.visible = false; scene.add(g); return g; })());
    if (!fit[id]) { const b = new THREE.Box3(); m.rotation.y = 0; m.updateMatrixWorld(true); m.traverse(o => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') b.expandByObject(o); });
      const sz = b.getSize(new THREE.Vector3()); fit[id] = { len: sz.x, h: sz.y }; }
    const F = fit[id];
    m.rotation.y = angle;
    const R = F.len * 0.6; stage.scale.set(R, 1, R); m.add(stage);
    const cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    const el = opts.elev ?? 0.16, aspect = cw / ch;
    // frame by size: the turntable spans ~72% of the width, with room above the roof
    const halfV = Math.tan(THREE.MathUtils.degToRad(17) / 2);
    const dist = opts.dist ?? Math.max(R * 2 / (2 * halfV * aspect * 0.72), F.h * 1.15 / (2 * halfV * 0.9));
    const ty = F.h * 0.42;
    showCam.aspect = aspect; showCam.position.set(0, ty + Math.sin(el) * dist, Math.cos(el) * dist); showCam.lookAt(0, ty, 0); showCam.updateProjectionMatrix();
    renderer.setPixelRatio(dpr); renderer.setSize(cw, ch, false);
    renderer.setViewport(0, 0, cw, ch); renderer.setScissor(0, 0, cw, ch);
    const was = window.CITY_PERIOD || 'night'; setPeriod('day'); scene.add(studio);
    m.visible = true; renderer.render(scene, showCam); m.visible = false;
    m.remove(stage); scene.remove(studio); setPeriod(was);
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    renderer.setPixelRatio(DPR); renderer.setSize(W, HMAX, false);
  }
  // the downloaded models (~17 MB) load on demand: near the garage, when it opens, or if one is the player's car.
  // Until then the hand-built models stand in (same ids), and 'garage:models' swaps them in.
  let glbPromise = null;
  const loadModels = () => glbPromise || (glbPromise = loadGLBs());
  window.JOPES_GARAGE = { loadModels, traffic: () => Object.keys(GLB).filter(k => GLB[k].userData.cfg?.traffic), credit: id => GLB[id] && GLB[id].userData.cfg && GLB[id].userData.cfg.credit, ids: GARAGE_IDS, names: Object.fromEntries(GARAGE_IDS.map(k => [k, REAL[k] ? REAL[k].name : 'XTZ 250 Lander'])), showcase, build: buildRealCar };
  window.dispatchEvent(new Event('garage:ready'));

  CITY.attachGL({ drawCar, drawHeli, drawPlane, drawTrain, pedFrame, personFrame, personBust,
    clearPedCache: () => { pedCache = {}; for (const k in personCache) delete personCache[k]; }, W, H, DPR, PLANE_BOX });
}

boot();
