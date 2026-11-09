/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements,
   daily quests, the streak and the festival track paying iron (into the running dig, or banked for
   the next one), dome skins that recolour the glass and its rim, the Daily Run (the same first
   site and twist for everyone all day, the most nights kept) and the story - Keeper Ada, her drone
   PIP and the Swarm Mother - told at the landing, the first night, every new biome, the first time
   the glass cracks and the first fall. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const BANK = 'sz-dome-keeper-bank';

  const SKINS = [
    { id: 'classic', name: 'Cobalt Glass', colors: ['#9adcff', '#3a8ae8', '#1a4aa0'], unlock: { kind: 'free' } },
    { id: 'emerald', name: 'Emerald', colors: ['#a8ffc8', '#2ec870', '#147a3a'], unlock: { kind: 'stat', stat: 'nights', n: 15, text: 'Survive 15 nights' } },
    { id: 'amber', name: 'Amber', colors: ['#ffe2a0', '#e8a030', '#8a5010'], unlock: { kind: 'stat', stat: 'tiles', n: 1500, text: 'Mine 1,500 tiles' } },
    { id: 'crimson', name: 'Crimson', colors: ['#ffb0a8', '#e83a3a', '#7a1010'], unlock: { kind: 'stat', stat: 'kills', n: 1000, text: 'Defeat 1,000 monsters' } },
    { id: 'violet', name: 'Violet', colors: ['#e0c0ff', '#9a5ae8', '#4a1a8a'], unlock: { kind: 'stat', stat: 'sites', n: 5, text: 'Relocate 5 times' } },
    { id: 'gold', name: 'Gilded', colors: ['#fff2b0', '#ffd75a', '#a0700a'], unlock: { kind: 'stat', stat: 'chests', n: 15, text: 'Open 15 secret chests' } },
    { id: 'obsidian', name: 'Obsidian', colors: ['#b0a0c8', '#3a2a50', '#120a1e'], unlock: { kind: 'stat', stat: 'bestNights', n: 40, text: 'Survive 40 nights in one dig' } },
    { id: 'fest-frost', name: 'Frostfall', colors: ['#ffffff', '#bff4ff', '#5aa0d8'], unlock: { kind: 'festival', id: 'frost' } },
    { id: 'fest-bloom', name: 'Bloom', colors: ['#ffe0f0', '#ff9ad0', '#7ae08a'], unlock: { kind: 'festival', id: 'bloom' } },
    { id: 'fest-sunfest', name: 'Sunfest', colors: ['#fff6c0', '#ffd23a', '#ff8a2a'], unlock: { kind: 'festival', id: 'sunfest' } },
    { id: 'fest-harvest', name: 'Harvest', colors: ['#ffd8a0', '#e0902a', '#7a4a1a'], unlock: { kind: 'festival', id: 'harvest' } },
    { id: 'fest-hollow', name: 'Hollow Night', colors: ['#ffb070', '#ff7a1a', '#4a1a6a'], unlock: { kind: 'festival', id: 'hollow' } },
    { id: 'fest-starfall', name: 'Starfall', colors: ['#fff2a0', '#6a6ad8', '#1a1a5a'], unlock: { kind: 'festival', id: 'starfall' } },
  ];

  const TWISTS = [
    { id: 'swarm', name: 'Swarm Nights', text: '40% more monsters every night', dome: 1, swarm: 1.4, ore: 1 },
    { id: 'thin', name: 'Thin Glass', text: 'The dome starts with 60% of its strength', dome: 0.6, swarm: 1, ore: 1 },
    { id: 'rich', name: 'Rich Veins', text: 'Ore is worth 50% more, nights are 20% busier', dome: 1, swarm: 1.2, ore: 1.5 },
    { id: 'lean', name: 'Lean Rock', text: 'Ore is worth 30% less', dome: 1, swarm: 1, ore: 0.7 },
  ];
  const NONE = { dome: 1, swarm: 1, ore: 1 };

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('k1', 'First Swat', 'kills', 1, 2, 'Defeat a monster'), A('k250', 'Exterminator', 'kills', 250, 5, 'Defeat 250 monsters'), A('k2500', 'Hive Breaker', 'kills', 2500, 10, 'Defeat 2,500 monsters'),
    A('n1', 'First Dawn', 'nights', 1, 2, 'Survive a night'), A('n25', 'Night Owl', 'nights', 25, 5, 'Survive 25 nights'), A('n150', 'Eternal Vigil', 'nights', 150, 12, 'Survive 150 nights'),
    A('bn10', 'Ten Dawns', 'bestNights', 10, 4, 'Survive 10 nights in one dig'), A('bn30', 'Unbroken', 'bestNights', 30, 10, 'Survive 30 nights in one dig'),
    A('t100', 'Pickaxe', 'tiles', 100, 2, 'Mine 100 tiles'), A('t2000', 'Tunneler', 'tiles', 2000, 6, 'Mine 2,000 tiles'), A('t10k', 'Mole King', 'tiles', 10000, 12, 'Mine 10,000 tiles'),
    A('s1', 'Moving Out', 'sites', 1, 3, 'Relocate the dome'), A('s10', 'Nomad', 'sites', 10, 8, 'Relocate 10 times'), A('bs4', 'Fourth Sky', 'bestSite', 4, 8, 'Reach the fourth site in one dig'),
    A('u10', 'Engineer', 'upgrades', 10, 3, 'Buy 10 upgrades'), A('u100', 'Architect', 'upgrades', 100, 8, 'Buy 100 upgrades'),
    A('c1', 'Treasure!', 'chests', 1, 3, 'Open a secret chest'), A('c25', 'Vault Cracker', 'chests', 25, 8, 'Open 25 secret chests'),
    A('r10', 'Stubborn', 'runs', 10, 4, 'Finish 10 digs'), A('d1', 'Daily Digger', 'dailies', 1, 2, 'Play a Daily Run'), A('d10', 'Regular', 'dailies', 10, 6, 'Play 10 Daily Runs'),
    A('st7', 'Seven Days', 'bestStreak', 7, 6, 'Play seven days in a row'), A('q10', 'Errands', 'quests', 10, 5, 'Complete 10 daily quests'), A('f1', 'Festive Glass', 'festivals', 1, 6, 'Finish a festival track'),
    A('sc50k', 'High Scorer', 'bestScore', 50000, 6, 'Score 50,000 in one dig'),
  ];
  const QUESTS = [
    { id: 'q-kills', kind: 'kills', n: 60, reward: 3, text: 'Defeat 60 monsters' }, { id: 'q-nights', kind: 'nights', n: 5, reward: 3, text: 'Survive 5 nights' },
    { id: 'q-tiles', kind: 'tiles', n: 250, reward: 3, text: 'Mine 250 tiles' }, { id: 'q-upgrades', kind: 'upgrades', n: 5, reward: 3, text: 'Buy 5 upgrades' },
    { id: 'q-site', kind: 'sites', n: 1, reward: 4, text: 'Relocate the dome' }, { id: 'q-chest', kind: 'chests', n: 1, reward: 4, text: 'Open a secret chest' },
    { id: 'q-daily', kind: 'dailies', n: 1, reward: 3, text: 'Play the Daily Run' },
  ];

  const CAST = {
    ada: { name: 'Keeper Ada', skin: '#e8b890', hair: '#c04a2a', cloth: '#d87a2a', trim: '#4af', eyes: '#2a3a5a', head: 'visor' },
    pip: { name: 'PIP', trim: '#6f6', draw(g, k) {
      k.E(16, 30, 13, 7, '#3a4a5a'); k.E(16, 18, 11, 10, '#8a9aaa'); k.E(16, 17, 9, 8, '#b8c8d8');
      k.R(9, 14, 14, 6, '#1a2a3a'); k.R(11, 16, 4, 2, '#6f6'); k.R(18, 16, 4, 2, '#6f6');
      k.R(15, 4, 2, 5, '#5a6a7a'); k.E(16, 4, 2.5, 2.5, '#ff5a5a'); k.R(13, 22, 6, 1, '#5a6a7a'); } },
    mother: { name: 'The Swarm Mother', foe: true, trim: '#ff5a8a', draw(g, k) {
      k.E(16, 30, 15, 8, '#3a1a3a'); k.E(16, 17, 12, 11, '#5a2a5a'); k.E(16, 15, 10, 8, '#7a3a7a');
      k.P([5, 12, 1, 2, 9, 9], '#9a4a9a'); k.P([27, 12, 31, 2, 23, 9], '#9a4a9a');
      k.E(11, 15, 2.5, 2, '#ffda3a'); k.E(21, 15, 2.5, 2, '#ffda3a'); k.E(16, 11, 2, 1.5, '#ffda3a');
      k.P([10, 22, 16, 27, 22, 22, 19, 24, 16, 22, 13, 24], '#2a0a2a'); } },
  };
  const BIOME_LINE = {
    rocky: 'Rocky badlands. Plenty of iron, plenty of places for things to hide.',
    desert: 'Dunes as far as the scanners reach. The glass will get hot.',
    ice: 'A frozen shelf. Water everywhere - if we can dig it out.',
    jungle: 'Alien jungle. The roots go deeper than our shafts.',
    volcanic: 'An ashen caldera. Cobalt glows in the cracks. So do the eyes.',
    crystal: 'Crystal fields. Everything sings here. Even them.',
  };
  const scenes = {
    landing: { title: 'Landing', lines: [
      { who: 'pip', text: 'Touchdown confirmed. Dome deployed. Oxygen nominal. Good morning, Keeper.' },
      { who: 'ada', text: 'Morning, PIP. What does the planet have for us?' },
      { who: 'pip', text: 'Iron below. Water deeper. And seismic chatter that rises every night.' },
      { who: 'mother', text: 'Another shell of glass on my world. My children are hungry.' },
      { who: 'ada', text: 'Dig by day, hold the dome by night. Let us get to work.' }] },
    night1: { title: 'The First Night', lines: [
      { who: 'pip', text: 'Sun is down. Movement on every side. Get back to the dome!' },
      { who: 'ada', text: 'Turret online. Come on, then.' }] },
    crack: { title: 'Cracked Glass', lines: [
      { who: 'pip', text: 'Dome integrity critical! Repairs in the upgrade tree - please hurry.' },
      { who: 'mother', text: 'I hear it splintering. Such a lovely sound.' }] },
    fall: { title: 'The Fall', lines: [
      { who: 'pip', text: 'The dome is down. Emergency lift engaged.' },
      { who: 'ada', text: 'We will be back. With thicker glass.' },
      { who: 'mother', text: 'Come back, little keeper. The nest remembers you.' }] },
  };
  for (const b in BIOME_LINE)
    scenes['site-' + b] = { title: 'New site: ' + b, lines: [{ who: 'pip', text: BIOME_LINE[b] }, { who: 'ada', text: 'Find the relocation core, keep the glass whole. Same as always.' }] };

  let pausedByUs = false;
  function pause() {
    if (G.state === 'PLAYING') { G.state = 'PAUSED'; pausedByUs = true; }
  }
  function resume() {
    if (pausedByUs && G.state === 'PAUSED') G.state = 'PLAYING';
    pausedByUs = false;
  }

  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'dome-keeper', cast: CAST, scenes, pause, resume }) : null;

  function applySkin(id) {
    const s = SKINS.find(x => x.id === id) || SKINS[0];
    NS.domeSkin = id === 'classic' ? null : { rim: s.colors, glass: s.colors[2] };
  }

  function pay(n) {
    const iron = n * 10;
    if (G.resources && (G.state === 'PLAYING' || G.state === 'PAUSED' || G.state === 'UPGRADE_DIALOG')) G.resources.iron = (G.resources.iron || 0) + iron;
    else try { localStorage.setItem(BANK, String((+localStorage.getItem(BANK) || 0) + iron)); } catch (_) {}
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'dome-keeper', title: 'Dome Keeper', accent: '#4af', currency: 'iron x10', pay,
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: SKINS, cosmeticLabel: 'Dome skin', onEquip: applySkin,
    tokens: { kills: 0.2, nights: 6, sites: 30, chests: 15, dailies: 20 }, twists: TWISTS, story,
    daily: {
      label: 'Daily Run',
      describe(r) {
        const b = NS.biomes.newSite(0, r.seed & 0x7fffffff).biome;
        return { title: 'Today\'s Daily Run', lines: ['First site: ' + NS.biomes.BIOMES[b].name, 'Everyone digs the same site today. Your most nights survived are kept.'] };
      },
      start(r) {
        G.dailyRun = { day: r.day, seed: r.seed & 0x7fffffff, twist: r.twist };
        NS.persistence.requestNewGame();
      },
    },
    pause, resume,
  }) : null;

  /* ── hooks called by the game ── */
  function deed(kind, n) { if (goals) goals.deed(kind, n); }
  function record(stat, v) { if (goals) goals.record(stat, v); }
  function twist() { return G.dailyRun && G.dailyRun.twist ? G.dailyRun.twist : NONE; }

  function onRunStart() {
    let bank = 0;
    try { bank = +localStorage.getItem(BANK) || 0; localStorage.removeItem(BANK); } catch (_) {}
    if (bank > 0 && G.resources) G.resources.iron = (G.resources.iron || 0) + bank;
    G.cracked = false;
  }
  /* the dig itself begins once the gadget is chosen */
  function onPlayStart() {
    if (story) story.play('landing');
  }
  function onNight() {
    deed('nights', 1);
    record('bestNights', G.waveNumber);
    if (story && G.waveNumber === 1) story.play('night1');
  }
  function onSite() {
    deed('sites', 1);
    record('bestSite', G.site.index + 1);
    if (story) story.play('site-' + G.site.biome);
  }
  function onDomeHit() {
    if (!G.cracked && G.maxDomeHP && G.domeHP > 0 && G.domeHP < G.maxDomeHP * 0.3) {
      G.cracked = true;
      if (story) story.play('crack');
    }
  }
  function onGameOver() {
    deed('runs', 1);
    record('bestScore', G.score);
    if (goals && G.dailyRun) goals.dailyResult(G.waveNumber);
    G.dailyRun = null;
    if (story) story.play('fall');
  }

  NS.meta = { goals, story, SKINS, TWISTS, deed, record, twist, onRunStart, onPlayStart, onNight, onSite, onDomeHit, onGameOver,
    open: tab => goals && goals.open(tab) };
})();
