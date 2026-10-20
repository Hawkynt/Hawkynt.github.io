/* ROOM DATA — 17 surreal rooms with hidden rules.
   Each room has: name, rule (hidden), doors/portals, objects, colors.
   Doors can lead to non-sequential rooms (non-Euclidean connections). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;

  const ROOMS = [
    { name: 'The Entrance', rule: 'Walk through the only door', ruleHint: 'Doors lead somewhere...', color: '#1a1a2e', accentColor: '#4a90d9',
      portals: [{ x: 600, y: 200, w: C.DOOR_W, h: C.DOOR_H, target: 1 }],
      objects: [], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Mirror Hall', rule: 'Movement is reversed horizontally', ruleHint: 'Things are not what they seem...', color: '#1e1e3a', accentColor: '#d94a90',
      portals: [{ x: 600, y: 200, w: C.DOOR_W, h: C.DOOR_H, target: 2 }, { x: 50, y: 400, w: C.DOOR_W, h: C.DOOR_H, target: 0 }],
      objects: [{ x: 350, y: 250, w: 20, h: 20, type: 'clue' }], playerStart: { x: 350, y: 400 }, viewMode: C.VIEW_FLIPPED },
    { name: 'Gravity Shift', rule: 'Perspective rotation changes gravity', ruleHint: 'Try a new angle...', color: '#2e1a1a', accentColor: '#d9c84a',
      portals: [{ x: 350, y: 30, w: C.DOOR_W, h: C.DOOR_H, target: 3 }],
      objects: [{ x: 200, y: 300, w: 80, h: 20, type: 'platform' }], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_ROTATED },
    { name: 'Infinite Corridor', rule: 'Walking right loops you back', ruleHint: 'Are you going in circles?', color: '#1a2e1a', accentColor: '#4ad990',
      portals: [{ x: 650, y: 400, w: C.DOOR_W, h: C.DOOR_H, target: 3 }, { x: 350, y: 100, w: C.DOOR_W, h: C.DOOR_H, target: 4 }],
      objects: [{ x: 300, y: 350, w: 20, h: 20, type: 'clue' }], playerStart: { x: 50, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Color Chamber', rule: 'Walk on matching color tiles only', ruleHint: 'Watch your step...', color: '#2a1a3e', accentColor: '#d94aff',
      portals: [{ x: 600, y: 100, w: C.DOOR_W, h: C.DOOR_H, target: 5 }],
      objects: [{ x: 150, y: 300, w: C.TILE, h: C.TILE, type: 'colorTile', tileColor: '#d94aff' }, { x: 300, y: 200, w: C.TILE, h: C.TILE, type: 'colorTile', tileColor: '#d94aff' }, { x: 450, y: 150, w: C.TILE, h: C.TILE, type: 'colorTile', tileColor: '#d94aff' }],
      playerStart: { x: 80, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Shadow Room', rule: 'Only doors visible in shadows are real', ruleHint: 'Trust the darkness...', color: '#0a0a0a', accentColor: '#667788',
      portals: [{ x: 500, y: 300, w: C.DOOR_W, h: C.DOOR_H, target: 6 }, { x: 200, y: 100, w: C.DOOR_W, h: C.DOOR_H, target: 3 }],
      objects: [{ x: 350, y: 250, w: 40, h: 40, type: 'shadow' }], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Echoing Void', rule: 'Interact with echoes of yourself', ruleHint: 'You are not alone...', color: '#1a1a40', accentColor: '#00ccff',
      portals: [{ x: 600, y: 400, w: C.DOOR_W, h: C.DOOR_H, target: 7 }],
      objects: [{ x: 350, y: 250, w: 20, h: 20, type: 'echo' }], playerStart: { x: 100, y: 250 }, viewMode: C.VIEW_NORMAL },
    { name: 'Penrose Steps', rule: 'Stairs loop forever unless you shift perspective', ruleHint: 'Step back and look again...', color: '#2e2e1a', accentColor: '#ffd700',
      portals: [{ x: 600, y: 80, w: C.DOOR_W, h: C.DOOR_H, target: 8 }],
      objects: [{ x: 100, y: 100, w: 500, h: 20, type: 'stairPlatform' }, { x: 100, y: 200, w: 500, h: 20, type: 'stairPlatform' }, { x: 100, y: 300, w: 500, h: 20, type: 'stairPlatform' }],
      playerStart: { x: 80, y: 400 }, viewMode: C.VIEW_ROTATED },
    { name: 'Whispering Walls', rule: 'Walls shift when you are not looking', ruleHint: 'Turn around...', color: '#301a30', accentColor: '#ff66aa',
      portals: [{ x: 350, y: 30, w: C.DOOR_W, h: C.DOOR_H, target: 9 }],
      objects: [{ x: 200, y: 150, w: 20, h: 200, type: 'wall' }, { x: 500, y: 150, w: 20, h: 200, type: 'wall' }],
      playerStart: { x: 350, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Tesseract', rule: 'Four exits lead to the same room from different angles', ruleHint: 'Which dimension are you in?', color: '#0a1a2e', accentColor: '#44ffdd',
      portals: [{ x: 650, y: 250, w: C.DOOR_W, h: C.DOOR_H, target: 10 }, { x: 10, y: 250, w: C.DOOR_W, h: C.DOOR_H, target: 10 }, { x: 330, y: 10, w: C.DOOR_W, h: C.DOOR_H, target: 10 }, { x: 330, y: 440, w: C.DOOR_W, h: C.DOOR_H, target: 10 }],
      objects: [], playerStart: { x: 350, y: 250 }, viewMode: C.VIEW_NORMAL },
    { name: 'Reality Fracture', rule: 'Walking through the fracture warps reality', ruleHint: 'The crack calls to you...', color: '#1a0a1a', accentColor: '#ff4444',
      portals: [{ x: 600, y: 400, w: C.DOOR_W, h: C.DOOR_H, target: 11 }],
      objects: [{ x: 350, y: 100, w: 8, h: 300, type: 'fracture' }], playerStart: { x: 100, y: 250 }, viewMode: C.VIEW_NORMAL },
    { name: 'Time Loop', rule: 'Objects reset every few seconds unless placed correctly', ruleHint: 'Hurry, or start over...', color: '#2e1a2e', accentColor: '#ff8800',
      portals: [{ x: 600, y: 200, w: C.DOOR_W, h: C.DOOR_H, target: 12 }],
      objects: [{ x: 300, y: 300, w: 20, h: 20, type: 'clue' }], playerStart: { x: 80, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Phantom Bridge', rule: 'Bridges appear only when you believe they are there', ruleHint: 'Have faith...', color: '#1a1a2e', accentColor: '#88ff44',
      portals: [{ x: 600, y: 100, w: C.DOOR_W, h: C.DOOR_H, target: 13 }],
      objects: [{ x: 250, y: 250, w: 200, h: 10, type: 'phantomBridge' }], playerStart: { x: 80, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Möbius Strip', rule: 'The room is its own mirror, flipped on return', ruleHint: 'Everything twists...', color: '#2e2a1a', accentColor: '#ddaa44',
      portals: [{ x: 600, y: 400, w: C.DOOR_W, h: C.DOOR_H, target: 14 }],
      objects: [], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_FLIPPED },
    { name: 'Quantum Door', rule: 'The door changes destination when observed', ruleHint: 'Look away and back...', color: '#1a2e2e', accentColor: '#44ddff',
      portals: [{ x: 350, y: 80, w: C.DOOR_W, h: C.DOOR_H, target: 15 }, { x: 500, y: 300, w: C.DOOR_W, h: C.DOOR_H, target: 12 }],
      objects: [{ x: 200, y: 200, w: 20, h: 20, type: 'clue' }], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'Void Nexus', rule: 'All paths converge here if you found the pattern', ruleHint: 'The pattern reveals itself...', color: '#0a0a20', accentColor: '#ffffff',
      portals: [{ x: 350, y: 200, w: C.DOOR_W, h: C.DOOR_H, target: 16 }],
      objects: [{ x: 350, y: 350, w: 30, h: 30, type: 'nexusOrb' }], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_NORMAL },
    { name: 'The Awakening', rule: 'Reach the center to awaken', ruleHint: 'You are almost free...', color: '#2e2e2e', accentColor: '#ffd700',
      portals: [],
      objects: [{ x: 330, y: 230, w: 40, h: 40, type: 'goal' }], playerStart: { x: 100, y: 400 }, viewMode: C.VIEW_NORMAL }
  ];

  NS.rooms = ROOMS;
})();
