/* The Sanctum Trials: once the bakery has ascended, it can begin again under a trial's rule
   (taking any sugar crystals waiting, like an ascension). Reaching the trial's era completes it
   forever: +10% production, the best time is kept, the rule lifts and the bakery simply carries
   on. A trial can be abandoned from the pause menu, which also just lifts the rule. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const E = NS.economy;
  const C = NS.constants;
  const { TRIALS, BY_ID } = NS.trialData;
  const { STAGES } = NS.treatData;
  const { sfx } = NS.audio;

  function available() {
    return G.profile.ascensions >= 1 && !G.bake;
  }

  function current() {
    return G.run && G.run.trial ? BY_ID[G.run.trial] || null : null;
  }

  function begin(id) {
    const t = BY_ID[id];
    if (!t || !available()) return false;
    const p = G.profile;
    const gained = NS.prestige.pending();
    if (gained >= 1) {
      p.crystals += gained;
      ++p.ascensions;
    }
    G.run = E.newRun('classic', p);
    G.run.trial = id;
    G.run.mods = JSON.parse(JSON.stringify(t.mods));
    G.run.mods.name = t.name;
    G.run.mods.desc = t.desc;
    NS.golden.clearAll();
    NS.production.invalidate();
    NS.production.refresh(true);
    G.ui.displayCookies = G.run.cookies;
    NS.screens.setScreen('game');
    NS.cinematics.play('trialStart', { trial: t, gained: gained });
    NS.save.write(G);
    return true;
  }

  /* called when the run's treat evolves */
  function onEvolve(run, stage) {
    const t = run.trial ? BY_ID[run.trial] : null;
    if (!t || run !== G.run || stage < t.goal) return false;
    const p = G.profile;
    const first = !p.trials[t.id];
    p.trials[t.id] = true;
    p.trialBest[t.id] = Math.min(p.trialBest[t.id] || Infinity, run.time);
    run.trial = null;
    run.mods = null;
    NS.production.invalidate();
    sfx('win');
    if (SZ.GameMusic) SZ.GameMusic.stinger('win');
    NS.cinematics.queue('trialDone', { trial: t, first: first, time: p.trialBest[t.id] });
    NS.progression.checkUnlocks();
    return true;
  }

  function abandon() {
    const t = current();
    if (!t) return false;
    G.run.trial = null;
    G.run.mods = null;
    NS.production.invalidate();
    NS.screens.toast('Trial abandoned: ' + t.name + ' - the bakery carries on without its rule', C.UI.textDim, 'back');
    return true;
  }

  function goalText(t) {
    return 'Reach the ' + STAGES[t.goal].name + ' (Era ' + NS.cinematics.ROMAN[t.goal] + ')';
  }

  Object.assign(NS.trials, { available, current, begin, onEvolve, abandon, goalText, TRIALS });
})();
