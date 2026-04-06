;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // 4-bit cardinal bitmask: set bit if the neighbor IS the same terrain.
  const N = 1, E = 2, S = 4, W = 8;

  function computeBitmask(col, row, tileGetter, myTile) {
    let mask = 0;
    if (tileGetter(col, row - 1) === myTile) mask |= N;
    if (tileGetter(col + 1, row) === myTile) mask |= E;
    if (tileGetter(col, row + 1) === myTile) mask |= S;
    if (tileGetter(col - 1, row) === myTile) mask |= W;
    return mask;
  }

  // Each entry maps a 4-bit bitmask (0-15) to a tile index in the overworld
  // spritesheet (57 columns, 1px margin, 16px tiles).
  //
  // Bitmask bit layout: N=1 E=2 S=4 W=8
  //   mask 15 = all neighbours match  → centre / interior tile
  //   mask  0 = isolated              → centre fallback
  //
  // The 3×3 block at (rows 0-2, cols 2-4) of the Kenney Roguelike RPG
  // spritesheet provides WATER-on-GRASS transitions:
  //
  //   idx  2 (NW corner)   idx  3 (N edge)   idx  4 (NE corner)
  //   idx 59 (W edge)      idx 60 (centre)    idx 61 (E edge)
  //   idx116 (SW corner)   idx117 (S edge)    idx118 (SE corner)
  //
  // 9 of 16 masks map to dedicated tiles; the remaining 7 (isolated,
  // end-caps, thin strips) fall back to the centre tile.

  const COLS = 57;
  const MARGIN = 1;

  function _rect(tileIndex) {
    const step = 16 + MARGIN;
    const c = tileIndex % COLS;
    const r = Math.floor(tileIndex / COLS);
    return Object.freeze({ x: c * step, y: r * step, w: 16, h: 16 });
  }

  // Build a 16-entry lookup from a 3×3 tile block.
  // nw/n/ne/w/center/e/sw/s/se are tile indices in the spritesheet.
  function _buildMap(nw, n, ne, w, center, e, sw, s, se) {
    const m = new Array(16);
    // Fallback: everything maps to centre by default
    for (let i = 0; i < 16; ++i)
      m[i] = _rect(center);

    // 4 edges (one side open)
    m[14] = _rect(n);   // E+S+W match, N differs
    m[13] = _rect(e);   // N+S+W match, E differs  (tile on the right edge)
    m[11] = _rect(s);   // N+E+W match, S differs
    m[ 7] = _rect(w);   // N+E+S match, W differs

    // 4 outer corners (two adjacent sides open)
    m[ 6] = _rect(nw);  // E+S match
    m[12] = _rect(ne);  // S+W match
    m[ 3] = _rect(sw);  // N+E match
    m[ 9] = _rect(se);  // N+W match

    return Object.freeze(m);
  }

  // WATER: 3×3 block at rows 0-2, cols 2-4 (confirmed from Kenney sample map)
  const WATER_MAP = _buildMap(
    2,   3,   4,    // NW, N, NE
    59,  60,  61,   // W, center, E
    116, 117, 118   // SW, S, SE
  );

  // Tile type constants from overworld-map.js
  const TileType = Object.freeze({
    WATER: 8,
    SAND: 9,
  });

  const OVERWORLD_AUTOTILE_MAP = Object.freeze({
    [TileType.WATER]: WATER_MAP,
  });

  // --- Runtime-generated terrain transitions ---
  //
  // The Kenney Roguelike RPG spritesheet only contains a pre-made 3×3
  // transition block for WATER-on-GRASS.  For other terrain borders
  // (SAND-on-GRASS, etc.) we composite transition tiles at init time
  // using canvas clip paths: background terrain is drawn first, then
  // foreground terrain is clipped to a shape (edges = rectangles,
  // corners = quarter-circle cutouts).  The generated tiles live on a
  // separate canvas; the renderer checks getAutotileSheet() to pick
  // the correct draw source.

  let _generatedCanvas = null;
  const _generatedMaps = {};
  const TILE = 16;
  const TRANSITION_R = 6;

  // Draw a clip-path for one of the 9 positions in a 3×3 block.
  // Positions 0-8 = NW,N,NE, W,C,E, SW,S,SE.
  function _transitionPath(ctx, position, sz, R) {
    ctx.beginPath();
    switch (position) {
      case 0: // NW corner — foreground fills SE, quarter-circle cutout in NW
        ctx.moveTo(R, 0);
        ctx.lineTo(sz, 0);
        ctx.lineTo(sz, sz);
        ctx.lineTo(0, sz);
        ctx.lineTo(0, R);
        ctx.arc(0, 0, R, 0.5 * Math.PI, 0, true);
        break;
      case 1: // N edge — foreground in bottom portion
        ctx.rect(0, R, sz, sz - R);
        break;
      case 2: // NE corner — foreground fills SW, cutout in NE
        ctx.moveTo(0, 0);
        ctx.lineTo(sz - R, 0);
        ctx.arc(sz, 0, R, Math.PI, 0.5 * Math.PI, true);
        ctx.lineTo(sz, sz);
        ctx.lineTo(0, sz);
        break;
      case 3: // W edge — foreground on right
        ctx.rect(R, 0, sz - R, sz);
        break;
      case 4: // Centre — full foreground
        ctx.rect(0, 0, sz, sz);
        break;
      case 5: // E edge — foreground on left
        ctx.rect(0, 0, sz - R, sz);
        break;
      case 6: // SW corner — foreground fills NE, cutout in SW
        ctx.moveTo(0, 0);
        ctx.lineTo(sz, 0);
        ctx.lineTo(sz, sz);
        ctx.lineTo(R, sz);
        ctx.arc(0, sz, R, 0, 1.5 * Math.PI, true);
        break;
      case 7: // S edge — foreground in top portion
        ctx.rect(0, 0, sz, sz - R);
        break;
      case 8: // SE corner — foreground fills NW, cutout in SE
        ctx.moveTo(0, 0);
        ctx.lineTo(sz, 0);
        ctx.lineTo(sz, sz - R);
        ctx.arc(sz, sz, R, 1.5 * Math.PI, Math.PI, true);
        ctx.lineTo(0, sz);
        break;
    }
    ctx.closePath();
  }

  // Paint the 9 transition tiles for one terrain onto the generated canvas.
  function _paintTerrainBlock(sheetImg, fgRect, bgRect, yOffset) {
    const ctx = _generatedCanvas.getContext('2d');
    const sz = TILE;
    const R = TRANSITION_R;

    for (let py = 0; py < 3; ++py)
      for (let px = 0; px < 3; ++px) {
        const dx = px * sz;
        const dy = yOffset + py * sz;

        ctx.save();
        ctx.clearRect(dx, dy, sz, sz);
        // Background terrain — full tile
        ctx.drawImage(sheetImg, bgRect.x, bgRect.y, sz, sz, dx, dy, sz, sz);
        // Foreground terrain — clipped to transition shape
        ctx.save();
        ctx.translate(dx, dy);
        _transitionPath(ctx, py * 3 + px, sz, R);
        ctx.clip();
        ctx.drawImage(sheetImg, fgRect.x, fgRect.y, sz, sz, 0, 0, sz, sz);
        ctx.restore();

        ctx.restore();
      }
  }

  // Build a frozen 16-entry map from rects into the generated canvas.
  function _buildGeneratedMap(yOffset) {
    const sz = TILE;
    const r = (px, py) => Object.freeze({
      x: px * sz, y: yOffset + py * sz, w: sz, h: sz,
    });

    const m = new Array(16);
    const center = r(1, 1);
    for (let i = 0; i < 16; ++i) m[i] = center;

    // Edges
    m[14] = r(1, 0); // N
    m[13] = r(2, 1); // E
    m[11] = r(1, 2); // S
    m[ 7] = r(0, 1); // W

    // Corners
    m[ 6] = r(0, 0); // NW
    m[12] = r(2, 0); // NE
    m[ 3] = r(0, 2); // SW
    m[ 9] = r(2, 2); // SE

    return Object.freeze(m);
  }

  // Call once after the overworld spritesheet image has loaded.
  // Creates a small canvas with composited transition tiles for each
  // terrain type that lacks a hand-drawn 3×3 block in the spritesheet.
  function generateTerrainTransitions(sheetImg) {
    if (!sheetImg || _generatedCanvas)
      return;

    const sprites = TR.OVERWORLD_TERRAIN_SPRITES;
    if (!sprites)
      return;

    const grassRect = sprites.GRASS;
    const sandRect = sprites.SAND;
    if (!grassRect || !sandRect)
      return;

    const sz = TILE;
    const terrainCount = 1; // SAND; add more as needed
    _generatedCanvas = document.createElement('canvas');
    _generatedCanvas.width = 3 * sz;
    _generatedCanvas.height = 3 * sz * terrainCount;

    // SAND-on-GRASS transitions (y-offset 0)
    _paintTerrainBlock(sheetImg, sandRect, grassRect, 0);
    _generatedMaps[TileType.SAND] = _buildGeneratedMap(0);
  }

  // Returns the generated canvas for a runtime-composited terrain,
  // or null when the tile type uses the main overworld spritesheet.
  function getAutotileSheet(tileType) {
    return _generatedMaps[tileType] ? _generatedCanvas : null;
  }

  function getAutotileRect(tileType, mask) {
    const map = OVERWORLD_AUTOTILE_MAP[tileType] || _generatedMaps[tileType];
    if (!map)
      return null;
    return map[mask] || map[15];
  }

  TR.computeBitmask = computeBitmask;
  TR.getAutotileRect = getAutotileRect;
  TR.getAutotileSheet = getAutotileSheet;
  TR.generateTerrainTransitions = generateTerrainTransitions;
  TR.OVERWORLD_AUTOTILE_MAP = OVERWORLD_AUTOTILE_MAP;
  TR.AUTOTILE_COLS = COLS;
  TR.AUTOTILE_MARGIN = MARGIN;
})();
