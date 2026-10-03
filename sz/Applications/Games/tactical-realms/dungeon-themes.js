;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // What a dungeon looks like and who lives in it. A theme picks the layout
  // generator, the floor and wall art, the battle backdrop, how dark it is,
  // the props scattered about and the monster pools by tier (0 = weakest).
  //
  // layout: 'built'   rooms and corridors (BSP)
  //         'cavern'  organic caves grown by cellular automata
  //         'maze'    many small rooms, long winding corridors
  //         'wilds'   open ground broken by thickets or cliffs, no roof
  //
  // floorTerrain/wallTerrain are the combat terrain ids (rules); floorArt and
  // wallArt are TerrainArt tiles (looks), so a thicket fights like a wall.

  const THEMES = Object.freeze({
    crypt: Object.freeze({
      id: 'crypt', name: 'Crypt', layout: 'built', size: [44, 32], floors: [1, 3],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'crypt_floor', wallArt: 'crypt_wall',
      biome: 'dungeon', darkness: 0.66, props: ['bones', 'sarcophagus', 'candles', 'urn'],
      pools: [['skeleton', 'zombie', 'dire_rat', 'rat'], ['skeleton', 'zombie', 'ghast', 'allip', 'ghoul'], ['ghoul', 'wight', 'shadow', 'mummy', 'wraith'], ['wraith', 'vampire_spawn', 'spectre', 'mohrg', 'bodak', 'wight'], ['vampire_spawn', 'lich', 'vampire', 'bodak', 'spectre', 'death_knight']],
    }),
    cavern: Object.freeze({
      id: 'cavern', name: 'Cavern', layout: 'cavern', size: [56, 40], floors: [1, 2],
      floorTerrain: 'cave', wallTerrain: 'stone_wall', floorArt: 'cave', wallArt: 'cave_wall',
      biome: 'cave', darkness: 0.72, props: ['mushrooms', 'stalagmite', 'puddle', 'crystals'],
      pools: [['rat', 'kobold', 'goblin', 'giant_centipede', 'darkmantle', 'dire_rat', 'spider'], ['goblin', 'spider', 'orc', 'choker', 'giant_spider_medium', 'troglodyte', 'grick', 'kobold'], ['orc', 'bugbear', 'troll', 'carrion_crawler', 'gelatinous_cube', 'otyugh', 'ochre_jelly', 'phase_spider'], ['troll', 'ogre', 'umber_hulk', 'drider', 'black_pudding', 'basilisk'], ['ogre', 'troll', 'umber_hulk', 'drider', 'aboleth', 'mind_flayer']],
    }),
    fortress: Object.freeze({
      id: 'fortress', name: 'Fortress', layout: 'built', size: [48, 34], floors: [1, 2],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'wood_floor', wallArt: 'fortress_wall',
      biome: 'dungeon', darkness: 0.5, props: ['crates', 'barrels', 'weapon_rack', 'banner'],
      pools: [['goblin', 'bandit', 'hobgoblin', 'duergar_warrior', 'kobold'], ['goblin', 'hobgoblin', 'orc', 'bugbear', 'gnoll', 'bandit'], ['orc', 'hobgoblin', 'bugbear', 'ettin', 'ogre'], ['ogre', 'minotaur', 'ettin', 'stone_giant', 'hill_giant'], ['hill_giant', 'frost_giant', 'fire_giant', 'stone_giant', 'ogre']],
    }),
    lair: Object.freeze({
      id: 'lair', name: 'Dragon Lair', layout: 'cavern', size: [60, 44], floors: [1, 2],
      floorTerrain: 'cave', wallTerrain: 'stone_wall', floorArt: 'cave', wallArt: 'cave_wall',
      biome: 'cave', darkness: 0.62, props: ['gold', 'bones', 'crystals', 'gold'],
      pools: [['kobold', 'pseudodragon', 'lizardfolk'], ['kobold', 'lizardfolk', 'white_dragon_wyrmling', 'black_dragon_wyrmling', 'wyvern'], ['lizardfolk', 'wyvern', 'white_dragon_very_young', 'red_dragon_wyrmling', 'dragon_wyrmling'], ['wyvern', 'green_dragon_very_young', 'blue_dragon_very_young', 'white_dragon_young', 'dragon_wyrmling'], ['dragon_wyrmling', 'black_dragon_young', 'red_dragon_very_young', 'green_dragon_young', 'young_dragon']],
    }),
    infernal: Object.freeze({
      id: 'infernal', name: 'Infernal Pit', layout: 'cavern', size: [52, 38], floors: [1, 3],
      floorTerrain: 'cave', wallTerrain: 'stone_wall', floorArt: 'infernal_floor', wallArt: 'infernal_wall',
      biome: 'lava', darkness: 0.4, props: ['brimstone', 'chains', 'bones', 'lava_pool'],
      pools: [['lemure', 'imp', 'mephit_fire', 'fire_elemental'], ['fire_elemental', 'dretch', 'quasit', 'mephit_magma', 'devil'], ['devil', 'demon', 'bearded_devil', 'babau', 'chain_devil', 'salamander_average', 'fire_elemental'], ['demon', 'hellcat', 'erinyes', 'bone_devil', 'efreeti', 'devil'], ['demon', 'vrock', 'barbed_devil', 'hezrou', 'bone_devil', 'devil']],
    }),
    frozen: Object.freeze({
      id: 'frozen', name: 'Frozen Halls', layout: 'built', size: [48, 34], floors: [1, 2],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'ice_floor', wallArt: 'ice_wall',
      biome: 'snow', darkness: 0.45, props: ['icicles', 'frozen_corpse', 'snowdrift'],
      pools: [['wolf', 'mephit_ice', 'worg'], ['worg', 'winter_wolf', 'bear_polar', 'dire_wolf'], ['dire_wolf', 'ogre', 'winter_wolf', 'white_dragon_very_young', 'remorhaz', 'worg'], ['frost_giant', 'remorhaz', 'white_dragon_young', 'dire_wolf'], ['frost_giant', 'white_dragon_juvenile', 'remorhaz', 'frost_giant']],
    }),
    tower: Object.freeze({
      id: 'tower', name: 'Wizard Tower', layout: 'built', size: [32, 26], floors: [2, 4],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'dungeon_floor', wallArt: 'wall',
      biome: 'dungeon', darkness: 0.5, props: ['bookshelf', 'candles', 'rune_circle', 'crystals'],
      pools: [['skeleton', 'homunculus', 'animated_object_small', 'dark_mage'], ['dark_mage', 'gargoyle', 'animated_object_medium', 'iron_cobra', 'skeleton'], ['dark_mage', 'wraith', 'animated_object_large', 'flesh_golem', 'gargoyle'], ['mind_flayer', 'dark_mage', 'flesh_golem', 'shield_guardian', 'night_hag', 'wight'], ['lich', 'clay_golem', 'stone_golem', 'rakshasa', 'mind_flayer']],
    }),
    labyrinth: Object.freeze({
      id: 'labyrinth', name: 'Labyrinth', layout: 'maze', size: [50, 38], floors: [1, 2],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'dungeon_floor', wallArt: 'wall',
      biome: 'dungeon', darkness: 0.6, props: ['bones', 'rubble', 'urn'],
      pools: [['goblin', 'rat', 'dire_rat', 'giant_centipede', 'hobgoblin'], ['hobgoblin', 'ghoul', 'rust_monster', 'gelatinous_cube', 'bugbear'], ['minotaur', 'hobgoblin', 'mimic', 'gargoyle', 'ghoul'], ['minotaur', 'umber_hulk', 'medusa', 'gargoyle'], ['minotaur', 'medusa', 'umber_hulk', 'minotaur']],
    }),
    ruins: Object.freeze({
      id: 'ruins', name: 'Ruins', layout: 'built', size: [46, 34], floors: [1, 1], broken: true,
      floorTerrain: 'ruins', wallTerrain: 'stone_wall', floorArt: 'ruins', wallArt: 'ruin_wall',
      biome: 'ruins', darkness: 0, props: ['rubble', 'statue', 'vines'],
      pools: [['bandit', 'goblin', 'stirge', 'giant_centipede', 'skeleton'], ['bandit', 'skeleton', 'choker', 'giant_spider_medium', 'gargoyle'], ['gargoyle', 'wight', 'mummy', 'medusa', 'bandit'], ['gargoyle', 'medusa', 'spectre', 'wight'], ['wight', 'spectre', 'mohrg', 'gargoyle']],
    }),
    woods: Object.freeze({
      id: 'woods', name: 'Deep Woods', layout: 'wilds', size: [56, 40], floors: [1, 1],
      floorTerrain: 'plains', wallTerrain: 'stone_wall', floorArt: 'plains', wallArt: 'thicket',
      biome: 'forest', darkness: 0, props: ['stump', 'flowers', 'mushrooms', 'boulder'],
      pools: [['wolf', 'goblin', 'boar', 'giant_spider_small', 'bandit'], ['wolf', 'worg', 'bandit', 'bear_black', 'giant_spider_medium', 'assassin_vine', 'gnoll'], ['dire_wolf', 'owlbear', 'dire_boar', 'bear_brown', 'ettercap', 'worg'], ['owlbear', 'troll', 'dire_bear', 'treant', 'dire_wolf'], ['troll', 'treant', 'dire_tiger', 'green_dragon_juvenile', 'owlbear']],
    }),
    marsh: Object.freeze({
      id: 'marsh', name: 'Marsh', layout: 'wilds', size: [54, 40], floors: [1, 1],
      floorTerrain: 'earth_packed', wallTerrain: 'stone_wall', floorArt: 'swamp', wallArt: 'thicket',
      biome: 'swamp', darkness: 0, props: ['reeds', 'stump', 'puddle'],
      pools: [['lizardfolk', 'giant_centipede', 'toad', 'rat'], ['lizardfolk', 'crocodile', 'troglodyte', 'cockatrice'], ['lizardfolk', 'crocodile_giant', 'shambling_mound', 'hydra_5', 'basilisk'], ['basilisk', 'will_o_wisp', 'hydra_7', 'shambling_mound', 'troll'], ['troll', 'hydra_7', 'black_dragon_juvenile', 'basilisk']],
    }),
    peaks: Object.freeze({
      id: 'peaks', name: 'Mountain Heights', layout: 'wilds', size: [54, 40], floors: [1, 1],
      floorTerrain: 'desert_rock', wallTerrain: 'stone_wall', floorArt: 'mountain', wallArt: 'cliff',
      biome: 'mountain', darkness: 0, props: ['boulder', 'snowdrift', 'bones'],
      pools: [['harpy', 'stirge', 'eagle', 'hippogriff', 'goblin'], ['harpy', 'orc', 'hippogriff', 'griffon', 'worg'], ['manticore', 'harpy', 'griffon', 'ettin', 'ogre'], ['wyvern', 'manticore', 'chimera', 'stone_giant', 'hill_giant'], ['wyvern', 'chimera', 'stone_giant', 'cloud_giant', 'frost_giant']],
    }),
    // --- the other planes -------------------------------------------------
    astral: Object.freeze({
      id: 'astral', name: 'Astral Drift', layout: 'wilds', size: [56, 40], floors: [1, 1],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'astral_rock', wallArt: 'rift',
      biome: 'astral', darkness: 0.2, props: ['astral_shard', 'crystals', 'statue'],
      pools: [['githyanki_warrior', 'phasm', 'intellect_devourer'], ['githyanki_warrior', 'phase_spider', 'intellect_devourer', 'githzerai_monk'], ['mind_flayer', 'githyanki_warrior', 'silver_dragon_wyrmling'], ['mind_flayer', 'silver_dragon_young', 'githzerai_monk'], ['silver_dragon_juvenile', 'mind_flayer', 'githyanki_warrior']],
    }),
    ethereal: Object.freeze({
      id: 'ethereal', name: 'Ghostly Halls', layout: 'built', size: [46, 34], floors: [1, 2],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'mist', wallArt: 'crypt_wall',
      biome: 'ethereal', darkness: 0.35, props: ['candles', 'urn', 'bones'],
      pools: [['allip', 'phase_spider', 'ethereal_filcher'], ['allip', 'phasm', 'phase_spider', 'ethereal_filcher'], ['wraith', 'phasm', 'spectre', 'banshee'], ['spectre', 'night_hag', 'banshee'], ['night_hag', 'spectre', 'nightmare']],
    }),
    shadowkeep: Object.freeze({
      id: 'shadowkeep', name: 'Shadow Keep', layout: 'built', size: [48, 34], floors: [1, 3],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'gloom', wallArt: 'crypt_wall',
      biome: 'shadow', darkness: 0.82, props: ['bones', 'chains', 'urn', 'grey_tree'],
      pools: [['shadow', 'skeleton', 'zombie'], ['shadow', 'wight', 'allip', 'ghast', 'shadow_mastiff'], ['wraith', 'shadow_mastiff', 'mohrg', 'spectre'], ['spectre', 'bodak', 'nightmare', 'wraith'], ['bodak', 'vampire', 'nightwalker', 'spectre']],
    }),
    drowned: Object.freeze({
      id: 'drowned', name: 'Drowned Halls', layout: 'cavern', size: [54, 40], floors: [1, 2],
      floorTerrain: 'earth_packed', wallTerrain: 'stone_wall', floorArt: 'coral', wallArt: 'cave_wall',
      biome: 'water', darkness: 0.4, props: ['coral_fan', 'puddle', 'crystals'],
      pools: [['mephit_water', 'water_elemental_small', 'tojanida_juvenile', 'triton'], ['tojanida_juvenile', 'water_elemental_medium', 'mephit_water', 'triton'], ['tojanida_adult', 'water_elemental_large', 'bronze_dragon_wyrmling'], ['marid', 'tojanida_elder', 'water_elemental_huge'], ['marid', 'water_elemental_greater', 'black_dragon_young']],
    }),
    geode: Object.freeze({
      id: 'geode', name: 'Geode Halls', layout: 'cavern', size: [56, 40], floors: [1, 3],
      floorTerrain: 'earth_packed', wallTerrain: 'stone_wall', floorArt: 'bedrock', wallArt: 'earth_wall',
      biome: 'earth', darkness: 0.6, props: ['crystals', 'stalagmite', 'gold', 'rubble'],
      pools: [['mephit_earth', 'earth_elemental_small', 'xorn_minor', 'thoqqua'], ['xorn_minor', 'earth_elemental_medium', 'mephit_earth'], ['xorn_average', 'earth_elemental_large', 'umber_hulk'], ['xorn_elder', 'earth_elemental_huge', 'dao'], ['dao', 'earth_elemental_greater', 'xorn_elder']],
    }),
    skyhold: Object.freeze({
      id: 'skyhold', name: 'Sky Castle', layout: 'built', size: [46, 34], floors: [2, 3],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'marble', wallArt: 'cloudbank',
      biome: 'sky', darkness: 0, props: ['banner', 'statue', 'candles'],
      pools: [['mephit_air', 'air_elemental_small', 'arrowhawk_juvenile'], ['air_elemental_medium', 'arrowhawk_adult', 'griffon', 'belker'], ['air_elemental_large', 'invisible_stalker', 'djinni'], ['djinni', 'cloud_giant', 'air_elemental_huge'], ['cloud_giant', 'air_elemental_greater', 'silver_dragon_juvenile']],
    }),
    celestial: Object.freeze({
      id: 'celestial', name: 'Shining Halls', layout: 'built', size: [46, 34], floors: [1, 2],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'marble', wallArt: 'ruin_wall',
      biome: 'celestial', darkness: 0, props: ['fountain', 'statue', 'flowers', 'candles'],
      pools: [['lantern_archon', 'pegasus', 'blink_dog'], ['hound_archon', 'unicorn', 'lantern_archon', 'griffon'], ['hound_archon', 'avoral_guardinal', 'bralani_eladrin', 'gold_dragon_wyrmling'], ['avoral_guardinal', 'leonal_guardinal', 'astral_deva', 'gold_dragon_young'], ['astral_deva', 'trumpet_archon', 'planetar', 'leonal_guardinal']],
    }),
    fey_glade: Object.freeze({
      id: 'fey_glade', name: 'Fey Glade', layout: 'wilds', size: [56, 40], floors: [1, 1],
      floorTerrain: 'plains', wallTerrain: 'stone_wall', floorArt: 'fey', wallArt: 'thicket',
      biome: 'fey', darkness: 0, props: ['fey_tree', 'mushrooms', 'flowers'],
      pools: [['pixie', 'sprite', 'grig', 'satyr'], ['satyr', 'dryad', 'quickling', 'pixie'], ['nymph', 'bralani_eladrin', 'satyr', 'unicorn'], ['treant', 'lillend', 'bralani_eladrin', 'unicorn'], ['ghaele_eladrin', 'treant', 'lillend']],
    }),
    chaos: Object.freeze({
      id: 'chaos', name: 'Churning Chaos', layout: 'cavern', size: [54, 40], floors: [1, 2],
      floorTerrain: 'earth_packed', wallTerrain: 'stone_wall', floorArt: 'chaos', wallArt: 'rift',
      biome: 'chaos', darkness: 0.25, props: ['crystals', 'astral_shard', 'lava_pool'],
      pools: [['mephit_fire', 'mephit_water', 'mephit_air', 'mephit_earth'], ['howler', 'githzerai_monk', 'chaos_beast'], ['red_slaad', 'chaos_beast', 'githzerai_monk', 'blue_slaad'], ['blue_slaad', 'green_slaad', 'gray_slaad'], ['gray_slaad', 'death_slaad', 'green_slaad']],
    }),
    abyssal: Object.freeze({
      id: 'abyssal', name: 'Abyssal Pit', layout: 'cavern', size: [56, 42], floors: [2, 3],
      floorTerrain: 'cave', wallTerrain: 'stone_wall', floorArt: 'abyssal', wallArt: 'infernal_wall',
      biome: 'abyss', darkness: 0.45, props: ['bones', 'chains', 'hell_spire', 'lava_pool'],
      pools: [['dretch', 'quasit', 'demon'], ['dretch', 'babau', 'howler', 'demon'], ['babau', 'vrock', 'succubus', 'demon'], ['vrock', 'hezrou', 'glabrezu', 'bebilith'], ['glabrezu', 'nalfeshnee', 'marilith', 'bebilith']],
    }),
    clockwork: Object.freeze({
      id: 'clockwork', name: 'Clockwork Maze', layout: 'maze', size: [50, 38], floors: [1, 3],
      floorTerrain: 'dungeon_floor', wallTerrain: 'stone_wall', floorArt: 'gears', wallArt: 'iron_plate',
      biome: 'clockwork', darkness: 0.3, props: ['cog', 'crates', 'chains'],
      pools: [['formian_worker', 'homunculus', 'iron_cobra'], ['formian_warrior', 'iron_cobra', 'animated_object_medium', 'rust_monster'], ['formian_taskmaster', 'formian_warrior', 'shield_guardian', 'inevitable_zelekhut'], ['formian_myrmarch', 'inevitable_zelekhut', 'stone_golem'], ['inevitable_kolyarut', 'iron_golem', 'inevitable_marut', 'formian_myrmarch']],
    }),
  });

  // Which theme a map location gets: its name first, then its biome.
  const NAME_RULES = [
    [/dragon/i, 'lair'],
    [/demon|infernal|hell|elemental rift/i, 'infernal'],
    [/frozen|frost|ice/i, 'frozen'],
    [/tower|mage|colony/i, 'tower'],
    [/labyrinth|maze/i, 'labyrinth'],
    [/crypt|catacomb|tomb|graveyard|sanctum|vampire|barrow/i, 'crypt'],
    [/fortress|stronghold|keep|giant/i, 'fortress'],
    [/ruin|perch/i, 'ruins'],
    [/cave|cavern|warren|nest|web|den|lair/i, 'cavern'],
    [/peak|roost|harpy|manticore/i, 'peaks'],
    [/lizardfolk|swamp|bog|marsh/i, 'marsh'],
  ];
  const BIOME_THEMES = Object.freeze({
    cave: 'cavern', dungeon: 'crypt', ruins: 'ruins', lava: 'infernal', mountain: 'peaks', forest: 'woods', swamp: 'marsh',
  });

  function themeForLocation(loc) {
    // the places of the other planes name their own look
    if (loc && loc.theme && THEMES[loc.theme])
      return THEMES[loc.theme];
    const name = (loc && loc.name) || '';
    // a den or nest in the forest is out in the woods, not underground
    if (loc && loc.biome === 'forest' && /den|camp|grounds|territory|bridge|pack/i.test(name))
      return THEMES.woods;
    for (const [re, id] of NAME_RULES)
      if (re.test(name))
        return THEMES[id];
    return THEMES[BIOME_THEMES[loc && loc.biome] || 'cavern'];
  }

  TR.DungeonThemes = Object.freeze({ THEMES, themeForLocation });
})();
