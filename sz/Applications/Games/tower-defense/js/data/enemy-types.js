/* data/enemy-types.js -- monster and boss definitions. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});

  /* ══════════════════════════════════════════════════════════════════
     ENEMY DEFINITIONS
     hp/speed/bounty are wave-1 values; cost is the share of a wave's
     budget; unlock is the share of the map's waves after which the type
     can appear. The first eight keys are kept from format 1 saves.
     ══════════════════════════════════════════════════════════════════ */

  const ENEMY_TYPES = {
    normal:   { name: 'Grunt', hp: 42, speed: 36, bounty: 5, radius: 7, color: '#d8584a', cost: 1, unlock: 0,
                info: 'Basic foot soldier.', counter: 'Anything' },
    fast:     { name: 'Runner', hp: 28, speed: 70, bounty: 5, radius: 6, color: '#5ad86a', cost: 1.1, unlock: 0.1, gap: 0.4,
                info: 'Quick and fragile.', counter: 'Frost, Archer' },
    swarm:    { name: 'Swarmling', hp: 14, speed: 58, bounty: 2, radius: 5, color: '#ffb03a', cost: 0.45, unlock: 0.16, gap: 0.22, pack: 6,
                info: 'Tiny, arrives in packs.', counter: 'Cannon, Flamer, Spikes' },
    flying:   { name: 'Bat', hp: 34, speed: 50, bounty: 7, radius: 6, color: '#9a8aff', cost: 1.6, unlock: 0.24, flying: true,
                info: 'Flies straight across the map, ignoring the path.', counter: 'Archer, Tesla, Frost' },
    armored:  { name: 'Brute', hp: 130, speed: 26, bounty: 13, radius: 9, color: '#9aa4b4', cost: 3.2, unlock: 0.3, armor: 5, gap: 1.0, batters: 1.2,
                info: 'Heavy armor shrugs off small hits; dents towers it passes.', counter: 'Laser, Venom, Sniper' },
    splitter: { name: 'Slime', hp: 80, speed: 32, bounty: 8, radius: 8, color: '#5ae0b4', cost: 3, unlock: 0.36, split: 'slimelet', splitCount: 3,
                info: 'Splits into three slimelets when it dies.', counter: 'Cannon, Flamer' },
    slimelet: { name: 'Slimelet', hp: 22, speed: 46, bounty: 1, radius: 5, color: '#8ff0d0', cost: 0, unlock: 2,
                info: 'Leftover of a slime.', counter: 'Splash' },
    healer:   { name: 'Shaman', hp: 60, speed: 33, bounty: 12, radius: 7, color: '#6aff8a', cost: 3, unlock: 0.44, heals: true,
                info: 'Heals nearby enemies every few seconds.', counter: 'Sniper (Strong targeting)' },
    stealth:  { name: 'Phantom', hp: 55, speed: 46, bounty: 10, radius: 7, color: '#b89aff', cost: 2.6, unlock: 0.5, stealth: true,
                info: 'Invisible to towers until spotted or caught by area damage.', counter: 'Sniper, Longbow, splash' },
    shield:   { name: 'Warden', hp: 75, speed: 30, bounty: 14, radius: 8, color: '#5ad8ff', cost: 3.6, unlock: 0.56, shielded: 0.5, shielder: true,
                info: 'Carries an energy shield and shields allies around it.', counter: 'Tesla, Venom' },
    drake:    { name: 'Wyvern', hp: 190, speed: 34, bounty: 18, radius: 10, color: '#ff7a5a', cost: 6, unlock: 0.68, flying: true, armor: 3, gap: 1.1,
                info: 'Armored flyer.', counter: 'Sniper, Laser, Tesla' },
    golem:    { name: 'Juggernaut', hp: 420, speed: 18, bounty: 32, radius: 12, color: '#b08a6a', cost: 11, unlock: 0.8, armor: 10, gap: 1.6, batters: 3,
                info: 'Walking fortress with massive armor.', counter: 'Venom, Acid, Solar Lance' },
    skeleton: { name: 'Skeleton', hp: 30, speed: 40, bounty: 1, radius: 6, color: '#e8e2d4', cost: 0, unlock: 2,
                info: 'Raised by the Lich.', counter: 'Anything' },
    beetle:   { name: 'Burrower', hp: 70, speed: 34, bounty: 9, radius: 7, color: '#c8904a', cost: 2.4, unlock: 0.2, burrows: true,
                info: 'Digs under the road now and then, out of reach of towers.', counter: 'Spikes, slows' },
    hornet:   { name: 'Hornet', hp: 18, speed: 64, bounty: 3, radius: 5, color: '#ffd23a', cost: 0.6, unlock: 0.28, flying: true, gap: 0.25, pack: 5,
                info: 'Fast flying swarm.', counter: 'Missile, Tesla, Storm' },
    rhino:    { name: 'Charger', hp: 110, speed: 28, bounty: 12, radius: 9, color: '#8a8aa8', cost: 3.2, unlock: 0.34, armor: 2, charges: true,
                info: 'Every few seconds it charges at triple speed.', counter: 'Frost, Wind' },
    ghoul:    { name: 'Ghoul', hp: 95, speed: 32, bounty: 11, radius: 7, color: '#8ab070', cost: 3, unlock: 0.4, regen: 0.03,
                info: 'Regenerates quickly unless it is burning or poisoned.', counter: 'Flamer, Venom' },
    gremlin:  { name: 'Saboteur', hp: 60, speed: 44, bounty: 14, radius: 6, color: '#5ac8a0', cost: 3, unlock: 0.48, sabotage: true,
                info: 'Jams towers it runs past for a few seconds.', counter: 'Long range: Sniper, Mortar' },
    hexer:    { name: 'Hexer', hp: 70, speed: 30, bounty: 14, radius: 7, color: '#c86aff', cost: 3.2, unlock: 0.6, cleanses: true,
                info: 'Breaks slows, freezes and stuns on enemies around it.', counter: 'Burst damage, kill it first' },
    boss:     { name: 'Warlord', hp: 1100, speed: 20, bounty: 120, radius: 15, color: '#ff4ad8', boss: true, armor: 6, lives: 5, batters: 5, gap: 2, warcry: true,
                info: 'Boss. Huge armor; its war cry jams the towers around it.', counter: 'Spread your towers out' },
    dragon:   { name: 'Dragon', hp: 1250, speed: 26, bounty: 140, radius: 16, color: '#ff5a3a', boss: true, flying: true, armor: 4, lives: 5, gap: 2,
                info: 'Flying boss that crosses the map in a straight line.', counter: 'Anti-air: Archer, Tesla, Sniper' },
    lich:     { name: 'Lich King', hp: 1450, speed: 18, bounty: 160, radius: 15, color: '#8affd8', boss: true, armor: 2, lives: 5, summons: true, gap: 2,
                info: 'Boss. Raises skeletons and grows furious when hurt.', counter: 'Splash for the skeletons, focus the Lich' },
    colossus: { name: 'Aegis Colossus', hp: 1500, speed: 17, bounty: 170, radius: 16, color: '#7ab8ff', boss: true, armor: 5, lives: 5, gap: 2, phases: true,
                info: 'Boss. Raises a huge energy shield at two thirds and one third health.', counter: 'Tesla breaks shields, Venom and Arcane ignore them' },
    sandworm: { name: 'Sandworm', hp: 1350, speed: 24, bounty: 160, radius: 15, color: '#d8a860', boss: true, armor: 3, lives: 5, gap: 2, burrows: true,
                info: 'Boss. Dives under the ground and races ahead.', counter: 'Spikes and slows on the road' },
    slimeking:{ name: 'Slime King', hp: 1300, speed: 18, bounty: 150, radius: 17, color: '#4ae0a8', boss: true, lives: 5, gap: 2, split: 'splitter', splitCount: 4,
                info: 'Boss. Bursts into four big slimes when it falls.', counter: 'Splash damage behind the boss' },
    troll:    { name: 'Troll Chieftain', hp: 1600, speed: 19, bounty: 170, radius: 16, color: '#6a9a5a', boss: true, armor: 4, lives: 5, gap: 2, regen: 0.02,
                info: 'Boss. Regenerates fast unless it burns or is poisoned.', counter: 'Flamer, Venom, Inferno' }
  };

  for (const k in ENEMY_TYPES)
    ENEMY_TYPES[k].key = k;

  // Bosses in the order the campaign introduces them, and the campaign place
  // (0-based) of the map where each one first appears
  const BOSS_ORDER = ['boss', 'slimeking', 'lich', 'troll', 'dragon', 'sandworm', 'colossus'];
  const BOSS_FROM_RANK = [0, 1, 3, 6, 9, 12, 15];
  const ELITE_HP = 2.2;

  NS.enemyTypes = { ENEMY_TYPES, BOSS_ORDER, BOSS_FROM_RANK, ELITE_HP };

})();
