/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — Cruze sedan (2016/2017, branco) em 3D detalhado
   Escala: ~15 unidades por metro · frente = +X · chão em y = 0 · direita = +Z

   Como é feito:
   • Carroceria e "greenhouse" (vidros/teto) são lofts: seções transversais
     ao longo de X, cada uma uma curva suave (Catmull-Rom) por pontos de
     controle — soleira, vinco inferior, ombro, linha de cintura, capô/tampa.
     As pontas varrem pra trás na vista de cima (cantos arredondados) e os
     arcos de roda são recortados de verdade.
   • Para-brisa e vigia fazem parte da própria malha do teto (bordas lisas).
   • Faróis, lanternas, grades, frisos, vincos de porta… são "decalques"
     projetados na superfície real (raios num grid 2D acelerado), com a
     normal suavizada da carroceria — ficam colados e com reflexo certo.
   Sem logotipos/emblemas; placa fictícia.
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { V3, clamp, ss, lerp, mono, crSection, loft, frameFrom, FR, roundPoly, carMaterials, decalKit, to2, ellipse } from './kit.js';

export function buildCruze({ studio = false, tailOff, head, plateTex, studioShadow } = {}) {
  const car = new THREE.Group();

  /* ── materials ── */
  const M = carMaterials({ tailOff, head });
  const { paint, paintPlain, glass, frit, pianoBlack, satinBlack, plasticTex, chrome, gap, under, lensClear, housing, reflector, drl, projGlass, redLens, redDeep, tailGlow } = M;
  const reverseM = M.reverse, honeyM = M.honey, grainM = M.grain;

  /* ── key dimensions (photos of the actual car, 4.67 m long) ── */
  const XF = 35.2, XR = -35.0;
  const AX = [20.8, -20.6];               // wheel centres
  const WR = 4.85;                        // tyre radius (215/50 R17)
  const ARCH = 5.85;                      // wheel-arch opening radius
  const TRACK = 11.6;                     // wheel centre |z|

  // centre-line profile of the body (hood, cowl, deck)
  const yTop = mono([[XF, 7.7], [35.0, 9.2], [34.75, 10.4], [34.25, 11.45], [33.5, 12.15], [32.2, 12.6], [27, 13.4], [22, 14.15], [18.5, 14.75],
    [16.5, 15.0], [14.8, 14.95], [0, 15.95], [-15, 17.1], [-22.2, 17.95], [-26.5, 18.1], [-28.6, 18.38], [-30, 18.48], [-33.0, 18.25], [-33.7, 18.05],
    [-34.25, 17.45], [-34.6, 15.8], [-34.8, 13.0], [-34.95, 10.6], [XR, 9.6]]);
  // body side top edge (fender top / window sill / deck edge)
  const yBelt0 = mono([[XF, 7.7], [35.0, 9.0], [34.6, 10.3], [33.8, 11.3], [32.5, 11.9], [30, 12.2], [22, 13.35], [17, 14.05], [14.8, 14.35],
    [0, 15.45], [-15, 16.6], [-22.2, 17.45], [-26.5, 18.1], [-30, 18.05], [-33.2, 17.75], [-33.9, 17.4], [-34.4, 16.4], [-34.75, 13.5], [-34.95, 10.6], [XR, 9.6]]);
  const yBelt = x => Math.min(yBelt0(x), yTop(x));
  // underside / bumper bottoms
  const yBot0 = mono([[XF, 7.7], [35.15, 6.4], [34.95, 4.6], [34.5, 3.15], [33, 2.75], [28, 2.55], [-28, 2.6], [-33, 3.1], [-34.3, 3.75], [-34.85, 5.0], [-34.98, 7.5], [XR, 9.6]]);
  const yBot = x => Math.min(yBot0(x), yBelt(x));
  // shoulder line (widest point): low at the headlight, rising into the tail lamp
  const ySh = x => x > 30 ? lerp(11.0, 10.2, ss(30, 34.5, x)) : x < -31 ? 14.9 : lerp(14.9, 11.0, (x + 31) / 61);
  // lower door crease, rising rearwards
  const yLc = x => 6.6 + (13 - clamp(x, -15, 15)) * 0.15;
  const creaseA = x => ss(-16.5, -11.5, x) * (1 - ss(12, 16.5, x));
  // plan view: ends narrow a little + corners sweep back
  const pf = x => x > 24 ? 1 - 0.07 * Math.pow(clamp((x - 24) / 11.2, 0, 1), 2) : x < -27 ? 1 - 0.045 * Math.pow(clamp((-27 - x) / 8, 0, 1), 2) : 1;
  const flare = x => Math.max(...AX.map(a => Math.exp(-Math.pow((x - a) / 6.8, 2))));
  const wSh = x => 13.5 * pf(x) + 0.28 * flare(x);
  const wBelt = x => pf(x) * (12.15 - 0.35 * ss(16, 33.5, x) - 0.25 * ss(-27, -34.5, x));
  const sweepF = x => 4.0 * ss(22, XF, x), sweepR = x => 3.0 * ss(-25, XR, x);

  function bodyHalf(x) {
    const yb = yBot(x), yt = yTop(x), yB = yBelt(x);
    const ws = wSh(x), wb = wBelt(x), p = pf(x), fl = flare(x), A = creaseA(x);
    const wRock = 12.75 * p + 0.22 * fl, wU = 10.9 * p;
    const ys = Math.min(ySh(x), yB - 0.8), yc = yLc(x);
    const yRk = yb + 1.4;
    const lin = y => lerp(wRock, ws, clamp((y - yRk) / Math.max(0.01, ys - yRk), 0, 1));
    let C = [
      [yb, 0], [yb, wU], [yb + 0.45, wRock - 0.28], [yRk, wRock],
      [yc - 0.4, lin(yc - 0.4) + 0.2 * A], [yc + 0.55, lin(yc + 0.55) - 0.12 * A],
      [ys - 0.12, ws], [ys + 0.3, ws - 0.2], [yB - 0.28, wb + 0.12], [yB, wb - 0.18],
      [yB + (yt - yB) * 0.72, wb * 0.6], [yt, 0],
    ];
    // keep heights ordered and inside [yb, yt] (the ends collapse to a line)
    for (let i = 1; i < C.length; i++) C[i][0] = Math.max(C[i][0], C[i - 1][0]);
    C[C.length - 1][0] = yt;
    for (let i = C.length - 2; i >= 0; i--) C[i][0] = Math.min(C[i][0], C[i + 1][0]);
    C[0][0] = Math.min(C[0][0], yb);
    return crSection(C, [4, 2, 2, 3, 3, 4, 2, 3, 2, 5, 7]);
  }
  const archY = x => { let y = -1; for (const a of AX) { const d = x - a; if (Math.abs(d) < ARCH) y = Math.max(y, WR + Math.sqrt(ARCH * ARCH - d * d)); } return y; };
  const bodyPost = v => {
    const k = Math.pow(v.z / 13.5, 2);
    v.x -= sweepF(v.x) * k; v.x += sweepR(v.x) * k;
    v.z *= 1 - 0.09 * ss(27, XF, v.x) * ss(10, 3, v.y) - 0.07 * ss(-27, XR, v.x) * ss(11, 4, v.y);   // bumpers tuck in at the bottom
    return v;
  };

  // stations: dense at the ends and around the wheel arches
  const st = new Set();
  const NX = 200;
  for (let i = 0; i <= NX; i++) { const t = i / NX; st.add(+((XF + XR) / 2 + (XF - XR) / 2 * Math.cos(Math.PI * t)).toFixed(4)); }
  for (const a of AX) for (let d = -ARCH - 0.6; d <= ARCH + 0.6; d += 0.25) st.add(+(a + d).toFixed(4));
  for (const a of AX) for (const d of [-ARCH, ARCH]) st.add(+(a + d).toFixed(4));
  const stations = [];
  for (const x of [...st].sort((a, b) => b - a)) if (!stations.length || stations[stations.length - 1] - x > 0.09 || Math.abs(Math.abs(x - AX[0]) - ARCH) < 1e-3 || Math.abs(Math.abs(x - AX[1]) - ARCH) < 1e-3) stations.push(x);
  if (stations[stations.length - 1] !== XR) { if (stations[stations.length - 1] - XR < 0.05) stations.pop(); stations.push(XR); }
  // the very ends must keep their fine spacing (the nose/tail close up there)
  for (const x of [...st]) if ((x > XF - 0.5 || x < XR + 0.5) && !stations.includes(x)) stations.push(x);
  stations.sort((a, b) => b - a);
  const bodyGeo = loft(stations, bodyHalf, bodyPost, () => 0, 1);
  { const p = bodyGeo.attributes.position, col = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); let y = p.getY(i);
      // wheel arches are cut AFTER the normals were computed, so the fender keeps clean shading
      const ay = archY(x); let clipped = false;
      if (y < ay) { y = ay; p.setY(i, y); clipped = true; }
      let ao = 1 - 0.32 * ss(6.5, 2.4, y);
      for (const a of AX) { const d = Math.hypot(x - a, y - WR); ao *= 1 - 0.28 * ss(ARCH + 1.6, ARCH, d); }
      col.push(ao, ao, ao);
    }
    bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  const body = new THREE.Mesh(bodyGeo, paint);
  car.add(body);

  /* ── greenhouse ── */
  const dloTop = mono([[15.4, 14.42], [3.4, 20.22], [0, 20.62], [-5, 20.72], [-10, 20.47], [-14, 20.02], [-18, 19.25], [-20.5, 18.5], [-22.7, 17.6]]);
  const dloBot = x => yBelt(x) + 0.12;
  const XA = 15.4, XQ = -22.7;
  const inDLO = (x, y, m = 0) => x < XA - m && x > XQ + m && y > dloBot(x) + m && y < dloTop(x) - m;
  const GF = 18.9, GR = -29.4;                         // where the windshield / backlight dive under the body
  const WS_TOP = 4.5, BL_TOP = -13.0, BL_BASE = -28.4;
  const yRC = mono([[GF, 14.35], [11, 17.95], [WS_TOP, 21.15], [2, 21.65], [-1, 21.92], [-5, 21.9], [-9, 21.62], [BL_TOP, 21.1], [-20, 19.95], [-24, 19.25], [-27, 18.75], [BL_BASE, 18.5], [GR, 18.1]]);
  const yRE0 = mono([[GF, 14.0], [16.0, 14.5], [15.2, 14.75], [3.4, 20.55], [0, 20.98], [-5, 21.08], [-10, 20.82], [-14, 20.38], [-20, 19.4], [-24, 18.75], [-27, 18.4], [-28.6, 18.15], [GR, 18.0]]);
  const yB_G = x => yBelt(x) - 0.06;
  const yRE = x => clamp(yRE0(x), yB_G(x), yRC(x) - 0.12);
  const wB_G = x => wBelt(x) - 0.14;
  const LEAN = 0.48;
  const wE = x => wB_G(x) - LEAN * (yRE(x) - yB_G(x));
  // greenhouse half-section; index ranges used for the material groups
  const GCNT = [2, 8, 8, 3, 5, 8];
  const G_IDX = []; { let s = 0; for (const c of GCNT) { G_IDX.push(s); s += c; } G_IDX.push(s); }   // control point → sample index
  function ghHalf(x) {
    const yb = yB_G(x), yr = yRE(x), yc = Math.max(yRC(x), yr + 0.1), wb = wB_G(x), we = wE(x);
    const hh = yr - yb;
    const C = [[yb, 0], [yb, wb], [yb + hh * 0.5, wb - LEAN * hh * 0.5 + 0.1], [yr - 0.25, we + 0.06], [yr + 0.12, we - 0.32],
      [yr + 0.3 + (yc - yr) * 0.55, we * 0.7], [yc, 0]];
    for (let i = 1; i < C.length; i++) C[i][0] = Math.max(C[i][0], C[i - 1][0]);
    return crSection(C, GCNT);
  }
  const ghPost = v => {
    const k = Math.pow(v.z / 12.4, 2);
    v.x -= 2.3 * ss(5, GF, v.x) * k;          // windshield wraps back at the A-pillars
    v.x += 1.9 * ss(-14, GR, v.x) * k;        // backlight wraps forward at the C-pillars
    return v;
  };
  const gst = new Set();
  const keep = [GF, GR, WS_TOP, WS_TOP + 0.45, BL_TOP, BL_TOP - 0.5];
  const NG = Math.round((GF - GR) / 0.2);
  for (let i = 0; i <= NG; i++) { const x = GF - (GF - GR) * i / NG; if (keep.every(k => Math.abs(k - x) > 0.08)) gst.add(+x.toFixed(4)); }
  for (const k of keep) gst.add(k);
  const gStations = [...gst].sort((a, b) => b - a);
  // groups: 0 paint, 1 glass, 2 frit (black ceramic band)
  const gGroup = (i, j, x0, x1, cx, cy, cz) => {
    const xm = (x0 + x1) / 2;
    if (j < G_IDX[3] + 2 && inDLO(cx, cy, 0.04)) return 1;          // side windows: real see-through glass
    if (xm > WS_TOP && xm < GF) {                                  // windshield: everything above the A-pillar edge
      if (j >= G_IDX[4] + 2) return xm < WS_TOP + 0.45 || j < G_IDX[4] + 3 ? 2 : 1;
      return 0;
    }
    if (xm < BL_TOP && xm > GR) {                                  // backlight: narrower, broad C-pillars
      if (j >= G_IDX[4] + 3) return xm > BL_TOP - 0.5 || j < G_IDX[4] + 4 ? 2 : 1;
      return 0;
    }
    return 0;
  };
  const ghGeo = loft(gStations, ghHalf, ghPost, gGroup, 3);
  ghGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(ghGeo.attributes.position.count * 3).fill(1), 3));
  const gh = new THREE.Mesh(ghGeo, [paint, glass, frit]);
  gh.renderOrder = 3;
  car.add(gh);
  // headliner / pillar insides (back faces of the paint + frit only)
  const liner = new THREE.MeshStandardMaterial({ color: 0x5a5852, roughness: 0.95, side: THREE.BackSide });
  const none = new THREE.MeshBasicMaterial({ visible: false });
  car.add(new THREE.Mesh(ghGeo, [liner, none, liner]));

  /* ── interior (seen through the glass) ── */
  {
    const trimI = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.8 });
    const tub = new THREE.MeshStandardMaterial({ color: 0x0f1012, roughness: 0.95, side: THREE.BackSide });
    const seatM = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.7 });
    const stitch = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.6 });
    const add = (geo, m, x, y, z, rz = 0, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(0, ry, rz); car.add(o); return o; };
    add(new THREE.BoxGeometry(40.5, 11.2, 22.6), tub, -4.2, 9.4, 0);                       // cabin tub (doors, floor, firewall)
    // dashboard: main body, instrument binnacle, centre screen
    add(new THREE.BoxGeometry(6.5, 2.6, 20.4), trimI, 12.6, 13.6, 0);
    add(new THREE.BoxGeometry(5.0, 0.8, 20.0), trimI, 11.8, 14.9, 0, -0.12);
    add(new THREE.BoxGeometry(2.4, 1.3, 5.4), trimI, 11.4, 15.9, -5.4);
    add(new THREE.BoxGeometry(0.2, 2.3, 3.6), new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.1, clearcoat: 1 }), 11.0, 15.4, 0, 0.25);
    add(new THREE.BoxGeometry(3.4, 4.0, 3.4), trimI, 8.6, 8.4, 0);                          // centre console
    add(new THREE.BoxGeometry(7.5, 1.6, 3.0), trimI, 3.5, 8.6, 0);
    // steering wheel (left-hand drive)
    const sw = new THREE.Group(); sw.position.set(9.6, 14.9, -5.4); sw.rotation.z = -0.5;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.24, 10, 32), seatM); ring.rotation.y = Math.PI / 2; sw.add(ring);
    const hubS = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 16), seatM); hubS.rotation.z = Math.PI / 2; sw.add(hubS);
    for (const a of [0, 2.2, -2.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.35), seatM); sp.position.set(0, Math.cos(a) * -0.8, Math.sin(a) * 0.8); sp.rotation.x = a; sw.add(sp); }
    car.add(sw);
    add(new THREE.CylinderGeometry(0.3, 0.35, 3.2, 10), trimI, 11.0, 14.2, -5.4, Math.PI / 2 - 0.5);
    // front seats
    for (const z of [-5.4, 5.4]) {
      add(new THREE.BoxGeometry(4.6, 1.6, 4.6), seatM, 3.0, 7.0, z);
      const back = new THREE.Group(); back.position.set(0.6, 7.6, z); back.rotation.z = 0.24; car.add(back);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 7.4, 4.6), seatM); bk.position.y = 3.7; back.add(bk);
      for (const dz of [-1.7, 1.7]) { const bol = new THREE.Mesh(new THREE.BoxGeometry(1.7, 6.4, 0.8), stitch); bol.position.set(0.2, 3.4, dz); back.add(bol); }
      const hr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 3.0), seatM); hr.position.set(-0.1, 8.5, 0); back.add(hr);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 1.6), chrome); post.position.set(0, 7.5, 0); back.add(post);
    }
    // rear bench + parcel shelf
    add(new THREE.BoxGeometry(4.8, 1.6, 19.6), seatM, -11.2, 7.3, 0);
    const rb = new THREE.Group(); rb.position.set(-13.6, 7.9, 0); rb.rotation.z = 0.3; car.add(rb);
    const rbk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.0, 19.6), seatM); rbk.position.y = 3.5; rb.add(rbk);
    for (const z of [-6.2, 0, 6.2]) { const hr = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 2.8), seatM); hr.position.set(-0.2, 7.7, z); rb.add(hr); }
    add(new THREE.BoxGeometry(6.5, 0.4, 21.5), trimI, -20.6, 16.4, 0, 0.12);
  }

  /* ── decals ── */
  const { P, decal, line, flush } = decalKit(car);

  const bodyOnly = [body], ghOnly = [gh];
  const prF = P('front', bodyOnly, FR.front), prR = P('rear', bodyOnly, FR.rear), prT = P('top', bodyOnly, FR.top);
  const side = s => s > 0 ? FR.right : FR.left;
  const prS = s => P('side' + s, bodyOnly, side(s));
  const prGS = s => P('gside' + s, ghOnly, side(s));

  /* front fascia ------------------------------------------------------ */
  // upper grille slot under the hood's V, with the chrome bar running into the lamps
  decal(prF, FR.front, [[-7.0, 9.7], [7.0, 9.7], [6.9, 10.95], [3.4, 10.75], [0, 10.45], [-3.4, 10.75], [-6.9, 10.95]], honeyM, 0.05, { uvScale: 0.9 });
  decal(prF, FR.front, roundPoly([[-7.7, 9.55], [7.7, 9.55], [7.4, 9.98], [-7.4, 9.98]], 0.15), chrome, 0.12, { nv: 2 });
  line(prF, [[-6.9, 10.98], [-3.4, 10.78], [0, 10.48], [3.4, 10.78], [6.9, 10.98]], 0.12, chrome, 0.1);
  // lower grille: trapezoid, chrome surround, three chrome slats
  const lg = [[-7.5, 4.05], [7.5, 4.05], [8.95, 7.85], [-8.95, 7.85]];
  decal(prF, FR.front, roundPoly([[-7.85, 3.8], [7.85, 3.8], [9.3, 8.1], [-9.3, 8.1]], 0.5), chrome, 0.05, { nv: 6 });
  decal(prF, FR.front, roundPoly(lg, 0.4), honeyM, 0.08, { uvScale: 0.9, nv: 6 });
  for (const y of [5.05, 6.05, 7.05]) { const w = lerp(7.5, 8.95, (y - 4.05) / 3.8) - 0.25; decal(prF, FR.front, roundPoly([[-w, y - 0.13], [w, y - 0.13], [w, y + 0.13], [-w, y + 0.13]], 0.1), chrome, 0.14, { nv: 1 }); }
  // chin / lower lip
  decal(prF, FR.front, [[-10.5, 2.95], [10.5, 2.95], [10.8, 3.55], [-10.8, 3.55]], grainM, 0.06, { nv: 2, uvScale: 1 });
  // fog lamp bezels + lamps (seen a bit from the side: oblique projection)
  for (const s of [1, -1]) {
    const F = frameFrom(V3(-1, 0, -0.55 * s)), pr = P('fogF' + s, bodyOnly, F);
    const bez = [[34.25, 4.3, 10.0], [34.2, 6.6, 10.1], [33.5, 6.9, 11.7], [32.7, 6.5, 12.6], [32.8, 4.5, 12.5], [33.7, 4.1, 11.4]].map(p => [p[0], p[1], p[2] * s]);
    decal(pr, F, roundPoly(to2(F, bez), 0.8), pianoBlack, 0.06, { nv: 6 });
    const c = to2(F, [[33.55, 5.35, 11.35 * s]])[0];
    decal(pr, F, ellipse(c[0], c[1], 0.95, 0.95), chrome, 0.1, { nv: 6 });
    decal(pr, F, ellipse(c[0], c[1], 0.72, 0.72), reflector, 0.13, { nv: 6 });
    decal(pr, F, ellipse(c[0], c[1], 0.36, 0.36), projGlass, 0.16, { nv: 4 });
  }
  // headlamps: swept, wrap round onto the fender
  for (const s of [1, -1]) {
    const F = frameFrom(V3(-1, -0.28, -0.78 * s)), pr = P('headF' + s, bodyOnly, F);
    const outline = [[34.4, 9.6, 7.1], [34.3, 10.55, 6.6], [33.6, 11.35, 8.6], [32.3, 12.05, 10.7], [30.5, 12.5, 12.3], [28.6, 12.55, 13.1],
      [28.2, 11.8, 13.3], [29.5, 11.05, 13.2], [31.6, 10.3, 12.4], [33.4, 9.55, 9.6]].map(p => [p[0], p[1], p[2] * s]);
    const o2 = to2(F, outline);
    decal(pr, F, roundPoly(o2, 0.35), housing, 0.05, { nv: 10, nu: 60 });
    const M3 = pts => to2(F, pts.map(p => [p[0], p[1], p[2] * s]));
    // big chrome reflector (outer part) with the projector, round low-beam cup inboard
    decal(pr, F, roundPoly(M3([[32.9, 10.0, 10.0], [32.5, 11.75, 10.7], [30.5, 12.25, 12.3], [28.9, 12.25, 13.0], [29.5, 11.25, 13.15], [31.4, 10.5, 12.35]]), 0.45), reflector, 0.08, { nv: 8 });
    for (const [c, r] of [[[30.9, 11.6, 12.0], 0.78], [[33.3, 10.25, 9.2], 0.55]]) {
      const pc = M3([c])[0];
      decal(pr, F, ellipse(pc[0], pc[1], r * 1.18, r * 1.08), housing, 0.1, { nv: 6 });
      decal(pr, F, ellipse(pc[0], pc[1], r, r * 0.92), chrome, 0.12, { nv: 6 });
      decal(pr, F, ellipse(pc[0], pc[1], r * 0.62, r * 0.58), projGlass, 0.15, { nv: 5 });
    }
    line(pr, M3([[34.25, 10.4, 6.9], [33.55, 11.15, 8.6], [32.3, 11.82, 10.7], [30.5, 12.27, 12.3], [28.8, 12.3, 13.05]]), 0.3, drl, 0.13);
    line(pr, M3([[34.3, 9.75, 7.4], [33.3, 9.75, 9.6], [31.5, 10.5, 12.3]]), 0.14, chrome, 0.12);
    decal(pr, F, roundPoly(o2, 0.35), lensClear, 0.2, { nv: 10, nu: 60 });
  }

  /* rear ------------------------------------------------------------- */
  const tails = [];
  for (const s of [1, -1]) {
    const F = frameFrom(V3(1, -0.12, -0.85 * s)), pr = P('tailF' + s, bodyOnly, F);
    const outline = [[-34.5, 15.75, 7.2], [-34.55, 14.55, 7.2], [-34.75, 13.55, 10.3], [-34.45, 13.15, 12.6], [-32.6, 13.4, 13.35], [-30.1, 14.45, 13.45],
      [-30.3, 15.3, 13.35], [-32.4, 15.9, 12.95], [-34.0, 16.05, 12.3], [-34.35, 15.95, 9.8]].map(p => [p[0], p[1], p[2] * s]);
    const o2 = to2(F, outline);
    decal(pr, F, roundPoly(o2, 0.3), redDeep, 0.05, { nv: 10, nu: 50 });
    // the lit "light pipe" following the top contour (switches to brake material)
    const pipe = [[-34.45, 15.35, 7.6], [-34.3, 15.6, 9.8], [-33.95, 15.6, 12.2], [-32.4, 15.45, 12.9], [-30.6, 14.85, 13.35]].map(p => [p[0], p[1], p[2] * s]);
    const tm = line(pr, to2(F, pipe), 0.42, tailGlow, 0.12, { separate: true }); if (tm) tails.push(tm);
    // red lens bands and the white reverse lamp on the fender part
    const band = [[-34.6, 14.4, 8.0], [-34.7, 13.75, 10.2], [-34.4, 13.45, 12.4], [-33.6, 13.6, 13.0], [-33.7, 14.5, 12.8], [-34.45, 14.85, 10.0]].map(p => [p[0], p[1], p[2] * s]);
    decal(pr, F, roundPoly(to2(F, band), 0.3), redLens, 0.1, { nv: 5 });
    const rev = [[-33.1, 13.75, 13.2], [-31.6, 14.05, 13.4], [-31.4, 14.6, 13.4], [-33.0, 14.75, 13.2]].map(p => [p[0], p[1], p[2] * s]);
    decal(pr, F, roundPoly(to2(F, rev), 0.25), reverseM, 0.11, { nv: 3 });
    decal(pr, F, roundPoly(o2, 0.3), lensClear, 0.18, { nv: 10, nu: 50 });
    // trunk-lid split across the lamp
    line(pr, to2(F, [[-34.5, 16.1, 9.75 * s], [-34.7, 13.3, 9.75 * s]]), 0.1, gap, 0.2);
  }
  // chrome strip across the boot lid between the lamps + badge blank
  decal(prR, FR.rear, roundPoly([[-7.25, 14.8], [7.25, 14.8], [7.25, 15.18], [-7.25, 15.18]], 0.15), chrome, 0.1, { nv: 2 });
  // plate recess
  { const rp = roundPoly([[-4.0, 11.75], [4.0, 11.75], [4.1, 14.35], [-4.1, 14.35]], 0.5); line(prR, [...rp, rp[0]], 0.1, gap); }
  // rear bumper: textured diffuser and the reflectors
  decal(prR, FR.rear, roundPoly([[-10.8, 3.7], [10.8, 3.7], [10.5, 4.6], [-10.5, 4.6]], 0.3), grainM, 0.06, { nv: 3, uvScale: 1 });
  for (const s of [1, -1]) {
    const F = frameFrom(V3(1, 0, -0.6 * s)), pr = P('reflR' + s, bodyOnly, F);
    decal(pr, F, roundPoly(to2(F, [[-34.3, 5.0, 11.9 * s], [-33.9, 5.3, 12.7 * s], [-33.9, 7.4, 12.75 * s], [-34.3, 7.0, 11.95 * s]]), 0.2), redLens, 0.08, { nv: 3 });
  }
  // trunk shut lines (rear face + deck)
  line(prR, [[-12.45, 13.3], [-12.4, 11.0], [-11.7, 10.45], [11.7, 10.45], [12.4, 11.0], [12.45, 13.3]], 0.1, gap);
  for (const s of [1, -1]) line(prT, [[-26.9, 11.75 * s], [-31, 11.8 * s], [-33.75, 11.6 * s]], 0.1, gap);
  line(prT, [[-26.85, -11.75], [-26.85, 11.75]], 0.1, gap);
  // hood shut lines (top) + cowl
  for (const s of [1, -1]) line(prT, [[17.1, 11.85 * s], [24, 11.7 * s], [30, 11.1 * s], [32.6, 10.1 * s]], 0.1, gap);
  line(prF, [[-12.6, 12.75], [-10.7, 12.2], [-8.6, 11.5], [-6.9, 11.1], [0, 10.62], [6.9, 11.1], [8.6, 11.5], [10.7, 12.2], [12.6, 12.75]], 0.1, gap, 0.04);
  const prTB = P('topBoth', [body, gh], FR.top);
  const seam = z => { for (let x = 21; x > 10; x -= 0.05) { const h = prTB(x, z, 0); if (h && h.mesh === 1) return x; } return 16; };
  const seamPts = []; for (let z = -11.2; z <= 11.21; z += 0.8) seamPts.push([seam(z), z]);
  decal(prT, FR.top, [...seamPts.map(([x, z]) => [x + 0.75, z]), ...seamPts.reverse().map(([x, z]) => [x - 0.3, z])].map(([x, z]) => [x, z]), plasticTex, 0.05, { nv: 6 });

  /* sides ------------------------------------------------------------ */
  // window line: black surround, glass panes, black B-pillar, chrome sill strip
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
    decal(pr, F, dloPoly(-1.65, -3.35, -0.1), pianoBlack, 0.06, { nu: 8, nv: 8 });       // B pillar
    decal(pr, F, dloPoly(-17.2, -18.0, -0.1), pianoBlack, 0.06, { nu: 6, nv: 8 });      // rear door / quarter glass divider
    // chrome strip along the window sill (a real little tube)
    const cp = [];
    for (let i = 0; i <= 40; i++) { const x = lerp(XA - 0.2, XQ + 0.3, i / 40), h = pr(x, dloBot(x) + 0.1, 0.1); if (h) cp.push(h.p); }
    if (cp.length > 4) { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp), 80, 0.14, 6); tg.scale(1, 1, 1); car.add(new THREE.Mesh(tg, chrome)); }
  }
  // door shut lines, fuel flap
  for (const s of [1, -1]) {
    const pr = prS(s);
    line(pr, [[14.1, dloBot(14.1) - 0.1], [14.05, 9], [13.95, 4.4]], 0.11, gap);                       // front door / fender
    line(pr, [[-2.5, dloBot(-2.5) - 0.1], [-2.45, 4.4]], 0.11, gap);                                   // B pillar
    const arc = []; for (let a = 42; a >= 0; a -= 6) { const r = (a * Math.PI) / 180; arc.push([AX[1] + Math.cos(r) * 7.0, WR + Math.sin(r) * 7.0]); }
    line(pr, [[-17.75, dloBot(-17.75) - 0.1], [-17.4, 14.5], [-16.4, 12.2], ...arc, [AX[1] + 7.0, 4.4]], 0.11, gap);
    line(pr, [[13.95, 4.45], [AX[1] + 7.0, 4.45]], 0.1, gap);                                           // door bottoms
    line(pr, [[XA + 0.2, dloBot(XA + 0.2) - 0.05], [-1.8, dloBot(-1.8) - 0.05]], 0.08, gap, 0.03);
  }
  line(prS(1), roundPoly([[-23.4, 13.2], [-20.5, 13.2], [-20.5, 15.4], [-23.4, 15.4]], 0.5).concat([[-23.4, 13.9]]), 0.09, gap);   // fuel door (right)
  // little black "sail" triangle at the mirror base + door handles
  for (const s of [1, -1]) {
    const pr = prS(s);
    decal(pr, side(s), [[14.0, dloBot(14) + 0.02], [15.6, dloBot(15.6) + 0.02], [14.0, dloBot(14) + 1.4]], pianoBlack, 0.08, { nv: 3 });
  }

  /* ── merge decals by material ── */
  flush([lensClear]);

  /* ── 3D parts ── */
  const hitS = (s, x, y, off = 0) => prS(s)(x, y, off);
  // door handles: chrome pull with a dark recess behind
  for (const s of [1, -1]) for (const x of [0.3, -14.9]) {
    const h = hitS(s, x, 14.25, 0.05); if (!h) continue;
    const g = new THREE.Group(); g.position.copy(h.p); g.lookAt(h.p.clone().add(h.n));
    const rec = new THREE.Mesh(new THREE.CircleGeometry(1, 20), satinBlack); rec.scale.set(1.55, 0.55, 1); g.add(rec);
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 2.3, 4, 10), chrome); bar.rotation.z = Math.PI / 2; bar.position.z = 0.22; bar.scale.set(1, 1, 0.75); g.add(bar);
    car.add(g);
  }
  // mirrors: body-colour cap on a black base that sits on the door's front corner
  for (const s of [1, -1]) {
    const base = hitS(s, 13.2, 15.0, 0) || { p: V3(13.2, 15.0, s * 12.7), n: V3(0, 0, s) };
    const g = new THREE.Group(); g.position.set(11.8, 15.7, s * 14.0);
    const capGeo = new THREE.SphereGeometry(1, 32, 20, 0, Math.PI);   // front half-shell
    capGeo.rotateY(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, paintPlain); cap.scale.set(1.35, 1.12, 2.1); g.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 40), satinBlack); rim.rotation.y = Math.PI / 2; rim.scale.set(1, 1.16, 2.02); g.add(rim);
    const mir = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshPhysicalMaterial({ color: 0x7d8894, metalness: 1, roughness: 0.03, envMapIntensity: 1.8 }));
    mir.rotation.y = -Math.PI / 2; mir.scale.set(1.95, 1.06, 1); mir.position.x = -0.04; g.add(mir);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), satinBlack); lower.scale.set(1.37, 1.13, 2.12); g.add(lower);
    // turn repeater on the outer edge
    g.rotation.y = s * 0.1;
    car.add(g);
    // tapered stalk from the door to the housing
    const A0 = base.p.clone(), A1 = V3(12.4, 15.2, s * 12.8);
    const st = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.8, A0.distanceTo(A1) + 0.6), satinBlack);
    st.position.copy(A0).lerp(A1, 0.5); st.rotation.y = s * 0.1; car.add(st);
  }
  // wipers resting on the cowl
  { const prG = P('topgh', ghOnly, FR.top);
    for (const [z0, z1] of [[-10.0, 0.4], [-0.2, 9.0]]) {
      const pts = [];
      for (let k = 0; k <= 2; k++) { const z = lerp(z0, z1, k / 2), x = seam(z) - 0.7 - k * 0.5; const h = prG(x, z, 0.28); if (h) pts.push(h.p); }
      if (pts.length > 2) { const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.13, 5); car.add(new THREE.Mesh(tg, satinBlack));
        const blade = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => p.clone().add(V3(-0.15, -0.12, 0)))), 24, 0.09, 4); car.add(new THREE.Mesh(blade, plasticTex)); }
    } }
  // roof antenna mast
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 0.5, 12), satinBlack); b.position.set(-14.2, 21.15, 0); car.add(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.4, 6), satinBlack); m.position.set(-15.3, 23.2, 0); m.rotation.z = 0.5; car.add(m); }
  // third brake light at the top of the backlight
  { const h = P('topgh', ghOnly, FR.top); const pts = []; for (const z of [-2.6, 2.6]) { const q = h(BL_TOP - 1.0, z, 0.05); if (q) pts.push(q.p); }
    if (pts.length === 2) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 5.2), redDeep); m.position.copy(pts[0]).lerp(pts[1], 0.5); car.add(m); } }
  // plates
  const plateM = plateTex ? plateTex('JOP2Z17') : new THREE.MeshStandardMaterial({ color: 0xf4f6f8 });
  for (const [pr, x, y] of [[prF, XF, 5.9], [prR, XR, 13.05]]) {
    const h = pr(0, y, 0.2); if (!h) continue;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 1.95), plateM); pl.position.copy(h.p); pl.lookAt(h.p.clone().add(h.n)); car.add(pl);
  }
  // wheel wells, underbody
  for (const a of AX) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(ARCH - 0.08, ARCH - 0.08, 24.8, 32, 1, true, Math.PI / 2, Math.PI), under);
    w.rotation.x = Math.PI / 2; w.position.set(a, WR, 0); car.add(w);
    for (const s of [1, -1]) { const d = new THREE.Mesh(new THREE.CircleGeometry(ARCH - 0.1, 32, 0, Math.PI), under); d.position.set(a, WR, s * 8.6); car.add(d); }
    for (const dx of [-1, 1]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(24.4, WR - 3.0), under); wl.rotation.y = Math.PI / 2; wl.position.set(a + dx * (ARCH - 0.08), (WR + 3.0) / 2, 0); car.add(wl); }
  }
  { const u = new THREE.Mesh(new THREE.PlaneGeometry(64, 22), under); u.rotation.x = Math.PI / 2; u.position.y = 2.7; car.add(u); }

  /* ── wheels: 215/50 R17, 10-spoke (5 split spokes), gunmetal with machined faces ── */
  const tyreM = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.88 });
  const rimM = new THREE.MeshPhysicalMaterial({ color: 0x6d737b, metalness: 0.85, roughness: 0.3, clearcoat: 0.6, envMapIntensity: 1.3 });
  const machined = new THREE.MeshStandardMaterial({ color: 0xc4cad1, metalness: 1, roughness: 0.22, envMapIntensity: 1.5 });
  const discM = new THREE.MeshStandardMaterial({ color: 0x4a4e54, metalness: 0.9, roughness: 0.5 });
  const caliperM = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.4, roughness: 0.5 });
  const TW = 3.2, RIM = 3.25;
  const tyreGeo = (() => {
    const p = [];
    const prof = [[RIM - 0.05, -1.35], [RIM + 0.25, -1.5], [3.9, -1.62], [4.45, -1.6], [4.72, -1.45], [4.84, -1.15], [4.86, -0.5], [4.86, 0.5], [4.84, 1.15], [4.72, 1.45], [4.45, 1.6], [3.9, 1.62], [RIM + 0.25, 1.5], [RIM - 0.05, 1.35]];
    for (const [r, z] of prof) p.push(new THREE.Vector2(r, z));
    const g = new THREE.LatheGeometry(p, 56); g.rotateX(Math.PI / 2); return g;
  })();
  const grooveGeo = (() => { const g = new THREE.CylinderGeometry(4.875, 4.875, 0.12, 56, 1, true); g.rotateX(Math.PI / 2); return g; })();
  const barrelGeo = (() => { const g = new THREE.CylinderGeometry(RIM - 0.1, RIM - 0.1, TW - 0.4, 40, 1, true); g.rotateX(Math.PI / 2); return g; })();
  const lipGeo = new THREE.TorusGeometry(RIM - 0.08, 0.13, 8, 48);
  // one split spoke = two slim arms that fan out from the hub toward the rim
  const armShape = (sgn) => {
    const sh = new THREE.Shape(), r0 = 1.05, r1 = RIM - 0.18, a0 = 0.0, a1 = 0.16 * sgn;
    const P2 = (r, a, w) => [r * Math.cos(a) - w * Math.sin(a), r * Math.sin(a) + w * Math.cos(a)];
    const pts = [P2(r0, a0, sgn > 0 ? 0.03 : -0.33), P2(r1, a1, -0.3), P2(r1, a1, 0.3), P2(r0, a0, sgn > 0 ? 0.33 : -0.03)];
    sh.moveTo(...pts[0]); for (const q of pts.slice(1)) sh.lineTo(...q); sh.closePath();
    return sh;
  };
  const dish = (g, z0) => { const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); pos.setZ(i, pos.getZ(i) + z0 - 0.42 * Math.pow(Math.max(0, (r - 0.9) / (RIM - 1.1)), 1.4)); } g.computeVertexNormals(); return g; };
  const spokeGeo = dish(new THREE.ExtrudeGeometry([armShape(1), armShape(-1)], { depth: 0.42, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 2, curveSegments: 2, steps: 6 }), 0);
  const spokeFaceGeo = dish(new THREE.ShapeGeometry([armShape(1), armShape(-1)], 1), 0.5);   // machined face on each arm
  function wheel(front, s) {
    const g = new THREE.Group(), spin = new THREE.Group();
    spin.add(new THREE.Mesh(tyreGeo, tyreM));
    for (const z of [-0.55, 0.55]) { const gr = new THREE.Mesh(grooveGeo, new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 1 })); gr.position.z = z; spin.add(gr); }
    spin.add(new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide })));
    const face = new THREE.Group(); face.position.z = s * (TW / 2 - 0.55); if (s < 0) face.rotation.y = Math.PI;
    const lip = new THREE.Mesh(lipGeo, machined); lip.position.z = 0.5; face.add(lip);
    const lip2 = new THREE.Mesh(new THREE.RingGeometry(RIM - 0.45, RIM - 0.05, 48), rimM); lip2.position.z = 0.42; face.add(lip2);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2;
      const sp = new THREE.Mesh(spokeGeo, rimM); sp.rotation.z = a; face.add(sp);
      const sf = new THREE.Mesh(spokeFaceGeo, machined); sf.rotation.z = a; face.add(sf);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 0.5, 30), rimM); hub.rotation.x = Math.PI / 2; hub.position.z = 0.3; face.add(hub);
    const capC = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.24, 30), rimM); capC.rotation.x = Math.PI / 2; capC.position.z = 0.6; face.add(capC);
    for (let k = 0; k < 5; k++) { const a = (k + 0.5) / 5 * Math.PI * 2; const n = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.25, 8), machined); n.rotation.x = Math.PI / 2; n.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.5); face.add(n); }
    spin.add(face);
    // brake disc (spins) + caliper (does not)
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.35, 40), discM); disc.rotation.x = Math.PI / 2; disc.position.z = s * 0.2; spin.add(disc);
    const back = new THREE.Mesh(new THREE.CircleGeometry(RIM - 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.9, side: THREE.DoubleSide })); back.position.z = -s * 0.6; spin.add(back);
    g.add(spin);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.0, 0.9), caliperM); cal.position.set(front ? -2.0 : 2.0, 1.0, s * 0.35); g.add(cal);
    g.userData.spin = spin; g.userData.front = front;
    return g;
  }
  const wheels = [];
  for (const [i, x] of AX.entries()) for (const s of [1, -1]) { const w = wheel(i === 0, s); w.position.set(x, WR, s * TRACK); car.add(w); wheels.push(w); }

  if (studio && studioShadow) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(88, 40), new THREE.MeshBasicMaterial({ map: studioShadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; car.add(sh);
  }
  car.userData = { wheels, tails, tail: tails[0] };
  return car;
}
