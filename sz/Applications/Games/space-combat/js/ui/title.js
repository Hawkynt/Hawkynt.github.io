/* The animated title screen: a dogfight flying past behind the chrome logo, the mode menu
   (Campaign, Endless, Daily, Boss Rush) plus Hangar, Tech Tree and Help, the pilot record and
   a preview of the highlighted mode. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { MODES, MISSIONS } = NS.campaign;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  let emitT = 0;

  /* the ambient dogfight: a hero ship weaving, raiders chasing, bolts between them */
  function drawDogfight() {
    const t = G.time;
    const hx = ((t * 160) % 1900) - 300, hy = 640 + Math.sin(t * 1.3) * 34;
    const ha = Math.atan2(Math.cos(t * 1.3) * 34 * 1.3, 160);
    const save = G.save;
    const ship = NS.ships.byId(NS.ships.SHIPS, save.ship) || NS.ships.SHIPS[0];
    const skin = NS.ships.SKINS[save.style.skin];
    const colors = (skin && skin.colors) || ship.colors;
    emitT -= 1 / 60;
    if (emitT <= 0) {
      emitT = 1 / 40;
      NS.fx.exhaust(hx - Math.cos(ha) * 22, hy - Math.sin(ha) * 22, -Math.cos(ha) * 200, -Math.sin(ha) * 200, 8, colors.glow, null);
    }
    for (let i = 0; i < 3; ++i) {
      const lag = 0.9 + i * 0.45;
      const ex = hx - 240 - i * 90, ey = 640 + Math.sin((t - lag) * 1.3) * 34 + (i - 1) * 34;
      const ea = Math.atan2(hy - ey, hx - ex);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      K.blit(ctx, K.glow('#ff6a3a'), ex - Math.cos(ea) * 18, ey - Math.sin(ea) * 18, 0.5);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, NS.enemyArt.enemySprite(i === 1 ? 'interceptor' : 'fighter'), ex, ey, ea, 0.9);
      const phase = (t * 1.6 + i * 0.37) % 1;
      if (phase < 0.45) {
        const bx = ex + Math.cos(ea) * (40 + phase * 500), by = ey + Math.sin(ea) * (40 + phase * 500);
        ctx.globalCompositeOperation = 'lighter';
        K.blitRot(ctx, K.bolt('ered', NS.ships.COLORS.red, 16, 4.5), bx, by, ea, 1);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    K.blit(ctx, K.glow(colors.glow), hx - Math.cos(ha) * 24, hy - Math.sin(ha) * 24, 0.8);
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.shipArt.shipSprite(ship.id, save.style.skin, colors, Math.sin(t * 1.3) * 0.8), hx, hy, ha, 1.3);
    NS.fxRender.draw({ x0: -400, y0: -400, x1: 1700, y1: 1100 });
  }

  function draw() {
    const save = G.save;
    const v = NS.view.visible();
    /* darken behind the menu so it reads over the scenery */
    const vg = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    vg.addColorStop(0, 'rgba(0,0,10,0.55)');
    vg.addColorStop(0.35, 'rgba(0,0,10,0.05)');
    vg.addColorStop(1, 'rgba(0,0,10,0.6)');
    ctx.fillStyle = vg;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    drawDogfight();

    /* logo over a slowly breathing halo */
    const logo = kit.logo();
    const lt = Math.min(1, G.screenT * 2);
    ctx.globalAlpha = lt * (0.35 + Math.sin(G.time * 1.6) * 0.1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(K.glow('#2a7ad0').canvas, 640 - 480, 112 - 110, 960, 220);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = lt;
    K.blit(ctx, logo, 640, 112 - (1 - lt) * 30, 0.95);
    kit.text('»SynthelicZ«  Arcade', 640, 182, 16, UI.textDim, { align: 'center' });
    ctx.globalAlpha = 1;

    /* menu */
    const items = [
      { id: 'campaign', label: MODES.campaign.name, sub: MODES.campaign.desc, icon: 'target', accent: MODES.campaign.color, action: () => { G.ui.mapSector = firstOpenSector(); scr.setScreen('map'); } },
      { id: 'endless', label: MODES.endless.name, sub: MODES.endless.desc, icon: 'infinity', accent: MODES.endless.color, action: () => NS.missions.startRun('endless') },
      { id: 'daily', label: MODES.daily.name, sub: MODES.daily.desc, icon: 'clock', accent: MODES.daily.color, action: () => NS.missions.startRun('daily') },
      { id: 'bossRush', label: MODES.bossRush.name, sub: rules.bossRushUnlocked(save) ? MODES.bossRush.desc : 'Beat the Warden to unlock', icon: 'skull', accent: MODES.bossRush.color, disabled: !rules.bossRushUnlocked(save), action: () => NS.missions.startRun('bossRush') },
      { id: 'hangar', label: 'Hangar', sub: 'Ships and loadouts', icon: 'engine', action: () => scr.openHangar('title') },
      { id: 'tree', label: 'Tech Tree', sub: 'Permanent upgrades', icon: 'radar', action: () => scr.openTree('title') },
      { id: 'help', label: 'How to Play', sub: 'Controls, enemies, hazards', icon: 'star', action: () => scr.openHelp('title') },
    ];
    const bw = 340, bh = 48, gap = 8, x = 640 - bw / 2;
    let y = 222;
    let hotItem = items[0];
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      const slide = Math.max(0, 1 - (G.screenT * 3 - i * 0.12));
      ctx.globalAlpha = 1 - slide;
      if (W.button(it.id, it.label, x - slide * 80, y, bw, bh, { action: it.action, disabled: it.disabled, sub: it.sub, icon: it.icon, accent: it.accent, px: 18 }))
        hotItem = it;
      ctx.globalAlpha = 1;
      y += bh + gap;
    }

    drawRecord(save);
    drawPreview(hotItem, save);
    kit.text('Arrows / Mouse to choose  -  Enter to start  -  F2 returns here', 640, 708, 13, UI.textMute, { align: 'center' });
  }

  function firstOpenSector() {
    let s = 0;
    for (let i = 0; i < MISSIONS.length; ++i)
      if (rules.sectorUnlocked(G.save, i)) s = i;
    return s;
  }

  function drawRecord(save) {
    const x = 60, y = 236, w = 330, h = 300;
    kit.panel(x, y, w, h, { accent: UI.accent });
    kit.text('PILOT RECORD', x + 20, y + 26, 15, UI.accent, { weight: 'bold' });
    kit.credits(save.credits, x + 20, y + 62, 24);
    const rows = [
      ['Campaign stars', rules.totalStars(save) + ' / 90'],
      ['Missions flown', String(save.stats.missions)],
      ['Endless best', save.best.endless.score + '  (wave ' + save.best.endless.wave + ')'],
      ['Boss rush', save.best.bossRush.cleared + ' / 5 bosses'],
      ['Daily today', save.best.daily.date === NS.rng.dayKey() ? String(save.best.daily.score) : 'not flown'],
      ['Enemies destroyed', String(save.stats.kills)],
      ['Bosses destroyed', String(save.stats.bosses)],
    ];
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 104 + i * 26;
      kit.text(rows[i][0], x + 20, ry, 14, UI.textDim);
      kit.text(rows[i][1], x + w - 20, ry, 14, UI.text, { align: 'right', weight: 'bold' });
    }
  }

  function drawPreview(item, save) {
    const x = 890, y = 236, w = 330, h = 300;
    const accent = item.accent || UI.accent;
    kit.panel(x, y, w, h, { accent: accent });
    kit.icon(item.icon, x + 40, y + 40, 30, accent);
    kit.fitText(item.label, x + 70, y + 40, w - 90, 22, { weight: 'bold', color: '#ffffff' });
    const desc = {
      campaign: 'Fly five sectors from the Kepler belt to the Void Citadel. Each sector has six missions - survival, assaults, escorts, defenses, salvage - and ends with a boss. Earn up to three stars per mission.',
      endless: 'Wave after wave, harder every time, with a boss on every fifth wave and a new sector every five. How long can you last?',
      daily: 'Today\'s seeded gauntlet: four missions and a boss under one mutator, the same for every pilot. One score per day.',
      bossRush: 'Fight all five bosses back to back. Your hull carries over between fights, half repaired.',
      hangar: 'Buy new ships, each with its own special ability, and choose your primary and secondary weapons.',
      tree: 'Spend scrap on permanent upgrades across five branches: Weapons, Defense, Engines, Systems and Style.',
      help: 'Controls, every enemy and hazard, power-ups and how progression works.',
    }[item.id];
    kit.wrap(desc, x + 22, y + 80, w - 44, 15, 22, UI.text);
    if (item.id === 'daily') {
      const plan = NS.waves.dailyPlan(NS.rng.dayKey());
      const mut = NS.waves.MUTATORS[plan.mutator];
      kit.text('Mutator: ' + mut.name, x + 22, y + h - 56, 15, UI.gold, { weight: 'bold' });
      kit.text(mut.desc, x + 22, y + h - 32, 13, UI.textDim);
    } else if (item.id === 'endless')
      kit.text('Best wave ' + save.best.endless.wave, x + 22, y + h - 32, 15, UI.good, { weight: 'bold' });
    /* a slow orbit of stars as decoration */
    for (let i = 0; i < 5; ++i) {
      const a = G.time * 0.6 + i * TAU / 5;
      ctx.globalAlpha = 0.3;
      kit.star(x + w - 40 + Math.cos(a) * 14, y + 40 + Math.sin(a) * 14, 4, true);
    }
    ctx.globalAlpha = 1;
  }

  Object.assign(NS.title, {
    draw
  });
})();
