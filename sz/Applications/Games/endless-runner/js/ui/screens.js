/* Screen switching: entering a screen resets the cursor and its timer; the tech tree,
   collection, journal and help remember where they were opened from (title, map, results or the
   pause menu); pausing (which autosaves the run) and resuming; starting a story stage (a world's
   comic strip or a guardian's reveal plays first, once); Continue; leaving a run for the title
   keeps its autosave. Owns G.screen and the return targets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { sfx } = NS.audio;

  const SUB = { tree: 1, wardrobe: 1, journal: 1, help: 1 };

  /* a real run is open: playing, paused, or a screen opened from the pause menu */
  function inRun() {
    const r = G.run;
    if (!r || r.demo || r.ended) return false;
    if (G.screen === 'playing' || G.screen === 'paused') return true;
    return !!SUB[G.screen] && G.back[G.screen] === 'paused';
  }

  function setScreen(name) {
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.ui.pauseConfirm = false;
    G.input.queue.length = 0;
    if (name === 'results' && NS.results.reset) NS.results.reset();
    if (name !== 'playing' && G.save) NS.save.writeSave();
    if (NS.statusBar.update) NS.statusBar.update();
  }

  function pause() {
    if (G.screen !== 'playing' || !G.run || G.run.demo || G.run.ended) return;
    NS.save.writeRun();
    setScreen('paused');
    sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (G.screen !== 'paused') return;
    setScreen('playing');
    const r = G.run;
    if (r && r.phase === 'play') { r.phase = 'ready'; r.phaseT = 0.9; }
    NS.save.refreshStats();
    sfx('blip');
  }

  function open(name, from) {
    G.back[name] = from || G.screen;
    if (name === 'help') G.ui.helpPage = 0;
    setScreen(name);
  }

  function back(name) {
    setScreen(G.back[name] || 'title');
  }

  /* to the title; an open run keeps its autosave so Continue brings it back */
  function toTitle() {
    if (inRun() && G.run.phase !== 'over') NS.save.writeRun();
    if (G.run && !G.run.demo && !G.run.ended) G.run = null;
    G.cine = null;
    setScreen('title');
  }

  /* a story stage: the world's strip on first entry, the guardian's reveal before a boss */
  function startStory(stageId) {
    const st = NS.worlds.stageById(stageId);
    if (!st) return;
    G.ui.mapWorld = st.w;
    G.ui.mapStage = st.s;
    const go = () => NS.run.start('story', { stageId: stageId });
    const seen = G.save.seen.cine;
    if (st.boss && !seen['boss_' + st.boss]) NS.cine.play('boss_' + st.boss, go);
    else if (st.s === 0 && !seen['world' + st.w]) NS.cine.play('world' + st.w, go);
    else go();
  }

  function continueRun() {
    const saved = NS.save.readRun();
    if (!saved) { sfx('error'); return; }
    NS.run.resume(saved);
  }

  function startMode(mode) {
    NS.run.start(mode, {});
  }

  Object.assign(NS.screens, {
    inRun, setScreen, pause, resume, open, back, toTitle, startStory, continueRun, startMode
  });
})();
