;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Autosave and continue: while a run is alive its snapshot (course generator, every
     object on the course, bird, hearts, power-ups, boss, scores) goes to localStorage every
     few seconds, on pause, on page hide and on unload; the title offers it as Continue and
     a reload resumes exactly there. A finished run deletes its snapshot. */

  const { AUTOSAVE_EVERY, STATE_READY, STATE_PLAYING, STATE_PAUSED } = NS.C;
  const G = NS.state;
  const Save = NS.save;

  function runAlive() {
    return !!G.course && (G.state === STATE_PLAYING || G.state === STATE_PAUSED || (G.state === STATE_READY && G.dist > 0));
  }

  function snapshot() {
    return {
      v: 1,
      savedAt: Date.now(),
      mode: G.mode,
      stageIndex: G.stageIndex,
      courseOpts: G.courseOpts,
      course: G.course.snapshot(),
      dist: G.dist, runTime: G.runTime, worldT: G.worldT, score: G.score, points: G.points, mult: G.mult, multClean: G.multClean,
      coinsRun: G.coinsRun, coinsPicked: G.coinsPicked, tokensRun: G.tokensRun, hearts: G.hearts, hitsTaken: G.hitsTaken,
      timeLeft: G.timeLeft, blastCharges: G.blastCharges, combo: G.combo, bestCombo: G.bestCombo, perfects: G.perfects,
      coinCarry: G.coinCarry, comboSaves: G.comboSaves, revives: G.revives, fever: G.fever, feverT: G.feverT, flow: G.flow,
      zenNote: G.zenNote, zenBumps: G.zenBumps,
      power: G.power, bird: { x: G.bird.x, y: G.bird.y, vy: G.bird.vy, angle: G.bird.angle }, buddy: G.buddy,
      boss: G.boss, bossRush: G.bossRush, sceneBiome: G.sceneBiome
    };
  }

  function saveNow() {
    if (!runAlive())
      return false;
    Save.writeRun(snapshot());
    Save.writeSave();
    return true;
  }

  function tick(dt) {
    G.runSaveT -= dt;
    if (G.runSaveT <= 0) {
      G.runSaveT = AUTOSAVE_EVERY;
      saveNow();
    }
  }

  /* a short label for the title's Continue button, or '' when there is nothing to resume */
  function describe(snap) {
    if (!snap)
      return '';
    let what;
    if (snap.mode === 'adventure') {
      const st = SZ.FlappyCourse.STAGES[snap.stageIndex];
      what = 'Story ' + (st ? st.id : '');
      if (snap.fresh)
        return what + ' - the next stage';
    } else {
      what = NS.progress.modeName(snap.mode);
    }
    return what + ' - ' + (snap.mode === 'arcade' ? snap.points + ' pts' : snap.score + ' pipes');
  }

  function attach() {
    window.addEventListener('pagehide', saveNow);
    window.addEventListener('beforeunload', saveNow);
    document.addEventListener('visibilitychange', function() {
      if (document.hidden)
        saveNow();
    });
  }

  Object.assign(NS.autosave, { runAlive, snapshot, saveNow, tick, describe, attach });
})();
