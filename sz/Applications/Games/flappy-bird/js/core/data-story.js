;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /*
   * The story: the cast, the six Season Feathers, the chapters and every cinematic as data.
   * A cinematic is a list of shots; a shot lasts t seconds and has a backdrop (bg: a biome,
   * 'skytree' or 'storm'), actors that glide from x[0],y[0] to x[1],y[1] (id: a bird id,
   * 'boss:<kind>', 'feather:<0-5>', 'feathers' (all six) or 'tree'), an optional caption,
   * an optional speech line { who, text } and effects (fx). systems/cinematics.js plays
   * them, render/cine-render.js draws them.
   */

  const CAST = {
    sunny: { name: 'Sunny', bird: 'sunny', color: '#ffd23f' },
    hoot: { name: 'Elder Hoot', bird: 'snowy', color: '#e8eefc' },
    pip: { name: 'Pip', bird: 'pip', color: '#5ad06a' },
    ruby: { name: 'Ruby', bird: 'ruby', color: '#ff6a3d' },
    jay: { name: 'Jay', bird: 'jay', color: '#5ab8ff' },
    corvus: { name: 'Corvus', bird: 'corvus', color: '#b45aff' },
    bee: { name: 'Queen Buzzella', boss: 'bee', color: '#ffc21a' },
    wyrm: { name: 'Dunejaw', boss: 'wyrm', color: '#e8a050' },
    owl: { name: 'Glacius', boss: 'owl', color: '#9fe0ff' },
    moth: { name: 'Duskmoth', boss: 'moth', color: '#c08aff' },
    crowbot: { name: 'MK-7 Crowbot', boss: 'crowbot', color: '#ff4a6a' }
  };

  const FEATHERS = [
    { name: 'Dawn Feather', color: '#ffd84a' },
    { name: 'Sand Feather', color: '#ff9a3a' },
    { name: 'Frost Feather', color: '#8ae8ff' },
    { name: 'Dusk Feather', color: '#b07aff' },
    { name: 'Neon Feather', color: '#3af2ff' },
    { name: 'Ember Feather', color: '#ff4a2a' }
  ];

  const CHAPTERS = [
    { title: 'Chapter 1', name: 'The Honey Thief', biome: 'meadow' },
    { title: 'Chapter 2', name: 'Sea of Sand', biome: 'desert' },
    { title: 'Chapter 3', name: 'The Frozen Throne', biome: 'frost' },
    { title: 'Chapter 4', name: 'Where the Moths Dance', biome: 'forest' },
    { title: 'Chapter 5', name: 'Iron Wings', biome: 'city' },
    { title: 'Chapter 6', name: 'Heart of the Storm', biome: 'volcano' }
  ];

  const BOSS_TAUNTS = {
    bee: 'Bzzz! That feather is MY honey now!',
    wyrm: 'The sand swallows little birds whole...',
    owl: 'Hoo dares to warm my mountain?',
    moth: 'Come closer to the light, little bird...',
    crowbot: 'INTRUDER DETECTED. ENGAGING.',
    corvus: 'You again? Then let the storm take you!'
  };

  const CINE = {};

  CINE.intro = [
    { t: 5, bg: 'skytree', fx: ['sunrise', 'sparkle'], caption: 'High above the clouds grows the Sky Tree, home of every bird that ever flapped.',
      actors: [{ id: 'tree', x: [640, 640], y: [580, 570], s: 0.8 }, { id: 'sunny', x: [180, 520], y: [520, 360], s: 2.2, bob: 10 }] },
    { t: 5, bg: 'skytree', fx: ['sparkle'], caption: 'Six Season Feathers keep its leaves turning: blossom and sun, harvest and snow, day and night.',
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8 }, { id: 'feathers', x: [640, 640], y: [330, 330], s: 1 }] },
    { t: 4.5, bg: 'storm', fx: ['storm', 'lightning', 'shake'], say: { who: 'corvus', text: 'Seasons? Bah! From now on there is only STORM!' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8, a: [1, 0.6] }, { id: 'corvus', x: [1400, 860], y: [120, 250], s: 3.6, bob: 12 }, { id: 'feathers', x: [640, 640], y: [330, 330], s: 1, scatter: true }] },
    { t: 5, bg: 'skytree', fx: ['dark'], say: { who: 'hoot', text: 'Corvus has scattered the feathers across the six lands. Without them, the Sky Tree will wither.' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8, a: [0.7, 0.7] }, { id: 'snowy', x: [820, 800], y: [360, 360], s: 3, bob: 4 }, { id: 'sunny', x: [430, 450], y: [380, 370], s: 2.4, bob: 8 }] },
    { t: 4.5, bg: 'skytree', fx: ['dark'], say: { who: 'sunny', text: 'Then I will bring them back. All six of them!' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8, a: [0.7, 0.7] }, { id: 'snowy', x: [800, 800], y: [360, 360], s: 3, bob: 4 }, { id: 'sunny', x: [450, 470], y: [370, 340], s: 2.6, bob: 10 }] },
    { t: 4, bg: 'skytree', fx: ['dark', 'sparkle'], say: { who: 'pip', text: 'Not without me, you won\'t! Wait up!' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8, a: [0.7, 0.7] }, { id: 'sunny', x: [470, 760], y: [340, 200], s: 2.6, bob: 6 }, { id: 'pip', x: [-60, 600], y: [480, 250], s: 2.2, bob: 6 }] }
  ];

  const CHAPTER_LINES = [
    [{ who: 'pip', text: 'The Dawn Feather landed somewhere past these pipes. And it smells like honey...' },
      { who: 'sunny', text: 'Honey means bees. Big bees, probably.' }],
    [{ who: 'ruby', text: 'Sandstorms all day since Corvus flew over. Dunejaw guards the Sand Feather deep in the canyon.' },
      { who: 'sunny', text: 'Stay low, stay quick. Got it, Ruby.' }],
    [{ who: 'hoot', text: 'The Frost Peaks freeze any bird that lingers. Glacius watches everything from his ice throne.' },
      { who: 'pip', text: 'B-b-brr. Can we go back to the desert?' }],
    [{ who: 'jay', text: 'The Twilight Woods never see the sun. Follow the fireflies and mind the bats.' },
      { who: 'sunny', text: 'Duskmoth won\'t like a sunbird in her woods.' }],
    [{ who: 'jay', text: 'Neon City. Corvus built a machine to guard the Neon Feather.' },
      { who: 'pip', text: 'A robot crow? Of course he did.' }],
    [{ who: 'hoot', text: 'This is it. Corvus waits at the heart of Ember Volcano with the last feather.' },
      { who: 'sunny', text: 'Five feathers say the seasons want to come home. Let\'s finish this.' }]
  ];

  const VICTORY_LINES = [
    { who: 'pip', text: 'One down! The meadow already smells like spring again.' },
    { who: 'ruby', text: 'The sandstorm is settling. Nice flying, Sunny!' },
    { who: 'hoot', text: 'The ice is melting. Three feathers home - the tree remembers its colours.' },
    { who: 'jay', text: 'Look, the moon is out! The woods can finally rest.' },
    { who: 'pip', text: 'The robot is scrap! Only the volcano left...' }
  ];

  const SIDEKICK = ['pip', 'ruby', 'snowy', 'jay', 'jay', 'snowy'];
  const SPEAKER_BIRD = { pip: 'pip', ruby: 'ruby', hoot: 'snowy', jay: 'jay', sunny: 'sunny', corvus: 'corvus' };

  for (let w = 0; w < 6; ++w) {
    const ch = CHAPTERS[w];
    const lines = CHAPTER_LINES[w];
    const friend = SPEAKER_BIRD[lines[0].who];
    CINE['chapter' + (w + 1)] = [
      { t: 3.2, bg: ch.biome, pan: [0, 500], fx: ['title'], title: ch.title, subtitle: ch.name,
        actors: [{ id: 'sunny', x: [-80, 420], y: [380, 340], s: 2.4, bob: 8 }, { id: friend, x: [-200, 260], y: [440, 400], s: 2, bob: 8 }] },
      { t: 4.2, bg: ch.biome, pan: [500, 800], say: lines[0],
        actors: [{ id: 'sunny', x: [420, 470], y: [340, 330], s: 2.4, bob: 8 }, { id: friend, x: [260, 290], y: [400, 400], s: 2.2, bob: 8 }] },
      { t: 3.8, bg: ch.biome, pan: [800, 1100], say: lines[1],
        actors: [{ id: 'sunny', x: [470, 1400], y: [330, 260], s: 2.4, bob: 6 }, { id: friend, x: [290, 1300], y: [400, 300], s: 2.2, bob: 6 }] }
    ];
  }

  for (let w = 0; w < 5; ++w) {
    const biome = CHAPTERS[w].biome;
    const line = VICTORY_LINES[w];
    CINE['victory' + (w + 1)] = [
      { t: 3.6, bg: biome, pan: [0, 120], fx: ['sparkle', 'rays'], caption: 'The ' + FEATHERS[w].name + ' is recovered! (' + (w + 1) + ' / 6)',
        actors: [{ id: 'sunny', x: [480, 520], y: [400, 380], s: 2.6, bob: 8 }, { id: 'feather:' + w, x: [800, 560], y: [560, 260], s: 1.4 }] },
      { t: 4, bg: biome, pan: [120, 300], fx: ['sparkle'], say: line,
        actors: [{ id: 'sunny', x: [520, 560], y: [380, 360], s: 2.6, bob: 8 }, { id: SPEAKER_BIRD[line.who], x: [-80, 330], y: [300, 400], s: 2.2, bob: 8 }, { id: 'feather:' + w, x: [560, 560], y: [260, 250], s: 1.2 }] }
    ];
  }

  CINE.finale = [
    { t: 4.5, bg: 'storm', fx: ['storm', 'shake'], say: { who: 'corvus', text: 'No... the storm... it was supposed to last forever...' },
      actors: [{ id: 'corvus', x: [800, 760], y: [260, 520], s: 3.4, rot: [0, 0.8] }, { id: 'sunny', x: [400, 420], y: [300, 290], s: 2.4, bob: 6 }] },
    { t: 5, bg: 'skytree', fx: ['sunrise', 'sparkle'], caption: 'One by one, the Season Feathers find their way home.',
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8, a: [0.7, 1] }, { id: 'feathers', x: [640, 640], y: [330, 330], s: 1, gather: true }] },
    { t: 5, bg: 'skytree', fx: ['bloom', 'sparkle'], say: { who: 'hoot', text: 'Blossom, sun, harvest and snow. Every season has its turn - even the storm.' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8 }, { id: 'feathers', x: [640, 640], y: [330, 330], s: 1 }, { id: 'snowy', x: [880, 880], y: [380, 370], s: 2.6, bob: 4 }] },
    { t: 4.5, bg: 'skytree', fx: ['bloom'], say: { who: 'sunny', text: 'There\'s room on the tree for you too, Corvus.' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8 }, { id: 'sunny', x: [430, 450], y: [360, 350], s: 2.4, bob: 6 }, { id: 'corvus', x: [860, 840], y: [380, 380], s: 2.2, bob: 3 }, { id: 'pip', x: [330, 340], y: [420, 410], s: 2, bob: 6 }] },
    { t: 4, bg: 'skytree', fx: ['bloom'], say: { who: 'corvus', text: '...Maybe a small branch. A stormy one.' },
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8 }, { id: 'sunny', x: [450, 450], y: [350, 350], s: 2.4, bob: 6 }, { id: 'corvus', x: [840, 840], y: [380, 380], s: 2.2, bob: 3 }, { id: 'pip', x: [340, 340], y: [410, 410], s: 2, bob: 6 }] },
    { t: 6, bg: 'skytree', fx: ['fireworks', 'title'], title: 'THE END', subtitle: 'The sky is never finished - keep flying!',
      actors: [{ id: 'tree', x: [640, 640], y: [570, 570], s: 0.8 }, { id: 'sunny', x: [450, 1400], y: [350, 120], s: 2.4, bob: 6 }, { id: 'pip', x: [340, 1300], y: [410, 160], s: 2, bob: 6 }] }
  ];

  Object.assign(NS.C, { CAST, FEATHERS, CHAPTERS, BOSS_TAUNTS, CINE });
})();
