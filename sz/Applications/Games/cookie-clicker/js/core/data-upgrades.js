/* The upgrade table, generated: five doubling tiers per producer, mice (click power and a
   share of production per click), flavour cookies (global production), treat decorations that
   also show on the treat, golden-event charms, milk (achievement power), era recipes and combo
   tools, each with its price, the condition that reveals it and the icon it is drawn with.
   Also the map from the original game's upgrade ids. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { BUILDINGS, TIER_OWNED, TIER_COST } = NS.buildingData;
  const { STAGES, DECOS } = NS.treatData;

  const UPGRADES = [];
  function add(u) {
    UPGRADES.push(u);
  }

  /* producer tiers: x2 each */
  for (let b = 0; b < BUILDINGS.length; ++b) {
    const def = BUILDINGS[b];
    for (let t = 0; t < 5; ++t)
      add({ id: 't-' + def.id + '-' + t, name: def.tiers[t], kind: 'tier', target: def.id, tier: t, mult: 2,
        cost: def.cost * TIER_COST[t], req: { own: def.id, n: TIER_OWNED[t] }, icon: 'b:' + def.id,
        desc: def.name + ' production x2' });
  }

  /* mice: x2 clicks; from the third on also +1% of production per click */
  const MICE = ['Wooden Mouse', 'Plastic Mouse', 'Iron Mouse', 'Titanium Mouse', 'Adamantium Mouse', 'Unobtainium Mouse', 'Eludium Mouse', 'Wishalloy Mouse'];
  for (let i = 0; i < MICE.length; ++i)
    add({ id: 'm' + i, name: MICE[i], kind: 'click', mult: 2, cpsShare: i >= 2 ? 0.01 : 0, cost: 500 * Math.pow(100, i),
      req: i ? { baked: 500 * Math.pow(100, i) * 0.4 } : { clicks: 40 }, icon: 'mouse', tierColor: i,
      desc: 'Clicks x2' + (i >= 2 ? ', +1% of production per click' : '') });

  /* flavour cookies: global production */
  const FLAVOURS = [
    ['g-sugar', 'Sugar Cubes', 5000, 1.05], ['g-butter', 'Butter Pats', 5e4, 1.05], ['g-vanilla', 'Vanilla Pods', 5e5, 1.08],
    ['g-lucky', 'Lucky Day', 7777777, 1.1], ['g-seren', 'Serendipity', 77777777, 1.1], ['g-getlucky', 'Get Lucky', 777777777, 1.1],
    ['g-fortune', 'Fortune', 7777777777, 1.15], ['g-prosper', 'Prosperity', 77777777777, 1.15], ['g-provid', 'Providence', 777777777777, 1.2],
    ['g-destiny', 'Destiny Manifest', 7777777777777, 1.25], ['g-macad', 'Macadamia Royale', 7.7e15, 1.25], ['g-dragon', 'Dragon Dough', 7.7e17, 1.3],
    ['g-ambro', 'Ambrosia Shortbread', 7.7e19, 1.3], ['g-infin', 'Infinity Wafer', 7.7e21, 1.35], ['g-omega', 'Omega Biscotti', 7.7e23, 1.4],
  ];
  for (let i = 0; i < FLAVOURS.length; ++i) {
    const f = FLAVOURS[i];
    add({ id: f[0], name: f[1], kind: 'global', mult: f[3], cost: f[2], req: { baked: f[2] * 0.3 }, icon: 'flavour', tierColor: i,
      desc: '+' + Math.round((f[3] - 1) * 100) + '% production' });
  }

  /* decorations: visible on the treat, x1.05 production and x1.5 clicks */
  const DECO_COST = [1e4, 2e5, 3e7, 5e9, 5e12, 5e15];
  for (let i = 0; i < DECOS.length; ++i)
    add({ id: 'd-' + DECOS[i].id, name: DECOS[i].name, kind: 'deco', deco: i, mult: 1.05, clickMult: 1.5, cost: DECO_COST[i],
      req: { stage: i + 1 }, icon: 'deco:' + DECOS[i].id, desc: 'Decorates the treat. +5% production, clicks x1.5' });

  /* golden-event charms */
  add({ id: 'gc-charm', name: 'Lucky Charm', kind: 'golden', goldenFreq: 0.15, cost: 7.7e4, req: { golden: 1 }, icon: 'golden', desc: 'Golden treats appear 15% more often' });
  add({ id: 'gc-shoe', name: 'Golden Horseshoe', kind: 'golden', goldenDur: 0.25, cost: 7.7e7, req: { golden: 7 }, icon: 'golden', desc: 'Golden buffs last 25% longer' });
  add({ id: 'gc-clover', name: 'Four-leaf Clover', kind: 'golden', goldenFreq: 0.15, cost: 7.7e10, req: { golden: 27 }, icon: 'golden', desc: 'Golden treats appear 15% more often' });
  add({ id: 'gc-goose', name: 'Golden Goose', kind: 'golden', luckyMul: 1, cost: 7.7e13, req: { golden: 77 }, icon: 'golden', desc: 'Lucky payouts are doubled' });

  /* milk: each achievement gives +1% production; milk strengthens that */
  const MILK = ['Plain Milk', 'Chocolate Milk', 'Strawberry Milk', 'Honey Milk', 'Starlight Milk'];
  const MILK_ACH = [10, 25, 50, 75, 100];
  for (let i = 0; i < MILK.length; ++i)
    add({ id: 'k' + i, name: MILK[i], kind: 'milk', milk: 0.25, cost: 9e5 * Math.pow(1000, i), req: { ach: MILK_ACH[i] }, icon: 'milk', tierColor: i,
      desc: 'Achievements give 25% more production' });

  /* era recipes: one per stage reached */
  for (let s = 1; s < STAGES.length; ++s)
    add({ id: 'e' + s, name: 'Recipe: ' + STAGES[s].name, kind: 'global', mult: 1.2, cost: Math.max(5e3, STAGES[s].need * 5), req: { stage: s },
      icon: 'recipe', tierColor: s, desc: '+20% production. Written down in the ' + STAGES[s].era + ' era' });

  /* combo tools */
  add({ id: 'c-pin', name: 'Rhythm Rolling Pin', kind: 'combo', comboCap: 25, cost: 2e4, req: { combo: 10 }, icon: 'combo', desc: 'Combo cap +25' });
  add({ id: 'c-metro', name: 'Kitchen Metronome', kind: 'combo', comboWindow: 0.35, cost: 2e7, req: { combo: 40 }, icon: 'combo', desc: 'Combos last 0.35 s longer between clicks' });
  add({ id: 'c-drum', name: 'Drum Whisk', kind: 'combo', comboPower: 0.5, cost: 2e10, req: { combo: 80 }, icon: 'combo', desc: 'Each combo step is worth 50% more' });

  const BY_ID = {};
  for (let i = 0; i < UPGRADES.length; ++i) {
    UPGRADES[i].index = i;
    BY_ID[UPGRADES[i].id] = UPGRADES[i];
  }

  /* the original game's upgrade ids */
  const LEGACY = {
    u20: 'm1', u21: 'm2', u22: 'm3', u76: 'm4', u77: 'm5', u78: 'm6',
    u23: 'g-lucky', u24: 'g-seren', u25: 'g-getlucky', u79: 'g-fortune', u80: 'g-prosper', u81: 'g-provid', u82: 'g-destiny',
  };
  const OLD_TIERS = {
    cursor: ['u01', 'u02', 'u03', 'u50', 'u51'], grandma: ['u04', 'u05', 'u06', 'u52'], farm: ['u07', 'u08', 'u09', 'u53'],
    mine: ['u10', 'u11', 'u12', 'u54'], factory: ['u13', 'u14', 'u15', 'u55'], bank: ['u16', 'u17', 'u56', 'u57'],
    temple: ['u18', 'u58', 'u59'], 'wizard-tower': ['u19', 'u60', 'u61'], shipment: ['u62', 'u63', 'u64'],
    'alchemy-lab': ['u65', 'u66', 'u67'], portal: ['u68', 'u69'], 'time-machine': ['u70', 'u71'], condenser: ['u72', 'u73'], prism: ['u74', 'u75'],
  };
  for (const bid in OLD_TIERS)
    for (let t = 0; t < OLD_TIERS[bid].length; ++t) LEGACY[OLD_TIERS[bid][t]] = 't-' + bid + '-' + t;

  NS.upgradeData = { UPGRADES, BY_ID, LEGACY };
})();
