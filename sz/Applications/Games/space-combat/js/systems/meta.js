/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements,
   daily quests, the streak and the festival track paying credits, liveries earned by deeds and
   festivals (painted over the hangar skin), and the campaign told by a cast - Commander Vega,
   the pilot Wren, Doc Okafor in the hangar and the Overmind behind the swarm: a prologue, an
   arrival in every sector, a word from every boss and a finale. Story scenes hold the
   simulation (G.hold) instead of opening the pause menu. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;

  const L = (id, name, hull, dark, trim, glow, unlock) => ({ id, name, colors: [hull, dark, trim, glow], unlock });
  const LIVERIES = [
    L('none', 'Hangar skin', '#c9d6e8', '#4a5872', '#2f8cff', '#7fd4ff', { kind: 'free' }),
    L('ace', 'Ace Crimson', '#e84a4a', '#5a1a1a', '#ffd75a', '#ffb07a', { kind: 'stat', stat: 'kills', n: 2000, text: 'Destroy 2,000 enemies' }),
    L('ghost', 'Ghost', '#e8ecf4', '#9aa6bc', '#5ad0ff', '#c8f4ff', { kind: 'stat', stat: 'missions', n: 15, text: 'Win 15 missions' }),
    L('hunter', 'Boss Hunter', '#3a2a1a', '#160e08', '#ff9a2a', '#ffd27a', { kind: 'stat', stat: 'bosses', n: 5, text: 'Destroy 5 bosses' }),
    L('void', 'Void Walker', '#1e1430', '#0a0614', '#c04cff', '#e8a8ff', { kind: 'stat', stat: 'bestWave', n: 20, text: 'Reach endless wave 20' }),
    L('gold', 'Gilded', '#ffd75a', '#8a5e14', '#fff2b0', '#fff2b0', { kind: 'stat', stat: 'stars', n: 60, text: 'Hold 60 mission stars' }),
    L('fest-frost', 'Frostfall', '#eaf8ff', '#7ab0d0', '#bff4ff', '#ffffff', { kind: 'festival', id: 'frost' }),
    L('fest-bloom', 'Bloom', '#ffd0e8', '#a05a7a', '#7ae08a', '#ffe0f0', { kind: 'festival', id: 'bloom' }),
    L('fest-sunfest', 'Sunfest', '#ffe07a', '#a05a1a', '#ff8a2a', '#fff2b0', { kind: 'festival', id: 'sunfest' }),
    L('fest-harvest', 'Harvest', '#c8803a', '#4a2a10', '#ffd23a', '#ffe0a0', { kind: 'festival', id: 'harvest' }),
    L('fest-hollow', 'Hollow Night', '#ff7a1a', '#2a0a3a', '#8a3ad8', '#ffb070', { kind: 'festival', id: 'hollow' }),
    L('fest-starfall', 'Starfall', '#2a2a6a', '#0e0e2a', '#ffd23a', '#fff2a0', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('k1', 'First Kill', 'kills', 1, 1, 'Destroy an enemy'), A('k500', 'Squadron Breaker', 'kills', 500, 3, 'Destroy 500 enemies'), A('k5000', 'Ace of Aces', 'kills', 5000, 8, 'Destroy 5,000 enemies'),
    A('b1', 'Giant Killer', 'bosses', 1, 3, 'Destroy a boss'), A('b10', 'Titan Slayer', 'bosses', 10, 8, 'Destroy 10 bosses'),
    A('m1', 'Mission Accomplished', 'missions', 1, 1, 'Win a mission'), A('m10', 'Veteran', 'missions', 10, 3, 'Win 10 missions'), A('m30', 'Hero of the Fleet', 'missions', 30, 8, 'Win 30 missions'),
    A('s30', 'Decorated', 'stars', 30, 4, 'Hold 30 mission stars'), A('s90', 'Full Ribbon Bar', 'stars', 90, 10, 'Hold all 90 mission stars'),
    A('w10', 'Holding Out', 'bestWave', 10, 3, 'Reach endless wave 10'), A('w30', 'Last Stand', 'bestWave', 30, 8, 'Reach endless wave 30'),
    A('sc100k', 'High Score', 'bestScore', 100000, 4, 'Score 100,000 in one run'), A('sc500k', 'Legend', 'bestScore', 500000, 8, 'Score 500,000 in one run'),
    A('d1', 'Daily Sortie', 'dailies', 1, 1, 'Fly a Daily'), A('d10', 'On Rotation', 'dailies', 10, 4, 'Fly 10 Dailies'),
    A('st7', 'Week on Duty', 'bestStreak', 7, 5, 'Play seven days in a row'), A('q10', 'Orders Received', 'quests', 10, 4, 'Complete 10 daily quests'), A('f1', 'Festival Flyby', 'festivals', 1, 5, 'Finish a festival track'),
    A('r25', 'Frequent Flyer', 'runs', 25, 3, 'Finish 25 runs'),
  ];
  const QUESTS = [
    { id: 'q-k', kind: 'kills', n: 150, reward: 2, text: 'Destroy 150 enemies' }, { id: 'q-k2', kind: 'kills', n: 400, reward: 3, text: 'Destroy 400 enemies' },
    { id: 'q-m', kind: 'missions', n: 2, reward: 3, text: 'Win 2 missions' }, { id: 'q-b', kind: 'bosses', n: 1, reward: 4, text: 'Destroy a boss' },
    { id: 'q-r', kind: 'runs', n: 3, reward: 2, text: 'Finish 3 runs' }, { id: 'q-d', kind: 'dailies', n: 1, reward: 3, text: 'Fly the Daily' },
  ];

  const CAST = {
    vega: { name: 'Commander Vega', skin: '#c88a5a', hair: '#1e1a14', cloth: '#2a3a6a', trim: '#ffd75a', eyes: '#1e2a3a', head: 'cap' },
    wren: { name: 'Wren', skin: '#f0c8a0', hair: '#e8d070', cloth: '#3a4a5a', trim: '#5ad0ff', eyes: '#2a4a6a', head: 'visor' },
    doc: { name: 'Doc Okafor', skin: '#7a4a2a', hair: '#2a1a0e', cloth: '#6a6a7a', trim: '#7fd4ff', eyes: '#1a1a1a', head: 'goggles' },
    overmind: { name: 'The Overmind', foe: true, trim: '#c04cff', draw(g, k) {
      k.E(16, 18, 14, 14, '#2a0a3a'); k.E(16, 17, 11, 11, '#5a1a7a'); k.E(16, 16, 7, 7, '#c04cff'); k.E(16, 16, 3.5, 3.5, '#fff0ff');
      for (let i = 0; i < 6; ++i) { const a = i / 6 * Math.PI * 2; k.E(16 + Math.cos(a) * 12, 18 + Math.sin(a) * 12, 2, 2, '#8a3ad8'); } } },
    boss: { name: 'Boss', foe: true, trim: '#ff5c6c', draw(g, k) {
      k.P([16, 2, 30, 14, 26, 30, 6, 30, 2, 14], '#4a1a1a'); k.P([16, 6, 26, 15, 23, 27, 9, 27, 6, 15], '#8a2a2a');
      k.E(11, 16, 2.5, 2, '#ffda3a'); k.E(21, 16, 2.5, 2, '#ffda3a'); k.R(12, 22, 8, 2, '#ff5c6c'); } },
  };
  const S = (who, text, name) => (name ? { who, text, name } : { who, text });
  const SECTOR_IN = [
    [S('vega', 'Kepler Reach. Our outposts went silent one by one. Find out why, Wren.'), S('wren', 'Copy. Weapons hot.')],
    [S('doc', 'The Crimson Expanse eats sensors. Trust your eyes, not your scope.'), S('wren', 'Something big is moving in the red.')],
    [S('vega', 'Helios Corona. Shields will cook out there - keep moving.'), S('overmind', 'The sun belongs to me. As will you.')],
    [S('doc', 'The Abyss Rift. Gravity wells everywhere. I patched the thrusters twice.'), S('wren', 'Then let us not need a third time.')],
    [S('vega', 'The Void Citadel. Everything leads here. End it, pilot.'), S('overmind', 'You are a spark in an endless night, little pilot.')],
  ];
  const BOSS_LINE = [
    [S('boss', 'The Warden holds this orbit. None pass.', 'Warden'), S('wren', 'Watch me.')],
    [S('boss', 'The Hydra has many heads. You have one ship.', 'Hydra'), S('doc', 'Hit the joints between the segments!')],
    [S('boss', 'Solaris burns. Solaris consumes.', 'Solaris'), S('vega', 'Its armour vents heat - shoot when the plates open!')],
    [S('boss', 'The Maw is hungry...', 'The Maw'), S('wren', 'Stay out of the pull. Stay out of the pull!')],
    [S('overmind', 'Then face me yourself.'), S('vega', 'All squadrons - cover Wren. This is it.')],
  ];
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('vega', 'Pilot Wren, report. Five sectors have gone dark and the fleet is spread thin.'),
      S('wren', 'Ready, Commander. What are we flying into?'),
      S('doc', 'A swarm that learns. I strapped everything I could find to your hull.'),
      S('overmind', 'One more ship. One more spark. I have swallowed suns.'),
      S('vega', 'Then let us give it something it cannot swallow. Launch.')] },
    finale: { title: 'Finale', lines: [
      S('overmind', 'The swarm... is... quiet...'),
      S('vega', 'All sectors report clear. You did it, Wren.'),
      S('doc', 'And you even brought the ship back. Mostly.'),
      S('wren', 'Keep the coffee warm. The endless patrol starts tomorrow.')] },
  };
  for (let i = 0; i < 5; ++i) {
    scenes['sector-' + i] = { title: 'Sector ' + (i + 1) + ': arrival', lines: SECTOR_IN[i] };
    scenes['boss-' + i] = { title: 'Sector ' + (i + 1) + ': boss', lines: BOSS_LINE[i] };
  }

  const pause = () => { G.hold = true; };
  const resume = () => { G.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'space-combat', cast: CAST, scenes, pause, resume }) : null;

  let livery = null;
  function applyLivery(id) {
    const l = LIVERIES.find(x => x.id === id);
    livery = !l || id === 'none' ? null : { hull: l.colors[0], dark: l.colors[1], trim: l.colors[2], glow: l.colors[3], key: id };
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'space-combat', title: 'Space Combat', accent: '#4fc3ff', currency: 'credits x50',
    pay: n => { if (G.save) { G.save.credits += n * 50; if (NS.save && NS.save.save) NS.save.save(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: LIVERIES, cosmeticLabel: 'Livery', onEquip: applyLivery,
    tokens: { kills: 0.1, missions: 15, bosses: 20, dailies: 20 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }
  function record(stat, v) { if (goals) goals.record(stat, v); }

  function onKill(e) {
    deed('kills', 1);
  }
  function onBoss(b) {
    if (story && b && b.def && typeof b.def.sector === 'number') story.play('boss-' + b.def.sector);
  }
  function onBossDown() { deed('bosses', 1); }
  function onStage(st, run) {
    if (!story || !run || run.mode !== 'campaign' || !st) return;
    if (st.sector === 0 && st.index === 0) story.play('prologue');
    if (st.index === 0) story.play('sector-' + st.sector);
  }
  function onFinish(res) {
    deed('runs', 1);
    if (res.won && res.mode === 'campaign') deed('missions', 1);
    if (res.mode === 'daily') deed('dailies', 1);
    record('bestScore', res.score || 0);
    if (G.run && G.run.mode === 'endless') record('bestWave', G.run.cleared || 0);
    if (G.save && G.save.stars) record('stars', Object.keys(G.save.stars).reduce((a, k) => a + (G.save.stars[k] || 0), 0));
    if (story && res.won && res.mode === 'campaign' && res.stage && res.stage.sector === 4 && res.stage.index === 5) story.play('finale');
  }

  NS.meta = { goals, story, LIVERIES, deed, record, onKill, onBoss, onBossDown, onStage, onFinish,
    livery: () => livery, open: tab => goals && goals.open(tab) };
})();
