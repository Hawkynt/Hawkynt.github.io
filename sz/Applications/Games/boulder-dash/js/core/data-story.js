/* The story: the cast, the five depths of Mount Ember with their looks (palettes, ambience,
   darkness) and their eight caves each, the dialogue between chapters and the scripts of the
   cinematics (intro, chapter openers, boss entrances, finale). Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  const CAST = {
    pip: { name: 'Pip Ferrow', color: '#ffb347', role: 'A young miner from Emberfall' },
    marla: { name: 'Granny Marla', color: '#9fe3a1', role: 'Retired mine matron, on the lamp radio' },
    king: { name: 'The Hollow King', color: '#c58bff', role: 'A crystal golem with an empty heart' },
    bolt: { name: 'Bolt', color: '#5fd6ff', role: 'A lantern sprite that follows Pip' }
  };

  /* palettes: backdrop sky, rock, dirt (three tones), brick, steel, glow, ambience particles, darkness */
  const THEMES = {
    amber: {
      name: 'Amber Mines', skyTop: '#2b1709', skyBottom: '#120904', rock: '#5a3b24', rockHi: '#8a613c',
      dirt: '#7b4a26', dirtHi: '#a8693a', dirtLo: '#4f2e16', brick: '#9a5530', brickHi: '#c9844f',
      steel: '#6c6f78', steelHi: '#b9bdc8', glow: '#ffc76a', accent: '#ffb347', ambient: 'dust', dark: 0.18,
      bg: '#1a0f08', vein: '#ffcf7a'
    },
    frost: {
      name: 'Frost Caverns', skyTop: '#0b2238', skyBottom: '#050c18', rock: '#2e4a66', rockHi: '#6a95bd',
      dirt: '#3f6b8c', dirtHi: '#7fb3d6', dirtLo: '#24425c', brick: '#5a7fa8', brickHi: '#9cc6ec',
      steel: '#7a8aa0', steelHi: '#dfe9f5', glow: '#9ff1ff', accent: '#7fe0ff', ambient: 'snow', dark: 0.22,
      bg: '#08131f', vein: '#c8f6ff'
    },
    grotto: {
      name: 'Glowshroom Grotto', skyTop: '#12061f', skyBottom: '#05020b', rock: '#3a2550', rockHi: '#6f4c94',
      dirt: '#3d2a46', dirtHi: '#6b4a78', dirtLo: '#24162c', brick: '#4e3a6a', brickHi: '#8a6fb3',
      steel: '#5d5a72', steelHi: '#b2adc9', glow: '#7dffb5', accent: '#9dff6a', ambient: 'spores', dark: 0.62,
      bg: '#0a0512', vein: '#8dffc9'
    },
    magma: {
      name: 'Magma Forge', skyTop: '#2e0905', skyBottom: '#0f0302', rock: '#4a1f17', rockHi: '#87402c',
      dirt: '#5b2a1c', dirtHi: '#8c4a2d', dirtLo: '#36160d', brick: '#7a2f20', brickHi: '#c25a35',
      steel: '#5b5354', steelHi: '#a89c9a', glow: '#ff7a2f', accent: '#ff6a3d', ambient: 'embers', dark: 0.35,
      bg: '#170504', vein: '#ff9a4a'
    },
    crystal: {
      name: 'Crystal Heart', skyTop: '#1b0c33', skyBottom: '#070312', rock: '#3b2d66', rockHi: '#7b67c4',
      dirt: '#40306a', dirtHi: '#7262b0', dirtLo: '#251a44', brick: '#5a46a0', brickHi: '#a08cf0',
      steel: '#6a6a88', steelHi: '#d6d6f2', glow: '#e3b6ff', accent: '#d58bff', ambient: 'sparkle', dark: 0.45,
      bg: '#0b0618', vein: '#f0d4ff'
    },
    zen: {
      name: 'Still Waters', skyTop: '#0d2a2a', skyBottom: '#04100f', rock: '#285454', rockHi: '#5e9c94',
      dirt: '#2f5c55', dirtHi: '#5f9a8c', dirtLo: '#1b3a35', brick: '#3e6f68', brickHi: '#7fbcae',
      steel: '#5a6d6b', steelHi: '#c4dcd6', glow: '#b8fff0', accent: '#8ff5dc', ambient: 'motes', dark: 0.1,
      bg: '#061412', vein: '#c9fff4'
    },
    retro: {
      name: 'Retro 8-bit', skyTop: '#101010', skyBottom: '#000000', rock: '#704020', rockHi: '#a06030',
      dirt: '#884400', dirtHi: '#bb6622', dirtLo: '#552200', brick: '#aa5533', brickHi: '#dd8866',
      steel: '#777777', steelHi: '#cccccc', glow: '#ffffff', accent: '#ffee55', ambient: 'none', dark: 0,
      bg: '#000000', vein: '#ffee55'
    },
    neon: {
      name: 'Neon Night', skyTop: '#0a0020', skyBottom: '#000008', rock: '#20104a', rockHi: '#ff3ad8',
      dirt: '#1d1440', dirtHi: '#3b2a90', dirtLo: '#0f0a26', brick: '#2a1a66', brickHi: '#00e5ff',
      steel: '#33335a', steelHi: '#9a9aff', glow: '#00ffd5', accent: '#ff3ad8', ambient: 'sparkle', dark: 0.3,
      bg: '#05000f', vein: '#00ffd5'
    }
  };

  /* level kinds: 'cave' regular, 'bonus' intermission, 'boss' finale */
  const CHAPTERS = [
    {
      id: 'amber', theme: 'amber', boss: 'grub', title: 'Chapter I - The Amber Mines',
      blurb: 'Warm sandstone galleries just below Emberfall. The old seams still hold their gems.',
      levels: ['First Light', 'Soft Seam', 'Rolling Stones', 'Firefly Hollow', 'Butterfly Garden', 'Powder Keg', 'Golden Rush', 'Old Chomp\'s Den'],
      kinds: ['cave', 'cave', 'cave', 'cave', 'cave', 'cave', 'bonus', 'boss']
    },
    {
      id: 'frost', theme: 'frost', boss: 'wyrm', title: 'Chapter II - The Frost Caverns',
      blurb: 'An underground glacier where ice blocks slide forever and bats patrol the halls.',
      levels: ['Thin Ice', 'Bat Belfry', 'Glacier Run', 'Rune Wall', 'Frozen Falls', 'Icicle Maze', 'Snowglobe', 'The Rime Wyrm'],
      kinds: ['cave', 'cave', 'cave', 'cave', 'cave', 'cave', 'bonus', 'boss']
    },
    {
      id: 'grotto', theme: 'grotto', boss: 'spore', title: 'Chapter III - The Glowshroom Grotto',
      blurb: 'Pitch dark but for glowing fungus. Spore moss creeps and turns to gems when trapped.',
      levels: ['Lantern Walk', 'Creeping Moss', 'Mushroom Ring', 'Silent Wings', 'Deep Bloom', 'Moss Garden', 'Glowworm Gala', 'The Spore Mother'],
      kinds: ['cave', 'cave', 'cave', 'cave', 'cave', 'cave', 'bonus', 'boss']
    },
    {
      id: 'magma', theme: 'magma', boss: 'titan', title: 'Chapter IV - The Magma Forge',
      blurb: 'The ancient dwarven forge. Lava pools, powder barrels and moles that dig toward you.',
      levels: ['Heat Haze', 'Lava Lanes', 'Barrel Run', 'Mole Tunnels', 'Cinder Steps', 'Chain Reaction', 'Molten Hoard', 'Cinderjaw'],
      kinds: ['cave', 'cave', 'cave', 'cave', 'cave', 'cave', 'bonus', 'boss']
    },
    {
      id: 'crystal', theme: 'crystal', boss: 'king', title: 'Chapter V - The Crystal Heart',
      blurb: 'The singing core of the mountain, where the Hollow King hoards the stolen light.',
      levels: ['Prism Gate', 'Echo Halls', 'Shard Storm', 'Mirror Wall', 'Last Lights', 'Heartbeat', 'Treasury', 'The Hollow King'],
      kinds: ['cave', 'cave', 'cave', 'cave', 'cave', 'cave', 'bonus', 'boss']
    }
  ];

  /* dialogue shown before each chapter (index) and after the finale (5) */
  const DIALOGUE = [
    [
      { who: 'marla', text: 'Pip, can you hear me? The lamps of Emberfall went dark all at once.' },
      { who: 'pip', text: 'I\'m at the Amber Mines, Granny. Your old pickaxe still bites.' },
      { who: 'marla', text: 'Gather the gems, they hold the light. Mind the boulders - they don\'t forgive.' }
    ],
    [
      { who: 'bolt', text: '*bzzt* Lantern sprite online. Following miner. Cold detected.' },
      { who: 'marla', text: 'The Frost Caverns. Ice blocks slide till they hit something - use that.' },
      { who: 'pip', text: 'Old Chomp was only guarding the stairs. Something deeper is eating the light.' }
    ],
    [
      { who: 'king', text: 'Little digger... every gem you take is a crumb from MY table.' },
      { who: 'pip', text: 'Who are you?! Give the mountain back its light!' },
      { who: 'marla', text: 'The grotto is dark, Pip. Stay near the glowing things and trap the moss.' }
    ],
    [
      { who: 'marla', text: 'The Magma Forge. My grandmother worked those anvils.' },
      { who: 'bolt', text: 'Warning: powder barrels. Recommend: distance. Recommend: running.' },
      { who: 'pip', text: 'And moles that dig straight for me. Lovely.' }
    ],
    [
      { who: 'king', text: 'You came all this way to my heart. It is empty, digger. As empty as me.' },
      { who: 'pip', text: 'Then let\'s fill it with light instead of stolen gems.' },
      { who: 'marla', text: 'The Crystal Heart. Bring it home, child.' }
    ],
    [
      { who: 'king', text: 'The light... it is warm. I had forgotten.' },
      { who: 'marla', text: 'Emberfall is shining again, Pip! The whole valley can see it.' },
      { who: 'pip', text: 'The mountain still has deep seams. I think I\'ll keep digging.' }
    ]
  ];

  /* cinematic scripts: shots with a scene painter id, duration and caption */
  const CINEMATICS = {
    intro: [
      { scene: 'village', dur: 4.2, title: 'Emberfall', text: 'A mining village on Mount Ember, lit by the glow of its gems.' },
      { scene: 'quake', dur: 4.0, title: 'One night...', text: 'the mountain shook, and every lamp in the valley went dark.' },
      { scene: 'king', dur: 4.2, title: 'The Hollow King', text: 'Deep below, a crystal golem woke hungry, swallowing the light.' },
      { scene: 'pip', dur: 4.2, title: 'Pip Ferrow', text: 'Granny Marla\'s old pickaxe. A lamp radio. Five depths to go.' },
      { scene: 'lift', dur: 3.6, title: 'Down we go', text: 'Collect gems, open the exits, bring the light home.' }
    ],
    chapter: [
      { scene: 'vista', dur: 4.0, title: '', text: '' },
      { scene: 'descend', dur: 2.6, title: '', text: '' }
    ],
    boss: [
      { scene: 'bossRise', dur: 3.4, title: '', text: '' }
    ],
    finale: [
      { scene: 'heart', dur: 4.5, title: 'The Heartstone', text: 'Filled with the gems Pip brought, the heart of the mountain sings again.' },
      { scene: 'dawn', dur: 4.5, title: 'Light returns', text: 'Emberfall glows brighter than ever. Even the Hollow King is warm.' },
      { scene: 'credits', dur: 5.0, title: 'Boulder Dash', text: 'Thank you for playing. The deep seams await - Arcade, Zen and the Daily cave.' }
    ]
  };

  Object.assign(NS.story, { CAST, THEMES, CHAPTERS, DIALOGUE, CINEMATICS, LEVELS_PER_CHAPTER: 8 });
})();
