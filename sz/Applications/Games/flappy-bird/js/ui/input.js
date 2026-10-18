;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Keyboard and pointer input for every screen, plus auto-pause and resize wiring.
     Writes G.flapHeld and the menu/tree cursors, calls into Nav, Run and Nest. */

  const {
    TREE_BRANCHES, STATE_NEST, STATE_HELP, STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_DYING, STATE_DEAD,
    STATE_CLEAR
  } = NS.C;
  const { canvas, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const View = NS.view;
  const Run = NS.run;
  const Menu = NS.menu;
  const Nav = NS.nav;
  const Nest = NS.nest;
  const Help = NS.help;

  function handleInput() {
    if (G.state === STATE_READY) {
      G.state = STATE_PLAYING;
      Run.flap();
      // the first flap out of READY is also the run start
      sfx('whoosh', { pitch: 1.2, volume: 0.4 });
      Nav.updateStatus();
    } else if (G.state === STATE_PLAYING) {
      Run.flap();
    }
  }

  /* Registers every listener, in the order the game always used */
  function attach() {
    /* Pause when the window is hidden or loses focus */
    SZ.GameAutoPause.attach({
      isRunning: () => G.state === STATE_PLAYING,
      pause: Nav.togglePause
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'F2') {
        e.preventDefault();
        if (G.state === STATE_READY || G.state === STATE_PLAYING || G.state === STATE_PAUSED ||
          G.state === STATE_DYING || G.state === STATE_DEAD || G.state === STATE_CLEAR)
          Run.resetGame();
        else
          Nav.goTitle();
        return;
      }

      if ((e.key === 'h' || e.key === 'H') && !e.repeat) {
        if (G.state === STATE_HELP) {
          e.preventDefault();
          Nav.backToPrev();
          return;
        }
        if (Menu.isMenuState(G.state)) {
          e.preventDefault();
          Nav.goHelp();
          return;
        }
      }

      // ── Nest tech tree navigation ──
      if (G.state === STATE_NEST) {
        e.preventDefault();
        if (e.repeat)
          return;
        if (e.code === 'Escape') {
          Nav.backToPrev();
        } else if (e.code === 'Tab') {
          G.treeBranch = (G.treeBranch + 1) % TREE_BRANCHES.length;
          G.treeLayout = Nest.buildTreeLayout();
          Nest.selectFirstInBranch();
          sfx('click', { volume: 0.4 });
        } else if (e.code >= 'Digit1' && e.code <= 'Digit5') {
          const b = Number(e.code.slice(5)) - 1;
          if (b < TREE_BRANCHES.length) {
            G.treeBranch = b;
            G.treeLayout = Nest.buildTreeLayout();
            Nest.selectFirstInBranch();
            sfx('click', { volume: 0.4 });
          }
        } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          Nest.moveTreeSelection(-1, 0);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          Nest.moveTreeSelection(1, 0);
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          Nest.moveTreeSelection(0, -1);
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          Nest.moveTreeSelection(0, 1);
        } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
          const node = Nest.treeNodeById(G.treeSelected);
          if (node && Prog.buyNode(node))
            G.treeBuyFlash = { id: node.id, at: G.globalTime };
        }
        return;
      }

      // ── Help pages ──
      if (G.state === STATE_HELP) {
        e.preventDefault();
        if (e.repeat)
          return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          G.helpPage = (G.helpPage + Help.HELP_PAGES.length - 1) % Help.HELP_PAGES.length;
          sfx('click', { volume: 0.4 });
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          G.helpPage = (G.helpPage + 1) % Help.HELP_PAGES.length;
          sfx('click', { volume: 0.4 });
        } else if (e.code === 'Escape')
          Nav.backToPrev();
        return;
      }

      // ── Menu screen navigation (all screens share the hit-area cursor) ──
      if (Menu.isMenuState(G.state) || G.state === STATE_PAUSED) {
        e.preventDefault();
        if (e.repeat)
          return;
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
          Menu.moveMenuCursor(-1);
        else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
          Menu.moveMenuCursor(1);
        else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
          Menu.activateMenuItem(G.hitAreas[G.menuCursor]);
        else if (e.code === 'Escape') {
          if (G.state === STATE_PAUSED)
            Nav.togglePause();
          else
            Nav.menuEscape();
        }
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (G.state === STATE_PLAYING)
          Nav.togglePause();
        else if (G.state === STATE_READY) {
          if (G.mode === 'adventure')
            Nav.goWorlds();
          else
            Nav.goTitle();
        }
        return;
      }

      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        G.flapHeld = true;
        handleInput();
      }
    });

    document.addEventListener('keyup', function(e) {
      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp')
        G.flapHeld = false;
    });

    canvas.addEventListener('pointerdown', function(e) {
      if (document.activeElement !== document.body || !document.hasFocus())
        window.focus();
      View.pointerToLogical(e);
      e.preventDefault();

      // the tree screen selects and buys by card, not by hit area
      if (G.state === STATE_NEST) {
        if (!G.treeLayout)
          G.treeLayout = Nest.buildTreeLayout();
        for (const tab of G.treeLayout.tabs) {
          if (G.mouseX >= tab.x && G.mouseX <= tab.x + tab.w && G.mouseY >= tab.y && G.mouseY <= tab.y + tab.h) {
            G.treeBranch = tab.index;
            Nest.selectFirstInBranch();
            sfx('click', { volume: 0.4 });
            return;
          }
        }
        for (const card of G.treeLayout.cards) {
          if (G.mouseX >= card.x && G.mouseX <= card.x + card.w && G.mouseY >= card.y && G.mouseY <= card.y + card.h) {
            G.treeSelected = card.node.id;
            if (Prog.buyNode(card.node))
              G.treeBuyFlash = { id: card.node.id, at: G.globalTime };
            return;
          }
        }
        return;
      }

      if (Menu.isMenuState(G.state) || G.state === STATE_PAUSED) {
        for (let i = 0; i < G.hitAreas.length; ++i) {
          const a = G.hitAreas[i];
          if (G.mouseX >= a.x && G.mouseX <= a.x + a.w && G.mouseY >= a.y && G.mouseY <= a.y + a.h) {
            G.menuCursor = i;
            Menu.activateMenuItem(a);
            return;
          }
        }
        return;
      }

      G.flapHeld = true;
      handleInput();
    });

    canvas.addEventListener('pointerup', function() {
      G.flapHeld = false;
    });

    canvas.addEventListener('pointercancel', function() {
      G.flapHeld = false;
    });

    window.addEventListener('pointerup', function() {
      G.flapHeld = false;
    });

    canvas.addEventListener('pointermove', View.pointerToLogical);

    window.addEventListener('resize', View.setupCanvas);
  }

  Object.assign(NS.input, { handleInput, attach });
})();
