/* Static cosmetics: ship skins (hull shape and paint), engine trails and shot colours, each with
   how it is unlocked - free, bought with stardust, earned by an achievement, a story chapter or
   a seasonal event tier. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  /* colors: [paint, dark, accent, engine glow] */
  const SKINS = [
    { id: 'kestrel', name: 'Kestrel', hull: 'dart', colors: ['#c8d8f0', '#3a4a6a', '#5ad8ff', '#5ad8ff'], unlock: { by: 'default' } },
    { id: 'vector', name: 'Vector 1979', hull: 'vector', colors: ['#ffffff', '#000000', '#ffffff', '#ffffff'], unlock: { by: 'default' } },
    { id: 'crimson', name: 'Crimson Ace', hull: 'arrow', colors: ['#e83a3a', '#4a0a10', '#ffd25a', '#ff8a40'], unlock: { by: 'dust', cost: 400 } },
    { id: 'cobalt', name: 'Cobalt Wing', hull: 'wing', colors: ['#3a7aff', '#0a1a4a', '#bfe8ff', '#6ab8ff'], unlock: { by: 'dust', cost: 600 } },
    { id: 'neon', name: 'Neon Runner', hull: 'arrow', colors: ['#1a1a2a', '#05050a', '#ff3ad0', '#3affe0'], unlock: { by: 'dust', cost: 900 } },
    { id: 'stealth', name: 'Nightfall', hull: 'wing', colors: ['#2a2e3a', '#0a0c12', '#8a9ab8', '#a070ff'], unlock: { by: 'dust', cost: 1200 } },
    { id: 'gilded', name: 'Gilded', hull: 'dart', colors: ['#ffd25a', '#6a4a08', '#fff4c0', '#ffe080'], unlock: { by: 'ach', id: 'rich' } },
    { id: 'comet', name: 'Comet', hull: 'arrow', colors: ['#e0f8ff', '#3a5a7a', '#80e0ff', '#ffffff'], unlock: { by: 'ach', id: 'combo50' } },
    { id: 'ember', name: 'Emberwing', hull: 'wing', colors: ['#ff7a30', '#3a0e04', '#ffd060', '#ff5020'], unlock: { by: 'story', chapter: 2 } },
    { id: 'prism', name: 'Prismatic', hull: 'dart', colors: ['#d0b0ff', '#2a1060', '#80ffff', '#c070ff'], unlock: { by: 'story', chapter: 3 } },
    { id: 'abyss', name: 'Abyss Walker', hull: 'wing', colors: ['#300810', '#0a0204', '#ff4a6a', '#ff2a4a'], unlock: { by: 'story', chapter: 5 } },
    { id: 'frost', name: 'Frostbite', hull: 'arrow', colors: ['#e8f8ff', '#4a7aa0', '#9ae0ff', '#bff4ff'], unlock: { by: 'season', season: 'winter', tier: 4 } },
    { id: 'bloom', name: 'Blossom', hull: 'wing', colors: ['#ffc0dc', '#6a2a50', '#a0ff90', '#ff90c8'], unlock: { by: 'season', season: 'spring', tier: 4 } },
    { id: 'solar', name: 'Solar Flare', hull: 'arrow', colors: ['#fff0a0', '#a04a08', '#ffffff', '#ffb030'], unlock: { by: 'season', season: 'summer', tier: 4 } },
    { id: 'harvest', name: 'Harvest Moon', hull: 'dart', colors: ['#e0904a', '#4a200a', '#ffe060', '#ff9a30'], unlock: { by: 'season', season: 'autumn', tier: 4 } },
    { id: 'spectre', name: 'Spectre', hull: 'wing', colors: ['#d0ffe0', '#1a3a2a', '#a0ff40', '#80ff80'], unlock: { by: 'season', season: 'halloween', tier: 4 } },
    { id: 'starfall', name: 'Starfall', hull: 'dart', colors: ['#ffffff', '#1a2a5a', '#ffd25a', '#ff5ad0'], unlock: { by: 'season', season: 'yearend', tier: 4 } },
  ];

  const TRAILS = [
    { id: 'ion', name: 'Ion Wake', style: 'ion', cols: ['#ffffff', '#9ae8ff', '#3a8aff'], unlock: { by: 'default' } },
    { id: 'comet', name: 'Comet Tail', style: 'ion', cols: ['#ffffff', '#fff0b0', '#ffa040'], unlock: { by: 'dust', cost: 300 } },
    { id: 'prism', name: 'Prism', style: 'prism', cols: ['#ff5a5a', '#ffd25a', '#5aff8a', '#5ad8ff', '#c070ff'], unlock: { by: 'dust', cost: 1000 } },
    { id: 'ember', name: 'Ember Wake', style: 'ember', cols: ['#ffffff', '#ffc050', '#ff5020'], unlock: { by: 'ach', id: 'boss1' } },
    { id: 'spark', name: 'Sparkler', style: 'spark', cols: ['#ffffff', '#ffe080', '#ff9a30'], unlock: { by: 'ach', id: 'rocks1000' } },
    { id: 'frost', name: 'Snowfall', style: 'snow', cols: ['#ffffff', '#cfefff', '#8ac8ff'], unlock: { by: 'season', season: 'winter', tier: 2 } },
    { id: 'petal', name: 'Petals', style: 'petal', cols: ['#ffd0e8', '#ff90c0', '#ffffff'], unlock: { by: 'season', season: 'spring', tier: 2 } },
    { id: 'sun', name: 'Sunfire', style: 'ember', cols: ['#ffffff', '#fff080', '#ff9a20'], unlock: { by: 'season', season: 'summer', tier: 2 } },
    { id: 'leaf', name: 'Falling Leaves', style: 'leaf', cols: ['#ffb040', '#e06020', '#a03010'], unlock: { by: 'season', season: 'autumn', tier: 2 } },
    { id: 'ghost', name: 'Wisps', style: 'ghost', cols: ['#e0fff0', '#80ffb0', '#20a060'], unlock: { by: 'season', season: 'halloween', tier: 2 } },
    { id: 'fireworks', name: 'Fireworks', style: 'spark', cols: ['#ffffff', '#ff5ad0', '#5ad8ff'], unlock: { by: 'season', season: 'yearend', tier: 2 } },
  ];

  /* ramp: [core, mid, outer] */
  const SHOTS = [
    { id: 'cyan', name: 'Cyan Bolt', ramp: ['#ffffff', '#a0f0ff', '#2a9aff'], unlock: { by: 'default' } },
    { id: 'crimson', name: 'Crimson Bolt', ramp: ['#ffffff', '#ffb0a0', '#ff2a3a'], unlock: { by: 'dust', cost: 250 } },
    { id: 'lime', name: 'Lime Bolt', ramp: ['#ffffff', '#d0ffa0', '#40e040'], unlock: { by: 'dust', cost: 250 } },
    { id: 'gold', name: 'Gold Bolt', ramp: ['#ffffff', '#fff0a0', '#ffb020'], unlock: { by: 'ach', id: 'stars30' } },
    { id: 'violet', name: 'Void Bolt', ramp: ['#ffffff', '#f0c0ff', '#a040ff'], unlock: { by: 'story', chapter: 4 } },
    { id: 'rose', name: 'Rose Bolt', ramp: ['#ffffff', '#ffd0e8', '#ff60b0'], unlock: { by: 'season', season: 'spring', tier: 6 } },
    { id: 'frost', name: 'Frost Bolt', ramp: ['#ffffff', '#e0f8ff', '#80d0ff'], unlock: { by: 'season', season: 'winter', tier: 6 } },
    { id: 'toxic', name: 'Hex Bolt', ramp: ['#ffffff', '#e0ffa0', '#80ff20'], unlock: { by: 'season', season: 'halloween', tier: 6 } },
  ];

  const KINDS = { skin: SKINS, trail: TRAILS, shot: SHOTS };

  function find(kind, id) {
    const list = KINDS[kind];
    for (let i = 0; i < list.length; ++i)
      if (list[i].id === id) return list[i];
    return null;
  }

  Object.assign(NS.cosmetics, {
    SKINS, TRAILS, SHOTS, KINDS, find
  });
})();
