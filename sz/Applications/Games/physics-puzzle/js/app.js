;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * The bootstrap and the frame loop: wires input, the window and the menu
   * bar, loads the save, then each frame advances G.time, runs the level
   * or draws the current screen, the view particles, flashes and the screen
   * fade, and refreshes the status bar. Owns the frame timing and the status
   * bar cache; reads everything else from G.
   */

  const G = NS.G;
  const ctx = G.ctx, Fx = G.Fx, Lv = G.Lv, Prog = G.Prog;
  const MAX_DT = NS.C.MAX_DT, VIEW_W = NS.C.VIEW_W, FIELD_H = NS.C.FIELD_H, FADE_RATE = NS.C.FADE_RATE;
  const view = NS.view, flow = NS.flow, Screens = NS.flow.screens;
  const statusLevel = document.getElementById('statusLevel');
  const statusShots = document.getElementById('statusShots');
  const statusStars = document.getElementById('statusStars');
  const statusCoins = document.getElementById('statusCoins');

  let lastTimestamp = 0;

  function gameLoop(timestamp) {
    const t0 = performance.now();
    const raw = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.max(0, Math.min(raw, MAX_DT));
    lastTimestamp = timestamp;
    G.frameDt = dt;
    G.time += dt;
    view.beginFrame();
    G.hitAreas.length = 0;
    const v = view.visibleRect();

    if (G.state === 'play' && G.run) {
      NS.shot.updatePlay(dt);
      if (G.state === 'play' && G.run) {
        const run = G.run;
        G.fxWorld.update(dt * (run.phase === 'flight' || run.phase === 'won' ? G.timeScale.scale : 1));
        G.texts.update(dt);
        Fx.ambient(G.fxWorld, run.world, { x0: 0, y0: 0, x1: VIEW_W, y1: FIELD_H }, dt);
        NS.field.drawField(dt);
        NS.hud.drawHUD();
      }
    }
    const state = G.state;
    if (state === 'pause' && G.run) {
      NS.field.drawField(0);
      NS.hud.drawHUD();
      Screens.drawPause();
    } else if (state === 'results' && G.results) {
      Screens.drawResults(dt);
    } else if (state === 'title') {
      Screens.drawTitle(dt);
    } else if (state === 'map') {
      Screens.drawMap();
    } else if (state === 'tricks') {
      Screens.drawTricks();
    } else if (state === 'tree') {
      Screens.drawTree();
    } else if (state === 'help') {
      Screens.drawHelp();
    }
    if (G.state !== 'play' && G.toast)
      NS.hud.drawToast();
    G.fxView.update(dt);
    G.fxView.draw(ctx);
    G.flash.update(dt);
    G.flash.draw(ctx, v);
    drawFade(dt, v);
    updateStatusBar();
    G.frameMs = performance.now() - t0;
    G.frameMsAvg += (G.frameMs - G.frameMsAvg) * 0.05;
    requestAnimationFrame(gameLoop);
  }

  function drawFade(dt, v) {
    if (G.fade <= 0)
      return;
    ctx.fillStyle = 'rgba(4,10,18,' + Math.min(1, G.fade).toFixed(3) + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    G.fade = Math.max(0, G.fade - dt * FADE_RATE);
  }

  const STATE_NAMES = { title: 'Title', map: 'World Map', tricks: 'Trick Shots', tree: 'Tech Tree', help: 'How to Play', play: 'Playing', pause: 'Paused', results: 'Results' };
  let statusCache = '';

  function updateStatusBar() {
    const run = G.run, save = G.save;
    const lvl = run ? run.level.name : STATE_NAMES[G.state] || '--';
    const shots = run && run.att ? run.att.shots + (run.level.par < 99 ? ' / par ' + run.level.par : '') : '--';
    const stars = Prog.totalStars(save, Lv.LEVELS) + ' / ' + Lv.LEVELS.length * 3;
    const key = lvl + '|' + shots + '|' + stars + '|' + save.coins;
    if (key === statusCache)
      return;
    statusCache = key;
    statusLevel.textContent = 'Level: ' + lvl;
    statusShots.textContent = 'Shots: ' + shots;
    statusStars.textContent = 'Stars: ' + stars;
    if (statusCoins)
      statusCoins.textContent = 'Coins: ' + save.coins;
  }

  /* ── init ── */

  NS.input.attach();
  NS.os.attachWindow();

  SZ.Dialog.wireAll();
  new SZ.MenuBar({ onAction: NS.os.handleAction });

  NS.save.loadSave();
  G.refreshStats();
  view.setupCanvas();
  SZ.GameAudio.attachMuteButton();
  SZ.GameAutoPause.attach({
    isRunning: () => G.state === 'play',
    pause: flow.pauseGame
  });

  document.body.tabIndex = -1;
  flow.setScreen('title');
  if (!G.save.tutorialSeen)
    flow.openHelp('title');
  NS.os.updateWindowTitle();
  requestAnimationFrame(gameLoop);
})();
