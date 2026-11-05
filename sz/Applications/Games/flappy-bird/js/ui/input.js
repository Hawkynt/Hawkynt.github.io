;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Keyboard, mouse and touch input for every screen, plus auto-pause, autosave hooks and
     resize wiring. One button flies: any tap, click or Space flaps. Menus share the
     hit-area cursor; the Nest, Wardrobe, Goals and Help screens add their own keys; a
     cinematic skips on any key, click or tap. Writes G.flapHeld, G.touchUsed and the
     screen cursors, calls into Nav, Run and the screens. */

  const {
    TREE_BRANCHES, STATE_NEST, STATE_AVIARY, STATE_GOALS, STATE_HELP, STATE_CINE, STATE_READY, STATE_PLAYING, STATE_PAUSED
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
  const Aviary = NS.aviary;
  const GoalsUi = NS.goalsUi;
  const Hud = NS.hud;

  function handleInput() {
    if (G.state === STATE_READY) {
      G.state = STATE_PLAYING;
      Run.flap();
      sfx('whoosh', { pitch: 1.2, volume: 0.4 });
      Nav.updateStatus();
    } else if (G.state === STATE_PLAYING) {
      Run.flap();
    }
  }

  function inside(r) {
    return G.mouseX >= r.x && G.mouseX <= r.x + r.w && G.mouseY >= r.y && G.mouseY <= r.y + r.h;
  }

  function setBranch(b) {
    G.treeBranch = (b + TREE_BRANCHES.length) % TREE_BRANCHES.length;
    G.treeLayout = Nest.buildTreeLayout();
    Nest.selectFirstInBranch();
    sfx('click', { volume: 0.4 });
  }

  function nestKey(e) {
    if (e.code === 'Escape')
      Nav.backToPrev();
    else if (e.code === 'Tab')
      setBranch(G.treeBranch + (e.shiftKey ? -1 : 1));
    else if (e.code >= 'Digit1' && e.code <= 'Digit6')
      setBranch(Number(e.code.slice(5)) - 1);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA')
      Nest.moveTreeSelection(-1, 0);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD')
      Nest.moveTreeSelection(1, 0);
    else if (e.code === 'ArrowUp' || e.code === 'KeyW')
      Nest.moveTreeSelection(0, -1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS')
      Nest.moveTreeSelection(0, 1);
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      const node = Nest.treeNodeById(G.treeSelected);
      if (node && Prog.buyNode(node))
        G.treeBuyFlash = { id: node.id, at: G.globalTime };
    }
  }

  function wardrobeKey(e) {
    const list = Aviary.tab().list;
    const cols = list.length > 14 ? 8 : 7;
    let move = 0;
    if (e.code === 'Escape')
      Nav.backToPrev();
    else if (e.code === 'Tab')
      Aviary.setTab(G.wardrobeTab + (e.shiftKey ? -1 : 1));
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA')
      move = -1;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD')
      move = 1;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW')
      move = -cols;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS')
      move = cols;
    else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
      Aviary.useSelected();
    if (move) {
      G.aviaryIndex = Math.max(0, Math.min(list.length - 1, G.aviaryIndex + move));
      G.mouseX = -1;
      sfx('click', { volume: 0.4 });
    }
  }

  function goalsKey(e) {
    if (e.code === 'Escape')
      Nav.backToPrev();
    else if (e.code === 'Tab')
      GoalsUi.setTab(G.goalsTab + (e.shiftKey ? -1 : 1));
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
      const d = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1;
      if (G.goalsTab === 1)
        G.goalsPage = (G.goalsPage + d + GoalsUi.pageCount()) % GoalsUi.pageCount();
      else
        GoalsUi.setTab(G.goalsTab + d);
      sfx('click', { volume: 0.4 });
    }
  }

  function helpKey(e) {
    const n = Help.HELP_PAGES.length;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      G.helpPage = (G.helpPage + n - 1) % n;
      sfx('click', { volume: 0.4 });
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Space' || e.code === 'Enter') {
      G.helpPage = (G.helpPage + 1) % n;
      sfx('click', { volume: 0.4 });
    } else if (e.code === 'Escape' || e.code === 'KeyH')
      Nav.backToPrev();
  }

  function onKeyDown(e) {
    if (G.state === STATE_CINE) {
      e.preventDefault();
      if (!e.repeat)
        NS.cine.skip();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      if (Nav.inRun())
        Run.resetGame();
      else
        Nav.goTitle();
      return;
    }

    if ((e.key === 'h' || e.key === 'H') && !e.repeat && G.state !== STATE_HELP && Menu.isMenuState(G.state)) {
      e.preventDefault();
      Nav.goHelp();
      return;
    }

    const screen = { [STATE_NEST]: nestKey, [STATE_AVIARY]: wardrobeKey, [STATE_GOALS]: goalsKey, [STATE_HELP]: helpKey }[G.state];
    if (screen) {
      e.preventDefault();
      if (!e.repeat)
        screen(e);
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
      else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (G.state === STATE_PAUSED)
          Nav.togglePause();
        else if (e.code === 'Escape')
          Nav.menuEscape();
      }
      G.mouseX = -1;
      return;
    }

    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (G.state === STATE_PLAYING)
        Nav.togglePause();
      else if (G.state === STATE_READY && e.code === 'Escape') {
        if (G.mode === 'adventure')
          Nav.goWorlds();
        else
          Nav.quitToMenu();
      }
      return;
    }

    if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Enter') {
      e.preventDefault();
      G.flapHeld = true;
      if (!e.repeat)
        handleInput();
    }
  }

  function onPointerDown(e) {
    if (document.activeElement !== document.body || !document.hasFocus())
      window.focus();
    if (e.pointerType === 'touch')
      G.touchUsed = true;
    View.pointerToLogical(e);
    e.preventDefault();

    if (G.state === STATE_CINE) {
      NS.cine.skip();
      return;
    }

    // the tree screen selects and buys by card, not by hit area
    if (G.state === STATE_NEST) {
      if (!G.treeLayout)
        G.treeLayout = Nest.buildTreeLayout();
      for (const tab of G.treeLayout.tabs) {
        if (inside(tab)) {
          G.treeBranch = tab.index;
          Nest.selectFirstInBranch();
          sfx('click', { volume: 0.4 });
          return;
        }
      }
      for (const card of G.treeLayout.cards) {
        if (inside(card)) {
          G.treeSelected = card.node.id;
          if (Prog.buyNode(card.node))
            G.treeBuyFlash = { id: card.node.id, at: G.globalTime };
          return;
        }
      }
      if (inside(Nest.BACK_BTN))
        Nav.backToPrev();
      return;
    }

    if (G.state === STATE_HELP) {
      G.helpPage = (G.helpPage + 1) % Help.HELP_PAGES.length;
      if (G.helpPage === 0)
        Nav.backToPrev();
      sfx('click', { volume: 0.4 });
      return;
    }

    if (Menu.isMenuState(G.state) || G.state === STATE_PAUSED) {
      for (let i = 0; i < G.hitAreas.length; ++i) {
        const a = G.hitAreas[i];
        if (inside(a)) {
          G.menuCursor = i;
          Menu.activateMenuItem(a);
          return;
        }
      }
      return;
    }

    if (G.state === STATE_PLAYING && inside(Hud.PAUSE_BTN)) {
      Nav.togglePause();
      return;
    }

    G.flapHeld = true;
    handleInput();
  }

  function release() {
    G.flapHeld = false;
  }

  /* Registers every listener */
  function attach() {
    SZ.GameAutoPause.attach({
      isRunning: () => G.state === STATE_PLAYING,
      pause: Nav.togglePause
    });
    NS.autosave.attach();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', function(e) {
      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Enter')
        release();
    });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    window.addEventListener('pointerup', release);
    canvas.addEventListener('pointermove', View.pointerToLogical);
    canvas.addEventListener('pointerleave', function() {
      G.mouseX = -1;
      G.mouseY = -1;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('resize', View.setupCanvas);
  }

  Object.assign(NS.input, { handleInput, onKeyDown, onPointerDown, attach });
})();
