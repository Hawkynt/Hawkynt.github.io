/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements, daily
   quests, the streak and the festival track paying arcane shards, robes earned by deeds and
   festivals (worn over the robe chosen in the wardrobe), and a story told by a cast - the young
   mage Elian, the archmage Seraphine, the familiar Ember and the Hollow Wraith who drained the
   elements: a prologue, an arrival in every realm and a finale. Scenes hold the puzzle (G.hold). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});

  const R = (id, name, color, b, unlock) => ({ id, name, colors: [color, b], unlock });
  const ROBES = [
    R('none', 'Wardrobe robe', '#5a4ae0', '#3a2a8a', { kind: 'free' }),
    R('ash', 'Ashen Sage', '#6a6a72', '#2a2a30', { kind: 'stat', stat: 'levels', n: 10, text: 'Restore 10 puzzles' }),
    R('tide', 'Tidecaller', '#2a8ad8', '#bfe8ff', { kind: 'stat', stat: 'perfect', n: 5, text: 'Solve 5 puzzles perfectly' }),
    R('stone', 'Earthwarden', '#8a6a3a', '#c9a36a', { kind: 'stat', stat: 'par', n: 15, text: 'Beat par on 15 puzzles' }),
    R('sky', 'Skyweaver', '#c8e8ff', '#5aa0d8', { kind: 'stat', stat: 'casts', n: 400, text: 'Cast 400 spells' }),
    R('star', 'Starlit', '#1e2050', '#ffe680', { kind: 'stat', stat: 'stars', n: 60, text: 'Collect 60 stars' }),
    R('fest-frost', 'Frostfall', '#bff4ff', '#ffffff', { kind: 'festival', id: 'frost' }),
    R('fest-bloom', 'Bloom', '#ff9ad0', '#7ae08a', { kind: 'festival', id: 'bloom' }),
    R('fest-sunfest', 'Sunfest', '#ffc23a', '#ff8a2a', { kind: 'festival', id: 'sunfest' }),
    R('fest-harvest', 'Harvest', '#c8702a', '#ffe0a0', { kind: 'festival', id: 'harvest' }),
    R('fest-hollow', 'Hollow Night', '#ff7a1a', '#4a1a6a', { kind: 'festival', id: 'hollow' }),
    R('fest-starfall', 'Starfall', '#2a2a7a', '#ffd23a', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('l1', 'First Spell', 'levels', 1, 1, 'Solve a puzzle'), A('l15', 'Apprentice', 'levels', 15, 3, 'Solve 15 puzzles'), A('l50', 'Archmage', 'levels', 50, 8, 'Solve 50 puzzles'),
    A('p1', 'Flawless Weave', 'perfect', 1, 2, 'Solve a puzzle perfectly'), A('p20', 'Perfectionist', 'perfect', 20, 6, 'Solve 20 puzzles perfectly'),
    A('par10', 'Economy of Magic', 'par', 10, 3, 'Beat par on 10 puzzles'), A('par40', 'Spare Mana', 'par', 40, 8, 'Beat par on 40 puzzles'),
    A('s30', 'Starlight', 'stars', 30, 3, 'Collect 30 stars'), A('s100', 'Constellation', 'stars', 100, 8, 'Collect 100 stars'),
    A('c100', 'Chanter', 'casts', 100, 2, 'Cast 100 spells'), A('c1000', 'Spellstorm', 'casts', 1000, 6, 'Cast 1,000 spells'),
    A('d1', 'Daily Riddle', 'dailies', 1, 2, 'Solve a Daily puzzle'), A('d10', 'Daily Scholar', 'dailies', 10, 6, 'Solve 10 Daily puzzles'),
    A('st7', 'Seven Moons', 'bestStreak', 7, 5, 'Play seven days in a row'), A('q10', 'Errands of the Tower', 'quests', 10, 4, 'Complete 10 daily quests'),
    A('f1', 'Festive Robes', 'festivals', 1, 5, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-l', kind: 'levels', n: 3, reward: 2, text: 'Solve 3 puzzles' }, { id: 'q-p', kind: 'perfect', n: 1, reward: 3, text: 'Solve a puzzle perfectly' },
    { id: 'q-par', kind: 'par', n: 2, reward: 3, text: 'Beat par on 2 puzzles' }, { id: 'q-c', kind: 'casts', n: 40, reward: 2, text: 'Cast 40 spells' },
    { id: 'q-s', kind: 'stars', n: 4, reward: 2, text: 'Collect 4 stars' }, { id: 'q-d', kind: 'dailies', n: 1, reward: 3, text: 'Solve the Daily puzzle' },
  ];

  const CAST = {
    elian: { name: 'Elian', skin: '#f0c8a0', hair: '#3a2a1e', cloth: '#5a4ae0', trim: '#ffd75a', eyes: '#2a3a6a', head: 'wizard' },
    seraphine: { name: 'Archmage Seraphine', skin: '#d8a070', hair: '#f4f4f8', cloth: '#a03ad0', trim: '#e8d8ff', eyes: '#3a2a5a', head: 'hood' },
    ember: { name: 'Ember', trim: '#ff8a3a', draw(g, k) {
      k.P([16, 2, 26, 16, 24, 28, 8, 28, 6, 16], '#ff5a1a'); k.P([16, 7, 22, 17, 20, 26, 12, 26, 10, 17], '#ffb03a'); k.P([16, 13, 19, 19, 16, 25, 13, 19], '#fff2b0');
      k.E(12, 18, 1.8, 2.2, '#1a1a1a'); k.E(20, 18, 1.8, 2.2, '#1a1a1a'); } },
    wraith: { name: 'The Hollow Wraith', foe: true, trim: '#7affd8', draw(g, k) {
      k.P([4, 34, 8, 10, 16, 2, 24, 10, 28, 34, 22, 28, 16, 34, 10, 28], '#1e2a3a'); k.P([9, 14, 16, 6, 23, 14, 22, 22, 10, 22], '#0a0e18');
      k.E(12, 15, 2.2, 1.6, '#7affd8'); k.E(20, 15, 2.2, 1.6, '#7affd8'); } },
  };
  const S = (who, text) => ({ who, text });
  const REALM_IN = [
    [S('seraphine', 'The Ember Grove. Fire alone answers you here - learn its patience.'), S('ember', 'Patience? I am a flame! But fine.')],
    [S('elian', 'Tide Caverns. Water now, and fire still answers.'), S('wraith', 'The tides are hollow. I drank them dry.')],
    [S('seraphine', 'Stone Peaks. Earth is slow to wake, and slow to forgive a careless cast.'), S('ember', 'Rocks. Lovely. Can I burn them?')],
    [S('elian', 'Sky Ruins. All four elements, and the wind wants to scatter them.'), S('wraith', 'Up here, little mage, every mistake falls a long way.')],
    [S('seraphine', 'The Elemental Sanctum. Restore it and the realms breathe again.'), S('wraith', 'Then come. The last door is the hardest.')],
  ];
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('seraphine', 'Elian. The Hollow Wraith has drained the elements from every realm.'),
      S('elian', 'Then I will weave them back, tile by tile.'),
      S('ember', 'And I will help! Mostly by being warm.'),
      S('wraith', 'A child with a staff. How quaint. Your mana will run out before my emptiness does.'),
      S('seraphine', 'Spend mana wisely. Every spell has a shape. Begin.')] },
    finale: { title: 'Finale', lines: [
      S('wraith', 'The emptiness... fills... no...'),
      S('seraphine', 'Every realm restored. You are an apprentice no longer, Elian.'),
      S('ember', 'Does this mean I get a bigger fireplace?'),
      S('elian', 'It means the Daily riddles start tomorrow. Come on, Ember.')] },
  };
  for (let i = 0; i < 5; ++i) scenes['realm-' + i] = { title: 'Realm ' + (i + 1) + ': arrival', lines: REALM_IN[i] };

  const pause = () => { NS.state.hold = true; };
  const resume = () => { NS.state.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'fantasy-puzzle', cast: CAST, scenes, pause, resume }) : null;

  let robe = null;
  function applyRobe(id) {
    const r = ROBES.find(x => x.id === id);
    robe = !r || id === 'none' ? null : r.colors[0];
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'fantasy-puzzle', title: 'Fantasy Puzzle', accent: '#a03ad0', currency: 'shards',
    pay: n => { const G = NS.state; if (G.save) { G.save.shards += n; if (NS.store && NS.store.writeSave) NS.store.writeSave(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: ROBES, cosmeticLabel: 'Robe', onEquip: applyRobe,
    tokens: { levels: 15, perfect: 10, stars: 4, dailies: 20, casts: 0.3 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }

  function onLevel(G) {
    if (!story || G.levelKind !== 'campaign' || !G.level) return;
    const realm = G.level.realm | 0;
    if (/-1$/.test(String(G.level.id))) {
      if (realm === 0) story.play('prologue');
      story.play('realm-' + realm);
    }
  }
  function onCast() { deed('casts', 1); }
  function onSolved(G, stars, gained, perfect) {
    deed('levels', 1);
    if (perfect) deed('perfect', 1);
    if (G.casts <= G.level.par) deed('par', 1);
    if (gained > 0) deed('stars', gained);
    if (G.sessionMode === 'daily') deed('dailies', 1);
    if (story && G.levelKind === 'campaign' && (G.level.realm | 0) === 4) {
      const list = (SZ.PuzzleLevels && SZ.PuzzleLevels.CAMPAIGN) || [];
      const last = list.filter(l => l.realm === 4).pop();
      if (!last || last.id === G.level.id) story.play('finale');
    }
  }

  NS.meta = { goals, story, ROBES, deed, onLevel, onCast, onSolved, robe: () => robe,
    open: tab => goals && goals.open(tab) };
})();
