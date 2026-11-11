/* ════════════════════════════════════════════════════════════════════
   JOPES.EXE — PLUS
   Coisas para fazer na cidade, além de visitar os prédios:

   • Cafés da redação: 12 xícaras espalhadas pelas calçadas. A pé ou de carro,
     é só passar por cima. +10 XP cada, missão ao achar todas.
   • Entrega expressa: de carro, passe pelo anel "PEDIDO" e siga os pontos de
     controle até o ERP. Cronômetro, medalha e melhor tempo salvo.
   • Retorno visual: "+XP" flutuando no personagem e confete ao fechar 100%.

   Script clássico carregado depois do jogo: usa as variáveis globais do
   index.html (CITY, playerPos, drivingCar, addXP, showToast…). O index.html
   chama JOPES_PLUS.update() a cada quadro e JOPES_PLUS.minimap() no minimapa.
   ════════════════════════════════════════════════════════════════════ */
(() => {
  const B = CITY.BLOCK, R = CITY.ROAD;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const css = document.createElement('style');
  css.textContent = `
  #worldPan .plus-coffee { position: absolute; width: 0; height: 0; pointer-events: none; }
  .plus-coffee i { position: absolute; left: -17px; top: -6px; width: 34px; height: 13px; border-radius: 50%; background: radial-gradient(closest-side, rgba(255,196,84,.55), rgba(255,196,84,0)); animation: plus-glow 1.6s ease-in-out infinite; }
  .plus-coffee svg { position: absolute; left: -13px; top: -40px; width: 26px; height: 34px; overflow: visible; animation: plus-bob 1.6s ease-in-out infinite; filter: drop-shadow(0 0 5px rgba(255,196,84,.75)); }
  .plus-coffee .steam { animation: plus-steam 1.8s linear infinite; transform-origin: 50% 100%; }
  .plus-coffee.got svg { animation: plus-got .45s ease-out forwards; }
  .plus-coffee.got i { display: none; }
  @keyframes plus-bob { 50% { transform: translateY(-6px); } }
  @keyframes plus-glow { 50% { opacity: .45; transform: scale(.8); } }
  @keyframes plus-steam { 0% { opacity: 0; transform: translateY(2px); } 40% { opacity: .9; } 100% { opacity: 0; transform: translateY(-7px); } }
  @keyframes plus-got { to { transform: translateY(-46px) scale(1.7); opacity: 0; } }

  #worldPan .plus-ring { position: absolute; width: 0; height: 0; pointer-events: none; z-index: 1; }
  .plus-ring svg { position: absolute; left: -110px; top: -55px; width: 220px; height: 110px; overflow: visible; }
  .plus-ring ellipse { fill: rgba(42,250,223,.07); stroke: var(--cyan); stroke-width: 3; stroke-dasharray: 14 9; animation: plus-dash 1.4s linear infinite; }
  .plus-ring .pulse { fill: none; stroke-dasharray: none; stroke-width: 2; transform-origin: 110px 55px; animation: plus-pulse 1.4s ease-out infinite; }
  .plus-ring.start ellipse { stroke: var(--accent); fill: rgba(255,230,0,.07); }
  .plus-ring.finish ellipse { stroke: var(--accent3); fill: rgba(0,255,136,.08); }
  @keyframes plus-dash { to { stroke-dashoffset: -46; } }
  @keyframes plus-pulse { from { transform: scale(.55); opacity: .9; } to { transform: scale(1.25); opacity: 0; } }
  #worldPan .plus-beam { position: absolute; width: 0; height: 0; pointer-events: none; }
  .plus-beam::before { content: ''; position: absolute; left: -9px; bottom: 0; width: 18px; height: 230px; background: linear-gradient(to top, var(--bc, #2AFADF), transparent); opacity: .5; border-radius: 9px; }
  .plus-beam b { position: absolute; left: 50%; bottom: 236px; transform: translateX(-50%); white-space: nowrap; font: 800 10px/1 'JetBrains Mono', monospace; letter-spacing: .16em; color: #06121c; background: var(--bc, #2AFADF); padding: 5px 8px 4px; border-radius: 99px; box-shadow: 0 4px 16px rgba(0,0,0,.5); }

  #plus-run { position: fixed; top: 74px; left: 50%; transform: translate(-50%, -8px); z-index: 21; display: flex; align-items: center; gap: 12px; padding: 8px 16px; border-radius: 99px; font: 700 11px/1 'JetBrains Mono', monospace; letter-spacing: .12em; color: #dbe7f3; background: rgba(9,14,24,.86); border: 1px solid rgba(42,250,223,.5); box-shadow: 0 8px 30px rgba(42,250,223,.18); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); opacity: 0; pointer-events: none; transition: opacity .25s, transform .25s; }
  #plus-run.on { opacity: 1; transform: translate(-50%, 0); }
  #plus-run time { font-size: 15px; font-weight: 800; color: var(--cyan); font-variant-numeric: tabular-nums; min-width: 66px; }
  #plus-run.done { border-color: var(--accent3); } #plus-run.done time { color: var(--accent3); }
  #plus-run small { font-size: 9.5px; color: #8fa3b5; }
  #plus-arrow { position: fixed; left: 0; top: 0; z-index: 19; width: 0; height: 0; pointer-events: none; opacity: 0; transition: opacity .2s; }
  #plus-arrow.on { opacity: 1; }
  #plus-arrow svg { position: absolute; left: -13px; top: -13px; width: 26px; height: 26px; filter: drop-shadow(0 0 6px rgba(42,250,223,.9)); }
  .plus-xp { position: fixed; z-index: 24; pointer-events: none; transform: translate(-50%, -50%); font: 800 14px/1 'JetBrains Mono', monospace; letter-spacing: .08em; color: var(--accent); text-shadow: 0 2px 0 #06121c, 0 0 12px rgba(255,230,0,.6); animation: plus-xp 1.15s ease-out forwards; }
  @keyframes plus-xp { 0% { opacity: 0; margin-top: 0; } 15% { opacity: 1; } 100% { opacity: 0; margin-top: -64px; } }
  #plus-confetti { position: fixed; inset: 0; z-index: 46; pointer-events: none; }
  body.touring #plus-run, body.touring #plus-arrow { opacity: 0 !important; }
  @media (pointer: coarse), (max-width: 760px) { #plus-run { top: calc(152px + env(safe-area-inset-top)); padding: 7px 13px; gap: 9px; } #plus-run small { display: none; } }
  @media (prefers-reduced-motion: reduce) { .plus-coffee svg, .plus-coffee i, .plus-coffee .steam, .plus-ring ellipse { animation: none; } }
  `;
  document.head.appendChild(css);

  const el = (cls, html, x, y, z) => {
    const d = document.createElement('div');
    d.className = cls; d.innerHTML = html;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    if (z != null) d.style.zIndex = z;
    worldPanEl.appendChild(d);
    return d;
  };
  const inMap = (x, y) => x > 130 && x < MAP_PX - 130 && y > 130 && y < MAP_PX - 130;

  /* ── cafés ───────────────────────────────────────────────────────── */
  const CUP = `<i></i><svg viewBox="0 0 26 34"><g class="steam" fill="none" stroke="#fff3d6" stroke-width="1.6" stroke-linecap="round"><path d="M9 9c-2-2 2-3 0-6"/><path d="M15 9c-2-2 2-3 0-6" style="animation-delay:-.6s"/></g>
    <path d="M4 13h16v9a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" fill="#fff8ea" stroke="#06121c" stroke-width="1.6"/><path d="M20 15h2.2a3.3 3.3 0 0 1 0 6.6H20" fill="none" stroke="#06121c" stroke-width="4"/><path d="M20 15h2.2a3.3 3.3 0 0 1 0 6.6H20" fill="none" stroke="#fff8ea" stroke-width="1.6"/>
    <path d="M5.4 14.4h13.2v2.4H5.4z" fill="#6b3d1e"/><path d="M2 31h20" stroke="#06121c" stroke-width="3" stroke-linecap="round"/><path d="M2 31h20" stroke="#FFE600" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  // [bloco i, bloco j, canto u (0/1), canto v (0/1)] — sempre na calçada, perto da esquina
  const SPOTS = [[2, 2, 1, 0], [1, 1, 0, 1], [0, 2, 1, 0], [2, 0, 0, 1], [3, 1, 1, 1], [3, 3, 1, 1],
                 [2, 3, 0, 1], [1, 3, 0, 0], [3, 2, 1, 0], [4, 3, 0, 0], [4, 4, 1, 0], [1, 0, 1, 1]];
  const edge = R / 2 + 26;
  const coffees = SPOTS.slice(0, COFFEE_TOTAL).map(([i, j, cu, cv], idx) => {
    const u = i * B + (cu ? B - edge : edge), v = j * B + (cv ? B - edge : edge);
    let { x, y } = CITY.S(u, v);
    // nunca dentro de um poste, banco ou árvore: procura o ponto livre mais próximo
    search: for (let r = 0; r <= 140; r += 20) for (let a = 0; a < 8; a++) {
      const nx = x + Math.cos(a * Math.PI / 4) * r, ny = y + Math.sin(a * Math.PI / 4) * r * 0.5;
      if (inMap(nx, ny) && !collidesAt(nx, ny, 22)) { x = nx; y = ny; break search; }
    }
    const c = { idx, x, y, got: coffeeGot.has(idx), el: null };
    if (!c.got) c.el = el('plus-coffee', CUP, x, y, spriteDepth(x, y, null, null, 13, 40));
    return c;
  });
  function collect(c) {
    c.got = true; coffeeGot.add(c.idx);
    c.el.classList.add('got'); setTimeout(() => c.el.remove(), 500);
    playSfx('coin');
    addXP(10);
    const n = coffeeGot.size;
    if (n >= coffees.length && !extrasDone.has('coffee')) {
      extrasDone.add('coffee');
      addXP(120);
      showToast(`REDAÇÃO ABASTECIDA — ${n}/${coffees.length} CAFÉS +120 XP`, 'star');
    } else showToast(`CAFÉ ${n}/${coffees.length} · +10 XP`, 'flame');
    renderQuestList();
    writeSave();
  }

  /* ── entrega expressa ────────────────────────────────────────────── */
  // pontos no meio das ruas (u, v): uma volta pelo centro, da loja B2B até o ERP
  const ROUTE = [[2.5, 3], [1.5, 3], [1, 2.5], [1, 1.5], [1.5, 1], [2.5, 1], [3, 1.5]].map(([a, b]) => ({ u: a * B, v: b * B, ...CITY.S(a * B, b * B) }));
  const LAST = ROUTE.length - 1;
  const RING = `<svg viewBox="0 0 220 110"><ellipse cx="110" cy="55" rx="100" ry="50"/><ellipse class="pulse" cx="110" cy="55" rx="100" ry="50"/></svg>`;
  const MEDALS = [[17, 'OURO'], [24, 'PRATA'], [Infinity, 'BRONZE']];
  const run = { active: false, i: 0, t: 0, ring: null, beam: null, hintAt: 0, doneUntil: 0 };
  const hud = document.createElement('div'); hud.id = 'plus-run';
  hud.innerHTML = '<span id="plus-run-l">ENTREGA</span><time id="plus-run-t">0.0s</time><small id="plus-run-s"></small>';
  document.body.appendChild(hud);
  const hudL = hud.querySelector('#plus-run-l'), hudT = hud.querySelector('#plus-run-t'), hudS = hud.querySelector('#plus-run-s');
  const arrow = document.createElement('div'); arrow.id = 'plus-arrow';
  arrow.innerHTML = '<svg viewBox="0 0 26 26"><path d="M24 13 6 3l4 10-4 10z" fill="#2AFADF" stroke="#06121c" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  document.body.appendChild(arrow);
  const fmt = s => s.toFixed(1).replace('.', ',') + 's';

  function mark(i) {
    run.ring?.remove(); run.beam?.remove();
    const p = ROUTE[i], kind = !run.active ? 'start' : i === LAST ? 'finish' : '';
    const col = kind === 'start' ? '#FFE600' : kind === 'finish' ? '#00FF88' : '#2AFADF';
    const label = kind === 'start' ? 'PEDIDO · ENTREGA EXPRESSA' : kind === 'finish' ? 'ERP · ENTREGAR AQUI' : `${i}/${LAST}`;
    run.ring = el('plus-ring ' + kind, RING, p.x, p.y);
    run.beam = el('plus-beam', `<b>${label}</b>`, p.x, p.y, Math.round(p.y));
    run.beam.style.setProperty('--bc', col);
  }
  function startRun() {
    run.active = true; run.i = 1; run.t = 0;
    playSfx('go');
    showToast('PEDIDO COLETADO — SIGA OS ANÉIS ATÉ O ERP', 'city');
    hud.classList.remove('done'); hud.classList.add('on');
    hudL.textContent = 'ENTREGA';
    mark(1);
  }
  function stopRun(msg) {
    run.active = false; run.i = 0;
    hud.classList.remove('on'); arrow.classList.remove('on');
    if (msg) showToast(msg, 'city');
    mark(0);
  }
  function finishRun() {
    const t = Math.round(run.t * 10) / 10, medal = MEDALS.find(([lim]) => t <= lim)[1];
    const record = bestDelivery == null || t < bestDelivery;
    if (record) bestDelivery = t;
    run.active = false; run.i = 0; run.doneUntil = performance.now() + 6000;
    arrow.classList.remove('on');
    hud.classList.add('done'); hudL.textContent = medal; hudT.textContent = fmt(t);
    hudS.textContent = record ? 'NOVO RECORDE' : 'RECORDE ' + fmt(bestDelivery);
    playSfx('complete');
    if (!extrasDone.has('delivery')) {
      extrasDone.add('delivery');
      addXP(100);
      showToast(`PEDIDO ENTREGUE 1× (SEM DUPLICIDADE) EM ${fmt(t)} · +100 XP`, 'star');
    } else showToast(`PEDIDO ENTREGUE EM ${fmt(t)} · ${medal}${record ? ' · NOVO RECORDE' : ''}`, 'star');
    renderQuestList();
    writeSave();
    mark(0);
  }
  mark(0);

  function updateRun(dt, now) {
    if (!run.active && run.doneUntil && now > run.doneUntil) { run.doneUntil = 0; hud.classList.remove('on'); }
    const target = ROUTE[run.i];
    const p = CITY.I(playerPos.x, playerPos.y);
    const d = Math.hypot(p.u - target.u, p.v - target.v), inside = d < 78;
    if (!run.active) {
      if (!inside || pilot) return;
      if (drivingCar) startRun();
      else if (now > run.hintAt) { run.hintAt = now + 9000; showToast('ENTREGA EXPRESSA: VOLTE DE CARRO E PASSE PELO ANEL', 'city'); }
      return;
    }
    if (!drivingCar) return stopRun('ENTREGA CANCELADA — O PEDIDO VOLTOU PARA A FILA');
    run.t += dt;
    if (run.t > 150) return stopRun('TIMEOUT — O PEDIDO VOLTOU PARA A FILA');
    hudT.textContent = fmt(run.t);
    hudS.textContent = `PONTO ${run.i}/${LAST}` + (bestDelivery != null ? ' · RECORDE ' + fmt(bestDelivery) : '');
    if (inside) {
      if (run.i === LAST) return finishRun();
      run.i++; playSfx('check'); mark(run.i);
      return;
    }
    // seta ao redor do carro apontando para o próximo anel (some quando ele já está perto na tela)
    const dx = (target.x - playerPos.x) * camNow.z, dy = (target.y - playerPos.y) * camNow.z, dist = Math.hypot(dx, dy);
    const show = dist > 190;
    arrow.classList.toggle('on', show);
    if (show) {
      const sx = (playerPos.x - camNow.x) * camNow.z, sy = (playerPos.y - camNow.y) * camNow.z, a = Math.atan2(dy, dx);
      arrow.style.transform = `translate(${(sx + Math.cos(a) * 92).toFixed(1)}px, ${(sy + Math.sin(a) * 92 - 14).toFixed(1)}px) rotate(${a.toFixed(3)}rad)`;
    }
  }

  /* ── "+XP" flutuando e confete ───────────────────────────────────── */
  let popStack = 0;
  function xpPop(amount) {
    if (!amount || typeof camNow === 'undefined' || !bootDone) return;
    const d = document.createElement('div');
    d.className = 'plus-xp'; d.textContent = `+${amount} XP`;
    d.style.left = ((playerPos.x - camNow.x) * camNow.z) + 'px';
    d.style.top = ((playerPos.y - camNow.y) * camNow.z - 70 - popStack * 20) + 'px';
    popStack++; setTimeout(() => { popStack = Math.max(0, popStack - 1); }, 500);
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  }
  function confetti() {
    if (REDUCE) return;
    const cv = document.createElement('canvas'); cv.id = 'plus-confetti';
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const colors = ['#FFE600', '#FF3CAC', '#00FF88', '#2AFADF', '#ffffff'];
    const parts = [...Array(150)].map((_, i) => ({
      x: innerWidth * (i % 2 ? 0.08 : 0.92), y: innerHeight * 0.75,
      vx: (i % 2 ? 1 : -1) * (180 + Math.random() * 520), vy: -(380 + Math.random() * 620),
      s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, c: colors[i % colors.length],
    }));
    let last = performance.now(), life = 0;
    (function step(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; life += dt;
      g.clearRect(0, 0, innerWidth, innerHeight);
      g.globalAlpha = Math.max(0, Math.min(1, 3.4 - life));
      for (const p of parts) {
        p.vy += 900 * dt; p.vx *= 1 - 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      }
      if (life < 3.4) requestAnimationFrame(step); else cv.remove();
    })(last);
  }

  /* ── ganchos chamados pelo index.html ────────────────────────────── */
  function update(dt, now) {
    if (overlayOpen || npcDialogOpen || tour.active) return;
    if (!pilot) {
      const reach = drivingCar ? 52 : 34;
      for (const c of coffees) if (!c.got && Math.abs(c.x - playerPos.x) < reach && Math.abs(c.y - playerPos.y) < reach * 0.7) collect(c);
    }
    updateRun(dt, now);
  }
  function minimap(ctx, k) {
    ctx.fillStyle = '#ffc454'; ctx.globalAlpha = 0.85;
    for (const c of coffees) if (!c.got) ctx.fillRect(5 + c.x * k - 1, 5 + c.y * k - 1, 2, 2);
    const p = ROUTE[run.i], t = (performance.now() / 700) % 1;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = run.active ? '#2AFADF' : '#FFE600'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(5 + p.x * k, 5 + p.y * k, 2 + t * 3, 0, Math.PI * 2); ctx.globalAlpha = 1 - t * 0.7; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  window.JOPES_PLUS = { update, minimap, xpPop, confetti, coffees, route: ROUTE, run };
})();
