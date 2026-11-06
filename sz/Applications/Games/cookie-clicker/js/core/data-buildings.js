/* The eighteen producers in unlock order: base cost and base production, the palette their
   procedural icon and bakery scene are painted with, flavour text and the names of their five
   upgrade tiers. The first fourteen keep the ids of the original game so old saves map 1:1.
   Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  /* sky, ground, main, accent: scene and icon palette */
  const BUILDINGS = [
    { id: 'cursor', name: 'Cursor', cost: 15, cps: 0.1, sky: '#3a2a4a', ground: '#5a3e2c', main: '#f4f1ea', accent: '#5aa0ff',
      desc: 'Taps the treat for you, politely and forever.',
      tiers: ['Reinforced Index Finger', 'Carpal Tunnel Prevention', 'Ambidextrous', 'Thousand Fingers', 'Million Fingers'] },
    { id: 'grandma', name: 'Grandma', cost: 100, cps: 1, sky: '#4a3048', ground: '#6b4a34', main: '#c98fb8', accent: '#f2e6d8',
      desc: 'A sweet grandma who knows every recipe by heart.',
      tiers: ['Forwards from Grandma', 'Steel-plated Rolling Pins', 'Lubricated Dentures', 'Prune Juice', 'Double-thick Glasses'] },
    { id: 'farm', name: 'Farm', cost: 1100, cps: 8, sky: '#5aa6d8', ground: '#4f8a3a', main: '#c8473a', accent: '#f0d27a',
      desc: 'Grows cookie plants from cookie seeds.',
      tiers: ['Cheap Hoes', 'Fertilizer', 'Cookie Trees', 'Genetically-modified Cookies', 'Gingerbread Scarecrows'] },
    { id: 'mine', name: 'Mine', cost: 12000, cps: 47, sky: '#2a2230', ground: '#4a3a36', main: '#8a7a70', accent: '#ffb44a',
      desc: 'Digs up veins of raw cookie dough.',
      tiers: ['Sugar Gas', 'Megadrill', 'Ultradrill', 'Ultimadrill', 'H-bomb Mining'] },
    { id: 'factory', name: 'Factory', cost: 130000, cps: 260, sky: '#6a5a6a', ground: '#4a4448', main: '#a65a3a', accent: '#d8d8d8',
      desc: 'Conveyor belts of mass-produced goodness.',
      tiers: ['Sturdier Conveyor Belts', 'Child Labor', 'Sweatshop', 'Radium Reactors', 'Recombobulators'] },
    { id: 'bank', name: 'Bank', cost: 1.4e6, cps: 1400, sky: '#2e4a3a', ground: '#5a5246', main: '#e8e0c8', accent: '#ffd25a',
      desc: 'Earns cookies from the interest on cookies.',
      tiers: ['Taller Tellers', 'Scissor-resistant Credit Cards', 'Acid-proof Vaults', 'Chocolate Coins', 'Exponential Interest Rates'] },
    { id: 'temple', name: 'Temple', cost: 2e7, cps: 7800, sky: '#d88a4a', ground: '#a07a4a', main: '#f0d8a0', accent: '#ff8a3a',
      desc: 'Ancient rites turn prayer into pastry.',
      tiers: ['Golden Idols', 'Sacrifices', 'Delicious Blessing', 'Sun Festival', 'Enlarged Pantheon'] },
    { id: 'wizard-tower', name: 'Wizard Tower', cost: 3.3e8, cps: 44000, sky: '#24204a', ground: '#3a3450', main: '#6a5acd', accent: '#b8f0ff',
      desc: 'Conjures cookies with arcane recipes.',
      tiers: ['Pointier Hats', 'Beardlier Beards', 'Ancient Grimoires', 'Kitchen Curses', 'School of Sorcery'] },
    { id: 'shipment', name: 'Shipment', cost: 5.1e9, cps: 260000, sky: '#0e1430', ground: '#5a4a6a', main: '#d8e0f0', accent: '#ff6a3a',
      desc: 'Rockets cookies in from the Cookie Planet.',
      tiers: ['Vanilla Nebulae', 'Wormholes', 'Frequent Flyer', 'Warp Drive', 'Chocolate Monoliths'] },
    { id: 'alchemy-lab', name: 'Alchemy Lab', cost: 7.5e10, cps: 1.6e6, sky: '#2a3a2a', ground: '#4a3a2a', main: '#7ad8a0', accent: '#ffd25a',
      desc: 'Transmutes gold into cookies.',
      tiers: ['Antimony', 'Essence of Dough', 'True Chocolate', 'Ambrosia', 'Aqua Crustulae'] },
    { id: 'portal', name: 'Portal', cost: 1e12, cps: 1e7, sky: '#1a0a2a', ground: '#2a1a3a', main: '#c060ff', accent: '#60ffd8',
      desc: 'Opens a door to the Cookieverse.',
      tiers: ['Ancient Tablet', 'Insane Oatling Workers', 'Soul Bond', 'Sanity Dance', 'Brane Transplant'] },
    { id: 'time-machine', name: 'Time Machine', cost: 1.4e13, cps: 6.5e7, sky: '#2a2a3a', ground: '#3a3a4a', main: '#c0a060', accent: '#60c0ff',
      desc: 'Brings back cookies before they were eaten.',
      tiers: ['Flux Capacitors', 'Time Paradox Resolver', 'Quantum Conundrum', 'Causality Enforcer', 'Yestermorrow Comparators'] },
    { id: 'condenser', name: 'Antimatter Condenser', cost: 1.7e14, cps: 4.3e8, sky: '#0a1a2a', ground: '#1a2a3a', main: '#40d0ff', accent: '#ff40a0',
      desc: 'Condenses antimatter into antimatter cookies.',
      tiers: ['Sugar Bosons', 'String Theory', 'Large Macaron Collider', 'Big Bang Bake', 'Reverse Cyclotrons'] },
    { id: 'prism', name: 'Prism', cost: 2.1e15, cps: 2.9e9, sky: '#1a1a2a', ground: '#2a2a3a', main: '#e0f0ff', accent: '#ff60c0',
      desc: 'Converts pure light into crunchy cookies.',
      tiers: ['Gem Polish', '9th Color', 'Chocolate Light', 'Grainbow', 'Pure Cosmic Light'] },
    { id: 'fractal-oven', name: 'Fractal Oven', cost: 2.6e16, cps: 2.1e10, sky: '#3a1a1a', ground: '#4a2a1a', main: '#ff8a3a', accent: '#ffe08a',
      desc: 'An oven inside an oven inside an oven.',
      tiers: ['Self-similar Trays', 'Recursive Preheat', 'Mandelbrot Batter', 'Infinite Racks', 'Koch Crust'] },
    { id: 'dream-engine', name: 'Dream Engine', cost: 3.1e17, cps: 1.5e11, sky: '#3a2a5a', ground: '#5a4a7a', main: '#ffb0e0', accent: '#a0e0ff',
      desc: 'Bakes the cookies people dream about.',
      tiers: ['Lucid Whisks', 'Pillow Ovens', 'Sleepwalking Bakers', 'Shared Dreaming', 'REM Reactor'] },
    { id: 'sugar-nebula', name: 'Sugar Nebula', cost: 7.1e18, cps: 1.1e12, sky: '#0a0a24', ground: '#1a1440', main: '#ff9ad8', accent: '#9affea',
      desc: 'A star nursery that condenses into icing.',
      tiers: ['Stellar Sifting', 'Comet Sprinkles', 'Accretion Frosting', 'Pulsar Mixers', 'Galactic Glaze'] },
    { id: 'cake-singularity', name: 'Cake Singularity', cost: 1.2e20, cps: 8.3e12, sky: '#08040e', ground: '#140a1e', main: '#ffd25a', accent: '#ff5ab4',
      desc: 'Infinite cake density. Do not look directly at it.',
      tiers: ['Event Horizon Icing', 'Hawking Sprinkles', 'Spaghettified Dough', 'Frame-dragging Whisks', 'The Last Slice'] },
  ];

  const BY_ID = {};
  for (let i = 0; i < BUILDINGS.length; ++i) {
    BUILDINGS[i].index = i;
    const n = BUILDINGS[i].name;
    BUILDINGS[i].plural = /Nebula$/.test(n) ? n + 'e' : /y$/.test(n) ? n.slice(0, -1) + 'ies' : n + 's';
    BY_ID[BUILDINGS[i].id] = BUILDINGS[i];
  }

  /* owned count each tier upgrade needs, and its price as a multiple of the base cost */
  const TIER_OWNED = [1, 5, 25, 50, 100];
  const TIER_COST = [10, 50, 500, 50000, 5e6];

  NS.buildingData = { BUILDINGS, BY_ID, TIER_OWNED, TIER_COST };
})();
