;(function() {
  'use strict';

  /* ── Constants ── */
  const STORAGE_KEY = 'sz-cookie-clicker';
  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;
  const AUTO_SAVE_INTERVAL = 30 * 1000;
  const MAX_OFFLINE_SECONDS = 8 * 3600; // 28800
  const OFFLINE_EFFICIENCY = 0.5;
  const COST_SCALE = 1.15;
  const WM_THEMECHANGED = 0x031A;

  /* States */
  const STATE_PLAYING = 'PLAYING';

  /* Number suffixes */
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  /* ── Building Definitions ── */
  const BUILDING_DEFS = [
    { id: 'cursor',       name: 'Cursor',              baseCost: 15,              baseCPS: 0.1,       emoji: '\u{1F5B1}', desc: 'Autoclicks once every 10 seconds' },
    { id: 'grandma',      name: 'Grandma',             baseCost: 100,             baseCPS: 1,         emoji: '\u{1F475}', desc: 'A nice grandma to bake cookies' },
    { id: 'farm',         name: 'Farm',                baseCost: 1100,            baseCPS: 8,         emoji: '\u{1F33E}', desc: 'Grows cookie plants' },
    { id: 'mine',         name: 'Mine',                baseCost: 12000,           baseCPS: 47,        emoji: '\u{26CF}',  desc: 'Mines out cookie dough' },
    { id: 'factory',      name: 'Factory',             baseCost: 130000,          baseCPS: 260,       emoji: '\u{1F3ED}', desc: 'Produces large quantities of cookies' },
    { id: 'bank',         name: 'Bank',                baseCost: 1400000,         baseCPS: 1400,      emoji: '\u{1F3E6}', desc: 'Generates cookies from interest' },
    { id: 'temple',       name: 'Temple',              baseCost: 20000000,        baseCPS: 7800,      emoji: '\u{26EA}',  desc: 'Converts prayer into cookies' },
    { id: 'wizard-tower', name: 'Wizard Tower',        baseCost: 330000000,       baseCPS: 44000,     emoji: '\u{1F9D9}', desc: 'Conjures cookies with magic' },
    { id: 'shipment',     name: 'Shipment',            baseCost: 5100000000,      baseCPS: 260000,    emoji: '\u{1F680}', desc: 'Imports cookies from the cookie planet' },
    { id: 'alchemy-lab',  name: 'Alchemy Lab',         baseCost: 75000000000,     baseCPS: 1600000,   emoji: '\u{2697}',  desc: 'Turns gold into cookies' },
    { id: 'portal',       name: 'Portal',              baseCost: 1000000000000,   baseCPS: 10000000,  emoji: '\u{1F300}', desc: 'Opens a door to the cookieverse' },
    { id: 'time-machine', name: 'Time Machine',        baseCost: 14000000000000,  baseCPS: 65000000,  emoji: '\u{231B}',  desc: 'Brings cookies from the past' },
    { id: 'condenser',    name: 'Antimatter Condenser', baseCost: 170000000000000, baseCPS: 430000000, emoji: '\u{269B}',  desc: 'Condenses antimatter into cookies' },
    { id: 'prism',        name: 'Prism',               baseCost: 2100000000000000, baseCPS: 2900000000, emoji: '\u{1F308}', desc: 'Converts light into cookies' }
  ];

  /* Building row layout */
  const BLDG_PANEL_X = 420;
  const BLDG_PANEL_W = CANVAS_W - BLDG_PANEL_X - 10;
  const BLDG_ROW_H = 50;
  const BLDG_ROW_PAD = 5;
  const BLDG_ROW_TOTAL = BLDG_ROW_H + BLDG_ROW_PAD;
  const BLDG_HEADER_H = 40;
  const BLDG_VISIBLE_H = CANVAS_H - 20 - BLDG_HEADER_H;

  /* ── Upgrade Definitions ── */
  const UPGRADE_DEFS = [
    // Cursor upgrades
    { id: 'u01', name: 'Reinforced Index Finger',     cost: 100,             target: 'cursor',       multiplier: 2,   condition: b => b.cursor >= 1,   desc: 'Cursors are twice as efficient' },
    { id: 'u02', name: 'Carpal Tunnel Prevention',    cost: 500,             target: 'cursor',       multiplier: 2,   condition: b => b.cursor >= 1,   desc: 'Cursors are twice as efficient' },
    { id: 'u03', name: 'Ambidextrous',                cost: 10000,           target: 'cursor',       multiplier: 2,   condition: b => b.cursor >= 10,  desc: 'Cursors are twice as efficient' },
    { id: 'u50', name: 'Thousand Fingers',            cost: 100000,          target: 'cursor',       multiplier: 2,   condition: b => b.cursor >= 25,  desc: 'Cursors are twice as efficient' },
    { id: 'u51', name: 'Million Fingers',             cost: 10000000,        target: 'cursor',       multiplier: 5,   condition: b => b.cursor >= 50,  desc: 'Cursors are 5x as efficient' },

    // Grandma upgrades
    { id: 'u04', name: 'Forwards from Grandma',       cost: 1000,            target: 'grandma',      multiplier: 2,   condition: b => b.grandma >= 1,  desc: 'Grandmas are twice as efficient' },
    { id: 'u05', name: 'Steel-plated Rolling Pins',   cost: 5000,            target: 'grandma',      multiplier: 2,   condition: b => b.grandma >= 5,  desc: 'Grandmas are twice as efficient' },
    { id: 'u06', name: 'Lubricated Dentures',         cost: 50000,           target: 'grandma',      multiplier: 2,   condition: b => b.grandma >= 25, desc: 'Grandmas are twice as efficient' },
    { id: 'u52', name: 'Prune Juice',                 cost: 5000000,         target: 'grandma',      multiplier: 2,   condition: b => b.grandma >= 50, desc: 'Grandmas are twice as efficient' },

    // Farm upgrades
    { id: 'u07', name: 'Cheap Hoes',                  cost: 11000,           target: 'farm',         multiplier: 2,   condition: b => b.farm >= 1,     desc: 'Farms are twice as efficient' },
    { id: 'u08', name: 'Fertilizer',                  cost: 55000,           target: 'farm',         multiplier: 2,   condition: b => b.farm >= 5,     desc: 'Farms are twice as efficient' },
    { id: 'u09', name: 'Cookie Trees',                cost: 550000,          target: 'farm',         multiplier: 2,   condition: b => b.farm >= 25,    desc: 'Farms are twice as efficient' },
    { id: 'u53', name: 'Genetically Modified Cookies', cost: 55000000,       target: 'farm',         multiplier: 2,   condition: b => b.farm >= 50,    desc: 'Farms are twice as efficient' },

    // Mine upgrades
    { id: 'u10', name: 'Sugar Gas',                   cost: 120000,          target: 'mine',         multiplier: 2,   condition: b => b.mine >= 1,     desc: 'Mines are twice as efficient' },
    { id: 'u11', name: 'Megadrill',                   cost: 600000,          target: 'mine',         multiplier: 2,   condition: b => b.mine >= 5,     desc: 'Mines are twice as efficient' },
    { id: 'u12', name: 'Ultradrill',                  cost: 6000000,         target: 'mine',         multiplier: 2,   condition: b => b.mine >= 25,    desc: 'Mines are twice as efficient' },
    { id: 'u54', name: 'Diamond-encrusted Drill',     cost: 600000000,       target: 'mine',         multiplier: 2,   condition: b => b.mine >= 50,    desc: 'Mines are twice as efficient' },

    // Factory upgrades
    { id: 'u13', name: 'Sturdier Conveyor Belts',     cost: 1300000,         target: 'factory',      multiplier: 2,   condition: b => b.factory >= 1,  desc: 'Factories are twice as efficient' },
    { id: 'u14', name: 'Child Labor',                 cost: 6500000,         target: 'factory',      multiplier: 2,   condition: b => b.factory >= 5,  desc: 'Factories are twice as efficient' },
    { id: 'u15', name: 'Sweatshop',                   cost: 65000000,        target: 'factory',      multiplier: 2,   condition: b => b.factory >= 25, desc: 'Factories are twice as efficient' },
    { id: 'u55', name: 'Radium Reactors',             cost: 6500000000,      target: 'factory',      multiplier: 2,   condition: b => b.factory >= 50, desc: 'Factories are twice as efficient' },

    // Bank upgrades
    { id: 'u16', name: 'Taller Tellers',              cost: 14000000,        target: 'bank',         multiplier: 2,   condition: b => b.bank >= 1,     desc: 'Banks are twice as efficient' },
    { id: 'u17', name: 'Scissor-resistant Credit Cards', cost: 70000000,     target: 'bank',         multiplier: 2,   condition: b => b.bank >= 5,     desc: 'Banks are twice as efficient' },
    { id: 'u56', name: 'Acid-proof Vaults',           cost: 7000000000,      target: 'bank',         multiplier: 2,   condition: b => b.bank >= 25,    desc: 'Banks are twice as efficient' },
    { id: 'u57', name: 'Chocolate Coins',             cost: 700000000000,    target: 'bank',         multiplier: 2,   condition: b => b.bank >= 50,    desc: 'Banks are twice as efficient' },

    // Temple upgrades
    { id: 'u18', name: 'Golden Idols',                cost: 200000000,       target: 'temple',       multiplier: 2,   condition: b => b.temple >= 1,   desc: 'Temples are twice as efficient' },
    { id: 'u58', name: 'Sacrificial Rolling Pins',    cost: 2000000000,      target: 'temple',       multiplier: 2,   condition: b => b.temple >= 5,   desc: 'Temples are twice as efficient' },
    { id: 'u59', name: 'Stained Glass Cookies',       cost: 200000000000,    target: 'temple',       multiplier: 2,   condition: b => b.temple >= 25,  desc: 'Temples are twice as efficient' },

    // Wizard Tower upgrades
    { id: 'u19', name: 'Pointier Hats',               cost: 3300000000,      target: 'wizard-tower', multiplier: 2,   condition: b => b['wizard-tower'] >= 1,  desc: 'Wizard Towers are twice as efficient' },
    { id: 'u60', name: 'Beardlier Beards',            cost: 33000000000,     target: 'wizard-tower', multiplier: 2,   condition: b => b['wizard-tower'] >= 5,  desc: 'Wizard Towers are twice as efficient' },
    { id: 'u61', name: 'Ancient Grimoires',           cost: 3300000000000,   target: 'wizard-tower', multiplier: 2,   condition: b => b['wizard-tower'] >= 25, desc: 'Wizard Towers are twice as efficient' },

    // Shipment upgrades
    { id: 'u62', name: 'Vanilla Nebulae',             cost: 51000000000,     target: 'shipment',     multiplier: 2,   condition: b => b.shipment >= 1,  desc: 'Shipments are twice as efficient' },
    { id: 'u63', name: 'Wormholes',                   cost: 510000000000,    target: 'shipment',     multiplier: 2,   condition: b => b.shipment >= 5,  desc: 'Shipments are twice as efficient' },
    { id: 'u64', name: 'Frequent Flyer',              cost: 51000000000000,  target: 'shipment',     multiplier: 2,   condition: b => b.shipment >= 25, desc: 'Shipments are twice as efficient' },

    // Alchemy Lab upgrades
    { id: 'u65', name: 'Antimony',                    cost: 750000000000,    target: 'alchemy-lab',  multiplier: 2,   condition: b => b['alchemy-lab'] >= 1,  desc: 'Alchemy Labs are twice as efficient' },
    { id: 'u66', name: 'Essence of Dough',            cost: 7500000000000,   target: 'alchemy-lab',  multiplier: 2,   condition: b => b['alchemy-lab'] >= 5,  desc: 'Alchemy Labs are twice as efficient' },
    { id: 'u67', name: 'True Chocolate',              cost: 750000000000000, target: 'alchemy-lab',  multiplier: 2,   condition: b => b['alchemy-lab'] >= 25, desc: 'Alchemy Labs are twice as efficient' },

    // Portal upgrades
    { id: 'u68', name: 'Ancient Tablet',              cost: 10000000000000,  target: 'portal',       multiplier: 2,   condition: b => b.portal >= 1,  desc: 'Portals are twice as efficient' },
    { id: 'u69', name: 'Insane Oatling Workers',      cost: 100000000000000, target: 'portal',       multiplier: 2,   condition: b => b.portal >= 5,  desc: 'Portals are twice as efficient' },

    // Time Machine upgrades
    { id: 'u70', name: 'Flux Capacitors',             cost: 140000000000000, target: 'time-machine', multiplier: 2,   condition: b => b['time-machine'] >= 1,  desc: 'Time Machines are twice as efficient' },
    { id: 'u71', name: 'Time Paradox Resolver',       cost: 1400000000000000, target: 'time-machine', multiplier: 2,  condition: b => b['time-machine'] >= 5,  desc: 'Time Machines are twice as efficient' },

    // Antimatter Condenser upgrades
    { id: 'u72', name: 'Sugar Bosons',                cost: 1700000000000000, target: 'condenser',    multiplier: 2,   condition: b => b.condenser >= 1, desc: 'Condensers are twice as efficient' },
    { id: 'u73', name: 'String Theory',               cost: 17000000000000000, target: 'condenser',   multiplier: 2,  condition: b => b.condenser >= 5, desc: 'Condensers are twice as efficient' },

    // Prism upgrades
    { id: 'u74', name: 'Gem Polish',                  cost: 21000000000000000, target: 'prism',       multiplier: 2,   condition: b => b.prism >= 1,   desc: 'Prisms are twice as efficient' },
    { id: 'u75', name: 'Spectral Frosting',           cost: 210000000000000000, target: 'prism',      multiplier: 2,   condition: b => b.prism >= 5,   desc: 'Prisms are twice as efficient' },

    // Click upgrades
    { id: 'u20', name: 'Plastic Mouse',               cost: 50000,           target: 'click',        multiplier: 2,   condition: () => true,           desc: 'Clicking is twice as powerful' },
    { id: 'u21', name: 'Iron Mouse',                  cost: 5000000,         target: 'click',        multiplier: 2,   condition: () => true,           desc: 'Clicking is twice as powerful' },
    { id: 'u22', name: 'Titanium Mouse',              cost: 500000000,       target: 'click',        multiplier: 2,   condition: () => true,           desc: 'Clicking is twice as powerful' },
    { id: 'u76', name: 'Adamantium Mouse',            cost: 50000000000,     target: 'click',        multiplier: 2,   condition: () => true,           desc: 'Clicking is twice as powerful' },
    { id: 'u77', name: 'Unobtainium Mouse',           cost: 5000000000000,   target: 'click',        multiplier: 2,   condition: () => true,           desc: 'Clicking is twice as powerful' },
    { id: 'u78', name: 'Eludium Mouse',               cost: 500000000000000, target: 'click',        multiplier: 5,   condition: () => true,           desc: 'Clicking is 5x as powerful' },

    // Global multiplier upgrades
    { id: 'u23', name: 'Lucky Day',                   cost: 7777777,         target: 'global',       multiplier: 1.1, condition: () => true,           desc: '+10% CPS from all sources' },
    { id: 'u24', name: 'Serendipity',                 cost: 77777777,        target: 'global',       multiplier: 1.1, condition: () => true,           desc: '+10% CPS from all sources' },
    { id: 'u25', name: 'Get Lucky',                   cost: 777777777,       target: 'global',       multiplier: 1.1, condition: () => true,           desc: '+10% CPS from all sources' },
    { id: 'u79', name: 'Fortune',                     cost: 7777777777,      target: 'global',       multiplier: 1.15, condition: () => true,          desc: '+15% CPS from all sources' },
    { id: 'u80', name: 'Prosperity',                  cost: 77777777777,     target: 'global',       multiplier: 1.15, condition: () => true,          desc: '+15% CPS from all sources' },
    { id: 'u81', name: 'Providence',                  cost: 777777777777,    target: 'global',       multiplier: 1.2, condition: () => true,           desc: '+20% CPS from all sources' },
    { id: 'u82', name: 'Destiny Manifest',            cost: 7777777777777,   target: 'global',       multiplier: 1.25, condition: () => true,          desc: '+25% CPS from all sources' }
  ];

  /* ── Achievement Definitions ── */
  const ACHIEVEMENT_DEFS = [
    // Baking milestones
    { id: 'a01', name: 'Wake and Bake',         desc: 'Bake 1 cookie',                  condition: s => s.cookiesBakedAllTime >= 1 },
    { id: 'a02', name: 'Making Some Dough',     desc: 'Bake 100 cookies',               condition: s => s.cookiesBakedAllTime >= 100 },
    { id: 'a03', name: 'So Baked Right Now',    desc: 'Bake 1,000 cookies',             condition: s => s.cookiesBakedAllTime >= 1000 },
    { id: 'a04', name: 'Fledgling Bakery',      desc: 'Bake 10,000 cookies',            condition: s => s.cookiesBakedAllTime >= 10000 },
    { id: 'a05', name: 'Affluent Bakery',       desc: 'Bake 100,000 cookies',           condition: s => s.cookiesBakedAllTime >= 100000 },
    { id: 'a06', name: 'World Famous Bakery',   desc: 'Bake 1 million cookies',         condition: s => s.cookiesBakedAllTime >= 1e6 },
    { id: 'a07', name: 'Cosmic Bakery',         desc: 'Bake 1 billion cookies',         condition: s => s.cookiesBakedAllTime >= 1e9 },
    { id: 'a08', name: 'Galactic Bakery',       desc: 'Bake 1 trillion cookies',        condition: s => s.cookiesBakedAllTime >= 1e12 },
    { id: 'a09', name: 'Universal Bakery',      desc: 'Bake 1 quadrillion',             condition: s => s.cookiesBakedAllTime >= 1e15 },
    { id: 'a10', name: 'Timeless Bakery',       desc: 'Bake 1 quintillion',             condition: s => s.cookiesBakedAllTime >= 1e18 },
    { id: 'a40', name: 'Infinite Bakery',       desc: 'Bake 1 sextillion',              condition: s => s.cookiesBakedAllTime >= 1e21 },

    // Click milestones
    { id: 'a11', name: 'Click',                 desc: 'Click the cookie 1 time',        condition: s => s.totalClicks >= 1 },
    { id: 'a12', name: 'Double Click',          desc: 'Click the cookie 2 times',       condition: s => s.totalClicks >= 2 },
    { id: 'a13', name: 'Mouse Wheel',           desc: 'Click the cookie 100 times',     condition: s => s.totalClicks >= 100 },
    { id: 'a14', name: 'Of Mice and Men',       desc: 'Click the cookie 500 times',     condition: s => s.totalClicks >= 500 },
    { id: 'a15', name: 'The Digital',           desc: 'Click the cookie 1,000 times',   condition: s => s.totalClicks >= 1000 },
    { id: 'a41', name: 'Extreme Polka',         desc: 'Click the cookie 5,000 times',   condition: s => s.totalClicks >= 5000 },
    { id: 'a42', name: 'Manic Clicking',        desc: 'Click the cookie 10,000 times',  condition: s => s.totalClicks >= 10000 },
    { id: 'a43', name: 'Carpal Tunnel',         desc: 'Click the cookie 50,000 times',  condition: s => s.totalClicks >= 50000 },

    // Original building milestones (own 1 and own 50)
    { id: 'a16', name: 'Cursor Starter',        desc: 'Own 1 cursor',                   condition: s => s.buildings.cursor >= 1 },
    { id: 'a17', name: 'Cursor Army',           desc: 'Own 50 cursors',                 condition: s => s.buildings.cursor >= 50 },
    { id: 'a18', name: 'Grandma Army',          desc: 'Own 50 grandmas',                condition: s => s.buildings.grandma >= 50 },
    { id: 'a19', name: 'Farm Lord',             desc: 'Own 50 farms',                   condition: s => s.buildings.farm >= 50 },
    { id: 'a20', name: 'Mine Tycoon',           desc: 'Own 50 mines',                   condition: s => s.buildings.mine >= 50 },
    { id: 'a21', name: 'Factory Owner',         desc: 'Own 50 factories',               condition: s => s.buildings.factory >= 50 },
    { id: 'a22', name: 'Bank President',        desc: 'Own 50 banks',                   condition: s => s.buildings.bank >= 50 },
    { id: 'a23', name: 'Temple Guardian',       desc: 'Own 50 temples',                 condition: s => s.buildings.temple >= 50 },
    { id: 'a24', name: 'Arch Wizard',           desc: 'Own 50 wizard towers',           condition: s => s.buildings['wizard-tower'] >= 50 },

    // New building milestones (own 1)
    { id: 'a44', name: 'Spacefarer',            desc: 'Own 1 shipment',                 condition: s => s.buildings.shipment >= 1 },
    { id: 'a45', name: 'Transmuter',            desc: 'Own 1 alchemy lab',              condition: s => s.buildings['alchemy-lab'] >= 1 },
    { id: 'a46', name: 'Gatekeeper',            desc: 'Own 1 portal',                   condition: s => s.buildings.portal >= 1 },
    { id: 'a47', name: 'Time Lord',             desc: 'Own 1 time machine',             condition: s => s.buildings['time-machine'] >= 1 },
    { id: 'a48', name: 'Antibaker',             desc: 'Own 1 antimatter condenser',     condition: s => s.buildings.condenser >= 1 },
    { id: 'a49', name: 'Light Bender',          desc: 'Own 1 prism',                    condition: s => s.buildings.prism >= 1 },

    // New building milestones (own 50)
    { id: 'a50', name: 'Fleet Commander',       desc: 'Own 50 shipments',               condition: s => s.buildings.shipment >= 50 },
    { id: 'a51', name: 'Grand Alchemist',       desc: 'Own 50 alchemy labs',            condition: s => s.buildings['alchemy-lab'] >= 50 },
    { id: 'a52', name: 'Portal Master',         desc: 'Own 50 portals',                 condition: s => s.buildings.portal >= 50 },
    { id: 'a53', name: 'Temporal Overlord',      desc: 'Own 50 time machines',           condition: s => s.buildings['time-machine'] >= 50 },
    { id: 'a54', name: 'Particle Physicist',     desc: 'Own 50 antimatter condensers',   condition: s => s.buildings.condenser >= 50 },
    { id: 'a55', name: 'Prismatic',             desc: 'Own 50 prisms',                  condition: s => s.buildings.prism >= 50 },

    // Own 100 of a building
    { id: 'a56', name: 'Cursor Centurion',      desc: 'Own 100 cursors',                condition: s => s.buildings.cursor >= 100 },
    { id: 'a57', name: 'Grandma Centennial',    desc: 'Own 100 grandmas',               condition: s => s.buildings.grandma >= 100 },
    { id: 'a58', name: 'Farm Baron',            desc: 'Own 100 farms',                  condition: s => s.buildings.farm >= 100 },
    { id: 'a59', name: 'Deep Digger',           desc: 'Own 100 mines',                  condition: s => s.buildings.mine >= 100 },

    // CPS milestones
    { id: 'a25', name: 'Speedbaker',            desc: 'Reach 10 CPS',                  condition: s => s.cps >= 10 },
    { id: 'a26', name: 'Kilobaker',             desc: 'Reach 1,000 CPS',               condition: s => s.cps >= 1000 },
    { id: 'a27', name: 'Megabaker',             desc: 'Reach 1 million CPS',           condition: s => s.cps >= 1e6 },
    { id: 'a28', name: 'Gigabaker',             desc: 'Reach 1 billion CPS',           condition: s => s.cps >= 1e9 },
    { id: 'a60', name: 'Terabaker',             desc: 'Reach 1 trillion CPS',          condition: s => s.cps >= 1e12 },
    { id: 'a61', name: 'Petabaker',             desc: 'Reach 1 quadrillion CPS',       condition: s => s.cps >= 1e15 },

    // Prestige milestones
    { id: 'a29', name: 'Ascended',              desc: 'Prestige at least once',         condition: s => s.prestigeCount >= 1 },
    { id: 'a30', name: 'Reborn',                desc: 'Prestige 5 times',              condition: s => s.prestigeCount >= 5 },
    { id: 'a62', name: 'Eternal',               desc: 'Prestige 10 times',             condition: s => s.prestigeCount >= 10 },

    // Total building milestones
    { id: 'a31', name: 'Builder',               desc: 'Own 100 buildings total',        condition: s => s.totalBuildings >= 100 },
    { id: 'a32', name: 'Architect',             desc: 'Own 500 buildings total',        condition: s => s.totalBuildings >= 500 },
    { id: 'a63', name: 'Engineer',              desc: 'Own 1,000 buildings total',      condition: s => s.totalBuildings >= 1000 },

    // Upgrade milestones
    { id: 'a64', name: 'Enhancer',              desc: 'Purchase 10 upgrades',           condition: s => s.totalUpgrades >= 10 },
    { id: 'a65', name: 'Augmenter',             desc: 'Purchase 25 upgrades',           condition: s => s.totalUpgrades >= 25 },
    { id: 'a66', name: 'Cookie Scientist',      desc: 'Purchase 50 upgrades',           condition: s => s.totalUpgrades >= 50 }
  ];

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCookies = document.getElementById('statusCookies');
  const statusCps = document.getElementById('statusCps');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Game State ── */
  let state = STATE_PLAYING;
  let cookies = 0;
  let displayCookies = 0;
  let cookiesBaked = 0;
  let cookiesBakedAllTime = 0;
  let totalClicks = 0;
  let clickValue = 1;
  let clickMultiplier = 1;
  let globalMultiplier = 1;
  let heavenlyChips = 0;
  let prestigeCount = 0;
  let cps = 0;
  let animFrameId = null;
  let lastTimestamp = 0;
  let dpr = 1;
  let cookieScale = 1;
  let cookieScaleV = 0;
  let achievementCheckTimer = 0;
  let autoSaveTimer = 0;
  let purchaseGlowTimer = 0;
  let purchaseGlowIndex = -1;
  let confettiTimer = 0;
  let lastMilestone = 0;

  /* ── Scroll state for buildings panel ── */
  let buildingScrollOffset = 0;

  /* ── Click ripple state ── */
  let clickRipple = null;

  /* ── Tooltip state ── */
  let tooltip = null; // { lines: string[], x, y }
  let mouseX = 0;
  let mouseY = 0;

  const buildings = {};
  const buildingMultipliers = {};
  for (const def of BUILDING_DEFS) {
    buildings[def.id] = 0;
    buildingMultipliers[def.id] = 1;
  }

  const upgradePurchased = {};
  for (const def of UPGRADE_DEFS)
    upgradePurchased[def.id] = false;

  const achievementUnlocked = {};
  for (const def of ACHIEVEMENT_DEFS)
    achievementUnlocked[def.id] = false;

  /* ── Canvas Setup ── */
  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Number Formatting ── */
  function formatNumber(n) {
    if (n < 1000)
      return Math.floor(n).toString();
    let idx = 0;
    let val = n;
    while (val >= 1000 && idx < SUFFIXES.length - 1) {
      val /= 1000;
      ++idx;
    }
    return val.toFixed(val < 10 ? 2 : val < 100 ? 1 : 0) + SUFFIXES[idx];
  }

  function formatCPS(n) {
    if (n === 0)
      return '0';
    if (n < 0.01)
      return n.toFixed(3);
    if (n < 1)
      return n.toFixed(2);
    if (n < 10)
      return n.toFixed(1);
    return formatNumber(n);
  }

  /* ── CPS Calculation ── */
  function getGlobalBonus() {
    const achievementBonus = 1 + Object.values(achievementUnlocked).filter(Boolean).length * 0.01;
    return globalMultiplier * (1 + heavenlyChips * 0.01) * achievementBonus;
  }

  function recalcCPS() {
    let total = 0;
    for (const def of BUILDING_DEFS)
      total += buildings[def.id] * def.baseCPS * buildingMultipliers[def.id];
    total *= getGlobalBonus();
    cps = total;
  }

  /* ── Per-building CPS (for tooltip) ── */
  function getBuildingCPSPerUnit(def) {
    return def.baseCPS * buildingMultipliers[def.id] * getGlobalBonus();
  }

  function getBuildingTotalCPS(def) {
    return buildings[def.id] * getBuildingCPSPerUnit(def);
  }

  /* ── Simulate CPS after buying one more building ── */
  function getCPSAfterBuyingBuilding(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    let total = 0;
    for (const d of BUILDING_DEFS) {
      const count = buildings[d.id] + (d.id === def.id ? 1 : 0);
      total += count * d.baseCPS * buildingMultipliers[d.id];
    }
    total *= getGlobalBonus();
    return total;
  }

  /* ── Simulate CPS after buying an upgrade ── */
  function getCPSAfterBuyingUpgrade(upgDef) {
    const savedMult = buildingMultipliers[upgDef.target];
    const savedClick = clickMultiplier;
    const savedGlobal = globalMultiplier;

    if (upgDef.target === 'click')
      clickMultiplier *= upgDef.multiplier;
    else if (upgDef.target === 'global')
      globalMultiplier *= upgDef.multiplier;
    else if (upgDef.target in buildingMultipliers)
      buildingMultipliers[upgDef.target] *= upgDef.multiplier;

    let total = 0;
    for (const d of BUILDING_DEFS)
      total += buildings[d.id] * d.baseCPS * buildingMultipliers[d.id];
    const bonus = getGlobalBonus();
    total *= bonus;

    // Restore
    if (upgDef.target === 'click')
      clickMultiplier = savedClick;
    else if (upgDef.target === 'global')
      globalMultiplier = savedGlobal;
    else if (upgDef.target in buildingMultipliers)
      buildingMultipliers[upgDef.target] = savedMult;

    return total;
  }

  function getClickValueAfterUpgrade(upgDef) {
    const savedClick = clickMultiplier;
    const savedGlobal = globalMultiplier;

    if (upgDef.target === 'click')
      clickMultiplier *= upgDef.multiplier;
    else if (upgDef.target === 'global')
      globalMultiplier *= upgDef.multiplier;

    const val = clickMultiplier * globalMultiplier * (1 + heavenlyChips * 0.01);

    clickMultiplier = savedClick;
    globalMultiplier = savedGlobal;
    return val;
  }

  /* ── Click Value Calculation ── */
  function recalcClickValue() {
    clickValue = clickMultiplier * globalMultiplier * (1 + heavenlyChips * 0.01);
  }

  /* ── Owned Counts Snapshot ── */
  function getOwnedCounts() {
    const counts = {};
    for (const def of BUILDING_DEFS)
      counts[def.id] = buildings[def.id];
    return counts;
  }

  /* ── Building Cost ── */
  function buildingCost(def) {
    return Math.ceil(def.baseCost * Math.pow(COST_SCALE, buildings[def.id]));
  }

  /* ── Buy Building ── */
  function buyBuilding(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    const cost = buildingCost(def);
    if (cookies >= cost) {
      cookies -= cost;
      ++buildings[def.id];
      recalcCPS();
      purchaseGlowTimer = 0.6;
      purchaseGlowIndex = defIndex;
      particles.burst(650, 80 + defIndex * BLDG_ROW_TOTAL, 8, { r: 255, g: 215, b: 0 }, 0.6);
    }
  }

  /* ── Buy Upgrade ── */
  function buyUpgrade(defIndex) {
    const def = UPGRADE_DEFS[defIndex];
    if (upgradePurchased[def.id] || cookies < def.cost)
      return;
    cookies -= def.cost;
    upgradePurchased[def.id] = true;
    if (def.target === 'click')
      clickMultiplier *= def.multiplier;
    else if (def.target === 'global')
      globalMultiplier *= def.multiplier;
    else
      buildingMultipliers[def.target] *= def.multiplier;
    recalcCPS();
    recalcClickValue();
    particles.burst(400, 300, 12, { r: 180, g: 100, b: 255 }, 0.8);
  }

  /* ── Cookie Click ── */
  function handleCookieClick(x, y) {
    cookies += clickValue;
    cookiesBaked += clickValue;
    cookiesBakedAllTime += clickValue;
    ++totalClicks;

    particles.burst(x || CANVAS_W / 2, y || CANVAS_H / 2, 8, { r: 210, g: 160, b: 60 }, 0.5);
    floatingText.add(x || CANVAS_W / 2, (y || CANVAS_H / 2) - 30, '+' + formatNumber(clickValue), { color: '#fff' });
    clickRipple = { x: COOKIE_CX, y: COOKIE_CY, radius: COOKIE_R * 0.5, alpha: 0.7 };
    particles.burst(COOKIE_CX, COOKIE_CY, 5, { r: 160, g: 120, b: 60 }, 0.4);
    cookieScale = 0.95;
    cookieScaleV = 0.3;
  }

  /* ── Achievement Check ── */
  function checkAchievements() {
    const totalBuildings = Object.values(buildings).reduce((a, b) => a + b, 0);
    const totalUpgrades = Object.values(upgradePurchased).filter(Boolean).length;
    const snapshot = {
      cookiesBakedAllTime,
      totalClicks,
      buildings,
      cps,
      prestigeCount,
      totalBuildings,
      totalUpgrades
    };
    let newUnlock = false;
    for (const def of ACHIEVEMENT_DEFS) {
      if (!achievementUnlocked[def.id] && def.condition(snapshot)) {
        achievementUnlocked[def.id] = true;
        newUnlock = true;
        floatingText.add(CANVAS_W / 2, 40, '\u{1F3C6} ' + def.name, { color: '#ffd700', decay: 0.01 });
      }
    }
    if (newUnlock)
      recalcCPS();
  }

  /* ── Milestone Confetti ── */
  const MILESTONES = [1e6, 1e9, 1e12, 1e15, 1e18, 1e21];
  const CONFETTI_COLORS = [
    { r: 255, g: 50, b: 50 },
    { r: 50, g: 255, b: 50 },
    { r: 50, g: 50, b: 255 },
    { r: 255, g: 215, b: 0 },
    { r: 255, g: 100, b: 255 }
  ];

  function checkMilestones() {
    for (const m of MILESTONES) {
      if (cookiesBakedAllTime >= m && lastMilestone < m) {
        lastMilestone = m;
        confettiTimer = 2;
        for (let i = 0; i < 50; ++i)
          particles.burst(Math.random() * CANVAS_W, -10, 3, CONFETTI_COLORS[i % CONFETTI_COLORS.length], 2);
      }
    }
  }

  /* ── Prestige ── */
  function getHeavenlyChipsFromLifetime() {
    return Math.floor(Math.cbrt(cookiesBakedAllTime / 1e12));
  }

  function performPrestige() {
    const newChips = getHeavenlyChipsFromLifetime() - heavenlyChips;
    if (newChips <= 0)
      return;
    heavenlyChips += newChips;
    ++prestigeCount;

    cookies = 0;
    cookiesBaked = 0;
    displayCookies = 0;
    clickMultiplier = 1;
    globalMultiplier = 1;
    for (const def of BUILDING_DEFS) {
      buildings[def.id] = 0;
      buildingMultipliers[def.id] = 1;
    }
    for (const def of UPGRADE_DEFS)
      upgradePurchased[def.id] = false;

    buildingScrollOffset = 0;
    recalcCPS();
    recalcClickValue();
    confettiTimer = 2;
    for (let i = 0; i < 40; ++i)
      particles.burst(Math.random() * CANVAS_W, -10, 2, { r: 200, g: 200, b: 255 }, 2);
  }

  /* ── Save / Load ── */
  function saveGame() {
    try {
      const data = {
        cookies, cookiesBaked, cookiesBakedAllTime, totalClicks,
        clickMultiplier, globalMultiplier, heavenlyChips, prestigeCount,
        buildings: { ...buildings },
        buildingMultipliers: { ...buildingMultipliers },
        upgradePurchased: { ...upgradePurchased },
        achievementUnlocked: { ...achievementUnlocked },
        lastMilestone,
        lastSaveTime: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw)
        return;
      const data = JSON.parse(raw);
      cookies = data.cookies || 0;
      cookiesBaked = data.cookiesBaked || 0;
      cookiesBakedAllTime = data.cookiesBakedAllTime || 0;
      totalClicks = data.totalClicks || 0;
      clickMultiplier = data.clickMultiplier || 1;
      globalMultiplier = data.globalMultiplier || 1;
      heavenlyChips = data.heavenlyChips || 0;
      prestigeCount = data.prestigeCount || 0;
      lastMilestone = data.lastMilestone || 0;
      if (data.buildings)
        for (const k of Object.keys(data.buildings))
          if (k in buildings)
            buildings[k] = data.buildings[k];
      if (data.buildingMultipliers)
        for (const k of Object.keys(data.buildingMultipliers))
          if (k in buildingMultipliers)
            buildingMultipliers[k] = data.buildingMultipliers[k];
      if (data.upgradePurchased)
        for (const k of Object.keys(data.upgradePurchased))
          if (k in upgradePurchased)
            upgradePurchased[k] = data.upgradePurchased[k];
      if (data.achievementUnlocked)
        for (const k of Object.keys(data.achievementUnlocked))
          if (k in achievementUnlocked)
            achievementUnlocked[k] = data.achievementUnlocked[k];

      recalcCPS();
      recalcClickValue();
      displayCookies = cookies;

      if (data.lastSaveTime) {
        const elapsed = Math.min((Date.now() - data.lastSaveTime) / 1000, MAX_OFFLINE_SECONDS);
        if (elapsed > 10) {
          const offlineCookies = elapsed * cps * OFFLINE_EFFICIENCY;
          cookies += offlineCookies;
          cookiesBaked += offlineCookies;
          cookiesBakedAllTime += offlineCookies;
          if (offlineCookies > 0)
            floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Welcome back! +' + formatNumber(offlineCookies), { color: '#7ec8e3', decay: 0.007 });
        }
      }
    } catch (_) {}
  }

  /* ── New Game ── */
  function newGame() {
    cookies = 0;
    displayCookies = 0;
    cookiesBaked = 0;
    cookiesBakedAllTime = 0;
    totalClicks = 0;
    clickValue = 1;
    clickMultiplier = 1;
    globalMultiplier = 1;
    heavenlyChips = 0;
    prestigeCount = 0;
    cps = 0;
    lastMilestone = 0;
    buildingScrollOffset = 0;
    for (const def of BUILDING_DEFS) {
      buildings[def.id] = 0;
      buildingMultipliers[def.id] = 1;
    }
    for (const def of UPGRADE_DEFS)
      upgradePurchased[def.id] = false;
    for (const def of ACHIEVEMENT_DEFS)
      achievementUnlocked[def.id] = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    recalcCPS();
    recalcClickValue();
  }

  /* ── Status ── */
  function updateStatus() {
    statusCookies.textContent = 'Cookies: ' + formatNumber(displayCookies);
    statusCps.textContent = 'CPS: ' + formatNumber(cps);
    statusState.textContent = state;
  }

  /* ── Draw Helpers ── */
  const COOKIE_CX = 200;
  const COOKIE_CY = 250;
  const COOKIE_R = 100;

  /* ── Background crumb particles ── */
  const bgCrumbs = [];
  for (let i = 0; i < 15; ++i)
    bgCrumbs.push({
      x: COOKIE_CX + (Math.random() - 0.5) * 250,
      y: Math.random() * CANVAS_H,
      r: 1 + Math.random() * 2,
      speed: 8 + Math.random() * 12,
      alpha: 0.15 + Math.random() * 0.25
    });

  function drawCookie() {
    ctx.save();
    ctx.translate(COOKIE_CX, COOKIE_CY);
    ctx.scale(cookieScale, cookieScale);

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20 + Math.sin(Date.now() / 500) * 5;

    const bodyGrad = ctx.createRadialGradient(-25, -25, COOKIE_R * 0.15, 0, 0, COOKIE_R);
    bodyGrad.addColorStop(0, '#daa520');
    bodyGrad.addColorStop(0.7, '#c68e17');
    bodyGrad.addColorStop(1, '#8b6914');
    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(139,105,20,0.3)';
    ctx.lineWidth = 1;
    const scoringRadii = [35, 55, 72, 88];
    for (const sr of scoringRadii) {
      ctx.beginPath();
      ctx.arc(0, 0, sr, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, sr, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }

    const chipPositions = [
      [-30, -40], [20, -30], [-10, 10], [40, 20], [-40, 30], [15, -60], [-20, 50]
    ];
    for (let i = 0; i < chipPositions.length; ++i) {
      const [cx, cy] = chipPositions[i];

      ctx.save();
      ctx.translate(cx, cy + 1.5);
      ctx.fillStyle = 'rgba(30,15,0,0.35)';
      ctx.beginPath();
      if (i % 2 === 0)
        ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
      else
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#4a2800';
      ctx.beginPath();
      if (i % 2 === 0)
        ctx.ellipse(cx, cy, 10, 7, 0, 0, Math.PI * 2);
      else
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-10, -10, COOKIE_R * 0.7, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,65,10,0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R - 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,220,130,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /* ── Scrollable Buildings Panel ── */
  function getMaxBuildingScroll() {
    const contentH = BUILDING_DEFS.length * BLDG_ROW_TOTAL;
    return Math.max(0, contentH - BLDG_VISIBLE_H);
  }

  function drawBuildingsPanel() {
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const panelTop = 10;
    const panelH = CANVAS_H - 20;
    const contentTop = panelTop + BLDG_HEADER_H;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(panelX, panelTop, panelW, panelH);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Buildings', panelX + 10, panelTop + 20);

    // Scroll indicators
    const maxScroll = getMaxBuildingScroll();
    if (maxScroll > 0) {
      ctx.fillStyle = '#888';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      if (buildingScrollOffset > 0)
        ctx.fillText('\u25B2 scroll up', panelX + panelW - 10, panelTop + 16);
      if (buildingScrollOffset < maxScroll)
        ctx.fillText('\u25BC scroll down', panelX + panelW - 10, panelTop + 28);
      ctx.textAlign = 'left';
    }

    // Clip to content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX, contentTop, panelW, BLDG_VISIBLE_H);
    ctx.clip();

    for (let i = 0; i < BUILDING_DEFS.length; ++i) {
      const def = BUILDING_DEFS[i];
      const y = contentTop + i * BLDG_ROW_TOTAL - buildingScrollOffset;

      if (y + BLDG_ROW_H < contentTop || y > contentTop + BLDG_VISIBLE_H)
        continue;

      const cost = buildingCost(def);
      const canAfford = cookies >= cost;

      // Purchase glow
      if (purchaseGlowIndex === i && purchaseGlowTimer > 0) {
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 30 * purchaseGlowTimer;
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(panelX + 5, y, panelW - 10, BLDG_ROW_H);
        ctx.restore();
      }

      // Row background
      const rowGrad = ctx.createLinearGradient(panelX + 5, 0, panelX + panelW - 5, 0);
      if (canAfford) {
        rowGrad.addColorStop(0, 'rgba(80,180,80,0.2)');
        rowGrad.addColorStop(0.5, 'rgba(100,200,100,0.12)');
        rowGrad.addColorStop(1, 'rgba(80,180,80,0.05)');
      } else {
        rowGrad.addColorStop(0, 'rgba(60,60,60,0.35)');
        rowGrad.addColorStop(0.5, 'rgba(50,50,50,0.25)');
        rowGrad.addColorStop(1, 'rgba(40,40,40,0.15)');
      }
      ctx.fillStyle = rowGrad;
      ctx.fillRect(panelX + 5, y, panelW - 10, BLDG_ROW_H);

      // Emoji
      ctx.save();
      if (canAfford) {
        const pulse = 4 + Math.sin(Date.now() / 600) * 3;
        ctx.shadowColor = 'rgba(100,255,100,0.6)';
        ctx.shadowBlur = pulse;
      }
      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(def.emoji, panelX + 10, y + 20);
      ctx.restore();

      // Name + cost + per-unit CPS
      ctx.font = '11px sans-serif';
      ctx.fillStyle = canAfford ? '#fff' : '#888';
      ctx.fillText(def.name, panelX + 36, y + 14);

      ctx.fillStyle = canAfford ? '#ccc' : '#666';
      ctx.font = '10px sans-serif';
      ctx.fillText('Cost: ' + formatNumber(cost), panelX + 36, y + 26);

      // Show each building's CPS contribution
      const unitCPS = getBuildingCPSPerUnit(def);
      ctx.fillStyle = '#7ec8e3';
      ctx.font = '9px sans-serif';
      ctx.fillText('each: ' + formatCPS(unitCPS) + ' CPS', panelX + 36, y + 38);

      if (buildings[def.id] > 0) {
        const totalBldgCPS = getBuildingTotalCPS(def);
        ctx.fillText('total: ' + formatCPS(totalBldgCPS) + ' CPS', panelX + 140, y + 38);
      }

      // Owned count
      ctx.fillStyle = '#7ec8e3';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(buildings[def.id].toString(), panelX + panelW - 12, y + 22);
      ctx.textAlign = 'left';
    }

    ctx.restore(); // unclip
  }

  function drawUpgradesPanel() {
    const panelX = 10;
    const panelY = 420;
    const panelW = 400;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(panelX, panelY, panelW, CANVAS_H - panelY - 10);

    ctx.fillStyle = '#c8a0ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Upgrades', panelX + 10, panelY + 16);

    const ownedCounts = getOwnedCounts();
    let drawn = 0;
    for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
      const def = UPGRADE_DEFS[i];
      if (upgradePurchased[def.id])
        continue;
      if (!def.condition(ownedCounts))
        continue;
      const x = panelX + 10 + (drawn % 3) * 130;
      const y = panelY + 30 + Math.floor(drawn / 3) * 55;
      const canAfford = cookies >= def.cost;

      ctx.fillStyle = canAfford ? 'rgba(200,160,255,0.2)' : 'rgba(50,50,50,0.3)';
      ctx.fillRect(x, y, 120, 48);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = canAfford ? '#fff' : '#888';
      ctx.fillText(def.name.substring(0, 18), x + 4, y + 14);
      ctx.fillText(formatNumber(def.cost), x + 4, y + 28);
      ctx.fillStyle = '#aaa';
      ctx.fillText('x' + def.multiplier + ' ' + def.target, x + 4, y + 42);
      ++drawn;
    }
  }

  function drawStats() {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatNumber(displayCookies) + ' cookies', COOKIE_CX, 50);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('per second: ' + formatNumber(cps), COOKIE_CX, 72);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#8ac';
    ctx.fillText('per click: ' + formatNumber(clickValue), COOKIE_CX, 88);

    if (heavenlyChips > 0) {
      ctx.fillStyle = '#c8a0ff';
      ctx.font = '12px sans-serif';
      ctx.fillText('\u{2728} ' + heavenlyChips + ' heavenly chips (+' + heavenlyChips + '% CPS)', COOKIE_CX, 104);
    }

    ctx.textAlign = 'left';
  }

  /* ── Tooltip Drawing ── */
  function drawTooltip() {
    if (!tooltip || !tooltip.lines.length)
      return;

    ctx.save();
    ctx.font = '11px sans-serif';

    const padding = 8;
    const lineH = 15;
    let maxW = 0;
    for (const line of tooltip.lines) {
      const t = typeof line === 'object' ? (line.text != null ? String(line.text) : '') : String(line);
      const w = ctx.measureText(t).width;
      if (w > maxW)
        maxW = w;
    }
    const boxW = maxW + padding * 2;
    const boxH = tooltip.lines.length * lineH + padding * 2;

    // Position: prefer left of mouse, offset enough to avoid blocking clicks
    let tx = tooltip.x - boxW - 20;
    let ty = tooltip.y - boxH / 2;
    if (tx < 5)
      tx = tooltip.x + 24;
    if (ty < 5)
      ty = 5;
    if (ty + boxH > CANVAS_H - 5)
      ty = CANVAS_H - 5 - boxH;

    // Background
    ctx.fillStyle = 'rgba(15,15,30,0.92)';
    ctx.strokeStyle = 'rgba(200,200,255,0.4)';
    ctx.lineWidth = 1;
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(tx + r, ty);
    ctx.lineTo(tx + boxW - r, ty);
    ctx.arcTo(tx + boxW, ty, tx + boxW, ty + r, r);
    ctx.lineTo(tx + boxW, ty + boxH - r);
    ctx.arcTo(tx + boxW, ty + boxH, tx + boxW - r, ty + boxH, r);
    ctx.lineTo(tx + r, ty + boxH);
    ctx.arcTo(tx, ty + boxH, tx, ty + boxH - r, r);
    ctx.lineTo(tx, ty + r);
    ctx.arcTo(tx, ty, tx + r, ty, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Text lines
    for (let i = 0; i < tooltip.lines.length; ++i) {
      const line = tooltip.lines[i];
      const text = typeof line === 'object' ? (line.text != null ? String(line.text) : '') : String(line);
      const color = (typeof line === 'object' ? line.color : null) || '#ddd';
      ctx.fillStyle = color;
      ctx.font = line.bold ? 'bold 11px sans-serif' : '11px sans-serif';
      ctx.fillText(text, tx + padding, ty + padding + (i + 1) * lineH - 3);
    }

    ctx.restore();
  }

  /* ── Build tooltip for a hovered building ── */
  function buildBuildingTooltip(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    const cost = buildingCost(def);
    const unitCPS = getBuildingCPSPerUnit(def);
    const newCPS = getCPSAfterBuyingBuilding(defIndex);
    const cpsDelta = newCPS - cps;
    const efficiency = cpsDelta > 0 ? cost / cpsDelta : Infinity;

    const lines = [
      { text: def.emoji + ' ' + def.name, color: '#ffd700', bold: true },
      { text: def.desc, color: '#bbb' },
      { text: '' },
      { text: 'Owned: ' + buildings[def.id], color: '#7ec8e3' },
      { text: 'Each produces: ' + formatCPS(unitCPS) + ' CPS', color: '#8f8' },
      { text: 'Cost: ' + formatNumber(cost) + ' cookies', color: cookies >= cost ? '#6f6' : '#f66' },
      { text: '' },
      { text: '--- If you buy one ---', color: '#aaa' },
      { text: 'CPS: ' + formatCPS(cps) + ' -> ' + formatCPS(newCPS), color: '#8ff' },
      { text: 'CPS increase: +' + formatCPS(cpsDelta), color: '#5f5' }
    ];

    if (efficiency !== Infinity && cpsDelta > 0)
      lines.push({ text: 'Cost per CPS: ' + formatNumber(efficiency), color: '#fc8' });

    return lines;
  }

  /* ── Build tooltip for a hovered upgrade ── */
  function buildUpgradeTooltip(defIndex) {
    const def = UPGRADE_DEFS[defIndex];
    const newCPS = getCPSAfterBuyingUpgrade(def);
    const cpsDelta = newCPS - cps;

    const lines = [
      { text: def.name, color: '#c8a0ff', bold: true },
      { text: def.desc, color: '#bbb' },
      { text: '' },
      { text: 'Cost: ' + formatNumber(def.cost) + ' cookies', color: cookies >= def.cost ? '#6f6' : '#f66' },
      { text: 'Affects: ' + def.target, color: '#aaa' },
      { text: 'Multiplier: x' + def.multiplier, color: '#fc8' }
    ];

    if (def.target === 'click') {
      const newClick = getClickValueAfterUpgrade(def);
      lines.push({ text: '' });
      lines.push({ text: '--- If you buy this ---', color: '#aaa' });
      lines.push({ text: 'Click: ' + formatCPS(clickValue) + ' -> ' + formatCPS(newClick), color: '#8ff' });
    } else {
      lines.push({ text: '' });
      lines.push({ text: '--- If you buy this ---', color: '#aaa' });
      lines.push({ text: 'CPS: ' + formatCPS(cps) + ' -> ' + formatCPS(newCPS), color: '#8ff' });
      if (cpsDelta > 0)
        lines.push({ text: 'CPS increase: +' + formatCPS(cpsDelta), color: '#5f5' });
    }

    if (def.target !== 'click' && def.target !== 'global' && cpsDelta > 0) {
      const efficiency = def.cost / cpsDelta;
      lines.push({ text: 'Cost per CPS: ' + formatNumber(efficiency), color: '#fc8' });
    }

    return lines;
  }

  /* ── Hover detection ── */
  function updateTooltipFromMouse(mx, my) {
    tooltip = null;

    // Check buildings panel hover
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const contentTop = 10 + BLDG_HEADER_H;

    if (mx >= panelX && mx <= panelX + panelW && my >= contentTop && my <= contentTop + BLDG_VISIBLE_H) {
      for (let i = 0; i < BUILDING_DEFS.length; ++i) {
        const y = contentTop + i * BLDG_ROW_TOTAL - buildingScrollOffset;
        if (y + BLDG_ROW_H < contentTop || y > contentTop + BLDG_VISIBLE_H)
          continue;
        if (my >= y && my <= y + BLDG_ROW_H) {
          tooltip = { lines: buildBuildingTooltip(i), x: mx, y: my };
          return;
        }
      }
    }

    // Check upgrades panel hover
    if (mx >= 10 && mx <= 410 && my >= 420) {
      const ownedCounts = getOwnedCounts();
      let drawn = 0;
      for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
        const def = UPGRADE_DEFS[i];
        if (upgradePurchased[def.id])
          continue;
        if (!def.condition(ownedCounts))
          continue;
        const ux = 10 + 10 + (drawn % 3) * 130;
        const uy = 420 + 30 + Math.floor(drawn / 3) * 55;
        if (mx >= ux && mx <= ux + 120 && my >= uy && my <= uy + 48) {
          tooltip = { lines: buildUpgradeTooltip(i), x: mx, y: my };
          return;
        }
        ++drawn;
      }
    }

    // Check cookie hover
    const cdx = mx - COOKIE_CX;
    const cdy = my - COOKIE_CY;
    if (cdx * cdx + cdy * cdy <= COOKIE_R * COOKIE_R) {
      tooltip = {
        lines: [
          { text: 'Big Cookie', color: '#ffd700', bold: true },
          { text: 'Click to earn cookies!', color: '#bbb' },
          { text: '' },
          { text: 'Per click: ' + formatCPS(clickValue) + ' cookies', color: '#8f8' },
          { text: 'Total clicks: ' + formatNumber(totalClicks), color: '#aaa' }
        ],
        x: mx, y: my
      };
    }
  }

  function tickConfetti(dt) {
    if (confettiTimer <= 0)
      return;
    confettiTimer -= dt;
  }

  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    if (!lastTimestamp)
      lastTimestamp = timestamp;
    const rawDt = (timestamp - lastTimestamp) / 1000;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    // Auto-generation
    if (cps > 0) {
      const earned = cps * dt;
      cookies += earned;
      cookiesBaked += earned;
      cookiesBakedAllTime += earned;
    }

    // Smooth counter animation
    displayCookies += (cookies - displayCookies) * Math.min(1, dt * 10);

    // Cookie squish spring
    cookieScaleV += (1 - cookieScale) * 20 * dt;
    cookieScaleV *= 0.85;
    cookieScale += cookieScaleV * dt * 60;

    // Purchase glow fade
    if (purchaseGlowTimer > 0)
      purchaseGlowTimer -= dt;

    // Confetti
    tickConfetti(dt);

    // Achievement check (every second)
    achievementCheckTimer += dt;
    if (achievementCheckTimer >= 1) {
      achievementCheckTimer = 0;
      checkAchievements();
      checkMilestones();
    }

    // Auto-save
    autoSaveTimer += dt;
    if (autoSaveTimer >= AUTO_SAVE_INTERVAL / 1000) {
      autoSaveTimer = 0;
      saveGame();
    }

    // Update background crumb particles
    for (const crumb of bgCrumbs) {
      crumb.y += crumb.speed * dt;
      if (crumb.y > CANVAS_H + 5) {
        crumb.y = -5;
        crumb.x = COOKIE_CX + (Math.random() - 0.5) * 250;
      }
    }

    // Update click ripple
    if (clickRipple) {
      clickRipple.radius += 150 * dt;
      clickRipple.alpha -= 1.4 * dt;
      if (clickRipple.alpha <= 0)
        clickRipple = null;
    }

    // Update effects
    particles.update(dt);
    floatingText.update(dt);

    // Update tooltip from current mouse position
    updateTooltipFromMouse(mouseX, mouseY);

    // ── Draw ──
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bakery warm glow
    ctx.save();
    const glowGrad = ctx.createRadialGradient(COOKIE_CX, COOKIE_CY, 20, COOKIE_CX, COOKIE_CY, 220);
    glowGrad.addColorStop(0, 'rgba(255,180,60,0.12)');
    glowGrad.addColorStop(0.5, 'rgba(200,140,40,0.06)');
    glowGrad.addColorStop(1, 'rgba(200,140,40,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // Background crumb particles
    ctx.save();
    for (const crumb of bgCrumbs) {
      ctx.beginPath();
      ctx.arc(crumb.x, crumb.y, crumb.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,120,60,' + crumb.alpha + ')';
      ctx.fill();
    }
    ctx.restore();

    drawStats();
    drawCookie();

    // Click ripple ring
    if (clickRipple) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(clickRipple.x, clickRipple.y, clickRipple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,215,0,' + clickRipple.alpha + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    drawBuildingsPanel();
    drawUpgradesPanel();

    // Render effects
    particles.draw(ctx);
    floatingText.draw(ctx);

    // Tooltip on top of everything
    drawTooltip();

    updateStatus();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Coordinate helpers ── */
  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  /* ── Click / Pointer Input ── */
  function handleCanvasClick(e) {
    const { x, y } = canvasCoords(e);

    // Check cookie click
    const dx = x - COOKIE_CX;
    const dy = y - COOKIE_CY;
    if (dx * dx + dy * dy <= COOKIE_R * COOKIE_R) {
      handleCookieClick(x, y);
      return;
    }

    // Check building click (within scrollable content area)
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const contentTop = 10 + BLDG_HEADER_H;

    if (x >= panelX && x <= panelX + panelW && y >= contentTop && y <= contentTop + BLDG_VISIBLE_H) {
      for (let i = 0; i < BUILDING_DEFS.length; ++i) {
        const by = contentTop + i * BLDG_ROW_TOTAL - buildingScrollOffset;
        if (by + BLDG_ROW_H < contentTop || by > contentTop + BLDG_VISIBLE_H)
          continue;
        if (y >= by && y <= by + BLDG_ROW_H) {
          buyBuilding(i);
          return;
        }
      }
    }

    // Check upgrade click
    if (x >= 10 && x <= 410 && y >= 420) {
      const ownedCounts = getOwnedCounts();
      let drawn = 0;
      for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
        const def = UPGRADE_DEFS[i];
        if (upgradePurchased[def.id])
          continue;
        if (!def.condition(ownedCounts))
          continue;
        const ux = 10 + 10 + (drawn % 3) * 130;
        const uy = 420 + 30 + Math.floor(drawn / 3) * 55;
        if (x >= ux && x <= ux + 120 && y >= uy && y <= uy + 48) {
          buyUpgrade(i);
          return;
        }
        ++drawn;
      }
    }
  }

  canvas.addEventListener('pointerdown', handleCanvasClick);

  /* ── Mouse move for tooltip ── */
  canvas.addEventListener('pointermove', function(e) {
    const { x, y } = canvasCoords(e);
    mouseX = x;
    mouseY = y;
  });

  canvas.addEventListener('pointerleave', function() {
    mouseX = -1000;
    mouseY = -1000;
    tooltip = null;
  });

  /* ── Scroll on buildings panel ── */
  canvas.addEventListener('wheel', function(e) {
    const { x, y } = canvasCoords(e);
    const panelX = BLDG_PANEL_X;
    const panelW = BLDG_PANEL_W;
    const contentTop = 10 + BLDG_HEADER_H;

    if (x >= panelX && x <= panelX + panelW && y >= contentTop && y <= contentTop + BLDG_VISIBLE_H) {
      e.preventDefault();
      buildingScrollOffset += e.deltaY > 0 ? 55 : -55;
      const maxScroll = getMaxBuildingScroll();
      if (buildingScrollOffset < 0)
        buildingScrollOffset = 0;
      if (buildingScrollOffset > maxScroll)
        buildingScrollOffset = maxScroll;
    }
  }, { passive: false });

  /* ── Keyboard ── */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
    }
  });

  /* ── Resize ── */
  window.addEventListener('resize', setupCanvas);

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => newGame(),
      save: () => saveGame(),
      prestige: async () => {
        const chips = getHeavenlyChipsFromLifetime() - heavenlyChips;
        document.getElementById('prestigeInfo').textContent =
          chips > 0
            ? 'Prestige now to earn ' + chips + ' heavenly chip(s). Each chip gives +1% CPS.'
            : 'You need more cookies to earn heavenly chips. Keep baking!';
        const result = await SZ.Dialog.show('prestigeBackdrop');
        if (result === 'ok' && chips > 0)
          performPrestige();
      },
      exit: () => { saveGame(); SZ.Dlls.User32.DestroyWindow(); },
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — CSS handles repainting
    }
  });

  SZ.Dlls.User32.SetWindowText('Cookie Clicker');

  /* ── Save on blur ── */
  window.addEventListener('blur', saveGame);

  /* ── Init ── */
  setupCanvas();
  loadGame();
  recalcCPS();
  recalcClickValue();
  updateStatus();
  animFrameId = requestAnimationFrame(gameLoop);

})();
