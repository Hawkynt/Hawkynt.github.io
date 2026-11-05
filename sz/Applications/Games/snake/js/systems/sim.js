/* One simulation step at the fixed rate: the calendar check (a new day brings a streak gift and
   new quests), hit-stop and slow motion, then the run while playing - flow, snake, critters,
   guardian, shots, power-ups, fruit, marks and the hazard clock - or the title demo board and the
   cinematic on the menus; effects and progress always. Owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { dayKey } = NS.rng;
  const seasons = NS.seasons;

  let dayCheck = 0;

  function refreshCalendar(date) {
    const d = date || new Date();
    G.today = dayKey(d);
    G.season = seasons.seasonFor(d);
    G.eventId = seasons.eventId(d);
    G.weekly = seasons.weeklyMutator(d);
  }

  function runWorld(dt) {
    const run = G.run;
    const play = NS.run.update(dt);
    if (!play || !G.run || G.run !== run) return;
    const rate = (run.act.warp || 0) > 0 ? 0.5 : 1;
    NS.board.rebuildOcc();
    if (run.phase === 'play') {
      NS.snake.update(dt);
      if (G.run !== run) return;
    }
    run.hazT += NS.board.frozen() ? 0 : dt * rate;
    NS.board.updateMarks(dt * rate);
    NS.enemies.update(dt);
    NS.bosses.update(dt);
    NS.combat.update(dt);
    if (run.phase === 'play') {
      NS.powerups.update(dt);
      NS.food.update(dt);
    }
    if (G.screen === 'playing' && run.mode !== 'demo') NS.audio.ambience(dt, NS.worlds.THEMES[run.level.theme].note, run.mode === 'zen');
  }

  function update(dt) {
    G.time += dt;
    G.screenT += dt;
    dayCheck -= dt;
    if (dayCheck <= 0) {
      dayCheck = 30;
      const before = G.today;
      refreshCalendar();
      if (before && before !== G.today) NS.progress.dayStart();
    }
    NS.progress.tick(dt);
    if (G.ui.treeFlash > 0) G.ui.treeFlash = Math.max(0, G.ui.treeFlash - dt * 1.5);
    if (G.ui.powerBanner) {
      G.ui.powerBanner.t += dt;
      if (G.ui.powerBanner.t > 1.6) G.ui.powerBanner = null;
    }
    if (G.hitstop > 0) {
      G.hitstop = Math.max(0, G.hitstop - dt);
      NS.fx.update(dt * 0.2);
      return;
    }
    let wdt = dt;
    if (G.slowmo > 0) wdt *= 0.4;
    if (G.screen === 'playing' && G.run) runWorld(wdt);
    else if (G.screen === 'title' || G.screen === 'modes') {
      if (!G.run || G.run.mode !== 'demo') NS.run.startDemo();
      runWorld(dt);
    } else if (G.screen === 'cine') NS.cine.update(dt);
    NS.fx.update(wdt);
  }

  refreshCalendar();

  Object.assign(NS.sim, {
    update, refreshCalendar
  });
})();
