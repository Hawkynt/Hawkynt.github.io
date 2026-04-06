;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const SpriteCompositor = TR.SpriteCompositor;

  describe('SpriteCompositor — construction', () => {

    it('constructs with default maxSize 1024', () => {
      const sc = new SpriteCompositor();
      assert.equal(sc.stats().maxSize, 1024);
    });

    it('constructs with custom maxSize', () => {
      const sc = new SpriteCompositor(256);
      assert.equal(sc.stats().maxSize, 256);
    });

    it('starts with zero hits/misses/size', () => {
      const sc = new SpriteCompositor();
      const s = sc.stats();
      assert.equal(s.hits, 0);
      assert.equal(s.misses, 0);
      assert.equal(s.size, 0);
    });

    it('corsBlocked defaults to false', () => {
      const sc = new SpriteCompositor();
      assert.equal(sc.corsBlocked, false);
    });
  });

  describe('SpriteCompositor — cache key determinism', () => {

    it('same layers produce same key via consistent stats', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      const rect = { x: 0, y: 0, w: 16, h: 16 };
      const layers = [{ img: fakeImg, rect, tint: null }];
      sc.drawComposite(fakeCtx, layers, 32, 0, 0);
      assert.equal(sc.stats().misses, 1);
      sc.drawComposite(fakeCtx, layers, 32, 0, 0);
      assert.equal(sc.stats().hits, 1);
      assert.equal(sc.stats().size, 1);
    });

    it('different layers produce different keys', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      const rect1 = { x: 0, y: 0, w: 16, h: 16 };
      const rect2 = { x: 16, y: 0, w: 16, h: 16 };
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rect1, tint: null }], 32, 0, 0);
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rect2, tint: null }], 32, 0, 0);
      assert.equal(sc.stats().size, 2);
      assert.equal(sc.stats().misses, 2);
    });

    it('tint differentiates entries', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      const rect = { x: 0, y: 0, w: 16, h: 16 };
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 32, 0, 0);
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: 'rgba(255,0,0,0.3)' }], 32, 0, 0);
      assert.equal(sc.stats().size, 2);
    });

    it('layer order matters', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      const rect1 = { x: 0, y: 0, w: 16, h: 16 };
      const rect2 = { x: 16, y: 0, w: 16, h: 16 };
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rect1, tint: null }, { img: fakeImg, rect: rect2, tint: null }], 32, 0, 0);
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rect2, tint: null }, { img: fakeImg, rect: rect1, tint: null }], 32, 0, 0);
      assert.equal(sc.stats().size, 2);
    });

    it('destSize is part of key', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      const rect = { x: 0, y: 0, w: 16, h: 16 };
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 32, 0, 0);
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 44, 0, 0);
      assert.equal(sc.stats().size, 2);
    });
  });

  describe('SpriteCompositor — LRU eviction', () => {

    it('cache size never exceeds maxSize', () => {
      const sc = new SpriteCompositor(4);
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      for (let i = 0; i < 8; ++i) {
        const rect = { x: i * 16, y: 0, w: 16, h: 16 };
        sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 32, 0, 0);
      }
      assert.ok(sc.stats().size <= 4);
    });

    it('evicts oldest entry when full', () => {
      const sc = new SpriteCompositor(3);
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      for (let i = 0; i < 4; ++i) {
        const rect = { x: i * 16, y: 0, w: 16, h: 16 };
        sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 32, 0, 0);
      }
      assert.equal(sc.stats().size, 3);
      // first entry should have been evicted -- re-access triggers miss
      const rect0 = { x: 0, y: 0, w: 16, h: 16 };
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rect0, tint: null }], 32, 0, 0);
      assert.equal(sc.stats().misses, 5);
    });

    it('recently accessed entries survive eviction', () => {
      const sc = new SpriteCompositor(3);
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      const rects = [];
      for (let i = 0; i < 3; ++i)
        rects.push({ x: i * 16, y: 0, w: 16, h: 16 });
      for (const r of rects)
        sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: r, tint: null }], 32, 0, 0);
      // touch entry 0 to make it most recent
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rects[0], tint: null }], 32, 0, 0);
      assert.equal(sc.stats().hits, 1);
      // add a 4th entry -- should evict entry 1 (oldest), not entry 0
      const rect3 = { x: 48, y: 0, w: 16, h: 16 };
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rect3, tint: null }], 32, 0, 0);
      assert.equal(sc.stats().size, 3);
      // entry 0 should still be cached
      sc.drawComposite(fakeCtx, [{ img: fakeImg, rect: rects[0], tint: null }], 32, 0, 0);
      assert.equal(sc.stats().hits, 2);
    });

    it('after eviction stats.size equals maxSize', () => {
      const sc = new SpriteCompositor(5);
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      for (let i = 0; i < 10; ++i) {
        const rect = { x: i * 16, y: 0, w: 16, h: 16 };
        sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 32, 0, 0);
      }
      assert.equal(sc.stats().size, 5);
    });

    it('invalidate() clears everything', () => {
      const sc = new SpriteCompositor(10);
      const fakeCtx = makeFakeCtx();
      const fakeImg = {};
      for (let i = 0; i < 5; ++i) {
        const rect = { x: i * 16, y: 0, w: 16, h: 16 };
        sc.drawComposite(fakeCtx, [{ img: fakeImg, rect, tint: null }], 32, 0, 0);
      }
      assert.equal(sc.stats().size, 5);
      sc.invalidate();
      const s = sc.stats();
      assert.equal(s.size, 0);
      assert.equal(s.hits, 0);
      assert.equal(s.misses, 0);
    });
  });

  describe('SpriteCompositor — CORS fallback', () => {

    it('drawComposite does not throw with null context', () => {
      const sc = new SpriteCompositor();
      sc.drawComposite(null, [{ img: {}, rect: { x: 0, y: 0, w: 16, h: 16 }, tint: null }], 32, 0, 0);
    });

    it('drawComposite does not throw with empty layers', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      sc.drawComposite(fakeCtx, [], 32, 0, 0);
    });

    it('drawComposite handles layers with null img gracefully', () => {
      const sc = new SpriteCompositor();
      const fakeCtx = makeFakeCtx();
      sc.drawComposite(fakeCtx, [{ img: null, rect: { x: 0, y: 0, w: 16, h: 16 }, tint: null }], 32, 0, 0);
    });
  });

  describe('SpriteCompositor — TERRAIN_LAYERS', () => {

    it('TERRAIN_LAYERS exists and is frozen', () => {
      assert.ok(TR.TERRAIN_LAYERS);
      assert.ok(Object.isFrozen(TR.TERRAIN_LAYERS));
    });

    it('has entries for all 14 terrain IDs', () => {
      const expected = ['plains', 'forest', 'mountain', 'ruins', 'dungeon_floor', 'water', 'swamp', 'desert', 'snow', 'lava', 'bridge', 'road', 'cave', 'wall'];
      for (const id of expected)
        assert.ok(TR.TERRAIN_LAYERS[id], `missing TERRAIN_LAYERS entry for ${id}`);
    });

    it('each entry is a frozen array of layer objects', () => {
      for (const [id, layers] of Object.entries(TR.TERRAIN_LAYERS)) {
        assert.ok(Array.isArray(layers), `${id} should be an array`);
        assert.ok(Object.isFrozen(layers), `${id} should be frozen`);
        assert.ok(layers.length > 0, `${id} should have at least one layer`);
      }
    });

    it('each layer has a sprite string matching a COMBAT_TERRAIN_SPRITES key', () => {
      for (const [id, layers] of Object.entries(TR.TERRAIN_LAYERS))
        for (const layer of layers) {
          assert.typeOf(layer.sprite, 'string', `${id} layer sprite should be string`);
          assert.ok(TR.COMBAT_TERRAIN_SPRITES[layer.sprite], `${id} layer sprite '${layer.sprite}' not in COMBAT_TERRAIN_SPRITES`);
        }
    });
  });

  describe('SpriteCompositor — Renderer integration', () => {

    it('Renderer constructs with compositor (no throw)', () => {
      const r = new TR.Renderer(null);
      assert.ok(r);
    });

    it('compositor getter returns SpriteCompositor instance', () => {
      const r = new TR.Renderer(null);
      assert.ok(r.compositor instanceof SpriteCompositor);
    });

    it('drawCombatGrid with TERRAIN_LAYERS does not throw in headless', () => {
      const r = new TR.Renderer(null);
      if (TR.CombatGrid) {
        const grid = TR.CombatGrid.generate(8, 8, new TR.PRNG(42), 'plains');
        r.drawCombatGrid(grid, 32, 0, 0, 'plains');
      }
    });
  });

  // Helper: minimal fake canvas context for headless testing
  function makeFakeCtx() {
    const noop = () => {};
    return {
      drawImage: noop,
      clearRect: noop,
      fillRect: noop,
      strokeRect: noop,
      beginPath: noop,
      arc: noop,
      fill: noop,
      stroke: noop,
      save: noop,
      restore: noop,
      fillText: noop,
      measureText: () => ({ width: 0 }),
      set imageSmoothingEnabled(_) {},
      set globalCompositeOperation(_) {},
      set fillStyle(_) {},
      set strokeStyle(_) {},
      set lineWidth(_) {},
      set font(_) {},
      set textAlign(_) {},
      set textBaseline(_) {},
      set globalAlpha(_) {},
      set shadowColor(_) {},
      set shadowBlur(_) {},
      set lineCap(_) {},
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      roundRect: noop,
      moveTo: noop,
      lineTo: noop,
      getContext: function() { return this; },
    };
  }
})();
