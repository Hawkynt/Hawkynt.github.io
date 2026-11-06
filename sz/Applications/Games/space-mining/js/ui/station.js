/* The station screen, the career hub: Kessler Station turning beside your docked rig, the
   credits, research and news ticker, and seven tabs - Market (stock, prices, history,
   forecasts, selling ore, bars and components), Refinery (smelting 3 ore into bars), Contracts
   (deliveries and waves held for credits and data, the daily contract), Shipyard and Modules
   (drawn by NS.shipyard), Colonies and Log (drawn by NS.colonies) - with buttons to the belt
   map, tech tree, help and title. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ORES, ORE_BY_ID } = NS.ores;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const eco = NS.economy;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const TABS = [
    { id: 'market', name: 'Market', icon: 'trade' },
    { id: 'refinery', name: 'Refinery', icon: 'refinery' },
    { id: 'contracts', name: 'Contracts', icon: 'contract' },
    { id: 'shipyard', name: 'Shipyard', icon: 'engine' },
    { id: 'modules', name: 'Modules', icon: 'station' },
    { id: 'colonies', name: 'Colonies', icon: 'habitat' },
    { id: 'log', name: 'Log', icon: 'log' },
  ];
  const PX = 600, PY = 96, PW = 640, PH = 520;

  /* coins flying from a sale toward the credits counter */
  const coins = [];

  function payout(x, y, amount) {
    const n = Math.min(14, 3 + Math.floor(Math.log(amount + 1) * 1.5));
    for (let i = 0; i < n; ++i) coins.push({ x: x, y: y, t: -i * 0.04, ox: (Math.random() - 0.5) * 160, oy: -40 - Math.random() * 80 });
    NS.fx.text(x, y - 10, '+' + kit.group(amount) + ' cr', UI.gold, 22, 1.2);
    sfx('coin', { volume: 0.7 });
  }

  function drawCoins() {
    for (let i = coins.length - 1; i >= 0; --i) {
      const c = coins[i];
      c.t += 1 / 60;
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / 0.8);
      const tx = 1080, ty = 46;
      const x = c.x + (tx - c.x) * k * k + c.ox * Math.sin(k * Math.PI) * 0.5;
      const y = c.y + (ty - c.y) * k * k + c.oy * Math.sin(k * Math.PI);
      kit.icon('coin', x, y, 14, UI.gold);
      if (k >= 1) coins.splice(i, 1);
    }
  }

  function draw() {
    const save = G.save;
    const v = NS.view.visible();
    const t = G.time;
    /* the station and the rig parked at its hub */
    ctx.fillStyle = 'rgba(0,0,8,0.25)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    NS.stationArt.draw(ctx, 300, 400, 0.62, save.modules, t);
    const st = G.stats;
    const bob = Math.sin(t * 1.3) * 4;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    K.blit(ctx, K.glow(st.colors.glow), 470 - 30, 640 + bob, 0.5);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.shipArt.shipSprite(st.hullId, st.colors, 0), 470, 640 + bob, -0.2, 1.4);
    kit.text(NS.ships.HULL_BY_ID[st.hullId].name + '  -  docked', 470, 690, 12, UI.textDim, { align: 'center' });
    NS.fxRender.draw({ x0: -400, y0: -400, x1: 1700, y1: 1100 });

    header(save);
    tabs();
    kit.panel(PX, PY + 40, PW, PH - 40, { alpha: 0.95 });
    switch (G.ui.stationTab) {
      case 'market': market(save); break;
      case 'refinery': refinery(save); break;
      case 'contracts': contracts(save); break;
      case 'shipyard': NS.shipyard.drawShipyard(PX, PY + 40, PW, PH - 40); break;
      case 'modules': NS.shipyard.drawModules(PX, PY + 40, PW, PH - 40); break;
      case 'colonies': NS.colonies.drawColonies(PX, PY + 40, PW, PH - 40); break;
      case 'log': NS.colonies.drawLog(PX, PY + 40, PW, PH - 40); break;
    }
    footer(v);
    drawCoins();
  }

  function header(save) {
    kit.text('KESSLER STATION', 40, 40, 30, '#ffffff', { weight: 'bold' });
    kit.text('Cycle ' + save.cycle + '  -  ' + save.licenses.length + ' of 5 belts licensed', 40, 70, 13, UI.textDim);
    kit.credits(save.credits, 1080, 46, 26, 'right');
    kit.amount(save.rd, 1240, 46, 22, 'right', 'rd');
    if (save.news) {
      const a = 0.7 + Math.sin(G.time * 2) * 0.3;
      ctx.globalAlpha = a;
      kit.text('NEWS  ' + save.news, 40, 96, 13, UI.warn, { weight: 'bold' });
      ctx.globalAlpha = 1;
    }
  }

  function tabs() {
    const w = PW / TABS.length;
    for (let i = 0; i < TABS.length; ++i) {
      const tb = TABS[i];
      const on = G.ui.stationTab === tb.id;
      W.button('tab_' + tb.id, tb.name, PX + i * w + 2, PY, w - 4, 38, {
        action: () => { G.ui.stationTab = tb.id; }, icon: tb.icon, selected: on, px: 12,
      });
    }
  }

  function footer(v) {
    const y = 636;
    W.button('launch', 'Launch', 600, y, 250, 56, { action: () => scr.setScreen('map'), icon: 'launch', accent: UI.gold, sub: 'Pick a belt', px: 22 });
    W.button('tree', 'Tech Tree', 862, y, 180, 56, { action: () => scr.openTree('station'), icon: 'tree', accent: UI.data });
    W.button('help', 'Help', 1054, y, 90, 56, { action: () => scr.openHelp('station'), icon: 'help', px: 15 });
    W.button('title', 'Title', 1150, y, 90, 56, { action: () => scr.setScreen('title'), icon: 'back', px: 15 });
  }

  function sparkline(hist, x, y, w, h, color) {
    if (hist.length < 2) return;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < hist.length; ++i) { lo = Math.min(lo, hist[i]); hi = Math.max(hi, hist[i]); }
    if (hi - lo < 1) { hi += 1; lo -= 1; }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < hist.length; ++i) {
      const px = x + i / (hist.length - 1) * w, py = y + h - (hist[i] - lo) / (hi - lo) * h;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function sellAll(save) {
    let total = 0;
    for (let i = 0; i < ORES.length; ++i) {
      total += eco.sell(save, G.stats, 'ore', ORES[i].id, Infinity);
      total += eco.sell(save, G.stats, 'bar', ORES[i].id, Infinity);
    }
    for (const id in save.store.comp) total += eco.sellComp(save, G.stats, id, Infinity);
    return total;
  }

  function after(total, x, y) {
    if (total > 0) payout(x, y, total);
    const got = NS.rules.checkAchievements(G.save);
    if (got.length) scr.achievements(got);
    NS.save.writeSave();
    NS.statusBar.update();
  }

  function market(save) {
    const st = G.stats;
    const x = PX + 18, y0 = PY + 60;
    const reach = eco.reachableOres(save);
    const rows = ORES.filter(o => reach.indexOf(o.id) >= 0 || save.store.ore[o.id] || save.store.bar[o.id]);
    kit.text('ORE', x + 34, y0, 12, UI.textMute, { weight: 'bold' });
    kit.text('STOCK', x + 200, y0, 12, UI.textMute, { weight: 'bold' });
    kit.text('PRICE', x + 300, y0, 12, UI.textMute, { weight: 'bold' });
    kit.text('LAST CYCLES', x + 370, y0, 12, UI.textMute, { weight: 'bold' });
    const rowH = Math.min(40, (Object.keys(save.store.comp).length ? 330 : 360) / Math.max(1, rows.length));
    for (let i = 0; i < rows.length; ++i) {
      const o = rows[i];
      const y = y0 + 22 + i * rowH;
      const m = save.market[o.id];
      const p = eco.price(save, st, o.id);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.15)';
      ctx.fillRect(x - 6, y - 4, PW - 24, rowH - 2);
      K.blit(ctx, NS.rockArt.nugget(o.id, 0), x + 12, y + rowH / 2 - 3, 1.2);
      kit.text(o.name, x + 34, y + rowH / 2 - 3, 15, o.glow, { weight: 'bold' });
      const ores = save.store.ore[o.id] || 0, bars = save.store.bar[o.id] || 0;
      kit.text(ores + (bars ? '  +' + bars + ' bars' : ''), x + 200, y + rowH / 2 - 3, 14, ores || bars ? UI.text : UI.textMute);
      const base = o.value * st.priceMul;
      kit.text(String(p), x + 300, y + rowH / 2 - 3, 15, p >= base * 1.08 ? UI.good : p <= base * 0.92 ? UI.bad : UI.text, { weight: 'bold' });
      sparkline(m.hist, x + 370, y + 4, 90, rowH - 16, K.rgba(o.color, 0.9));
      if (st.scanner >= 2) {
        const f = eco.forecast(save, o.id);
        kit.text(f > 0 ? '▲' : f < 0 ? '▼' : '•', x + 470, y + rowH / 2 - 3, 13, f > 0 ? UI.good : f < 0 ? UI.bad : UI.textMute, { align: 'center' });
      }
      if (ores || bars) {
        const val = ores * p + bars * eco.barPrice(save, st, o.id);
        W.button('sell_' + o.id, 'Sell ' + kit.group(val), x + 488, y, 130, rowH - 6, {
          accent: UI.gold, px: 13, action: () => {
            const tot = eco.sell(save, st, 'ore', o.id, Infinity) + eco.sell(save, st, 'bar', o.id, Infinity);
            after(tot, x + 550, y + 10);
          },
        });
      }
    }
    const comps = Object.keys(save.store.comp);
    if (comps.length) {
      let cx = x;
      const cy = PY + PH - 78;
      kit.text('COMPONENTS', cx, cy, 11, UI.textMute, { weight: 'bold' });
      cx += 90;
      for (let i = 0; i < comps.length && cx < PX + PW - 120; ++i) {
        const cd = NS.colonyData.COMP_BY_ID[comps[i]];
        kit.icon(cd.icon, cx + 8, cy, 14, cd.color);
        kit.text(save.store.comp[comps[i]] + ' x ' + eco.compPrice(st, comps[i]), cx + 18, cy, 12, UI.text);
        cx += 96;
      }
    }
    const total = eco.storeValue(save, st);
    const by = PY + PH - 50;
    kit.text(st.scanner >= 2 ? 'Arrows: the Scanner Array\'s forecast for next cycle' : 'Prices drift every cycle - selling a lot at once pushes them down', x, by + 18, 12, UI.textMute);
    W.button('sellAll', total ? 'Sell everything  ' + kit.group(total) : 'Warehouse empty', PX + PW - 260, by, 240, 40, {
      accent: UI.gold, disabled: !total, action: () => after(sellAll(save), PX + PW - 140, by),
    });
  }

  function refinery(save) {
    const st = G.stats;
    const x = PX + 24, y0 = PY + 64;
    if (st.refinery < 1) {
      kit.icon('refinery', PX + PW / 2, PY + 200, 64, UI.textMute);
      kit.text('No refinery yet', PX + PW / 2, PY + 260, 22, '#ffffff', { align: 'center', weight: 'bold' });
      kit.wrap('Build the Refinery module to smelt three ore into one bar worth 30% more - bars are lighter on the market too.', PX + 80, PY + 290, PW - 160, 14, 20, UI.textDim, { align: 'left' });
      W.button('toModules', 'Go to Modules', PX + PW / 2 - 110, PY + 360, 220, 44, { accent: UI.gold, action: () => { G.ui.stationTab = 'modules'; } });
      return;
    }
    kit.text('Refinery level ' + st.refinery + '  -  bars are worth ' + Math.round((eco.BAR_MUL[st.refinery] - 1) * 100) + '% more than their ore', x, y0, 15, UI.accent, { weight: 'bold' });
    let row = 0;
    for (let i = 0; i < ORES.length; ++i) {
      const o = ORES[i];
      const have = save.store.ore[o.id] || 0;
      if (have < 3) continue;
      const y = y0 + 30 + row * 42;
      if (y > PY + PH - 100) break;
      ++row;
      K.blit(ctx, NS.rockArt.nugget(o.id, 1), x + 10, y + 16, 1.2);
      kit.text(have + ' ' + o.name, x + 30, y + 16, 15, o.glow, { weight: 'bold' });
      const bars = Math.floor(have / 3);
      kit.text('->  ' + bars + ' x ' + o.bar, x + 200, y + 16, 14, UI.text);
      const gain = bars * (eco.barPrice(save, st, o.id) - 3 * eco.price(save, st, o.id));
      kit.text('+' + kit.group(gain) + ' value', x + 400, y + 16, 13, UI.good);
      W.button('ref_' + o.id, 'Smelt', x + 480, y, 110, 34, {
        accent: UI.warn, px: 14, action: () => {
          const n = eco.refine(save, st, o.id);
          if (n) smelted(n, x + 535, y + 16, o);
          after(0);
        },
      });
    }
    if (!row) kit.text('Bring back at least 3 of an ore to smelt it', PX + PW / 2, PY + 220, 16, UI.textMute, { align: 'center' });
    const by = PY + PH - 50;
    W.button('refAll', 'Smelt everything', PX + PW - 260, by, 240, 40, {
      accent: UI.warn, disabled: !row, action: () => {
        let n = 0;
        for (let i = 0; i < ORES.length; ++i) n += eco.refine(save, st, ORES[i].id);
        if (n) smelted(n, PX + PW - 140, by, null);
        after(0);
      },
    });
  }

  function smelted(n, x, y, ore) {
    NS.fx.explode(x, y, 10, NS.fx.FIRE, { noDebris: true });
    NS.fx.text(x, y - 16, '+' + n + ' bar' + (n > 1 ? 's' : ''), ore ? ore.glow : UI.warn, 20, 1.2);
    NS.fx.shake(0.1);
    sfx('levelup', { volume: 0.5, pitch: 0.7 });
  }

  function contracts(save) {
    const st = G.stats;
    const list = save.contracts;
    kit.text('Deliveries for the colonies - paid in credits and research data', PX + 24, PY + 64, 14, UI.textDim);
    const cw = (PW - 60) / 2, ch = 118;
    for (let i = 0; i < list.length; ++i) {
      const c = list[i];
      const o = ORE_BY_ID[c.ore];
      const comp = c.kind === 'comp' ? NS.colonyData.COMP_BY_ID[c.ore] : null;
      const color = o ? o.color : comp ? comp.color : UI.bad;
      const x = PX + 20 + (i % 2) * (cw + 20), y = PY + 88 + Math.floor(i / 2) * (ch + 12);
      if (y + ch > PY + PH - 4) break;
      const ok = eco.canFulfil(save, c);
      kit.panel(x, y, cw, ch, { accent: ok ? UI.good : c.daily ? UI.cyan : c.weekly ? UI.data : color, radius: 8, alpha: 0.9, glow: ok });
      if (o) K.blit(ctx, NS.rockArt.nugget(o.id, 2), x + 26, y + 30, 1.6);
      else kit.icon(comp ? comp.icon : 'turret', x + 26, y + 30, 26, color);
      kit.fitText(NS.colonies.contractText(c).replace('Deliver ', ''), x + 50, y + 22, cw - 140, 15, { weight: 'bold', color: '#ffffff' });
      kit.text(c.daily ? 'DAILY - today only' : c.weekly ? 'WEEKLY - until ' + c.weekly.slice(5) + ' ends' : c.trips + ' cycle' + (c.trips > 1 ? 's' : '') + ' left', x + 50, y + 44, 12,
        c.daily ? UI.cyan : c.weekly ? UI.data : c.trips <= 1 ? UI.bad : UI.textDim);
      const have = eco.progress(save, c);
      kit.bar(x + 16, y + 62, cw - 32, 8, have / c.qty, ok ? UI.good : color);
      kit.text(Math.min(have, c.qty) + ' / ' + c.qty + (c.kind === 'bar' ? ' bars' : c.kind === 'waves' ? ' waves' : ''), x + 16, y + 82, 12, UI.textDim);
      kit.credits(c.reward, x + cw - 16, y + 22, 15, 'right');
      kit.amount(c.rd, x + cw - 16, y + 44, 13, 'right', 'rd');
      W.button('ctr_' + c.id, ok ? 'Deliver' : 'Need more', x + cw - 130, y + ch - 40, 116, 30, {
        disabled: !ok, accent: UI.good, px: 13, action: () => {
          const done = eco.fulfil(save, save.contracts.indexOf(c));
          if (done) {
            payout(x + cw - 70, y + ch - 30, done.reward);
            sfx('win', { volume: 0.5 });
          }
          after(0);
        },
      });
    }
    if (!list.length) kit.text('No open contracts - they refresh each cycle', PX + PW / 2, PY + 240, 16, UI.textMute, { align: 'center' });
    kit.text('Open slots: ' + st.contracts + '  (Trade Hub and Contract Office add more)', PX + 24, PY + PH - 24, 12, UI.textMute);
  }

  function onKey(e) {
    if (e.code === 'Tab') {
      let i = 0;
      for (let k = 0; k < TABS.length; ++k) if (TABS[k].id === G.ui.stationTab) i = k;
      i = (i + (e.shiftKey ? TABS.length - 1 : 1)) % TABS.length;
      G.ui.stationTab = TABS[i].id;
      sfx('click', { volume: 0.4 });
      return true;
    }
    if (e.code === 'KeyL') {
      scr.setScreen('map');
      return true;
    }
    return false;
  }

  Object.assign(NS.station, {
    TABS, draw, onKey, payout, TAU
  });
})();
