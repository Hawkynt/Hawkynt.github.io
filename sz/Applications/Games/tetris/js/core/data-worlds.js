/* The five realms of the story, each with a palette, a backdrop style, a music key and six
   stages - five objectives and a guardian. Stage kinds: lines (clear n lines), score (reach a
   score), dig (clear every garbage row), gems (clear every gem), survive (last a time while
   garbage rises), combo (reach a combo of n) and boss. Each stage starts at a gravity level, may
   have a time limit, a par time for the second star and a bonus goal for the third. The
   guardians have hit points, a garbage attack and a special move. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  const WORLDS = [
    { id: 'verdant', name: 'Verdant Ruins', blurb: 'Mossy towers under a green sky', sky: ['#6ec8f0', '#c8f0d0'], ground: '#3a7a3a', accent: '#7be08a', glow: '#d8ffb0', style: 'ruins',
      boss: { id: 'grumbleroot', name: 'Grumbleroot', title: 'the Moss Titan', hp: 30, every: 14, rows: 2, special: 'vines', specialEvery: 20, color: '#4a9a3a', accent: '#c8f070' },
      stages: [
        { name: 'First Stones', kind: 'lines', n: 10, level: 1, par: 70, bonus: { k: 'quads', n: 1 } },
        { name: 'Climbing Ivy', kind: 'lines', n: 20, level: 2, par: 120, bonus: { k: 'combo', n: 3 } },
        { name: 'Root Cellar', kind: 'dig', garbage: 6, level: 2, par: 90, bonus: { k: 'nohold' } },
        { name: 'Lantern Path', kind: 'score', n: 8000, level: 3, time: 150, par: 100, bonus: { k: 'quads', n: 2 } },
        { name: 'Overgrown Gate', kind: 'gems', garbage: 5, level: 3, par: 110, bonus: { k: 'tspins', n: 1 } },
        { name: 'Grumbleroot', kind: 'boss', level: 3, par: 150, bonus: { k: 'nohit' } },
      ] },
    { id: 'crystal', name: 'Crystal Hollows', blurb: 'Glittering caverns that hum', sky: ['#1a1440', '#4a3a8a'], ground: '#3a2a6a', accent: '#9affea', glow: '#c8a8ff', style: 'caves',
      boss: { id: 'shardmaw', name: 'Shardmaw', title: 'the Crystal Wyrm', hp: 40, every: 13, rows: 2, special: 'crystals', specialEvery: 15, color: '#7ab0ff', accent: '#e8f8ff' },
      stages: [
        { name: 'Glow Tunnel', kind: 'lines', n: 25, level: 4, par: 130, bonus: { k: 'quads', n: 2 } },
        { name: 'Shard Pit', kind: 'dig', garbage: 9, level: 4, par: 120, bonus: { k: 'combo', n: 4 } },
        { name: 'Echo Hall', kind: 'combo', n: 3, level: 4, garbage: 8, par: 120, bonus: { k: 'nohold' } },
        { name: 'Geode Run', kind: 'score', n: 20000, level: 5, time: 150, par: 110, bonus: { k: 'tspins', n: 1 } },
        { name: 'Prism Vault', kind: 'gems', garbage: 8, level: 5, par: 130, bonus: { k: 'quads', n: 2 } },
        { name: 'Shardmaw', kind: 'boss', level: 5, par: 170, bonus: { k: 'nohit' } },
      ] },
    { id: 'sunken', name: 'Sunken Temple', blurb: 'Drowned halls of an old sea people', sky: ['#0a3a5a', '#2a8aa0'], ground: '#1a4a5a', accent: '#5ae0e0', glow: '#a0fff0', style: 'temple',
      boss: { id: 'maelora', name: 'Maelora', title: 'the Tide Leviathan', hp: 50, every: 12, rows: 3, special: 'tide', specialEvery: 18, color: '#2ab0c0', accent: '#a0fff0' },
      stages: [
        { name: 'Flooded Steps', kind: 'survive', time: 75, rise: 9, level: 5, par: 75, bonus: { k: 'quads', n: 1 } },
        { name: 'Coral Columns', kind: 'lines', n: 30, level: 6, par: 140, bonus: { k: 'tspins', n: 1 } },
        { name: 'Pearl Diver', kind: 'gems', garbage: 10, level: 6, par: 140, bonus: { k: 'combo', n: 4 } },
        { name: 'Undertow', kind: 'dig', garbage: 12, level: 6, par: 150, bonus: { k: 'nohold' } },
        { name: 'Bell of the Deep', kind: 'score', n: 35000, level: 7, time: 150, par: 120, bonus: { k: 'perfect' } },
        { name: 'Maelora', kind: 'boss', level: 7, par: 180, bonus: { k: 'nohit' } },
      ] },
    { id: 'ember', name: 'Ember Forge', blurb: 'Rivers of lava under iron bridges', sky: ['#3a0a0a', '#c04a1a'], ground: '#4a1a10', accent: '#ff8a3a', glow: '#ffd07a', style: 'forge',
      boss: { id: 'vulkar', name: 'Vulkar', title: 'the Forge King', hp: 60, every: 11, rows: 3, special: 'heat', specialEvery: 20, color: '#ff6a2a', accent: '#ffe07a' },
      stages: [
        { name: 'Anvil Row', kind: 'lines', n: 35, level: 8, par: 150, bonus: { k: 'quads', n: 3 } },
        { name: 'Slag Heap', kind: 'dig', garbage: 14, level: 8, par: 160, bonus: { k: 'tspins', n: 1 } },
        { name: 'Bellows', kind: 'survive', time: 90, rise: 7, level: 8, par: 90, bonus: { k: 'combo', n: 5 } },
        { name: 'Spark Chain', kind: 'combo', n: 4, level: 8, garbage: 10, par: 140, bonus: { k: 'quads', n: 1 } },
        { name: 'Crucible', kind: 'score', n: 60000, level: 9, time: 150, par: 130, bonus: { k: 'tspins', n: 2 } },
        { name: 'Vulkar', kind: 'boss', level: 9, par: 190, bonus: { k: 'nohit' } },
      ] },
    { id: 'void', name: 'Starlit Spire', blurb: 'The tower at the edge of the sky', sky: ['#05030f', '#2a1a5a'], ground: '#1a103a', accent: '#c08aff', glow: '#ffe8a0', style: 'spire',
      boss: { id: 'mason', name: 'The Hollow Mason', title: 'Unbuilder of Worlds', hp: 80, every: 10, rows: 3, special: 'mirror', specialEvery: 22, color: '#8a5aff', accent: '#ffe8a0' },
      stages: [
        { name: 'Starlit Stair', kind: 'lines', n: 40, level: 10, par: 160, bonus: { k: 'quads', n: 3 } },
        { name: 'Comet Garden', kind: 'gems', garbage: 12, level: 10, par: 160, bonus: { k: 'tspins', n: 2 } },
        { name: 'Gravity Well', kind: 'survive', time: 100, rise: 6, level: 11, par: 100, bonus: { k: 'nohold' } },
        { name: 'Constellation', kind: 'combo', n: 5, level: 11, garbage: 12, par: 150, bonus: { k: 'perfect' } },
        { name: 'Edge of Night', kind: 'dig', garbage: 16, level: 12, par: 170, bonus: { k: 'combo', n: 6 } },
        { name: 'The Hollow Mason', kind: 'boss', level: 12, par: 220, bonus: { k: 'nohit' } },
      ] },
  ];

  const STAGES = [];
  for (let w = 0; w < WORLDS.length; ++w)
    for (let s = 0; s < WORLDS[w].stages.length; ++s) {
      const st = WORLDS[w].stages[s];
      st.id = WORLDS[w].id + '-' + (s + 1);
      st.world = w;
      st.index = s;
      st.n = st.n || 0;
      STAGES.push(st);
    }
  const BY_ID = {};
  for (let i = 0; i < STAGES.length; ++i) BY_ID[STAGES[i].id] = STAGES[i];
  const BOSSES = WORLDS.map(w => w.boss);

  NS.worldData = { WORLDS, STAGES, BY_ID, BOSSES };
})();
