/* The tech tree on two pages: the Test Kitchen (Ovens, Hands, Fortune, Logistics, Science),
   researched with recipe notes, and the Sugar Sanctum (Heritage, Destiny, Ascension), bought
   with unspent sugar crystals. Every node has level costs, prerequisites, a grid place and the
   stat each level adds (summed by economy.treeStat). The tree survives ascension. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  const PAGES = [
    { id: 'kitchen', name: 'Test Kitchen', currency: 'notes' },
    { id: 'sanctum', name: 'Sugar Sanctum', currency: 'crystals' },
  ];

  const BRANCHES = [
    { id: 'ovens', name: 'Ovens', color: '#ff9a4a', icon: 'oven', page: 0 },
    { id: 'hands', name: 'Hands', color: '#5ab4ff', icon: 'hand', page: 0 },
    { id: 'fortune', name: 'Fortune', color: '#ffd25a', icon: 'golden', page: 0 },
    { id: 'logistics', name: 'Logistics', color: '#7be08a', icon: 'clock', page: 0 },
    { id: 'science', name: 'Science', color: '#c08aff', icon: 'flask', page: 0 },
    { id: 'heritage', name: 'Heritage', color: '#ff8ac8', icon: 'crystal', page: 1 },
    { id: 'destiny', name: 'Destiny', color: '#8affe8', icon: 'star', page: 1 },
    { id: 'ascension', name: 'Ascension', color: '#e59cff', icon: 'wing', page: 1 },
  ];

  /* per: what one level adds to stat; fmt: {p} = per as percent, {v} = per as value */
  const TREE = [
    { id: 'o_heat', branch: 'ovens', name: 'Hotter Ovens', icon: 'oven', row: 0, lane: 0, stat: 'prod', per: 0.05, fmt: '+{p} production', costs: [1, 2, 3, 5, 8], req: [] },
    { id: 'o_cheap', branch: 'ovens', name: 'Bulk Flour', icon: 'sack', row: 0, lane: 1, stat: 'discount', per: 0.02, fmt: 'Producers cost {p} less', costs: [2, 4, 6, 9], req: [] },
    { id: 'o_trays', branch: 'ovens', name: 'Bigger Trays', icon: 'tray', row: 1, lane: 0, stat: 'prod', per: 0.1, fmt: '+{p} production', costs: [3, 5, 8, 12], req: [['o_heat', 2]] },
    { id: 'o_variety', branch: 'ovens', name: 'Mixed Menu', icon: 'cake', row: 1, lane: 1, stat: 'variety', per: 0.01, fmt: '+{p} production per producer type owned', costs: [4, 7, 11], req: [['o_cheap', 1]] },
    { id: 'o_master', branch: 'ovens', name: 'Master Baker', icon: 'hat', row: 2, lane: 0.5, stat: 'prod', per: 0.25, fmt: '+{p} production', costs: [20], req: [['o_trays', 3], ['o_variety', 1]] },

    { id: 'h_power', branch: 'hands', name: 'Strong Wrists', icon: 'hand', row: 0, lane: 0, stat: 'click', per: 0.25, fmt: '+{p} click power', costs: [1, 2, 3, 5, 8], req: [] },
    { id: 'h_combo', branch: 'hands', name: 'Combo Rhythm', icon: 'combo', row: 0, lane: 1, stat: 'comboCap', per: 10, fmt: 'Combo cap +{v}', costs: [2, 3, 5], req: [] },
    { id: 'h_window', branch: 'hands', name: 'Patient Fingers', icon: 'clock', row: 1, lane: 1, stat: 'comboWindow', per: 0.15, fmt: 'Combos survive {v} s longer between clicks', costs: [2, 4, 6], req: [['h_combo', 1]] },
    { id: 'h_ghost', branch: 'hands', name: 'Ghost Hands', icon: 'ghost', row: 1, lane: 0, stat: 'autoClick', per: 1, fmt: '{v} automatic click per second', costs: [5, 9, 14], req: [['h_power', 2]] },
    { id: 'h_share', branch: 'hands', name: 'Golden Touch', icon: 'sparkle', row: 2, lane: 0.5, stat: 'cpsShare', per: 0.01, fmt: 'Clicks add {p} of production', costs: [6, 10, 15], req: [['h_ghost', 1], ['h_window', 1]] },

    { id: 'f_freq', branch: 'fortune', name: 'Sweet Tooth Radar', icon: 'radar', row: 0, lane: 0, stat: 'goldenFreq', per: 0.08, fmt: 'Golden treats appear {p} more often', costs: [2, 3, 5, 8], req: [] },
    { id: 'f_life', branch: 'fortune', name: 'Slow Fade', icon: 'clock', row: 0, lane: 1, stat: 'goldenLife', per: 2, fmt: 'Golden treats stay {v} s longer', costs: [2, 4, 6], req: [] },
    { id: 'f_dur', branch: 'fortune', name: 'Long Rush', icon: 'bolt', row: 1, lane: 0, stat: 'goldenDur', per: 0.1, fmt: 'Golden buffs last {p} longer', costs: [3, 5, 8, 12], req: [['f_freq', 1]] },
    { id: 'f_notes', branch: 'fortune', name: 'Fortune Notes', icon: 'note', row: 1, lane: 1, stat: 'goldenNotes', per: 0.1, fmt: '{p} chance a golden treat also gives a recipe note', costs: [4, 7, 11], req: [['f_life', 1]] },
    { id: 'f_double', branch: 'fortune', name: 'Twin Treats', icon: 'golden', row: 2, lane: 0.5, stat: 'goldenTwin', per: 0.05, fmt: '{p} chance of a second golden treat', costs: [8, 14], req: [['f_dur', 2], ['f_notes', 1]] },

    { id: 'l_offhrs', branch: 'logistics', name: 'Night Shift', icon: 'moon', row: 0, lane: 0, stat: 'offlineHours', per: 2, fmt: 'Offline baking lasts {v} h longer', costs: [2, 3, 5, 8], req: [] },
    { id: 'l_bulk', branch: 'logistics', name: 'Bulk Orders', icon: 'crate', row: 0, lane: 1, stat: 'bulk', per: 1, fmt: 'Buy 100 or as many as you can afford at once', costs: [3], req: [] },
    { id: 'l_offeff', branch: 'logistics', name: 'Sleepwalking Staff', icon: 'zzz', row: 1, lane: 0, stat: 'offlineEff', per: 0.1, fmt: '+{p} offline efficiency', costs: [3, 5, 8, 12], req: [['l_offhrs', 1]] },
    { id: 'l_upg', branch: 'logistics', name: 'Haggling', icon: 'coin', row: 1, lane: 1, stat: 'upgDiscount', per: 0.03, fmt: 'Upgrades cost {p} less', costs: [2, 4, 7], req: [['l_bulk', 1]] },

    { id: 's_notes', branch: 'science', name: 'Recipe Journal', icon: 'note', row: 0, lane: 0, stat: 'notesGain', per: 0.2, fmt: '+{p} recipe notes from baking', costs: [3, 5, 8, 12], req: [] },
    { id: 's_quest', branch: 'science', name: 'Daily Specials', icon: 'scroll', row: 0, lane: 1, stat: 'questGain', per: 0.5, fmt: '+{p} quest and Bake-Off rewards', costs: [2, 5], req: [] },
    { id: 's_milk', branch: 'science', name: 'Food Critic', icon: 'milk', row: 1, lane: 0, stat: 'milk', per: 0.1, fmt: 'Achievements give {p} more production', costs: [3, 6, 9], req: [['s_notes', 1]] },
    { id: 's_era', branch: 'science', name: 'Era Insight', icon: 'cake', row: 1, lane: 1, stat: 'eraGain', per: 0.2, fmt: 'Era bonuses are {p} stronger', costs: [5, 9, 14], req: [['s_quest', 1]] },

    { id: 'c_potency', branch: 'heritage', name: 'Crystal Resonance', icon: 'crystal', row: 0, lane: 0.5, stat: 'crystalPower', per: 0.1, fmt: 'Each sugar crystal gives {p} more', costs: [2, 5, 15, 40, 100], req: [] },
    { id: 'c_start', branch: 'heritage', name: 'Heirloom Starter', icon: 'sack', row: 1, lane: 0, stat: 'startCookies', per: 1, fmt: 'Each run starts with 10^({v} x 3) cookies', costs: [1, 5, 25], req: [['c_potency', 1]] },
    { id: 'c_decor', branch: 'heritage', name: 'Family Decor', icon: 'deco', row: 1, lane: 1, stat: 'keepDecor', per: 1, fmt: 'Decorations survive ascension', costs: [10], req: [['c_potency', 1]] },
    { id: 'c_golden', branch: 'destiny', name: 'Golden Aura', icon: 'golden', row: 0, lane: 0, stat: 'goldenFreq', per: 0.1, fmt: 'Golden treats appear {p} more often', costs: [3, 10, 30], req: [] },
    { id: 'c_offline', branch: 'destiny', name: 'Eternal Oven', icon: 'oven', row: 0, lane: 1, stat: 'offlineEff', per: 0.15, fmt: '+{p} offline efficiency', costs: [5, 20, 60], req: [] },
    { id: 'c_season', branch: 'destiny', name: 'Season Blessing', icon: 'leaf', row: 1, lane: 0.5, stat: 'seasonTokens', per: 1, fmt: 'Seasonal tokens count double', costs: [8], req: [['c_golden', 1]] },
    { id: 'c_click', branch: 'ascension', name: 'Celestial Fingers', icon: 'hand', row: 0, lane: 0, stat: 'click', per: 1, fmt: '+{p} click power', costs: [2, 6, 18], req: [] },
    { id: 'c_cost', branch: 'ascension', name: 'Sugar Discount', icon: 'coin', row: 0, lane: 1, stat: 'discount', per: 0.03, fmt: 'Producers cost {p} less', costs: [4, 12, 36], req: [] },
    { id: 'c_notes', branch: 'ascension', name: 'Oracle Notes', icon: 'note', row: 1, lane: 0.5, stat: 'ascendNotes', per: 5, fmt: '+{v} recipe notes per ascension', costs: [3, 9], req: [['c_click', 1]] },
  ];

  const TREE_BY_ID = {};
  for (let i = 0; i < TREE.length; ++i) TREE_BY_ID[TREE[i].id] = TREE[i];
  const BRANCH_BY_ID = {};
  for (let i = 0; i < BRANCHES.length; ++i) BRANCH_BY_ID[BRANCHES[i].id] = BRANCHES[i];

  NS.treeData = { PAGES, BRANCHES, BRANCH_BY_ID, TREE, TREE_BY_ID };
})();
