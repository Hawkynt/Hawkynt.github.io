/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements, daily
   quests, the streak and the real-date festival track (separate from the farm's own seasons) paying
   credits, fence paints earned by deeds and festivals (the fence around the field), and a story told
   by a cast - the settler Juno, the colony agronomist Dr. Reyes, the farm robot SPUD and Baron
   Krell, the land-grabber from the orbital mining company: a prologue on arrival and scenes at the
   first harvest, the first expansion, the first storm, week four and the first million credits. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});

  const F = (id, name, dark, light, unlock) => ({ id, name, colors: [dark, light], unlock });
  const PAINTS = [
    F('wood', 'Plain Wood', '#5e3820', '#9a5b34', { kind: 'free' }),
    F('white', 'Picket White', '#c8ccd8', '#ffffff', { kind: 'stat', stat: 'harvests', n: 200, text: 'Harvest 200 crops' }),
    F('barn', 'Barn Red', '#7a1e1a', '#d84a3a', { kind: 'stat', stat: 'produce', n: 150, text: 'Collect 150 animal products' }),
    F('sage', 'Sage', '#3a5a3a', '#8ac08a', { kind: 'stat', stat: 'days', n: 30, text: 'Run the farm for 30 days' }),
    F('steel', 'Colony Steel', '#3a4250', '#a8b4c8', { kind: 'stat', stat: 'tech', n: 15, text: 'Research 15 technologies' }),
    F('gold', 'Gilded', '#8a5e14', '#ffd75a', { kind: 'stat', stat: 'earned', n: 100000, text: 'Earn 100,000 credits' }),
    F('fest-frost', 'Frostfall', '#7ab0d0', '#ffffff', { kind: 'festival', id: 'frost' }),
    F('fest-bloom', 'Bloom', '#a05a7a', '#ff9ad0', { kind: 'festival', id: 'bloom' }),
    F('fest-sunfest', 'Sunfest', '#c86a1a', '#ffd23a', { kind: 'festival', id: 'sunfest' }),
    F('fest-harvest', 'Harvest', '#7a4a1a', '#e0902a', { kind: 'festival', id: 'harvest' }),
    F('fest-hollow', 'Hollow Night', '#3a1a4a', '#ff7a1a', { kind: 'festival', id: 'hollow' }),
    F('fest-starfall', 'Starfall', '#1a1a4a', '#ffd23a', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('h1', 'First Sprout', 'harvests', 1, 2, 'Harvest a crop'), A('h250', 'Green Thumb', 'harvests', 250, 5, 'Harvest 250 crops'), A('h2500', 'Breadbasket', 'harvests', 2500, 12, 'Harvest 2,500 crops'),
    A('p1', 'Fresh Eggs', 'produce', 1, 2, 'Collect an animal product'), A('p300', 'Rancher', 'produce', 300, 6, 'Collect 300 animal products'),
    A('d7', 'First Week', 'days', 7, 3, 'Run the farm for 7 days'), A('d60', 'Homesteader', 'days', 60, 8, 'Run the farm for 60 days'),
    A('e1', 'More Land', 'expansions', 1, 3, 'Expand the field'), A('e6', 'Land Baron', 'expansions', 6, 8, 'Expand the field 6 times'),
    A('t5', 'Agronomist', 'tech', 5, 3, 'Research 5 technologies'), A('t30', 'Terraformer', 'tech', 30, 10, 'Research 30 technologies'),
    A('m10k', 'Market Day', 'earned', 10000, 3, 'Earn 10,000 credits'), A('m1m', 'Millionaire', 'earned', 1000000, 12, 'Earn 1,000,000 credits'),
    A('st7', 'Seven Sunrises', 'bestStreak', 7, 5, 'Play seven days in a row'), A('q10', 'Chores', 'quests', 10, 4, 'Complete 10 daily quests'),
    A('f1', 'Festival Farm', 'festivals', 1, 5, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-h', kind: 'harvests', n: 40, reward: 2, text: 'Harvest 40 crops' }, { id: 'q-p', kind: 'produce', n: 20, reward: 2, text: 'Collect 20 animal products' },
    { id: 'q-d', kind: 'days', n: 3, reward: 3, text: 'Run the farm for 3 days' }, { id: 'q-t', kind: 'tech', n: 1, reward: 3, text: 'Research a technology' },
    { id: 'q-m', kind: 'earned', n: 2000, reward: 2, text: 'Earn 2,000 credits' }, { id: 'q-e', kind: 'expansions', n: 1, reward: 4, text: 'Expand the field' },
  ];

  const CAST = {
    juno: { name: 'Juno', skin: '#e8b890', hair: '#7a4a1a', cloth: '#5a8a3a', trim: '#ffd75a', eyes: '#2a3a2a', head: 'cap' },
    reyes: { name: 'Dr. Reyes', skin: '#8a5a3a', hair: '#1a1410', cloth: '#f4f4f8', trim: '#5ad0ff', eyes: '#1a1a1a', head: 'goggles' },
    spud: { name: 'SPUD', trim: '#ffb03a', draw(g, k) {
      k.E(16, 20, 12, 12, '#a87a4a'); k.E(16, 19, 10, 10, '#c89a6a'); k.E(12, 18, 2.5, 2.5, '#1a2a3a'); k.E(20, 18, 2.5, 2.5, '#1a2a3a');
      k.E(12, 18, 1, 1, '#7affd8'); k.E(20, 18, 1, 1, '#7affd8'); k.R(13, 24, 6, 1, '#5a3a1a'); k.R(15, 4, 2, 6, '#5a6a7a'); k.E(16, 4, 3, 2, '#7ae08a'); } },
    krell: { name: 'Baron Krell', foe: true, skin: '#d8b8a0', hair: '#3a3a42', cloth: '#2a2a3a', trim: '#ff5a5a', eyes: '#1a1a1a', head: 'crown' },
  };
  const S = (who, text) => ({ who, text });
  const scenes = {
    prologue: { title: 'Arrival', lines: [
      S('reyes', 'Welcome to Kepler Fields, Juno. The soil is thin, the nights are long and the colony is hungry.'),
      S('juno', 'Then we grow. Seeds, water, patience.'),
      S('spud', 'SPUD online. I can plant, water and carry. I cannot dance. Yet.'),
      S('krell', 'A farm? On my company\'s land? Enjoy it while it lasts, settler.'),
      S('juno', 'Your company sold this land to the colony, Baron. Go and mine an asteroid.')] },
    harvest: { title: 'First Harvest', lines: [S('spud', 'First crop harvested! Weight: excellent. Smell: also excellent.'), S('reyes', 'Sell what you do not need. The market likes fresh produce.')] },
    expand: { title: 'More Land', lines: [S('juno', 'More fields! The farm is growing.'), S('krell', 'Every acre you plough is an acre I cannot drill. Noted.')] },
    storm: { title: 'The First Storm', lines: [S('reyes', 'Storm warning! Dust and thunder - check the crops and the pens.'), S('spud', 'Recommendation: stay indoors. I will stay outdoors. I am waterproof.')] },
    week4: { title: 'Week Four', lines: [S('reyes', 'Four weeks. The colony eats your bread every morning now.'), S('juno', 'Then let us plant more. And maybe some flowers.')] },
    million: { title: 'Millionaire', lines: [S('krell', 'A million credits... from cabbages?! Fine. FINE. I will buy my vegetables from you.'), S('juno', 'Delivery is extra, Baron.'), S('spud', 'I can deliver. I still cannot dance.')] },
  };

  const pause = () => { NS.state.hold = true; };
  const resume = () => { NS.state.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'space-farming', cast: CAST, scenes, pause, resume }) : null;

  function applyPaint(id) {
    const p = PAINTS.find(x => x.id === id);
    NS.fencePaint = !p || id === 'wood' ? null : p.colors;
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'space-farming', title: 'Space Farming', accent: '#7ae08a', currency: 'credits x50',
    pay: n => { const G = NS.state; if (typeof G.credits === 'number') G.credits += n * 50; },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: PAINTS, cosmeticLabel: 'Fence paint', cosmeticPlural: 'Fence paints', onEquip: applyPaint,
    tokens: { harvests: 0.5, produce: 0.5, days: 10, expansions: 25, tech: 10 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }

  function onStart() { if (story) story.play('prologue'); }
  function onHarvest() { deed('harvests', 1); if (story) story.play('harvest'); }
  function onProduce(n) { deed('produce', n || 1); }
  function onDay(day) { deed('days', 1); if (story && day >= 28) story.play('week4'); }
  function onExpand() { deed('expansions', 1); if (story) story.play('expand'); }
  function onTech() { deed('tech', 1); }
  function onEarn(n) {
    deed('earned', n);
    if (story && goals && goals.state.stats.earned >= 1000000) story.play('million');
  }
  function onStorm() { if (story) story.play('storm'); }

  NS.meta = { goals, story, PAINTS, deed, onStart, onHarvest, onProduce, onDay, onExpand, onTech, onEarn, onStorm,
    open: tab => goals && goals.open(tab) };
})();
