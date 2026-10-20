/* Level definitions — 12 handcrafted levels.
   Each level: start, goal, wells (with strength/mass), asteroids, par moves. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});

  NS.levels.LEVELS = [
    // Level 1: straight shot, no obstacles — spacecraft repair tutorial
    {
      start: { x: 100, y: 240 }, goal: { x: 540, y: 240 }, par: 1,
      wells: [],
      asteroids: [],
      repair: { component: 'Navigation Module' }
    },
    // Level 2: one gravity well bends path
    {
      start: { x: 80, y: 400 }, goal: { x: 560, y: 80 }, par: 1,
      wells: [{ x: 320, y: 240, strength: 4000, mass: 40 }],
      asteroids: [],
      repair: { component: 'Thruster Assembly' }
    },
    // Level 3: asteroid field
    {
      start: { x: 80, y: 240 }, goal: { x: 560, y: 240 }, par: 1,
      wells: [],
      asteroids: [
        { x: 250, y: 200, r: 20 }, { x: 300, y: 300, r: 18 },
        { x: 400, y: 180, r: 22 }, { x: 350, y: 280, r: 16 }
      ],
      repair: { component: 'Hull Plating' }
    },
    // Level 4: gravity well + asteroids
    {
      start: { x: 60, y: 420 }, goal: { x: 580, y: 60 }, par: 2,
      wells: [{ x: 300, y: 240, strength: 3500, mass: 35 }],
      asteroids: [{ x: 450, y: 150, r: 25 }, { x: 200, y: 350, r: 20 }],
      repair: { component: 'Shield Generator' }
    },
    // Level 5: two wells creating a slingshot
    {
      start: { x: 60, y: 240 }, goal: { x: 580, y: 240 }, par: 1,
      wells: [
        { x: 220, y: 160, strength: 3000, mass: 30 },
        { x: 420, y: 320, strength: 3000, mass: 30 }
      ],
      asteroids: [{ x: 320, y: 240, r: 30 }],
      repair: { component: 'Fuel Cell' }
    },
    // Level 6: obstacle course with tight gaps
    {
      start: { x: 60, y: 60 }, goal: { x: 580, y: 420 }, par: 2,
      wells: [{ x: 320, y: 100, strength: 2500, mass: 25 }],
      asteroids: [
        { x: 200, y: 200, r: 40 }, { x: 400, y: 300, r: 35 },
        { x: 150, y: 380, r: 20 }, { x: 500, y: 150, r: 18 }
      ],
      repair: { component: 'Oxygen Recycler' }
    },
    // Level 7: strong central well — orbit required
    {
      start: { x: 60, y: 240 }, goal: { x: 60, y: 100 }, par: 2,
      wells: [{ x: 320, y: 240, strength: 6000, mass: 60 }],
      asteroids: [{ x: 200, y: 100, r: 15 }, { x: 440, y: 380, r: 15 }],
      repair: { component: 'Comm Array' }
    },
    // Level 8: three wells — gravitational maze
    {
      start: { x: 60, y: 420 }, goal: { x: 580, y: 60 }, par: 2,
      wells: [
        { x: 180, y: 180, strength: 2500, mass: 25 },
        { x: 460, y: 320, strength: 3000, mass: 30 },
        { x: 320, y: 120, strength: 2000, mass: 20 }
      ],
      asteroids: [{ x: 280, y: 280, r: 25 }, { x: 400, y: 180, r: 20 }],
      repair: { component: 'Warp Coil' }
    },
    // Level 9: dense asteroid field with weak wells
    {
      start: { x: 60, y: 240 }, goal: { x: 580, y: 240 }, par: 2,
      wells: [
        { x: 200, y: 150, strength: 1500, mass: 15 },
        { x: 450, y: 350, strength: 1500, mass: 15 }
      ],
      asteroids: [
        { x: 180, y: 280, r: 18 }, { x: 260, y: 180, r: 16 },
        { x: 340, y: 300, r: 20 }, { x: 420, y: 200, r: 17 },
        { x: 500, y: 280, r: 15 }, { x: 300, y: 120, r: 22 }
      ],
      repair: { component: 'Sensor Array' }
    },
    // Level 10: final spacecraft repair — all elements combined
    {
      start: { x: 60, y: 60 }, goal: { x: 580, y: 420 }, par: 3,
      wells: [
        { x: 200, y: 300, strength: 4000, mass: 40 },
        { x: 450, y: 150, strength: 3500, mass: 35 },
        { x: 320, y: 400, strength: 2500, mass: 25 }
      ],
      asteroids: [
        { x: 150, y: 180, r: 20 }, { x: 370, y: 260, r: 25 },
        { x: 520, y: 320, r: 18 }, { x: 280, y: 100, r: 15 }
      ],
      repair: { component: 'Main Engine' }
    },
    // Level 11: bonus — repulsive well trick
    {
      start: { x: 320, y: 420 }, goal: { x: 320, y: 60 }, par: 1,
      wells: [
        { x: 160, y: 240, strength: 3000, mass: 30 },
        { x: 480, y: 240, strength: 3000, mass: 30 }
      ],
      asteroids: [
        { x: 320, y: 300, r: 20 }, { x: 250, y: 150, r: 15 },
        { x: 390, y: 150, r: 15 }
      ],
      repair: { component: 'Life Support' }
    },
    // Level 12: gauntlet — maximal difficulty
    {
      start: { x: 60, y: 420 }, goal: { x: 580, y: 60 }, par: 3,
      wells: [
        { x: 160, y: 160, strength: 4000, mass: 40 },
        { x: 480, y: 340, strength: 4500, mass: 45 },
        { x: 320, y: 240, strength: 3000, mass: 30 },
        { x: 400, y: 100, strength: 2000, mass: 20 }
      ],
      asteroids: [
        { x: 240, y: 300, r: 22 }, { x: 400, y: 200, r: 20 },
        { x: 160, y: 380, r: 18 }, { x: 500, y: 120, r: 16 },
        { x: 300, y: 350, r: 15 }, { x: 440, y: 280, r: 19 }
      ],
      repair: { component: 'Quantum Core' }
    }
  ];
})();
