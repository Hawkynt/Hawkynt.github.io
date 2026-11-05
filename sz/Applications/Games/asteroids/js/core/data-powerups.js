/* Static power-up data: twelve pickups with their icon, colour, duration (0 = instant), drop
   weight and what they do; the overdrive blast; the daily challenge modifiers. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});

  const POWERUPS = {
    shield: { name: 'Shield', icon: 'shield', col: '#4ab8ff', dur: 14, w: 12, desc: 'Absorbs one hit and bumps rocks away.' },
    triple: { name: 'Tri-Shot', icon: 'triple', col: '#ff9a3a', dur: 12, w: 12, desc: 'Three-way spread.' },
    rapid: { name: 'Rapid Fire', icon: 'rapid', col: '#ff4a5a', dur: 12, w: 12, desc: 'Fires twice as fast with more shots in the air.' },
    pierce: { name: 'Lance Rounds', icon: 'pierce', col: '#c070ff', dur: 10, w: 9, desc: 'Shots punch through rocks.' },
    homing: { name: 'Seeker Swarm', icon: 'homing', col: '#40f0e0', dur: 10, w: 9, desc: 'Shots curve toward the nearest target.' },
    laser: { name: 'Sunbeam', icon: 'laser', col: '#ffe040', dur: 7, w: 6, desc: 'A continuous beam that melts everything in line.' },
    orbit: { name: 'Orbit Blades', icon: 'orbit', col: '#a0ff60', dur: 14, w: 7, desc: 'Three blades circle the ship and grind rocks.' },
    chrono: { name: 'Chrono Field', icon: 'chrono', col: '#80a0ff', dur: 8, w: 6, desc: 'Everything but you slows to a crawl.' },
    magnet: { name: 'Tractor', icon: 'magnet', col: '#ff80d0', dur: 16, w: 8, desc: 'Pulls stardust and pickups from across the field.' },
    double: { name: 'Score x2', icon: 'double', col: '#ffd25a', dur: 15, w: 6, desc: 'Doubles every point.' },
    nova: { name: 'Nova Bomb', icon: 'nova', col: '#ffffff', dur: 0, w: 4, desc: 'Shatters every rock on the field at once.' },
    gravity: { name: 'Singularity', icon: 'gravity', col: '#ff4ad0', dur: 0, w: 4, desc: 'Drops a black hole that swallows rocks for a while.' },
    life: { name: 'Extra Ship', icon: 'life', col: '#6dff9a', dur: 0, w: 2, desc: 'One more ship.' },
  };

  const POWER_ORDER = ['shield', 'triple', 'rapid', 'pierce', 'homing', 'laser', 'orbit', 'chrono', 'magnet', 'double', 'nova', 'gravity', 'life'];

  /* daily challenge modifiers: a seeded pick of two each day */
  const MODIFIERS = {
    ironRain: { name: 'Iron Rain', desc: 'Every rock is iron or harder.' },
    glass: { name: 'Glass Cannon', desc: 'Double damage, but no shields drop.' },
    swarm: { name: 'Swarm', desc: 'Hunters arrive in endless packs.' },
    goldRush: { name: 'Gold Rush', desc: 'Gold rocks everywhere.' },
    drift: { name: 'Zero Drag', desc: 'Your ship never slows down.' },
    bounty: { name: 'Bounty', desc: 'Raiders are worth triple.' },
    bigRocks: { name: 'Colossi', desc: 'Every wave brings a colossal rock.' },
    frenzy: { name: 'Frenzy', desc: 'Power-ups drop twice as often but last half as long.' },
  };

  Object.assign(NS.powerData, {
    POWERUPS, POWER_ORDER, MODIFIERS
  });
})();
