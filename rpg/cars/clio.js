/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — Renault Clio II hatch 5p (2010/2011, preto) em 3D detalhado
   Escala ~15 un/m (3,81 m → 57,2) · frente = +X · chão y = 0 · direita = +Z
   Mesma técnica do Cruze/HB20 (cars/kit.js). Traços do Clio: formas
   redondas, capô curto e caído, para-brisa longo, tampa traseira quase em pé
   com lanternas altas nos cantos, friso preto de proteção nas portas,
   retrovisores pretos e calotas. Sem logotipos; placa fictícia.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { V3, clamp, ss, lerp, mono, crSection, loft, frameFrom, FR, roundPoly, carMaterials, decalKit, to2, ellipse,
  bodyStations, finishBody, whiteColors, uniformStations, wheelWells, doorHandle, sideMirror, cabinInterior, alloyWheels, studioShadowPlane } from './kit.js';

export function buildClio({ studio = false, tailOff, head, plateTex, studioShadow } = {}) {
  const car = new THREE.Group();
  const M = carMaterials({ tailOff, head, paint: 0x0d0f12 });
  M.paint.roughness = 0.28; M.paint.envMapIntensity = 1.5; M.paintPlain.roughness = 0.28; M.paintPlain.envMapIntensity = 1.5;
  const { paint, paintPlain, glass, frit, pianoBlack, satinBlack, plasticTex, chrome, gap, lensClear, housing, reflector, drl, projGlass, redLens, redDeep, tailGlow } = M;

  /* ── dimensions ── */
  const XF = 28.8, XR = -28.4;
  const AX = [17.8, -19.2];
  const WR = 4.28, ARCH = 5.2, TRACK = 10.7;

  const yTop = mono([[XF, 7.2], [28.65, 8.6], [28.35, 9.9], [27.7, 10.9], [26.5, 11.65], [23, 12.4], [18, 13.3], [14, 14.0], [12, 14.25],
    [0, 14.45], [-12, 14.95], [-18, 15.25], [-22, 15.45], [-25, 15.6], [-27.0, 15.5], [-27.7, 15.05], [-28.05, 13.4], [-28.3, 10.6], [-28.38, 8.8], [XR, 7.9]]);
  const yBelt0 = mono([[XF, 7.2], [28.65, 8.4], [28.2, 9.7], [27.4, 10.7], [25.5, 11.3], [20, 12.2], [14, 13.15], [12, 13.6], [0, 14.0], [-12, 14.45],
    [-18, 14.75], [-22, 15.0], [-25, 15.15], [-27.0, 15.05], [-27.7, 14.7], [-28.05, 13.3], [-28.3, 10.6], [-28.38, 8.8], [XR, 7.9]]);
  const yBelt = x => Math.min(yBelt0(x), yTop(x));
  const yBot0 = mono([[XF, 7.2], [28.75, 6.0], [28.55, 4.5], [28.1, 3.3], [26.5, 2.75], [22, 2.5], [-22, 2.5], [-26.5, 3.0], [-27.9, 3.8], [-28.3, 5.2], [-28.38, 6.8], [XR, 7.9]]);
  const yBot = x => Math.min(yBot0(x), yBelt(x));
  const ySh = x => 10.6 + (26 - clamp(x, -26, 26)) * (2.0 / 52) - 0.5 * ss(26, 28.5, x);
  const yLc = x => 7.0;
  const creaseA = x => 0;
  const pf = x => x > 19 ? 1 - 0.11 * Math.pow(clamp((x - 19) / 9.8, 0, 1), 2) : x < -23 ? 1 - 0.07 * Math.pow(clamp((-23 - x) / 5.4, 0, 1), 2) : 1;
  const flare = x => Math.max(...AX.map(a => Math.exp(-Math.pow((x - a) / 6.0, 2))));
  const wSh = x => 12.3 * pf(x) + 0.25 * flare(x);
  const wBelt = x => pf(x) * (11.05 - 0.3 * ss(14, 27, x) - 0.3 * ss(-23, -28, x));
  const sweepF = x => 3.8 * ss(18, XF, x), sweepR = x => 2.6 * ss(-21, XR, x);

  function bodyHalf(x) {
    const yb = yBot(x), yt = yTop(x), yB = yBelt(x);
    const ws = wSh(x), wb = wBelt(x), p = pf(x), fl = flare(x), A = creaseA(x);
    const wRock = 11.7 * p + 0.2 * fl, wU = 9.9 * p;
    const ys = Math.min(ySh(x), yB - 0.8), yc = yLc(x);
    const yRk = yb + 1.3;
    const lin = y => lerp(wRock, ws, clamp((y - yRk) / Math.max(0.01, ys - yRk), 0, 1));
    const C = [
      [yb, 0], [yb, wU], [yb + 0.45, wRock - 0.28], [yRk, wRock],
      [yc - 0.35, lin(yc - 0.35) + 0.18 * A], [yc + 0.5, lin(yc + 0.5) - 0.12 * A],
      [ys - 0.1, ws], [ys + 0.25, ws - 0.22], [yB - 0.28, wb + 0.12], [yB, wb - 0.18],
      [yB + (yt - yB) * 0.72, wb * 0.6], [yt, 0],
    ];
    for (let i = 1; i < C.length; i++) C[i][0] = Math.max(C[i][0], C[i - 1][0]);
    C[C.length - 1][0] = yt;
    for (let i = C.length - 2; i >= 0; i--) C[i][0] = Math.min(C[i][0], C[i + 1][0]);
    return crSection(C, [4, 2, 2, 3, 3, 4, 2, 3, 2, 5, 7]);
  }
  const archY = x => { let y = -1; for (const a of AX) { const d = x - a; if (Math.abs(d) < ARCH) y = Math.max(y, WR + Math.sqrt(ARCH * ARCH - d * d)); } return y; };
  const bodyPost = v => {
    const k = Math.pow(v.z / 12.3, 2);
    v.x -= sweepF(v.x) * k; v.x += sweepR(v.x) * k;
    v.z *= 1 - 0.08 * ss(23, XF, v.x) * ss(9.5, 3, v.y) - 0.06 * ss(-24, XR, v.x) * ss(10, 4, v.y);
    return v;
  };
  const bodyGeo = loft(bodyStations(XF, XR, AX, ARCH, 185), bodyHalf, bodyPost, () => 0, 1);
  finishBody(bodyGeo, archY, AX, WR, ARCH);
  const body = new THREE.Mesh(bodyGeo, paint);
  car.add(body);

  /* ── greenhouse: long raked windshield, roof falling to a spoiler, steep hatch glass ── */
  const dloTop = mono([[12.1, 13.95], [0.8, 19.7], [-2, 20.1], [-8, 20.25], [-12, 20.1], [-16, 19.75], [-19.5, 19.05], [-21.2, 18.2], [-21.9, 16.9], [-22.0, 15.4]]);
  const dloBot = x => yBelt(x) + 0.12;
  const XA = 12.1, XQ = -22.0;
  const inDLO = (x, y, m = 0) => x < XA - m && x > XQ + m && y > dloBot(x) + m && y < dloTop(x) - m;
  const GF = 14.6, GR = -27.6;
  const WS_TOP = 0.8, BL_TOP = -23.0;
  const yRC = mono([[GF, 13.5], [8, 17.3], [WS_TOP, 20.6], [-2, 21.1], [-7, 21.3], [-12, 21.15], [-16, 20.8], [-20, 20.2], [BL_TOP, 19.55],
    [-24.6, 18.9], [-26.0, 17.7], [-27.0, 16.3], [GR, 15.2]]);
  const yRE0 = mono([[GF, 13.2], [12.6, 13.7], [12.0, 13.95], [0.8, 20.0], [-2, 20.45], [-8, 20.6], [-12, 20.45], [-16, 20.1], [-20, 19.5], [-23, 18.8], [-24.8, 18.0],
    [-26.3, 16.9], [-27.2, 15.8], [GR, 15.0]]);
  const yB_G = x => yBelt(x) - 0.06;
  const yRE = x => clamp(yRE0(x), yB_G(x), yRC(x) - 0.12);
  const wB_G = x => wBelt(x) - 0.14;
  const LEAN = 0.42;
  const wE = x => wB_G(x) - LEAN * (yRE(x) - yB_G(x));
  const GCNT = [2, 8, 8, 3, 5, 8];
  const G_IDX = []; { let s = 0; for (const c of GCNT) { G_IDX.push(s); s += c; } G_IDX.push(s); }
  function ghHalf(x) {
    const yb = yB_G(x), yr = yRE(x), yc = Math.max(yRC(x), yr + 0.1), wb = wB_G(x), we = wE(x);
    const hh = yr - yb;
    const C = [[yb, 0], [yb, wb], [yb + hh * 0.5, wb - LEAN * hh * 0.5 + 0.1], [yr - 0.25, we + 0.06], [yr + 0.12, we - 0.32],
      [yr + 0.3 + (yc - yr) * 0.55, we * 0.7], [yc, 0]];
    for (let i = 1; i < C.length; i++) C[i][0] = Math.max(C[i][0], C[i - 1][0]);
    return crSection(C, GCNT);
  }
  const ghPost = v => {
    const k = Math.pow(v.z / 11.0, 2);
    v.x -= 2.0 * ss(2, GF, v.x) * k;
    v.x += 1.2 * ss(-24.5, GR, v.x) * k;
    return v;
  };
  const gStations = uniformStations(GF, GR, 0.2, [WS_TOP, WS_TOP + 0.45, BL_TOP, BL_TOP - 0.45]);
  const gGroup = (i, j, x0, x1, cx, cy) => {
    const xm = (x0 + x1) / 2;
    if (j < G_IDX[3] + 2 && inDLO(cx, cy, 0.04)) return 1;
    if (xm > WS_TOP && xm < GF) { if (j >= G_IDX[4] + 2) return xm < WS_TOP + 0.45 || j < G_IDX[4] + 3 ? 2 : 1; return 0; }
    if (xm < BL_TOP && xm > GR) { if (j >= G_IDX[4] + 2) return xm > BL_TOP - 0.45 || j < G_IDX[4] + 3 ? 2 : 1; return 0; }
    return 0;
  };
  const ghGeo = loft(gStations, ghHalf, ghPost, gGroup, 3);
  whiteColors(ghGeo);
  const gh = new THREE.Mesh(ghGeo, [paint, glass, frit]); gh.renderOrder = 3; car.add(gh);
  car.add(new THREE.Mesh(ghGeo, [new THREE.MeshStandardMaterial({ color: 0x5a5852, roughness: 0.95, side: THREE.BackSide }), new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: 0x5a5852, roughness: 0.95, side: THREE.BackSide })]));

  cabinInterior(car, M, { tub: [12.0, -24.6, 10.6, 20.2], dashX: 9.8, dashW: 18.2, dashY: 12.9, wheelZ: 4.6, frontSeatX: 0.2, rearSeatX: -13.3, seatW: 17.4, shelf: [-23.8, 15.0, 5.0], seat: 0x1c1d21, seat2: 0x2a2c31 });

  /* ── decals ── */
  const { P, decal, line, flush } = decalKit(car);
  const bodyOnly = [body], ghOnly = [gh];
  const prF = P('front', bodyOnly, FR.front), prR = P('rear', bodyOnly, FR.rear), prT = P('top', bodyOnly, FR.top);
  const side = s => s > 0 ? FR.right : FR.left;
  const prS = s => P('side' + s, bodyOnly, side(s));
  const prGS = s => P('gside' + s, ghOnly, side(s));

  /* front: slim twin-slot grille under the hood lip, wide lower intake, blank fog recesses */
  for (const s of [1, -1]) for (const [y0, y1] of [[9.95, 10.4], [10.6, 11.0]]) {
    decal(prF, FR.front, roundPoly([[s * 1.6, y0], [s * 6.0, y0 + 0.15], [s * 5.8, y1 + 0.15], [s * 1.6, y1]], 0.18), M.honey, 0.07, { nv: 2, uvScale: 0.9 });
  }
  decal(prF, FR.front, roundPoly([[-8.0, 3.9], [8.0, 3.9], [8.7, 6.5], [-8.7, 6.5]], 0.6), M.honey, 0.06, { nv: 6, uvScale: 0.9 });
  for (const y of [4.75, 5.6]) decal(prF, FR.front, roundPoly([[-8.0, y - 0.13], [8.0, y - 0.13], [8.2, y + 0.13], [-8.2, y + 0.13]], 0.1), pianoBlack, 0.12, { nv: 1 });
  line(prF, [[-11.4, 7.6], [-8.4, 7.35], [8.4, 7.35], [11.4, 7.6]], 0.12, gap, 0.04);           // bumper split line
  decal(prF, FR.front, [[-9.8, 2.8], [9.8, 2.8], [10.2, 3.35], [-10.2, 3.35]], M.grain, 0.06, { nv: 2 });
  for (const s of [1, -1]) {
    const F = frameFrom(V3(-1, 0, -0.6 * s)), pr = P('fogF' + s, bodyOnly, F);
    const bez = [[28.3, 4.0, 9.6], [28.2, 6.1, 9.9], [27.5, 6.3, 11.3], [26.7, 5.9, 12.0], [26.9, 4.2, 11.8], [27.9, 3.8, 10.8]].map(p => [p[0], p[1], p[2] * s]);
    decal(pr, F, roundPoly(to2(F, bez), 0.6), M.grain, 0.06, { nv: 6 });
  }
  // headlamps: big swept teardrops climbing up the fender
  for (const s of [1, -1]) {
    const F = frameFrom(V3(-1, -0.2, -0.9 * s)), pr = P('headF' + s, bodyOnly, F);
    const M3 = pts => to2(F, pts.map(p => [p[0], p[1], p[2] * s]));
    const o2 = M3([[28.6, 9.9, 6.3], [28.35, 11.25, 6.0], [27.9, 11.65, 8.0], [27.0, 11.95, 10.2], [25.3, 12.25, 11.6], [23.2, 12.35, 12.1], [22.9, 11.8, 12.25],
      [24.8, 10.85, 12.0], [26.8, 9.95, 11.4], [28.0, 9.55, 9.5]]);
    decal(pr, F, roundPoly(o2, 0.45), housing, 0.05, { nv: 10, nu: 70 });
    decal(pr, F, roundPoly(M3([[28.4, 10.0, 6.6], [28.2, 11.3, 6.5], [27.3, 11.75, 9.6], [25.0, 12.05, 11.6], [24.2, 11.55, 12.0], [26.6, 10.25, 11.3], [27.9, 9.75, 9.4]]), 0.5), reflector, 0.08, { nv: 8 });
    for (const [c, r] of [[[27.1, 10.75, 10.6], 1.0], [[28.3, 10.55, 7.6], 0.75]]) {
      const pc = M3([c])[0];
      decal(pr, F, ellipse(pc[0], pc[1], r * 1.15, r * 1.08), chrome, 0.1, { nv: 6 });
      decal(pr, F, ellipse(pc[0], pc[1], r * 0.62, r * 0.58), projGlass, 0.14, { nv: 5 });
    }
    line(pr, M3([[25.4, 11.35, 11.75], [23.6, 11.95, 12.15]]), 0.3, M.amber, 0.13);
    decal(pr, F, roundPoly(o2, 0.45), lensClear, 0.2, { nv: 10, nu: 70 });
  }
  // hood shut lines + cowl
  line(prF, [[-12.0, 12.45], [-9.5, 12.0], [-6.1, 11.4], [-1.6, 11.35], [0, 11.2], [1.6, 11.35], [6.1, 11.4], [9.5, 12.0], [12.0, 12.45]], 0.1, gap, 0.04);
  for (const s of [1, -1]) line(prT, [[12.9, 10.6 * s], [18, 10.6 * s], [22.6, 10.65 * s]], 0.1, gap);
  const prTB = P('topBoth', [body, gh], FR.top);
  const seam = z => { for (let x = 17.5; x > 8; x -= 0.05) { const h = prTB(x, z, 0); if (h && h.mesh === 1) return x; } return 13; };
  const seamPts = []; for (let z = -10.0; z <= 10.01; z += 0.8) seamPts.push([seam(z), z]);
  decal(prT, FR.top, [...seamPts.map(([x, z]) => [x + 0.75, z]), ...seamPts.slice().reverse().map(([x, z]) => [x - 0.3, z])], plasticTex, 0.05, { nv: 6 });

  /* rear: tall lamps in the corners, near-vertical tailgate, plate in the bumper */
  const tails = [];
  for (const s of [1, -1]) {
    const F = frameFrom(V3(1, -0.05, -0.8 * s)), pr = P('tailF' + s, bodyOnly, F);
    const M3 = pts => to2(F, pts.map(p => [p[0], p[1], p[2] * s]));
    const o2 = M3([[-27.8, 15.2, 9.7], [-28.1, 13.0, 9.9], [-28.28, 11.2, 10.4], [-28.2, 10.55, 11.3], [-27.5, 10.75, 11.95], [-26.4, 12.4, 12.15],
      [-26.1, 14.3, 12.05], [-26.5, 15.15, 11.7], [-27.3, 15.45, 10.8]]);
    decal(pr, F, roundPoly(o2, 0.5), redDeep, 0.05, { nv: 12, nu: 40 });
    const tm = line(pr, M3([[-27.6, 14.95, 10.0], [-27.25, 15.0, 11.0], [-26.6, 14.7, 11.75], [-26.3, 13.6, 12.05]]), 0.45, tailGlow, 0.12, { separate: true });
    if (tm) tails.push(tm);
    decal(pr, F, roundPoly(M3([[-28.15, 12.6, 10.0], [-28.25, 11.2, 10.5], [-27.6, 10.95, 11.8], [-27.0, 11.6, 12.05], [-27.3, 12.7, 11.6]]), 0.35), redLens, 0.1, { nv: 5 });
    const rc = M3([[-28.0, 12.0, 10.45]])[0];
    decal(pr, F, ellipse(rc[0], rc[1], 0.42, 0.5), M.reverse, 0.12, { nv: 5 });
    decal(pr, F, roundPoly(o2, 0.5), lensClear, 0.18, { nv: 12, nu: 40 });
  }
  line(prR, [[-9.4, 15.3], [-9.6, 12.0], [-9.2, 10.4], [9.2, 10.4], [9.6, 12.0], [9.4, 15.3]], 0.1, gap);
  decal(prR, FR.rear, roundPoly([[-3.4, 12.2], [3.4, 12.2], [3.2, 12.55], [-3.2, 12.55]], 0.15), chrome, 0.1, { nv: 2 });   // tailgate handle strip
  { const rp = roundPoly([[-3.9, 6.75], [3.9, 6.75], [4.0, 9.2], [-4.0, 9.2]], 0.5); line(prR, [...rp, rp[0]], 0.1, gap); }
  line(prR, [[-11.0, 9.9], [-9.5, 9.75], [9.5, 9.75], [11.0, 9.9]], 0.1, gap, 0.04);
  decal(prR, FR.rear, roundPoly([[-10.0, 3.7], [10.0, 3.7], [9.8, 4.6], [-9.8, 4.6]], 0.3), M.grain, 0.06, { nv: 3 });

  /* sides */
  const dloPoly = (x0, x1, inset = 0) => {
    const pts = [], n = 40;
    for (let i = 0; i <= n; i++) { const x = lerp(x0, x1, i / n); pts.push([x, Math.max(dloBot(x) + inset, dloTop(x) - inset)]); }
    for (let i = n; i >= 0; i--) { const x = lerp(x0, x1, i / n); pts.push([x, dloBot(x) + inset]); }
    return pts;
  };
  for (const s of [1, -1]) {
    const F = side(s), pr = prGS(s);
    const ring = dloPoly(XA + 0.05, XQ - 0.05, 0); ring.push(ring[0]);
    line(pr, ring, 0.75, pianoBlack, 0.05);
    decal(pr, F, dloPoly(-1.3, -2.7, -0.1), pianoBlack, 0.06, { nu: 8, nv: 8 });       // B pillar
    decal(pr, F, dloPoly(-17.4, -18.0, -0.1), pianoBlack, 0.06, { nu: 6, nv: 8 });     // fixed-glass divider
    decal(pr, F, [[XA - 0.2, dloBot(XA - 0.2) + 0.02], [XA + 1.3, dloBot(XA + 1.3) + 0.02], [XA - 0.2, dloBot(XA) + 1.3]], pianoBlack, 0.08, { nv: 3 });
  }
  for (const s of [1, -1]) {
    const pr = prS(s);
    line(pr, [[11.65, dloBot(11.65) - 0.1], [11.75, 9], [11.6, 4.2]], 0.11, gap);
    line(pr, [[-2.0, dloBot(-2.0) - 0.1], [-1.95, 4.2]], 0.11, gap);
    decal(pr, side(s), roundPoly([[11.0, 8.35], [-18.0, 8.35], [-18.0, 9.35], [11.0, 9.35]].map(([x, y]) => [x, y]), 0.45), M.grain, 0.12, { nv: 3, nu: 60 });   // black rub strip
    const R = ARCH + 0.85, arc = []; for (let a = 44; a >= 0; a -= 6) { const r = a * Math.PI / 180; arc.push([AX[1] + Math.cos(r) * R, WR + Math.sin(r) * R]); }
    line(pr, [[-21.6, dloBot(-21.6) - 0.1], [-20.4, 13.6], [-17.6, 11.6], ...arc, [AX[1] + R, 4.2]], 0.11, gap);
    line(pr, [[11.6, 4.25], [AX[1] + R, 4.25]], 0.1, gap);
  }
  { const fd = ellipse(-23.6, 13.2, 1.15, 1.15, 24); line(prS(1), [...fd, fd[0]], 0.09, gap); }   // fuel door (right)

  flush([lensClear]);

  /* ── 3D parts ── */
  const handleM = { ...M, handle: paintPlain };
  for (const s of [1, -1]) for (const x of [-0.3, -15.0]) { const h = prS(s)(x, 12.4, 0.05); if (h) doorHandle(car, handleM, h, 2.0); }
  for (const s of [1, -1]) {
    const b = prS(s)(11.2, 13.8, 0); const base = b ? b.p : V3(11.2, 13.8, s * 11.2);
    sideMirror(car, M, s, { at: [10.0, 14.6, 12.6], size: [1.2, 1.0, 1.8], base, stalkTo: [10.6, 14.2, 11.4], capMat: pianoBlack });
  }
  // third brake light at the top of the hatch glass
  { const prG = P('topgh', ghOnly, FR.top), pts = [];
    for (let z = -9.2; z <= 9.21; z += 0.8) { const h = prG(BL_TOP + 0.3, z, 0); if (h) pts.push(h.p); }
    if (pts.length > 4) {
      const sh = new THREE.Shape(); sh.moveTo(0.7, -0.1); sh.lineTo(0.5, 0.15); sh.lineTo(-0.3, 0.08); sh.lineTo(-0.45, -0.15); sh.lineTo(-0.1, -0.25); sh.closePath();
      const len = pts[pts.length - 1].z - pts[0].z;
      const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 3, curveSegments: 4 });
      g.translate(0, 0, -len / 2);
      const pos = g.attributes.position; const yAt = z => { let best = pts[0]; for (const q of pts) if (Math.abs(q.z - z) < Math.abs(best.z - z)) best = q; return best.y; };
      for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i); pos.setY(i, pos.getY(i) + yAt(z) - 0.05); pos.setX(i, pos.getX(i) + BL_TOP + 0.3 - 1.0 * Math.pow(z / 9.5, 2)); }
      g.computeVertexNormals();
      g.dispose();   // no roof spoiler on these cars — only the third brake light stays
      const stop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 4.4), redDeep); { const q = prG(BL_TOP - 0.55, 0, 0.12); if (q) { stop.position.copy(q.p); car.add(stop); } }
    }
    // rear wiper
    const w0 = prG(-26.8, 0.6, 0.25), w1 = prG(-24.6, -5.5, 0.25);
    if (w0 && w1) { const tg = new THREE.TubeGeometry(new THREE.LineCurve3(w0.p, w1.p), 4, 0.12, 5); car.add(new THREE.Mesh(tg, satinBlack)); }
    // front wipers
    for (const [z0, z1] of [[-9.0, 0.2], [-0.2, 8.0]]) {
      const ws = [];
      for (let k = 0; k <= 2; k++) { const z = lerp(z0, z1, k / 2), x = seam(z) - 0.7 - k * 0.5; const h = prG(x, z, 0.28); if (h) ws.push(h.p); }
      if (ws.length > 2) car.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ws), 12, 0.13, 5), satinBlack));
    }
  }
  // short roof antenna
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.2, 6), satinBlack); m.position.set(-0.4, 22.6, 0); m.rotation.z = 0.6; car.add(m);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 0.45, 12), satinBlack); b.position.set(0.6, 20.95, 0); car.add(b); }
  // plates: front on the grille, rear in the bumper recess
  const plateM = plateTex ? plateTex('JOP1C10') : new THREE.MeshStandardMaterial({ color: 0xf4f6f8 });
  for (const [pr, y] of [[prF, 7.0], [prR, 7.98]]) {
    const h = pr(0, y, 0.25); if (!h) continue;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.95), plateM); pl.position.copy(h.p); pl.lookAt(h.p.clone().add(h.n)); car.add(pl);
  }
  wheelWells(car, M, AX, WR, ARCH, 22.4, { len: 52, w: 19 });

  /* ── wheels: 165/65 R14 steel wheels with silver 8-slot hubcaps ── */
  const wheel = alloyWheels({ TW: 2.5, RIM: 2.67, R: WR, rimColor: 0xb8bec5, faceColor: 0xd9dde2, nuts: 4, spokes: { n: 8, split: 0, w0: 0.32, w1: 0.62 } });
  const wheels = [];
  for (const [i, x] of AX.entries()) for (const s of [1, -1]) { const w = wheel(i === 0, s); w.position.set(x, WR, s * TRACK); car.add(w); wheels.push(w); }

  if (studio && studioShadow) studioShadowPlane(car, studioShadow, 72, 35);
  car.userData = { wheels, tails, tail: tails[0] };
  return car;
}
