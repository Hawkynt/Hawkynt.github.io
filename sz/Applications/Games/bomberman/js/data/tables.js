/* The static tables: the weighted power-up drop table, the level-gated enemy
   definitions, the tutorial pages and the lookups over the power-up table. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const T = NS.data = NS.data || {};

  /* Weighted drop table (type, weight, color, letter) */
  T.POWERUP_TABLE = [
    { type: C.POWERUP_BOMB_UP,    weight: 20, color: '#ff6b6b', letter: 'B' },
    { type: C.POWERUP_FIRE_UP,    weight: 20, color: '#ff9f43', letter: 'F' },
    { type: C.POWERUP_SPEED_UP,   weight: 15, color: '#2ed573', letter: 'S' },
    { type: C.POWERUP_KICK,       weight: 12, color: '#1e90ff', letter: 'K' },
    { type: C.POWERUP_REMOTE,     weight: 10, color: '#e056fd', letter: 'R' },
    { type: C.POWERUP_POWER_KICK, weight: 6,  color: '#00d2ff', letter: 'P' },
    { type: C.POWERUP_FLY,        weight: 5,  color: '#87ceeb', letter: 'W' },
    { type: C.POWERUP_GLOVE,      weight: 6,  color: '#ff69b4', letter: 'G' },
    { type: C.POWERUP_CLIMB,      weight: 6,  color: '#daa520', letter: 'C' }
  ];
  T.POWERUP_TOTAL_WEIGHT = T.POWERUP_TABLE.reduce((s, e) => s + e.weight, 0);

  /* Enemy type definitions — level-gated with distinct abilities */
  T.ENEMY_TYPES = [
    { type: 'slow',    speed: 1.5, hp: 1, color: '#9b59b6', minLevel: 1, points: 100 },
    { type: 'normal',  speed: 2.5, hp: 1, color: '#e74c3c', minLevel: 1, points: 100 },
    { type: 'fast',    speed: 3.5, hp: 1, color: '#e67e22', minLevel: 1, points: 100 },
    { type: 'climber', speed: 2.0, hp: 1, color: '#2ecc71', minLevel: 3, points: 150 },
    { type: 'chaser',  speed: 2.5, hp: 1, color: '#f1c40f', minLevel: 4, points: 200 },
    { type: 'tank',    speed: 1.5, hp: 2, color: '#95a5a6', minLevel: 5, points: 200 },
    { type: 'ghost',   speed: 2.0, hp: 1, color: '#a29bfe', minLevel: 7, points: 250 }
  ];

  T.getEnemyTypeDef = function getEnemyTypeDef(typeName) {
    return T.ENEMY_TYPES.find(t => t.type === typeName) || T.ENEMY_TYPES[0];
  };

  T.randomPowerUpType = function randomPowerUpType() {
    let roll = Math.random() * T.POWERUP_TOTAL_WEIGHT;
    for (const entry of T.POWERUP_TABLE) {
      roll -= entry.weight;
      if (roll <= 0)
        return entry.type;
    }
    return T.POWERUP_TABLE[0].type;
  };

  T.powerUpEntry = function powerUpEntry(type) {
    return T.POWERUP_TABLE.find(e => e.type === type) || T.POWERUP_TABLE[0];
  };

  T.TUTORIAL_PAGES = [
    { title: 'How to Play', lines: ['Place bombs to destroy walls and enemies.', 'Collect power-ups hidden under walls.', '', 'Arrow Keys / WASD = Move', 'Space = Place bomb'] },
    { title: 'Power-Ups & Tips', lines: ['Bomb Up = more bombs, Fire Up = bigger blasts,', 'Speed Up, Kick, Remote Detonation, and more.', '', 'Chain explosions by placing bombs near each other.', 'Trap enemies in corridors for easy kills.', 'Press H anytime to see this help again.'] }
  ];
})();
