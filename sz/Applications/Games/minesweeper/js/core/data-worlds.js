/* The five lands of the story, each with a palette, a backdrop style and six stages - five fields and
   a guardian. Every story board is proven solvable by logic from the first click (board.generate
   with noGuess) and seeded by its stage, so it is the same for everyone. Stage kinds: clear (open
   every safe cell), gems (clear and collect every gem), timed (clear before the clock runs out) and
   fog (smoke drifts over parts of the field and hides numbers for a while). Each stage has a par
   time for the second star and a bonus goal for the third: no shield or power used, no flags at all,
   a number of chords, every gem. Guardians stand over a bigger field with a fuse that must not burn
   down, and every few seconds they strike: the Burrowbeast reburies opened cells, Rimewing freezes
   the flags, the Cinder Golem blows smoke, the Archivist knocks flags loose and the Rustmonger's
   Engine does all of it, faster at half its field. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});

  const st = (name, kind, w, h, mines, par, bonus, extra) => Object.assign({ name: name, kind: kind, w: w, h: h, mines: mines, par: par, bonus: bonus, gems: 0, chests: 1 }, extra || {});
  const WORLDS = [
    { id: 'meadow', name: 'Meadowmere', blurb: 'Clover fields where the old war buried its mines', sky: ['#0e2a14', '#7ad07a'], accent: '#7be08a', glow: '#e0ffc0', style: 'garden', tile: 'meadow',
      boss: { id: 'burrow', name: 'The Burrowbeast', title: 'Mole of a Hundred Tunnels', special: 'bury', every: 9, power: 3, fuse: 240, w: 16, h: 12, mines: 30, color: '#8a6a3a', accent: '#ffd07a' },
      stages: [st('First Furrow', 'clear', 9, 9, 10, 60, { k: 'nohit' }, { chests: 0 }), st('Clover Patch', 'gems', 10, 9, 12, 75, { k: 'gems' }, { gems: 3 }),
        st('Windmill Lane', 'clear', 12, 10, 18, 100, { k: 'chords', n: 3 }), st('Beehive Hollow', 'timed', 11, 10, 15, 70, { k: 'nohit' }, { time: 150 }),
        st('Old Orchard', 'clear', 14, 11, 25, 140, { k: 'noflag' }), st('The Burrowbeast', 'boss', 16, 12, 30, 200, { k: 'nohit' })] },
    { id: 'frost', name: 'Frostfen', blurb: 'Frozen marsh and humming ice', sky: ['#0a1a3a', '#9ad8ff'], accent: '#9ae8ff', glow: '#e8f8ff', style: 'ice', tile: 'crystal',
      boss: { id: 'rime', name: 'Rimewing', title: 'Owl of the Long Winter', special: 'frost', every: 10, power: 6, fuse: 270, w: 18, h: 13, mines: 38, color: '#7ab0e0', accent: '#ffffff' },
      stages: [st('Iced Reeds', 'clear', 12, 10, 18, 100, { k: 'nohit' }), st('Frozen Mill', 'gems', 13, 10, 20, 120, { k: 'gems' }, { gems: 4 }),
        st('Whiteout', 'fog', 13, 11, 22, 140, { k: 'nohit' }), st('Thin Ice', 'timed', 14, 10, 22, 110, { k: 'chords', n: 4 }, { time: 180 }),
        st('Glacier Steps', 'clear', 16, 12, 32, 180, { k: 'noflag' }), st('Rimewing', 'boss', 18, 13, 38, 240, { k: 'nohit' })] },
    { id: 'ember', name: 'Ember Badlands', blurb: 'Cracked red earth and hissing vents', sky: ['#2a0a06', '#ff8a3a'], accent: '#ff9a4a', glow: '#ffe0a0', style: 'gears', tile: 'sandstone',
      boss: { id: 'cinder', name: 'The Cinder Golem', title: 'Furnace That Walks', special: 'smoke', every: 8, power: 5, fuse: 300, w: 20, h: 14, mines: 46, color: '#c05a2a', accent: '#ffd25a' },
      stages: [st('Ash Road', 'clear', 14, 11, 26, 140, { k: 'nohit' }), st('Smoke Vents', 'fog', 15, 11, 28, 160, { k: 'chords', n: 5 }),
        st('Ruby Wash', 'gems', 16, 12, 32, 180, { k: 'gems' }, { gems: 5 }), st('Lava Clock', 'timed', 16, 11, 30, 160, { k: 'nohit' }, { time: 210 }),
        st('Basalt Maze', 'clear', 18, 13, 42, 220, { k: 'noflag' }), st('The Cinder Golem', 'boss', 20, 14, 46, 280, { k: 'nohit' })] },
    { id: 'archive', name: 'Sunken Archive', blurb: 'Drowned libraries full of clockwork traps', sky: ['#04182a', '#3ac0c0'], accent: '#5ae0d0', glow: '#d0fff8', style: 'reef', tile: 'tide',
      boss: { id: 'archivist', name: 'The Archivist', title: 'Keeper of Lost Maps', special: 'quake', every: 9, power: 3, fuse: 330, w: 22, h: 15, mines: 56, color: '#3a8a9a', accent: '#c8fff0' },
      stages: [st('Flooded Stacks', 'clear', 16, 12, 34, 180, { k: 'nohit' }), st('Map Room', 'gems', 18, 12, 38, 200, { k: 'gems' }, { gems: 6 }),
        st('Ink Cloud', 'fog', 18, 13, 42, 220, { k: 'nopower' }), st('Tide Clock', 'timed', 18, 12, 40, 200, { k: 'chords', n: 6 }, { time: 260 }),
        st('Vault of Pages', 'clear', 20, 14, 52, 260, { k: 'noflag' }), st('The Archivist', 'boss', 22, 15, 56, 320, { k: 'nohit' })] },
    { id: 'rust', name: 'Rust Citadel', blurb: 'Where the Rustmonger builds his mines', sky: ['#120a06', '#a05a3a'], accent: '#e09a5a', glow: '#ffe8c0', style: 'engine', tile: 'iron',
      boss: { id: 'engine', name: 'The Rustmonger\'s Engine', title: 'Mine Factory on Legs', special: 'all', every: 8, power: 4, fuse: 380, w: 24, h: 16, mines: 66, color: '#8a5a3a', accent: '#ffd07a' },
      stages: [st('Scrap Yard', 'clear', 18, 13, 42, 220, { k: 'nohit' }), st('Gear Gallery', 'gems', 20, 13, 46, 240, { k: 'gems' }, { gems: 7 }),
        st('Steam Works', 'fog', 20, 14, 50, 260, { k: 'nopower' }), st('Clock Tower', 'timed', 20, 14, 50, 250, { k: 'chords', n: 8 }, { time: 320 }),
        st('Foundry Floor', 'clear', 22, 15, 60, 300, { k: 'noflag' }), st('The Rustmonger\'s Engine', 'boss', 24, 16, 66, 360, { k: 'nohit' })] },
  ];

  const STAGES = [];
  for (let w = 0; w < WORLDS.length; ++w)
    for (let s = 0; s < 6; ++s) {
      const x = WORLDS[w].stages[s];
      x.id = WORLDS[w].id + '-' + (s + 1);
      x.world = w;
      x.index = s;
      STAGES.push(x);
    }
  const BY_ID = {};
  for (const x of STAGES) BY_ID[x.id] = x;

  NS.worldData = { WORLDS, STAGES, BY_ID, BOSSES: WORLDS.map(w => w.boss) };
})();
