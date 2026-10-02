;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // What each plane of the cosmology looks like when the party walks it:
  // the ground its overworld is made of, the road between its places, the
  // gate the party arrives at, its settlements and dangerous sites, and how
  // much harder its fights are than the Material Plane's.
  //
  // terrain(h, m, v, col, row) picks an overworld tile name (TR.OverworldTile
  // keys) from elevation h, moisture m and a third noise v, all 0..1. The
  // Material Plane has no entry here: its climate generator lives in
  // overworld-map.js. Names of places are this game's own.

  const BY_CATEGORY = Object.freeze({
    prime: { levelBonus: 0, encounterScale: 1, portalChance: 0.03, siteDifficulty: 0 },
    transitive: { levelBonus: 1, encounterScale: 1.15, portalChance: 0.14, siteDifficulty: 4 },
    inner: { levelBonus: 2, encounterScale: 1.2, portalChance: 0.1, siteDifficulty: 5 },
    outer: { levelBonus: 3, encounterScale: 1.25, portalChance: 0.1, siteDifficulty: 6 },
  });

  // the Material-like outer planes reuse its biome tiles
  function temperate(h, m, { snowy = false, warm = false } = {}) {
    if (h < 0.13)
      return 'WATER';
    if (h > 0.88)
      return 'MOUNTAIN';
    if (snowy && h > 0.62)
      return m > 0.5 ? 'TAIGA' : 'SNOW';
    if (h > 0.72)
      return 'HILLS';
    if (warm && m > 0.62)
      return 'JUNGLE';
    if (m > 0.58)
      return 'FOREST';
    return warm && m < 0.3 ? 'SAVANNA' : 'GRASS';
  }

  const site = (name, theme, enemies, tier = 0) => Object.freeze({ name, theme, enemies, tier });

  const PROFILES = Object.freeze({
    astral: {
      base: 'ASTRAL', road: 'silver_path', gate: 'Silver Pool',
      terrain: (h, m, v) => (v > 0.78 ? 'DRIFT_ROCK' : h < 0.06 ? 'RIFT' : 'ASTRAL'),
      towns: ['Driftstone Market', 'Silver Wayhouse'],
      sites: [site('Petrified God-Isle', 'astral', ['githyanki_warrior', 'intellect_devourer']), site('Astral Wreck', 'astral', ['githyanki_warrior', 'phasm'], 1), site('Silver Lighthouse', 'astral', ['githyanki_warrior', 'silver_dragon_young'], 2)],
    },
    ethereal: {
      base: 'MIST', road: 'silver_path', gate: 'Shimmering Curtain',
      terrain: (h, m, v) => (h < 0.1 ? 'RIFT' : v > 0.82 ? 'GLOOM' : 'MIST'),
      towns: ['Mistwalker Refuge'],
      sites: [site('Haunted Mist Manor', 'ethereal', ['ghost', 'allip', 'phasm']), site('Phantom Hulk', 'ethereal', ['phase_spider', 'ethereal_filcher'], 1), site('Hag Hollow', 'ethereal', ['night_hag', 'allip'], 2)],
    },
    shadow: {
      base: 'GLOOM', road: 'ruins', gate: 'Dim Archway',
      terrain: (h, m, v) => (h > 0.88 ? 'MOUNTAIN' : h < 0.12 ? 'RIFT' : v > 0.75 ? 'GREY' : 'GLOOM'),
      props: { GLOOM: ['grey_tree', 9] },
      towns: ['Duskhaven'],
      sites: [site('Umbral Keep', 'shadowkeep', ['shadow', 'shadow_mastiff']), site('Hollow Necropolis', 'crypt', ['wraith', 'spectre'], 1), site('Gloomwood Barrow', 'shadowkeep', ['nightwalker', 'bodak'], 2)],
    },
    elemental_fire: {
      base: 'CINDER', road: 'hell_road', gate: 'Pillar of Flame',
      terrain: (h, m, v) => (v > 0.7 || h < 0.18 ? 'LAVA' : m > 0.68 ? 'ASH' : 'CINDER'),
      props: { CINDER: ['vent', 13] },
      towns: ['Ember Bazaar'],
      sites: [site('Brazen Citadel', 'infernal', ['efreeti', 'salamander_noble'], 2), site('Cinder Forge', 'infernal', ['azer', 'mephit_fire']), site('Salamander Warrens', 'infernal', ['salamander_average', 'fire_elemental_medium'], 1)],
    },
    elemental_water: {
      base: 'CURRENT', road: 'marble', gate: 'Whirlpool Gate',
      terrain: (h, m) => (h > 0.9 ? 'ICE' : m > 0.68 ? 'CORAL' : 'CURRENT'),
      props: { CORAL: ['coral_fan', 5] },
      towns: ['Pearl Market'],
      sites: [site('Drowned Palace', 'drowned', ['marid', 'triton'], 2), site('Coral Labyrinth', 'drowned', ['tojanida_adult', 'water_elemental_medium'], 1), site('Whirling Grotto', 'drowned', ['mephit_water', 'tojanida_juvenile'])],
    },
    elemental_earth: {
      base: 'BEDROCK', road: 'ruins', gate: 'Stone Doorway',
      terrain: (h, m, v) => (Math.abs(h - 0.5) < 0.2 || v > 0.8 ? 'BEDROCK' : 'SOLID_ROCK'),
      props: { BEDROCK: ['crystals', 11] },
      towns: ['Deepdelve'],
      sites: [site('Geode Halls', 'geode', ['xorn_average', 'earth_elemental_medium'], 1), site('Xorn Burrows', 'geode', ['xorn_minor', 'mephit_earth']), site('Crystal Vault', 'geode', ['dao', 'earth_elemental_large'], 2)],
    },
    elemental_air: {
      base: 'SKY', road: 'marble', gate: 'Eye of the Wind',
      terrain: (h, m) => (m > 0.56 || h > 0.8 ? 'CLOUD' : 'SKY'),
      towns: ['Sky Harbor'],
      sites: [site('Cloud Castle', 'skyhold', ['cloud_giant', 'air_elemental_large'], 2), site('Storm Eyrie', 'skyhold', ['arrowhawk', 'air_elemental_medium'], 1), site('Windspire', 'skyhold', ['mephit_air', 'invisible_stalker'])],
    },
    para_ice: {
      base: 'SNOW', road: 'marble', gate: 'Frozen Arch',
      terrain: h => (h < 0.15 || h > 0.86 ? 'ICE' : 'SNOW'),
      props: { SNOW: ['snow_rock', 11] },
      towns: ['Rimehold'],
      sites: [site('Rime Halls', 'frozen', ['mephit_ice', 'winter_wolf']), site('Glacier Heart', 'frozen', ['frost_worm', 'ice_devil'], 2)],
    },
    para_magma: {
      base: 'CINDER', road: 'hell_road', gate: 'Molten Arch',
      terrain: (h, m, v) => (v > 0.6 ? 'LAVA' : m > 0.6 ? 'ASH' : 'CINDER'),
      towns: ['Slagport'],
      sites: [site('Magma Forge', 'infernal', ['mephit_magma', 'magmin']), site('Molten Deep', 'infernal', ['salamander_average', 'fire_elemental_large'], 2)],
    },
    para_ooze: {
      base: 'OOZE', road: 'ruins', gate: 'Dripping Arch',
      terrain: (h, m) => (h < 0.14 ? 'WATER' : m > 0.6 ? 'SWAMP' : 'OOZE'),
      props: { SWAMP: ['reeds', 4] },
      towns: ['Mudwallow'],
      sites: [site('Sludge Pits', 'marsh', ['mephit_ooze', 'gray_ooze']), site('Black Mire', 'marsh', ['black_pudding', 'ochre_jelly'], 2)],
    },
    para_smoke: {
      base: 'SMOKE', road: 'ruins', gate: 'Sooty Arch',
      terrain: (h, m) => (m > 0.62 ? 'ASH' : 'SMOKE'),
      towns: ['Hazeport'],
      sites: [site('Smoke Warrens', 'cavern', ['mephit_dust', 'belker']), site('Choking Vault', 'cavern', ['belker', 'air_elemental_large'], 2)],
    },
    positive_energy: {
      base: 'RADIANCE', road: 'marble', gate: 'Blazing Threshold',
      terrain: (h, m) => (m > 0.7 ? 'CELESTIAL' : 'RADIANCE'),
      props: { RADIANCE: ['light_pillar', 17] },
      towns: ['Brightwell'],
      sites: [site('Radiant Spire', 'celestial', ['ravid', 'lantern_archon'], 1), site('Sunburst Hollow', 'celestial', ['ravid', 'astral_deva'], 2)],
    },
    negative_energy: {
      base: 'DARKNESS', road: 'ruins', gate: 'Lightless Threshold',
      terrain: (h, m, v) => (h < 0.12 ? 'RIFT' : v > 0.78 ? 'GREY' : 'DARKNESS'),
      towns: [],
      sites: [site('Hall of Withering', 'shadowkeep', ['wraith', 'shadow']), site('Starving Dark', 'shadowkeep', ['nightwalker', 'bodak'], 2)],
    },
    mount_celestia: {
      base: 'CELESTIAL', road: 'marble', gate: 'Silver Stair',
      terrain: (h, m) => (h > 0.82 ? 'MOUNTAIN' : h > 0.66 ? 'HILLS' : h < 0.12 ? 'WATER' : m > 0.66 ? 'FOREST' : 'CELESTIAL'),
      towns: ['Lantern Haven', 'Pilgrim Terrace'],
      sites: [site('Lantern Monastery', 'celestial', ['lantern_archon', 'hound_archon']), site('Archon Bastion', 'celestial', ['hound_archon', 'trumpet_archon'], 2)],
    },
    bytopia: {
      base: 'GRASS', road: 'road', gate: 'Twin Door',
      terrain: (h, m) => temperate(h, m),
      towns: ['Gearwright Village', 'Twinfield'],
      sites: [site('Deep Workshop', 'fortress', ['hound_archon', 'iron_cobra']), site('Shepherd Caves', 'cavern', ['avoral_guardinal', 'dire_bear'], 1)],
    },
    elysium: {
      base: 'CELESTIAL', road: 'marble', gate: 'Riverside Arch',
      terrain: (h, m) => (h < 0.16 ? 'WATER' : m > 0.64 ? 'FOREST' : 'CELESTIAL'),
      props: { CELESTIAL: ['flowers', 7] },
      towns: ['Riverrest'],
      sites: [site('Riverside Sanctuary', 'celestial', ['avoral_guardinal', 'leonal_guardinal'], 1), site('Lion Pride Hill', 'woods', ['leonal_guardinal', 'dire_lion'], 2)],
    },
    beastlands: {
      base: 'JUNGLE', road: 'road', gate: 'Hollow Oak',
      terrain: (h, m) => temperate(h, m, { warm: true }),
      towns: ['Wildheart Camp'],
      sites: [site('Great Beast Den', 'woods', ['dire_bear', 'dire_tiger']), site('Moonlit Hunt', 'woods', ['leonal_guardinal', 'dire_wolf'], 1)],
    },
    arborea: {
      base: 'FEY', road: 'marble', gate: 'Moonlit Arch',
      terrain: (h, m) => (h > 0.88 ? 'MOUNTAIN' : h < 0.12 ? 'WATER' : m > 0.5 ? 'FOREST' : 'FEY'),
      props: { FEY: ['fey_tree', 9] },
      towns: ['Revelry Town'],
      sites: [site('Revel Glade', 'fey_glade', ['bralani_eladrin', 'satyr']), site('Fey Court', 'fey_glade', ['ghaele_eladrin', 'nymph'], 2)],
    },
    ysgard: {
      base: 'HILLS', road: 'road', gate: 'Rainbow Bridge',
      terrain: (h, m) => temperate(h, m, { snowy: true }),
      towns: ['Mead Hall'],
      sites: [site('Hall of Heroes', 'fortress', ['lillend', 'frost_giant'], 1), site('Earthberg Rift', 'peaks', ['fire_giant', 'frost_giant'], 2)],
    },
    limbo: {
      base: 'CHAOS', road: 'silver_path', gate: 'Anchored Stone',
      terrain: (h, m, v) => (v > 0.75 ? 'CINDER' : v < 0.2 ? 'CURRENT' : m > 0.72 ? 'SKY' : h > 0.8 ? 'BEDROCK' : 'CHAOS'),
      towns: ['Anchorhold'],
      sites: [site('Churning Spire', 'chaos', ['red_slaad', 'blue_slaad']), site('Slaad Hatchery', 'chaos', ['green_slaad', 'gray_slaad'], 2)],
    },
    pandemonium: {
      base: 'GLOOM', road: 'ruins', gate: 'Howling Mouth',
      terrain: (h, m, v) => (Math.abs(h - 0.5) < 0.2 || v > 0.82 ? 'GLOOM' : 'SOLID_ROCK'),
      towns: ['Windbreak'],
      sites: [site('Howling Tunnels', 'cavern', ['howler', 'bodak'], 1), site('Mad Wind Hollow', 'cavern', ['retriever_fiend', 'howler'], 2)],
    },
    abyss: {
      base: 'ABYSSAL', road: 'hell_road', gate: 'Bleeding Gate',
      terrain: (h, m, v) => (v > 0.8 ? 'LAVA' : h < 0.12 ? 'RIFT' : m > 0.7 ? 'BRIMSTONE' : 'ABYSSAL'),
      props: { ABYSSAL: ['hell_spire', 11] },
      towns: ['Bloodmarket'],
      sites: [site('Demon Fane', 'abyssal', ['vrock', 'babau']), site('Pit of Endless Hunger', 'abyssal', ['hezrou', 'glabrezu'], 1), site('Throne of Blades', 'abyssal', ['marilith', 'nalfeshnee'], 2)],
    },
    carceri: {
      base: 'GLOOM', road: 'ruins', gate: 'Prison Orb Gate',
      terrain: (h, m) => (h < 0.16 ? 'WATER' : m > 0.6 ? 'SWAMP' : 'GLOOM'),
      props: { SWAMP: ['grey_tree', 6] },
      towns: ["Warden's Post"],
      sites: [site('Orb Cells', 'crypt', ['bodak', 'nightmare'], 1), site('Exile Pits', 'shadowkeep', ['night_hag', 'nightwalker'], 2)],
    },
    gray_waste: {
      base: 'GREY', road: 'ruins', gate: 'Ashen Arch',
      terrain: (h, m) => (h > 0.88 ? 'MOUNTAIN' : m > 0.68 ? 'ASH' : 'GREY'),
      props: { GREY: ['grey_tree', 13] },
      towns: ['Dreary Bazaar'],
      sites: [site('Ashen Fortress', 'shadowkeep', ['mezzoloth', 'night_hag']), site('Hag Market', 'shadowkeep', ['night_hag', 'nycaloth'], 2)],
    },
    gehenna: {
      base: 'BRIMSTONE', road: 'hell_road', gate: 'Furnace Gate',
      terrain: (h, m, v) => (h > 0.86 ? 'MOUNTAIN' : v > 0.82 ? 'LAVA' : m > 0.64 ? 'ASH' : 'BRIMSTONE'),
      towns: ['Slagmarket'],
      sites: [site('Furnace Mount', 'infernal', ['mezzoloth', 'barghest']), site('Mercenary Keep', 'infernal', ['nycaloth', 'mezzoloth'], 2)],
    },
    nine_hells: {
      base: 'BRIMSTONE', road: 'hell_road', gate: 'Iron Gate',
      terrain: (h, m, v) => (h > 0.86 ? 'MOUNTAIN' : v > 0.76 ? 'LAVA' : m > 0.66 ? 'ASH' : 'BRIMSTONE'),
      props: { BRIMSTONE: ['hell_spire', 15] },
      towns: ['Contract Exchange'],
      sites: [site('Iron Bastion', 'infernal', ['bearded_devil', 'chain_devil']), site('Brimstone Citadel', 'infernal', ['bone_devil', 'erinyes'], 1), site('Pit of Oaths', 'infernal', ['barbed_devil', 'horned_devil'], 2)],
    },
    acheron: {
      base: 'IRON', road: 'iron_plate', gate: 'Clanging Gate',
      terrain: (h, m, v) => (h < 0.1 ? 'RIFT' : v > 0.8 ? 'GEARS' : 'IRON'),
      towns: ['Rustwall'],
      sites: [site('Rusted Cube Fortress', 'clockwork', ['rust_monster', 'hobgoblin']), site('War Foundry', 'clockwork', ['iron_golem', 'bugbear'], 2)],
    },
    mechanus: {
      base: 'GEARS', road: 'iron_plate', gate: 'Turning Door',
      terrain: (h, m, v) => (h < 0.1 ? 'RIFT' : m > 0.7 ? 'IRON' : 'GEARS'),
      props: { GEARS: ['cog', 10] },
      towns: ['Cogtown'],
      sites: [site('Clockwork Citadel', 'clockwork', ['inevitable_zelekhut', 'formian_warrior'], 1), site('Gear Maze', 'clockwork', ['formian_worker', 'iron_cobra']), site('Hall of Judgement', 'clockwork', ['inevitable_kolyarut', 'inevitable_marut'], 2)],
    },
    arcadia: {
      base: 'GRASS', road: 'marble', gate: 'Orchard Gate',
      // orderly orchards in rows between the fields
      terrain: (h, m, v, col, row) => (h < 0.12 ? 'WATER' : m > 0.5 && ((row % 6) + 6) % 6 < 2 ? 'FOREST' : 'GRASS'),
      towns: ['Orchard Market'],
      sites: [site('Orchard Fortress', 'celestial', ['hound_archon', 'formian_warrior']), site('Hall of Order', 'fortress', ['formian_taskmaster', 'inevitable_zelekhut'], 2)],
    },
    outlands: {
      base: 'GRASS', road: 'road', gate: 'Crossroads Gate',
      terrain: (h, m) => temperate(h, m),
      towns: ['Gate Town', 'Wayfarers Rest'],
      sites: [site('Spire Foothill Ruin', 'ruins', ['bandit', 'gargoyle']), site('Neutral Ground', 'fortress', ['ogre', 'hill_giant'], 1)],
    },
  });

  // How a plane is called in passing ("a portal to the Abyss").
  const SHORT = Object.freeze({
    material: 'the Material Plane', astral: 'the Astral', ethereal: 'the Ethereal', shadow: 'Shadow',
    elemental_fire: 'Elemental Fire', elemental_water: 'Elemental Water', elemental_earth: 'Elemental Earth', elemental_air: 'Elemental Air',
    para_ice: 'Ice', para_magma: 'Magma', para_ooze: 'Ooze', para_smoke: 'Smoke',
    positive_energy: 'Positive Energy', negative_energy: 'Negative Energy',
    mount_celestia: 'Celestia', bytopia: 'Bytopia', elysium: 'Elysium', beastlands: 'the Beastlands', arborea: 'Arborea',
    ysgard: 'Ysgard', limbo: 'Limbo', pandemonium: 'Pandemonium', abyss: 'the Abyss', carceri: 'Carceri',
    gray_waste: 'the Gray Waste', gehenna: 'Gehenna', nine_hells: 'the Nine Hells', acheron: 'Acheron',
    mechanus: 'Mechanus', arcadia: 'Arcadia', outlands: 'the Outlands',
  });

  const _cache = new Map();

  function categoryOf(id) {
    const p = TR.PlaneRegistry ? TR.PlaneRegistry.get(id) : null;
    return p ? p.category : 'prime';
  }

  // Everything known about a plane's look and danger; null for unknown ids.
  function get(id) {
    if (!id)
      return null;
    if (_cache.has(id))
      return _cache.get(id);
    const plane = TR.PlaneRegistry ? TR.PlaneRegistry.get(id) : null;
    if (!plane)
      return null;
    const cat = BY_CATEGORY[plane.category] || BY_CATEGORY.outer;
    const prof = PROFILES[id] || {};
    const out = Object.freeze({
      id, name: plane.name, category: plane.category, traits: plane.traits || {},
      levelBonus: cat.levelBonus, encounterScale: cat.encounterScale, portalChance: cat.portalChance,
      siteDifficulty: cat.siteDifficulty,
      base: prof.base || 'GRASS', road: prof.road || 'road', gate: prof.gate || null,
      terrain: prof.terrain || null, props: prof.props || {},
      towns: prof.towns || [], sites: prof.sites || [],
    });
    _cache.set(id, out);
    return out;
  }

  // The plane's own creatures the game can field.
  function natives(id) {
    const plane = TR.PlaneRegistry ? TR.PlaneRegistry.get(id) : null;
    const R = TR.MonsterRoster;
    if (!plane || !R)
      return [];
    return (plane.inhabitants || []).filter(m => R.crOf(m) != null);
  }

  TR.PlaneWorlds = Object.freeze({
    get, natives, categoryOf,
    shortName: id => SHORT[id] || (TR.PlaneRegistry && TR.PlaneRegistry.get(id) ? TR.PlaneRegistry.get(id).name : id),
    ids: () => Object.keys(PROFILES),
    has: id => !!get(id),
    PROFILES,
  });
})();
