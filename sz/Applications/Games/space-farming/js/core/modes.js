/* Farm modes, chosen on the title: Classic (the farm ends when it can no longer earn), Relaxed
   (three times the starting credits and the farm never ends), Harvest Rush (earn 5,000 credits
   within 14 days) and the Daily Farm (the same seeded field for everyone, seven days, the most
   credits earned kept as today's best through the shared goals layer). Owns G.farmMode. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;

  const MODES = {
    classic: { id: 'classic', name: 'Classic farm', blurb: 'The farm ends when it can no longer earn' },
    relaxed: { id: 'relaxed', name: 'Relaxed farm', blurb: 'Triple starting credits, the farm never ends', credits: 300, endless: true },
    rush: { id: 'rush', name: 'Harvest Rush', blurb: 'Earn 5,000 credits within 14 days', goal: 5000, days: 14 },
    daily: { id: 'daily', name: 'Daily Farm', blurb: 'Today\'s field for everyone: seven days, most credits wins', days: 7, daily: true },
  };
  G.farmMode = 'classic';
  let pending = 'classic', seed = 0;

  function mode() { return MODES[G.farmMode] || MODES.classic; }

  /* the title picks a mode, then the usual new-farm flow runs */
  function start(id) {
    pending = MODES[id] ? id : 'classic';
    NS.requestNewGame();
  }

  function rng(s) {
    let a = s >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* called by resetGame around the field's generation: the Daily Farm draws it from today's seed */
  function beginReset() {
    G.farmMode = pending;
    pending = 'classic';
    const m = mode();
    if (!m.daily) return null;
    const r = NS.meta && NS.meta.goals ? NS.meta.goals.dailyRecipe() : { seed: 12345 };
    seed = r.seed;
    const saved = Math.random;
    Math.random = rng(seed);
    return saved;
  }
  function endReset(saved) {
    if (saved) Math.random = saved;
    const m = mode();
    if (m.credits) G.credits = m.credits;
    if (NS.toast && m.id !== 'classic') NS.toast(m.name + ': ' + m.blurb, '#7ae08a', 'star');
  }

  /* -> 'won' | 'over' | '' once a day ticks or a second passes */
  function verdict() {
    const m = mode();
    if (m.goal && G.stats.earned >= m.goal) return 'won';
    if (m.days && G.dayCount > m.days) return 'over';
    return '';
  }

  function onEnd(won) {
    const m = mode();
    if (m.daily && NS.meta && NS.meta.goals) NS.meta.goals.dailyResult(G.stats.earned);
    G.farmResult.mode = m.id;
    G.farmResult.won = !!won;
  }

  function headline(R) {
    const m = MODES[R.mode] || MODES.classic;
    if (m.id === 'rush') return R.won ? ['Harvest Rush won!', 'Earned ' + m.goal.toLocaleString('en-US') + ' credits in ' + R.days + (R.days === 1 ? ' day.' : ' days.')] : ['Harvest Rush over', 'The 14 days are up.'];
    if (m.id === 'daily') return ['Daily Farm done', 'Seven days on today\'s field. Your earnings count as today\'s best.'];
    return ['Season Over', 'No credits for seeds, nothing growing and nothing left to sell.'];
  }

  function progressText() {
    const m = mode();
    if (m.id === 'rush') return 'Harvest Rush - day ' + Math.min(G.dayCount, m.days) + ' of ' + m.days + ' - ' + Math.floor(G.stats.earned).toLocaleString('en-US') + ' / ' + m.goal.toLocaleString('en-US') + ' credits';
    if (m.id === 'daily') return 'Daily Farm - day ' + Math.min(G.dayCount, m.days) + ' of ' + m.days + ' - ' + Math.floor(G.stats.earned).toLocaleString('en-US') + ' credits';
    return '';
  }

  Object.assign(NS, { modes: { MODES, mode, start, beginReset, endReset, verdict, onEnd, headline, progressText } });
})();
