/* JOPES.EXE — lógica do jogo: save, áudio, missões, jogador, carros, helicóptero, HUD, tour, clima e o loop.
   Script clássico: roda depois do city.js e antes de vehicles.js / world3d.js / plus.js, que usam estas variáveis globais. */
'use strict';

/* ════════════════════════════════════════════════
   ICONS — inline SVG, no emoji, no external assets
   ════════════════════════════════════════════════ */
const ICONS = {
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"/><path d="M7 5H4a2 2 0 0 0 2 4"/><path d="M17 5h3a2 2 0 0 1-2 4"/><path d="M12 12v3"/><path d="M8 20h8"/><path d="M10 16h4v4h-4z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2s5 4.7 5 10a5 5 0 1 1-10 0c0-1.1.3-2.1 1-3 .2 1 1 2 2 2 0-3-2-4-2-7 1 0 2.7 1 4 4Z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>',
  city: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18"/><path d="M5 21V9l4-3 4 3v12"/><path d="M13 21V6l4-2 4 2v15"/></svg>',
  monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="1"/><path d="M8 21h8M12 17v4"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
  notebook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 3v18M4 8h2M4 12h2M4 16h2"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 6 9 7 9-7"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM3 9h4v12H3zM9 9h3.7v1.7h.05c.5-1 1.8-1.9 3.6-1.9 3.9 0 4.65 2.4 4.65 5.6V21h-4v-5.7c0-1.4 0-3.1-1.9-3.1-1.9 0-2.2 1.5-2.2 3v5.8H9z"/></svg>',
  github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.7c-2.78.6-3.37-1.2-3.37-1.2-.46-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.11-4.56-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.83-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .26.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.1 6.6 7.2.9-5.3 4.9 1.5 7.1L12 17.9 5.5 21.5l1.5-7.1L1.7 9.5l7.2-.9L12 2Z"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4 4 20h16Z"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20 4 4h16Z"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 12 20 4v16Z"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 12 4 4v16Z"/></svg>',
  volumeOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 5V4L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a9 9 0 0 1 0 12"/></svg>',
  volumeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9v6h4l5 5V4L8 9H4Z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
  cv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
};


/* ════════════════════════════════════════════════
   SAVE — localStorage persistence (XP, quests, intro seen)
   ════════════════════════════════════════════════ */
/* Real portfolio content (projects, testimonials…) synced from portfolio-joao
   by scripts/sync-portfolio.mjs into assets/portfolio/data.json. */
window.PORTFOLIO = fetch('assets/portfolio/data.json').then(r => r.ok ? r.json() : null).catch(() => null);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SAVE_KEY = 'jopes_save_v1';
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      xp, level,
      revealedZones: [...revealedZones],
      talkedNPCs: [...talkedNPCs],
      extras: [...extrasDone],
      viewedProjects: [...viewedProjects],
      periodMode, weatherMode,
      allMissionsDone,
      introSeen,
      audioMuted,
      garageCar,
      coffees: [...coffeeGot],
      bestDelivery,
    }));
  } catch {}
}
const save = loadSave();
let introSeen = save.introSeen || false;
let garageCar = save.garageCar || null;
const COFFEE_TOTAL = 12;
const coffeeGot = new Set(save.coffees || []);       // cafés espalhados pela cidade (plus.js)
let bestDelivery = save.bestDelivery || null;       // melhor tempo da entrega expressa, em segundos (plus.js)          // which of João's vehicles the JOPES car is

/* ════════════════════════════════════════════════
   TIME OF DAY — follows the real hour in Blumenau unless the visitor picks
   one. world3d.js / vehicles.js read window.CITY_PERIOD on start and relight
   on 'city:period'.
   ════════════════════════════════════════════════ */
const PERIOD_ORDER = ['auto', 'day', 'dusk', 'night', 'dawn'];
const PERIOD_ICON = { day: '☀', dusk: '◐', night: '☾', dawn: '◑' };
const PERIOD_NAME = { day: 'DIA', dusk: 'ENTARDECER', night: 'NOITE', dawn: 'AMANHECER', auto: 'AUTO' };
const bluHour = () => +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()) % 24;
const periodFromHour = h => (h >= 5 && h < 7) ? 'dawn' : (h >= 7 && h < 17) ? 'day' : (h >= 17 && h < 19) ? 'dusk' : 'night';
let periodMode = save.periodMode || 'auto';
const wantedPeriod = () => periodMode === 'auto' ? periodFromHour(bluHour()) : periodMode;
let period = wantedPeriod();
window.CITY_PERIOD = period;
document.body.dataset.period = period;
let weather = 'clear', weatherMode = save.weatherMode || 'auto';
document.body.dataset.weather = weather;

/* ════════════════════════════════════════════════
   SFX — short procedural blips on interaction, no ambient drone.
   No external file; each call synthesizes one short envelope. The
   AudioContext is created lazily on first real call, which is always
   already inside a user-gesture handler (keydown/click), satisfying
   the browser autoplay policy.
   ════════════════════════════════════════════════ */
let audioCtx = null, masterGain = null;
let audioMuted = save.audioMuted || false;

function ensureAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = audioMuted ? 0 : 0.3;
  masterGain.connect(audioCtx.destination);
}

function playTone(freq, delay, dur, type) {
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  osc.type = type || 'square';
  osc.frequency.value = freq;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playSfx(name) {
  ensureAudio();
  if (name === 'interact')  playTone(520, 0, 0.07);
  if (name === 'talk')      playTone(660, 0, 0.08, 'triangle');
  if (name === 'reveal')    { playTone(440, 0, 0.09); playTone(660, 0.08, 0.12); }
  if (name === 'levelup')   { playTone(523, 0, 0.09); playTone(659, 0.08, 0.09); playTone(784, 0.16, 0.14); }
  if (name === 'horn')      { playTone(330, 0, 0.16, 'sawtooth'); playTone(415, 0, 0.16, 'sawtooth'); playTone(330, 0.2, 0.22, 'sawtooth'); playTone(415, 0.2, 0.22, 'sawtooth'); }
  if (name === 'engine')    { playTone(70, 0, 0.25, 'sawtooth'); playTone(95, 0.12, 0.3, 'sawtooth'); playTone(140, 0.3, 0.18, 'square'); }
  if (name === 'door')      { playTone(180, 0, 0.06, 'square'); playTone(120, 0.06, 0.08, 'square'); }
  if (name === 'bump')      playTone(90, 0, 0.08, 'square');
  if (name === 'coin')      { playTone(988, 0, 0.06); playTone(1319, 0.06, 0.12); }
  if (name === 'check')     { playTone(784, 0, 0.07, 'triangle'); playTone(1047, 0.07, 0.11, 'triangle'); }
  if (name === 'go')        { playTone(440, 0, 0.1); playTone(440, 0.25, 0.1); playTone(880, 0.5, 0.25); }
  if (name === 'complete')  { playTone(392, 0, 0.1); playTone(523, 0.1, 0.1); playTone(659, 0.2, 0.1); playTone(784, 0.3, 0.22); }
}

function updateMuteBtn() {
  document.getElementById('mute-btn').innerHTML = audioMuted ? ICONS.volumeOff : ICONS.volumeOn;
}
function toggleMute() {
  audioMuted = !audioMuted;
  if (masterGain) masterGain.gain.value = audioMuted ? 0 : 0.3;
  updateMuteBtn();
  writeSave();
}
updateMuteBtn();
document.getElementById('mute-btn').addEventListener('click', toggleMute);

/* ════════════════════════════════════════════════
   CONTENT
   ════════════════════════════════════════════════ */
const PROJECTS = [
  { code:'P/001', type:'MONOLITH', year:'2026', title:'E-commerce Monolithic Backend',
    body:'Arquitetura multi-tenant em Spring Boot 3 para e-commerce B2B. Módulos de pedido, estoque, pricing dinâmico, notificações e integração com AWS SQS/SNS/S3/Kinesis. Processamento assíncrono com filas, eventos de domínio e relatórios em tempo real.',
    tags:['Java 17','Spring Boot 3','PostgreSQL','Redis','AWS SQS/SNS/S3','Kinesis'] },
  { code:'P/002', type:'FRONTEND', year:'2026', title:'E-commerce Front — Multi-Tenant B2B SPA',
    body:'SPA em React + TypeScript para plataforma B2B multi-tenant. Catálogo de produtos, carrinho, checkout, painel do cliente e customização por tenant. Integração com backend via REST e WebSocket para notificações em tempo real.',
    tags:['React','TypeScript','Vite','TailwindCSS','WebSocket'] },
  { code:'P/003', type:'MOBILE', year:'2026', title:'Field Sales Mobile — Offline-First App',
    body:'App Flutter para força de vendas em campo com modo offline completo. Sincronização bidirecional via queue local, compressão de dados e conflict resolution. Suporte a catálogo, pedidos e visitas sem conexão.',
    tags:['Flutter','Dart','SQLite','Hive','REST sync','Offline-first'] },
  { code:'P/004', type:'ADMIN', year:'2026', title:'Backoffice — Admin Panel with AI Chat',
    body:'Painel administrativo fullstack com chat IA integrado (OpenAI GPT-4). CRUD de usuários, permissões, relatórios e dashboards. Chat contextual que entende os dados da plataforma e responde perguntas de negócio em linguagem natural.',
    tags:['React','Node.js','OpenAI GPT-4','PostgreSQL','JWT','RBAC'] },
  { code:'P/005', type:'MOBILE', year:'2026', title:'Register Flow — Multi-Step Onboarding',
    body:'Fluxo de cadastro multi-step para app mobile com validação em tempo real, upload de documentos, reconhecimento facial e integração com bureaus de crédito. UX fluida com progresso persistido.',
    tags:['Flutter','Dart','REST','Biometrics','Document OCR'] },
  { code:'P/006', type:'INTEGRATION', year:'2026', title:'Integration Platform — 3-Service Bridge',
    body:'Middleware de integração conectando ERP, e-commerce e sistema de logística. Mapeamento bidirecional, retry com backoff exponencial, dead-letter queue e dashboard de monitoramento.',
    tags:['Java','Spring Integration','RabbitMQ','REST','SOAP','DLQ'] },
  { code:'P/007', type:'EVENT-DRIVEN', year:'2026', title:'Offline Integrator — Field Sales API',
    body:'API event-driven para sincronização da força de vendas offline. Recebe batches de eventos do app mobile, processa de forma idempotente e propaga para sistemas downstream com auditoria.',
    tags:['Java 17','Spring Boot','Kafka','PostgreSQL','Idempotency','AWS'] },
  { code:'P/008', type:'IAC', year:'2025', title:'Infra Terraform — AWS IaC Ecosystem',
    body:'Ecosistema completo de infraestrutura como código para AWS. Módulos reutilizáveis para ECS, RDS, ElastiCache, ALB, Route53, WAF e VPC. Pipelines de CI/CD com GitHub Actions e deploy blue-green.',
    tags:['Terraform','AWS ECS','RDS','ElastiCache','GitHub Actions','Terragrunt'] },
];

const ZONE_CONTENT = {
  garage: { id:'GARAGE', title:'GARAGEM', sub:'', body:null },
  main: { id:'BOOT', title:'MAIN\nHALL', sub:'Backend Engineer — Blumenau, SC',
    body:'Oi, sou o João Paulo — engenheiro backend apaixonado por sistemas distribuídos, APIs bem desenhadas e código que escala.\n\nTrabalho com Java + Spring Boot como stack principal, mas navego por Flutter, React e Terraform quando o problema pede.\n\nEste site é uma cidade. Explore os prédios pressionando E.',
    tags:['Backend Engineer','Java · Spring','AWS · Terraform','Blumenau SC'] },
  projects: { id:'PROJ', title:'PROJETOS', sub:'11 projetos · 2025–2026', body:null },
  lab: { id:'LAB', title:'BACKEND\nLAB', sub:'Ferramentas e experimentos',
    body:'Um espaço para ferramentas, experimentos e coisas que construo enquanto aprendo.',
    labCards:[
      { icon:'notebook', title:'Palavras cruzadas', body:'Cruzadinha com o vocabulário do meu trabalho: cada palavra vem com a história de onde ela aparece' },
      { icon:'monitor', title:'Pregão da carreira', body:'A carreira como gráfico de ações, com eixo de tempo real e volume de tecnologias' },
      { icon:'zap', title:'CommitClock', body:'Foto do cartão ponto vira timesheet no Clockify em menos de um minuto' },
      { icon:'alert', title:'Edição internacional', body:'O portfólio inteiro em inglês, com troca de idioma instantânea' },
    ], link:'../#passatempos' },
  about: { id:'SOBRE', title:'SOBRE\nMIM', sub:'Trajetória · valores · forma de trabalhar',
    body:'Engenheiro backend com foco em sistemas distribuídos e cloud-native. Construo plataformas B2B que escalam: APIs, integrações, mensageria e infraestrutura na AWS.\n\nGosto de código limpo, mas não de purismo. Prefiro soluções que funcionam em produção.',
    timeline:[
      { date:'SET 2025 — PRESENTE', role:'Desenvolvedor Pleno', company:"Segala's Alimentos · Gaspar SC" },
      { date:'AGO 2024 — AGO 2025', role:'Desenvolvedor Júnior', company:"Segala's Alimentos · Gaspar SC" },
      { date:'MAR 2024 — JUL 2024', role:'Trainee de Desenvolvimento', company:"Segala's Alimentos · Gaspar SC" },
      { date:'AGO 2023 — FEV 2024', role:'Assistente de TI', company:"Segala's Alimentos · Gaspar SC" },
    ] },
  stack: { id:'TECH', title:'TECH\nSTACK', sub:'Tecnologias do dia a dia',
    body:'Stack principal em backend Java/Spring, com incursões em Node.js, Flutter e infra AWS.',
    techGrid:[
      { cat:'Backend', items:['Java 17+','Spring Boot 3','Node.js','REST / GraphQL'] },
      { cat:'Mobile & Front', items:['Flutter / Dart','React / Next.js','TypeScript'] },
      { cat:'Cloud & Infra', items:['AWS (ECS/RDS/S3…)','Terraform','Docker','GitHub Actions'] },
      { cat:'Data & Messaging', items:['PostgreSQL','Oracle DB','Redis','Kafka / RabbitMQ'] },
    ] },
  contact: { id:'CONTATO', title:'VAMOS\nCONVERSAR?', sub:'Aberto a oportunidades, projetos e conversas',
    body:'Se você tem um problema de backend interessante — um sistema que não escala, uma integração que não integra — me conta.',
    links:[
      { icon:'mail', label:'jpauloo.2003@gmail.com', sub:'Email principal', href:'mailto:jpauloo.2003@gmail.com' },
      { icon:'linkedin', label:'linkedin.com/in/joaooliveira07', sub:'LinkedIn', href:'https://www.linkedin.com/in/joaooliveira07/' },
      { icon:'github', label:'github.com/JoaoOliveira07', sub:'GitHub', href:'https://github.com/JoaoOliveira07' },
      { icon:'globe', label:'O Jopes (jornal)', sub:'Portfólio em texto', href:'../' },
    ] },
  secret: { id:'???', title:'ARQUIVO\n.ENV', sub:'Você não devia estar aqui…',
    body:'→ Estudando agora: Designing Data-Intensive Applications (DDIA)\n→ Próximo objetivo: Kafka internals + stream processing\n→ Coffee consumed in 2026: ~847 cups\n→ Tabs abertas agora: 47\n→ Último commit message: "fix: finally"\n→ Playlist de código: lo-fi + synthwave em loop\n→ Debug preferido: console.log e oração',
    tags:['SECRET FILE','.ENV','EASTER EGG','// TODO: hide better'] },
};

/* ════════════════════════════════════════════════
   MAP — generated by city.js (isometric line-art SVG).
   Everything lives in "map pixel space": (0,0) is the top-left corner of
   the MAP_PX × MAP_PX city, camera is a clamped scroll offset.
   city.js also exposes an iso grid (u, v) — handy for footprints.
   ════════════════════════════════════════════════ */
const MAP_PX = 2760;
const EDGE_MARGIN = 70;        // how close to the map edge the player can get

const viewport = document.getElementById('viewport');
const mapLayerEl = document.getElementById('mapLayer');
const worldPanEl = document.getElementById('worldPan');
mapLayerEl.style.width = MAP_PX + 'px';
mapLayerEl.style.height = MAP_PX + 'px';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

const CITY = City.build({ mapPx: MAP_PX, groundEl: mapLayerEl, worldEl: worldPanEl });
window.CITY = CITY; // vehicles.js (3D) attaches to it once loaded

/* ════════════════════════════════════════════════
   BUILDINGS — the interactive ones. Position/footprint come from city.js
   (edit ZONE_BLOCKS there to move a building to another block).
   ════════════════════════════════════════════════ */
const ZONE_META = {
  main:     { label:'MAIN HQ',     sublabel:'João Paulo Oliveira' },
  projects: { label:'PROJETOS',    sublabel:'8 projetos reais' },
  lab:      { label:'BACKEND LAB', sublabel:'Ferramentas & experimentos' },
  about:    { label:'SOBRE MIM',   sublabel:'Trajetória & valores' },
  stack:    { label:'TECH STACK',  sublabel:'Stack do dia a dia' },
  contact:  { label:'CONTATO',     sublabel:'Vamos conversar?' },
  secret:   { label:'???',         sublabel:'Arquivo .env' },
  garage:   { label:'GARAGEM',     sublabel:'Os carros que já foram meus' },
};
const ZONE_ORDER = Object.keys(ZONE_META);
// { zone, x, y (ground centre, map px), u, v, a, b (iso footprint), labelY, obj, label, sublabel }
const BUILDINGS = CITY.zones
  .map(z => ({ ...z, ...ZONE_META[z.zone] }))
  .sort((p, q) => ZONE_ORDER.indexOf(p.zone) - ZONE_ORDER.indexOf(q.zone));

const B = {}; // quick zone → building lookup
BUILDINGS.forEach(b => { B[b.zone] = b; });

// Distance (iso units) from a map point to the edge of a footprint; 0 = touching.
function footprintDist(x, y, o) {
  const p = CITY.I(x, y);
  const du = Math.max(Math.abs(p.u - o.u) - o.a, 0);
  const dv = Math.max(Math.abs(p.v - o.v) - o.b, 0);
  return Math.hypot(du, dv);
}

function setBuildingLit(zone, lit) {
  const b = B[zone]; if (!b) return;
  b.objs.forEach(o => o.el.classList.toggle('lit', lit));
  if (b.halo) b.halo.classList.toggle('lit', lit);
}
document.querySelector('.bld-plaza')?.classList.add('lit');

/* ════════════════════════════════════════════════
   XP / LEVEL
   ════════════════════════════════════════════════ */
const LEVELS = [[0,'EXPLORADOR'],[100,'JÚNIOR'],[250,'MID-LEVEL'],[500,'SÊNIOR'],[800,'STAFF']];
let xp = save.xp || 0, level = save.level || 1;

function addXP(amount) {
  xp += amount;
  window.JOPES_PLUS?.xpPop(amount);
  const newLevel = LEVELS.filter(([r]) => xp >= r).length;
  if (newLevel > level) { level = newLevel; showToast('NÍVEL ' + LEVELS[level-1][1] + ' DESBLOQUEADO', 'trophy'); playSfx('levelup'); }
  updateHUD();
  writeSave();
}

function updateHUD() {
  const [req, name] = LEVELS[level-1];
  const next = LEVELS[level] ? LEVELS[level][0] : req;
  const pct = level >= LEVELS.length ? 100 : Math.min(100, (xp-req)/(next-req)*100);
  document.getElementById('lvl-num').textContent = level;
  document.getElementById('lvl-txt').textContent = name;
  document.getElementById('xp-txt').textContent = level >= LEVELS.length ? xp + ' XP · MAX' : `${xp} / ${next} XP`;
  document.getElementById('xp-fill').style.width = pct + '%';
}

/* ════════════════════════════════════════════════
   ZONE REVEAL SYSTEM
   ════════════════════════════════════════════════ */
const revealedZones = new Set(save.revealedZones || []);
revealedZones.forEach(z => setBuildingLit(z, true));

function revealZone(zone) {
  if (revealedZones.has(zone)) return;
  revealedZones.add(zone);
  setBuildingLit(zone, true);
  addXP(zone === 'secret' ? 200 : 60);
  playSfx('reveal');
  showToast('ZONA REVELADA: ' + (ZONE_CONTENT[zone]?.title || zone).replace('\n',' '), 'flame');
  renderQuestList();
  writeSave();
}

const talkedNPCs = new Set(save.talkedNPCs || []);
const extrasDone = new Set(save.extras || []); // side quests, e.g. 'drive'
const viewedProjects = new Set(save.viewedProjects || []);
function talkToNPC(npc) {
  if (!talkedNPCs.has(npc.def.key)) {
    talkedNPCs.add(npc.def.key);
    addXP(40);
    showToast('CONVERSOU COM ' + npc.def.name, 'chat');
    renderQuestList();
    writeSave();
  }
  openNPCDialog(npc);
}

/* ════════════════════════════════════════════════
   PLAYER
   ════════════════════════════════════════════════ */
const SPRITE_DIR = 'assets/player/Idle';
const SPRITE_DIRS = ['south','south-east','east','north-east','north','north-west','west','south-west'];
const WALK_FRAMES = 6;

const spritePaths = {};
SPRITE_DIRS.forEach(d => {
  spritePaths[`idle_${d}`] = `${SPRITE_DIR}/rotations/${d}.png`;
  spritePaths[`walk_${d}`] = [];
  for (let i = 0; i < WALK_FRAMES; i++) {
    spritePaths[`walk_${d}`].push(`${SPRITE_DIR}/animations/Walk/${d}/frame_${String(i).padStart(3,'0')}.png`);
  }
});
Object.values(spritePaths).flat().forEach(src => { new Image().src = src; });

const playerImgEl = document.createElement('img');
playerImgEl.className = 'sprite';
playerImgEl.src = spritePaths['idle_south'];
worldPanEl.appendChild(playerImgEl);

let spriteDir = 'south';
let spriteFrame = 0;
let spriteAnimTime = 0;
const SPRITE_FPS = 8;

// Plain 2D direction → one of the 8 sprite facings (no isometric remapping —
// the sprites just face the screen direction the player is walking).
function getSpriteDir(dx, dy) {
  if (dx === 0 && dy === 0) return spriteDir;
  if (dx === 0) return dy < 0 ? 'north' : 'south';
  if (dy === 0) return dx < 0 ? 'west' : 'east';
  if (dx < 0) return dy < 0 ? 'north-west' : 'south-west';
  return dy < 0 ? 'north-east' : 'south-east';
}

const playerSpawn = { x: CITY.spawn.x, y: CITY.spawn.y }; // plaza, next to the monument
let playerPos = { x: playerSpawn.x, y: playerSpawn.y };

/* ════════════════════════════════════════════════
   NPCS
   ════════════════════════════════════════════════ */
const NPC_DEFS = [
  { key:'felipe', pos: CITY.S(B.about.u + 160, B.about.v - 70), imgPath:'assets/npcs/felipe/Idle/rotations/south.png',
    name:'FELIPE', sub:'Desenvolvedor Full-Stack · Web, Mobile e PWA',
    question:'O que acha de João Paulo?',
    answer:'Tive o prazer de trabalhar com o João e posso afirmar, com total convicção, que seu trabalho é excepcional. Acompanhei de perto sua evolução, assim como sua dedicação e vontade constante de aprender e fazer as coisas acontecerem.\n\nSeu papel sempre foi fundamental, tanto na tomada de decisões quanto na construção de soluções, graças ao seu profundo conhecimento e domínio técnico. Trabalhar com o João é, sem dúvida, uma oportunidade valiosa que todos deveriam ter.' },
  { key:'kauan', pos: CITY.npcSpots.main, imgPath:'assets/npcs/kauan/Idle/rotations/south.png',
    name:'KAUAN', sub:'Desenvolvedor Sênior · Web e Mobile',
    question:'O que acha de João Paulo?',
    answer:'Tive a oportunidade de trabalhar com o João nos últimos 2 anos no desenvolvimento do nosso app mobile, e posso dizer com tranquilidade que ele foi peça-chave na construção do backend.\n\nComo Dev Backend, atuando com Java e Spring, o João participou diretamente de grande parte da implementação da nossa estrutura backend. Além disso, contribuiu bastante para melhorar a performance de consultas e otimizar pontos importantes da aplicação, sempre preocupado com eficiência e qualidade.\n\nO que mais gosto de trabalhar com ele é a postura: aprende rápido, entende o problema com facilidade e sabe discutir soluções de forma madura, sempre buscando a melhor decisão para o produto. Ele entrega rápido, mas sem abrir mão de boas práticas e organização, o que faz muita diferença no dia a dia.\n\nRecomendo o João com total confiança para qualquer time que precise de um backend sólido, responsável e comprometido com resultado.' },
  { key:'vargas', pos: CITY.npcSpots.stack, imgPath:'assets/npcs/vargas/Idle/rotations/south.png',
    name:'VARGAS', sub:'Colega de carreira',
    question:'O que acha de João Paulo?',
    answer:'Tive a sorte de iniciar minha carreira como desenvolvedor ao lado do João Paulo. Desde o começo, sempre ficou evidente a competência e a curiosidade dele na resolução de problemas.\n\nO João foi uma peça fundamental na minha evolução profissional. Como colega e amigo, nunca mediu esforços para ajudar, seja explicando algo que eu não entendia ou dedicando horas (às vezes o dia inteiro) para resolver um problema junto. Para ele, o importante sempre foi chegar na melhor solução.\n\nRecomendo o João com total confiança para qualquer empresa. Trabalhar com ele é uma experiência que eleva o nível de quem está ao redor.' },
  { key:'fernando', pos: CITY.npcSpots.lab, imgPath:'assets/npcs/fernando/Idle/rotations/south.png',
    name:'FERNANDO', sub:'Colega de trabalho',
    question:'O que acha de João Paulo?',
    answer:'João é um excelente profissional, tive a oportunidade de trabalhar com ele durante 2 anos e ele sempre foi um profissional dedicado, se mostrou desde o início ter facilidade de aprender e ser capaz de assumir responsabilidades. Desempenhou com excelência os projetos em que participou.\n\nJoão é e será peça fundamental em qualquer equipe que atuar. Contudo deixo minha recomendação de seus serviços.' },
];

const NPCS = NPC_DEFS.map(def => {
  const imgEl = document.createElement('img');
  imgEl.className = 'sprite';
  imgEl.src = def.imgPath;
  if (def.cls) imgEl.classList.add(def.cls);
  worldPanEl.appendChild(imgEl);
  const nameEl = document.createElement('div');
  nameEl.className = 'npc-name';
  nameEl.textContent = def.name;
  document.body.appendChild(nameEl);
  return { def, imgEl, nameEl };
});

/* ════════════════════════════════════════════════
   QUEST LIST
   ════════════════════════════════════════════════ */
const MISSIONS = [
  ...BUILDINGS.map(b => ({ type:'zone', key:b.zone, label:b.label, xp: b.zone==='secret' ? 200 : 60 })),
  ...NPCS.map(n => ({ type:'npc', key:n.def.key, label:'Conversar com ' + n.def.name, xp:40 })),
  { type:'extra', key:'drive', label:'Dar uma volta de carro', xp:50 },
  { type:'extra', key:'fly', label:'Voar de helicóptero', xp:80 },
  { type:'extra', key:'billboards', label:'Ver 3 projetos nos outdoors', xp:60 },
  { type:'extra', key:'garage', label:'Tirar um carro da garagem', xp:50 },
  { type:'extra', key:'coffee', get label() { return `Achar os cafés da redação ${coffeeGot.size}/${COFFEE_TOTAL}`; }, xp:120 },
  { type:'extra', key:'delivery', label:'Entregar um pedido de carro', xp:100 },
];
const questListEl = document.getElementById('quest-list');
const questCardEl = document.getElementById('quest-card');
let allMissionsDone = save.allMissionsDone || false;   // re-checked in renderQuestList: a save from before new missions existed is no longer 100%
const uiPref = (() => { try { return JSON.parse(localStorage.getItem('jopes_ui') || '{}'); } catch { return {}; } })();
const saveUiPref = () => { try { localStorage.setItem('jopes_ui', JSON.stringify(uiPref)); } catch {} };
const questHead = document.getElementById('quest-head');
function setQuestCollapsed(c) { questCardEl.classList.toggle('collapsed', c); questHead.setAttribute('aria-expanded', String(!c)); }
setQuestCollapsed(!!uiPref.questsCollapsed || matchMedia('(pointer: coarse)').matches);
questHead.addEventListener('click', () => { uiPref.questsCollapsed = !questCardEl.classList.contains('collapsed'); setQuestCollapsed(uiPref.questsCollapsed); saveUiPref(); });
const ctrlHint = document.getElementById('controls-hint');
if (uiPref.ctrlHidden) ctrlHint.classList.add('hidden');
document.getElementById('ctrl-close').addEventListener('click', () => { ctrlHint.classList.add('hidden'); uiPref.ctrlHidden = true; saveUiPref(); });
document.getElementById('ctrl-open').addEventListener('click', () => { ctrlHint.classList.remove('hidden'); uiPref.ctrlHidden = false; saveUiPref(); });
if (/[?&]debug\b/.test(location.search)) document.body.classList.add('debug');
if (allMissionsDone) questCardEl.classList.add('all-done');

function renderQuestList() {
  let doneCount = 0;
  const CHECK = '<svg viewBox="0 0 10 10" fill="none" stroke="#06140c" stroke-width="2"><path d="M2 5.2 4.2 7.3 8 2.8"/></svg>';
  const GROUPS = [['zone', 'Lugares'], ['npc', 'Pessoas'], ['extra', 'Desafios']];
  questListEl.innerHTML = GROUPS.map(([type, title]) => {
    const rows = MISSIONS.filter(m => m.type === type).map(m => {
      const done = m.type === 'zone' ? revealedZones.has(m.key) : m.type === 'npc' ? talkedNPCs.has(m.key) : extrasDone.has(m.key);
      if (done) doneCount++;
      const secret = m.key === 'secret' && !done;
      return { done, html: `<div class="quest-row${done ? ' done' : ''}${secret ? ' secret' : ''}"><span class="quest-name"><span class="quest-check">${CHECK}</span><span class="qn">${secret ? '??? (segredo)' : m.label}</span></span><span class="quest-xp">+${m.xp}</span></div>` };
    });
    rows.sort((a, b) => a.done - b.done);                         // pending first
    return `<div class="q-group">${title} · ${rows.filter(r => r.done).length}/${rows.length}</div>` + rows.map(r => r.html).join('');
  }).join('');
  document.getElementById('quest-count').textContent = `${doneCount}/${MISSIONS.length}`;
  document.getElementById('quest-prog-fill').style.width = (doneCount / MISSIONS.length * 100) + '%';

  if (doneCount < MISSIONS.length && allMissionsDone) { allMissionsDone = false; questCardEl.classList.remove('all-done'); }
  if (doneCount === MISSIONS.length && !allMissionsDone) {
    allMissionsDone = true;
    questCardEl.classList.add('all-done');
    addXP(300);
    playSfx('complete');
    showToast('CIDADE 100% EXPLORADA — +300 XP BÔNUS', 'star');
    const flash = document.getElementById('completion-flash');
    flash.classList.remove('active');
    void flash.offsetWidth;
    flash.classList.add('active');
    writeSave();
    window.JOPES_PLUS?.confetti();
    setTimeout(showCompletionOverlay, 900);
  }
}
renderQuestList();
updateHUD();

// MAIN HQ starts already known (it's where the player spawns) — everything
// else reveals by walking up and pressing E.
revealZone('main');

/* ════════════════════════════════════════════════
   INPUT
   ════════════════════════════════════════════════ */
const keys = {};
const keyName = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
function handleInteract() {
  if (npcDialogOpen) { advanceNPCDialog(); return; }
  if (overlayOpen) return;
  if (pilot) { landHeli(); return; }
  if (drivingCar) { exitCar(); return; }
  if (nearNPC) { playSfx('talk'); talkToNPC(nearNPC); return; }
  if (nearHeli) { boardHeli(false); return; }
  if (nearBillboard) { playSfx('interact'); openProject(nearBillboard.billboard.k); return; }
  if (nearCar) { enterCar(nearCar); return; }
  if (nearBuilding) { playSfx('interact'); flashBuildingLabel(nearBuilding.zone); revealZone(nearBuilding.zone); openZone(nearBuilding.zone); }
}

window.addEventListener('keydown', e => {
  keys[keyName(e)] = true;
  if (e.key === 'e' || e.key === 'E') handleInteract();
  if ((e.key === 'h' || e.key === 'H') && drivingCar && !e.repeat) { playSfx('horn'); honkAt = performance.now(); }
  if ((e.key === 'f' || e.key === 'F') && !e.repeat) tryHelipad();
  if (e.key === ' ' && drivingCar) { e.preventDefault(); document.activeElement?.blur?.(); }   // freio de mão: não "clica" no botão que estiver em foco
  if (e.key === 'Escape') { if (tour.active) endTour(); closeNPCDialog(); closeOverlay(); }
  if (tour.active && (e.key === 'ArrowRight' || e.key === 'Enter')) tourNext();
});
window.addEventListener('keyup', e => { keys[keyName(e)] = false; });
// alt-tab / clicking away never delivers the keyup: let go of everything
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// rodinha do mouse = zoom da câmera (fica salvo); Ctrl+rodinha não dá zoom na página
let userZoom = clamp(+uiPref.zoom || 1, 0.7, 1.4);
window.addEventListener('wheel', e => {
  if (e.ctrlKey) { e.preventDefault(); return; }
  if (overlayOpen || npcDialogOpen || tour.active || e.target.closest?.(UI_SEL)) return;
  userZoom = clamp(userZoom * Math.exp(-e.deltaY * 0.0012), 0.7, 1.4);
  uiPref.zoom = Math.round(userZoom * 100) / 100; saveUiPref();
}, { passive:false });
document.addEventListener('gesturestart', e => e.preventDefault());

// mobile: real on-screen D-pad + [E] button (wired up in the TOUCH CONTROLS section below)

/* ════════════════════════════════════════════════
   MOVEMENT
   ════════════════════════════════════════════════ */
const SPEED = 260; // map-space px/sec
const RUN_BOOST = 1.6;
const pvel = { x: 0, y: 0 };                    // velocidade atual do personagem a pé (px/s no mapa)
const joyVec = { x: 0, y: 0, m: 0 };            // joystick do celular: direção + intensidade (0…1)
const SPRITE_BY_ANGLE = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
// clicar/tocar no chão: o personagem anda em linha reta até o ponto (para ao encostar em algo)
let walkTarget = null, walkMark = null;
function setWalkTarget(p) {
  if (!p && !walkTarget) return;
  walkTarget = p ? { x: p.x, y: p.y, stuck: 0 } : null;
  if (p && !walkMark) { walkMark = document.createElement('div'); walkMark.className = 'walk-mark'; worldPanEl.appendChild(walkMark); }
  if (walkMark) {
    walkMark.style.display = p ? '' : 'none';
    if (p) { walkMark.style.left = p.x + 'px'; walkMark.style.top = p.y + 'px'; walkMark.style.animation = 'none'; void walkMark.offsetWidth; walkMark.style.animation = ''; }
  }
}
const NPC_COLLIDE_RADIUS = 28;

// Every solid city object blocks its iso footprint (+ a little padding for
// the sprite's feet) — so you can walk right up to a wall, or behind it.
const FOOT_PAD = 12;
function collidesAt(x, y, pad = FOOT_PAD, npcExtra = 0) {
  const p = CITY.I(x, y);
  for (const o of CITY.objects) {
    if (o.solid && Math.abs(p.u - o.u) < o.a + pad && Math.abs(p.v - o.v) < o.b + pad) return true;
  }
  for (const npc of NPCS) {
    if (Math.hypot(x - npc.def.pos.x, y - npc.def.pos.y) < NPC_COLLIDE_RADIUS + npcExtra) return true;
  }
  return false;
}

// Driven car: its real footprint (an oriented rectangle that turns with the car) against each object's
// footprint, instead of a fat circle — so you only stop where you'd actually touch something.
const CAR_HL = 30, CAR_HW = 14;    // half length / half width of the car body (iso units)
function carCollidesAt(x, y, ang) {
  const p = CITY.I(x, y), c = Math.cos(ang), s = Math.sin(ang), ac = Math.abs(c), as = Math.abs(s);
  const eu = ac * CAR_HL + as * CAR_HW, ev = as * CAR_HL + ac * CAR_HW;    // car extent on the u / v axes
  for (const o of CITY.objects) {
    if (!o.solid) continue;
    const du = o.u - p.u, dv = o.v - p.v;
    if (Math.abs(du) >= o.a + eu || Math.abs(dv) >= o.b + ev) continue;
    if (Math.abs(du * c + dv * s) < CAR_HL + o.a * ac + o.b * as && Math.abs(-du * s + dv * c) < CAR_HW + o.a * as + o.b * ac) return true;
  }
  for (const npc of NPCS) if (Math.hypot(x - npc.def.pos.x, y - npc.def.pos.y) < NPC_COLLIDE_RADIUS + 24) return true;
  return false;
}

let nearBuilding = null;
// download the garage's 3D models only once the player heads that way (they're ~23 MB)
let garageSpot = null, garagePreloaded = false;
function preloadGarageNear() {
  if (garagePreloaded || !window.JOPES_GARAGE?.loadModels) return;
  if (!garageSpot) { const g = BUILDINGS.find(b => b.zone === 'garage'); if (!g) return; garageSpot = CITY.S(g.u, g.v); }
  if (Math.hypot(playerPos.x - garageSpot.x, playerPos.y - garageSpot.y) < 330) { garagePreloaded = true; window.JOPES_GARAGE.loadModels(); }
}
// desktop on a good connection: fetch them quietly a few seconds after the player starts moving
{
  const light = matchMedia('(pointer: coarse)').matches || navigator.connection?.saveData || /2g|3g/.test(navigator.connection?.effectiveType || '');
  if (!light) addEventListener('keydown', function idle() {
    removeEventListener('keydown', idle);
    setTimeout(() => { const go = () => { if (!garagePreloaded) { garagePreloaded = true; window.JOPES_GARAGE?.loadModels?.(); } }; window.requestIdleCallback ? requestIdleCallback(go, { timeout: 2000 }) : go(); }, 4000);   // the game loop is never idle: the timeout makes sure it runs
  });
}
let nearNPC = null;
let overlayOpen = false;
let moving = false;

function updatePlayer(dt) {
  const up    = keys['ArrowUp']    || keys['w'] || keys['W'];
  const down  = keys['ArrowDown']  || keys['s'] || keys['S'];
  const left  = keys['ArrowLeft']  || keys['a'] || keys['A'];
  const right = keys['ArrowRight'] || keys['d'] || keys['D'];

  let dx = 0, dy = 0;
  if (up) dy -= 1;
  if (down) dy += 1;
  if (left) dx -= 1;
  if (right) dx += 1;

  moving = dx !== 0 || dy !== 0;
  document.body.classList.toggle('is-moving', moving);
  preloadGarageNear();

  if (pilot || drivingCar) { pvel.x = pvel.y = 0; setWalkTarget(null); }
  if (pilot) { updateHeli(dt, dx, dy); nearNPC = null; nearBuilding = null; nearCar = null; nearHeli = null; return; }
  if (drivingCar) { updateDriving(dt, dx, dy); nearNPC = null; nearBuilding = null; nearCar = null; return; }

  // Entrada: teclado (8 direções), joystick (analógico) ou um ponto clicado/tocado no chão.
  let ix = 0, iy = 0, mag = 0;
  if (joyVec.m > 0) { ix = joyVec.x; iy = joyVec.y; mag = joyVec.m; setWalkTarget(null); }
  else if (moving) { const len = Math.hypot(dx, dy); ix = dx / len; iy = dy / len; mag = 1; setWalkTarget(null); }
  else if (walkTarget) {
    const tx = walkTarget.x - playerPos.x, ty = walkTarget.y - playerPos.y, d = Math.hypot(tx, ty);
    if (d < 8 || walkTarget.stuck > 0.3) setWalkTarget(null);       // chegou, ou encostou numa parede
    else { ix = tx / d; iy = ty / d; mag = Math.min(1, d / 60 + 0.4); }
  }
  // O personagem tem inércia curta: acelera em ~0,1 s e para um pouco mais rápido, em vez de ligar/desligar seco.
  const run = keys['Shift'] ? RUN_BOOST : 1;      // Shift = correr
  const ease = Math.min(1, dt * (mag ? 12 : 16));
  pvel.x += (ix * SPEED * run * mag - pvel.x) * ease;
  pvel.y += (iy * SPEED * run * mag - pvel.y) * ease;
  if (!mag && Math.hypot(pvel.x, pvel.y) < 8) pvel.x = pvel.y = 0;
  const sp = Math.hypot(pvel.x, pvel.y);
  if (sp > 0) {
    const nx = clamp(playerPos.x + pvel.x * dt, EDGE_MARGIN, MAP_PX - EDGE_MARGIN);
    const ny = clamp(playerPos.y + pvel.y * dt, EDGE_MARGIN, MAP_PX - EDGE_MARGIN);
    // if already stuck inside a collider (bad coords, tuning slip), never hard-lock —
    // let this frame's move through so the player can always walk back out
    const alreadyStuck = collidesAt(playerPos.x, playerPos.y);
    let moved = 0;
    // cada eixo é testado sozinho: andando na diagonal contra uma parede o personagem desliza ao longo dela
    if (alreadyStuck || !collidesAt(nx, playerPos.y)) { moved += Math.abs(nx - playerPos.x); playerPos.x = nx; } else pvel.x = 0;
    if (alreadyStuck || !collidesAt(playerPos.x, ny)) { moved += Math.abs(ny - playerPos.y); playerPos.y = ny; } else pvel.y = 0;
    if (walkTarget) walkTarget.stuck = moved < sp * dt * 0.3 ? walkTarget.stuck + dt : 0;
  }
  moving = mag > 0;
  document.body.classList.toggle('is-moving', moving);

  if (moving) {
    spriteDir = SPRITE_BY_ANGLE[(Math.round(Math.atan2(iy, ix) / (Math.PI / 4)) + 8) % 8];
    spriteAnimTime += dt * run * Math.max(0.55, mag);
    if (spriteAnimTime >= 1 / SPRITE_FPS) {
      spriteAnimTime = 0;
      spriteFrame = (spriteFrame + 1) % WALK_FRAMES;
    }
    playerImgEl.src = spritePaths[`walk_${spriteDir}`][spriteFrame];
  } else {
    spriteFrame = 0;
    spriteAnimTime = 0;
    playerImgEl.src = spritePaths[`idle_${spriteDir}`];
  }

  // NPC proximity — closest NPC within range
  nearNPC = null;
  {
    let closestDist = Infinity;
    for (const npc of NPCS) {
      const dist = Math.hypot(playerPos.x - npc.def.pos.x, playerPos.y - npc.def.pos.y);
      if (dist < 70 && dist < closestDist) { closestDist = dist; nearNPC = npc; }
    }
  }

  // find nearest building (revealed or not — E reveals+opens in one step)
  nearBuilding = null;
  if (!nearNPC) {
    let closestDist = Infinity;
    for (const b of BUILDINGS) {
      const dist = footprintDist(playerPos.x, playerPos.y, b);
      if (dist < 70 && dist < closestDist) { closestDist = dist; nearBuilding = b; }
    }
  }

  // parked car within reach? (traffic cars don't stop for hitchhikers)
  nearCar = null;
  if (!nearNPC) {
    let closestDist = 80;
    for (const car of CITY.cars) {
      if (car.ai) continue;
      const dist = Math.hypot(playerPos.x - car.x, playerPos.y - car.y);
      if (dist < closestDist) { closestDist = dist; nearCar = car; }
    }
    if (nearCar && nearBuilding && footprintDist(playerPos.x, playerPos.y, nearBuilding) < 25) nearCar = null;
  }
  nearBillboard = null;
  if (!nearNPC) {
    let best = 75;
    for (const o of CITY.billboards) { const d = footprintDist(playerPos.x, playerPos.y, o); if (d < best) { best = d; nearBillboard = o; } }
    if (nearBillboard) { nearCar = null; }
  }
  nearHeli = (!nearNPC && heli.state === 'ground' && Math.hypot(playerPos.x - heli.x, playerPos.y - heli.y) < 90) ? heli : null;
  if (nearHeli) nearCar = null;
  document.body.classList.toggle('can-fly', atHQ() && heli.state === 'roof');
}

/* ════════════════════════════════════════════════
   CARS — walk up to a parked car and press E to drive it. Cars move along
   the iso grid (8 headings), H honks, E again to get out. Traffic cars loop
   along their lanes and brake for you.
   ════════════════════════════════════════════════ */
// Simple bicycle-model car: throttle/brake change speed, the front wheels steer,
// and the turn rate depends on speed (no turning on the spot, inverted in reverse).
const CAR = {
  MAX_SPEED: 520,     // iso units/s forward
  MAX_REVERSE: 170,   // iso units/s backward
  ACCEL: 360,         // throttle
  BRAKE: 900,         // S while moving forward
  DRAG: 1.1,          // rolling resistance (per second, proportional)
  COAST: 70,          // constant decel when off the throttle
  WHEELBASE: 62,      // bigger = wider turning circle
  MAX_STEER: 0.5,     // rad at the front wheels
  STEER_RATE: 2.4,    // how fast the wheel turns toward the input (rad/s)
  GRIP_LOSS: 0.65,    // at top speed the max steer shrinks by this fraction
  YAW_EASE: 5,        // how fast the body's turn rate follows the wheels (1/s): the car has weight
};
const CAR_PAD = 24;      // extra clearance around the car body (iso units)
let nearBillboard = null;
let drivingCar = null, nearCar = null, driveDist = 0, honkAt = 0, lastBump = 0;

function updateDriving(dt, dx, dy) {
  const car = drivingCar;
  const throttle = dy < 0 ? 1 : 0, brake = dy > 0 ? 1 : 0, steerIn = dx;

  // speed
  if (throttle) car.speed += CAR.ACCEL * dt * (car.speed < 0 ? 2.5 : 1);
  else if (brake) car.speed -= (car.speed > 0 ? CAR.BRAKE : CAR.ACCEL * 0.6) * dt;
  else {
    const c = Math.min(Math.abs(car.speed), CAR.COAST * dt);
    car.speed -= Math.sign(car.speed) * c;
  }
  // Espaço = freio de mão: trava as rodas de trás, a traseira escapa e o carro segue um pouco de lado (derrapagem)
  const hb = !!keys[' '] && car.speed > 30;
  if (hb) car.speed = Math.max(0, car.speed - CAR.BRAKE * 0.45 * dt);
  car.speed -= car.speed * CAR.DRAG * 0.25 * dt;
  car.speed = clamp(car.speed, -CAR.MAX_REVERSE, CAR.MAX_SPEED);
  if (Math.abs(car.speed) < 2 && !throttle && !brake) car.speed = 0;

  // steering: the wheel eases toward the input; less lock at high speed
  const lock = Math.min(CAR.MAX_STEER, CAR.MAX_STEER * (1 - CAR.GRIP_LOSS * Math.min(1, Math.abs(car.speed) / CAR.MAX_SPEED)) * (hb ? 1.9 : 1));
  const target = steerIn * lock;
  const ds = target - car.steer, maxStep = CAR.STEER_RATE * dt;
  car.steer += clamp(ds, -maxStep, maxStep);
  if (!steerIn && Math.abs(car.steer) < 0.02) car.steer = 0;

  // heading changes with distance travelled (bicycle model, signed speed: in reverse the nose swings
  // the other way, like a real car). +angle = clockwise on screen. The turn rate eases toward the
  // geometric one, so the body has some inertia instead of snapping around.
  const yawTarget = (car.speed / CAR.WHEELBASE) * Math.tan(car.steer) * (hb ? 1.35 : 1);
  car.yaw = (car.yaw || 0) + (yawTarget - (car.yaw || 0)) * Math.min(1, CAR.YAW_EASE * dt);
  const prevAngle = car.angle;
  car.angle += car.yaw * dt;

  // derrapagem: o carro anda numa direção um pouco atrás de para onde o nariz aponta; sem freio de mão ela volta a zero
  const slipT = hb ? clamp((car.yaw || 0) * 0.5, -0.55, 0.55) : 0;
  car.slip = (car.slip || 0) + (slipT - (car.slip || 0)) * Math.min(1, dt * (hb ? 5 : 2.4));
  const travel = car.angle - car.slip;
  const du = Math.cos(travel) * car.speed * dt, dv = Math.sin(travel) * car.speed * dt;
  const nx = car.x + (du - dv), ny = car.y + (du + dv) / 2;
  const inside = nx > EDGE_MARGIN && nx < MAP_PX - EDGE_MARGIN && ny > EDGE_MARGIN && ny < MAP_PX - EDGE_MARGIN;
  if (car.speed !== 0) {
    if (inside && !carCollidesAt(nx, ny, car.angle)) {
      driveDist += Math.hypot(nx - car.x, ny - car.y);
      CITY.moveCar(car, nx, ny);
      if (driveDist > 900 && !extrasDone.has('drive')) {
        extrasDone.add('drive');
        addXP(50);
        showToast('MISSÃO: VOLTA DE CARRO +50 XP', 'star');
        renderQuestList();
        writeSave();
      }
    } else {
      // crash: stop dead and bounce back a little
      if (Math.abs(car.speed) > 60 && performance.now() - lastBump > 250) { lastBump = performance.now(); playSfx('bump'); }
      car.speed = -car.speed * 0.25;
      car.angle = prevAngle; car.yaw = 0; car.slip = 0;
    }
  }
  car.wheelRot = (car.wheelRot || 0) + car.speed * dt / 5.8; // wheels roll with the distance covered
  CITY.setCarHeading(car, car.angle, car.steer > 0.12 ? 1 : car.steer < -0.12 ? -1 : 0);
  car.el.classList.toggle('braking', (!!brake || hb) && car.speed > 5 || (car.speed < 0 && !throttle));
  updateEngine(car.speed);
  playerPos.x = car.x; playerPos.y = car.y;
}

// engine hum: one low oscillator whose pitch follows the speed
let engineOsc = null, engineGain = null;
function startEngine() {
  ensureAudio();
  if (engineOsc) return;
  engineOsc = audioCtx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineGain = audioCtx.createGain();
  engineGain.gain.value = 0.0001;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(masterGain);
  engineOsc.start();
}
function updateEngine(speed) {
  if (!engineOsc) return;
  const t = audioCtx.currentTime, v = Math.abs(speed) / CAR.MAX_SPEED;
  engineOsc.frequency.setTargetAtTime(42 + v * 95, t, 0.08);
  engineGain.gain.setTargetAtTime(0.05 + v * 0.07, t, 0.1);
}
function stopEngine() {
  if (!engineOsc) return;
  const t = audioCtx.currentTime;
  engineGain.gain.setTargetAtTime(0.0001, t, 0.08);
  const o = engineOsc; engineOsc = null;
  setTimeout(() => { try { o.stop(); } catch {} }, 400);
}

/* ════════════════════════════════════════════════
   HELICOPTER — parked on the MAIN HQ helipad. At the HQ door press F to ride
   the elevator up and take off. WASD flies (screen-relative, with inertia),
   E lands: back on the helipad if you're over the HQ, otherwise on any free
   spot on the ground (and E there to take off again).
   ════════════════════════════════════════════════ */
const heli = CITY.heli;
const HELI = { CRUISE: 420, CLIMB: 190, ACCEL: 760, DRAG: 1.6, MAX: 620, YAW: 3.2 };
let pilot = false, nearHeli = null, flyDist = 0, heliT = 0;
let heliOsc = null, heliLfo = null, heliGain = null;

function fadeThen(fn) {
  const f = document.getElementById('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 380);
}
const atHQ = () => footprintDist(playerPos.x, playerPos.y, B.main) < 80;
function tryHelipad() {
  if (pilot || drivingCar || overlayOpen || npcDialogOpen) return;
  if (atHQ() && heli.state === 'roof') { playSfx('door'); fadeThen(() => boardHeli(true)); }
}
function boardHeli(fromRoof) {
  pilot = true;
  heli.state = 'takeoff';
  heli.solid = false;
  heli.vx = heli.vy = 0;
  heli.el.classList.add('spinning');
  document.body.classList.add('flying');
  playerImgEl.style.display = 'none';
  document.body.classList.add('driving');
  playerPos.x = heli.x; playerPos.y = heli.y;
  startRotorSound();
  showToast(fromRoof ? 'DECOLANDO DO HQ · WASD VOA · E POUSA' : 'DECOLANDO · WASD VOA · E POUSA', 'city');
}
function landHeli() {
  if (heli.state !== 'flying') return;
  const overPad = Math.hypot(heli.x - heli.pad.x, heli.y - heli.pad.y) < 110;
  if (overPad) { heli.state = 'landing'; heli.target = { ...heli.pad }; return; }
  if (!collidesAt(heli.x, heli.y, 36, 40)) { heli.state = 'landing'; heli.target = { x: heli.x, y: heli.y, h: 0 }; return; }
  showToast('SEM ESPAÇO PRA POUSAR AQUI — TENTE UMA RUA OU O HELIPONTO DO HQ', 'alert');
}
function leaveHeli() {
  pilot = false;
  heli.el.classList.remove('spinning');
  document.body.classList.remove('flying');
  CITY.redraw(heli);
  document.body.classList.remove('driving');
  stopRotorSound();
  if (heli.state === 'roof') {
    // back down the elevator, out the front door of the HQ
    fadeThen(() => {
      const door = CITY.S(B.main.u - 70, B.main.v + 150);
      playerPos.x = door.x; playerPos.y = door.y;
      playerImgEl.style.display = '';
      showToast('DESCEU PELO ELEVADOR DO HQ', 'city');
    });
    return;
  }
  heli.solid = true;
  for (const [du, dv] of [[0, 60], [60, 0], [0, -60], [-60, 0], [60, 60], [-60, -60], [0, 90], [90, 0]]) {
    const x = heli.x + (du - dv), y = heli.y + (du + dv) / 2;
    if (!collidesAt(x, y)) { playerPos.x = x; playerPos.y = y; break; }
  }
  playerImgEl.style.display = '';
}
function updateHeli(dt, dx, dy) {
  heliT += dt;
  // vertical
  if (heli.state === 'takeoff') {
    const h = Math.min(HELI.CRUISE, heli.h + HELI.CLIMB * dt);
    if (h >= HELI.CRUISE) heli.state = 'flying';
    heli.h = h;
  } else if (heli.state === 'landing') {
    const t = heli.target;
    heli.vx *= Math.max(0, 1 - 4 * dt); heli.vy *= Math.max(0, 1 - 4 * dt);
    heli.x += (t.x - heli.x) * Math.min(1, 3 * dt);
    heli.y += (t.y - heli.y) * Math.min(1, 3 * dt);
    heli.h = Math.max(t.h, heli.h - HELI.CLIMB * 0.8 * dt);
    if (heli.h <= t.h + 0.5 && Math.hypot(t.x - heli.x, t.y - heli.y) < 3) {
      heli.x = t.x; heli.y = t.y; heli.h = t.h;
      heli.state = t.h > 0 ? 'roof' : 'ground';
      CITY.moveHeli(heli, heli.x, heli.y, heli.h);
      leaveHeli();
      return;
    }
  }
  // horizontal: screen-relative thrust with inertia (only once off the pad)
  if (heli.state !== 'landing' && heli.h > 40) {
    if (dx || dy) { const l = Math.hypot(dx, dy); heli.vx += dx / l * HELI.ACCEL * dt; heli.vy += dy / l * HELI.ACCEL * dt; }
    heli.vx -= heli.vx * HELI.DRAG * dt; heli.vy -= heli.vy * HELI.DRAG * dt;
    const sp = Math.hypot(heli.vx, heli.vy);
    if (sp > HELI.MAX) { heli.vx *= HELI.MAX / sp; heli.vy *= HELI.MAX / sp; }
    const nx = clamp(heli.x + heli.vx * dt, EDGE_MARGIN, MAP_PX - EDGE_MARGIN);
    const ny = clamp(heli.y + heli.vy * dt, EDGE_MARGIN + 200, MAP_PX - EDGE_MARGIN);
    flyDist += Math.hypot(nx - heli.x, ny - heli.y);
    heli.x = nx; heli.y = ny;
    // nose turns toward where it's going
    if (sp > 40) {
      const du = heli.vy + heli.vx / 2, dv = heli.vy - heli.vx / 2;
      let d = Math.atan2(dv, du) - heli.angle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heli.angle += clamp(d, -HELI.YAW * dt, HELI.YAW * dt);
    }
    if (flyDist > 1500 && !extrasDone.has('fly')) {
      extrasDone.add('fly'); addXP(80);
      showToast('MISSÃO: VOO DE HELICÓPTERO +80 XP', 'star');
      renderQuestList(); writeSave();
    }
  }
  const bob = heli.state === 'flying' ? Math.sin(heliT * 2.2) * 3 : 0;
  CITY.setHeliHeading(heli, heli.angle);
  const hLogical = heli.h;
  CITY.moveHeli(heli, heli.x, heli.y, hLogical + bob);
  heli.h = hLogical; // the bob is visual only
  updateRotorSound(Math.hypot(heli.vx, heli.vy));
  playerPos.x = heli.x; playerPos.y = heli.y;
}

// rotor sound: low saw whose volume is chopped by a ~12 Hz LFO
function startRotorSound() {
  ensureAudio();
  if (heliOsc) return;
  heliOsc = audioCtx.createOscillator(); heliOsc.type = 'sawtooth'; heliOsc.frequency.value = 48;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
  heliGain = audioCtx.createGain(); heliGain.gain.value = 0.0001;
  const chop = audioCtx.createGain(); chop.gain.value = 0.5;
  heliLfo = audioCtx.createOscillator(); heliLfo.type = 'square'; heliLfo.frequency.value = 11;
  const lfoAmt = audioCtx.createGain(); lfoAmt.gain.value = 0.5;
  heliLfo.connect(lfoAmt); lfoAmt.connect(chop.gain);
  heliOsc.connect(lp); lp.connect(chop); chop.connect(heliGain); heliGain.connect(masterGain);
  heliOsc.start(); heliLfo.start();
  heliGain.gain.setTargetAtTime(0.09, audioCtx.currentTime, 0.4);
}
function updateRotorSound(speed) {
  if (!heliOsc) return;
  const v = Math.min(1, speed / HELI.MAX), t = audioCtx.currentTime;
  heliLfo.frequency.setTargetAtTime(11 + v * 5, t, 0.2);
  heliOsc.frequency.setTargetAtTime(48 + v * 20, t, 0.2);
}
function stopRotorSound() {
  if (!heliOsc) return;
  heliGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.3);
  const o = heliOsc, l = heliLfo; heliOsc = heliLfo = null;
  setTimeout(() => { try { o.stop(); l.stop(); } catch {} }, 1200);
}

function enterCar(car) {
  drivingCar = car;
  car.solid = false;
  car.speed = 0; car.steer = 0; car.yaw = 0;
  car.angle = car.heading * 2 * Math.PI / 64;
  car.el.classList.add('driving');
  car.el.classList.remove('near-car');
  playerImgEl.style.display = 'none';
  document.body.classList.add('driving');
  playerPos.x = car.x; playerPos.y = car.y;
  playSfx('door'); setTimeout(() => { playSfx('engine'); startEngine(); }, 120);
  showToast('W ACELERA · S FREIA/RÉ · A/D ESTERÇA · ESPAÇO FREIO DE MÃO', 'city');
}

function exitCar() {
  const car = drivingCar;
  if (Math.abs(car.speed) > 140) { showToast('FREIA ANTES DE SAIR (S)', 'alert'); return; }
  car.solid = true;
  // first free spot around the car
  const spots = [[0, 52], [52, 0], [0, -52], [-52, 0], [52, 52], [-52, -52], [52, -52], [-52, 52], [0, 80], [80, 0]];
  for (const [du, dv] of spots) {
    const x = car.x + (du - dv), y = car.y + (du + dv) / 2;
    if (x < EDGE_MARGIN || x > MAP_PX - EDGE_MARGIN || y < EDGE_MARGIN || y > MAP_PX - EDGE_MARGIN) continue;
    if (!collidesAt(x, y)) {
      playerPos.x = x; playerPos.y = y;
      drivingCar = null;
      car.speed = 0; car.steer = 0; car.yaw = 0;
      car.el.classList.remove('driving', 'braking');   // before the redraw: the bike drops its rider
      CITY.setCarHeading(car, car.angle, 0);
      stopEngine();
      playerImgEl.style.display = '';
      document.body.classList.remove('driving');
      playSfx('door');
      return;
    }
  }
  car.solid = false;
  showToast('SEM ESPAÇO PRA SAIR AQUI', 'alert');
}

// traffic: move along the lane, brake if the player (or the player's car) is ahead.
// Cars on u-roads also yield to cars on v-roads so nobody deadlocks at a junction.
function updateTraffic(dt) {
  for (const car of CITY.cars) {
    const ai = car.ai; if (!ai) continue;
    const along = ai.axis, across = along === 'u' ? 'v' : 'u';
    const blockers = [];
    if (drivingCar) blockers.push(CITY.I(drivingCar.x, drivingCar.y)); else if (!pilot) blockers.push(CITY.I(playerPos.x, playerPos.y));
    if (heli.state === 'ground') blockers.push(heli);
    for (const o of CITY.cars) if (o !== car && !o.ai) blockers.push(o);
    if (along === 'u') for (const o of CITY.cars) if (o.ai && o.ai.axis === 'v') blockers.push(o);
    let blocked = false;
    for (const b of blockers) {
      const ahead = (b[along] - car[along]) * ai.dir, side = Math.abs(b[across] - car[across]);
      if (ahead > 0 && ahead < 95 && side < 36) { blocked = true; break; }
    }
    // a honk makes nearby stopped cars hurry along (they don't, but they flash)
    car.el.classList.toggle('honked', performance.now() - honkAt < 600 && drivingCar && Math.hypot(car.x - drivingCar.x, car.y - drivingCar.y) < 260);
    if (!blocked) {
      // red / amber light at the next junction → stop at the line
      const B_ = CITY.BLOCK, coord = car[along], road = Math.round(car[across] / B_);
      const next = ai.dir > 0 ? Math.ceil((coord + 1) / B_) : Math.floor((coord - 1) / B_);
      const stopAt = next * B_ - ai.dir * (CITY.ROAD / 2 + 26);
      const dist = (stopAt - coord) * ai.dir;
      if (dist > -2 && dist < 34) {
        const st = along === 'u' ? CITY.lightAt(next, road, 'u') : CITY.lightAt(road, next, 'v');
        if (st !== 'g') blocked = true;
      }
    }
    if (car.el.classList.contains('braking') !== blocked) { car.el.classList.toggle('braking', blocked); CITY.redraw(car); } // brake lights
    if (blocked) continue;
    let pos = car[along] + ai.dir * ai.speed * dt;
    if (pos > ai.hi) pos = ai.lo; else if (pos < ai.lo) pos = ai.hi;
    const u = along === 'u' ? pos : car.u, v = along === 'u' ? car.v : pos;
    const sp = CITY.S(u, v);
    CITY.moveCar(car, sp.x, sp.y);
  }
}

/* ════════════════════════════════════════════════
   MINIMAP
   ════════════════════════════════════════════════ */
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
const MM_DPR = Math.min(2, window.devicePixelRatio || 1);
function sizeMinimap() { const w = mmCanvas.clientWidth || 150; mmCanvas.width = mmCanvas.height = Math.round(w * MM_DPR); }
sizeMinimap(); addEventListener('resize', sizeMinimap);
const MM_SCALE = 100 / MAP_PX;

const ZONE_COLORS = CITY.colors;

function drawMinimap() {
  const k = mmCanvas.width / 110;                    // draw in a 110-unit space, scaled to the canvas
  mmCtx.setTransform(1, 0, 0, 1, 0, 0);
  mmCtx.clearRect(0, 0, mmCanvas.width, mmCanvas.height);
  mmCtx.setTransform(k, 0, 0, k, 0, 0);
  mmCtx.fillStyle = 'rgba(4,8,15,0.75)'; mmCtx.fillRect(0, 0, 110, 110);
  mmCtx.save();
  mmCtx.beginPath(); mmCtx.rect(2, 2, 106, 106); mmCtx.clip();
  mmCtx.lineCap = 'round';
  mmCtx.strokeStyle = 'rgba(200,215,230,0.16)'; mmCtx.lineWidth = 2.2;
  CITY.roads.forEach(r => {
    mmCtx.beginPath();
    mmCtx.moveTo(5 + r.a.x*MM_SCALE, 5 + r.a.y*MM_SCALE);
    mmCtx.lineTo(5 + r.b.x*MM_SCALE, 5 + r.b.y*MM_SCALE);
    mmCtx.stroke();
  });
  BUILDINGS.forEach(b => {
    if (b.zone === 'secret' && !revealedZones.has('secret')) return;
    const x = 5 + b.x*MM_SCALE, y = 5 + b.y*MM_SCALE, lit = revealedZones.has(b.zone);
    mmCtx.fillStyle = ZONE_COLORS[b.zone] || '#ffffff';
    mmCtx.globalAlpha = lit ? 0.95 : 0.45;
    mmCtx.beginPath(); mmCtx.arc(x, y, 3.2, 0, Math.PI*2); mmCtx.fill();
    if (lit) { mmCtx.globalAlpha = 0.18; mmCtx.beginPath(); mmCtx.arc(x, y, 6, 0, Math.PI*2); mmCtx.fill(); }
  });
  mmCtx.globalAlpha = 1;
  window.JOPES_PLUS?.minimap(mmCtx, MM_SCALE);
  const px = 5 + playerPos.x*MM_SCALE, py = 5 + playerPos.y*MM_SCALE, t = performance.now() / 1000;
  mmCtx.strokeStyle = 'rgba(255,230,0,' + (0.55 - (t % 1.4) / 1.4 * 0.55) + ')'; mmCtx.lineWidth = 1;
  mmCtx.beginPath(); mmCtx.arc(px, py, 3 + (t % 1.4) / 1.4 * 7, 0, Math.PI*2); mmCtx.stroke();
  mmCtx.fillStyle = '#FFE600'; mmCtx.strokeStyle = '#0a0d12'; mmCtx.lineWidth = 1.2;
  mmCtx.beginPath(); mmCtx.arc(px, py, 3, 0, Math.PI*2); mmCtx.fill(); mmCtx.stroke();
  mmCtx.restore();
}

/* ════════════════════════════════════════════════
   HUD
   ════════════════════════════════════════════════ */
const interactPrompt = document.getElementById('interact-prompt');
{ // every caller sets .textContent = '[ E ] ENTRAR · [ F ] …' — render those brackets as keycaps
  let last = '';
  Object.defineProperty(interactPrompt, 'textContent', {
    get() { return last; },
    set(v) { if (v === last) return; last = v;
      this.innerHTML = esc(v).replace(/\[ ?([A-Z]+) ?\]/g, '<kbd>$1</kbd>').replace(/ · /g, '<span class="sep">·</span>'); }
  });
}
const zoneName = document.getElementById('zone-name');
const zoneSub = document.getElementById('zone-sub');
const debugCoords = document.getElementById('debug-coords');

const zoneDot = document.getElementById('zone-dot'), mmZone = document.getElementById('mm-zone');
function updateZoneHUD() {
  updateZoneHUDText();
  const c = pilot || drivingCar ? 'var(--cyan)' : nearBuilding ? (ZONE_COLORS[nearBuilding.zone] || 'var(--accent)') : nearBillboard ? 'var(--accent2)' : 'var(--accent)';
  if (zoneDot._c !== c) { zoneDot._c = c; zoneDot.style.background = c; zoneDot.style.color = c; }
  const z = zoneName.textContent; if (mmZone._z !== z) { mmZone._z = z; mmZone.textContent = z; }
}
function updateZoneHUDText() {
  if (npcDialogOpen) { interactPrompt.classList.remove('visible'); return; }
  if (pilot) {
    const kmh = Math.round(Math.hypot(heli.vx, heli.vy) * 0.3);
    zoneName.textContent = 'HELICÓPTERO JOPES';
    zoneSub.textContent = `ALT ${Math.round(heli.h / 3)} M · ${kmh} KM/H`;
    const overPad = Math.hypot(heli.x - heli.pad.x, heli.y - heli.pad.y) < 110;
    interactPrompt.textContent = heli.state === 'flying' ? (overPad ? '[ E ] POUSAR NO HELIPONTO' : '[ E ] POUSAR') : heli.state === 'takeoff' ? 'DECOLANDO…' : 'POUSANDO…';
    interactPrompt.classList.add('visible');
    return;
  }
  if (nearHeli) {
    zoneName.textContent = 'HELICÓPTERO JOPES';
    zoneSub.textContent = 'POUSADO';
    interactPrompt.textContent = '[ E ] DECOLAR';
    interactPrompt.classList.add('visible');
    return;
  }
  if (drivingCar) {
    zoneName.textContent = drivingCar.special ? jopesCarName() : 'DIRIGINDO';
    const kmh = Math.round(Math.abs(drivingCar.speed) * 0.22);
    zoneSub.textContent = (drivingCar.speed < -1 ? 'RÉ · ' : '') + kmh + ' KM/H · A/D ESTERÇA';
    interactPrompt.textContent = drivingCar.special && garageCar === 'xtz' ? '[ E ] DESCER DA MOTO' : '[ E ] SAIR DO CARRO';
    interactPrompt.classList.add('visible');
  } else if (nearNPC) {
    zoneName.textContent = nearNPC.def.name;
    zoneSub.textContent = nearNPC.def.sub;
    interactPrompt.textContent = '[ E ] CONVERSAR COM ' + nearNPC.def.name + (atHQ() && heli.state === 'roof' ? ' · [ F ] HELIPONTO' : '');
    interactPrompt.classList.add('visible');
  } else if (nearBillboard) {
    const p = projectList()[nearBillboard.billboard.k];
    zoneName.textContent = 'OUTDOOR · PROJETO ' + String(nearBillboard.billboard.k + 1).padStart(2, '0');
    zoneSub.textContent = p ? (p.title?.pt || p.title) : '';
    interactPrompt.textContent = '[ E ] VER PROJETO';
    interactPrompt.classList.add('visible');
  } else if (nearCar) {
    zoneName.textContent = nearCar.special ? jopesCarName() : 'CARRO ESTACIONADO';
    zoneSub.textContent = 'DÁ PRA DIRIGIR';
    interactPrompt.textContent = '[ E ] DIRIGIR';
    interactPrompt.classList.add('visible');
  } else if (nearBuilding) {
    zoneName.textContent = nearBuilding.label;
    zoneSub.textContent = nearBuilding.sublabel;
    interactPrompt.textContent = (nearBuilding === B.main && heli.state === 'roof') ? '[ E ] ENTRAR · [ F ] HELIPONTO' : '[ E ] ENTRAR';
    interactPrompt.classList.add('visible');
  } else {
    zoneName.textContent = 'CITY CENTER';
    zoneSub.textContent = 'EXPLORE A CIDADE';
    interactPrompt.classList.remove('visible');
  }
}

/* ════════════════════════════════════════════════
   OVERLAY
   ════════════════════════════════════════════════ */
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');
let currentProjIdx = 0;

const npcDialogEl = document.getElementById('npc-dialog');
const npcDialogPortrait = document.getElementById('npc-dialog-portrait');
const npcDialogName = document.getElementById('npc-dialog-name');
const npcDialogSub = document.getElementById('npc-dialog-sub');
const npcDialogText = document.getElementById('npc-dialog-text');
const npcDialogPage = document.getElementById('npc-dialog-page');
const npcDialogNext = document.getElementById('npc-dialog-next');

let npcDialogOpen = false;
let npcDialogPages = [];
let npcDialogIdx = 0;

function openNPCDialog(npc) {
  const { name, sub, question, answer, imgPath } = npc.def;
  const G = CITY.getGL();
  if (CHARS_3D && G?.personBust) { npcDialogPortrait.src = bustCache[npc.def.key] || (bustCache[npc.def.key] = G.personBust(npc.def.key)); npcDialogPortrait.className = ''; }
  else { npcDialogPortrait.src = imgPath; npcDialogPortrait.className = npc.def.cls || ''; }
  npcDialogName.textContent = name;
  npcDialogSub.textContent = sub;
  npcDialogPages = [{ text: `Você: "${question}"`, question: true }, ...answer.split('\n\n').map(text => ({ text }))];
  npcDialogIdx = 0;
  npcDialogOpen = true;
  renderNPCDialogPage();
  npcDialogEl.classList.add('active');
}

function renderNPCDialogPage() {
  const page = npcDialogPages[npcDialogIdx];
  npcDialogText.textContent = page.text;
  npcDialogText.classList.toggle('question', !!page.question);
  npcDialogPage.textContent = (npcDialogIdx + 1) + ' / ' + npcDialogPages.length;
  npcDialogNext.textContent = npcDialogIdx < npcDialogPages.length - 1 ? '[ E ] CONTINUAR' : '[ E ] FECHAR';
}

function advanceNPCDialog() {
  if (npcDialogIdx < npcDialogPages.length - 1) {
    npcDialogIdx++;
    renderNPCDialogPage();
  } else {
    closeNPCDialog();
  }
}

function closeNPCDialog() {
  npcDialogOpen = false;
  npcDialogEl.classList.remove('active');
}

function openZone(zone) {
  const data = ZONE_CONTENT[zone];
  if (!data) return;
  if (zone === 'garage') { openGarage(); return; }
  if (zone === 'projects') { currentProjIdx = 0; renderProjectOverlay(); }
  else overlayContent.innerHTML = buildOverlayHTML(data, zone);
  overlay.classList.add('active');
  overlayOpen = true;
}

function showCompletionOverlay() {
  if (overlayOpen) return;
  overlayContent.innerHTML = `
    <div class="ov-id">FINAL SECRETO</div>
    <div class="ov-title">CIDADE\n100% EXPLORADA</div>
    <div class="ov-sub">Você desbloqueou tudo que a JOPES.EXE tinha pra mostrar</div>
    <hr class="ov-divider">
    <div class="ov-body">Conversou com todo mundo, entrou em cada prédio e até achou o arquivo .env escondido. Por isso o bônus de +300 XP.

Se quiser ir além do mapa, o histórico completo e mais projetos estão em:</div>
    <div class="contact-links">
      <a class="contact-link" href="../"><span class="contact-link-icon">${ICONS.globe}</span><div><div>O Jopes</div><div class="contact-link-sub">Portfólio completo, em formato de jornal</div></div></a>
    </div>
  `;
  overlay.classList.add('active');
  overlayOpen = true;
}

function buildOverlayHTML(data, zone) {
  let h = `<div class="ov-id">${data.id}</div>`;
  h += `<div class="ov-title">${data.title}</div>`;
  if (data.sub) h += `<div class="ov-sub">${data.sub}</div>`;
  h += `<hr class="ov-divider">`;
  if (data.body) h += `<div class="ov-body">${data.body}</div>`;
  if (zone==='about' && data.timeline) {
    h += `<div class="ov-id" style="margin-top:8px">TIMELINE</div><div class="timeline">`;
    data.timeline.forEach(t => h += `<div class="tl-item"><div class="tl-date">${t.date}</div><div class="tl-role">${t.role}</div><div class="tl-company">${t.company}</div></div>`);
    h += `</div>`;
  }
  if (zone==='stack' && data.techGrid) {
    h += `<div class="tech-grid">`;
    data.techGrid.forEach(cat => {
      h += `<div class="tech-cat"><div class="tech-cat-name">${cat.cat}</div>`;
      cat.items.forEach(i => h += `<div class="tech-item">→ ${i}</div>`);
      h += `</div>`;
    });
    h += `</div>`;
  }
  if (zone==='lab' && data.labCards) {
    h += `<div class="lab-grid">`;
    data.labCards.forEach(c => h += `<div class="lab-card"><div class="lab-card-icon">${ICONS[c.icon]}</div><div class="lab-card-title">${c.title}</div><div class="lab-card-body">${c.body}</div></div>`);
    h += `</div>`;
    if (data.link) h += `<div style="margin-top:24px"><a href="${data.link}" target="_blank" class="contact-link" style="display:inline-flex"><span class="contact-link-icon">${ICONS.globe}</span><div><div>${data.link}</div><div class="contact-link-sub">Abrir Backend Lab</div></div></a></div>`;
  }
  if (zone==='contact' && data.links) {
    h += `<div class="contact-links">`;
    data.links.forEach(l => h += `<a class="contact-link" href="${l.href}" target="_blank"><span class="contact-link-icon">${ICONS[l.icon]}</span><div><div>${l.label}</div><div class="contact-link-sub">${l.sub}</div></div></a>`);
    h += `</div>`;
  }
  if (data.tags) {
    h += `<div class="tags">`;
    data.tags.forEach(t => h += `<span class="tag">${t}</span>`);
    h += `</div>`;
  }
  return h;
}

let PROJECT_DATA = null;
const projectList = () => PROJECT_DATA || PROJECTS;
const CAT_LABEL = { monolith:'Monolito', frontend:'Front-end', mobile:'Mobile', admin:'Backoffice', integration:'Integração', 'event-driven':'Event-driven', iac:'Infra as Code', automation:'Automação', sync:'Sync' };
function openProject(k) {
  currentProjIdx = k;
  renderProjectOverlay();
  overlay.classList.add('active');
  overlayOpen = true;
  const p = projectList()[k];
  if (p && p.slug && !viewedProjects.has(p.slug)) {
    viewedProjects.add(p.slug);
    if (viewedProjects.size >= 3 && !extrasDone.has('billboards')) {
      extrasDone.add('billboards'); addXP(60);
      showToast('MISSÃO: 3 PROJETOS VISTOS +60 XP', 'star');
      renderQuestList();
    }
    writeSave();
  }
}
function renderProjectOverlay() {
  if (PROJECT_DATA) return renderRealProject();
  const p = PROJECTS[currentProjIdx];
  let h = `<div class="ov-id">${p.code} — ${currentProjIdx+1} / ${PROJECTS.length}</div>`;
  h += `<div class="ov-title">${p.type}</div><div class="ov-sub">${p.title}</div>`;
  h += `<hr class="ov-divider"><div class="ov-body">${p.body}</div>`;
  h += `<div class="tags">` + p.tags.map(t=>`<span class="tag cyan">${t}</span>`).join('') + `</div>`;
  h += `<div class="proj-nav">`;
  h += `<button onclick="prevProj()" ${currentProjIdx===0?'disabled':''}>← ANTERIOR</button>`;
  h += `<button onclick="nextProj()" ${currentProjIdx===PROJECTS.length-1?'disabled':''}>PRÓXIMO →</button>`;
  h += `</div>`;
  overlayContent.innerHTML = h;
}

function renderRealProject() {
  const L = PROJECT_DATA, k = currentProjIdx, p = L[k];
  const t = x => esc(x?.pt ?? x);
  const list = (title, arr) => arr?.pt?.length ? `<div class="proj-h">${title}</div><ul class="proj-list">${arr.pt.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  let h = `<div class="proj-head">`;
  if (p.image) h += `<div class="proj-media"><img src="${p.image}" alt="${t(p.title)}"></div>`;
  h += `<div><div class="ov-id">PROJETO ${String(k + 1).padStart(2, '0')} / ${L.length}</div>`;
  h += `<div class="ov-title proj-title">${t(p.title)}</div><div class="ov-sub" style="margin-bottom:0;line-height:1.6;letter-spacing:.05em">${t(p.subtitle)}</div>`;
  h += `<div class="proj-badges"><span class="proj-badge">${p.type === 'personal' ? 'Pessoal' : 'Profissional'}</span><span class="proj-badge">${p.year}</span><span class="proj-badge">${CAT_LABEL[p.category] || p.category}</span><span class="proj-badge">Complexidade ${'★'.repeat(p.complexity)}</span></div>`;
  if (p.role) h += `<div class="proj-role">${t(p.role)}</div>`;
  h += `</div></div>`;
  h += `<div class="ov-body" style="margin-bottom:8px">${t(p.description)}</div>`;
  h += `<div class="proj-grid"><div class="proj-sec"><h4>O PROBLEMA</h4><p>${t(p.problem)}</p></div><div class="proj-sec"><h4>A SOLUÇÃO</h4><p>${t(p.solution)}</p></div></div>`;
  h += list('DESTAQUES', p.highlights) + list('RESULTADOS', p.results) + list('DECISÕES TÉCNICAS', p.technicalDecisions) + list('DESAFIOS', p.challenges);
  h += `<div class="proj-h">STACK</div><div class="tags" style="margin-bottom:20px">` + p.techStack.map(x => `<span class="tag cyan">${esc(x)}</span>`).join('') + `</div>`;
  h += `<a class="proj-link" href="/pt/projects/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">VER NO PORTFÓLIO ↗</a>`;
  h += `<div class="proj-nav"><button onclick="prevProj()" ${k === 0 ? 'disabled' : ''}>← ANTERIOR</button><button onclick="nextProj()" ${k === L.length - 1 ? 'disabled' : ''}>PRÓXIMO →</button></div>`;
  overlayContent.innerHTML = h;
  overlayContent.parentElement.scrollTop = 0;
}
window.prevProj = () => { if (currentProjIdx>0) { currentProjIdx--; openProject(currentProjIdx); } };
window.nextProj = () => { if (currentProjIdx<projectList().length-1) { currentProjIdx++; openProject(currentProjIdx); } };

// once the data arrives: real projects everywhere, billboard screenshots, Felipe's real testimonial
window.PORTFOLIO.then(data => {
  if (!data) return;
  PROJECT_DATA = data.projects;
  ZONE_CONTENT.projects.sub = `${data.projects.length} projetos reais · clique ou chegue perto dos outdoors`;
  document.querySelectorAll('image.bb-img').forEach(img => { const p = data.projects[+img.dataset.k]; if (p?.image) img.setAttribute('href', p.image); });
  const fel = data.testimonials?.find(x => x.id === 'felipe-baer');
  const npc = NPCS.find(n => n.def.key === 'felipe');
  if (fel && npc) { npc.def.answer = fel.content.pt; npc.def.sub = fel.author.role.pt; }
});

// click a billboard panel or a port container to open that project
let camNow = { x: 0, y: 0, z: 1 };
const ZOOM = { BASE: matchMedia('(pointer: coarse)').matches ? 1.15 : 1.35, TOUR: 0.95 };
let camZoom = ZOOM.BASE, rasterZoom = 1, camFocus = null;
const REDUCE_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;
function pickAt(cx, cy) {
  const mx = cx / camNow.z + camNow.x, my = cy / camNow.z + camNow.y;
  for (const o of CITY.billboards) {
    const bb = o.bbox;
    if (mx >= bb.x0 + 14 && mx <= bb.x1 - 14 && my >= bb.y0 + 14 && my <= o.y - 30) return o.billboard.k;
  }
  if (B.projects) {                                   // containers: test at mid container height
    const p = CITY.I(mx, my + 17), du = p.u - B.projects.u, dv = p.v - B.projects.v;
    const cols = [-114, -38, 38, 114], rows = [-24, 24];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++)
      if (Math.abs(du - cols[c]) < 34 && Math.abs(dv - rows[r]) < 18) return r * 4 + c;
  }
  return -1;
}
const UI_SEL = '#overlay, #npc-dialog, #intro-modal, button, a, #hud-left, #quick-actions, #touch-controls, #zone-card';
window.addEventListener('click', e => {
  if (overlayOpen || npcDialogOpen || e.target.closest(UI_SEL)) return;
  const k = pickAt(e.clientX, e.clientY);
  if (k >= 0 && k < projectList().length) { playSfx('interact'); openProject(k); return; }
  if (drivingCar || pilot || tour.active || !bootDone) return;
  setWalkTarget({ x: clamp(e.clientX / camNow.z + camNow.x, EDGE_MARGIN, MAP_PX - EDGE_MARGIN), y: clamp(e.clientY / camNow.z + camNow.y, EDGE_MARGIN, MAP_PX - EDGE_MARGIN) });
});
window.addEventListener('mousemove', e => {
  document.body.classList.toggle('pick-hover', !overlayOpen && !e.target.closest(UI_SEL) && pickAt(e.clientX, e.clientY) >= 0);
});


/* ════════════════════════════════════════════════
   GARAGE — João's own cars (and the bike), on turntables.
   Models come from vehicles.js (hand-built, or GLB files listed in
   assets/garage/garage.json). "Dirigir este" turns the JOPES car into it.
   ════════════════════════════════════════════════ */
const GARAGE_INFO = {
  clio:  { name: 'Renault Clio',          year: '2010/2011', color: 'Preto',  kind: 'Hatch · 3 portas' },
  hb20:  { name: 'Hyundai HB20',          year: '2016',      color: 'Branco', kind: 'Hatch · 5 portas' },
  cruze: { name: 'Chevrolet Cruze',       year: '2016/2017', color: 'Branco', kind: 'Sedã' },
  xtz:   { name: 'Yamaha XTZ 250 Lander', year: '',          color: 'Azul',   kind: 'Moto trail' },
};
const GARAGE_ORDER = ['clio', 'hb20', 'cruze', 'xtz'];
const jopesCarName = () => garageCar ? GARAGE_INFO[garageCar].name.toUpperCase() : 'JOPES MOBILE';
let garageOpen = false, garageSel = garageCar || 'clio', garageAng = -0.7, garageDrag = null;
function applyGarageCar() {
  const car = CITY.playerCar;
  if (!car || !window.JOPES_GARAGE) return;
  car.model = garageCar || undefined;
  if (garageCar && window.JOPES_GARAGE.loadModels) window.JOPES_GARAGE.loadModels();   // your own car: fetch its real model
  if (CITY.gl) CITY.redraw(car);
}
window.addEventListener('garage:ready', applyGarageCar);
window.addEventListener('garage:models', applyGarageCar);
// on desktop the old placeholder cars stay hidden until the real models arrive (a few seconds in)
if (!(matchMedia('(pointer: coarse)').matches || navigator.connection?.saveData)) {
  const hideOld = () => CITY.cars.forEach(c => { if (c !== CITY.playerCar && !c.model) c.el.style.visibility = 'hidden'; });
  hideOld(); window.addEventListener('garage:ready', hideOld);
}
// traffic: once the downloaded cars are in, every car on the street (and parked) becomes one of them
window.addEventListener('garage:models', () => {
  const ids = window.JOPES_GARAGE.traffic?.() || [];
  if (!ids.length || !CITY.gl) return;
  let n = 0; CITY.cars.filter(c => c !== CITY.playerCar && !c.model).forEach(c => { c.model = ids[n++ % ids.length]; CITY.redraw(c); c.el.style.visibility = ''; });
});
if (window.JOPES_GARAGE) applyGarageCar();
function openGarage() {
  const G = window.JOPES_GARAGE;
  overlayContent.innerHTML = `
    <div class="gar-head">
      <div>
        <div class="ov-id">GARAGEM · JOPES</div>
        <h2 class="gar-title">Os carros que <em>já foram meus</em></h2>
        <p class="gar-sub">Cada um marcou uma fase. Escolha um, gire e leve pra rodar pela cidade.</p>
      </div>
      <div class="gar-count"><b>${GARAGE_ORDER.length}</b><span>veículos</span></div>
    </div>
    <div class="gar-stage">
      <canvas id="gar-cv"></canvas>
      <div id="gar-credit" class="gar-credit" hidden></div>
      <div class="gar-hint">${G ? 'arraste para girar' : 'os modelos 3D precisam de WebGL'}</div>
    </div>
    <div class="gar-plate"><div><div id="gar-name"></div><div id="gar-meta"></div></div><button id="gar-drive" class="intro-btn primary"></button></div>
    <div class="gar-tabs">${GARAGE_ORDER.map(id => `<button class="gar-tab" data-id="${id}"><b>${GARAGE_INFO[id].name.split(' ').slice(-1)[0] === 'Lander' ? 'XTZ 250' : GARAGE_INFO[id].name.split(' ').slice(1).join(' ')}</b><span>${GARAGE_INFO[id].year || GARAGE_INFO[id].kind}</span></button>`).join('')}</div>`;
  overlay.classList.add('active', 'garage');
  overlayOpen = true; garageOpen = true;
  const cv = document.getElementById('gar-cv');
  const sel = id => {
    garageSel = id;
    const I = GARAGE_INFO[id];
    document.getElementById('gar-name').textContent = I.name;
    document.getElementById('gar-meta').textContent = [I.year, I.color, I.kind].filter(Boolean).join(' · ');
    const cr = G && G.credit && G.credit(id), ce = document.getElementById('gar-credit');
    ce.textContent = cr || ''; ce.hidden = !cr;
    document.getElementById('gar-drive').textContent = garageCar === id ? '✓ É O SEU CARRO NA CIDADE' : (id === 'xtz' ? 'PILOTAR ESTA' : 'DIRIGIR ESTE');
    overlayContent.querySelectorAll('.gar-tab').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  };
  overlayContent.querySelectorAll('.gar-tab').forEach(b => b.addEventListener('click', () => { playSfx('interact'); sel(b.dataset.id); }));
  document.getElementById('gar-drive').addEventListener('click', () => driveGarageCar(garageSel));
  cv.addEventListener('pointerdown', e => { garageDrag = { x: e.clientX, a: garageAng }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (garageDrag) garageAng = garageDrag.a + (e.clientX - garageDrag.x) * 0.012; });
  cv.addEventListener('pointerup', () => { garageDrag = null; });
  sel(garageSel);
  let last = performance.now();
  (function spin(now) {
    if (!garageOpen) return;
    requestAnimationFrame(spin);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!garageDrag) garageAng += dt * 0.35;
    if (G) G.showcase(garageSel, cv, garageAng, { elev: 0.2 });
  })(last);
}
function driveGarageCar(id) {
  garageCar = id; writeSave(); applyGarageCar();
  playSfx('reveal');
  const car = CITY.playerCar, g = BUILDINGS.find(b => b.zone === 'garage');
  if (car && g && !drivingCar) {
    // bring it round to the street in front of the garage and hop in
    const p = CITY.S(g.u + 40, (Math.floor(g.v / CITY.BLOCK) + 1) * CITY.BLOCK - 22);
    car.heading = 0; car.angle = 0;
    CITY.moveCar(car, p.x, p.y); CITY.setCarHeading(car, 0, 0);
    closeOverlay();
    playerPos.x = p.x; playerPos.y = p.y;
    enterCar(car);
    showToast((id === 'xtz' ? 'SUA ' : 'SEU ') + GARAGE_INFO[id].name.toUpperCase() + ' · BOA VOLTA!', 'city');
  } else closeOverlay();
  if (!extrasDone.has('garage')) { extrasDone.add('garage'); addXP(50); renderQuestList(); writeSave(); }
}

function closeOverlay() {
  garageOpen = false;
  overlay.classList.remove('active', 'garage');
  overlayOpen = false;
}
document.getElementById('overlay-close').addEventListener('click', closeOverlay);
overlay.addEventListener('click', e => { if (e.target===overlay) closeOverlay(); });

/* ── TOAST ──────────────────────────────────────── */
var toastTimer;
function showToast(msg, icon) {
  const el = document.getElementById('toast');
  el.innerHTML = (icon ? `<span class="toast-icon">${ICONS[icon]}</span>` : '') + msg;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.opacity='0', 3000);
}

/* ════════════════════════════════════════════════
   BOOT SEQUENCE
   ════════════════════════════════════════════════ */
const bootLines = ['Booting JOPES.EXE…','Carregando o mapa…','Explore a cidade…','Boa sorte.'];
let bootIdx = 0;
const bootText = document.getElementById('boot-text');
(function tick() { if (bootIdx<bootLines.length) { bootText.textContent=bootLines[bootIdx++]; setTimeout(tick,420); } })();

// The boot screen stays up until the 3D city (world3d.js) is built, so nobody
// sees it "turning 3D" piece by piece. Never blocks: no WebGL / module not
// loading / slow device → it opens anyway after a timeout.
let cityReady = false, bootMinDone = false, bootDone = false;
function finishBoot() {
  if (bootDone || !(cityReady && bootMinDone)) return;
  bootDone = true;
  const boot = document.getElementById('boot');
  boot.style.transition='opacity 0.8s'; boot.style.opacity='0';
  setTimeout(()=>boot.remove(),800);
  if (!introSeen) {
    document.getElementById('intro-modal').classList.add('active');
  } else {
    showToast('CHEGUE PERTO DE UM PRÉDIO E APERTE [ E ]', 'city');
  }
}
setTimeout(() => { bootMinDone = true; finishBoot(); }, 2600);
window.addEventListener('city3d:progress', e => { if (bootIdx >= bootLines.length) bootText.textContent = `Construindo a cidade 3D… ${Math.round(e.detail * 100)}%`; });
window.addEventListener('city3d:ready', () => { cityReady = true; finishBoot(); });
setTimeout(() => { if (!window.__world3dStarted) { cityReady = true; finishBoot(); } }, 3500);
setTimeout(() => { cityReady = true; finishBoot(); }, 14000);


/* ════════════════════════════════════════════════
   INTRO MODAL + CV SHORTCUT
   ════════════════════════════════════════════════ */
function closeIntro() {
  introSeen = true;
  writeSave();
  document.getElementById('intro-modal').classList.remove('active');
}
function goToCV() {
  revealZone('contact');
  openZone('contact');
}
document.getElementById('intro-play').addEventListener('click', () => { closeIntro(); });
document.getElementById('intro-skip').addEventListener('click', () => { closeIntro(); goToCV(); });
document.getElementById('cv-btn-icon').innerHTML = ICONS.cv;
document.getElementById('cv-btn').addEventListener('click', goToCV);

/* ════════════════════════════════════════════════
   TOUCH CONTROLS (mobile joystick + [E] button)
   ════════════════════════════════════════════════ */
const joyBase = document.getElementById('joy-base');
const joyStick = document.getElementById('joy-stick');
const JOY_RADIUS = 38;   // max stick travel, px
const JOY_DEADZONE = 14; // px before a direction registers
let joyPointerId = null;

function resetJoyKeys() {
  joyVec.m = 0;
  keys['ArrowUp'] = keys['ArrowDown'] = keys['ArrowLeft'] = keys['ArrowRight'] = false;
}
// 8-way sectors of 45°, screen coords (dy>0 = down), reuses the same digital
// movement flags as WASD so it drives updatePlayer()/getSpriteDir() untouched.
function applyJoyDirection(dx, dy, dist) {
  if (dist < JOY_DEADZONE) { resetJoyKeys(); return; }
  // a pé o joystick é analógico (qualquer ângulo, empurrar pouco = andar devagar); carro e helicóptero seguem usando as 8 direções abaixo
  joyVec.x = dx / dist; joyVec.y = dy / dist;
  joyVec.m = clamp((dist - JOY_DEADZONE) / (JOY_RADIUS - JOY_DEADZONE), 0.35, 1);
  const deg = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
  const sector = Math.round(deg / 45) % 8;
  const RIGHT=0, LEFT=1, UP=2, DOWN=3;
  const table = [
    [1,0,0,0], [1,0,0,1], [0,0,0,1], [0,1,0,1],
    [0,1,0,0], [0,1,1,0], [0,0,1,0], [1,0,1,0],
  ][sector];
  keys['ArrowRight'] = !!table[RIGHT];
  keys['ArrowLeft']  = !!table[LEFT];
  keys['ArrowUp']    = !!table[UP];
  keys['ArrowDown']  = !!table[DOWN];
}
function updateJoy(clientX, clientY) {
  const rect = joyBase.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, JOY_RADIUS);
  const angle = Math.atan2(dy, dx);
  joyStick.style.transform = `translate(calc(-50% + ${Math.cos(angle) * clamped}px), calc(-50% + ${Math.sin(angle) * clamped}px))`;
  applyJoyDirection(dx, dy, dist);
}
function endJoy(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  joyBase.classList.remove('active');
  joyStick.style.transform = 'translate(-50%, -50%)';
  resetJoyKeys();
}
joyBase.addEventListener('pointerdown', e => {
  e.preventDefault();
  joyPointerId = e.pointerId;
  joyBase.classList.add('active');
  joyBase.setPointerCapture(e.pointerId);
  updateJoy(e.clientX, e.clientY);
});
joyBase.addEventListener('pointermove', e => { if (e.pointerId === joyPointerId) updateJoy(e.clientX, e.clientY); });
joyBase.addEventListener('pointerup', endJoy);
joyBase.addEventListener('pointercancel', endJoy);

document.getElementById('touch-e').addEventListener('pointerdown', e => { e.preventDefault(); handleInteract(); });
document.getElementById('touch-f').addEventListener('pointerdown', e => { e.preventDefault(); tryHelipad(); });
document.getElementById('touch-h').addEventListener('pointerdown', e => { e.preventDefault(); if (drivingCar) { playSfx('horn'); honkAt = performance.now(); } });

/* ════════════════════════════════════════════════
   BUILDING LABELS
   ════════════════════════════════════════════════ */
const labelContainer = document.getElementById('building-labels');
const ZONE_COLORS_HEX = ZONE_COLORS;

const buildingLabelEls = BUILDINGS.map(b => {
  const div = document.createElement('div');
  div.className = 'blabel';
  div.innerHTML = `<div class="blabel-id"><span class="blabel-dot" style="background:${ZONE_COLORS_HEX[b.zone]||'#fff'}"></span>${b.sublabel}</div><div class="blabel-name">${b.label}</div>`;
  labelContainer.appendChild(div);
  return { el: div, b };
});
const buildingLabelByZone = {};
buildingLabelEls.forEach(({ el, b }) => { buildingLabelByZone[b.zone] = el; });

function flashBuildingLabel(zone) {
  const el = buildingLabelByZone[zone];
  if (!el) return;
  el.classList.remove('flash');
  void el.offsetWidth; // restart animation
  el.classList.add('flash');
}

/* ════════════════════════════════════════════════
   TIME OF DAY + WEATHER (controls and effects)
   ════════════════════════════════════════════════ */
function applyPeriod(p) {
  if (p === period) { updatePeriodBtn(); return; }
  period = p; window.CITY_PERIOD = p; document.body.dataset.period = p;
  window.dispatchEvent(new CustomEvent('city:period', { detail: p }));
  updatePeriodBtn();
}
function updatePeriodBtn() {
  document.getElementById('period-btn').innerHTML = `<span class="ico">${PERIOD_ICON[period]}</span><span class="lbl">${PERIOD_NAME[period]}</span>${periodMode === 'auto' ? '<small>AUTO</small>' : ''}`;
}
document.getElementById('period-btn').addEventListener('click', () => {
  periodMode = PERIOD_ORDER[(PERIOD_ORDER.indexOf(periodMode) + 1) % PERIOD_ORDER.length];
  writeSave();
  applyPeriod(wantedPeriod());
  showToast(periodMode === 'auto' ? `HORA DE BLUMENAU: ${PERIOD_NAME[period]}` : PERIOD_NAME[period], 'city');
});
setInterval(() => { if (periodMode === 'auto') applyPeriod(wantedPeriod()); }, 60000);
updatePeriodBtn();

// weather: auto cycles clear / rain / fog every few minutes; or pick one
const WEATHER_ORDER = ['auto', 'clear', 'rain', 'fog'];
const WEATHER_LABEL = { auto: 'AUTO', clear: 'LIMPO', rain: 'CHUVA', fog: 'NEBLINA' };
const WEATHER_ICON = { clear: '✦', rain: '☂', fog: '≋' };
let nextWeatherAt = performance.now() + 70000;
function setWeather(w) {
  if (w === weather) { updateWeatherBtn(); return; }
  weather = w; document.body.dataset.weather = w;
  rainSound(w === 'rain');
  updateWeatherBtn();
}
function updateWeatherBtn() {
  document.getElementById('weather-btn').innerHTML = `<span class="ico">${WEATHER_ICON[weather]}</span><span class="lbl">${WEATHER_LABEL[weather]}</span>${weatherMode === 'auto' ? '<small>AUTO</small>' : ''}`;
}
document.getElementById('weather-btn').addEventListener('click', () => {
  weatherMode = WEATHER_ORDER[(WEATHER_ORDER.indexOf(weatherMode) + 1) % WEATHER_ORDER.length];
  writeSave();
  setWeather(weatherMode === 'auto' ? 'clear' : weatherMode);
  if (weatherMode === 'auto') nextWeatherAt = performance.now() + 60000;
  showToast('CLIMA: ' + WEATHER_LABEL[weatherMode], 'city');
});
if (weatherMode !== 'auto') setWeather(weatherMode);
updateWeatherBtn();

const rainCv = document.getElementById('rain'), rainCtx = rainCv.getContext('2d');
let drops = [], splashes = [], nextBolt = 0;
function sizeRain() { rainCv.width = innerWidth; rainCv.height = innerHeight; drops = [...Array(Math.round(innerWidth * innerHeight / 7000))].map(() => newDrop(true)); }
function newDrop(any) { return { x: Math.random() * (innerWidth + 200) - 100, y: any ? Math.random() * innerHeight : -20 - Math.random() * 60, l: 10 + Math.random() * 14, v: 900 + Math.random() * 500 }; }
addEventListener('resize', sizeRain); sizeRain();
function updateWeather(dt, now) {
  if (weatherMode === 'auto' && now > nextWeatherAt) {
    const r = Math.random();
    setWeather(r < 0.58 ? 'clear' : r < 0.86 ? 'rain' : 'fog');
    nextWeatherAt = now + (weather === 'clear' ? 150000 : 90000) + Math.random() * 90000;
  }
  if (weather !== 'rain') { if (drops.length && rainCv.dataset.on) { rainCtx.clearRect(0, 0, rainCv.width, rainCv.height); delete rainCv.dataset.on; } return; }
  rainCv.dataset.on = 1;
  const c = rainCtx; c.clearRect(0, 0, rainCv.width, rainCv.height);
  c.strokeStyle = 'rgba(175,205,235,0.38)'; c.lineWidth = 1; c.beginPath();
  for (const d of drops) {
    d.y += d.v * dt; d.x -= d.v * dt * 0.18;
    if (d.y > innerHeight) { if (Math.random() < 0.35) splashes.push({ x: d.x, y: innerHeight * (0.25 + Math.random() * 0.75), t: 0 }); Object.assign(d, newDrop(false)); }
    c.moveTo(d.x, d.y); c.lineTo(d.x + d.l * 0.18, d.y - d.l);
  }
  c.stroke();
  c.strokeStyle = 'rgba(190,215,240,0.35)';
  splashes = splashes.filter(sp => (sp.t += dt) < 0.35);
  for (const sp of splashes) { const k = sp.t / 0.35; c.globalAlpha = 1 - k; c.beginPath(); c.ellipse(sp.x, sp.y, 2 + k * 7, 1 + k * 2.5, 0, 0, Math.PI * 2); c.stroke(); }
  c.globalAlpha = 1;
  if (now > nextBolt) {                                // lightning + thunder
    if (nextBolt) { const f = document.getElementById('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); setTimeout(thunder, 500 + Math.random() * 1500); }
    nextBolt = now + 9000 + Math.random() * 16000;
  }
}
// sounds: rain = looped filtered noise; thunder = low noise burst
let rainNode = null;
function noiseBuffer(sec) { const b = audioCtx.createBuffer(1, audioCtx.sampleRate * sec, audioCtx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function rainSound(on) {
  if (!audioCtx) { if (on) { const once = () => { removeEventListener('keydown', once); removeEventListener('pointerdown', once); if (weather === 'rain') rainSound(true); }; addEventListener('keydown', once); addEventListener('pointerdown', once); } return; }
  if (on && !rainNode) {
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    const bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.6;
    const g = audioCtx.createGain(); g.gain.value = 0.0001; src.connect(bp); bp.connect(g); g.connect(masterGain); src.start();
    g.gain.setTargetAtTime(0.06, audioCtx.currentTime, 1.2);
    rainNode = { src, g };
  } else if (!on && rainNode) {
    const r = rainNode; rainNode = null; r.g.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.8); setTimeout(() => { try { r.src.stop(); } catch {} }, 3000);
  }
}
function thunder() {
  if (!audioCtx || audioMuted) return;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer(3);
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
  const g = audioCtx.createGain(); const t = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  src.connect(lp); lp.connect(g); g.connect(masterGain); src.start(); src.stop(t + 3);
}

/* ════════════════════════════════════════════════
   TOUR — a one-minute guided flight for people in a hurry (recruiters!).
   The HQ helicopter takes off and flies the camera over the city, one
   caption per stop; it lands back on the helipad at the end.
   ════════════════════════════════════════════════ */
const tour = { active: false, i: 0, phase: 'fly', t: 0, from: null, stops: [] };
function tourStops() {
  const P = PROJECT_DATA || [];
  const at = (b, du = 0, dv = 0) => { const s = CITY.S(b.u + du, b.v + dv); return { x: s.x, y: s.y }; };
  const pos = PORTFOLIO_CACHE?.experience?.positions?.find(p => !p.isLocked);
  const quote = PORTFOLIO_CACHE?.testimonials?.[0];
  return [
    { ...at(B.main, 260, 260), title: 'Bem-vindo à JOPES.EXE', text: 'Esta cidade é o portfólio do João Paulo Oliveira, engenheiro backend em Blumenau (SC). Cada prédio é uma parte da carreira. Bora dar uma volta.' },
    { ...at(B.main), title: 'MAIN HQ · quem é o João', text: 'Backend com Java + Spring Boot como stack principal, AWS e Terraform na infra, Flutter e React quando o problema pede. Gosta de sistemas distribuídos, APIs bem desenhadas e código que escala.' },
    { ...at(B.projects), title: `PROJETOS · ${P.length || 11} projetos reais`, text: 'O porto de deploy: um contêiner por projeto. Pela cidade, outdoors mostram cada um. Chegue perto ou clique para abrir a ficha completa (problema, solução, stack e resultados).' },
    ...(B.garage ? [{ ...at(B.garage), title: 'GARAGEM · os carros do João', text: 'Clio, HB20, Cruze e a XTZ 250: os veículos que já foram dele, em 3D. Entre, gire cada um e saia dirigindo o seu favorito pela cidade.' }] : []),
    { ...at(B.lab), title: 'BACKEND LAB', text: 'O laboratório: ferramentas, experimentos e estudos. System Monitor, simulador de on-call, desafios de backend e notas do dia a dia.' },
    { ...at(B.stack), title: 'TECH STACK', text: 'Uma pilha de verdade: AWS + Terraform na base, Postgres e Redis, Kafka e RabbitMQ, Spring Boot 3 e Java 17+ no topo. Chegue perto e ela se desmonta camada por camada.' },
    { ...at(B.about), title: 'SOBRE MIM · trajetória', text: pos ? `Hoje: ${pos.title}. ${pos.description.pt}` : 'De estagiário de TI a desenvolvedor backend, construindo plataformas que escalam.' },
    { ...at(B.stack, 160, -20), title: 'Quem trabalhou com ele', text: quote ? `“${quote.content.pt.split('\n')[0].slice(0, 230)}${quote.content.pt.length > 230 ? '…' : ''}” — ${quote.author.name}` : 'Converse com os NPCs da cidade: eles contam como é trabalhar com o João.' },
    { ...at(B.contact), title: 'CONTATO · vamos conversar?', text: 'Email, LinkedIn e GitHub na torre de rádio. Agora é com você: ande com WASD, pegue um carro, voe de helicóptero e explore cada prédio.' },
  ];
}
function startTour() {
  if (tour.active) return;
  if (drivingCar || pilot) { showToast('SAIA DO VEÍCULO PARA VER O TOUR', 'alert'); return; }
  closeOverlay(); closeNPCDialog();
  tour.stops = tourStops(); tour.i = 0; tour.phase = 'fly'; tour.t = 0;
  tour.saved = { state: heli.state, x: heli.x, y: heli.y, h: heli.h, solid: heli.solid };
  heli.state = 'tour'; heli.solid = false; heli.el.classList.add('spinning');
  tour.from = { x: heli.x, y: heli.y, h: heli.h };
  tour.active = true;
  document.body.classList.add('touring', 'flying');
  startRotorSound();
  renderTourCard();
}
function endTour() {
  if (!tour.active) return;
  tour.active = false;
  document.body.classList.remove('touring', 'flying');
  stopRotorSound();
  fadeThen(() => {
    // the helicopter goes home: back on the helipad
    heli.state = 'roof'; heli.solid = false; heli.vx = heli.vy = 0;
    heli.el.classList.remove('spinning');
    CITY.moveHeli(heli, heli.pad.x, heli.pad.y, heli.pad.h);
    heli.el.style.zIndex = B.main.objs[0].z + 2;
    CITY.setHeliHeading(heli, Math.PI / 4);
    showToast('AGORA É COM VOCÊ — EXPLORE A CIDADE', 'city');
  });
}
function tourNext() {
  if (tour.i >= tour.stops.length - 1) { endTour(); return; }
  tour.i++; tour.phase = 'fly'; tour.t = 0; tour.from = { x: heli.x, y: heli.y, h: heli.h };
  renderTourCard();
}
function renderTourCard() {
  const st = tour.stops[tour.i];
  document.getElementById('tour-step').textContent = `TOUR · ${tour.i + 1} / ${tour.stops.length}`;
  document.getElementById('tour-title').textContent = st.title;
  document.getElementById('tour-text').textContent = st.text;
  document.getElementById('tour-dots').innerHTML = tour.stops.map((_, k) => `<i class="${k <= tour.i ? 'on' : ''}"></i>`).join('');
  document.getElementById('tour-next').textContent = tour.i === tour.stops.length - 1 ? 'EXPLORAR ▸' : 'PRÓXIMO ▸';
}
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function updateTour(dt) {
  const st = tour.stops[tour.i];
  tour.t += dt;
  const FLY = 2.6, HOLD = 3.2 + st.text.length / 38;   // reading time grows with the caption
  const px = heli.x, py = heli.y;
  if (tour.phase === 'fly') {
    const k = ease(Math.min(1, tour.t / FLY));
    heli.x = tour.from.x + (st.x - tour.from.x) * k;
    heli.y = tour.from.y + (st.y - tour.from.y) * k;
    heli.h = tour.from.h + (440 - tour.from.h) * Math.min(1, tour.t / 1.2);
    if (tour.t >= FLY) { tour.phase = 'hold'; tour.t = 0; }
  } else {
    heli.x = st.x + Math.sin(performance.now() / 900) * 8;    // gentle hover
    if (tour.t >= HOLD) tourNext();
  }
  heli.vx = (heli.x - px) / Math.max(dt, 1e-3); heli.vy = (heli.y - py) / Math.max(dt, 1e-3);
  if (Math.hypot(heli.vx, heli.vy) > 30) {
    const du = heli.vy + heli.vx / 2, dv = heli.vy - heli.vx / 2;
    let d = Math.atan2(dv, du) - heli.angle; d = Math.atan2(Math.sin(d), Math.cos(d));
    heli.angle += clamp(d, -2.5 * dt, 2.5 * dt);
  }
  CITY.setHeliHeading(heli, heli.angle);
  CITY.moveHeli(heli, heli.x, heli.y, heli.h + Math.sin(performance.now() / 500) * 3);
  heli.h = tour.phase === 'fly' ? heli.h : 440;
}
let PORTFOLIO_CACHE = null;
window.PORTFOLIO.then(d => {
  PORTFOLIO_CACHE = d;
  // contatos vêm do portfólio (data/profile.ts) quando disponíveis — uma fonte só
  const pf = d && d.profile, links = ZONE_CONTENT.contact && ZONE_CONTENT.contact.links;
  if (pf && links) {
    const short = u => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    const by = icon => links.find(l => l.icon === icon);
    if (pf.email && by('mail')) Object.assign(by('mail'), { label: pf.email, href: 'mailto:' + pf.email });
    if (pf.linkedin && by('linkedin')) Object.assign(by('linkedin'), { label: short(pf.linkedin), href: pf.linkedin });
    if (pf.github && by('github')) Object.assign(by('github'), { label: short(pf.github), href: pf.github });
  }
});
document.getElementById('tour-btn').addEventListener('click', startTour);
document.getElementById('tour-next').addEventListener('click', tourNext);
document.getElementById('tour-exit').addEventListener('click', endTour);
document.getElementById('intro-tour').addEventListener('click', () => { closeIntro(); setTimeout(startTour, 300); });

/* ════════════════════════════════════════════════
   3D CHARACTERS — once vehicles.js is up, the player and NPCs are drawn
   from low-poly 3D models (vehicles.js · PEOPLE). The pixel-art <img>
   sprites stay as the fallback (no WebGL).
   ════════════════════════════════════════════════ */
const bustCache = {};
const CHARS_3D = /[?&]chars=3d\b/.test(location.search);   // opt-in: the pixel-art sprites are the default look
const SCREEN_DIR = { south: [0, 1], 'south-east': [1, 1], east: [1, 0], 'north-east': [1, -1], north: [0, -1], 'north-west': [-1, -1], west: [-1, 0], 'south-west': [-1, 1] };
const dirAngle = d => { const [dx, dy] = SCREEN_DIR[d]; return Math.atan2(dy - dx / 2, dy + dx / 2); };
let chars3d = false, playerCv = null, playerKey = '';
function blit(cv, src) { const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.drawImage(src, 0, 0, cv.width, cv.height); }
function updateChars3D() {
  const G = CHARS_3D && CITY.getGL();
  if (!G?.personFrame) return;
  const mk = () => { const c = document.createElement('canvas'); c.className = 'char3d'; c.width = Math.round(60 * G.DPR); c.height = Math.round(72 * G.DPR); worldPanEl.appendChild(c); return c; };
  if (!chars3d) {
    chars3d = true;
    playerCv = mk(); playerImgEl.style.visibility = 'hidden';
    for (const npc of NPCS) { npc.cv = mk(); npc.key = ''; npc.imgEl.style.visibility = 'hidden'; }
  }
  // player
  const visible = playerImgEl.style.display !== 'none' && !tour.active;
  playerCv.style.display = visible ? '' : 'none';
  if (visible) {
    playerCv.style.left = playerPos.x + 'px'; playerCv.style.top = playerPos.y + 'px'; playerCv.style.zIndex = playerImgEl.style.zIndex;
    const frame = moving ? spriteFrame : -1, key = spriteDir + ':' + frame;
    if (key !== playerKey) { playerKey = key; blit(playerCv, G.personFrame('joao', dirAngle(spriteDir), frame)); }
  }
  // NPCs: turn to face you when you're close
  for (const npc of NPCS) {
    const { x, y } = npc.def.pos;
    npc.cv.style.left = x + 'px'; npc.cv.style.top = y + 'px'; npc.cv.style.zIndex = npc.imgEl.style.zIndex;
    let ang = Math.PI / 4;
    const dx = playerPos.x - x, dy = playerPos.y - y;
    if (!drivingCar && !pilot && Math.hypot(dx, dy) < 240) { const du = dy + dx / 2, dv = dy - dx / 2; ang = Math.round(Math.atan2(dv, du) / (Math.PI / 4)) * Math.PI / 4; }
    const key = String(ang);
    if (key !== npc.key) { npc.key = key; blit(npc.cv, G.personFrame(npc.def.key, ang, -1)); }
  }
}
window.addEventListener('city:period', () => { playerKey = ''; NPCS.forEach(n => { n.key = ''; }); for (const k in bustCache) delete bustCache[k]; });

/* ════════════════════════════════════════════════
   DEPTH — a sprite standing behind an object (north of both of its front
   faces) is drawn under it; the object fades so the player stays visible.
   ════════════════════════════════════════════════ */
function spriteDepth(x, y, xraySet, self = null, hw = 26, top = 56) {
  let z = Math.round(y);
  const p = CITY.I(x, y);
  const sx0 = x - hw, sx1 = x + hw, sy0 = y - top, sy1 = y + 4;
  for (const o of CITY.objects) {
    if (o === self || o.skipDepth || (self && o.car)) continue;
    const bb = o.bbox;
    if (sx1 < bb.x0 || sx0 > bb.x1 || sy1 < bb.y0 || sy0 > bb.y1) continue;
    if (p.u < o.u + o.a && p.v < o.v + o.b) {
      z = Math.min(z, o.z - 1);
      if (xraySet && sy0 < o.y) xraySet.add(o);
    } else {
      z = Math.max(z, o.z + 1);
    }
  }
  return z;
}

/* ════════════════════════════════════════════════
   GAME LOOP
   ════════════════════════════════════════════════ */
let lastT = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;

  if (!overlayOpen && !npcDialogOpen && !tour.active) updatePlayer(dt);
  updateTraffic(dt);
  CITY.updatePeds(dt, now);
  CITY.updateMetro(dt);

  // camera: clamp so the viewport never shows past the map's real edge
  const vw = window.innerWidth, vh = window.innerHeight;
  if (tour.active) updateTour(dt);
  updateWeather(dt, now);
  const fx = tour.active ? heli.x : playerPos.x;
  const focusY = tour.active ? heli.y - heli.h * 0.8 : playerPos.y - (pilot ? heli.h * 0.8 : 0);
  // zoom: the city is shown bigger on foot; the camera pulls back with speed
  // in a car and with altitude in the helicopter (you see the whole city up there)
  const zt = tour.active ? ZOOM.TOUR
    : pilot ? ZOOM.BASE * (1 - 0.45 * Math.min(1, heli.h / HELI.CRUISE))
    : drivingCar ? ZOOM.BASE - 0.22 * Math.min(1, Math.abs(drivingCar.speed) / 520)
    : ZOOM.BASE;
  const ztu = tour.active ? zt : zt * userZoom;
  camZoom += (ztu - camZoom) * Math.min(1, dt * (Math.abs(ztu - camZoom) > 0.02 && !drivingCar && !pilot ? 6 : 2.2));
  // a câmera não fica presa no personagem: olha um pouco à frente do movimento e chega com suavidade
  let focusTX = fx, focusTY = focusY;
  if (!tour.active && !REDUCE_MOTION) {
    let lx = 0, ly = 0;
    if (pilot) { lx = heli.vx * 0.26; ly = heli.vy * 0.26; }
    else if (drivingCar) { const a = drivingCar.angle - (drivingCar.slip || 0), k = drivingCar.speed * 0.34, du = Math.cos(a) * k, dv = Math.sin(a) * k; lx = du - dv; ly = (du + dv) / 2; }
    else { lx = pvel.x * 0.17; ly = pvel.y * 0.17; }
    const m = Math.hypot(lx, ly), cap = 190;
    if (m > cap) { lx *= cap / m; ly *= cap / m; }
    focusTX += lx; focusTY += ly;
  }
  if (!camFocus || tour.active || Math.hypot(focusTX - camFocus.x, focusTY - camFocus.y) > 620) camFocus = { x: focusTX, y: focusTY };   // teleporte: corta direto
  else { const k = 1 - Math.exp(-dt * (drivingCar || pilot ? 4.5 : 7)); camFocus.x += (focusTX - camFocus.x) * k; camFocus.y += (focusTY - camFocus.y) * k; }
  const Z = camZoom, ww = vw / Z, wh = vh / Z;
  const camX = clamp(camFocus.x - ww/2, 0, Math.max(0, MAP_PX - ww));
  const camY = clamp(camFocus.y - wh/2, 0, Math.max(0, MAP_PX - wh));
  camNow.x = camX; camNow.y = camY; camNow.z = Z;
  const camT = `translate(${(-camX * Z).toFixed(2)}px, ${(-camY * Z).toFixed(2)}px) scale(${Z.toFixed(4)})`;
  mapLayerEl.style.transform = camT;
  worldPanEl.style.transform = camT;
  // layers with will-change keep the raster scale they started with; once the zoom
  // settles at a new value, drop the hint for a frame so they re-rasterize sharp
  if (Math.abs(ztu - Z) < 0.003 && Math.abs(Z - rasterZoom) > 0.04) {
    rasterZoom = Z; mapLayerEl.style.willChange = worldPanEl.style.willChange = 'auto';
    requestAnimationFrame(() => { mapLayerEl.style.willChange = worldPanEl.style.willChange = ''; });
  }

  // sprites are positioned in map space inside #worldPan
  const xray = new Set();
  playerImgEl.style.left = playerPos.x + 'px';
  playerImgEl.style.top  = playerPos.y + 'px';
  if (!drivingCar && !pilot) playerImgEl.style.zIndex = spriteDepth(playerPos.x, playerPos.y, xray);
  heli.skipDepth = heli.state !== 'ground';
  if (heli.state === 'ground') { heli.z = spriteDepth(heli.x, heli.y, null, heli, 50, 50); heli.el.style.zIndex = heli.z; }
  else if (heli.state !== 'roof') heli.el.style.zIndex = 99999;
  for (const o of CITY.peds) { o.z = spriteDepth(o.x, o.y, null, o, 10, 34); o.el.style.zIndex = o.z; }
  for (const o of CITY.train) { o.z = Math.round(o.y + 90); o.el.style.zIndex = o.z; }
  for (const car of CITY.cars) {
    car.z = spriteDepth(car.x, car.y, car === drivingCar ? xray : null, car, 34, 40);
    car.el.style.zIndex = car.z;
    car.el.classList.toggle('near-car', car === nearCar);
  }
  CITY.objects.forEach(o => { const on = xray.has(o); if (o.xray !== on) { o.xray = on; o.el.classList.toggle('xray', on); } });

  for (const npc of NPCS) {
    npc.imgEl.style.left = npc.def.pos.x + 'px';
    npc.imgEl.style.top  = npc.def.pos.y + 'px';
    npc.imgEl.style.zIndex = spriteDepth(npc.def.pos.x, npc.def.pos.y, null);
    npc.nameEl.style.left = ((npc.def.pos.x - camX) * Z) + 'px';
    npc.nameEl.style.top  = ((npc.def.pos.y - camY - 45) * Z) + 'px';
  }

  buildingLabelEls.forEach(({ el, b }) => {
    el.style.left = ((b.x - camX) * Z) + 'px';
    el.style.top  = ((b.labelY - camY) * Z) + 'px';
    el.classList.toggle('near', nearBuilding === b);
    b.objs.forEach(o => o.el.classList.toggle('near', nearBuilding === b));
  });

  updateChars3D();
  updateZoneHUD();
  window.JOPES_PLUS?.update(dt, now);
  drawMinimap();
  debugCoords.textContent = `X: ${Math.round(playerPos.x)}   Y: ${Math.round(playerPos.y)}`;
}
animate();
