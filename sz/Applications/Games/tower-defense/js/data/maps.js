/* data/maps.js -- biomes, the 24 campaign maps, their campaign order and regions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});

  /* ══════════════════════════════════════════════════════════════════
     BIOMES AND MAPS -- paths are waypoint sequences on a 25 x 17 grid;
     features are blocked rectangles [col0, row0, col1, row1]. Map order
     and names are kept from format 1 so old saves land on the same map.
     ══════════════════════════════════════════════════════════════════ */

  const BIOMES = {
    meadow:  { name: 'Greenvale', color: '#6fd06a', ground: '#4f8a3a', path: '#a8834e', feature: 'water', desc: 'Rolling meadows, ponds and old forests.' },
    desert:  { name: 'Sunscar Desert', color: '#ffc25a', ground: '#c9a25e', path: '#8e7350', feature: 'water', desc: 'Dunes, mesas and the odd oasis.' },
    tundra:  { name: 'Frostreach', color: '#9fe0ff', ground: '#dfe9f2', path: '#8a9bb0', feature: 'ice', desc: 'Snowfields and frozen lakes.' },
    volcano: { name: 'Ashen Wastes', color: '#ff7a3a', ground: '#4a3a3a', path: '#2a2026', feature: 'lava', desc: 'Basalt, ash and rivers of lava.' },
    swamp:   { name: 'Mirewood', color: '#b6d65a', ground: '#3b522c', path: '#9a7448', feature: 'bog', desc: 'Drowned woods, plank walks and sucking bogs.' },
    cavern:  { name: 'Crystal Caverns', color: '#b48aff', ground: '#302c46', path: '#7a7498', feature: 'chasm', desc: 'Glittering halls above bottomless chasms.' }
  };
  const BIOME_ORDER = ['meadow', 'swamp', 'desert', 'cavern', 'tundra', 'volcano'];

  const MAPS = [
    { name: 'Serpentine', biome: 'meadow', waves: 15, startGold: 220, startLives: 20, hpMul: 0.85,
      desc: 'A gentle road winding through the meadow. A fine place to learn the ropes.',
      paths: [[[0,8],[4,8],[4,3],[10,3],[10,13],[16,13],[16,5],[21,5],[21,11],[24,11]]],
      features: [['water', 12, 6, 14, 9], ['water', 0, 15, 6, 16], ['rock', 19, 14, 20, 15]] },
    { name: 'Crossroads', biome: 'meadow', waves: 15, startGold: 300, startLives: 20, hpMul: 0.66,
      desc: 'Two roads cross twice. Enemies come from the west and the north.',
      paths: [[[0,4],[17,4],[17,16]], [[7,0],[7,12],[24,12]]],
      features: [['water', 19, 0, 23, 2], ['water', 1, 13, 4, 15], ['rock', 11, 7, 13, 9]] },
    { name: 'Spiral', biome: 'meadow', waves: 18, startGold: 230, startLives: 20, hpMul: 0.86,
      desc: 'The road coils inward to the old keep. Long, but every turn is a chance.',
      paths: [[[0,1],[22,1],[22,15],[2,15],[2,5],[18,5],[18,11],[7,11],[7,8],[13,8]]],
      features: [['water', 10, 12, 14, 13], ['rock', 15, 7, 16, 9]] },
    { name: 'Zigzag', biome: 'desert', waves: 18, startGold: 240, startLives: 20, hpMul: 0.91,
      desc: 'Long switchbacks through the dunes, past a shaded oasis.',
      paths: [[[0,2],[6,2],[6,14],[12,14],[12,2],[18,2],[18,14],[24,14]]],
      features: [['water', 20, 5, 23, 9], ['rock', 8, 6, 10, 9], ['rock', 14, 9, 16, 11]] },
    { name: 'Diamond', biome: 'desert', waves: 20, startGold: 250, startLives: 20, hpMul: 1.03,
      desc: 'The road circles a great mesa and doubles back across itself.',
      paths: [[[0,8],[3,8],[3,2],[21,2],[21,14],[6,14],[6,6],[17,6],[17,10],[24,10]]],
      features: [['rock', 9, 9, 14, 12], ['water', 23, 13, 24, 16]] },
    { name: 'Fortress', biome: 'desert', waves: 20, startGold: 260, startLives: 20, hpMul: 1.18,
      desc: 'Two caravan routes join before the fortress gate.',
      paths: [[[0,3],[8,3],[8,8],[16,8],[16,4],[24,4]], [[0,13],[8,13],[8,8],[16,8],[16,4],[24,4]]],
      features: [['rock', 11, 11, 14, 14], ['water', 19, 9, 23, 12], ['rock', 11, 1, 13, 2]] },
    { name: 'Canyon', biome: 'tundra', waves: 22, startGold: 250, startLives: 18, hpMul: 1.61, budgetMul: 1.15,
      desc: 'A frozen canyon cut into deep switchbacks.',
      paths: [[[0,14],[4,14],[4,2],[9,2],[9,14],[14,14],[14,2],[19,2],[19,14],[24,14]]],
      features: [['ice', 21, 4, 23, 9], ['rock', 6, 6, 7, 9], ['rock', 16, 6, 17, 9]] },
    { name: 'Labyrinth', biome: 'tundra', waves: 22, startGold: 260, startLives: 18, hpMul: 1.87, budgetMul: 1.2,
      desc: 'An icy maze of twists and blind turns.',
      paths: [[[0,2],[5,2],[5,8],[1,8],[1,14],[10,14],[10,5],[15,5],[15,12],[20,12],[20,2],[24,2]]],
      features: [['ice', 12, 7, 13, 11], ['rock', 4, 10, 7, 11], ['ice', 22, 6, 24, 10]] },
    { name: 'Twin Paths', biome: 'tundra', waves: 24, startGold: 280, startLives: 18, hpMul: 2.09, budgetMul: 1.25,
      desc: 'Two mirrored roads run side by side through the snow.',
      paths: [[[0,2],[8,2],[8,7],[16,7],[16,2],[24,2]], [[0,14],[8,14],[8,9],[16,9],[16,14],[24,14]]],
      features: [['ice', 10, 11, 14, 12], ['ice', 10, 4, 14, 5], ['rock', 2, 6, 4, 10], ['rock', 20, 6, 22, 10]] },
    { name: 'Gauntlet', biome: 'volcano', waves: 25, startGold: 270, startLives: 15, hpMul: 2.9, budgetMul: 1.4,
      desc: 'Narrow ridges between rivers of lava. Space is precious.',
      paths: [[[0,8],[3,8],[3,2],[7,2],[7,14],[11,14],[11,2],[15,2],[15,14],[19,14],[19,2],[22,2],[22,8],[24,8]]],
      features: [['lava', 5, 4, 5, 12], ['lava', 13, 4, 13, 12], ['lava', 17, 4, 17, 12], ['lava', 21, 11, 24, 16]] },
    { name: 'Wasteland', biome: 'volcano', waves: 25, startGold: 290, startLives: 15, hpMul: 3.05, budgetMul: 1.45,
      desc: 'Ash plains where two war parties join at the ridge and march east together.',
      paths: [[[0,2],[8,2],[8,9],[13,9],[13,4],[20,4],[20,12],[24,12]], [[0,15],[8,15],[8,9],[13,9],[13,4],[20,4],[20,12],[24,12]]],
      features: [['lava', 1, 5, 4, 9], ['lava', 15, 6, 18, 10], ['rock', 10, 12, 13, 14], ['rock', 22, 0, 24, 2]] },
    { name: 'Final Stand', biome: 'volcano', waves: 30, startGold: 320, startLives: 10, hpMul: 3.5, budgetMul: 1.5,
      desc: 'The last citadel. Both armies march on the heart of the fortress.',
      paths: [[[0,2],[9,2],[9,5],[3,5],[3,12],[8,12],[8,8],[12,8]], [[24,14],[15,14],[15,11],[21,11],[21,4],[16,4],[16,8],[12,8]]],
      features: [['lava', 10, 11, 13, 13], ['lava', 11, 3, 13, 5], ['rock', 0, 14, 2, 16], ['rock', 23, 0, 24, 2]] },
    // Added after the original twelve; CAMPAIGN sets where each one is played
    { name: 'Mill Pond', biome: 'meadow', waves: 18, startGold: 240, startLives: 20, hpMul: 0.86,
      desc: 'The road parts around the mill pond and meets again below the mill. Guard both banks.',
      paths: [[[0,6],[5,6],[5,3],[16,3],[16,7],[20,7],[20,13],[24,13]], [[0,6],[5,6],[5,10],[16,10],[16,7],[20,7],[20,13],[24,13]]],
      features: [['water', 9, 5, 12, 8], ['water', 1, 12, 5, 15], ['rock', 21, 1, 23, 3], ['water', 14, 13, 16, 15]] },
    { name: 'Boardwalk', biome: 'swamp', waves: 18, startGold: 240, startLives: 20, hpMul: 0.86,
      desc: 'A long plank walk winds through the drowned wood. Bogs leave only islands to build on.',
      paths: [[[0,13],[3,13],[3,3],[8,3],[8,10],[12,10],[12,5],[16,5],[16,14],[21,14],[21,6],[24,6]]],
      features: [['bog', 5, 12, 7, 15], ['bog', 9, 0, 14, 2], ['bog', 18, 8, 19, 11], ['rock', 22, 10, 24, 12], ['bog', 13, 12, 14, 15]] },
    { name: 'Twin Fens', biome: 'swamp', waves: 20, startGold: 260, startLives: 20, hpMul: 0.86,
      desc: 'Raiders wade in from the west and the south fen; their trails join at the old sluice.',
      paths: [[[0,2],[6,2],[6,9],[17,9],[17,3],[22,3],[22,13],[24,13]], [[3,16],[3,13],[12,13],[12,9],[17,9],[17,3],[22,3],[22,13],[24,13]]],
      features: [['bog', 8, 4, 13, 6], ['bog', 18, 11, 20, 15], ['rock', 0, 5, 2, 8], ['bog', 14, 12, 16, 15]] },
    { name: 'Witch\'s Hollow', biome: 'swamp', waves: 20, startGold: 260, startLives: 20, hpMul: 0.87,
      desc: 'One trail from the north forks around the hollow and closes on the witch\'s hut from both sides.',
      paths: [[[14,0],[14,3],[5,3],[5,12],[12,12]], [[14,0],[14,3],[20,3],[20,9],[15,9],[15,12],[12,12]]],
      features: [['bog', 8, 6, 11, 9], ['bog', 21, 12, 24, 16], ['rock', 0, 0, 2, 2], ['bog', 16, 5, 18, 7]] },
    { name: 'Mire Crossing', biome: 'swamp', waves: 20, startGold: 270, startLives: 20, hpMul: 0.89,
      desc: 'Two war bands cross the mire on their own paths, and the paths cross once. Firm ground is scarce.',
      paths: [[[0,2],[7,2],[7,8],[3,8],[3,14],[12,14],[12,10],[24,10]], [[17,0],[17,5],[21,5],[21,16]]],
      features: [['bog', 9, 4, 15, 8], ['bog', 5, 10, 9, 12], ['rock', 14, 12, 18, 15], ['bog', 22, 0, 24, 3]] },
    { name: 'Dune Sea', biome: 'desert', waves: 22, startGold: 260, startLives: 18, hpMul: 1.23, budgetMul: 1.1,
      desc: 'Open sand as far as the eye can see, but the road squeezes between mesas twice.',
      paths: [[[0,8],[4,8],[4,2],[11,2],[11,14],[16,14],[16,5],[21,5],[21,16]]],
      features: [['rock', 8, 9, 10, 11], ['rock', 12, 9, 13, 11], ['rock', 17, 8, 18, 11], ['water', 1, 11, 3, 14], ['rock', 6, 4, 8, 6]] },
    { name: 'Glimmerdeep', biome: 'cavern', waves: 22, startGold: 260, startLives: 18, hpMul: 1.29, budgetMul: 1.1,
      desc: 'Steps of glittering stone lead down into the deep, then a climb back to the light. Bats take the short way across.',
      paths: [[[0,2],[5,2],[5,5],[10,5],[10,9],[15,9],[15,13],[20,13],[20,6],[24,6]]],
      features: [['chasm', 1, 7, 6, 14], ['chasm', 12, 6, 14, 7], ['rock', 22, 8, 24, 11], ['chasm', 16, 15, 23, 16]] },
    { name: 'Chasm Bridges', biome: 'cavern', waves: 22, startGold: 270, startLives: 18, hpMul: 1.36, budgetMul: 1.1,
      desc: 'Two columns cross the chasm on narrow bridges and meet under the great geode.',
      paths: [[[0,12],[6,12],[6,6],[19,6],[19,13],[24,13]], [[10,16],[10,10],[13,10],[13,6],[19,6],[19,13],[24,13]]],
      features: [['chasm', 15, 8, 17, 11], ['chasm', 0, 0, 4, 3], ['chasm', 21, 1, 24, 4], ['rock', 1, 14, 4, 16], ['chasm', 7, 8, 8, 10]] },
    { name: 'Geode Keep', biome: 'cavern', waves: 24, startGold: 280, startLives: 18, hpMul: 1.44, budgetMul: 1.15,
      desc: 'The keep sits in a hollow geode. One road climbs in from the west, the other winds down from the east.',
      paths: [[[0,13],[4,13],[4,2],[9,2],[9,8],[12,8]], [[24,12],[20,12],[20,2],[15,2],[15,5],[12,5],[12,8]]],
      features: [['chasm', 13, 9, 17, 13], ['chasm', 6, 10, 9, 15], ['rock', 21, 0, 24, 0], ['chasm', 6, 4, 7, 6]] },
    { name: 'Prism Falls', biome: 'cavern', waves: 24, startGold: 280, startLives: 18, hpMul: 1.52, budgetMul: 1.15,
      desc: 'The road splits around two crystal falls in a row. Every fork has to be held twice.',
      paths: [[[0,8],[3,8],[3,3],[9,3],[9,8],[13,8],[13,2],[21,2],[21,8],[24,8]], [[0,8],[3,8],[3,12],[9,12],[9,8],[13,8],[13,14],[21,14],[21,8],[24,8]]],
      features: [['chasm', 5, 5, 7, 10], ['rock', 15, 6, 18, 10], ['chasm', 0, 0, 1, 5], ['chasm', 23, 11, 24, 16]] },
    { name: 'Glacier Pass', biome: 'tundra', waves: 25, startGold: 290, startLives: 16, hpMul: 2.35, budgetMul: 1.3,
      desc: 'Three columns come down from the ice fields and join one by one on the way to the pass.',
      paths: [[[0,3],[8,3],[8,8],[14,8],[14,12],[20,12],[20,4],[24,4]], [[0,13],[8,13],[8,8],[14,8],[14,12],[20,12],[20,4],[24,4]], [[24,15],[17,15],[17,12],[20,12],[20,4],[24,4]]],
      features: [['ice', 10, 1, 16, 5], ['ice', 10, 10, 12, 15], ['rock', 2, 6, 4, 10], ['ice', 21, 7, 24, 11], ['ice', 18, 0, 22, 2]] },
    { name: 'Cinder Fork', biome: 'volcano', waves: 28, startGold: 300, startLives: 15, hpMul: 3.15, budgetMul: 1.45,
      desc: 'The road forks below the ash cone and leaves by two gates. Hold both or lose the valley.',
      paths: [[[0,13],[4,13],[4,3],[8,3],[8,9],[11,9],[11,5],[16,5],[16,1],[24,1]], [[0,13],[4,13],[4,3],[8,3],[8,9],[11,9],[11,13],[19,13],[19,9],[24,9]]],
      features: [['lava', 13, 7, 17, 10], ['lava', 0, 0, 2, 9], ['rock', 21, 11, 24, 14], ['lava', 5, 12, 9, 16]] }
  ];

  // Order of play: region by region (BIOME_ORDER), maps within a region in
  // this order. Maps added later are appended to MAPS so saves, stars and
  // records stay with their map; only their place in the campaign is set here.
  const CAMPAIGN = [0, 1, 2, 12, 13, 14, 15, 16, 3, 4, 5, 17, 18, 19, 20, 21, 6, 7, 8, 22, 9, 10, 23, 11];
  const MAP_RANK = [];
  CAMPAIGN.forEach((m, r) => { MAP_RANK[m] = r; });
  const REGIONS = BIOME_ORDER.map(biome => ({ biome, maps: CAMPAIGN.filter(i => MAPS[i].biome === biome) }));
  const ORIGINAL_MAPS = 12;    // maps that opened strictly one after another by index

  // Map that follows in the campaign, -1 after the last one
  function nextMapOf(i) {
    const r = MAP_RANK[i] + 1;
    return r < CAMPAIGN.length ? CAMPAIGN[r] : -1;
  }

  function regionOf(i) {
    return REGIONS.findIndex(R => R.maps.indexOf(i) >= 0);
  }

  // Format 1 wave counts, used once to honour maps already won back then
  const V1_WAVES = [15, 18, 15, 20, 15, 12, 18, 20, 16, 25, 15, 30];

  NS.maps = { BIOMES, BIOME_ORDER, MAPS, CAMPAIGN, MAP_RANK, REGIONS, ORIGINAL_MAPS, nextMapOf, regionOf,
      V1_WAVES };

})();
