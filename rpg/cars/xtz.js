/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — Yamaha XTZ 250 Lander (azul/branca) em 3D detalhado
   Escala ~15 un/m (2,12 m → 31,8) · frente = +X · chão y = 0 · direita = +Z
   Roda 21" na frente e 18" atrás com raios e pneu de cravos, garfo com
   bengalas, discos "wave", carenagem do farol com piscas, tanque e abas
   azuis com faixa branca, banco longo preto, lateral branca, rabeta azul
   com bagageiro, motor monocilíndrico arrefecido a ar, escape à direita.
   Sem logotipos (só as cores).
   ════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildXTZ({ studio = false, tailOff, head, plateTex, studioShadow } = {}) {
  const bike = new THREE.Group();
  const phys = o => new THREE.MeshPhysicalMaterial(o), std = o => new THREE.MeshStandardMaterial(o);
  const blue = phys({ color: 0x1438c8, metalness: 0.25, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
  const white = phys({ color: 0xe8ebee, metalness: 0.0, roughness: 0.32, clearcoat: 0.8, envMapIntensity: 1.1 });
  const black = std({ color: 0x111317, roughness: 0.5, metalness: 0.3 });
  const gloss = phys({ color: 0x0b0c0e, roughness: 0.25, clearcoat: 0.6 });
  const seatM = std({ color: 0x131416, roughness: 0.85 });
  const steel = std({ color: 0xcfd5dc, roughness: 0.18, metalness: 1, envMapIntensity: 1.6 });
  const alu = std({ color: 0xb4bbc3, roughness: 0.35, metalness: 1, envMapIntensity: 1.3 });
  const engBlack = std({ color: 0x1a1c20, roughness: 0.55, metalness: 0.5 });
  const rubber = std({ color: 0x151618, roughness: 0.92 });
  const amber = phys({ color: 0xd07a10, roughness: 0.1, clearcoat: 1, emissive: 0x4a2400, emissiveIntensity: 0.7 });
  const lens = phys({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1, envMapIntensity: 2 });
  const headM = head || std({ color: 0xffffff, emissive: 0xfff1c6, emissiveIntensity: 2 });
  const tailM = tailOff || std({ color: 0x400000, emissive: 0xff2a2a, emissiveIntensity: 1.1 });

  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
  const tube = (a, b, r, m, seg = 10) => { const A = V3(...a), B = V3(...b); const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg), m); o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize()); return o; };
  const bent = (pts, r, m, seg = 40) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), seg, r, 8), m);
  // a side-profile panel, rounded and slightly domed outward
  const panel = (pts, depth, m, z = 0, bevel = 0.35, dome = 0) => {
    const sh = new THREE.Shape(); sh.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) sh.quadraticCurveTo(p[0], p[1], p[2], p[3]); else sh.lineTo(p[0], p[1]); }
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 4, curveSegments: 10, steps: 2 });
    g.translate(0, 0, -depth / 2);
    if (dome) { g.computeBoundingBox(); const bb = g.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, rx = (bb.max.x - bb.min.x) / 2, ry = (bb.max.y - bb.min.y) / 2;
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = Math.max(0, 1 - Math.pow((p.getX(i) - cx) / rx, 2) - Math.pow((p.getY(i) - cy) / ry, 2)); p.setZ(i, p.getZ(i) * (1 + dome * k)); } }
    g.computeVertexNormals();
    return mesh(g, m, 0, 0, z);
  };

  /* ── wheels: knobby tyre (lathe + staggered knobs), alloy rim, 36 spokes, wave disc ── */
  function wheel(front) {
    const R = front ? 5.2 : 4.78, RIM = front ? 3.55 : 3.05, W = front ? 1.2 : 1.5;
    const g = new THREE.Group(), spin = new THREE.Group();
    const prof = [[RIM + 0.05, -W * 0.45], [RIM + 0.4, -W * 0.62], [R - 0.75, -W * 0.68], [R - 0.3, -W * 0.55], [R - 0.06, -W * 0.3], [R, 0], [R - 0.06, W * 0.3], [R - 0.3, W * 0.55], [R - 0.75, W * 0.68], [RIM + 0.4, W * 0.62], [RIM + 0.05, W * 0.45]];
    const tg = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 64); tg.rotateX(Math.PI / 2);
    spin.add(new THREE.Mesh(tg, rubber));
    const knob = new THREE.BoxGeometry(0.42, 0.34, W * 0.42), knobS = new THREE.BoxGeometry(0.38, 0.3, W * 0.3);
    const N = front ? 40 : 36;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2;
      for (const [z, geo, dr] of i % 2 ? [[0, knob, 0.12]] : [[-W * 0.42, knobS, -0.05], [W * 0.42, knobS, -0.05]]) {
        const k = mesh(geo, rubber, Math.cos(a) * (R + dr - 0.02), Math.sin(a) * (R + dr - 0.02), z); k.rotation.z = a; spin.add(k);
      }
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM, 0.2, 8, 64), alu); rim.scale.z = W * 0.9; spin.add(rim);
    const rimIn = new THREE.Mesh(new THREE.CylinderGeometry(RIM - 0.18, RIM - 0.18, W * 0.75, 64, 1, true), std({ color: 0x8e959d, metalness: 1, roughness: 0.4, side: THREE.DoubleSide })); rimIn.rotation.x = Math.PI / 2; spin.add(rimIn);
    const hub = mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.8, 18), alu); hub.rotation.x = Math.PI / 2; spin.add(hub);
    for (const z of [-0.8, 0.8]) { const fl = mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 24), alu, 0, 0, z); fl.rotation.x = Math.PI / 2; spin.add(fl); }
    for (let i = 0; i < 36; i++) {                       // crossed spokes from both hub flanges
      const side = i % 2 ? 1 : -1, a0 = i / 36 * Math.PI * 2, a1 = a0 + side * 0.32 * (i % 4 < 2 ? 1 : -1);
      spin.add(tube([Math.cos(a0) * 0.95, Math.sin(a0) * 0.95, side * 0.8], [Math.cos(a1) * (RIM - 0.15), Math.sin(a1) * (RIM - 0.15), side * 0.12], 0.045, steel, 5));
    }
    // wave brake disc (front: left side, rear: right side)
    const dz = front ? -1.0 : 1.0, dr = front ? 2.45 : 2.0, ds = new THREE.Shape(), n = 24;
    for (let i = 0; i <= n * 4; i++) { const a = i / (n * 4) * Math.PI * 2, r = dr + 0.14 * Math.sin(a * n); i ? ds.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ds.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const hole = new THREE.Path(); hole.absarc(0, 0, dr - 0.55, 0, Math.PI * 2, true); ds.holes.push(hole);
    const disc = mesh(new THREE.ExtrudeGeometry(ds, { depth: 0.12, bevelEnabled: false }), std({ color: 0xa7adb4, metalness: 1, roughness: 0.32 }), 0, 0, dz - 0.06); spin.add(disc);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; spin.add(tube([Math.cos(a) * 0.9, Math.sin(a) * 0.9, dz], [Math.cos(a) * (dr - 0.5), Math.sin(a) * (dr - 0.5), dz], 0.14, black, 6)); }
    g.add(spin);
    const cal = mesh(new THREE.BoxGeometry(1.0, 1.7, 0.7), gloss, front ? -1.6 : 1.4, front ? 1.3 : -1.0, dz + Math.sign(dz) * 0.35); cal.rotation.z = front ? 0.6 : -0.5; g.add(cal);
    g.userData = { spin, front };
    return g;
  }
  const FA = [10.6, 5.2], RA = [-10.3, 4.78];
  const fw = wheel(true), rw = wheel(false);
  fw.position.set(FA[0], FA[1], 0); rw.position.set(RA[0], RA[1], 0);
  bike.add(fw, rw);

  /* ── front end: fork, clamps, bars, cowl + headlight, fender, signals ── */
  const HEAD = [7.05, 13.7];
  const fork = V3(HEAD[0] - FA[0], HEAD[1] - FA[1], 0).normalize();
  const along = t => [FA[0] + fork.x * t, FA[1] + fork.y * t];
  for (const z of [-1.25, 1.25]) {
    bike.add(tube([...along(0.2), z], [...along(4.6), z], 0.42, alu, 14));            // lower slider
    bike.add(tube([...along(4.4), z], [...along(9.9), z], 0.32, steel, 14));          // stanchion
    bike.add(tube([...along(5.2), z], [...along(7.4), z], 0.48, rubber, 14));         // dust boot
    bike.add(mesh(new THREE.SphereGeometry(0.45, 10, 8), alu, ...along(0.15), z));
  }
  bike.add(mesh(new THREE.BoxGeometry(1.4, 0.55, 3.4), alu, ...along(8.4), 0));       // lower clamp
  bike.add(mesh(new THREE.BoxGeometry(1.5, 0.5, 3.5), black, ...along(9.8), 0));       // top clamp
  // handlebar with grips, levers, mirrors
  const BAR = [HEAD[0] - 0.9, 16.0];
  bike.add(bent([[BAR[0] + 0.3, BAR[1] - 0.5, -5.6], [BAR[0] - 0.1, BAR[1] - 0.05, -4.2], [BAR[0] + 0.4, BAR[1] - 0.25, -1.0], [BAR[0] + 0.4, BAR[1] - 0.25, 1.0], [BAR[0] - 0.1, BAR[1] - 0.05, 4.2], [BAR[0] + 0.3, BAR[1] - 0.5, 5.6]], 0.17, black));
  bike.add(tube([...along(9.8), 0], [BAR[0] + 0.4, BAR[1] - 0.3, 0], 0.3, black));
  for (const s of [-1, 1]) {
    bike.add(tube([BAR[0] + 0.3, BAR[1] - 0.5, s * 4.6], [BAR[0] + 0.3, BAR[1] - 0.5, s * 6.2], 0.3, rubber));
    bike.add(tube([BAR[0] + 0.5, BAR[1] - 0.4, s * 3.6], [BAR[0] + 1.6, BAR[1] - 0.7, s * 6.0], 0.09, alu, 6));            // lever
    bike.add(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.9), black, BAR[0] + 0.2, BAR[1] - 0.3, s * 3.6));                      // switch / master cylinder
    bike.add(tube([BAR[0] + 0.1, BAR[1] - 0.1, s * 3.4], [BAR[0] - 0.4, BAR[1] + 2.3, s * 4.4], 0.08, black, 6));
    const mr = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 20), gloss, BAR[0] - 0.5, BAR[1] + 2.75, s * 4.6); mr.rotation.z = Math.PI / 2 - 0.15; bike.add(mr);
  }
  // instruments
  bike.add(mesh(new THREE.BoxGeometry(1.0, 1.0, 2.6), black, HEAD[0] + 0.1, 15.2, 0));
  // headlight cowl: blue sides, white top panel, clear lens with the lamp
  bike.add(panel([[9.6, 11.2], [10.1, 12.6], [10.0, 14.6, 9.0, 15.6], [7.9, 15.2], [7.5, 12.4], [8.4, 11.0]], 3.0, blue, 0, 0.4, 0.3));
  bike.add(panel([[9.9, 13.9], [9.7, 15.0, 8.9, 15.8], [8.0, 15.6], [8.6, 14.6]], 3.3, white, 0, 0.3));
  const hl = mesh(new THREE.SphereGeometry(1, 20, 14), headM, 9.75, 13.1, 0); hl.scale.set(0.45, 1.05, 1.0); bike.add(hl);
  const hlc = mesh(new THREE.SphereGeometry(1, 20, 14), lens, 9.85, 13.1, 0); hlc.scale.set(0.5, 1.2, 1.15); bike.add(hlc);
  for (const s of [-1, 1]) {                                                                // turn signals
    bike.add(tube([8.6, 13.6, s * 1.6], [8.9, 13.7, s * 3.0], 0.12, black, 6));
    const ts = mesh(new THREE.SphereGeometry(0.42, 12, 10), amber, 9.05, 13.75, s * 3.15); ts.scale.set(1.5, 0.9, 0.9); bike.add(ts);
  }
  // high front fender
  bike.add(panel([[15.6, 10.9], [15.2, 11.4, 13.4, 11.7], [10.6, 11.85], [7.6, 11.4], [7.4, 10.95], [10.6, 11.35], [13.6, 11.15, 15.4, 10.6]], 2.4, blue, 0, 0.3));

  /* ── frame, swingarm, engine ── */
  for (const z of [-1.4, 1.4]) {
    bike.add(bent([[6.7, 12.8, z * 0.4], [5.6, 9.0, z * 0.6], [3.6, 3.8, z], [1.0, 2.6, z], [-1.6, 3.6, z], [-1.8, 7.0, z]], 0.32, black));   // cradle
    bike.add(bent([[6.6, 13.2, z * 0.4], [3.0, 12.9, z * 0.9], [-1.4, 12.2, z], [-1.8, 7.0, z]], 0.36, black));                             // backbone
    bike.add(bent([[-1.4, 12.2, z], [-6.0, 12.6, z * 1.1], [-11.6, 13.0, z * 1.05]], 0.24, black));                                           // seat rail
    bike.add(tube([-1.8, 7.6, z], [-9.0, 12.6, z * 1.1], 0.22, black));                                                                       // sub-frame strut
    bike.add(tube([-1.6, 6.6, z * 1.45], [RA[0], RA[1], z * 1.45], 0.38, alu, 12));                                                           // swingarm
  }
  bike.add(tube([-2.4, 11.6, 0], [-4.4, 6.4, 0], 0.5, std({ color: 0xd2a04a, metalness: 0.6, roughness: 0.3 })));                             // shock spring
  bike.add(tube([-2.4, 11.6, 0], [-4.4, 6.4, 0], 0.28, black));
  // engine: crankcase, finned cylinder leaning forward, round side covers
  const eng = new THREE.Group(); bike.add(eng);
  eng.add(panel([[4.4, 4.2], [4.6, 7.2], [2.6, 8.6], [-1.2, 8.2], [-1.8, 5.2], [0.2, 3.6]], 4.0, engBlack, 0, 0.5));
  const cyl = new THREE.Group(); cyl.position.set(2.4, 8.0, 0); cyl.rotation.z = -0.32; eng.add(cyl);
  cyl.add(mesh(new THREE.BoxGeometry(2.8, 4.2, 2.8), engBlack, 0, 2.0, 0));
  for (let i = 0; i < 7; i++) cyl.add(mesh(new THREE.BoxGeometry(3.6, 0.16, 3.6), engBlack, 0, 0.6 + i * 0.5, 0));
  cyl.add(mesh(new THREE.BoxGeometry(3.0, 1.0, 3.0), alu, 0, 4.4, 0));
  const cc = mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.5, 28), alu, 0.6, 5.6, 2.25); cc.rotation.x = Math.PI / 2; eng.add(cc);           // clutch cover (right)
  const mc = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.45, 24), alu, 1.6, 5.0, -2.2); mc.rotation.x = Math.PI / 2; eng.add(mc);          // magneto cover (left)
  eng.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 3.4), alu, 3.4, 4.9, 0));
  // carb + airbox under the seat
  eng.add(mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), alu, -0.6, 10.0, 0));
  eng.add(mesh(new THREE.BoxGeometry(3.6, 2.6, 2.6), black, -3.8, 10.8, 0));
  // chain + sprockets (left side)
  const fsp = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 14), black, -0.3, 5.2, -2.3); fsp.rotation.x = Math.PI / 2; bike.add(fsp);
  const rsp = mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.2, 36), black, RA[0], RA[1], -1.95); rsp.rotation.x = Math.PI / 2; bike.add(rsp);
  bike.add(tube([-0.3, 5.95, -2.1], [RA[0], RA[1] + 2.3, -2.0], 0.12, gloss, 6));
  bike.add(tube([-0.3, 4.45, -2.1], [RA[0], RA[1] - 2.3, -2.0], 0.12, gloss, 6));

  /* ── bodywork: tank, shrouds with white graphic, seat, white side panel, tail ── */
  bike.add(panel([[6.6, 13.2], [6.2, 14.8, 4.2, 15.0], [1.6, 14.3], [0.8, 13.0], [2.4, 12.4], [5.6, 12.4]], 4.6, blue, 0, 0.6, 0.25));
  for (const s of [-1, 1]) {
    const z = s * 2.75;
    bike.add(panel([[8.0, 13.9], [6.4, 14.5], [3.8, 13.6], [2.0, 11.2], [2.8, 9.4], [4.6, 9.0], [6.6, 10.6]], 0.55, blue, z, 0.3, 0.2));
    bike.add(panel([[6.9, 12.2], [5.3, 13.4], [3.4, 12.9], [3.0, 12.0], [4.9, 11.6]], 0.25, white, s * 3.12, 0.12));
    bike.add(panel([[6.3, 11.7], [4.6, 12.5], [3.4, 11.7], [5.4, 11.3]], 0.2, gloss, s * 3.3, 0.08));
    bike.add(panel([[-1.0, 12.6], [-8.6, 12.9], [-9.4, 12.0], [-7.2, 10.2], [-1.8, 9.7]], 0.6, white, s * 2.25, 0.3, 0.2));
    bike.add(panel([[-3.0, 11.6], [-6.8, 11.9], [-7.2, 11.2], [-3.4, 10.9]], 0.2, blue, s * 2.62, 0.08));
  }
  bike.add(panel([[1.6, 13.4], [0.6, 14.4, -1.6, 14.0], [-11.2, 13.9], [-11.6, 13.2], [-1.0, 12.6]], 4.2, seatM, 0, 0.6, 0.15));
  bike.add(panel([[-8.4, 13.1], [-11.6, 13.9], [-15.6, 13.85], [-15.8, 13.1], [-11.6, 12.4], [-8.6, 12.2]], 3.0, blue, 0, 0.35, 0.15));
  // tail light, plate holder + plate, rear signals, rack
  const tl = mesh(new THREE.BoxGeometry(0.5, 0.7, 1.8), tailM, -15.85, 13.45, 0); bike.add(tl);
  bike.add(panel([[-15.2, 12.8], [-15.9, 12.9], [-16.6, 9.8], [-15.9, 9.6]], 1.6, black, 0, 0.15));
  if (plateTex) { const pl = mesh(new THREE.PlaneGeometry(1.95, 1.4), plateTex('JOP0X25'), -16.5, 10.6, 0); pl.rotation.y = -Math.PI / 2; pl.rotation.x = 0.0; pl.scale.x = 1; bike.add(pl); }
  for (const s of [-1, 1]) { bike.add(tube([-15.0, 12.3, s * 0.8], [-15.2, 12.2, s * 2.5], 0.1, black, 6)); const ts = mesh(new THREE.SphereGeometry(0.38, 12, 10), amber, -15.3, 12.2, s * 2.7); ts.scale.set(1.4, 0.9, 0.9); bike.add(ts); }
  bike.add(bent([[-8.6, 13.7, -2.3], [-14.6, 14.2, -2.1], [-14.9, 14.2, 0], [-14.6, 14.2, 2.1], [-8.6, 13.7, 2.3]], 0.17, black));
  for (const x of [-10.6, -12.6]) bike.add(tube([x, 14.1, -2.2], [x, 14.1, 2.2], 0.12, black, 6));

  /* ── exhaust (right): header, black muffler with a silver end and guard ── */
  bike.add(bent([[3.4, 10.3, 1.0], [4.6, 8.4, 1.6], [3.6, 4.6, 2.4], [0.0, 4.2, 2.8], [-3.2, 6.6, 3.0], [-5.4, 9.6, 3.0]], 0.38, steel, 50));
  const muf = mesh(new THREE.CylinderGeometry(1.05, 0.95, 7.2, 20), gloss); muf.position.set(-8.6, 11.1, 3.15); muf.rotation.z = Math.PI / 2 + 0.2; bike.add(muf);
  const endc = mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.8, 20), steel); endc.position.set(-12.3, 11.85, 3.15); endc.rotation.z = Math.PI / 2 + 0.2; bike.add(endc);
  bike.add(panel([[-5.6, 11.6], [-10.6, 12.6], [-10.8, 11.6], [-5.8, 10.6]], 0.15, alu, 4.25, 0.1));

  /* ── pegs, levers, side stand ── */
  for (const s of [-1, 1]) bike.add(tube([-0.6, 4.6, s * 2.2], [-0.8, 4.6, s * 4.2], 0.24, rubber, 8));
  bike.add(tube([0.2, 4.3, 3.6], [2.4, 4.8, 3.6], 0.14, black, 6));          // brake pedal
  bike.add(tube([0.2, 5.4, -3.4], [2.2, 5.0, -3.6], 0.14, black, 6));        // gear lever
  bike.add(tube([-0.6, 4.4, -2.2], [-1.4, 0.3, -4.6], 0.2, black, 8));      // side stand

  if (studio && studioShadow) { const sh = mesh(new THREE.PlaneGeometry(42, 16), new THREE.MeshBasicMaterial({ map: studioShadow, transparent: true, depthWrite: false }), 0, 0.05, 0); sh.rotation.x = -Math.PI / 2; bike.add(sh); }
  bike.userData = { wheels: [fw, rw], tails: [tl], tail: tl, moto: true };
  return bike;
}
