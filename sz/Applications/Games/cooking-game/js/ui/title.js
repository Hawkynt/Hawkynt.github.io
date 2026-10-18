;(function() {
  'use strict';

  /* The title screen: logo, the chef with orbiting dishes, strolling
     guests and the mode buttons. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, STATE_TITLE, STATE_CAREER, STATE_UPGRADES, STATE_RECIPES } = NS.C;
  const { TREE } = NS.Tree;
  const { ctx, ui } = NS.view;
  const { fx } = NS.juice;
  const { countStars, countTreeMaxed } = NS.persist;
  const { dateKey } = NS.rules;
  const { startDay } = NS.day;
  const { drawRibbon } = NS.sprites;
  const { setScreen, openHelp, drawButton, drawMenuBackdrop, drawCoinChip } = NS.menu;

  function drawTitleScreen() {
    drawMenuBackdrop('bistro', 0.42);
    /* warm rays behind the logo, slowly turning */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.translate(640, 120);
    ctx.rotate(G.animT * 0.08);
    ui.drawGlow(0, 0, 900, '#ffb050', 18);
    ctx.restore();
    const breathe = 1 + Math.sin(G.animT * 2) * 0.02;
    ctx.save();
    ctx.translate(640, 112);
    ctx.scale(breathe, breathe);
    ctx.rotate(Math.sin(G.animT * 1.3) * 0.01);
    ui.drawHeadline('BISTRO RUSH', 0, 0, 1000, 104, '#ffd23f', '#ff6a1a');
    ctx.restore();
    drawRibbon(640, 196, 520, 44, 'Cook · Serve · Build your restaurant empire', '#c8302a');
    if (Math.random() < 0.08) fx.emit('star', 640 + (Math.random() - 0.5) * 760, 112 + (Math.random() - 0.5) * 100, 1, { color: '#fff0a0', speed: 30, gravity: -10 });

    /* the chef cheering on the left, dishes orbiting around him */
    SZ.PeopleArt.drawChef(ctx, 170, 640, 'cheer', G.animT);
    const orbit = ['burger', 'pizza', 'tacos', 'cake', 'salad', 'ramen'];
    for (let i = 0; i < orbit.length; ++i) {
      const a = G.animT * 1.1 + i * Math.PI / 3;
      const depth = Math.sin(a);
      SZ.FoodArt.drawDish(ctx, orbit[i], 170 + Math.cos(a) * 130, 500 + depth * 60, 56 + depth * 10, 1, 'good');
    }
    /* guests strolling along the bottom */
    for (let i = 0; i < 3; ++i) {
      const span = VIEW_W + 220;
      const x = ((G.animT * 90 + i * 430) % span) - 110;
      SZ.PeopleArt.drawCustomer(ctx, G.titleLooks[i], x, 712, 'walk', G.animT + i, 1);
    }

    drawCoinChip(1256, 16, G.save.coins);

    const stars = countStars();
    const daily = G.save.best.daily;
    const items = [
      { id: 't-career', label: 'Career', sub: stars + ' / 90 stars', color: 'orange', x: 430, y: 290, w: 420, h: 76, px: 30, action: () => setScreen(STATE_CAREER) },
      { id: 't-endless', label: 'Endless Rush', sub: 'Best $' + G.save.best.endless, color: 'red', x: 430, y: 380, w: 206, h: 62, action: () => startDay('endless', 0) },
      { id: 't-daily', label: 'Daily Special', sub: daily.date === dateKey(new Date()) ? 'Today: $' + daily.earned : 'New menu today', color: 'blue', x: 644, y: 380, w: 206, h: 62, action: () => startDay('daily', 0) },
      { id: 't-kitchen', label: 'Kitchen', sub: countTreeMaxed() + ' / ' + TREE.length + ' upgrades', color: 'green', x: 430, y: 454, w: 206, h: 62, action: () => { G.prevScreen = STATE_TITLE; setScreen(STATE_UPGRADES); } },
      { id: 't-recipes', label: 'Recipe Book', color: 'wood', x: 644, y: 454, w: 206, h: 62, action: () => setScreen(STATE_RECIPES) },
      { id: 't-help', label: 'Help', color: 'wood', x: 565, y: 530, w: 150, h: 44, px: 17, action: openHelp },
    ];
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      drawButton(it.id, it.label, it.x, it.y, it.w, it.h, { sub: it.sub, action: it.action, color: it.color, px: it.px || 20, bob: i });
    }

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' },
      { key: 'F2', label: 'New Game' },
    ], 640, 600, 900, 1);
  }

  NS.titleScreen = { drawTitleScreen };

})();
