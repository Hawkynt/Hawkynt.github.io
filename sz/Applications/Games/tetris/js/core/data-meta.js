/* Everything around the playfield that a profile collects: the eight powers (charged by power
   orbs, used with E), the tech tree (five branches, 25 nodes bought with shards), the
   collection (block skins, board frames, lock effects; bought with gems, earned with stars or
   festival tracks), the achievements and the daily quest pool, and the modes with their rules.
   Pure data; achievements test a snapshot built by progress.snapshot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});

  /* ---- powers ---- */
  const POWERS = [
    { id: 'sweep', name: 'Sweep', desc: 'Clears the two bottom rows', icon: 'sweep', color: '#7be08a', start: true },
    { id: 'slow', name: 'Slow Time', desc: 'Gravity at a quarter for 15 s', icon: 'clock', color: '#8fd0ff', start: true },
    { id: 'storm', name: 'I-Storm', desc: 'The next three pieces are long bars', icon: 'bar', color: '#3ad8f0', start: true },
    { id: 'quake', name: 'Quake', desc: 'Every column settles - holes fill and rows clear', icon: 'quake', color: '#e0a060' },
    { id: 'laser', name: 'Laser', desc: 'Burns away the tallest column', icon: 'laser', color: '#ff5a7a' },
    { id: 'bomb', name: 'Bomb', desc: 'Blasts a 4 x 4 hole in the top of the stack', icon: 'bomb', color: '#ff9a3a' },
    { id: 'rush', name: 'Score Rush', desc: 'Double score for 20 s', icon: 'star', color: '#ffd25a' },
    { id: 'shield', name: 'Aegis', desc: 'Blocks the next attack and saves you from one top-out', icon: 'shield', color: '#c8a0ff' },
  ];

  /* ---- tech tree: stat, per level, costs ---- */
  const BRANCHES = [
    { id: 'craft', name: 'Craft', color: '#5ad0ff' },
    { id: 'power', name: 'Power', color: '#ff9a3a' },
    { id: 'fortune', name: 'Fortune', color: '#ffd25a' },
    { id: 'guard', name: 'Guard', color: '#7be08a' },
    { id: 'mastery', name: 'Mastery', color: '#c8a0ff' },
  ];
  const TREE = [
    { id: 'lock1', branch: 'craft', name: 'Steady Hands', desc: '+0.1 s lock delay per level', stat: 'lockDelay', per: 0.1, costs: [60, 160, 400], req: [], x: 0, y: 0 },
    { id: 'preview', branch: 'craft', name: 'Far Sight', desc: 'See {v} more pieces ahead (base 3)', stat: 'preview', per: 1, costs: [80, 240], req: [['lock1', 1]], x: 0, y: 1 },
    { id: 'softbonus', branch: 'craft', name: 'Quick Drop', desc: '+{p} drop points', stat: 'dropScore', per: 0.5, costs: [100, 300], req: [['lock1', 1]], x: 1, y: 1 },
    { id: 'gravity', branch: 'craft', name: 'Feather Fall', desc: 'Story gravity -{p}', stat: 'gravityCut', per: 0.08, costs: [200, 500, 1200], req: [['preview', 1]], x: 0, y: 2 },
    { id: 'ghost', branch: 'craft', name: 'Clear Ghost', desc: 'A brighter ghost piece and a landing line', stat: 'ghost', per: 1, costs: [150], req: [['preview', 1]], x: 1, y: 2 },

    { id: 'orbs', branch: 'power', name: 'Orb Finder', desc: '+{p} power orb chance', stat: 'orbChance', per: 0.04, costs: [80, 200, 500], req: [], x: 0, y: 0 },
    { id: 'slot', branch: 'power', name: 'Second Pocket', desc: '+1 power slot', stat: 'slots', per: 1, costs: [400, 1500], req: [['orbs', 1]], x: 0, y: 1 },
    { id: 'u-quake', branch: 'power', name: 'Quake', desc: 'Unlocks the Quake power', stat: 'unlock:quake', per: 1, costs: [250], req: [['orbs', 1]], x: 1, y: 1 },
    { id: 'u-laser', branch: 'power', name: 'Laser', desc: 'Unlocks the Laser power', stat: 'unlock:laser', per: 1, costs: [350], req: [['u-quake', 1]], x: 1, y: 2 },
    { id: 'u-bomb', branch: 'power', name: 'Bomb', desc: 'Unlocks the Bomb power', stat: 'unlock:bomb', per: 1, costs: [450], req: [['u-laser', 1]], x: 1, y: 3 },
    { id: 'u-rush', branch: 'power', name: 'Score Rush', desc: 'Unlocks the Score Rush power', stat: 'unlock:rush', per: 1, costs: [300], req: [['slot', 1]], x: 0, y: 2 },
    { id: 'u-shield', branch: 'power', name: 'Aegis', desc: 'Unlocks the Aegis power', stat: 'unlock:shield', per: 1, costs: [600], req: [['u-rush', 1]], x: 0, y: 3 },

    { id: 'shards', branch: 'fortune', name: 'Shard Sense', desc: '+{p} shards from every game', stat: 'shardGain', per: 0.1, costs: [100, 250, 600, 1400], req: [], x: 0, y: 0 },
    { id: 'score', branch: 'fortune', name: 'Showmanship', desc: '+{p} score', stat: 'scoreGain', per: 0.05, costs: [120, 300, 700], req: [['shards', 1]], x: 0, y: 1 },
    { id: 'combo', branch: 'fortune', name: 'Chain Reaction', desc: '+{p} combo points', stat: 'comboGain', per: 0.25, costs: [150, 400], req: [['shards', 1]], x: 1, y: 1 },
    { id: 'gems', branch: 'fortune', name: 'Gem Eye', desc: '+1 gem for every three-star stage', stat: 'starGems', per: 1, costs: [500], req: [['score', 1]], x: 0, y: 2 },

    { id: 'revive', branch: 'guard', name: 'Second Chance', desc: 'Once per game a top-out clears the bottom eight rows instead', stat: 'revive', per: 1, costs: [500], req: [], x: 0, y: 0 },
    { id: 'armor', branch: 'guard', name: 'Bulwark', desc: 'Guardian attacks send one row less', stat: 'armor', per: 1, costs: [400], req: [['revive', 1]], x: 0, y: 1 },
    { id: 'damage', branch: 'guard', name: 'Heavy Hitter', desc: '+{p} damage to guardians', stat: 'damage', per: 0.15, costs: [150, 400, 900], req: [['revive', 1]], x: 1, y: 1 },
    { id: 'cancel', branch: 'guard', name: 'Counterweight', desc: 'Clears cancel incoming rows twice as well', stat: 'cancel', per: 1, costs: [600], req: [['damage', 1]], x: 1, y: 2 },
    { id: 'startshield', branch: 'guard', name: 'Warded Start', desc: 'Begin guardian fights with Aegis ready', stat: 'startShield', per: 1, costs: [800], req: [['armor', 1]], x: 0, y: 2 },

    { id: 'xp', branch: 'mastery', name: 'Fast Learner', desc: '+{p} XP', stat: 'xpGain', per: 0.15, costs: [100, 300, 700], req: [], x: 0, y: 0 },
    { id: 'quests', branch: 'mastery', name: 'Errand Pro', desc: '+{p} quest rewards', stat: 'questGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 0, y: 1 },
    { id: 'tokens', branch: 'mastery', name: 'Festive Spirit', desc: '+{p} festival tokens', stat: 'tokenGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 1, y: 1 },
    { id: 'master', branch: 'mastery', name: 'Grand Builder', desc: '+{p} everything earned (shards, XP, score)', stat: 'allGain', per: 0.05, costs: [1500, 3000, 6000], req: [['quests', 1], ['tokens', 1]], x: 0, y: 2 },
  ];

  /* ---- collection ---- unlock: default, gems (price), stars (n), level (player level),
     ach (count), festival (season id), master (Master mode level) */
  const SKINS = [
    { id: 'gloss', name: 'Gloss', style: 'gloss', unlock: { k: 'default' } },
    { id: 'pixel', name: 'Pixel', style: 'pixel', unlock: { k: 'gems', n: 40 } },
    { id: 'glass', name: 'Glass', style: 'glass', unlock: { k: 'gems', n: 60 } },
    { id: 'neon', name: 'Neon', style: 'neon', unlock: { k: 'stars', n: 20 } },
    { id: 'candy', name: 'Candy', style: 'candy', unlock: { k: 'gems', n: 80 } },
    { id: 'stone', name: 'Ruin Stone', style: 'stone', unlock: { k: 'stars', n: 8 } },
    { id: 'gem', name: 'Gemcut', style: 'gem', unlock: { k: 'stars', n: 45 } },
    { id: 'holo', name: 'Hologram', style: 'holo', unlock: { k: 'level', n: 25 } },
    { id: 'royal', name: 'Royal Gold', style: 'royal', unlock: { k: 'stars', n: 90 } },
    { id: 'void', name: 'Voidglass', style: 'void', unlock: { k: 'master', n: 15 } },
    { id: 'frost', name: 'Frostfall', style: 'frost', unlock: { k: 'festival', id: 'frost' } },
    { id: 'bloom', name: 'Blossom', style: 'bloom', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunfest', style: 'sun', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'harvest', name: 'Harvest', style: 'harvest', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'hollow', name: 'Hollow Night', style: 'hollow', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'starfall', name: 'Starfall', style: 'starfall', unlock: { k: 'festival', id: 'starfall' } },
  ];
  const FRAMES = [
    { id: 'steel', name: 'Steel', color: '#8aa0c0', accent: '#d0e0ff', unlock: { k: 'default' } },
    { id: 'wood', name: 'Ruin Wood', color: '#8a5a32', accent: '#e0b070', unlock: { k: 'stars', n: 5 } },
    { id: 'crystal', name: 'Crystal', color: '#7a6ad0', accent: '#9affea', unlock: { k: 'stars', n: 18 } },
    { id: 'coral', name: 'Coral', color: '#2a8a9a', accent: '#ffb0a0', unlock: { k: 'stars', n: 30 } },
    { id: 'iron', name: 'Forge Iron', color: '#5a3a30', accent: '#ff8a3a', unlock: { k: 'stars', n: 42 } },
    { id: 'starlight', name: 'Starlight', color: '#3a2a7a', accent: '#ffe8a0', unlock: { k: 'stars', n: 60 } },
    { id: 'rainbow', name: 'Prism', color: '#ff6aa8', accent: '#7affea', unlock: { k: 'gems', n: 150 } },
    { id: 'champion', name: 'Champion', color: '#c09030', accent: '#fff0b0', unlock: { k: 'ach', n: 30 } },
  ];
  const EFFECTS = [
    { id: 'sparks', name: 'Sparks', kind: 'spark', unlock: { k: 'default' } },
    { id: 'stars', name: 'Stardust', kind: 'star', unlock: { k: 'level', n: 5 } },
    { id: 'bubbles', name: 'Bubbles', kind: 'bubble', unlock: { k: 'stars', n: 25 } },
    { id: 'embers', name: 'Embers', kind: 'ember', unlock: { k: 'stars', n: 40 } },
    { id: 'pixels', name: 'Pixels', kind: 'square', unlock: { k: 'gems', n: 50 } },
    { id: 'hearts', name: 'Hearts', kind: 'heart', unlock: { k: 'ach', n: 20 } },
    { id: 'snow', name: 'Snow', kind: 'snow', unlock: { k: 'festival', id: 'frost' } },
    { id: 'petals', name: 'Petals', kind: 'petal', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'confetti', name: 'Confetti', kind: 'confetti', unlock: { k: 'festival', id: 'starfall' } },
    { id: 'bats', name: 'Bats', kind: 'bat', unlock: { k: 'festival', id: 'hollow' } },
  ];

  /* ---- modes ---- */
  const MODES = [
    { id: 'story', name: 'Story', desc: 'Five realms, thirty stages, five guardians', icon: 'book' },
    { id: 'marathon', name: 'Marathon', desc: 'Endless, faster every ten lines', icon: 'flag' },
    { id: 'sprint', name: 'Sprint', desc: 'Clear 40 lines as fast as you can', icon: 'bolt', lines: 40 },
    { id: 'ultra', name: 'Ultra', desc: 'Score as much as you can in two minutes', icon: 'clock', time: 120 },
    { id: 'zen', name: 'Zen', desc: 'No pressure, no game over, calm music', icon: 'leaf' },
    { id: 'daily', name: 'Daily Challenge', desc: 'Three minutes, one seed for everyone today, two mutators', icon: 'calendar', time: 180 },
    { id: 'rush', name: 'Boss Rush', desc: 'All five guardians back to back', icon: 'skull', need: 2 },
    { id: 'master', name: 'Master', desc: 'Instant gravity from the first piece - for experts', icon: 'crown' },
  ];

  /* ---- achievements ---- */
  const A = [];
  const add = (id, name, desc, icon, test) => A.push({ id: id, name: name, desc: desc, icon: icon, test: test });
  add('lines100', 'Bricklayer', 'Clear 100 lines in total', 'bar', s => s.lines >= 100);
  add('lines1k', 'Mason', 'Clear 1,000 lines in total', 'bar', s => s.lines >= 1000);
  add('lines10k', 'Architect', 'Clear 10,000 lines in total', 'bar', s => s.lines >= 10000);
  add('quad1', 'Four Fit', 'Clear four lines at once', 'star', s => s.quads >= 1);
  add('quad100', 'Quad Squad', 'Clear 100 quads', 'star', s => s.quads >= 100);
  add('tspin1', 'Spin Doctor', 'Land a T-spin clear', 'spin', s => s.tspins >= 1);
  add('tspin50', 'Whirlwind', 'Land 50 T-spin clears', 'spin', s => s.tspins >= 50);
  add('tst', 'Triple Twister', 'Land a T-spin triple', 'spin', s => s.tst >= 1);
  add('pc', 'Clean Slate', 'Make a perfect clear', 'sparkle', s => s.perfects >= 1);
  add('pc10', 'Spotless', 'Make 10 perfect clears', 'sparkle', s => s.perfects >= 10);
  add('combo5', 'Chain Gang', 'Reach a combo of 5', 'chain', s => s.maxCombo >= 5);
  add('combo10', 'Unbroken', 'Reach a combo of 10', 'chain', s => s.maxCombo >= 10);
  add('b2b5', 'Back to Back to Back', 'Make 5 back-to-back clears in one game', 'chain', s => s.bestB2B >= 5);
  add('w1', 'Rootbreaker', 'Defeat Grumbleroot', 'skull', s => s.bosses >= 1);
  add('w2', 'Wyrm Tamer', 'Defeat Shardmaw', 'skull', s => s.bosses >= 2);
  add('w3', 'Tide Turner', 'Defeat Maelora', 'skull', s => s.bosses >= 3);
  add('w4', 'Forge Breaker', 'Defeat Vulkar', 'skull', s => s.bosses >= 4);
  add('w5', 'Spire Restored', 'Defeat the Hollow Mason', 'crown', s => s.bosses >= 5);
  add('stars30', 'Star Collector', 'Earn 30 stars', 'star', s => s.stars >= 30);
  add('stars90', 'All the Stars', 'Earn all 90 stars', 'star', s => s.stars >= 90);
  add('m100', 'Long Haul', 'Clear 100 lines in one Marathon', 'flag', s => s.marathonLines >= 100);
  add('m300', 'Ultra Marathon', 'Clear 300 lines in one Marathon', 'flag', s => s.marathonLines >= 300);
  add('sprint120', 'Sprinter', 'Finish Sprint in under 2 minutes', 'bolt', s => s.sprintBest > 0 && s.sprintBest < 120);
  add('sprint60', 'Lightning', 'Finish Sprint in under 1 minute', 'bolt', s => s.sprintBest > 0 && s.sprintBest < 60);
  add('ultra100k', 'Big Score', 'Score 100,000 in Ultra', 'clock', s => s.ultraBest >= 100000);
  add('zen10', 'Inner Calm', 'Spend 10 minutes in Zen', 'leaf', s => s.zenSeconds >= 600);
  add('daily1', 'Daily Builder', 'Finish a Daily Challenge', 'calendar', s => s.dailies >= 1);
  add('daily7', 'Regular', 'Finish 7 Daily Challenges', 'calendar', s => s.dailies >= 7);
  add('rush', 'Gauntlet', 'Win Boss Rush', 'skull', s => s.rushWins >= 1);
  add('master10', 'Master Builder', 'Reach level 10 in Master', 'crown', s => s.masterBest >= 10);
  add('master20', 'Grandmaster', 'Reach level 20 in Master', 'crown', s => s.masterBest >= 20);
  add('power1', 'Power Up', 'Use a power', 'bolt', s => s.powers >= 1);
  add('power50', 'Overcharged', 'Use 50 powers', 'bolt', s => s.powers >= 50);
  add('tree10', 'Researcher', 'Buy 10 tech tree levels', 'tree', s => s.treeLevels >= 10);
  add('tree40', 'Scholar', 'Buy every tech tree level', 'tree', s => s.treeLevels >= s.treeMax);
  add('skins5', 'Fashionable', 'Own 5 block skins', 'palette', s => s.skins >= 5);
  add('streak7', 'Week Streak', 'Play on 7 days in a row', 'calendar', s => s.streak >= 7);
  add('quests30', 'Errand Runner', 'Complete 30 daily quests', 'scroll', s => s.quests >= 30);
  add('level20', 'Seasoned', 'Reach player level 20', 'xp', s => s.level >= 20);
  add('level50', 'Veteran', 'Reach player level 50', 'xp', s => s.level >= 50);
  add('festival', 'Festive', 'Finish a festival reward track', 'gift', s => s.festivalDone >= 1);
  add('nohold', 'No Pockets', 'Clear 40 lines in one game without holding', 'bar', s => s.noHoldLines >= 40);

  const QUESTS = [
    { id: 'lines', text: 'Clear {n} lines', n: [30, 50, 80], reward: 60 },
    { id: 'quads', text: 'Clear {n} quads', n: [2, 3, 5], reward: 80 },
    { id: 'tspins', text: 'Land {n} T-spin clears', n: [1, 2, 3], reward: 90 },
    { id: 'combo', text: 'Reach a combo of {n}', n: [3, 4, 5], reward: 70, max: true },
    { id: 'score', text: 'Score {n} in one game', n: [20000, 40000, 70000], reward: 70, max: true },
    { id: 'stage', text: 'Finish {n} story stages', n: [1, 2, 3], reward: 80 },
    { id: 'powers', text: 'Use {n} powers', n: [2, 4, 6], reward: 50 },
    { id: 'games', text: 'Play {n} games in any mode', n: [2, 3, 5], reward: 50 },
    { id: 'sprint', text: 'Finish a Sprint', n: [1], reward: 60 },
    { id: 'zen', text: 'Spend {n} minutes in Zen', n: [3, 5], reward: 40 },
    { id: 'pieces', text: 'Place {n} pieces', n: [150, 250, 400], reward: 50 },
  ];

  const TREE_BY_ID = {};
  for (const n of TREE) TREE_BY_ID[n.id] = n;
  const POWER_BY_ID = {};
  for (const p of POWERS) POWER_BY_ID[p.id] = p;
  const MODE_BY_ID = {};
  for (const m of MODES) MODE_BY_ID[m.id] = m;

  NS.metaData = { POWERS, POWER_BY_ID, BRANCHES, TREE, TREE_BY_ID, SKINS, FRAMES, EFFECTS, MODES, MODE_BY_ID, ACHIEVEMENTS: A, QUESTS };
})();
