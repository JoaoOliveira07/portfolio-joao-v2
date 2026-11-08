/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — CITY ART
   The whole city (ground, roads, buildings, props, cars) is generated here
   as SVG, in an isometric line-art style inspired by iso-glow: dark fills,
   thin light strokes, one neon accent per zone. Nothing is a bitmap.

   Two coordinate systems:
     screen/map px  (x, y)   — what the game, camera and sprites use
     iso ground     (u, v)   — the city grid. +u runs down-right, +v down-left.
   S(u,v) / I(x,y) convert between them (2:1 isometric).

   City.build() returns:
     zones    — one entry per interactive building (zone, x, y, labelY, els …)
     objects  — everything with height (buildings, trees, cars…): footprint
                for collision + occlusion, and its own DOM element
     cars     — drivable/traffic cars (also in objects), see makeCar/moveCar
     npcSpots — suggested NPC positions (map px), spawn — player start
     roads    — road centerlines (for the minimap)
   ════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const BLOCK = 520;   // iso units between road centerlines
const ROAD  = 128;   // road width (iso units)
const LANE  = 30;    // lane offset from the road centerline

const ZONE_COLORS = {
  main:'#FFE600', projects:'#FF3CAC', lab:'#2AFADF',
  about:'#9B7BFF', stack:'#00FF88', contact:'#FF8C00', secret:'#ff3333', garage:'#4DA3FF',
};
const CAR_COLORS = ['#2AFADF', '#FF3CAC', '#9B7BFF', '#FF8C00', '#8cc8ff', '#00FF88'];

// Which city block (i, j) holds which zone. Block centre = ((i+.5)B, (j+.5)B).
const ZONE_BLOCKS = {
  projects:[0,2], main:[1,1], lab:[2,0],
  about:[2,3], contact:[3,1], stack:[3,3], secret:[5,3], garage:[1,2],
};
const PLAZA_BLOCK = [2,2];
const FIELD_BLOCK = [4,2];   // football pitch (just to look at)
// airport: two blocks on the south edge, one runway across both (and the road between them)
const AIRPORT_BLOCKS = [[3,5],[4,5]];
const RUNWAY = { u0: 3 * BLOCK + 70, u1: 5 * BLOCK - 70, v: 5.5 * BLOCK + 70, w: 62 };

/* ── tiny deterministic RNG so the city looks the same on every load ── */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const f1 = n => (Math.round(n * 10) / 10);

/* ════════════════════════════════════════════════════════════════════
   SHAPE BUILDER — draws in a local iso frame whose origin is the
   object's ground centre, and tracks the bounding box as it goes.
   ════════════════════════════════════════════════════════════════════ */
class Shape {
  constructor() { this.out = []; this.fxOut = []; this.fxDepth = 0; this.minx = 1e9; this.miny = 1e9; this.maxx = -1e9; this.maxy = -1e9; }
  emit(str) { this.out.push(str); if (this.fxDepth) this.fxOut.push(str); }
  // fx(): what's drawn inside stays as an animated SVG layer on top of the 3D render
  fx(fn) { this.fxDepth++; fn(); this.fxDepth--; }
  B(x, y) {
    if (x < this.minx) this.minx = x; if (x > this.maxx) this.maxx = x;
    if (y < this.miny) this.miny = y; if (y > this.maxy) this.maxy = y;
  }
  P(u, v, h = 0) { const x = u - v, y = (u + v) / 2 - h; this.B(x, y); return [x, y]; }
  pts(list) { return list.map(p => f1(p[0]) + ',' + f1(p[1])).join(' '); }
  poly(list, cls, extra = '') { this.emit(`<polygon class="${cls}" points="${this.pts(list)}" ${extra}/>`); }
  line(a, b, cls, extra = '') { this.emit(`<line class="${cls}" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" ${extra}/>`); }
  pline(list, cls) { this.emit(`<polyline class="${cls}" points="${this.pts(list)}"/>`); }
  raw(s) { this.emit(s); }
  open(s) { this.emit(s); }
  close(s = '</g>') { this.emit(s); }

  // Axis-aligned box: footprint centred at (u,v), half-extents a×b, from h0 to h1.
  box(u, v, a, b, h0, h1, o = {}) {
    const P = (uu, vv, hh) => this.P(uu, vv, hh), c = o.cls || '';
    // vertical edges are chamfered by k — softer, less "cardboard box" silhouette
    const k = o.cham ?? Math.min(6, a / 6, b / 6);
    this.poly([P(u - a + k, v + b, h0), P(u + a - k, v + b, h0), P(u + a - k, v + b, h1), P(u - a + k, v + b, h1)], 'fl ' + c);
    if (k > 0) this.poly([P(u + a - k, v + b, h0), P(u + a, v + b - k, h0), P(u + a, v + b - k, h1), P(u + a - k, v + b, h1)], 'fc ' + c);
    this.poly([P(u + a, v + b - k, h0), P(u + a, v - b + k, h0), P(u + a, v - b + k, h1), P(u + a, v + b - k, h1)], 'fr ' + c);
    const oct = (A, Bb, K, h) => [P(u - A + K, v - Bb, h), P(u + A - K, v - Bb, h), P(u + A, v - Bb + K, h), P(u + A, v + Bb - K, h),
                                  P(u + A - K, v + Bb, h), P(u - A + K, v + Bb, h), P(u - A, v + Bb - K, h), P(u - A, v - Bb + K, h)];
    if (!o.noTop) {
      this.poly(oct(a, b, k, h1), 'ft ' + c);
      if (o.lip ?? (a > 30 && b > 30 && h1 - h0 > 24)) this.poly(oct(a - 5, b - 5, Math.max(0, k - 2), h1), 'lip');
    }
    if (o.stripe) for (let h = h0 + o.stripe; h < h1 - 2; h += o.stripe) {
      this.line(P(u - a + k, v + b, h), P(u + a - k, v + b, h), 'hatch');
      this.line(P(u + a, v + b - k, h), P(u + a, v - b + k, h), 'hatch');
    }
    if (o.ribs) { // vertical corrugation (containers)
      for (let t = -a + o.ribs; t < a - k; t += o.ribs) this.line(P(u + t, v + b, h0 + 2), P(u + t, v + b, h1 - 2), 'hatch');
      for (let t = -b + k + o.ribs; t < b; t += o.ribs) this.line(P(u + a, v + t, h0 + 2), P(u + a, v + t, h1 - 2), 'hatch');
    }
  }

  // Frustum rotated by theta: bottom rect (centre x0 along heading, hl0×hw0) to a
  // smaller top rect (x1, hl1×hw1) — car cabins with sloped windshields.
  rfrustum(x0, hl0, hw0, x1, hl1, hw1, h0, h1, theta, cls = '') {
    const c = Math.cos(theta), sn = Math.sin(theta);
    const R = (x, y) => [x * c - y * sn, x * sn + y * c];
    const bot = [R(x0 + hl0, hw0), R(x0 + hl0, -hw0), R(x0 - hl0, -hw0), R(x0 - hl0, hw0)];
    const top = [R(x1 + hl1, hw1), R(x1 + hl1, -hw1), R(x1 - hl1, -hw1), R(x1 - hl1, hw1)];
    const cen = R(x0, 0);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const nu = (bot[i][0] + bot[j][0]) / 2 - cen[0], nv = (bot[i][1] + bot[j][1]) / 2 - cen[1];
      if (nu + nv <= 0.01) continue;
      const glass = (i === 0 || i === 2) ? 'car-glass' : 'car-win';
      this.poly([this.P(bot[i][0], bot[i][1], h0), this.P(bot[j][0], bot[j][1], h0), this.P(top[j][0], top[j][1], h1), this.P(top[i][0], top[i][1], h1)], glass + ' ' + cls);
    }
    this.poly(top.map(p => this.P(p[0], p[1], h1)), 'ft car-roof ' + cls);
  }

  // Box rotated by theta (radians) in the ground plane — used for cars.
  // Draws only the side faces that face the viewer (+u/+v), then the top.
  rbox(cu, cv, hl, hw, h0, h1, theta, cls = '') {
    const c = Math.cos(theta), s = Math.sin(theta);
    const R = (x, y) => [cu + x * c - y * s, cv + x * s + y * c];
    const cs = [R(hl, hw), R(hl, -hw), R(-hl, -hw), R(-hl, hw)];
    for (let i = 0; i < 4; i++) {
      const p = cs[i], q = cs[(i + 1) % 4];
      const nu = (p[0] + q[0]) / 2 - cu, nv = (p[1] + q[1]) / 2 - cv;
      if (nu + nv <= 0.01) continue;
      this.poly([this.P(p[0], p[1], h0), this.P(q[0], q[1], h0), this.P(q[0], q[1], h1), this.P(p[0], p[1], h1)], (nv > nu ? 'fl ' : 'fr ') + cls);
    }
    this.poly(cs.map(p => this.P(p[0], p[1], h1)), 'ft ' + cls);
  }

  // Vertical cylinder (radius r in iso units). An iso circle is an ellipse rx=r√2, ry=r/√2.
  cyl(u, v, r, h0, h1, cls = '', topCls = 'ft') {
    const [x0, y0] = this.P(u, v, h0), [x1, y1] = this.P(u, v, h1);
    const rx = r * 1.4142, ry = r * 0.7071;
    this.B(x0 - rx, y0 + ry); this.B(x1 + rx, y1 - ry);
    this.raw(`<path class="fl ${cls}" d="M${f1(x0 - rx)},${f1(y0)} A${f1(rx)} ${f1(ry)} 0 0 0 ${f1(x0 + rx)},${f1(y0)} L${f1(x1 + rx)},${f1(y1)} L${f1(x1 - rx)},${f1(y1)} Z"/>`);
    this.line([x0 - rx * 0.45, y0 + ry * 0.9], [x1 - rx * 0.45, y1 + ry * 0.9], 'hatch');
    if (topCls) this.raw(`<ellipse class="${topCls}" cx="${f1(x1)}" cy="${f1(y1)}" rx="${f1(rx)}" ry="${f1(ry)}"/>`);
    return { x1, y1, rx, ry };
  }

  // Grid of windows on the left (+v) face or right (+u) face of a box.
  windows(face, u, v, a, b, h0, h1, cols, rows, o = {}) {
    const r = o.rand || Math.random, lit = o.lit ?? 0.55, padS = o.padS ?? 0.14, padH = o.padH ?? 0.22;
    const span = face === 'L' ? a : b;
    const cw = (2 * span) / cols, rh = (h1 - h0) / rows;
    const litList = [], darkList = [];
    for (let c = 0; c < cols; c++) for (let rI = 0; rI < rows; rI++) {
      const s0 = -span + c * cw + cw * padS, s1 = -span + (c + 1) * cw - cw * padS;
      const z0 = h0 + rI * rh + rh * padH, z1 = h0 + (rI + 1) * rh - rh * padH;
      let q;
      if (face === 'L') q = [this.P(u + s0, v + b, z0), this.P(u + s1, v + b, z0), this.P(u + s1, v + b, z1), this.P(u + s0, v + b, z1)];
      else              q = [this.P(u + a, v - s0, z0), this.P(u + a, v - s1, z0), this.P(u + a, v - s1, z1), this.P(u + a, v - s0, z1)];
      (r() < lit ? litList : darkList).push(q);
    }
    darkList.forEach(q => this.poly(q, 'win'));
    if (litList.length) {
      this.open(`<g class="${o.glowCls || 'glow'}">`);
      litList.forEach(q => this.poly(q, 'win-lit'));
      this.close();
    }
  }

  // Text painted onto a surface. 'L' = +v wall, 'R' = +u wall, 'T' = roof (reads along +u).
  text(face, u, v, h, str, o = {}) {
    const [x, y] = this.P(u, v, h);
    const m = face === 'L' ? `matrix(1,0.5,0,1,${f1(x)},${f1(y)})`
            : face === 'T' ? `matrix(1,0.5,-1,0.5,${f1(x)},${f1(y)})`
            : `matrix(1,-0.5,0,1,${f1(x)},${f1(y)})`;
    this.raw(`<text class="${o.cls || 'sign glow'}" transform="${m}" font-size="${o.size || 14}" text-anchor="${o.anchor || 'middle'}" ${o.extra || ''}>${str}</text>`);
  }

  // A few smoke puffs rising from a screen point.
  smoke(x, y, n = 3, big = 1) {
    this.B(x - 30, y - 70 * big);
    this.fx(() => { for (let k = 0; k < n; k++)
      this.raw(`<circle class="puff" style="animation-delay:${(-k * 3.2 / n).toFixed(2)}s;--s:${big}" cx="${f1(x)}" cy="${f1(y)}" r="7"/>`); });
  }

  svg(cls, pad = 24) {
    const x = Math.floor(this.minx - pad), y = Math.floor(this.miny - pad);
    const w = Math.ceil(this.maxx - this.minx + 2 * pad), h = Math.ceil(this.maxy - this.miny + 2 * pad);
    const head = `xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}"`;
    return { x, y, w, h, html: `<svg class="obj ${cls}" ${head}>${this.out.join('')}</svg>`,
             fxHtml: this.fxOut.length ? `<svg class="fx" ${head}>${this.fxOut.join('')}</svg>` : '' };
  }
}

/* ════════════════════════════════════════════════════════════════════
   ZONE BUILDINGS — one hand-made design per portfolio section.
   A design returns:
     parts   — [{ shape, du, dv, a, b }] each placed as its own object
               (own footprint + depth), offset from the block centre
     area    — { a, b } interaction footprint around the block centre
     labelH  — height of the floating label above the main part
     ground  — optional fn(G) → SVG drawn on the ground layer (G(u,v) = "x,y")
   ════════════════════════════════════════════════════════════════════ */
const DESIGNS = {
  // GARAGE — glass showroom with João's own cars on turntables (3D in world3d.js)
  garage() {
    const s = new Shape();
    s.box(0, 0, 118, 98, 0, 6, {});
    s.box(-116, 0, 2, 98, 6, 64, {});
    s.box(0, -96, 118, 2, 6, 64, {});
    s.text('L', 0, -94, 46, 'GARAGEM', { size: 16, extra: 'font-weight="700" letter-spacing="3"' });
    s.P(-130, -110, 0); s.P(130, 110, 80);
    return { parts: [{ shape: s, du: 0, dv: 0, a: 118, b: 98 }], area: { a: 124, b: 106 }, labelH: 92 };
  },

  // MAIN HQ — the tallest tower in town: glass elevator running up the front,
  // name on the crown, helipad + a searchlight sweeping the sky.
  main(r) {
    const s = new Shape();
    s.box(0, 0, 100, 100, 0, 14, {});
    s.box(0, 0, 86, 86, 14, 52, { stripe: 9 });
    s.open('<g class="glow">');
    s.poly([s.P(-22, 86, 14), s.P(22, 86, 14), s.P(22, 86, 44), s.P(-22, 86, 44)], 'win-lit');
    s.close();
    s.box(0, 104, 34, 14, 44, 50, {}); // entrance canopy
    s.box(0, 0, 70, 70, 52, 292, {});
    s.windows('L', 0, 0, 70, 70, 60, 284, 4, 10, { rand: r, lit: 0.5 });
    s.windows('R', 0, 0, 70, 70, 60, 284, 4, 10, { rand: r, lit: 0.42 });
    s.open('<g class="glow">');
    s.line(s.P(70, 70, 52), s.P(70, 70, 292), 'neon-edge');
    s.close();
    // glass elevator shaft on the front-left wall, cab rides up and down
    // shaft sticks out 10 from the facade (v 70→80); world3d builds the glass + steel,
    // the cab is a lit box in the fx layer so CSS can ride it up and down
    s.poly([s.P(-10, 80, 52), s.P(10, 80, 52), s.P(10, 80, 290), s.P(-10, 80, 290)], 'shaft');
    s.poly([s.P(10, 70, 52), s.P(10, 80, 52), s.P(10, 80, 290), s.P(10, 70, 290)], 'shaft');
    s.fx(() => { s.open('<g class="elev">');
      const h0 = 56, h1 = 74;
      s.poly([s.P(-8, 78.5, h1), s.P(8, 78.5, h1), s.P(8, 71.5, h1), s.P(-8, 71.5, h1)], 'elev-top');
      s.poly([s.P(8, 78.5, h0), s.P(8, 71.5, h0), s.P(8, 71.5, h1), s.P(8, 78.5, h1)], 'elev-side');
      s.poly([s.P(-8, 78.5, h0), s.P(8, 78.5, h0), s.P(8, 78.5, h1), s.P(-8, 78.5, h1)], 'elev-front');
      s.line(s.P(0, 78.6, h0), s.P(0, 78.6, h1), 'elev-door');
    s.close(); });
    s.box(0, 0, 58, 58, 292, 326, { cls: 'crown' });
    s.text('L', 0, 58, 300, 'JOPES', { size: 19, extra: 'font-weight="700" letter-spacing="2"' });
    s.text('R', 58, 0, 300, 'HQ', { size: 19, extra: 'font-weight="700"' });
    // helipad on the roof
    const [hx, hy] = s.P(8, 8, 326);
    s.raw(`<ellipse class="pad" cx="${f1(hx)}" cy="${f1(hy)}" rx="48" ry="24"/>`);
    s.text('T', 8, 8, 326, 'H', { size: 22, cls: 'sign-dim', extra: 'font-weight="700" dy="8"' });
    // antenna on the back corner
    s.line(s.P(-44, -44, 326), s.P(-44, -44, 400), 'mast');
    const [bx, by] = s.P(-44, -44, 402);
    s.fx(() => s.raw(`<circle class="beacon glow" cx="${bx}" cy="${by}" r="4"/>`));
    // searchlight on the front corner
    s.box(44, 44, 8, 8, 326, 336, {});
    const [lx, ly] = s.P(44, 44, 340);
    s.B(lx - 220, ly - 330); s.B(lx + 220, ly);
    s.fx(() => s.raw(`<g transform="translate(${f1(lx)},${f1(ly)})"><g class="sweep"><path class="beam beam-y" d="M-3,0 L-34,-300 Q0,-345 34,-300 L3,0 Z"/></g>` +
          `<circle class="glow beacon-c" cx="0" cy="0" r="4"/></g>`));
    return { parts: [{ shape: s, du: 0, dv: 0, a: 100, b: 100 }], area: { a: 104, b: 118 }, labelH: 345 };
  },

  // PROJETOS — a deploy port: 8 shipping containers (one per project, P/001…P/008)
  // and a gantry crane rolling back and forth delivering the next one.
  projects(r) {
    const s = new Shape();
    const ROWS = [-24, 24], COLS = [-114, -38, 38, 114];
    // billboard behind the yard
    [-50, 50].forEach(u => s.line(s.P(u, -78, 0), s.P(u, -78, 128), 'mast'));
    const panel = [s.P(-82, -78, 92), s.P(82, -78, 92), s.P(82, -78, 150), s.P(-82, -78, 150)];
    s.poly(panel, 'panel');
    s.open('<g class="glow">');
    s.poly(panel, 'panel-frame');
    s.text('L', 0, -78, 128, '&lt;/&gt; PROJETOS', { size: 19, extra: 'font-weight="700" letter-spacing="1"' });
    s.text('L', 0, -78, 104, 'DEPLOY PORT · 08 REPOS', { size: 10, cls: 'sign-sub', extra: 'letter-spacing="1.5"' });
    s.close();
    // crane: back legs first (behind the containers)
    const crane = (part) => {
      s.open('<g class="crane">');
      if (part === 'back') {
        s.line(s.P(0, -64, 0), s.P(0, -64, 118), 'mast');
        s.line(s.P(0, -64, 40), s.P(0, -40, 0), 'mast thin');
      } else {
        s.line(s.P(0, 64, 0), s.P(0, 64, 118), 'mast');
        s.line(s.P(0, 64, 40), s.P(0, 40, 0), 'mast thin');
        s.box(0, 0, 6, 68, 116, 124, {});
        s.box(0, 8, 9, 9, 104, 116, {});           // trolley
        s.line(s.P(0, 8, 104), s.P(0, 8, 78), 'mast thin');
        s.open('<g class="glow">');
        s.box(0, 8, 30, 14, 52, 78, { cls: 'box-lit' }); // container on the hook
        s.close();
        s.P(-140, 0, 130); s.P(140, 0, 130);
      }
      s.close();
    };
    crane('back');
    let n = 0;
    ROWS.forEach(v => COLS.forEach(u => {
      n++;
      s.box(u, v, 34, 18, 0, 34, { ribs: 6, cls: 'container' });
      s.text('T', u, v, 34, 'P/00' + n, { size: 11, cls: 'sign-sub glow', extra: 'font-weight="700" dy="4"' });
    }));
    crane('front');
    const ground = G => `<polygon class="zone-pad" points="${G(-170, -100)} ${G(170, -100)} ${G(170, 100)} ${G(-170, 100)}"/>` +
      [-70, 70].map(v => `<line class="rail" x1="${G(-175, v).split(',')[0]}" y1="${G(-175, v).split(',')[1]}" x2="${G(175, v).split(',')[0]}" y2="${G(175, v).split(',')[1]}"/>`).join('');
    return { parts: [{ shape: s, du: 0, dv: 0, a: 150, b: 72 }], area: { a: 150, b: 80 }, labelH: 160, ground };
  },

  // BACKEND LAB — an industrial lab: sawtooth-roof plant, smoking stacks,
  // glass reactors bubbling, and a conveyor shipping "200 OK" crates.
  lab(r) {
    // the plant
    const hall = new Shape();
    const A = 92, Bb = 70, H = 70;
    hall.cyl(-70, -52, 11, 70, 190);                 // stacks behind the roof
    hall.cyl(-30, -60, 9, 70, 160);
    hall.box(0, 0, A, Bb, 0, H, { noTop: true });
    hall.windows('L', 0, 0, A, Bb, 34, 60, 7, 1, { rand: r, lit: 0.85, padS: 0.1 });
    hall.poly([hall.P(-46, Bb, 0), hall.P(-14, Bb, 0), hall.P(-14, Bb, 30), hall.P(-46, Bb, 30)], 'door-dark'); // loading door
    for (let k = 0; k < 4; k++) {                      // sawtooth roof, glazing faces +u
      const u0 = -A + k * (2 * A / 4), u1 = u0 + 2 * A / 4;
      hall.poly([hall.P(u0, -Bb, H), hall.P(u1, -Bb, H + 30), hall.P(u1, Bb, H + 30), hall.P(u0, Bb, H)], 'ft');
      hall.poly([hall.P(u0, Bb, H), hall.P(u1, Bb, H), hall.P(u1, Bb, H + 30)], 'fl');
      hall.open('<g class="glow">');
      hall.poly([hall.P(u1, Bb, H), hall.P(u1, -Bb, H), hall.P(u1, -Bb, H + 30), hall.P(u1, Bb, H + 30)], 'win-lit glass-roof');
      hall.close();
    }
    hall.text('L', 0, Bb, 14, 'BACKEND LAB · R&amp;D', { size: 11, cls: 'sign-sub glow', extra: 'letter-spacing="2"' });
    const t1 = hall.P(-70, -52, 192), t2 = hall.P(-30, -60, 162);
    hall.smoke(t1[0], t1[1], 4, 1.2); hall.smoke(t2[0], t2[1], 3, 1);

    // two glass reactors with pipes into the plant
    const tanks = new Shape();
    [[0, -40], [0, 34]].forEach(([u, v], k) => {
      tanks.box(u, v, 30, 30, 0, 8, {});
      tanks.cyl(u, v, 26, 8, 104, 'glass', null);
      tanks.open('<g class="glow">');
      const lvl = 70 + k * 12;
      const L = tanks.cyl(u, v, 21, 12, lvl, 'liquid', 'liquid-top');
      tanks.close();
      tanks.fx(() => { tanks.open('<g class="glow">');
      for (let b = 0; b < 5; b++) {
        const bx = L.x1 + (b - 2) * 7, by = L.y1 + (lvl - 12) - 4;
        tanks.raw(`<circle class="bubble" style="--rise:-${lvl - 18}px;animation-delay:${(-b * 0.55).toFixed(2)}s" cx="${f1(bx)}" cy="${f1(by)}" r="2.2"/>`);
      }
      tanks.close(); });
      const top = tanks.P(u, v, 104);
      tanks.raw(`<ellipse class="ft" cx="${f1(top[0])}" cy="${f1(top[1])}" rx="36.8" ry="18.4"/>`);
      tanks.box(u, v, 8, 8, 104, 116, {});
      tanks.pline([tanks.P(u, v, 116), tanks.P(u, v, 124), tanks.P(u - 70, v, 124)], 'pipe');
    });
    // conveyor out of the loading door, crates riding it
    const belt = new Shape();
    belt.box(0, 0, 14, 56, 10, 16, {});
    [-46, 0, 46].forEach(v => belt.line(belt.P(10, v, 10), belt.P(10, v, 0), 'mast'));
    belt.fx(() => { for (let k = 0; k < 3; k++) {
      belt.open(`<g class="crate" style="animation-delay:${(-k * 2).toFixed(1)}s">`);
      belt.open('<g class="glow">');
      belt.box(0, -48, 9, 9, 16, 32, { cls: 'box-lit' });
      belt.close(); belt.close();
    } });
    belt.text('L', 0, 56, 18, '200 OK', { size: 8, cls: 'sign-sub glow' });
    belt.P(0, 60, 40);
    return {
      parts: [
        { shape: hall, du: -40, dv: -40, a: A, b: Bb },
        { shape: tanks, du: 110, dv: -26, a: 30, b: 70 },
        { shape: belt, du: -70, dv: 90, a: 14, b: 56 },
      ],
      area: { a: 150, b: 150 }, labelH: 140,
      ground: G => `<polygon class="zone-pad" points="${G(-150, -130)} ${G(160, -130)} ${G(160, 60)} ${G(-150, 60)}"/>` +
                   `<polygon class="hazard-pad" points="${G(-92, 34)} ${G(-48, 34)} ${G(-48, 150)} ${G(-92, 150)}"/>`,
    };
  },

  // SOBRE MIM — a house with a garden: smoke from the chimney, a mailbox,
  // and a stone path lit by five lamps — one per step of the career.
  about(r) {
    const s = new Shape();
    const a = 84, b = 68, H = 82, R = 140, o = 10;
    s.box(0, 0, a, b, 0, H, {});
    s.open('<g class="glow">');
    [[-62, -36], [-22, 4]].forEach(([u0, u1]) => s.poly([s.P(u0, b, 30), s.P(u1, b, 30), s.P(u1, b, 62), s.P(u0, b, 62)], 'win-lit'));
    s.poly([s.P(30, b, 0), s.P(54, b, 0), s.P(54, b, 50), s.P(30, b, 50)], 'win-lit door');
    [[-46, -14], [14, 46]].forEach(([v0, v1]) => s.poly([s.P(a, -v0, 32), s.P(a, -v1, 32), s.P(a, -v1, 62), s.P(a, -v0, 62)], 'win-lit'));
    s.close();
    // flower boxes under the front windows
    [[-62, -36], [-22, 4]].forEach(([u0, u1]) => s.box((u0 + u1) / 2, b + 4, (u1 - u0) / 2 + 2, 4, 24, 30, { cls: 'planter' }));
    // roof: ridge runs along u at v = 0
    s.poly([s.P(-a - o, -b - o, H - 6), s.P(a + o, -b - o, H - 6), s.P(a + o, 0, R), s.P(-a - o, 0, R)], 'ft');
    s.box(-40, -30, 10, 10, 96, 162, {});
    const ch = s.P(-40, -30, 164);
    s.smoke(ch[0], ch[1], 3, 0.8);
    s.poly([s.P(a, -b, H), s.P(a, b, H), s.P(a, 0, R)], 'fr');
    s.poly([s.P(-a - o, b + o, H - 6), s.P(a + o, b + o, H - 6), s.P(a + o, 0, R), s.P(-a - o, 0, R)], 'fl roof');
    for (let t = 1; t < 5; t++) {
      const vv = (b + o) * t / 5, hh = R - (R - H + 6) * t / 5;
      s.line(s.P(-a - o, vv, hh), s.P(a + o, vv, hh), 'hatch');
    }
    const [lx, ly] = s.P(60, b + 6, 56);
    s.fx(() => s.raw(`<circle class="glow beacon-c" cx="${lx}" cy="${ly}" r="3"/>`));
    // mailbox
    const mb = new Shape();
    mb.line(mb.P(0, 0, 0), mb.P(0, 0, 22), 'mast');
    mb.box(0, 0, 9, 5, 22, 34, {});
    mb.open('<g class="glow">'); mb.line(mb.P(9, -3, 30), mb.P(9, 3, 30), 'led-line'); mb.close();
    mb.raw(`<polygon class="flag" points="${mb.pts([mb.P(-6, 5, 34), mb.P(-6, 5, 46), mb.P(-1, 5, 42)])}"/>`);
    return {
      parts: [{ shape: s, du: -20, dv: -30, a, b }, { shape: mb, du: 90, dv: 150, a: 9, b: 6 }],
      area: { a: 120, b: 120 }, labelH: 165,
      ground: G => {
        // lawn + fence with a gap for the path; path stones + 5 timeline lamps
        let g = `<polygon class="lawn" points="${G(-170, -170)} ${G(170, -170)} ${G(170, 170)} ${G(-170, 170)}"/>`;
        g += `<polyline class="fence" points="${G(20, 172)} ${G(-172, 172)} ${G(-172, -172)} ${G(172, -172)} ${G(172, 172)} ${G(60, 172)}"/>`;
        for (let k = 0; k < 6; k++) {
          const v = 176 - k * 22, u = 40;
          g += `<polygon class="stone" points="${G(u - 8, v - 6)} ${G(u + 8, v - 6)} ${G(u + 8, v + 6)} ${G(u - 8, v + 6)}"/>`;
        }
        for (let k = 0; k < 5; k++) {
          const [x, y] = G(64, 160 - k * 26).split(',').map(Number);
          g += `<line class="g-post" x1="${x}" y1="${y}" x2="${x}" y2="${y - 16}"/><circle class="g-lamp tl-lamp" style="animation-delay:${k * 0.4}s" cx="${x}" cy="${y - 17}" r="2.6"/>`;
        }
        return g;
      },
    };
  },

  // TECH STACK — literally a stack. Walk up and it pulls apart into its layers;
  // data packets climb the corner.
  stack() {
    const s = new Shape();
    const layers = ['AWS · TERRAFORM', 'POSTGRES · REDIS', 'KAFKA · RABBITMQ', 'SPRING BOOT 3', 'JAVA 17+'];
    layers.forEach((name, k) => {
      const sz = 96 - k * 9, h0 = k * 46;
      s.open(`<g class="layer" style="--k:${k}">`);
      s.box(0, 0, sz, sz, h0, h0 + 34, {});
      s.text('L', 0, sz, h0 + 13, name, { size: 11, cls: 'sign-sub glow', extra: 'letter-spacing="1"' });
      s.open('<g class="glow">');
      s.box(0, 0, sz - 7, sz - 7, h0 + 34, h0 + 46, { cls: 'band' });
      s.close();
      s.close();
    });
    const top = 5 * 46;
    s.open('<g class="layer" style="--k:5">');
    s.box(0, 0, 50, 50, top, top + 10, {});
    s.open('<g class="glow cursor">');
    s.box(0, 0, 12, 12, top + 10, top + 34, { cls: 'band' });
    s.close(); s.close();
    s.fx(() => { s.open('<g class="glow">');
    for (let k = 0; k < 4; k++) {
      const [x, y] = s.P(96, 96, 0);
      s.raw(`<rect class="packet" style="animation-delay:${(-k * 0.9).toFixed(1)}s" x="${x - 3}" y="${y - 6}" width="6" height="6"/>`);
    }
    s.close(); });
    s.P(0, 0, top + 34 + 80);
    return { parts: [{ shape: s, du: 0, dv: 0, a: 96, b: 96 }], area: { a: 100, b: 100 }, labelH: top + 36,
      ground: G => `<polygon class="zone-pad" points="${G(-130, -130)} ${G(130, -130)} ${G(130, 130)} ${G(-130, 130)}"/>` };
  },

  // CONTATO — a little post-and-radio station: lattice mast sending signal,
  // paper planes taking off, a big mailbox out front.
  contact(r) {
    const s = new Shape();
    s.box(0, 0, 76, 76, 0, 92, {});
    s.windows('L', 0, 0, 76, 76, 14, 84, 3, 2, { rand: r, lit: 0.7 });
    s.windows('R', 0, 0, 76, 76, 14, 84, 3, 2, { rand: r, lit: 0.6 });
    s.text('R', 76, 0, 98, '@ CONTATO', { size: 11, cls: 'sign-sub glow', extra: 'letter-spacing="2"' });
    const h0 = 92, h1 = 290, w0 = 28, w1 = 5;
    const W = h => w0 + (w1 - w0) * (h - h0) / (h1 - h0);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([cu, cv]) => s.line(s.P(cu * w0, cv * w0, h0), s.P(cu * w1, cv * w1, h1), 'mast'));
    for (let h = h0; h < h1 - 10; h += 28) {
      const hn = Math.min(h + 28, h1), a0 = W(h), a1 = W(hn);
      s.line(s.P(-a0, a0, h), s.P(a1, a1, hn), 'mast thin');
      s.line(s.P(a0, a0, h), s.P(-a1, a1, hn), 'mast thin');
      s.line(s.P(a0, a0, h), s.P(a1, -a1, hn), 'mast thin');
      s.line(s.P(a0, -a0, h), s.P(a1, a1, hn), 'mast thin');
    }
    const [tx, ty] = s.P(0, 0, h1 + 6);
    s.fx(() => s.raw(`<g class="glow"><circle class="beacon" cx="${tx}" cy="${ty}" r="4.5"/>` +
          [0, 1, 2].map(k => `<circle class="ring" style="animation-delay:${k * 0.8}s" cx="${tx}" cy="${ty}" r="14"/>`).join('') + `</g>`));
    // paper planes taking off from the mast
    const plane = '-11,0 11,-5 -3,6';
    [[150, -40], [-140, -70], [110, -110]].forEach(([dx, dy], k) => {
      s.fx(() => s.raw(`<g transform="translate(${f1(tx)},${f1(ty + 40)})"><polygon class="plane glow" style="--dx:${dx}px;--dy:${dy}px;animation-delay:${(-k * 1.4).toFixed(1)}s" points="${plane}"/></g>`));
    });
    s.B(tx - 160, ty - 130); s.B(tx + 170, ty);
    // big mailbox out front
    const mb = new Shape();
    mb.box(0, 0, 14, 12, 0, 40, {});
    mb.cyl(0, 0, 9, 40, 46, '', 'ft');
    mb.open('<g class="glow">'); mb.line(mb.P(-8, 12, 30), mb.P(8, 12, 30), 'led-line'); mb.close();
    mb.text('L', 0, 12, 12, '✉', { size: 12, cls: 'sign-sub glow' });
    return { parts: [{ shape: s, du: 0, dv: 0, a: 76, b: 76 }, { shape: mb, du: 30, dv: 135, a: 14, b: 12 }],
      area: { a: 90, b: 140 }, labelH: 100 };
  },

  // ??? — a low bunker tucked in a corner, a red alarm light turning on top.
  // Barely glows until you find it.
  secret() {
    const s = new Shape();
    s.box(0, 0, 62, 62, 0, 30, { stripe: 7 });
    s.box(-24, -20, 10, 10, 30, 52, {});
    s.line(s.P(-24, -20, 52), s.P(-24, -20, 66), 'mast');
    s.box(-20, -20, 6, 4, 62, 68, {}); // periscope head
    for (let u = -56; u < 56; u += 16) s.poly([s.P(u, 62, 30), s.P(u + 8, 62, 30), s.P(u + 8, 54, 30), s.P(u, 54, 30)], 'hazard');
    s.open('<g class="glow secret-glow">');
    s.poly([s.P(-18, 62, 0), s.P(18, 62, 0), s.P(18, 62, 24), s.P(-18, 62, 24)], 'win-lit door');
    s.close();
    const [ax, ay] = s.P(20, 20, 40);
    s.fx(() => s.raw(`<g class="glow secret-glow"><g transform="translate(${f1(ax)},${f1(ay)})"><g class="spin"><path class="beam beam-r" d="M0,-2 L64,-20 Q82,0 64,20 L0,2 Z"/></g><circle class="beacon-c" r="4"/></g></g>`));
    s.box(20, 20, 5, 5, 30, 38, {});
    s.B(ax - 80, ay - 80); s.B(ax + 80, ay + 40);
    s.text('L', 0, 62, 10, '.env', { size: 10, cls: 'sign-dark', extra: 'font-weight="700"' });
    return { parts: [{ shape: s, du: 0, dv: 0, a: 62, b: 62 }], area: { a: 66, b: 66 }, labelH: 72 };
  },
};

/* ── generic props ─────────────────────────────────────────────────── */
function treeShape(r, big) {
  const s = new Shape();
  const pine = r() < 0.28;                       // in 3D: araucária
  const ipe = !pine && r() < 0.22 ? (r() < 0.5 ? 'pink' : 'yellow') : null;
  const spec = { kind: 'tree', big: !!big, pine, ipe, seed: Math.floor(r() * 1e6) };
  const k = (big ? 1.25 : 1) * 1.6;              // trees are ~3 storeys tall now (in scale with the buildings)
  { const R = 30 * k / 1.6 * 1.15, H = 100 * k / 1.6;   // reserve room for the 3D model
    for (const [u, v] of [[R, R], [-R, -R], [R, -R], [-R, R]]) { s.P(u, v, 0); s.P(u, v, H); } }
  const [gx, gy] = s.P(0, 0, 0);
  s.raw(`<ellipse class="tshadow" cx="${f1(gx)}" cy="${f1(gy)}" rx="${f1(20 * k)}" ry="${f1(10 * k)}"/>`);
  const blob = (du, dv, h, rr, cls = 'leafc') => {
    const [x, y] = s.P(du, dv, h); s.B(x - rr, y - rr); s.B(x + rr, y + rr);
    s.raw(`<circle class="${cls}" cx="${f1(x)}" cy="${f1(y)}" r="${f1(rr)}"/>`); return [x, y];
  };
  if (pine) { // pine: stacked cones
    s.line(s.P(0, 0, 0), s.P(0, 0, 12 * k), 'trunk');
    [[10, 22, 15], [24, 18, 12], [36, 14, 9]].forEach(([h, w, ht]) => {
      const [x, y] = s.P(0, 0, h * k);
      const W = w * k, T = (h + ht + 10) * k;
      const [tx, ty] = s.P(0, 0, T);
      s.raw(`<path class="leafc" d="M${f1(x - W)},${f1(y)} Q${f1(x)},${f1(y + W * 0.45)} ${f1(x + W)},${f1(y)} L${f1(tx)},${f1(ty)} Z"/>`);
    });
  } else {          // round canopy: three overlapping blobs + a highlight
    s.line(s.P(0, 0, 0), s.P(0, 0, 22 * k), 'trunk');
    blob(-7 * k, 5 * k, 28 * k, 12 * k);
    blob(7 * k, -5 * k, 30 * k, 11 * k);
    const [x, y] = blob(0, 0, 40 * k, 15 * k);
    s.raw(`<path class="leaf-hl" d="M${f1(x - 10 * k)},${f1(y - 3 * k)} A${f1(12 * k)} ${f1(12 * k)} 0 0 1 ${f1(x + 1 * k)},${f1(y - 12 * k)}"/>`);
  }
  return { shape: s, a: 9, b: 9, spec };
}
function bushShape(r) {
  const s = new Shape();
  const [gx, gy] = s.P(0, 0, 0);
  s.raw(`<ellipse class="tshadow" cx="${f1(gx)}" cy="${f1(gy)}" rx="16" ry="8"/>`);
  [[-6, 3, 7, 7], [6, -3, 7, 7], [0, 0, 10, 9]].forEach(([du, dv, h, rr]) => {
    const [x, y] = s.P(du, dv, h); s.B(x - rr, y - rr); s.B(x + rr, y + rr);
    s.raw(`<circle class="leafc" cx="${f1(x)}" cy="${f1(y)}" r="${rr}"/>`);
  });
  const flowers = r() < 0.35;
  if (flowers) { const [x, y] = s.P(2, 2, 15); s.raw(`<circle class="flower" cx="${f1(x)}" cy="${f1(y)}" r="1.6"/>`); }
  return { shape: s, a: 8, b: 8, spec: { kind: 'bush', flowers, seed: Math.floor(r() * 1e6) } };
}
const SHOPS = ['CAFÉ 24', 'BAR', 'PIZZA', 'HOTEL', 'NOODLES', 'ARCADE', 'LAUNDRY', 'DINER', 'SUSHI', 'BOOKS', 'GYM 24H', 'TATTOO'];
const SHOP_COLORS = ['#2AFADF', '#FF3CAC', '#9B7BFF', '#FF8C00', '#8cc8ff', '#00FF88', '#FFE600'];
function lowriseParams(r, a, b, h) {
  const p = { a, b, h, stripe: r() < 0.25 ? 8 : 0, seed: Math.floor(r() * 1e6) };
  p.shop = (h > 40 && r() < 0.5) ? { col: SHOP_COLORS[Math.floor(r() * SHOP_COLORS.length)], name: SHOPS[Math.floor(r() * SHOPS.length)] } : null;
  p.fireEscape = h > 80 && r() < 0.4;
  const roll = r();
  p.roof = roll < 0.3 ? 'box' : roll < 0.48 ? 'tank' : roll < 0.6 ? 'antenna' : null;
  const n = 1 + Math.floor(r() * 3);
  p.acs = [...Array(n)].map(() => ({ du: (r() - 0.2) * a * 0.9, dv: (r() - 0.2) * b * 0.9 }));
  p.tone = r();            // facade colour variation for 3D
  return p;
}
function lowriseShape(r, a, b, h) {
  const p = lowriseParams(r, a, b, h);
  const s = new Shape();
  s.box(0, 0, a + 6, b + 6, 0, 4, { cham: 5, lip: false });           // sidewalk plinth
  s.box(0, 0, a, b, 4, h, { stripe: p.stripe });
  const w0 = p.shop ? 34 : 12;
  if (h > 40) {
    const rows = Math.max(1, Math.round((h - w0 - 6) / 22));
    s.windows('L', 0, 0, a, b, w0, h - 8, Math.max(2, Math.round(a / 15)), rows, { rand: r, lit: 0.16, glowCls: 'dim-lit' });
    s.windows('R', 0, 0, a, b, w0, h - 8, Math.max(2, Math.round(b / 15)), rows, { rand: r, lit: 0.12, glowCls: 'dim-lit' });
  }
  if (p.shop) { // shopfront + neon sign on the street-facing wall
    const { col, name } = p.shop;
    const s0 = -a * 0.7, s1 = a * 0.35;
    s.open(`<g class="glow" style="color:${col}">`);
    s.poly([s.P(s0, b, 6), s.P(s1, b, 6), s.P(s1, b, 19), s.P(s0, b, 19)], 'win-lit shopfront');
    s.poly([s.P(s0, b + 1, 22), s.P(s1, b + 1, 22), s.P(s1, b + 1, 32), s.P(s0, b + 1, 32)], 'panel-frame');
    s.text('L', (s0 + s1) / 2, b + 1, 24.5, name, { size: 8, cls: 'sign', extra: 'font-weight="700" letter-spacing="1"' });
    s.close();
    s.poly([s.P(a * 0.48, b, 4), s.P(a * 0.68, b, 4), s.P(a * 0.68, b, 20), s.P(a * 0.48, b, 20)], 'door-dark');
  }
  if (p.fireEscape) { // fire escape zigzag on the right wall
    const v0 = -b * 0.55, v1 = b * 0.15;
    for (let hh = 30; hh < h - 14; hh += 24) {
      s.line(s.P(a + 5, v0, hh), s.P(a + 5, v1, hh), 'mast thin');
      s.line(s.P(a + 5, v0, hh + 6), s.P(a + 5, v1, hh + 6), 'mast thin');
      if (hh + 24 < h - 14) s.line(s.P(a + 5, v1, hh), s.P(a + 5, v0, hh + 24), 'mast thin');
    }
  }
  if (p.roof === 'box') s.box(-a * 0.3, -b * 0.3, Math.min(14, a * 0.3), Math.min(14, b * 0.3), h, h + 12, {});
  else if (p.roof === 'tank') {
    s.line(s.P(-a * 0.3 - 8, -b * 0.3, h), s.P(-a * 0.3 - 8, -b * 0.3, h + 14), 'mast');
    s.line(s.P(-a * 0.3 + 8, -b * 0.3, h), s.P(-a * 0.3 + 8, -b * 0.3, h + 14), 'mast');
    s.cyl(-a * 0.3, -b * 0.3, 11, h + 14, h + 36);
    const [x, y] = s.P(-a * 0.3, -b * 0.3, h + 36);
    s.raw(`<path class="hatch" d="M${f1(x - 15.5)},${f1(y)} L${f1(x)},${f1(y - 9)} L${f1(x + 15.5)},${f1(y)}"/>`);
  } else if (p.roof === 'antenna') {
    s.line(s.P(0, 0, h), s.P(0, 0, h + 40), 'mast');
    const [x, y] = s.P(0, 0, h + 41);
    s.fx(() => s.raw(`<circle class="beacon red-blink" cx="${x}" cy="${y}" r="2.5"/>`));
  }
  for (const { du, dv } of p.acs) {
    s.box(du, dv, 8, 6, h, h + 8, { cham: 1.5, lip: false });
    const [x, y] = s.P(du, dv, h + 8);
    s.raw(`<ellipse class="fan" cx="${f1(x)}" cy="${f1(y)}" rx="5" ry="2.5"/>`);
  }
  return { shape: s, a: a + 6, b: b + 6, spec: { kind: 'lowrise', ...p } };
}
// Project billboard: panel on two posts. face 'v' = panel faces +v (left wall side),
// face 'u' = faces +u. The screenshot <image> is filled in once the portfolio data loads.
function billboardShape(k, face) {
  const s = new Shape();
  const W = 48, H0 = 40, H1 = 136;
  const P = face === 'v' ? (t, h) => s.P(t, 4, h) : (t, h) => s.P(4, -t, h);
  [-30, 30].forEach(t => s.line(P(t, 0), P(t, H0), 'mast'));
  s.poly([P(-W - 3, H0 - 3), P(W + 3, H0 - 3), P(W + 3, H1 + 3), P(-W - 3, H1 + 3)], 'panel');
  const [ox, oy] = P(-W, H1);
  const m = face === 'v' ? `matrix(1,0.5,0,1,${f1(ox)},${f1(oy)})` : `matrix(1,-0.5,0,1,${f1(ox)},${f1(oy)})`;
  s.raw(`<image class="bb-img" data-k="${k}" x="0" y="0" width="${2 * W}" height="${H1 - H0}" preserveAspectRatio="xMidYMid slice" transform="${m}"/>`);
  s.poly([P(-W - 3, H0 - 3), P(W + 3, H0 - 3), P(W + 3, H1 + 3), P(-W - 3, H1 + 3)], 'panel-frame', 'style="color:#FF3CAC"');
  return { shape: s, a: face === 'v' ? W : 5, b: face === 'v' ? 5 : W, spec: { kind: 'billboard', k, face } };
}
/* Traffic light, Brazilian-avenue style: tall pole, mast arm out over the
   near lane (+v), main head facing +u traffic, a second head on the pole for
   the cross street (+v). The lenses are an fx layer so they can cycle in CSS
   (u-head: sig-*, cross head: sig2-* = the inverse phase). Must match
   world3d.js · buildSignal. */
const SIG = { H: 84, ARM: 40, HEAD: [70, 64.4, 58.8], HEAD2: [51.5, 47, 42.5] };
function signalShape(k) {
  const s = new Shape(), B = 5.2;
  s.line(s.P(0, 0, B), s.P(0, 0, B + SIG.H), 'mast');
  s.line(s.P(0, 0, B + SIG.H - 6), s.P(0, SIG.ARM, B + SIG.H - 6), 'mast');
  s.box(0, SIG.ARM - 4, 2.5, 3, B + 51, B + 75, { cham: 0, lip: false });
  s.box(0, 3, 3, 2.2, B + 38, B + 56, { cham: 0, lip: false });
  s.P(-6, -6, B); s.P(6, SIG.ARM + 4, B + SIG.H + 2);               // make sure the box covers the 3D model
  const d = `style="animation-delay:${(-k * 2.3).toFixed(1)}s"`;
  s.fx(() => {
    SIG.HEAD.forEach((h, i) => { const [x, y] = s.P(2.9, SIG.ARM - 4, B + h - 5.2);
      s.raw(`<circle class="sig sig-${'rag'[i]}" ${d} cx="${f1(x)}" cy="${f1(y)}" r="1.9"/>`); });
    SIG.HEAD2.forEach((h, i) => { const [x, y] = s.P(0, 5.6, B + h - 5.2);
      s.raw(`<circle class="sig sig2-${'rag'[i]}" ${d} cx="${f1(x)}" cy="${f1(y)}" r="1.6"/>`); });
  });
  return { shape: s, a: 3, b: 3, spec: { kind: 'signal' } };
}
/* Street light: tapered pole, curved arm reaching over the road (d = ±1 along
   the block diagonal), flat LED head. Matches world3d.js · buildLamp. */
const LAMP = { H: 92, REACH: 18 };
function lampShape(l) {
  const s = new Shape(), B = 5.2, r = l.d * LAMP.REACH;
  s.line(s.P(0, 0, B), s.P(0, 0, B + LAMP.H - 4), 'mast');
  s.line(s.P(0, 0, B + LAMP.H - 4), s.P(r, 0, B + LAMP.H), 'mast');
  s.P(-5, -5, B); s.P(5, 5, B); s.P(r + 8, -4, B + LAMP.H + 4); s.P(r - 8, 4, B + LAMP.H + 4);
  s.fx(() => { const [x, y] = s.P(r, 0, B + LAMP.H - 2);
    s.raw(`<ellipse class="lamp-glow ${l.warm ? 'warm' : 'cool'}" cx="${f1(x)}" cy="${f1(y + 1.5)}" rx="7" ry="3.5"/>`); });
  return { shape: s, a: 2, b: 2, spec: { kind: 'lamp', warm: l.warm, d: l.d } };
}
function monumentShape() {
  const s = new Shape();
  s.box(0, 0, 34, 34, 0, 10, {});
  s.box(0, 0, 24, 24, 10, 36, { stripe: 6 });
  const top = s.P(0, 0, 120), bot = s.P(0, 0, 62);
  const e = s.P(20, 0, 91), w = s.P(-20, 0, 91), so = s.P(0, 20, 91);
  const pts = p => p.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ');
  s.raw(`<g class="bob glow">` +
    `<polygon class="gem gem-l" points="${pts([top, w, so])}"/><polygon class="gem gem-r" points="${pts([top, so, e])}"/>` +
    `<polygon class="gem gem-r" points="${pts([bot, so, e])}"/><polygon class="gem gem-l" points="${pts([bot, w, so])}"/></g>`);
  s.text('L', 0, 24, 16, 'JOPES.EXE', { size: 8, cls: 'sign-sub glow', extra: 'letter-spacing="1"' });
  return { shape: s, a: 34, b: 34 };
}

/* ── cars ───────────────────────────────────────────────────────────
   Eight pre-rendered headings (k·45° in the iso ground plane, k=0 → +u).
   Every heading shares the same viewBox so swapping is just innerHTML. */
const CAR_VB = { x: -130, y: -95, w: 260, h: 170 };
// Cars are drawn at 64 headings (q · 360/64°, q=0 → +u) and 3 steering states
// (st = -1 left, 0 straight, 1 right — only the front wheels change).
const CAR_DIRS = 64;
const STEER_VIS = 0.42; // how far the front wheels visibly turn (rad)
function carSVG(q, color, special, extraCls = '', st = 0, under = false) {
  const s = new Shape();
  const th = q * 2 * Math.PI / CAR_DIRS, c = Math.cos(th), sn = Math.sin(th);
  const at = (x, y, h) => s.P(x * c - y * sn, x * sn + y * c, h);
  // soft headlight cone: narrow at the lamps, widening, rounded far edge, fading out
  const pq = (x, y) => { const p = at(x, y, 0); return f1(p[0]) + ',' + f1(p[1]); };
  s.raw(`<path class="headbeam" fill="url(#hb${q})" d="M${pq(27, 7)} L${pq(128, 52)} Q${pq(165, 0)} ${pq(128, -52)} L${pq(27, -7)} Q${pq(31, 0)} ${pq(27, 7)} Z"/>`);
  const [gx, gy] = s.P(0, 0, 0);
  s.raw(`<ellipse class="tshadow" cx="${f1(gx)}" cy="${f1(gy + 2)}" rx="34" ry="17"/>`);
  if (under) return `<svg class="car-under" xmlns="http://www.w3.org/2000/svg" viewBox="${CAR_VB.x} ${CAR_VB.y} ${CAR_VB.w} ${CAR_VB.h}" width="${CAR_VB.w}" height="${CAR_VB.h}">${s.out.join('')}</svg>`;
  // wheels on the sides that face the viewer; a wheel is a vertical disc, drawn as an
  // ellipse stretched along its rolling direction — the front pair follows the steering
  const wheel = (x, y, ang) => {
    const p = at(x, y, 4);
    const du = Math.cos(ang), dv = Math.sin(ang);
    const sx = du - dv, sy = (du + dv) / 2, len = Math.hypot(sx, sy);
    const deg = Math.atan2(sy, sx) * 180 / Math.PI;
    s.raw(`<ellipse class="wheel" cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${f1(4.4 * len + 0.6)}" ry="3.6" transform="rotate(${f1(deg)} ${f1(p[0])} ${f1(p[1])})"/>`);
  };
  [13, -13].forEach(y => {
    const ny = y > 0 ? (-sn + c) : (sn - c);
    if (ny <= 0.01) return;
    wheel(-17, y, th);
    wheel(17, y, th + st * STEER_VIS);
  });
  s.rbox(0, 0, 28, 13, 4, 12, th, 'car-body');
  s.rfrustum(-4, 16, 12, -6, 10, 10, 12, 21, th, 'car-cab');
  const front = c + sn > -0.01, back = c + sn < 0.01;
  if (front) [-8, 8].forEach(y => { const p = at(28, y, 9); s.raw(`<circle class="hl" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.2"/>`); });
  if (back) [-8, 8].forEach(y => { const p = at(-28, y, 9); s.raw(`<circle class="tl" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2"/>`); });
  if (special) { const p = at(-6, 0, 21); s.raw(`<circle class="roof-light" cx="${f1(p[0])}" cy="${f1(p[1])}" r="3"/>`); }
  return `<svg class="obj car ${extraCls}" xmlns="http://www.w3.org/2000/svg" viewBox="${CAR_VB.x} ${CAR_VB.y} ${CAR_VB.w} ${CAR_VB.h}" width="${CAR_VB.w}" height="${CAR_VB.h}" style="color:${color}">${s.out.join('')}</svg>`;
}

/* ── helicopter ──────────────────────────────────────────────────────
   Same 64-heading scheme as the cars. The main rotor is drawn in the ground
   plane through an iso matrix, so it really spins "flat" in isometric. */
/* ── pedestrians (SVG fallback; 3D frames come from vehicles.js) ── */
const PED_VB = { x: -30, y: -66, w: 60, h: 72 };   // = vehicles.js · PERSON_BOX (same scale as the player)
const PED_SHIRTS = ['#d9534f', '#3f7fd6', '#e0b13a', '#3fae7c', '#9b6bd6', '#e07a3a'];
function pedSVG(style) {
  return `<svg class="ped-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${PED_VB.x} ${PED_VB.y} ${PED_VB.w} ${PED_VB.h}" width="${PED_VB.w}" height="${PED_VB.h}">` +
    `<ellipse cx="0" cy="0" rx="7" ry="3.5" fill="rgba(0,0,0,.35)"/><line x1="-2" y1="0" x2="-1" y2="-11" stroke="#2b3240" stroke-width="2.4"/><line x1="2" y1="0" x2="1" y2="-11" stroke="#2b3240" stroke-width="2.4"/>` +
    `<rect x="-4" y="-21" width="8" height="11" rx="2" fill="${PED_SHIRTS[style % PED_SHIRTS.length]}"/><circle cx="0" cy="-24.5" r="3.4" fill="#e2b48f"/></svg>`;
}
/* ── metro (SVG fallback) ── */
const TRAIN_VB = { x: -130, y: -175, w: 260, h: 205 };
const DECK_H = 70;
function viaductShape(len, pillar) {
  const s = new Shape();
  if (pillar) { s.box(0, 0, 5, 5, 0, DECK_H - 8, { cham: 1.5, lip: false }); s.box(0, 0, 12, 8, DECK_H - 14, DECK_H - 8, { cham: 1, lip: false }); }
  s.box(0, 0, 15, len / 2, DECK_H - 8, DECK_H, { cham: 0, lip: false });
  s.line(s.P(13, -len / 2, DECK_H + 3), s.P(13, len / 2, DECK_H + 3), 'mast thin');
  s.line(s.P(-13, -len / 2, DECK_H + 3), s.P(-13, len / 2, DECK_H + 3), 'mast thin');
  return { shape: s, a: 15, b: len / 2, spec: { kind: 'viaduct', len, pillar } };
}
function stationShape() {
  const s = new Shape();
  for (const u of [-30, 30]) s.box(u, 0, 13, 66, DECK_H - 6, DECK_H, { cham: 1, lip: false });
  for (const u of [-38, 38]) for (const v of [-56, 0, 56]) s.line(s.P(u, v, DECK_H), s.P(u, v, DECK_H + 34), 'mast');
  for (const u of [-30, 30]) s.box(u, 0, 14, 68, DECK_H + 34, DECK_H + 37, { cham: 1, lip: false });
  s.box(-56, 52, 9, 14, 0, DECK_H, { cham: 1, lip: false, stripe: 7 });     // stairs block
  s.text('L', -30, 66, DECK_H + 20, 'ESTAÇÃO JOPES', { size: 7, cls: 'sign-sub glow', extra: 'style="color:#FFE600"' });
  return { shape: s, a: 66, b: 68, spec: { kind: 'station' } };
}
function trainSVG(q, cab) {
  const s = new Shape();
  const th = q * 2 * Math.PI / CAR_DIRS;
  s.rbox(0, 0, 36, 11, DECK_H + 4, DECK_H + 26, th, 'car-body');
  return `<svg class="obj train" xmlns="http://www.w3.org/2000/svg" viewBox="${TRAIN_VB.x} ${TRAIN_VB.y} ${TRAIN_VB.w} ${TRAIN_VB.h}" width="${TRAIN_VB.w}" height="${TRAIN_VB.h}" style="color:#e9eef5">${s.out.join('')}</svg>`;
}

function heliSVG(q, color) {
  const s = new Shape();
  const th = q * 2 * Math.PI / CAR_DIRS, c = Math.cos(th), sn = Math.sin(th);
  const at = (x, y, h) => s.P(x * c - y * sn, x * sn + y * c, h);
  [10, -10].forEach(y => {                       // skids + struts
    s.line(at(-17, y, 1), at(17, y, 1), 'skid');
    s.line(at(-8, y, 1), at(-7, y * 0.6, 8), 'mast thin');
    s.line(at(8, y, 1), at(7, y * 0.6, 8), 'mast thin');
  });
  const tail = () => {
    s.rbox(-34 * c, -34 * sn, 17, 2.5, 15, 20, th, 'heli-body');
    s.rbox(-50 * c, -50 * sn, 3, 1.2, 15, 33, th, 'heli-body');
    const p = at(-50, 3, 28);
    s.raw(`<circle class="tail-rotor" cx="${f1(p[0])}" cy="${f1(p[1])}" r="6"/>`);
  };
  const body = () => s.rfrustum(2, 18, 11, 0, 12, 8, 6, 24, th, 'heli-body');
  if (c + sn > 0) { tail(); body(); } else { body(); tail(); }
  const nav = (x, y, h, cls) => { const p = at(x, y, h); s.raw(`<circle class="${cls}" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.8"/>`); };
  nav(4, 11, 12, 'nav-g'); nav(4, -11, 12, 'nav-r');
  const b = at(0, 0, 5); s.raw(`<circle class="beacon red-blink" cx="${f1(b[0])}" cy="${f1(b[1])}" r="2.2"/>`);
  s.line(at(0, 0, 24), at(0, 0, 29), 'mast');
  const [rx, ry] = at(0, 0, 30);
  s.B(rx - 76, ry - 40); s.B(rx + 76, ry + 40);
  s.raw(`<g transform="matrix(1,0.5,-1,0.5,${f1(rx)},${f1(ry)})"><circle class="rotor-disc" r="50"/>` +
        `<g class="rotor"><rect x="-52" y="-1.8" width="104" height="3.6" rx="1.8"/><rect x="-1.8" y="-52" width="3.6" height="104" ry="1.8"/></g></g>`);
  return `<svg class="obj heli" xmlns="http://www.w3.org/2000/svg" viewBox="${CAR_VB.x} ${CAR_VB.y} ${CAR_VB.w} ${CAR_VB.h}" width="${CAR_VB.w}" height="${CAR_VB.h}" style="color:${color}">${s.out.join('')}</svg>`;
}

// a little airliner that crosses the sky now and then (scenery only)
function planeSVG() {
  const s = new Shape();
  s.rbox(0, 0, 10, 46, 3, 5, 0, 'plane-body');           // wings
  s.rbox(0, 0, 42, 5, 0, 9, 0, 'plane-body');            // fuselage
  s.rbox(-36, 0, 4, 16, 6, 8, 0, 'plane-body');          // tailplane
  s.rbox(-38, 0, 4, 1, 8, 22, 0, 'plane-body');          // fin
  const L = (u, v, h, cls) => { const p = s.P(u, v, h); s.raw(`<circle class="${cls}" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2.2"/>`); };
  L(0, 46, 5, 'nav-r'); L(0, -46, 5, 'nav-g'); L(-40, 0, 22, 'strobe');
  for (let k = -28; k < 34; k += 8) { const p = s.P(k, 5, 6); s.raw(`<circle class="porthole" cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.1"/>`); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-130 -95 260 170" width="260" height="170">${s.out.join('')}</svg>`;
}

/* ════════════════════════════════════════════════════════════════════
   BUILD
   ════════════════════════════════════════════════════════════════════ */
function build({ mapPx, groundEl, worldEl }) {
  const X0 = mapPx / 2;
  const S = (u, v) => ({ x: X0 + u - v, y: (u + v) / 2 });
  const I = (x, y) => ({ u: y + (x - X0) / 2, v: y - (x - X0) / 2 });
  const blockCentre = (i, j) => ({ u: (i + 0.5) * BLOCK, v: (j + 0.5) * BLOCK });

  const objects = [];
  const zones = [];
  const cars = [];

  // global gradients used by beams
  const defs = document.createElement('div');
  defs.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="beam-y" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFE600" stop-opacity=".45"/><stop offset="1" stop-color="#FFE600" stop-opacity="0"/></linearGradient>
    <linearGradient id="beam-r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3333" stop-opacity=".6"/><stop offset="1" stop-color="#ff3333" stop-opacity="0"/></linearGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter>
    ${[...Array(CAR_DIRS)].map((_, k) => {
      // headlight gradient for heading k, in the car's own local coordinates
      const th = k * 2 * Math.PI / CAR_DIRS, P = (x) => [x * Math.cos(th) - x * Math.sin(th), (x * Math.cos(th) + x * Math.sin(th)) / 2];
      const [x1, y1] = P(27), [x2, y2] = P(150);
      return `<linearGradient id="hb${k}" gradientUnits="userSpaceOnUse" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}">` +
        `<stop offset="0" stop-color="#fff4c8" stop-opacity=".5"/><stop offset=".45" stop-color="#fff4c8" stop-opacity=".16"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></linearGradient>`;
    }).join('')}
  </defs></svg>`;
  document.body.appendChild(defs.firstChild);

  function addEl(html, x, y, z) {
    const holder = document.createElement('div');
    holder.innerHTML = html;
    const el = holder.firstChild;
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.zIndex = z;
    worldEl.appendChild(el);
    return el;
  }

  function place(shapeInfo, u, v, opts = {}) {
    const { shape, a, b } = shapeInfo;
    const g = S(u, v);
    const svg = shape.svg(opts.cls || '', opts.pad ?? 24);
    const z = Math.round(g.y + (a + b) / 2); // occlusion order: footprint's front corner
    const el = addEl(svg.html, g.x + svg.x, g.y + svg.y, z);
    if (opts.color) el.style.color = opts.color;
    const o = { u, v, a, b, x: g.x, y: g.y, z, el, solid: opts.solid !== false,
      bbox: { x0: g.x + svg.x, y0: g.y + svg.y, x1: g.x + svg.x + svg.w, y1: g.y + svg.y + svg.h },
      box: { x: svg.x, y: svg.y, w: svg.w, h: svg.h }, fxHtml: svg.fxHtml, spec: opts.spec || shapeInfo.spec || null };
    objects.push(o);
    return o;
  }

  /* cars: movable objects with 8 headings */
  // k = one of 8 compass headings (k·45°); stored as q on the 64-step wheel
  function makeCar(u, v, k, color, opts = {}) {
    const g = S(u, v);
    const q = k * (CAR_DIRS / 8);
    const o = { u, v, a: 20, b: 20, x: g.x, y: g.y, z: Math.round(g.y + 20), solid: true, car: true,
      heading: q, steerVis: 0, cache: {}, color, special: !!opts.special, ai: opts.ai || null, bbox: {},
      angle: q * 2 * Math.PI / CAR_DIRS, speed: 0, steer: 0 };
    o.el = addEl(carHTML(o, q, 0), g.x + CAR_VB.x, g.y + CAR_VB.y, o.z);
    // the car's own bbox is just around the body, not the headlight cone
    moveCar(o, g.x, g.y);
    objects.push(o); cars.push(o);
    return o;
  }
  function moveCar(o, x, y) {
    const p = I(x, y);
    o.u = p.u; o.v = p.v; o.x = x; o.y = y;
    o.el.style.left = (x + CAR_VB.x) + 'px';
    o.el.style.top = (y + CAR_VB.y) + 'px';
    o.bbox = { x0: x - 40, y0: y - 44, x1: x + 40, y1: y + 22 };
  }
  function carHTML(o, q, st) {
    const key = q + ':' + st;
    return o.cache[key] || (o.cache[key] = carSVG(q, o.color, o.special, o.ai ? 'ai-car' : '', st));
  }
  // angle in radians (iso plane, 0 = +u), st = steering state -1/0/1
  function setCarHeading(o, angle, st = 0) {
    const q = ((Math.round(angle / (2 * Math.PI) * CAR_DIRS) % CAR_DIRS) + CAR_DIRS) % CAR_DIRS;
    if (GL) { // 3D: continuous angle; only the ground layer (headlight cone) is per-q SVG
      o.angle = angle;
      if (o.heading !== q) { o.heading = q; o.under.outerHTML = carSVG(q, o.color, o.special, '', 0, true); o.under = o.el.querySelector('.car-under'); }
      GL.drawCar(o);
      return;
    }
    if (o.heading === q && o.steerVis === st) return;
    o.heading = q; o.steerVis = st;
    const holder = document.createElement('div');
    holder.innerHTML = carHTML(o, q, st);
    const el = holder.firstChild;
    el.style.cssText = o.el.style.cssText;
    o.el.classList.forEach(c => el.classList.add(c));
    o.el.replaceWith(el); o.el = el;
  }

  /* ── which blocks are on the map, and what's on each ── */
  const zoneAt = {};
  Object.entries(ZONE_BLOCKS).forEach(([z, [i, j]]) => { zoneAt[i + ',' + j] = z; });
  const blocks = [];
  for (let i = -3; i <= 8; i++) for (let j = -3; j <= 8; j++) {
    const c = blockCentre(i, j), s = S(c.u, c.v);
    if (!(s.x > -380 && s.x < mapPx + 380 && s.y > -300 && s.y < mapPx + 300)) continue;
    const zone = zoneAt[i + ',' + j];
    const isPlaza = i === PLAZA_BLOCK[0] && j === PLAZA_BLOCK[1];
    const r = rng(i * 131 + j * 977 + 7);
    const isField = i === FIELD_BLOCK[0] && j === FIELD_BLOCK[1];
    const isAirport = AIRPORT_BLOCKS.some(([a, c]) => a === i && c === j);
    const kind = zone ? 'zone' : isPlaza ? 'plaza' : isField ? 'field' : isAirport ? 'airport' : ['park', 'lowrise', 'lowrise', 'lot', 'lowrise', 'park'][Math.floor(r() * 6)];
    const design = zone ? DESIGNS[zone](rng(i * 733 + j * 191 + 3)) : null;
    blocks.push({ i, j, c, s, kind, zone, design });
  }

  /* ── project billboards: the 11 non-zone blocks closest to the plaza ── */
  const BILLBOARDS = 11;
  const pc = S((PLAZA_BLOCK[0] + 0.5) * BLOCK, (PLAZA_BLOCK[1] + 0.5) * BLOCK);
  blocks.filter(b => ['park', 'lowrise', 'lot'].includes(b.kind))
    .sort((p, q) => Math.hypot(p.s.x - pc.x, p.s.y - pc.y) - Math.hypot(q.s.x - pc.x, q.s.y - pc.y))
    .slice(0, BILLBOARDS)
    .forEach((b, k) => { b.billboard = { k, face: (b.i + b.j) % 2 ? 'u' : 'v' }; });

  /* ── ground SVG ─────────────────────────────────────────────────── */
  const g = [];
  const pt = (u, v) => { const s = S(u, v); return f1(s.x) + ',' + f1(s.y); };
  const half = BLOCK / 2 - ROAD / 2;

  // two ground layers: `g` = base (roads, sidewalks…) which the 3D ground replaces,
  // `gk` = light & markings (halos, lamp pools, zone decorations) that always stay on top
  const gk = [];
  const svgHead = cls => `<svg xmlns="http://www.w3.org/2000/svg" width="${mapPx}" height="${mapPx}" viewBox="0 0 ${mapPx} ${mapPx}" class="${cls}">`;
  g.push(svgHead('ground ground-base'));
  gk.push(svgHead('ground ground-fx'));
  gk.push(`<defs>
    <pattern id="hatch" width="28" height="28" patternUnits="userSpaceOnUse">
      <line x1="5" y1="9" x2="15" y2="14" class="g-dash"/><line x1="19" y1="23" x2="29" y2="28" class="g-dash"/>
    </pattern>
    <pattern id="grass" width="22" height="22" patternUnits="userSpaceOnUse">
      <line x1="4" y1="6" x2="4" y2="10" class="g-grass"/><line x1="15" y1="17" x2="15" y2="21" class="g-grass"/>
    </pattern>
    <pattern id="grid" width="56" height="28" patternUnits="userSpaceOnUse">
      <path d="M0 14 L28 0 L56 14 L28 28 Z" class="g-grid"/>
    </pattern>
    <pattern id="hazard" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="8" height="16" fill="rgba(42,250,223,0.10)"/>
    </pattern>
    <radialGradient id="pool-warm"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".28"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
    <radialGradient id="pool-cool"><stop offset="0" stop-color="#5ab0ff" stop-opacity=".22"/><stop offset="1" stop-color="#5ab0ff" stop-opacity="0"/></radialGradient>
    ${Object.entries(ZONE_COLORS).map(([z, c]) => `<radialGradient id="halo-${z}"><stop offset="0" stop-color="${c}" stop-opacity=".30"/><stop offset=".6" stop-color="${c}" stop-opacity=".08"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')}
  </defs>`);
  g.push(`<rect width="${mapPx}" height="${mapPx}" class="g-road"/>`);
  g.push(`<rect width="${mapPx}" height="${mapPx}" fill="url(#grid)" opacity=".5"/>`);

  const minK = -4, maxK = 9;
  for (let k = minK; k <= maxK; k++) {
    const c = k * BLOCK;
    g.push(`<line class="g-lane" x1="${S(minK * BLOCK, c).x}" y1="${S(minK * BLOCK, c).y}" x2="${S(maxK * BLOCK, c).x}" y2="${S(maxK * BLOCK, c).y}"/>`);
    g.push(`<line class="g-lane" x1="${S(c, minK * BLOCK).x}" y1="${S(c, minK * BLOCK).y}" x2="${S(c, maxK * BLOCK).x}" y2="${S(c, maxK * BLOCK).y}"/>`);
  }
  const zebra = [];
  for (let ki = minK; ki <= maxK; ki++) for (let kj = minK; kj <= maxK; kj++) {
    const cu = ki * BLOCK, cv = kj * BLOCK, s = S(cu, cv);
    if (s.x < -200 || s.x > mapPx + 200 || s.y < -200 || s.y > mapPx + 200) continue;
    zebra.push(`<polygon class="g-cross" points="${pt(cu - ROAD / 2, cv - ROAD / 2)} ${pt(cu + ROAD / 2, cv - ROAD / 2)} ${pt(cu + ROAD / 2, cv + ROAD / 2)} ${pt(cu - ROAD / 2, cv + ROAD / 2)}"/>`);
    for (const sgn of [-1, 1]) {
      for (let n = -ROAD / 2 + 10; n <= ROAD / 2 - 10; n += 13) {
        const u0 = cu + sgn * (ROAD / 2 + 6), u1 = cu + sgn * (ROAD / 2 + 22);
        zebra.push(`<line class="g-zebra" x1="${S(u0, cv + n).x}" y1="${S(u0, cv + n).y}" x2="${S(u1, cv + n).x}" y2="${S(u1, cv + n).y}"/>`);
        const v0 = cv + sgn * (ROAD / 2 + 6), v1 = cv + sgn * (ROAD / 2 + 22);
        zebra.push(`<line class="g-zebra" x1="${S(cu + n, v0).x}" y1="${S(cu + n, v0).y}" x2="${S(cu + n, v1).x}" y2="${S(cu + n, v1).y}"/>`);
      }
    }
  }
  g.push(zebra.join(''));

  const lamps = [];
  blocks.forEach(blk => {
    const { i, j, c, kind, zone, design } = blk;
    const u0 = c.u - half, u1 = c.u + half, v0 = c.v - half, v1 = c.v + half, H = 6;
    const P = (u, v, h = 0) => { const s = S(u, v); return f1(s.x) + ',' + f1(s.y - h); };
    g.push(`<polygon class="g-curb-l" points="${P(u0, v1)} ${P(u1, v1)} ${P(u1, v1, -H)} ${P(u0, v1, -H)}"/>`);
    g.push(`<polygon class="g-curb-r" points="${P(u1, v1)} ${P(u1, v0)} ${P(u1, v0, -H)} ${P(u1, v1, -H)}"/>`);
    g.push(`<polygon class="g-block" points="${P(u0, v0)} ${P(u1, v0)} ${P(u1, v1)} ${P(u0, v1)}"/>`);
    const inset = 26;
    const fill = kind === 'park' || kind === 'field' ? 'url(#grass)' : 'url(#hatch)';
    g.push(`<polygon class="g-inner ${kind === 'park' ? 'g-park' : ''}" points="${P(u0 + inset, v0 + inset)} ${P(u1 - inset, v0 + inset)} ${P(u1 - inset, v1 - inset)} ${P(u0 + inset, v1 - inset)}"/>`);
    g.push(`<polygon fill="${fill}" points="${P(u0 + inset, v0 + inset)} ${P(u1 - inset, v0 + inset)} ${P(u1 - inset, v1 - inset)} ${P(u0 + inset, v1 - inset)}"/>`);

    if (zone) {
      const s = S(c.u, c.v);
      gk.push(`<ellipse class="halo" data-zone="${zone}" cx="${f1(s.x)}" cy="${f1(s.y)}" rx="300" ry="150" fill="url(#halo-${zone})"/>`);
      if (design.ground) gk.push(`<g class="zone-ground" style="color:${ZONE_COLORS[zone]}">${design.ground((du, dv) => pt(c.u + du, c.v + dv))}</g>`);
    }
    if (kind === 'plaza') {
      const s = S(c.u, c.v);
      [150, 105, 60].forEach((rr, k) => gk.push(`<ellipse class="${k === 1 ? 'g-ring-dash' : 'g-ring'}" cx="${f1(s.x)}" cy="${f1(s.y)}" rx="${rr * 1.414}" ry="${rr * 0.707}"/>`));
      gk.push(`<ellipse cx="${f1(s.x)}" cy="${f1(s.y)}" rx="230" ry="115" fill="url(#halo-main)" opacity=".7"/>`);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([du, dv]) => {
        g.push(`<line class="g-path" x1="${S(c.u + du * 150, c.v + dv * 150).x}" y1="${S(c.u + du * 150, c.v + dv * 150).y}" x2="${S(c.u + du * (half - inset), c.v + dv * (half - inset)).x}" y2="${S(c.u + du * (half - inset), c.v + dv * (half - inset)).y}"/>`);
      });
    }
    if (kind === 'lot') {
      for (let n = -3; n <= 3; n++) {
        const vv = c.v + n * 44;
        g.push(`<line class="g-park-line" x1="${S(c.u - 120, vv).x}" y1="${S(c.u - 120, vv).y}" x2="${S(c.u - 40, vv).x}" y2="${S(c.u - 40, vv).y}"/>`);
        g.push(`<line class="g-park-line" x1="${S(c.u + 40, vv).x}" y1="${S(c.u + 40, vv).y}" x2="${S(c.u + 120, vv).x}" y2="${S(c.u + 120, vv).y}"/>`);
      }
    }
    lamps.push({ u: u1 - 12, v: v1 - 12, warm: (i + j) % 2 === 0, d: 1 });
    lamps.push({ u: u0 + 12, v: v0 + 12, warm: (i + j) % 2 !== 0, d: -1 });
  });

  lamps.forEach(l => {
    const s = S(l.u + l.d * LAMP.REACH, l.v);     // light pool under the head
    gk.push(`<ellipse cx="${f1(s.x)}" cy="${f1(s.y)}" rx="92" ry="46" fill="url(#pool-${l.warm ? 'warm' : 'cool'})"/>`);
  });

  g.push(`</svg>`); gk.push(`</svg>`);
  groundEl.innerHTML = g.join('') + gk.join('');
  const halos = {}, zoneGrounds = {};
  groundEl.querySelectorAll('.halo').forEach(h => { halos[h.dataset.zone] = h; });

  /* ── objects on each block ──────────────────────────────────────── */
  let spawn = null, playerCar = null;
  const billboards = [];
  blocks.forEach(({ i, j, c, kind, zone, design, billboard }) => {
    const r = rng(i * 733 + j * 191 + 3);
    if (billboard) {
      const [du, dv] = kind === 'lot' ? [0, 0] : [95, 95];
      const o = place(billboardShape(billboard.k, billboard.face), c.u + du, c.v + dv, { cls: 'billboard', pad: 20 });
      o.billboard = billboard;
      billboards.push(o);
    }
    const freeSlot = billboard && kind !== 'lot' ? '95,95' : null;
    if (kind === 'zone') {
      const els = design.parts.map((p, k) => place(p, c.u + p.du, c.v + p.dv, { cls: 'bld bld-' + zone + (k ? ' bld-part' : ''), color: ZONE_COLORS[zone], pad: 30,
        spec: { kind: 'zone', zone, part: k, color: ZONE_COLORS[zone] } }));
      const main = els[0];
      zones.push({ zone, x: main.x, y: main.y, u: c.u, v: c.v, a: design.area.a, b: design.area.b,
        labelY: main.y - design.labelH - 18, objs: els, halo: halos[zone] });
      const corners = { projects: [], lab: [[-1, 1]], about: [[1, -1]], secret: [] }[zone] ?? [[-1, 1], [1, -1]];
      corners.forEach(([su, sv]) => place(treeShape(r, false), c.u + su * 160, c.v + sv * 160, { cls: 'prop' }));
      if (zone === 'secret') {
        place(treeShape(r, true), c.u - 130, c.v - 40, { cls: 'prop' });
        place(treeShape(r, true), c.u - 40, c.v - 140, { cls: 'prop' });
        place(treeShape(r, false), c.u - 150, c.v - 140, { cls: 'prop' });
      }
      if (zone === 'about') place(treeShape(r, true), c.u - 140, c.v + 130, { cls: 'prop' });
    } else if (kind === 'plaza') {
      place(monumentShape(), c.u, c.v, { cls: 'bld bld-plaza', color: ZONE_COLORS.main });
      [[-1, -1], [1, -1], [-1, 1]].forEach(([su, sv]) => place(treeShape(r, true), c.u + su * 165, c.v + sv * 165, { cls: 'prop' }));
      spawn = S(c.u + 95, c.v + 95);
      // the JOPES car, parked on the street right next to the spawn point
      const ps = S(c.u + half + 30, c.v + 70);
      playerCar = makeCar(c.u + half + 30, c.v + 70, 2, '#FFE600', { special: true });
    } else if (kind === 'park') {
      for (let gu = -1; gu <= 1; gu++) for (let gv = -1; gv <= 1; gv++) {
        if (r() < 0.2) continue;
        if (freeSlot && gu === 1 && gv === 1) continue;
        const tu = c.u + gu * 110 + (r() - 0.5) * 50, tv = c.v + gv * 110 + (r() - 0.5) * 50;
        place(treeShape(r, r() < 0.4), tu, tv, { cls: 'prop' });
        if (r() < 0.5) place(bushShape(r), tu + 45, tv + 20, { cls: 'prop' });
      }
    } else if (kind === 'lowrise') {
      [[-95, -95], [95, -95], [-95, 95], [95, 95]].forEach(([du, dv]) => {
        if (freeSlot === du + ',' + dv) return;
        if (r() < 0.25) return;
        const a = 40 + r() * 34, b = 40 + r() * 34, h = 30 + r() * (r() < 0.3 ? 170 : 80);
        place(lowriseShape(r, a, b, h), c.u + du, c.v + dv, { cls: 'filler' });
      });
    } else if (kind === 'lot') {
      for (let n = -3; n <= 2; n++) {
        if (r() < 0.45) continue;
        const side = r() < 0.5 ? -80 : 80;
        makeCar(c.u + side, c.v + n * 44 + 22, side < 0 ? 0 : 4, CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]);
      }
    }
  });

  // traffic lights on the corners of the central junctions
  let sigN = 0;
  const signals = {};
  for (let ki = 1; ki <= 4; ki++) for (let kj = 1; kj <= 4; kj++) {
    const cu = ki * BLOCK, cv = kj * BLOCK, s = S(cu, cv);
    if (s.x < 200 || s.x > mapPx - 200 || s.y < 200 || s.y > mapPx - 200) continue;
    signals[ki + ',' + kj] = sigN;
    place(signalShape(sigN++), cu + ROAD / 2 + 12, cv - ROAD / 2 - 12, { cls: 'prop' });
  }
  // street lights: real objects now (depth-sorted, 3D), not paint on the ground
  lamps.forEach(l => place(lampShape(l), l.u, l.v, { cls: 'prop lamp', solid: false }));
  // Light state, in sync with the CSS animation of the signal heads (9 s cycle,
  // each junction offset by 2.3 s): the head shows the u-road; the v-road is the inverse.
  function lightAt(ki, kj, axis) {
    const k = signals[ki + ',' + kj];
    if (k === undefined) return 'g';
    const t = (document.timeline?.currentTime ?? performance.now()) / 1000;
    const p = ((t + k * 2.3) % 9) / 9;
    if (axis === 'u') return p < 0.45 ? 'g' : p < 0.55 ? 'a' : 'r';
    return p < 0.55 ? 'r' : p < 0.92 ? 'g' : 'a';
  }

  /* ── traffic: cars looping along lanes ─────────────────────────────
     Right-hand traffic: along a u-road (v = kB) cars going +u use the
     lane at v = kB + LANE; going -u use v = kB - LANE. Same for v-roads. */
  const traffic = [
    { axis: 'u', k: 2, dir: 1 }, { axis: 'u', k: 3, dir: -1 }, { axis: 'u', k: 1, dir: 1 },
    { axis: 'v', k: 2, dir: 1 }, { axis: 'v', k: 3, dir: -1 }, { axis: 'v', k: 4, dir: 1 },
    { axis: 'u', k: 4, dir: -1 }, { axis: 'u', k: 2, dir: -1 }, { axis: 'v', k: 1, dir: -1 }, { axis: 'v', k: 2, dir: -1 },
  ];
  const tr = rng(99);
  traffic.forEach((t, n) => {
    const fixed = t.k * BLOCK + (t.axis === 'u' ? t.dir * LANE : -t.dir * LANE);
    // range of the moving coordinate that keeps the car on the map
    const range = [];
    for (let m = -1500; m <= 4500; m += 10) {
      const s = t.axis === 'u' ? S(m, fixed) : S(fixed, m);
      if (s.x > 40 && s.x < mapPx - 40 && s.y > 40 && s.y < mapPx - 40) range.push(m);
    }
    if (!range.length) return;
    const lo = range[0], hi = range[range.length - 1];
    const pos = lo + (hi - lo) * ((n * 0.37 + tr()) % 1);
    const u = t.axis === 'u' ? pos : fixed, v = t.axis === 'u' ? fixed : pos;
    const k = t.axis === 'u' ? (t.dir > 0 ? 0 : 4) : (t.dir > 0 ? 2 : 6);
    makeCar(u, v, k, CAR_COLORS[n % CAR_COLORS.length], { ai: { axis: t.axis, dir: t.dir, lo, hi, speed: 120 + tr() * 50 } });
  });

  /* ── pedestrians: loops on the sidewalk ring of the blocks around the centre ── */
  const peds = [];
  const ring = half - 13;
  const pr = rng(4242);
  // off for now (set to true, or open the page with ?peds, to bring them back)
  const PEDS_ON = /[?&]peds\b/.test(location.search);
  if (PEDS_ON) blocks.slice().sort((p, q) => Math.hypot(p.s.x - pc.x, p.s.y - pc.y) - Math.hypot(q.s.x - pc.x, q.s.y - pc.y)).slice(0, 14).forEach(b => {
    const n = 1 + Math.floor(pr() * 2);
    for (let k = 0; k < n; k++) {
      const o = { ped: true, cu: b.c.u, cv: b.c.v, t: pr(), dir: pr() < 0.5 ? 1 : -1, speed: 24 + pr() * 14, style: Math.floor(pr() * 6),
        a: 5, b: 5, solid: false, z: 0, heading: -1, frame: -1, bbox: {} };
      o.el = addEl(`<div class="obj ped" style="width:${PED_VB.w}px;height:${PED_VB.h}px">${pedSVG(o.style)}</div>`, 0, 0, 0);
      peds.push(o); objects.push(o);
    }
  });
  function pedPos(o) {          // perimeter parameter t∈[0,1) → (u, v, heading)
    const r = ring, L = 8 * r, d = ((o.t % 1) + 1) % 1 * L;
    const side = Math.floor(d / (2 * r)), f = d - side * 2 * r;
    const pts = [[-r + f, -r, 0], [r, -r + f, 2], [r - f, r, 4], [-r, r - f, 6]][side];
    return { u: o.cu + pts[0], v: o.cv + pts[1], k: (pts[2] + (o.dir < 0 ? 4 : 0)) % 8 };
  }
  function updatePeds(dt, now) {
    for (const o of peds) {
      o.t += o.dir * o.speed * dt / (8 * ring);
      const p = pedPos(o), sp = S(p.u, p.v);
      o.u = p.u; o.v = p.v; o.x = sp.x; o.y = sp.y;
      o.el.style.left = (sp.x + PED_VB.x) + 'px'; o.el.style.top = (sp.y + PED_VB.y) + 'px';
      o.bbox = { x0: sp.x - 10, y0: sp.y - 34, x1: sp.x + 10, y1: sp.y + 4 };
      const f = Math.floor(now / 140 + o.style) % 4;
      if (GL && (p.k !== o.heading || f !== o.frame)) {
        o.heading = p.k; o.frame = f;
        const ctx = o.canvas.getContext('2d'); ctx.clearRect(0, 0, o.canvas.width, o.canvas.height);
        ctx.drawImage(GL.pedFrame(o.style, p.k, f), 0, 0, o.canvas.width, o.canvas.height);
      }
    }
  }

  /* ── elevated metro over the v-road at u = 2·BLOCK, station by the plaza ── */
  const MU = 2 * BLOCK;
  const along = [];
  for (let m = -1500; m <= 4500; m += 10) { const sp = S(MU, m); if (sp.x > 60 && sp.x < mapPx - 60 && sp.y > 60 && sp.y < mapPx - 60) along.push(m); }
  const vlo = along[0], vhi = along[along.length - 1];
  const stationV = (PLAZA_BLOCK[1] + 0.5) * BLOCK;
  for (let v = vlo + 50; v < vhi; v += 100) {
    const local = ((v % BLOCK) + BLOCK) % BLOCK;
    const pillar = local > ROAD / 2 + 30 && local < BLOCK - ROAD / 2 - 30;
    const o = place(viaductShape(100, pillar), MU, v, { cls: 'metro', solid: false, pad: 16 });
    if (pillar) objects.push({ u: MU, v, a: 6, b: 6, solid: true, el: document.createElement('i'), bbox: { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }, z: 0 });
  }
  place(stationShape(), MU, stationV, { cls: 'metro', solid: false, pad: 20 });
  const train = [];
  const metro = { v: stationV, dir: 1, speed: 0, wait: 3, cars: train, lo: vlo + 140, hi: vhi - 140, stationV };
  for (let k = 0; k < 3; k++) {
    const o = { train: true, cab: k !== 1, idx: k, a: 20, b: 36, solid: false, z: 0, bbox: {}, angle: Math.PI / 2, heading: 16 };
    o.el = addEl(trainSVG(16, o.cab), 0, 0, 0);
    train.push(o); objects.push(o);
  }
  function placeTrain() {
    train.forEach((o, k) => {
      const v = metro.v + (k - 1) * 100 * metro.dir, sp = S(MU, v);   // car spacing = the real-train car length
      o.u = MU; o.v = v; o.x = sp.x; o.y = sp.y;
      o.el.style.left = (sp.x + TRAIN_VB.x) + 'px'; o.el.style.top = (sp.y + TRAIN_VB.y) + 'px';
      o.bbox = { x0: sp.x - 60, y0: sp.y - 150, x1: sp.x + 60, y1: sp.y - 40 };
    });
  }
  function updateMetro(dt) {
    if (metro.wait > 0) { metro.wait -= dt; if (metro.wait <= 0) metro.speed = 0; return; }
    const target = 190;
    const toStation = (metro.stationV - metro.v) * metro.dir, toEnd = ((metro.dir > 0 ? metro.hi : metro.lo) - metro.v) * metro.dir;
    const stopIn = Math.min(toStation > 0 ? toStation : Infinity, toEnd);
    const brake = Math.sqrt(2 * 120 * Math.max(0, stopIn));                  // v² = 2·a·d
    metro.speed = Math.min(target, metro.speed + 90 * dt, brake);
    metro.v += metro.dir * Math.max(metro.speed, stopIn > 0.5 ? 6 : 0) * dt;
    if (toStation > 0 && toStation < 1.5) { metro.v = metro.stationV; metro.wait = 4; }
    else if (toEnd < 1.5) {                       // end of the line: wait, turn around
      metro.wait = 3; metro.dir *= -1;
      const ang = metro.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      train.forEach(o => { o.angle = ang; o.heading = metro.dir > 0 ? 16 : 48; if (GL) GL.drawTrain(o); else o.el.innerHTML = trainSVG(o.heading, o.cab).replace(/^<svg[^>]*>|<\/svg>$/g, ''); });
      metro.v += metro.dir * 2;
    }
    placeTrain();
  }
  placeTrain();

  const roads = [];
  for (let k = minK; k <= maxK; k++) roads.push({ a: S(minK * BLOCK, k * BLOCK), b: S(maxK * BLOCK, k * BLOCK) }, { a: S(k * BLOCK, minK * BLOCK), b: S(k * BLOCK, maxK * BLOCK) });

  // NPC spots: on the sidewalk in front of the building they talk about
  const Z = Object.fromEntries(zones.map(z => [z.zone, z]));
  const npcSpots = {
    main:  S(Z.main.u + 10, Z.main.v + 160),
    lab:   S(Z.lab.u + 70, Z.lab.v + 120),
    stack: S(Z.stack.u + 160, Z.stack.v - 20),
  };

  /* ── helicopter: parked on the HQ helipad (pad centre (8,8) from the tower, roof at h=326) ── */
  const HELI_ROOF_H = 326;
  const heli = { heli: true, a: 40, b: 40, solid: false, skipDepth: true, cache: {}, color: '#FFE600',
    heading: -1, angle: Math.PI / 4, h: HELI_ROOF_H, state: 'roof', vx: 0, vy: 0, bbox: {}, z: 0 };
  heli.shadow = addEl(`<svg class="heli-shadow" xmlns="http://www.w3.org/2000/svg" viewBox="-105 -52 210 104" width="210" height="104"><ellipse rx="66" ry="33"/></svg>`, 0, 0, 1);
  heli.el = addEl(heliSVG(8, heli.color), 0, 0, 0);
  heli.heading = 8; heli.cache[8] = heli.el.outerHTML;
  function setHeliHeading(o, angle) {
    if (GL) { o.angle = angle; GL.drawHeli(o); return; }
    const q = ((Math.round(angle / (2 * Math.PI) * CAR_DIRS) % CAR_DIRS) + CAR_DIRS) % CAR_DIRS;
    if (o.heading === q) return;
    o.heading = q;
    const holder = document.createElement('div');
    holder.innerHTML = o.cache[q] || (o.cache[q] = heliSVG(q, o.color));
    const el = holder.firstChild;
    el.style.cssText = o.el.style.cssText;
    o.el.classList.forEach(c => el.classList.add(c));
    o.el.replaceWith(el); o.el = el;
  }
  function moveHeli(o, x, y, h) {
    const p = I(x, y);
    o.u = p.u; o.v = p.v; o.x = x; o.y = y; o.h = h;
    o.el.style.left = (x + CAR_VB.x) + 'px';
    o.el.style.top = (y - h + CAR_VB.y) + 'px';
    o.shadow.style.left = (x - 105) + 'px';
    o.shadow.style.top = (y - 52) + 'px';
    o.shadow.style.opacity = Math.max(0.12, 0.6 - h / 900);
    o.shadow.style.display = (o.state === 'roof') ? 'none' : '';
    o.bbox = { x0: x - 90, y0: y - h - 90, x1: x + 90, y1: y - h + 38 };
  }
  const pad = S(Z.main.u + 8, Z.main.v + 8);
  heli.pad = { x: pad.x, y: pad.y, h: HELI_ROOF_H };
  moveHeli(heli, pad.x, pad.y, HELI_ROOF_H);
  heli.el.style.zIndex = Z.main.objs[0].z + 2;
  objects.push(heli);

  /* ── the airliner: lands on the airport runway, rolls out, turns round and takes off again ── */
  const plane = addEl(`<div class="obj plane-air" style="width:640px;height:440px;opacity:0"></div>`, 0, 0, 100000);

  /* ── 3D vehicles (vehicles.js): swap each vehicle's SVG for [ground SVG + canvas] ── */
  let GL = null;
  function glBox(o, cls) {
    const div = document.createElement('div');
    div.className = cls;
    o.el.classList.forEach(c => div.classList.add(c));
    div.style.cssText = o.el.style.cssText;
    div.style.width = CAR_VB.w + 'px'; div.style.height = CAR_VB.h + 'px';
    const cv = document.createElement('canvas');
    cv.width = Math.round(GL.W * GL.DPR); cv.height = Math.round(GL.H * GL.DPR);
    cv.className = 'veh-canvas';
    o.el.replaceWith(div); o.el = div; o.canvas = cv;
    return { div, cv };
  }
  function attachGL(gl) {
    GL = gl;
    for (const o of cars) {
      const { div, cv } = glBox(o, 'obj car gl');
      if (o.ai) div.classList.add('ai-car');
      div.insertAdjacentHTML('beforeend', carSVG(o.heading, o.color, o.special, '', 0, true));
      o.under = div.querySelector('.car-under');
      div.appendChild(cv);
      gl.drawCar(o);
    }
    { const { div, cv } = glBox(heli, 'obj heli gl'); div.appendChild(cv); gl.drawHeli(heli); }
    for (const o of peds) {
      const cv = document.createElement('canvas');
      cv.width = Math.round(PED_VB.w * gl.DPR); cv.height = Math.round(PED_VB.h * gl.DPR); cv.className = 'veh-canvas ped-canvas';
      o.el.innerHTML = ''; o.el.appendChild(cv); o.canvas = cv; o.heading = -1;
    }
    for (const o of train) {
      const div = document.createElement('div');
      o.el.classList.forEach(c => div.classList.add(c)); div.classList.add('gl');
      div.style.cssText = o.el.style.cssText; div.style.width = TRAIN_VB.w + 'px'; div.style.height = TRAIN_VB.h + 'px';
      const cv = document.createElement('canvas'); cv.width = Math.round(TRAIN_VB.w * gl.DPR); cv.height = Math.round(TRAIN_VB.h * gl.DPR); cv.className = 'veh-canvas train-canvas';
      div.appendChild(cv); o.el.replaceWith(div); o.el = div; o.canvas = cv;
      gl.drawTrain(o);
    }
    {
      const B = gl.PLANE_BOX, mk = flip => { const cv = document.createElement('canvas'); cv.width = Math.round(B.w * gl.DPR); cv.height = Math.round(B.h * gl.DPR);
        cv.style.cssText = `position:absolute;left:0;top:0;width:${B.w}px;height:${B.h}px;pointer-events:none`; plane.appendChild(cv); gl.drawPlane(cv, flip); return cv; };
      plane.innerHTML = ''; plane.cvs = [mk(false), mk(true)];          // facing +u (landing) and −u (taking off)
      const at = (u, h) => { const p = S(u, RUNWAY.v); return `translate(${(p.x + B.x).toFixed(1)}px, ${(p.y + B.y - h).toFixed(1)}px)`; };
      const { u0, u1 } = RUNWAY, far = 2600, D = 64000;
      // approach → flare/touchdown → roll-out → hold → (turned round) take-off roll → climb-out → empty sky
      plane.animate([
        { transform: at(u0 - far, 620), opacity: 0, offset: 0 },
        { transform: at(u0 - far * 0.85, 540), opacity: 1, offset: 0.03 },
        { transform: at(u0 + 60, 0), offset: 0.26, easing: 'cubic-bezier(.2,.6,.4,1)' },
        { transform: at(u1 - 260, 0), offset: 0.38 },
        { transform: at(u1 - 260, 0), offset: 0.48 },
        { transform: at(u1 - 260, 0), offset: 0.5, easing: 'cubic-bezier(.6,0,.9,.6)' },
        { transform: at(u0 + 200, 0), offset: 0.6, easing: 'cubic-bezier(.3,0,.6,1)' },
        { transform: at(u0 - far * 0.5, 380), offset: 0.74 },
        { transform: at(u0 - far, 640), opacity: 1, offset: 0.82 },
        { transform: at(u0 - far, 640), opacity: 0, offset: 0.83 },
        { transform: at(u0 - far, 620), opacity: 0, offset: 1 },
      ], { duration: D, iterations: Infinity, delay: 2000 });
      const swap = [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 0.49 }, { opacity: 0, offset: 0.4901 }, { opacity: 0, offset: 1 }];
      plane.cvs[0].animate(swap, { duration: D, iterations: Infinity, delay: 2000 });
      plane.cvs[1].animate(swap.map(k => ({ ...k, opacity: 1 - k.opacity })), { duration: D, iterations: Infinity, delay: 2000 });
    }
    // new light → redraw every vehicle (vehicles.js already switched its lights)
    window.addEventListener('train:model', () => train.forEach(o => gl.drawTrain(o)));
    window.addEventListener('city:period', () => { cars.forEach(o => gl.drawCar(o)); gl.drawHeli(heli); plane.cvs.forEach((cv, k) => gl.drawPlane(cv, k === 1)); train.forEach(o => gl.drawTrain(o)); peds.forEach(o => { o.heading = -1; }); gl.clearPedCache?.(); });
    document.body.classList.add('gl-vehicles');
  }
  const getGL = () => GL;
  function redraw(o) { if (!GL) return; if (o.heli) GL.drawHeli(o); else GL.drawCar(o); }

  /* ── 3D buildings/props/ground (world3d.js) ──────────────────────────
     Every object that has a `spec` swaps its SVG for [canvas + fx SVG]: the
     canvas gets the 3D render, the fx layer keeps the animated details. */
  const groundData = { RUNWAY, mapPx, X0, BLOCK, ROAD, LANE, half, minK, maxK, lamps,
    blocks: blocks.map(b => ({ i: b.i, j: b.j, u: b.c.u, v: b.c.v, kind: b.kind, zone: b.zone })) };
  function attach3D(dpr, filter) {
    const list = [];
    for (const o of objects) {
      if (!o.spec || o.car || o.heli) continue;
      if (filter && !filter(o)) continue;
      const div = document.createElement('div');
      o.el.classList.forEach(c => div.classList.add(c));
      div.classList.add('g3');
      div.style.cssText = o.el.style.cssText;
      div.style.width = o.box.w + 'px'; div.style.height = o.box.h + 'px';
      if (o.el.style.color) div.style.color = o.el.style.color;
      const cv = document.createElement('canvas');
      cv.width = Math.floor(o.box.w * dpr); cv.height = Math.floor(o.box.h * dpr);
      cv.style.width = (cv.width / dpr) + 'px'; cv.style.height = (cv.height / dpr) + 'px';
      cv.className = 'g3-canvas';
      div.appendChild(cv);
      if (o.fxHtml) div.insertAdjacentHTML('beforeend', o.fxHtml);
      o.svgEl = o.el; o.canvas = cv; o.el3 = div;
      list.push(o);
    }
    return list;
  }
  // swap one object to its 3D element (called once its canvas has been drawn)
  function show3D(o) {
    if (!o.el3 || o.el === o.el3) return;
    o.el.classList.forEach(c => o.el3.classList.add(c));   // lit / near / xray set meanwhile
    o.el3.style.zIndex = o.el.style.zIndex;
    o.el.replaceWith(o.el3); o.el = o.el3;
  }
  function setGround3D(canvas) {
    groundEl.querySelectorAll('.ground-3d').forEach(c => c.remove());
    canvas.className = 'ground-3d';
    groundEl.insertBefore(canvas, groundEl.firstChild);
    const base = groundEl.querySelector('.ground-base');
    if (base) base.style.display = 'none';
  }

  return { RUNWAY, S, I, zones, objects, cars, playerCar, spawn, npcSpots, roads, colors: ZONE_COLORS, moveCar, setCarHeading,
           heli, moveHeli, setHeliHeading, attachGL, redraw, getGL, get gl() { return !!GL; },
           groundData, attach3D, show3D, setGround3D, billboards, lightAt, BLOCK, ROAD,
           peds, updatePeds, train, updateMetro, metro, PED_VB, TRAIN_VB };
}

window.City = { build, ZONE_COLORS };
})();
