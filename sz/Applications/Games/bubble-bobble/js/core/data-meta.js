/* Everything a profile collects around the rooms: the tech tree (five branches, 25 nodes bought
   with shards), the collection (newt colours, bubble styles, pop trails; bought with gems, earned
   with stars, levels, achievements or festival tracks), the modes, the achievements and the daily quest
   pool. Pure data; achievements test a snapshot built by progress.snapshot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  const BRANCHES = [
    { id: 'breath', name: 'Breath', color: '#5ad0ff' },
    { id: 'power', name: 'Candy', color: '#ff9a3a' },
    { id: 'fortune', name: 'Fortune', color: '#ffd25a' },
    { id: 'guard', name: 'Guard', color: '#7be08a' },
    { id: 'mastery', name: 'Mastery', color: '#c8a0ff' },
  ];
  const TREE = [
    { id: 'range', branch: 'breath', name: 'Deep Breath', desc: 'Bubbles fly {p} farther', stat: 'range', per: 0.15, costs: [60, 160, 400], req: [], x: 0, y: 0 },
    { id: 'rate', branch: 'breath', name: 'Quick Puff', desc: 'Blow bubbles {p} faster', stat: 'rate', per: 0.15, costs: [100, 300], req: [['range', 1]], x: 0, y: 1 },
    { id: 'hold', branch: 'breath', name: 'Strong Skin', desc: 'Trapped enemies stay {p} longer', stat: 'trap', per: 0.15, costs: [150, 400], req: [['range', 1]], x: 1, y: 1 },
    { id: 'run', branch: 'breath', name: 'Light Feet', desc: 'Run {p} faster', stat: 'run', per: 0.06, costs: [200, 500], req: [['rate', 1]], x: 0, y: 2 },
    { id: 'calm', branch: 'breath', name: 'Calm Rooms', desc: 'Enemies move {p} slower', stat: 'slow', per: 0.05, costs: [250, 600], req: [['rate', 1]], x: 1, y: 2 },

    { id: 'drops', branch: 'power', name: 'Sweet Tooth', desc: '+{p} candy drops', stat: 'dropGain', per: 0.15, costs: [80, 200, 500], req: [], x: 0, y: 0 },
    { id: 'elements', branch: 'power', name: 'Weather Sense', desc: 'Elemental bubbles drift in {p} more often', stat: 'elements', per: 0.15, costs: [120, 300, 700], req: [['drops', 1]], x: 0, y: 1 },
    { id: 'u-big', branch: 'power', name: 'Big Bubbles', desc: 'Big Bubble candy can drop', stat: 'unlock:big', per: 1, costs: [250], req: [['drops', 1]], x: 1, y: 1 },
    { id: 'u-freeze', branch: 'power', name: 'Frost Pop', desc: 'Frost Pop candy can drop', stat: 'unlock:freeze', per: 1, costs: [350], req: [['u-big', 1]], x: 1, y: 2 },
    { id: 'u-magnet', branch: 'power', name: 'Fruit Magnet', desc: 'Fruit Magnet candy can drop', stat: 'unlock:magnet', per: 1, costs: [300], req: [['elements', 1]], x: 0, y: 2 },
    { id: 'u-bomb', branch: 'power', name: 'Pop Bomb', desc: 'Pop Bomb candy can drop', stat: 'unlock:bomb', per: 1, costs: [550], req: [['u-freeze', 1]], x: 1, y: 3 },
    { id: 'startshield', branch: 'power', name: 'Bubble Armour', desc: 'Start every room with a Bubble Shield', stat: 'startShield', per: 1, costs: [800], req: [['u-magnet', 1]], x: 0, y: 3 },

    { id: 'shards', branch: 'fortune', name: 'Shard Sense', desc: '+{p} shards from every game', stat: 'shardGain', per: 0.1, costs: [100, 250, 600, 1400], req: [], x: 0, y: 0 },
    { id: 'score', branch: 'fortune', name: 'Showmanship', desc: '+{p} score', stat: 'scoreGain', per: 0.05, costs: [120, 300, 700], req: [['shards', 1]], x: 0, y: 1 },
    { id: 'combo', branch: 'fortune', name: 'Chain Bonus', desc: '+{p} shards from long chains', stat: 'comboGain', per: 0.25, costs: [150, 400], req: [['shards', 1]], x: 1, y: 1 },
    { id: 'gems', branch: 'fortune', name: 'Gem Eye', desc: '+1 gem for every three-star stage', stat: 'starGems', per: 1, costs: [500], req: [['score', 1]], x: 0, y: 2 },

    { id: 'life', branch: 'guard', name: 'Spare Bubble', desc: '+1 life', stat: 'lives', per: 1, costs: [300, 900], req: [], x: 0, y: 0 },
    { id: 'invuln', branch: 'guard', name: 'Soft Landing', desc: 'Longer safety after a hit', stat: 'invuln', per: 0.5, costs: [300], req: [['life', 1]], x: 0, y: 1 },
    { id: 'damage', branch: 'guard', name: 'Heavy Bubbles', desc: '+{p} damage to guardians', stat: 'damage', per: 0.15, costs: [150, 400, 900], req: [['life', 1]], x: 1, y: 1 },
    { id: 'patience', branch: 'guard', name: 'Patience', desc: 'Enemies get angry 15 s later', stat: 'patience', per: 15, costs: [500], req: [['damage', 1]], x: 1, y: 2 },
    { id: 'revive', branch: 'guard', name: 'Second Chance', desc: 'Once per game, the last life comes back', stat: 'revive', per: 1, costs: [800], req: [['invuln', 1]], x: 0, y: 2 },

    { id: 'xp', branch: 'mastery', name: 'Fast Learner', desc: '+{p} XP', stat: 'xpGain', per: 0.15, costs: [100, 300, 700], req: [], x: 0, y: 0 },
    { id: 'quests', branch: 'mastery', name: 'Errand Pro', desc: '+{p} quest rewards', stat: 'questGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 0, y: 1 },
    { id: 'tokens', branch: 'mastery', name: 'Festive Spirit', desc: '+{p} festival tokens', stat: 'tokenGain', per: 0.25, costs: [200, 500], req: [['xp', 1]], x: 1, y: 1 },
    { id: 'master', branch: 'mastery', name: 'Bubble Master', desc: '+{p} everything earned (shards, XP, score)', stat: 'allGain', per: 0.05, costs: [1500, 3000, 6000], req: [['quests', 1], ['tokens', 1]], x: 0, y: 2 },
  ];

  /* unlock: default, gems (price), stars, level, ach (count), festival (season id), rush (wins) */
  const NEWTS = [
    { id: 'mint', name: 'Mint', color: '#7be0c0', accent: '#ff8ac0', style: 'field', unlock: { k: 'default' } },
    { id: 'snow', name: 'Snowy', color: '#e8f0ff', accent: '#5ad0ff', style: 'metal', unlock: { k: 'gems', n: 40 } },
    { id: 'ember', name: 'Ember', color: '#ff7a4a', accent: '#ffd07a', style: 'field', unlock: { k: 'stars', n: 10 } },
    { id: 'jade', name: 'Jade', color: '#3aa06a', accent: '#c8ffe0', style: 'gem', unlock: { k: 'gems', n: 60 } },
    { id: 'prism', name: 'Prism', color: '#ff7ad8', accent: '#7affea', style: 'prism', unlock: { k: 'stars', n: 35 } },
    { id: 'royal', name: 'Royal', color: '#c09030', accent: '#fff0b0', style: 'metal', unlock: { k: 'stars', n: 70 } },
    { id: 'void', name: 'Midnight', color: '#3a1a6a', accent: '#c08aff', style: 'field', unlock: { k: 'rush', n: 1 } },
    { id: 'pixel', name: 'Lime', color: '#5ae07a', accent: '#ffffff', style: 'pixel', unlock: { k: 'level', n: 15 } },
    { id: 'frost', name: 'Frostfall', color: '#bfe8ff', accent: '#ffffff', style: 'gem', unlock: { k: 'festival', id: 'frost' } },
    { id: 'bloom', name: 'Blossom', color: '#ffb0d0', accent: '#ffffff', style: 'field', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunfest', color: '#ffd23a', accent: '#ff8a3a', style: 'metal', unlock: { k: 'festival', id: 'sunfest' } },
    { id: 'harvest', name: 'Harvest', color: '#c0602a', accent: '#ffd07a', style: 'field', unlock: { k: 'festival', id: 'harvest' } },
    { id: 'hollow', name: 'Hollow Night', color: '#ff8a1a', accent: '#8a4aff', style: 'field', unlock: { k: 'festival', id: 'hollow' } },
    { id: 'starfall', name: 'Starfall', color: '#2a2a6a', accent: '#ffd23a', style: 'prism', unlock: { k: 'festival', id: 'starfall' } },
  ];
  const BUBBLES = [
    { id: 'pearl', name: 'Soap', color: '#bfe8ff', core: '#ffffff', unlock: { k: 'default' } },
    { id: 'sun', name: 'Sunball', color: '#ffd25a', core: '#ffffff', unlock: { k: 'stars', n: 5 } },
    { id: 'plasma', name: 'Plasma', color: '#ff5ad0', core: '#ffffff', unlock: { k: 'gems', n: 50 } },
    { id: 'emerald', name: 'Emerald', color: '#5ae07a', core: '#e0ffe8', unlock: { k: 'stars', n: 25 } },
    { id: 'heart', name: 'Heartfoam', color: '#ff7a9a', core: '#ffe0e8', unlock: { k: 'ach', n: 15 } },
    { id: 'comet', name: 'Comet', color: '#9ae8ff', core: '#ffffff', unlock: { k: 'level', n: 25 } },
    { id: 'gold', name: 'Golden', color: '#ffd23a', core: '#fff8d0', unlock: { k: 'stars', n: 90 } },
    { id: 'void', name: 'Nebula', color: '#8a5aff', core: '#ffe8ff', unlock: { k: 'gems', n: 120 } },
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
    { id: 'story', name: 'Story', desc: 'Five kingdoms, thirty rooms, five guardians', icon: 'book' },
    { id: 'arcade', name: 'Arcade', desc: 'Endless rooms with three lives, tougher every room', icon: 'flag' },
    { id: 'blitz', name: 'Blitz', desc: 'Three minutes, endless rooms, no lives to lose', icon: 'clock', time: 180 },
    { id: 'zen', name: 'Zen', desc: 'Nothing can hurt you, soft music', icon: 'leaf' },
    { id: 'daily', name: 'Daily Challenge', desc: 'Three minutes, the same rooms for everyone today, two mutators', icon: 'calendar', time: 180 },
    { id: 'rush', name: 'Boss Rush', desc: 'All five guardians back to back', icon: 'skull', need: 2 },
  ];

  const A = [];
  const add = (id, name, desc, icon, test) => A.push({ id: id, name: name, desc: desc, icon: icon, test: test });
  add('t50', 'Bubble Catcher', 'Trap 50 enemies', 'mega', s => s.trapped >= 50);
  add('t500', 'Bubble Wrangler', 'Trap 500 enemies', 'mega', s => s.trapped >= 500);
  add('t5k', 'Bubble Legend', 'Trap 5,000 enemies', 'mega', s => s.trapped >= 5000);
  add('c3', 'Triple Pop', 'Pop 3 trapped enemies in one chain', 'chain', s => s.bestChain >= 3);
  add('c5', 'Pop Party', 'Pop 5 trapped enemies in one chain', 'chain', s => s.bestChain >= 5);
  add('c7', 'Grand Finale', 'Pop 7 trapped enemies in one chain', 'chain', s => s.bestChain >= 7);
  add('fruit100', 'Fruit Basket', 'Collect 100 fruit', 'heart', s => s.fruit >= 100);
  add('fruit1k', 'Orchard', 'Collect 1,000 fruit', 'heart', s => s.fruit >= 1000);
  add('p20', 'Sweet Tooth', 'Eat 20 candies', 'bolt', s => s.powers >= 20);
  add('el50', 'Weather Maker', 'Pop 50 elemental bubbles', 'fire', s => s.elements >= 50);
  add('bounce100', 'Trampoline', 'Bounce on bubbles 100 times', 'wide', s => s.bounces >= 100);
  add('stars', 'Wish Upon', 'Collect five star bubbles for a life', 'star', s => s.starLives >= 1);
  add('w1', 'Unstuck', 'Defeat King Gummo', 'skull', s => s.bosses >= 1);
  add('w2', 'Wound Down', 'Defeat General Tinwhistle', 'skull', s => s.bosses >= 2);
  add('w3', 'Storm Chaser', 'Defeat Croakatoa', 'skull', s => s.bosses >= 3);
  add('w4', 'Sky Pirate No More', 'Defeat Captain Zephyr', 'skull', s => s.bosses >= 4);
  add('w5', 'Lagoon Hero', 'Defeat Baron Dryspell', 'crown', s => s.bosses >= 5);
  add('stars30', 'Star Collector', 'Earn 30 stars', 'star', s => s.stars >= 30);
  add('stars90', 'All the Stars', 'Earn all 90 stars', 'star', s => s.stars >= 90);
  add('flawless', 'Untouched', 'Finish a story room without losing a life', 'sparkle', s => s.flawless >= 1);
  add('flawless10', 'Untouchable', 'Finish 10 story rooms without losing a life', 'sparkle', s => s.flawless >= 10);
  add('a10', 'Room Hopper', 'Reach room 10 in Arcade', 'flag', s => s.arcadeBest >= 10);
  add('a25', 'Endless Bubbles', 'Reach room 25 in Arcade', 'flag', s => s.arcadeBest >= 25);
  add('blitz100k', 'Blitzed', 'Score 100,000 in Blitz', 'clock', s => s.blitzBest >= 100000);
  add('zen10', 'Inner Calm', 'Spend 10 minutes in Zen', 'leaf', s => s.zenSeconds >= 600);
  add('daily1', 'Daily Bubbler', 'Finish a Daily Challenge', 'calendar', s => s.dailies >= 1);
  add('daily7', 'Regular', 'Finish 7 Daily Challenges', 'calendar', s => s.dailies >= 7);
  add('rush', 'Gauntlet', 'Win Boss Rush', 'skull', s => s.rushWins >= 1);
  add('tree10', 'Researcher', 'Buy 10 tech tree levels', 'tree', s => s.treeLevels >= 10);
  add('treeAll', 'Scholar', 'Buy every tech tree level', 'tree', s => s.treeLevels >= s.treeMax);
  add('style', 'Colourful', 'Own 5 newt colours', 'palette', s => s.paddles >= 5);
  add('streak7', 'Week Streak', 'Play on 7 days in a row', 'calendar', s => s.streak >= 7);
  add('quests30', 'Errand Runner', 'Complete 30 daily quests', 'scroll', s => s.quests >= 30);
  add('level20', 'Seasoned', 'Reach player level 20', 'xp', s => s.level >= 20);
  add('level50', 'Veteran', 'Reach player level 50', 'xp', s => s.level >= 50);
  add('festival', 'Festive', 'Finish a festival reward track', 'gift', s => s.festivalDone >= 1);
  add('hurry', 'Cool Head', 'Clear 20 rooms before the hurry-up', 'clock', s => s.calm >= 20);

  const QUESTS = [
    { id: 'trapped', text: 'Trap {n} enemies', n: [20, 35, 50], reward: 60 },
    { id: 'chain', text: 'Pop a chain of {n}', n: [2, 3, 4], reward: 70, max: true },
    { id: 'fruit', text: 'Collect {n} fruit', n: [15, 25, 40], reward: 60 },
    { id: 'stage', text: 'Finish {n} story rooms', n: [1, 2, 3], reward: 80 },
    { id: 'score', text: 'Score {n} in one game', n: [20000, 50000, 100000], reward: 70, max: true },
    { id: 'elements', text: 'Pop {n} elemental bubbles', n: [3, 5, 8], reward: 60 },
    { id: 'games', text: 'Play {n} games in any mode', n: [2, 3, 5], reward: 50 },
    { id: 'powers', text: 'Eat {n} candies', n: [3, 5, 8], reward: 50 },
    { id: 'zen', text: 'Spend {n} minutes in Zen', n: [3, 5], reward: 40 },
    { id: 'bounces', text: 'Bounce on {n} bubbles', n: [5, 10], reward: 50 },
  ];

  const TREE_BY_ID = {};
  for (const n of TREE) TREE_BY_ID[n.id] = n;
  const MODE_BY_ID = {};
  for (const m of MODES) MODE_BY_ID[m.id] = m;

  NS.metaData = { BRANCHES, TREE, TREE_BY_ID, PADDLES: NEWTS, NEWTS, BALLS: BUBBLES, BUBBLES, TRAILS, MODES, MODE_BY_ID, ACHIEVEMENTS: A, QUESTS };
})();
