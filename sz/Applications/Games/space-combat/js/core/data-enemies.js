/* Static enemy data: ten hostile ship types with their behaviour, weapons and wave cost, and the
   five multi-part bosses with parts, weak points and attack phases. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  /* ai: behaviour in systems/enemies.js; cost: wave budget points; fire.rate = seconds between bursts */
  const ENEMIES = {
    fighter: {
      name: 'Raider', role: 'Strafes around you at mid range and fires bursts.',
      hp: 40, r: 20, speed: 300, accel: 620, score: 100, scrap: 5, cost: 2, ai: 'strafe', range: 330,
      fire: { rate: 1.7, burst: 3, gap: 0.12, speed: 470, dmg: 7, kind: 'bolt', color: 'red' },
    },
    interceptor: {
      name: 'Hornet', role: 'Fast pursuer that leads its shots and overshoots.',
      hp: 30, r: 17, speed: 480, accel: 900, score: 120, scrap: 6, cost: 2, ai: 'pursue', range: 240,
      fire: { rate: 1.2, burst: 2, gap: 0.1, speed: 580, dmg: 6, kind: 'bolt', color: 'orange' },
    },
    bomber: {
      name: 'Hammerhead', role: 'Slow bomber that lobs heavy plasma at stations and convoys.',
      hp: 130, r: 28, speed: 150, accel: 240, score: 250, scrap: 12, cost: 4, ai: 'bomber', range: 420,
      fire: { rate: 2.8, burst: 1, gap: 0, speed: 240, dmg: 18, kind: 'orb', color: 'violet', count: 3, arc: 0.5 },
    },
    drone: {
      name: 'Swarmer', role: 'Kamikaze drone; detonates on contact.',
      hp: 14, r: 12, speed: 370, accel: 760, score: 50, scrap: 2, cost: 1, ai: 'kamikaze',
      blast: { dmg: 20, radius: 70 },
    },
    turret: {
      name: 'Sentry', role: 'Static gun platform that tracks you.',
      hp: 110, r: 24, speed: 0, accel: 0, score: 150, scrap: 8, cost: 3, ai: 'turret', range: 620,
      fire: { rate: 1.5, burst: 4, gap: 0.09, speed: 520, dmg: 7, kind: 'bolt', color: 'red' },
    },
    station: {
      name: 'Outpost', role: 'Armoured base with sentries; launches swarmers.',
      hp: 1100, r: 70, speed: 0, accel: 0, score: 1500, scrap: 50, cost: 12, ai: 'station', range: 700,
      spawn: { type: 'drone', every: 7, count: 3 }, turrets: 3,
    },
    frigate: {
      name: 'Bulwark', role: 'Shielded frigate: its front arc blocks shots. Flank it.',
      hp: 300, r: 40, speed: 115, accel: 150, score: 500, scrap: 22, cost: 6, ai: 'frigate', range: 520,
      shieldArc: 1.05,
      fire: { rate: 2.2, burst: 1, gap: 0, speed: 400, dmg: 8, kind: 'pellet', color: 'orange', count: 5, arc: 0.6 },
    },
    cloaker: {
      name: 'Phantom', role: 'Cloaks, closes in unseen and decloaks to strike.',
      hp: 55, r: 19, speed: 340, accel: 520, score: 300, scrap: 11, cost: 3, ai: 'cloak', range: 280,
      fire: { rate: 0.9, burst: 5, gap: 0.07, speed: 520, dmg: 6, kind: 'bolt', color: 'violet' },
    },
    carrier: {
      name: 'Leviathan', role: 'Huge carrier that launches raiders and swarmers.',
      hp: 820, r: 66, speed: 70, accel: 90, score: 1200, scrap: 45, cost: 10, ai: 'carrier', range: 700,
      spawn: { type: 'fighter', every: 6.5, count: 2, alt: 'drone' },
      fire: { rate: 3.2, burst: 1, gap: 0, speed: 300, dmg: 10, kind: 'orb', color: 'red', count: 8, arc: 6.283 },
    },
    lancer: {
      name: 'Lancer', role: 'Long-range sniper: a red line warns before the beam.',
      hp: 65, r: 20, speed: 230, accel: 400, score: 260, scrap: 11, cost: 3, ai: 'lancer', range: 720,
      beam: { charge: 1.15, dmg: 24, every: 3.6, width: 10 },
    },
  };

  const ENEMY_ORDER = ['fighter', 'interceptor', 'drone', 'bomber', 'turret', 'frigate', 'cloaker', 'lancer', 'carrier', 'station'];

  /* Bosses. Part coordinates are relative to the boss centre, facing +x.
     shieldBy: the core is invulnerable while parts of that type live (minimum left alive = shieldMin).
     weak: 'mouth' (core only vulnerable while the mouth is open), 'rear' (frontal arc armoured). */
  const BOSSES = {
    warden: {
      name: 'Warden', title: 'Orbital Bastion', sector: 0, hp: 3600, r: 74, score: 12000, scrap: 400,
      move: { type: 'hover', dist: 430, speed: 90, spin: 0.35 },
      shieldBy: 'shield', shieldMin: 0,
      parts: [
        { type: 'shield', x: 0, y: -128, hp: 440, r: 26 },
        { type: 'shield', x: 0, y: 128, hp: 440, r: 26 },
        { type: 'turret', x: 128, y: 0, hp: 370, r: 24 },
        { type: 'turret', x: -128, y: 0, hp: 370, r: 24 },
      ],
      phases: [
        { at: 1, attacks: ['aimed', 'ring'], every: 2.4 },
        { at: 0.6, attacks: ['spiral', 'aimed', 'summon:drone:4'], every: 2.1 },
        { at: 0.3, attacks: ['spiral2', 'ring', 'summon:fighter:2'], every: 1.7, spin: 0.7 },
      ],
    },
    hydra: {
      name: 'Hydra', title: 'Serpent of the Crimson Deep', sector: 1, hp: 3900, r: 48, score: 15000, scrap: 480,
      move: { type: 'serpent', dist: 300, speed: 230, segments: 8, spacing: 46 },
      weak: 'rear', arc: 0.9,
      parts: [],
      phases: [
        { at: 1, attacks: ['fan', 'segments'], every: 2.2 },
        { at: 0.6, attacks: ['segments', 'mines', 'fan'], every: 1.9 },
        { at: 0.3, attacks: ['charge', 'segments', 'ring'], every: 1.6, speed: 1.35 },
      ],
    },
    solaris: {
      name: 'Solaris', title: 'Sunforged Dreadnought', sector: 2, hp: 5600, r: 82, score: 18000, scrap: 560,
      move: { type: 'stalk', dist: 520, speed: 70, turn: 0.45 },
      shieldBy: 'shield', shieldMin: 0,
      parts: [
        { type: 'shield', x: -70, y: -74, hp: 540, r: 26 },
        { type: 'shield', x: -70, y: 74, hp: 540, r: 26 },
        { type: 'beam', x: 52, y: -92, hp: 480, r: 24 },
        { type: 'beam', x: 52, y: 92, hp: 480, r: 24 },
        { type: 'turret', x: 0, y: -60, hp: 310, r: 20 },
        { type: 'turret', x: 0, y: 60, hp: 310, r: 20 },
      ],
      phases: [
        { at: 1, attacks: ['aimed', 'beam'], every: 2.6 },
        { at: 0.6, attacks: ['missiles', 'beam', 'fan'], every: 2.2 },
        { at: 0.3, attacks: ['ring', 'beam', 'missiles', 'spiral'], every: 1.8 },
      ],
    },
    maw: {
      name: 'The Maw', title: 'Leviathan of the Abyss', sector: 3, hp: 7000, r: 88, score: 21000, scrap: 640,
      move: { type: 'hover', dist: 480, speed: 60, spin: 0, gravity: 160 },
      weak: 'mouth',
      parts: [
        { type: 'launcher', x: -40, y: -110, hp: 510, r: 26 },
        { type: 'launcher', x: -40, y: 110, hp: 510, r: 26 },
        { type: 'turret', x: -110, y: -50, hp: 370, r: 22 },
        { type: 'turret', x: -110, y: 50, hp: 370, r: 22 },
      ],
      phases: [
        { at: 1, attacks: ['mouth', 'summon:drone:5', 'aimed'], every: 2.6 },
        { at: 0.6, attacks: ['mouth', 'ring', 'summon:interceptor:2'], every: 2.2, gravity: 230 },
        { at: 0.3, attacks: ['mouth', 'spiral2', 'ring'], every: 1.7, gravity: 300 },
      ],
    },
    overmind: {
      name: 'Overmind', title: 'Heart of the Void Citadel', sector: 4, hp: 7800, r: 78, score: 26000, scrap: 800,
      move: { type: 'hover', dist: 460, speed: 80, spin: 0.9 },
      shieldBy: 'shard', shieldMin: 3,
      parts: [
        { type: 'shard', orbit: 170, a: 0, hp: 410, r: 22 },
        { type: 'shard', orbit: 170, a: 1.047, hp: 410, r: 22 },
        { type: 'shard', orbit: 170, a: 2.094, hp: 410, r: 22 },
        { type: 'shard', orbit: 170, a: 3.142, hp: 410, r: 22 },
        { type: 'shard', orbit: 170, a: 4.189, hp: 410, r: 22 },
        { type: 'shard', orbit: 170, a: 5.236, hp: 410, r: 22 },
      ],
      phases: [
        { at: 1, attacks: ['shards', 'aimed', 'ring'], every: 2.2 },
        { at: 0.6, attacks: ['teleport', 'summon:cloaker:3', 'spiral'], every: 2 },
        { at: 0.3, attacks: ['spiral2', 'beam', 'teleport', 'ring'], every: 1.5, spin: 1.6 },
      ],
    },
  };

  const BOSS_ORDER = ['warden', 'hydra', 'solaris', 'maw', 'overmind'];

  Object.assign(NS.enemyData, {
    ENEMIES, ENEMY_ORDER, BOSSES, BOSS_ORDER
  });
})();
