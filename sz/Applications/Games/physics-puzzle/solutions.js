;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Known solutions for every campaign level and trick shot, found by
   * tools/solve-levels.js with the game's deterministic physics and replayed
   * by tests/solutions.test.js. parts: [type, x, y, angleDeg]; shots: [angleDeg, speed].
   * The game uses them for the Blueprint hint and to hang the Daily stars.
   */
  SZ.PhysicsPuzzleSolutions = Object.freeze({
    'w1-1': { parts: [], shots: [[23, 1320]] },
    'w1-2': { parts: [], shots: [[58, 1100]] },
    'w1-3': { parts: [['plank', 1180, 516, 90]], shots: [[61, 1260]] },
    'w1-4': { parts: [['spring', 810, 550, 15]], shots: [[23, 1400]] },
    'w1-5': { parts: [], shots: [[20, 1340]] },
    'w1-6': { parts: [], shots: [[59, 1180]] },
    'w1-7': { parts: [['bumper', 1150, 420, 0]], shots: [[25, 1320]] },
    'w1-8': { parts: [], shots: [[22, 1360], [67, 1360]] },
    'w2-1': { parts: [], shots: [[9, 1300]] },
    'w2-2': { parts: [['plank', 490, 610, 0], ['plank', 630, 610, 0]], shots: [[-8, 360]] },
    'w2-3': { parts: [], shots: [[-8, 480]] },
    'w2-4': { parts: [], shots: [[33, 1040]] },
    'w2-5': { parts: [], shots: [[32, 1220]] },
    'w2-6': { parts: [['spring', 490, 470, 0]], shots: [[29, 1060]] },
    'w2-7': { parts: [['conveyor', 840, 450, 330]], shots: [[24, 1320]] },
    'w2-8': { parts: [], shots: [[68, 1360]] },
    'w3-1': { parts: [], shots: [[29, 1360]] },
    'w3-2': { parts: [], shots: [[36, 1340]] },
    'w3-3': { parts: [], shots: [[52, 1240]] },
    'w3-4': { parts: [['spring', 1180, 550, -45]], shots: [[-2, 1300]] },
    'w3-5': { parts: [], shots: [[44, 1300]] },
    'w3-6': { parts: [['plank', 490, 420, 0], ['spring', 400, 500, 0]], shots: [[23, 1360]] },
    'w3-7': { parts: [['spring', 800, 450, 345]], shots: [[29, 1200]] },
    'w3-8': { parts: [], shots: [[54, 1240]] },
    'w4-1': { parts: [], shots: [[62, 1220]] },
    'w4-2': { parts: [], shots: [[23, 1340]] },
    'w4-3': { parts: [], shots: [[35, 1360]] },
    'w4-4': { parts: [], shots: [[32, 1400]] },
    'w4-5': { parts: [], shots: [[51, 1020]] },
    'w4-6': { parts: [], shots: [[6, 1400]] },
    'w4-7': { parts: [], shots: [[4, 1380], [24, 1200]] },
    'w4-8': { parts: [], shots: [[38, 1320], [46, 1120]] },
    'w5-1': { parts: [], shots: [[51, 700]] },
    'w5-2': { parts: [], shots: [[-8, 340]] },
    'w5-3': { parts: [], shots: [[45, 780]] },
    'w5-4': { parts: [], shots: [[54, 860]] },
    'w5-5': { parts: [['fan', 560, 560, 300]], shots: [[9, 1220]] },
    'w5-6': { parts: [], shots: [[2, 660]] },
    'w5-7': { parts: [], shots: [[30, 800]] },
    'w5-8': { parts: [], shots: [[22, 1380]] },
    'trick-t1': { parts: [], shots: [[71, 1140]] },
    'trick-t2': { parts: [], shots: [[59, 1180]] },
    'trick-t3': { parts: [], shots: [[33, 1040]] },
    'trick-t4': { parts: [], shots: [[68, 1360]] },
    'trick-t5': { parts: [], shots: [[36, 1340]] },
    'trick-t6': { parts: [], shots: [[54, 1240]] },
    'trick-t7': { parts: [], shots: [[32, 1400]] },
    'trick-t8': { parts: [], shots: [[6, 1400]] },
    'trick-t9': { parts: [], shots: [[54, 860]] },
    'trick-t10': { parts: [], shots: [[22, 1380]] }
  });
})();
