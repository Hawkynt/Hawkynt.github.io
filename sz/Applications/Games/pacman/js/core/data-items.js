/* Gameplay tables: the twelve power-ups, the seven ghost kinds and how they behave, the bonus
   fruit ladder, the game modes and the daily modifiers. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});

  /* dur: seconds (0 = instant); weight: spawn chance share; min: earliest maze number it can appear */
  const POWERUPS = [
    { id: 'speed', name: 'Turbo Sneakers', desc: 'Run 45% faster', color: '#ffe23a', dur: 7, weight: 10, min: 0 },
    { id: 'freeze', name: 'Freeze Ray', desc: 'Every ghost freezes solid', color: '#8af0ff', dur: 4.5, weight: 8, min: 0 },
    { id: 'double', name: 'Double Points', desc: 'All points count twice', color: '#ffa23a', dur: 10, weight: 9, min: 0 },
    { id: 'magnet', name: 'Dot Magnet', desc: 'Pulls in dots from 3 tiles away', color: '#ff5ad8', dur: 8, weight: 9, min: 0 },
    { id: 'shield', name: 'Bubble Shield', desc: 'Shrugs off one ghost', color: '#5affc8', dur: 20, weight: 7, min: 1 },
    { id: 'phase', name: 'Ghost Walk', desc: 'Walk straight through walls', color: '#e8e8ff', dur: 4, weight: 6, min: 2 },
    { id: 'blaster', name: 'Pellet Blaster', desc: 'Fires stunning pellets ahead', color: '#ff6a4a', dur: 7, weight: 7, min: 1 },
    { id: 'bomb', name: 'Boo Bomb', desc: 'Blasts nearby ghosts home', color: '#ff3b6a', dur: 0, weight: 6, min: 2 },
    { id: 'mega', name: 'Mega Chomp', desc: 'Giant Pac eats any ghost', color: '#ffd23a', dur: 5, weight: 4, min: 3 },
    { id: 'decoy', name: 'Decoy Pac', desc: 'Ghosts chase a fake you', color: '#ffeb9a', dur: 7, weight: 6, min: 2 },
    { id: 'slowmo', name: 'Time Warp', desc: 'Ghosts move at half speed', color: '#9a7aff', dur: 7, weight: 7, min: 1 },
    { id: 'life', name: 'Extra Heart', desc: 'One more life', color: '#ff4a6a', dur: 0, weight: 2, min: 4 },
  ];
  const POWERUP_BY_ID = {};
  for (let i = 0; i < POWERUPS.length; ++i) POWERUP_BY_ID[POWERUPS[i].id] = POWERUPS[i];

  /* ai: chase targeting style; extra flags give the special kinds their twist */
  const GHOSTS = {
    blinky: { name: 'Blinky', color: '#ff3b3b', ai: 'chase', scatter: { x: 25, y: -3 }, speed: 1 },
    pinky: { name: 'Pinky', color: '#ffa6e8', ai: 'ambush', scatter: { x: 2, y: -3 }, speed: 1 },
    inky: { name: 'Inky', color: '#3ae8ff', ai: 'flank', scatter: { x: 27, y: 34 }, speed: 1 },
    clyde: { name: 'Clyde', color: '#ffab3a', ai: 'shy', scatter: { x: 0, y: 34 }, speed: 1 },
    gobbler: { name: 'Gobbler', color: '#7aff5a', ai: 'gobble', scatter: { x: 27, y: 34 }, speed: 0.92, desc: 'Eats your dots - catch it frightened for a jackpot' },
    dasher: { name: 'Dasher', color: '#ff8a1a', ai: 'dash', scatter: { x: 0, y: 34 }, speed: 0.95, desc: 'Charges down straight halls when it sees you' },
    phantom: { name: 'Phantom', color: '#c8b0ff', ai: 'phase', scatter: { x: 2, y: -3 }, speed: 0.85, desc: 'Drifts through walls toward you' },
  };

  /* bonus fruit by maze number (the last repeats) */
  const FRUITS = [
    { id: 'cherry', name: 'Cherry', points: 100, color: '#ff2a3a' },
    { id: 'strawberry', name: 'Strawberry', points: 300, color: '#ff3a5a' },
    { id: 'orange', name: 'Orange', points: 500, color: '#ffa02a' },
    { id: 'apple', name: 'Apple', points: 700, color: '#ff4a3a' },
    { id: 'melon', name: 'Melon', points: 1000, color: '#5aff6a' },
    { id: 'galaxian', name: 'Galaxian', points: 2000, color: '#4aa0ff' },
    { id: 'bell', name: 'Bell', points: 3000, color: '#ffe23a' },
    { id: 'key', name: 'Key', points: 5000, color: '#8ae0ff' },
  ];

  const MODES = [
    { id: 'story', name: 'Story', sub: 'Relight the five Lumens', icon: 'book', color: '#ffd23a' },
    { id: 'arcade', name: 'Arcade', sub: 'Endless mazes, rising speed, score attack', icon: 'joystick', color: '#ff4ad8' },
    { id: 'zen', name: 'Zen', sub: 'No game over - just flow and glow', icon: 'lotus', color: '#5affc8' },
    { id: 'daily', name: 'Daily Maze', sub: 'Three seeded mazes, new every day', icon: 'calendar', color: '#4ad8ff' },
    { id: 'bossrush', name: 'Boss Rush', sub: 'Every boss back to back', icon: 'skull', color: '#ff6a4a', unlock: 2 },
  ];

  /* Daily / weekly modifiers */
  const MODIFIERS = [
    { id: 'turbo', name: 'Turbo', desc: 'Everyone is 20% faster - points x1.5' },
    { id: 'dark', name: 'Lights Out', desc: 'Only your glow lights the maze' },
    { id: 'swarm', name: 'Swarm', desc: 'Two extra ghosts join the hunt' },
    { id: 'bounty', name: 'Bounty', desc: 'Power-ups appear twice as often' },
    { id: 'glass', name: 'Glass Jaw', desc: 'One life only - points x2' },
    { id: 'feast', name: 'Feast', desc: 'Fruit every 40 dots' },
  ];
  const MODIFIER_BY_ID = {};
  for (let i = 0; i < MODIFIERS.length; ++i) MODIFIER_BY_ID[MODIFIERS[i].id] = MODIFIERS[i];

  Object.assign(NS.items, {
    POWERUPS, POWERUP_BY_ID, GHOSTS, FRUITS, MODES, MODIFIERS, MODIFIER_BY_ID
  });
})();
