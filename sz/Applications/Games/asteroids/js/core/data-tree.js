/* Static tech tree data: five branches (Cannons, Hull, Engines, Salvage, Overdrive), 29 nodes
   with level costs in stardust, prerequisites, grid placement and the stat each level adds.
   Pure data; rules.computeStats turns owned levels into ship stats. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  const BRANCHES = [
    { id: 'cannons', name: 'Cannons', color: '#ff6a5c', icon: 'gun' },
    { id: 'hull', name: 'Hull', color: '#58c8ff', icon: 'shield' },
    { id: 'engines', name: 'Engines', color: '#ffa040', icon: 'engine' },
    { id: 'salvage', name: 'Salvage', color: '#5cff9a', icon: 'dust' },
    { id: 'overdrive', name: 'Overdrive', color: '#d08aff', icon: 'nova' },
  ];

  /* per: added per level; fmt: {p} = per*level as percent, {v} = per*level */
  const TREE = [
    { id: 'c_dmg', branch: 'cannons', name: 'Hardened Rounds', icon: 'gun', row: 0, lane: 0, stat: 'dmg', per: 0.15, fmt: '+{p}% shot damage', costs: [60, 140, 280, 480, 760], req: [] },
    { id: 'c_rate', branch: 'cannons', name: 'Cyclers', icon: 'rapid', row: 0, lane: 1, stat: 'rate', per: 0.08, fmt: '+{p}% fire rate', costs: [60, 140, 280, 480, 760], req: [] },
    { id: 'c_cap', branch: 'cannons', name: 'Magazine', icon: 'triple', row: 1, lane: 0, stat: 'bullets', per: 1, fmt: '+{v} shots in the air', costs: [120, 300, 600], req: [['c_dmg', 1]] },
    { id: 'c_vel', branch: 'cannons', name: 'Rail Coils', icon: 'pierce', row: 1, lane: 1, stat: 'shotSpeed', per: 0.12, fmt: '+{p}% shot speed and range', costs: [100, 240, 460], req: [['c_rate', 1]] },
    { id: 'c_crit', branch: 'cannons', name: 'Weak-Point Scanner', icon: 'crosshair', row: 2, lane: 0, stat: 'crit', per: 0.07, fmt: '+{p}% chance of a triple-damage critical', costs: [180, 400, 750], req: [['c_cap', 1]] },
    { id: 'c_twin', branch: 'cannons', name: 'Twin Barrels', icon: 'twin', row: 2, lane: 1, stat: 'twin', per: 1, fmt: 'Fires two parallel shots', costs: [900], req: [['c_rate', 3]] },
    { id: 'c_ricochet', branch: 'cannons', name: 'Ricochet', icon: 'homing', row: 3, lane: 0.5, stat: 'ricochet', per: 1, fmt: 'Shots bounce on to {v} more target', costs: [700, 1500], req: [['c_crit', 1], ['c_vel', 2]] },

    { id: 'h_life', branch: 'hull', name: 'Spare Hulls', icon: 'life', row: 0, lane: 0, stat: 'lives', per: 1, fmt: '+{v} ship per run', costs: [250, 900], req: [] },
    { id: 'h_invuln', branch: 'hull', name: 'Phase Plating', icon: 'shield', row: 0, lane: 1, stat: 'invuln', per: 0.5, fmt: '+{v} s of safety after a respawn', costs: [80, 200, 400], req: [] },
    { id: 'h_shield', branch: 'hull', name: 'Bulwark', icon: 'shield', row: 1, lane: 0, stat: 'startShield', per: 1, fmt: 'Start every level shielded', costs: [600], req: [['h_life', 1]] },
    { id: 'h_hyper', branch: 'hull', name: 'Jump Tuning', icon: 'hyper', row: 1, lane: 1, stat: 'hyperCd', per: 0.15, fmt: '-{p}% hyperspace cooldown', costs: [90, 220, 420], req: [['h_invuln', 1]] },
    { id: 'h_safe', branch: 'hull', name: 'Safe Jump', icon: 'hyper', row: 2, lane: 1, stat: 'safeHyper', per: 1, fmt: 'Hyperspace never lands near danger', costs: [650], req: [['h_hyper', 2]] },
    { id: 'h_last', branch: 'hull', name: 'Last Stand', icon: 'heart', row: 2, lane: 0, stat: 'lastStand', per: 1, fmt: 'Once per level, shrug off a fatal hit', costs: [1200], req: [['h_shield', 1]] },

    { id: 'e_thrust', branch: 'engines', name: 'Ion Thrust', icon: 'engine', row: 0, lane: 0, stat: 'thrust', per: 0.08, fmt: '+{p}% thrust', costs: [50, 120, 240, 420, 680], req: [] },
    { id: 'e_turn', branch: 'engines', name: 'Gyro Ring', icon: 'turn', row: 0, lane: 1, stat: 'turn', per: 0.1, fmt: '+{p}% turn rate', costs: [60, 150, 320], req: [] },
    { id: 'e_speed', branch: 'engines', name: 'Afterburners', icon: 'engine', row: 1, lane: 0, stat: 'speed', per: 0.08, fmt: '+{p}% top speed', costs: [120, 280, 520], req: [['e_thrust', 2]] },
    { id: 'e_brake', branch: 'engines', name: 'Inertial Dampers', icon: 'brake', row: 1, lane: 1, stat: 'brake', per: 0.5, fmt: '+{p}% braking (S / Down)', costs: [140, 360], req: [['e_turn', 1]] },
    { id: 'e_ram', branch: 'engines', name: 'Ram Prow', icon: 'ram', row: 2, lane: 0.5, stat: 'ram', per: 1, fmt: 'Smash rocks up to size {v} by flying into them', costs: [800, 1600], req: [['e_speed', 1], ['e_brake', 1]] },

    { id: 's_dust', branch: 'salvage', name: 'Refinery', icon: 'dust', row: 0, lane: 0, stat: 'dust', per: 0.1, fmt: '+{p}% stardust', costs: [80, 180, 340, 560, 860], req: [] },
    { id: 's_magnet', branch: 'salvage', name: 'Tractor Coils', icon: 'magnet', row: 0, lane: 1, stat: 'magnet', per: 0.4, fmt: '+{p}% pickup reach', costs: [60, 150, 300], req: [] },
    { id: 's_luck', branch: 'salvage', name: 'Lucky Find', icon: 'clover', row: 1, lane: 0, stat: 'luck', per: 0.2, fmt: '+{p}% power-up drops', costs: [150, 340, 640], req: [['s_dust', 1]] },
    { id: 's_dur', branch: 'salvage', name: 'Capacitors', icon: 'chrono', row: 1, lane: 1, stat: 'puDur', per: 0.15, fmt: '+{p}% power-up duration', costs: [120, 280, 520], req: [['s_magnet', 1]] },
    { id: 's_combo', branch: 'salvage', name: 'Chain Link', icon: 'double', row: 2, lane: 1, stat: 'combo', per: 0.4, fmt: 'Combos last +{v} s longer', costs: [160, 380, 700], req: [['s_dur', 1]] },
    { id: 's_start', branch: 'salvage', name: 'Opening Gift', icon: 'gift', row: 2, lane: 0, stat: 'startPower', per: 1, fmt: 'Start each level with a random power-up', costs: [1000], req: [['s_luck', 2]] },

    { id: 'o_rate', branch: 'overdrive', name: 'Overcharge', icon: 'nova', row: 0, lane: 0, stat: 'odRate', per: 0.2, fmt: '+{p}% overdrive charge', costs: [90, 220, 450], req: [] },
    { id: 'o_radius', branch: 'overdrive', name: 'Wide Blast', icon: 'ring', row: 0, lane: 1, stat: 'odRadius', per: 0.15, fmt: '+{p}% blast radius', costs: [90, 220, 450], req: [] },
    { id: 'o_dmg', branch: 'overdrive', name: 'Shock Yield', icon: 'blast', row: 1, lane: 0.5, stat: 'odDmg', per: 2, fmt: '+{v} blast damage', costs: [160, 380, 720], req: [['o_rate', 1], ['o_radius', 1]] },
    { id: 'o_drone', branch: 'overdrive', name: 'Wingdrones', icon: 'drone', row: 2, lane: 0, stat: 'drones', per: 1, fmt: '{v} wingdrone(s) fly with you', costs: [700, 1400], req: [['o_dmg', 1]] },
    { id: 'o_slow', branch: 'overdrive', name: 'Time Dilation', icon: 'chrono', row: 2, lane: 1, stat: 'odSlow', per: 1, fmt: 'Overdrive slows time for 2 s', costs: [850], req: [['o_dmg', 2]] },
  ];

  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i)
    TREE_BY_ID[TREE[i].id] = TREE[i];

  Object.assign(NS.treeData, {
    BRANCHES, TREE, TREE_BY_ID
  });
})();
