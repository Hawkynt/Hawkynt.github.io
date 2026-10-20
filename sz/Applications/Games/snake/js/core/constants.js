/* Cell size, storage keys, scoring and level constants, speed/field presets, the
   direction vectors, the theme color tables, the power-up types and the game presets.
   Pure data, owns no state. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants || (NS.constants = {});

  C.CELL = 20;
  C.STORAGE_KEY = 'sz-snake-high-scores';
  C.CONFIG_KEY = 'sz-snake-config';
  C.MAX_HIGH_SCORES = 5;
  C.INITIAL_LENGTH = 3;
  C.FOODS_PER_LEVEL = 5;
  C.FOOD_SCORE_BASE = 10;
  C.INTERVAL_STEP = 10;
  C.AI_KILL_BONUS = 50;
  C.AI_RESPAWN_DELAY = 3000;
  C.POWERUP_SPAWN_DELAY = 3000;
  C.POWERUP_LIFETIME = 15000;
  C.POWERUP_BLINK_START = 12000;

  C.SPEED_PRESETS = {
    slow:   { base: 200, min: 100 },
    normal: { base: 150, min: 50 },
    fast:   { base: 100, min: 40 },
    insane: { base: 60,  min: 30 }
  };

  C.FIELD_SIZES = {
    small:  { cols: 15, rows: 15 },
    medium: { cols: 20, rows: 20 },
    large:  { cols: 80, rows: 60 }
  };

  C.DIR = {
    UP:    { x:  0, y: -1 },
    DOWN:  { x:  0, y:  1 },
    LEFT:  { x: -1, y:  0 },
    RIGHT: { x:  1, y:  0 }
  };
  C.ALL_DIRS = [C.DIR.UP, C.DIR.DOWN, C.DIR.LEFT, C.DIR.RIGHT];

  C.AI_COLORS = [
    { head: '#e88a2a', body: '#c76f1a' },
    { head: '#9c27b0', body: '#7b1fa2' },
    { head: '#00bcd4', body: '#0097a7' }
  ];

  C.TRON_COLORS = {
    player: '#00e5ff',
    ai: ['#ff6d00', '#d500f9', '#ff1744'],
    bg: '#050510',
    grid: 'rgba(0,100,255,0.06)',
    width: 5
  };

  C.ZEN_COLORS = {
    bg: '#0a1a0a',
    grid: 'rgba(34,139,34,0.06)',
    leafColors: ['#2e7d32', '#388e3c', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7']
  };

  C.MAZE_COLORS = {
    bg: '#1a1208',
    brick: '#8d6e4f',
    mortar: '#3e2723',
    darkBrick: '#5d4037',
    flame: ['#ff6d00', '#ff9100', '#ffab00', '#ffd600'],
    ember: ['#ff6d00', '#e65100', '#bf360c', '#4e342e'],
    coin: '#ffd700',
    coinHighlight: '#fff8e1'
  };

  C.POWERUP_TYPES = [
    { id: 'speed',  name: 'Speed+',  color: '#ffeb3b', icon: 'lightning', duration: 8000 },
    { id: 'slow',   name: 'Slow',    color: '#00e5ff', icon: 'clock',     duration: 8000 },
    { id: 'shield', name: 'Shield',  color: '#448aff', icon: 'star',      duration: Infinity },
    { id: 'shrink', name: 'Shrink',  color: '#e040fb', icon: 'minus',     duration: 0 },
    { id: 'magnet', name: 'Magnet',  color: '#ff9100', icon: 'diamond',   duration: 10000 },
    { id: 'ghost',  name: 'Ghost',   color: '#ffffff', icon: 'circle',    duration: 5000 }
  ];

  C.PRESETS = {
    classic:      { walls: 'solid', obstacles: 'none',    enemies: 0, powerups: false, fieldSize: 'medium', speed: 'normal' },
    tron:         { walls: 'wrap',  obstacles: 'none',    enemies: 2, powerups: false, fieldSize: 'medium', speed: 'fast', visualTheme: 'tron' },
    mazeRunner:   { walls: 'solid', obstacles: 'maze',    enemies: 0, powerups: true,  fieldSize: 'large',  speed: 'normal', visualTheme: 'maze' },
    battleRoyale: { walls: 'wrap',  obstacles: 'random',  enemies: 3, powerups: true,  fieldSize: 'large',  speed: 'fast' },
    zen:          { walls: 'wrap',  obstacles: 'none',    enemies: 0, powerups: true,  fieldSize: 'medium', speed: 'slow', visualTheme: 'zen' }
  };

  C.DEFAULT_CONFIG = { ...C.PRESETS.classic };
})();
