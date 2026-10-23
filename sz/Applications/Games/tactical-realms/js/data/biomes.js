;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).biomes || (TR._pending.biomes = []);
  TR._pending.biomes.push(

    // -- Material Plane Biomes ----------------------------------------------

    {
      id: 'arctic_tundra',
      name: 'Arctic Tundra',
      terrainWeights: { snow: 35, tundra: 30, ice: 10, shallow_water: 5, hill: 10, road: 5, plains: 5 },
      encounterTable: ['winter_wolf', 'frost_giant', 'remorhaz', 'bear_polar', 'mephit_ice', 'white_dragon_wyrmling', 'white_dragon_juvenile'],
      planes: ['material'],
    },
    {
      id: 'arctic_glacier',
      name: 'Arctic Glacier',
      terrainWeights: { ice: 50, snow: 25, mountain_peak: 5, pit: 5, cave_floor: 10, shallow_water: 5 },
      encounterTable: ['frost_giant', 'white_dragon_young', 'white_dragon_adult', 'white_dragon_old', 'mephit_ice', 'remorhaz', 'ice_devil'],
      planes: ['material'],
    },
    {
      id: 'desert_sand',
      name: 'Sand Desert',
      terrainWeights: { desert_sand: 55, desert_rock: 15, road: 5, hill: 10, pit: 5, ruins: 5, shallow_water: 5 },
      encounterTable: ['mummy', 'blue_dragon_wyrmling', 'blue_dragon_juvenile', 'blue_dragon_adult', 'giant_scorpion_large', 'mephit_dust', 'gnoll', 'giant_scorpion_medium'],
      planes: ['material'],
    },
    {
      id: 'desert_rock',
      name: 'Rock Desert',
      terrainWeights: { desert_rock: 45, desert_sand: 20, hill: 15, mountain: 5, road: 5, cave_floor: 5, rubble: 5 },
      encounterTable: ['basilisk', 'manticore', 'gnoll', 'hyena', 'medusa', 'blue_dragon_young', 'blue_dragon_adult', 'bulette'],
      planes: ['material'],
    },
    {
      id: 'temperate_forest',
      name: 'Temperate Forest',
      terrainWeights: { forest_light: 30, forest_dense: 25, plains: 15, hill: 5, road: 10, shallow_water: 5, bridge: 5, rubble: 5 },
      encounterTable: ['wolf', 'dire_wolf', 'bear_black', 'owlbear', 'treant', 'dryad', 'ettercap', 'green_dragon_wyrmling', 'green_dragon_juvenile', 'green_dragon_adult'],
      planes: ['material'],
    },
    {
      id: 'tropical_jungle',
      name: 'Tropical Jungle',
      terrainWeights: { jungle: 40, forest_dense: 20, shallow_water: 10, swamp: 10, hill: 5, road: 5, rubble: 5, plains: 5 },
      encounterTable: ['yuan_ti_pureblood', 'dire_ape', 'giant_constrictor_snake', 'shambling_mound', 'lizardfolk', 'green_dragon_young', 'green_dragon_adult', 'tiger', 'assassin_vine'],
      planes: ['material'],
    },
    {
      id: 'temperate_plains',
      name: 'Temperate Plains',
      terrainWeights: { plains: 45, hill: 15, forest_light: 10, road: 15, shallow_water: 5, bridge: 5, rubble: 5 },
      encounterTable: ['wolf', 'goblin', 'kobold', 'bandit', 'gnoll', 'ankheg', 'bulette'],
      planes: ['material'],
    },
    {
      id: 'swamp',
      name: 'Swamp',
      terrainWeights: { swamp: 35, marsh: 20, shallow_water: 20, forest_light: 5, hill: 5, road: 5, bridge: 5, rubble: 5 },
      encounterTable: ['lizardfolk', 'troll', 'will_o_wisp', 'night_hag', 'shambling_mound', 'black_dragon_wyrmling', 'black_dragon_juvenile', 'black_dragon_adult', 'hydra_5', 'hydra_7'],
      planes: ['material'],
    },
    {
      id: 'marsh',
      name: 'Marsh',
      terrainWeights: { marsh: 40, shallow_water: 20, plains: 15, swamp: 10, road: 5, bridge: 5, forest_light: 5 },
      encounterTable: ['lizardfolk', 'stirge', 'toad', 'will_o_wisp', 'crocodile', 'crocodile_giant', 'troglodyte'],
      planes: ['material'],
    },
    {
      id: 'mountain',
      name: 'Mountain',
      terrainWeights: { mountain: 30, mountain_peak: 10, hill: 20, cave_floor: 10, pit: 5, road: 5, plains: 10, rubble: 5, stalagmites: 5 },
      encounterTable: ['hill_giant', 'stone_giant', 'griffon', 'wyvern', 'red_dragon_wyrmling', 'red_dragon_juvenile', 'red_dragon_adult', 'chimera'],
      planes: ['material'],
    },
    {
      id: 'hill',
      name: 'Hill Country',
      terrainWeights: { hill: 35, plains: 25, forest_light: 10, road: 10, mountain: 5, cave_floor: 5, rubble: 5, shallow_water: 5 },
      encounterTable: ['ogre', 'goblin', 'hobgoblin', 'hill_giant', 'worg', 'ettin', 'troll'],
      planes: ['material'],
    },
    {
      id: 'underground',
      name: 'Underdark',
      terrainWeights: { dungeon_floor: 25, dungeon_corridor: 15, cave_floor: 20, stalagmites: 10, stone_wall: 10, rubble: 5, pit: 5, earth_packed: 5, shallow_water: 5 },
      encounterTable: ['drow_warrior', 'mind_flayer', 'beholder', 'umber_hulk', 'drider', 'duergar_warrior', 'purple_worm', 'aboleth', 'grick', 'carrion_crawler'],
      planes: ['material'],
    },
    {
      id: 'underwater_reef',
      name: 'Underwater Reef',
      terrainWeights: { coral_reef: 40, seabed: 20, shallow_water: 20, deep_water: 10, rubble: 10 },
      encounterTable: ['sahuagin', 'nixie', 'shark_medium', 'octopus', 'water_elemental_medium', 'water_elemental_large'],
      planes: ['material'],
    },
    {
      id: 'underwater_deep',
      name: 'Deep Ocean',
      terrainWeights: { deep_water: 45, seabed: 30, coral_reef: 5, pit: 10, rubble: 10 },
      encounterTable: ['kraken', 'aboleth', 'sahuagin', 'squid', 'shark_huge', 'water_elemental_huge'],
      planes: ['material'],
    },
    {
      id: 'lava_field',
      name: 'Lava Field',
      terrainWeights: { lava: 30, magma: 15, fire_ground: 20, desert_rock: 15, rubble: 10, pit: 5, mountain: 5 },
      encounterTable: ['fire_elemental', 'fire_giant', 'salamander_average', 'mephit_magma', 'red_dragon_young', 'red_dragon_adult', 'efreeti'],
      planes: ['material', 'elemental_fire'],
    },
    {
      id: 'ash_waste',
      name: 'Ash Waste',
      terrainWeights: { desert_sand: 25, desert_rock: 20, rubble: 20, fire_ground: 10, lava: 5, hill: 10, pit: 5, road: 5 },
      encounterTable: ['fire_elemental', 'mephit_dust', 'mephit_magma', 'salamander_average', 'bodak', 'skeleton'],
      planes: ['material'],
    },

    // -- Transitive / Planar Biomes -----------------------------------------

    {
      id: 'cloud',
      name: 'Cloud Realm',
      terrainWeights: { cloud: 50, air_open: 35, ice: 5, celestial_garden: 5, pit: 5 },
      encounterTable: ['air_elemental_large', 'djinni', 'cloud_giant', 'pegasus', 'silver_dragon_young', 'silver_dragon_adult'],
      planes: ['elemental_air'],
    },
    {
      id: 'shadow',
      name: 'Shadowfell',
      terrainWeights: { shadow_ground: 50, dungeon_floor: 15, rubble: 10, pit: 5, swamp: 5, forest_dense: 10, cave_floor: 5 },
      encounterTable: ['shadow', 'wraith', 'spectre', 'howler', 'allip', 'bodak'],
      planes: ['shadow'],
    },
    {
      id: 'astral_void',
      name: 'Astral Void',
      terrainWeights: { astral_void: 80, cloud: 5, ethereal_mist: 5, celestial_garden: 5, infernal_waste: 5 },
      encounterTable: ['githyanki_warrior', 'githzerai_monk', 'mind_flayer', 'intellect_devourer', 'silver_dragon_adult'],
      planes: ['astral'],
    },
    {
      id: 'ethereal_mist',
      name: 'Ethereal Mist',
      terrainWeights: { ethereal_mist: 70, shadow_ground: 10, cloud: 10, plains: 5, dungeon_floor: 5 },
      encounterTable: ['phasm', 'phase_spider', 'ethereal_filcher', 'night_hag', 'allip', 'spectre'],
      planes: ['ethereal'],
    },

    // -- Outer / Alignment Planes -------------------------------------------

    {
      id: 'infernal_waste',
      name: 'Infernal Waste',
      terrainWeights: { infernal_waste: 40, fire_ground: 15, lava: 15, rubble: 10, pit: 10, desert_rock: 5, iron_door: 5 },
      encounterTable: ['lemure', 'imp', 'pit_fiend', 'erinyes', 'horned_devil', 'ice_devil', 'bearded_devil', 'barbed_devil', 'bone_devil', 'hellcat'],
      planes: ['nine_hells', 'gehenna'],
    },
    {
      id: 'celestial_garden',
      name: 'Celestial Garden',
      terrainWeights: { celestial_garden: 45, plains: 20, forest_light: 15, shallow_water: 5, road: 10, cloud: 5 },
      encounterTable: ['unicorn', 'pegasus', 'griffon', 'lion', 'gold_dragon_young', 'gold_dragon_adult', 'inevitable_zelekhut'],
      planes: ['mount_celestia', 'elysium', 'bytopia'],
    },
    {
      id: 'feywild_grove',
      name: 'Feywild Grove',
      terrainWeights: { feywild_grove: 35, forest_dense: 20, forest_light: 15, shallow_water: 10, plains: 10, hill: 5, bridge: 5 },
      encounterTable: ['dryad', 'satyr', 'pixie', 'nymph', 'treant', 'unicorn', 'sprite', 'grig', 'quickling', 'redcap', 'green_dragon_juvenile'],
      planes: ['arborea', 'beastlands'],
    },
    {
      id: 'abyss',
      name: 'The Abyss',
      terrainWeights: { infernal_waste: 25, lava: 15, pit: 15, rubble: 15, shadow_ground: 10, fire_ground: 10, deep_water: 5, magma: 5 },
      encounterTable: ['dretch', 'vrock', 'balor', 'marilith', 'hezrou', 'glabrezu', 'quasit', 'babau', 'succubus', 'nalfeshnee'],
      planes: ['abyss'],
    },

    // -- Elemental Biomes ---------------------------------------------------

    {
      id: 'elemental_fire',
      name: 'Elemental Fire',
      terrainWeights: { fire_ground: 35, lava: 30, magma: 15, desert_rock: 10, pit: 5, infernal_waste: 5 },
      encounterTable: ['fire_elemental', 'efreeti', 'salamander_average', 'salamander_noble', 'mephit_magma', 'mephit_fire', 'azer', 'red_dragon_adult'],
      planes: ['elemental_fire'],
    },
    {
      id: 'elemental_water',
      name: 'Elemental Water',
      terrainWeights: { deep_water: 40, shallow_water: 25, seabed: 15, coral_reef: 10, ice: 5, ethereal_mist: 5 },
      encounterTable: ['water_elemental_medium', 'water_elemental_large', 'marid', 'mephit_water', 'tojanida_juvenile', 'tojanida_adult', 'tojanida_elder'],
      planes: ['elemental_water'],
    },
    {
      id: 'elemental_earth',
      name: 'Elemental Earth',
      terrainWeights: { earth_packed: 35, cave_floor: 20, stalagmites: 15, stone_wall: 10, rubble: 10, pit: 5, mountain: 5 },
      encounterTable: ['earth_elemental_medium', 'earth_elemental_large', 'dao', 'xorn_minor', 'xorn_average', 'xorn_elder', 'mephit_earth', 'umber_hulk'],
      planes: ['elemental_earth'],
    },
    {
      id: 'elemental_air',
      name: 'Elemental Air',
      terrainWeights: { air_open: 45, cloud: 35, ice: 5, ethereal_mist: 5, pit: 5, celestial_garden: 5 },
      encounterTable: ['air_elemental_medium', 'air_elemental_large', 'djinni', 'mephit_air', 'invisible_stalker', 'silver_dragon_adult'],
      planes: ['elemental_air'],
    },
    {
      id: 'mechanus_grid',
      name: 'Mechanus Grid',
      terrainWeights: { mechanus_grid: 60, dungeon_floor: 15, iron_door: 5, road: 10, rubble: 5, pit: 5 },
      encounterTable: ['inevitable_marut', 'inevitable_kolyarut', 'inevitable_zelekhut', 'iron_cobra', 'shield_guardian', 'clay_golem', 'stone_golem', 'iron_golem'],
      planes: ['mechanus'],
    },

  );
})();
