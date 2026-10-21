/* The achievement table: baking, clicking, building, CPS, prestige, total-building
   and upgrade milestones, each with its unlock condition over a state snapshot. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
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

  NS.achievementDefs = ACHIEVEMENT_DEFS;
})();
