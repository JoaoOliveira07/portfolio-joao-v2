/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — Hyundai HB20 hatch (2016, branco) em 3D detalhado
   Escala ~15 un/m (3,92 m → 58,8) · frente = +X · chão y = 0 · direita = +Z
   Mesma técnica do Cruze (cars/kit.js): carroceria e teto em loft, vidros na
   própria malha, faróis/lanternas/grade/vincos como decalques projetados.
   Traços do HB20: vinco forte subindo da roda dianteira até a lanterna,
   cintura que sobe no fim (vigia lateral "kick-up"), vigia traseira bem
   inclinada com aerofólio, grade hexagonal e faróis compridos que sobem
   pelo para-lama. Sem logotipos; placa fictícia.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { V3, clamp, ss, lerp, mono, crSection, loft, frameFrom, FR, roundPoly, carMaterials, decalKit, to2, ellipse,
  bodyStations, finishBody, whiteColors, uniformStations, wheelWells, doorHandle, sideMirror, cabinInterior, alloyWheels, studioShadowPlane } from './kit.js';

export function buildHB20({ studio = false, tailOff, head, plateTex, studioShadow } = {}) {
  const car = new THREE.Group();
  const M = carMaterials({ tailOff, head });
  const { paint, paintPlain, glass, frit, pianoBlack, satinBlack, plasticTex, chrome, gap, lensClear, housing, reflector, drl, projGlass, redLens, redDeep, tailGlow } = M;

  /* ── dimensions ── */
  const XF = 29.6, XR = -29.3;
  const AX = [18.0, -19.4];
  const WR = 4.52, ARCH = 5.45, TRACK = 11.0;

  const yTop = mono([[XF, 7.4], [29.45, 8.8], [29.15, 10.0], [28.6, 11.0], [27.6, 11.75], [25, 12.35], [20, 13.15], [15, 13.85], [12.8, 14.25],
    [11, 14.3], [0, 15.2], [-10, 16.0], [-17, 16.75], [-21, 17.35], [-24, 17.15], [-26.5, 16.6], [-27.6, 16.25], [-28.3, 15.45], [-28.75, 13.6],
    [-29.05, 11.2], [-29.2, 9.4], [XR, 8.4]]);
  const yBelt0 = mono([[XF, 7.4], [29.45, 8.6], [29.0, 9.8], [28.2, 10.9], [26.5, 11.5], [22, 12.1], [16, 13.05], [12.8, 13.6], [0, 14.55],
    [-10, 15.4], [-17, 16.15], [-21, 16.95], [-24, 16.8], [-26.5, 16.2], [-27.6, 15.85], [-28.3, 15.1], [-28.75, 13.5], [-29.05, 11.2], [-29.2, 9.4], [XR, 8.4]]);
  const yBelt = x => Math.min(yBelt0(x), yTop(x));
  const yBot0 = mono([[XF, 7.4], [29.55, 6.2], [29.35, 4.6], [28.9, 3.3], [27.5, 2.85], [23, 2.6], [-23, 2.6], [-27.5, 3.2], [-28.7, 4.0], [-29.15, 5.4], [-29.25, 7.2], [XR, 8.4]]);
  const yBot = x => Math.min(yBot0(x), yBelt(x));
  // the HB20's signature crease: low at the headlamp, climbing straight into the tail lamp
  const ySh = x => 10.4 + (27 - clamp(x, -27.5, 27)) * (4.2 / 54) - 0.6 * ss(27, 29.5, x);
  const yLc = x => 6.2 + (10 - clamp(x, -14, 12)) * 0.11;
  const creaseA = x => ss(-15, -10.5, x) * (1 - ss(9, 13, x));
  const pf = x => x > 20 ? 1 - 0.09 * Math.pow(clamp((x - 20) / 9.6, 0, 1), 2) : x < -24 ? 1 - 0.04 * Math.pow(clamp((-24 - x) / 5.3, 0, 1), 2) : 1;
  const flare = x => Math.max(...AX.map(a => Math.exp(-Math.pow((x - a) / 6.2, 2))));
  const wSh = x => 12.6 * pf(x) + 0.3 * flare(x);
  const wBelt = x => pf(x) * (11.45 - 0.3 * ss(14, 28, x) - 0.25 * ss(-24, -29, x));
  const sweepF = x => 3.8 * ss(18, XF, x), sweepR = x => 2.4 * ss(-22, XR, x);

  function bodyHalf(x) {
    const yb = yBot(x), yt = yTop(x), yB = yBelt(x);
    const ws = wSh(x), wb = wBelt(x), p = pf(x), fl = flare(x), A = creaseA(x);
    const wRock = 11.95 * p + 0.22 * fl, wU = 10.2 * p;
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
    const k = Math.pow(v.z / 12.6, 2);
    v.x -= sweepF(v.x) * k; v.x += sweepR(v.x) * k;
    v.z *= 1 - 0.08 * ss(23, XF, v.x) * ss(9.5, 3, v.y) - 0.06 * ss(-24, XR, v.x) * ss(10, 4, v.y);
    return v;
  };
  const bodyGeo = loft(bodyStations(XF, XR, AX, ARCH, 190), bodyHalf, bodyPost, () => 0, 1);
  finishBody(bodyGeo, archY, AX, WR, ARCH);
  const body = new THREE.Mesh(bodyGeo, paint);
  car.add(body);

  /* ── greenhouse: long raked windshield, roof falling to a spoiler, steep hatch glass ── */
  const dloTop = mono([[12.6, 14.05], [1.0, 20.25], [-3, 20.65], [-10, 20.65], [-16, 20.3], [-19.5, 19.75], [-21.5, 19.0], [-23.0, 17.35]]);
  const dloBot = x => yBelt(x) + 0.12;
  const XA = 12.6, XQ = -23.0;
  const inDLO = (x, y, m = 0) => x < XA - m && x > XQ + m && y > dloBot(x) + m && y < dloTop(x) - m;
  const GF = 15.2, GR = -28.3;
  const WS_TOP = 1.4, BL_TOP = -23.9;
  const yRC = mono([[GF, 13.75], [8, 17.55], [WS_TOP, 21.2], [-1, 21.75], [-5, 22.0], [-10, 21.95], [-15, 21.7], [-20, 21.2], [-23, 20.8], [BL_TOP, 20.6],
    [-24.8, 20.15], [-26.2, 18.35], [-27.3, 16.75], [GR, 15.7]]);
  const yRE0 = mono([[GF, 13.5], [13.0, 14.0], [12.3, 14.4], [1.0, 20.6], [-3, 21.0], [-10, 21.0], [-16, 20.65], [-21, 20.1], [-23.5, 19.65], [-25, 19.0],
    [-26.5, 17.5], [-27.6, 16.2], [GR, 15.5]]);
  const yB_G = x => yBelt(x) - 0.06;
  const yRE = x => clamp(yRE0(x), yB_G(x), yRC(x) - 0.12);
  const wB_G = x => wBelt(x) - 0.14;
  const LEAN = 0.46;
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
    const k = Math.pow(v.z / 11.5, 2);
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

  cabinInterior(car, M, { tub: [12.6, -25.5, 11.0, 21.0], dashX: 10.2, dashW: 19.0, dashY: 13.1, wheelZ: 4.8, frontSeatX: 0.4, rearSeatX: -13.4, seatW: 18.2, shelf: [-24.8, 15.4, 5.5] });

  /* ── decals ── */
  const { P, decal, line, flush } = decalKit(car);
  const bodyOnly = [body], ghOnly = [gh];
  const prF = P('front', bodyOnly, FR.front), prR = P('rear', bodyOnly, FR.rear), prT = P('top', bodyOnly, FR.top);
  const side = s => s > 0 ? FR.right : FR.left;
  const prS = s => P('side' + s, bodyOnly, side(s));
  const prGS = s => P('gside' + s, ghOnly, side(s));

  /* front: hexagonal grille with chrome surround, black bars; intake + fog lamps below */
  const hex = (k) => [[-6.9 * k, 10.35 + (k - 1) * 0.6], [6.9 * k, 10.35 + (k - 1) * 0.6], [7.6 * k, 8.9], [6.5 * k, 4.95 - (k - 1) * 0.6], [-6.5 * k, 4.95 - (k - 1) * 0.6], [-7.6 * k, 8.9]];
  decal(prF, FR.front, roundPoly(hex(1.06), 0.6), chrome, 0.05, { nv: 10, nu: 50 });
  decal(prF, FR.front, roundPoly(hex(1.0), 0.5), M.honey, 0.08, { nv: 10, nu: 50, uvScale: 0.9 });
  for (const y of [5.9, 7.0, 8.1, 9.2]) {
    const w = (y < 8.9 ? lerp(6.5, 7.6, (y - 4.95) / 3.95) : lerp(7.6, 6.9, (y - 8.9) / 1.45)) - 0.35;
    decal(prF, FR.front, roundPoly([[-w, y - 0.28], [w, y - 0.28], [w, y + 0.28], [-w, y + 0.28]], 0.15), pianoBlack, 0.13, { nv: 2 });
  }
  decal(prF, FR.front, roundPoly([[-1.4, 9.9], [1.4, 9.9], [1.4, 10.5], [-1.4, 10.5]], 0.25), chrome, 0.16, { nv: 2 });   // badge plinth (no logo)
  decal(prF, FR.front, roundPoly([[-10.2, 3.45], [10.2, 3.45], [10.6, 4.55], [-10.6, 4.55]], 0.4), M.grain, 0.06, { nv: 3 });
  decal(prF, FR.front, [[-10.0, 2.85], [10.0, 2.85], [10.4, 3.3], [-10.4, 3.3]], M.grain, 0.06, { nv: 2 });
  for (const s of [1, -1]) {
    const F = frameFrom(V3(-1, 0, -0.6 * s)), pr = P('fogF' + s, bodyOnly, F);
    const bez = [[29.0, 3.7, 9.2], [28.9, 6.3, 9.6], [28.2, 6.6, 11.3], [27.3, 6.1, 12.2], [27.5, 3.9, 12.0], [28.5, 3.6, 10.8]].map(p => [p[0], p[1], p[2] * s]);
    decal(pr, F, roundPoly(to2(F, bez), 0.7), pianoBlack, 0.06, { nv: 6 });
    const c = to2(F, [[28.3, 5.05, 10.9 * s]])[0];
    decal(pr, F, ellipse(c[0], c[1], 0.78, 0.78), chrome, 0.1, { nv: 6 });
    decal(pr, F, ellipse(c[0], c[1], 0.58, 0.58), reflector, 0.13, { nv: 6 });
    decal(pr, F, ellipse(c[0], c[1], 0.3, 0.3), projGlass, 0.16, { nv: 4 });
  }
  // headlamps: big swept teardrops climbing up the fender
  for (const s of [1, -1]) {
    const F = frameFrom(V3(-1, -0.22, -0.95 * s)), pr = P('headF' + s, bodyOnly, F);
    const M3 = pts => to2(F, pts.map(p => [p[0], p[1], p[2] * s]));
    const o2 = M3([[29.4, 9.15, 7.9], [29.2, 10.75, 7.3], [28.6, 11.6, 9.4], [27.6, 12.25, 11.1], [26.0, 12.65, 12.0], [24.0, 12.9, 12.3], [22.4, 12.95, 12.45],
      [22.6, 12.2, 12.5], [24.6, 11.35, 12.45], [26.6, 10.4, 12.15], [28.0, 9.6, 11.2], [29.0, 9.1, 9.4]]);
    decal(pr, F, roundPoly(o2, 0.35), housing, 0.05, { nv: 10, nu: 70 });
    decal(pr, F, roundPoly(M3([[28.6, 9.5, 9.6], [28.3, 11.3, 9.8], [26.5, 12.35, 11.7], [24.0, 12.6, 12.3], [23.4, 12.0, 12.4], [25.8, 11.0, 12.25], [27.6, 9.95, 11.4]]), 0.5), reflector, 0.08, { nv: 8 });
    for (const [c, r] of [[[27.0, 11.0, 11.2], 1.0], [[28.75, 9.95, 9.0], 0.62]]) {
      const pc = M3([c])[0];
      decal(pr, F, ellipse(pc[0], pc[1], r * 1.18, r * 1.08), housing, 0.1, { nv: 6 });
      decal(pr, F, ellipse(pc[0], pc[1], r, r * 0.92), chrome, 0.12, { nv: 6 });
      decal(pr, F, ellipse(pc[0], pc[1], r * 0.6, r * 0.56), projGlass, 0.15, { nv: 5 });
    }
    line(pr, M3([[29.15, 10.6, 7.5], [28.55, 11.42, 9.4], [27.5, 12.05, 11.1], [25.8, 12.45, 12.0], [23.4, 12.7, 12.4]]), 0.2, drl, 0.13);
    line(pr, M3([[25.2, 11.75, 12.4], [23.0, 12.45, 12.5]]), 0.24, M.amber, 0.13);                 // side turn lens at the tail of the lamp
    decal(pr, F, roundPoly(o2, 0.35), lensClear, 0.2, { nv: 10, nu: 70 });
  }
  // hood shut lines + cowl
  line(prF, [[-12.3, 12.7], [-9.8, 11.95], [-7.4, 11.0], [-3.5, 10.85], [0, 10.8], [3.5, 10.85], [7.4, 11.0], [9.8, 11.95], [12.3, 12.7]], 0.1, gap, 0.04);
  for (const s of [1, -1]) line(prT, [[13.4, 10.9 * s], [18, 10.8 * s], [22.4, 10.75 * s]], 0.1, gap);
  const prTB = P('topBoth', [body, gh], FR.top);
  const seam = z => { for (let x = 18; x > 8; x -= 0.05) { const h = prTB(x, z, 0); if (h && h.mesh === 1) return x; } return 13; };
  const seamPts = []; for (let z = -10.4; z <= 10.41; z += 0.8) seamPts.push([seam(z), z]);
  decal(prT, FR.top, [...seamPts.map(([x, z]) => [x + 0.75, z]), ...seamPts.slice().reverse().map(([x, z]) => [x - 0.3, z])], plasticTex, 0.05, { nv: 6 });

  /* rear: tail lamps on the shoulders, tailgate, plate in the bumper */
  const tails = [];
  for (const s of [1, -1]) {
    const F = frameFrom(V3(1, -0.1, -0.8 * s)), pr = P('tailF' + s, bodyOnly, F);
    const M3 = pts => to2(F, pts.map(p => [p[0], p[1], p[2] * s]));
    const o2 = M3([[-28.05, 15.75, 7.4], [-28.3, 14.9, 7.4], [-28.6, 13.85, 10.0], [-28.35, 13.35, 11.6], [-27.2, 13.6, 12.2], [-25.6, 14.65, 12.35],
      [-25.4, 15.35, 12.3], [-26.6, 15.95, 11.95], [-27.6, 16.1, 11.2], [-27.95, 16.0, 9.4]]);
    decal(pr, F, roundPoly(o2, 0.35), redDeep, 0.05, { nv: 10, nu: 50 });
    const tm = line(pr, M3([[-28.0, 15.45, 7.9], [-27.85, 15.7, 9.6], [-27.45, 15.75, 11.2], [-26.4, 15.5, 12.1], [-25.7, 15.05, 12.3]]), 0.42, tailGlow, 0.12, { separate: true });
    if (tm) tails.push(tm);
    decal(pr, F, roundPoly(M3([[-28.35, 14.6, 8.0], [-28.6, 13.95, 10.0], [-28.35, 13.65, 11.4], [-27.2, 13.9, 12.0], [-27.4, 14.7, 11.6], [-28.15, 14.95, 9.8]]), 0.3), redLens, 0.1, { nv: 5 });
    const rc = M3([[-27.55, 14.45, 11.3]])[0];
    decal(pr, F, ellipse(rc[0], rc[1], 0.55, 0.42), M.reverse, 0.12, { nv: 4 });
    decal(pr, F, roundPoly(o2, 0.35), lensClear, 0.18, { nv: 10, nu: 50 });
  }
  // tailgate shut line, handle strip, plate recess, reflectors, diffuser
  line(prR, [[-10.4, 15.7], [-10.3, 12.3], [-9.6, 10.75], [9.6, 10.75], [10.3, 12.3], [10.4, 15.7]], 0.1, gap);
  decal(prR, FR.rear, roundPoly([[-3.6, 11.3], [3.6, 11.3], [3.6, 11.65], [-3.6, 11.65]], 0.15), chrome, 0.1, { nv: 2 });
  { const rp = roundPoly([[-3.9, 7.4], [3.9, 7.4], [4.0, 9.85], [-4.0, 9.85]], 0.5); line(prR, [...rp, rp[0]], 0.1, gap); }
  for (const s of [1, -1]) {
    const F = frameFrom(V3(1, 0, -0.5 * s)), pr = P('reflR' + s, bodyOnly, F);
    decal(pr, F, roundPoly(to2(F, [[-28.9, 8.75, 6.6 * s], [-28.7, 8.75, 10.6 * s], [-28.6, 9.15, 10.9 * s], [-28.9, 9.15, 6.6 * s]]), 0.18), redLens, 0.08, { nv: 2 });
  }
  decal(prR, FR.rear, roundPoly([[-10.4, 3.9], [10.4, 3.9], [10.2, 4.9], [-10.2, 4.9]], 0.3), M.grain, 0.06, { nv: 3 });

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
    decal(pr, F, dloPoly(-1.6, -3.1, -0.1), pianoBlack, 0.06, { nu: 8, nv: 8 });       // B pillar
    decal(pr, F, dloPoly(-18.5, -19.4, -0.1), pianoBlack, 0.06, { nu: 6, nv: 8 });     // quarter-glass divider
    decal(pr, F, [[XA - 0.2, dloBot(XA - 0.2) + 0.02], [XA + 1.3, dloBot(XA + 1.3) + 0.02], [XA - 0.2, dloBot(XA) + 1.3]], pianoBlack, 0.08, { nv: 3 });
  }
  for (const s of [1, -1]) {
    const pr = prS(s);
    line(pr, [[12.15, dloBot(12.15) - 0.1], [12.25, 9], [12.1, 4.3]], 0.11, gap);
    line(pr, [[-2.35, dloBot(-2.35) - 0.1], [-2.3, 4.3]], 0.11, gap);
    const R = ARCH + 0.85, arc = []; for (let a = 44; a >= 0; a -= 6) { const r = a * Math.PI / 180; arc.push([AX[1] + Math.cos(r) * R, WR + Math.sin(r) * R]); }
    line(pr, [[-18.95, dloBot(-18.95) - 0.1], [-18.6, 14.6], [-17.6, 12.0], ...arc, [AX[1] + R, 4.3]], 0.11, gap);
    line(pr, [[12.1, 4.35], [AX[1] + R, 4.35]], 0.1, gap);
  }
  { const fd = ellipse(-22.6, 14.7, 1.15, 1.05, 24); line(prS(-1), [...fd, fd[0]], 0.09, gap); }   // fuel door (left)

  flush([lensClear]);

  /* ── 3D parts ── */
  const handleM = { ...M, handle: paintPlain };
  for (const s of [1, -1]) for (const x of [0.0, -15.2]) { const h = prS(s)(x, ySh(x) + 0.65, 0.05); if (h) doorHandle(car, handleM, h, 2.1); }
  for (const s of [1, -1]) {
    const b = prS(s)(11.6, 14.0, 0); const base = b ? b.p : V3(11.6, 14.0, s * 11.6);
    sideMirror(car, M, s, { at: [10.2, 15.0, 13.0], size: [1.25, 1.05, 1.95], base, stalkTo: [10.8, 14.5, 11.7] });
  }
  // third brake light at the top of the hatch glass
  { const prG = P('topgh', ghOnly, FR.top), pts = [];
    for (let z = -9.2; z <= 9.21; z += 0.8) { const h = prG(BL_TOP + 0.3, z, 0); if (h) pts.push(h.p); }
    if (pts.length > 4) {
      const sh = new THREE.Shape(); sh.moveTo(1.2, -0.1); sh.lineTo(0.8, 0.35); sh.lineTo(-1.3, 0.2); sh.lineTo(-1.6, -0.25); sh.lineTo(-0.8, -0.4); sh.closePath();
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
    const w0 = prG(-27.4, 0.6, 0.25), w1 = prG(-25.2, -5.5, 0.25);
    if (w0 && w1) { const tg = new THREE.TubeGeometry(new THREE.LineCurve3(w0.p, w1.p), 4, 0.12, 5); car.add(new THREE.Mesh(tg, satinBlack)); }
    // front wipers
    for (const [z0, z1] of [[-9.4, 0.2], [-0.2, 8.4]]) {
      const ws = [];
      for (let k = 0; k <= 2; k++) { const z = lerp(z0, z1, k / 2), x = seam(z) - 0.7 - k * 0.5; const h = prG(x, z, 0.28); if (h) ws.push(h.p); }
      if (ws.length > 2) car.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ws), 12, 0.13, 5), satinBlack));
    }
  }
  // short roof antenna
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.0, 6), satinBlack); m.position.set(-19.2, 22.3, 0); m.rotation.z = 0.55; car.add(m);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 0.45, 12), satinBlack); b.position.set(-18.5, 21.25, 0); car.add(b); }
  // plates: front on the grille, rear in the bumper recess
  const plateM = plateTex ? plateTex('JOP2H16') : new THREE.MeshStandardMaterial({ color: 0xf4f6f8 });
  for (const [pr, y] of [[prF, 6.6], [prR, 8.62]]) {
    const h = pr(0, y, 0.25); if (!h) continue;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.95), plateM); pl.position.copy(h.p); pl.lookAt(h.p.clone().add(h.n)); car.add(pl);
  }
  wheelWells(car, M, AX, WR, ARCH, 23.0, { len: 54, w: 20 });

  /* ── wheels: 185/60 R15, silver 5 twin-spoke ── */
  const wheel = alloyWheels({ TW: 2.8, RIM: 2.86, R: WR, rimColor: 0xa9b0b8, faceColor: 0xdfe4ea, nuts: 4, spokes: { n: 5, split: 0.21, w0: 0.27, w1: 0.24 } });
  const wheels = [];
  for (const [i, x] of AX.entries()) for (const s of [1, -1]) { const w = wheel(i === 0, s); w.position.set(x, WR, s * TRACK); car.add(w); wheels.push(w); }

  if (studio && studioShadow) studioShadowPlane(car, studioShadow, 74, 36);
  car.userData = { wheels, tails, tail: tails[0] };
  return car;
}
