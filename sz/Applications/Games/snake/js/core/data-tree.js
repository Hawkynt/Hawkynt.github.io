/* The tech tree: five branches of upgrade nodes bought with scales. Each node has a grid slot
   (row, lane) in its branch column, a cost per level, prerequisites as [node, level] pairs, the
   stat it raises and how much per level. Pure data; rules.computeStats turns it into numbers. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  const BRANCHES = [
    { id: 'body', name: 'Body', color: '#7ee07a', icon: 'heart' },
    { id: 'senses', name: 'Senses', color: '#6fd3ff', icon: 'eye' },
    { id: 'power', name: 'Power', color: '#ffb347', icon: 'bolt' },
    { id: 'venom', name: 'Venom', color: '#b98aff', icon: 'drop' },
    { id: 'fortune', name: 'Fortune', color: '#ffd25a', icon: 'coin' },
  ];

  /* text: '{v}' is replaced by the total value at that level */
  const TREE = [
    { id: 'hide', branch: 'body', row: 0, lane: 0, name: 'Thick Hide', icon: 'shield', stat: 'shields', per: 1, costs: [80, 240], req: [], text: 'Start every level with {v} Scale Armor' },
    { id: 'wind', branch: 'body', row: 0, lane: 1, name: 'Second Wind', icon: 'heart', stat: 'iframes', per: 0.6, costs: [60, 130, 220], req: [], text: '+{v}s safety after a respawn' },
    { id: 'lives', branch: 'body', row: 1, lane: 0, name: 'Nine Lives', icon: 'heart', stat: 'lives', per: 1, costs: [140, 380], req: [['hide', 1]], text: '+{v} life in Story, Arcade and Rush' },
    { id: 'moltm', branch: 'body', row: 1, lane: 1, name: 'Molting Mastery', icon: 'molt', stat: 'moltBonus', per: 0.5, costs: [70, 170], req: [['wind', 1]], text: 'Molt scores +{p} more' },
    { id: 'thrive', branch: 'body', row: 2, lane: 0, name: 'Thrive', icon: 'leaf', stat: 'growScore', per: 0.02, costs: [160, 320, 520], req: [['lives', 1], ['moltm', 1]], text: 'Each segment of length adds +{p} to fruit score' },

    { id: 'keen', branch: 'senses', row: 0, lane: 0, name: 'Keen Nose', icon: 'eye', stat: 'extraFood', per: 1, costs: [100, 320], req: [], text: '{v} extra fruit on the board' },
    { id: 'rhythm', branch: 'senses', row: 0, lane: 1, name: 'Rhythm', icon: 'clock', stat: 'comboWindow', per: 0.5, costs: [60, 140, 260], req: [], text: 'Combo window +{v}s' },
    { id: 'frenzyc', branch: 'senses', row: 1, lane: 1, name: 'Feeding Frenzy', icon: 'star', stat: 'comboCap', per: 1, costs: [160, 420], req: [['rhythm', 2]], text: 'Combo multiplier cap +{v}x' },
    { id: 'lode', branch: 'senses', row: 1, lane: 0, name: 'Lodestone', icon: 'magnet', stat: 'magnet', per: 1, costs: [70, 150, 280], req: [['keen', 1]], text: 'Magnet +{v} cells reach and +{v}s' },
    { id: 'hunter', branch: 'senses', row: 2, lane: 0, name: 'Hunter', icon: 'fang', stat: 'critterScore', per: 0.5, costs: [120, 260], req: [['lode', 1]], text: 'Critters score +{p}' },

    { id: 'last', branch: 'power', row: 0, lane: 0, name: 'Lasting Power', icon: 'clock', stat: 'duration', per: 0.15, costs: [60, 120, 200, 320], req: [], text: 'Power-ups last +{p}' },
    { id: 'luck', branch: 'power', row: 0, lane: 1, name: 'Lucky Drops', icon: 'star', stat: 'dropRate', per: 0.12, costs: [80, 180, 320], req: [], text: 'Power-ups appear {p} sooner' },
    { id: 'shine', branch: 'power', row: 1, lane: 0, name: 'Overcharge', icon: 'sun', stat: 'radiant', per: 2, costs: [100, 240], req: [['last', 1]], text: 'Sun Shard shines +{v}s' },
    { id: 'starter', branch: 'power', row: 1, lane: 1, name: 'Head Start', icon: 'bolt', stat: 'starter', per: 1, costs: [250], req: [['luck', 1]], text: 'Begin each level with a random power-up' },
    { id: 'twin', branch: 'power', row: 2, lane: 1, name: 'Twin Drops', icon: 'rain', stat: 'twin', per: 0.25, costs: [180, 400], req: [['starter', 1]], text: '{p} chance of a second power-up' },

    { id: 'glands', branch: 'venom', row: 0, lane: 0, name: 'Venom Glands', icon: 'drop', stat: 'venom', per: 1, costs: [120], req: [], text: 'Spit venom with Space; start with 2, refill by eating' },
    { id: 'sac', branch: 'venom', row: 1, lane: 0, name: 'Bigger Sac', icon: 'drop', stat: 'venomMax', per: 2, costs: [80, 160, 280], req: [['glands', 1]], text: 'Carry +{v} more venom' },
    { id: 'quick', branch: 'venom', row: 1, lane: 1, name: 'Quick Glands', icon: 'clock', stat: 'venomRegen', per: 1, costs: [100, 200, 320], req: [['glands', 1]], text: 'Refill venom {v} fruit sooner' },
    { id: 'pierce', branch: 'venom', row: 2, lane: 0, name: 'Piercing Spit', icon: 'bolt', stat: 'pierce', per: 1, costs: [220], req: [['sac', 1]], text: 'Spit flies through what it hits' },
    { id: 'burst', branch: 'venom', row: 3, lane: 0, name: 'Toxic Burst', icon: 'quake', stat: 'burst', per: 1, costs: [300], req: [['pierce', 1]], text: 'Spit bursts in a 3 x 3 cloud' },

    { id: 'collector', branch: 'fortune', row: 0, lane: 0, name: 'Scale Collector', icon: 'coin', stat: 'scaleBonus', per: 0.1, costs: [60, 120, 200, 300, 450], req: [], text: '+{p} scales from every run' },
    { id: 'gemfind', branch: 'fortune', row: 0, lane: 1, name: 'Gem Finder', icon: 'gem', stat: 'gems', per: 0.04, costs: [80, 180, 320], req: [], text: '+{p} chance a fruit is a scale gem' },
    { id: 'touch', branch: 'fortune', row: 1, lane: 1, name: 'Golden Touch', icon: 'fang', stat: 'goldChance', per: 0.04, costs: [90, 200, 340], req: [['gemfind', 1]], text: '+{p} golden apples' },
    { id: 'festive', branch: 'fortune', row: 1, lane: 0, name: 'Festival Spirit', icon: 'gift', stat: 'tokens', per: 0.5, costs: [100, 260], req: [['collector', 1]], text: 'Festival tokens appear {p} more often' },
    { id: 'loyal', branch: 'fortune', row: 2, lane: 0, name: 'Loyal Heart', icon: 'heart', stat: 'streakBonus', per: 0.25, costs: [120, 300], req: [['festive', 1]], text: 'Daily streak gifts +{p}' },
  ];

  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i) TREE_BY_ID[TREE[i].id] = TREE[i];

  Object.assign(NS.treeData, {
    BRANCHES, TREE, TREE_BY_ID
  });
})();
