/*
 * The bootstrap: the frame loop and screen dispatch, the status bar, the menu bar, window integration
 * and start-up.
 * Owns G.time and G.frameDt.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { MAX_DT } = NS.config;
  const Fx = SZ.PlatformerFx;
  const View = NS.module('view');
  const Storage = NS.module('storage');
  const Session = NS.module('session');
  const Camera = NS.module('camera');
  const Step = NS.module('step');
  const World = NS.module('world');
  const Hud = NS.module('hud');
  const Title = NS.module('title');
  const MapScreen = NS.module('map');
  const Tree = NS.module('tree');
  const Wardrobe = NS.module('wardrobe');
  const Help = NS.module('help');
  const Pause = NS.module('pause');
  const Results = NS.module('results');
  const Controls = NS.module('controls');
  const { visibleRect } = NS.module('view');
  const canvas = G.canvas;
  const ctx = G.ctx;
  const fxWorld = G.fxWorld;
  const fxView = G.fxView;
  const flash = G.flash;
  const texts = G.texts;
  const viewTexts = G.viewTexts;
  const hitAreas = G.hitAreas;

  const { User32 } = SZ?.Dlls ?? {};
  const statusScore = document.getElementById('statusScore');
  const statusLevel = document.getElementById('statusLevel');
  const statusLives = document.getElementById('statusLives');
  const statusState = document.getElementById('statusState');

  let lastTimestamp = 0;

  function gameLoop(timestamp) {
    const raw = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.max(0, Math.min(raw, MAX_DT));
    lastTimestamp = timestamp;
    G.frameDt = dt;
    G.time += dt;
    View.beginFrame();
    hitAreas.length = 0;
    const v = visibleRect();

    if (G.screen === 'play' && G.run) {
      Step.updatePlay(dt);
      if (G.screen === 'play' && G.run) {
        Camera.updateCamera(dt);
        fxWorld.update(dt);
        texts.update(dt);
        Fx.ambient(fxWorld, G.run.world, World.worldRect(v), dt);
        World.drawWorld(dt);
        Hud.drawHUD();
      }
    }
    if (G.screen === 'pause' && G.run) {
      World.drawWorld(0);
      Hud.drawHUD();
      Pause.drawPause();
    } else if (G.screen === 'results' && G.results) {
      Results.drawResults(dt);
    } else if (G.screen === 'title') {
      Title.drawTitle();
    } else if (G.screen === 'map') {
      MapScreen.drawMap();
    } else if (G.screen === 'tree') {
      Tree.drawTree();
    } else if (G.screen === 'wardrobe') {
      Wardrobe.drawWardrobe();
    } else if (G.screen === 'help') {
      Help.drawHelp();
    }
    if (G.screen !== 'play' && G.toast)
      Hud.drawToastOnly();
    fxView.update(dt);
    fxView.draw(ctx);
    viewTexts.update(dt);
    viewTexts.draw(ctx);
    flash.update(dt);
    flash.draw(ctx, v);
    Hud.drawFade(dt, v);
    updateStatusBar();
    requestAnimationFrame(gameLoop);
  }

  const STATE_NAMES = { title: 'Title', map: 'World Map', tree: 'Tech Tree', wardrobe: 'Wardrobe', help: 'How to Play', play: 'Playing', pause: 'Paused', results: 'Results' };
  let statusCache = '';

  function updateStatusBar() {
    const coins = G.run && (G.screen === 'play' || G.screen === 'pause') ? Math.floor(G.run.coinsRun) : G.save.coins;
    const lvl = G.run ? G.run.level.name : '--';
    const hearts = G.run ? G.run.hearts + ' / ' + G.run.maxHearts : '--';
    const st = STATE_NAMES[G.screen] || G.screen;
    const key = coins + '|' + lvl + '|' + hearts + '|' + st;
    if (key === statusCache)
      return;
    statusCache = key;
    statusScore.textContent = 'Coins: ' + coins;
    statusLevel.textContent = 'Level: ' + lvl;
    statusLives.textContent = 'Hearts: ' + hearts;
    statusState.textContent = st;
  }

  function handleAction(action) {
    switch (action) {
      case 'new':
        G.run = null;
        Session.setScreen('title');
        break;
      case 'pause':
        if (G.screen === 'play') Pause.pauseGame();
        else if (G.screen === 'pause') Pause.resumeGame();
        break;
      case 'high-scores':
        Storage.renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            G.highScores = [];
            Storage.saveHighScores();
            Storage.renderHighScores();
          }
        });
        break;
      case 'tech-tree':
        if (G.screen === 'play') Pause.pauseGame();
        Tree.openTree(G.screen === 'pause' ? 'pause' : 'title');
        break;
      case 'tutorial':
        if (G.screen === 'play') Pause.pauseGame();
        Help.openHelp(G.screen === 'pause' ? 'pause' : 'title');
        break;
      case 'controls':
        if (G.screen === 'play') Pause.pauseGame();
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        if (G.screen === 'play') Pause.pauseGame();
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  function updateWindowTitle() {
    const title = G.run ? 'Platformer - ' + G.run.level.name : 'Platformer';
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  function handleResize() {
    View.setupCanvas();
  }

  function start() {
    Controls.attach();
    if (User32?.RegisterWindowProc) {
      User32.RegisterWindowProc((msg) => {
        if (msg === 'WM_SIZE')
          handleResize();
        else if (msg === 'WM_THEMECHANGED')
          View.setupCanvas();
      });
    }
    window.addEventListener('resize', handleResize);
    if (window.ResizeObserver)
      new ResizeObserver(handleResize).observe(canvas);

    SZ.Dialog.wireAll();
    new SZ.MenuBar({ onAction: handleAction });

    Storage.loadSave();
    Storage.loadHighScores();
    Session.refreshStats();
    View.setupCanvas();
    SZ.GameAudio.attachMuteButton();
    G.touch = SZ.TouchControls.attach({
      container: document.querySelector('.game-frame'),
      stick: 'horizontal',
      buttons: [
        { label: 'Jump', code: 'Space' },
        { label: 'Dash', code: 'KeyX' },
        { label: 'Fire', code: 'KeyC' }
      ],
      extra: [{ label: 'II', code: 'Escape', title: 'Pause' }]
    });
    window.addEventListener('touchstart', () => {
      if (!G.touchUsed) {
        G.touchUsed = true;
        setTimeout(Controls.syncTouch, 0);
      }
    }, { capture: true, passive: true });
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      G.touchUsed = true;

    SZ.GameAutoPause.attach({
      isRunning: () => G.screen === 'play',
      pause: Pause.pauseGame
    });

    document.body.tabIndex = -1;
    Session.setScreen('title');
    if (!G.save.tutorialSeen)
      Help.openHelp('title');
    updateWindowTitle();
    requestAnimationFrame(gameLoop);
  }

  Object.assign(NS.module('app'), {
    updateWindowTitle
  });

  start();
})();
