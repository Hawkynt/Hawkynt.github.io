/* All mutable game state in one object: the phase, level progress, the drag/aim
   coordinates, the launched probe with its trail, the current level's geometry and
   the starfield that is rolled once at load time. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpacePuzzle || (SZ.SpacePuzzle = {});
  const C = NS.constants;

  const S = NS.state = NS.state || {
    state: C.STATE_READY,
    currentLevel: 0,
    highScores: [],
    totalScore: 0,

    /* Drag/aim state */
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragEndX: 0,
    dragEndY: 0,

    /* Level timer */
    levelStartTime: 0,
    elapsed: 0,

    /* Move counter */
    moveCount: 0,

    /* Launched object */
    obj: { x: 0, y: 0, vx: 0, vy: 0, active: false },
    trail: [],

    /* Level data */
    wells: [],
    asteroids: [],
    goal: { x: 0, y: 0 },
    startPos: { x: 0, y: 0 },

    /* Stars background — varied sizes, some large bright stars */
    stars: []
  };

  for (let i = 0; i < C.STAR_COUNT; ++i) {
    const sizeRoll = Math.random();
    const size = sizeRoll < 0.85 ? Math.random() * 1.2 + 0.4 : Math.random() * 1.5 + 1.5;
    S.stars.push({ x: Math.random() * C.CANVAS_W, y: Math.random() * C.CANVAS_H, s: size, b: Math.random() });
  }
})();
