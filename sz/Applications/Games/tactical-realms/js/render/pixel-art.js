;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Hand-drawn 16x16 pixel-art tiles for things the Kenney sheets lack
  // (single-tile town, cave entrance, mountain peak). Each row is one
  // pixel line; '.' is transparent, every other char is a PALETTE key.
  // Tiles are rasterised once into an in-memory sheet ("landmarks").

  const TILE = 16;

  const PALETTE = Object.freeze({
    o: '#3b2a24', // outline
    R: '#c4553c', r: '#8e3a2a', h: '#e8866a',             // roof
    W: '#efe0b8', w: '#c8b088',                           // plaster wall
    d: '#6b4226', f: '#7a5030', g: '#7cc4e4',             // door, frame, glass
    s: '#b4b6c0', S: '#8a8c98', x: '#5e606c', X: '#3e3f4a', // stone ramp
    n: '#f6f8fc', N: '#c9d3e2',                           // snow
    b: '#140f12', B: '#2e2428',                           // cave darkness
    m: '#5f9a3c', M: '#3f6e2a',                           // moss
  });

  const TILES = Object.freeze({
    town: [
      '................',
      '................',
      '................',
      '...oo...........',
      '..ohRo......oo..',
      '.ohRRRo....ohRo.',
      'ohRRRRRo..ohRRRo',
      'ohRRRRRRoohRRRRo',
      'orrrrrrrrorrrrro',
      '.oWWWWWWo.oWWwo.',
      '.oWgfWWWo.oWgwo.',
      '.oWffWWwo.oWWwo.',
      '.oWWWddwo.oWdwo.',
      '.oWWWddwo.oWdwo.',
      '.oooooooo.ooooo.',
      '................',
    ],
    cave: [
      '................',
      '................',
      '................',
      '.....oooooo.....',
      '...ooSsssSxoo...',
      '..oSssSSssSxxo..',
      '.oSsSxbbbbxSxxo.',
      '.oSSxbbbbbbxSxo.',
      'oSsSxbbBBbbxSSxo',
      'oSSxbbBbbBbbxSxo',
      'oSsxbbbbbbbbxSxo',
      'oSSxbbbbbbbbxxxo',
      'oxSxbbbbbbbbxSxo',
      'omSxbbbbbbbbxxmo',
      'oMmmbbbbbbbbmmMo',
      '.oooooooooooooo.',
    ],
    peak: [
      '................',
      '................',
      '................',
      '.......oo.......',
      '......onNo......',
      '.....onnNNo.....',
      '....onnnNsxo....',
      '...onnsnSxxxo...',
      '...osssSSxxxo...',
      '..osssSSxSxxxo..',
      '..osSsSxxxSxxo..',
      '.ossSSsSxxxxxxo.',
      '.osSsSSSxSxxXxo.',
      'osssSSSxxxxXxxxo',
      'oSsSSSxxxSxxXXxo',
      'oooooooooooooooo',
    ],
  });

  const TILE_NAMES = Object.freeze(Object.keys(TILES));

  // Rects are pure data so tables can be built before any canvas exists.
  function rect(name) {
    const i = TILE_NAMES.indexOf(name);
    if (i < 0)
      return null;
    return Object.freeze({ x: i * TILE, y: 0, w: TILE, h: TILE, sheet: 'landmarks' });
  }

  function validate() {
    const errors = [];
    for (const [name, rows] of Object.entries(TILES)) {
      if (rows.length !== TILE)
        errors.push(`${name}: ${rows.length} rows`);
      rows.forEach((row, y) => {
        if (row.length !== TILE)
          errors.push(`${name}[${y}]: ${row.length} cols`);
        for (const ch of row)
          if (ch !== '.' && !PALETTE[ch])
            errors.push(`${name}[${y}]: unknown color '${ch}'`);
      });
    }
    return errors;
  }

  function paint(ctx, rows, ox, oy) {
    for (let y = 0; y < rows.length; ++y) {
      const row = rows[y];
      let x = 0;
      while (x < row.length) {
        const ch = row[x];
        let end = x + 1;
        while (end < row.length && row[end] === ch)
          ++end;
        if (ch !== '.') {
          ctx.fillStyle = PALETTE[ch];
          ctx.fillRect(ox + x, oy + y, end - x, 1);
        }
        x = end;
      }
    }
  }

  let _sheet = null;

  function landmarkSheet() {
    if (_sheet || typeof document === 'undefined')
      return _sheet;
    const cv = document.createElement('canvas');
    cv.width = TILE_NAMES.length * TILE;
    cv.height = TILE;
    const ctx = cv.getContext('2d');
    if (!ctx)
      return null;
    TILE_NAMES.forEach((name, i) => paint(ctx, TILES[name], i * TILE, 0));
    _sheet = cv;
    return _sheet;
  }

  function get(sheetId) {
    return sheetId === 'landmarks' ? landmarkSheet() : null;
  }

  TR.PixelArt = Object.freeze({
    TILE, PALETTE, TILES, TILE_NAMES,
    rect, validate, paint, get,
    sheets: () => ({ landmarks: landmarkSheet() }),
  });
})();
