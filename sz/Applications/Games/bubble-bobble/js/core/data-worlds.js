/* The five kingdoms of the story, each with a palette, a backdrop style, a platform style and
   six stages - five rooms and a guardian. A room is generated from the stage's seed in the
   kingdom's style with its enemy kinds and count (see core/levels.js); stage kinds: clear (trap
   and pop everyone) and timed (before the clock runs out). Each stage has a par time for the
   second star and a bonus goal for the third. Guardians have hit points, speed, a fan of shots
   and a helper they call in. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  const st = (name, kind, kinds, count, par, bonus, extra) => Object.assign({ name: name, kind: kind, kinds: kinds, count: count, par: par, bonus: bonus }, extra || {});
  const WORLDS = [
    { id: 'candy', name: 'Candy Caverns', blurb: 'Caves of rock candy and syrup falls', sky: ['#3a0a3a', '#ff8ac0'], accent: '#ff8ac0', glow: '#ffd0e8', style: 'garden', platform: 'ledges', tile: '#ff7ab0',
      boss: { id: 'gummo', name: 'King Gummo', title: 'the Sticky Sovereign', hp: 24, speed: 80, shoot: 2.8, fan: 3, minion: 'walker', color: '#ff5a9a', accent: '#ffe0f0' },
      stages: [st('Sugar Steps', 'clear', ['walker'], 3, 40, { k: 'nodeath' }), st('Gumdrop Hollow', 'clear', ['walker', 'hopper'], 4, 50, { k: 'chain', n: 2 }),
        st('Licorice Loop', 'clear', ['hopper'], 5, 55, { k: 'fruit', n: 4 }), st('Syrup Falls', 'timed', ['walker', 'hopper'], 5, 45, { k: 'nodeath' }, { time: 70 }),
        st('Rock Candy Hall', 'clear', ['walker', 'hopper', 'flyer'], 6, 65, { k: 'chain', n: 3 }), st('King Gummo', 'boss', [], 0, 90, { k: 'nodeath' })] },
    { id: 'toys', name: 'Toybox Tower', blurb: 'Wind-up soldiers and building blocks', sky: ['#0a1a3a', '#5a8aff'], accent: '#5ad0ff', glow: '#c8e8ff', style: 'ice', platform: 'steps', tile: '#5a9aff',
      boss: { id: 'tin', name: 'General Tinwhistle', title: 'Commander of the Toybox', hp: 32, speed: 95, shoot: 2.5, fan: 3, minion: 'charger', color: '#5a8aff', accent: '#ffd25a' },
      stages: [st('Block Stairs', 'clear', ['walker', 'charger'], 5, 55, { k: 'nodeath' }), st('Music Box', 'clear', ['flyer', 'hopper'], 5, 60, { k: 'chain', n: 3 }),
        st('Marble Run', 'timed', ['charger'], 6, 50, { k: 'fruit', n: 5 }, { time: 75 }), st('Puppet Stage', 'clear', ['shooter', 'walker'], 6, 70, { k: 'nodeath' }),
        st('Train Set', 'clear', ['charger', 'flyer', 'shooter'], 7, 75, { k: 'chain', n: 3 }), st('General Tinwhistle', 'boss', [], 0, 100, { k: 'nodeath' })] },
    { id: 'jungle', name: 'Canopy Kingdom', blurb: 'Vines, waterfalls and giant leaves', sky: ['#0a2a14', '#5ac07a'], accent: '#7be08a', glow: '#e0ffc0', style: 'gears', platform: 'islands', tile: '#5ab05a',
      boss: { id: 'croak', name: 'Croakatoa', title: 'the Thunder Frog', hp: 40, speed: 110, shoot: 2.3, fan: 4, minion: 'hopper', color: '#3aa05a', accent: '#ffe07a' },
      stages: [st('Vine Bridge', 'clear', ['hopper', 'flyer'], 6, 60, { k: 'nodeath' }), st('Leaf Drop', 'clear', ['shooter', 'hopper'], 6, 65, { k: 'fruit', n: 6 }),
        st('Monkey Tree', 'timed', ['charger', 'hopper'], 7, 55, { k: 'chain', n: 3 }, { time: 80 }), st('Waterfall', 'clear', ['flyer', 'ghost'], 6, 70, { k: 'nodeath' }),
        st('Temple Roots', 'clear', ['brute', 'hopper', 'shooter'], 7, 80, { k: 'chain', n: 4 }), st('Croakatoa', 'boss', [], 0, 110, { k: 'nodeath' })] },
    { id: 'clouds', name: 'Cloudworks', blurb: 'Sky ships and humming propellers', sky: ['#1a2a5a', '#c0d8ff'], accent: '#c8e8ff', glow: '#ffffff', style: 'reef', platform: 'clouds', tile: '#e0eaff',
      boss: { id: 'zephyr', name: 'Captain Zephyr', title: 'Pirate of the Gusts', hp: 48, speed: 125, shoot: 2.1, fan: 4, minion: 'flyer', color: '#7a9ac0', accent: '#ff7a5a' },
      stages: [st('Cloud Dock', 'clear', ['flyer', 'walker'], 6, 60, { k: 'nodeath' }), st('Propeller Deck', 'clear', ['charger', 'flyer'], 7, 70, { k: 'chain', n: 3 }),
        st('Storm Front', 'timed', ['ghost', 'flyer'], 6, 60, { k: 'fruit', n: 6 }, { time: 80 }), st('Rigging', 'clear', ['shooter', 'brute'], 7, 80, { k: 'nodeath' }),
        st('Crow\'s Nest', 'clear', ['brute', 'charger', 'ghost'], 8, 85, { k: 'chain', n: 4 }), st('Captain Zephyr', 'boss', [], 0, 120, { k: 'nodeath' })] },
    { id: 'castle', name: 'Dryspell Castle', blurb: 'Where every drop of water is stolen', sky: ['#0e0612', '#7a2a3a'], accent: '#ff8a5a', glow: '#ffe8a0', style: 'engine', platform: 'castle', tile: '#8a6a5a',
      boss: { id: 'dryspell', name: 'Baron Dryspell', title: 'Thief of the Lagoons', hp: 60, speed: 135, shoot: 1.9, fan: 5, minion: 'ghost', color: '#a05a3a', accent: '#ffe8a0' },
      stages: [st('Dust Moat', 'clear', ['charger', 'shooter'], 7, 70, { k: 'nodeath' }), st('Sand Halls', 'clear', ['brute', 'ghost'], 7, 80, { k: 'chain', n: 4 }),
        st('Hourglass', 'timed', ['charger', 'hopper', 'flyer'], 8, 70, { k: 'fruit', n: 7 }, { time: 85 }), st('Cracked Throne', 'clear', ['shooter', 'ghost', 'brute'], 8, 90, { k: 'nodeath' }),
        st('Last Drop', 'clear', ['charger', 'brute', 'ghost', 'shooter'], 9, 95, { k: 'chain', n: 4 }), st('Baron Dryspell', 'boss', [], 0, 140, { k: 'nodeath' })] },
  ];

  const STAGES = [];
  for (let w = 0; w < WORLDS.length; ++w)
    for (let s = 0; s < 6; ++s) {
      const x = WORLDS[w].stages[s];
      x.id = WORLDS[w].id + '-' + (s + 1);
      x.world = w;
      x.index = s;
      x.speed = 1 + (w * 6 + s) * 0.025;
      STAGES.push(x);
    }
  const BY_ID = {};
  for (const x of STAGES) BY_ID[x.id] = x;

  /* the room of a stage, the same every time */
  function levelOf(stage) {
    if (stage.kind === 'boss') return { map: NS.levels.blank().map((r, y) => r.map((c, x) => (y === 16 && (x < 5 || x > 18) && x > 0 && x < 23) ? '#' : c).join('')), spawn: { x: 2, y: 18 }, enemies: [], wind: 'center' };
    return NS.levels.generate(NS.rng.hashString('stage-' + stage.id), WORLDS[stage.world].platform, { kinds: stage.kinds, count: stage.count });
  }

  NS.worldData = { WORLDS, STAGES, BY_ID, BOSSES: WORLDS.map(w => w.boss), levelOf };
})();
