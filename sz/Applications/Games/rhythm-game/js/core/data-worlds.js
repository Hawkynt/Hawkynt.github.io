/* The five districts and their thirty stages. Each district teaches one note kind - taps on the
   Neon Docks, holds in the Glass Gardens, chords in the Rust Foundry, Hush notes in the Undertow
   Club, drift notes up the Crown Spire - first gently (a low rate on its first stage), then fully,
   and keeps the kinds before it. The level climbs through a district and across districts in a
   saw-tooth: each duel is a peak, the next district's first song eases off while it teaches the new
   kind. Songs grow longer as the story goes on. Each stage names its bonus goal (the third star).
   Pure data; the curve is checked by tests/playtest.test.js. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const SD = NS.songData;

  const WORLDS = [
    { id: 'docks', name: 'Neon Docks', teach: 'tap', color: '#ff4a9a', glow: '#5af0ff', sky: ['#0a0420', '#3a0a4a', '#ff4a8a'], blurb: 'Cranes, container stacks and a harbour full of neon' },
    { id: 'gardens', name: 'Glass Gardens', teach: 'hold', color: '#7affd0', glow: '#c48aff', sky: ['#04102a', '#1a3a5a', '#7affd0'], blurb: 'Greenhouses of glass where light sings when it is held' },
    { id: 'foundry', name: 'Rust Foundry', teach: 'chord', color: '#ff8a3a', glow: '#ffd25a', sky: ['#140604', '#4a1a0a', '#ff8a3a'], blurb: 'Furnaces, pistons and sparks in two-handed rhythm' },
    { id: 'club', name: 'Undertow Club', teach: 'hush', color: '#3a8aff', glow: '#5affea', sky: ['#020818', '#06204a', '#3a8aff'], blurb: 'A club at the bottom of the bay, where silence bites back' },
    { id: 'spire', name: 'Crown Spire', teach: 'drift', color: '#ffd25a', glow: '#ffffff', sky: ['#0a0418', '#2a1a5a', '#ffd25a'], blurb: 'The tower above the clouds where the Hush conducts' },
  ];

  /* the duel bosses: attacks cycle on the major slots, every slot once they rage */
  const BOSSES = [
    { id: 'gristle', name: 'Gristle the Bass Baron', short: 'Gristle', attacks: ['rush'], color: '#ff4a9a', hpShare: 0.66 },
    { id: 'vesper', name: 'Vesper, the Glass Siren', short: 'Vesper', attacks: ['fog'], color: '#7affd0', hpShare: 0.68 },
    { id: 'anvil', name: 'Anvil-9', short: 'Anvil-9', attacks: ['hammer'], color: '#ff8a3a', hpShare: 0.7 },
    { id: 'undertow', name: 'Madame Undertow', short: 'Undertow', attacks: ['sway'], color: '#3a8aff', hpShare: 0.71 },
    { id: 'hush', name: 'The Hush', short: 'The Hush', attacks: ['rush', 'fog', 'hammer', 'sway', 'silence'], color: '#e0e0ff', hpShare: 0.72 },
  ];

  const ATTACKS = {
    rush: { name: 'Bass Drop', text: 'Notes rush in!', icon: 'bolt' },
    fog: { name: 'Glass Fog', text: 'Fog over the highway!', icon: 'eye' },
    hammer: { name: 'Hammerfall', text: 'Hush notes incoming!', icon: 'bomb' },
    sway: { name: 'Riptide', text: 'The highway sways!', icon: 'drop' },
    silence: { name: 'Silence', text: 'The music stops - keep the beat!', icon: 'music' },
  };

  /* level per district (first song, last song, duel) */
  /* the target per district (first song, last song, duel): the mean accuracy a regular and a casual
     player reach; each stage's level is calibrated to it within +-0.25 of the curve below */
  const TARGET = [[0.97, 0.935, 0.925], [0.93, 0.88, 0.86], [0.89, 0.83, 0.8], [0.85, 0.79, 0.76], [0.81, 0.71, 0.64]];
  const CURVE = [[0.1, 0.45, 0.5], [0.45, 0.65, 0.75], [0.4, 0.65, 0.7], [0.5, 0.65, 0.72], [0.62, 0.76, 0.86]];
  const GOALS = [
    { id: 'fc', text: 'Full combo' },
    { id: 'stars', text: 'Complete every star phrase' },
    { id: 'acc95', text: 'Reach 95% accuracy' },
    { id: 'noboost', text: 'Clear it without boosters' },
    { id: 'nohush', text: 'Touch no Hush note' },
    { id: 'acc90', text: 'Reach 90% accuracy' },
    { id: 'holds', text: 'Keep every hold to its tail' },
    { id: 'combo', text: 'A combo of {n}' },
  ];

  const KINDS = ['tap', 'hold', 'chord', 'hush', 'drift'];
  function kindsFor(w, s) {
    const k = {};
    for (let i = 1; i <= w; ++i) k[KINDS[i]] = i === w ? (s === 0 ? 0.35 : s === 1 ? 0.7 : 1) : 0.8;
    return k;
  }

  const STAGES = [];
  for (let w = 0; w < WORLDS.length; ++w) {
    const [a, b, boss] = CURVE[w];
    for (let s = 0; s < 6; ++s) {
      const isBoss = s === 5;
      const level = isBoss ? boss : a + (b - a) * s / 4;
      const tg = TARGET[w], target = isBoss ? tg[2] : tg[0] + (tg[1] - tg[0]) * s / 4;
      let goal = GOALS[[[5, 0, 1, 3, 7], [6, 1, 5, 0, 6], [5, 3, 1, 2, 0], [4, 1, 5, 4, 2], [5, 4, 1, 2, 0]][w][Math.min(s, 4)]];
      if (isBoss) goal = GOALS[w < 2 ? 5 : 2];
      STAGES.push({
        id: WORLDS[w].id + '-' + (s + 1), world: w, stage: s, index: STAGES.length, boss: isBoss ? BOSSES[w] : null,
        name: SD.STAGE_NAMES[w][s], level: Math.round(level * 100) / 100, target: Math.round(target * 1000) / 1000,
        bars: isBoss ? 40 + w * 4 : 24 + w * 4 + s * 2, kinds: kindsFor(w, s),
        goal: goal.id, goalN: goal.id === 'combo' ? 40 + w * 30 : 0, goalText: goal.text.replace('{n}', 40 + w * 30),
      });
    }
  }

  const BY_ID = {};
  for (const s of STAGES) BY_ID[s.id] = s;

  /* the chart of a stage at a level; opts: lucky, mirror, hushStorm, speed (practice), levelAdd */
  function chartAt(st, level, opts) {
    opts = opts || {};
    let song = SD.stageSong(st.world, st.stage);
    if (opts.speed && opts.speed !== 1) song = Object.assign({}, song, { bpm: NS.chart.bpmOf(song) * opts.speed });
    const kinds = Object.assign({}, st.kinds);
    if (opts.hushStorm) kinds.hush = 1.4;
    return NS.chart.build(song, { level: Math.max(0, Math.min(1, level + (opts.levelAdd || 0))), bars: st.bars, kinds: kinds,
      boss: st.boss ? st.boss.attacks : null, lucky: !!opts.lucky, mirror: !!opts.mirror, seed: st.index });
  }

  /* the mean accuracy of the regular and casual bots over a chart (no fail; a duel with its attacks) */
  function referenceAccuracy(chart, boss) {
    let sum = 0;
    for (const p of ['regular', 'casual']) for (const seed of [3, 11]) sum += NS.engine.accuracy(NS.bot.run(chart, { noFail: true, boss: boss || null }, p, seed));
    return sum / 4;
  }

  /* the stage's level calibrated to its target (bisection over +-0.25 around its curve) */
  const calibrated = {};
  function stageLevel(st) {
    if (calibrated[st.id] != null) return calibrated[st.id];
    let lo = Math.max(0, st.level - 0.25), hi = Math.min(1, st.level + 0.25);
    for (let k = 0; k < 7; ++k) {
      const mid = (lo + hi) / 2;
      if (referenceAccuracy(chartAt(st, mid), st.boss) > st.target) lo = mid; else hi = mid;
    }
    return (calibrated[st.id] = Math.round((lo + hi) / 2 * 1000) / 1000);
  }

  function stageChart(st, opts) {
    return chartAt(st, stageLevel(st), opts);
  }

  NS.worldData = { WORLDS, BOSSES, ATTACKS, TARGET, CURVE, GOALS, KINDS, STAGES, BY_ID, kindsFor, chartAt, referenceAccuracy, stageLevel, stageChart };
})();
