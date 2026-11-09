/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements, daily
   quests, the streak and the festival track paying coins, aprons earned by deeds and festivals
   (the chef's apron colour), and the career told by a cast - the young chef Sunny, the old cook
   Nonna Rosa who taught her, the food critic Margot Vane and the rival chef Gaston Grille: a
   prologue, an opening at every venue and a finale. Scenes hold the kitchen (G.hold). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});

  const AP = (id, name, c, b, unlock) => ({ id, name, colors: [c, b], unlock });
  const APRONS = [
    AP('classic', 'Linen', '#dcd2bc', '#b8ac94', { kind: 'free' }),
    AP('cherry', 'Cherry', '#e84a5a', '#ffd0d8', { kind: 'stat', stat: 'served', n: 200, text: 'Serve 200 guests' }),
    AP('mint', 'Mint', '#7ae0b0', '#e0fff0', { kind: 'stat', stat: 'perfect', n: 100, text: 'Serve 100 perfect dishes' }),
    AP('denim', 'Denim', '#3a5a8a', '#a8c0e0', { kind: 'stat', stat: 'days', n: 15, text: 'Finish 15 days' }),
    AP('noir', 'Noir', '#2a2a32', '#ffd75a', { kind: 'stat', stat: 'stars', n: 60, text: 'Earn 60 career stars' }),
    AP('gold', 'Golden Toque', '#ffd75a', '#fff2b0', { kind: 'stat', stat: 'combo', n: 15, text: 'Reach a 15-dish combo' }),
    AP('fest-frost', 'Frostfall', '#bff4ff', '#ffffff', { kind: 'festival', id: 'frost' }),
    AP('fest-bloom', 'Bloom', '#ff9ad0', '#7ae08a', { kind: 'festival', id: 'bloom' }),
    AP('fest-sunfest', 'Sunfest', '#ffc23a', '#ff8a2a', { kind: 'festival', id: 'sunfest' }),
    AP('fest-harvest', 'Harvest', '#c8702a', '#ffe0a0', { kind: 'festival', id: 'harvest' }),
    AP('fest-hollow', 'Hollow Night', '#ff7a1a', '#4a1a6a', { kind: 'festival', id: 'hollow' }),
    AP('fest-starfall', 'Starfall', '#2a2a7a', '#ffd23a', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('s1', 'Order Up!', 'served', 1, 1, 'Serve a guest'), A('s200', 'Busy Kitchen', 'served', 200, 4, 'Serve 200 guests'), A('s2000', 'Restaurateur', 'served', 2000, 10, 'Serve 2,000 guests'),
    A('p1', 'Chef\'s Kiss', 'perfect', 1, 1, 'Serve a perfect dish'), A('p250', 'Perfectionist', 'perfect', 250, 6, 'Serve 250 perfect dishes'),
    A('d1', 'Opening Night', 'days', 1, 2, 'Finish a day'), A('d30', 'Full Season', 'days', 30, 8, 'Finish 30 days'),
    A('st30', 'Rising Star', 'stars', 30, 4, 'Earn 30 career stars'), A('st90', 'Michelin Dreams', 'stars', 90, 10, 'Earn all 90 career stars'),
    A('c10', 'In the Zone', 'combo', 10, 3, 'Reach a 10-dish combo'), A('c25', 'Unstoppable', 'combo', 25, 8, 'Reach a 25-dish combo'),
    A('t10k', 'Big Tipper', 'earned', 10000, 4, 'Earn 10,000 in tips'), A('t100k', 'Empire', 'earned', 100000, 10, 'Earn 100,000 in tips'),
    A('dl1', 'Daily Special', 'dailies', 1, 2, 'Play a Daily Special'), A('dl10', 'Regular Specials', 'dailies', 10, 6, 'Play 10 Daily Specials'),
    A('sk7', 'Seven Services', 'bestStreak', 7, 5, 'Play seven days in a row'), A('q10', 'Prep List', 'quests', 10, 4, 'Complete 10 daily quests'),
    A('f1', 'Festival Menu', 'festivals', 1, 5, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-s', kind: 'served', n: 30, reward: 2, text: 'Serve 30 guests' }, { id: 'q-p', kind: 'perfect', n: 15, reward: 3, text: 'Serve 15 perfect dishes' },
    { id: 'q-d', kind: 'days', n: 2, reward: 3, text: 'Finish 2 days' }, { id: 'q-st', kind: 'stars', n: 3, reward: 3, text: 'Earn 3 career stars' },
    { id: 'q-e', kind: 'earned', n: 1500, reward: 2, text: 'Earn 1,500 in tips' }, { id: 'q-dl', kind: 'dailies', n: 1, reward: 3, text: 'Play the Daily Special' },
  ];

  const CAST = {
    sunny: { name: 'Chef Sunny', skin: '#f0c8a0', hair: '#c04a2a', cloth: '#f4f4f8', trim: '#ff9a3a', eyes: '#2a3a2a', head: 'chef' },
    rosa: { name: 'Nonna Rosa', skin: '#e0b090', hair: '#d8d8e0', cloth: '#7a3a3a', trim: '#ffd0a0', eyes: '#3a2a1a', head: 'hood' },
    margot: { name: 'Margot Vane', skin: '#c88a5a', hair: '#1a1410', cloth: '#2a2a3a', trim: '#e8e8f0', eyes: '#1a1a1a', head: 'cap' },
    gaston: { name: 'Gaston Grille', foe: true, skin: '#e8b890', hair: '#2a1a0e', cloth: '#1e1e26', trim: '#ff5a5a', eyes: '#1a1a1a', head: 'chef' },
  };
  const S = (who, text) => ({ who, text });
  const VENUE = {
    truck: [S('rosa', 'A food truck! Every great kitchen starts on four wheels.'), S('sunny', 'Burgers, salads and tacos. Let us feed the street.')],
    diner: [S('sunny', 'The Corner Diner. Pancakes and pasta and the morning rush.'), S('gaston', 'A diner? How... charming. My bistro opens across the road.')],
    bistro: [S('margot', 'Le Bistro. I shall be dining. I shall be taking notes.'), S('rosa', 'Do not cook for the critic, cara. Cook for the guest.')],
    sushi: [S('sunny', 'Sakura Bar. Fresh fish, sharp knives, steady hands.'), S('gaston', 'Sushi, ramen, curry... spreading yourself thin, little chef?')],
    hotel: [S('margot', 'The Grand Hotel. The finest kitchen in the city. Impress me.'), S('gaston', 'This kitchen should have been mine.'), S('sunny', 'Then come and taste why it is not.')],
  };
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('rosa', 'Sunny, my kitchen has taught you everything I know. Now go and cook for the city.'),
      S('sunny', 'One truck, three recipes and a lot of hungry people. I am ready, Nonna.'),
      S('gaston', "A food truck? Ha! The city eats at Gaston's or it does not eat at all."),
      S('margot', 'The city eats where the food is good. I will be the judge of that.'),
      S('rosa', 'Hot pans, cool head. Andiamo!')] },
    finale: { title: 'Finale', lines: [
      S('margot', 'Three stars at the Grand Hotel. Write that down, someone.'),
      S('gaston', 'Fine. FINE. ...Could I have the recipe for that cake?'),
      S('rosa', 'From a truck to the finest kitchen in the city. I am so proud, cara.'),
      S('sunny', 'Endless Rush tomorrow. The ovens never really cool down.')] },
  };
  for (const v in VENUE) scenes['venue-' + v] = { title: 'Opening: ' + v, lines: VENUE[v] };

  const pause = () => { NS.state.hold = true; };
  const resume = () => { NS.state.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'cooking-game', cast: CAST, scenes, pause, resume }) : null;

  function applyApron(id) {
    const a = APRONS.find(x => x.id === id);
    if (SZ.PeopleArt && SZ.PeopleArt.setApron) SZ.PeopleArt.setApron(a ? a.colors[0] : null);
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'cooking-game', title: 'Cooking Game', accent: '#ff9a3a', currency: 'coins x20',
    pay: n => { const G = NS.state; if (G.save) { G.save.coins += n * 20; if (NS.persist && NS.persist.writeSave) NS.persist.writeSave(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: APRONS, cosmeticLabel: 'Apron', onEquip: applyApron,
    tokens: { served: 0.6, perfect: 0.6, days: 15, stars: 5, dailies: 20 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }
  function record(stat, v) { if (goals) goals.record(stat, v); }

  function onDay(G) {
    if (!story || G.mode !== 'career' || !G.dayInfo) return;
    const id = String(G.dayInfo.id || '');
    if (/-1$/.test(id)) {
      if (id === '1-1') story.play('prologue');
      story.play('venue-' + G.dayInfo.location);
    }
  }
  function onServe(quality, combo) {
    deed('served', 1);
    if (quality === 'perfect') deed('perfect', 1);
    record('combo', combo || 0);
  }
  function onDayEnd(G) {
    const r = G.dayResult || {};
    deed('days', 1);
    if (r.earned) deed('earned', r.earned);
    if (r.stars) deed('stars', r.stars);
    if (G.mode === 'daily') deed('dailies', 1);
    if (story && G.mode === 'career' && G.dayInfo && G.dayInfo.id === '5-6' && r.stars >= 1) story.play('finale');
  }

  NS.meta = { goals, story, APRONS, deed, onDay, onServe, onDayEnd, open: tab => goals && goals.open(tab) };
})();
