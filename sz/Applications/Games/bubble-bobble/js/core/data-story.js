/* The story: the cast (Fizz the bubble-blowing newt, her cousin Pop who reads the winds, Grandma
   Tide of the Lagoon and Baron Dryspell who stole the water of five kingdoms) with portrait
   colours, every cinematic as a list of shots - the intro, each kingdom's arrival, each guardian
   before and after its fight, the finale and the credits - and the lines called out during
   play. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  const CAST = {
    fizz: { name: 'Fizz', role: 'bubble newt', skin: '#7be0c0', hair: '#3aa08a', coat: '#ff8ac0', accent: '#ffd25a' },
    pop: { name: 'Pop', role: 'wind reader', skin: '#ffc07a', hair: '#e08a3a', coat: '#5a8aff', accent: '#9ae8ff' },
    tide: { name: 'Grandma Tide', role: 'keeper of the Lagoon', skin: '#a0d8f0', hair: '#f0f8ff', coat: '#2a6a9a', accent: '#7affea' },
    dryspell: { name: 'Baron Dryspell', role: 'thief of the lagoons', skin: '#c8905a', hair: '#5a2a1a', coat: '#3a1a10', accent: '#ffe8a0' },
  };

  const SHOTS = {
    intro: [
      { kind: 'card', title: 'The Dry Lagoon', sub: 'One morning, every drop of water was gone', world: 0, dur: 3.4 },
      { kind: 'talk', who: 'tide', text: 'Fizz, Baron Dryspell has bottled the water of five kingdoms and locked it in his castle.', dur: 4.4 },
      { kind: 'talk', who: 'fizz', text: 'Then I\'ll blow bubbles until every one of his goons is floating away!', dur: 3.8 },
      { kind: 'talk', who: 'pop', text: 'I\'ll read the winds. Bubbles drift where the wind goes - pop them in bunches for big points!', dur: 4.2 },
      { kind: 'talk', who: 'tide', text: 'Start in the Candy Caverns. Bring the water home, little one.', dur: 3.4 },
    ],
    finale: [
      { kind: 'victory', title: 'The Lagoon Fills Again', sub: 'Five kingdoms, all their water home', world: 4, dur: 3.6 },
      { kind: 'talk', who: 'dryspell', text: 'I only wanted... one cool drink. Everything here was so dry.', dur: 4 },
      { kind: 'talk', who: 'tide', text: 'Then come and share ours. The Lagoon has water enough for everyone.', dur: 4 },
      { kind: 'talk', who: 'pop', text: 'The winds are warm and wet again. Best weather report ever.', dur: 3.6 },
      { kind: 'talk', who: 'fizz', text: 'And I still have bubbles left. Lots of bubbles.', dur: 3.4 },
      { kind: 'credits', title: 'Thank you for playing', sub: 'Arcade, Blitz, Zen, the Daily Challenge and Boss Rush await', dur: 6 },
    ],
  };

  const WORLD_LINES = [
    [['fizz', 'Everything here is sticky. Even the enemies.'], ['pop', 'Trap them in a bubble, then touch it to pop. Easy!']],
    [['pop', 'Wind-up soldiers! They charge straight at you.'], ['fizz', 'Hold jump while landing on a bubble to bounce on it.']],
    [['tide', 'The canopy guards the old rain wells. Watch for lightning bubbles - they strike in a line.'], ['fizz', 'Ooh, a water bubble! It floods the platforms.']],
    [['pop', 'Up here the wind blows every way at once.'], ['fizz', 'Five star bubbles mean an extra life. Collect them!']],
    [['dryspell', 'You came all this way for a few puddles?'], ['fizz', 'For a whole lagoon. Hand it over!']],
  ];

  const BOSS_LINES = [
    [['boss', 'GUMMO STICKS! GUMMO STAYS!'], ['pop', 'Hit him with bubbles - and grab the lightning ones!']],
    [['boss', 'Ten-hut! Toys, attack formation!'], ['fizz', 'Time to wind you down, General.']],
    [['boss', 'CROOOAK. The storm answers only to me!'], ['tide', 'Lightning bubbles hurt it most, Fizz.']],
    [['boss', 'Arr! These skies belong to Captain Zephyr!'], ['pop', 'Its shots fan out - stay moving!']],
    [['boss', 'Enough bubbles! Dry out, little newt!'], ['fizz', 'Not a chance.']],
  ];

  const WIN_LINES = [
    [['fizz', 'The syrup falls are running again!'], ['pop', 'One kingdom done!']],
    [['tide', 'The toybox fountains sparkle once more.']],
    [['fizz', 'Rain! Real rain!']],
    [['pop', 'The clouds are full of water again. And grateful.']],
    [],
  ];

  const CALLOUTS = {
    chain: ['What a chain!', 'Pop pop pop!', 'Look at them go!'],
    hurry: ['Hurry up!', 'They\'re getting angry!'],
    popDown: ['Ow! Be right back!', 'I\'ll float back in a moment!', 'Keep going, Fizz!'],
    shade: ['Something is coming... run!'],
    power: ['Ooh, candy!', 'Power-up!'],
  };

  function worldIntro(w, world) {
    const shots = [{ kind: 'card', title: world.name, sub: world.blurb, world: w, dur: 3 }];
    for (const l of WORLD_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.6 });
    return shots;
  }

  function bossIntro(w, boss) {
    const shots = [{ kind: 'boss', title: boss.name, sub: boss.title, world: w, boss: w, dur: 3.2 }];
    for (const l of BOSS_LINES[w]) shots.push({ kind: 'talk', who: l[0], boss: w, text: l[1], dur: 3.6 });
    return shots;
  }

  function bossWin(w, boss) {
    const shots = [{ kind: 'victory', title: boss.name + ' pops', sub: 'Kingdom ' + (w + 1) + ' of 5 gets its water back', world: w, dur: 3.2 }];
    for (const l of WIN_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.4 });
    return shots;
  }

  NS.storyData = { CAST, SHOTS, WORLD_LINES, BOSS_LINES, WIN_LINES, CALLOUTS, worldIntro, bossIntro, bossWin };
})();
