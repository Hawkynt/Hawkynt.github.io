/* Event tables: the golden-treat outcomes with weights and buff shapes, the seasonal carriers
   that replace the golden cookie during a season (and drop season tokens), each season's
   token-track rewards, the daily quest templates and the Daily Bake-Off modifiers. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  /* buff: kind prod/click multiplies production or clicks for `dur` seconds */
  const OUTCOMES = [
    { id: 'lucky', name: 'Lucky!', weight: 40, color: '#ffd25a', desc: 'An instant pile of treats' },
    { id: 'frenzy', name: 'Frenzy', weight: 28, color: '#ff9a4a', buff: { kind: 'prod', mult: 7, dur: 77 }, desc: 'Production x7 for 77 s' },
    { id: 'clickfrenzy', name: 'Click Frenzy', weight: 8, color: '#5ab4ff', buff: { kind: 'click', mult: 777, dur: 13 }, desc: 'Clicks x777 for 13 s' },
    { id: 'rush', name: 'Building Rush', weight: 12, color: '#7be08a', buff: { kind: 'prod', mult: 0, dur: 30 }, desc: 'Production boosted by one producer type' },
    { id: 'sugar', name: 'Sugar Rush', weight: 5, color: '#8fd0ff', desc: 'Recipe notes for the tech tree' },
    { id: 'storm', name: 'Cookie Storm', weight: 5, color: '#ffb45a', storm: 8, desc: 'Treats rain down - catch them!' },
    { id: 'comboblast', name: 'Combo Blast', weight: 6, color: '#ff5ab4', desc: 'Combo jumps to its cap' },
  ];

  /* the golden treat's look by season; seasonal carriers also drop a token */
  const CARRIERS = {
    none: { id: 'golden', name: 'Golden Cookie', names: 'Golden Cookies', token: '' },
    winter: { id: 'snowflake', name: 'Golden Snowflake', names: 'Golden Snowflakes', token: 'snowflakes' },
    spring: { id: 'egg', name: 'Painted Egg', names: 'Painted Eggs', token: 'eggs' },
    summer: { id: 'sun', name: 'Sun Drop', names: 'Sun Drops', token: 'sun drops' },
    autumn: { id: 'leaf', name: 'Golden Leaf', names: 'Golden Leaves', token: 'leaves' },
    halloween: { id: 'pumpkin', name: 'Lantern Pumpkin', names: 'Lantern Pumpkins', token: 'pumpkins' },
    yearend: { id: 'present', name: 'Year-End Present', names: 'Year-End Presents', token: 'presents' },
  };

  /* token thresholds and what each gives (notes, or a cosmetic unlocked by season) */
  const TRACK = [
    { need: 3, notes: 3 },
    { need: 10, skin: true },
    { need: 20, notes: 8 },
    { need: 35, particle: true },
    { need: 60, notes: 20 },
  ];

  /* {n} is replaced by the target */
  const QUESTS = [
    { id: 'clicks', text: 'Click the treat {n} times', min: 150, max: 600, reward: 2 },
    { id: 'golden', text: 'Catch {n} golden treats', min: 2, max: 4, reward: 3 },
    { id: 'buy', text: 'Buy {n} producers', min: 15, max: 50, reward: 2 },
    { id: 'upgrades', text: 'Buy {n} upgrades', min: 3, max: 6, reward: 2 },
    { id: 'combo', text: 'Reach a combo of {n}', min: 20, max: 60, reward: 3 },
    { id: 'bake', text: 'Bake {n} minutes of production', min: 10, max: 30, reward: 2 },
    { id: 'bakeoff', text: 'Finish {n} Bake-Off', min: 1, max: 1, reward: 4 },
  ];

  const MODIFIERS = [
    { id: 'grandma', name: 'Grandma Gala', desc: 'Grandmas bake x5', building: { grandma: 5 } },
    { id: 'golden', name: 'Golden Hour', desc: 'Golden treats appear three times as often', goldenFreq: 2 },
    { id: 'clicky', name: 'Butterfingers', desc: 'Clicks x3, producers cost 50% more', click: 3, cost: 1.5 },
    { id: 'bulk', name: 'Wholesale Day', desc: 'Producers cost 30% less', cost: 0.7 },
    { id: 'combo', name: 'Drumline', desc: 'Combo cap doubled, combos last longer', comboCap: 2, comboWindow: 0.5 },
    { id: 'cursor', name: 'Cursor Carnival', desc: 'Cursors bake x10', building: { cursor: 10 } },
    { id: 'rush', name: 'Rush Hour', desc: 'Golden buffs last twice as long', goldenDur: 1 },
  ];

  NS.eventData = { OUTCOMES, CARRIERS, TRACK, QUESTS, MODIFIERS };
})();
