/* Cosmetics and seasons as data: Pac-Man skins (body colours and an accessory), trails, maze
   themes, how each is unlocked (free, shard shop, achievement, story chapter or seasonal event
   tier), and the six seasonal events with their dates, collectible, palette accent and reward
   track. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  /* unlock: { by: 'free' | 'shop' | 'ach' | 'story' | 'season', cost, id, chapter } */
  const SKINS = [
    { id: 'classic', name: 'Classic', body: '#ffd23a', deep: '#e08a00', acc: '', unlock: { by: 'free' } },
    { id: 'bow', name: 'Ribbon', body: '#ffd23a', deep: '#e08a00', acc: 'bow', unlock: { by: 'shop', cost: 120 } },
    { id: 'cherry', name: 'Cherry Bomb', body: '#ff4a5a', deep: '#a00a2a', acc: 'leaf', unlock: { by: 'shop', cost: 180 } },
    { id: 'mint', name: 'Mint Chip', body: '#7affc8', deep: '#1a9a6a', acc: 'chips', unlock: { by: 'shop', cost: 220 } },
    { id: 'robot', name: 'Chrome-Bot', body: '#c8d4e8', deep: '#5a6a8a', acc: 'antenna', unlock: { by: 'shop', cost: 300 } },
    { id: 'ninja', name: 'Shadow Ninja', body: '#3a3a4a', deep: '#0a0a14', acc: 'band', unlock: { by: 'ach', id: 'ghost100' } },
    { id: 'pixel', name: '8-Bit', body: '#ffe23a', deep: '#c09a00', acc: 'pixel', unlock: { by: 'ach', id: 'arcade25k' } },
    { id: 'galaxy', name: 'Galaxy', body: '#5a3aff', deep: '#1a0a6a', acc: 'stars', unlock: { by: 'ach', id: 'streak7' } },
    { id: 'golden', name: 'Golden Gulp', body: '#ffd84a', deep: '#a07000', acc: 'shine', unlock: { by: 'ach', id: 'bosses5' } },
    { id: 'king', name: 'Lumen King', body: '#fff0a0', deep: '#ffb43a', acc: 'crown', unlock: { by: 'story', chapter: 5 } },
    { id: 'pumpkin', name: 'Jack-o-Pac', body: '#ff8a1a', deep: '#a04000', acc: 'stem', unlock: { by: 'season', id: 'halloween' } },
    { id: 'frosty', name: 'Frosty', body: '#f0f8ff', deep: '#8ab0d0', acc: 'scarf', unlock: { by: 'season', id: 'winter' } },
    { id: 'santa', name: 'Santa Pac', body: '#ffd23a', deep: '#e08a00', acc: 'santa', unlock: { by: 'season', id: 'yearend' } },
    { id: 'bunny', name: 'Bunny Hop', body: '#ffe8f4', deep: '#e0a0c0', acc: 'ears', unlock: { by: 'season', id: 'spring' } },
    { id: 'shades', name: 'Beach Pac', body: '#ffd23a', deep: '#e08a00', acc: 'shades', unlock: { by: 'season', id: 'summer' } },
    { id: 'acorn', name: 'Acorn', body: '#c8843a', deep: '#6a3a10', acc: 'cap', unlock: { by: 'season', id: 'autumn' } },
  ];

  const TRAILS = [
    { id: 'none', name: 'None', color: '#ffffff', unlock: { by: 'free' } },
    { id: 'sparkle', name: 'Sparkle', color: '#fff6a0', unlock: { by: 'free' } },
    { id: 'rainbow', name: 'Rainbow', color: '#ff5ad8', unlock: { by: 'shop', cost: 200 } },
    { id: 'fire', name: 'Fire', color: '#ff7a2a', unlock: { by: 'ach', id: 'combo6' } },
    { id: 'bubbles', name: 'Bubbles', color: '#8af0ff', unlock: { by: 'shop', cost: 150 } },
    { id: 'hearts', name: 'Hearts', color: '#ff5a8a', unlock: { by: 'ach', id: 'zen30' } },
    { id: 'snow', name: 'Snowfall', color: '#ffffff', unlock: { by: 'season', id: 'winter' } },
    { id: 'petals', name: 'Petals', color: '#ffb0d8', unlock: { by: 'season', id: 'spring' } },
    { id: 'leaves', name: 'Leaves', color: '#ff9a3a', unlock: { by: 'season', id: 'autumn' } },
    { id: 'bats', name: 'Bats', color: '#9a6aff', unlock: { by: 'season', id: 'halloween' } },
    { id: 'confetti', name: 'Confetti', color: '#ffd23a', unlock: { by: 'season', id: 'yearend' } },
    { id: 'bubblegum', name: 'Sunshine', color: '#ffe86a', unlock: { by: 'season', id: 'summer' } },
  ];

  /* Maze themes override the world look outside the story */
  const MAZE_THEMES = [
    { id: 'auto', name: 'World colours', unlock: { by: 'free' } },
    { id: 'retro', name: 'Retro Arcade', unlock: { by: 'free' },
      theme: { wall: '#000014', rim: '#2121ff', glow: '#4a4aff', floor: '#000000', grid: '#000000', dot: '#ffb8ae', skyTop: '#000000', skyBottom: '#0a0a2a', accent: '#ffd23a', tex: 'none', backdrop: 'city', ambient: 'none' } },
    { id: 'synth', name: 'Synthwave', unlock: { by: 'shop', cost: 250 },
      theme: { wall: '#2a0a3a', rim: '#ff3ad8', glow: '#ff6ae0', floor: '#0a0218', grid: '#3a0a5a', dot: '#7af0ff', skyTop: '#0a0228', skyBottom: '#ff3a8a', accent: '#ffd23a', tex: 'grid', backdrop: 'synth', ambient: 'none' } },
    { id: 'blueprint', name: 'Blueprint', unlock: { by: 'shop', cost: 180 },
      theme: { wall: '#0a3a8a', rim: '#e0f0ff', glow: '#a0d0ff', floor: '#082a6a', grid: '#1a4a9a', dot: '#ffffff', skyTop: '#06204a', skyBottom: '#0a3a7a', accent: '#ffffff', tex: 'grid', backdrop: 'glacier', ambient: 'none' } },
    { id: 'gold', name: 'Gold Rush', unlock: { by: 'ach', id: 'shards1000' },
      theme: { wall: '#3a2a04', rim: '#ffd23a', glow: '#ffe88a', floor: '#0a0802', grid: '#2a2004', dot: '#fff4c0', skyTop: '#0a0602', skyBottom: '#3a2604', accent: '#ffffff', tex: 'circuit', backdrop: 'volcano', ambient: 'embers' } },
    { id: 'season', name: 'Season colours', unlock: { by: 'free' } },
  ];

  /* Seasonal events by local date (month 1-12). Year-end and Halloween win over the plain seasons.
     tint: colours mixed into the maze; token: the collectible; track: tokens needed per tier */
  const SEASONS = [
    { id: 'yearend', name: 'Starlight Festival', token: 'gift', tokenName: 'Gift', tokenPlural: 'gifts', from: [12, 15], to: [1, 6], color: '#ffd23a', tint: '#ff3a5a', ambient: 'fireworks',
      rewards: ['shards:60', 'trail:confetti', 'shards:120', 'skin:santa', 'shards:250'] },
    { id: 'halloween', name: 'Night of Lanterns', token: 'pumpkin', tokenName: 'Pumpkin', tokenPlural: 'pumpkins', from: [10, 15], to: [11, 2], color: '#ff8a1a', tint: '#8a3aff', ambient: 'bats',
      rewards: ['shards:60', 'trail:bats', 'shards:120', 'skin:pumpkin', 'shards:250'] },
    { id: 'winter', name: 'Frostfall', token: 'flake', tokenName: 'Snowflake', tokenPlural: 'snowflakes', from: [12, 1], to: [2, 29], color: '#bff4ff', tint: '#8ad0ff', ambient: 'snow',
      rewards: ['shards:60', 'trail:snow', 'shards:120', 'skin:frosty', 'shards:250'] },
    { id: 'spring', name: 'Bloom Parade', token: 'egg', tokenName: 'Egg', tokenPlural: 'eggs', from: [3, 1], to: [5, 31], color: '#ffb0d8', tint: '#7aff9a', ambient: 'petals',
      rewards: ['shards:60', 'trail:petals', 'shards:120', 'skin:bunny', 'shards:250'] },
    { id: 'summer', name: 'Sunsplash', token: 'shell', tokenName: 'Seashell', tokenPlural: 'seashells', from: [6, 1], to: [8, 31], color: '#ffe86a', tint: '#3ad8ff', ambient: 'sunmotes',
      rewards: ['shards:60', 'trail:bubblegum', 'shards:120', 'skin:shades', 'shards:250'] },
    { id: 'autumn', name: 'Harvest Moon', token: 'leaf', tokenName: 'Maple Leaf', tokenPlural: 'maple leaves', from: [9, 1], to: [11, 30], color: '#ff9a3a', tint: '#ff6a2a', ambient: 'leaves',
      rewards: ['shards:60', 'trail:leaves', 'shards:120', 'skin:acorn', 'shards:250'] },
  ];
  const SEASON_TRACK = [10, 25, 45, 70, 100];

  function byId(list) {
    const out = {};
    for (let i = 0; i < list.length; ++i) out[list[i].id] = list[i];
    return out;
  }

  Object.assign(NS.cosmetics, {
    SKINS, TRAILS, MAZE_THEMES, SEASONS, SEASON_TRACK,
    SKIN_BY_ID: byId(SKINS), TRAIL_BY_ID: byId(TRAILS), THEME_BY_ID: byId(MAZE_THEMES), SEASON_BY_ID: byId(SEASONS)
  });
})();
