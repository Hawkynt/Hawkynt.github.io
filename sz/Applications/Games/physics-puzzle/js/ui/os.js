;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Desktop integration: the menu bar actions, the Progress, Controls and
   * About dialogs (with the save reset), the window title, and resizing
   * through the desktop's window messages, the browser and a ResizeObserver.
   * Reads G.state, G.run and G.save; the Progress reset replaces G.save.
   */

  const G = NS.G;
  const Lv = G.Lv, Prog = G.Prog;
  const WORLDS = NS.C.WORLDS;
  const { User32 } = SZ?.Dlls ?? {};

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body)
      return;
    body.innerHTML = '';
    WORLDS.forEach((w, i) => {
      const levels = Lv.worldLevels(i);
      const stars = Prog.totalStars(G.save, levels);
      const cleared = levels.filter(l => Prog.cleared(G.save, l.id)).length;
      const tr = document.createElement('tr');
      for (const v of [w.name, stars + ' / ' + levels.length * 3, cleared + ' / ' + levels.length]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
    const tricks = Lv.TRICKS.filter(t => G.save.tricks[t.id]).length;
    const tr = document.createElement('tr');
    for (const v of ['Trick Shots', tricks + ' / ' + Lv.TRICKS.length, G.save.daily.cleared ? 'Daily cleared' : '']) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  function handleAction(action) {
    const flow = NS.flow;
    switch (action) {
      case 'new':
        G.run = null;
        flow.setScreen('title');
        break;
      case 'pause':
        if (G.state === 'play') flow.pauseGame();
        else if (G.state === 'pause') flow.resumeGame();
        break;
      case 'restart':
        if (G.run) { if (G.state === 'pause') flow.resumeGame(); NS.run.restartLevel(); }
        break;
      case 'high-scores':
        if (G.state === 'play') flow.pauseGame();
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            G.save = Prog.defaultSave();
            G.save.tutorialSeen = true;
            G.writeSave();
            G.refreshStats();
            renderHighScores();
            G.run = null;
            flow.setScreen('title');
          }
        });
        break;
      case 'tech-tree':
        if (G.state === 'play') flow.pauseGame();
        flow.openTree(G.state === 'pause' ? 'pause' : 'title');
        break;
      case 'tutorial':
        if (G.state === 'play') flow.pauseGame();
        flow.openHelp(G.state === 'pause' ? 'pause' : 'title');
        break;
      case 'controls':
        if (G.state === 'play') flow.pauseGame();
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        if (G.state === 'play') flow.pauseGame();
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  function updateWindowTitle() {
    const title = G.run && (G.state === 'play' || G.state === 'pause') ? 'Physics Puzzle - ' + G.run.level.name : 'Physics Puzzle';
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  function handleResize() {
    NS.view.setupCanvas();
  }

  function attachWindow() {
    if (User32?.RegisterWindowProc) {
      User32.RegisterWindowProc((msg) => {
        if (msg === 'WM_SIZE')
          handleResize();
        else if (msg === 'WM_THEMECHANGED')
          NS.view.setupCanvas();
      });
    }
    window.addEventListener('resize', handleResize);
    if (window.ResizeObserver)
      new ResizeObserver(handleResize).observe(G.canvas);
  }

  NS.os = { handleAction: handleAction, updateWindowTitle: updateWindowTitle, attachWindow: attachWindow };
})();
