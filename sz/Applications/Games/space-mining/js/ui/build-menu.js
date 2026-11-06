/* The build menu of the command view: six category tabs and a tile per building (thumbnail,
   name, credit cost, red when you cannot afford it) with a tooltip listing the full cost
   against your stock, power, crew, upkeep and role; picking a tile starts placement. Before the
   outpost is founded it offers only the command hub. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { CATEGORIES, BUILDINGS, BUILDING_BY_ID, COMP_BY_ID } = NS.colonyData;
  const { ORE_BY_ID } = NS.ores;
  const kit = NS.kit;
  const C = NS.colony;
  const { ctx } = NS.view;

  const TILE = 76;

  function area(v) {
    const x = v.x0 + NS.commandHud.MM_W + 32;
    return { x: x, y: v.y1 - 126, w: Math.min(6 * (TILE + 6) + 14, v.x1 - 410 - x), h: 118 };
  }

  function costLines(cost, stock, wallet) {
    const out = [];
    if (cost.cr) out.push(['Credits  ' + NS.kit.group(cost.cr) + '  (have ' + NS.kit.group(wallet.credits) + ')', wallet.credits >= cost.cr ? UI.gold : UI.bad, true]);
    for (const kind of ['ore', 'bar', 'comp'])
      if (cost[kind]) for (const id in cost[kind]) {
        const have = stock[kind][id] || 0;
        const name = kind === 'comp' ? COMP_BY_ID[id].name : kind === 'bar' ? ORE_BY_ID[id].bar : ORE_BY_ID[id].name;
        out.push([cost[kind][id] + ' ' + name + '  (have ' + have + ')', have >= cost[kind][id] ? UI.text : UI.bad]);
      }
    return out;
  }

  function tipFor(def, b) {
    const cost = C.buildCost(def.id, G.stats);
    const lines = costLines(cost, b.data.stock, NS.base.wallet());
    lines.push([(def.power > 0 ? '+' + def.power + ' power' : def.power < 0 ? def.power + ' power' : 'No power') + '   ' + (def.crew ? def.crew + ' crew' : 'no crew') +
      '   ' + def.size + 'x' + def.size + '   upkeep ' + def.upkeep + '/cycle', UI.textDim]);
    return { title: def.name, text: def.desc, lines: lines, color: def.color };
  }

  function draw(v) {
    const b = G.base;
    const a = area(v);
    kit.panel(a.x, a.y, a.w, a.h, { radius: 8, brackets: false, alpha: 0.94 });
    const c = G.cmd;
    const btn = NS.commandHud.btn;
    if (b.data.abandoned) {
      kit.text('The outpost is abandoned.', a.x + 16, a.y + 34, 16, UI.bad, { weight: 'bold' });
      kit.wrap('Kill any hive at the hub, then bring survivors to the hub or reclaim it from the hub panel with new crew.', a.x + 16, a.y + 54, a.w - 32, 13, 18, UI.textDim);
      return;
    }
    const claimed = NS.base.claimed();
    let list;
    if (!claimed) {
      list = [BUILDING_BY_ID.hub];
      kit.text('FOUND AN OUTPOST', a.x + 14, a.y + 16, 13, UI.accent, { weight: 'bold' });
    } else {
      const tw = (a.w - 20) / CATEGORIES.length;
      for (let i = 0; i < CATEGORIES.length; ++i) {
        const cat = CATEGORIES[i];
        btn('cat_' + cat.id, a.x + 8 + i * tw, a.y + 6, tw - 4, 24, {
          icon: cat.icon, label: cat.name, px: 11, color: cat.color, on: c.cat === cat.id, action: () => { c.cat = cat.id; },
        });
      }
      list = BUILDINGS.filter(d => d.cat === c.cat && d.id !== 'hub');
    }
    const y = a.y + (claimed ? 34 : 28);
    for (let i = 0; i < list.length; ++i) {
      const def = list[i];
      const x = a.x + 8 + i * (TILE + 6);
      if (x + TILE > a.x + a.w) break;
      const cost = C.buildCost(def.id, G.stats);
      const ok = C.canAfford(NS.base.wallet(), b.data.stock, cost);
      const on = c.place === def.id;
      const hot = btn('b_' + def.id, x, y, TILE, TILE, { color: def.color, on: on, action: () => {
        if (c.place === def.id) c.place = null;
        else NS.command.startPlace(def.id);
      }, tip: tipFor(def, b) });
      const sp = NS.colonyArt.building(def.id, 1);
      const s = 40 / sp.w;
      ctx.globalAlpha = ok ? 1 : 0.55;
      ctx.drawImage(sp.canvas, x + TILE / 2 - sp.w * s / 2, y + 6, sp.w * s, sp.h * s);
      ctx.globalAlpha = 1;
      kit.fitText(def.name, x + TILE / 2, y + 54, TILE - 6, 11, { weight: 'bold', color: hot ? '#ffffff' : UI.text, align: 'center' });
      kit.text(NS.kit.group(cost.cr), x + TILE / 2, y + 68, 11, ok ? UI.gold : UI.bad, { align: 'center', weight: 'bold' });
    }
    if (!claimed) kit.wrap('Pick the Command Hub, then click inside the outpost site. It costs ' + NS.kit.group(C.buildCost('hub', G.stats).cr) +
      ' credits and starts four crew. Waves will come for it.', a.x + TILE + 26, a.y + 40, a.w - TILE - 40, 13, 18, UI.textDim);
  }

  /* B cycles the categories */
  function cycle(d) {
    const c = G.cmd;
    let i = CATEGORIES.findIndex(k => k.id === c.cat);
    i = (i + (d || 1) + CATEGORIES.length) % CATEGORIES.length;
    c.cat = CATEGORIES[i].id;
  }

  Object.assign(NS.buildMenu, {
    TILE, area, draw, cycle, costLines
  });
})();
