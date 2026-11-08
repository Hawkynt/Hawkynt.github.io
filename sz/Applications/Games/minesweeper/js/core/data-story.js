/* The story, "The Bloomfield Expedition": the cast (Wren the young surveyor, Tock her clockwork mole
   who can hear a mine ticking, Elder Maple who keeps the valley's seeds, and the Rustmonger, a
   lonely tinkerer who sowed the valley with clockwork mines) with portrait colours, every
   cinematic as a list of shots - the intro, each land's arrival, each guardian before and after its
   fight, the finale and the credits - and the lines called out during play. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});

  const CAST = {
    wren: { name: 'Wren', role: 'surveyor', skin: '#f0c8a0', hair: '#c0602a', coat: '#3a7a4a', accent: '#ffd25a' },
    tock: { name: 'Tock', role: 'clockwork mole', skin: '#c8a070', hair: '#8a6a4a', coat: '#b08a3a', accent: '#7affea' },
    maple: { name: 'Elder Maple', role: 'keeper of seeds', skin: '#d8b090', hair: '#e8e8e0', coat: '#a04a2a', accent: '#ffb07a' },
    rust: { name: 'The Rustmonger', role: 'tinkerer of the Citadel', skin: '#b09080', hair: '#4a3a3a', coat: '#5a3a2a', accent: '#ffd07a' },
  };

  const SHOTS = {
    intro: [
      { kind: 'card', title: 'The Bloomfield Expedition', sub: 'Five lands, sown with clockwork mines', world: 0, dur: 3.4 },
      { kind: 'talk', who: 'maple', text: 'Wren, nothing has grown in the valley since the Rustmonger buried his ticking mines in every field.', dur: 4.6 },
      { kind: 'talk', who: 'wren', text: 'Then I\'ll survey every field, cell by cell, until it\'s safe to plant again.', dur: 3.8 },
      { kind: 'talk', who: 'tock', text: '*tick tick* The numbers tell you how many mines touch a cell. I\'ll help you hear the rest.', dur: 4.2 },
      { kind: 'talk', who: 'maple', text: 'Every field out there can be read by reason alone - no guessing. Start in Meadowmere.', dur: 4 },
    ],
    finale: [
      { kind: 'victory', title: 'The Valley Blooms', sub: 'Five lands cleared, every field planted', world: 4, dur: 3.6 },
      { kind: 'talk', who: 'rust', text: 'I only built them so someone would come and see what I could make. Nobody ever came.', dur: 4.4 },
      { kind: 'talk', who: 'wren', text: 'We came. Build sprinklers next time - Maple needs about a thousand.', dur: 4 },
      { kind: 'talk', who: 'maple', text: 'The seeds are already in the ground. You did this, cell by cell.', dur: 3.8 },
      { kind: 'talk', who: 'tock', text: '*tick* No more ticking. Just bees.', dur: 3.2 },
      { kind: 'credits', title: 'Thank you for playing', sub: 'Classic, the Daily Field, Zen, Rush, the Gauntlet and Versus await', dur: 6 },
    ],
  };

  const WORLD_LINES = [
    [['wren', 'Clover and craters. Let\'s start where it\'s quiet.'], ['tock', 'A cell with no number has no mines around it - it opens a whole patch at once.']],
    [['tock', '*brrr* My springs are freezing. Some fields here are timed - keep moving!'], ['wren', 'Smoke over the ice too. Remember what the numbers said before it rolled in.']],
    [['maple', 'The Badlands vents blow smoke across the fields. Read fast, remember well.'], ['wren', 'Chests! Tock, those hold tools.']],
    [['tock', 'Wet gears, wet maps. The Archivist hides gems in every flooded stack.'], ['wren', 'Gems first, then the rest of the field.']],
    [['rust', 'You walked all the way to my Citadel? Nobody walks all the way to my Citadel.'], ['wren', 'Then you\'d better have the kettle on.']],
  ];

  const BOSS_LINES = [
    [['boss', 'Tunnels everywhere! Your little numbers go back underground!'], ['tock', 'It reburies opened cells - they\'re still safe, just open them again.']],
    [['boss', 'Hoo. Your flags will freeze to the ground, child.'], ['wren', 'Then I\'ll remember where the mines are without them.']],
    [['boss', 'GRRRM. SMOKE. ASH. NO NUMBERS FOR YOU.'], ['maple', 'Smoke hides numbers for a while - read the field before it rolls in.']],
    [['boss', 'Out of order! Every flag back on the shelf!'], ['tock', 'It knocks your flags loose. Put them back - the mines never moved.']],
    [['boss', 'ENGINE AT FULL STEAM. ALL TRICKS AT ONCE.'], ['wren', 'Watch the fuse, Tock. Clear it before it blows.']],
  ];

  const WIN_LINES = [
    [['wren', 'Meadowmere is safe. First seeds in!'], ['tock', '*happy ticking*']],
    [['maple', 'The ice is melting into the furrows. Good water for spring.']],
    [['wren', 'The vents are quiet. Even the Badlands can grow cactus flowers.']],
    [['tock', 'Every lost map is back on its shelf. The Archivist says thank you. Very quietly.']],
    [],
  ];

  const CALLOUTS = {
    big: ['What a clearing!', 'Look at it open up!', 'A whole field at once!'],
    shield: ['Shield popped - that was close!', 'Phew! Defused.'],
    gem: ['A gem!', 'Shiny!'],
    chest: ['A chest - new tool!', 'Tock found something!'],
    danger: ['Careful now...', 'Slow and steady.'],
    fuse: ['The fuse is burning down!', 'Hurry, Wren!'],
  };

  function worldIntro(w, world) {
    const shots = [{ kind: 'card', title: world.name, sub: world.blurb, world: w, dur: 3 }];
    for (const l of WORLD_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.8 });
    return shots;
  }

  function bossIntro(w, boss) {
    const shots = [{ kind: 'boss', title: boss.name, sub: boss.title, world: w, boss: w, dur: 3.2 }];
    for (const l of BOSS_LINES[w]) shots.push({ kind: 'talk', who: l[0], boss: w, text: l[1], dur: 3.8 });
    return shots;
  }

  function bossWin(w, boss) {
    const shots = [{ kind: 'victory', title: boss.name + ' falls silent', sub: 'Land ' + (w + 1) + ' of 5 is safe to plant', world: w, dur: 3.2 }];
    for (const l of WIN_LINES[w]) shots.push({ kind: 'talk', who: l[0], text: l[1], dur: 3.4 });
    return shots;
  }

  NS.storyData = { CAST, SHOTS, WORLD_LINES, BOSS_LINES, WIN_LINES, CALLOUTS, worldIntro, bossIntro, bossWin };
})();
