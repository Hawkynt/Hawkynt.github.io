/* P, the drawing constants: the dusk palette, the block depth and elevation, and the
   fixed twinkling star field. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;

  /* ── Palette ── */
  const PAL = {
    skyTop: '#1d1640',
    skyMid: '#3b2763',
    skyLow: '#7a4775',
    star: 'rgba(255,240,220,',
    floorTop: ['#f7e7cf', '#e7c9a2'],
    floorLeft: '#c7798a',
    floorRight: '#9b5269',
    raisedTop: ['#fbefdc', '#edd3ae'],
    stairTop: ['#d9ccff', '#a690ea'],
    stairDim: ['#8a82a8', '#6c6390'],
    stairLeft: '#7d68c4',
    stairRight: '#5c4a9e',
    goalTop: ['#b9f7e9', '#4fd3b8'],
    goalLeft: '#3aa892',
    goalRight: '#2a8072',
    edge: 'rgba(255,255,255,0.55)',
    gem: ['#fff4b8', '#ffd24a', '#e8962a'],
    ink: '#2a1f45',
    text: '#f6ecff',
    textDim: 'rgba(246,236,255,0.65)',
    accent: '#ffcf6b'
  };

  const BLOCK_DEPTH = 22;
  const ELEVATION_RAISED = 0.5;

  /* Twinkling background stars (fixed positions) */
  const STARS = [];
  for (let i = 0; i < 70; ++i)
    STARS.push({ x: (i * 197) % C.CANVAS_W, y: (i * 89 + (i % 7) * 31) % (C.CANVAS_H * 0.75), r: 0.6 + (i % 3) * 0.5, p: i * 0.7 });

  Object.assign(NS.palette, { PAL, BLOCK_DEPTH, ELEVATION_RAISED, STARS });
})();
