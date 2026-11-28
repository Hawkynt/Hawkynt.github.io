/* The story, "The Hush": the cast (Lyra Vale, a street DJ; Metro, her drone metronome who counts
   everything out loud; Auntie Reverb, who keeps Radio Afterglow on air; and the five bosses, each a
   district's sound turned sour) with portrait colours, every cinematic as a list of shots - the intro,
   each district's arrival, each duel before and after, the finale and the credits - the lines called
   out during play and the Journal's codex entries. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  const CAST = {
    lyra: { name: 'Lyra Vale', role: 'street DJ', skin: '#c8865a', hair: '#2a1a3a', coat: '#ff4a9a', accent: '#5af0ff', look: 'phones' },
    metro: { name: 'Metro', role: 'drone metronome', skin: '#b8c8e0', hair: '#5a6a8a', coat: '#3a4a6a', accent: '#ffd25a', look: 'drone' },
    reverb: { name: 'Auntie Reverb', role: 'host of Radio Afterglow', skin: '#e0b090', hair: '#d8d0e0', coat: '#7a3a8a', accent: '#ffb07a', look: 'shades' },
    gristle: { name: 'Gristle', role: 'the Bass Baron', skin: '#8a5a6a', hair: '#2a0a1a', coat: '#4a0a2a', accent: '#ff4a9a', look: 'boss', boss: 0 },
    vesper: { name: 'Vesper', role: 'the Glass Siren', skin: '#c8f0ff', hair: '#7affd0', coat: '#1a4a5a', accent: '#c48aff', look: 'boss', boss: 1 },
    anvil: { name: 'Anvil-9', role: 'foundry automaton', skin: '#8a7a6a', hair: '#3a2a1a', coat: '#5a3a1a', accent: '#ff8a3a', look: 'boss', boss: 2 },
    undertow: { name: 'Madame Undertow', role: 'queen of the deep club', skin: '#5a8ab0', hair: '#0a2a5a', coat: '#06204a', accent: '#5affea', look: 'boss', boss: 3 },
    hush: { name: 'The Hush', role: 'conductor of silence', skin: '#e8e8f8', hair: '#ffffff', coat: '#1a1a2a', accent: '#e0e0ff', look: 'boss', boss: 4 },
  };
  const BOSS_KEYS = ['gristle', 'vesper', 'anvil', 'undertow', 'hush'];

  const SHOTS = {
    intro: [
      { kind: 'card', title: 'The Hush', sub: 'Hush City has forgotten its music', world: 0, dur: 3.4 },
      { kind: 'talk', who: 'reverb', text: 'This is Radio Afterglow, the last station still on the air. Everywhere else in the city... nothing. Not a hum.', dur: 4.6 },
      { kind: 'talk', who: 'lyra', text: 'The Docks went quiet last night, Auntie. The cranes stopped swinging. Even the gulls lost the beat.', dur: 4.2 },
      { kind: 'talk', who: 'metro', text: 'One, two, three, four! I still have the beat. I always have the beat. Somebody has to.', dur: 3.8 },
      { kind: 'talk', who: 'reverb', text: 'Then take it out there, girl. Play every district back to life, note by note - and find who is doing this.', dur: 4.4 },
      { kind: 'talk', who: 'metro', text: 'Hit the notes as they cross the line. D, F, J, K. On the beat, not after it!', dur: 3.6 },
    ],
    finale: [
      { kind: 'victory', title: 'Hush City Sings', sub: 'Five districts back on the beat', world: 4, dur: 3.6 },
      { kind: 'talk', who: 'hush', text: 'All that noise. I only wanted one quiet moment in a city that never stops shouting.', dur: 4.4 },
      { kind: 'talk', who: 'lyra', text: 'Then come down to the Docks at dawn. Between the songs there is a rest - that is your quiet. You have to earn it.', dur: 4.8 },
      { kind: 'talk', who: 'reverb', text: 'Radio Afterglow to Hush City: every station is back on the air. Turn it up.', dur: 4 },
      { kind: 'talk', who: 'metro', text: 'Five, six, seven, eight! Again from the top? Again from the top!', dur: 3.4 },
      { kind: 'credits', title: 'Thank you for playing', sub: 'Free Play, Marathon, the Daily Mix and the Remix Tour await', dur: 6 },
    ],
  };

  const WORLD_LINES = [
    [['lyra', 'The Docks. Cranes like giant metronomes, and not one of them moving.'], ['metro', 'Just taps here. Watch the line, hit on the beat - the music tells you when.']],
    [['reverb', 'The Gardens hold their light like a long note. Hold yours too.'], ['metro', 'Long notes! Press when the head crosses the line and keep holding to the tail.']],
    [['lyra', 'The Foundry runs on two hands. Pistons left, pistons right.'], ['metro', 'Chords! Two notes on one beat - hit both lanes together.']],
    [['reverb', 'The Undertow Club. Down there, silence bites. Mind the dark notes, child.'], ['metro', 'Hush notes! The dark ones. Do NOT press them. Let them fall past.']],
    [['lyra', 'The Spire. Up there the notes do not even stay in their lanes.'], ['metro', 'Drift notes slide over before the line. Follow the arrow and hit where they land!']],
  ];

  const BOSS_LINES = [
    [['boss', 'Bass so heavy the harbour sinks! Let us see you keep up when I DROP it!'], ['metro', 'He speeds the notes up on his Bass Drop. Read early, stay calm.']],
    [['boss', 'Glass remembers every note... and I will fog every one of them.'], ['lyra', 'Then I will play the part I can see and trust the beat for the rest.']],
    [['boss', 'CLANG. HAMMERFALL PROTOCOL. INSERTING SILENCE INTO YOUR LANES.'], ['metro', 'When it swings, Hush notes rain down. Leave them alone!']],
    [['boss', 'Dance with the tide, darling. Everything sways down here.'], ['lyra', 'The whole highway is rocking. Eyes on the line, not the lanes.']],
    [['boss', '...'], ['reverb', 'The Hush takes every trick from every district - and then it takes the music itself.'], ['metro', 'If the sound goes, keep counting with me. One, two, three, four.']],
  ];

  const WIN_LINES = [
    [['lyra', 'Listen - the cranes are swinging again!'], ['reverb', 'The Docks are back on the air. Gristle is humming along, the old grump.']],
    [['metro', 'The glass is singing! In tune! Mostly in tune!']],
    [['lyra', 'Anvil-9 is tapping its foot. Robots can learn rhythm after all.']],
    [['reverb', 'Madame Undertow just booked you for Friday nights. I said you would think about it.']],
    [],
  ];

  const CALLOUTS = {
    combo: ['On fire!', 'Keep it going!', 'The crowd is with you!', 'Unstoppable!'],
    surge: ['SURGE!', 'Turn it up!', 'Here we go!'],
    low: ['Find the beat!', 'Stay with me!', 'Breathe - count it in!'],
    phrase: ['Star phrase!', 'Shining!', 'Perfect phrase!'],
    rescue: ['Second wind!', 'Not done yet!'],
    boss: ['It is weakening!', 'Keep hitting!', 'Almost there!'],
  };

  const CODEX = {
    docks: 'Cranes, containers and neon over black water. House music used to roll in with every ferry.',
    gardens: 'Greenhouses of singing glass. Light held long enough becomes a note.',
    foundry: 'The furnaces keep time in pairs. Two hammers, one beat.',
    club: 'A club at the bottom of the bay. Down here the silence is alive, and it bites.',
    spire: 'A tower above the clouds where every note drifts on the wind.',
  };

  function worldIntro(w, world) {
    const shots = [{ kind: 'card', title: world.name, sub: world.blurb, world: w, dur: 3 }];
    for (const l of WORLD_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.8 });
    return shots;
  }

  function bossIntro(w, boss) {
    const shots = [{ kind: 'boss', title: boss.name, sub: NS.worldData.ATTACKS[boss.attacks[0]].name + (boss.attacks.length > 1 ? ' and every trick in the city' : ''), world: w, boss: w, dur: 3.2 }];
    for (const l of BOSS_LINES[w]) shots.push({ kind: 'talk', who: l[0] === 'boss' ? BOSS_KEYS[w] : l[0], text: l[1], dur: 3.8 });
    return shots;
  }

  function bossWin(w, boss) {
    const shots = [{ kind: 'victory', title: boss.short + ' finds the beat', sub: 'District ' + (w + 1) + ' of 5 is back on the air', world: w, dur: 3.2 }];
    for (const l of WIN_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.4 });
    return shots;
  }

  NS.storyData = { CAST, BOSS_KEYS, SHOTS, WORLD_LINES, BOSS_LINES, WIN_LINES, CALLOUTS, CODEX, worldIntro, bossIntro, bossWin };
})();
