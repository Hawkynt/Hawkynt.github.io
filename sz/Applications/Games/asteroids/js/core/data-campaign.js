/* Static story data: the cast, the five chapters of the Starfall campaign with their themes,
   map positions, briefing and debriefing dialogue, and six hand-designed levels each (objective,
   opening rocks, reinforcement waves, raiders, hazards, par time, boss). Also the game modes.
   Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  const CAST = {
    nova: { name: 'Nova Reyes', role: 'Pilot of the Kestrel', col: '#5ad8ff', visor: '#ffb04a', hair: '#2a1a12' },
    kite: { name: 'KITE', role: 'Kestrel ship mind', col: '#6dff9a', visor: '#6dff9a', hair: null },
    varga: { name: 'Cmdr. Ilsa Varga', role: 'Haven Station', col: '#ffd25a', visor: '#c0d8ff', hair: '#d8d8e0' },
    shard: { name: 'The Shardmind', role: '???', col: '#ff4a6a', visor: '#ff4a6a', hair: null },
  };

  const MODES = {
    story: { name: 'Story', desc: 'The Starfall campaign: five belts, thirty missions, five titans.', icon: 'book', col: '#5ad8ff' },
    arcade: { name: 'Arcade', desc: 'Endless waves, three ships, chase the high score.', icon: 'star', col: '#ffd25a' },
    zen: { name: 'Zen', desc: 'No death, no clock. Drift, shatter, breathe.', icon: 'lotus', col: '#6dff9a' },
    daily: { name: 'Daily', desc: 'One ship, today\'s seeded field and modifiers.', icon: 'calendar', col: '#ff9a3a' },
    rush: { name: 'Boss Rush', desc: 'All five titans back to back.', icon: 'skull', col: '#ff5a6a' },
  };

  /* level shorthand: rocks [type, size, count]; waves: groups that arrive as the field empties;
     foes: raider kinds, first spawn time, interval and cap; obj clear/survive/collect/rescue/boss */
  function L(name, obj, rocks, extra) {
    return Object.assign({ name: name, obj: obj, rocks: rocks, waves: [], foes: null, hazard: null, time: 0, target: 0, par: 90 }, extra || {});
  }

  const CHAPTERS = [
    {
      id: 'kuiper', name: 'Kuiper Drift', sub: 'Chapter I', boss: 'glacier', map: { x: 210, y: 470 },
      theme: { bg0: '#020814', bg1: '#06203a', neb: ['#1a5a8a', '#3aa0d0', '#0a2a50'], accent: '#7ad8ff', star: '#dff4ff',
        planet: { col: '#8ac8e8', dark: '#1a3a5a', ring: true, x: 1040, y: 150, r: 110 }, dust: '#bfe8ff' },
      intro: [
        ['varga', 'Haven to Kestrel. The belt is moving, Nova. Rocks that drifted for a billion years are falling toward us all at once.'],
        ['nova', 'Something is herding them. I can see the patterns from here.'],
        ['kite', 'Ice composition, high velocity. Recommend shooting them. Repeatedly.'],
        ['varga', 'Clear the lanes to the outer relays. Haven is counting on you.'],
      ],
      outro: [
        ['kite', 'The titan was hollow. There was a signal inside it... repeating.'],
        ['shard', 'YOU BREAK WHAT WE GATHER. WE WILL GATHER MORE.'],
        ['nova', 'Whoever you are - stop throwing rocks at my home.'],
        ['varga', 'The signal points sunward. The Ember Belt. Go.'],
      ],
      levels: [
        L('First Light', 'clear', [['normal', 3, 3]], { par: 45, tip: 'Rotate with A/D or the arrows, thrust with W, fire with Space.' }),
        L('Thin Ice', 'clear', [['normal', 3, 3], ['ice', 3, 1]], { waves: [[['normal', 2, 4]]], foes: { kinds: ['saucer'], first: 25, every: 30, max: 1 }, par: 55, tip: 'Ice rocks leave frost that slows everything inside.' }),
        L('Relay Run', 'rescue', [['normal', 3, 3], ['iron', 3, 1]], { target: 4, foes: { kinds: ['saucer'], first: 20, every: 28, max: 1 }, par: 40, tip: 'Fly into the drifting escape pods to rescue them.' }),
        L('Hailstorm', 'survive', [['normal', 2, 4], ['ice', 2, 2]], { time: 60, waves: [[['normal', 2, 3]], [['ice', 3, 2]], [['normal', 3, 2]]], foes: { kinds: ['hunter'], first: 15, every: 20, max: 3 }, par: 60, tip: 'Stay alive until the clock runs out.' }),
        L('Frostbite Field', 'clear', [['ice', 3, 3], ['iron', 3, 2], ['gold', 2, 1]], { waves: [[['ice', 3, 2], ['normal', 3, 2]]], foes: { kinds: ['saucer', 'hunter'], first: 18, every: 22, max: 2 }, hazard: 'ice', par: 70 }),
        L('The Glacier Titan', 'boss', [['ice', 2, 2]], { boss: 'glacier', par: 150 }),
      ],
    },
    {
      id: 'ember', name: 'Ember Belt', sub: 'Chapter II', boss: 'wyrm', map: { x: 420, y: 300 },
      theme: { bg0: '#100402', bg1: '#3a0e04', neb: ['#a0300a', '#ff7a20', '#4a0a04'], accent: '#ffa040', star: '#ffe8c8',
        planet: { col: '#ff8040', dark: '#4a1004', ring: false, x: 230, y: 160, r: 140, lava: true }, dust: '#ffd090' },
      intro: [
        ['kite', 'Ambient temperature rising. These rocks are molten at the core.'],
        ['nova', 'And they explode. Wonderful.'],
        ['varga', 'Mining crews are trapped out there. Bring as many home as you can.'],
        ['shard', 'THE FIRE REMEMBERS. THE FIRE COILS.'],
      ],
      outro: [
        ['nova', 'That thing was alive. Or close enough.'],
        ['kite', 'Its segments were stitched by the same signal. It is getting stronger the closer we fly.'],
        ['varga', 'Crystal Reach is next on the vector. Our scouts never came back from there.'],
      ],
      levels: [
        L('Cinder Lanes', 'clear', [['normal', 3, 2], ['lava', 3, 2], ['gold', 2, 1]], { foes: { kinds: ['hunter'], first: 14, every: 18, max: 3 }, par: 40, tip: 'Magma rocks drip burning patches - do not fly through them.' }),
        L('Volatile Garden', 'clear', [['explosive', 3, 3], ['normal', 3, 2]], { waves: [[['explosive', 2, 4]]], foes: { kinds: ['saucer'], first: 20, every: 25, max: 1 }, par: 35, tip: 'Volatile rocks chain-react. Use them.' }),
        L('Trapped Miners', 'rescue', [['lava', 3, 2], ['iron', 3, 2], ['explosive', 2, 2]], { target: 6, foes: { kinds: ['hunter', 'gunship'], first: 16, every: 20, max: 2 }, par: 75 }),
        L('Gunship Alley', 'clear', [['iron', 3, 3], ['lava', 2, 3]], { waves: [[['explosive', 3, 2], ['normal', 2, 3]]], foes: { kinds: ['gunship', 'hunter'], first: 8, every: 16, max: 3 }, par: 60 }),
        L('Ember Harvest', 'collect', [['gold', 3, 2], ['lava', 3, 2], ['explosive', 3, 1]], { target: 12, waves: [[['gold', 2, 3], ['lava', 3, 1]], [['gold', 3, 2]]], foes: { kinds: ['saucer', 'hunter'], first: 12, every: 18, max: 2 }, hazard: 'comets', par: 90, tip: 'Gold rocks drop star shards. Gather the target.' }),
        L('Coil of the Ember Belt', 'boss', [], { boss: 'wyrm', par: 150 }),
      ],
    },
    {
      id: 'crystal', name: 'Crystal Reach', sub: 'Chapter III', boss: 'prism', map: { x: 660, y: 430 },
      theme: { bg0: '#06020e', bg1: '#1e0a3a', neb: ['#5a20b0', '#c070ff', '#200a50'], accent: '#c08aff', star: '#f0e0ff',
        planet: { col: '#b080ff', dark: '#24104a', ring: true, x: 1080, y: 560, r: 90, crystal: true }, dust: '#e0c8ff' },
      intro: [
        ['nova', 'It is beautiful. Every rock is a lens.'],
        ['kite', 'And every lens focuses the signal. Crystal fractures into three - mind the shards.'],
        ['shard', 'SEE HOW WE SHINE. SEE HOW WE MULTIPLY.'],
        ['varga', 'Our scouts left beacons. Recover what you can.'],
      ],
      outro: [
        ['kite', 'Prism data decoded. The Shardmind is not a ship. It is a pattern, living in the stone itself.'],
        ['nova', 'Then where is its body?'],
        ['varga', 'Past the Storm Nebula. Where the belt just... ends.'],
      ],
      levels: [
        L('Refraction', 'clear', [['crystal', 3, 3], ['normal', 3, 1]], { foes: { kinds: ['sniper'], first: 22, every: 26, max: 1 }, par: 80, tip: 'Crystal splits into three. Small shards are fast.' }),
        L('Lost Scouts', 'rescue', [['crystal', 3, 2], ['iron', 3, 2], ['gold', 2, 1]], { target: 5, foes: { kinds: ['layer'], first: 12, every: 24, max: 1 }, par: 45, tip: 'Mine-layers sow proximity mines. Shoot the mines from range.' }),
        L('Glass Orchard', 'collect', [['crystal', 3, 2], ['gold', 3, 2]], { target: 14, waves: [[['crystal', 2, 4], ['gold', 2, 2]], [['gold', 3, 2]]], foes: { kinds: ['sniper', 'hunter'], first: 15, every: 18, max: 2 }, par: 95 }),
        L('Mirror Maze', 'survive', [['crystal', 3, 3], ['crystal', 2, 2]], { time: 75, waves: [[['crystal', 3, 2]], [['explosive', 3, 2]], [['crystal', 3, 3]]], foes: { kinds: ['layer', 'sniper'], first: 10, every: 18, max: 2 }, par: 75 }),
        L('Shatterpoint', 'clear', [['crystal', 3, 3], ['explosive', 3, 2], ['iron', 3, 1]], { waves: [[['crystal', 3, 2], ['gold', 2, 1]]], foes: { kinds: ['sniper', 'layer', 'gunship'], first: 10, every: 15, max: 3 }, par: 120 }),
        L('Lens of the Reach', 'boss', [['crystal', 2, 2]], { boss: 'prism', par: 165 }),
      ],
    },
    {
      id: 'storm', name: 'Storm Nebula', sub: 'Chapter IV', boss: 'tempest', map: { x: 900, y: 260 },
      theme: { bg0: '#020a08', bg1: '#0a2a24', neb: ['#1a7060', '#a0e060', '#06302a'], accent: '#a0f080', star: '#e8ffe0',
        planet: { col: '#60c0a0', dark: '#0a3a30', ring: false, x: 200, y: 560, r: 120, storm: true }, dust: '#d0ffb0' },
      intro: [
        ['kite', 'Charge density off the scale. Lightning will strike where the field glows - stay clear.'],
        ['nova', 'Phantoms on the scope. They flicker in and out.'],
        ['shard', 'YOU ARE SO SMALL. THE STORM IS SO WIDE.'],
        ['varga', 'Hold on, Nova. We are relaying everything you send.'],
      ],
      outro: [
        ['nova', 'The storm is clearing. And behind it...'],
        ['kite', 'A mouth. Eight hundred kilometres wide. It is swallowing the belt and spitting it at Haven.'],
        ['varga', 'Then that is the target. Everything we have is behind you.'],
      ],
      levels: [
        L('Static Bloom', 'clear', [['electric', 3, 3], ['normal', 3, 2]], { foes: { kinds: ['phantom'], first: 20, every: 24, max: 1 }, hazard: 'storm', par: 30, tip: 'Storm rocks arc lightning into their neighbours when they die.' }),
        L('Thunderhead', 'survive', [['electric', 3, 2], ['ice', 3, 2]], { time: 80, waves: [[['electric', 3, 2]], [['ice', 3, 2], ['explosive', 2, 2]], [['electric', 3, 3]]], foes: { kinds: ['phantom', 'hunter'], first: 12, every: 15, max: 3 }, hazard: 'storm', par: 80 }),
        L('Eye of Calm', 'collect', [['gold', 3, 3], ['electric', 3, 2]], { target: 16, waves: [[['gold', 3, 2], ['electric', 2, 3]], [['gold', 2, 4]]], foes: { kinds: ['gunship', 'phantom'], first: 14, every: 18, max: 2 }, hazard: 'storm', par: 60 }),
        L('Ion Rescue', 'rescue', [['electric', 3, 2], ['iron', 3, 2], ['explosive', 3, 1]], { target: 7, foes: { kinds: ['phantom', 'sniper'], first: 10, every: 16, max: 2 }, hazard: 'storm', par: 75 }),
        L('Supercell', 'clear', [['electric', 3, 4], ['explosive', 3, 2], ['crystal', 3, 1]], { waves: [[['electric', 3, 3], ['ice', 3, 1]]], foes: { kinds: ['phantom', 'gunship', 'layer'], first: 8, every: 13, max: 3 }, hazard: 'storm', par: 80 }),
        L('Heart of the Storm', 'boss', [], { boss: 'tempest', hazard: 'storm', par: 210 }),
      ],
    },
    {
      id: 'maw', name: 'The Maw', sub: 'Chapter V', boss: 'maw', map: { x: 1110, y: 440 },
      theme: { bg0: '#0a0204', bg1: '#2a0610', neb: ['#801030', '#ff4a6a', '#2a0410'], accent: '#ff5a7a', star: '#ffe0e8',
        planet: { col: '#300810', dark: '#000000', ring: false, x: 1090, y: 590, r: 100, hole: true }, dust: '#ffc0d0' },
      intro: [
        ['shard', 'COME CLOSER, LITTLE SPARK. BE GATHERED.'],
        ['kite', 'Gravity wells everywhere. The void rocks pull our shots off course.'],
        ['nova', 'KITE, if this goes badly -'],
        ['kite', 'It will not. I have run the numbers. Mostly.'],
      ],
      outro: [
        ['shard', 'WE... WERE ONLY... HUNGRY...'],
        ['nova', 'The rocks are slowing. They are just rocks again.'],
        ['varga', 'Haven to Kestrel. The sky is clear. Come home, Nova.'],
        ['kite', 'Course plotted. Taking the scenic route.'],
      ],
      levels: [
        L('Event Horizon', 'clear', [['void', 3, 2], ['normal', 3, 3]], { foes: { kinds: ['splitter'], first: 20, every: 26, max: 1 }, hazard: 'holes', par: 45, tip: 'Black holes pull everything in. Thrust away from the glow.' }),
        L('Gravity Garden', 'collect', [['void', 3, 2], ['gold', 3, 3]], { target: 18, waves: [[['gold', 3, 2], ['void', 2, 2]], [['gold', 3, 3]]], foes: { kinds: ['splitter', 'hunter'], first: 12, every: 16, max: 3 }, hazard: 'holes', par: 95 }),
        L('Last Colony', 'rescue', [['void', 3, 2], ['lava', 3, 2], ['electric', 3, 1]], { target: 8, foes: { kinds: ['phantom', 'gunship'], first: 10, every: 15, max: 3 }, hazard: 'holes', par: 150 }),
        L('All Belts Fall', 'survive', [['void', 3, 2], ['crystal', 3, 2], ['explosive', 3, 2]], { time: 90, waves: [[['ice', 3, 2], ['lava', 3, 2]], [['electric', 3, 3]], [['void', 3, 2], ['crystal', 3, 2]]], foes: { kinds: ['splitter', 'phantom', 'sniper'], first: 8, every: 12, max: 3 }, hazard: 'holes', par: 90 }),
        L('Throat of Stone', 'clear', [['void', 3, 3], ['iron', 3, 2], ['explosive', 3, 2]], { waves: [[['void', 3, 2], ['crystal', 3, 2], ['gold', 2, 1]]], foes: { kinds: ['splitter', 'gunship', 'layer'], first: 6, every: 12, max: 3 }, hazard: 'holes', par: 140 }),
        L('Hunger at the Edge', 'boss', [], { boss: 'maw', par: 240 }),
      ],
    },
  ];

  const INTRO = [
    ['varga', 'Haven Station, year 212 of the colony. For a billion years the belt was quiet.'],
    ['varga', 'Then the rocks began to fall toward us.'],
    ['nova', 'Kestrel is fuelled and armed. I am going out there.'],
    ['kite', 'Systems green. I am told this is the part where I say something brave.'],
  ];

  function levelKey(c, l) {
    return (c + 1) + '-' + (l + 1);
  }

  const LEVEL_COUNT = CHAPTERS.reduce((n, c) => n + c.levels.length, 0);

  Object.assign(NS.campaign, {
    CAST, MODES, CHAPTERS, INTRO, LEVEL_COUNT, levelKey
  });
})();
