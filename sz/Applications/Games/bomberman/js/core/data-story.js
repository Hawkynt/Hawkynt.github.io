/* The story: the cast, the five worlds of the campaign with their palettes, twists, enemy
   mixes and bosses, the hand-designed maps (each world's opening stage and every boss arena)
   and the cinematic scripts (intro, chapter openers, boss entrances, finale). Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  const CAST = {
    pip: { name: 'Pip', color: '#ffffff' },
    nova: { name: 'Nova', color: '#ff8ac8' },
    fuse: { name: 'Professor Fuse', color: '#ffd27a' },
    baron: { name: 'Baron Blackfuse', color: '#c58bff' },
    mole: { name: 'King Gnarl', color: '#d9a066' },
    yeti: { name: 'Rimefang', color: '#bfe8ff' },
    crab: { name: 'Clinker', color: '#ff8a4c' },
    mecha: { name: 'MB-9', color: '#7ef9ff' },
    narrator: { name: '', color: '#fff6e8' }
  };

  /* Legend: # hard  + soft  x crate  . floor  ~ ice  ^ v < > belts  T teleporter
             P spawn  E exit under a soft block  * power-up under a soft block  e enemy  B boss */
  const MAPS = {
    meadow1: [
      '###################',
      '#P.+..+.+++.+..+.e#',
      '#.#+#.#+#+#.#+#.#.#',
      '#..++..+..+.+++.+.#',
      '#+#.#+#.#*#.#.#+#+#',
      '#.+..+.+..+..+..+.#',
      '#+#+#.#+#E#+#.#+#.#',
      '#..+.+..+.+.+..+..#',
      '#.#+#+#.#+#.#+#*#+#',
      '#+..+..+..e.+..+..#',
      '#.#.#+#+#.#+#.#+#.#',
      '#e.+..+..+..+.+..e#',
      '###################'
    ],
    frost1: [
      '###################',
      '#P..+~~~+.+~~~+..e#',
      '#.#.#~#+#.#+#~#.#.#',
      '#.+.+~~.+.+.~~+.+.#',
      '#+#+#.#.#*#.#.#+#+#',
      '#~~~+.+..+..+.+~~~#',
      '#~#~#+#.#E#.#+#~#~#',
      '#~~~+.+..+..+.+~~~#',
      '#+#+#.#.#+#.#.#+#+#',
      '#.+.+~~.+.+.~~+*+.#',
      '#.#.#~#+#.#+#~#.#.#',
      '#e..+~~~+e+~~~+..e#',
      '###################'
    ],
    foundry1: [
      '###################',
      '#P..+.+.+.+.+.+..e#',
      '#.#.#+#v#+#v#+#.#.#',
      '#.+>>>>v.+.v<<<<+.#',
      '#+#+#+#v#*#v#+#+#+#',
      '#..+..+v.+.v+..+..#',
      '#+#.#+#v#E#v#+#.#+#',
      '#..+..+v.+.v+..+..#',
      '#+#+#+#v#+#v#+#+#+#',
      '#.+<<<<<.+.>>>>>*.#',
      '#.#.#+#.#+#.#+#.#.#',
      '#e..+.+.+e+.+.+..e#',
      '###################'
    ],
    neon1: [
      '###################',
      '#P..+.+.+T+.+.+..e#',
      '#.#.#+#.#+#.#+#.#.#',
      '#.+.+.+.+.+.+.+.+.#',
      '#+#+#.#+#*#+#.#+#+#',
      '#T.+..+.....+..+.T#',
      '#+#.#+#+#E#+#+#.#+#',
      '#..+..+..x..+..+..#',
      '#+#+#.#+#+#+#.#+#+#',
      '#.+.+.+.+.+.+.+*+.#',
      '#.#.#+#.#+#.#+#.#.#',
      '#e..+.+.+T+.+.+..e#',
      '###################'
    ],
    keep1: [
      '###################',
      '#P.+x+.+.+.+.+x+.e#',
      '#.#+#+#.#+#.#+#+#.#',
      '#.x.+.+x+.+x+.+.x.#',
      '#+#+#.#+#*#+#.#+#+#',
      '#.+.x.+..+..+.x.+.#',
      '#+#.#+#+#E#+#+#.#+#',
      '#.+.x.+..+..+.x.+.#',
      '#+#+#.#+#+#+#.#+#+#',
      '#.x.+.+x+.+x+.+*x.#',
      '#.#+#+#.#+#.#+#+#.#',
      '#e.+x+.+.e.+.+x+.e#',
      '###################'
    ],
    bossMole: [
      '###################',
      '#.................#',
      '#.#.....+.+.....#.#',
      '#...+.........+...#',
      '#.....#.....#.....#',
      '#.+.......B.....+.#',
      '#.................#',
      '#.+.....+...+...+.#',
      '#.....#.....#.....#',
      '#...+.........+...#',
      '#.#.....+.+.....#.#',
      '#........P........#',
      '###################'
    ],
    bossYeti: [
      '###################',
      '#~~~~...........~~#',
      '#~#~~...+.+...~~#~#',
      '#~~...........~~..#',
      '#.....#..~..#.....#',
      '#.+......~B~.....+#',
      '#........~~~......#',
      '#.+....+.....+...+#',
      '#.....#.....#.....#',
      '#~~.+.........+.~~#',
      '#~#~~...+.+...~~#~#',
      '#~~~~....P....~~~~#',
      '###################'
    ],
    bossCrab: [
      '###################',
      '#.................#',
      '#.#>>>>>.+.<<<<<#.#',
      '#.................#',
      '#..+..#.....#..+..#',
      '#.........B.......#',
      '#.................#',
      '#..+....+...+..+..#',
      '#.....#.....#.....#',
      '#.................#',
      '#.#<<<<<.+.>>>>>#.#',
      '#........P........#',
      '###################'
    ],
    bossMecha: [
      '###################',
      '#T...............T#',
      '#.#.....+.+.....#.#',
      '#...+.........+...#',
      '#.....#.....#.....#',
      '#.+.......B.....+.#',
      '#.................#',
      '#.+.....+...+...+.#',
      '#.....#.....#.....#',
      '#...+.........+...#',
      '#.#.....+.+.....#.#',
      '#T.......P.......T#',
      '###################'
    ],
    bossBaron: [
      '###################',
      '#.................#',
      '#.#..x..+.+..x..#.#',
      '#...+.........+...#',
      '#.x...#.....#...x.#',
      '#.+.......B.....+.#',
      '#.................#',
      '#.+..x..+...+..x+.#',
      '#.....#.....#.....#',
      '#...+.........+...#',
      '#.#..x..+.+..x..#.#',
      '#........P........#',
      '###################'
    ]
  };

  /* The campaign. Enemy mixes widen level by level; the twist tile shows from stage two on. */
  const WORLDS = [
    {
      id: 'meadow', name: 'Meadow Gardens', short: 'Meadow', ember: 'Verdant Ember', boss: 'mole', bossMap: 'bossMole', firstMap: 'meadow1',
      twist: 'crate', dark: false, tagline: 'Hedges, bricks and burrowing trouble',
      mix: [['puff'], ['puff', 'zapper'], ['puff', 'zapper', 'hopper'], ['zapper', 'hopper', 'blob'], ['hopper', 'blob', 'charger'], ['puff', 'blob', 'charger', 'zapper']],
      palette: { floorA: '#6cbf4a', floorB: '#62b343', grout: '#4f9a36', hardTop: '#9aa7b4', hardSide: '#5d6876', hardEdge: '#c8d2dc', softA: '#c8743c', softB: '#a65a2c', softMortar: '#7a3f1e', accent: '#ffe066', sky1: '#7fd3ff', sky2: '#c9f0ff', ground: '#3f8f2e' }
    },
    {
      id: 'frost', name: 'Frostbite Caverns', short: 'Frost', ember: 'Glacial Ember', boss: 'yeti', bossMap: 'bossYeti', firstMap: 'frost1',
      twist: 'ice', dark: false, tagline: 'Slippery ice: you slide until something stops you',
      mix: [['puff', 'hopper'], ['zapper', 'hopper'], ['hopper', 'wisp'], ['zapper', 'wisp', 'brute'], ['hopper', 'brute', 'charger'], ['wisp', 'brute', 'charger', 'hunter']],
      palette: { floorA: '#cfe6f5', floorB: '#bcd9ee', grout: '#9fc4df', hardTop: '#7aa6c8', hardSide: '#4a6f90', hardEdge: '#d8f1ff', softA: '#9fd8f2', softB: '#7cc0e3', softMortar: '#4f8fb5', accent: '#e8fbff', sky1: '#1c3550', sky2: '#4b7aa6', ground: '#e6f4ff' }
    },
    {
      id: 'foundry', name: 'Ember Foundry', short: 'Foundry', ember: 'Molten Ember', boss: 'crab', bossMap: 'bossCrab', firstMap: 'foundry1',
      twist: 'belt', dark: false, tagline: 'Conveyor belts carry you and your bombs',
      mix: [['zapper', 'imp'], ['zapper', 'imp', 'hopper'], ['imp', 'brute', 'charger'], ['imp', 'hunter', 'blob'], ['brute', 'imp', 'hunter', 'charger'], ['imp', 'hunter', 'brute', 'blob', 'charger']],
      palette: { floorA: '#5a4a44', floorB: '#524340', grout: '#3a2e2b', hardTop: '#6b6f78', hardSide: '#3d3f46', hardEdge: '#a3a8b2', softA: '#8a4b2c', softB: '#6e3a22', softMortar: '#ff7a2a', accent: '#ff9a3c', sky1: '#1a0c0a', sky2: '#4a1a0e', ground: '#2a1a16' }
    },
    {
      id: 'neon', name: 'Neon Circuit', short: 'Neon', ember: 'Volt Ember', boss: 'mecha', bossMap: 'bossMecha', firstMap: 'neon1',
      twist: 'tele', dark: false, tagline: 'Teleport pads link distant corners',
      mix: [['zapper', 'hunter'], ['zapper', 'hunter', 'wisp'], ['hunter', 'charger', 'imp'], ['hunter', 'wisp', 'brute', 'zapper'], ['charger', 'hunter', 'imp', 'blob'], ['hunter', 'wisp', 'imp', 'brute', 'charger']],
      palette: { floorA: '#1b1f3a', floorB: '#181b33', grout: '#2c3a7a', hardTop: '#3a4170', hardSide: '#20244a', hardEdge: '#7ef9ff', softA: '#7a3cff', softB: '#5a24cc', softMortar: '#ff4fd8', accent: '#7ef9ff', sky1: '#080818', sky2: '#2a0e4a', ground: '#12122a' }
    },
    {
      id: 'keep', name: 'Shadow Keep', short: 'Keep', ember: 'Umbral Ember', boss: 'baron', bossMap: 'bossBaron', firstMap: 'keep1',
      twist: 'crate', dark: true, tagline: 'Darkness: only your glow and the fire light the halls',
      mix: [['wisp', 'zapper', 'blob'], ['wisp', 'hunter', 'imp'], ['wisp', 'brute', 'charger', 'imp'], ['hunter', 'wisp', 'brute', 'blob', 'imp'], ['hunter', 'wisp', 'charger', 'imp', 'brute'], ['hunter', 'wisp', 'charger', 'imp', 'brute', 'blob']],
      palette: { floorA: '#3b3346', floorB: '#352e40', grout: '#262030', hardTop: '#5a5068', hardSide: '#2e2838', hardEdge: '#8c7fa3', softA: '#6b5a4a', softB: '#56473a', softMortar: '#2a2220', accent: '#c58bff', sky1: '#0c0814', sky2: '#2a1838', ground: '#1a1422' }
    }
  ];

  const LEVELS_PER_WORLD = 7; /* six stages and the boss */

  /* Cinematic scripts. Shot fields: scene (backdrop), actors [{id, x, face, anim, to}], speaker,
     text, fx ('flash', 'shake', 'boom', 'sparkle', 'dark'). Positions are view-plane pixels. */
  const CINEMATICS = {
    intro: [
      { scene: 'village', actors: [{ id: 'pip', x: 520, anim: 'idle' }, { id: 'nova', x: 640, anim: 'idle', face: -1 }], speaker: 'narrator', text: 'Every autumn night, Fuse Village lights the sky with the Spark Core - the heart of every firework, every lantern, every bomb.', fx: 'sparkle' },
      { scene: 'village', actors: [{ id: 'pip', x: 420, anim: 'scared' }, { id: 'nova', x: 520, anim: 'scared' }, { id: 'baron', x: 1020, to: 820, anim: 'walk', face: -1 }], speaker: 'baron', text: 'Such a waste of good fire. From tonight the Spark Core burns for me alone!', fx: 'flash' },
      { scene: 'village', actors: [{ id: 'baron', x: 820, anim: 'cast', face: -1 }, { id: 'pip', x: 420, anim: 'scared' }], speaker: 'baron', text: 'Five Embers for five guardians. Come and take them, little bomber - if you dare.', fx: 'boom' },
      { scene: 'lab', actors: [{ id: 'fuse', x: 760, anim: 'talk', face: -1 }, { id: 'pip', x: 480, anim: 'idle' }], speaker: 'fuse', text: 'He split the Core into five Embers and hid them in the five realms. Without them the village goes dark by winter.', fx: '' },
      { scene: 'lab', actors: [{ id: 'nova', x: 760, anim: 'talk', face: -1 }, { id: 'pip', x: 480, anim: 'idle' }], speaker: 'nova', text: 'I tuned your bomb bag. Bring back the Embers and spend what you find on upgrades - I will build anything!', fx: '' },
      { scene: 'village', actors: [{ id: 'pip', x: 560, anim: 'jump' }], speaker: 'pip', text: 'Leave it to me. Next stop: Meadow Gardens!', fx: 'sparkle' }
    ],
    chapter0: [
      { scene: 'meadow', actors: [{ id: 'pip', x: 300, to: 520, anim: 'walk' }], speaker: 'narrator', text: 'Chapter 1 - Meadow Gardens. The hedges hum with moles and puffballs.', fx: '' },
      { scene: 'meadow', actors: [{ id: 'pip', x: 520, anim: 'idle' }, { id: 'fuse', x: 1080, anim: 'radio', face: -1, s: 0.6 }], speaker: 'fuse', text: 'Bricks break, grey stone does not. Clear every enemy and the exit under one of the bricks opens.', fx: '' }
    ],
    chapter1: [
      { scene: 'frost', actors: [{ id: 'pip', x: 300, to: 520, anim: 'walk' }], speaker: 'narrator', text: 'Chapter 2 - Frostbite Caverns. The Verdant Ember glows in Pip\'s pack as the air turns to ice.', fx: '' },
      { scene: 'frost', actors: [{ id: 'pip', x: 520, anim: 'scared' }, { id: 'nova', x: 760, anim: 'talk', face: -1 }], speaker: 'nova', text: 'Careful on the ice - once you start sliding you only stop at a wall, a bomb or a friend.', fx: '' }
    ],
    chapter2: [
      { scene: 'foundry', actors: [{ id: 'pip', x: 300, to: 520, anim: 'walk' }], speaker: 'narrator', text: 'Chapter 3 - Ember Foundry. Machines roar where the Baron forges his army.', fx: 'shake' },
      { scene: 'foundry', actors: [{ id: 'pip', x: 520, anim: 'idle' }, { id: 'fuse', x: 1080, anim: 'radio', face: -1, s: 0.6 }], speaker: 'fuse', text: 'The conveyor belts carry everything - you, your bombs, even the imps\' bombs. Use them!', fx: '' }
    ],
    chapter3: [
      { scene: 'neon', actors: [{ id: 'pip', x: 300, to: 520, anim: 'walk' }], speaker: 'narrator', text: 'Chapter 4 - Neon Circuit. A city of light that never sleeps, wired to the Volt Ember.', fx: 'sparkle' },
      { scene: 'neon', actors: [{ id: 'pip', x: 520, anim: 'idle' }, { id: 'nova', x: 760, anim: 'talk', face: -1 }], speaker: 'nova', text: 'Teleport pads come in pairs. Step on one and you pop out of its twin!', fx: '' }
    ],
    chapter4: [
      { scene: 'keep', actors: [{ id: 'pip', x: 300, to: 520, anim: 'walk' }], speaker: 'narrator', text: 'Chapter 5 - Shadow Keep. Four Embers burn in Pip\'s pack. The last one waits in the dark.', fx: 'dark' },
      { scene: 'keep', actors: [{ id: 'pip', x: 520, anim: 'idle' }, { id: 'baron', x: 1060, anim: 'cast', face: -1, s: 0.7 }], speaker: 'baron', text: 'You light my halls with stolen fire. How fitting that it will be your last.', fx: 'flash' }
    ],
    boss0: [
      { scene: 'meadow', actors: [{ id: 'pip', x: 420, anim: 'idle' }, { id: 'mole', x: 860, anim: 'rise', face: -1 }], speaker: 'mole', text: 'Who stomps on my royal tunnels? The Verdant Ember is MY crown jewel now!', fx: 'shake' },
      { scene: 'meadow', actors: [{ id: 'pip', x: 420, anim: 'jump' }, { id: 'mole', x: 860, anim: 'idle', face: -1 }], speaker: 'pip', text: 'Hit him when he surfaces - he is safe while he burrows!', fx: '' }
    ],
    boss1: [
      { scene: 'frost', actors: [{ id: 'pip', x: 420, anim: 'scared' }, { id: 'yeti', x: 880, anim: 'rise', face: -1 }], speaker: 'yeti', text: 'RRRAAAH! Rimefang guards the Glacial Ember. Freeze, little spark!', fx: 'shake' },
      { scene: 'frost', actors: [{ id: 'pip', x: 420, anim: 'idle' }, { id: 'nova', x: 180, anim: 'radio', s: 0.6 }], speaker: 'nova', text: 'Watch the floor - his stomps send ice shards along the lines he glows on!', fx: '' }
    ],
    boss2: [
      { scene: 'foundry', actors: [{ id: 'pip', x: 420, anim: 'idle' }, { id: 'crab', x: 880, anim: 'rise', face: -1 }], speaker: 'crab', text: 'Clack clack! Clinker melts intruders into scrap. The Molten Ember stays in my shell!', fx: 'boom' },
      { scene: 'foundry', actors: [{ id: 'pip', x: 420, anim: 'jump' }], speaker: 'pip', text: 'Glowing columns mean fire is coming. Dodge, then bomb!', fx: '' }
    ],
    boss3: [
      { scene: 'neon', actors: [{ id: 'pip', x: 420, anim: 'idle' }, { id: 'mecha', x: 880, anim: 'rise', face: -1 }], speaker: 'mecha', text: 'TARGET ACQUIRED. MB-9 WILL NOW DEMONSTRATE SUPERIOR BOMBING.', fx: 'flash' },
      { scene: 'neon', actors: [{ id: 'pip', x: 420, anim: 'idle' }, { id: 'fuse', x: 180, anim: 'radio', s: 0.6 }], speaker: 'fuse', text: 'It copies your tricks. Keep moving and strike when it reloads!', fx: '' }
    ],
    boss4: [
      { scene: 'keep', actors: [{ id: 'pip', x: 420, anim: 'idle' }, { id: 'baron', x: 880, anim: 'cast', face: -1 }], speaker: 'baron', text: 'Four Embers, carried right to my door. Thank you, Pip. Now hand them over.', fx: 'dark' },
      { scene: 'keep', actors: [{ id: 'pip', x: 420, anim: 'jump' }, { id: 'baron', x: 880, anim: 'cast', face: -1 }], speaker: 'pip', text: 'The Spark Core belongs to everyone. Let\'s finish this!', fx: 'boom' }
    ],
    finale: [
      { scene: 'keep', actors: [{ id: 'baron', x: 760, anim: 'scared', face: -1 }, { id: 'pip', x: 420, anim: 'idle' }], speaker: 'baron', text: 'Impossible... beaten by a village bomber with a bag of firecrackers...', fx: 'shake' },
      { scene: 'village', actors: [{ id: 'pip', x: 480, anim: 'jump' }, { id: 'nova', x: 600, anim: 'jump', face: -1 }, { id: 'fuse', x: 760, anim: 'talk', face: -1 }], speaker: 'fuse', text: 'All five Embers! The Spark Core burns again - brighter than ever.', fx: 'sparkle' },
      { scene: 'village', actors: [{ id: 'pip', x: 480, anim: 'idle' }, { id: 'nova', x: 600, anim: 'talk', face: -1 }], speaker: 'nova', text: 'And look who is sweeping the square - the Baron, on festival duty for a year!', fx: '' },
      { scene: 'village', actors: [{ id: 'pip', x: 560, anim: 'jump' }], speaker: 'narrator', text: 'Fuse Village celebrates. But the realms still hum with mischief - Arcade, Zen and the Daily Challenge await.', fx: 'boom' }
    ]
  };

  Object.assign(NS.story, {
    CAST, MAPS, WORLDS, LEVELS_PER_WORLD, CINEMATICS
  });
})();
