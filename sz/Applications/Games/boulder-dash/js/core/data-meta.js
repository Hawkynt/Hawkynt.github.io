/* Meta-game tables: the game modes, the tech tree (branches, nodes, costs, effects), miner
   skins, dig trails, cave tile sets, achievements, the daily quest pool, the seasons and their
   event track. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  const MODES = {
    story: { name: 'Story', color: '#ffb347', desc: 'Five depths of Mount Ember, 40 caves, five bosses.' },
    arcade: { name: 'Arcade', color: '#ff5d5d', desc: 'Endless caves, rising danger, combo multiplier, 3 lives.' },
    zen: { name: 'Zen', color: '#8ff5dc', desc: 'No clock, no creatures, no death. Just dig and breathe.' },
    daily: { name: 'Daily Cave', color: '#5fd6ff', desc: 'One cave for everyone today, with a twist.' },
    time: { name: 'Time Attack', color: '#d58bff', desc: 'Two minutes. Every gem buys a second.' }
  };

  const BRANCHES = [
    { id: 'survival', name: 'Survival', color: '#ff7a6a' },
    { id: 'fortune', name: 'Fortune', color: '#ffd54a' },
    { id: 'demolition', name: 'Demolition', color: '#ff9a3c' },
    { id: 'chrono', name: 'Chrono', color: '#b39dff' },
    { id: 'explorer', name: 'Explorer', color: '#5fd6ff' }
  ];

  /* effect: perk key summed per level (per = amount per level) */
  const TREE = [
    { id: 'hardhat', branch: 'survival', tier: 0, name: 'Hard Hat', max: 1, cost: [120], effect: 'startShield', per: 1, desc: 'Start every cave wearing a hard hat.' },
    { id: 'lives', branch: 'survival', tier: 1, name: 'Spare Lamps', max: 2, cost: [160, 420], effect: 'lives', per: 1, req: ['hardhat'], desc: '+1 life in Arcade and Daily runs.' },
    { id: 'armor', branch: 'survival', tier: 1, name: 'Steel Brim', max: 2, cost: [200, 480], effect: 'shieldMax', per: 1, req: ['hardhat'], desc: 'Hard hats stack one higher.' },
    { id: 'escape', branch: 'survival', tier: 2, name: 'Lucky Escape', max: 2, cost: [380, 800], effect: 'escape', per: 0.15, req: ['lives'], desc: '15% chance per level to shrug off a deadly hit.' },
    { id: 'grit', branch: 'survival', tier: 2, name: 'Grit', max: 1, cost: [520], effect: 'grit', per: 1, req: ['armor'], desc: 'After a hit you are untouchable a moment longer.' },

    { id: 'gemvalue', branch: 'fortune', tier: 0, name: 'Gem Polish', max: 5, cost: [60, 120, 200, 320, 480], effect: 'gemValue', per: 0.1, desc: '+10% score per gem per level.' },
    { id: 'gold', branch: 'fortune', tier: 1, name: 'Prospector', max: 5, cost: [100, 180, 300, 460, 700], effect: 'goldGain', per: 0.1, req: ['gemvalue'], desc: '+10% gold from every source.' },
    { id: 'combo', branch: 'fortune', tier: 1, name: 'Rhythm', max: 3, cost: [140, 280, 520], effect: 'comboWindow', per: 0.3, req: ['gemvalue'], desc: 'Combo window +0.3 s per level.' },
    { id: 'magnet', branch: 'fortune', tier: 2, name: 'Strong Magnet', max: 2, cost: [260, 560], effect: 'magnetRadius', per: 1, req: ['combo'], desc: 'Gem magnet reaches one cell further.' },
    { id: 'luck', branch: 'fortune', tier: 2, name: 'Treasure Sense', max: 3, cost: [220, 440, 760], effect: 'extraPowerups', per: 1, req: ['gold'], desc: 'One more power-up hidden in every cave.' },

    { id: 'bombs', branch: 'demolition', tier: 0, name: 'Powder Pouch', max: 3, cost: [90, 210, 400], effect: 'startBombs', per: 1, desc: 'Start every cave with more dynamite.' },
    { id: 'fuse', branch: 'demolition', tier: 1, name: 'Short Fuse', max: 2, cost: [180, 380], effect: 'fuse', per: 0.2, req: ['bombs'], desc: 'Dynamite fuses burn 20% faster.' },
    { id: 'drill', branch: 'demolition', tier: 1, name: 'Diamond Bit', max: 2, cost: [160, 340], effect: 'drillDur', per: 4, req: ['bombs'], desc: 'Power drill lasts 4 s longer.' },
    { id: 'blast', branch: 'demolition', tier: 2, name: 'Big Bang', max: 1, cost: [900], effect: 'blast', per: 1, req: ['fuse'], desc: 'Dynamite blasts 5x5 instead of 3x3.' },
    { id: 'chain', branch: 'demolition', tier: 2, name: 'Chain Master', max: 2, cost: [300, 620], effect: 'chainBonus', per: 0.5, req: ['drill'], desc: 'Chain explosions score +50% per level.' },

    { id: 'clock', branch: 'chrono', tier: 0, name: 'Pocket Watch', max: 3, cost: [80, 180, 340], effect: 'timeBonus', per: 10, desc: '+10 s on every cave clock.' },
    { id: 'slow', branch: 'chrono', tier: 1, name: 'Slow Sand', max: 2, cost: [160, 360], effect: 'slowDur', per: 3, req: ['clock'], desc: 'Stopwatch lasts 3 s longer.' },
    { id: 'freeze', branch: 'chrono', tier: 1, name: 'Deep Frost', max: 2, cost: [160, 360], effect: 'freezeDur', per: 3, req: ['clock'], desc: 'Frost charm lasts 3 s longer.' },
    { id: 'powerdur', branch: 'chrono', tier: 2, name: 'Lasting Charms', max: 3, cost: [260, 520, 900], effect: 'powerDur', per: 0.15, req: ['slow'], desc: 'All timed power-ups last 15% longer.' },
    { id: 'laces', branch: 'chrono', tier: 2, name: 'Boot Laces', max: 2, cost: [240, 500], effect: 'bootsDur', per: 5, req: ['freeze'], desc: 'Swift boots last 5 s longer.' },

    { id: 'lantern', branch: 'explorer', tier: 0, name: 'Wide Wick', max: 3, cost: [70, 160, 300], effect: 'light', per: 1, desc: 'Your lamp lights one more cell in dark caves.' },
    { id: 'scout', branch: 'explorer', tier: 1, name: 'Scout', max: 1, cost: [200], effect: 'scout', per: 1, req: ['lantern'], desc: 'An arrow points to the exit once it opens.' },
    { id: 'sense', branch: 'explorer', tier: 1, name: 'Gem Sense', max: 1, cost: [320], effect: 'gemSense', per: 1, req: ['lantern'], desc: 'The minimap shows every gem.' },
    { id: 'nose', branch: 'explorer', tier: 2, name: 'Festive Nose', max: 2, cost: [180, 420], effect: 'tokens', per: 1, req: ['scout'], desc: 'One more seasonal token per cave.' },
    { id: 'zen', branch: 'explorer', tier: 2, name: 'Zen Garden', max: 1, cost: [400], effect: 'zenGold', per: 0.5, req: ['sense'], desc: 'Zen mode earns 50% more gold.' }
  ];

  /* hat: helmet beanie pumpkin ears party crown robot hood snow cap knight */
  const SKINS = [
    { id: 'classic', name: 'Classic Miner', helmet: '#ffcf3a', body: '#3d6fd0', trim: '#253f80', face: '#f2c49b', hat: 'helmet', unlock: { type: 'free' } },
    { id: 'amber', name: 'Amber Digger', helmet: '#ff9a2e', body: '#8b4a22', trim: '#ffcf7a', face: '#f2c49b', hat: 'helmet', unlock: { type: 'chapter', value: 1 } },
    { id: 'frost', name: 'Frost Parka', helmet: '#e8f6ff', body: '#3a9ad8', trim: '#ffffff', face: '#f6d2b4', hat: 'hood', unlock: { type: 'chapter', value: 2 } },
    { id: 'grotto', name: 'Shroom Druid', helmet: '#c04ad8', body: '#2f6a3e', trim: '#9dff6a', face: '#e8c09a', hat: 'cap', unlock: { type: 'chapter', value: 3 } },
    { id: 'magma', name: 'Forge Knight', helmet: '#6a6c74', body: '#a3301c', trim: '#ffb347', face: '#d9a27a', hat: 'knight', unlock: { type: 'chapter', value: 4 } },
    { id: 'crystal', name: 'Crystal Mage', helmet: '#d58bff', body: '#4a2f9a', trim: '#f0d4ff', face: '#f2c49b', hat: 'crown', unlock: { type: 'chapter', value: 5 } },
    { id: 'robot', name: 'Dig-O-Tron', helmet: '#b9c2cf', body: '#5d6b80', trim: '#5fd6ff', face: '#9aa6b8', hat: 'robot', unlock: { type: 'ach', value: 'arcade_25k' } },
    { id: 'golden', name: 'Golden Miner', helmet: '#ffe066', body: '#c9962a', trim: '#fff3b0', face: '#f2c49b', hat: 'helmet', unlock: { type: 'ach', value: 'gems_5000' } },
    { id: 'ninja', name: 'Shadow Digger', helmet: '#22232a', body: '#2c2e38', trim: '#ff4f6a', face: '#f2c49b', hat: 'beanie', unlock: { type: 'ach', value: 'daily_7' } },
    { id: 'tycoon', name: 'Mine Tycoon', helmet: '#2a2a2a', body: '#6b2d5c', trim: '#ffd54a', face: '#f2c49b', hat: 'party', unlock: { type: 'gold', value: 2500 } },
    { id: 'snowman', name: 'Snow Buddy', helmet: '#2a6fd0', body: '#f4f8ff', trim: '#ff6a3d', face: '#ffffff', hat: 'snow', unlock: { type: 'season', value: 'winter' } },
    { id: 'party', name: 'Party Popper', helmet: '#ff4fa0', body: '#2a1d6b', trim: '#ffd54a', face: '#f2c49b', hat: 'party', unlock: { type: 'season', value: 'yearend' } },
    { id: 'bunny', name: 'Spring Bunny', helmet: '#ffd6ea', body: '#ffb0cf', trim: '#ffffff', face: '#f8dcc4', hat: 'ears', unlock: { type: 'season', value: 'spring' } },
    { id: 'surfer', name: 'Beach Bum', helmet: '#ffe066', body: '#ff8a3c', trim: '#2fd0c8', face: '#e0a878', hat: 'cap', unlock: { type: 'season', value: 'summer' } },
    { id: 'scarecrow', name: 'Scarecrow', helmet: '#c9962a', body: '#6a8a3a', trim: '#e0c070', face: '#f2d8a0', hat: 'beanie', unlock: { type: 'season', value: 'autumn' } },
    { id: 'pumpkin', name: 'Jack o\' Miner', helmet: '#ff8a1a', body: '#3a2050', trim: '#7dff8a', face: '#ff8a1a', hat: 'pumpkin', unlock: { type: 'season', value: 'halloween' } }
  ];

  const TRAILS = [
    { id: 'none', name: 'No Trail', colors: [], unlock: { type: 'free' } },
    { id: 'dust', name: 'Dust Puffs', colors: ['#c9a27a', '#8b6a4a'], unlock: { type: 'free' } },
    { id: 'sparkle', name: 'Sparkles', colors: ['#fff6b0', '#ffd54a', '#ffffff'], unlock: { type: 'ach', value: 'gems_1000' } },
    { id: 'embers', name: 'Embers', colors: ['#ff7a2f', '#ffd54a', '#ff3d1a'], unlock: { type: 'chapter', value: 4 } },
    { id: 'prism', name: 'Prism', colors: ['#ff5d5d', '#ffd54a', '#7dff8a', '#5fd6ff', '#d58bff'], unlock: { type: 'ach', value: 'story_done' } },
    { id: 'hearts', name: 'Hearts', colors: ['#ff4fa0', '#ff9ac8'], unlock: { type: 'ach', value: 'streak_7' } },
    { id: 'snow', name: 'Snowfall', colors: ['#ffffff', '#cfefff'], unlock: { type: 'season', value: 'winter' } },
    { id: 'confetti', name: 'Confetti', colors: ['#ff4fa0', '#ffd54a', '#5fd6ff', '#7dff8a'], unlock: { type: 'season', value: 'yearend' } },
    { id: 'petals', name: 'Petals', colors: ['#ffc4e1', '#ffe3f0', '#ff9ac8'], unlock: { type: 'season', value: 'spring' } },
    { id: 'bubbles', name: 'Bubbles', colors: ['#bff6ff', '#7fe0ff'], unlock: { type: 'season', value: 'summer' } },
    { id: 'leaves', name: 'Leaves', colors: ['#e0802a', '#c9502a', '#e0c040'], unlock: { type: 'season', value: 'autumn' } },
    { id: 'ghosts', name: 'Wisps', colors: ['#c8ffd8', '#9dff6a'], unlock: { type: 'season', value: 'halloween' } }
  ];

  /* tile sets: auto follows the chapter */
  const TILESETS = [
    { id: 'auto', name: 'Chapter Colours', unlock: { type: 'free' } },
    { id: 'retro', name: 'Retro 8-bit', unlock: { type: 'ach', value: 'caves_25' } },
    { id: 'neon', name: 'Neon Night', unlock: { type: 'gold', value: 1500 } },
    { id: 'zen', name: 'Still Waters', unlock: { type: 'ach', value: 'zen_10' } },
    { id: 'frost', name: 'Glacier', unlock: { type: 'chapter', value: 2 } },
    { id: 'crystal', name: 'Amethyst', unlock: { type: 'chapter', value: 5 } }
  ];

  /* stat: lifetime counter (or 'best' value) checked against target */
  const ACHIEVEMENTS = [
    { id: 'first_gem', name: 'Shiny!', desc: 'Collect your first gem.', stat: 'gems', target: 1, gold: 20 },
    { id: 'gems_100', name: 'Pocketful', desc: 'Collect 100 gems.', stat: 'gems', target: 100, gold: 60 },
    { id: 'gems_1000', name: 'Gem Hoarder', desc: 'Collect 1,000 gems.', stat: 'gems', target: 1000, gold: 200 },
    { id: 'gems_5000', name: 'Mountain\'s Fortune', desc: 'Collect 5,000 gems.', stat: 'gems', target: 5000, gold: 600 },
    { id: 'cave_1', name: 'Way Out', desc: 'Clear a cave.', stat: 'caves', target: 1, gold: 30 },
    { id: 'caves_25', name: 'Tunnel Rat', desc: 'Clear 25 caves.', stat: 'caves', target: 25, gold: 200 },
    { id: 'caves_100', name: 'Deep Delver', desc: 'Clear 100 caves.', stat: 'caves', target: 100, gold: 600 },
    { id: 'crush_1', name: 'Look Out Below', desc: 'Crush a creature with a boulder.', stat: 'crushes', target: 1, gold: 40 },
    { id: 'crush_25', name: 'Rockfall Artist', desc: 'Crush 25 creatures.', stat: 'crushes', target: 25, gold: 250 },
    { id: 'butterfly', name: 'Metamorphosis', desc: 'Turn a butterfly into gems.', stat: 'butterflies', target: 1, gold: 60 },
    { id: 'boss_1', name: 'Giant Slayer', desc: 'Defeat a boss.', stat: 'bosses', target: 1, gold: 120 },
    { id: 'story_done', name: 'Light Bringer', desc: 'Finish the story.', stat: 'chapters', target: 5, gold: 1000 },
    { id: 'stars_60', name: 'Star Miner', desc: 'Earn 60 story stars.', stat: 'stars', target: 60, gold: 300 },
    { id: 'stars_120', name: 'Perfectionist', desc: 'Earn all 120 story stars.', stat: 'stars', target: 120, gold: 1500 },
    { id: 'combo_8', name: 'In The Groove', desc: 'Reach an x8 combo.', stat: 'bestCombo', target: 8, gold: 150 },
    { id: 'arcade_5k', name: 'High Roller', desc: 'Score 5,000 in one Arcade run.', stat: 'bestArcade', target: 5000, gold: 150 },
    { id: 'arcade_25k', name: 'Arcade Legend', desc: 'Score 25,000 in one Arcade run.', stat: 'bestArcade', target: 25000, gold: 600 },
    { id: 'daily_1', name: 'Daily Digger', desc: 'Play a Daily Cave.', stat: 'dailies', target: 1, gold: 50 },
    { id: 'daily_7', name: 'Regular', desc: 'Play 7 Daily Caves.', stat: 'dailies', target: 7, gold: 300 },
    { id: 'zen_10', name: 'Inner Peace', desc: 'Spend 10 minutes in Zen mode.', stat: 'zenTime', target: 600, gold: 200 },
    { id: 'bombs_50', name: 'Demolition Crew', desc: 'Set off 50 dynamite sticks.', stat: 'bombs', target: 50, gold: 200 },
    { id: 'chain_3', name: 'Chain Reaction', desc: 'Chain 3 powder barrels in one blast.', stat: 'bestChain', target: 3, gold: 200 },
    { id: 'streak_3', name: 'Coming Back', desc: 'Play 3 days in a row.', stat: 'bestStreak', target: 3, gold: 100 },
    { id: 'streak_7', name: 'Devoted', desc: 'Play 7 days in a row.', stat: 'bestStreak', target: 7, gold: 400 },
    { id: 'power_50', name: 'Charmed', desc: 'Pick up 50 power-ups.', stat: 'powerups', target: 50, gold: 200 },
    { id: 'push_200', name: 'Mover', desc: 'Push 200 boulders.', stat: 'pushes', target: 200, gold: 150 },
    { id: 'dig_5000', name: 'Excavator', desc: 'Dig 5,000 cells of dirt.', stat: 'dug', target: 5000, gold: 300 },
    { id: 'tokens_50', name: 'Festive Spirit', desc: 'Collect 50 seasonal tokens.', stat: 'tokens', target: 50, gold: 250 },
    { id: 'perfect', name: 'Flawless', desc: 'Earn three stars on a story cave.', stat: 'perfects', target: 1, gold: 80 },
    { id: 'time_60', name: 'Against The Clock', desc: 'Collect 60 gems in one Time Attack.', stat: 'bestTimeGems', target: 60, gold: 250 }
  ];

  /* daily quests: stat deltas made today count toward the target */
  const QUESTS = [
    { id: 'q_gems', text: 'Collect {n} gems', stat: 'gems', targets: [80, 150, 250], gold: [60, 100, 160] },
    { id: 'q_caves', text: 'Clear {n} caves', stat: 'caves', targets: [2, 3, 5], gold: [60, 90, 150] },
    { id: 'q_crush', text: 'Crush {n} creatures', stat: 'crushes', targets: [2, 4, 6], gold: [70, 110, 160] },
    { id: 'q_push', text: 'Push {n} boulders', stat: 'pushes', targets: [15, 30, 50], gold: [50, 80, 120] },
    { id: 'q_power', text: 'Pick up {n} power-ups', stat: 'powerups', targets: [3, 6, 10], gold: [60, 100, 150] },
    { id: 'q_bombs', text: 'Set off {n} dynamite', stat: 'bombs', targets: [3, 6, 10], gold: [60, 90, 140] },
    { id: 'q_dig', text: 'Dig {n} cells of dirt', stat: 'dug', targets: [200, 400, 700], gold: [50, 80, 130] },
    { id: 'q_tokens', text: 'Find {n} seasonal tokens', stat: 'tokens', targets: [3, 6, 10], gold: [70, 110, 170] },
    { id: 'q_zen', text: 'Relax {n} minutes in Zen', stat: 'zenTime', targets: [120, 240, 420], gold: [50, 80, 120], minutes: true },
    { id: 'q_bricks', text: 'Blast {n} brick walls', stat: 'bricks', targets: [10, 25, 40], gold: [60, 90, 140] }
  ];

  /* seasons by local date; the first match wins so festivals sit before their season */
  const SEASONS = [
    { id: 'yearend', name: 'Starfall Festival', from: [12, 24], to: [1, 6], token: 'Star Sparkler', color: '#ffd54a', color2: '#ff4fa0', decor: 'fireworks', skin: 'party', trail: 'confetti' },
    { id: 'halloween', name: 'Lantern Night', from: [10, 15], to: [11, 2], token: 'Candy Corn', color: '#ff8a1a', color2: '#9a4ad8', decor: 'bats', skin: 'pumpkin', trail: 'ghosts' },
    { id: 'winter', name: 'Frostlight', from: [12, 1], to: [2, 29], token: 'Snowflake', color: '#cfefff', color2: '#5fd6ff', decor: 'snow', skin: 'snowman', trail: 'snow' },
    { id: 'spring', name: 'Bloom Days', from: [3, 1], to: [5, 31], token: 'Painted Egg', color: '#ff9ac8', color2: '#7dff8a', decor: 'petals', skin: 'bunny', trail: 'petals' },
    { id: 'summer', name: 'Sunstone Summer', from: [6, 1], to: [8, 31], token: 'Sea Shell', color: '#ffe066', color2: '#2fd0c8', decor: 'sun', skin: 'surfer', trail: 'bubbles' },
    { id: 'autumn', name: 'Harvest Moon', from: [9, 1], to: [11, 30], token: 'Acorn', color: '#e0802a', color2: '#e0c040', decor: 'leaves', skin: 'scarecrow', trail: 'leaves' }
  ];

  /* event track tiers: tokens needed and the reward */
  const TRACK = [
    { need: 5, reward: { type: 'gold', value: 80 } },
    { need: 15, reward: { type: 'trail' } },
    { need: 30, reward: { type: 'gold', value: 200 } },
    { need: 50, reward: { type: 'skin' } },
    { need: 80, reward: { type: 'gold', value: 400 } },
    { need: 120, reward: { type: 'gold', value: 800 } }
  ];

  Object.assign(NS.meta, { MODES, BRANCHES, TREE, SKINS, TRAILS, TILESETS, ACHIEVEMENTS, QUESTS, SEASONS, TRACK });
})();
