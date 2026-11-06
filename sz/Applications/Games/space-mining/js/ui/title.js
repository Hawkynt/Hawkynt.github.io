/* The animated title screen: a mining rig drilling a gold-veined asteroid behind the chrome logo
   (beam, sparks, drifting rubble, nuggets streaming into the hold), the mode menu (Career,
   Gold Rush, Daily Belt) plus Tech Tree and How to Play, the pilot record and a preview of the
   highlighted entry. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { MODES } = NS.goals;
  const { ZONES, ORE_BY_ID } = NS.ores;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const RA = NS.rockArt;
  const { ctx } = NS.view;
  const R = NS.rng.fx;

  const drift = [];
  for (let i = 0; i < 9; ++i) drift.push({ x: R() * 1500 - 100, y: 80 + R() * 600, tier: 1 + Math.floor(R() * 2), v: R() * 4 | 0, sp: 12 + R() * 30, rot: R() * TAU, k: 0.6 + R() * 0.9 });
  let emitT = 0, nugT = 0;
  const flying = [];

  function scene() {
    const t = G.time;
    const pal = ZONES[0].theme.rock;
    /* far drifting rubble */
    for (let i = 0; i < drift.length; ++i) {
      const d = drift[i];
      const x = ((d.x - t * d.sp) % 1500 + 1500) % 1500 - 100;
      const b = RA.body(d.tier, d.v, pal);
      ctx.globalAlpha = 0.55;
      K.blitRot(ctx, b, x, d.y, d.rot + t * 0.1, d.k * 0.8);
    }
    ctx.globalAlpha = 1;
    /* the big rock */
    const rx = 1010, ry = 500, rot = t * 0.04, sc = 2.2;
    const b = RA.body(4, 1, pal);
    K.blitRot(ctx, b, rx, ry, rot, sc);
    K.blitRot(ctx, RA.veins(4, 1, 'gold'), rx, ry, rot, sc);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4 + Math.sin(t * 2) * 0.15;
    K.blitRot(ctx, RA.veinGlow(4, 1, 'gold'), rx, ry, rot, sc);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    /* the rig hovering and drilling */
    const sx = 690 + Math.sin(t * 0.7) * 16, sy = 560 + Math.sin(t * 1.1) * 10;
    const hx = rx - 150 + Math.sin(t * 0.9) * 16, hy = ry + 30 + Math.cos(t * 0.8) * 22;
    const a = Math.atan2(hy - sy, hx - sx);
    const st = G.stats;
    ctx.globalCompositeOperation = 'lighter';
    K.blit(ctx, K.glow(st.colors.glow), sx - Math.cos(a) * 30, sy - Math.sin(a) * 30, 0.7);
    const fl = 0.85 + Math.sin(t * 60) * 0.15;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,106,58,0.25)';
    ctx.lineWidth = 16 * fl;
    beam(sx + Math.cos(a) * 30, sy + Math.sin(a) * 30, hx, hy);
    ctx.strokeStyle = 'rgba(255,176,112,0.6)';
    ctx.lineWidth = 6 * fl;
    beam(sx + Math.cos(a) * 30, sy + Math.sin(a) * 30, hx, hy);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    beam(sx + Math.cos(a) * 30, sy + Math.sin(a) * 30, hx, hy);
    K.blit(ctx, K.glow('#ffd090'), hx, hy, 1.4 + Math.sin(t * 40) * 0.15);
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.shipArt.shipSprite(st.hullId, st.colors, Math.sin(t * 0.7) * 0.4), sx, sy, a, 1.5);
    emitT -= 1 / 60;
    if (emitT <= 0) {
      emitT = 0.05;
      NS.fx.sparks(hx, hy, a + Math.PI, 1.8, 2, '#fff09a', 320, 0.35);
      if (R() < 0.3) NS.fx.dust(hx, hy, 1, 18, pal[0], 50);
    }
    /* nuggets arcing into the hold */
    nugT -= 1 / 60;
    if (nugT <= 0) {
      nugT = 0.5 + R() * 0.5;
      flying.push({ x: hx, y: hy, t: 0, ox: (R() - 0.5) * 160, v: Math.floor(R() * 3) });
    }
    for (let i = flying.length - 1; i >= 0; --i) {
      const f = flying[i];
      f.t += 1 / 60;
      const k = Math.min(1, f.t / 1.4);
      const x = hx + (sx - hx) * k + Math.sin(k * Math.PI) * f.ox, y = hy + (sy - hy) * k - Math.sin(k * Math.PI) * 90;
      ctx.globalCompositeOperation = 'lighter';
      K.blit(ctx, K.glow(ORE_BY_ID.gold.color), x, y, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, RA.nugget('gold', f.v), x, y, f.t * 6, 1.2);
      if (k >= 1) flying.splice(i, 1);
    }
    NS.fxRender.draw({ x0: -400, y0: -400, x1: 1700, y1: 1100 });
  }

  function beam(x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function draw() {
    const save = G.save;
    const v = NS.view.visible();
    NS.backdrop.setZone(0);
    const vg = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    vg.addColorStop(0, 'rgba(0,0,8,0.6)');
    vg.addColorStop(0.4, 'rgba(0,0,8,0.05)');
    vg.addColorStop(1, 'rgba(0,0,8,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    scene();

    const lt = Math.min(1, G.screenT * 2);
    ctx.globalAlpha = lt * (0.35 + Math.sin(G.time * 1.6) * 0.1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(K.glow('#d07a2a').canvas, 640 - 480, 104 - 110, 960, 220);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = lt;
    K.blit(ctx, kit.logo(), 640, 104 - (1 - lt) * 30, 0.95);
    kit.text('»SynthelicZ«  Arcade  -  mine, refine, prosper', 640, 172, 16, UI.textDim, { align: 'center' });
    ctx.globalAlpha = 1;

    const items = [];
    if (save.resume && NS.resume.valid(save.resume))
      items.push({ id: 'continue', label: 'Continue', sub: MODES[save.resume.mode].name + ' - ' + ZONES[save.resume.zone].name, icon: 'launch', accent: UI.good, action: () => scr.continueRun() });
    items.push(
      { id: 'career', label: MODES.career.name, sub: save.stats.trips ? 'Continue - ' + kit.group(save.credits) + ' credits' : MODES.career.desc, icon: 'station', accent: MODES.career.color, action: () => scr.career() },
      { id: 'rush', label: MODES.rush.name, sub: MODES.rush.desc, icon: 'clock', accent: MODES.rush.color, action: () => scr.launch('rush', bestZone()) },
      { id: 'daily', label: MODES.daily.name, sub: MODES.daily.desc, icon: 'calendar', accent: MODES.daily.color, action: () => scr.launch('daily', 0) },
      { id: 'siege', label: MODES.siege.name, sub: MODES.siege.desc, icon: 'turret', accent: MODES.siege.color, action: () => scr.launch('siege', siegeZone()) },
      { id: 'tree', label: 'Tech Tree', sub: 'Research with data from the belts', icon: 'tree', accent: UI.data, action: () => scr.openTree('title') },
      { id: 'help', label: 'How to Play', sub: 'Controls, outposts, life in the belts', icon: 'help', action: () => scr.openHelp('title') });
    const bh = items.length > 6 ? 48 : 52, gap = items.length > 6 ? 7 : 9;
    const bw = 340, x = 640 - bw / 2;
    let y = 208;
    let hotItem = items[0];
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      const slide = Math.max(0, 1 - (G.screenT * 3 - i * 0.12));
      ctx.globalAlpha = 1 - slide;
      if (W.button(it.id, it.label, x - slide * 80, y, bw, bh, { action: it.action, sub: it.sub, icon: it.icon, accent: it.accent, px: 19 }))
        hotItem = it;
      ctx.globalAlpha = 1;
      y += bh + gap;
    }
    drawRecord(save, v);
    drawPreview(hotItem, save, v);
    kit.text('Arrows / Mouse to choose  -  Enter to start  -  F2 returns here', 640, v.y1 - 14, 13, UI.textMute, { align: 'center' });
  }

  function bestZone() {
    return Math.max(0, G.save.licenses.length - 1);
  }

  function siegeZone() {
    return Math.max(1, Math.min(4, bestZone()));
  }

  function drawRecord(save, v) {
    const x = Math.max(v.x0 + 24, 40), y = 214, w = 300, h = 292;
    kit.panel(x, y, w, h, { alpha: 0.92 });
    kit.text('PILOT RECORD', x + 20, y + 26, 15, UI.accent, { weight: 'bold' });
    kit.credits(save.credits, x + 20, y + 60, 22);
    kit.amount(save.rd, x + 20, y + 92, 18, 'left', 'rd');
    const st = save.stats;
    const rows = [
      ['Belts licensed', save.licenses.length + ' / 5'], ['Trips flown', kit.group(st.trips)], ['Rocks fractured', kit.group(st.fractures)],
      ['Credits earned', kit.group(st.earned)], ['Achievements', NS.rules.achievementCount(save) + ' / ' + NS.goals.ACHIEVEMENTS.length],
      ['Gold Rush best', kit.group(save.best.rush)], ['Waves repelled', kit.group(st.waves)],
    ];
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], x + 20, y + 130 + i * 22, 13, UI.textDim);
      kit.text(rows[i][1], x + w - 20, y + 130 + i * 22, 13, UI.text, { align: 'right', weight: 'bold' });
    }
    if (save.crownDone) kit.text('The Crown is yours', x + w / 2, y + h - 14, 12, UI.data, { align: 'center', weight: 'bold' });
  }

  function drawPreview(item, save, v) {
    const w = 300, x = Math.min(v.x1 - 24, 1240) - w, y = 214, h = 292;
    kit.panel(x, y, w, h, { alpha: 0.92, accent: item.accent || UI.accent });
    kit.icon(item.icon, x + 34, y + 36, 30, item.accent || UI.accent);
    kit.text(item.label, x + 60, y + 36, 20, '#ffffff', { weight: 'bold' });
    const blurb = {
      career: 'Fly out from Kessler Station, laser asteroids apart and haul the ore home. Sell into a living market, refine bars, fill contracts, buy hulls and drones, build out the station and chart five belts - all the way to the Crown Heart.',
      rush: 'Five minutes in your best licensed belt with your own ship. Every dock sells on the spot. A quarter of the take goes to your career.',
      daily: 'Today\'s belt: the same seed and the same standard rig for every pilot. Four minutes, one score.',
      tree: '32 upgrades in six branches, paid in research data. Open it any time - even from the pause menu mid-trip.',
      help: 'Flight, drilling, the tractor beam, the hold, docking, the market, hazards, every ore, outposts, the command view and life in the belts.',
      siege: 'An outpost in ' + ZONES[siegeZone()].name + ' with a hub, power, a rig, a smelter and three lasers. Build it up, raise a fleet and hold through 15 waves - a mothership comes at 10 and 15. A fifth of the score goes to your career.',
      continue: 'Pick up the trip you were flying exactly where you left it - the ship, the belt, the outpost and the battle.',
    }[item.id];
    kit.wrap(blurb, x + 20, y + 70, w - 40, 14, 20, UI.text);
    if (item.id === 'daily') {
      const today = NS.rng.dayKey();
      const best = save.best.daily.day === today ? save.best.daily.score : 0;
      kit.text('Today ' + today, x + 20, y + h - 46, 13, UI.textDim);
      kit.text('Best: ' + kit.group(best), x + 20, y + h - 22, 15, UI.gold, { weight: 'bold' });
    } else if (item.id === 'rush') {
      kit.text('Belt: ' + ZONES[bestZone()].name, x + 20, y + h - 46, 13, UI.textDim);
      kit.text('Best: ' + kit.group(save.best.rush), x + 20, y + h - 22, 15, UI.gold, { weight: 'bold' });
    } else if (item.id === 'siege') {
      kit.text('Belt: ' + ZONES[siegeZone()].name, x + 20, y + h - 46, 13, UI.textDim);
      kit.text('Best: ' + kit.group(save.best.siege), x + 20, y + h - 22, 15, UI.gold, { weight: 'bold' });
    }
  }

  Object.assign(NS.title, {
    draw
  });
})();
