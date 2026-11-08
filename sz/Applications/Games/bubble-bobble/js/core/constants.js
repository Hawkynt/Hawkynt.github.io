/* Tuning constants: the 1280 x 720 view plane and where the 672 x 560 field (24 x 20 tiles of
   28 px) sits in it, platform physics (gravity, run, jump that reaches three tiles), bubbles
   (speed, range, float, trap time), enemies, the enemy kinds, the candy power-ups, the elemental
   bubbles, pool sizes, storage keys and the UI palette. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});

  /* enemy kinds: speed (px/s), behaviour, how many bubbles trap it, points */
  const ENEMIES = {
    walker: { name: 'Grumble', speed: 70, kind: 'walk', hp: 1, points: 1000, color: '#ff8a5a', jumps: true },
    hopper: { name: 'Boing', speed: 60, kind: 'hop', hp: 1, points: 1000, color: '#7be08a', jumps: true },
    flyer: { name: 'Flitter', speed: 80, kind: 'fly', hp: 1, points: 1500, color: '#c08aff' },
    shooter: { name: 'Pebbler', speed: 55, kind: 'walk', hp: 1, points: 1500, color: '#e0c060', shoots: true, jumps: true },
    charger: { name: 'Zoomer', speed: 120, kind: 'walk', hp: 1, points: 2000, color: '#ff5a7a', jumps: true },
    brute: { name: 'Bulk', speed: 45, kind: 'walk', hp: 2, points: 3000, color: '#8a9ab0', jumps: false },
    ghost: { name: 'Wisp', speed: 50, kind: 'ghost', hp: 1, points: 2500, color: '#c8e8ff' },
  };

  const POWERS = [
    { id: 'shoes', name: 'Swift Shoes', desc: 'Run faster for the rest of the stage', color: '#5ad0ff', icon: 'bolt', w: 10 },
    { id: 'rapid', name: 'Rapid Gum', desc: 'Blow bubbles twice as fast', color: '#ff7ad8', icon: 'multi', w: 10 },
    { id: 'range', name: 'Long Breath', desc: 'Bubbles fly twice as far', color: '#7be08a', icon: 'wide', w: 9 },
    { id: 'big', name: 'Big Bubbles', desc: 'Huge bubbles that trap more easily', color: '#ffd25a', icon: 'mega', w: 7, unlock: true },
    { id: 'shield', name: 'Bubble Shield', desc: 'Survive one hit', color: '#c8a0ff', icon: 'shield', w: 6 },
    { id: 'freeze', name: 'Frost Pop', desc: 'Every enemy freezes for 6 s', color: '#bfe8ff', icon: 'clock', w: 5, unlock: true },
    { id: 'magnet', name: 'Fruit Magnet', desc: 'Fruit flies to you', color: '#ff9a3a', icon: 'magnet', w: 6, unlock: true },
    { id: 'bomb', name: 'Pop Bomb', desc: 'Every trapped enemy pops at once', color: '#ff4a2a', icon: 'bomb', w: 4, unlock: true },
  ];
  const POWER_BY_ID = {};
  for (const p of POWERS) POWER_BY_ID[p.id] = p;

  const UI = {
    accent: '#5ad0ff', gold: '#ffd25a', good: '#7be08a', bad: '#ff6a6a', shard: '#8fe0ff', gem: '#ff7ad8', xp: '#c8a0ff',
    text: '#f0f8ff', textDim: '#a8c0e0', textMute: '#6a80a0', panelTop: 'rgba(18,40,70,0.94)', panelBottom: 'rgba(6,16,34,0.96)',
    font: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  };

  NS.constants = {
    VIEW_W: 1280, VIEW_H: 720, TAU: Math.PI * 2,
    TILE: 28, COLS: 24, ROWS: 20, FIELD_W: 672, FIELD_H: 560, FIELD_X: 304, FIELD_Y: 80,
    GRAVITY: 1500, JUMP: 560, RUN: 170, FALL_MAX: 520, PW: 22, PH: 24,
    BUBBLE_R: 15, BUBBLE_SPEED: 430, BUBBLE_RANGE: 130, BUBBLE_RISE: 110, BUBBLE_LIFE: 12, TRAP_TIME: 7, SHOT_GAP: 0.32,
    BUDDY_BACK: 3.5, ANGRY_AT: 40, SHADE_AT: 55, INVULN: 2, STAR_GOAL: 5,
    ENEMIES, POWERS, POWER_BY_ID, UI,
    STEP: 1 / 120, MAX_DT: 0.1, AUTOSAVE: 3,
    MAX_PARTICLES: 900, MAX_TEXTS: 40, MAX_RINGS: 40,
    PROFILE_KEY: 'sz-bubble-bobble-profile', RUN_KEY: 'sz-bubble-bobble-run', LEGACY_KEY: 'sz-bubble-bobble-highscores', SAVE_VERSION: 1,
  };
})();
