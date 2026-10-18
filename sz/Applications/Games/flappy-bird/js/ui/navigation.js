;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Screen changes, pause, the window title and the status bar. Owns G.state transitions
     between screens and G.prevState. */

  const {
    BIRD_DEFS, STATE_TITLE, STATE_WORLDS, STATE_NEST, STATE_AVIARY, STATE_HELP, STATE_READY, STATE_PLAYING,
    STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR
  } = NS.C;
  const { statusScore, statusBest, statusState, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Nest = NS.nest;

  function updateWindowTitle() {
    if (G.state === STATE_READY || G.state === STATE_PLAYING || G.state === STATE_PAUSED ||
      G.state === STATE_DYING || G.state === STATE_DEAD || G.state === STATE_CLEAR)
      SZ.Dlls.User32.SetWindowText('Flappy Bird -- ' + (G.mode === 'adventure' ? SZ.FlappyCourse.STAGES[G.stageIndex].name : Prog.modeName()));
    else
      SZ.Dlls.User32.SetWindowText('Flappy Bird');
  }

  function goTitle() {
    G.state = STATE_TITLE;
    G.menuCursor = 0;
    updateStatus();
    updateWindowTitle();
  }

  function goWorlds() {
    G.state = STATE_WORLDS;
    G.menuCursor = 0;
    updateStatus();
    updateWindowTitle();
  }

  function goNest() {
    G.prevState = G.state;
    G.treeLayout = Nest.buildTreeLayout();
    Nest.selectFirstInBranch();
    G.state = STATE_NEST;
    updateStatus();
    updateWindowTitle();
  }

  function goAviary() {
    G.prevState = G.state;
    G.aviaryIndex = Math.max(0, BIRD_DEFS.findIndex(d => d.id === Prog.currentBird()));
    G.menuCursor = G.aviaryIndex;
    G.state = STATE_AVIARY;
    updateStatus();
    updateWindowTitle();
  }

  function goHelp() {
    G.prevState = G.state;
    G.helpPage = 0;
    G.state = STATE_HELP;
    updateStatus();
    updateWindowTitle();
  }

  function backToPrev() {
    if (G.prevState === STATE_WORLDS)
      goWorlds();
    else
      goTitle();
  }

  function quitToMenu() {
    G.fade = 1;
    if (G.mode === 'adventure')
      goWorlds();
    else
      goTitle();
  }

  function menuEscape() {
    if (G.state === STATE_WORLDS)
      goTitle();
    else if (G.state === STATE_NEST || G.state === STATE_AVIARY || G.state === STATE_HELP)
      backToPrev();
    else if (G.state === STATE_DEAD || G.state === STATE_CLEAR)
      quitToMenu();
  }

  function updateStatus() {
    statusScore.textContent = 'Score: ' + G.score;
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      const earned = Math.min(3, G.save.stars[st.id] || 0);
      let pips = '';
      for (let i = 0; i < 3; ++i)
        pips += i < earned ? '★' : '☆';
      statusBest.textContent = 'Best: ' + pips + ' (stage ' + st.id + ')';
    } else {
      statusBest.textContent = 'Best: ' + Prog.modeBest();
    }
    if (G.state === STATE_TITLE) {
      statusState.textContent = 'Title';
      return;
    }
    if (G.state === STATE_WORLDS) {
      statusState.textContent = 'Adventure';
      return;
    }
    if (G.state === STATE_NEST) {
      statusState.textContent = 'Nest';
      return;
    }
    if (G.state === STATE_AVIARY) {
      statusState.textContent = 'Aviary';
      return;
    }
    if (G.state === STATE_HELP) {
      statusState.textContent = 'Help';
      return;
    }
    const label = G.state === STATE_PAUSED ? 'Paused' :
      G.state === STATE_DEAD || G.state === STATE_DYING ? 'Game Over' :
      G.state === STATE_CLEAR ? 'Stage Clear' :
      G.state === STATE_PLAYING ? 'Playing' : 'Ready';
    statusState.textContent = Prog.modeName() + ' - ' + label;
  }

  function togglePause() {
    if (G.state === STATE_PLAYING)
      G.state = STATE_PAUSED;
    else if (G.state === STATE_PAUSED)
      G.state = STATE_PLAYING;
    else
      return;
    sfx('click', { volume: 0.4 });
    updateStatus();
  }

  Object.assign(NS.nav, {
    updateWindowTitle, goTitle, goWorlds, goNest, goAviary, goHelp, backToPrev, quitToMenu, menuEscape,
    updateStatus, togglePause
  });
})();
