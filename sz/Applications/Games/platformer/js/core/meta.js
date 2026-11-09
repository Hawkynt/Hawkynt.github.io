/*
 * The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements, daily
 * quests, the streak and the festival track paying coins, hero auras earned by deeds and festivals
 * (a coloured glow behind the hero), and the adventure told by a cast - the hero Pip, the wise owl
 * Hootsworth, the tinker fox Rusty and the Storm Regent: a prologue, an arrival in every world, a
 * word from every boss and a finale. Scenes hold the play loop (G.hold).
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});

  const AU = (id, name, a, b, unlock) => ({ id, name, colors: [a, b], unlock });
  const AURAS = [
    AU('none', 'No aura', '#3a4256', '#1a2030', { kind: 'free' }),
    AU('sunny', 'Sunny', '#ffd75a', '#fff2b0', { kind: 'stat', stat: 'levels', n: 10, text: 'Clear 10 levels' }),
    AU('leaf', 'Leafy', '#7ad04a', '#d8ffb0', { kind: 'stat', stat: 'stomps', n: 300, text: 'Stomp 300 enemies' }),
    AU('ruby', 'Ruby', '#ff5a6a', '#ffd0d8', { kind: 'stat', stat: 'bosses', n: 3, text: 'Defeat 3 bosses' }),
    AU('azure', 'Azure', '#4aa8ff', '#c8e8ff', { kind: 'stat', stat: 'coins', n: 5000, text: 'Collect 5,000 coins' }),
    AU('storm', 'Stormlight', '#b06aff', '#ffffff', { kind: 'stat', stat: 'bestStage', n: 15, text: 'Reach endless stage 15' }),
    AU('fest-frost', 'Frostfall', '#bff4ff', '#ffffff', { kind: 'festival', id: 'frost' }),
    AU('fest-bloom', 'Bloom', '#ff9ad0', '#7ae08a', { kind: 'festival', id: 'bloom' }),
    AU('fest-sunfest', 'Sunfest', '#ffd23a', '#ff8a2a', { kind: 'festival', id: 'sunfest' }),
    AU('fest-harvest', 'Harvest', '#e0902a', '#ffe0a0', { kind: 'festival', id: 'harvest' }),
    AU('fest-hollow', 'Hollow Night', '#ff7a1a', '#8a3ad8', { kind: 'festival', id: 'hollow' }),
    AU('fest-starfall', 'Starfall', '#ffd23a', '#6a6ad8', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('l1', 'Off We Go', 'levels', 1, 2, 'Clear a level'), A('l10', 'Adventurer', 'levels', 10, 5, 'Clear 10 levels'), A('l40', 'Hero of the Isles', 'levels', 40, 12, 'Clear 40 levels'),
    A('s1', 'Bonk', 'stomps', 1, 1, 'Stomp an enemy'), A('s200', 'Boot Camp', 'stomps', 200, 4, 'Stomp 200 enemies'), A('s2000', 'Heavy Boots', 'stomps', 2000, 10, 'Stomp 2,000 enemies'),
    A('b1', 'Boss Bopper', 'bosses', 1, 4, 'Defeat a boss'), A('b5', 'Regent\'s Bane', 'bosses', 5, 10, 'Defeat 5 bosses'),
    A('c500', 'Pocket Change', 'coins', 500, 2, 'Collect 500 coins'), A('c10k', 'Treasure Hoard', 'coins', 10000, 10, 'Collect 10,000 coins'),
    A('e5', 'Endless Runner', 'bestStage', 5, 3, 'Reach endless stage 5'), A('e20', 'No End in Sight', 'bestStage', 20, 10, 'Reach endless stage 20'),
    A('nd', 'Untouched', 'flawless', 1, 4, 'Clear a level without falling or getting knocked out'), A('nd10', 'Graceful', 'flawless', 10, 8, 'Clear 10 levels without a knockout'),
    A('d1', 'Daily Dash', 'dailies', 1, 2, 'Clear a Daily level'), A('d10', 'Daily Regular', 'dailies', 10, 6, 'Clear 10 Daily levels'),
    A('st7', 'Seven Sunrises', 'bestStreak', 7, 6, 'Play seven days in a row'), A('q10', 'Helpful', 'quests', 10, 5, 'Complete 10 daily quests'),
    A('f1', 'Festival Fun', 'festivals', 1, 6, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-l', kind: 'levels', n: 3, reward: 3, text: 'Clear 3 levels' }, { id: 'q-s', kind: 'stomps', n: 40, reward: 2, text: 'Stomp 40 enemies' },
    { id: 'q-c', kind: 'coins', n: 300, reward: 2, text: 'Collect 300 coins' }, { id: 'q-b', kind: 'bosses', n: 1, reward: 4, text: 'Defeat a boss' },
    { id: 'q-f', kind: 'flawless', n: 1, reward: 4, text: 'Clear a level without a knockout' }, { id: 'q-d', kind: 'dailies', n: 1, reward: 3, text: 'Clear the Daily level' },
  ];

  const CAST = {
    pip: { name: 'Pip', skin: '#f0c8a0', hair: '#8a4a1a', cloth: '#e84a4a', trim: '#ffd75a', eyes: '#2a1a1a', head: 'cap' },
    owl: { name: 'Hootsworth', trim: '#c8a070', draw(g, k) {
      k.E(16, 22, 13, 12, '#7a5a3a'); k.E(16, 25, 8, 7, '#d8c0a0'); k.P([6, 6, 9, 13, 12, 9], '#5a3a1a'); k.P([26, 6, 23, 13, 20, 9], '#5a3a1a');
      k.E(11, 15, 4.5, 4.5, '#fff6e0'); k.E(21, 15, 4.5, 4.5, '#fff6e0'); k.E(11, 15, 2, 2, '#1a1a1a'); k.E(21, 15, 2, 2, '#1a1a1a'); k.P([14, 19, 18, 19, 16, 23], '#ffb03a'); } },
    fox: { name: 'Rusty', trim: '#ff8a3a', draw(g, k) {
      k.E(16, 31, 12, 6, '#3a5a8a'); k.E(16, 18, 11, 10, '#e8702a'); k.P([6, 4, 8, 14, 13, 10], '#e8702a'); k.P([26, 4, 24, 14, 19, 10], '#e8702a');
      k.P([9, 20, 16, 28, 23, 20], '#fff0e0'); k.E(12, 16, 1.6, 1.6, '#1a1a1a'); k.E(20, 16, 1.6, 1.6, '#1a1a1a'); k.E(16, 23, 1.5, 1.2, '#1a1a1a');
      k.R(9, 11, 14, 2, '#3a2a1a'); k.E(12, 12, 2, 1.5, '#9ae4ff'); k.E(20, 12, 2, 1.5, '#9ae4ff'); } },
    regent: { name: 'The Storm Regent', foe: true, skin: '#a8a0c8', hair: '#e8e8f8', cloth: '#3a2a6a', trim: '#b06aff', eyes: '#ffff5a', head: 'wizard' },
    boss: { name: 'Boss', foe: true, trim: '#ff8a6a', draw(g, k) {
      k.E(16, 20, 14, 12, '#3a6a3a'); k.E(16, 18, 11, 9, '#5aaa5a'); k.E(11, 16, 3, 3, '#ffffff'); k.E(21, 16, 3, 3, '#ffffff');
      k.E(11, 16, 1.5, 1.5, '#1a1a1a'); k.E(21, 16, 1.5, 1.5, '#1a1a1a'); k.R(10, 23, 12, 2, '#1a3a1a'); k.P([10, 8, 13, 3, 16, 8, 19, 3, 22, 8], '#ffd75a'); } },
  };
  const S = (who, text, name) => (name ? { who, text, name } : { who, text });
  const WORLD_IN = [
    [S('owl', 'The Sunleaf Meadows. Gentle hills, cheeky critters, a slime who thinks he is a king.'), S('pip', 'Gentle hills I can do!')],
    [S('fox', 'Glimmer Caverns. The ceilings drip and the crystals bite.'), S('pip', 'Lights on, helmet on.')],
    [S('owl', 'Frostfang Peaks. Mind the ice - it does not mind you.'), S('pip', 'Slip, slide, jump. Got it.')],
    [S('fox', 'The Cinder Forge. I made these boots lava-proof. Mostly.'), S('pip', 'Mostly?!')],
    [S('regent', 'My Skyspire. Islands in the clouds, and nothing below them.'), S('pip', 'Then I will not fall.')],
  ];
  const BOSS_LINE = [
    [S('boss', 'BOW before KING GLOOP! Blorp.', 'King Gloop'), S('pip', 'Crowns are for stomping.')],
    [S('boss', 'CRYSTAL. HARD. YOU. SOFT.', 'Crystal Golem'), S('fox', 'Hit it when the crystals glow!')],
    [S('boss', 'Hrrrmm. Who walks on my mountain?', 'Old Rimeback'), S('owl', 'Wait for it to slide, then jump over.')],
    [S('boss', 'The forge is mine. The fire is mine!', 'Magma Drake'), S('pip', 'Stay off the glowing floor...')],
    [S('regent', 'You climbed all the way up here. How tiresome.'), S('pip', 'Give the islands back, Regent!')],
  ];
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('owl', 'Pip! The Storm Regent has scattered the islands and stolen the sunlight.'),
      S('pip', 'Then I will run, jump and bonk my way to get it back.'),
      S('fox', 'Take these boots. They jump higher than you think.'),
      S('regent', 'A little hero with big boots. Come and fall, little hero.'),
      S('pip', 'Here we go!')] },
    finale: { title: 'Finale', lines: [
      S('regent', 'The storm... breaks... how?'),
      S('owl', 'The sun is back over every island. Well done, Pip.'),
      S('fox', 'And the boots survived! Mostly.'),
      S('pip', 'Endless stages next. I am not tired at all!')] },
  };
  for (let i = 0; i < 5; ++i) {
    scenes['world-' + i] = { title: 'World ' + (i + 1) + ': arrival', lines: WORLD_IN[i] };
    scenes['boss-' + i] = { title: 'World ' + (i + 1) + ': boss', lines: BOSS_LINE[i] };
  }

  const pause = () => { NS.state.hold = true; };
  const resume = () => { NS.state.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'platformer', cast: CAST, scenes, pause, resume }) : null;

  let aura = null;
  function applyAura(id) {
    const a = AURAS.find(x => x.id === id);
    aura = !a || id === 'none' ? null : a.colors;
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'platformer', title: 'Platformer', accent: '#ffd75a', currency: 'coins x20',
    pay: n => { const G = NS.state; if (G.save) { G.save.coins += n * 20; if (NS.storage && NS.storage.writeSave) NS.storage.writeSave(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: AURAS, cosmeticLabel: 'Hero aura', onEquip: applyAura,
    tokens: { levels: 12, stomps: 0.3, bosses: 25, dailies: 20 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }
  function record(stat, v) { if (goals) goals.record(stat, v); }

  function worldIndex(r) {
    return typeof r.world === 'number' ? r.world : 0;
  }
  function onLevel(r) {
    if (!story || !r || r.mode !== 'adventure') return;
    const L = SZ.PlatformerLevels, w = worldIndex(r);
    const first = L && L.CAMPAIGN && L.CAMPAIGN[w] && L.CAMPAIGN[w][0] && r.spec && L.CAMPAIGN[w][0].id === r.spec.id;
    if (first && w === 0) story.play('prologue');
    if (first) story.play('world-' + w);
  }
  function onBoss(r) {
    if (story && r && r.mode === 'adventure') story.play('boss-' + worldIndex(r));
  }
  function onBossDown(r) {
    deed('bosses', 1);
    if (story && r && r.mode === 'adventure' && worldIndex(r) === 4) story.play('finale');
  }
  function onFinish(r) {
    deed('levels', 1);
    if (r.coinsRun) deed('coins', Math.floor(r.coinsRun));
    if (!r.deaths) deed('flawless', 1);
    if (r.mode === 'daily') deed('dailies', 1);
  }
  function onEndless(stage) { record('bestStage', stage); }

  function drawAura(ctx, x, y, t) {
    if (!aura) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rr = 46, cy = y - 30;
    const g = ctx.createRadialGradient(x, cy, 2, x, cy, rr);
    g.addColorStop(0, aura[0] + '77');
    g.addColorStop(1, aura[0] + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - rr, cy - rr, rr * 2, rr * 2);
    ctx.fillStyle = aura[1];
    for (let i = 0; i < 5; ++i) {
      const a = t * 2 + i * 1.256;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5 + i);
      ctx.fillRect(x + Math.cos(a) * 26 - 1, cy + Math.sin(a) * 30 - 1, 3, 3);
    }
    ctx.restore();
  }

  NS.meta = { goals, story, AURAS, deed, record, onLevel, onBoss, onBossDown, onFinish, onEndless, drawAura,
    open: tab => goals && goals.open(tab) };
})();
