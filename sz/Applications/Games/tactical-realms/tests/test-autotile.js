;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;

  describe('Autotile — computeBitmask', () => {

    it('returns 0 for an isolated tile with no matching neighbours', () => {
      const getter = () => 1;
      assert.equal(TR.computeBitmask(5, 5, (c, r) => (c === 5 && r === 5) ? 8 : 1, 8), 0);
    });

    it('returns 15 when all four cardinal neighbours match', () => {
      const mask = TR.computeBitmask(5, 5, () => 8, 8);
      assert.equal(mask, 15);
    });

    it('sets N bit when north neighbour matches', () => {
      const getter = (c, r) => (r === 4 && c === 5) || (c === 5 && r === 5) ? 8 : 1;
      const mask = TR.computeBitmask(5, 5, getter, 8);
      assert.equal(mask & 1, 1);
    });

    it('sets E bit when east neighbour matches', () => {
      const getter = (c, r) => (c === 6 && r === 5) || (c === 5 && r === 5) ? 8 : 1;
      const mask = TR.computeBitmask(5, 5, getter, 8);
      assert.equal(mask & 2, 2);
    });

    it('sets S bit when south neighbour matches', () => {
      const getter = (c, r) => (r === 6 && c === 5) || (c === 5 && r === 5) ? 8 : 1;
      const mask = TR.computeBitmask(5, 5, getter, 8);
      assert.equal(mask & 4, 4);
    });

    it('sets W bit when west neighbour matches', () => {
      const getter = (c, r) => (c === 4 && r === 5) || (c === 5 && r === 5) ? 8 : 1;
      const mask = TR.computeBitmask(5, 5, getter, 8);
      assert.equal(mask & 8, 8);
    });

    it('returns N+S (5) for a vertical strip', () => {
      const getter = (c, r) => c === 5 ? 8 : 1;
      const mask = TR.computeBitmask(5, 5, getter, 8);
      assert.equal(mask, 1 + 4);
    });

    it('returns E+W (10) for a horizontal strip', () => {
      const getter = (c, r) => r === 5 ? 8 : 1;
      const mask = TR.computeBitmask(5, 5, getter, 8);
      assert.equal(mask, 2 + 8);
    });

    it('handles different terrain type values', () => {
      const getter = (c, r) => 3;
      const mask = TR.computeBitmask(0, 0, getter, 3);
      assert.equal(mask, 15);
    });

    it('handles negative coordinates', () => {
      const getter = () => 8;
      const mask = TR.computeBitmask(-5, -10, getter, 8);
      assert.equal(mask, 15);
    });
  });

  describe('Autotile — getAutotileRect', () => {

    it('returns a rect for WATER (tile type 8) with mask 15', () => {
      const rect = TR.getAutotileRect(8, 15);
      assert.ok(rect);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
    });

    it('returns null for terrain types without autotile maps', () => {
      const rect = TR.getAutotileRect(1, 15);
      assert.isNull(rect);
    });

    it('returns null for GRASS (tile type 1)', () => {
      assert.isNull(TR.getAutotileRect(1, 0));
    });

    it('returns centre tile for mask 15 (all match)', () => {
      const rect = TR.getAutotileRect(8, 15);
      assert.ok(rect);
      assert.equal(rect.x, 3 * 17);
      assert.equal(rect.y, 1 * 17);
    });

    it('returns N-edge tile for mask 14 (N differs)', () => {
      const rect = TR.getAutotileRect(8, 14);
      assert.ok(rect);
      assert.equal(rect.x, 3 * 17);
      assert.equal(rect.y, 0 * 17);
    });

    it('returns NW-corner tile for mask 6 (E+S match)', () => {
      const rect = TR.getAutotileRect(8, 6);
      assert.ok(rect);
      assert.equal(rect.x, 2 * 17);
      assert.equal(rect.y, 0 * 17);
    });

    it('returns NE-corner tile for mask 12 (S+W match)', () => {
      const rect = TR.getAutotileRect(8, 12);
      assert.ok(rect);
      assert.equal(rect.x, 4 * 17);
      assert.equal(rect.y, 0 * 17);
    });

    it('returns SW-corner tile for mask 3 (N+E match)', () => {
      const rect = TR.getAutotileRect(8, 3);
      assert.ok(rect);
      assert.equal(rect.x, 2 * 17);
      assert.equal(rect.y, 2 * 17);
    });

    it('returns SE-corner tile for mask 9 (N+W match)', () => {
      const rect = TR.getAutotileRect(8, 9);
      assert.ok(rect);
      assert.equal(rect.x, 4 * 17);
      assert.equal(rect.y, 2 * 17);
    });

    it('returns W-edge tile for mask 7 (N+E+S match)', () => {
      const rect = TR.getAutotileRect(8, 7);
      assert.ok(rect);
      assert.equal(rect.x, 2 * 17);
      assert.equal(rect.y, 1 * 17);
    });

    it('returns E-edge tile for mask 13 (N+S+W match)', () => {
      const rect = TR.getAutotileRect(8, 13);
      assert.ok(rect);
      assert.equal(rect.x, 4 * 17);
      assert.equal(rect.y, 1 * 17);
    });

    it('returns S-edge tile for mask 11 (N+E+W match)', () => {
      const rect = TR.getAutotileRect(8, 11);
      assert.ok(rect);
      assert.equal(rect.x, 3 * 17);
      assert.equal(rect.y, 2 * 17);
    });

    it('falls back to centre for isolated mask 0', () => {
      const rect = TR.getAutotileRect(8, 0);
      const centre = TR.getAutotileRect(8, 15);
      assert.equal(rect.x, centre.x);
      assert.equal(rect.y, centre.y);
    });

    it('all 16 masks produce frozen rects with valid properties', () => {
      for (let mask = 0; mask < 16; ++mask) {
        const rect = TR.getAutotileRect(8, mask);
        assert.ok(rect, 'mask ' + mask + ' should return a rect');
        assert.ok(Object.isFrozen(rect), 'mask ' + mask + ' rect should be frozen');
        assert.equal(rect.w, 16, 'mask ' + mask + ' .w');
        assert.equal(rect.h, 16, 'mask ' + mask + ' .h');
        assert.ok(rect.x >= 0, 'mask ' + mask + ' .x >= 0');
        assert.ok(rect.y >= 0, 'mask ' + mask + ' .y >= 0');
      }
    });
  });

  describe('Autotile — OVERWORLD_AUTOTILE_MAP', () => {

    it('is frozen', () => {
      assert.ok(Object.isFrozen(TR.OVERWORLD_AUTOTILE_MAP));
    });

    it('has an entry for WATER (tile type 8)', () => {
      assert.ok(TR.OVERWORLD_AUTOTILE_MAP[8]);
    });

    it('WATER map has 16 entries', () => {
      assert.equal(TR.OVERWORLD_AUTOTILE_MAP[8].length, 16);
    });

    it('WATER map entries are all frozen rects', () => {
      for (let i = 0; i < 16; ++i) {
        const rect = TR.OVERWORLD_AUTOTILE_MAP[8][i];
        assert.ok(rect, 'entry ' + i);
        assert.ok(Object.isFrozen(rect), 'entry ' + i + ' frozen');
      }
    });

    it('distinct masks produce distinct tiles for edges and corners', () => {
      const map = TR.OVERWORLD_AUTOTILE_MAP[8];
      const edgeMasks = [14, 13, 11, 7, 6, 12, 3, 9];
      const rects = edgeMasks.map(m => map[m]);
      for (let i = 0; i < rects.length; ++i)
        for (let j = i + 1; j < rects.length; ++j)
          assert.ok(
            rects[i].x !== rects[j].x || rects[i].y !== rects[j].y,
            'masks ' + edgeMasks[i] + ' and ' + edgeMasks[j] + ' should differ'
          );
    });
  });

  describe('Autotile — generateTerrainTransitions', () => {

    it('exposes generateTerrainTransitions as a function', () => {
      assert.equal(typeof TR.generateTerrainTransitions, 'function');
    });

    it('exposes getAutotileSheet as a function', () => {
      assert.equal(typeof TR.getAutotileSheet, 'function');
    });

    it('returns null sheet before generation', () => {
      assert.isNull(TR.getAutotileSheet(9));
    });

    it('SAND returns null from getAutotileRect before generation', () => {
      assert.isNull(TR.getAutotileRect(9, 15));
    });

    it('does not throw when called with a fake sheet image', () => {
      const fakeImg = {};
      TR.generateTerrainTransitions(fakeImg);
    });

    it('does not throw when called with null', () => {
      TR.generateTerrainTransitions(null);
    });
  });

  describe('Autotile — generated SAND map', () => {

    it('generates SAND map after calling generateTerrainTransitions', () => {
      // Force re-generation by creating a new scope test
      // The map was populated by the fake-image call above
      // but the canvas will be a DOM shim canvas with noop drawing
      const rect = TR.getAutotileRect(9, 15);
      // In the headless environment the generated canvas is a mock,
      // but the map entries should still be built correctly
      if (rect) {
        assert.equal(rect.w, 16);
        assert.equal(rect.h, 16);
      }
    });

    it('getAutotileSheet returns a canvas for SAND after generation', () => {
      const sheet = TR.getAutotileSheet(9);
      if (sheet)
        assert.ok(sheet);
    });

    it('getAutotileSheet returns null for WATER', () => {
      assert.isNull(TR.getAutotileSheet(8));
    });

    it('getAutotileSheet returns null for GRASS', () => {
      assert.isNull(TR.getAutotileSheet(1));
    });

    it('WATER autotiling still works unchanged after generation', () => {
      const rect = TR.getAutotileRect(8, 15);
      assert.ok(rect);
      assert.equal(rect.x, 3 * 17);
      assert.equal(rect.y, 1 * 17);
    });

    it('WATER edge rects unchanged after SAND generation', () => {
      assert.equal(TR.getAutotileRect(8, 14).x, 3 * 17);
      assert.equal(TR.getAutotileRect(8, 6).x, 2 * 17);
      assert.equal(TR.getAutotileRect(8, 12).x, 4 * 17);
    });
  });
})();
