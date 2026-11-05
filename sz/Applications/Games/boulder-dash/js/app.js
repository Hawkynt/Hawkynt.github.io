/* Bootstrap: reads the calendar (season, streak, quests), the fixed 60 Hz loop (as many steps as
   are due, then one draw), the slow housekeeping tick (achievements, finished quests, play time,
   status bar), saving on page hide and unload, and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const P = NS.progression;
  const scr = NS.screens;

  let last = 0, acc = 0, slow = 0;

  function calendar() {
    const now = new Date();
    G.today = NS.rng.dateKey(now);
    G.season = P.seasonFor(now);
    P.syncSeason(G.save, G.season, now);
    const bonus = P.refreshDay(G.save, now, G.perks);
    if (bonus) scr.toast('Day ' + G.save.streak.count + ' streak: +' + bonus + ' gold', '#ffd54a');
  }

  function housekeeping() {
    if (G.screen === 'playing') G.save.stats.playTime = (G.save.stats.playTime || 0) + 1;
    const got = P.checkAchievements(G.save, G.perks);
    for (let k = 0; k < got.length; ++k) {
      scr.toast('Achievement: ' + got[k].name + '  +' + got[k].gold + ' gold', '#ffd54a');
      SZ.GameAudio && SZ.GameAudio.play('levelup', { volume: 0.3 });
    }
    const q = G.save.quests.list;
    for (let k = 0; k < q.length; ++k)
      if (q[k].done && !q[k].notified) {
        q[k].notified = true;
        scr.toast('Quest done: ' + P.questText(q[k]) + ' - claim it in the Journal', '#5fd6ff');
      }
    if (NS.rng.dateKey(new Date()) !== G.today) calendar();
    NS.dom.update();
  }

  function loop(ts) {
    if (!last) last = ts;
    let elapsed = ts - last;
    last = ts;
    if (Math.abs(elapsed - C.STEP_MS) < C.STEP_SNAP_MS) elapsed = C.STEP_MS;
    acc = Math.min(acc + elapsed, C.STEP_MS * C.MAX_STEPS);
    const t0 = performance.now();
    while (acc >= C.STEP_MS) {
      acc -= C.STEP_MS;
      NS.sim.update(C.STEP);
    }
    const sim = performance.now() - t0;
    G.perf.sim = sim;
    G.perf.avgSim = G.perf.avgSim * 0.95 + sim * 0.05;
    NS.frame.draw(Math.min(0.05, elapsed / 1000));
    slow += elapsed;
    if (slow >= 1000) { slow -= 1000; housekeeping(); }
    requestAnimationFrame(loop);
  }

  function saveNow() {
    if (G.run && G.screen === 'playing') NS.run.autosave();
    else NS.save.writeSave();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('beforeunload', saveNow);

  const User32 = SZ.Dlls && SZ.Dlls.User32;
  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Boulder Dash');
  }
  if (SZ.GameAudio) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  calendar();
  NS.save.writeSave();
  NS.dom.update();
  if (!G.save.seenHelp) {
    G.save.seenHelp = true;
    scr.toast('New miner? Press H for How to Play', '#5fd6ff');
  }
  requestAnimationFrame(loop);

  Object.assign(NS.app, { calendar, housekeeping, saveNow });
})();
