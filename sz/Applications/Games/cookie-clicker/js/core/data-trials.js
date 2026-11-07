/* The Sanctum Trials: after the first ascension a bakery can be started under a rule that makes
   it harder; reaching the trial's era completes it for good. Every completed trial adds +10%
   production forever, and three and six completed trials unlock cosmetics. The rule is a set
   of run modifiers read by economy.compute, the golden spawner and purchasing. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const TRIALS = [
    { id: 'hands', name: 'Hands Off', desc: 'Clicking the treat bakes nothing. Only producers bake.', goal: 4, icon: 'hand',
      mods: { click: 0, noShare: true } },
    { id: 'strike', name: 'Grandma Strike', desc: 'Cursors and grandmas put down their tools and bake nothing.', goal: 4, icon: 'hat',
      mods: { building: { cursor: 0, grandma: 0 } } },
    { id: 'tax', name: 'Sugar Tax', desc: 'Every producer costs ten times as much.', goal: 4, icon: 'coin',
      mods: { cost: 10 } },
    { id: 'slow', name: 'Slow Oven', desc: 'Producers bake at a tenth of their speed, but clicks are ten times stronger.', goal: 4, icon: 'clock',
      mods: { prod: 0.1, click: 10 } },
    { id: 'dark', name: 'Lights Out', desc: 'No golden treats appear at all.', goal: 5, icon: 'moon',
      mods: { noGolden: true } },
    { id: 'lean', name: 'Lean Kitchen', desc: 'At most 25 of each producer.', goal: 5, icon: 'crate',
      mods: { maxEach: 25 } },
  ];

  const BY_ID = {};
  for (let i = 0; i < TRIALS.length; ++i) BY_ID[TRIALS[i].id] = TRIALS[i];

  NS.trialData = { TRIALS, BY_ID, BONUS: 0.1 };
})();
