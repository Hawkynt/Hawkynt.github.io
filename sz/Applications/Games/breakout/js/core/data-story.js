/* The story: the cast (Juno the pilot of the paddle-ship Aurora, Bolt her chatty drone, Captain
   Orla of the Lightkeepers and the Gloom that dims the stars) with portrait colours, and every
   cinematic as a list of shots - the intro, each fortress's arrival, each guardian before and
   after its fight, the finale and the credits - plus the lines called out during play. Shot
   kinds: card, talk, boss, victory, credits. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});

  const CAST = {
    juno: { name: 'Juno', role: 'pilot of the Aurora', skin: '#f0c8a8', hair: '#ff6a8a', coat: '#3a4ac0', accent: '#ffd25a' },
    bolt: { name: 'Bolt', role: 'helper drone', skin: '#c8d8f0', hair: '#5ad0ff', coat: '#5a6a8a', accent: '#5ad0ff' },
    orla: { name: 'Captain Orla', role: 'of the Lightkeepers', skin: '#c89070', hair: '#e8e8f0', coat: '#2a6a5a', accent: '#7be08a' },
    gloom: { name: 'The Gloom', role: 'devourer of stars', skin: '#1a0a2a', hair: '#8a5aff', coat: '#0a0414', accent: '#ffe8a0' },
  };

  const SHOTS = {
    intro: [
      { kind: 'card', title: 'Prism Run', sub: 'One by one, the stars are going out', world: 4, dur: 3.4 },
      { kind: 'talk', who: 'orla', text: 'Juno, the Gloom Engine has walled the starlight inside five brick fortresses. Without it, the night swallows everything.', dur: 4.6 },
      { kind: 'talk', who: 'juno', text: 'Then the Aurora breaks them open. One ball, one paddle, a lot of bricks.', dur: 3.8 },
      { kind: 'talk', who: 'bolt', text: 'Bolt has calculated the odds! They are... let us not talk about the odds.', dur: 3.8 },
      { kind: 'talk', who: 'orla', text: 'Start with the Neon Gardens. And watch out for what guards each fortress.', dur: 3.6 },
    ],
    finale: [
      { kind: 'victory', title: 'The Stars Return', sub: 'The Gloom Engine falls silent', world: 4, dur: 3.6 },
      { kind: 'talk', who: 'gloom', text: 'So much light... I only wanted to stop feeling so cold.', dur: 4 },
      { kind: 'talk', who: 'orla', text: 'Every fortress is open. Look up, Juno - the sky is full again.', dur: 4 },
      { kind: 'talk', who: 'bolt', text: 'Bolt is counting the stars. Bolt will be busy for a while.', dur: 3.6 },
      { kind: 'talk', who: 'juno', text: 'Then let\'s keep the Aurora warm. There are always more bricks somewhere.', dur: 3.6 },
      { kind: 'credits', title: 'Thank you for playing', sub: 'Arcade, Blitz, Zen, the Daily Challenge and Boss Rush await', dur: 6 },
    ],
  };

  const WORLD_LINES = [
    [['juno', 'Hedges that glow in the dark. Pretty - for a prison.'], ['bolt', 'Some bricks hold crystals. Crystals hold power-ups. Bolt likes crystals.']],
    [['bolt', 'Brrr. Glass bricks let the ball fly straight through!'], ['orla', 'The Frost Warden mends its shield fast. Strike hard and often.']],
    [['juno', 'Gears everywhere. And bombs - chain them and watch it go.'], ['bolt', 'Titan bricks are tough. Even fire bounces off them.']],
    [['orla', 'The reef bricks grow back. Do not leave them for later.'], ['juno', 'It\'s so dark down here...']],
    [['gloom', 'You came all this way, little light. Come closer.'], ['juno', 'Last fortress. Let\'s finish this.']],
  ];

  const BOSS_LINES = [
    [['boss', 'NO ONE PRUNES THE COLOSSUS!'], ['bolt', 'Hit the body, not the leaves!']],
    [['boss', 'Your warmth will freeze like everything else.'], ['juno', 'Then I\'ll break the ice.']],
    [['boss', 'TICK. TOCK. Your time is up, pilot.'], ['bolt', 'Its ring spins faster when it\'s angry. Watch out!']],
    [['boss', 'The deep keeps what it takes.'], ['juno', 'Not this time.']],
    [['boss', 'I AM THE DARK BETWEEN THE STARS.'], ['orla', 'Juno - everything you have. Now!']],
  ];

  const WIN_LINES = [
    [['juno', 'The Gardens are glowing again!'], ['bolt', 'One fortress down. Bolt is doing a victory spin.']],
    [['orla', 'The Citadel thaws. Starlight is flowing back.']],
    [['bolt', 'The gears stopped! Bolt can hear itself think again.']],
    [['juno', 'The reef is shining. The deep isn\'t so scary any more.']],
    [],
  ];

  const CALLOUTS = {
    combo: ['What a chain!', 'Keep it going!', 'Bricks everywhere!'],
    power: ['Power up!', 'Ooh, shiny!', 'Bolt approves.'],
    danger: ['Last ball, Juno!', 'Careful now!'],
    boss: ['Aim for its body!', 'Break the shield ring!'],
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
    const shots = [{ kind: 'victory', title: boss.name + ' falls', sub: 'Fortress ' + (w + 1) + ' of 5 sets its starlight free', world: w, dur: 3.2 }];
    for (const l of WIN_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.4 });
    return shots;
  }

  NS.storyData = { CAST, SHOTS, WORLD_LINES, BOSS_LINES, WIN_LINES, CALLOUTS, worldIntro, bossIntro, bossWin };
})();
