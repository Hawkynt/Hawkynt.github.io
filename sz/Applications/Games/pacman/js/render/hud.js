/* The in-game HUD around the maze: the left panel (mode and stage, rolling score, best, the
   multiplier dial with its chain, lives, maze progress), the right panel (active power-ups and
   fright timers, today's quests, the season's tokens, shards earned), the boss health banner,
   READY / CLEAR call-outs and power-up banners; plus the screen-wide flash, maze wipe, toasts and
   achievement pop-ups drawn over every screen. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { UI, MAZE_X, MAZE_Y, MAZE_W, MAZE_H, TAU, MULT_STEPS } = C;
  const { WORLDS, BOSSES } = NS.worlds;
  const { POWERUP_BY_ID } = NS.items;
  const K = NS.artKit;
  const kit = NS.kit;
  const R = NS.rules;
  const { ctx } = NS.view;

  const LX = 22, LW = MAZE_X - 44, RX = MAZE_X + MAZE_W + 22, RW = 1280 - RX - 22;
  let shownScore = 0;

  function modeLine(run) {
    const lvl = run.lvl;
    switch (run.mode) {
      case 'story': return { a: 'STORY', b: WORLDS[run.world].name, c: run.stage === 4 ? 'Boss' : 'Maze ' + (run.world + 1) + '-' + (run.stage + 1) };
      case 'arcade': return { a: 'ARCADE', b: WORLDS[lvl.world].name, c: 'Maze ' + (run.n + 1) };
      case 'zen': return { a: 'ZEN', b: WORLDS[lvl.world].name, c: 'Maze ' + (run.n + 1) };
      case 'daily': return { a: 'DAILY MAZE', b: run.dayKey, c: 'Maze ' + (run.n + 1) + ' / 3' };
      default: return { a: 'BOSS RUSH', b: BOSSES[lvl.bossId].name, c: 'Boss ' + (run.n + 1) + ' / 5' };
    }
  }

  function left(run) {
    const lvl = run.lvl;
    const th = NS.world.theme();
    kit.panel(LX, MAZE_Y, LW, MAZE_H, { accent: th.rim, alpha: 0.92 });
    const m = modeLine(run);
    kit.chip(m.a, LX + 18, MAZE_Y + 28, th.accent, 13);
    kit.fitText(m.b, LX + 18, MAZE_Y + 58, LW - 36, 20, { weight: 'bold', color: '#ffffff' });
    kit.text(m.c, LX + 18, MAZE_Y + 82, 14, UI.textDim);
    /* score rolls toward the real value */
    shownScore += (run.score - shownScore) * 0.25;
    if (Math.abs(run.score - shownScore) < 1) shownScore = run.score;
    kit.text('SCORE', LX + 18, MAZE_Y + 122, 12, UI.textMute, { weight: 'bold' });
    kit.fitText(kit.group(Math.round(shownScore)), LX + 18, MAZE_Y + 152, LW - 36, 36, { weight: 'bold', color: UI.accent });
    const best = run.mode === 'story' ? (G.profile.story.best[run.world + '-' + run.stage] || 0) : (G.profile.best[run.mode] || 0);
    kit.text('BEST  ' + kit.group(Math.max(best, run.score)), LX + 18, MAZE_Y + 182, 13, UI.textDim);
    /* multiplier dial */
    const cx = LX + 70, cy = MAZE_Y + 268, r = 42;
    const mult = run.mult || 1;
    const cap = G.stats.multCap;
    const lo = MULT_STEPS[Math.min(mult - 1, MULT_STEPS.length - 1)], hi = MULT_STEPS[Math.min(mult, MULT_STEPS.length - 1)];
    const frac = mult >= cap ? 1 : Math.max(0, Math.min(1, (run.multPts - lo) / Math.max(1, hi - lo)));
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    const col = mult >= 6 ? '#ff4ad8' : mult >= 4 ? '#ff9a2a' : mult >= 2 ? UI.accent : UI.accent2;
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac); ctx.stroke();
    ctx.lineCap = 'butt';
    const pulse = 1 + (run.chainT > 0 ? Math.sin(G.time * 14) * 0.04 : 0);
    kit.text('x' + mult, cx, cy + 1, 34 * pulse, col, { align: 'center', weight: 'bold' });
    kit.text('MULTIPLIER', cx + r + 16, cy - 14, 11, UI.textMute, { weight: 'bold' });
    kit.text(run.chain > 1 ? run.chain + ' chain' : 'chain dots', cx + r + 16, cy + 6, 15, run.chain > 1 ? UI.accent2 : UI.textDim, { weight: 'bold' });
    kit.text('cap x' + cap, cx + r + 16, cy + 26, 11, UI.textMute);
    /* lives */
    const ly = MAZE_Y + 360;
    if (run.mode === 'zen') {
      kit.text('NO GAME OVER', LX + 18, ly, 13, UI.good, { weight: 'bold' });
      kit.text('Zen time ' + kit.time(run.playTime), LX + 18, ly + 24, 13, UI.textDim);
    } else {
      kit.text('LIVES', LX + 18, ly, 12, UI.textMute, { weight: 'bold' });
      const skin = G.profile.skin;
      const n = Math.min(run.lives, 8);
      for (let i = 0; i < n; ++i) K.blit(ctx, NS.actorArt.pac(skin, 3), LX + 30 + i * 30, ly + 28, 0.5);
      if (run.lives > 8) kit.text('+' + (run.lives - 8), LX + 30 + 8 * 30, ly + 28, 14, UI.text);
    }
    /* progress */
    const py = MAZE_Y + 440;
    if (lvl.kind === 'maze') {
      kit.text('DOTS', LX + 18, py, 12, UI.textMute, { weight: 'bold' });
      kit.text(Math.max(0, lvl.dotsLeft) + ' left', LX + LW - 18, py, 12, UI.textDim, { align: 'right' });
      kit.bar(LX + 18, py + 14, LW - 36, 10, 1 - Math.max(0, lvl.dotsLeft) / Math.max(1, lvl.dotsTotal), th.rim);
    }
    if (lvl.gobbled > 0) kit.text('Gobbled: ' + lvl.gobbled + ' dots', LX + 18, py + 44, 12, '#7aff5a');
    /* tips at the bottom */
    const tip = lvl.features.indexOf('pads') >= 0 ? 'Arrow pads fling you along' : lvl.features.indexOf('ice') >= 0 ? 'No turning back on ice' :
      lvl.features.indexOf('vents') >= 0 ? 'Vents glow red before they erupt' : lvl.dark ? 'Stay near your own light' :
        lvl.kind === 'boss' ? 'Bite the boss while powered up' : 'Power pellets turn the tables';
    kit.wrap(tip, LX + 18, MAZE_Y + MAZE_H - 92, LW - 36, 13, 17, UI.textDim);
    kit.text('Esc pause  -  T tech tree', LX + 18, MAZE_Y + MAZE_H - 30, 11, UI.textMute);
  }

  function right(run) {
    const lvl = run.lvl;
    const th = NS.world.theme();
    kit.panel(RX, MAZE_Y, RW, MAZE_H, { accent: th.rim, alpha: 0.92 });
    let y = MAZE_Y + 28;
    kit.text('POWER-UPS', RX + 18, y, 12, UI.textMute, { weight: 'bold' });
    y += 26;
    if (lvl.frightT > 0) {
      kit.icon('ghost', RX + 34, y + 4, 22, '#4a6aff');
      kit.text('Fright', RX + 54, y - 3, 13, '#9ab0ff', { weight: 'bold' });
      kit.bar(RX + 54, y + 9, RW - 74, 6, lvl.frightT / Math.max(0.1, lvl.frightMax), '#4a6aff');
      y += 36;
    }
    const act = NS.powerups.active(lvl);
    for (let i = 0; i < act.length && i < 6; ++i) {
      const a = act[i], d = POWERUP_BY_ID[a.id];
      K.blit(ctx, NS.itemArt.capsule(a.id, d.color), RX + 34, y + 4, 0.6);
      kit.text(d.name, RX + 54, y - 3, 13, d.color, { weight: 'bold' });
      kit.bar(RX + 54, y + 9, RW - 74, 6, a.t / Math.max(0.1, a.max), d.color);
      y += 36;
    }
    if (!act.length && lvl.frightT <= 0) {
      kit.text('Grab capsules in the maze', RX + 18, y, 13, UI.textDim);
      y += 24;
    }
    /* quests */
    y = Math.max(y + 10, MAZE_Y + 270);
    kit.text("TODAY'S QUESTS", RX + 18, y, 12, UI.textMute, { weight: 'bold' });
    y += 22;
    const p = G.profile;
    for (let i = 0; i < p.quests.list.length; ++i) {
      const q = p.quests.list[i];
      const prog = R.questProgress(p, q);
      kit.fitText((q.done ? '✓ ' : '') + R.questText(q), RX + 18, y, RW - 36, 13, { color: q.done ? UI.good : UI.text });
      kit.bar(RX + 18, y + 11, RW - 36, 4, prog, q.done ? UI.good : UI.accent2);
      y += 32;
    }
    /* season */
    y += 6;
    const s = G.season;
    if (s) {
      K.blit(ctx, NS.itemArt.token(s.token), RX + 32, y + 8, 0.7);
      kit.fitText(s.name, RX + 56, y, RW - 74, 14, { weight: 'bold', color: s.color });
      const tier = NS.seasons.tierOf(p.season.tokens);
      const track = NS.cosmetics.SEASON_TRACK;
      const next = track[Math.min(tier, track.length - 1)];
      kit.text(p.season.tokens + (tier < track.length ? ' / ' + next : ' - complete!'), RX + 56, y + 18, 12, UI.textDim);
      kit.bar(RX + 18, y + 34, RW - 36, 6, tier >= track.length ? 1 : p.season.tokens / next, s.color, { cells: 5 });
      y += 56;
    }
    kit.text('SHARDS THIS RUN', RX + 18, MAZE_Y + MAZE_H - 56, 12, UI.textMute, { weight: 'bold' });
    kit.shards(run.shards + Math.floor((run.score - run.paid) / (run.mode === 'zen' ? 260 : 200) * G.stats.shardBonus), RX + 18, MAZE_Y + MAZE_H - 30, 20);
  }

  function bossBar(lvl) {
    const b = lvl.boss;
    if (!b) return;
    const d = BOSSES[b.id];
    const w = MAZE_W - 80, x = MAZE_X + 40, y = MAZE_Y + 10;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    kit.roundRect(x - 10, y - 4, w + 20, 34, 8);
    ctx.fill();
    kit.text(d.name.toUpperCase(), x, y + 7, 13, d.color, { weight: 'bold' });
    if (b.enraged) kit.text('ENRAGED', x + w, y + 7, 12, '#ff3b3b', { weight: 'bold', align: 'right' });
    kit.bar(x, y + 17, w, 8, b.hp / b.maxHp, b.enraged ? '#ff3b3b' : d.color, { cells: Math.round(b.maxHp) });
  }

  function callouts(run) {
    const lvl = run.lvl;
    const cx = MAZE_X + MAZE_W / 2, cy = MAZE_Y + 17.5 * C.TILE;
    if (lvl.phase === 'ready') {
      const k = NS.rng.easeBack(Math.min(1, lvl.phaseT * 3));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      kit.text('READY!', 0, 0, 30, '#ffe23a', { align: 'center', weight: 'bold' });
      ctx.restore();
    } else if (lvl.phase === 'clear') {
      const k = NS.rng.easeBack(Math.min(1, lvl.phaseT * 2.5));
      ctx.save();
      ctx.translate(cx, MAZE_Y + MAZE_H / 2);
      ctx.scale(k, k);
      kit.panel(-170, -46, 340, 92, { accent: UI.accent, glow: true });
      kit.text(lvl.kind === 'boss' ? 'BOSS DEFEATED!' : 'MAZE CLEAR!', 0, -12, 30, UI.accent, { align: 'center', weight: 'bold' });
      kit.text(lvl.perfect ? 'Perfect - no lives lost' : 'Score ' + kit.group(run.score), 0, 22, 15, UI.text, { align: 'center' });
      ctx.restore();
    }
    const banners = G.ui.banners;
    for (let i = 0; i < banners.length; ++i) {
      const b = banners[i];
      const a = Math.min(1, b.t * 5, (2.2 - b.t) * 3);
      const k = NS.rng.easeBack(Math.min(1, b.t * 4));
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(cx, MAZE_Y + 70 + i * 62);
      ctx.scale(k, k);
      kit.panel(-150, -24, 300, 50, { accent: b.color, glow: true, radius: 25 });
      K.blit(ctx, NS.itemArt.capsule(b.icon, b.color), -122, 1, 0.75);
      kit.text(b.text, 12, -7, 18, b.color, { align: 'center', weight: 'bold' });
      kit.text(b.sub, 12, 12, 12, UI.text, { align: 'center' });
      ctx.restore();
    }
  }

  function draw() {
    const run = G.run;
    if (!run || !run.lvl || run.demo) return;
    left(run);
    right(run);
    bossBar(run.lvl);
    callouts(run);
    if (G.input.touch) NS.touch.draw();
  }

  /* ── overlays on every screen ── */
  function drawFlash() {
    const ui = G.ui;
    const r = NS.view.visible();
    if (ui.flash > 0) {
      ctx.globalAlpha = Math.min(0.8, ui.flash);
      ctx.fillStyle = ui.flashColor;
      ctx.fillRect(r.x0, r.y0, r.w, r.h);
      ctx.globalAlpha = 1;
    }
    if (ui.wipe > 0) {
      /* an iris that opens from the maze centre */
      const k = 1 - ui.wipe;
      const rad = k * 900;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x0, r.y0, r.w, r.h);
      ctx.arc(MAZE_X + MAZE_W / 2, MAZE_Y + MAZE_H / 2, Math.max(1, rad), 0, TAU, true);
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawToast() {
    const ui = G.ui;
    if (ui.toast) {
      const t = ui.toast;
      const a = Math.min(1, t.t * 5, (3 - t.t) * 3);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = kit.font(16, 'bold');
      const w = Math.min(760, ctx.measureText(t.text).width + 60);
      const y = 676 - (1 - Math.min(1, t.t * 5)) * 20;
      kit.panel(640 - w / 2, y - 22, w, 44, { accent: t.color, glow: true, radius: 22 });
      kit.fitText(t.text, 640, y, w - 30, 16, { color: t.color, align: 'center', weight: 'bold' });
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < ui.popups.length; ++i) {
      const p = ui.popups[i];
      const slide = Math.min(1, p.t * 4, (4 - p.t) * 3);
      const x = 1258 - 330 * Math.max(0, slide), y = 30 + i * 86;
      kit.panel(x, y, 320, 76, { accent: UI.gold, glow: true });
      kit.icon('trophy', x + 38, y + 38, 34, UI.gold);
      kit.text('ACHIEVEMENT', x + 70, y + 18, 11, UI.gold, { weight: 'bold' });
      kit.fitText(p.name, x + 70, y + 38, 236, 18, { weight: 'bold', color: '#ffffff' });
      kit.fitText(p.desc + '  +' + p.reward + ' shards', x + 70, y + 58, 236, 12, { color: UI.textDim });
    }
  }

  Object.assign(NS.hud, {
    draw, drawFlash, drawToast, LX, LW, RX, RW
  });
})();
