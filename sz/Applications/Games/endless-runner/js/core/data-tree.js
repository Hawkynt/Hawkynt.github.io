/* The tech tree: five branches (Power-ups, Moves, Survival, Fortune, Head Start) of levelled
   nodes bought with coins, each with its grid position, prerequisites, level count, cost curve
   and per-level effect text. The effects themselves are summed in rules.computeStats. Pure data
   plus the cost formula; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  const BRANCHES = [
    { id: 'power', name: 'Power-ups', color: '#ffd24a', icon: 'bolt' },
    { id: 'moves', name: 'Moves', color: '#5ee0ff', icon: 'wing' },
    { id: 'survival', name: 'Survival', color: '#ff6a7a', icon: 'heart' },
    { id: 'fortune', name: 'Fortune', color: '#7cff9a', icon: 'coin' },
    { id: 'start', name: 'Head Start', color: '#b48cff', icon: 'rocket' },
  ];

  /* row 0 is the root of a branch; req lists node ids that need at least one level */
  const NODES = [
    { id: 'magnetCoil', branch: 0, row: 0, name: 'Magnet Coil', max: 5, base: 120, desc: l => 'Magnet lasts ' + (8 + l * 1.5) + 's, range +' + l * 12 + '%' },
    { id: 'shieldCore', branch: 0, row: 1, name: 'Shield Core', max: 4, base: 180, req: ['magnetCoil'], desc: l => 'Shield lasts ' + (14 + l * 2) + 's' + (l >= 4 ? ', blocks two hits' : '') },
    { id: 'jetFuel', branch: 0, row: 2, name: 'Jet Fuel', max: 4, base: 260, req: ['shieldCore'], desc: l => 'Jetpack and Rocket last +' + l * 18 + '%' },
    { id: 'titanSerum', branch: 0, row: 3, name: 'Titan Serum', max: 4, base: 300, req: ['jetFuel'], desc: l => 'Giant, Ghost and Slow-Mo last +' + l * 15 + '%' },
    { id: 'powerSense', branch: 0, row: 4, name: 'Power Sense', max: 3, base: 520, req: ['titanSerum'], desc: l => 'Power-ups appear ' + l * 10 + '% more often' },

    { id: 'dashJets', branch: 1, row: 0, name: 'Dash Jets', max: 4, base: 140, desc: l => 'Dash recharges in ' + (1.6 - l * 0.18).toFixed(2) + 's' },
    { id: 'slideMaster', branch: 1, row: 1, name: 'Slide Mastery', max: 3, base: 160, req: ['dashJets'], desc: l => 'Slides last ' + (0.6 + l * 0.1).toFixed(1) + 's' },
    { id: 'springLegs', branch: 1, row: 2, name: 'Spring Legs', max: 3, base: 260, req: ['slideMaster'], desc: l => 'Jumps ' + l * 3 + '% higher' },
    { id: 'longDash', branch: 1, row: 3, name: 'Long Dash', max: 3, base: 320, req: ['springLegs'], desc: l => 'Dashes last ' + (0.22 + l * 0.04).toFixed(2) + 's' },
    { id: 'tripleJump', branch: 1, row: 4, name: 'Triple Jump', max: 1, base: 1800, req: ['longDash'], desc: l => l ? 'A third jump in the air' : 'Unlocks a third air jump' },

    { id: 'phoenix', branch: 2, row: 0, name: 'Phoenix Reserve', max: 2, base: 400, desc: l => 'Start every run with ' + l + ' revive' + (l === 1 ? '' : 's') },
    { id: 'guardian', branch: 2, row: 1, name: 'Guardian Angel', max: 1, base: 600, req: ['phoenix'], desc: l => 'The first hit of every run is forgiven' },
    { id: 'secondWind', branch: 2, row: 2, name: 'Second Wind', max: 3, base: 250, req: ['guardian'], desc: l => 'After a revive: ' + (2 + l * 0.6).toFixed(1) + 's untouchable' },
    { id: 'startShield', branch: 2, row: 3, name: 'Opening Shield', max: 1, base: 900, req: ['secondWind'], desc: l => 'Start every run with a Shield' },
    { id: 'zenGarden', branch: 2, row: 4, name: 'Calm Mind', max: 3, base: 300, req: ['startShield'], desc: l => 'Zen pays ' + (50 + l * 15) + '% of normal coins' },

    { id: 'coinValue', branch: 3, row: 0, name: 'Golden Touch', max: 5, base: 150, desc: l => 'Coins are worth +' + l * 10 + '%' },
    { id: 'gemFinder', branch: 3, row: 1, name: 'Gem Finder', max: 3, base: 240, req: ['coinValue'], desc: l => l * 4 + '% of coins become gems' },
    { id: 'comboKeep', branch: 3, row: 2, name: 'Combo Keeper', max: 4, base: 200, req: ['gemFinder'], desc: l => 'Combos last ' + (2.6 + l * 0.3).toFixed(1) + 's' },
    { id: 'nearMiss', branch: 3, row: 3, name: 'Daredevil', max: 3, base: 260, req: ['comboKeep'], desc: l => 'Near misses score +' + l * 30 + '%' },
    { id: 'comboCap', branch: 3, row: 4, name: 'Frenzy', max: 1, base: 1500, req: ['nearMiss'], desc: l => 'Combo multiplier goes up to x5' },

    { id: 'headStart', branch: 4, row: 0, name: 'Head Start', max: 3, base: 260, desc: l => l ? 'Rocket through the first ' + l * 150 + ' m' : 'Rocket through the start' },
    { id: 'scoreBoost', branch: 4, row: 1, name: 'Score Boost', max: 5, base: 200, req: ['headStart'], desc: l => 'All scores +' + l * 5 + '%' },
    { id: 'luckyStart', branch: 4, row: 2, name: 'Lucky Start', max: 1, base: 700, req: ['scoreBoost'], desc: l => 'Start with a random power-up' },
    { id: 'xpBoost', branch: 4, row: 3, name: 'Fast Learner', max: 3, base: 350, req: ['luckyStart'], desc: l => 'Runner XP +' + l * 15 + '%' },
    { id: 'treasure', branch: 4, row: 4, name: 'Treasure Hunter', max: 2, base: 800, req: ['xpBoost'], desc: l => 'Bosses and stars pay +' + l * 25 + '%' },
  ];

  const NODE_BY_ID = {};
  for (let i = 0; i < NODES.length; ++i) NODE_BY_ID[NODES[i].id] = NODES[i];

  /* coins for the next level of a node at level l */
  function cost(node, l) {
    return Math.round(node.base * Math.pow(1.75, l) / 10) * 10;
  }

  Object.assign(NS.treeData, {
    BRANCHES, NODES, NODE_BY_ID, cost
  });
})();
