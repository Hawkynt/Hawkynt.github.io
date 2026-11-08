/* Tuning constants: the 1280 x 720 view plane and where the 700 x 640 field sits in it, the
   brick grid (14 columns of 50 x 22), paddle, ball and drop geometry and speeds, combo timing,
   the brick kinds with their hit points and points, the power-ups, pool sizes, storage keys and
   the UI palette. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});

  /* brick kinds by layout character: hp, points, breakable, colour */
  const BRICKS = {
    '1': { kind: 'normal', hp: 1, points: 10, color: '#ff5a6a' }, '2': { kind: 'normal', hp: 1, points: 10, color: '#ff9a3a' },
    '3': { kind: 'normal', hp: 1, points: 10, color: '#ffd23a' }, '4': { kind: 'normal', hp: 1, points: 10, color: '#5ae07a' },
    '5': { kind: 'normal', hp: 1, points: 10, color: '#4ab4ff' }, '6': { kind: 'normal', hp: 1, points: 10, color: '#b47aff' },
    s: { kind: 'steel', hp: 2, points: 25, color: '#b8c4d8' }, t: { kind: 'titan', hp: 3, points: 40, color: '#7a8aa8' },
    g: { kind: 'glass', hp: 1, points: 15, color: '#c8f4ff' }, '#': { kind: 'wall', hp: 0, points: 0, color: '#3a3050' },
    b: { kind: 'bomb', hp: 1, points: 20, color: '#ff4a2a' }, r: { kind: 'regen', hp: 1, points: 15, color: '#7affb0' },
    '*': { kind: 'gold', hp: 2, points: 100, color: '#ffd25a' }, c: { kind: 'crystal', hp: 1, points: 30, color: '#ff7ad8' },
  };

  const POWERS = [
    { id: 'wide', name: 'Wide', desc: 'A longer paddle for 15 s', color: '#5ae07a', icon: 'wide', good: true, w: 14 },
    { id: 'multi', name: 'Multi', desc: 'Every ball splits into three', color: '#ff7ad8', icon: 'multi', good: true, w: 12 },
    { id: 'slow', name: 'Slow', desc: 'Slower balls for 12 s', color: '#5ad0ff', icon: 'clock', good: true, w: 10 },
    { id: 'fire', name: 'Fire', desc: 'Balls burn through bricks for 8 s', color: '#ff8a2a', icon: 'fire', good: true, w: 8 },
    { id: 'laser', name: 'Laser', desc: 'Twin cannons for 10 s (Space or click)', color: '#ff4a5a', icon: 'laser', good: true, w: 9 },
    { id: 'barrier', name: 'Barrier', desc: 'A shield that saves one ball', color: '#8a8aff', icon: 'shield', good: true, w: 8 },
    { id: 'magnet', name: 'Magnet', desc: 'Balls stick to the paddle for 15 s', color: '#c8a0ff', icon: 'magnet', good: true, w: 7, unlock: true },
    { id: 'mega', name: 'Mega Ball', desc: 'Huge balls that smash three times as hard for 10 s', color: '#ffd25a', icon: 'mega', good: true, w: 6, unlock: true },
    { id: 'life', name: 'Extra Life', desc: 'One more ball in reserve', color: '#ff5a6a', icon: 'heart', good: true, w: 2 },
    { id: 'star', name: 'Star Shower', desc: 'Stars fall and break the bricks they hit', color: '#fff4a0', icon: 'star', good: true, w: 4, unlock: true },
    { id: 'shrink', name: 'Shrink', desc: 'A shorter paddle for 10 s', color: '#8a8a9a', icon: 'shrink', good: false, w: 5 },
    { id: 'fast', name: 'Haste', desc: 'Faster balls for 10 s', color: '#9a6a6a', icon: 'bolt', good: false, w: 5 },
  ];
  const POWER_BY_ID = {};
  for (const p of POWERS) POWER_BY_ID[p.id] = p;

  const UI = {
    accent: '#ff7ad8', gold: '#ffd25a', good: '#7be08a', bad: '#ff6a6a', shard: '#8fe0ff', gem: '#ff7ad8', xp: '#c8a0ff',
    text: '#f4f0ff', textDim: '#b8acd8', textMute: '#76709a', panelTop: 'rgba(40,24,64,0.94)', panelBottom: 'rgba(16,8,30,0.96)',
    font: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  };

  NS.constants = {
    VIEW_W: 1280, VIEW_H: 720, TAU: Math.PI * 2,
    FIELD_W: 700, FIELD_H: 640, FIELD_X: 290, FIELD_Y: 60,
    COLS: 14, BRICK_W: 50, BRICK_H: 22, BRICK_TOP: 70, ROWS_MAX: 16,
    PADDLE_Y: 600, PADDLE_H: 16, PADDLE_W: 110, PADDLE_SPEED: 760, PADDLE_FOLLOW: 2400,
    BALL_R: 8, BALL_SPEED: 400, BALL_SPEED_STEP: 10, BALL_SPEED_MAX: 640, MAX_BALLS: 24,
    DROP_SPEED: 170, DROP_W: 46, DROP_H: 20, DROP_CHANCE: 0.16, LASER_SPEED: 900, LASER_GAP: 0.28,
    COMBO_TIME: 1.4, REGEN_TIME: 8, STUCK_TIME: 9,
    STEP: 1 / 240, MAX_DT: 0.1, AUTOSAVE: 3,
    BRICKS, POWERS, POWER_BY_ID, UI,
    MAX_PARTICLES: 1000, MAX_TEXTS: 40, MAX_RINGS: 40,
    PROFILE_KEY: 'sz-breakout-profile', RUN_KEY: 'sz-breakout-run', LEGACY_KEY: 'sz-breakout-high-scores', SAVE_VERSION: 1,
  };
})();
