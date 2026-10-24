/* The content tables: fruit rewards, powerup definitions, the per-level speed and fright
   config, and the boss roster. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const T = NS.data = NS.data || {};

  /* Fruit config */
  const FRUIT_POS = { x: 13, y: 17 };
  const FRUIT_TABLE = [
    { name: 'cherry',     pts: 100,  color: '#FF0000' },
    { name: 'strawberry', pts: 300,  color: '#FF4488' },
    { name: 'orange',     pts: 500,  color: '#FFB852' },
    { name: 'apple',      pts: 700,  color: '#FF0000' },
    { name: 'melon',      pts: 1000, color: '#00FF00' },
    { name: 'galaxian',   pts: 2000, color: '#0088FF' },
    { name: 'bell',       pts: 3000, color: '#FFD700' },
    { name: 'key',        pts: 5000, color: '#00FFFF' }
  ];

  /* --- Powerups --- */
  const POWERUP_TYPES = [
    { id: 'speed',      name: 'Speed+',    color: '#FFEB3B', icon: 'lightning', duration: 5000 },
    { id: 'freeze',     name: 'Freeze',    color: '#00E5FF', icon: 'snowflake', duration: 4000 },
    { id: 'multiplier', name: '2x Score',  color: '#FF9100', icon: 'star',      duration: 8000 },
    { id: 'extralife',  name: 'Extra Life', color: '#4CAF50', icon: 'heart',    duration: 0 },
    { id: 'magnet',     name: 'Magnet',    color: '#E040FB', icon: 'diamond',   duration: 6000 },
    { id: 'phase',      name: 'Phase',     color: '#FFFFFF', icon: 'circle',    duration: 3000 }
  ];

  /* --- Level Config --- */
  const LEVEL_CONFIG = [
    { pac: 0.80, ghost: 0.75, fright: 6000, tunnel: 0.40, elroy1Dots: 20, elroy1Spd: 0.80, elroy2Dots: 10, elroy2Spd: 0.85 },
    { pac: 0.90, ghost: 0.85, fright: 5000, tunnel: 0.45, elroy1Dots: 30, elroy1Spd: 0.90, elroy2Dots: 15, elroy2Spd: 0.95 },
    { pac: 0.90, ghost: 0.85, fright: 4000, tunnel: 0.45, elroy1Dots: 40, elroy1Spd: 0.90, elroy2Dots: 20, elroy2Spd: 0.95 },
    { pac: 0.90, ghost: 0.85, fright: 3000, tunnel: 0.45, elroy1Dots: 40, elroy1Spd: 0.90, elroy2Dots: 20, elroy2Spd: 0.95 },
    { pac: 1.00, ghost: 0.95, fright: 2000, tunnel: 0.50, elroy1Dots: 40, elroy1Spd: 1.00, elroy2Dots: 20, elroy2Spd: 1.05 }
  ];

  const BOSS_TYPES = [
    { name: 'Shadow King',   color: '#FF0000', ability: 'summon' },
    { name: 'Phantom Queen',  color: '#FFB8FF', ability: 'teleport' },
    { name: 'Spectral Lord',  color: '#00FFFF', ability: 'freeze' },
    { name: 'Clyde Supreme',  color: '#FFB852', ability: 'split' }
  ];

  Object.assign(T, {
    FRUIT_POS, FRUIT_TABLE, POWERUP_TYPES, LEVEL_CONFIG, BOSS_TYPES
  });
})();
