/* The store on the right: Producers and Upgrades tabs, the buy-amount switch (x1, x10, and
   with Bulk Orders x100 and Max), producer rows with icon, price, owned count and production
   share, the upgrade grid, scrolling by wheel or drag, buying by click, tap or Enter, selling
   one producer by right-click, and the hover tooltip with the numbers behind each choice. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { LAYOUT, UI, BUY_STEPS } = NS.constants;
  const K = NS.artKit;
  const E = NS.economy;
  const kit = NS.kit;
  const W = NS.widgets;
  const fmt = NS.format;
  const PU = NS.purchasing;
  const { BUILDINGS } = NS.buildingData;
  const { ctx } = NS.view;

  const ROW_H = 60, TILE = 62, COLS = 5;
  const LIST_Y = 176;

  function revealed() {
    const run = G.active();
    let maxIdx = 0;
    for (let i = 0; i < BUILDINGS.length; ++i) if (run.buildings[BUILDINGS[i].id] > 0) maxIdx = i;
    const out = [];
    for (let i = 0; i < BUILDINGS.length && i <= maxIdx + 2; ++i) out.push(BUILDINGS[i]);
    return out;
  }

  function listHeight() {
    return G.ui.storeTab === 'buildings' ? revealed().length * ROW_H : Math.ceil(PU.visibleUpgrades().length / COLS) * TILE;
  }

  function clampScroll() {
    const L = LAYOUT;
    const viewH = L.storeY + L.storeH - LIST_Y - 6;
    const max = Math.max(0, listHeight() - viewH);
    const key = G.ui.storeTab === 'buildings' ? 'storeScroll' : 'upgScroll';
    G.ui[key] = Math.max(0, Math.min(max, G.ui[key]));
    return { max: max, viewH: viewH, key: key };
  }

  function setTab(tab) {
    G.ui.storeTab = tab;
    NS.audio.sfx('click', { volume: 0.4 });
  }

  function draw() {
    const L = LAYOUT;
    const run = G.active();
    const st = G.st;
    kit.panel(L.storeX, L.storeY, L.storeW, L.storeH, { radius: 14 });
    const ups = PU.visibleUpgrades();
    let affordable = 0;
    for (let i = 0; i < ups.length; ++i) if (run.cookies >= E.upgradeCost(st, ups[i].id)) ++affordable;
    W.button('tab-b', 'Producers', L.storeX + 10, L.storeY + 8, 158, 34, { selected: G.ui.storeTab === 'buildings', px: 16, action: () => setTab('buildings') });
    W.button('tab-u', 'Upgrades ' + (ups.length ? '(' + ups.length + ')' : ''), L.storeX + 176, L.storeY + 8, 158, 34,
      { selected: G.ui.storeTab === 'upgrades', px: 16, accent: affordable ? UI.good : UI.accent, action: () => setTab('upgrades') });
    if (affordable && G.ui.storeTab !== 'upgrades') {
      const pulse = 0.5 + Math.sin(G.time * 5) * 0.5;
      K.circle(ctx, L.storeX + 326, L.storeY + 12, 9, K.rgba(UI.good, 0.6 + pulse * 0.4));
      kit.text(String(affordable), L.storeX + 326, L.storeY + 12, 11, '#06240a', { align: 'center', weight: 'bold' });
    }
    if (G.ui.storeTab === 'buildings') drawBuildings(run, st);
    else drawUpgrades(run, st, ups);
  }

  function drawBuildings(run, st) {
    const L = LAYOUT;
    kit.text('Buy', L.storeX + 14, L.storeY + 66, 14, UI.textDim, { weight: 'bold' });
    const bulk = PU.bulkAllowed();
    for (let i = 0; i < BUY_STEPS.length; ++i) {
      const n = BUY_STEPS[i];
      const locked = i > 1 && !bulk;
      W.button('amt' + i, n < 0 ? 'Max' : 'x' + n, L.storeX + 52 + i * 70, L.storeY + 52, 64, 28,
        { selected: G.ui.buyIndex === i && !locked, disabled: locked, px: 14, action: () => { G.ui.buyIndex = i; } });
      if (locked) kit.lock(L.storeX + 104 + i * 70, L.storeY + 64, 9);
    }
    const list = revealed();
    const sc = clampScroll();
    const top = LIST_Y;
    W.area('store-list', L.storeX, top, L.storeW, sc.viewH, null, { nonav: true, scroll: 'store' });
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.storeX + 4, top, L.storeW - 8, sc.viewH);
    ctx.clip();
    for (let i = 0; i < list.length; ++i) {
      const y = top + i * ROW_H - G.ui.storeScroll;
      if (y + ROW_H < top || y > top + sc.viewH) continue;
      row(list[i], L.storeX + 8, y, L.storeW - 16, run, st);
    }
    ctx.restore();
    scrollbar(sc, top);
  }

  function row(d, x, y, w, run, st) {
    const q = PU.quote(d.id);
    const can = run.cookies >= q.cost;
    const owned = run.buildings[d.id];
    const hidden = d.index > 1 && owned === 0 && !can && run.baked < d.cost * 0.5 && G.profile.allTime < d.cost;
    const hot = W.area('b-' + d.id, x, y + 2, w, ROW_H - 4, () => PU.buyBuilding(d.id, x + 30, y + 30), { alt: () => PU.sellBuilding(d.id) });
    kit.panel(x, y + 2, w, ROW_H - 4, { radius: 10, accent: can ? UI.gold : UI.accent, glow: hot, alpha: can ? 1 : 0.75,
      top: hot ? 'rgba(96,60,36,0.97)' : undefined });
    ctx.globalAlpha = hidden ? 0.35 : can ? 1 : 0.7;
    ctx.drawImage(NS.buildingArt.icon(d.id), x + 6, y + 6, 48, 48);
    ctx.globalAlpha = 1;
    kit.fitText(hidden ? '???' : d.name, x + 62, y + 20, 180, 16, { weight: 'bold', color: can ? '#ffffff' : UI.textDim });
    kit.icon('cookie', x + 70, y + 41, 14, '#d89a52');
    kit.text(fmt.short(q.cost) + (q.n > 1 ? '  (x' + q.n + ')' : ''), x + 80, y + 41, 14, can ? UI.good : UI.bad, { weight: 'bold' });
    if (owned) kit.text(fmt.group(owned), x + w - 12, y + 30, 26, K.rgba('#ffffff', 0.85), { align: 'right', weight: 'bold' });
    if (hot) tooltipBuilding(d, q, run, st, y);
  }

  function tooltipBuilding(d, q, run, st, y) {
    const owned = run.buildings[d.id];
    const each = st.per[d.id];
    const total = NS.production.cpsOf(run, st);
    const lines = [
      [d.desc, UI.textDim],
      ['Each bakes ' + fmt.rate(each) + ' per second', '#ffffff'],
      [owned ? owned + ' bake ' + fmt.rate(each * owned) + '/s (' + (total > 0 ? Math.round(each * owned / total * 100) : 0) + '% of all)' : 'You own none yet', UI.textDim],
      ['Buying ' + q.n + ' adds +' + fmt.rate(each * q.n) + '/s', UI.good],
    ];
    if (total > 0) lines.push(['Pays back in ' + fmt.duration(q.cost / Math.max(1e-9, each * q.n)), UI.textMute]);
    if (owned) lines.push(['Right-click sells one for ' + fmt.short(E.sellValue(run, st, d.id)), UI.textMute]);
    G.ui.hover = { title: d.name, icon: 'b:' + d.id, lines: lines, y: y };
  }

  function drawUpgrades(run, st, ups) {
    const L = LAYOUT;
    kit.text(ups.length ? 'Cheapest first. Hover for details.' : 'No upgrades yet - keep baking!', L.storeX + 14, L.storeY + 66, 13, UI.textDim);
    const sc = clampScroll();
    const top = LIST_Y - 20;
    W.area('upg-list', L.storeX, top, L.storeW, sc.viewH + 20, null, { nonav: true, scroll: 'store' });
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.storeX + 4, top, L.storeW - 8, sc.viewH + 20);
    ctx.clip();
    for (let i = 0; i < ups.length; ++i) {
      const u = ups[i];
      const x = L.storeX + 12 + (i % COLS) * (TILE + 2), y = top + Math.floor(i / COLS) * TILE - G.ui.upgScroll;
      if (y + TILE < top || y > top + sc.viewH + 20) continue;
      const cost = E.upgradeCost(st, u.id);
      const can = run.cookies >= cost;
      const hot = W.area('u-' + u.id, x, y, TILE - 4, TILE - 4, () => PU.buyUpgrade(u.id));
      kit.panel(x, y, TILE - 4, TILE - 4, { radius: 9, accent: can ? UI.good : UI.accent, glow: hot || can && Math.sin(G.time * 3 + i) > 0.7,
        alpha: can ? 1 : 0.6 });
      upgradeIcon(u, x + (TILE - 4) / 2, y + (TILE - 4) / 2, can);
      if (hot) G.ui.hover = { title: u.name, icon: u.icon, lines: [[u.desc, '#ffffff'], ['Costs ' + fmt.short(cost), can ? UI.good : UI.bad], [kindText(u), UI.textMute]], y: y };
    }
    ctx.restore();
    scrollbar(sc, top + 20);
  }

  const TIER_COLORS = ['#c8884a', '#d8d8e0', '#ffd25a', '#8affe8', '#ff8ac8', '#c08aff', '#ff5a5a', '#ffffff'];

  function upgradeIcon(u, x, y, can) {
    ctx.globalAlpha = can ? 1 : 0.6;
    if (u.kind === 'tier') {
      ctx.drawImage(NS.buildingArt.icon(u.target), x - 22, y - 24, 44, 44);
      for (let k = 0; k <= u.tier; ++k) K.circle(ctx, x - 16 + k * 8, y + 22, 3, TIER_COLORS[k + 1]);
    } else kit.icon(u.icon, x, y, 30, u.tierColor != null ? TIER_COLORS[u.tierColor % TIER_COLORS.length] : UI.gold);
    ctx.globalAlpha = 1;
  }

  function kindText(u) {
    return { tier: 'Producer upgrade', click: 'Clicking upgrade', global: 'Flavour upgrade', deco: 'Treat decoration - you will see it!', golden: 'Golden treat charm',
      milk: 'Milk - boosts achievements', combo: 'Combo tool' }[u.kind] || '';
  }

  function scrollbar(sc, top) {
    if (sc.max <= 0) return;
    const L = LAYOUT;
    const f = G.ui[sc.key] / sc.max;
    const bh = Math.max(30, sc.viewH * sc.viewH / (sc.viewH + sc.max));
    ctx.fillStyle = 'rgba(255,220,170,0.35)';
    K.roundRect(ctx, L.storeX + L.storeW - 7, top + f * (sc.viewH - bh), 4, bh, 2);
    ctx.fill();
  }

  function drawTooltip() {
    const h = G.ui.hover;
    if (!h) return;
    const w = 320;
    const x = LAYOUT.storeX - w - 10;
    const hh = 46 + h.lines.length * 20;
    const y = Math.max(90, Math.min(700 - hh, h.y - 10));
    kit.panel(x, y, w, hh, { accent: UI.gold, glow: true, top: 'rgba(40,24,14,0.98)', bottom: 'rgba(22,12,6,0.98)' });
    kit.icon(h.icon, x + 24, y + 24, 30, UI.gold);
    kit.fitText(h.title, x + 46, y + 23, w - 56, 18, { weight: 'bold', color: UI.gold });
    for (let i = 0; i < h.lines.length; ++i) kit.fitText(h.lines[i][0], x + 14, y + 52 + i * 20, w - 24, 13, { color: h.lines[i][1] });
  }

  /* wheel or drag on the list */
  function scroll(dy) {
    const sc = clampScroll();
    G.ui[sc.key] += dy;
    clampScroll();
  }

  Object.assign(NS.store, { revealed, clampScroll, setTab, draw, drawTooltip, scroll, upgradeIcon });
})();
