/* =========================================================
   Palavras cruzadas: gera a grade a partir de uma lista de
   palavras (sempre a mesma grade para a mesma lista) e cuida
   da interação. Uso: Crossword.mount({ ...opções })
   ========================================================= */
(function () {
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const key = (r, c) => `${r},${c}`;

  function rng(seed) { // mulberry32: aleatório, mas reproduzível
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- geração da grade ---------- */
  function tryLayout(words, rand, maxSize) {
    const cells = new Map(); // "r,c" -> { ch, dirs: Set }
    const placed = [];
    let box = { r0: 0, r1: 0, c0: 0, c1: 0 };
    const order = [...words].sort((a, b) => b.a.length - a.a.length + (rand() - 0.5) * 3);

    const fits = (w, r, c, dir) => {
      const dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      if (cells.has(key(r - dr, c - dc)) || cells.has(key(r + dr * w.length, c + dc * w.length))) return -1;
      let cross = 0;
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, cell = cells.get(key(rr, cc));
        if (cell) {
          if (cell.ch !== w[i] || cell.dirs.has(dir)) return -1;
          cross++;
        } else if (dir === 'across' ? (cells.has(key(rr - 1, cc)) || cells.has(key(rr + 1, cc)))
                                    : (cells.has(key(rr, cc - 1)) || cells.has(key(rr, cc + 1)))) return -1;
      }
      const end = { r: r + dr * (w.length - 1), c: c + dc * (w.length - 1) };
      const nb = { r0: Math.min(box.r0, r), r1: Math.max(box.r1, end.r), c0: Math.min(box.c0, c), c1: Math.max(box.c1, end.c) };
      if (nb.r1 - nb.r0 + 1 > maxSize || nb.c1 - nb.c0 + 1 > maxSize) return -1;
      return cross;
    };
    const put = (word, r, c, dir) => {
      const dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0;
      for (let i = 0; i < word.a.length; i++) {
        const k = key(r + dr * i, c + dc * i);
        const cell = cells.get(k) || { ch: word.a[i], dirs: new Set() };
        cell.dirs.add(dir); cells.set(k, cell);
      }
      const end = { r: r + dr * (word.a.length - 1), c: c + dc * (word.a.length - 1) };
      box = { r0: Math.min(box.r0, r), r1: Math.max(box.r1, end.r), c0: Math.min(box.c0, c), c1: Math.max(box.c1, end.c) };
      placed.push({ ...word, r, c, dir });
    };

    put(order[0], 0, 0, 'across');
    box = { r0: 0, r1: 0, c0: 0, c1: order[0].a.length - 1 };
    const skipped = [];
    for (const w of order.slice(1)) {
      let best = null;
      for (const [k, cell] of cells) {
        const [cr, cc] = k.split(',').map(Number);
        for (let j = 0; j < w.a.length; j++) {
          if (w.a[j] !== cell.ch) continue;
          for (const dir of ['across', 'down']) {
            if (cell.dirs.has(dir)) continue;
            const r = dir === 'down' ? cr - j : cr, c = dir === 'across' ? cc - j : cc;
            const cross = fits(w.a, r, c, dir);
            if (cross < 1) continue;
            const score = cross * 10 + rand();
            if (!best || score > best.score) best = { r, c, dir, score };
          }
        }
      }
      if (best) put(w, best.r, best.c, best.dir); else skipped.push(w);
    }
    return { placed, skipped, box };
  }

  function generate(words, maxSize = 13) {
    let best = null;
    for (let s = 1; s <= 120; s++) {
      const lay = tryLayout(words, rng(s * 7919), maxSize);
      const area = (lay.box.r1 - lay.box.r0 + 1) * (lay.box.c1 - lay.box.c0 + 1);
      const score = lay.placed.length * 10000 - area;
      if (!best || score > best.score) best = { ...lay, score };
      if (!lay.skipped.length && s > 40) break;
    }
    // normaliza para começar em 0,0 e numera como num jornal
    const { r0, c0 } = best.box;
    const words2 = best.placed.map((w) => ({ ...w, r: w.r - r0, c: w.c - c0 }));
    const rows = best.box.r1 - r0 + 1, cols = best.box.c1 - c0 + 1;
    const starts = new Map();
    words2.forEach((w) => starts.set(key(w.r, w.c), true));
    let n = 0;
    const numAt = new Map();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (starts.has(key(r, c))) numAt.set(key(r, c), ++n);
    words2.forEach((w) => { w.num = numAt.get(key(w.r, w.c)); });
    words2.sort((a, b) => a.num - b.num);
    return { words: words2, rows, cols, numAt, skipped: best.skipped };
  }

  /* ---------- interação ---------- */
  function mount(o) {
    const words = o.words.map((w) => ({ ...w, a: strip(w.a) }));
    const puzzle = generate(words);
    const W = puzzle.words;
    W.forEach((w, i) => {
      w.id = i;
      w.cells = [...w.a].map((_, j) => key(w.r + (w.dir === 'down' ? j : 0), w.c + (w.dir === 'across' ? j : 0)));
    });
    const sol = new Map();
    const owners = new Map(); // célula -> ids das palavras
    W.forEach((w) => w.cells.forEach((k, j) => { sol.set(k, w.a[j]); owners.set(k, [...(owners.get(k) || []), w.id]); }));

    let state = { entries: {}, found: [], revealed: [] };
    try { state = { ...state, ...JSON.parse(localStorage.getItem(o.storageKey) || '{}') }; } catch { /* ok */ }
    const save = () => { try { localStorage.setItem(o.storageKey, JSON.stringify(state)); } catch { /* ok */ } };

    let cur = W[0].id, dir = W[0].dir, focusKey = W[0].cells[0];
    let flash = null; // palavra recém-encontrada: a explicação aparece logo abaixo da grade

    // grade
    const grid = o.grid;
    grid.style.setProperty('--cols', puzzle.cols);
    grid.style.setProperty('--rows', puzzle.rows);
    let html = '';
    for (let r = 0; r < puzzle.rows; r++) {
      for (let c = 0; c < puzzle.cols; c++) {
        const k = key(r, c);
        if (!sol.has(k)) { html += '<div class="xw-cell blank"></div>'; continue; }
        const num = puzzle.numAt.get(k);
        html += `<div class="xw-cell" data-k="${k}">${num ? `<span class="xw-num">${num}</span>` : ''}<input maxlength="2" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${o.t('pz.cellLabel', { r: r + 1, c: c + 1 })}" value="${state.entries[k] || ''}"></div>`;
      }
    }
    grid.innerHTML = html;
    const cellEl = (k) => grid.querySelector(`[data-k="${k}"]`);
    const input = (k) => cellEl(k)?.querySelector('input');

    // dicas
    const clueHTML = (w) => `<li data-w="${w.id}" value="${w.num}"><b>${w.num}</b> ${o.esc(w.clue)} <span class="xw-len">(${w.a.length})</span></li>`;
    o.across.innerHTML = W.filter((w) => w.dir === 'across').map(clueHTML).join('');
    o.down.innerHTML = W.filter((w) => w.dir === 'down').map(clueHTML).join('');

    const isDone = (w) => w.cells.every((k) => (state.entries[k] || '') === sol.get(k));

    function paint() {
      grid.querySelectorAll('.xw-cell[data-k]').forEach((el) => {
        const k = el.dataset.k;
        el.classList.toggle('hl', W[cur].cells.includes(k));
        el.classList.toggle('focus', k === focusKey);
        el.classList.toggle('ok', owners.get(k).some((id) => state.found.includes(id)));
        el.classList.toggle('rev', state.revealed.includes(k));
      });
      [o.across, o.down].forEach((ol) => ol.querySelectorAll('li').forEach((li) => {
        const id = +li.dataset.w;
        li.classList.toggle('on', id === cur);
        li.classList.toggle('done', state.found.includes(id));
      }));
      const w = W[cur];
      if (flash != null) {
        const f = W[flash];
        o.current.classList.add('found');
        o.current.innerHTML = `<b>✓ ${o.t('pz.gotit', { w: f.a })}</b> ${o.esc(f.why)}${f.link ? ` <a class="more-link" href="#/materia/${f.link}">${o.t('pz.readStory')}</a>` : ''}`;
      } else {
        o.current.classList.remove('found');
        o.current.innerHTML = `<b>${w.num} ${o.t(w.dir === 'across' ? 'pz.acrossOne' : 'pz.downOne')}</b> ${o.esc(w.clue)}`;
      }
      o.progress.textContent = o.t('pz.progress', { a: state.found.length, b: W.length });
    }

    function renderExplain(newId) {
      if (!state.found.length) { o.explain.innerHTML = `<p class="xw-empty">${o.t('pz.empty')}</p>`; return; }
      const list = [...state.found].reverse().map((id) => W[id]);
      o.explain.innerHTML = list.map((w) => `
        <article class="xw-card${w.id === newId ? ' new' : ''}">
          <span class="kicker">${w.num} ${o.t(w.dir === 'across' ? 'pz.acrossOne' : 'pz.downOne')}</span>
          <h4>${w.a}</h4>
          <p>${o.esc(w.why)}</p>
          ${w.link ? `<a class="more-link" href="#/materia/${w.link}">${o.t('pz.readStory')}</a>` : ''}
        </article>`).join('');
    }

    function checkWords(k, silent) {
      for (const id of owners.get(k) || []) {
        if (state.found.includes(id) || !isDone(W[id])) continue;
        state.found.push(id);
        if (!silent) {
          flash = id;
          o.onFound?.(W[id], state.found.length === W.length);
          W[id].cells.forEach((ck, i) => {
            const el = cellEl(ck);
            el.style.setProperty('--d', `${i * 45}ms`);
            el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
          });
        }
        renderExplain(silent ? null : id);
      }
    }

    function focusCell(k, keepDir) {
      focusKey = k;
      const ids = owners.get(k);
      if (!keepDir || !ids.includes(cur)) {
        const same = ids.find((id) => W[id].dir === dir);
        cur = same ?? ids[0];
        dir = W[cur].dir;
      }
      const inp = input(k);
      if (inp) {
        if (document.activeElement !== inp) inp.focus({ preventScroll: true });
        inp.select(); // no celular, a próxima letra substitui a atual
      }
      paint();
    }
    function step(delta) {
      const w = W[cur], i = w.cells.indexOf(focusKey) + delta;
      if (i >= 0 && i < w.cells.length) focusCell(w.cells[i], true);
    }
    function move(dr, dc) {
      const [r, c] = focusKey.split(',').map(Number);
      for (let n = 1; n < 20; n++) {
        const k = key(r + dr * n, c + dc * n);
        if (sol.has(k)) { dir = dc ? 'across' : 'down'; return focusCell(k); }
        if (r + dr * n < 0 || c + dc * n < 0 || r + dr * n >= puzzle.rows || c + dc * n >= puzzle.cols) return;
      }
    }
    function setLetter(k, ch) {
      if (state.found.some((id) => W[id].cells.includes(k)) && state.entries[k] === sol.get(k)) { input(k).value = state.entries[k]; return; }
      state.entries[k] = ch;
      input(k).value = ch;
      cellEl(k).classList.remove('bad');
      checkWords(k);
      save();
      paint();
    }

    grid.addEventListener('mousedown', (e) => {
      const el = e.target.closest('.xw-cell[data-k]');
      if (!el) return;
      e.preventDefault();
      flash = null;
      const k = el.dataset.k;
      if (k === focusKey && owners.get(k).length > 1) { // segundo clique alterna direção
        cur = owners.get(k).find((id) => id !== cur); dir = W[cur].dir; focusCell(k, true);
      } else focusCell(k);
    });
    grid.addEventListener('focusin', (e) => {
      const el = e.target.closest('.xw-cell[data-k]');
      if (el && el.dataset.k !== focusKey) focusCell(el.dataset.k);
    });
    // Teclado físico: a letra vem da tecla (keydown), nunca do conteúdo da casa.
    // Assim digitar numa casa já preenchida substitui a letra em vez de juntar duas.
    // Teclado de celular (que manda key "Unidentified") cai no evento input abaixo.
    grid.addEventListener('input', (e) => {
      const el = e.target.closest('.xw-cell[data-k]');
      if (!el) return;
      const typed = e.data != null ? e.data : e.target.value.replace(state.entries[el.dataset.k] || '', '');
      const ch = strip(typed || '').replace(/[^A-Z]/g, '').slice(-1);
      if (!ch) { e.target.value = state.entries[el.dataset.k] || ''; return; }
      setLetter(el.dataset.k, ch);
      step(1);
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const ch = strip(e.key).replace(/[^A-Z]/g, '');
        if (!ch) return;
        if (e.repeat) return; // segurar a tecla não sai preenchendo a palavra toda
        setLetter(focusKey, ch);
        step(1);
        return;
      }
      const map = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
      if (map[e.key]) { e.preventDefault(); flash = null; return move(...map[e.key]); }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (state.entries[focusKey] && !cellEl(focusKey).classList.contains('ok')) setLetter(focusKey, '');
        else { step(-1); if (!cellEl(focusKey).classList.contains('ok')) setLetter(focusKey, ''); }
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        flash = null;
        const next = W[(cur + (e.shiftKey ? W.length - 1 : 1)) % W.length];
        dir = next.dir; cur = next.id; focusCell(next.cells[0], true);
      }
    });
    const clueClick = (e) => {
      const li = e.target.closest('li[data-w]');
      if (!li) return;
      flash = null;
      const w = W[+li.dataset.w];
      cur = w.id; dir = w.dir;
      focusCell(w.cells[0], true); // sempre do começo: cada tecla = uma casa
    };
    o.across.addEventListener('click', clueClick);
    o.down.addEventListener('click', clueClick);

    o.tools.hint.onclick = () => {
      const w = W[cur];
      const k = w.cells.find((ck) => state.entries[ck] !== sol.get(ck));
      if (!k) return;
      state.revealed.push(k);
      setLetter(k, sol.get(k));
      focusCell(k, true);
    };
    o.tools.check.onclick = () => {
      let bad = 0;
      sol.forEach((ch, k) => {
        const wrong = state.entries[k] && state.entries[k] !== ch;
        cellEl(k).classList.toggle('bad', !!wrong);
        if (wrong) bad++;
      });
      o.toast(bad ? o.t('pz.wrong', { n: bad }) : o.t('pz.allright'));
    };
    o.tools.reveal.onclick = () => {
      sol.forEach((ch, k) => { if (state.entries[k] !== ch) { state.entries[k] = ch; state.revealed.push(k); input(k).value = ch; } });
      W.forEach((w) => checkWords(w.cells[0], true));
      save(); paint(); renderExplain();
    };
    o.tools.reset.onclick = () => {
      state = { entries: {}, found: [], revealed: [] };
      grid.querySelectorAll('input').forEach((i) => { i.value = ''; });
      grid.querySelectorAll('.bad').forEach((el) => el.classList.remove('bad'));
      save(); renderExplain(); focusCell(W[0].cells[0]);
    };

    // tamanho das casas acompanha a largura disponível
    const fit = () => {
      const w = grid.parentElement.clientWidth;
      grid.style.setProperty('--cell', `${Math.max(24, Math.min(42, Math.floor((w - 2) / puzzle.cols)))}px`);
    };
    fit();
    if (o.ro) o.ro.disconnect();
    o.ro = new ResizeObserver(fit);
    o.ro.observe(grid.parentElement);

    renderExplain();
    paint();
    return { total: W.length, skipped: puzzle.skipped };
  }

  window.Crossword = { mount, generate };
})();
