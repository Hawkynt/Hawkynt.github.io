/* The story: the cast (Kip the young builder, Ollo the stone golem, Elder Vey the keeper of the
   Spire and the Hollow Mason who unbuilds the worlds) with their portrait colours, and every
   cinematic as a list of shots - the intro, each realm's arrival, each guardian before and after
   its fight, the finale and the credits. Shot kinds: card (title over the realm), talk (portrait
   and typed line), boss (the guardian rises), victory (a keystone returns) and credits. Also the
   lines the cast calls out during play. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  const CAST = {
    kip: { name: 'Kip', role: 'apprentice builder', skin: '#f2c8a0', hair: '#5a3a22', coat: '#f08a3a', accent: '#ffe07a' },
    ollo: { name: 'Ollo', role: 'stone golem', skin: '#9aa0a8', hair: '#5a9a4a', coat: '#6a7078', accent: '#9affea' },
    vey: { name: 'Elder Vey', role: 'keeper of the Spire', skin: '#e8c8b0', hair: '#f0f0f8', coat: '#4a5ac0', accent: '#ffd25a' },
    mason: { name: 'The Hollow Mason', role: 'unbuilder', skin: '#2a1a4a', hair: '#8a5aff', coat: '#1a0a2a', accent: '#ffe8a0' },
  };

  const S = {
    intro: [
      { kind: 'card', title: 'The Spire of Lumen', sub: 'Long ago, five keystones held the worlds together', world: 4, dur: 3.4 },
      { kind: 'talk', who: 'vey', text: 'Kip! The Hollow Mason has pulled the five keystones from the Spire. The realms are crumbling.', dur: 4.4 },
      { kind: 'talk', who: 'kip', text: 'Then we build them back up. Block by block, line by line.', dur: 3.6 },
      { kind: 'talk', who: 'ollo', text: 'Ollo carries. Kip stacks. Stones like a full row - full rows go home.', dur: 4 },
      { kind: 'talk', who: 'vey', text: 'Start in the Verdant Ruins. And Kip... mind the guardians.', dur: 3.6 },
    ],
    finale: [
      { kind: 'victory', title: 'The Spire Stands', sub: 'All five keystones are home', world: 4, dur: 3.6 },
      { kind: 'talk', who: 'mason', text: 'You build... faster than I can unbuild. Perhaps the worlds were worth keeping after all.', dur: 4.4 },
      { kind: 'talk', who: 'vey', text: 'The Spire shines again. Every realm will remember your name, Kip.', dur: 4 },
      { kind: 'talk', who: 'ollo', text: 'Ollo remembers too. Ollo is made of remembering.', dur: 3.4 },
      { kind: 'talk', who: 'kip', text: 'Then let\'s keep building. Higher. Faster. Maybe a little fancier.', dur: 3.6 },
      { kind: 'credits', title: 'Thank you for playing', sub: 'Marathon, Sprint, Ultra, Zen, the Daily Challenge, Boss Rush and Master mode await', dur: 6 },
    ],
  };

  const WORLD_LINES = [
    [['kip', 'Ruins everywhere. These walls used to be the start of everything.'], ['ollo', 'Moss tickles. Ollo likes it here.']],
    [['kip', 'The crystals sing when a line clears. Listen!'], ['vey', 'Shardmaw sleeps in the deepest hollow. Do not wake it lightly.']],
    [['ollo', 'Ollo does not swim. Ollo sinks. Ollo is fine with that.'], ['kip', 'The tide is rising. We have to stack faster than the water.']],
    [['kip', 'It\'s so hot the blocks glow.'], ['vey', 'Vulkar forged the Mason\'s tools. Break his hammer and the Spire is in reach.']],
    [['vey', 'The last stair. The Mason waits at the top, where the stars are thin.'], ['kip', 'Four keystones in my pack. One more.']],
  ];

  const BOSS_LINES = [
    [['ollo', 'Big tree. Angry tree.'], ['boss', 'GRUMBLE. Roots take back what stones forget!']],
    [['boss', 'Crrrrack. Your little rows shatter like glass.'], ['kip', 'Then I\'ll stack them twice as fast.']],
    [['boss', 'The sea swallows every tower in the end, little builder.'], ['ollo', 'Not this one.']],
    [['boss', 'I made the hammer that broke your Spire! Feel the heat of my forge!'], ['kip', 'And I\'ll use the pieces to fix it.']],
    [['boss', 'Every wall falls. Every line is erased. I am only... faster.'], ['kip', 'Not faster than me.']],
  ];

  const WIN_LINES = [
    [['kip', 'The first keystone! It\'s warm.'], ['ollo', 'Grumbleroot is napping now. Shhh.']],
    [['vey', 'The crystal keystone. The hollows are singing again.']],
    [['kip', 'The tide is going out!'], ['ollo', 'Ollo dried off. Ollo is gravel now. Good gravel.']],
    [['vey', 'The forge cools. Only the Spire remains.']],
    [],
  ];

  /* called out during play */
  const CALLOUTS = {
    quad: ['Four at once!', 'A perfect fit!', 'That\'s how it\'s done!'],
    tspin: ['A T-spin! Fancy.', 'Spun right in!', 'Ollo saw that spin.'],
    perfect: ['A perfect clear! Not a single stone left!'],
    danger: ['Careful, the stack is high!', 'Kip, the top!'],
    boss: ['Hit it with a big clear!', 'Clear lines to send them back!'],
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
    const shots = [{ kind: 'victory', title: boss.name + ' falls', sub: 'Keystone ' + (w + 1) + ' of 5 returns to the Spire', world: w, dur: 3.2 }];
    for (const l of WIN_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.4 });
    return shots;
  }

  NS.storyData = { CAST, SHOTS: S, WORLD_LINES, BOSS_LINES, WIN_LINES, CALLOUTS, worldIntro, bossIntro, bossWin };
})();
