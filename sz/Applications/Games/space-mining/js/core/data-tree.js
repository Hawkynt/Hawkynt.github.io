/* Static tech tree data on two pages: the ship (Drilling, Engines, Logistics, Automation,
   Defense, Science) and the colony (Construction, Fortification, Fleet, Biosecurity, Industry),
   52 nodes bought with research data, with level costs, prerequisites, grid placement and the
   stat each level adds (see rules.computeStats). Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const BRANCHES = [
    { id: 'drilling', name: 'Drilling', color: '#ff8a3a', icon: 'laser' },
    { id: 'engines', name: 'Engines', color: '#4fc3ff', icon: 'engine' },
    { id: 'logistics', name: 'Logistics', color: '#ffd25a', icon: 'cargo' },
    { id: 'automation', name: 'Automation', color: '#5cff9a', icon: 'drone' },
    { id: 'defense', name: 'Defense', color: '#ff5c8a', icon: 'shield' },
    { id: 'science', name: 'Science', color: '#b48aff', icon: 'scan' },
    { id: 'construction', name: 'Construction', color: '#ffb44a', icon: 'station', page: 1 },
    { id: 'fortification', name: 'Fortify', color: '#ff5c6c', icon: 'turret', page: 1 },
    { id: 'fleet', name: 'Fleet', color: '#4fd8ff', icon: 'fighter', page: 1 },
    { id: 'biosecurity', name: 'Biosecurity', color: '#9ae04a', icon: 'serum', page: 1 },
    { id: 'industry', name: 'Industry', color: '#ffd25a', icon: 'refinery', page: 1 },
  ];
  for (let i = 0; i < BRANCHES.length; ++i) BRANCHES[i].page = BRANCHES[i].page || 0;
  const PAGES = ['Ship', 'Colony'];

  /* per: amount one level adds to `stat`; fmt: {p} = per as percent, {v} = per as a value */
  const TREE = [
    /* Drilling */
    { id: 'd_focus', branch: 'drilling', name: 'Focusing Lens', icon: 'laser', row: 0, lane: 0, stat: 'laserMul', per: 0.1, fmt: '+{p}% laser power', costs: [2, 3, 5, 8, 12], req: [] },
    { id: 'd_yield', branch: 'drilling', name: 'Thermal Fracture', icon: 'crack', row: 0, lane: 1, stat: 'yieldMul', per: 0.12, fmt: '+{p}% ore from every fracture', costs: [3, 5, 8, 12], req: [] },
    { id: 'd_crit', branch: 'drilling', name: 'Fault Finder', icon: 'crosshair', row: 1, lane: 0, stat: 'crit', per: 0.07, fmt: '+{p}% chance of a fault crack (triple damage)', costs: [4, 7, 11], req: [['d_focus', 2]] },
    { id: 'd_chip', branch: 'drilling', name: 'Chip Collectors', icon: 'nugget', row: 1, lane: 1, stat: 'chip', per: 0.35, fmt: '+{p}% ore chipped off while drilling', costs: [4, 7, 11], req: [['d_yield', 1]] },
    { id: 'd_twin', branch: 'drilling', name: 'Split Beam', icon: 'split', row: 2, lane: 0, stat: 'twin', per: 0.35, fmt: 'A second beam drills a nearby rock at {p}% power', costs: [10, 16], req: [['d_crit', 1]] },
    { id: 'd_seismic', branch: 'drilling', name: 'Seismic Charge', icon: 'blast', row: 2, lane: 1, stat: 'seismic', per: 1, fmt: 'C drops a charge that shatters rocks ({v} per trip)', costs: [8, 12, 18], req: [['d_chip', 1]] },

    /* Engines */
    { id: 'e_thrust', branch: 'engines', name: 'Ion Injectors', icon: 'engine', row: 0, lane: 0, stat: 'thrustMul', per: 0.08, fmt: '+{p}% thrust and top speed', costs: [2, 3, 5, 8, 12], req: [] },
    { id: 'e_eff', branch: 'engines', name: 'Lean Burn', icon: 'fuel', row: 0, lane: 1, stat: 'fuelEff', per: 0.1, fmt: '-{p}% fuel burned', costs: [2, 4, 7, 11], req: [] },
    { id: 'e_boost', branch: 'engines', name: 'Afterburner', icon: 'flame', row: 1, lane: 0, stat: 'boost', per: 1, fmt: 'Shift boosts; level {v} burns cooler', costs: [3, 6, 10], req: [['e_thrust', 1]] },
    { id: 'e_grip', branch: 'engines', name: 'Vector Vanes', icon: 'vector', row: 1, lane: 1, stat: 'grip', per: 0.25, fmt: '+{p}% braking and grip', costs: [3, 5, 9], req: [['e_eff', 1]] },
    { id: 'e_warp', branch: 'engines', name: 'Emergency Jump', icon: 'warp', row: 2, lane: 0.5, stat: 'jump', per: 1, fmt: 'Out of fuel or hull, jump home with 85% of the hold', costs: [14], req: [['e_boost', 1], ['e_grip', 1]] },

    /* Logistics */
    { id: 'l_hold', branch: 'logistics', name: 'Bulk Holds', icon: 'cargo', row: 0, lane: 0, stat: 'cargoMul', per: 0.1, fmt: '+{p}% hold space', costs: [2, 3, 5, 8, 12], req: [] },
    { id: 'l_tractor', branch: 'logistics', name: 'Graviton Coils', icon: 'tractor', row: 0, lane: 1, stat: 'tractorMul', per: 0.2, fmt: '+{p}% tractor reach', costs: [2, 4, 7, 10], req: [] },
    { id: 'l_compress', branch: 'logistics', name: 'Ore Compactor', icon: 'compress', row: 1, lane: 0, stat: 'compress', per: 1, fmt: 'Iron, ice and copper take half the space', costs: [9], req: [['l_hold', 2]] },
    { id: 'l_broker', branch: 'logistics', name: 'Broker Network', icon: 'trade', row: 1, lane: 1, stat: 'priceMul', per: 0.04, fmt: '+{p}% sale prices', costs: [3, 5, 8, 12], req: [['l_tractor', 1]] },
    { id: 'l_contract', branch: 'logistics', name: 'Contract Office', icon: 'contract', row: 2, lane: 0.5, stat: 'contracts', per: 1, fmt: '+{v} contract slot, +15% contract pay per level', costs: [6, 12], req: [['l_compress', 1], ['l_broker', 1]] },

    /* Automation */
    { id: 'a_drone', branch: 'automation', name: 'Drone Protocols', icon: 'drone', row: 0, lane: 0, stat: 'drones', per: 1, fmt: '+{v} mining drone', costs: [5, 12], req: [] },
    { id: 'a_speed', branch: 'automation', name: 'Drone Thrusters', icon: 'engine', row: 0, lane: 1, stat: 'droneSpeed', per: 0.2, fmt: '+{p}% drone speed', costs: [3, 5, 8], req: [] },
    { id: 'a_laser', branch: 'automation', name: 'Drone Cutters', icon: 'laser', row: 1, lane: 0, stat: 'droneLaser', per: 0.3, fmt: '+{p}% drone laser power', costs: [3, 6, 9], req: [['a_drone', 1]] },
    { id: 'a_haul', branch: 'automation', name: 'Drone Baskets', icon: 'cargo', row: 1, lane: 1, stat: 'droneHaul', per: 2, fmt: 'Drones carry {v} more units per run', costs: [3, 6, 9], req: [['a_speed', 1]] },
    { id: 'a_armor', branch: 'automation', name: 'Drone Plating', icon: 'hull', row: 2, lane: 0, stat: 'droneArmor', per: 0.5, fmt: '+{p}% drone toughness', costs: [4, 8], req: [['a_laser', 1]] },
    { id: 'a_smart', branch: 'automation', name: 'Prospector AI', icon: 'chip', row: 2, lane: 1, stat: 'smartDrones', per: 1, fmt: 'Drones seek the most valuable rocks', costs: [8], req: [['a_haul', 1]] },

    /* Defense */
    { id: 'f_shield', branch: 'defense', name: 'Deflector', icon: 'shield', row: 0, lane: 0, stat: 'shield', per: 25, fmt: '+{v} shield that recharges', costs: [3, 5, 8, 12], req: [] },
    { id: 'f_impact', branch: 'defense', name: 'Impact Dampers', icon: 'hull', row: 0, lane: 1, stat: 'impact', per: 0.2, fmt: '-{p}% collision damage', costs: [2, 4, 7], req: [] },
    { id: 'f_turret', branch: 'defense', name: 'Point Defense', icon: 'turret', row: 1, lane: 0, stat: 'turret', per: 1, fmt: 'An auto-turret shoots pirates (level {v})', costs: [5, 9, 14], req: [['f_shield', 1]] },
    { id: 'f_rad', branch: 'defense', name: 'Lead Lining', icon: 'rad', row: 1, lane: 1, stat: 'radResist', per: 0.25, fmt: '-{p}% radiation and storm damage', costs: [3, 6, 9], req: [['f_impact', 1]] },
    { id: 'f_blast', branch: 'defense', name: 'Blast Baffles', icon: 'blast', row: 2, lane: 0.5, stat: 'blastResist', per: 0.3, fmt: '-{p}% explosion damage', costs: [5, 9], req: [['f_turret', 1], ['f_rad', 1]] },

    /* Science */
    { id: 's_scan', branch: 'science', name: 'Scanner Pulse', icon: 'scan', row: 0, lane: 0, stat: 'scan', per: 1, fmt: 'Q pings the belt; level {v} reaches further', costs: [2, 4, 7, 11], req: [] },
    { id: 's_data', branch: 'science', name: 'Data Mining', icon: 'data', row: 0, lane: 1, stat: 'dataMul', per: 0.25, fmt: '+{p}% research data', costs: [3, 5, 8], req: [] },
    { id: 's_rare', branch: 'science', name: 'Spectral Filter', icon: 'gem', row: 1, lane: 0, stat: 'rare', per: 0.2, fmt: '+{p}% rare ore in new rocks', costs: [4, 7, 11], req: [['s_scan', 1]] },
    { id: 's_geode', branch: 'science', name: 'Geode Sense', icon: 'geode', row: 1, lane: 1, stat: 'geode', per: 0.35, fmt: '+{p}% chance of geodes and derelicts', costs: [5, 9], req: [['s_data', 1]] },
    { id: 's_salvage', branch: 'science', name: 'Xeno Salvage', icon: 'derelict', row: 2, lane: 0.5, stat: 'salvage', per: 0.5, fmt: '+{p}% loot from derelicts and pirates', costs: [7, 12], req: [['s_rare', 1], ['s_geode', 1]] },

    /* Construction */
    { id: 'c_build', branch: 'construction', name: 'Rapid Assembly', icon: 'wrench', row: 0, lane: 0, stat: 'buildSpeed', per: 0.25, fmt: '+{p}% construction speed', costs: [2, 4, 7], req: [] },
    { id: 'c_armor', branch: 'construction', name: 'Reinforced Frames', icon: 'hull', row: 0, lane: 1, stat: 'buildingHp', per: 0.2, fmt: '+{p}% building hit points', costs: [3, 5, 8], req: [] },
    { id: 'c_cost', branch: 'construction', name: 'Modular Kits', icon: 'cargo', row: 1, lane: 0, stat: 'buildCost', per: 0.08, fmt: '-{p}% building costs', costs: [4, 7], req: [['c_build', 1]] },
    { id: 'c_grid', branch: 'construction', name: 'Wide Grid', icon: 'relay', row: 1, lane: 1, stat: 'linkRange', per: 1, fmt: '+{v} cells of link range', costs: [5, 9], req: [['c_armor', 1]] },

    /* Fortification */
    { id: 't_dmg', branch: 'fortification', name: 'Hardpoints', icon: 'turret', row: 0, lane: 0, stat: 'turretDmg', per: 0.15, fmt: '+{p}% turret damage', costs: [3, 5, 8, 12], req: [] },
    { id: 't_range', branch: 'fortification', name: 'Fire Control', icon: 'crosshair', row: 0, lane: 1, stat: 'turretRange', per: 0.1, fmt: '+{p}% turret range', costs: [3, 6, 9], req: [] },
    { id: 't_shield', branch: 'fortification', name: 'Aegis Lattice', icon: 'shield', row: 1, lane: 0, stat: 'shieldMul', per: 0.3, fmt: '+{p}% shield dome strength', costs: [5, 9], req: [['t_dmg', 1]] },
    { id: 't_repair', branch: 'fortification', name: 'Nanite Foam', icon: 'wrench', row: 1, lane: 1, stat: 'repairMul', per: 0.4, fmt: '+{p}% repair speed', costs: [4, 7], req: [['t_range', 1]] },

    /* Fleet */
    { id: 'u_hp', branch: 'fleet', name: 'Composite Hulls', icon: 'hull', row: 0, lane: 0, stat: 'unitHp', per: 0.15, fmt: '+{p}% unit hit points', costs: [3, 5, 8], req: [] },
    { id: 'u_dmg', branch: 'fleet', name: 'Weapon Tuning', icon: 'laser', row: 0, lane: 1, stat: 'unitDmg', per: 0.15, fmt: '+{p}% unit damage', costs: [3, 5, 8], req: [] },
    { id: 'u_speed', branch: 'fleet', name: 'Formation Drives', icon: 'fWedge', row: 1, lane: 0, stat: 'unitSpeed', per: 0.1, fmt: '+{p}% unit speed', costs: [3, 6], req: [['u_hp', 1]] },
    { id: 'u_cap', branch: 'fleet', name: 'Crew Quarters', icon: 'habitat', row: 1, lane: 1, stat: 'supply', per: 4, fmt: '+{v} fleet supply', costs: [4, 8], req: [['u_dmg', 1]] },

    /* Biosecurity */
    { id: 'b_vaccine', branch: 'biosecurity', name: 'Vaccine Program', icon: 'serum', row: 0, lane: 0, stat: 'vaccine', per: 0.25, fmt: '-{p}% infection spread and growth', costs: [3, 6, 10], req: [] },
    { id: 'b_firewall', branch: 'biosecurity', name: 'Firewall Kernels', icon: 'glitch', row: 0, lane: 1, stat: 'firewall', per: 0.25, fmt: '-{p}% nanoprobe corruption', costs: [4, 7, 11], req: [] },
    { id: 'b_scan', branch: 'biosecurity', name: 'Cargo Scanners', icon: 'scan', row: 1, lane: 0, stat: 'cargoScan', per: 1, fmt: 'Docking cargo is always scanned for spores', costs: [6], req: [['b_vaccine', 1]] },
    { id: 'b_emp', branch: 'biosecurity', name: 'Purge Pulse', icon: 'blast', row: 1, lane: 1, stat: 'emp', per: 1, fmt: 'The hub can fire an EMP that purges corruption nearby', costs: [7], req: [['b_firewall', 1]] },

    /* Industry */
    { id: 'i_extract', branch: 'industry', name: 'Deep Drills', icon: 'drill', row: 0, lane: 0, stat: 'extract', per: 0.2, fmt: '+{p}% rig, siphon and harvester output', costs: [2, 4, 7], req: [] },
    { id: 'i_smelt', branch: 'industry', name: 'Arc Furnaces', icon: 'refinery', row: 0, lane: 1, stat: 'process', per: 0.2, fmt: '+{p}% smelting and fabrication speed', costs: [3, 5, 8], req: [] },
    { id: 'i_storage', branch: 'industry', name: 'Compression Racks', icon: 'compress', row: 1, lane: 0, stat: 'storageMul', per: 0.25, fmt: '+{p}% outpost storage', costs: [3, 6], req: [['i_extract', 1]] },
    { id: 'i_power', branch: 'industry', name: 'Power Routing', icon: 'bolt', row: 1, lane: 1, stat: 'powerMul', per: 0.1, fmt: '+{p}% power output', costs: [4, 7, 10], req: [['i_smelt', 1]] },
  ];

  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i) TREE_BY_ID[TREE[i].id] = TREE[i];

  Object.assign(NS.treeData, {
    BRANCHES, PAGES, TREE, TREE_BY_ID
  });
})();
