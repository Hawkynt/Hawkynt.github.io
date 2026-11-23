/* The Supply panel, drawn as the station's Supply tab and as the Supplies screen opened while
   docked mid-trip (the trip waits): buying iron, copper and ice as ore and bars into the
   warehouse, and the list of what goes aboard - at the station the cargo manifest loaded at
   every launch, docked the supplies in the hold, loaded and unloaded on the spot - with the
   hold gauge. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { ORE_BY_ID } = NS.ores;
  const { COMP_BY_ID } = NS.colonyData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const SP = NS.supply;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const ROW = 26;

  function name(kind, id) {
    return kind === 'comp' ? COMP_BY_ID[id].name : kind === 'bar' ? ORE_BY_ID[id].bar : ORE_BY_ID[id].name;
  }

  function icon(kind, id, x, y) {
    if (kind === 'ore') K.blit(ctx, NS.rockArt.nugget(id, 0), x, y, 1);
    else if (kind === 'comp') kit.icon(COMP_BY_ID[id].icon, x, y, 14, COMP_BY_ID[id].color);
    else {
      ctx.fillStyle = ORE_BY_ID[id].color;
      ctx.fillRect(x - 7, y - 4, 14, 8);
    }
  }

  /* docked mid-trip the list moves supplies on the spot, at the station it edits the manifest */
  function live() {
    return !!(G.run && G.screen === 'supply');
  }

  function buyColumn(x, y, w) {
    const save = G.save, st = G.stats;
    kit.text('BUY AT THE STATION', x, y, 12, UI.textMute, { weight: 'bold' });
    for (let i = 0; i < SP.BUY.length; ++i) {
      const b = SP.BUY[i], yy = y + 26 + i * ROW;
      const p = SP.buyPrice(save, st, b.kind, b.id);
      icon(b.kind, b.id, x + 8, yy);
      kit.fitText(name(b.kind, b.id), x + 22, yy, 110, 13, { color: UI.text });
      kit.text(p + ' cr', x + 140, yy, 12, UI.gold);
      for (const n of [10, 50]) {
        const bx = x + w - (n === 10 ? 96 : 48);
        W.button('buy' + n + '_' + b.kind + '_' + b.id, '+' + n, bx, yy - 10, 44, 20, { px: 11, disabled: save.credits < p * n,
          action: () => { if (SP.buy(save, st, b.kind, b.id, n)) sfx('coin', { volume: 0.4 }); else sfx('error'); } });
      }
    }
    kit.wrap('Markup ' + Math.round((SP.MARKUP - 1) * 100) + '% over the market. The outer belts have little or no iron, copper and ice - bring them along.',
      x, y + 34 + SP.BUY.length * ROW, w, 11, 15, UI.textMute);
  }

  /* the rows of the list: everything ordered, aboard or in the warehouse, in a fixed catalogue
     order (components, bars, ore) - rows never move when a number changes, so the row under the
     pointer stays the same while you click */
  function rows(target) {
    const store = G.save.store, out = [];
    const order = { comp: NS.colonyData.COMPONENTS.map(c => c.id), bar: NS.ores.ORES.map(o => o.id), ore: NS.ores.ORES.map(o => o.id) };
    for (const kind of ['comp', 'bar', 'ore'])
      for (const id of order[kind])
        if ((target[kind][id] || 0) > 0 || (store[kind][id] || 0) > 0) out.push({ kind: kind, id: id });
    return out;
  }

  function change(kind, id, n) {
    const save = G.save;
    if (live()) {
      const moved = n > 0 ? SP.move(save.store, G.run.freight, kind, id, Math.min(n, room(kind, id))) : SP.move(G.run.freight, save.store, kind, id, -n);
      NS.mining.refreshCargoSpace();
      sfx(moved ? 'blip' : 'error');
      return;
    }
    const m = save.manifest[kind];
    m[id] = Math.max(0, (m[id] || 0) + n);
    if (!m[id]) delete m[id];
    sfx('blip');
  }

  /* how many more units of kind/id fit into the hold right now */
  function room(kind, id) {
    const left = G.run.cargoMax - G.run.cargoUsed;
    if (kind !== 'ore') return Math.floor(left);
    return NS.rules.packedRoom(G.stats, G.run.freight.ore[id] || 0, left / NS.rules.oreSpace(G.stats, id));
  }

  function listColumn(x, y, w, h) {
    const save = G.save, on = live();
    const target = on ? G.run.freight : save.manifest;
    kit.text(on ? 'SUPPLIES ABOARD' : 'CARGO MANIFEST - LOADED AT EVERY LAUNCH', x, y, 12, UI.textMute, { weight: 'bold' });
    const list = rows(target);
    if (list.length) {
      kit.text('STORE', x + 150, y + 14, 10, UI.textMute, { align: 'right' });
      kit.text(on ? 'ABOARD' : 'TAKE', x + 206, y + 14, 10, UI.textMute, { align: 'right' });
    }
    const max = Math.max(1, Math.floor((h - 90) / ROW));
    if (!list.length) kit.wrap('The warehouse is empty. Buy basics here, or bank ore from the inner belts.', x, y + 30, w, 13, 18, UI.textDim);
    for (let i = 0; i < list.length && i < max; ++i) {
      const r = list[i], yy = y + 36 + i * ROW;
      const have = save.store[r.kind][r.id] || 0, n = target[r.kind][r.id] || 0;
      icon(r.kind, r.id, x + 8, yy);
      kit.fitText(name(r.kind, r.id), x + 22, yy, 96, 13, { color: n ? '#ffffff' : UI.text });
      kit.text(String(have), x + 150, yy, 12, UI.textDim, { align: 'right' });
      kit.text(String(n), x + 206, yy, 13, n ? UI.accent : UI.textMute, { weight: 'bold', align: 'right' });
      const key = r.kind + '_' + r.id;
      W.button('sup_less_' + key, '-10', x + w - 92, yy - 10, 42, 20, { px: 11, disabled: !n, action: () => change(r.kind, r.id, -10) });
      W.button('sup_more_' + key, '+10', x + w - 46, yy - 10, 42, 20, { px: 11, disabled: on && !have, action: () => change(r.kind, r.id, 10) });
    }
    /* the hold gauge */
    const gy = y + h - 44;
    const cap = on ? G.run.cargoMax : G.stats.cargo;
    const used = on ? G.run.cargoUsed : SP.fit(save, G.stats, cap).used;
    kit.text(on ? 'HOLD' : 'A LAUNCH LOADS', x, gy, 12, UI.textMute, { weight: 'bold' });
    kit.bar(x + 120, gy - 5, w - 230, 10, used / Math.max(1, cap), UI.accent);
    kit.text(Math.ceil(used) + ' / ' + cap + ' slots', x + w, gy, 12, UI.text, { align: 'right' });
    if (!on) kit.text('Supplies never count as a haul - unload them at your hub', x, gy + 22, 11, UI.textMute);
  }

  function draw(x, y, w, h) {
    buyColumn(x + 18, y + 20, 270);
    listColumn(x + 310, y + 20, w - 328, h - 20);
  }

  /* the Supplies screen while docked */
  function drawScreen() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,4,12,0.55)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const x = 300, y = 110, w = 680, h = 480;
    kit.panel(x, y, w, h, { glow: true, accent: UI.gold });
    kit.text('SUPPLIES', 640, y + 26, 22, '#ffffff', { align: 'center', weight: 'bold' });
    kit.credits(G.save.credits, x + w - 20, y + 26, 18, 'right');
    draw(x, y + 30, w, h - 90);
    W.button('sup_back', 'Back to the flight  [Esc]', 640 - 140, y + h - 54, 280, 42, { accent: UI.gold, action: close });
  }

  function open() {
    if (!G.run || !G.run.docked || G.run.mode !== 'career') return;
    NS.screens.setScreen('supply');
  }

  function close() {
    if (G.screen === 'supply') NS.screens.setScreen('playing');
  }

  Object.assign(NS.supplyUi, {
    draw, drawScreen, open, close, rows
  });
})();
