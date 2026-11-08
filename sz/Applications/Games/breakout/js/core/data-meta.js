/* Everything a profile collects around the field: the tech tree (five branches, 25 nodes bought
   with shards), the collection (paddles, balls, trails; bought with gems, earned with stars,
   levels, achievements or festival tracks), the modes, the achievements and the daily quest
   pool. Pure data; achievements test a snapshot built by progress.snapshot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});

  const BRANCHES = [
    { id: 'paddle', name: 'Paddle', color: '#5ad0ff' },
    { id: 'power', name: 'Power', color: '#ff9a3a' },
    { id: 'fortune', name: 'Fortune', color: '#ffd25a' },
    { id: 'guard', name: 'Guard', color: '#7be08a' },
    { id: 'mastery', name: 'Mastery', color: '#c8a0ff' },
  ];
  const TREE = [
    { id: 'width', branch: 'paddle', name: 'Wider Hull', desc: '+{p} paddle width', stat: 'paddleW', per: 0.06, costs: [60, 160, 400], req: [], x: 0, y: 0 },
    { id: 'control', branch: 'paddle', name: 'Fine Control', desc: 'Slower balls: -{p} speed', stat: 'ballSlow', per: 0.04, costs: [100, 300], req: [['width', 1]], x: 0, y: 1 },
    { id: 'laserup', branch: 'paddle', name: 'Rapid Cannons', desc: 'Lasers fire {p} faster', stat: 'laserRate', per: 0.2, costs: [150, 400], req: [['width', 1]], x: 1, y: 1 },
    { id: 'stun', branch: 'paddle', name: 'Grounded', desc: 'Guardian shots stun {p} shorter', stat: 'stunCut', per: 0.25, costs: [200, 500], req: [['control', 1]], x: 0, y: 2 },
    { id: 'aim', branch: 'paddle', name: 'Aim Line', desc: 'See where a held ball will fly', stat: 'aim', per: 1, costs: [180], req: [['control', 1]], x: 1, y: 2 },

    { id: 'drops', branch: 'power', name: 'Lucky Bricks', desc: '+{p} power-up drops', stat: 'dropGain', per: 0.15, costs: [80, 200, 500], req: [], x: 0, y: 0 },
    { id: 'duration', branch: 'power', name: 'Long Charge', desc: 'Power-ups last {p} longer', stat: 'duration', per: 0.15, costs: [120, 300, 700], req: [['drops', 1]], x: 0, y: 1 },
    { id: 'u-magnet', branch: 'power', name: 'Magnet', desc: 'Magnet power-ups can drop', stat: 'unlock:magnet', per: 1, costs: [250], req: [['drops', 1]], x: 1, y: 1 },
    { id: 'u-mega', branch: 'power', name: 'Mega Ball', desc: 'Mega Ball power-ups can drop', stat: 'unlock:mega', per: 1, costs: [400], req: [['u-magnet', 1]], x: 1, y: 2 },
    { id: 'u-star', branch: 'power', name: 'Star Shower', desc: 'Star Shower power-ups can drop', stat: 'unlock:star', per: 1, costs: [550], req: [['u-mega', 1]], x: 1, y: 3 },
    { id: 'nobad', branch: 'power', name: 'Clean Signal', desc: 'Shrink and Haste never drop', stat: 'noBad', per: 1, costs: [600], req: [['duration', 1]], x: 0, y: 2 },
    { id: 'startpow', branch: 'power', name: 'Head Start', desc: 'Begin every stage with a Barrier', stat: 'startBarrier', per: 1, costs: [700], req: [['nobad', 1]], x: 0, y: 3 },

    { id: 'shards', branch: 'fortune', name: 'Shard Sense', desc: '+{p} shards from every game', stat: 'shardGain', per: 0.1, costs: [100, 250, 600, 1400], req: [], x: 0, y: 0 },
    { id: 'score', branch: 'fortune', name: 'Showmanship', desc: '+{p} score', stat: 'scoreGain', per: 0.05, costs: [120, 300, 700], req: [['shards', 1]], x: 0, y: 1 },
    { id: 'combo', branch: 'fortune', name: 'Chain Bonus', desc: '+{p} shards from long combos', stat: 'comboGain', per: 0.25, costs: [150, 400], req: [['shards', 1]], x: 1, y: 1 },
    { id: 'gems', branch: 'fortune', name: 'Gem Eye', desc: '+1 gem for every three-star stage', stat: 'starGems', per: 1, costs: [500], req: [['score', 1]], x: 0, y: 2 },

    { id: 'life', branch: 'guard', name: 'Spare Hull', desc: '+1 ball in reserve', stat: 'lives', per: 1, costs: [300, 900], req: [], x: 0, y: 0 },
    { id: 'barrier', branch: 'guard', name: 'Double Barrier', desc: 'Barriers stack one higher', stat: 'barrierCap', per: 1, costs: [400], req: [['life', 1]], x: 0, y: 1 },
    { id: 'damage', branch: 'guard', name: 'Heavy Hitter', desc: '+{p} damage to guardians', stat: 'damage', per: 0.15, costs: [150, 400, 900], req: [['life', 1]], x: 1, y: 1 },
    { id: 'armor', branch: 'guard', name: 'Deflector', desc: 'Guardian shots are slower', stat: 'shotSlow', per: 0.2, costs: [500], req: [['damage', 1]], x: 1, y: 2 },
    { id: 'revive', branch: 'guard', name: 'Second Chance', desc: 'Once per game, the last ball lost comes back', stat: 'revive', per: 1, costs: [800], req: [['barrier', 1]], x: 0, y: 2 },

    { id: 'xp', branch: 'mastery', name: 'Fast Learner', desc: '+{p} XP', stat: 'xpGain', per: 0.15, costs: [100, 300, 700], req: [], x: 0, y: 0 },
    { id: 'quests', branch: 'mastery', name: 'Errand Pro', desc: '+{p} quest rewards', stat: 'questGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 0, y: 1 },
    { id: 'tokens', branch: 'mastery', name: 'Festive Spirit', desc: '+{p} festival tokens', stat: 'tokenGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 1, y: 1 },
    { id: 'master', branch: 'mastery', name: 'Star Pilot', desc: '+{p} everything earned (shards, XP, score)', stat: 'allGain', per: 0.05, costs: [1500, 3000, 6000], req: [['quests', 1], ['tokens', 1]], x: 0, y: 2 },
  ];

  /* unlock: default, gems (price), stars, level, ach (count), festival (season id), rush (wins) */
  const PADDLES = [
    { id: 'aurora', name: 'Aurora', color: '#4a7af0', accent: '#9ae8ff', style: 'field', unlock: { k: 'default' } },
    { id: 'chrome', name: 'Chrome', color: '#c0c8d8', accent: '#ffffff', style: 'metal', unlock: { k: 'gems', n: 40 } },
    { id: 'ember', name: 'Ember', color: '#ff6a2a', accent: '#ffd07a', style: 'field', unlock: { k: 'stars', n: 10 } },
    { id: 'jade', name: 'Jade', color: '#3aa06a', accent: '#c8ffe0', style: 'gem', unlock: { k: 'gems', n: 60 } },
    { id: 'prism', name: 'Prism', color: '#ff7ad8', accent: '#7affea', style: 'prism', unlock: { k: 'stars', n: 35 } },
    { id: 'royal', name: 'Royal', color: '#c09030', accent: '#fff0b0', style: 'metal', unlock: { k: 'stars', n: 70 } },
    { id: 'void', name: 'Voidblade', color: '#3a1a6a', accent: '#c08aff', style: 'field', unlock: { k: 'rush', n: 1 } },
    { id: 'pixel', name: 'Pixel', color: '#5ae07a', accent: '#ffffff', style: 'pixel', unlock: { k: 'level', n: 15 } },
    { id: 'frost', name: 'Frostfall', color: '#bfe8ff', accent: '#ffffff', style: 'gem', unlock: { k: 'festival', id: 'frost' } },
    { id: 'bloom', name: 'Blossom', color: '#ffb0d0', accent: '#ffffff', style: 'field', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunfest', color: '#ffd23a', accent: '#ff8a3a', style: 'metal', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'harvest', name: 'Harvest', color: '#c0602a', accent: '#ffd07a', style: 'field', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'hollow', name: 'Hollow Night', color: '#ff8a1a', accent: '#8a4aff', style: 'field', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'starfall', name: 'Starfall', color: '#2a2a6a', accent: '#ffd23a', style: 'prism', unlock: { k: 'festival', id: 'starfall' } },
  ];
  const BALLS = [
    { id: 'pearl', name: 'Pearl', color: '#ffffff', core: '#9ae8ff', unlock: { k: 'default' } },
    { id: 'sun', name: 'Sunball', color: '#ffd25a', core: '#ffffff', unlock: { k: 'stars', n: 5 } },
    { id: 'plasma', name: 'Plasma', color: '#ff5ad0', core: '#ffffff', unlock: { k: 'gems', n: 50 } },
    { id: 'emerald', name: 'Emerald', color: '#5ae07a', core: '#e0ffe8', unlock: { k: 'stars', n: 25 } },
    { id: 'eye', name: 'Watcher', color: '#ff4a4a', core: '#ffe0a0', unlock: { k: 'ach', n: 15 } },
    { id: 'comet', name: 'Comet', color: '#9ae8ff', core: '#ffffff', unlock: { k: 'level', n: 25 } },
    { id: 'gold', name: 'Golden', color: '#ffd23a', core: '#fff8d0', unlock: { k: 'stars', n: 90 } },
    { id: 'void', name: 'Singularity', color: '#8a5aff', core: '#05020c', unlock: { k: 'gems', n: 120 } },
  ];
  const TRAILS = [
    { id: 'spark', name: 'Sparks', kind: 'spark', color: '#9ae8ff', unlock: { k: 'default' } },
    { id: 'rainbow', name: 'Rainbow', kind: 'rainbow', color: '#ff7ad8', unlock: { k: 'stars', n: 15 } },
    { id: 'ember', name: 'Embers', kind: 'ember', color: '#ff8a2a', unlock: { k: 'gems', n: 40 } },
    { id: 'stars', name: 'Stardust', kind: 'star', color: '#ffe8a0', unlock: { k: 'level', n: 8 } },
    { id: 'bubbles', name: 'Bubbles', kind: 'bubble', color: '#a0fff0', unlock: { k: 'stars', n: 45 } },
    { id: 'hearts', name: 'Hearts', kind: 'heart', color: '#ff7a9a', unlock: { k: 'ach', n: 25 } },
    { id: 'snow', name: 'Snow', kind: 'snow', color: '#ffffff', unlock: { k: 'festival', id: 'frost' } },
    { id: 'petals', name: 'Petals', kind: 'petal', color: '#ffc0dc', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunbeams', kind: 'spark', color: '#ffd23a', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'leaves', name: 'Leaves', kind: 'leaf', color: '#e0902a', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'bats', name: 'Bats', kind: 'bat', color: '#5a2a7a', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'confetti', name: 'Confetti', kind: 'confetti', color: '#ffd23a', unlock: { k: 'festival', id: 'starfall' } },
  ];

  const MODES = [
    { id: 'story', name: 'Story', desc: 'Five fortresses, thirty stages, five guardians', icon: 'book' },
    { id: 'arcade', name: 'Arcade', desc: 'Endless walls with three balls, faster every wall', icon: 'flag' },
    { id: 'blitz', name: 'Blitz', desc: 'Two minutes, endless bricks, no lives to lose', icon: 'clock', time: 120 },
    { id: 'zen', name: 'Zen', desc: 'No lives, no clock, soft music', icon: 'leaf' },
    { id: 'daily', name: 'Daily Challenge', desc: 'Three minutes, one wall for everyone today, two mutators', icon: 'calendar', time: 180 },
    { id: 'rush', name: 'Boss Rush', desc: 'All five guardians back to back', icon: 'skull', need: 2 },
    { id: 'duo', name: 'Duo', desc: 'Co-op with Bolt guarding the top edge, bricks in the middle', icon: 'duo' },
    { id: 'arena', name: 'Arena', desc: 'Four paddles, four open edges: you and three CPU partners', icon: 'swords' },
  ];

  /* the CPU partners of the team modes by the edge they guard */
  const MATES = {
    top: { name: 'Bolt', who: 'bolt', paddle: 'chrome' },
    left: { name: 'Captain Orla', who: 'orla', paddle: 'jade' },
    right: { name: 'Bolt-2', who: 'bolt', paddle: 'ember' },
  };

  const A = [];
  const add = (id, name, desc, icon, test) => A.push({ id: id, name: name, desc: desc, icon: icon, test: test });
  add('b100', 'Brick Breaker', 'Break 100 bricks', 'brick', s => s.bricks >= 100);
  add('b1k', 'Demolisher', 'Break 1,000 bricks', 'brick', s => s.bricks >= 1000);
  add('b10k', 'Wrecking Crew', 'Break 10,000 bricks', 'brick', s => s.bricks >= 10000);
  add('c10', 'Chain', 'Reach a combo of 10', 'chain', s => s.best >= 10);
  add('c25', 'Long Chain', 'Reach a combo of 25', 'chain', s => s.best >= 25);
  add('c50', 'Unbroken', 'Reach a combo of 50', 'chain', s => s.best >= 50);
  add('p10', 'Power User', 'Catch 10 power-ups', 'bolt', s => s.powers >= 10);
  add('p200', 'Supercharged', 'Catch 200 power-ups', 'bolt', s => s.powers >= 200);
  add('bomb50', 'Boom', 'Set off 50 bombs', 'bomb', s => s.bombs >= 50);
  add('gold20', 'Treasure Hunter', 'Break 20 gold targets', 'star', s => s.gold >= 20);
  add('laser200', 'Trigger Happy', 'Fire 200 laser shots', 'laser', s => s.lasers >= 200);
  add('w1', 'Gardener', 'Defeat the Hedge Colossus', 'skull', s => s.bosses >= 1);
  add('w2', 'Icebreaker', 'Defeat the Frost Warden', 'skull', s => s.bosses >= 2);
  add('w3', 'Clock Stopper', 'Defeat the Gear Tyrant', 'skull', s => s.bosses >= 3);
  add('w4', 'Deep Diver', 'Defeat the Abyssal Kraken', 'skull', s => s.bosses >= 4);
  add('w5', 'Lightbringer', 'Defeat the Gloom Engine', 'crown', s => s.bosses >= 5);
  add('stars30', 'Star Collector', 'Earn 30 stars', 'star', s => s.stars >= 30);
  add('stars90', 'All the Stars', 'Earn all 90 stars', 'star', s => s.stars >= 90);
  add('flawless', 'Flawless', 'Finish a story stage without losing a ball', 'sparkle', s => s.flawless >= 1);
  add('flawless10', 'Untouchable', 'Finish 10 story stages without losing a ball', 'sparkle', s => s.flawless >= 10);
  add('a10', 'Wall Runner', 'Reach wall 10 in Arcade', 'flag', s => s.arcadeBest >= 10);
  add('a25', 'Marathon Pilot', 'Reach wall 25 in Arcade', 'flag', s => s.arcadeBest >= 25);
  add('blitz50k', 'Blitzed', 'Score 50,000 in Blitz', 'clock', s => s.blitzBest >= 50000);
  add('zen10', 'Inner Calm', 'Spend 10 minutes in Zen', 'leaf', s => s.zenSeconds >= 600);
  add('daily1', 'Daily Pilot', 'Finish a Daily Challenge', 'calendar', s => s.dailies >= 1);
  add('daily7', 'Regular', 'Finish 7 Daily Challenges', 'calendar', s => s.dailies >= 7);
  add('rush', 'Gauntlet', 'Win Boss Rush', 'skull', s => s.rushWins >= 1);
  add('duo5', 'Two Can Play', 'Reach wall 5 in Duo', 'duo', s => s.duoBest >= 5);
  add('arena5', 'Four Corners', 'Reach wall 5 in Arena', 'swords', s => s.arenaBest >= 5);
  add('team500', 'Teamwork', 'Let your partners return 500 balls', 'duo', s => s.mateHits >= 500);
  add('balls12', 'Ball Storm', 'Have 12 balls in play at once', 'multi', s => s.maxBalls >= 12);
  add('tree10', 'Engineer', 'Buy 10 tech tree levels', 'tree', s => s.treeLevels >= 10);
  add('treeAll', 'Chief Engineer', 'Buy every tech tree level', 'tree', s => s.treeLevels >= s.treeMax);
  add('style', 'Stylish', 'Own 5 paddles', 'palette', s => s.paddles >= 5);
  add('streak7', 'Week Streak', 'Play on 7 days in a row', 'calendar', s => s.streak >= 7);
  add('quests30', 'Errand Runner', 'Complete 30 daily quests', 'scroll', s => s.quests >= 30);
  add('level20', 'Seasoned', 'Reach player level 20', 'xp', s => s.level >= 20);
  add('level50', 'Veteran', 'Reach player level 50', 'xp', s => s.level >= 50);
  add('festival', 'Festive', 'Finish a festival reward track', 'gift', s => s.festivalDone >= 1);
  add('catchall', 'Collector', 'Catch 6 power-ups in one stage', 'bolt', s => s.bestCatch >= 6);
  add('crystal100', 'Crystal Clear', 'Break 100 crystal bricks', 'gem', s => s.crystals >= 100);

  const QUESTS = [
    { id: 'bricks', text: 'Break {n} bricks', n: [150, 250, 400], reward: 60 },
    { id: 'team', text: 'Clear {n} walls in Duo or Arena', n: [1, 2, 3], reward: 70 },
    { id: 'combo', text: 'Reach a combo of {n}', n: [10, 15, 20], reward: 70, max: true },
    { id: 'powers', text: 'Catch {n} power-ups', n: [5, 8, 12], reward: 60 },
    { id: 'stage', text: 'Finish {n} story stages', n: [1, 2, 3], reward: 80 },
    { id: 'score', text: 'Score {n} in one game', n: [10000, 25000, 50000], reward: 70, max: true },
    { id: 'bombs', text: 'Set off {n} bombs', n: [5, 10, 20], reward: 60 },
    { id: 'games', text: 'Play {n} games in any mode', n: [2, 3, 5], reward: 50 },
    { id: 'lasers', text: 'Fire {n} laser shots', n: [20, 40], reward: 50 },
    { id: 'zen', text: 'Spend {n} minutes in Zen', n: [3, 5], reward: 40 },
    { id: 'gold', text: 'Break {n} gold targets', n: [2, 4], reward: 70 },
  ];

  const TREE_BY_ID = {};
  for (const n of TREE) TREE_BY_ID[n.id] = n;
  const MODE_BY_ID = {};
  for (const m of MODES) MODE_BY_ID[m.id] = m;

  NS.metaData = { BRANCHES, TREE, TREE_BY_ID, PADDLES, BALLS, TRAILS, MODES, MODE_BY_ID, ACHIEVEMENTS: A, QUESTS, MATES };
})();
