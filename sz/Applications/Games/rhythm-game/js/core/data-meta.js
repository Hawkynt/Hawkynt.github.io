/* Everything a profile collects around the songs: the tech tree (Timing, Groove, Surge, Fortune and
   Stage, 28 nodes bought with discs), the six performers with their perks, note skins, highways and
   hit effects with a rarity (bought with crystals, earned with stars, levels, achievements, Fame,
   festivals, crates or 100% completion), the boosters, the Record Crate odds and duplicate refunds,
   the modes, 46 achievements (some hidden), the daily quest pool and the weekly challenges. Pure data;
   achievements test a snapshot built by progress.snapshot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  const BRANCHES = [
    { id: 'timing', name: 'Timing', color: '#5af0ff' },
    { id: 'groove', name: 'Groove', color: '#7bf0a0' },
    { id: 'surge', name: 'Surge', color: '#ff7ad8' },
    { id: 'fortune', name: 'Fortune', color: '#ffc85a' },
    { id: 'stage', name: 'Stage', color: '#c48aff' },
  ];
  const T = (id, branch, name, desc, stat, per, costs, req, x, y) => ({ id: id, branch: branch, name: name, desc: desc, stat: stat, per: per, costs: costs, req: req, x: x, y: y });
  const TREE = [
    T('win', 'timing', 'Wide Ears', 'Every timing window {p} wider', 'win', 0.04, [150, 400, 900], [], 0, 0),
    T('focus', 'timing', 'Focus', 'Perfect window +{ms} ms', 'focus', 0.005, [250, 700], [['win', 1]], 0, 1),
    T('magnet', 'timing', 'Strong Magnet', 'Magnet pickups last {v} s longer', 'magnetLen', 3, [200, 500], [['win', 1]], 1, 1),
    T('calm', 'timing', 'Steady Hands', 'Duel attacks start a beat later and fade a beat sooner', 'calm', 1, [600], [['focus', 1]], 0, 2),
    T('read', 'timing', 'Sight Reader', 'Notes show {v} more beat of warning', 'look', 0.15, [300, 700], [['magnet', 1]], 1, 2),
    T('gstart', 'groove', 'Warm Crowd', 'Start every song with {p} more groove', 'grooveStart', 0.08, [120, 350], [], 0, 0),
    T('regen', 'groove', 'Second Breath', 'Hits fill the groove {p} faster', 'regen', 0.15, [180, 450, 1000], [['gstart', 1]], 0, 1),
    T('drain', 'groove', 'Thick Skin', 'Misses drain {p} less groove', 'drain', 0.08, [250, 600, 1300], [['gstart', 1]], 1, 1),
    T('shield', 'groove', 'Spare Strings', 'Start every song with a shield', 'shieldStart', 1, [700], [['regen', 1]], 0, 2),
    T('rescue', 'groove', 'Encore', 'Once a song, an empty groove refills to half', 'rescue', 1, [1500], [['drain', 2]], 1, 2),
    T('fill', 'surge', 'Star Catcher', 'Star phrases fill {p} more Surge', 'surgeFill', 0.2, [200, 500, 1100], [], 0, 0),
    T('len', 'surge', 'Long Drop', 'Surge lasts {v} more beats', 'surgeBeats', 2, [250, 650], [['fill', 1]], 0, 1),
    T('power', 'surge', 'Amplifier', 'Surge multiplies {v} more', 'surgePower', 0.25, [500, 1200], [['fill', 1]], 1, 1),
    T('sstart', 'surge', 'Pre-Show', 'Start every song with a quarter of Surge', 'surgeStart', 0.25, [600], [['len', 1]], 0, 2),
    T('lucky', 'surge', 'Lucky Star', 'Every song has extra star phrases', 'lucky', 1, [900], [['power', 1]], 1, 2),
    T('discs', 'fortune', 'Royalties', '+{p} discs from every song', 'discGain', 0.1, [100, 250, 600, 1400], [], 0, 0),
    T('crys', 'fortune', 'Crystal Ear', '+1 crystal for every three-star stage and every S', 'crystalBonus', 1, [500], [['discs', 1]], 0, 1),
    T('luck', 'fortune', 'Crate Digger', 'Crates promise an epic one crate sooner', 'crateLuck', 1, [400, 900], [['discs', 1]], 1, 1),
    T('deal', 'fortune', 'Haggler', 'Shop prices {p} lower', 'discount', 0.05, [600, 1500], [['crys', 1]], 0, 2),
    T('score', 'fortune', 'Showmanship', '+{p} score', 'scoreGain', 0.05, [150, 400, 900], [['luck', 1]], 1, 2),
    T('xp', 'stage', 'Fast Learner', '+{p} XP', 'xpGain', 0.15, [100, 300, 700], [], 0, 0),
    T('slots', 'stage', 'Gig Bag', '+1 booster slot', 'slots', 1, [400, 1200], [['xp', 1]], 1, 0),
    T('quests', 'stage', 'Errand Pro', '+{p} quest rewards', 'questGain', 0.25, [200, 500], [['xp', 1]], 0, 1),
    T('tokens', 'stage', 'Festive Spirit', '+{p} festival tokens', 'tokenGain', 0.25, [200, 500], [['xp', 1]], 1, 1),
    T('practice', 'stage', 'Rehearsal', 'Practice speeds pay full discs', 'practicePay', 1, [450], [['quests', 1]], 0, 2),
    T('marathon', 'stage', 'Stamina', 'Marathon songs refill {p} more groove', 'marathonRefill', 0.1, [350, 800], [['tokens', 1]], 1, 2),
    T('master', 'stage', 'Headliner', '+{p} everything earned (discs, XP, score)', 'allGain', 0.05, [2000, 4000, 8000], [['practice', 1], ['marathon', 1]], 0, 3),
    T('fame', 'stage', 'Fan Club', 'Fame stars count {p} more', 'fameGain', 0.1, [3000], [['master', 1]], 1, 3),
  ];

  /* rarity: common, rare, epic, legendary; unlock k: default, crystals (n), stars, level, ach, fame,
     festival (season id), crate (crates only), complete (100%) */
  const PERFORMERS = [
    { id: 'lyra', name: 'Lyra Vale', desc: 'Street DJ - +5% discs', perk: { discGain: 0.05 }, colors: ['#ff4a9a', '#5af0ff', '#2a1a3a'], prop: 'decks', rarity: 'common', unlock: { k: 'default' } },
    { id: 'juno', name: 'Juno', desc: 'Drummer - the groove fills 15% faster', perk: { regen: 0.15 }, colors: ['#ffc85a', '#ff7a3a', '#3a1a0a'], prop: 'drums', rarity: 'rare', unlock: { k: 'stars', n: 15 } },
    { id: 'kip', name: 'Kip', desc: 'Keytar kid - star phrases fill 15% more Surge', perk: { surgeFill: 0.15 }, colors: ['#7bf0a0', '#c48aff', '#1a3a2a'], prop: 'keytar', rarity: 'rare', unlock: { k: 'crystals', n: 120 } },
    { id: 'sable', name: 'Sable', desc: 'Cellist - timing windows 4% wider', perk: { win: 0.04 }, colors: ['#8ab4ff', '#e0e0ff', '#1a1a3a'], prop: 'cello', rarity: 'epic', unlock: { k: 'stars', n: 45 } },
    { id: 'bolt', name: 'Bolt', desc: 'Robot vocalist - Surge lasts 2 beats longer', perk: { surgeBeats: 2 }, colors: ['#c0c8d8', '#ff5a5a', '#2a2a3a'], prop: 'mic', rarity: 'epic', unlock: { k: 'crate' } },
    { id: 'nova', name: 'Nova', desc: 'Headliner - +5% everything earned', perk: { allGain: 0.05 }, colors: ['#ffd25a', '#ffffff', '#3a2a5a'], prop: 'guitar', rarity: 'legendary', unlock: { k: 'stars', n: 90 } },
  ];
  const C = (id, name, extra, rarity, unlock) => Object.assign({ id: id, name: name, rarity: rarity, unlock: unlock }, extra);
  const NOTES = [
    C('orb', 'Orb', { shape: 'orb' }, 'common', { k: 'default' }),
    C('bar', 'Classic Bar', { shape: 'bar' }, 'common', { k: 'default' }),
    C('arrow', 'Arrow', { shape: 'arrow' }, 'common', { k: 'stars', n: 6 }),
    C('diamond', 'Diamond', { shape: 'diamond' }, 'rare', { k: 'crystals', n: 60 }),
    C('star', 'Star', { shape: 'star' }, 'rare', { k: 'level', n: 8 }),
    C('heart', 'Heart', { shape: 'heart' }, 'rare', { k: 'crate' }),
    C('vinyl', 'Vinyl', { shape: 'vinyl' }, 'epic', { k: 'crystals', n: 150 }),
    C('pixel', 'Pixel', { shape: 'pixel' }, 'epic', { k: 'crate' }),
    C('prism', 'Prism', { shape: 'prism' }, 'legendary', { k: 'complete' }),
    C('snow', 'Snowflake', { shape: 'snow' }, 'epic', { k: 'festival', id: 'frost' }),
    C('petal', 'Petal', { shape: 'petal' }, 'epic', { k: 'festival', id: 'bloom' }),
    C('sun', 'Sunburst', { shape: 'sun' }, 'epic', { k: 'festival', id: 'sunfest' }),
    C('leaf', 'Maple Leaf', { shape: 'leaf' }, 'epic', { k: 'festival', id: 'harvest' }),
    C('pumpkin', 'Pumpkin', { shape: 'pumpkin' }, 'epic', { k: 'festival', id: 'hollow' }),
    C('spark', 'Sparkler', { shape: 'spark' }, 'epic', { k: 'festival', id: 'starfall' }),
  ];
  const HIGHWAYS = [
    C('neon', 'Neon', { base: '#120828', line: '#5af0ff', edge: '#ff4a9a' }, 'common', { k: 'default' }),
    C('chrome', 'Chrome', { base: '#1a1c24', line: '#c8d0e0', edge: '#8ab4ff' }, 'common', { k: 'stars', n: 10 }),
    C('jazz', 'Jazz Club', { base: '#2a160c', line: '#ffc85a', edge: '#c0602a' }, 'rare', { k: 'crystals', n: 80 }),
    C('glass', 'Glasshouse', { base: '#0a2a2a', line: '#7affd0', edge: '#c48aff' }, 'rare', { k: 'crate' }),
    C('lava', 'Lava', { base: '#2a0804', line: '#ff8a3a', edge: '#ffd25a' }, 'rare', { k: 'ach', n: 12 }),
    C('ocean', 'Deep Water', { base: '#021430', line: '#3a8aff', edge: '#5affea' }, 'epic', { k: 'crate' }),
    C('stars', 'Starfield', { base: '#04040e', line: '#ffffff', edge: '#c48aff' }, 'epic', { k: 'fame', n: 1 }),
    C('grid', 'Retro Grid', { base: '#1a0628', line: '#ff4af0', edge: '#ffd25a' }, 'epic', { k: 'crystals', n: 180 }),
    C('frost', 'Frostfall', { base: '#0c1a2e', line: '#bff4ff', edge: '#ffffff' }, 'epic', { k: 'festival', id: 'frost' }),
    C('bloom', 'Blossom', { base: '#2a0c1e', line: '#ffb0d0', edge: '#ffffff' }, 'epic', { k: 'festival', id: 'bloom' }),
    C('beach', 'Beach Night', { base: '#0a1a2a', line: '#ffe07a', edge: '#5affea' }, 'epic', { k: 'festival', id: 'sunfest' }),
    C('harvest', 'Harvest', { base: '#1e1004', line: '#e0902a', edge: '#ffd07a' }, 'epic', { k: 'festival', id: 'harvest' }),
    C('hollow', 'Hollow Night', { base: '#14061e', line: '#ff8a1a', edge: '#7a3aff' }, 'epic', { k: 'festival', id: 'hollow' }),
    C('starfall', 'Starfall', { base: '#0a0a24', line: '#ffd23a', edge: '#ff7ad8' }, 'epic', { k: 'festival', id: 'starfall' }),
  ];
  const EFFECTS = [
    C('spark', 'Sparks', { kind: 'spark' }, 'common', { k: 'default' }),
    C('ring', 'Rings', { kind: 'ring' }, 'common', { k: 'stars', n: 4 }),
    C('confetti', 'Confetti', { kind: 'confetti' }, 'rare', { k: 'crystals', n: 50 }),
    C('stars', 'Stardust', { kind: 'star' }, 'rare', { k: 'level', n: 5 }),
    C('ember', 'Embers', { kind: 'ember' }, 'rare', { k: 'crate' }),
    C('hearts', 'Hearts', { kind: 'heart' }, 'epic', { k: 'ach', n: 20 }),
    C('notes', 'Music Notes', { kind: 'note' }, 'epic', { k: 'crate' }),
    C('bolt', 'Lightning', { kind: 'bolt' }, 'legendary', { k: 'crate' }),
    C('snow', 'Snow', { kind: 'snow' }, 'epic', { k: 'festival', id: 'frost' }),
    C('petals', 'Petals', { kind: 'petal' }, 'epic', { k: 'festival', id: 'bloom' }),
    C('sun', 'Sunbeams', { kind: 'spark', tint: '#ffd23a' }, 'epic', { k: 'festival', id: 'sunfest' }),
    C('leaves', 'Leaves', { kind: 'leaf' }, 'epic', { k: 'festival', id: 'harvest' }),
    C('bats', 'Bats', { kind: 'bat' }, 'epic', { k: 'festival', id: 'hollow' }),
    C('fireworks', 'Fireworks', { kind: 'confetti', tint: '#ff7ad8' }, 'epic', { k: 'festival', id: 'starfall' }),
  ];

  const BOOSTERS = [
    { id: 'net', name: 'Safety Net', desc: 'Three misses keep your combo', price: 120, icon: 'shield', color: '#7bf0a0' },
    { id: 'warm', name: 'Warm-Up', desc: 'Timing windows 25% wider for the first eight bars', price: 100, icon: 'clock', color: '#5af0ff' },
    { id: 'double', name: 'Disc Doubler', desc: 'Twice the discs from this song', price: 200, icon: 'disc', color: '#ffc85a' },
    { id: 'lucky', name: 'Lucky Stars', desc: 'Extra star phrases', price: 150, icon: 'star', color: '#ff7ad8' },
    { id: 'wind', name: 'Second Wind', desc: 'One fail becomes a rescue at half groove', price: 250, icon: 'heart', color: '#ff5a7a' },
    { id: 'focus', name: 'Focus', desc: 'Perfect window +10 ms', price: 180, icon: 'eye', color: '#c48aff' },
  ];

  const RARITY = {
    common: { name: 'Common', color: '#b8c0d0', weight: 70, refund: 100 },
    rare: { name: 'Rare', color: '#5ab4ff', weight: 22, refund: 250 },
    epic: { name: 'Epic', color: '#c48aff', weight: 7, refund: 600 },
    legendary: { name: 'Legendary', color: '#ffc85a', weight: 1, refund: 1500 },
  };
  const CRATE = { discs: 1800, crystals: 60, items: 3, pity: 10 };

  const MODES = [
    { id: 'story', name: 'Story', desc: 'Five districts, thirty songs, five boss duels', icon: 'book' },
    { id: 'free', name: 'Free Play', desc: 'Any song you own in four difficulties, practice speeds', icon: 'music' },
    { id: 'marathon', name: 'Marathon', desc: 'An endless medley - every song faster', icon: 'fire' },
    { id: 'daily', name: 'Daily Mix', desc: 'A song composed for today, two mutators', icon: 'calendar' },
    { id: 'zen', name: 'Zen', desc: 'Calm songs, no fail, no pressure', icon: 'leaf' },
    { id: 'bossrush', name: 'Boss Rush', desc: 'All five duels back to back', icon: 'skull', need: 2 },
    { id: 'weekly', name: 'Weekly Remix', desc: 'This week\'s song and mutator', icon: 'spin' },
    { id: 'remix', name: 'Remix Tour', desc: 'The story again - Remix charts, two mutators each', icon: 'crown', need: 5 },
  ];
  const DIFFS = [
    { id: 'easy', name: 'Easy', level: 0.12, color: '#7bf0a0' },
    { id: 'normal', name: 'Normal', level: 0.42, color: '#5af0ff' },
    { id: 'hard', name: 'Hard', level: 0.7, color: '#ffc85a' },
    { id: 'expert', name: 'Expert', level: 0.95, color: '#ff5a7a' },
  ];
  const MASTERY = [{ id: 'bronze', name: 'Bronze', color: '#d08a4a' }, { id: 'silver', name: 'Silver', color: '#c8d0e0' }, { id: 'gold', name: 'Gold', color: '#ffd25a' }, { id: 'platinum', name: 'Platinum', color: '#bff4ff' }, { id: 'diamond', name: 'Diamond', color: '#c48aff' }];

  const A = [];
  const add = (id, name, desc, icon, test, hidden) => A.push({ id: id, name: name, desc: desc, icon: icon, test: test, hidden: !!hidden });
  add('hit1k', 'Warming Up', 'Hit 1,000 notes', 'music', s => s.hits >= 1000);
  add('hit10k', 'Session Player', 'Hit 10,000 notes', 'music', s => s.hits >= 10000);
  add('hit100k', 'Living Metronome', 'Hit 100,000 notes', 'music', s => s.hits >= 100000);
  add('perf5k', 'Perfectionist', 'Land 5,000 Perfects', 'star', s => s.perfects >= 5000);
  add('combo100', 'Hundred Club', 'A combo of 100', 'chain', s => s.bestCombo >= 100);
  add('combo300', 'In the Zone', 'A combo of 300', 'chain', s => s.bestCombo >= 300);
  add('combo600', 'Flow State', 'A combo of 600', 'chain', s => s.bestCombo >= 600);
  add('fc1', 'Flawless', 'Full combo a song', 'sparkle', s => s.fullCombos >= 1);
  add('fc25', 'Clean Hands', 'Full combo 25 songs', 'sparkle', s => s.fullCombos >= 25);
  add('s1', 'S Rank', 'Earn an S', 'trophy', s => s.sRanks >= 1);
  add('splus', 'S Plus', 'Earn an S+', 'crown', s => s.sPlus >= 1);
  add('w1', 'Harbour Lights', 'Beat Gristle the Bass Baron', 'skull', s => s.bosses >= 1);
  add('w2', 'Clear Glass', 'Beat Vesper the Glass Siren', 'skull', s => s.bosses >= 2);
  add('w3', 'Reforged', 'Beat Anvil-9', 'skull', s => s.bosses >= 3);
  add('w4', 'Surfaced', 'Beat Madame Undertow', 'skull', s => s.bosses >= 4);
  add('w5', 'The City Sings', 'Beat the Hush', 'crown', s => s.bosses >= 5);
  add('stars30', 'Rising Star', 'Earn 30 stars', 'star', s => s.stars >= 30);
  add('stars90', 'Constellation', 'Earn all 90 stars', 'star', s => s.stars >= 90);
  add('expert1', 'Expert Hands', 'Clear a song on Expert', 'fire', s => s.expertClears >= 1);
  add('expert10', 'Shredder', 'Clear 10 songs on Expert', 'fire', s => s.expertClears >= 10);
  add('mastery', 'Diamond Disc', 'Reach Diamond mastery on a song', 'gem', s => s.diamonds >= 1);
  add('mara5', 'Long Haul', 'Survive 5 songs in Marathon', 'fire', s => s.marathonBest >= 5);
  add('mara12', 'Iron Lungs', 'Survive 12 songs in Marathon', 'fire', s => s.marathonBest >= 12);
  add('daily1', 'Daily Listener', 'Clear a Daily Mix', 'calendar', s => s.dailies >= 1);
  add('daily7', 'Regular', 'Clear 7 Daily Mixes', 'calendar', s => s.dailies >= 7);
  add('zen30', 'Unwind', 'Play 30 minutes of Zen', 'leaf', s => s.zenSeconds >= 1800);
  add('rush', 'Boss Rush', 'Win the Boss Rush', 'skull', s => s.rushWins >= 1);
  add('remix30', 'Remixer', 'Earn 30 Remix Tour stars', 'spin', s => s.remixStars >= 30);
  add('surge50', 'Turn It Up', 'Unleash Surge 50 times', 'bolt', s => s.surges >= 50);
  add('hush500', 'Hold Your Peace', 'Let 500 Hush notes pass', 'eye', s => s.hushDodged >= 500);
  add('holds500', 'Sustain', 'Keep 500 holds to their tails', 'music', s => s.holds >= 500);
  add('pick100', 'Collector', 'Catch 100 pickups', 'gift', s => s.pickups >= 100);
  add('tree10', 'Studio Time', 'Buy 10 tech tree levels', 'tree', s => s.treeLevels >= 10);
  add('treeAll', 'Producer', 'Buy every tech tree level', 'tree', s => s.treeLevels >= s.treeMax);
  add('crate10', 'Crate Digger', 'Open 10 Record Crates', 'gift', s => s.crates >= 10);
  add('legend', 'Legendary', 'Find a legendary item', 'crown', s => s.legendaries >= 1);
  add('songs8', 'Record Shop', 'Own 8 shop songs', 'disc', s => s.shopSongs >= 8);
  add('style', 'Stylist', 'Own 20 cosmetics', 'palette', s => s.cosmetics >= 20);
  add('streak7', 'Week Streak', 'Play on 7 days in a row', 'calendar', s => s.streak >= 7);
  add('quests30', 'Errand Runner', 'Complete 30 daily quests', 'scroll', s => s.quests >= 30);
  add('level20', 'Seasoned', 'Reach player level 20', 'xp', s => s.level >= 20);
  add('fame1', 'On Tour', 'Earn a Fame star', 'crown', s => s.fame >= 1);
  add('festival', 'Festive', 'Finish a festival reward track', 'gift', s => s.festivalDone >= 1);
  add('calib', 'Dialled In', 'Calibrate your audio offset', 'gear', s => s.calibrated >= 1, true);
  add('owl', 'Night Shift', 'Finish a song between midnight and 4 am', 'clock', s => s.nightSongs >= 1, true);
  add('comeback', 'Comeback', 'Clear a song after Second Wind rescued it', 'heart', s => s.comebacks >= 1, true);

  const QUESTS = [
    { id: 'hits', text: 'Hit {n} notes', n: [300, 600, 1000], reward: 60 },
    { id: 'songs', text: 'Clear {n} songs in any mode', n: [2, 3, 5], reward: 70 },
    { id: 'stage', text: 'Clear {n} story stages', n: [1, 2, 3], reward: 80 },
    { id: 'perfects', text: 'Land {n} Perfects', n: [150, 300, 500], reward: 60 },
    { id: 'combo', text: 'Reach a combo of {n}', n: [50, 100, 150], reward: 70, max: true },
    { id: 'grade', text: 'Earn {n} grades of A or better', n: [1, 2, 3], reward: 70 },
    { id: 'surge', text: 'Unleash Surge {n} times', n: [2, 4, 6], reward: 50 },
    { id: 'holds', text: 'Keep {n} holds to their tails', n: [20, 40, 70], reward: 50 },
    { id: 'free', text: 'Clear {n} Free Play songs', n: [1, 2, 3], reward: 60 },
    { id: 'phrases', text: 'Complete {n} star phrases', n: [3, 6, 10], reward: 60 },
    { id: 'pickups', text: 'Catch {n} pickups', n: [3, 5, 8], reward: 50 },
  ];
  const WEEKLY = [
    { id: 'songs', text: 'Clear {n} songs', n: 15, reward: { crystals: 40, crate: 1 } },
    { id: 'grade', text: 'Earn {n} grades of A or better', n: 8, reward: { crystals: 40, crate: 1 } },
    { id: 'hits', text: 'Hit {n} notes', n: 5000, reward: { crystals: 40, crate: 1 } },
    { id: 'perfects', text: 'Land {n} Perfects', n: 2500, reward: { crystals: 40, crate: 1 } },
    { id: 'phrases', text: 'Complete {n} star phrases', n: 30, reward: { crystals: 40, crate: 1 } },
  ];

  const by = list => { const o = {}; for (const x of list) o[x.id] = x; return o; };
  NS.metaData = {
    BRANCHES, TREE, TREE_BY_ID: by(TREE), PERFORMERS, NOTES, HIGHWAYS, EFFECTS, BOOSTERS, BOOSTER_BY_ID: by(BOOSTERS), RARITY, CRATE,
    MODES, MODE_BY_ID: by(MODES), DIFFS, DIFF_BY_ID: by(DIFFS), MASTERY, ACHIEVEMENTS: A, QUESTS, WEEKLY,
    SLOTS: { performer: PERFORMERS, note: NOTES, highway: HIGHWAYS, effect: EFFECTS },
  };
})();
