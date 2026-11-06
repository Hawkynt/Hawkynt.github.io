/* The command view HUD in view-plane coordinates, pinned to the visible edges: the resource bar
   (credits, research, power, storage, crew and infection, fleet supply), the outpost stock
   strip for every resource, the wave clock with its preview, the boss bar, alerts, the minimap
   (terrain, outpost, fleets, threats, the view frame - click to look there), view buttons, the
   build menu and selection panel (their own modules), hints and messages; plus the compact
   outpost widget of the pilot view. Also the flat buttons every strategy panel uses. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ORES, ORE_BY_ID } = NS.ores;
  const { COMPONENTS } = NS.colonyData;
  const { ENEMY_BY_ID } = NS.fleetData;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const C = NS.colony;
  const { ctx, visible } = NS.view;

  const MM_W = 230, MM_H = 166;

  function hovered(x, y, w, h) {
    const i = G.input;
    return !i.touch && i.mouseX >= x && i.mouseX <= x + w && i.mouseY >= y && i.mouseY <= y + h;
  }

  /* a flat strategy button: opts { icon, label, sub, color, disabled, on, action, px, tip } */
  function btn(id, x, y, w, h, opts) {
    W.register(id, x, y, w, h, opts.disabled ? null : opts.action, opts.disabled);
    const hot = hovered(x, y, w, h);
    const col = opts.color || UI.accent;
    ctx.save();
    if (opts.disabled) ctx.globalAlpha *= 0.45;
    kit.panel(x, y, w, h, { radius: 6, brackets: false, accent: hot || opts.on ? '#ffffff' : col, glow: hot || opts.on,
      top: opts.on ? 'rgba(60,70,40,0.96)' : hot ? 'rgba(46,52,66,0.97)' : 'rgba(18,26,38,0.94)', bottom: 'rgba(6,10,16,0.96)' });
    let tx = x + w / 2;
    if (opts.icon && opts.label) {
      kit.icon(opts.icon, x + 16, y + h / 2, Math.min(20, h * 0.55), hot ? '#ffffff' : col);
      tx = x + 16 + (w - 16) / 2;
    } else if (opts.icon) kit.icon(opts.icon, x + w / 2, y + h / 2 - (opts.sub ? 6 : 0), Math.min(24, h * 0.6), hot ? '#ffffff' : col);
    if (opts.label) kit.fitText(opts.label, tx, y + h / 2 - (opts.sub ? 7 : 0), w - (opts.icon ? 34 : 10), opts.px || 13, { weight: 'bold', color: hot ? '#ffffff' : UI.text, align: 'center' });
    if (opts.sub) kit.fitText(opts.sub, tx, y + h - 9, w - 8, 10, { color: UI.textDim, align: 'center' });
    ctx.restore();
    if (hot && opts.tip) G.cmd.tip = opts.tip;
    return hot;
  }

  /* ── the command view ── */
  function draw() {
    const b = G.base;
    if (!b) return;
    const v = visible();
    G.cmd.tip = null;
    topBar(v, b);
    stockStrip(v, b);
    wave(v, b);
    boss(v);
    alerts(v, b);
    minimap(v, b);
    viewButtons(v);
    NS.buildMenu.draw(v);
    NS.selPanel.draw(v);
    tip(v);
    message(v);
    if (G.cmd.plan) {
      ctx.strokeStyle = K.rgba(UI.cyan, 0.5 + Math.sin(G.time * 4) * 0.2);
      ctx.lineWidth = 4;
      ctx.strokeRect(v.x0 + 2, v.y0 + 2, v.w - 4, v.h - 4);
      kit.text('PAUSED  -  PLAN YOUR MOVES  (Space resumes)', (v.x0 + v.x1) / 2, v.y0 + 128, 18, UI.cyan, { align: 'center', weight: 'bold' });
    }
    NS.hud.drawBannerOnly(v);
  }

  function stat(x, y, icon, text, color, frac, fcol) {
    kit.icon(icon, x + 9, y, 16, color);
    kit.text(text, x + 22, y - (frac !== undefined ? 3 : 0), 13, color, { weight: 'bold' });
    if (frac !== undefined) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x + 22, y + 8, 88, 3);
      ctx.fillStyle = fcol || color;
      ctx.fillRect(x + 22, y + 8, 88 * Math.max(0, Math.min(1, frac)), 3);
    }
  }

  function topBar(v, b) {
    const h = 44;
    kit.panel(v.x0 + 6, v.y0 + 4, v.w - 12, h, { radius: 8, brackets: false, alpha: 0.92 });
    let x = v.x0 + 18;
    const y = v.y0 + 4 + h / 2;
    const wal = NS.base.wallet();
    kit.credits(wal.credits, x, y, 16);
    x += 128;
    kit.amount(G.save.rd + G.run.rd, x, y, 15, 'left', 'rd');
    x += 82;
    const d = b.data;
    const pw = b.pw;
    stat(x, y, 'bolt', Math.round(pw.make) + ' / ' + Math.round(pw.use), pw.ratio < 0.95 ? UI.bad : UI.cyan, pw.use ? Math.min(1, pw.make / Math.max(1, pw.use)) : 1, pw.ratio < 0.95 ? UI.bad : UI.cyan);
    x += 122;
    const cap = C.storageCap(d, G.stats), used = C.stockCount(d.stock);
    stat(x, y, 'cargo', used + ' / ' + cap, used >= cap ? UI.warn : UI.text, cap ? used / cap : 0, used >= cap ? UI.warn : UI.accent);
    x += 122;
    let inf = 0;
    for (let i = 0; i < d.buildings.length; ++i) if ((d.buildings[i].inf || 0) > 0.02) ++inf;
    stat(x, y, 'crew', d.crew + ' / ' + C.housing(d) + (inf ? '  ' + inf + ' sick' : ''), inf ? '#9ae04a' : UI.text);
    x += 132;
    stat(x, y, 'fighter', NS.base.supplyUsed() + ' / ' + C.supplyCap(d, G.stats), UI.text);
    x += 96;
    kit.text(b.zone.name.toUpperCase() + (d.abandoned ? '  -  ABANDONED' : ''), v.x1 - 18, y, 14, d.abandoned ? UI.bad : b.zone.theme.accent, { align: 'right', weight: 'bold' });
  }

  function chip(x, y, kind, id, n) {
    if (kind === 'comp') {
      const c = NS.colonyData.COMP_BY_ID[id];
      kit.icon(c.icon, x + 8, y, 14, c.color);
    } else {
      const o = ORE_BY_ID[id];
      if (kind === 'bar') {
        ctx.fillStyle = o.color;
        ctx.fillRect(x + 1, y - 4, 14, 8);
        ctx.fillStyle = o.glow;
        ctx.fillRect(x + 3, y - 4, 10, 2);
      } else K.blit(ctx, NS.rockArt.nugget(id, 0), x + 8, y, 0.85);
    }
    kit.text(String(n), x + 18, y, 12, UI.text, { weight: 'bold' });
    ctx.font = kit.font(12, 'bold');
    return 26 + ctx.measureText(String(n)).width;
  }

  /* every resource in stock: ore, then bars, then components */
  function stockStrip(v, b) {
    const st = b.data.stock;
    let x = v.x0 + 14;
    const y = v.y0 + 60, xm = v.x1 - 280;
    ctx.fillStyle = 'rgba(4,8,14,0.6)';
    ctx.fillRect(v.x0 + 6, y - 10, v.w - 12, 20);
    let any = false;
    for (let i = 0; i < ORES.length && x < xm; ++i) if (st.ore[ORES[i].id]) { x += chip(x, y, 'ore', ORES[i].id, st.ore[ORES[i].id]); any = true; }
    for (let i = 0; i < ORES.length && x < xm; ++i) if (st.bar[ORES[i].id]) { x += chip(x, y, 'bar', ORES[i].id, st.bar[ORES[i].id]); any = true; }
    for (let i = 0; i < COMPONENTS.length && x < xm; ++i) if (st.comp[COMPONENTS[i].id]) { x += chip(x, y, 'comp', COMPONENTS[i].id, st.comp[COMPONENTS[i].id]); any = true; }
    if (!any) kit.text(NS.base.claimed() ? 'Outpost stock empty - dock at the hub to unload your hold, or build rigs' : 'No outpost yet', x, y, 12, UI.textMute);
  }

  function clock(t) {
    t = Math.max(0, Math.ceil(t));
    return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60);
  }

  function wave(v, b) {
    if (!NS.base.claimed() || b.data.abandoned) return;
    const cx = (v.x0 + v.x1) / 2, y = v.y0 + 92;
    const p = NS.waves.preview();
    kit.panel(cx - 170, y - 18, 340, 40, { radius: 8, brackets: false, alpha: 0.9, accent: b.active ? UI.bad : UI.accent });
    if (b.active) {
      const left = NS.enemies.count(e => e.wave === b.waveNo) + (b.spawnQ ? b.spawnQ.length : 0);
      kit.text('WAVE ' + b.waveNo + '  -  ' + left + ' invaders left', cx, y + 2, 15, Math.sin(G.time * 6) > 0 ? UI.bad : '#ffffff', { align: 'center', weight: 'bold' });
      return;
    }
    if (!p) return;
    const warn = b.waveT <= NS.waves.WARN;
    kit.text('WAVE ' + p.wave + (p.boss ? ' + BOSS' : '') + '  ' + clock(b.waveT), cx - 160, y + 2, 14, warn && Math.sin(G.time * 8) > 0 ? UI.bad : UI.text, { weight: 'bold' });
    if (p.hidden) {
      kit.text('~' + p.count + ' contacts', cx + 160, y + 2, 12, UI.textDim, { align: 'right' });
      return;
    }
    let x = cx + 10;
    for (let i = 0; i < p.groups.length && x < cx + 160; ++i) {
      const g = p.groups[i];
      K.blitRot(ctx, NS.fleetArt.enemy(g.type), x + 8, y + 2, -Math.PI / 2, Math.min(0.5, 16 / ENEMY_BY_ID[g.type].r));
      kit.text('x' + g.n, x + 18, y + 6, 11, ENEMY_BY_ID[g.type].color, { weight: 'bold' });
      x += 36;
    }
  }

  function boss(v) {
    let m = null;
    for (let i = 0; i < G.enemies.length; ++i) if (G.enemies[i].alive && G.enemies[i].def.boss) m = G.enemies[i];
    if (!m) return;
    const cx = (v.x0 + v.x1) / 2, y = G.cmd.on ? v.y1 - 236 : v.y0 + 140;
    kit.text('HIVE MOTHERSHIP', cx, y - 12, 14, '#e080ff', { align: 'center', weight: 'bold' });
    kit.bar(cx - 220, y, 440, 12, m.hp / m.maxHp, '#d050ff', { cells: 20 });
    if (m.maxShield) kit.bar(cx - 220, y + 15, 440, 4, m.shield / m.maxShield, '#58a8ff');
  }

  function alerts(v, b) {
    let y = v.y0 + 86;
    const x = v.x1 - 14;
    for (const k in b.alerts) {
      const a = b.alerts[k];
      const blink = (k === 'attack' || k === 'hub' || k === 'rogue') && Math.sin(G.time * 8) < 0;
      ctx.font = kit.font(12, 'bold');
      const w = ctx.measureText(a.text).width + 28;
      ctx.fillStyle = 'rgba(6,10,16,0.82)';
      ctx.fillRect(x - w, y - 10, w, 20);
      ctx.fillStyle = a.color;
      ctx.fillRect(x - w, y - 10, 3, 20);
      kit.text(a.text, x - 8, y, 12, blink ? '#ffffff' : a.color, { align: 'right', weight: 'bold' });
      y += 23;
    }
  }

  /* the minimap: click to look there, right click to order there */
  function minimap(v, b) {
    const x = v.x0 + 10, y = v.y1 - MM_H - 10;
    kit.panel(x - 4, y - 4, MM_W + 8, MM_H + 8, { radius: 6, brackets: false, alpha: 0.95 });
    const kx = MM_W / G.world.w, ky = MM_H / G.world.h;
    ctx.drawImage(terrain(b, kx, ky), x, y, MM_W, MM_H);
    const radar = b.data.buildings.some(o => o.type === 'radar' && o.prog >= 1 && !o.rogue);
    for (let i = 0; i < G.clouds.length; ++i) {
      const c = G.clouds[i];
      if (!c.bio && !radar) continue;
      ctx.fillStyle = K.rgba(ORE_BY_ID[c.res].color, 0.35);
      ctx.beginPath(); ctx.arc(x + c.x * kx, y + c.y * ky, Math.max(1.5, c.r * kx), 0, TAU); ctx.fill();
    }
    const s = b.site;
    ctx.strokeStyle = K.rgba(b.zone.theme.accent, 0.7);
    ctx.strokeRect(x + s.x0 * kx, y + s.y0 * ky, s.w * kx, s.h * ky);
    for (let i = 0; i < b.data.buildings.length; ++i) {
      const o = b.data.buildings[i];
      ctx.fillStyle = o.rogue ? '#3affd0' : (o.inf || 0) > 0.05 ? '#9ae04a' : b.data.abandoned ? '#5a6070' : '#7cf0ff';
      ctx.fillRect(x + o.x * kx - 1.5, y + o.y * ky - 1.5, 3, 3);
    }
    ctx.fillStyle = UI.gold;
    ctx.fillRect(x + G.dock.x * kx - 2.5, y + G.dock.y * ky - 2.5, 5, 5);
    if (G.distress && G.distress.state !== 'rescued') {
      ctx.fillStyle = Math.sin(G.time * 6) > 0 ? '#ffd25a' : '#8a6a20';
      ctx.fillRect(x + G.distress.x * kx - 3, y + G.distress.y * ky - 3, 6, 6);
    }
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (!u.alive) continue;
      ctx.fillStyle = u.side === 'rogue' ? '#3affd0' : G.cmd.sel.indexOf(u) >= 0 ? '#ffffff' : '#5cff9a';
      ctx.fillRect(x + u.x * kx - 1, y + u.y * ky - 1, 2, 2);
    }
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || (e.dormant && !radar)) continue;
      ctx.fillStyle = e.dormant ? '#8a4a7a' : e.def.faction === 'lattice' ? '#3affd0' : '#ff4a4a';
      const sz = e.def.boss ? 5 : e.r > 30 ? 3 : 2;
      ctx.fillRect(x + e.x * kx - sz / 2, y + e.y * ky - sz / 2, sz, sz);
    }
    const sh = G.ship;
    if (sh && sh.alive) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x + sh.x * kx, y + sh.y * ky, 2.5, 0, TAU); ctx.fill();
    }
    const r = NS.camera.worldRect({}, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + Math.max(0, r.x0) * kx, y + Math.max(0, r.y0) * ky, Math.min(G.world.w, r.x1 - r.x0) * kx, Math.min(G.world.h, r.y1 - r.y0) * ky);
    W.register('minimap', x, y, MM_W, MM_H, () => {
      const m = minimapPoint(G.input.mouseX, G.input.mouseY);
      if (m) NS.command.centre(m.x, m.y);
    });
  }

  /* the minimap's terrain: belt colours and rock density, repainted every few seconds */
  let terr = null, terrT = -9, terrRun = null;
  function terrain(b, kx, ky) {
    if (!terr) terr = K.makeCanvas(MM_W * 2, MM_H * 2);
    if (terrRun === G.run && G.time - terrT < 3) return terr;
    terrRun = G.run;
    terrT = G.time;
    const g = terr.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    const th = b.zone.theme;
    const gr = g.createLinearGradient(0, 0, MM_W, MM_H);
    gr.addColorStop(0, K.shade(th.neb[0], -0.3));
    gr.addColorStop(1, th.base);
    g.fillStyle = gr;
    g.fillRect(0, 0, MM_W, MM_H);
    g.fillStyle = K.rgba(th.rock[0], 0.55);
    for (let i = 0; i < G.rocks.length; ++i) {
      const o = G.rocks[i];
      if (!o.alive || o.tier < 2) continue;
      const s = o.tier >= 3 ? 2 : 1.3;
      g.fillRect(o.x * kx - s / 2, o.y * ky - s / 2, s, s);
    }
    for (let i = 0; i < G.radZones.length; ++i) {
      const z = G.radZones[i];
      g.fillStyle = 'rgba(124,255,74,0.12)';
      g.beginPath(); g.arc(z.x * kx, z.y * ky, z.r * kx, 0, TAU); g.fill();
    }
    g.strokeStyle = K.rgba(th.accent, 0.25);
    g.strokeRect(0.5, 0.5, MM_W - 1, MM_H - 1);
    return terr;
  }

  function minimapPoint(px, py) {
    const v = visible();
    const x = v.x0 + 10, y = v.y1 - MM_H - 10;
    if (px < x || px > x + MM_W || py < y || py > y + MM_H) return null;
    return { x: (px - x) / MM_W * G.world.w, y: (py - y) / MM_H * G.world.h };
  }

  function viewButtons(v) {
    const x = v.x0 + 10, y = v.y1 - MM_H - 52;
    btn('toPilot', x, y, 112, 32, { icon: 'launch', label: 'Pilot', sub: '', color: UI.accent, action: () => NS.command.toggle(false), tip: { title: 'Pilot view (Tab)', text: 'Fly the ship again. Units keep their orders.' } });
    btn('plan', x + 118, y, 36, 32, { icon: G.cmd.plan ? 'launch' : 'pause', color: UI.cyan, on: G.cmd.plan, action: () => NS.command.plan(), tip: { title: 'Pause and plan (Space)', text: 'Freeze the battle and give orders at leisure.' } });
    btn('zoomIn', x + 160, y, 34, 32, { label: '+', px: 18, action: () => NS.command.zoomStep(1) });
    btn('zoomOut', x + 198, y, 34, 32, { label: '-', px: 18, action: () => NS.command.zoomStep(-1) });
  }

  function tip(v) {
    const t = G.cmd.tip;
    if (!t) return;
    const w = 300;
    ctx.font = kit.font(12);
    const lines = t.lines || [];
    const h = 40 + (t.text ? 18 * Math.ceil(ctx.measureText(t.text).width / (w - 24)) : 0) + lines.length * 17;
    const x = Math.min(v.x1 - w - 10, Math.max(v.x0 + 10, G.input.mouseX - w / 2)), y = Math.max(v.y0 + 70, G.input.mouseY - h - 18);
    kit.panel(x, y, w, h, { radius: 6, brackets: false, accent: t.color || UI.accent, glow: true });
    kit.text(t.title, x + 12, y + 16, 14, '#ffffff', { weight: 'bold' });
    let yy = y + 30;
    if (t.text) yy += kit.wrap(t.text, x + 12, yy, w - 24, 12, 18, UI.textDim);
    for (let i = 0; i < lines.length; ++i) {
      kit.text(lines[i][0], x + 12, yy + 8, 12, lines[i][1] || UI.text, { weight: lines[i][2] ? 'bold' : 'normal' });
      yy += 17;
    }
  }

  function message(v) {
    const m = G.cmd.msg;
    if (!m) return;
    ctx.globalAlpha = Math.min(1, (2.6 - m.t) * 2);
    kit.text(m.text, (v.x0 + v.x1) / 2, v.y0 + 150, 16, m.color, { align: 'center', weight: 'bold' });
    ctx.globalAlpha = 1;
  }

  /* ── the pilot view's outpost widget ── */
  function pilotWidget(v) {
    const b = G.base;
    if (!b) return;
    const x = v.x0 + 18, y = v.y0 + 104;
    if (!NS.base.claimed() && !b.data.abandoned) {
      kit.text('TAB  command view - found an outpost here', x, y, 12, b.zone.theme.accent, { weight: 'bold' });
      return;
    }
    kit.panel(x - 6, y - 14, 290, 28 + Object.keys(b.alerts).length * 16, { alpha: 0.8, radius: 8, brackets: false });
    let line = 'OUTPOST';
    if (b.active) line += '  -  WAVE ' + b.waveNo + ' ATTACKING';
    else if (!b.data.abandoned && b.next) line += '  -  wave ' + b.next.wave + ' in ' + clock(b.waveT);
    kit.text(line, x, y, 12, b.active ? UI.bad : UI.accent, { weight: 'bold' });
    kit.text('TAB', x + 278, y, 10, UI.textDim, { align: 'right', weight: 'bold' });
    let yy = y + 16;
    for (const k in b.alerts) {
      kit.text(b.alerts[k].text, x, yy, 11, b.alerts[k].color);
      yy += 16;
    }
    boss(v);
  }

  Object.assign(NS.commandHud, {
    MM_W, MM_H, btn, hovered, draw, minimapPoint, pilotWidget, clock
  });
})();
