/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements, daily
   quests, the streak and the festival track paying coins, ball trails earned by deeds and festivals
   (the colour of the trail behind every shot), and a story told by a cast - Professor Cogsworth,
   his apprentice Mina, the robot Bolt and the Chaos Gremlin who keeps scrambling the labs: a
   prologue, an arrival in every world and a finale. Scenes hold the play loop (G.hold). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  const TR = (id, name, rgb, b, unlock) => ({ id, name, colors: ['rgb(' + rgb + ')', b], rgb, unlock });
  const TRAILS = [
    TR('classic', 'Warm Light', '255,240,210', '#fff0d2', { kind: 'free' }),
    TR('spark', 'Spark Blue', '90,200,255', '#c8f4ff', { kind: 'stat', stat: 'levels', n: 10, text: 'Solve 10 levels' }),
    TR('lime', 'Lime', '140,255,110', '#e0ffd0', { kind: 'stat', stat: 'oneShot', n: 5, text: 'Solve 5 levels in one shot' }),
    TR('rose', 'Rose', '255,110,170', '#ffd0e8', { kind: 'stat', stat: 'stars', n: 40, text: 'Collect 40 stars' }),
    TR('gold', 'Gold', '255,215,90', '#fff2b0', { kind: 'stat', stat: 'tricks', n: 5, text: 'Land 5 trick shots' }),
    TR('violet', 'Violet', '176,106,255', '#ead8ff', { kind: 'stat', stat: 'shots', n: 500, text: 'Fire 500 shots' }),
    TR('fest-frost', 'Frostfall', '190,240,255', '#ffffff', { kind: 'festival', id: 'frost' }),
    TR('fest-bloom', 'Bloom', '255,154,208', '#7ae08a', { kind: 'festival', id: 'bloom' }),
    TR('fest-sunfest', 'Sunfest', '255,210,58', '#ff8a2a', { kind: 'festival', id: 'sunfest' }),
    TR('fest-harvest', 'Harvest', '224,144,42', '#ffe0a0', { kind: 'festival', id: 'harvest' }),
    TR('fest-hollow', 'Hollow Night', '255,122,26', '#8a3ad8', { kind: 'festival', id: 'hollow' }),
    TR('fest-starfall', 'Starfall', '255,210,58', '#6a6ad8', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('l1', 'Eureka', 'levels', 1, 2, 'Solve a level'), A('l10', 'Lab Assistant', 'levels', 10, 4, 'Solve 10 levels'), A('l40', 'Grand Inventor', 'levels', 40, 10, 'Solve 40 levels'),
    A('o1', 'Hole in One', 'oneShot', 1, 2, 'Solve a level in one shot'), A('o15', 'Sharp Eye', 'oneShot', 15, 6, 'Solve 15 levels in one shot'),
    A('s20', 'Starry', 'stars', 20, 3, 'Collect 20 stars'), A('s100', 'Constellation', 'stars', 100, 10, 'Collect 100 stars'),
    A('t1', 'Trick Shot', 'tricks', 1, 2, 'Land a trick shot'), A('t10', 'Show-off', 'tricks', 10, 6, 'Land 10 trick shots'),
    A('sh100', 'Trigger Happy', 'shots', 100, 2, 'Fire 100 shots'), A('sh1000', 'Ballistics', 'shots', 1000, 6, 'Fire 1,000 shots'),
    A('d1', 'Daily Puzzle', 'dailies', 1, 2, 'Solve a Daily level'), A('d10', 'Puzzle a Day', 'dailies', 10, 6, 'Solve 10 Daily levels'),
    A('st7', 'Seven Days', 'bestStreak', 7, 6, 'Play seven days in a row'), A('q10', 'Lab Errands', 'quests', 10, 5, 'Complete 10 daily quests'),
    A('f1', 'Festive Physics', 'festivals', 1, 6, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-l', kind: 'levels', n: 3, reward: 3, text: 'Solve 3 levels' }, { id: 'q-o', kind: 'oneShot', n: 1, reward: 4, text: 'Solve a level in one shot' },
    { id: 'q-s', kind: 'stars', n: 5, reward: 3, text: 'Collect 5 stars' }, { id: 'q-t', kind: 'tricks', n: 1, reward: 3, text: 'Land a trick shot' },
    { id: 'q-sh', kind: 'shots', n: 25, reward: 2, text: 'Fire 25 shots' }, { id: 'q-d', kind: 'dailies', n: 1, reward: 3, text: 'Solve the Daily level' },
  ];

  const CAST = {
    prof: { name: 'Professor Cogsworth', skin: '#f0c8a0', hair: '#e8e8f0', cloth: '#f4f4f8', trim: '#ffb35a', eyes: '#2a3a5a', head: 'goggles' },
    mina: { name: 'Mina', skin: '#c88a5a', hair: '#2a1a14', cloth: '#3a7ad8', trim: '#7ee07a', eyes: '#1a1a1a', head: 'cap' },
    bolt: { name: 'Bolt', trim: '#7ad8ff', draw(g, k) {
      k.R(6, 8, 20, 18, '#8a9aaa'); k.R(8, 10, 16, 14, '#b8c8d8'); k.R(10, 14, 4, 4, '#2a3a4a'); k.R(18, 14, 4, 4, '#2a3a4a');
      k.R(11, 15, 2, 2, '#7ad8ff'); k.R(19, 15, 2, 2, '#7ad8ff'); k.R(12, 20, 8, 2, '#5a6a7a'); k.R(15, 2, 2, 6, '#5a6a7a'); k.E(16, 2, 2.5, 2.5, '#ffb35a');
      k.R(4, 28, 24, 6, '#5a6a7a'); } },
    gremlin: { name: 'The Chaos Gremlin', foe: true, trim: '#ff5aff', draw(g, k) {
      k.E(16, 20, 12, 11, '#5a8a3a'); k.P([4, 8, 9, 14, 12, 10], '#5a8a3a'); k.P([28, 8, 23, 14, 20, 10], '#5a8a3a');
      k.E(11, 17, 3, 3.5, '#ffff7a'); k.E(21, 17, 3, 3.5, '#ffff7a'); k.E(11, 18, 1.4, 2, '#1a1a1a'); k.E(21, 18, 1.4, 2, '#1a1a1a');
      k.P([9, 24, 23, 24, 16, 28], '#2a1a0a'); k.R(12, 24, 2, 2, '#ffffff'); k.R(18, 24, 2, 2, '#ffffff'); } },
  };
  const S = (who, text) => ({ who, text });
  const WORLD_IN = [
    [S('prof', 'The Tinker Workshop. Planks, springs, crates - the honest tools.'), S('gremlin', 'Hee hee. I moved all the crates. Good luck!')],
    [S('mina', 'The Greenhouse. Fans blow, belts roll, and the pond eats balls.'), S('bolt', 'Calculating wind. Calculating... splash.')],
    [S('prof', 'The Cryo Lab. Ice slides, magnets pull and portals... portal.'), S('gremlin', 'I swapped the portals around. Or did I?')],
    [S('bolt', 'Volcano Forge. Temperature: spicy.'), S('mina', 'Bumpers and lava. Aim twice, shoot once.')],
    [S('gremlin', 'Orbit Station! Gravity is just a suggestion up here.'), S('prof', 'And suggestions can be calculated. Off you go.')],
  ];
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('prof', 'Mina! Someone has scrambled every experiment in my labs.'),
      S('gremlin', 'Someone? Me! Crates in the pond, springs on the ceiling. Wonderful!'),
      S('mina', 'Then we put every ball where it belongs. One shot at a time.'),
      S('bolt', 'Recommendation: place parts before firing. Probability of success: higher.'),
      S('prof', 'Precisely. Science, Mina - with a slingshot.')] },
    finale: { title: 'Finale', lines: [
      S('gremlin', 'You solved... all of them? Even the floaty ones?'),
      S('prof', 'Every lab in order. Splendid work, Mina.'),
      S('bolt', 'Gremlin threat level: sulking.'),
      S('mina', 'Daily puzzles next. I am just getting warmed up.')] },
  };
  for (let i = 0; i < 5; ++i) scenes['world-' + i] = { title: 'World ' + (i + 1) + ': arrival', lines: WORLD_IN[i] };

  const pause = () => { NS.G.hold = true; };
  const resume = () => { NS.G.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'physics-puzzle', cast: CAST, scenes, pause, resume }) : null;

  let trail = '255,240,210';
  function applyTrail(id) {
    const t = TRAILS.find(x => x.id === id);
    trail = t ? t.rgb : '255,240,210';
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'physics-puzzle', title: 'Physics Puzzle', accent: '#ffb35a', currency: 'coins x15',
    pay: n => { const G = NS.G; if (G.save) { G.save.coins += n * 15; if (NS.save && NS.save.writeSave) NS.save.writeSave(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: TRAILS, cosmeticLabel: 'Ball trail', onEquip: applyTrail,
    tokens: { levels: 15, stars: 5, tricks: 15, dailies: 20, shots: 0.5 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }

  function onLevel(run) {
    if (!story || !run || run.mode !== 'campaign') return;
    const L = SZ.PhysicsPuzzleLevels, w = run.world || 0;
    const first = L && L.LEVELS.find(l => l.world === w);
    if (first && first === run.level) {
      if (w === 0) story.play('prologue');
      story.play('world-' + w);
    }
  }
  function onShot() { deed('shots', 1); }
  function onSolved(run, results) {
    deed('levels', 1);
    if (results.shots === 1) deed('oneShot', 1);
    if (results.newStars) deed('stars', results.newStars);
    if (run.mode === 'trick') deed('tricks', 1);
    if (run.mode === 'daily') deed('dailies', 1);
    const L = SZ.PhysicsPuzzleLevels;
    if (story && run.mode === 'campaign' && L) {
      const last = L.LEVELS.filter(l => l.world === L.WORLDS.length - 1).pop();
      if (last === run.level) story.play('finale');
    }
  }

  NS.meta = { goals, story, TRAILS, deed, onLevel, onShot, onSolved, trailRgb: () => trail,
    open: tab => goals && goals.open(tab) };
})();
