/* The long game: the tech tree (five branches of levelled nodes), the cosmetic catalogue (skins,
   bomb skins, trails) with how each unlocks, achievements, the daily and weekly quest pools,
   the seasons with their collectibles and event tracks, and the player ranks. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});

  const BRANCHES = [
    { id: 'arsenal', name: 'Arsenal', color: '#ff8a3c', icon: 'bomb' },
    { id: 'move', name: 'Mobility', color: '#4fd0ff', icon: 'speed' },
    { id: 'guard', name: 'Guardian', color: '#6fe07a', icon: 'heart' },
    { id: 'fortune', name: 'Fortune', color: '#ffd84a', icon: 'gem' },
    { id: 'gadget', name: 'Gadgets', color: '#c58bff', icon: 'remote' }
  ];

  /* text uses {v} for the value at a level; values[level - 1] is that level's effect */
  const TREE = [
    { id: 'a_bombs', branch: 'arsenal', row: 0, lane: 0, name: 'Bomb Bag', icon: 'bomb', costs: [40, 140, 360], values: [1, 2, 3], text: 'Start every stage with +{v} bombs', req: [] },
    { id: 'a_fire', branch: 'arsenal', row: 0, lane: 1, name: 'Blast Core', icon: 'fire', costs: [40, 140, 360], values: [1, 2, 3], text: 'Start every stage with +{v} fire', req: [] },
    { id: 'a_fuse', branch: 'arsenal', row: 1, lane: 0, name: 'Quick Fuse', icon: 'fuse', costs: [90, 220], values: [0.3, 0.6], text: 'Fuses burn {v}s faster', req: [['a_bombs', 1]] },
    { id: 'a_chain', branch: 'arsenal', row: 1, lane: 1, name: 'Chain Reactor', icon: 'chain', costs: [160], values: [1], text: 'Chained bombs blast +{v} further', req: [['a_fire', 1]] },
    { id: 'a_super', branch: 'arsenal', row: 2, lane: 0, name: 'Mega Bomb', icon: 'super', costs: [260], values: [1], text: 'Kills charge a Mega Bomb (C): a piercing blast of 6 that clears a cross', req: [['a_fuse', 1], ['a_chain', 1]] },
    { id: 'a_super2', branch: 'arsenal', row: 3, lane: 0, name: 'Mega Charge', icon: 'super', costs: [220, 440], values: [35, 70], text: 'The Mega Bomb charges {v}% faster', req: [['a_super', 1]] },

    { id: 'm_speed', branch: 'move', row: 0, lane: 0, name: 'Sneakers', icon: 'speed', costs: [50, 160, 380], values: [1, 2, 3], text: 'Start every stage with +{v} speed', req: [] },
    { id: 'm_kick', branch: 'move', row: 1, lane: 0, name: 'Kick Start', icon: 'kick', costs: [130], values: [1], text: 'Start every stage with Kick Boots', req: [['m_speed', 1]] },
    { id: 'm_dash', branch: 'move', row: 1, lane: 1, name: 'Dash', icon: 'dash', costs: [200], values: [1], text: 'Shift: a quick dash with a blink of invulnerability', req: [['m_speed', 1]] },
    { id: 'm_dash2', branch: 'move', row: 2, lane: 1, name: 'Afterburner', icon: 'dash', costs: [180, 360], values: [0.6, 1.2], text: 'Dash recharges {v}s sooner', req: [['m_dash', 1]] },
    { id: 'm_glove', branch: 'move', row: 2, lane: 0, name: 'Glove Start', icon: 'glove', costs: [240], values: [1], text: 'Start every stage with the Power Glove', req: [['m_kick', 1]] },

    { id: 'g_life', branch: 'guard', row: 0, lane: 0, name: 'Extra Heart', icon: 'heart', costs: [110, 320], values: [1, 2], text: '+{v} lives in Story and Arcade', req: [] },
    { id: 'g_inv', branch: 'guard', row: 0, lane: 1, name: 'Second Wind', icon: 'clock', costs: [70, 170], values: [1, 2], text: 'Respawn shield lasts +{v}s', req: [] },
    { id: 'g_shield', branch: 'guard', row: 1, lane: 0, name: 'Bubble Start', icon: 'shield', costs: [280], values: [1], text: 'Start every stage inside a Bubble Shield', req: [['g_life', 1]] },
    { id: 'g_heart', branch: 'guard', row: 1, lane: 1, name: 'Heart Finder', icon: 'heart', costs: [120, 260], values: [50, 100], text: 'Extra lives drop {v}% more often', req: [['g_inv', 1]] },
    { id: 'g_phoenix', branch: 'guard', row: 2, lane: 0, name: 'Phoenix', icon: 'phoenix', costs: [420], values: [1], text: 'Once per run, rise again on the spot instead of losing a life', req: [['g_shield', 1], ['g_heart', 1]] },

    { id: 'f_gems', branch: 'fortune', row: 0, lane: 0, name: 'Gem Polish', icon: 'gem', costs: [60, 180, 420], values: [20, 40, 70], text: '+{v}% gems from everything', req: [] },
    { id: 'f_magnet', branch: 'fortune', row: 0, lane: 1, name: 'Magnet Aura', icon: 'magnet', costs: [90, 230], values: [1.2, 2.2], text: 'Pickups within {v} tiles drift to you', req: [] },
    { id: 'f_combo', branch: 'fortune', row: 1, lane: 0, name: 'Combo Keeper', icon: 'chain', costs: [90, 210], values: [0.8, 1.6], text: 'Combo window +{v}s', req: [['f_gems', 1]] },
    { id: 'f_drop', branch: 'fortune', row: 1, lane: 1, name: 'Treasure Nose', icon: 'star', costs: [100, 260], values: [15, 30], text: '+{v}% power-ups under bricks', req: [['f_magnet', 1]] },
    { id: 'f_luck', branch: 'fortune', row: 2, lane: 1, name: 'Lucky Clover', icon: 'clover', costs: [300], values: [1], text: 'Rare power-ups twice as likely, skulls half as likely', req: [['f_drop', 1]] },

    { id: 't_dur', branch: 'gadget', row: 0, lane: 0, name: 'Overclock', icon: 'freeze', costs: [80, 200], values: [40, 80], text: 'Timed power-ups last {v}% longer', req: [] },
    { id: 't_time', branch: 'gadget', row: 0, lane: 1, name: 'Chrono', icon: 'clock', costs: [70, 160], values: [30, 60], text: '+{v}s on every stage timer', req: [] },
    { id: 't_radar', branch: 'gadget', row: 1, lane: 1, name: 'Radar', icon: 'radar', costs: [170], values: [1], text: 'The exit and hidden power-ups shimmer through bricks', req: [['t_time', 1]] },
    { id: 't_remote', branch: 'gadget', row: 1, lane: 0, name: 'Remote Start', icon: 'remote', costs: [320], values: [1], text: 'Start every stage with the Remote Fuse', req: [['t_dur', 1]] }
  ];
  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i) TREE_BY_ID[TREE[i].id] = TREE[i];

  /* unlock: free | buy (gems) | ach (achievement id) | event (season id) | world (cleared) | rank */
  const SKINS = [
    { id: 'classic', name: 'Classic Pip', unlock: { type: 'free' }, suit: '#3a6cf0', trim: '#ffffff', head: '#ffffff', face: '#ffc8a8', accent: '#ff4f7a', hat: '' },
    { id: 'nova', name: 'Nova Pink', unlock: { type: 'world', world: 0 }, suit: '#ff6fb5', trim: '#ffe0f0', head: '#ffe8f4', face: '#ffd2b8', accent: '#ffd84a', hat: 'bow' },
    { id: 'ninja', name: 'Shadow Ninja', unlock: { type: 'buy', cost: 400 }, suit: '#2a2a38', trim: '#ff3a4a', head: '#33334a', face: '#ffd2b8', accent: '#ff3a4a', hat: 'band' },
    { id: 'robo', name: 'Robo Pip', unlock: { type: 'world', world: 2 }, suit: '#8a98a8', trim: '#4ff0ff', head: '#c8d4e0', face: '#2a3440', accent: '#4ff0ff', hat: 'antenna' },
    { id: 'knight', name: 'Ember Knight', unlock: { type: 'world', world: 4 }, suit: '#b0b8c8', trim: '#ffd84a', head: '#d8dee8', face: '#ffd2b8', accent: '#ff5d3a', hat: 'helm' },
    { id: 'frog', name: 'Hopper Suit', unlock: { type: 'buy', cost: 250 }, suit: '#4fc04a', trim: '#e8ff9a', head: '#7ce06a', face: '#ffd2b8', accent: '#ffd84a', hat: 'eyes' },
    { id: 'gold', name: 'Golden Pip', unlock: { type: 'ach', ach: 'arcade_master' }, suit: '#e0a820', trim: '#fff2a8', head: '#ffe26a', face: '#ffd2b8', accent: '#ffffff', hat: 'crown' },
    { id: 'shade', name: 'Baron\'s Heir', unlock: { type: 'ach', ach: 'rush_clear' }, suit: '#4a2a6a', trim: '#c58bff', head: '#2a1a3a', face: '#e8d0ff', accent: '#c58bff', hat: 'tophat' },
    { id: 'snowman', name: 'Snow Buddy', unlock: { type: 'event', season: 'winter' }, suit: '#e8f4ff', trim: '#3a7ad0', head: '#ffffff', face: '#ffffff', accent: '#ff8a2a', hat: 'beanie' },
    { id: 'bunny', name: 'Spring Bunny', unlock: { type: 'event', season: 'spring' }, suit: '#f8d0ff', trim: '#ffffff', head: '#ffffff', face: '#ffd2b8', accent: '#ff8ac8', hat: 'ears' },
    { id: 'surfer', name: 'Beach Bomber', unlock: { type: 'event', season: 'summer' }, suit: '#ffb03a', trim: '#3ad8ff', head: '#ffffff', face: '#e8b088', accent: '#3ad8ff', hat: 'shades' },
    { id: 'pumpkin', name: 'Pumpkin Pip', unlock: { type: 'event', season: 'autumn' }, suit: '#3a2a4a', trim: '#ff8a1a', head: '#ff8a1a', face: '#2a1a0a', accent: '#6fd040', hat: 'stem' },
    { id: 'party', name: 'Party Popper', unlock: { type: 'event', season: 'yearend' }, suit: '#e03a6a', trim: '#ffd84a', head: '#ffffff', face: '#ffd2b8', accent: '#4fd0ff', hat: 'cone' }
  ];

  const BOMB_SKINS = [
    { id: 'classic', name: 'Classic', unlock: { type: 'free' }, body: '#2a2d3a', shine: '#7a8098', band: '#3a3e50' },
    { id: 'cherry', name: 'Cherry', unlock: { type: 'buy', cost: 150 }, body: '#c8202a', shine: '#ff8a90', band: '#3a8a2a' },
    { id: 'mine', name: 'Sea Mine', unlock: { type: 'buy', cost: 300 }, body: '#3a4a3a', shine: '#8aa88a', band: '#c8a020', spikes: true },
    { id: 'skull', name: 'Skull', unlock: { type: 'ach', ach: 'chain5' }, body: '#e8e4d8', shine: '#ffffff', band: '#2a2a2a', face: 'skull' },
    { id: 'snowball', name: 'Snowball', unlock: { type: 'event', season: 'winter' }, body: '#e8f4ff', shine: '#ffffff', band: '#9ac8f0' },
    { id: 'egg', name: 'Painted Egg', unlock: { type: 'event', season: 'spring' }, body: '#ffb8e0', shine: '#ffffff', band: '#7ad8ff', stripes: true },
    { id: 'coconut', name: 'Coconut', unlock: { type: 'event', season: 'summer' }, body: '#6a4a2a', shine: '#a88a5a', band: '#4a3018' },
    { id: 'pumpkin', name: 'Jack Bomb', unlock: { type: 'event', season: 'autumn' }, body: '#ff8a1a', shine: '#ffc070', band: '#c05a0a', face: 'jack' },
    { id: 'gift', name: 'Gift Box', unlock: { type: 'event', season: 'yearend' }, body: '#3ac06a', shine: '#8af0aa', band: '#ffd84a', ribbon: true }
  ];

  const TRAILS = [
    { id: 'none', name: 'No Trail', unlock: { type: 'free' }, color: '' },
    { id: 'sparks', name: 'Sparks', unlock: { type: 'buy', cost: 200 }, color: '#ffb347' },
    { id: 'stars', name: 'Stardust', unlock: { type: 'ach', ach: 'daily_first' }, color: '#ffe86a' },
    { id: 'hearts', name: 'Hearts', unlock: { type: 'ach', ach: 'streak7' }, color: '#ff6fa0' },
    { id: 'snow', name: 'Snowflakes', unlock: { type: 'event', season: 'winter' }, color: '#e8f8ff' },
    { id: 'petals', name: 'Petals', unlock: { type: 'event', season: 'spring' }, color: '#ffb8d8' },
    { id: 'bubbles', name: 'Bubbles', unlock: { type: 'event', season: 'summer' }, color: '#8ae8ff' },
    { id: 'leaves', name: 'Falling Leaves', unlock: { type: 'event', season: 'autumn' }, color: '#ff9a3a' },
    { id: 'confetti', name: 'Confetti', unlock: { type: 'event', season: 'yearend' }, color: '#ff5da0' }
  ];

  /* Achievements: lifetime stat thresholds */
  const ACHIEVEMENTS = [
    { id: 'first_blood', name: 'First Pop', desc: 'Defeat an enemy', stat: 'kills', goal: 1, gems: 10 },
    { id: 'kills100', name: 'Pest Control', desc: 'Defeat 100 enemies', stat: 'kills', goal: 100, gems: 60 },
    { id: 'kills1000', name: 'Exterminator', desc: 'Defeat 1000 enemies', stat: 'kills', goal: 1000, gems: 250 },
    { id: 'chain3', name: 'Triple Threat', desc: 'Defeat 3 enemies with one chain of blasts', stat: 'bestChain', goal: 3, gems: 40 },
    { id: 'chain5', name: 'Domino Master', desc: 'Defeat 5 enemies with one chain of blasts', stat: 'bestChain', goal: 5, gems: 120 },
    { id: 'blocks500', name: 'Demolition', desc: 'Destroy 500 bricks', stat: 'blocks', goal: 500, gems: 50 },
    { id: 'blocks5000', name: 'Urban Renewal', desc: 'Destroy 5000 bricks', stat: 'blocks', goal: 5000, gems: 200 },
    { id: 'world1', name: 'Verdant Ember', desc: 'Clear Meadow Gardens', stat: 'worlds', goal: 1, gems: 80 },
    { id: 'world3', name: 'Halfway Hero', desc: 'Clear three worlds', stat: 'worlds', goal: 3, gems: 160 },
    { id: 'world5', name: 'Spark Restored', desc: 'Clear the whole campaign', stat: 'worlds', goal: 5, gems: 400 },
    { id: 'stars30', name: 'Star Collector', desc: 'Earn 30 stars', stat: 'stars', goal: 30, gems: 120 },
    { id: 'stars105', name: 'Perfectionist', desc: 'Earn all 105 stars', stat: 'stars', goal: 105, gems: 600 },
    { id: 'arcade10k', name: 'Arcade Rookie', desc: 'Score 10,000 in Arcade', stat: 'arcadeBest', goal: 10000, gems: 60 },
    { id: 'arcade_master', name: 'Arcade Master', desc: 'Score 60,000 in Arcade', stat: 'arcadeBest', goal: 60000, gems: 300 },
    { id: 'combo8', name: 'Max Multiplier', desc: 'Reach a x8 combo', stat: 'bestCombo', goal: 8, gems: 100 },
    { id: 'zen200', name: 'Inner Peace', desc: 'Pop 200 bricks in Zen', stat: 'zenBlocks', goal: 200, gems: 60 },
    { id: 'daily_first', name: 'Daily Bread', desc: 'Finish a Daily Challenge', stat: 'dailyClears', goal: 1, gems: 50 },
    { id: 'daily7', name: 'Regular', desc: 'Finish 7 Daily Challenges', stat: 'dailyClears', goal: 7, gems: 200 },
    { id: 'streak3', name: 'Coming Back', desc: 'Play 3 days in a row', stat: 'streakBest', goal: 3, gems: 50 },
    { id: 'streak7', name: 'Devoted', desc: 'Play 7 days in a row', stat: 'streakBest', goal: 7, gems: 200 },
    { id: 'bosses5', name: 'Giant Slayer', desc: 'Defeat 5 bosses', stat: 'bosses', goal: 5, gems: 150 },
    { id: 'rush_clear', name: 'Gauntlet', desc: 'Survive the Boss Rush', stat: 'rushClears', goal: 1, gems: 300 },
    { id: 'kicks50', name: 'Footballer', desc: 'Kick 50 bombs', stat: 'kicks', goal: 50, gems: 60 },
    { id: 'throws30', name: 'Pitcher', desc: 'Throw 30 bombs', stat: 'throws', goal: 30, gems: 60 },
    { id: 'powerups200', name: 'Power Hungry', desc: 'Collect 200 power-ups', stat: 'powerups', goal: 200, gems: 100 },
    { id: 'curse5', name: 'Curse Breaker', desc: 'Lift a curse by blasting an enemy 5 times', stat: 'cursePass', goal: 5, gems: 80 },
    { id: 'tree10', name: 'Tinkerer', desc: 'Buy 10 tech tree levels', stat: 'treeLevels', goal: 10, gems: 100 },
    { id: 'season50', name: 'Festive', desc: 'Collect 50 seasonal tokens', stat: 'tokens', goal: 50, gems: 120 }
  ];
  const ACH_BY_ID = {};
  for (let i = 0; i < ACHIEVEMENTS.length; ++i) ACH_BY_ID[ACHIEVEMENTS[i].id] = ACHIEVEMENTS[i];

  /* Quest templates: progress is the growth of a lifetime stat since the quest was handed out */
  const QUESTS = [
    { id: 'q_blocks', text: 'Destroy {n} bricks', stat: 'blocks', n: [40, 80], gems: 30 },
    { id: 'q_kills', text: 'Defeat {n} enemies', stat: 'kills', n: [25, 50], gems: 35 },
    { id: 'q_power', text: 'Collect {n} power-ups', stat: 'powerups', n: [12, 25], gems: 30 },
    { id: 'q_levels', text: 'Clear {n} stages in any mode', stat: 'levels', n: [3, 6], gems: 40 },
    { id: 'q_gems', text: 'Pick up {n} gems', stat: 'gemsPicked', n: [30, 60], gems: 30 },
    { id: 'q_kicks', text: 'Kick or throw {n} bombs', stat: 'moves', n: [8, 16], gems: 30 },
    { id: 'q_zen', text: 'Spend {n} minutes in Zen', stat: 'zenMinutes', n: [3, 6], gems: 25 },
    { id: 'q_chain', text: 'Chain {n} bombs in one blast', stat: 'bestChainToday', n: [3, 4], gems: 35, best: true },
    { id: 'q_tokens', text: 'Collect {n} seasonal tokens', stat: 'tokens', n: [6, 12], gems: 40 },
    { id: 'q_bombs', text: 'Drop {n} bombs', stat: 'bombs', n: [60, 120], gems: 25 }
  ];

  /* Seasons by local date. yearend wins over winter in its window. */
  const SEASONS = [
    { id: 'winter', name: 'Winter Frost', token: 'Snowflakes', tokenIcon: 'snowflake', color: '#bfe8ff', tint: 'rgba(170,210,255,0.10)', particle: 'snow' },
    { id: 'spring', name: 'Spring Bloom', token: 'Painted Eggs', tokenIcon: 'egg', color: '#ffb8e0', tint: 'rgba(255,190,230,0.07)', particle: 'petals' },
    { id: 'summer', name: 'Summer Splash', token: 'Seashells', tokenIcon: 'shell', color: '#ffd84a', tint: 'rgba(255,230,140,0.08)', particle: 'motes' },
    { id: 'autumn', name: 'Harvest Moon', token: 'Pumpkins', tokenIcon: 'pumpkin', color: '#ff9a3a', tint: 'rgba(255,150,60,0.08)', particle: 'leaves' },
    { id: 'yearend', name: 'Starlight Festival', token: 'Gifts', tokenIcon: 'gift', color: '#ff5da0', tint: 'rgba(255,120,200,0.07)', particle: 'confetti' }
  ];

  const EVENT_TIERS = [
    { need: 10, reward: 'gems', gems: 60 },
    { need: 25, reward: 'bomb' },
    { need: 45, reward: 'trail' },
    { need: 70, reward: 'skin' },
    { need: 100, reward: 'gems', gems: 400 }
  ];

  const RANKS = [
    { xp: 0, name: 'Spark' }, { xp: 2000, name: 'Fuse' }, { xp: 8000, name: 'Firecracker' }, { xp: 20000, name: 'Blaster' },
    { xp: 45000, name: 'Demolisher' }, { xp: 90000, name: 'Inferno' }, { xp: 160000, name: 'Supernova' }, { xp: 260000, name: 'Legend' }
  ];

  Object.assign(NS.meta, {
    BRANCHES, TREE, TREE_BY_ID, SKINS, BOMB_SKINS, TRAILS, ACHIEVEMENTS, ACH_BY_ID, QUESTS, SEASONS, EVENT_TIERS, RANKS
  });
})();
