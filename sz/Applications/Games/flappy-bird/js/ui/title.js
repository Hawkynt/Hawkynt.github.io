;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Title screen and the Adventure world map with its stage buttons. Reads G.save, sets
     G.mode/G.stageIndex through the button actions. */

  const { CANVAS_W, BIRD_DEFS } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const View = NS.view;
  const Run = NS.run;
  const Shapes = NS.shapes;
  const Menu = NS.menu;
  const Nav = NS.nav;

  function drawTitleScreen() {
    const t = G.globalTime;
    ui.drawHeadline('FLAPPY BIRD', 640, 130, 900, 96, '#ffd23f', '#ff8a1e');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Flap. Dodge. Collect. Soar.', 640, 200, 600, 22, { color: ui.UI.textDim });

    // the decoration birds stay in the left and right thirds — they never cross the
    // headline, the subtitle or the column of buttons
    const others = BIRD_DEFS.filter(d => Prog.birdOwned(d.id) && d.id !== Prog.currentBird()).map(d => d.id);
    while (others.length < 2)
      others.push(others.length === 0 ? 'ruby' : 'jay');
    for (let i = 0; i < 2; ++i) {
      const home = i === 0 ? 250 : 1040;
      const x = home + Math.sin(t * (0.5 + i * 0.17) + i) * 130;
      const y = 420 + i * 90 + Math.sin(t * 1.5 + i * 2) * 60;
      SZ.FlappyBirdArt.drawBird(ctx, { x: x, y: y, angle: 0, birdId: others[i], frame: t * 8, scale: 1.4 });
    }
    SZ.FlappyBirdArt.drawBird(ctx, {
      x: 250 + 80 * Math.sin(t),
      y: 450 + 70 * Math.sin(2 * t),
      angle: 0.2 * Math.cos(2 * t),
      birdId: Prog.currentBird(),
      frame: t * 10,
      scale: 3
    });

    const bx = 640 - 170;
    let y = 236;
    Menu.drawButton('t-adventure', 'Adventure', bx, y, 340, 50, { sub: Prog.totalStars() + ' / 72 stars', action: Nav.goWorlds });
    y += 58;
    Menu.drawButton('t-classic', 'Classic', bx, y, 340, 50, { sub: 'Best ' + G.save.best.classic, action: () => { G.mode = 'classic'; Run.startRun(); } });
    y += 58;
    Menu.drawButton('t-time', 'Time Attack', bx, y, 340, 50, { sub: 'Best ' + G.save.best.time, action: () => { G.mode = 'time'; Run.startRun(); } });
    y += 58;
    Menu.drawButton('t-daily', 'Daily Run', bx, y, 340, 50, {
      sub: G.save.best.daily.date === Prog.todayKey() ? 'Best ' + G.save.best.daily.score : 'New seed today',
      action: () => { G.mode = 'daily'; Run.startRun(); }
    });
    y += 58;
    Menu.drawButton('t-nest', 'Nest', bx, y, 340, 50, { sub: Prog.treeComplete() + ' / 15 upgrades', action: Nav.goNest });
    y += 58;
    Menu.drawButton('t-aviary', 'Aviary', bx, y, 340, 50, { sub: G.save.birds.length + '/6 birds', action: Nav.goAviary });
    y += 58;
    Menu.drawButton('t-help', 'Help', bx, y, 340, 50, { action: Nav.goHelp });

    Shapes.drawCoinChip(G.save.coins, CANVAS_W - 24, 20);
    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'H', label: 'Help' }
    ], 640, 690, 420, 1.2);
  }

  function drawWorldsScreen() {
    ui.drawHeadline('Adventure', 640, 62, 500, 44, ui.UI.gold);
    const stages = SZ.FlappyCourse.STAGES;
    for (let w = 0; w < 6; ++w) {
      const cx = 40 + (w % 3) * 404;
      const cy = 120 + Math.floor(w / 3) * 274;
      const biome = SZ.FlappyCourse.BIOME_ORDER[w];
      const worldLocked = !Prog.stageUnlocked(w * 4);

      ui.drawPanel(cx, cy, 380, 250, { accent: ui.UI.gold });

      // miniature of the biome sky, clipped into the card
      ctx.save();
      ui.roundRectPath(cx, cy, 380, 250, 9);
      ctx.clip();
      ctx.translate(cx, cy);
      ctx.scale(0.3, 0.3);
      View.sceneFor(biome).drawSky(ctx);
      ctx.restore();
      const g = ctx.createLinearGradient(0, cy + 110, 0, cy + 250);
      g.addColorStop(0, 'rgba(6,10,24,0)');
      g.addColorStop(1, 'rgba(6,10,24,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(cx, cy + 110, 380, 140);

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ui.fitText(SZ.FlappyCourse.BIOMES[biome].name, cx + 16, cy + 26, 250, 26, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.6)' });
      // the star counter sits on a dark chip, right-aligned at the card edge
      ui.drawChip(Prog.worldStars(w) + ' / 12', cx + 380 - 16, cy + 26 - 13, 26, {
        align: 'right',
        color: '#ffd23f',
        bg: 'rgba(0,0,0,0.45)'
      });
      ctx.textAlign = 'left';

      if (worldLocked) {
        Shapes.drawLock(cx + 190, cy + 110, 64);
        ctx.textAlign = 'center';
        ui.fitText('Clear ' + SZ.FlappyCourse.BIOMES[SZ.FlappyCourse.BIOME_ORDER[w - 1]].name, cx + 190, cy + 162, 340, 18, { weight: 'bold', color: ui.UI.warn });
        ctx.textAlign = 'left';
      }

      for (let s = 0; s < 4; ++s) {
        const idx = w * 4 + s;
        const bx = cx + 12 + s * 92, by = cy + 170;
        const locked = !Prog.stageUnlocked(idx);
        const action = () => { G.mode = 'adventure'; G.stageIndex = idx; Run.startRun(); };
        const index = Menu.registerHit('stage' + idx, bx, by, 80, 64, action, locked);
        const hot = Menu.isHot(index, bx, by, 80, 64);
        ctx.save();
        if (locked)
          ctx.globalAlpha *= 0.45;
        if (hot) {
          ctx.translate(bx + 40, by + 32);
          ctx.scale(1.05, 1.05);
          ctx.translate(-(bx + 40), -(by + 32));
        }
        ui.drawPanel(bx, by, 80, 64, { radius: 8, noStuds: true, accent: hot ? ui.UI.gold : ui.UI.accent, glow: hot });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(String(s + 1), bx + 40, by + 22, 60, 26, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
        const earned = G.save.stars[stages[idx].id] || 0;
        for (let k = 0; k < 3; ++k)
          Shapes.drawStarShape(bx + 26 + k * 14, by + 48, 6, k < earned);
        if (locked)
          Shapes.drawLock(bx + 40, by + 32, 26);
        ctx.restore();
      }
    }
    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Stage' },
      { key: 'Enter', label: 'Play' },
      { key: 'Esc', label: 'Title' }
    ], 640, 692, 900, 1);
  }

  Object.assign(NS.title, { drawTitleScreen, drawWorldsScreen });
})();
