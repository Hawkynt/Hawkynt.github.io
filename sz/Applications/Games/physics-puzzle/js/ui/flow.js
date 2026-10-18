;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Screen flow: switching screens, the menu screens instance with the
   * actions it may call, opening and closing the map, Trick Shots, Tech Tree
   * and How to Play (returning to where they were opened from), pause and
   * resume, and the Escape / back chain. Owns G.state, G.fade and the
   * tree / help return points; reads and writes G.run and G.menuCursor.
   */

  const G = NS.G;

  function setScreen(name) {
    G.state = name;
    G.menuCursor = 0;
    G.fade = 1;
    G.hitAreas.length = 0;
    NS.os.updateWindowTitle();
  }

  G.actions = {
    startCampaign: NS.run.startCampaign, startTrick: NS.run.startTrick, startDaily: NS.run.startDaily, startSandbox: NS.run.startSandbox,
    openMap: (w) => openMap(w), openTricks: () => openTricks(), openTree: (from) => openTree(from), openHelp: (from) => openHelp(from),
    title: () => { G.run = null; setScreen('title'); }, resume: () => resumeGame(), restart: () => NS.run.restartLevel(), quit: () => NS.run.quitToMenu(),
    next: () => NS.run.nextLevel(), retry: () => NS.run.retry(),
    closeTree: () => closeTree(), closeHelp: () => closeHelp(), setScreen: setScreen
  };
  const Screens = SZ.PhysicsPuzzleScreens.create(G);

  function openMap(world) {
    Screens.openMap(world);
    setScreen('map');
  }

  function openTricks() {
    setScreen('tricks');
  }

  let treeFrom = 'title', helpFrom = 'title';
  function openTree(from) {
    treeFrom = from;
    Screens.openTree();
    Screens.setTreeFromPause(from === 'pause');
    setScreen('tree');
  }

  function closeTree() {
    G.refreshStats();
    const run = G.run;
    if (run) {
      /* new spare parts and Bullet Time count straight away */
      run.inv = NS.run.inventoryFor(run.level, run.mode);
      if (run.phase !== 'flight')
        run.bulletLeft = G.stats.bulletTime;
    }
    if (treeFrom === 'pause' && run) {
      G.state = 'pause';
    } else if (treeFrom === 'results' && G.results) {
      G.state = 'results';
    } else {
      setScreen(treeFrom === 'map' ? 'map' : 'title');
    }
  }

  function openHelp(from) {
    helpFrom = from;
    Screens.openHelp();
    setScreen('help');
  }

  function closeHelp() {
    if (!G.save.tutorialSeen) {
      G.save.tutorialSeen = true;
      G.writeSave();
    }
    if (helpFrom === 'pause' && G.run)
      G.state = 'pause';
    else
      setScreen('title');
  }

  function pauseGame() {
    if (G.state !== 'play' || !G.run)
      return;
    G.state = 'pause';
    G.run.aiming = null;
    G.run.drag = null;
    G.menuCursor = 0;
    G.sfx('click');
    NS.os.updateWindowTitle();
  }

  function resumeGame() {
    if (!G.run)
      return;
    G.state = 'play';
    G.sfx('click');
    NS.os.updateWindowTitle();
  }

  /* Escape: step back out of whatever is open */
  function back() {
    const run = G.run;
    switch (G.state) {
      case 'play':
        if (run && run.drag) { run.drag = null; return; }
        if (run && run.selected >= 0) { run.selected = -1; return; }
        pauseGame();
        break;
      case 'pause': resumeGame(); break;
      case 'map': setScreen('title'); break;
      case 'tricks': setScreen('title'); break;
      case 'tree': closeTree(); break;
      case 'help': closeHelp(); break;
      case 'results': NS.run.quitToMenu(); break;
    }
  }

  NS.flow = {
    screens: Screens, setScreen: setScreen, openMap: openMap, openTricks: openTricks, openTree: openTree, closeTree: closeTree,
    openHelp: openHelp, closeHelp: closeHelp, pauseGame: pauseGame, resumeGame: resumeGame, back: back
  };
})();
