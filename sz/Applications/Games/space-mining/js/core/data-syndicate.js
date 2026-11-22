/* Static Syndicate data: what each structure and unit costs and takes to build, the build orders
   a base works through (and the loop it falls into after), what its factories turn out, the
   rings of build spots round the core and round a relay, and its income. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* cost in Syndicate credits, build time in seconds */
  const BUILD = {
    syn_harvester: { cost: 300, time: 8 },
    syn_tower: { cost: 350, time: 9 },
    syn_battery: { cost: 700, time: 12 },
    syn_factory: { cost: 600, time: 12 },
    syn_relay: { cost: 150, time: 5 },
    syn_pylon: { cost: 500, time: 10 },
  };
  const UNITS = {
    syn_fighter: { cost: 160, time: 7 },
    juggernaut: { cost: 700, time: 18 },
    stalker: { cost: 260, time: 10 },
    nanodrone: { cost: 120, time: 6 },
    nanoswarm: { cost: 220, time: 9 },
  };
  const ORDERS = {
    outpost: ['syn_harvester', 'syn_tower', 'syn_harvester', 'syn_factory', 'syn_relay', 'syn_harvester', 'syn_tower', 'syn_harvester'],
    standard: ['syn_harvester', 'syn_tower', 'syn_factory', 'syn_harvester', 'syn_relay', 'syn_tower', 'syn_harvester', 'syn_battery', 'syn_factory', 'syn_relay',
      'syn_harvester', 'syn_tower', 'syn_pylon'],
    fortress: ['syn_tower', 'syn_pylon', 'syn_battery', 'syn_harvester', 'syn_tower', 'syn_factory', 'syn_battery', 'syn_relay', 'syn_pylon', 'syn_tower', 'syn_harvester',
      'syn_battery'],
    expand: ['syn_relay', 'syn_harvester', 'syn_relay', 'syn_harvester', 'syn_relay', 'syn_harvester', 'syn_tower', 'syn_relay', 'syn_harvester'],
  };
  /* what a base builds once its order is done, round and round */
  const LOOP = ['syn_harvester', 'syn_tower', 'syn_relay', 'syn_harvester', 'syn_battery'];
  const MAX_STRUCTURES = 30;
  /* factory output by weight */
  const MIX = {
    light: { syn_fighter: 1 },
    standard: { syn_fighter: 3, juggernaut: 1, stalker: 1 },
    heavy: { syn_fighter: 2, juggernaut: 2, stalker: 1 },
    lattice: { nanodrone: 3, nanoswarm: 2 },
  };
  /* build spots: rings round the core, a ring round each relay */
  const RINGS = [{ r: 170, n: 6 }, { r: 290, n: 10 }, { r: 410, n: 14 }];
  const RELAY_RING = { n: 8 };
  const INCOME = 2;

  Object.assign(NS.syndicateData, {
    BUILD, UNITS, ORDERS, LOOP, MAX_STRUCTURES, MIX, RINGS, RELAY_RING, INCOME
  });
})();
