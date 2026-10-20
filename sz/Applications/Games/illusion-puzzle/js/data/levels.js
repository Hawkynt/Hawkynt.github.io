/* L, the embedded puzzle definitions: 16 impossible-geometry levels with their grid
   layout, goal position, collectibles and Penrose stair links. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});

  /* ══════════════════════════════════════════════════════════════════
     LEVEL DATA — 16 impossible-geometry levels
     Each level: grid layout, goal position, collectibles, Penrose stair links
     Grid cell types: 0=void, 1=floor, 2=raised, 3=Penrose stair, 4=goal
     ══════════════════════════════════════════════════════════════════ */

  const LEVELS = [
    { name: 'First Steps', grid: [[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [], perspective: 0 },
    { name: 'The Rise', grid: [[1,1,1,0,0],[1,2,2,2,0],[0,2,1,2,0],[0,2,2,2,0],[0,0,0,0,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [{from:{row:1,col:3},to:{row:4,col:4},perspective:1}], perspective: 0 },
    { name: 'Penrose Gateway', grid: [[1,1,3,0,0],[1,1,1,0,0],[3,1,1,1,0],[0,0,1,1,1],[0,0,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:1,col:1},{row:3,col:3}], illusionLinks: [{from:{row:0,col:2},to:{row:2,col:0},perspective:0}], perspective: 0 },
    { name: 'Escher Bridge', grid: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0}], illusionLinks: [], perspective: 0 },
    { name: 'Spiral Tower', grid: [[1,1,0,0,0],[1,2,2,0,0],[0,2,3,2,0],[0,0,2,2,1],[0,0,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:3,col:4},perspective:1}], perspective: 0 },
    { name: 'Double Illusion', grid: [[1,1,1,1,1],[1,0,0,0,1],[1,0,3,0,1],[1,0,0,0,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0},{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:4,col:4},perspective:2}], perspective: 0 },
    { name: 'Floating Paths', grid: [[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,1],[0,1,0,1,0],[1,0,1,0,4]], playerStart: {row:0,col:0},
      collectibles: [{row:1,col:1},{row:3,col:3}], illusionLinks: [{from:{row:0,col:2},to:{row:2,col:0},perspective:1},{from:{row:2,col:4},to:{row:4,col:2},perspective:1}], perspective: 0 },
    { name: 'The Paradox', grid: [[2,2,1,1,0],[2,3,1,0,0],[1,1,1,1,0],[0,0,1,3,2],[0,0,1,2,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:3},{row:4,col:3}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:0}], perspective: 0 },
    { name: 'Mirror Stairs', grid: [[1,1,1,1,1],[1,3,0,3,1],[1,0,2,0,1],[1,3,0,3,1],[1,1,1,1,4]], playerStart: {row:0,col:2},
      collectibles: [{row:2,col:2},{row:0,col:0},{row:0,col:4}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:1},{from:{row:1,col:3},to:{row:3,col:1},perspective:2}], perspective: 0 },
    { name: 'Gravity Well', grid: [[1,1,1,0,0],[1,2,1,0,0],[1,1,1,1,1],[0,0,1,2,1],[0,0,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:1,col:1},{row:3,col:3}], illusionLinks: [], perspective: 0 },
    { name: 'Impossible Fork', grid: [[1,1,0,1,1],[1,0,0,0,1],[0,0,3,0,0],[1,0,0,0,1],[1,1,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:3},{row:4,col:0}], illusionLinks: [{from:{row:2,col:2},to:{row:0,col:4},perspective:1},{from:{row:2,col:2},to:{row:4,col:0},perspective:2}], perspective: 0 },
    { name: 'Cascade', grid: [[2,1,1,1,0],[0,0,0,1,0],[0,0,2,1,0],[0,0,0,1,0],[0,0,0,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:3},{row:2,col:2}], illusionLinks: [{from:{row:0,col:0},to:{row:2,col:2},perspective:1}], perspective: 0 },
    { name: 'Möbius Walk', grid: [[1,1,1,1,1],[1,3,1,3,1],[1,1,1,1,1],[1,3,1,3,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0},{row:2,col:2}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:0},{from:{row:1,col:3},to:{row:3,col:1},perspective:1}], perspective: 0 },
    { name: 'The Void', grid: [[1,0,0,0,1],[0,1,0,1,0],[0,0,3,0,0],[0,1,0,1,0],[1,0,0,0,4]], playerStart: {row:0,col:0},
      collectibles: [{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:4,col:4},perspective:2}], perspective: 0 },
    { name: 'Architect\'s Dream', grid: [[2,2,1,2,2],[2,1,1,1,2],[1,1,3,1,1],[2,1,1,1,2],[2,2,1,2,4]], playerStart: {row:0,col:2},
      collectibles: [{row:0,col:0},{row:0,col:4},{row:4,col:0},{row:2,col:2}], illusionLinks: [{from:{row:2,col:2},to:{row:4,col:2},perspective:1}], perspective: 0 },
    { name: 'Final Illusion', grid: [[1,1,1,1,1],[1,3,2,3,1],[1,2,3,2,1],[1,3,2,3,1],[1,1,1,1,4]], playerStart: {row:0,col:0},
      collectibles: [{row:0,col:4},{row:4,col:0},{row:2,col:2},{row:1,col:2}], illusionLinks: [{from:{row:1,col:1},to:{row:3,col:3},perspective:0},{from:{row:1,col:3},to:{row:3,col:1},perspective:1},{from:{row:2,col:2},to:{row:4,col:4},perspective:2}], perspective: 0 }
  ];

  Object.assign(NS.levels, { LEVELS });
})();
