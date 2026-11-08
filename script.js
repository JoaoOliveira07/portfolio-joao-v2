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
    title: pos.title, period: L(pos.period), description: L(pos.description),
    responsibilities: arr(L(pos.responsibilities)), techStack: arr(pos.techStack), locked: !!pos.isLocked,
    company, location: L(RAW.experience.location), pts: MARKET_PTS[pos.title] || 0, short: C().market[pos.title] || pos.title,
  }));
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
  paintNight();
  if (current < 0) document.title = `${t('paper')} — ${PROFILE.name}`;
}
function paintNight() {
  const night = root.dataset.theme === 'night';
  $('#nightBtn').innerHTML = `<span class="t-long">${t(night ? 'util.day' : 'util.night')}</span><span class="t-short" aria-hidden="true">${night ? '☀' : '☾'}</span>`;
  $('#nightBtn').setAttribute('aria-label', t(night ? 'util.day' : 'util.night'));
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
    <div class="print-img"><img src="img/eu.jpg" alt="${esc(PROFILE.name)}"></div>
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
          <div class="print-img iv-photo"><img src="img/entrevista.jpg" alt="${esc(PROFILE.name)}" loading="lazy"></div>
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
    const delta = Math.round(((pos.pts - IPO) / IPO) * 100);
    return `<li class="pos${pos.locked ? ' locked' : ''}" data-i="${i}">
      <div class="pos-meta"><span class="kicker">${esc(pos.period)}</span><span class="pos-level">JPO3 ${num(pos.pts)} pts · ${i ? t('career.since', { p: delta }).replace('▲ ', '') : t('career.opening')}</span></div>
      <h3 class="headline">${esc(pos.title)}</h3>
      <div class="company">${esc(pos.company)} · ${esc(pos.location)}</div>
      <p class="deck">${esc(pos.description)}</p>
      <ul>${pos.responsibilities.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      ${pos.techStack.length ? `<div class="stack">${pos.techStack.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
      ${pos.locked ? `<span class="stamp">${t('career.stamp')}</span>` : ''}
    </li>`;
  }).join('');
  $('#marketFoot').innerHTML = `
    <span><i class="lg lg-line"></i>${t('career.lgPrice')}</span>
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
let activePos = -1, chartGeo = null;

function drawChart(active) {
  const svg = $('#chart');
  if (!svg || !CAREER.length) return;
  const W = Math.max(300, svg.clientWidth || svg.parentElement.clientWidth);
  const small = W < 560;
  // o painel fica preso no topo: em telas baixas o gráfico encolhe para não cobrir o texto
  const H = small ? 150 : Math.round(Math.min(260, Math.max(190, innerHeight * 0.32)));
  const P = { l: 8, r: small ? 46 : 58, t: small ? 22 : 30, b: small ? 52 : 70 };
  const priceBottom = H - P.b, volTop = H - P.b + 14, volBottom = H - 22;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;

  const now = new Date();
  const x = (d) => P.l + ((d - T0) / (T1 - T0)) * (W - P.l - P.r);
  const y = (v) => priceBottom - (v / 135) * (priceBottom - P.t);
  const roles = CAREER.map((p, i) => {
    const s = new Date(...(ROLE_START[p.title] || [2023, 7]));
    const next = CAREER[i + 1];
    const e = p.locked ? s : next && !next.locked ? new Date(...ROLE_START[next.title]) : now;
    return { ...p, s, e, i };
  });
  const real = roles.filter((r) => !r.locked);
  const upto = Math.min(active, real.length - 1);
  const senior = roles.find((r) => r.locked);
  const fmt = (d) => d.toLocaleDateString(locale(), { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/');

  const stepPath = (list) => list.map((r, k) => (k === 0 ? `M ${x(r.s)} ${y(r.pts)}` : ` V ${y(r.pts)}`) + ` H ${x(r.e)}`).join('');
  const ghost = stepPath(real);
  const shown = upto >= 0 ? stepPath(real.slice(0, upto + 1)) : '';
  const area = upto >= 0 ? `${shown} V ${priceBottom} H ${x(real[0].s)} Z` : '';
  const last = upto >= 0 ? real[upto] : null;

  // grade de preço (direita) e anos (embaixo)
  let grid = '';
  [25, 50, 75, 100, 125].forEach((v) => {
    grid += `<line class="g" x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${W - P.r + 6}" y="${y(v) + 4}">${v}</text>`;
  });
  for (let yr = 2024; yr <= 2027; yr++) {
    const gx = x(new Date(yr, 0, 1));
    grid += `<line class="g gv" x1="${gx}" x2="${gx}" y1="${P.t - 8}" y2="${volBottom}"/><text class="ax ax-x" x="${gx}" y="${H - 6}">${yr}</text>`;
  }

  // volume: uma barra por mês, altura = tecnologias acumuladas na carreira até aquele cargo
  const seen = new Set();
  real.forEach((r) => { r.techStack.forEach((s) => seen.add(s.replace(/\s*\d+$/, ''))); r.cum = seen.size; });
  const maxStack = Math.max(...real.map((r) => r.cum), 1);
  let vol = '';
  for (let d = new Date(T0); d < now; d.setMonth(d.getMonth() + 1)) {
    const r = real.find((rr) => d >= new Date(rr.s.getFullYear(), rr.s.getMonth(), 1) && d < rr.e);
    if (!r) continue;
    const bx = x(d), bw = Math.max(1.5, x(new Date(d.getFullYear(), d.getMonth() + 1, 1)) - bx - 1.5);
    const bh = (r.cum / maxStack) * (volBottom - volTop);
    vol += `<rect class="vol${r.i <= upto ? ' on' : ''}" x="${bx}" y="${volBottom - bh}" width="${bw}" height="${bh}"/>`;
  }

  // marcadores de promoção com rótulo
  const marks = roles.map((r) => {
    const isOn = r.i <= upto || (r.locked && active >= roles.length - 1);
    const mx = x(r.s), my = y(r.pts);
    const anchor = mx > W - P.r - 70 ? 'end' : 'start';
    const dx = anchor === 'end' ? -8 : 8;
    return `<g class="mk${isOn ? ' on' : ''}${r.i === active ? ' cur' : ''}${r.locked ? ' locked' : ''}">
      <line class="pt-o" x1="${mx}" y1="${my}" x2="${mx}" y2="${my}"/><line class="pt-i" x1="${mx}" y1="${my}" x2="${mx}" y2="${my}"/>
      ${small && r.i !== active ? '' : `<text class="mk-l" x="${mx + dx}" y="${my - 24}" text-anchor="${anchor}">${esc(r.short)}</text><text class="mk-d" x="${mx + dx}" y="${my - 11}" text-anchor="${anchor}">${r.locked ? '2027?' : fmt(r.s)}</text>`}
    </g>`;
  }).join('');

  // hoje + projeção + etiqueta de preço
  const nx = x(now);
  const today = `<line class="today" x1="${nx}" x2="${nx}" y1="${P.t - 8}" y2="${volBottom}"/><text class="today-l" x="${nx - 5}" y="${P.t - 12}" text-anchor="end">${t('career.today')}</text>`;
  const projOn = senior && active >= roles.length - 1;
  const proj = senior ? `<path class="proj${projOn ? ' on' : ''}" d="M ${nx} ${y(real[real.length - 1].pts)} L ${x(senior.s)} ${y(senior.pts)}"/>` : '';
  const tagV = projOn ? senior.pts : last ? last.pts : null;
  const tag = tagV != null ? `<line class="tag-line" x1="${projOn ? x(senior.s) : x(last.e)}" x2="${W - P.r}" y1="${y(tagV)}" y2="${y(tagV)}"/>
    <rect class="tag${projOn ? ' proj-tag' : ''}" x="${W - P.r + 2}" y="${y(tagV) - 10}" width="${P.r - 4}" height="20" rx="2"/>
    <text class="tag-t" x="${W - P.r / 2}" y="${y(tagV) + 4}">${num(tagV)}</text>` : '';

  svg.innerHTML = `
    <defs><linearGradient id="chartFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fade-a"/><stop offset="1" class="fade-b"/></linearGradient></defs>
    ${grid}
    <text class="vol-l" x="${P.l + 2}" y="${volTop - 3}">${t('career.volume')}</text>
    ${vol}
    ${today}
    <path class="ghost" d="${ghost}"/>
    <path class="area" d="${area}" fill="url(#chartFade)"/>
    <path class="line" d="${shown}"/>
    ${proj}${tag}${marks}
    <g class="hover" id="chartHover" style="display:none"><line class="hv-l" y1="${P.t - 8}" y2="${volBottom}"/><rect class="hv-box" height="38" rx="2"/><text class="hv-t1"/><text class="hv-t2"/></g>`;
  chartGeo = { x, y, roles, real, W, P, priceBottom, fmt, now };
}

// mira: mês, cargo e cotação sob o mouse
function chartHover(e) {
  if (!chartGeo) return;
  const svg = $('#chart'), g = $('#chartHover');
  const { x, roles, real, W, P, fmt, now } = chartGeo;
  const rect = svg.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const date = new Date(T0.getTime() + ((px - P.l) / (W - P.l - P.r)) * (T1 - T0));
  let r = real.find((rr) => date >= rr.s && date < rr.e);
  const senior = roles.find((rr) => rr.locked);
  if (!r && date >= now && senior) r = senior;
  if (!r || px < P.l || px > W - P.r) { g.style.display = 'none'; return; }
  g.style.display = '';
  const line1 = `${fmt(date)} · ${r.short}`;
  const line2 = r.locked && date >= now ? `${num(r.pts)} pts${t('career.proj')}` : `${num(r.pts)} pts · ${t('career.techs', { n: r.cum })}`;
  const bw = Math.max(line1.length, line2.length) * 6.6 + 16;
  const bx = px + bw + 12 > W - P.r ? px - bw - 8 : px + 8;
  g.querySelector('.hv-l').setAttribute('x1', px); g.querySelector('.hv-l').setAttribute('x2', px);
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
  const target = p.pts, from = instant ? target : quoteVal, t0 = performance.now();
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
  $('#letters').innerHTML = RAW.testimonials.map((tm) => {
    const name = tm.author.name;
    const paras = L(tm.content).split(/\n+/).filter(Boolean);
    const title = C().letterTitles[name] || paras[0].split(/(?<=[.!?])\s/)[0];
    const av = AVATARS[name];
    return `<article class="letter rise">
      <h3>“${esc(title.replace(/[.]$/, ''))}”</h3>
      ${paras.map((p) => `<p>${esc(p)}</p>`).join('')}
      <div class="signature">
        ${av ? `<div class="print-img"><img src="img/avatars/${av}.jpeg" alt="${esc(name)}" loading="lazy"></div>` : ''}
        ${(() => {
          const inner = `<b>${esc(name)}</b><span>${esc(L(tm.author.role))}</span><span>${esc(L(tm.relationship))}</span>`;
          return tm.author.linkedin ? `<a href="${esc(tm.author.linkedin)}" target="_blank" rel="noopener">${inner}</a>` : `<div>${inner}</div>`;
        })()}
      </div>
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

  // edição noturna
  $('#nightBtn').addEventListener('click', () => {
    const night = root.dataset.theme !== 'night';
    if (night) root.dataset.theme = 'night'; else delete root.dataset.theme;
    store.set('jopes-theme', night ? 'night' : 'day');
    paintNight();
    $('meta[name="theme-color"]').content = night ? '#15130f' : '#f1ebdf';
  });
  if (root.dataset.theme === 'night') $('meta[name="theme-color"]').content = '#15130f';
  $('#printBtn').addEventListener('click', () => print());

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
