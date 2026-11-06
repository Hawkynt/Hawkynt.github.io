/* The title screen: the kitchen with the highest era's treat turning on its glow and cookies
   tumbling past, the »SZ« Cookie Clicker logo, Continue (or Start Baking, or Continue
   Bake-Off), the Bake-Off, the Daily Bake-Off with today's modifier, the Zen Kitchen, the
   tech tree, collection, journal and how-to-play, plus the season and streak banner. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI, VIEW_W, TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const fmt = NS.format;
  const { STAGES } = NS.treatData;
  const { ctx } = NS.view;

  let logoFill = null;
  const tumble = [];
  for (let i = 0; i < 14; ++i) tumble.push({ x: Math.random() * VIEW_W, y: Math.random() * 720, v: 40 + Math.random() * 60, r: Math.random() * TAU, s: 0.5 + Math.random() * 0.6 });

  function startGame() {
    NS.screens.setScreen('game');
    if (!G.profile.seenIntro) NS.cinematics.play('intro');
  }

  function update(dt) {
    for (let i = 0; i < tumble.length; ++i) {
      const c = tumble[i];
      c.y += c.v * dt;
      c.r += dt * (i % 2 ? 1 : -1);
      if (c.y > 760) { c.y = -40; c.x = Math.random() * VIEW_W; }
    }
  }

  function draw() {
    const p = G.profile;
    const img = NS.hud.goldenSprite('golden');
    const drop = NS.hud.dropSprite();
    for (let i = 0; i < tumble.length; ++i) {
      const c = tumble[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.scale(c.s, c.s);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(i === 3 ? img : drop, i === 3 ? -42 : -22, i === 3 ? -42 : -22);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const stage = Math.max(p.stageMax, G.run ? G.run.stage : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    K.blit(ctx, K.glow(NS.treatArt.glowColor(stage)), 360, 420, 5);
    ctx.restore();
    NS.hud.drawTreat({ stage: stage, x: 360, y: 430, scale: 1.12, mask: G.stMain ? G.stMain.decoMask : 0, noHover: true });
    /* logo */
    kit.text('»SZ«', 360, 58, 22, UI.gold, { align: 'center', weight: 'bold', shadow: true });
    const wob = Math.sin(G.time * 2) * 0.02;
    ctx.save();
    ctx.translate(360, 112);
    ctx.rotate(wob);
    if (!logoFill) {
      logoFill = ctx.createLinearGradient(0, -30, 0, 30);
      logoFill.addColorStop(0, '#fff8e0');
      logoFill.addColorStop(0.5, '#ffd27a');
      logoFill.addColorStop(1, '#e8902a');
    }
    ctx.lineJoin = 'round';
    ctx.font = kit.font(62, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#4a2008';
    ctx.lineWidth = 10;
    ctx.strokeText('COOKIE CLICKER', 0, 4);
    kit.text('COOKIE CLICKER', 0, 0, 62, logoFill, { align: 'center', weight: 'bold' });
    ctx.restore();
    kit.text('From one plain cookie to a bakery planet', 360, 160, 18, UI.textDim, { align: 'center', shadow: true });
    menu();
    banner();
  }

  function menu() {
    const p = G.profile;
    const x = 760, w = 400;
    let y = 120;
    const h = 52, gap = 10;
    if (G.bake) {
      W.button('t-cont-bake', 'Continue Bake-Off', x, y, w, h, { icon: 'clock', sub: fmt.clock(G.bake.timeLeft) + ' left - ' + fmt.short(G.bake.baked) + ' baked', action: () => NS.screens.setScreen('game') });
      y += h + gap;
    }
    const fresh = !G.run || (G.run.baked < 1 && p.allTime < 1);
    W.button('t-cont', fresh ? 'Start Baking' : 'Continue', x, y, w, h + 8, {
      icon: 'play', px: 22, accent: UI.gold,
      sub: fresh ? 'Grandma Rosa hands you the keys' : fmt.short(G.run.cookies) + ' treats - ' + STAGES[G.run.stage].name + ' - Era ' + NS.cinematics.ROMAN[G.run.stage],
      action: () => {
        if (G.bake) NS.modes.quitBake();
        startGame();
      },
    });
    y += h + 8 + gap;
    const half = (w - 10) / 2;
    W.button('t-bake', 'Bake-Off', x, y, half, h, { icon: 'clock', sub: 'best ' + fmt.short(p.stats.bakeBest), action: () => NS.modes.startBake(false) });
    const dBest = p.dailyBest[G.today];
    const mod = G.modifier;
    W.button('t-daily', 'Daily Bake-Off', x + half + 10, y, half, h, { icon: 'calendar', accent: UI.good, sub: dBest ? 'today ' + fmt.short(dBest) : mod.name, action: () => NS.modes.startBake(true) });
    y += h + gap;
    W.button('t-zen', 'Zen Kitchen', x, y, half, h, { icon: 'leaf', sub: 'no clock, no numbers', action: () => NS.modes.enterZen() });
    W.button('t-tree', 'Tech Tree', x + half + 10, y, half, h, { icon: 'tree', sub: p.notes + ' notes', accent: UI.notes, action: () => NS.screens.openTree('title') });
    y += h + gap;
    W.button('t-coll', 'Collection', x, y, half, h, { icon: 'palette', sub: 'skins and themes', action: () => NS.screens.openCollection('title') });
    W.button('t-journal', 'Journal', x + half + 10, y, half, h, { icon: 'trophy', sub: NS.economy.achievementCount(p) + ' achievements', action: () => NS.screens.openJournal('title') });
    y += h + gap;
    W.button('t-help', 'How to Play', x, y, w, 40, { icon: 'note', px: 16, action: () => NS.screens.openHelp('title') });
    if (G.menuCursor < 0) G.menuCursor = G.bake ? 0 : 0;
  }

  function banner() {
    const p = G.profile;
    const se = G.season;
    const x = 760, y = 588, w = 400;
    kit.panel(x, y, w, 64, { radius: 12, accent: '#ff9ac8' });
    kit.icon('leaf', x + 24, y + 22, 20, '#ff9ac8');
    kit.text(NS.calendar.SEASON_NAMES[se] + ' event', x + 44, y + 22, 15, '#ffffff', { weight: 'bold' });
    kit.text('Catch ' + NS.eventData.CARRIERS[se].names + ' for ' + NS.eventData.CARRIERS[se].token + ': ' + fmt.short(p.season.tokens[se] || 0), x + 44, y + 44, 13, UI.textDim);
    const streak = p.streak.last === G.today ? p.streak.count : 0;
    kit.text('Day ' + Math.max(1, streak) + ' streak', x + w - 14, y + 22, 14, UI.good, { align: 'right', weight: 'bold' });
    kit.text('a »SynthelicZ« desktop game', 360, 690, 13, 'rgba(255,240,220,0.5)', { align: 'center' });
  }

  Object.assign(NS.title, { startGame, update, draw });
})();
