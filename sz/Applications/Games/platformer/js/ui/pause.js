/*
 * Pausing, resuming and quitting a level, and the pause menu.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, WORLDS } = NS.config;
  const Session = NS.module('session');
  const Menu = NS.module('menu');
  const Tree = NS.module('tree');
  const Wardrobe = NS.module('wardrobe');
  const Help = NS.module('help');
  const Controls = NS.module('controls');
  const { sfx } = NS.module('sound');
  const ui = G.ui;
  const held = G.held;
  const pressed = G.pressed;

  function pauseGame() {
    if (G.screen === 'play' && G.run && G.run.clearT <= 0 && G.run.koT <= 0) {
      G.screen = 'pause';
      G.menuCursor = 0;
      held.clear();
      sfx('click');
      Controls.syncTouch();
    }
  }

  function resumeGame() {
    if (G.screen === 'pause') {
      G.screen = 'play';
      held.clear();
      pressed.clear();
      Controls.syncTouch();
    }
  }

  function quitToMenu() {
    if (G.run && (G.run.mode === 'adventure' || G.run.mode === 'trial')) {
      G.mapMode = G.run.mode;
      Session.setScreen('map');
    } else {
      Session.setScreen('title');
    }
    G.run = null;
  }

  function drawPause() {
    Menu.veil(0.6);
    const x = VIEW_W / 2 - 220, y = 120;
    ui.drawPanel(x, y, 440, 470, { accent: WORLDS[G.run.world].color, title: 'Paused', titleRight: G.run.level.name, headerH: 38, titlePx: 20 });
    const items = [
      ['Resume', resumeGame, 'Esc'],
      ['Restart', Session.restartLevel, 'R'],
      ['Tech Tree', () => Tree.openTree('pause'), 'T'],
      ['Wardrobe', () => Wardrobe.openWardrobe('pause'), ''],
      ['How to Play', () => Help.openHelp('pause'), 'H'],
      [G.run.mode === 'adventure' || G.run.mode === 'trial' ? 'Quit to Map' : 'Quit to Title', quitToMenu, 'Q']
    ];
    items.forEach((it, i) => Menu.drawButton('p' + i, it[0], x + 40, y + 60 + i * 66, 360, 54, { action: it[1], key: it[2] || undefined }));
  }

  Object.assign(NS.module('pause'), {
    pauseGame,
    resumeGame,
    quitToMenu,
    drawPause
  });
})();
