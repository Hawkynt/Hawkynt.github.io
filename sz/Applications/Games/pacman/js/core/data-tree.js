/* The tech tree: five branches (Agility, Power, Fortune, Luck, Survival) of 25 nodes with level
   costs in shards, prerequisites and a short text per level. Effects are applied by
   rules.computeStats. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  const BRANCHES = [
    { id: 'agility', name: 'Agility', color: '#ffe23a', icon: 'speed' },
    { id: 'power', name: 'Power', color: '#4ad8ff', icon: 'pellet' },
    { id: 'fortune', name: 'Fortune', color: '#ffb43a', icon: 'shard' },
    { id: 'luck', name: 'Luck', color: '#ff7ad8', icon: 'clover' },
    { id: 'survival', name: 'Survival', color: '#5aff9a', icon: 'heart' },
  ];

  /* text(level) describes the total effect at that level */
  const TREE = [
    { id: 'a_speed', branch: 'agility', name: 'Fleet Feet', icon: 'speed', row: 0, lane: 0, costs: [40, 90, 160], req: [], text: l => 'Run ' + (l * 3) + '% faster' },
    { id: 'a_corner', branch: 'agility', name: 'Slick Turns', icon: 'turn', row: 0, lane: 1, costs: [60], req: [], text: () => 'Turn corners early and remember turns longer' },
    { id: 'a_tunnel', branch: 'agility', name: 'Tunnel Runner', icon: 'tunnel', row: 1, lane: 0, costs: [70, 140], req: [['a_speed', 1]], text: l => 'Tunnels and taffy slow you ' + (l * 25) + '% less' },
    { id: 'a_ice', branch: 'agility', name: 'Grip Soles', icon: 'boot', row: 1, lane: 1, costs: [90], req: [['a_corner', 1]], text: () => 'Steer freely on ice' },
    { id: 'a_burst', branch: 'agility', name: 'Afterglow', icon: 'flame', row: 2, lane: 0, costs: [120, 220], req: [['a_tunnel', 1]], text: l => '+' + (l * 12) + '% speed for 3 s after eating a ghost' },

    { id: 'p_fright', branch: 'power', name: 'Long Fright', icon: 'pellet', row: 0, lane: 0, costs: [50, 100, 170, 260], req: [], text: l => 'Power pellets last ' + (l * 0.75).toFixed(2).replace(/\.?0+$/, '') + ' s longer' },
    { id: 'p_gourmet', branch: 'power', name: 'Ghost Gourmet', icon: 'ghost', row: 0, lane: 1, costs: [60, 130, 220], req: [], text: l => 'Ghosts are worth ' + (l * 25) + '% more' },
    { id: 'p_slow', branch: 'power', name: 'Heavy Sheets', icon: 'snail', row: 1, lane: 0, costs: [90, 180], req: [['p_fright', 1]], text: l => 'Frightened ghosts ' + (l * 10) + '% slower' },
    { id: 'p_echo', branch: 'power', name: 'Pellet Echo', icon: 'ring', row: 1, lane: 1, costs: [200], req: [['p_gourmet', 2]], text: () => 'Each ghost eaten adds 1 s of fright' },
    { id: 'p_boss', branch: 'power', name: 'Boss Bite', icon: 'fang', row: 2, lane: 0, costs: [150, 250, 400], req: [['p_slow', 1]], text: l => (l * 33) + '% chance to bite a boss twice' },

    { id: 'f_shards', branch: 'fortune', name: 'Shard Collector', icon: 'shard', row: 0, lane: 0, costs: [60, 140, 260], req: [], text: l => '+' + (l * 15) + '% shards from every run' },
    { id: 'f_fruit', branch: 'fortune', name: 'Fruit Basket', icon: 'cherry', row: 0, lane: 1, costs: [50, 120], req: [], text: l => 'Fruit worth ' + (l * 40) + '% more and stays longer' },
    { id: 'f_combo', branch: 'fortune', name: 'Combo Keeper', icon: 'chain', row: 1, lane: 0, costs: [70, 150, 240], req: [['f_shards', 1]], text: l => 'Dot chains forgive ' + (l * 0.12).toFixed(2) + ' s more' },
    { id: 'f_token', branch: 'fortune', name: 'Season Pass', icon: 'gift', row: 1, lane: 1, costs: [100, 200], req: [['f_fruit', 1]], text: l => (l * 40) + '% chance of a bonus seasonal token' },
    { id: 'f_mult', branch: 'fortune', name: 'High Roller', icon: 'crown', row: 2, lane: 0, costs: [120, 220, 360], req: [['f_combo', 1]], text: l => 'Multiplier caps at x' + (5 + l) },

    { id: 'l_dur', branch: 'luck', name: 'Long Lasting', icon: 'hourglass', row: 0, lane: 0, costs: [50, 110, 190], req: [], text: l => 'Power-ups last ' + (l * 15) + '% longer' },
    { id: 'l_rate', branch: 'luck', name: 'Lucky Spawns', icon: 'clover', row: 0, lane: 1, costs: [60, 130, 220], req: [], text: l => 'Power-ups appear ' + (l * 12) + '% more often' },
    { id: 'l_rare', branch: 'luck', name: 'Rare Finds', icon: 'star', row: 1, lane: 0, costs: [120, 240], req: [['l_dur', 1]], text: l => 'Mega Chomp, Boo Bomb and hearts ' + (l + 1) + 'x as likely' },
    { id: 'l_start', branch: 'luck', name: 'Head Start', icon: 'box', row: 1, lane: 1, costs: [180], req: [['l_rate', 2]], text: () => 'Every maze opens with a random power-up' },
    { id: 'l_twin', branch: 'luck', name: 'Twin Drops', icon: 'twin', row: 2, lane: 0, costs: [260], req: [['l_rare', 1]], text: () => '25% chance a power-up comes in pairs' },

    { id: 's_life', branch: 'survival', name: 'Extra Heart', icon: 'heart', row: 0, lane: 0, costs: [100, 250], req: [], text: l => 'Start with ' + (3 + l) + ' lives' },
    { id: 's_shield', branch: 'survival', name: 'Bubble Start', icon: 'shield', row: 0, lane: 1, costs: [150], req: [], text: () => 'Every maze opens with a Bubble Shield' },
    { id: 's_revive', branch: 'survival', name: 'Second Wind', icon: 'wing', row: 1, lane: 0, costs: [220], req: [['s_life', 1]], text: () => 'Once per run, a caught Pac bounces back' },
    { id: 's_grace', branch: 'survival', name: 'Ghost Grace', icon: 'clock', row: 1, lane: 1, costs: [80, 160], req: [['s_shield', 1]], text: l => (l * 1.5) + ' s untouchable after respawning' },
    { id: 's_bonus', branch: 'survival', name: 'Life Bonus', icon: 'plus', row: 2, lane: 0, costs: [200], req: [['s_revive', 1]], text: () => 'Extra life every 8,000 points instead of 10,000' },
  ];
  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i) TREE_BY_ID[TREE[i].id] = TREE[i];

  Object.assign(NS.treeData, {
    BRANCHES, TREE, TREE_BY_ID
  });
})();
