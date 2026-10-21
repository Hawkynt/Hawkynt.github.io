/* The fourteen building types with base costs, base CPS, emoji and flavor text. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
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

  NS.buildingDefs = BUILDING_DEFS;
})();
