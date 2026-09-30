;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;

  // Dungeon sheet layout (12 cols): heroes 84-88 and 96-100, monsters 108-112
  // and 120-124. Everything else is floors, walls, furniture and items.
  const DUNGEON_COLS = 12;
  const HERO_TILES = new Set([84, 85, 86, 87, 88, 96, 97, 98, 99, 100]);
  const MONSTER_TILES = new Set([108, 109, 110, 111, 112, 120, 121, 122, 123, 124]);
  const CHARACTER_TILES = new Set([...HERO_TILES, ...MONSTER_TILES]);

  function dungeonIndex(rect) {
    return (rect.y / 17) * DUNGEON_COLS + rect.x / 17;
  }

  describe('Sprite mapping -- dungeon sheet characters', () => {

    it('every enemy fallback points at a character tile, never furniture', () => {
      for (const [id, rect] of Object.entries(TR.ENEMY_SPRITES))
        assert.ok(CHARACTER_TILES.has(dungeonIndex(rect)), `${id} maps to non-character tile ${dungeonIndex(rect)}`);
    });

    it('every party class points at a character tile', () => {
      for (const [id, rect] of Object.entries(TR.PARTY_SPRITES))
        assert.ok(CHARACTER_TILES.has(dungeonIndex(rect)), `${id} maps to non-character tile ${dungeonIndex(rect)}`);
    });

    it('sheet-type registry entries carry a rect', () => {
      for (const [id, entry] of Object.entries(TR.CREATURE_SPRITE_REGISTRY))
        if (entry.type === 'sheet')
          assert.ok(entry.rect && entry.rect.w === 16, `${id} sheet entry lacks a rect`);
    });
  });

  describe('Sprite mapping -- pixel-art landmarks', () => {

    it('all landmark tiles are 16x16 with known colors', () => {
      assert.deepEqual(TR.PixelArt.validate(), []);
    });

    it('overworld MOUNTAIN, TOWN and DUNGEON use landmark tiles', () => {
      for (const name of ['MOUNTAIN', 'TOWN', 'DUNGEON'])
        assert.equal(TR.OVERWORLD_TERRAIN_SPRITES[name].sheet, 'landmarks', name);
    });
  });

  // The pixel checks need the real PNG files, so they only run under Node.
  const nodeFs = typeof require === 'function' ? require('fs') : null;
  if (!nodeFs)
    return;
  const nodePath = require('path');
  const zlib = require('zlib');
  const gameRoot = nodePath.join(__dirname, '..');

  // Minimal PNG decoder: 8-bit, non-interlaced, color types 3 (palette) and 6 (RGBA).
  function decodePng(file) {
    const buf = nodeFs.readFileSync(file);
    let pos = 8;
    let width = 0, height = 0, colorType = 0, bitDepth = 0;
    let trns = null;
    const idat = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString('ascii', pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (type === 'IHDR') {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
      } else if (type === 'tRNS')
        trns = data;
      else if (type === 'IDAT')
        idat.push(data);
      pos += 12 + len;
    }
    if (bitDepth !== 8 || (colorType !== 3 && colorType !== 6))
      throw new Error(`unsupported PNG ${file}: depth ${bitDepth} type ${colorType}`);
    const bpp = colorType === 6 ? 4 : 1;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * bpp;
    const px = Buffer.alloc(stride * height);
    for (let y = 0; y < height; ++y) {
      const filter = raw[y * (stride + 1)];
      for (let x = 0; x < stride; ++x) {
        const v = raw[y * (stride + 1) + 1 + x];
        const a = x >= bpp ? px[y * stride + x - bpp] : 0;
        const b = y > 0 ? px[(y - 1) * stride + x] : 0;
        const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
        let pred = 0;
        if (filter === 1) pred = a;
        else if (filter === 2) pred = b;
        else if (filter === 3) pred = (a + b) >> 1;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
        }
        px[y * stride + x] = (v + pred) & 0xff;
      }
    }
    const alpha = (x, y) => colorType === 6
      ? px[y * stride + x * 4 + 3]
      : (trns && px[y * stride + x] < trns.length ? trns[px[y * stride + x]] : 255);
    return { width, height, alpha };
  }

  const sheets = {};
  for (const [id, meta] of Object.entries(TR.SHEET_REGISTRY))
    sheets[id] = decodePng(nodePath.join(gameRoot, meta.path));

  function opaquePixels(sheet, rect) {
    let n = 0;
    for (let y = rect.y; y < rect.y + rect.h; ++y)
      for (let x = rect.x; x < rect.x + rect.w; ++x)
        if (sheet.alpha(x, y) > 0)
          ++n;
    return n;
  }

  function checkTable(label, table, defaultSheet) {
    for (const [id, rect] of Object.entries(table)) {
      if (rect.sheet === 'landmarks')
        continue;
      const sheet = sheets[rect.sheet || defaultSheet];
      assert.ok(sheet, `${label}.${id}: unknown sheet ${rect.sheet}`);
      assert.ok(rect.x + rect.w <= sheet.width && rect.y + rect.h <= sheet.height, `${label}.${id} out of bounds`);
      assert.ok(opaquePixels(sheet, rect) > 0, `${label}.${id} is a fully transparent tile`);
    }
  }

  describe('Sprite mapping -- pixels', () => {

    it('overworld terrain of every plane shows visible pixels', () => {
      for (const [dim, table] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES))
        checkTable(dim, table, 'overworld');
    });

    it('ground tiles are fully opaque so no void shows through', () => {
      for (const [dim, table] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES))
        for (const name of ['GRASS', 'WATER', 'SAND', 'ROAD'])
          assert.equal(opaquePixels(sheets.overworld, table[name]), 256, `${dim}.${name} has holes`);
    });

    it('combat terrain, party, enemy and item tiles show visible pixels', () => {
      checkTable('combat', TR.COMBAT_TERRAIN_SPRITES, 'dungeon');
      checkTable('party', TR.PARTY_SPRITES, 'dungeon');
      checkTable('enemy', TR.ENEMY_SPRITES, 'dungeon');
      checkTable('item', TR.ITEM_SPRITES, 'dungeon');
    });

    it('every creature icon file exists', () => {
      for (const [id, entry] of Object.entries(TR.CREATURE_SPRITE_REGISTRY))
        if (entry.path)
          assert.ok(nodeFs.existsSync(nodePath.join(gameRoot, entry.path)), `${id}: missing ${entry.path}`);
    });
  });
})();
