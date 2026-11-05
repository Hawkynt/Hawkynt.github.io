;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Screen changes, story entry (intro and chapter cinematics before a stage), mode starts,
     continue, pause, the window title and the status bar. Owns G.state transitions between
     screens and G.prevState. */

  const {
    STATE_TITLE, STATE_WORLDS, STATE_MODES, STATE_NEST, STATE_AVIARY, STATE_GOALS, STATE_HELP, STATE_CINE, STATE_READY,
    STATE_PLAYING, STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR, BIRD_DEFS
  } = NS.C;
  const { statusScore, statusBest, statusState, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;

  function inRun() {
    return G.state === STATE_READY || G.state === STATE_PLAYING || G.state === STATE_PAUSED ||
      G.state === STATE_DYING || G.state === STATE_DEAD || G.state === STATE_CLEAR;
  }

  function updateWindowTitle() {
    if (inRun())
      SZ.Dlls.User32.SetWindowText('Flappy Bird -- ' + (G.mode === 'adventure' ? SZ.FlappyCourse.STAGES[G.stageIndex].name : Prog.modeName()));
    else
      SZ.Dlls.User32.SetWindowText('Flappy Bird');
  }

  function show(state) {
    G.state = state;
    G.menuCursor = 0;
    G.fade = Math.max(G.fade, 0.5);
    updateStatus();
    updateWindowTitle();
  }

  function goTitle() {
    show(STATE_TITLE);
  }

  /* the story map; the very first visit plays the intro */
  function goWorlds() {
    if (!G.save.seenCine.intro) {
      G.state = STATE_TITLE;
      NS.cine.play('intro', () => {
        show(STATE_WORLDS);
        G.menuCursor = G.mapSel = Prog.storyNext();
      });
      return;
    }
    show(STATE_WORLDS);
    G.menuCursor = G.mapSel = Prog.storyNext();
  }

  function goModes() {
    show(STATE_MODES);
  }

  /* screens that come back to where they were opened from (title, map, pause) */
  function openOver(state) {
    if (G.state !== state)
      G.prevState = G.state;
    if (G.state === STATE_PLAYING)
      G.prevState = STATE_PAUSED;
    G.state = state;
    G.menuCursor = 0;
    updateStatus();
  }

  function goNest() {
    openOver(STATE_NEST);
    G.treeLayout = NS.nest.buildTreeLayout();
    NS.nest.selectFirstInBranch();
  }

  function goAviary() {
    openOver(STATE_AVIARY);
    G.wardrobeTab = 0;
    G.aviaryIndex = Math.max(0, BIRD_DEFS.findIndex(d => d.id === Prog.currentBird()));
  }

  function goGoals(tab) {
    openOver(STATE_GOALS);
    G.goalsTab = tab || 0;
    G.goalsPage = 0;
  }

  function goHelp() {
    openOver(STATE_HELP);
    G.helpPage = 0;
  }

  function backToPrev() {
    const prev = G.prevState;
    if (prev === STATE_PAUSED) {
      // upgrades bought from the pause menu count right away: more hearts fill up
      const max = NS.rules.maxHearts();
      if (G.heartsAtPause && max > G.heartsAtPause)
        G.hearts += max - G.heartsAtPause;
      G.heartsAtPause = max;
      G.state = STATE_PAUSED;
      G.menuCursor = 0;
      updateStatus();
      return;
    }
    if (prev === STATE_DEAD || prev === STATE_CLEAR) {
      G.state = prev;
      G.menuCursor = 0;
      updateStatus();
      return;
    }
    if (prev === STATE_WORLDS)
      show(STATE_WORLDS);
    else if (prev === STATE_MODES)
      show(STATE_MODES);
    else
      goTitle();
  }

  /* a story stage: the chapter cinematic plays before the first stage of every land */
  function startStage(idx) {
    G.mode = 'adventure';
    G.stageIndex = idx;
    const w = SZ.FlappyCourse.STAGES[idx].world;
    const id = 'chapter' + (w + 1);
    if (!G.save.seenCine[id])
      NS.cine.play(id, () => NS.run.startRun());
    else
      NS.run.startRun();
  }

  function startMode(mode) {
    G.mode = mode;
    NS.run.startRun();
  }

  function continueRun() {
    const snap = NS.save.readRun();
    if (!snap) {
      sfx('error');
      return;
    }
    if (snap.fresh) {
      startStage(snap.stageIndex);
      return;
    }
    try {
      NS.run.resumeRun(snap);
    } catch (_) {
      NS.save.clearRun();
      sfx('error');
      goTitle();
    }
  }

  function quitToMenu() {
    G.fade = 1;
    if (G.state === STATE_PAUSED)
      NS.autosave.saveNow();
    if (G.mode === 'adventure') {
      show(STATE_WORLDS);
      G.menuCursor = G.mapSel = G.stageIndex;
    } else if (G.mode === 'classic')
      goTitle();
    else
      show(STATE_MODES);
  }

  function menuEscape() {
    if (G.state === STATE_WORLDS || G.state === STATE_MODES)
      goTitle();
    else if (G.state === STATE_NEST || G.state === STATE_AVIARY || G.state === STATE_HELP || G.state === STATE_GOALS)
      backToPrev();
    else if (G.state === STATE_DEAD || G.state === STATE_CLEAR)
      quitToMenu();
  }

  const STATE_LABELS = {};
  STATE_LABELS[STATE_TITLE] = 'Title';
  STATE_LABELS[STATE_WORLDS] = 'Story map';
  STATE_LABELS[STATE_MODES] = 'Modes';
  STATE_LABELS[STATE_NEST] = 'Nest';
  STATE_LABELS[STATE_AVIARY] = 'Wardrobe';
  STATE_LABELS[STATE_GOALS] = 'Goals';
  STATE_LABELS[STATE_HELP] = 'Help';
  STATE_LABELS[STATE_CINE] = 'Story';

  function updateStatus() {
    statusScore.textContent = G.mode === 'arcade' ? 'Points: ' + G.points : 'Score: ' + G.score;
    if (G.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[G.stageIndex];
      const earned = Math.min(3, G.save.stars[st.id] || 0);
      statusBest.textContent = 'Best: ' + '★'.repeat(earned) + '☆'.repeat(3 - earned) + ' (stage ' + st.id + ')';
    } else {
      statusBest.textContent = 'Best: ' + Prog.modeBest();
    }
    if (STATE_LABELS[G.state]) {
      statusState.textContent = STATE_LABELS[G.state];
      return;
    }
    const label = G.state === STATE_PAUSED ? 'Paused' :
      G.state === STATE_DEAD || G.state === STATE_DYING ? 'Game Over' :
      G.state === STATE_CLEAR ? 'Stage Clear' :
      G.state === STATE_PLAYING ? 'Playing' : 'Ready';
    statusState.textContent = Prog.modeName() + ' - ' + label;
  }

  function togglePause() {
    if (G.state === STATE_PLAYING) {
      G.state = STATE_PAUSED;
      G.heartsAtPause = NS.rules.maxHearts();
      G.menuCursor = 0;
      NS.autosave.saveNow();
    } else if (G.state === STATE_PAUSED) {
      G.state = STATE_PLAYING;
      G.invuln = Math.max(G.invuln, 0.4);
    } else {
      return;
    }
    sfx('click', { volume: 0.4 });
    updateStatus();
  }

  Object.assign(NS.nav, {
    inRun, updateWindowTitle, show, goTitle, goWorlds, goModes, goNest, goAviary, goGoals, goHelp, backToPrev, startStage,
    startMode, continueRun, quitToMenu, menuEscape, updateStatus, togglePause
  });
})();
