/* The five worlds of the campaign: names, palettes for the sky, the parallax layers and the
   ground, ambient weather, the root note of the ambience, which course patterns each world
   favours, its guardian set-piece and its five stages (four runs and the guardian) with length,
   speed and difficulty. Pure data plus stage lookups; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  /* pattern weights: how often each course pattern appears in a world (0 = never) */
  const WORLDS = [
    {
      id: 'meadow', name: 'Sunpetal Meadows', sub: 'Rolling hills, bees and old farm fences',
      boss: 'boar', root: 262, weather: 'pollen',
      sky: ['#3f8fe0', '#8fd0ff', '#ffe8b8'], sun: '#fff2b0', sunX: 0.72, sunY: 0.22, night: false,
      far: '#8fb8e0', farHi: '#c8e4ff', mid: '#5aa868', midHi: '#9be08a', near: '#2f7a46', nearHi: '#5fbf5a',
      ground: ['#6fcf4a', '#3f9a3a', '#7a4f2e', '#4a2e1c'], deco: '#ffe06a', accent: '#ffd24a', fog: 'rgba(255,240,210,0.18)',
      pit: 'water',
      weights: { coins: 3, hurdle: 4, block: 4, bar: 3, pit: 3, pitPlat: 2, stairs: 2, wall: 1, spikes: 1, lowHigh: 2, saw: 0, drone: 2, rock: 1, roller: 2, spring: 2, boost: 1, crumble: 0, gemRoute: 2, rest: 1, double: 2, tunnel: 1 },
    },
    {
      id: 'canyon', name: 'Ember Canyon', sub: 'Red rock, tumbleweeds and rivers of lava',
      boss: 'wyrm', root: 233, weather: 'sand',
      sky: ['#e0603a', '#ffa860', '#ffe0a0'], sun: '#ffd27a', sunX: 0.3, sunY: 0.3, night: false,
      far: '#d88a6a', farHi: '#f4b890', mid: '#b4583a', midHi: '#e48a5a', near: '#7a3424', nearHi: '#b45a3a',
      ground: ['#e0a060', '#b4703a', '#7a3f22', '#4a2214'], deco: '#ffb04a', accent: '#ff8a3a', fog: 'rgba(255,200,150,0.18)',
      pit: 'lava',
      weights: { coins: 2, hurdle: 3, block: 3, bar: 3, pit: 4, pitPlat: 3, stairs: 2, wall: 2, spikes: 2, lowHigh: 2, saw: 1, drone: 2, rock: 3, roller: 3, spring: 2, boost: 1, crumble: 2, gemRoute: 2, rest: 1, double: 2, tunnel: 1 },
    },
    {
      id: 'frost', name: 'Frostpeak Pass', sub: 'Glaciers, icicles and the northern lights',
      boss: 'avalanche', root: 294, weather: 'snow',
      sky: ['#1a2a5a', '#4a70b0', '#b8d8f0'], sun: '#e8f4ff', sunX: 0.8, sunY: 0.18, night: false,
      far: '#8aa8d0', farHi: '#e8f4ff', mid: '#5a7aa8', midHi: '#c8e0f4', near: '#2e4a78', nearHi: '#8ab0d8',
      ground: ['#f0f8ff', '#bcd8ee', '#5a7a9a', '#2e4460'], deco: '#bff0ff', accent: '#8ae0ff', fog: 'rgba(220,240,255,0.22)',
      pit: 'chasm',
      weights: { coins: 2, hurdle: 3, block: 3, bar: 3, pit: 3, pitPlat: 3, stairs: 2, wall: 2, spikes: 2, lowHigh: 3, saw: 1, drone: 2, rock: 4, roller: 3, spring: 2, boost: 1, crumble: 3, gemRoute: 2, rest: 1, double: 2, tunnel: 2 },
    },
    {
      id: 'neon', name: 'Neon Metro', sub: 'Rooftops, security drones and laser signs',
      boss: 'warden', root: 220, weather: 'rain',
      sky: ['#0a0628', '#2a1058', '#c03a8a'], sun: '#ff6ad5', sunX: 0.5, sunY: 0.42, night: true,
      far: '#3a2a78', farHi: '#7a5aff', mid: '#24184e', midHi: '#ff4ab8', near: '#120c2a', nearHi: '#38e0ff',
      ground: ['#4a4a6a', '#2a2a44', '#16162a', '#0a0a16'], deco: '#38e0ff', accent: '#ff4ab8', fog: 'rgba(120,60,200,0.20)',
      pit: 'neon',
      weights: { coins: 2, hurdle: 3, block: 3, bar: 4, pit: 3, pitPlat: 3, stairs: 3, wall: 2, spikes: 2, lowHigh: 3, saw: 3, drone: 4, rock: 2, roller: 2, spring: 2, boost: 2, crumble: 2, gemRoute: 3, rest: 1, double: 2, tunnel: 2 },
    },
    {
      id: 'rift', name: 'The Hollow Rift', sub: 'Where the world comes apart at the seams',
      boss: 'king', root: 196, weather: 'void',
      sky: ['#05020e', '#24104a', '#5a2a7a'], sun: '#c08cff', sunX: 0.62, sunY: 0.3, night: true,
      far: '#2a1a4a', farHi: '#8a5aff', mid: '#1c0e34', midHi: '#c08cff', near: '#0e0620', nearHi: '#ff6ad5',
      ground: ['#5a3a8a', '#3a2260', '#1e1036', '#0c061a'], deco: '#e0b0ff', accent: '#c08cff', fog: 'rgba(150,80,255,0.18)',
      pit: 'void',
      weights: { coins: 2, hurdle: 3, block: 3, bar: 3, pit: 4, pitPlat: 3, stairs: 3, wall: 3, spikes: 3, lowHigh: 3, saw: 3, drone: 3, rock: 3, roller: 2, spring: 2, boost: 2, crumble: 4, gemRoute: 3, rest: 1, double: 3, tunnel: 2 },
    },
  ];

  const WORLD_BY_ID = {};
  for (let i = 0; i < WORLDS.length; ++i) {
    WORLDS[i].index = i;
    WORLD_BY_ID[WORLDS[i].id] = WORLDS[i];
  }

  const STAGE_NAMES = [
    ['First Light', 'Fencehop Farm', 'Beehive Bluff', 'Windmill Ridge'],
    ['Dust Devils', 'Mesa Leap', 'Cinder Falls', 'Magma Gorge'],
    ['Snowline', 'Icicle Hollow', 'Crystal Bridge', 'Aurora Climb'],
    ['Rooftop Rush', 'Signal Alley', 'Monorail Mile', 'Laser District'],
    ['Torn Horizon', 'Floating Isles', 'Mirror Steps', 'The Last Mile'],
  ];

  const STAGES_PER_WORLD = 5;

  /* stage s of world w: s 0-3 are runs, s 4 is the guardian set-piece */
  function stage(w, s) {
    const world = WORLDS[w];
    const isBoss = s === STAGES_PER_WORLD - 1;
    const lenM = isBoss ? 0 : 700 + s * 150 + w * 100;
    const v0 = 10 + w * 1.2 + s * 0.45;
    return {
      id: world.id + '-' + (s + 1), w: w, s: s, world: world, boss: isBoss ? world.boss : null,
      name: isBoss ? BOSS_NAMES[world.boss] : STAGE_NAMES[w][s],
      lenM: lenM, v0: v0, v1: v0 + 2.2 + w * 0.3, diff: Math.min(1, 0.12 + w * 0.18 + s * 0.05),
      shards: 3,
    };
  }

  const BOSS_NAMES = {
    boar: 'Thornback Stampede', wyrm: 'The Dune Wyrm', avalanche: 'Rime\'s Avalanche', warden: 'Warden Mk-II', king: 'The Hollow King',
  };

  function allStages() {
    const out = [];
    for (let w = 0; w < WORLDS.length; ++w)
      for (let s = 0; s < STAGES_PER_WORLD; ++s) out.push(stage(w, s));
    return out;
  }

  function stageById(id) {
    const m = /^([a-z]+)-(\d)$/.exec(id || '');
    if (!m || !WORLD_BY_ID[m[1]]) return null;
    const s = +m[2] - 1;
    if (s < 0 || s >= STAGES_PER_WORLD) return null;
    return stage(WORLD_BY_ID[m[1]].index, s);
  }

  Object.assign(NS.worlds, {
    WORLDS, WORLD_BY_ID, STAGES_PER_WORLD, BOSS_NAMES, stage, allStages, stageById
  });
})();
