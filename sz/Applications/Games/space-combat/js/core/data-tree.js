/* Static tech tree data: five branches (Weapons, Defense, Engines, Systems, Style), 36 nodes
   with level costs, prerequisites, grid placement and the stat each level adds. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  const BRANCHES = [
    { id: 'weapons', name: 'Weapons', color: '#ff6a5c', icon: 'gun' },
    { id: 'defense', name: 'Defense', color: '#58c8ff', icon: 'shield' },
    { id: 'engines', name: 'Engines', color: '#ffa040', icon: 'engine' },
    { id: 'systems', name: 'Systems', color: '#5cff9a', icon: 'radar' },
    { id: 'style', name: 'Style', color: '#d08aff', icon: 'brush' },
  ];

  /* per: stat added per level (see rules.computeStats); fmt: how one level reads */
  const TREE = [
    /* Weapons */
    { id: 'w_dmg', branch: 'weapons', name: 'Power Coupling', icon: 'gun', row: 0, lane: 0, stat: 'dmg', per: 0.08, fmt: '+{p}% weapon damage', costs: [150, 300, 520, 850, 1300], req: [] },
    { id: 'w_speed', branch: 'weapons', name: 'Mag Accelerators', icon: 'bolt', row: 0, lane: 1, stat: 'projSpeed', per: 0.1, fmt: '+{p}% shot speed and range', costs: [140, 320, 600], req: [] },
    { id: 'w_rate', branch: 'weapons', name: 'Rapid Cyclers', icon: 'rate', row: 1, lane: 0, stat: 'rate', per: 0.06, fmt: '+{p}% fire rate', costs: [220, 420, 700, 1050, 1500], req: [['w_dmg', 1]] },
    { id: 'w_crit', branch: 'weapons', name: 'Targeting Matrix', icon: 'crosshair', row: 1, lane: 1, stat: 'crit', per: 0.05, fmt: '+{p}% chance of a double-damage critical', costs: [260, 520, 900], req: [['w_speed', 1]] },
    { id: 'w_ammo', branch: 'weapons', name: 'Ordnance Racks', icon: 'missile', row: 2, lane: 0, stat: 'ammo', per: 0.25, fmt: '+{p}% secondary ammo', costs: [300, 600, 1000], req: [['w_rate', 2]] },
    { id: 'w_sec', branch: 'weapons', name: 'Warhead Yield', icon: 'blast', row: 2, lane: 1, stat: 'secDmg', per: 0.15, fmt: '+{p}% secondary damage', costs: [320, 640, 1050], req: [['w_crit', 1]] },
    { id: 'w_over', branch: 'weapons', name: 'Overcharge Capacitor', icon: 'star', row: 3, lane: 0.5, stat: 'overTime', per: 3, fmt: 'Overcharge lasts +{v} s', costs: [700, 1400], req: [['w_ammo', 1], ['w_sec', 1]] },

    /* Defense */
    { id: 'd_hull', branch: 'defense', name: 'Reinforced Hull', icon: 'hull', row: 0, lane: 0, stat: 'hull', per: 0.12, fmt: '+{p}% hull', costs: [150, 300, 520, 850, 1300], req: [] },
    { id: 'd_shield', branch: 'defense', name: 'Shield Capacitors', icon: 'shield', row: 0, lane: 1, stat: 'shield', per: 0.12, fmt: '+{p}% shield', costs: [150, 300, 520, 850, 1300], req: [] },
    { id: 'd_armor', branch: 'defense', name: 'Ablative Plating', icon: 'plate', row: 1, lane: 0, stat: 'armor', per: 0.06, fmt: '-{p}% hull damage taken', costs: [300, 620, 1000], req: [['d_hull', 2]] },
    { id: 'd_regen', branch: 'defense', name: 'Fast Recharge', icon: 'rate', row: 1, lane: 1, stat: 'regen', per: 0.2, fmt: '+{p}% shield recharge, sooner', costs: [260, 540, 900], req: [['d_shield', 1]] },
    { id: 'd_repair', branch: 'defense', name: 'Nano Repair', icon: 'wrench', row: 2, lane: 0, stat: 'repair', per: 1, fmt: 'Hull mends {v} point/s', costs: [500, 1000], req: [['d_armor', 1]] },
    { id: 'd_last', branch: 'defense', name: 'Last Stand', icon: 'heart', row: 3, lane: 0.5, stat: 'lastStand', per: 1, fmt: 'Once per mission, survive a fatal hit', costs: [1600], req: [['d_regen', 2], ['d_repair', 1]] },

    /* Engines */
    { id: 'e_thrust', branch: 'engines', name: 'Ion Thrusters', icon: 'engine', row: 0, lane: 0, stat: 'thrust', per: 0.08, fmt: '+{p}% thrust and top speed', costs: [140, 280, 500, 820, 1250], req: [] },
    { id: 'e_roll', branch: 'engines', name: 'Gyro Stabilisers', icon: 'roll', row: 0, lane: 1, stat: 'rollCd', per: 0.12, fmt: '-{p}% dodge-roll cooldown', costs: [180, 380, 700], req: [] },
    { id: 'e_boost', branch: 'engines', name: 'Heat Sinks', icon: 'heat', row: 1, lane: 0, stat: 'boostCap', per: 0.25, fmt: '+{p}% boost before overheating', costs: [220, 460, 800], req: [['e_thrust', 1]] },
    { id: 'e_grip', branch: 'engines', name: 'Vector Nozzles', icon: 'vector', row: 1, lane: 1, stat: 'grip', per: 0.18, fmt: '+{p}% grip, less drift', costs: [200, 420, 750], req: [['e_roll', 1]] },
    { id: 'e_ram', branch: 'engines', name: 'Ram Field', icon: 'blast', row: 2, lane: 1, stat: 'ram', per: 40, fmt: 'Dodge rolls deal {v} damage', costs: [600, 1200], req: [['e_roll', 2]] },
    { id: 'e_burn', branch: 'engines', name: 'Afterburner Wake', icon: 'flame', row: 2, lane: 0, stat: 'burn', per: 1, fmt: 'Boosting leaves a burning wake', costs: [1100], req: [['e_boost', 2]] },

    /* Systems */
    { id: 's_radar', branch: 'systems', name: 'Long-Range Radar', icon: 'radar', row: 0, lane: 0, stat: 'radar', per: 0.25, fmt: '+{p}% radar range', costs: [120, 260, 480], req: [] },
    { id: 's_magnet', branch: 'systems', name: 'Tractor Coils', icon: 'magnet', row: 0, lane: 1, stat: 'magnet', per: 0.4, fmt: '+{p}% pickup magnet radius', costs: [120, 260, 480], req: [] },
    { id: 's_salvage', branch: 'systems', name: 'Salvage Protocols', icon: 'scrap', row: 1, lane: 1, stat: 'salvage', per: 0.1, fmt: '+{p}% scrap earned', costs: [250, 500, 850, 1300], req: [['s_magnet', 1]] },
    { id: 's_drone', branch: 'systems', name: 'Drone AI', icon: 'drone', row: 1, lane: 0, stat: 'droneAi', per: 1, fmt: 'Drones +20% power; an escort drone at level 3', costs: [300, 650, 1200], req: [['s_radar', 1]] },
    { id: 's_ability', branch: 'systems', name: 'Special Capacitor', icon: 'star', row: 2, lane: 0, stat: 'abilityCd', per: 0.1, fmt: '-{p}% special cooldown', costs: [350, 700, 1150], req: [['s_drone', 1]] },
    { id: 's_luck', branch: 'systems', name: 'Lucky Charms', icon: 'clover', row: 2, lane: 1, stat: 'luck', per: 0.2, fmt: '+{p}% power-up drop chance', costs: [300, 600, 1000], req: [['s_salvage', 2]] },

    /* Style: cosmetic, one level each; owned entries can be equipped */
    { id: 'skin_crimson', branch: 'style', name: 'Crimson Ace', icon: 'skin', row: 0, lane: 0, style: 'skin', value: 'crimson', fmt: 'Paint scheme: Crimson Ace', costs: [250], req: [] },
    { id: 'skin_stealth', branch: 'style', name: 'Nightfall', icon: 'skin', row: 1, lane: 0, style: 'skin', value: 'stealth', fmt: 'Paint scheme: Nightfall', costs: [450], req: [['skin_crimson', 1]] },
    { id: 'skin_gold', branch: 'style', name: 'Gilded', icon: 'skin', row: 2, lane: 0, style: 'skin', value: 'gold', fmt: 'Paint scheme: Gilded', costs: [900], req: [['skin_stealth', 1]] },
    { id: 'skin_aurora', branch: 'style', name: 'Aurora', icon: 'skin', row: 3, lane: 0, style: 'skin', value: 'aurora', fmt: 'Paint scheme: Aurora', costs: [1400], req: [['skin_gold', 1]] },
    { id: 'trail_comet', branch: 'style', name: 'Comet Tail', icon: 'trail', row: 0, lane: 1, style: 'trail', value: 'comet', fmt: 'Engine trail: Comet Tail', costs: [200], req: [] },
    { id: 'trail_ember', branch: 'style', name: 'Ember Wake', icon: 'trail', row: 1, lane: 1, style: 'trail', value: 'ember', fmt: 'Engine trail: Ember Wake', costs: [500], req: [['trail_comet', 1]] },
    { id: 'trail_prism', branch: 'style', name: 'Prism Trail', icon: 'trail', row: 2, lane: 1, style: 'trail', value: 'prism', fmt: 'Engine trail: Prism', costs: [1200], req: [['trail_ember', 1]] },
    { id: 'eng_plasma', branch: 'style', name: 'Plasma Blue', icon: 'flame', row: 0, lane: 2, style: 'engine', value: 'plasma', fmt: 'Engine glow: Plasma Blue', costs: [150], req: [] },
    { id: 'eng_solar', branch: 'style', name: 'Solar Orange', icon: 'flame', row: 1, lane: 2, style: 'engine', value: 'solar', fmt: 'Engine glow: Solar Orange', costs: [300], req: [['eng_plasma', 1]] },
    { id: 'eng_viridian', branch: 'style', name: 'Viridian', icon: 'flame', row: 2, lane: 2, style: 'engine', value: 'viridian', fmt: 'Engine glow: Viridian', costs: [500], req: [['eng_solar', 1]] },
    { id: 'eng_violet', branch: 'style', name: 'Void Violet', icon: 'flame', row: 3, lane: 2, style: 'engine', value: 'violet', fmt: 'Engine glow: Void Violet', costs: [800], req: [['eng_viridian', 1]] },
  ];

  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i)
    TREE_BY_ID[TREE[i].id] = TREE[i];

  Object.assign(NS.treeData, {
    BRANCHES, TREE, TREE_BY_ID
  });
})();
