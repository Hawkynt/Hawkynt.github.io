/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements,
   daily quests, the streak and the festival track paying credits, ship auras earned by deeds and
   festivals (a coloured glow and spark trail behind the ship), and the campaign told by a cast -
   Captain Rhea, the gunner Kip, the ship's mind LUMEN and the Overmind: a prologue, an arrival in
   every sector, a word before every boss and a finale. Scenes hold the simulation (G.hold). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;

  const AU = (id, name, a, b, unlock) => ({ id, name, colors: [a, b], unlock });
  const AURAS = [
    AU('none', 'No aura', '#3a4256', '#1a2030', { kind: 'free' }),
    AU('plasma', 'Plasma', '#5ad0ff', '#c8f4ff', { kind: 'stat', stat: 'kills', n: 1500, text: 'Destroy 1,500 aliens' }),
    AU('ember', 'Ember', '#ff6a2a', '#ffd27a', { kind: 'stat', stat: 'bosses', n: 3, text: 'Defeat 3 bosses' }),
    AU('venom', 'Venom', '#5aff7a', '#d8ffe0', { kind: 'stat', stat: 'waves', n: 50, text: 'Clear 50 waves' }),
    AU('royal', 'Royal', '#b06aff', '#ffd75a', { kind: 'stat', stat: 'stages', n: 20, text: 'Clear 20 campaign stages' }),
    AU('solar', 'Solar Crown', '#ffd75a', '#fff2b0', { kind: 'stat', stat: 'bestScore', n: 200000, text: 'Score 200,000 in one run' }),
    AU('fest-frost', 'Frostfall', '#bff4ff', '#ffffff', { kind: 'festival', id: 'frost' }),
    AU('fest-bloom', 'Bloom', '#ff9ad0', '#7ae08a', { kind: 'festival', id: 'bloom' }),
    AU('fest-sunfest', 'Sunfest', '#ffd23a', '#ff8a2a', { kind: 'festival', id: 'sunfest' }),
    AU('fest-harvest', 'Harvest', '#e0902a', '#ffe0a0', { kind: 'festival', id: 'harvest' }),
    AU('fest-hollow', 'Hollow Night', '#ff7a1a', '#8a3ad8', { kind: 'festival', id: 'hollow' }),
    AU('fest-starfall', 'Starfall', '#ffd23a', '#6a6ad8', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('k1', 'Contact', 'kills', 1, 1, 'Destroy an alien'), A('k1000', 'Fleet Breaker', 'kills', 1000, 3, 'Destroy 1,000 aliens'), A('k10k', 'Planet Defender', 'kills', 10000, 8, 'Destroy 10,000 aliens'),
    A('w10', 'Wave Rider', 'waves', 10, 2, 'Clear 10 waves'), A('w100', 'Tide Turner', 'waves', 100, 6, 'Clear 100 waves'),
    A('b1', 'Boss Down', 'bosses', 1, 3, 'Defeat a boss'), A('b12', 'Overkill', 'bosses', 12, 8, 'Defeat 12 bosses'),
    A('s1', 'First Stage', 'stages', 1, 1, 'Clear a campaign stage'), A('s15', 'Halfway Home', 'stages', 15, 4, 'Clear 15 campaign stages'), A('s30', 'Liberator', 'stages', 30, 8, 'Clear all 30 campaign stages'),
    A('lv10', 'Deep Space', 'bestLevel', 10, 3, 'Reach level 10 in one run'), A('lv25', 'Beyond the Belt', 'bestLevel', 25, 6, 'Reach level 25 in one run'),
    A('sc50k', 'Sharpshooter', 'bestScore', 50000, 3, 'Score 50,000 in one run'), A('sc250k', 'Legend', 'bestScore', 250000, 8, 'Score 250,000 in one run'),
    A('d1', 'Daily Patrol', 'dailies', 1, 1, 'Fly a Daily run'), A('d10', 'Regular Patrol', 'dailies', 10, 4, 'Fly 10 Daily runs'),
    A('r20', 'Never Give Up', 'runs', 20, 3, 'Finish 20 runs'), A('st7', 'Seven Sorties', 'bestStreak', 7, 5, 'Play seven days in a row'),
    A('q10', 'Orders', 'quests', 10, 4, 'Complete 10 daily quests'), A('f1', 'Festive Flight', 'festivals', 1, 5, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-k', kind: 'kills', n: 200, reward: 2, text: 'Destroy 200 aliens' }, { id: 'q-k2', kind: 'kills', n: 500, reward: 3, text: 'Destroy 500 aliens' },
    { id: 'q-w', kind: 'waves', n: 8, reward: 3, text: 'Clear 8 waves' }, { id: 'q-s', kind: 'stages', n: 2, reward: 3, text: 'Clear 2 campaign stages' },
    { id: 'q-b', kind: 'bosses', n: 1, reward: 4, text: 'Defeat a boss' }, { id: 'q-d', kind: 'dailies', n: 1, reward: 3, text: 'Fly the Daily run' },
    { id: 'q-r', kind: 'runs', n: 3, reward: 2, text: 'Finish 3 runs' },
  ];

  const CAST = {
    rhea: { name: 'Captain Rhea', skin: '#8a5a3a', hair: '#1a1410', cloth: '#5a2a2a', trim: '#ffd75a', eyes: '#1a1a1a', head: 'cap' },
    kip: { name: 'Kip', skin: '#f0c8a0', hair: '#ff8a3a', cloth: '#2a4a3a', trim: '#5aff7a', eyes: '#2a3a2a', head: 'visor' },
    lumen: { name: 'LUMEN', trim: '#5ad0ff', draw(g, k) {
      k.E(16, 17, 13, 13, '#0e2a3a'); k.E(16, 17, 10, 10, '#1a5a7a'); k.E(16, 17, 6, 6, '#5ad0ff'); k.E(16, 17, 2.5, 2.5, '#ffffff');
      k.R(3, 16, 4, 2, '#5ad0ff'); k.R(25, 16, 4, 2, '#5ad0ff'); } },
    overmind: { name: 'The Overmind', foe: true, trim: '#c04cff', draw(g, k) {
      k.E(16, 16, 14, 12, '#2a0a3a'); k.E(16, 15, 11, 9, '#6a2a8a'); k.E(10, 15, 3, 3, '#ff5aff'); k.E(22, 15, 3, 3, '#ff5aff'); k.E(16, 10, 2, 2, '#ff5aff');
      for (let i = 0; i < 5; ++i) k.R(6 + i * 5, 26, 2, 6, '#4a1a5a'); } },
    boss: { name: 'Boss', foe: true, trim: '#ff5c6c', draw(g, k) {
      k.E(16, 16, 14, 11, '#4a1a1a'); k.E(16, 15, 11, 8, '#8a2a2a'); k.R(6, 22, 20, 4, '#5a1a1a');
      k.E(11, 14, 2.5, 2, '#ffda3a'); k.E(21, 14, 2.5, 2, '#ffda3a'); k.R(11, 19, 10, 2, '#ff5c6c'); } },
  };
  const S = (who, text, name) => (name ? { who, text, name } : { who, text });
  const SECTOR = [
    { name: 'Lunar Orbit', boss: 'Crater Warden', lines: [S('rhea', 'Lunar orbit. The first wave is already in formation above the craters.'), S('kip', 'They march in rows. Old-fashioned. I like old-fashioned.')] },
    { name: 'Mars Front', boss: 'Rust Colossus', lines: [S('lumen', 'Mars front. Dust storms will hide their divers until the last moment.'), S('rhea', 'Then we shoot first and squint later.')] },
    { name: 'Asteroid Belt', boss: 'Rock Hive', lines: [S('kip', 'Rocks everywhere. Some of them are moving on their own.'), S('lumen', 'Those are not rocks. Those are hives.')] },
    { name: 'Jupiter Storm', boss: 'Storm Leviathan', lines: [S('rhea', 'Jupiter. Hold on to your seat, Kip.'), S('overmind', 'The storm is mine. The thunder is mine. You are lightning in a jar.')] },
    { name: 'Saturn Rings', boss: 'Ring Sentinel', lines: [S('lumen', 'The rings are mined. Fly between the bands.'), S('kip', 'Pretty. Deadly. Story of my life.')] },
    { name: 'Mothership', boss: 'The Overmind', lines: [S('rhea', 'There it is. The mothership. Everything ends here.'), S('overmind', 'Come closer, little ship. I have waited a long time to see you.')] },
  ];
  const BOSS_LINE = [
    [S('boss', 'The crater is my nest. Leave or be buried.', 'Crater Warden'), S('kip', 'Aim for the glowing bits!')],
    [S('boss', 'Rust and iron. I do not break.', 'Rust Colossus'), S('lumen', 'Its plates shift when it fires - strike then.')],
    [S('boss', 'The hive hungers. The hive grows.', 'Rock Hive'), S('rhea', 'Clear the drones, then the queen.')],
    [S('boss', 'I AM THE STORM.', 'Storm Leviathan'), S('kip', 'Dodge left. No, right. Just dodge!')],
    [S('boss', 'The rings turn. You will turn with them.', 'Ring Sentinel'), S('lumen', 'Its shield rotates. Wait for the gap.')],
    [S('overmind', 'Then let us finish this, captain.'), S('rhea', 'All power to the guns. For Earth.')],
  ];
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('lumen', 'Alert. Alien fleet entering the solar system. Six sectors under attack.'),
      S('rhea', 'Then we take them back one by one. Kip, are the guns warm?'),
      S('kip', 'Warm, loaded and a little bit excited, captain.'),
      S('overmind', 'Little ship. Your world is the next one on my list.'),
      S('rhea', 'Lists can be shortened. Launch.')] },
    finale: { title: 'Finale', lines: [
      S('overmind', 'Impossible... my fleet... my rings...'),
      S('lumen', 'Mothership destroyed. The sky is clear, captain.'),
      S('kip', 'Can we go home now? I want a sandwich the size of Jupiter.'),
      S('rhea', 'Sandwich first. Then the classic patrol - they will be back.')] },
  };
  SECTOR.forEach((s, i) => {
    scenes['sector-' + i] = { title: s.name + ': arrival', lines: s.lines };
    scenes['boss-' + i] = { title: s.name + ': ' + s.boss, lines: BOSS_LINE[i] };
  });

  const pause = () => { G.hold = true; };
  const resume = () => { G.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'space-invaders', cast: CAST, scenes, pause, resume }) : null;

  let aura = null;
  function applyAura(id) {
    const a = AURAS.find(x => x.id === id);
    aura = !a || id === 'none' ? null : a.colors;
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'space-invaders', title: 'Space Invaders', accent: '#5aff7a', currency: 'credits x25',
    pay: n => { if (G.save) { G.save.credits += n * 25; if (NS.save && NS.save.writeSave) NS.save.writeSave(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: AURAS, cosmeticLabel: 'Ship aura', onEquip: applyAura,
    tokens: { kills: 0.1, waves: 4, stages: 15, bosses: 20, dailies: 20 }, story, pause, resume,
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }
  function record(stat, v) { if (goals) goals.record(stat, v); }

  function onStage(info) {
    if (!story || !info) return;
    if (info.sector === 0 && info.stage === 0) story.play('prologue');
    if (info.stage === 0) story.play('sector-' + info.sector);
    if (info.boss) story.play('boss-' + info.sector);
  }
  function onStageClear(info) {
    deed('stages', 1);
    if (story && info && info.sector === 5 && info.boss) story.play('finale');
  }
  function onRunEnd() {
    deed('runs', 1);
    if (G.gameMode === 'daily') deed('dailies', 1);
    record('bestScore', G.score || 0);
    record('bestLevel', G.level || 0);
  }

  /* the aura: a soft glow and a few sparks behind the ship */
  function drawAura(ctx, x, y, w, h, t) {
    if (!aura) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rr = w * 1.3, cy = y + h / 2;
    const g = ctx.createRadialGradient(x, cy, 2, x, cy, rr);
    g.addColorStop(0, aura[0] + '88');
    g.addColorStop(1, aura[0] + '00');
    ctx.fillStyle = g;
    ctx.fillRect(x - rr, cy - rr, rr * 2, rr * 2);
    ctx.fillStyle = aura[1];
    for (let i = 0; i < 6; ++i) {
      const k = ((t / 400 + i / 6) % 1);
      ctx.globalAlpha = 1 - k;
      ctx.fillRect(x - 3 + Math.sin(i * 2.1 + t / 300) * w * 0.3, y + h + k * 26, 2, 2);
    }
    ctx.restore();
  }

  NS.meta = { goals, story, AURAS, deed, record, onStage, onStageClear, onRunEnd, drawAura,
    open: tab => goals && goals.open(tab) };
})();
