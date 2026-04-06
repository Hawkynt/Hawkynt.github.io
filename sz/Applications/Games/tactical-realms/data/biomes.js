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
      encounterTable: ['winter_wolf', 'frost_giant', 'remorhaz', 'polar_bear', 'ice_mephit', 'yeti'],
      planes: ['material'],
    },
    {
      id: 'arctic_glacier',
      name: 'Arctic Glacier',
      terrainWeights: { ice: 50, snow: 25, mountain_peak: 5, pit: 5, cave_floor: 10, shallow_water: 5 },
      encounterTable: ['frost_giant', 'white_dragon', 'ice_elemental', 'ice_mephit', 'frost_worm'],
      planes: ['material'],
    },
    {
      id: 'desert_sand',
      name: 'Sand Desert',
      terrainWeights: { desert_sand: 55, desert_rock: 15, road: 5, hill: 10, pit: 5, ruins: 5, shallow_water: 5 },
      encounterTable: ['mummy', 'blue_dragon', 'scorpion_giant', 'dust_mephit', 'lamia', 'gnoll'],
      planes: ['material'],
    },
    {
      id: 'desert_rock',
      name: 'Rock Desert',
      terrainWeights: { desert_rock: 45, desert_sand: 20, hill: 15, mountain: 5, road: 5, cave_floor: 5, rubble: 5 },
      encounterTable: ['basilisk', 'manticore', 'gnoll', 'hyena_dire', 'medusa', 'blue_dragon'],
      planes: ['material'],
    },
    {
      id: 'temperate_forest',
      name: 'Temperate Forest',
      terrainWeights: { forest_light: 30, forest_dense: 25, plains: 15, hill: 5, road: 10, shallow_water: 5, bridge: 5, rubble: 5 },
      encounterTable: ['wolf', 'dire_wolf', 'bear_black', 'owlbear', 'treant', 'dryad', 'ettercap', 'green_dragon'],
      planes: ['material'],
    },
    {
      id: 'tropical_jungle',
      name: 'Tropical Jungle',
      terrainWeights: { jungle: 40, forest_dense: 20, shallow_water: 10, swamp: 10, hill: 5, road: 5, rubble: 5, plains: 5 },
      encounterTable: ['yuan_ti', 'couatl', 'dire_ape', 'giant_snake', 'shambling_mound', 'lizardfolk', 'green_dragon'],
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
      encounterTable: ['lizardfolk', 'troll', 'will_o_wisp', 'hag_green', 'shambling_mound', 'black_dragon', 'hydra'],
      planes: ['material'],
    },
    {
      id: 'marsh',
      name: 'Marsh',
      terrainWeights: { marsh: 40, shallow_water: 20, plains: 15, swamp: 10, road: 5, bridge: 5, forest_light: 5 },
      encounterTable: ['lizardfolk', 'stirge', 'giant_frog', 'will_o_wisp', 'hag_green', 'crocodile_giant'],
      planes: ['material'],
    },
    {
      id: 'mountain',
      name: 'Mountain',
      terrainWeights: { mountain: 30, mountain_peak: 10, hill: 20, cave_floor: 10, pit: 5, road: 5, plains: 10, rubble: 5, stalagmites: 5 },
      encounterTable: ['giant_hill', 'giant_stone', 'griffon', 'wyvern', 'red_dragon', 'roc', 'chimera'],
      planes: ['material'],
    },
    {
      id: 'hill',
      name: 'Hill Country',
      terrainWeights: { hill: 35, plains: 25, forest_light: 10, road: 10, mountain: 5, cave_floor: 5, rubble: 5, shallow_water: 5 },
      encounterTable: ['ogre', 'goblin', 'hobgoblin', 'giant_hill', 'worg', 'ettin', 'troll'],
      planes: ['material'],
    },
    {
      id: 'underground',
      name: 'Underdark',
      terrainWeights: { dungeon_floor: 25, dungeon_corridor: 15, cave_floor: 20, stalagmites: 10, stone_wall: 10, rubble: 5, pit: 5, earth_packed: 5, shallow_water: 5 },
      encounterTable: ['drow', 'mind_flayer', 'beholder', 'umber_hulk', 'drider', 'deep_gnome', 'purple_worm', 'aboleth'],
      planes: ['material'],
    },
    {
      id: 'underwater_reef',
      name: 'Underwater Reef',
      terrainWeights: { coral_reef: 40, seabed: 20, shallow_water: 20, deep_water: 10, rubble: 10 },
      encounterTable: ['sahuagin', 'merfolk', 'sea_hag', 'giant_octopus', 'dragon_turtle', 'water_elemental'],
      planes: ['material'],
    },
    {
      id: 'underwater_deep',
      name: 'Deep Ocean',
      terrainWeights: { deep_water: 45, seabed: 30, coral_reef: 5, pit: 10, rubble: 10 },
      encounterTable: ['kraken', 'aboleth', 'sahuagin', 'dragon_turtle', 'water_elemental', 'sea_serpent'],
      planes: ['material'],
    },
    {
      id: 'lava_field',
      name: 'Lava Field',
      terrainWeights: { lava: 30, magma: 15, fire_ground: 20, desert_rock: 15, rubble: 10, pit: 5, mountain: 5 },
      encounterTable: ['fire_elemental', 'fire_giant', 'salamander', 'magmin', 'red_dragon', 'efreeti'],
      planes: ['material', 'elemental_fire'],
    },
    {
      id: 'ash_waste',
      name: 'Ash Waste',
      terrainWeights: { desert_sand: 25, desert_rock: 20, rubble: 20, fire_ground: 10, lava: 5, hill: 10, pit: 5, road: 5 },
      encounterTable: ['fire_elemental', 'dust_mephit', 'magmin', 'salamander', 'nightwalker', 'undead_skeleton'],
      planes: ['material'],
    },

    // -- Transitive / Planar Biomes -----------------------------------------

    {
      id: 'cloud',
      name: 'Cloud Realm',
      terrainWeights: { cloud: 50, air_open: 35, ice: 5, celestial_garden: 5, pit: 5 },
      encounterTable: ['air_elemental', 'djinni', 'cloud_giant', 'roc', 'silver_dragon'],
      planes: ['elemental_air'],
    },
    {
      id: 'shadow',
      name: 'Shadowfell',
      terrainWeights: { shadow_ground: 50, dungeon_floor: 15, rubble: 10, pit: 5, swamp: 5, forest_dense: 10, cave_floor: 5 },
      encounterTable: ['shadow', 'wraith', 'nightwalker', 'shadow_mastiff', 'dread_wraith', 'shadow_dragon'],
      planes: ['shadow'],
    },
    {
      id: 'astral_void',
      name: 'Astral Void',
      terrainWeights: { astral_void: 80, cloud: 5, ethereal_mist: 5, celestial_garden: 5, infernal_waste: 5 },
      encounterTable: ['githyanki', 'astral_dreadnought', 'astral_stalker', 'silver_dragon', 'deva'],
      planes: ['astral'],
    },
    {
      id: 'ethereal_mist',
      name: 'Ethereal Mist',
      terrainWeights: { ethereal_mist: 70, shadow_ground: 10, cloud: 10, plains: 5, dungeon_floor: 5 },
      encounterTable: ['ghost', 'phase_spider', 'ethereal_filcher', 'night_hag', 'xill'],
      planes: ['ethereal'],
    },

    // -- Outer / Alignment Planes -------------------------------------------

    {
      id: 'infernal_waste',
      name: 'Infernal Waste',
      terrainWeights: { infernal_waste: 40, fire_ground: 15, lava: 15, rubble: 10, pit: 10, desert_rock: 5, iron_door: 5 },
      encounterTable: ['devil_lemure', 'devil_imp', 'devil_pit_fiend', 'erinyes', 'horned_devil', 'ice_devil'],
      planes: ['nine_hells', 'gehenna'],
    },
    {
      id: 'celestial_garden',
      name: 'Celestial Garden',
      terrainWeights: { celestial_garden: 45, plains: 20, forest_light: 15, shallow_water: 5, road: 10, cloud: 5 },
      encounterTable: ['deva', 'planetar', 'solar', 'archon_lantern', 'archon_hound', 'celestial_lion'],
      planes: ['mount_celestia', 'elysium', 'bytopia'],
    },
    {
      id: 'feywild_grove',
      name: 'Feywild Grove',
      terrainWeights: { feywild_grove: 35, forest_dense: 20, forest_light: 15, shallow_water: 10, plains: 10, hill: 5, bridge: 5 },
      encounterTable: ['dryad', 'satyr', 'pixie', 'nymph', 'treant', 'unicorn', 'blink_dog', 'green_dragon'],
      planes: ['arborea', 'beastlands'],
    },
    {
      id: 'abyss',
      name: 'The Abyss',
      terrainWeights: { infernal_waste: 25, lava: 15, pit: 15, rubble: 15, shadow_ground: 10, fire_ground: 10, deep_water: 5, magma: 5 },
      encounterTable: ['demon_dretch', 'demon_vrock', 'demon_balor', 'demon_marilith', 'demon_hezrou', 'demon_glabrezu'],
      planes: ['abyss'],
    },

    // -- Elemental Biomes ---------------------------------------------------

    {
      id: 'elemental_fire',
      name: 'Elemental Fire',
      terrainWeights: { fire_ground: 35, lava: 30, magma: 15, desert_rock: 10, pit: 5, infernal_waste: 5 },
      encounterTable: ['fire_elemental', 'efreeti', 'salamander', 'magmin', 'fire_mephit', 'red_dragon'],
      planes: ['elemental_fire'],
    },
    {
      id: 'elemental_water',
      name: 'Elemental Water',
      terrainWeights: { deep_water: 40, shallow_water: 25, seabed: 15, coral_reef: 10, ice: 5, ethereal_mist: 5 },
      encounterTable: ['water_elemental', 'marid', 'water_mephit', 'tojanida', 'triton', 'dragon_turtle'],
      planes: ['elemental_water'],
    },
    {
      id: 'elemental_earth',
      name: 'Elemental Earth',
      terrainWeights: { earth_packed: 35, cave_floor: 20, stalagmites: 15, stone_wall: 10, rubble: 10, pit: 5, mountain: 5 },
      encounterTable: ['earth_elemental', 'dao', 'xorn', 'earth_mephit', 'umber_hulk', 'galeb_duhr'],
      planes: ['elemental_earth'],
    },
    {
      id: 'elemental_air',
      name: 'Elemental Air',
      terrainWeights: { air_open: 45, cloud: 35, ice: 5, ethereal_mist: 5, pit: 5, celestial_garden: 5 },
      encounterTable: ['air_elemental', 'djinni', 'air_mephit', 'arrowhawk', 'invisible_stalker', 'silver_dragon'],
      planes: ['elemental_air'],
    },
    {
      id: 'mechanus_grid',
      name: 'Mechanus Grid',
      terrainWeights: { mechanus_grid: 60, dungeon_floor: 15, iron_door: 5, road: 10, rubble: 5, pit: 5 },
      encounterTable: ['modron', 'inevitable_marut', 'inevitable_kolyarut', 'formian', 'gear_spirit'],
      planes: ['mechanus'],
    },

  );
})();
