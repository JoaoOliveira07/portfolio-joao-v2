/* Curtida + contador de acessos do JOPES.EXE.
   No portfolio-joao-v2 o site é estático, então usa o abacus.jasoncameron.dev
   (contador gratuito, sem dados pessoais) em vez da antiga /api/site/*.
   Se o serviço não responder, os botões simplesmente não aparecem. */
(() => {
  const bar = document.getElementById('quick-actions');
  if (!bar) return;
  const API = 'https://abacus.jasoncameron.dev';
  const NS = 'jopes-v2';
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };
  let counted = false; try { counted = sessionStorage.getItem('rpg-visit-counted') === '1'; } catch { /* ok */ }

  const val = (path) => fetch(`${API}/${path}`).then((r) => (r.ok ? r.json() : r.status === 404 ? { value: 0 } : Promise.reject(r.status))).then((j) => j.value);
  Promise.all([val(`${counted ? 'get' : 'hit'}/${NS}/rpg`), val(`get/${NS}/curtidas`)])
    .then(([visits, likes]) => {
      try { sessionStorage.setItem('rpg-visit-counted', '1'); } catch { /* ok */ }
      init({ visits, likes, liked: get('jopes-liked') === '1' });
    })
    .catch(() => {});

  function init(stats) {
    const heart = (on) => `<svg viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21s-7-4.6-9.3-9.1C1 8.4 3 5 6.4 5c2 0 3.6 1.1 4.6 2.7h2C14 6.1 15.6 5 17.6 5 21 5 23 8.4 21.3 11.9 19 16.4 12 21 12 21z"/></svg>`;
    const sep = document.createElement('i'); sep.className = 'qa-sep';
    const btn = document.createElement('button'); btn.className = 'qa-btn'; btn.type = 'button';
    const views = document.createElement('span'); views.className = 'qa-btn'; views.style.cursor = 'default'; views.title = 'Acessos';
    const paint = () => {
      btn.innerHTML = `${heart(stats.liked)}<span>${stats.likes}</span>`;
      btn.style.color = stats.liked ? '#ff5c8a' : '';
      btn.title = stats.liked ? 'Você curtiu o projeto' : 'Curtir o projeto';
      btn.setAttribute('aria-pressed', stats.liked);
      views.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg><span>${stats.visits}</span>`;
    };
    btn.addEventListener('click', async () => {
      if (stats.liked) return; // o contador público só soma; uma curtida por navegador
      stats.liked = true; stats.likes += 1; set('jopes-liked', '1'); paint();
      try { stats.likes = await val(`hit/${NS}/curtidas`); paint(); } catch { /* fica o valor otimista */ }
    });
    paint();
    bar.append(sep, btn, views);
  }
})();
