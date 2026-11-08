/* The five fortresses of the story, each with a palette, a backdrop style and six stages - five
   brick layouts and a guardian. Layout characters: 1-6 colours, s steel (2 hits), t titan (3,
   stops fire), g glass (balls pass), # wall, b bomb, r regrows, * gold target (2 hits), c crystal
   (always drops a power). Stage kinds: clear (every brick), gold (every gold target), timed
   (clear before the clock runs out) and boss. Each stage has a par time for the second star and
   a bonus goal for the third. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});

  const WORLDS = [
    { id: 'neon', name: 'Neon Gardens', blurb: 'Glowing hedges under a pink sky', sky: ['#1a0a3a', '#ff6aa8'], accent: '#5ae07a', glow: '#ffb0e0', style: 'garden',
      boss: { id: 'hedge', name: 'Hedge Colossus', title: 'Warden of the Gardens', hp: 30, speed: 70, shoot: 3.2, shot: 'seed', ring: 6, color: '#3aa04a', accent: '#ff9ad0' },
      stages: [
        { name: 'First Light', kind: 'clear', par: 60, bonus: { k: 'nolose' }, layout: ['55555555555555', '44444444444444', '33333333333333', '22222222222222', '11111111111111'] },
        { name: 'Blossom', kind: 'clear', par: 80, bonus: { k: 'combo', n: 8 }, layout: ['....1111....', '...122221...', '..12333321..', '..12344321..', '..12333321..', '...122221...', '....1111....', '.....44.....', '.....44.....'] },
        { name: 'Hedge Maze', kind: 'clear', par: 100, bonus: { k: 'catch', n: 4 }, layout: ['4s4s4s4s4s4s4s', '4............4', '4.55555555.c.4', '4.5......5...4', '4.5.3333.5.4.4', '4.5.3cc3.5.4.4', '4.5.3333...4.4', '4.55555555.4.4', '4..........4.4', '44444444444444'] },
        { name: 'Lantern Rows', kind: 'timed', time: 120, par: 80, bonus: { k: 'nolose' }, layout: ['b6b6b6b6b6b6b6', '66666666666666', '..............', '5g5g5g5g5g5g5g', '55555555555555', '..............', '3b3b3b3b3b3b3b', '33333333333333'] },
        { name: 'Golden Bloom', kind: 'gold', par: 90, bonus: { k: 'combo', n: 10 }, layout: ['.....##.....', '....#**#....', '...#1111#...', '..#222222#..', '.#33333333#.', '#4444444444#', '.5555555555.', '..66666666..'] },
        { name: 'Hedge Colossus', kind: 'boss', par: 150, bonus: { k: 'nolose' }, layout: [] },
      ] },
    { id: 'glacier', name: 'Glacier Citadel', blurb: 'Ice towers that ring like bells', sky: ['#0a1a3a', '#8ad0ff'], accent: '#9ae8ff', glow: '#e0f8ff', style: 'ice',
      boss: { id: 'frost', name: 'Frost Warden', title: 'Keeper of the Cold', hp: 40, speed: 90, shoot: 2.8, shot: 'ice', ring: 8, color: '#7ac0ff', accent: '#ffffff' },
      stages: [
        { name: 'Frozen Gate', kind: 'clear', par: 90, bonus: { k: 'nolose' }, layout: ['gggggggggggggg', '55555555555555', 's5s5s5s5s5s5s5', '44444444444444', 'gggggggggggggg', '33333333333333'] },
        { name: 'Icicles', kind: 'clear', par: 100, bonus: { k: 'combo', n: 12 }, layout: ['55555555555555', '5.5.5.5.5.5.5.', '5.5.5.5.5.5.5.', 'g.g.g.g.g.g.g.', 's.s.s.s.s.s.s.', '5...5...5...5.', 'c...c...c...c.'] },
        { name: 'Snow Fort', kind: 'gold', par: 110, bonus: { k: 'catch', n: 5 }, layout: ['#s#s#s#s#s#s#s', 'ssssssssssssss', 's555555555555s', 's5gggggggggg5s', 's5g*......*g5s', 's5gggggggggg5s', 's555555555555s', 'ssssssssssssss'] },
        { name: 'Avalanche', kind: 'timed', time: 130, par: 90, bonus: { k: 'nolose' }, layout: ['bbbbbbbbbbbbbb', '44444444444444', '44444444444444', 'g4g4g4g4g4g4g4', '33333333333333', '33333333333333', 'b3b3b3b3b3b3b3'] },
        { name: 'Crystal Hall', kind: 'clear', par: 120, bonus: { k: 'combo', n: 15 }, layout: ['..tt......tt..', '.t55t....t55t.', 't5555t..t5555t', 't5cc5t..t5cc5t', 't5555t..t5555t', '.t55t....t55t.', '..tt......tt..', '..............', 'gggggggggggggg'] },
        { name: 'Frost Warden', kind: 'boss', par: 170, bonus: { k: 'nolose' }, layout: [] },
      ] },
    { id: 'foundry', name: 'Clockwork Foundry', blurb: 'Brass gears and hissing steam', sky: ['#2a1608', '#c08a3a'], accent: '#ffc05a', glow: '#ffe0a0', style: 'gears',
      boss: { id: 'gear', name: 'Gear Tyrant', title: 'Lord of a Thousand Cogs', hp: 50, speed: 110, shoot: 2.5, shot: 'bolt', ring: 10, color: '#c08a3a', accent: '#ffe07a' },
      stages: [
        { name: 'Boiler Room', kind: 'clear', par: 100, bonus: { k: 'nolose' }, layout: ['ssssssssssssss', '22222222222222', '2b22b22b22b22b', '22222222222222', 'ssssssssssssss', '33333333333333'] },
        { name: 'Cog Wheel', kind: 'clear', par: 110, bonus: { k: 'combo', n: 15 }, layout: ['....ssssss....', '...s222222s...', '..s23333332s..', '.s2334444332s.', '.s234*##*432s.', '.s2334444332s.', '..s23333332s..', '...s222222s...', '....ssssss....'] },
        { name: 'Conveyor', kind: 'timed', time: 140, par: 100, bonus: { k: 'catch', n: 6 }, layout: ['#............#', '#2222222222222', '#3333333333333', '2222222222222#', '3333333333333#', '#rrrrrrrrrrrr#', '#cccccccccccc#'] },
        { name: 'Pressure Valve', kind: 'gold', par: 120, bonus: { k: 'nolose' }, layout: ['tttttttttttttt', 't*....bb....*t', 't.tttt..tttt.t', 't.t22222222t.t', 't.t2b2bb2b2t.t', 't.t22222222t.t', 't............t', 'tttttt..tttttt'] },
        { name: 'Engine Heart', kind: 'clear', par: 140, bonus: { k: 'combo', n: 20 }, layout: ['bsbsbsbsbsbsbs', 'ssssssssssssss', '33333333333333', 'r3r3r3r3r3r3r3', '44444444444444', 'tttt..cc..tttt', '22222222222222', 'b2b2b2b2b2b2b2'] },
        { name: 'Gear Tyrant', kind: 'boss', par: 190, bonus: { k: 'nolose' }, layout: [] },
      ] },
    { id: 'abyss', name: 'Coral Abyss', blurb: 'Glowing reefs in the dark deep', sky: ['#020a1a', '#0a4a6a'], accent: '#5ae0e0', glow: '#a0fff0', style: 'reef',
      boss: { id: 'kraken', name: 'Abyssal Kraken', title: 'Terror of the Trench', hp: 60, speed: 120, shoot: 2.2, shot: 'ink', ring: 10, color: '#6a3ac0', accent: '#5ae0e0' },
      stages: [
        { name: 'Reef Edge', kind: 'clear', par: 110, bonus: { k: 'nolose' }, layout: ['66666666666666', '6g6g6g6g6g6g6g', '55555555555555', 'r5r5r5r5r5r5r5', '44444444444444', 'c............c'] },
        { name: 'Jellyfish', kind: 'clear', par: 120, bonus: { k: 'combo', n: 15 }, layout: ['..666....666..', '.66666..66666.', '6666666666666g', '6g6g6g66g6g6g6', '.5.5.5..5.5.5.', '.5.5.5..5.5.5.', '..5.5....5.5..', '..r.r....r.r..'] },
        { name: 'Sunken Chest', kind: 'gold', par: 130, bonus: { k: 'catch', n: 6 }, layout: ['ssssssssssssss', 'st3333333333ts', 'st3******333ts', 'st3333333333ts', 'stttttttttttts', 'ssssssssssssss', '..............', 'gggggggggggggg'] },
        { name: 'Undertow', kind: 'timed', time: 150, par: 110, bonus: { k: 'nolose' }, layout: ['rrrrrrrrrrrrrr', '66666666666666', 'b6b6b6b6b6b6b6', '55555555555555', 'rrrrrrrrrrrrrr', '44444444444444', 'c4c4c4c4c4c4c4'] },
        { name: 'Pearl Throne', kind: 'clear', par: 150, bonus: { k: 'combo', n: 25 }, layout: ['t.t.t.t.t.t.t.', '66666666666666', '6tttttttttttt6', '6t5555555555t6', '6t5ccccccc55t6', '6t5555555555t6', '6tttt....tttt6', '66666666666666'] },
        { name: 'Abyssal Kraken', kind: 'boss', par: 200, bonus: { k: 'nolose' }, layout: [] },
      ] },
    { id: 'gloom', name: 'The Gloom Engine', blurb: 'A machine that eats the light', sky: ['#05020c', '#3a1a5a'], accent: '#c08aff', glow: '#ffe8a0', style: 'engine',
      boss: { id: 'engine', name: 'The Gloom Engine', title: 'Devourer of Stars', hp: 75, speed: 130, shoot: 1.9, shot: 'void', ring: 12, color: '#8a5aff', accent: '#ffe8a0' },
      stages: [
        { name: 'Outer Hull', kind: 'clear', par: 120, bonus: { k: 'nolose' }, layout: ['tttttttttttttt', '66666666666666', 'b666b666b666b6', '66666666666666', 'ssssssssssssss', '55555555555555', 'c............c'] },
        { name: 'Dark Matter', kind: 'clear', par: 140, bonus: { k: 'combo', n: 20 }, layout: ['#6#6#6#6#6#6#6', '66666666666666', '6#6#6#6#6#6#6#', '..............', 'r5r5r5r5r5r5r5', '5r5r5r5r5r5r5r', '..............', 'gcgcgcgcgcgcgc'] },
        { name: 'Core Vault', kind: 'gold', par: 150, bonus: { k: 'catch', n: 7 }, layout: ['tttttttttttttt', '.############.', '.#*........*#.', '.#.66666666.#.', '.#.6bbbbbb6.#.', '.#.66666666.#.', '.#*........*#.', '.###......###.'] },
        { name: 'Event Horizon', kind: 'timed', time: 160, par: 120, bonus: { k: 'nolose' }, layout: ['bbbbbbbbbbbbbb', '66666666666666', 'r6r6r6r6r6r6r6', 'ssssssssssssss', '55555555555555', 'r5r5r5r5r5r5r5', 'cccccccccccccc'] },
        { name: 'Starless Gate', kind: 'clear', par: 170, bonus: { k: 'combo', n: 30 }, layout: ['t6t6t6t6t6t6t6', '6t6t6t6t6t6t6t', 'ssssssssssssss', '5bb5bb5bb5bb5b', 'rrrrrrrrrrrrrr', '44444444444444', '#..##.cc.##..#', '33333333333333'] },
        { name: 'The Gloom Engine', kind: 'boss', par: 240, bonus: { k: 'nolose' }, layout: [] },
      ] },
  ];

  const STAGES = [];
  for (let w = 0; w < WORLDS.length; ++w)
    for (let s = 0; s < WORLDS[w].stages.length; ++s) {
      const st = WORLDS[w].stages[s];
      st.id = WORLDS[w].id + '-' + (s + 1);
      st.world = w;
      st.index = s;
      STAGES.push(st);
    }
  const BY_ID = {};
  for (const st of STAGES) BY_ID[st.id] = st;
  const BOSSES = WORLDS.map(w => w.boss);

  NS.worldData = { WORLDS, STAGES, BY_ID, BOSSES };
})();
