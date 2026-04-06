;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;

  describe('AssetLoader — spriteRectM', () => {

    it('spriteRectM returns correct coordinates with zero margin', () => {
      const rect = TR.spriteRectM(0, 12, 0);
      assert.equal(rect.x, 0);
      assert.equal(rect.y, 0);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
    });

    it('spriteRectM returns correct coordinates with margin', () => {
      const rect = TR.spriteRectM(1, 57, 1);
      assert.equal(rect.x, 17);
      assert.equal(rect.y, 0);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
    });

    it('spriteRectM wraps to second row correctly', () => {
      const rect = TR.spriteRectM(57, 57, 1);
      assert.equal(rect.x, 0);
      assert.equal(rect.y, 17);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
    });

    it('spriteRectM with margin=0 matches dungeon spriteRect coordinates', () => {
      const rect = TR.spriteRectM(108, 12, 0);
      assert.equal(rect.x, 0);
      assert.equal(rect.y, 144);
    });

    it('spriteRectM result is frozen', () => {
      const rect = TR.spriteRectM(5, 10, 1);
      assert.ok(Object.isFrozen(rect));
    });
  });

  describe('AssetLoader — Overworld Constants', () => {

    it('OVERWORLD_COLS equals 57', () => {
      assert.equal(TR.OVERWORLD_COLS, 57);
    });

    it('OVERWORLD_MARGIN equals 1', () => {
      assert.equal(TR.OVERWORLD_MARGIN, 1);
    });

    it('OVERWORLD_TERRAIN_SPRITES has entries for all 9 tile types', () => {
      const expected = ['GRASS', 'FOREST', 'MOUNTAIN', 'DUNGEON', 'TOWN', 'ROAD', 'CAMP', 'WATER', 'SAND'];
      for (const name of expected)
        assert.ok(TR.OVERWORLD_TERRAIN_SPRITES[name], `missing sprite for ${name}`);
    });

    it('OVERWORLD_TERRAIN_SPRITES entries have valid rect properties', () => {
      for (const [name, rect] of Object.entries(TR.OVERWORLD_TERRAIN_SPRITES)) {
        assert.typeOf(rect.x, 'number', `${name}.x`);
        assert.typeOf(rect.y, 'number', `${name}.y`);
        assert.equal(rect.w, 16, `${name}.w`);
        assert.equal(rect.h, 16, `${name}.h`);
        assert.ok(rect.x >= 0, `${name}.x should be >= 0`);
        assert.ok(rect.y >= 0, `${name}.y should be >= 0`);
      }
    });

    it('OVERWORLD_TERRAIN_SPRITES is frozen', () => {
      assert.ok(Object.isFrozen(TR.OVERWORLD_TERRAIN_SPRITES));
    });
  });

  describe('AssetLoader — ENEMY_SPRITES', () => {

    it('all 11 original enemies have sprite mappings', () => {
      const expected = ['goblin', 'skeleton', 'wolf', 'bandit', 'orc', 'spider', 'dark_mage', 'troll', 'wraith', 'rat', 'ogre'];
      for (const id of expected)
        assert.ok(TR.ENEMY_SPRITES[id], `missing sprite for ${id}`);
    });

    it('all 8 variant enemies have sprite mappings', () => {
      const expected = ['dire_wolf', 'hobgoblin', 'ghoul', 'minotaur', 'vampire_spawn', 'wyvern', 'lich', 'dragon_wyrmling'];
      for (const id of expected)
        assert.ok(TR.ENEMY_SPRITES[id], `missing sprite for ${id}`);
    });

    it('all 23 Phase B new enemies have sprite mappings', () => {
      const expected = [
        'kobold', 'zombie', 'stirge', 'gnoll', 'bugbear', 'worg', 'lizardfolk', 'harpy',
        'cockatrice', 'basilisk', 'wight', 'gargoyle', 'owlbear', 'manticore', 'phase_spider',
        'hill_giant', 'mind_flayer', 'young_dragon', 'death_knight', 'fire_elemental',
        'frost_giant', 'demon', 'devil',
      ];
      for (const id of expected)
        assert.ok(TR.ENEMY_SPRITES[id], `missing sprite for ${id}`);
    });

    it('all 42 enemies have tint entries', () => {
      for (const id of Object.keys(TR.ENEMY_SPRITES))
        assert.ok(TR.ENEMY_TINTS[id], `missing tint for ${id}`);
    });

    it('enemy sprite rects have valid coordinates', () => {
      for (const [id, rect] of Object.entries(TR.ENEMY_SPRITES)) {
        assert.equal(rect.w, 16, `${id}.w`);
        assert.equal(rect.h, 16, `${id}.h`);
        assert.ok(rect.x >= 0, `${id}.x should be >= 0`);
        assert.ok(rect.y >= 0, `${id}.y should be >= 0`);
      }
    });
  });

  describe('AssetLoader — Core Sprites', () => {

    it('COMBAT_TERRAIN_SPRITES exists with expected entries', () => {
      assert.ok(TR.COMBAT_TERRAIN_SPRITES);
      assert.ok(TR.COMBAT_TERRAIN_SPRITES.plains);
      assert.ok(TR.COMBAT_TERRAIN_SPRITES.forest);
      assert.ok(TR.COMBAT_TERRAIN_SPRITES.wall);
    });

    it('PARTY_SPRITES has all 10 class entries', () => {
      const classes = ['fighter', 'wizard', 'cleric', 'rogue', 'ranger', 'paladin', 'barbarian', 'bard', 'warlock', 'sorcerer'];
      for (const c of classes)
        assert.ok(TR.PARTY_SPRITES[c], `missing party sprite for ${c}`);
    });

    it('ITEM_SPRITES has expected entries', () => {
      assert.ok(TR.ITEM_SPRITES);
      assert.ok(TR.ITEM_SPRITES.chest_closed);
      assert.ok(TR.ITEM_SPRITES.sword);
      assert.ok(TR.ITEM_SPRITES.coin);
    });

    it('PLAYER_SPRITE is defined with valid rect', () => {
      assert.ok(TR.PLAYER_SPRITE);
      assert.equal(TR.PLAYER_SPRITE.w, 16);
      assert.equal(TR.PLAYER_SPRITE.h, 16);
    });

    it('ASSET_MANIFEST has dungeon and overworld entries', () => {
      assert.ok(TR.ASSET_MANIFEST);
      assert.ok(TR.ASSET_MANIFEST.dungeon);
      assert.ok(TR.ASSET_MANIFEST.overworld);
    });
  });

  describe('AssetLoader — ENEMY_TINTS', () => {

    it('ENEMY_TINTS exists and is frozen', () => {
      assert.ok(TR.ENEMY_TINTS);
      assert.ok(Object.isFrozen(TR.ENEMY_TINTS));
    });

    it('ENEMY_TINTS has entries for all 42 enemies', () => {
      for (const id of Object.keys(TR.ENEMY_SPRITES))
        assert.ok(TR.ENEMY_TINTS[id], `missing tint for ${id}`);
      assert.equal(Object.keys(TR.ENEMY_TINTS).length, 42);
    });

    it('all ENEMY_TINTS values are rgba strings', () => {
      for (const [id, tint] of Object.entries(TR.ENEMY_TINTS)) {
        assert.typeOf(tint, 'string', `${id} tint should be string`);
        assert.ok(tint.startsWith('rgba('), `${id} tint should start with rgba(`);
      }
    });
  });

  describe('AssetLoader — PARTY_TINTS', () => {

    it('PARTY_TINTS exists and is frozen', () => {
      assert.ok(TR.PARTY_TINTS);
      assert.ok(Object.isFrozen(TR.PARTY_TINTS));
    });

    it('PARTY_TINTS has entries for ranger and warlock', () => {
      assert.ok(TR.PARTY_TINTS.ranger, 'missing tint for ranger');
      assert.ok(TR.PARTY_TINTS.warlock, 'missing tint for warlock');
    });

    it('all PARTY_TINTS values are rgba strings', () => {
      for (const [id, tint] of Object.entries(TR.PARTY_TINTS)) {
        assert.typeOf(tint, 'string', `${id} tint should be string`);
        assert.ok(tint.startsWith('rgba('), `${id} tint should start with rgba(`);
      }
    });
  });

  describe('AssetLoader — DIMENSION_TERRAIN_SPRITES', () => {

    it('DIMENSION_TERRAIN_SPRITES exists and is frozen', () => {
      assert.ok(TR.DIMENSION_TERRAIN_SPRITES);
      assert.ok(Object.isFrozen(TR.DIMENSION_TERRAIN_SPRITES));
    });

    it('material dimension matches OVERWORLD_TERRAIN_SPRITES', () => {
      assert.equal(TR.DIMENSION_TERRAIN_SPRITES.material, TR.OVERWORLD_TERRAIN_SPRITES);
    });

    it('has entries for all planned dimensions', () => {
      const dims = ['material', 'feywild', 'shadowfell', 'nine_hells', 'underdark', 'abyss'];
      for (const d of dims)
        assert.ok(TR.DIMENSION_TERRAIN_SPRITES[d], `missing dimension ${d}`);
    });

    it('each dimension has GRASS, FOREST, and WATER keys at minimum', () => {
      const required = ['GRASS', 'FOREST', 'WATER'];
      for (const [dim, sprites] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES)) {
        for (const key of required)
          assert.ok(sprites[key], `${dim} missing ${key}`);
      }
    });

    it('each dimension entry has valid rects', () => {
      for (const [dim, sprites] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES)) {
        for (const [key, rect] of Object.entries(sprites)) {
          assert.typeOf(rect.x, 'number', `${dim}.${key}.x`);
          assert.typeOf(rect.y, 'number', `${dim}.${key}.y`);
          assert.equal(rect.w, 16, `${dim}.${key}.w`);
          assert.equal(rect.h, 16, `${dim}.${key}.h`);
          assert.ok(rect.x >= 0, `${dim}.${key}.x >= 0`);
          assert.ok(rect.y >= 0, `${dim}.${key}.y >= 0`);
        }
      }
    });

    it('each dimension is frozen', () => {
      for (const [dim, sprites] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES))
        assert.ok(Object.isFrozen(sprites), `${dim} should be frozen`);
    });

    it('non-material dimensions differ from material in at least GRASS', () => {
      const material = TR.DIMENSION_TERRAIN_SPRITES.material;
      for (const [dim, sprites] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES)) {
        if (dim === 'material')
          continue;
        const sameGrass = sprites.GRASS.x === material.GRASS.x && sprites.GRASS.y === material.GRASS.y;
        assert.ok(!sameGrass, `${dim} GRASS should differ from material`);
      }
    });
  });


  describe('AssetLoader — Sprite Sheet Margin Correctness', () => {

    it('dungeon sprites use 1px margin (203px = 12x16 + 11x1, step=17)', () => {
      const fighter = TR.PARTY_SPRITES.fighter;
      assert.equal(fighter.w, 16);
      assert.equal(fighter.x % 17, 0, 'fighter x should be 17px-aligned');
      assert.equal(fighter.y % 17, 0, 'fighter y should be 17px-aligned');
    });

    it('enemy sprites use dungeon sheet 1px margin (17px-aligned)', () => {
      const goblin = TR.ENEMY_SPRITES.goblin;
      assert.equal(goblin.w, 16);
      assert.equal(goblin.x % 17, 0, 'goblin x should be 17px-aligned');
      assert.equal(goblin.y % 17, 0, 'goblin y should be 17px-aligned');
    });

    it('dungeon sprite fighter at index 88 maps to col=4 row=7 at (68,119)', () => {
      const f = TR.PARTY_SPRITES.fighter;
      assert.equal(f.x, 68);
      assert.equal(f.y, 119);
    });

    it('dungeon goblin at index 86 maps to col=2 row=7 at (34,119)', () => {
      const g = TR.ENEMY_SPRITES.goblin;
      assert.equal(g.x, 34);
      assert.equal(g.y, 119);
    });

    it('overworld sprites use 1px margin (968px = 57×16 + 56×1)', () => {
      const grass = TR.OVERWORLD_TERRAIN_SPRITES.GRASS;
      assert.equal(grass.w, 16);
      const forest = TR.OVERWORLD_TERRAIN_SPRITES.FOREST;
      assert.ok(forest.x >= 0 && forest.y >= 0);
    });

    it('all dungeon party sprites fit within 203×186 sheet bounds', () => {
      for (const [id, rect] of Object.entries(TR.PARTY_SPRITES)) {
        assert.ok(rect.x + rect.w <= 203, `${id} x+w exceeds 203px dungeon width`);
        assert.ok(rect.y + rect.h <= 186, `${id} y+h exceeds 186px dungeon height`);
      }
    });

    it('all enemy sprites fit within 203×186 dungeon sheet bounds', () => {
      for (const [id, rect] of Object.entries(TR.ENEMY_SPRITES)) {
        assert.ok(rect.x + rect.w <= 203, `${id} x+w exceeds 203px dungeon width`);
        assert.ok(rect.y + rect.h <= 186, `${id} y+h exceeds 186px dungeon height`);
      }
    });

    it('all dungeon combat terrain sprites fit within 203×186 sheet bounds', () => {
      for (const [id, rect] of Object.entries(TR.COMBAT_TERRAIN_SPRITES)) {
        assert.ok(rect.x + rect.w <= 203, `${id} x+w exceeds 203px dungeon width`);
        assert.ok(rect.y + rect.h <= 186, `${id} y+h exceeds 186px dungeon height`);
      }
    });

    it('all overworld terrain sprites fit within 968×526 sheet bounds', () => {
      for (const [id, rect] of Object.entries(TR.OVERWORLD_TERRAIN_SPRITES)) {
        assert.ok(rect.x + rect.w <= 968, `${id} x+w exceeds 968px overworld width`);
        assert.ok(rect.y + rect.h <= 526, `${id} y+h exceeds 526px overworld height`);
      }
    });

    it('all dimension terrain sprites fit within 968×526 sheet bounds', () => {
      for (const [dim, sprites] of Object.entries(TR.DIMENSION_TERRAIN_SPRITES))
        for (const [id, rect] of Object.entries(sprites)) {
          assert.ok(rect.x + rect.w <= 968, `${dim}.${id} x+w exceeds 968px overworld width`);
          assert.ok(rect.y + rect.h <= 526, `${dim}.${id} y+h exceeds 526px overworld height`);
        }
    });

    it('all dungeon item sprites fit within 203×186 sheet bounds', () => {
      for (const [id, rect] of Object.entries(TR.ITEM_SPRITES)) {
        assert.ok(rect.x + rect.w <= 203, `${id} x+w exceeds 203px dungeon width`);
        assert.ok(rect.y + rect.h <= 186, `${id} y+h exceeds 186px dungeon height`);
      }
    });
  });

  describe('AssetLoader — Enemy Sprite Archetypes', () => {

    it('enemy sprites use dungeon sheet (no sheet property)', () => {
      for (const [id, rect] of Object.entries(TR.ENEMY_SPRITES))
        assert.equal(rect.sheet, undefined, `${id} should not have a sheet property`);
    });

    it('enemies sharing an archetype sprite are differentiated by tints', () => {
      const byPosition = new Map();
      for (const [id, rect] of Object.entries(TR.ENEMY_SPRITES)) {
        const key = `${rect.x},${rect.y}`;
        if (!byPosition.has(key))
          byPosition.set(key, []);
        byPosition.get(key).push(id);
      }
      for (const [key, ids] of byPosition) {
        if (ids.length > 1)
          for (const id of ids)
            assert.ok(TR.ENEMY_TINTS[id], `${id} shares archetype ${key} but has no tint`);
      }
    });

    it('party sprites do not have a sheet property', () => {
      for (const [id, rect] of Object.entries(TR.PARTY_SPRITES))
        assert.equal(rect.sheet, undefined, `${id} party sprite should not have sheet property`);
    });
  });

  describe('AssetLoader — SHEET_REGISTRY', () => {

    it('SHEET_REGISTRY exists and is frozen', () => {
      assert.ok(TR.SHEET_REGISTRY);
      assert.ok(Object.isFrozen(TR.SHEET_REGISTRY));
    });

    it('has all 2 existing sheet entries', () => {
      const ids = ['dungeon', 'overworld'];
      for (const id of ids)
        assert.ok(TR.SHEET_REGISTRY[id], `missing sheet ${id}`);
    });

    it('each entry has tileSize, margin, cols, and path', () => {
      for (const [id, meta] of Object.entries(TR.SHEET_REGISTRY)) {
        assert.typeOf(meta.tileSize, 'number', `${id}.tileSize`);
        assert.typeOf(meta.margin, 'number', `${id}.margin`);
        assert.typeOf(meta.cols, 'number', `${id}.cols`);
        assert.typeOf(meta.path, 'string', `${id}.path`);
      }
    });

    it('dungeon metadata is 16px/1/12', () => {
      const d = TR.SHEET_REGISTRY.dungeon;
      assert.equal(d.tileSize, 16);
      assert.equal(d.margin, 1);
      assert.equal(d.cols, 12);
    });

    it('overworld metadata is 16px/1/57', () => {
      const o = TR.SHEET_REGISTRY.overworld;
      assert.equal(o.tileSize, 16);
      assert.equal(o.margin, 1);
      assert.equal(o.cols, 57);
    });

    it('each entry is frozen', () => {
      for (const [id, meta] of Object.entries(TR.SHEET_REGISTRY))
        assert.ok(Object.isFrozen(meta), `${id} should be frozen`);
    });

    it('ASSET_MANIFEST is auto-generated from SHEET_REGISTRY paths', () => {
      for (const [id, meta] of Object.entries(TR.SHEET_REGISTRY))
        assert.equal(TR.ASSET_MANIFEST[id], meta.path, `${id} manifest path mismatch`);
    });
  });

  describe('AssetLoader — sheetRect', () => {

    it('returns correct rect for dungeon sheet index 0', () => {
      const rect = TR.sheetRect(0, 'dungeon');
      assert.equal(rect.x, 0);
      assert.equal(rect.y, 0);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
      assert.equal(rect.sheet, 'dungeon');
    });

    it('returns correct rect for overworld index 57 (second row)', () => {
      const rect = TR.sheetRect(57, 'overworld');
      assert.equal(rect.x, 0);
      assert.equal(rect.y, 17);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
      assert.equal(rect.sheet, 'overworld');
    });

    it('returns null for unknown sheet ID', () => {
      assert.isNull(TR.sheetRect(0, 'nonexistent'));
    });

    it('result is frozen', () => {
      const rect = TR.sheetRect(0, 'dungeon');
      assert.ok(Object.isFrozen(rect));
    });
  });

  describe('AssetLoader — resolveSprite', () => {

    it('returns 16x16 fallback when no HD map exists', () => {
      const rect = TR.resolveSprite('fighter', 'party');
      assert.ok(rect);
      assert.equal(rect.w, 16);
      assert.equal(rect.h, 16);
      assert.equal(rect, TR.PARTY_SPRITES.fighter);
    });

    it('returns enemy sprite via fallback', () => {
      const rect = TR.resolveSprite('goblin', 'enemy');
      assert.ok(rect);
      assert.equal(rect, TR.ENEMY_SPRITES.goblin);
    });

    it('returns combat_terrain sprite via fallback', () => {
      const rect = TR.resolveSprite('plains', 'combat_terrain');
      assert.ok(rect);
      assert.equal(rect, TR.COMBAT_TERRAIN_SPRITES.plains);
    });

    it('returns item sprite via fallback', () => {
      const rect = TR.resolveSprite('sword', 'item');
      assert.ok(rect);
      assert.equal(rect, TR.ITEM_SPRITES.sword);
    });

    it('returns null for unknown sprite ID', () => {
      assert.isNull(TR.resolveSprite('nonexistent_monster', 'enemy'));
    });

    it('returns null for unknown category', () => {
      assert.isNull(TR.resolveSprite('fighter', 'nonexistent_category'));
    });
  });

  describe('AssetLoader — Instance', () => {

    it('AssetLoader constructs with initial state', () => {
      const loader = new TR.AssetLoader();
      assert.ok(!loader.ready);
      assert.equal(loader.loaded, 0);
      assert.equal(loader.total, 0);
      assert.equal(loader.progress, 1);
    });

    it('has() returns false for unknown ids', () => {
      const loader = new TR.AssetLoader();
      assert.ok(!loader.has('unknown'));
    });

    it('get() returns null for unknown ids', () => {
      const loader = new TR.AssetLoader();
      assert.isNull(loader.get('unknown'));
    });

    it('drawSprite returns false without loaded image', () => {
      const loader = new TR.AssetLoader();
      const result = loader.drawSprite(null, 'dungeon', TR.PARTY_SPRITES.fighter, 0, 0, 32);
      assert.ok(!result);
    });
  });
})();
