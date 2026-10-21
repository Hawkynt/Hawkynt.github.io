/* The upgrade table: click, per-building and global multipliers with the owned-
   building condition that reveals each one. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
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

  NS.upgradeDefs = UPGRADE_DEFS;
})();
