/* The treat and its eras: eight evolution stages (cookie to bakery planet) with the run total
   each needs, the era name, its production bonus, three milestones and the transformation
   lines; the six decorations upgrades paint onto it; the cosmetics of the collection
   (treat skins, click-particle styles, kitchen themes) with how each one unlocks. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  /* milestone kinds: clicks, own (id), cps, golden, upgrades, combo, buildings (total) */
  const STAGES = [
    { id: 'cookie', name: 'Plain Cookie', era: 'The Little Kitchen', need: 0, bonus: 0,
      goals: [{ t: 'clicks', n: 30 }, { t: 'own', id: 'cursor', n: 5 }, { t: 'own', id: 'grandma', n: 1 }],
      lines: [['rosa', 'Every great bakery starts with one honest cookie. Click it, dear!']] },
    { id: 'chip', name: 'Chocolate-Chip Cookie', era: 'Chips Ahoy', need: 1e3, bonus: 0.1,
      goals: [{ t: 'own', id: 'grandma', n: 10 }, { t: 'cps', n: 25 }, { t: 'upgrades', n: 3 }],
      lines: [['rosa', 'Chocolate chips! Now the neighbours are lining up at the door.'], ['pip', 'I sneaked one. For quality control.']] },
    { id: 'frosted', name: 'Frosted Sprinkle Cookie', era: 'Sugar Rush', need: 1e5, bonus: 0.2,
      goals: [{ t: 'own', id: 'farm', n: 10 }, { t: 'golden', n: 1 }, { t: 'combo', n: 25 }],
      lines: [['pip', 'Pink frosting AND sprinkles? This is getting serious.'], ['baron', 'Hmph. A frosted cookie. Cute. My factories will crush you.']] },
    { id: 'cupcake', name: 'Cupcake', era: 'Rise of the Cupcake', need: 1e7, bonus: 0.35,
      goals: [{ t: 'own', id: 'factory', n: 10 }, { t: 'cps', n: 5e4 }, { t: 'buildings', n: 150 }],
      lines: [['rosa', 'The dough has risen into a cupcake! A wrapper, a swirl, a cherry...'], ['baron', 'Cupcakes?! That was MY next product line!']] },
    { id: 'layer', name: 'Layer Cake', era: 'Layers of Power', need: 1e9, bonus: 0.5,
      goals: [{ t: 'own', id: 'bank', n: 25 }, { t: 'golden', n: 7 }, { t: 'upgrades', n: 30 }],
      lines: [['pip', 'Two layers of sponge and a river of cream. I might cry.'], ['rosa', 'Layers are like friendships, Pip. Each one holds up the next.']] },
    { id: 'wedding', name: 'Wedding Cake', era: 'The Grand Celebration', need: 1e12, bonus: 0.75,
      goals: [{ t: 'own', id: 'wizard-tower', n: 25 }, { t: 'cps', n: 1e9 }, { t: 'combo', n: 75 }],
      lines: [['baron', 'Three tiers... pearls... a topper. I... I concede the wedding market.'], ['rosa', 'The whole world wants a slice now.']] },
    { id: 'cosmic', name: 'Cosmic Cake', era: 'Beyond the Oven', need: 1e15, bonus: 1,
      goals: [{ t: 'own', id: 'portal', n: 25 }, { t: 'golden', n: 25 }, { t: 'buildings', n: 900 }],
      lines: [['oracle', 'Your cake now bends starlight. The cosmos has noticed your kitchen.'], ['pip', 'Is it... humming?']] },
    { id: 'planet', name: 'Bakery Planet', era: 'A World of Cake', need: 1e18, bonus: 1.5,
      goals: [{ t: 'own', id: 'fractal-oven', n: 25 }, { t: 'cps', n: 1e15 }, { t: 'own', id: 'cake-singularity', n: 1 }],
      lines: [['oracle', 'The cake has become a world, and every grain of it is sugar.'], ['rosa', 'Well. I suppose we will need a bigger plate.']] },
  ];

  const CAST = {
    rosa: { name: 'Grandma Rosa', hair: '#e8e4f0', skin: '#f2c8a8', coat: '#c94f6d', accent: '#ffffff' },
    pip: { name: 'Pip the Apprentice', hair: '#7a4a2a', skin: '#f4d0b0', coat: '#4a90d9', accent: '#ffffff' },
    baron: { name: 'Baron Crumbleton', hair: '#2a2a2a', skin: '#e8b898', coat: '#3a3a4a', accent: '#ffd25a' },
    oracle: { name: 'The Sugar Oracle', hair: '#f0d0ff', skin: '#c8b0ff', coat: '#6a3aa0', accent: '#9affea' },
  };

  /* decorations painted onto the treat once their upgrade is owned (bit = 1 << index) */
  const DECOS = [
    { id: 'icing', name: 'Icing Drizzle' },
    { id: 'sprinkles', name: 'Rainbow Sprinkles' },
    { id: 'cherry', name: 'Cherry on Top' },
    { id: 'candles', name: 'Birthday Candles' },
    { id: 'goldleaf', name: 'Gold Leaf' },
    { id: 'starglaze', name: 'Starlight Glaze' },
  ];

  /* unlock kinds: default, stage (reach stage n ever), ach (achievement count), season (season id
     track reward), crystal (ascensions), bake (Bake-Off best score), golden (lifetime golden), garden
     (seeds discovered), trials (Sanctum Trials completed) */
  const SKINS = [
    { id: 'classic', name: 'Classic Butter', dough: '#d89a52', dark: '#8a5428', icing: '#f8c0d8', accent: '#5a3018', unlock: { k: 'default' } },
    { id: 'strawberry', name: 'Strawberry Swirl', dough: '#f0a0a8', dark: '#b85a6a', icing: '#fff0f4', accent: '#e83a5a', unlock: { k: 'stage', n: 2 } },
    { id: 'mint', name: 'Mint Chip', dough: '#a8e0c0', dark: '#4a9a78', icing: '#f0fff8', accent: '#3a2418', unlock: { k: 'ach', n: 15 } },
    { id: 'velvet', name: 'Red Velvet', dough: '#b03040', dark: '#701828', icing: '#fff8f0', accent: '#2a0a10', unlock: { k: 'stage', n: 4 } },
    { id: 'lemon', name: 'Lemon Drizzle', dough: '#f4dc6a', dark: '#b89a2a', icing: '#fffbe8', accent: '#e89a1a', unlock: { k: 'golden', n: 10 } },
    { id: 'midnight', name: 'Midnight Cocoa', dough: '#4a2e24', dark: '#24140e', icing: '#c8b8ff', accent: '#ffd25a', unlock: { k: 'ach', n: 40 } },
    { id: 'golden', name: 'Solid Gold', dough: '#f0c040', dark: '#a07818', icing: '#fff4c0', accent: '#fffbe0', unlock: { k: 'crystal', n: 1 } },
    { id: 'rainbow', name: 'Prismatic', dough: '#c8a0ff', dark: '#7a50c0', icing: '#a0f0ff', accent: '#ff60c0', unlock: { k: 'crystal', n: 5 } },
    { id: 'champion', name: 'Champion Crust', dough: '#e0a060', dark: '#904820', icing: '#ffd25a', accent: '#c0c0d0', unlock: { k: 'bake', n: 1e9 } },
    { id: 'frost', name: 'Frost Bite', dough: '#d8ecff', dark: '#7aa0c8', icing: '#ffffff', accent: '#4a7ab8', unlock: { k: 'season', id: 'winter' } },
    { id: 'blossom', name: 'Cherry Blossom', dough: '#ffd0e0', dark: '#d08aa0', icing: '#ffffff', accent: '#8ac060', unlock: { k: 'season', id: 'spring' } },
    { id: 'tropical', name: 'Tropical Mango', dough: '#ffb84a', dark: '#d07a1a', icing: '#fff0a0', accent: '#3ac0a0', unlock: { k: 'season', id: 'summer' } },
    { id: 'maple', name: 'Maple Crunch', dough: '#c8783a', dark: '#7a3e14', icing: '#f0c890', accent: '#a03018', unlock: { k: 'season', id: 'autumn' } },
    { id: 'pumpkin', name: 'Spooky Pumpkin', dough: '#f08a2a', dark: '#9a4a0a', icing: '#3a2a3a', accent: '#7aff5a', unlock: { k: 'season', id: 'halloween' } },
    { id: 'firework', name: 'Midnight Firework', dough: '#2a2a5a', dark: '#14143a', icing: '#ffd25a', accent: '#ff5ab4', unlock: { k: 'season', id: 'yearend' } },
    { id: 'herbal', name: 'Garden Herb', dough: '#b8d890', dark: '#5a8a3a', icing: '#fff8d0', accent: '#e86a8a', unlock: { k: 'garden', n: 8 } },
    { id: 'sanctum', name: 'Sanctum Glass', dough: '#d8c8ff', dark: '#8a6ad0', icing: '#ffffff', accent: '#9affea', unlock: { k: 'trials', n: 3 } },
    { id: 'ascendant', name: 'Ascendant Crown', dough: '#fff0c0', dark: '#c09030', icing: '#e59cff', accent: '#ffd25a', unlock: { k: 'trials', n: 6 } },
  ];

  const PARTICLES = [
    { id: 'crumbs', name: 'Crumbs', unlock: { k: 'default' } },
    { id: 'sprinkles', name: 'Sprinkles', unlock: { k: 'stage', n: 2 } },
    { id: 'stars', name: 'Stardust', unlock: { k: 'stage', n: 6 } },
    { id: 'hearts', name: 'Hearts', unlock: { k: 'ach', n: 25 } },
    { id: 'coins', name: 'Gold Coins', unlock: { k: 'golden', n: 50 } },
    { id: 'snow', name: 'Snowflakes', unlock: { k: 'season', id: 'winter' } },
    { id: 'petals', name: 'Petals', unlock: { k: 'season', id: 'spring' } },
    { id: 'leaves', name: 'Autumn Leaves', unlock: { k: 'season', id: 'autumn' } },
    { id: 'confetti', name: 'Confetti', unlock: { k: 'season', id: 'yearend' } },
  ];

  const THEMES = [
    { id: 'bakery', name: 'Cozy Bakery', top: '#4a2a1e', bottom: '#1e100a', glow: '#ffb45a', unlock: { k: 'default' } },
    { id: 'night', name: 'Night Shift', top: '#1a1a3a', bottom: '#080814', glow: '#8ab0ff', unlock: { k: 'stage', n: 3 } },
    { id: 'candy', name: 'Candy Land', top: '#ff9ac8', bottom: '#7a3a8a', glow: '#fff0a0', unlock: { k: 'bake', n: 1e6 } },
    { id: 'garden', name: 'Tea Garden', top: '#3a6a4a', bottom: '#14281a', glow: '#d0ffb0', unlock: { k: 'ach', n: 60 } },
    { id: 'cosmos', name: 'Starfield', top: '#140a30', bottom: '#020108', glow: '#c08aff', unlock: { k: 'stage', n: 6 } },
    { id: 'greenhouse', name: 'Greenhouse', top: '#2a5a3a', bottom: '#0a1a10', glow: '#ffe8a0', unlock: { k: 'garden', n: 17 } },
    { id: 'sanctum', name: 'Sugar Sanctum', top: '#2a1a4a', bottom: '#08040e', glow: '#e59cff', unlock: { k: 'trials', n: 6 } },
  ];

  const SEASON_IDS = ['winter', 'spring', 'summer', 'autumn', 'halloween', 'yearend'];

  NS.treatData = { STAGES, CAST, DECOS, SKINS, PARTICLES, THEMES, SEASON_IDS };
})();
