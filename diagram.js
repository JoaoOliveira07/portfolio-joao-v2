/* Infográfico em estilo de jornal, desenhado a partir de { nodes, edges, groups }.
   Usado pelo jornal (script.js) e pela ferramenta de imagens (tools/render.html). */
window.renderDiagram = function (p, { L, t, esc }) {
  const d = p.diagram, id = `dg-${p.slug}`;
  const box = (n) => ({ w: n.w || (n.kind === 'phone' ? 96 : 150), h: n.kind === 'phone' ? 120 : n.kind === 'db' ? 70 : 58 });
  const byId = Object.fromEntries(d.nodes.map((n) => [n.id, { ...n, ...box(n) }]));
  const edge = ([a, b, label]) => {
    const A = byId[a], B = byId[b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const cut = (n, s) => { const k = Math.min((n.w / 2 + 6) / Math.abs(dx || 1e-6), (n.h / 2 + 6) / Math.abs(dy || 1e-6)); return [n.x + s * dx * k, n.y + s * dy * k]; };
    const [x1, y1] = cut(A, 1), [x2, y2] = cut(B, -1);
    const mid = label ? `<text class="dg-elabel" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}">${esc(L(label))}</text>` : '';
    return `<line class="dg-edge" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${id}-a)"/>${mid}`;
  };
  const node = (n) => {
    const { x, y, w, h } = n, l = esc(L(n.label)), s = n.sub ? esc(L(n.sub)) : '';
    const ty = s ? y - 3 : y + 5;
    let shape;
    if (n.kind === 'db') {
      shape = `<path class="dg-box" d="M${x - w / 2} ${y - h / 2 + 9} v${h - 18} a${w / 2} 9 0 0 0 ${w} 0 v${-(h - 18)}"/><ellipse class="dg-box" cx="${x}" cy="${y - h / 2 + 9}" rx="${w / 2}" ry="9"/>`;
    } else if (n.kind === 'phone') {
      shape = `<rect class="dg-box" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="14"/><line class="dg-thin" x1="${x - 12}" y1="${y - h / 2 + 10}" x2="${x + 12}" y2="${y - h / 2 + 10}"/>`;
    } else if (n.kind === 'cloud') {
      shape = `<rect class="dg-box" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${h / 2}"/>`;
    } else if (n.kind === 'note') {
      shape = `<rect class="dg-note" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}"/>`;
    } else {
      shape = `<rect class="dg-box${n.kind === 'main' ? ' dg-main' : ''}" x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}"/>`;
    }
    const cls = n.kind === 'main' ? 'dg-label dg-inv' : 'dg-label';
    return `<g>${shape}<text class="${cls}" x="${x}" y="${ty}">${l}</text>${s ? `<text class="dg-sub${n.kind === 'main' ? ' dg-inv' : ''}" x="${x}" y="${ty + 16}">${s}</text>` : ''}</g>`;
  };
  const groups = (d.groups || []).map((g) => `<rect class="dg-group" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/><text class="dg-glabel" x="${g.x + 10}" y="${g.y + 18}">${esc(L(g.label))}</text>`).join('');
  return `<div class="print-img diagram" role="img" aria-label="${esc(t('reader.diagram'))}: ${esc(p.title)}">
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid meet">
      <defs><marker id="${id}-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="dg-arrow"/></marker></defs>
      <text class="dg-title" x="20" y="24">${esc(t('reader.diagram'))}</text>
      ${groups}${d.edges.map(edge).join('')}${d.nodes.map((n) => node(byId[n.id])).join('')}
    </svg></div>`;
};
