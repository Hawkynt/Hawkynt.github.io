;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The title screen: logo, the hero bird with its friends flying around, the main menu
     (Continue when a run is saved, Story, modes, Classic, Nest, Wardrobe, Goals, Help) and
     the "today" panel with the seasonal event, its track, the day streak, the daily twist
     and the three daily quests. Reads G.save and the saved run. */

  const { CANVAS_W, BIRD_DEFS } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Shapes = NS.shapes;
  const Menu = NS.menu;
  const Nav = NS.nav;
  const Goals = NS.goals;
  const S = SZ.FlappySeasons;

  let runCache = { at: -1, snap: null };

  /* the saved run, read from storage at most twice a second */
  function savedRun() {
    if (G.globalTime - runCache.at > 0.5 || runCache.at < 0) {
      runCache = { at: G.globalTime, snap: NS.save.readRun() };
    }
    return runCache.snap;
  }

  function drawHeroes(t) {
    const others = BIRD_DEFS.filter(d => Prog.owns('birds', d.id) && d.id !== Prog.currentBird()).map(d => d.id);
    while (others.length < 2)
      others.push(others.length === 0 ? 'ruby' : 'jay');
    for (let i = 0; i < 2; ++i) {
      const x = 170 + i * 120 + Math.sin(t * (0.5 + i * 0.17) + i) * 90;
      const y = 470 + i * 70 + Math.sin(t * 1.5 + i * 2) * 50;
      SZ.FlappyBirdArt.drawBird(ctx, { x: x, y: y, angle: 0.1 * Math.sin(t * 2 + i), birdId: others[i], frame: t * 9, scale: 1.4 });
    }
    const hx = 240 + 70 * Math.sin(t), hy = 330 + 60 * Math.sin(2 * t);
    const ang = 0.2 * Math.cos(2 * t);
    const stretch = 1 + 0.06 * Math.sin(t * 10);
    SZ.FlappyBirdArt.drawBird(ctx, { x: hx, y: hy, angle: ang, birdId: Prog.currentBird(), frame: t * 10, scale: 3, sx: 2 - stretch, sy: stretch });
    const hat = Prog.currentHat();
    if (hat !== 'none')
      SZ.FlappyCosmeticArt.drawHat(ctx, { x: hx, y: hy, angle: ang, hatId: hat, scale: 3, sx: 2 - stretch, sy: stretch });
    if (Math.random() < 0.3)
      NS.services.particles.trail(hx - 50, hy + 8, { color: '#fff6c0', size: 3, life: 0.6, vx: -2, shape: 'star' });
  }

  function drawTodayPanel() {
    const x = 900, y = 214, w = 356;
    const ev = G.season.event;
    const s = G.save.season;
    // season event card
    ui.drawPanel(x, y, w, 150, { title: ev.name, titlePx: 18, accent: ev.accent, titleRight: G.season.daysLeft + ' days left' });
    ctx.save();
    ctx.translate(x + 40, y + 70);
    SZ.FlappySeasonArt.drawToken(ctx, ev.id, 0, 0, G.globalTime);
    ctx.restore();
    const tier = S.trackTier(s.tokens);
    const next = S.TRACK[Math.min(tier, S.TRACK.length - 1)];
    const prevNeed = tier > 0 ? S.TRACK[tier - 1].need : 0;
    const ratio = tier >= S.TRACK.length ? 1 : (s.tokens - prevNeed) / (next.need - prevNeed);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(s.tokens + ' ' + ev.token + (s.tokens === 1 ? '' : 's'), x + 72, y + 56, w - 90, 18, { weight: 'bold', color: ev.tokenColor });
    ui.drawMeter(x + 72, y + 74, w - 92, 12, ratio, ev.accent);
    let reward;
    if (tier >= S.TRACK.length)
      reward = 'Track complete - Season Champion!';
    else if (next.reward)
      reward = 'Next: ' + Prog.itemName(next.reward === 'bird' ? 'birds' : next.reward + 's', ev.rewards[next.reward]) + ' at ' + next.need;
    else
      reward = 'Next: +' + next.coins + ' coins at ' + next.need;
    ui.fitText(reward, x + 72, y + 100, w - 90, 14, { color: ui.UI.textDim });
    ui.drawTextBlock(ev.blurb, x + 16, y + 112, w - 32, 34, 13, { color: ui.UI.textMute });

    // daily quests and streak
    const qy = y + 162;
    const quests = Goals.questList();
    ui.drawPanel(x, qy, w, 186, { title: 'Today', titlePx: 18, titleRight: 'Streak ' + G.save.streak.count + ' day' + (G.save.streak.count === 1 ? '' : 's') });
    ctx.textAlign = 'left';
    ui.fitText('Daily twist: ' + G.twist.name, x + 16, qy + 46, w - 32, 15, { weight: 'bold', color: '#ff9a3a' });
    for (let i = 0; i < quests.length; ++i) {
      const q = quests[i];
      const done = G.save.daily.claimed[i];
      const ly = qy + 76 + i * 34;
      ui.roundRectPath(x + 16, ly - 10, 20, 20, 5);
      ctx.fillStyle = done ? ui.UI.good : 'rgba(255,255,255,0.08)';
      ctx.fill();
      if (done) {
        ctx.strokeStyle = '#0a2a12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 20, ly);
        ctx.lineTo(x + 25, ly + 5);
        ctx.lineTo(x + 32, ly - 5);
        ctx.stroke();
      }
      ctx.textAlign = 'left';
      ui.fitText(q.text, x + 46, ly - 4, w - 140, 14, { color: done ? ui.UI.textDim : ui.UI.text });
      ui.drawMeter(x + 46, ly + 8, w - 140, 5, Goals.questProgress(q) / q.need, done ? ui.UI.good : ui.UI.accent);
      ctx.textAlign = 'right';
      ui.fitText('+' + q.reward, x + w - 16, ly, 70, 14, { weight: 'bold', color: ui.UI.gold });
    }
  }

  function drawTitleScreen() {
    const t = G.globalTime;
    drawHeroes(t);
    const bob = Math.sin(t * 2) * 4;
    ui.drawHeadline('FLAPPY BIRD', 640, 92 + bob, 900, 92, '#ffd23f', '#ff8a1e');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('and the Season Feathers', 640, 156, 600, 26, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.6)' });

    const bx = 640 - 175, bw = 350, bh = 48, step = 54;
    let y = 196;
    const snap = savedRun();
    if (snap) {
      Menu.drawButton('t-continue', 'Continue', bx, y, bw, bh, { sub: NS.autosave.describe(snap), accent: '#6fe08a', action: Nav.continueRun });
      y += step;
    }
    const next = SZ.FlappyCourse.STAGES[Prog.storyNext()];
    Menu.drawButton('t-story', 'Story', bx, y, bw, bh, {
      sub: Prog.totalStars() + ' / 72 stars  -  ' + NS.C.CHAPTERS[next.world].name, action: Nav.goWorlds
    });
    y += step;
    Menu.drawButton('t-modes', 'Arcade, Zen & more', bx, y, bw, bh, { sub: 'Arcade, Zen, Time Attack, Daily, Boss Rush', action: Nav.goModes });
    y += step;
    Menu.drawButton('t-classic', 'Classic', bx, y, bw, bh, { sub: 'Best ' + G.save.best.classic, action: () => Nav.startMode('classic') });
    y += step;
    Menu.drawButton('t-nest', 'Nest - Tech Tree', bx, y, bw, bh, { sub: Prog.treeComplete() + ' / ' + NS.C.TREE.length + ' upgrades maxed', action: Nav.goNest });
    y += step;
    Menu.drawButton('t-wardrobe', 'Wardrobe', bx, y, bw, bh, { sub: Prog.wardrobeCount() + ' / ' + Prog.wardrobeTotal() + ' birds, hats & trails', action: Nav.goAviary });
    y += step;
    Menu.drawButton('t-goals', 'Goals & Stats', bx, y, bw, bh, { sub: Goals.achievementCount() + ' / ' + NS.C.ACHIEVEMENTS.length + ' achievements', action: () => Nav.goGoals(0) });
    y += step;
    if (!snap)
      Menu.drawButton('t-help', 'Help', bx, y, bw, bh, { action: Nav.goHelp });

    drawTodayPanel();
    Shapes.drawCoinChip(G.save.coins, CANVAS_W - 24, 20);
    if (G.save.streak.count > 1)
      ui.drawChip('Day streak ' + G.save.streak.count, 24, 20, 30, { align: 'left', color: '#ff9a3a', bg: 'rgba(0,0,0,0.45)' });
    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'H', label: 'Help' }
    ], 640, 700, 420, 1.1);
  }

  Object.assign(NS.title, { savedRun, drawTitleScreen, drawTodayPanel });
})();
