/* Everything a profile collects around the fields: the tech tree (five branches, 24 nodes bought with
   shards), the collection (tile sets, flags and clearing effects; bought with gems, earned with
   stars, levels, achievements, Gauntlet wins or festival tracks), the modes, the achievements and
   the daily quest pool. Pure data; achievements test a snapshot built by progress.snapshot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});

  const BRANCHES = [
    { id: 'survey', name: 'Survey', color: '#5ad0ff' },
    { id: 'safety', name: 'Safety', color: '#c8a0ff' },
    { id: 'fortune', name: 'Fortune', color: '#ffd25a' },
    { id: 'craft', name: 'Craft', color: '#7be08a' },
    { id: 'mastery', name: 'Mastery', color: '#ff9a5a' },
  ];
  const TREE = [
    { id: 'scanstart', branch: 'survey', name: 'Head Start', desc: 'Begin every story, Daily and Zen field with a Scanner', stat: 'scanStart', per: 1, costs: [120], req: [], x: 0, y: 0 },
    { id: 'chests', branch: 'survey', name: 'Treasure Map', desc: '+1 chest on every story field', stat: 'chests', per: 1, costs: [150, 450], req: [['scanstart', 1]], x: 0, y: 1 },
    { id: 'u-sonar', branch: 'survey', name: 'Sonar', desc: 'Chests can hold a Sonar', stat: 'unlock:sonar', per: 1, costs: [250], req: [['scanstart', 1]], x: 1, y: 1 },
    { id: 'u-lantern', branch: 'survey', name: 'Lantern', desc: 'Chests can hold a Lantern', stat: 'unlock:lantern', per: 1, costs: [400], req: [['u-sonar', 1]], x: 1, y: 2 },
    { id: 'slots', branch: 'survey', name: 'Bigger Pack', desc: '+1 power slot', stat: 'slots', per: 1, costs: [350, 900], req: [['chests', 1]], x: 0, y: 2 },

    { id: 'shield', branch: 'safety', name: 'Blast Vest', desc: '+1 shield on every story field', stat: 'shields', per: 1, costs: [200, 700], req: [], x: 0, y: 0 },
    { id: 'fuse', branch: 'safety', name: 'Long Fuse', desc: 'Guardian fuses burn {p} longer', stat: 'fuse', per: 0.1, costs: [150, 400, 800], req: [['shield', 1]], x: 0, y: 1 },
    { id: 'thaw', branch: 'safety', name: 'Warm Gloves', desc: 'Frozen flags and smoke clear {p} sooner', stat: 'thaw', per: 0.2, costs: [200, 500], req: [['shield', 1]], x: 1, y: 1 },
    { id: 'revive', branch: 'safety', name: 'Second Chance', desc: 'Once per session, a lost field is defused instead', stat: 'revive', per: 1, costs: [900], req: [['fuse', 1]], x: 0, y: 2 },
    { id: 'calm', branch: 'safety', name: 'Steady Hands', desc: 'Guardians strike {p} less often', stat: 'calm', per: 0.08, costs: [300, 700], req: [['thaw', 1]], x: 1, y: 2 },

    { id: 'shards', branch: 'fortune', name: 'Prospector', desc: '+{p} shards from every game', stat: 'shardGain', per: 0.1, costs: [100, 250, 600, 1400], req: [], x: 0, y: 0 },
    { id: 'score', branch: 'fortune', name: 'Tidy Work', desc: '+{p} score', stat: 'scoreGain', per: 0.05, costs: [120, 300, 700], req: [['shards', 1]], x: 0, y: 1 },
    { id: 'gemgain', branch: 'fortune', name: 'Gem Cutter', desc: 'Gems pay {p} more shards', stat: 'gemGain', per: 0.5, costs: [150, 400], req: [['shards', 1]], x: 1, y: 1 },
    { id: 'stargems', branch: 'fortune', name: 'Gem Eye', desc: '+1 gem for every three-star stage', stat: 'starGems', per: 1, costs: [500], req: [['score', 1]], x: 0, y: 2 },

    { id: 'speed', branch: 'craft', name: 'Quick Read', desc: 'Par times are {p} longer', stat: 'par', per: 0.1, costs: [150, 400], req: [], x: 0, y: 0 },
    { id: 'timer', branch: 'craft', name: 'Pocket Watch', desc: 'Timed fields and Rush get {v} more seconds', stat: 'time', per: 15, costs: [200, 500], req: [['speed', 1]], x: 0, y: 1 },
    { id: 'chord', branch: 'craft', name: 'Chord Master', desc: 'Each chord scores {p} more', stat: 'chordGain', per: 0.5, costs: [150, 400], req: [['speed', 1]], x: 1, y: 1 },
    { id: 'flood', branch: 'craft', name: 'Wide Open', desc: 'Big clearings score {p} more', stat: 'floodGain', per: 0.25, costs: [250, 600], req: [['chord', 1]], x: 1, y: 2 },
    { id: 'zenshield', branch: 'craft', name: 'Zen Garden', desc: 'Zen fields start with a shield', stat: 'zenShield', per: 1, costs: [450], req: [['timer', 1]], x: 0, y: 2 },

    { id: 'xp', branch: 'mastery', name: 'Fast Learner', desc: '+{p} XP', stat: 'xpGain', per: 0.15, costs: [100, 300, 700], req: [], x: 0, y: 0 },
    { id: 'quests', branch: 'mastery', name: 'Errand Pro', desc: '+{p} quest rewards', stat: 'questGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 0, y: 1 },
    { id: 'tokens', branch: 'mastery', name: 'Festive Spirit', desc: '+{p} festival tokens', stat: 'tokenGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 1, y: 1 },
    { id: 'master', branch: 'mastery', name: 'Master Surveyor', desc: '+{p} everything earned (shards, XP, score)', stat: 'allGain', per: 0.05, costs: [1500, 3000, 6000], req: [['quests', 1], ['tokens', 1]], x: 0, y: 2 },
    { id: 'cpu', branch: 'mastery', name: 'Rival Notes', desc: 'Versus CPU rivals start {v} s later', stat: 'rivalDelay', per: 2, costs: [300, 700], req: [['xp', 1]], x: 1, y: 2 },
  ];

  /* unlock: default, gems (price), stars, level, ach (count), festival (season id), gauntlet (wins) */
  const TILES = [
    { id: 'classic', name: 'Classic', style: 'classic', color: '#c0c0c0', accent: '#ffffff', open: '#b8b8b8', unlock: { k: 'default' } },
    { id: 'meadow', name: 'Meadow', style: 'grass', color: '#6ac05a', accent: '#c8f0a0', open: '#e8d8a8', unlock: { k: 'default' } },
    { id: 'crystal', name: 'Crystal', style: 'gem', color: '#8ad0f0', accent: '#ffffff', open: '#e0f0ff', unlock: { k: 'stars', n: 10 } },
    { id: 'sandstone', name: 'Sandstone', style: 'stone', color: '#d0a060', accent: '#ffe0a8', open: '#f0dcb0', unlock: { k: 'stars', n: 25 } },
    { id: 'tide', name: 'Tidepool', style: 'gem', color: '#3ab0b0', accent: '#c8fff0', open: '#d8f0e8', unlock: { k: 'stars', n: 40 } },
    { id: 'iron', name: 'Iron', style: 'metal', color: '#8a8a9a', accent: '#e0e0f0', open: '#c8c8d0', unlock: { k: 'stars', n: 60 } },
    { id: 'wood', name: 'Oak', style: 'wood', color: '#a0703a', accent: '#e0b070', open: '#f0dcc0', unlock: { k: 'gems', n: 40 } },
    { id: 'candy', name: 'Candy', style: 'grass', color: '#ff8ac0', accent: '#ffe0f0', open: '#fff0f8', unlock: { k: 'gems', n: 60 } },
    { id: 'neon', name: 'Neon', style: 'neon', color: '#1a1a3a', accent: '#5affea', open: '#0a0a1a', unlock: { k: 'level', n: 15 } },
    { id: 'gold', name: 'Gilded', style: 'metal', color: '#d0a030', accent: '#fff0b0', open: '#f8ecc0', unlock: { k: 'stars', n: 90 } },
    { id: 'obsidian', name: 'Obsidian', style: 'gem', color: '#2a1a3a', accent: '#c08aff', open: '#3a2a4a', unlock: { k: 'gauntlet', n: 1 } },
    { id: 'frost', name: 'Frostfall', style: 'gem', color: '#cfefff', accent: '#ffffff', open: '#f0faff', unlock: { k: 'festival', id: 'frost' } },
    { id: 'bloom', name: 'Blossom', style: 'grass', color: '#ffb0d0', accent: '#ffffff', open: '#fff4f8', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunfest', style: 'metal', color: '#ffd23a', accent: '#fff4c0', open: '#fff8e0', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'harvest', name: 'Harvest', style: 'wood', color: '#c0702a', accent: '#ffd07a', open: '#f8e4c8', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'hollow', name: 'Hollow Night', style: 'stone', color: '#5a2a7a', accent: '#ff8a1a', open: '#2a1a3a', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'starfall', name: 'Starfall', style: 'neon', color: '#1a1a5a', accent: '#ffd23a', open: '#10103a', unlock: { k: 'festival', id: 'starfall' } },
  ];
  const FLAGS = [
    { id: 'pennant', name: 'Pennant', shape: 'pennant', color: '#ff2a2a', pole: '#2a2a2a', unlock: { k: 'default' } },
    { id: 'banner', name: 'Banner', shape: 'banner', color: '#3a6aff', pole: '#4a3a2a', unlock: { k: 'stars', n: 5 } },
    { id: 'sprout', name: 'Sprout', shape: 'sprout', color: '#5ac05a', pole: '#6a4a2a', unlock: { k: 'stars', n: 20 } },
    { id: 'star', name: 'Star', shape: 'star', color: '#ffd23a', pole: '#8a6a2a', unlock: { k: 'gems', n: 50 } },
    { id: 'heart', name: 'Heart', shape: 'heart', color: '#ff5a8a', pole: '#8a2a4a', unlock: { k: 'ach', n: 15 } },
    { id: 'crown', name: 'Crown', shape: 'crown', color: '#ffd23a', pole: '#8a6a2a', unlock: { k: 'level', n: 25 } },
    { id: 'tock', name: 'Tock Pin', shape: 'gear', color: '#c8a070', pole: '#5a4a3a', unlock: { k: 'stars', n: 50 } },
    { id: 'snow', name: 'Snowflake', shape: 'star', color: '#ffffff', pole: '#7ab0e0', unlock: { k: 'festival', id: 'frost' } },
    { id: 'petal', name: 'Petal', shape: 'heart', color: '#ffb0d0', pole: '#5a8a3a', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sunflag', name: 'Sun Flag', shape: 'banner', color: '#ffb03a', pole: '#8a5a2a', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'leaf', name: 'Maple Leaf', shape: 'sprout', color: '#e0702a', pole: '#5a3a1a', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'pumpkin', name: 'Pumpkin', shape: 'crown', color: '#ff8a1a', pole: '#3a5a1a', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'spark', name: 'Sparkler', shape: 'star', color: '#ffe07a', pole: '#3a3a6a', unlock: { k: 'festival', id: 'starfall' } },
  ];
  const EFFECTS = [
    { id: 'spark', name: 'Sparks', kind: 'spark', color: '#9ae8ff', unlock: { k: 'default' } },
    { id: 'confetti', name: 'Confetti', kind: 'confetti', color: '#ffd23a', unlock: { k: 'stars', n: 15 } },
    { id: 'ember', name: 'Embers', kind: 'ember', color: '#ff8a2a', unlock: { k: 'gems', n: 40 } },
    { id: 'stars', name: 'Stardust', kind: 'star', color: '#ffe8a0', unlock: { k: 'level', n: 8 } },
    { id: 'leaves', name: 'Clover', kind: 'leaf', color: '#7be08a', unlock: { k: 'stars', n: 35 } },
    { id: 'hearts', name: 'Hearts', kind: 'heart', color: '#ff7a9a', unlock: { k: 'ach', n: 25 } },
    { id: 'shards', name: 'Crystal', kind: 'shard', color: '#bfe8ff', unlock: { k: 'gems', n: 70 } },
    { id: 'snow', name: 'Snow', kind: 'snow', color: '#ffffff', unlock: { k: 'festival', id: 'frost' } },
    { id: 'petals', name: 'Petals', kind: 'petal', color: '#ffc0dc', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunbeams', kind: 'spark', color: '#ffd23a', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'harvest', name: 'Leaves', kind: 'leaf', color: '#e0902a', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'bats', name: 'Bats', kind: 'bat', color: '#5a2a7a', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'fireworks', name: 'Fireworks', kind: 'confetti', color: '#ff7ad8', unlock: { k: 'festival', id: 'starfall' } },
  ];

  const MODES = [
    { id: 'story', name: 'Story', desc: 'Five lands, thirty fields, five guardians', icon: 'book' },
    { id: 'classic', name: 'Classic', desc: 'Beginner, Intermediate, Expert or your own size - best times', icon: 'flag' },
    { id: 'daily', name: 'Daily Field', desc: 'One proven field for everyone today, two twists', icon: 'calendar' },
    { id: 'zen', name: 'Zen', desc: 'Endless proven fields, no clock, a mine only costs points', icon: 'leaf' },
    { id: 'rush', name: 'Rush', desc: 'Clear as many fields as you can in three minutes', icon: 'clock', time: 180 },
    { id: 'gauntlet', name: 'Gauntlet', desc: 'All five guardians back to back', icon: 'skull', need: 2 },
    { id: 'versus', name: 'Versus CPU', desc: 'Race a CPU surveyor on the same field', icon: 'swords' },
  ];

  const A = [];
  const add = (id, name, desc, icon, test) => A.push({ id: id, name: name, desc: desc, icon: icon, test: test });
  add('open1k', 'Surveyor', 'Open 1,000 cells', 'flag', s => s.opened >= 1000);
  add('open10k', 'Cartographer', 'Open 10,000 cells', 'flag', s => s.opened >= 10000);
  add('open100k', 'Valley Mapper', 'Open 100,000 cells', 'map', s => s.opened >= 100000);
  add('flags100', 'Flag Bearer', 'Plant 100 flags', 'flag', s => s.flags >= 100);
  add('chords100', 'Chord Player', 'Chord 100 times', 'chain', s => s.chords >= 100);
  add('big80', 'Wide Open', 'Open 80 cells with one click', 'sparkle', s => s.biggest >= 80);
  add('gems25', 'Gem Hunter', 'Collect 25 gems', 'gem', s => s.gems >= 25);
  add('gems250', 'Jeweller', 'Collect 250 gems', 'gem', s => s.gems >= 250);
  add('chests20', 'Treasure Seeker', 'Open 20 chests', 'gift', s => s.chests >= 20);
  add('powers25', 'Toolbox', 'Use 25 powers', 'bolt', s => s.powers >= 25);
  add('shield', 'Close Call', 'Survive a mine with a shield', 'shield', s => s.shields >= 1);
  add('w1', 'Tunnel Vision', 'Defeat the Burrowbeast', 'skull', s => s.bosses >= 1);
  add('w2', 'Thaw', 'Defeat Rimewing', 'skull', s => s.bosses >= 2);
  add('w3', 'Clear Skies', 'Defeat the Cinder Golem', 'skull', s => s.bosses >= 3);
  add('w4', 'Overdue', 'Defeat the Archivist', 'skull', s => s.bosses >= 4);
  add('w5', 'Valley in Bloom', 'Stop the Rustmonger\'s Engine', 'crown', s => s.bosses >= 5);
  add('stars30', 'Star Collector', 'Earn 30 stars', 'star', s => s.stars >= 30);
  add('stars90', 'All the Stars', 'Earn all 90 stars', 'star', s => s.stars >= 90);
  add('noflag', 'No Flags Needed', 'Clear a story field without planting a flag', 'sparkle', s => s.noflagWins >= 1);
  add('beg', 'Beginner\'s Luck', 'Win Classic Beginner', 'flag', s => s.classicWins.beginner >= 1);
  add('int', 'Getting Serious', 'Win Classic Intermediate', 'flag', s => s.classicWins.intermediate >= 1);
  add('exp', 'Expert', 'Win Classic Expert', 'crown', s => s.classicWins.expert >= 1);
  add('beg10', 'Ten Seconds Flat', 'Win Classic Beginner in under 10 seconds', 'clock', s => s.bestTimes.beginner > 0 && s.bestTimes.beginner < 10);
  add('int60', 'Minute Man', 'Win Classic Intermediate in under 60 seconds', 'clock', s => s.bestTimes.intermediate > 0 && s.bestTimes.intermediate < 60);
  add('exp180', 'Expert Sprinter', 'Win Classic Expert in under 3 minutes', 'clock', s => s.bestTimes.expert > 0 && s.bestTimes.expert < 180);
  add('streak5', 'Hot Streak', 'Win 5 Classic games in a row', 'chain', s => s.classicStreakBest >= 5);
  add('daily1', 'Daily Surveyor', 'Clear a Daily Field', 'calendar', s => s.dailies >= 1);
  add('daily7', 'Regular', 'Clear 7 Daily Fields', 'calendar', s => s.dailies >= 7);
  add('zen20', 'Zen Gardener', 'Clear 20 Zen fields', 'leaf', s => s.zenFields >= 20);
  add('rush5', 'Rushed', 'Clear 5 fields in one Rush', 'clock', s => s.rushBest >= 5);
  add('rush12', 'Whirlwind', 'Clear 12 fields in one Rush', 'clock', s => s.rushBest >= 12);
  add('gauntlet', 'Gauntlet', 'Win the Gauntlet', 'skull', s => s.gauntletWins >= 1);
  add('vs1', 'Rival Down', 'Win a Versus race', 'swords', s => s.vsWins >= 1);
  add('vsLegend', 'Living Legend', 'Beat the Legend in Versus', 'crown', s => s.vsBest >= 4);
  add('tree10', 'Researcher', 'Buy 10 tech tree levels', 'tree', s => s.treeLevels >= 10);
  add('treeAll', 'Scholar', 'Buy every tech tree level', 'tree', s => s.treeLevels >= s.treeMax);
  add('style', 'Decorator', 'Own 5 tile sets', 'palette', s => s.tiles >= 5);
  add('streak7', 'Week Streak', 'Play on 7 days in a row', 'calendar', s => s.streak >= 7);
  add('quests30', 'Errand Runner', 'Complete 30 daily quests', 'scroll', s => s.quests >= 30);
  add('level20', 'Seasoned', 'Reach player level 20', 'xp', s => s.level >= 20);
  add('level50', 'Veteran', 'Reach player level 50', 'xp', s => s.level >= 50);
  add('festival', 'Festive', 'Finish a festival reward track', 'gift', s => s.festivalDone >= 1);

  const QUESTS = [
    { id: 'opened', text: 'Open {n} cells', n: [300, 600, 1000], reward: 60 },
    { id: 'fields', text: 'Clear {n} fields in any mode', n: [2, 3, 5], reward: 70 },
    { id: 'stage', text: 'Finish {n} story stages', n: [1, 2, 3], reward: 80 },
    { id: 'chords', text: 'Chord {n} times', n: [10, 20, 40], reward: 60 },
    { id: 'gems', text: 'Collect {n} gems', n: [3, 5, 8], reward: 70 },
    { id: 'flags', text: 'Plant {n} correct flags', n: [20, 40, 70], reward: 50 },
    { id: 'classic', text: 'Win {n} Classic games', n: [1, 2, 3], reward: 70 },
    { id: 'big', text: 'Open {n} cells with one click', n: [30, 50, 70], reward: 60, max: true },
    { id: 'powers', text: 'Use {n} powers', n: [2, 4, 6], reward: 50 },
    { id: 'games', text: 'Play {n} games in any mode', n: [2, 3, 5], reward: 50 },
    { id: 'versus', text: 'Win {n} Versus race(s)', n: [1, 2], reward: 70 },
  ];

  const TREE_BY_ID = {};
  for (const n of TREE) TREE_BY_ID[n.id] = n;
  const MODE_BY_ID = {};
  for (const m of MODES) MODE_BY_ID[m.id] = m;

  NS.metaData = { BRANCHES, TREE, TREE_BY_ID, TILES, FLAGS, EFFECTS, MODES, MODE_BY_ID, ACHIEVEMENTS: A, QUESTS };
})();
