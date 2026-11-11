/* =========================================================
   O JOPES — monta o jornal.
   Dados: data/profissionais.json (projetos profissionais, versão pública: sem
            nomes internos, marcas ou números da empresa; pt/en)
          data/edicao.json (perfil, carreira, skills, cartas e projetos pessoais)
   Textos de jornal: i18n.js
   ========================================================= */
const GAME_URL = 'rpg/';
const GH_USER = 'JoaoOliveira07';
const LEAD = 'integracao-erp';
const ROW3 = ['backend-ecommerce', 'app-vendas', 'commitclock'];
const MARKET_PTS = { 'IT Assistant': 21, 'Trainee Software Developer': 43, 'Junior Software Developer': 66, 'Mid-Level Software Developer': 98, 'Senior Software Developer': 124 };
const IPO = 21;
const AVATARS = { 'Alessandro Elias': 'alessandro', 'Kauan Curbani': 'kauan-curbani', 'Fernando Junior': 'fernando', 'Joao Vargas': 'vargas', 'Felipe Baer': 'baer' };
const START = new Date(2023, 7, 1); // agosto de 2023, início da carreira

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rich = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const root = document.documentElement;

let LANG = root.dataset.lang === 'en' ? 'en' : 'pt';
let RAW, PROFILE, PROJECTS = [], CAREER = [], current = -1, LIVE = null;

const C = () => window.COPY[LANG];
const t = (k, vars = {}) => {
  let s = C()[k] ?? window.COPY.pt[k] ?? k;
  if (typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (_, v) => (vars[v] ?? `{${v}}`));
  return s;
};
const L = (v) => (v && typeof v === 'object' && !Array.isArray(v) && ('pt' in v || 'en' in v) ? (v[LANG] ?? v.pt) : v);
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const locale = () => (LANG === 'en' ? 'en-US' : 'pt-BR');
const num = (n, d = 1) => n.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const press = (p) => C().press[p.slug] || { kicker: p.type === 'personal' ? t('reader.personal') : 'Tech', headline: p.title };
// imagem principal: infográfico > foto
const img = (p, alt) => (p.diagram ? diagram(p) : `<div class="print-img"><img src="${esc(p.image)}" alt="${esc(alt || p.title)}" loading="lazy"></div>`);

const diagram = (p) => window.renderDiagram(p, { L, t, esc });
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
};

/* ---------- abertura: a rotativa ---------- */
(function pressIntro() {
  if (!root.classList.contains('press')) return;
  const edition = Math.floor((Date.now() - START) / 864e5).toLocaleString(locale());
  $('#pressText').textContent = t('press.running', { n: edition });
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    root.classList.add('press-out');
    store.set('jopes-press', '1');
    setTimeout(() => root.classList.remove('press', 'press-out'), 700);
  };
  setTimeout(finish, 2600);
  addEventListener('click', finish, { once: true });
  addEventListener('keydown', finish, { once: true });
})();

/* ---------- carregar ---------- */
Promise.all(['data/edicao.json', 'data/profissionais.json', 'data/entrevista.json'].map((u) => fetch(u).then((r) => r.json())))
  .then(([edicao, profissionais, entrevista]) => {
    PROFILE = edicao.profile;
    RAW = { ...edicao, projects: [...profissionais, ...edicao.personal], interview: entrevista };
    initUI();
    render();
    routeFromHash();
    fetchLive();
    countVisit();
  })
  .catch((err) => {
    console.error(err);
    $('main').innerHTML = '<p style="padding:60px 0;font-style:italic">A rotativa emperrou: não foi possível carregar os dados. Abra o site por um servidor local (veja o serve.ps1).</p>';
  });

/* ---------- dados no idioma atual ---------- */
function localize() {
  const g = C().game;
  PROJECTS = RAW.projects.map((p) => ({
    slug: p.slug, title: L(p.title), subtitle: L(p.subtitle), description: L(p.description),
    problem: L(p.problem), solution: L(p.solution), role: L(p.role), year: p.year, type: p.type,
    techStack: arr(p.techStack), highlights: arr(L(p.highlights)), results: arr(L(p.results)),
    challenges: arr(L(p.challenges)), technicalDecisions: arr(L(p.technicalDecisions)),
    image: p.img || `img/${p.slug}.jpg`, diagram: p.diagram,
  }));
  PROJECTS.push({
    slug: 'jopes-exe', ...g, year: 2026, type: 'personal', image: 'img/rpg-preview.webp',
    techStack: ['JavaScript', 'SVG', 'three.js', 'GLTF', 'Web Audio', 'Next.js (API)', 'Prisma + Neon'],
    challenges: [], technicalDecisions: [],
  });
  const { company, positions } = RAW.experience;
  CAREER = [...positions].reverse().map((pos) => ({
    title: pos.title, period: livePeriod(pos), description: L(pos.description),
    responsibilities: arr(L(pos.responsibilities)), techStack: arr(pos.techStack), locked: !!pos.isLocked,
    company, location: L(RAW.experience.location), pts: MARKET_PTS[pos.title] || 0, short: C().market[pos.title] || pos.title,
  }));
  buildCandles();
}

// O cargo atual ("... - Atual (7 meses)") tem a duração recalculada a cada visita, para o texto
// do edicao.json não envelhecer. Conta como o LinkedIn: o mês de início e o mês atual entram.
function livePeriod(pos) {
  const text = L(pos.period), start = ROLE_START[pos.title];
  const current = /atual|present/i.test(text);
  if (!current || pos.isLocked || !start) return text;
  const now = new Date();
  const months = (now.getFullYear() - start[0]) * 12 + (now.getMonth() - start[1]) + 1;
  if (months < 1) return text;
  const y = Math.floor(months / 12), m = months % 12, en = LANG === 'en';
  const parts = [];
  if (y) parts.push(`${y} ${en ? (y > 1 ? 'years' : 'year') : (y > 1 ? 'anos' : 'ano')}`);
  if (m) parts.push(`${m} ${en ? (m > 1 ? 'months' : 'month') : (m > 1 ? 'meses' : 'mês')}`);
  return text.replace(/\s*\([^)]*\)\s*$/, '') + ` (${parts.join(' ')})`;
}

/* ---------- render ---------- */
function render() {
  localize();
  applyStatic();
  dateline();
  buildTicker();
  buildLead();
  buildProfile();
  buildNumbers();
  buildFeature();
  buildRow3();
  buildMore();
  buildInterview();
  buildCareer();
  buildAds();
  buildPuzzle();
  buildLetters();
  buildColophon();
  observe();
}

function applyStatic() {
  root.lang = LANG === 'en' ? 'en' : 'pt-BR';
  root.dataset.lang = LANG;
  paintCirculation();
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  ['#paperName', '#miniName', '#footName'].forEach((s) => { $(s).textContent = t('paper'); });
  // botões com versão longa (computador) e curta (celular)
  $('#langBtn').innerHTML = `<span class="t-long">${t('util.lang')}</span><span class="t-short">${LANG === 'en' ? 'PT' : 'EN'}</span>`;
  if (current < 0) document.title = `${t('paper')} — ${PROFILE.name}`;
}

function dateline() {
  const now = new Date();
  const d = now.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const short = now.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\.| de /g, ' ').replace(/\s+/g, ' ');
  const n = Math.floor((now - START) / 864e5).toLocaleString(locale());
  const year = now.getFullYear() - START.getFullYear() + (now.getMonth() >= START.getMonth() ? 1 : 0);
  // versão longa no computador, curta no celular
  $('#dateline').innerHTML = `<span class="t-long">${esc(t('dateline', { d, n }))}</span><span class="t-short">${esc(t('datelineShort', { d: short, n }))}</span>`;
  $('#motto').innerHTML = `<span class="t-long">${esc(t('motto', { y: roman(year) }))}</span><span class="t-short">${esc(t('mottoShort', { y: roman(year) }))}</span>`;
}
function roman(n) {
  let s = '';
  for (const [v, r] of [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; }
  return s;
}

/* ---------- letreiro (com dados reais do GitHub quando disponíveis) ---------- */
function ago(date) {
  const m = Math.round((Date.now() - new Date(date)) / 60000), a = C().ago;
  if (m < 2) return a.now;
  if (m < 60) return a.m.replace('{n}', m);
  if (m < 60 * 48) return a.h.replace('{n}', Math.round(m / 60));
  return a.d.replace('{n}', Math.round(m / 1440));
}
function buildTicker() {
  const lines = [];
  if (LIVE?.push) {
    const p = LIVE.push;
    lines.push(['LIVE', 'github', p.msg ? t('live.push', { repo: p.repo, msg: p.msg, ago: ago(p.date) }) : t('live.pushNoMsg', { repo: p.repo, ago: ago(p.date) })]);
  }
  if (LIVE?.contrib) lines.push(['LIVE', 'github', `${LIVE.contrib.toLocaleString(locale())} ${t('live.contrib')}`]);
  if (LIVE?.repos) lines.push(['LIVE', 'github', t('live.repos', { n: LIVE.repos })]);
  const all = [...lines, ...C().ticker];
  const now = Date.now();
  const html = all.map(([lv, svc, msg], i) => {
    const time = lv === 'LIVE' ? '●' : new Date(now - (all.length - i) * 47000).toLocaleTimeString(locale());
    // só as linhas reais (GitHub) levam o selo AO VIVO; as demais são logs de brincadeira da redação
    return `<span>${time} <b class="lv lv-${lv}">${lv === 'LIVE' ? t('ticker.live') : lv}</b><span class="svc">${esc(svc)}</span>${esc(msg)}</span>`;
  }).join('');
  $('#ticker').innerHTML = html + html;
}

/* Tiragem = contador de visitas (abacus.jasoncameron.dev: gratuito, sem dados pessoais).
   Conta 1 por sessão; se o serviço estiver fora, a tiragem simplesmente não aparece. */
const COUNTER = 'https://abacus.jasoncameron.dev';
let CIRCULATION = null;
async function countVisit() {
  let counted = false;
  try { counted = sessionStorage.getItem('jopes-visit') === '1'; } catch { /* ok */ }
  try {
    const r = await fetch(`${COUNTER}/${counted ? 'get' : 'hit'}/jopes-v2/jornal`);
    if (!r.ok) return;
    CIRCULATION = (await r.json()).value;
    try { sessionStorage.setItem('jopes-visit', '1'); } catch { /* ok */ }
    paintCirculation();
  } catch { /* sem contador, sem problema */ }
}
// a tiragem fica no lema, embaixo do título
function paintCirculation() {
  if (CIRCULATION == null) return;
  $('#circulation').textContent = ` · ${t('circulation', { n: CIRCULATION.toLocaleString(locale()) })}`;
}

async function fetchLive() {
  const cacheKey = 'jopes-live';
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (cached && Date.now() - cached.at < 15 * 60000) { LIVE = cached; buildTicker(); buildNumbers(); return; }
  } catch { /* ok */ }
  const live = { at: Date.now() };
  const [events, user, contrib] = await Promise.allSettled([
    fetch(`https://api.github.com/users/${GH_USER}/events/public?per_page=30`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`https://api.github.com/users/${GH_USER}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    fetch(`https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
  ]);
  if (events.status === 'fulfilled') {
    const push = events.value.find((e) => e.type === 'PushEvent');
    if (push) {
      const commits = push.payload?.commits || [];
      const msg = commits.length ? commits[commits.length - 1].message.split('\n')[0].slice(0, 90) : '';
      live.push = { repo: push.repo.name.replace(`${GH_USER}/`, ''), msg, date: push.created_at };
    }
  }
  if (user.status === 'fulfilled') live.repos = user.value.public_repos;
  if (contrib.status === 'fulfilled') live.contrib = contrib.value?.total?.lastYear;
  if (!live.push && !live.repos && !live.contrib) return;
  LIVE = live;
  try { sessionStorage.setItem(cacheKey, JSON.stringify(live)); } catch { /* ok */ }
  buildTicker();
  buildNumbers();
}

/* ---------- capa ---------- */
function buildLead() {
  const p = PROJECTS.find((x) => x.slug === LEAD);
  const pr = press(p);
  const [first, ...rest] = p.description.split('. ');
  $('#lead').innerHTML = `
    <span class="kicker">${esc(pr.kicker)} · ${t('lead.tag')}</span>
    <h2 class="headline"><a href="#/materia/${p.slug}">${esc(pr.headline)}</a></h2>
    <p class="deck">${rich(p.subtitle)}.</p>
    <p class="byline">${t('reader.by')} <b>${esc(PROFILE.name)}</b> · Blumenau · ${p.year}</p>
    <div class="lead-body">
      <div class="lead-fig">
        <figure>${img(p)}<figcaption>${t('lead.caption')}</figcaption></figure>
        <div class="xray">
          <h3>${t('lead.xray')}</h3>
          <dl>
            <dt>${t('lead.xStack')}</dt><dd>${p.techStack.slice(0, 6).map(esc).join(' · ')}</dd>
            <dt>${t('lead.xRole')}</dt><dd>${esc(p.role)}</dd>
            ${p.results.slice(0, 2).map((r) => `<dt>${t('lead.xResult')}</dt><dd>${esc(r)}</dd>`).join('')}
          </dl>
        </div>
      </div>
      <div class="lead-text">
        <p class="dropcap">${rich(first)}.</p>
        <p class="lead-quote">${esc(pr.quote)}</p>
        <p>${rich(rest.join('. '))}</p>
        <a class="more-link" href="#/materia/${p.slug}">${t('lead.more')}</a>
      </div>
    </div>`;
}

function buildProfile() {
  $('#profile').innerHTML = `
    <h2 class="box-title">${t('profile.title')}</h2>
    <div class="print-img"><img src="img/eu.webp" width="760" height="760" fetchpriority="high" decoding="async" alt="${esc(PROFILE.name)}"></div>
    <figcaption>${t('profile.caption')}</figcaption>
    <h2>${esc(PROFILE.name)}</h2>
    <p class="role">${t('role')} · ${LANG === 'en' ? 'Blumenau, Brazil' : esc(PROFILE.location)}</p>
    ${C().about.map((a) => `<p>${esc(a)}</p>`).join('')}
    <div class="profile-links">
      <a class="more-link" href="#expediente">${t('profile.contact')}</a>
      <a class="more-link" href="${t('cv')}" target="_blank" rel="noopener">${t('profile.cv')}</a>
    </div>`;
}

function buildNumbers() {
  const years = Math.floor((Date.now() - START) / (365.25 * 864e5));
  const rows = C().numbers.map(([n, l]) => [n === '{projects}' ? PROJECTS.length : n === '{years}' ? years : n, l]);
  if (LIVE?.contrib) rows.splice(1, 0, [LIVE.contrib, t('live.contrib'), true]);
  $('#numbers').innerHTML = rows.map(([n, l, live]) =>
    `<div class="number${live ? ' live' : ''}"><b data-count="${typeof n === 'number' ? n : ''}">${typeof n === 'number' ? n.toLocaleString(locale()) : n}</b><span>${esc(l)}</span></div>`).join('');
  observeCounts();
}

function buildFeature() {
  const g = PROJECTS.find((p) => p.slug === 'jopes-exe');
  $('#games').innerHTML = `
    <figure class="rise">
      <a href="#/materia/${g.slug}">${img(g, 'JOPES.EXE')}</a>
      <figcaption>${t('feature.caption')}</figcaption>
      <div class="facts">${C().facts.map(([n, l]) => `<div class="fact"><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
    </figure>
    <div class="rise">
      <span class="feature-flag">${t('feature.flag')}</span>
      <h2 class="headline"><a href="#/materia/${g.slug}">${esc(press(g).headline)}</a></h2>
      <p class="deck">${esc(g.subtitle)}.</p>
      <p class="byline">${t('feature.byline', { y: g.year })}</p>
      <p class="body dropcap">${esc(g.description)}</p>
      <div class="howto">
        <h3>${t('feature.howto')}</h3>
        <ul>
          <li><span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd></span> ${t('feature.k1')}</li>
          <li><kbd>E</kbd> ${t('feature.k2')}</li>
          <li><kbd>F</kbd> ${t('feature.k3')} · <kbd>H</kbd> ${t('feature.k4')}</li>
        </ul>
      </div>
      <div class="feature-actions">
        <a class="btn-ink" href="${GAME_URL}" target="_blank" rel="noopener">${t('feature.play')}</a>
        <a class="more-link" href="#/materia/${g.slug}">${t('feature.more')}</a>
      </div>
    </div>`;
}

function buildRow3() {
  $('#row3').innerHTML = ROW3.map((slug) => {
    const p = PROJECTS.find((x) => x.slug === slug);
    const pr = press(p);
    return `<article class="story rise"><a href="#/materia/${p.slug}">
      ${img(p)}
      <span class="kicker">${esc(pr.kicker)}</span>
      <h3 class="headline"><span>${esc(pr.headline)}</span></h3>
      <p class="deck">${rich(p.subtitle)}.</p>
      <span class="more-link">${t('story.read')}</span>
    </a></article>`;
  }).join('');
}

function buildMore() {
  const rest = PROJECTS.filter((p) => p.slug !== LEAD && p.slug !== 'jopes-exe' && !ROW3.includes(p.slug));
  $('#more').innerHTML = rest.map((p) => {
    const pr = press(p);
    return `<a class="brief rise" href="#/materia/${p.slug}">
      ${img(p)}
      <span class="kicker">${esc(pr.kicker)}</span>
      <h3>${esc(pr.headline)}</h3>
      <p>${esc(p.title.split(' — ')[0])} · ${p.year}</p>
    </a>`;
  }).join('') + promos(rest.length);
}

// vagas sobrando na grade de 4 viram chamadas para outros cadernos, como num jornal
function promos(count) {
  const free = (4 - (count % 4)) % 4;
  return C().promos.slice(0, free).map(([kicker, head, deck, href]) => `
    <a class="brief promo rise" href="${href}">
      <span class="kicker">${esc(kicker)}</span>
      <h3>${esc(head)}</h3>
      <p>${esc(deck)}</p>
      <span class="more-link">${t('promo.go')}</span>
    </a>`).join('');
}

/* ---------- entrevista ping-pong ---------- */
function buildInterview() {
  const iv = RAW.interview;
  if (!iv) return;
  const qa = iv.qa.map((x) => `<div class="iv-qa"><p class="iv-q">${esc(L(x.q))}</p><p class="iv-a">${esc(L(x.a))}</p></div>`);
  const half = Math.ceil(qa.length / 2);
  const pull = `<blockquote class="iv-pull">${esc(L(iv.pull))}</blockquote>`;
  $('#entrevista').innerHTML = `
    <h2 class="caderno"><span class="caderno-tag">${t('iv.tag')}</span> <span>${t('iv.kicker')}</span></h2>
    <div class="iv-grid">
      <aside class="iv-side rise">
        <figure>
          <div class="print-img iv-photo"><img src="img/entrevista.webp" width="400" height="400" alt="${esc(PROFILE.name)}" loading="lazy" decoding="async"></div>
          <figcaption>${t('iv.caption')}</figcaption>
        </figure>
        <div class="iv-quick">
          <h3>${t('iv.quick')}</h3>
          <dl>${iv.quick.map((x) => `<dt>${esc(L(x.q))}</dt><dd>${esc(L(x.a))}</dd>`).join('')}</dl>
        </div>
      </aside>
      <div class="iv-main rise">
        ${iv.draft ? `<span class="stamp iv-stamp">${t('iv.draft')}</span>` : ''}
        <h3 class="headline iv-headline">${esc(L(iv.headline))}</h3>
        <p class="deck">${esc(L(iv.deck))}</p>
        <p class="byline">${t('iv.byline')}</p>
        <div class="iv-cols">${qa.slice(0, half).join('')}${pull}${qa.slice(half).join('')}</div>
      </div>
    </div>`;
}

/* ---------- carreira: o pregão da JPO3 ---------- */
function buildCareer() {
  $('#positions').innerHTML = CAREER.map((pos, i) => {
    const delta = Math.round(((pos.close - IPO) / IPO) * 100);
    return `<li class="pos${pos.locked ? ' locked' : ''}" data-i="${i}">
      <div class="pos-meta"><span class="kicker">${esc(pos.period)}</span><span class="pos-level">JPO3 ${num(pos.close)} pts · ${i ? t('career.since', { p: delta }).replace('▲ ', '') : t('career.opening')}</span></div>
      <h3 class="headline">${esc(pos.title)}</h3>
      <div class="company">${esc(pos.company)} · ${esc(pos.location)}</div>
      <p class="deck">${esc(pos.description)}</p>
      <ul>${pos.responsibilities.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      ${pos.techStack.length ? `<div class="stack">${pos.techStack.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      ${pos.locked ? `<span class="stamp">${t('career.stamp')}</span>` : ''}
    </li>`;
  }).join('');
  $('#marketFoot').innerHTML = `
    <span><i class="lg lg-up"></i>${t('career.lgUp')}</span>
    <span><i class="lg lg-dn"></i>${t('career.lgDown')}</span>
    <span><i class="lg lg-proj"></i>${t('career.lgProj')}</span>
    <span><i class="lg lg-vol"></i>${t('career.lgVol')}</span>`;
  drawChart(activePos);
  if (activePos >= 0) setQuote(activePos, true);
}

// Início de cada cargo (o Sênior é projeção)
const ROLE_START = {
  'IT Assistant': [2023, 7], 'Trainee Software Developer': [2024, 2], 'Junior Software Developer': [2024, 7],
  'Mid-Level Software Developer': [2025, 8], 'Senior Software Developer': [2027, 0],
};
const T0 = new Date(2023, 6, 1), T1 = new Date(2027, 5, 1);
let activePos = -1, chartGeo = null, CANDLES = [];

// gerador pseudoaleatório com semente: as velas são fictícias, mas sempre as mesmas
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let q = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    q = (q + Math.imul(q ^ (q >>> 7), 61 | q)) ^ q;
    return ((q ^ (q >>> 14)) >>> 0) / 4294967296;
  };
}
// Uma vela a cada duas semanas, como num home broker. Dentro de cada cargo a cotação oscila em
// torno do patamar (com semanas de queda); cada promoção vira um rali de algumas semanas.
function buildCandles() {
  const rand = rng(2023), now = new Date();
  const real = CAREER.map((p, i) => ({ p, i, s: new Date(...(ROLE_START[p.title] || [2023, 7])) })).filter((r) => !r.p.locked);
  const seen = new Set();
  real.forEach((r) => { r.p.techStack.forEach((s) => seen.add(s.replace(/\s*\d+$/, ''))); r.p.cum = seen.size; });
  const out = [];
  let prev = IPO * 0.97, wk = 0, k0 = -1;
  for (let d = new Date(2023, 7, 1); d <= now; d = new Date(d.getTime() + 14 * 864e5)) {
    let k = -1;
    real.forEach((r, j) => { if (d >= r.s) k = j; });
    if (k < 0) continue;
    if (k !== k0) { wk = 0; k0 = k; }
    const r = real[k], base = r.p.pts;
    const o = prev;
    const rally = wk < 3; // primeiras semanas no cargo novo: rali de alta
    const pull = rally ? 0.5 : 0.18;
    const c = o + (base - o) * pull + (rand() - (rally ? 0.3 : 0.5)) * base * 0.13;
    const h = Math.max(o, c) + (0.15 + rand()) * base * 0.03;
    const l = Math.min(o, c) - (0.15 + rand()) * base * 0.03;
    out.push({ d, o, h, l, c, role: r.i, first: wk === 0, vol: (r.p.cum || 1) * (0.5 + rand() * 0.8) * (rally ? 1.6 : 1) });
    prev = c; wk++;
  }
  // a última semana de cada cargo fecha no patamar dele (é o número do painel e do texto)
  real.forEach((r) => {
    const last = out.filter((c) => c.role === r.i).pop();
    if (!last) return;
    last.c = r.p.pts; last.h = Math.max(last.h, last.o, last.c); last.l = Math.min(last.l, last.o, last.c);
    const nxt = out[out.indexOf(last) + 1];
    if (nxt) { nxt.o = last.c; nxt.h = Math.max(nxt.h, nxt.o); nxt.l = Math.min(nxt.l, nxt.o); }
  });
  CANDLES = out;
  CAREER.forEach((p) => { p.close = p.pts; });
}

function drawChart(active) {
  const svg = $('#chart');
  if (!svg || !CAREER.length || !CANDLES.length) return;
  const W = Math.max(300, svg.clientWidth || svg.parentElement.clientWidth);
  const small = W < 560;
  // o painel fica preso no topo: em telas baixas o gráfico encolhe para não cobrir o texto
  const H = small ? 160 : Math.round(Math.min(260, Math.max(200, innerHeight * 0.3)));
  const P = { l: 8, r: small ? 46 : 58, t: small ? 28 : 36, b: small ? 46 : 58 };
  const priceBottom = H - P.b, volTop = H - P.b + 10, volBottom = H - 22;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;

  const now = new Date();
  const x = (d) => P.l + ((d - T0) / (T1 - T0)) * (W - P.l - P.r);
  const y = (v) => priceBottom - ((v - 12) / 125) * (priceBottom - P.t);
  const slot = x(new Date(T0.getTime() + 14 * 864e5)) - x(T0);
  const bw = Math.max(2, Math.min(10, slot * 0.64));
  const realN = CAREER.filter((p) => !p.locked).length;
  const upto = active < 0 ? realN - 1 : Math.min(active, realN - 1);
  const seniorI = CAREER.findIndex((p) => p.locked);
  const senior = seniorI >= 0 ? CAREER[seniorI] : null;
  const fmt = (d) => d.toLocaleDateString(locale(), { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/');
  const fmtDay = (d) => d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\./g, '').replace(/ de /g, '/');

  // grade de preço (direita) e anos (embaixo)
  let grid = '';
  [25, 50, 75, 100, 125].forEach((v) => {
    grid += `<line class="g" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${W - P.r + 6}" y="${y(v) + 4}">${v}</text>`;
  });
  for (let yr = 2024; yr <= 2027; yr++) {
    const gx = x(new Date(yr, 0, 1));
    grid += `<line class="g gv" x1="${gx}" x2="${gx}" y1="${P.t - 8}" y2="${volBottom}"/><text class="ax ax-x" x="${gx}" y="${H - 6}">${yr}</text>`;
  }

  // velas + volume
  const maxVol = Math.max(...CANDLES.map((c) => c.vol), 1);
  let candles = '', vol = '';
  CANDLES.forEach((c) => {
    const up = c.c >= c.o, dim = c.role > upto, X = x(c.d) + slot / 2;
    const top = y(Math.max(c.o, c.c)), bh = Math.max(1, Math.abs(y(c.o) - y(c.c)));
    const cls = `${up ? 'up' : 'dn'}${dim ? ' dim' : ''}`;
    candles += `<g class="cd ${cls}"><line class="wick" x1="${X}" x2="${X}" y1="${y(c.h)}" y2="${y(c.l)}"/><rect class="body" x="${X - bw / 2}" y="${top}" width="${bw}" height="${bh}"/></g>`;
    const vh = (c.vol / maxVol) * (volBottom - volTop);
    vol += `<rect class="vol ${cls}" x="${X - bw / 2}" y="${volBottom - vh}" width="${bw}" height="${vh}"/>`;
  });

  // marcadores de promoção (como "eventos" num gráfico de corretora)
  const shown = CANDLES.filter((c) => c.role <= upto);
  const marks = CAREER.map((p, i) => {
    if (p.locked) return '';
    const run = CANDLES.filter((cd) => cd.role === i);
    if (!run.length) return '';
    const c = run[0], X = x(c.d) + slot / 2;
    const top = y(Math.max(...run.slice(0, 5).map((r) => r.h))) - 6;
    const isOn = i <= upto;
    const anchor = X > W - P.r - 70 ? 'end' : 'start';
    const dx = anchor === 'end' ? 4 : -4;
    const label = small && i !== active ? '' : `<text class="mk-l" x="${X + dx}" y="${top - 20}" text-anchor="${anchor}">${esc(p.short)}</text><text class="mk-d" x="${X + dx}" y="${top - 8}" text-anchor="${anchor}">${fmt(c.d)}</text>`;
    return `<g class="mk${isOn ? ' on' : ''}${i === active ? ' cur' : ''}"><line class="flag" x1="${X}" x2="${X}" y1="${top}" y2="${top - (label ? 5 : 3)}"/>${label}</g>`;
  }).join('');

  // hoje + projeção (Sênior) + etiqueta de preço
  const nx = x(now);
  const today = `<line class="today" x1="${nx}" x2="${nx}" y1="${P.t - 8}" y2="${volBottom}"/><text class="today-l" x="${nx - 5}" y="${P.t - 12}" text-anchor="end">${t('career.today')}</text>`;
  const lastC = CANDLES[CANDLES.length - 1];
  const projOn = senior && active >= seniorI;
  let proj = '';
  if (senior) {
    const sx = x(new Date(...ROLE_START[senior.title])), sy = y(senior.pts);
    const anchor = sx > W - P.r - 70 ? 'end' : 'start', dx = anchor === 'end' ? -10 : 10;
    proj = `<path class="proj${projOn ? ' on' : ''}" d="M ${x(lastC.d) + slot / 2} ${y(lastC.c)} L ${sx} ${sy}"/>
      <g class="mk locked${projOn ? ' on cur' : ''}"><line class="pt-o" x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy}"/><line class="pt-i" x1="${sx}" y1="${sy}" x2="${sx}" y2="${sy}"/>
      ${small && !projOn ? '' : `<text class="mk-l" x="${sx + dx}" y="${sy - 18}" text-anchor="${anchor}">${esc(senior.short)}</text><text class="mk-d" x="${sx + dx}" y="${sy - 6}" text-anchor="${anchor}">2027?</text>`}</g>`;
  }
  const lastShown = shown[shown.length - 1];
  const tagV = projOn ? senior.pts : lastShown ? lastShown.c : null;
  const tagUp = !lastShown || lastShown.c >= lastShown.o;
  const tagX = projOn ? x(new Date(...ROLE_START[senior.title])) : lastShown ? x(lastShown.d) + slot / 2 + bw / 2 : 0;
  const tag = tagV != null ? `<line class="tag-line" x1="${tagX}" x2="${W - P.r}" y1="${y(tagV)}" y2="${y(tagV)}"/>
    <rect class="tag ${projOn ? 'proj-tag' : tagUp ? 'up' : 'dn'}" x="${W - P.r + 2}" y="${y(tagV) - 10}" width="${P.r - 4}" height="20" rx="2"/>
    <text class="tag-t" x="${W - P.r / 2}" y="${y(tagV) + 4}">${num(tagV)}</text>` : '';

  svg.innerHTML = `
    ${grid}
    <text class="vol-l" x="${P.l + 2}" y="${volTop + 6}">${t('career.volume')}</text>
    ${vol}
    ${today}
    ${candles}
    ${proj}${tag}${marks}
    <g class="hover" id="chartHover" style="display:none"><line class="hv-l" y1="${P.t - 8}" y2="${volBottom}"/><line class="hv-h" x1="${P.l}" x2="${W - P.r}"/><rect class="hv-box" height="38" rx="2"/><text class="hv-t1"/><text class="hv-t2"/></g>`;
  chartGeo = { x, y, W, P, fmtDay, fmt, now, slot, senior };
}

// mira: encaixa na vela mais próxima, com abertura / máxima / mínima / fechamento
function chartHover(e) {
  if (!chartGeo) return;
  const svg = $('#chart'), g = $('#chartHover');
  const { x, y, W, P, fmtDay, fmt, now, slot, senior } = chartGeo;
  const rect = svg.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  if (px < P.l || px > W - P.r) { g.style.display = 'none'; return; }
  const date = new Date(T0.getTime() + ((px - P.l) / (W - P.l - P.r)) * (T1 - T0));
  let line1, line2, hx, hy;
  const lastC = CANDLES[CANDLES.length - 1];
  if (date >= CANDLES[0].d && date <= new Date(lastC.d.getTime() + 14 * 864e5)) {
    const c = CANDLES.reduce((a, b) => (Math.abs(b.d - date) < Math.abs(a.d - date) ? b : a));
    const p = CAREER[c.role];
    line1 = `${fmtDay(c.d)} · ${p.short} · ${t('career.techs', { n: p.cum })}`;
    line2 = t('career.ohlc', { o: num(c.o), h: num(c.h), l: num(c.l), c: num(c.c) });
    hx = x(c.d) + slot / 2; hy = y(c.c);
  } else if (date > now && senior) {
    line1 = `${fmt(date)} · ${senior.short}`;
    line2 = `${num(senior.pts)} pts${t('career.proj')}`;
    hx = px; hy = y(senior.pts);
  } else { g.style.display = 'none'; return; }
  g.style.display = '';
  const bw = Math.max(line1.length, line2.length) * 6.6 + 16;
  const bx = hx + bw + 12 > W - P.r ? hx - bw - 8 : hx + 8;
  const vl = g.querySelector('.hv-l'); vl.setAttribute('x1', hx); vl.setAttribute('x2', hx);
  const hl = g.querySelector('.hv-h'); hl.setAttribute('y1', hy); hl.setAttribute('y2', hy);
  const box = g.querySelector('.hv-box');
  box.setAttribute('x', bx); box.setAttribute('y', P.t); box.setAttribute('width', bw);
  const t1 = g.querySelector('.hv-t1'), t2 = g.querySelector('.hv-t2');
  t1.setAttribute('x', bx + 8); t1.setAttribute('y', P.t + 15); t1.textContent = line1;
  t2.setAttribute('x', bx + 8); t2.setAttribute('y', P.t + 30); t2.textContent = line2;
}

let quoteRaf, quoteVal = 0;
function setQuote(i, instant) {
  activePos = i;
  const p = CAREER[i];
  drawChart(i);
  const target = p.close ?? p.pts, from = instant ? target : quoteVal, t0 = performance.now();
  cancelAnimationFrame(quoteRaf);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3);
    quoteVal = from + (target - from) * e;
    $('#quote').textContent = `${num(quoteVal)} pts`;
    if (k < 1) quoteRaf = requestAnimationFrame(step);
  };
  quoteRaf = requestAnimationFrame(step);
  const delta = Math.round(((target - IPO) / IPO) * 100);
  $('#quoteDelta').textContent = i === 0 ? t('career.ipo') : t('career.since', { p: delta }) + (p.locked ? t('career.proj') : '');
}

/* ---------- classificados ---------- */
function buildAds() {
  const c = C();
  const skillAds = RAW.skills.map((g) => {
    const titleEn = g.title.en || L(g.title);
    const [h, line] = c.ads[titleEn] || [L(g.title), ''];
    return `<div class="ad"><h3>${esc(h)}</h3>${esc(line)} ${esc(L(g.description))}
      <div class="lst">${g.skills.map(esc).join(' · ')}</div>
      <a class="contact" href="mailto:${esc(PROFILE.email)}">${t('ad.contact')}</a></div>`;
  });
  const secretAds = c.secrets.map(([label, val]) => `<div class="ad tiny"><h3>${esc(label)}</h3>${esc(val)}</div>`);
  const [bh, bt, bl] = c['ad.big'];
  const big = `<div class="ad big"><h3>${bh}</h3>${bt}<a class="contact" href="#expediente">${bl}</a></div>`;
  const [gh, gt, gk, gl] = c['ad.game'];
  const game = `<div class="ad inverse"><h3>${gh}</h3>${gt}<div class="lst">${gk}</div><a class="contact" href="${GAME_URL}" target="_blank" rel="noopener">${gl}</a></div>`;
  const [ch, ct, c1, c2] = c['ad.cv'];
  const cvs = LANG === 'en' ? ['cv/cv-en.pdf', 'cv/cv-pt.pdf'] : ['cv/cv-pt.pdf', 'cv/cv-en.pdf'];
  const cv = `<div class="ad"><h3>${ch}</h3>${ct}<a class="contact" href="${cvs[0]}" target="_blank" rel="noopener">${c1}</a><a class="contact" href="${cvs[1]}" target="_blank" rel="noopener">${c2}</a></div>`;
  const puzzleAd = `<div class="ad"><h3>${LANG === 'en' ? 'Bored?' : 'Entediado?'}</h3>${LANG === 'en' ? 'There is a crossword on the Puzzles page. Every answer comes with a story.' : 'Tem palavra cruzada na página de Passatempos. Cada resposta vem com uma história.'}<a class="contact" href="#passatempos">${LANG === 'en' ? 'Go to Puzzles →' : 'Ir para Passatempos →'}</a></div>`;
  const order = [big, skillAds[0], secretAds[0], secretAds[3], skillAds[1], game, secretAds[4], skillAds[2], puzzleAd, secretAds[1], cv, skillAds[3], secretAds[2], secretAds[5]];
  $('#ads').innerHTML = order.filter(Boolean).join('');
}

/* ---------- passatempos ---------- */
const xwOpts = {};
function buildPuzzle() {
  Object.assign(xwOpts, {
    words: C().words,
    grid: $('#xwGrid'), across: $('#xwAcross'), down: $('#xwDown'),
    progress: $('#xwProgress'), current: $('#xwCurrent'), explain: $('#xwExplain'),
    tools: { hint: $('#xwHint'), check: $('#xwCheck'), reveal: $('#xwReveal'), reset: $('#xwReset') },
    storageKey: `jopes-xw-${LANG}`,
    t, esc, toast,
    onFound: (w, all) => toast(all ? t('pz.done') : t('pz.gotit', { w: w.a })),
  });
  const res = Crossword.mount(xwOpts);
  if (res.skipped.length) console.warn('Palavras que não couberam na grade:', res.skipped.map((w) => w.a));
}

/* ---------- cartas ---------- */
function buildLetters() {
  // cada carta começa por quem escreve (remetente), depois a frase-título e o texto
  $('#letters').innerHTML = RAW.testimonials.map((tm) => {
    const name = tm.author.name;
    const paras = L(tm.content).split(/\n+/).filter(Boolean);
    const title = C().letterTitles[name] || paras[0].split(/(?<=[.!?])\s/)[0];
    const av = AVATARS[name];
    const who = `<b>${esc(name)}</b><span>${esc(L(tm.author.role))}</span>`;
    return `<article class="letter rise">
      <header class="letter-from">
        ${av ? `<div class="print-img"><img src="img/avatars/${av}.webp" width="160" height="160" alt="${esc(name)}" loading="lazy" decoding="async"></div>` : ''}
        ${tm.author.linkedin ? `<a href="${esc(tm.author.linkedin)}" target="_blank" rel="noopener">${who}</a>` : `<div>${who}</div>`}
      </header>
      <p class="letter-rel">${esc(L(tm.relationship))}</p>
      <h3>“${esc(title.replace(/[.]$/, ''))}”</h3>
      <p>${esc(paras[0])}</p>
      ${paras.length > 1 ? `<div class="letter-rest">${paras.slice(1).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      <button class="letter-more" type="button" aria-expanded="false">${t('letters.more')}</button>` : ''}
    </article>`;
  }).join('');
}

/* ---------- expediente ---------- */
function buildColophon() {
  $('#staff').innerHTML = t('staff', { name: esc(PROFILE.name), role: t('role'), loc: LANG === 'en' ? 'Blumenau, Brazil' : esc(PROFILE.location) });
  $('#copyEmail').innerHTML = `${esc(PROFILE.email)} <span aria-hidden="true">⧉</span>`;
  const names = C().outlets;
  const urls = [PROFILE.github, PROFILE.linkedin, GAME_URL, t('cv'), LANG === 'en' ? 'cv/cv-pt.pdf' : 'cv/cv-en.pdf'];
  $('#outlets').innerHTML = urls.map((u, i) =>
    `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(names[i])}<span>${esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/(index\.html)?$/, ''))} ↗</span></a></li>`).join('');
  $('#fine').textContent = t('fine', { y: new Date().getFullYear(), name: PROFILE.name });
}

/* ---------- leitor de matéria ---------- */
const list = (arr, fn = rich) => `<ul>${arr.map((h) => `<li>${fn(h)}</li>`).join('')}</ul>`;
const decision = (d) => {
  const i = d.indexOf(':');
  return i > 0 ? `<b>${rich(d.slice(0, i))}:</b>${rich(d.slice(i + 1))}` : rich(d);
};
function openArticle(slug) {
  const idx = PROJECTS.findIndex((p) => p.slug === slug);
  if (idx < 0) return closeArticle(false);
  const was = current;
  current = idx;
  const p = PROJECTS[idx], pr = press(p);
  const prev = PROJECTS[(idx - 1 + PROJECTS.length) % PROJECTS.length];
  const next = PROJECTS[(idx + 1) % PROJECTS.length];
  const personal = t('reader.personal');
  const tail = p.type === 'personal' ? (pr.kicker === personal ? '' : ` · ${personal}`) : ` · ${t('reader.professional')}`;
  $('#readerFolio').textContent = `${t('paper')} · ${t('reader.page')} ${idx + 3} · ${pr.kicker}`;
  $('#readerBody').innerHTML = `
    <span class="kicker">${esc(pr.kicker)}${tail}</span>
    <h1 class="headline" id="readerTitle">${esc(pr.headline)}</h1>
    <p class="deck">${rich(p.subtitle)}.</p>
    <p class="byline">${t('reader.by')} <b>${esc(PROFILE.name)}</b> · ${esc(p.title)} · ${p.year}</p>
    <figure>${img(p)}<figcaption>${esc(p.title)}.</figcaption></figure>
    <div class="article-cols">
      <p class="dropcap">${rich(p.description)}</p>
      ${p.problem ? `<h3>${t('reader.problem')}</h3><p>${rich(p.problem)}</p>` : ''}
      ${p.solution ? `<h3>${t('reader.solution')}</h3><p>${rich(p.solution)}</p>` : ''}
      <div class="role-box"><b>${t('reader.role')}</b>${esc(p.role)}</div>
      <h3>${t('reader.inside')}</h3>
      ${list(p.highlights)}
      ${p.technicalDecisions.length ? `<h3>${t('reader.decisions')}</h3>${list(p.technicalDecisions, decision)}` : ''}
      ${p.challenges.length ? `<h3>${t('reader.challenges')}</h3>${list(p.challenges)}` : ''}
    </div>
    <div class="results">${p.results.map((r, i) => `<div class="result"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(r)}</span></div>`).join('')}</div>
    <div class="techbox"><b>${t('reader.stack')}</b>${p.techStack.map((s) => `<span>${esc(s)}</span>`).join('')}</div>
    ${p.slug === 'jopes-exe' ? `<p style="margin-top:22px"><a class="btn-ink" href="${GAME_URL}" target="_blank" rel="noopener">${t('reader.play')}</a></p>` : ''}
    <nav class="pager">
      <button type="button" data-go="${prev.slug}"><small>${t('reader.prev')}</small><strong>${esc(press(prev).headline)}</strong></button>
      <button type="button" data-go="${next.slug}"><small>${t('reader.next')}</small><strong>${esc(press(next).headline)}</strong></button>
    </nav>`;
  const reader = $('#reader');
  reader.classList.remove('closing');
  if (reader.hidden) {
    reader.hidden = false; document.body.classList.add('reading'); // abre virando a página (animação no CSS)
  } else if (was >= 0 && was !== idx) {
    // trocar de matéria vira a página para frente ou para trás
    const page = $('#readerBody');
    const forward = (was + 1) % PROJECTS.length === idx;
    page.classList.remove('turn-next', 'turn-prev');
    void page.offsetWidth;
    page.classList.add(forward ? 'turn-next' : 'turn-prev');
  }
  reader.scrollTop = 0;
  document.title = `${pr.headline} — ${t('paper')}`;
  $('#readerClose').focus({ preventScroll: true });
}
function closeArticle(updateHash = true) {
  const reader = $('#reader');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reader.hidden && !reduce) {
    // fecha a página virando de volta, depois esconde
    reader.classList.add('closing');
    setTimeout(() => { if (reader.classList.contains('closing')) { reader.hidden = true; reader.classList.remove('closing'); } }, 450);
  } else reader.hidden = true;
  document.body.classList.remove('reading');
  current = -1;
  document.title = `${t('paper')} — ${PROFILE.name}`;
  if (updateHash && location.hash.startsWith('#/materia/')) history.pushState('', '', location.pathname + location.search);
}
function routeFromHash() {
  const m = location.hash.match(/^#\/materia\/([\w-]+)/);
  if (m) openArticle(m[1]); else if (current >= 0) closeArticle(false);
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------- observadores (refeitos a cada render) ---------- */
let observers = [];
function observe() {
  observers.forEach((o) => o.disconnect());
  observers = [];

  const riseIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); riseIO.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rise:not(.in)').forEach((el) => riseIO.observe(el));

  const posIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (!en.isIntersecting) return;
    $$('.pos').forEach((p) => p.classList.toggle('on', p === en.target));
    setQuote(+en.target.dataset.i);
  }), { rootMargin: '-50% 0px -40% 0px' });
  $$('.pos').forEach((p) => posIO.observe(p));
  if (activePos >= 0) $$('.pos')[activePos]?.classList.add('on');

  // animações de jornal: imagem "imprimindo", tinta assentando nas manchetes,
  // fios dos cadernos se desenhando e carimbos batendo (só quando entram na tela)
  const inkIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('seen'); inkIO.unobserve(en.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('main .print-img, main .headline, .caderno, .band, .stamp, .xray, .facts, .iv-pull').forEach((el) => {
      if (el.classList.contains('seen')) return;
      el.classList.add('anim');
      inkIO.observe(el);
    });
  }

  observers.push(riseIO, posIO, inkIO);
  observeCounts();
}
let countIO;
function observeCounts() {
  countIO?.disconnect();
  countIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (!en.isIntersecting) return;
    countIO.unobserve(en.target);
    const el = en.target, target = +el.dataset.count, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1600), e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(target * e).toLocaleString(locale());
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  $$('[data-count]').forEach((el) => { if (el.dataset.count && !el.dataset.counted) { el.dataset.counted = '1'; countIO.observe(el); } });
}

/* ---------- interações fixas (uma vez só) ---------- */
function initUI() {
  addEventListener('hashchange', routeFromHash);
  $('#readerClose').addEventListener('click', () => closeArticle());
  $('#readerBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) location.hash = `#/materia/${b.dataset.go}`;
  });
  addEventListener('keydown', (e) => {
    if (current < 0) return;
    if (e.key === 'Escape') closeArticle();
    if (e.key === 'ArrowRight') location.hash = `#/materia/${PROJECTS[(current + 1) % PROJECTS.length].slug}`;
    if (e.key === 'ArrowLeft') location.hash = `#/materia/${PROJECTS[(current - 1 + PROJECTS.length) % PROJECTS.length].slug}`;
  });

  // idioma
  $('#langBtn').addEventListener('click', () => {
    LANG = LANG === 'en' ? 'pt' : 'en';
    store.set('jopes-lang', LANG);
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    history.replaceState(null, '', url);
    render();
    if (current >= 0) openArticle(PROJECTS[current].slug);
    toast(LANG === 'en' ? 'International edition' : 'Edição brasileira');
  });

  $('#printBtn').addEventListener('click', () => print());

  // cartas longas: no celular abrem só o primeiro parágrafo; o botão mostra o resto
  $('#letters').addEventListener('click', (e) => {
    const b = e.target.closest('.letter-more');
    if (!b) return;
    const open = b.closest('.letter').classList.toggle('open');
    b.setAttribute('aria-expanded', String(open));
    b.textContent = t(open ? 'letters.less' : 'letters.more');
  });

  // gráfico da carreira: mira e redesenho ao mudar a largura
  const chart = $('#chart');
  chart.addEventListener('mousemove', chartHover);
  chart.addEventListener('mouseleave', () => { const g = $('#chartHover'); if (g) g.style.display = 'none'; });
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawChart(activePos), 120); });

  // copiar e-mail
  $('#copyEmail').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(PROFILE.email); toast(t('copied')); }
    catch { location.href = `mailto:${PROFILE.email}`; }
  });

  // masthead compacto + seção ativa
  const mini = $('#mini');
  new IntersectionObserver(([en]) => mini.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top < 0)).observe($('#sections'));
  const miniLinks = $$('.mini-links a');
  const secIO = new IntersectionObserver((ens) => ens.forEach((en) => {
    if (en.isIntersecting) miniLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${en.target.id}`));
  }), { rootMargin: '-40% 0px -55% 0px' });
  ['tecnologia', 'entrevista', 'carreira', 'classificados', 'passatempos', 'cartas', 'expediente'].forEach((id) => secIO.observe($(`#${id}`)));
}
