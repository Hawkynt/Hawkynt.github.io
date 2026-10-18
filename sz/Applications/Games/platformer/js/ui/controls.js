/*
 * Keyboard, mouse and touch input: play keys into G.held / G.pressed, menu navigation per screen,
 * pointer hit-testing and showing the touch controls only during play.
 * Owns G.mouseX, G.mouseY, G.pointerMoved, G.touchUsed.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const View = NS.module('view');
  const Input = NS.module('input');
  const Session = NS.module('session');
  const Menu = NS.module('menu');
  const MapScreen = NS.module('map');
  const Tree = NS.module('tree');
  const Wardrobe = NS.module('wardrobe');
  const Help = NS.module('help');
  const Pause = NS.module('pause');
  const { sfx } = NS.module('sound');
  const canvas = G.canvas;
  const hitAreas = G.hitAreas;
  const held = G.held;
  const pressed = G.pressed;

  function back() {
    switch (G.screen) {
      case 'play': Pause.pauseGame(); break;
      case 'pause': Pause.resumeGame(); break;
      case 'map': Session.setScreen('title'); break;
      case 'tree': Tree.closeTree(); break;
      case 'wardrobe': Wardrobe.closeWardrobe(); break;
      case 'help': Help.closeHelp(); break;
      case 'results': Pause.quitToMenu(); break;
    }
  }

  function attach() {
    document.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))
        return;
      if (document.querySelector('.dialog-overlay.visible'))
        return;
      const code = e.code;
      if (code === 'F2') {
        e.preventDefault();
        G.run = null;
        Session.setScreen('title');
        return;
      }
      if (code === 'Escape' || code === 'KeyP' && (G.screen === 'play' || G.screen === 'pause')) {
        e.preventDefault();
        if (!e.repeat)
          back();
        return;
      }
      if (G.screen === 'play') {
        const a = Input.KEYMAP[code];
        if (a) {
          e.preventDefault();
          if (!e.repeat && !held.has(a))
            pressed.add(a);
          held.add(a);
        } else if (code === 'KeyR' && !e.repeat) {
          Session.restartLevel();
        } else if (code === 'KeyH' && !e.repeat) {
          Pause.pauseGame();
          Help.openHelp('pause');
        } else if (code === 'KeyT' && !e.repeat) {
          Pause.pauseGame();
          Tree.openTree('pause');
        }
        return;
      }
      if (e.repeat && (code === 'Enter' || code === 'Space'))
        return;
      if (G.screen === 'tree') {
        if (code === 'ArrowLeft' || code === 'KeyA') Tree.moveTree(-1, 0);
        else if (code === 'ArrowRight' || code === 'KeyD') Tree.moveTree(1, 0);
        else if (code === 'ArrowUp' || code === 'KeyW') Tree.moveTree(0, -1);
        else if (code === 'ArrowDown' || code === 'KeyS') Tree.moveTree(0, 1);
        else if (code === 'Tab') { G.treeBranch = (G.treeBranch + (e.shiftKey ? 4 : 1)) % 5; G.treeSelected = Tree.treeLayout()[0].node.id; sfx('click'); }
        else if (/^Digit[1-5]$/.test(code)) { G.treeBranch = Number(code.charAt(5)) - 1; G.treeSelected = Tree.treeLayout()[0].node.id; }
        else if (code === 'Enter' || code === 'Space') Tree.buyTreeNode(G.treeSelected);
        e.preventDefault();
        return;
      }
      if (G.screen === 'map') {
        if (code === 'ArrowLeft' || code === 'KeyA') MapScreen.selectMapLevel(G.mapLevel - 1);
        else if (code === 'ArrowRight' || code === 'KeyD') MapScreen.selectMapLevel(G.mapLevel + 1);
        else if (code === 'KeyQ' || code === 'PageUp' || code === 'ArrowUp' || code === 'KeyW') MapScreen.changeMapWorld(-1);
        else if (code === 'KeyE' || code === 'PageDown' || code === 'ArrowDown' || code === 'KeyS') MapScreen.changeMapWorld(1);
        else if (code === 'Enter' || code === 'Space') MapScreen.playMapLevel();
        else if (code === 'KeyT') Tree.openTree('map');
        e.preventDefault();
        return;
      }
      if (G.screen === 'help') {
        if (code === 'ArrowRight' || code === 'Enter' || code === 'Space' || code === 'KeyD') {
          if (G.helpPage < Help.HELP_PAGES.length - 1) ++G.helpPage;
          else Help.closeHelp();
          sfx('click');
        } else if (code === 'ArrowLeft' || code === 'KeyA') {
          if (G.helpPage > 0) { --G.helpPage; sfx('click'); }
        }
        e.preventDefault();
        return;
      }
      if (G.screen === 'title' && code === 'KeyH') {
        Help.openHelp('title');
        return;
      }
      if (G.screen === 'pause') {
        if (code === 'KeyR') { Session.restartLevel(); return; }
        if (code === 'KeyT') { Tree.openTree('pause'); return; }
        if (code === 'KeyH') { Help.openHelp('pause'); return; }
        if (code === 'KeyQ') { Pause.quitToMenu(); return; }
      }
      if (G.screen === 'results') {
        if (code === 'KeyR') { Session.restartLevel(); return; }
        if (code === 'KeyT') { Tree.openTree('results'); return; }
      }
      if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'KeyA') {
        Menu.moveCursor(-1);
        G.pointerMoved = false;
        e.preventDefault();
      } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowRight' || code === 'KeyD' || code === 'Tab') {
        Menu.moveCursor(1);
        G.pointerMoved = false;
        e.preventDefault();
      } else if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        Menu.activate(hitAreas[G.menuCursor]);
      }
    });

    document.addEventListener('keyup', (e) => {
      const a = Input.KEYMAP[e.code];
      if (a)
        held.delete(a);
    });

    window.addEventListener('blur', () => {
      held.clear();
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = View.pointerToView(e);
      if (Math.abs(p.x - G.mouseX) > 0.5 || Math.abs(p.y - G.mouseY) > 0.5)
        G.pointerMoved = true;
      G.mouseX = p.x;
      G.mouseY = p.y;
    });

    canvas.addEventListener('pointerleave', () => {
      G.mouseX = -1;
      G.mouseY = -1;
    });

    canvas.addEventListener('pointerdown', (e) => {
      const p = View.pointerToView(e);
      G.mouseX = p.x;
      G.mouseY = p.y;
      G.pointerMoved = true;
      if (G.screen === 'play')
        return;
      for (let i = hitAreas.length - 1; i >= 0; --i) {
        const h = hitAreas[i];
        if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) {
          G.menuCursor = i;
          Menu.activate(h);
          return;
        }
      }
    });
  }

  function syncTouch() {
    if (!G.touch)
      return;
    if (G.touch.visible)
      G.touchUsed = true;
    if (!G.touchUsed)
      return;
    if (G.screen === 'play')
      G.touch.show();
    else
      G.touch.hide();
  }

  Object.assign(NS.module('controls'), {
    attach,
    syncTouch
  });
})();
