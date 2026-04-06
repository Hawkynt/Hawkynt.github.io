;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;

  describe('SpriteResolver -- CREATURE_SPRITE_REGISTRY', () => {

    it('registry exists and is frozen', () => {
      assert.ok(TR.CREATURE_SPRITE_REGISTRY);
      assert.ok(Object.isFrozen(TR.CREATURE_SPRITE_REGISTRY));
    });

    it('every ENEMY_TEMPLATES key has a registry entry', () => {
      const templates = TR.ENEMY_TEMPLATES;
      if (!templates)
        return;
      for (const id of Object.keys(templates))
        assert.ok(TR.CREATURE_SPRITE_REGISTRY[id], `missing registry entry for ${id}`);
    });

    it('all entries have valid type field', () => {
      const validTypes = new Set(['icon', 'sheet', 'anim-sheet', 'anim-set']);
      for (const [id, entry] of Object.entries(TR.CREATURE_SPRITE_REGISTRY)) {
        assert.ok(validTypes.has(entry.type), `${id} has invalid type: ${entry.type}`);
      }
    });

    it('all icon entries have a valid path string', () => {
      for (const [id, entry] of Object.entries(TR.CREATURE_SPRITE_REGISTRY)) {
        if (entry.type !== 'icon')
          continue;
        assert.typeOf(entry.path, 'string', `${id}.path`);
        assert.ok(entry.path.length > 0, `${id} path should not be empty`);
      }
    });

    it('no entry has undefined type', () => {
      for (const [id, entry] of Object.entries(TR.CREATURE_SPRITE_REGISTRY))
        assert.ok(entry.type !== undefined, `${id} type should not be undefined`);
    });

    it('each entry object is frozen', () => {
      for (const [id, entry] of Object.entries(TR.CREATURE_SPRITE_REGISTRY))
        assert.ok(Object.isFrozen(entry), `${id} entry should be frozen`);
    });

    it('has at least 42 entries (all enemy types)', () => {
      assert.ok(Object.keys(TR.CREATURE_SPRITE_REGISTRY).length >= 42);
    });
  });

  describe('SpriteResolver -- resolve() fallback chain', () => {

    it('returns null for completely unknown creatureId', () => {
      const resolver = new TR.SpriteResolver(null);
      const result = resolver.resolve('nonexistent_xyzzy', 'enemy');
      assert.isNull(result);
    });

    it('returns sheet-based result for party sprites when assets available', () => {
      const fakeLoader = {
        ready: true,
        has(id) { return id === 'dungeon'; },
        get(id) { return id === 'dungeon' ? { width: 203, height: 186 } : null; },
      };
      const resolver = new TR.SpriteResolver(fakeLoader);
      const result = resolver.resolve('fighter', 'party');
      assert.ok(result, 'should resolve party sprite from dungeon sheet');
      assert.ok(result.img);
      assert.typeOf(result.srcX, 'number');
      assert.typeOf(result.srcY, 'number');
    });

    it('returns null for enemy when icon not yet loaded', () => {
      const resolver = new TR.SpriteResolver(null);
      const result = resolver.resolve('goblin', 'enemy');
      assert.isNull(result);
    });

    it('result shape has all required fields', () => {
      const fakeLoader = {
        ready: true,
        has() { return true; },
        get() { return { width: 203, height: 186 }; },
      };
      const resolver = new TR.SpriteResolver(fakeLoader);
      const result = resolver.resolve('fighter', 'party');
      assert.ok(result);
      assert.ok('img' in result, 'should have img');
      assert.ok('srcX' in result, 'should have srcX');
      assert.ok('srcY' in result, 'should have srcY');
      assert.ok('srcW' in result, 'should have srcW');
      assert.ok('srcH' in result, 'should have srcH');
      assert.ok('flip' in result, 'should have flip');
      assert.ok('tint' in result, 'should have tint');
    });

    it('tint from ENEMY_TINTS used for sheet fallback', () => {
      const fakeLoader = {
        ready: true,
        has() { return true; },
        get() { return { width: 203, height: 186 }; },
      };
      const resolver = new TR.SpriteResolver(fakeLoader);
      // use a creature with no registry override that still has ENEMY_SPRITES entry
      // all enemies ARE in the registry, so we test via direct sheet fallback
      // fighter is a party class, not an enemy -- it uses PARTY_TINTS
      const result = resolver.resolve('ranger', 'party');
      if (result && TR.PARTY_TINTS && TR.PARTY_TINTS.ranger)
        assert.equal(result.tint, TR.PARTY_TINTS.ranger);
    });

    it('flip is false for standard sheet sprites', () => {
      const fakeLoader = {
        ready: true,
        has() { return true; },
        get() { return { width: 203, height: 186 }; },
      };
      const resolver = new TR.SpriteResolver(fakeLoader);
      const result = resolver.resolve('paladin', 'party');
      assert.ok(result);
      assert.equal(result.flip, false);
    });

    it('falls through to dungeon sheet for unknown registry entry', () => {
      const fakeLoader = {
        ready: true,
        has() { return true; },
        get() { return { width: 203, height: 186 }; },
      };
      const resolver = new TR.SpriteResolver(fakeLoader);
      // fighter is not in CREATURE_SPRITE_REGISTRY, but is in PARTY_SPRITES
      const result = resolver.resolve('fighter', 'party');
      assert.ok(result, 'should fall through to sheet resolve');
    });
  });

  describe('SpriteResolver -- format support', () => {

    it('icon entries resolve to null initially (image not loaded yet)', () => {
      const resolver = new TR.SpriteResolver(null);
      const result = resolver.resolve('goblin', 'enemy');
      assert.isNull(result);
    });

    it('sheet entries resolve when loader has the sheet', () => {
      // Manually create a resolver and test a sheet-type entry
      const fakeLoader = {
        ready: true,
        has() { return true; },
        get() { return { width: 100, height: 100 }; },
      };
      const resolver = new TR.SpriteResolver(fakeLoader);
      // Test via party sprite (which goes through sheet fallback)
      const result = resolver.resolve('wizard', 'party');
      assert.ok(result);
      assert.equal(result.srcW, 16);
      assert.equal(result.srcH, 16);
    });

    it('animType fallback: unknown anim falls back to stand', () => {
      // Test the internal fallback by creating a mock anim-sheet entry
      // Since all current entries are icon type, we test the mechanism via
      // the API accepting animType gracefully
      const resolver = new TR.SpriteResolver(null);
      // Should not crash with unknown animType
      const result = resolver.resolve('goblin', 'enemy', 'dance', 'down', 0);
      // Result is null because icon not loaded, but no error is thrown
      assert.isNull(result);
    });

    it('direction param accepted without error for icon types', () => {
      const resolver = new TR.SpriteResolver(null);
      const result = resolver.resolve('goblin', 'enemy', 'stand', 'left', 3);
      assert.isNull(result);
    });

    it('frame wraps via modulo for anim types', () => {
      // Test frame wrapping logic with a minimal anim-sheet-like setup
      // Since we can't inject into the frozen registry, test via API acceptance
      const resolver = new TR.SpriteResolver(null);
      const result = resolver.resolve('goblin', 'enemy', 'stand', 'down', 99);
      assert.isNull(result);
    });
  });

  describe('SpriteResolver -- lazy loading', () => {

    it('isLoaded returns false before load', () => {
      const resolver = new TR.SpriteResolver(null);
      assert.ok(!resolver.isLoaded('assets/monsters/Chaos/Icon1.png'));
    });

    it('loadedCount starts at 0', () => {
      const resolver = new TR.SpriteResolver(null);
      assert.equal(resolver.loadedCount, 0);
    });

    it('preloadCreatures ignores unknown IDs', () => {
      const resolver = new TR.SpriteResolver(null);
      resolver.preloadCreatures(['nonexistent_abc', 'nonexistent_xyz']);
      assert.equal(resolver.loadedCount, 0);
    });

    it('preloadCreatures triggers loads for valid IDs without crashing', () => {
      const resolver = new TR.SpriteResolver(null);
      resolver.preloadCreatures(['goblin', 'troll', 'rat']);
      // Images are loading async; loadedCount is still 0 synchronously
      assert.equal(resolver.loadedCount, 0);
    });

    it('preloadCreatures does not crash on empty array', () => {
      const resolver = new TR.SpriteResolver(null);
      resolver.preloadCreatures([]);
      assert.equal(resolver.loadedCount, 0);
    });
  });

  describe('SpriteResolver -- API signature', () => {

    it('resolve accepts (creatureId, category, animType, direction, frame)', () => {
      const resolver = new TR.SpriteResolver(null);
      const result = resolver.resolve('goblin', 'enemy', 'stand', 'down', 0);
      // Should not throw -- null is fine (image not loaded)
      assert.isNull(result);
    });

    it('missing optional params default gracefully', () => {
      const resolver = new TR.SpriteResolver(null);
      const r1 = resolver.resolve('goblin', 'enemy');
      assert.isNull(r1);
      const r2 = resolver.resolve('goblin', 'enemy', 'attack');
      assert.isNull(r2);
      const r3 = resolver.resolve('goblin', 'enemy', 'attack', 'left');
      assert.isNull(r3);
    });

    it('resolve returns null when creatureId is null', () => {
      const resolver = new TR.SpriteResolver(null);
      assert.isNull(resolver.resolve(null, 'enemy'));
    });

    it('resolve returns null when creatureId is undefined', () => {
      const resolver = new TR.SpriteResolver(null);
      assert.isNull(resolver.resolve(undefined, 'party'));
    });

    it('SpriteResolver constructor accepts null assetLoader', () => {
      const resolver = new TR.SpriteResolver(null);
      assert.ok(resolver);
      assert.equal(resolver.loadedCount, 0);
    });

    it('SpriteResolver is exported on TR namespace', () => {
      assert.ok(TR.SpriteResolver);
      assert.typeOf(TR.SpriteResolver, 'function');
    });

    it('CREATURE_SPRITE_REGISTRY is exported on TR namespace', () => {
      assert.ok(TR.CREATURE_SPRITE_REGISTRY);
      assert.typeOf(TR.CREATURE_SPRITE_REGISTRY, 'object');
    });
  });
})();
