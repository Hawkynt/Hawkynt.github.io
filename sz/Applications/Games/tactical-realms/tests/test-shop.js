;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { Shop, ShopType, SHOP_CONFIGS, Items, PRNG, Character } = window.SZ.TacticalRealms;

  describe('Shop — ShopType & SHOP_CONFIGS', () => {

    it('ShopType has all expected types', () => {
      assert.equal(ShopType.GENERAL, 'general');
      assert.equal(ShopType.WEAPONSMITH, 'weaponsmith');
      assert.equal(ShopType.ARMORER, 'armorer');
      assert.equal(ShopType.TRAINER, 'trainer');
    });

    it('SHOP_CONFIGS exists for every ShopType', () => {
      for (const type of Object.values(ShopType))
        assert.ok(SHOP_CONFIGS[type], `missing config for ${type}`);
    });

    it('each config has name, categories, and slots', () => {
      for (const [type, cfg] of Object.entries(SHOP_CONFIGS)) {
        assert.typeOf(cfg.name, 'string', `${type} name`);
        assert.isArray(cfg.categories, `${type} categories`);
        assert.typeOf(cfg.slots, 'number', `${type} slots`);
      }
    });

    it('trainer config has 0 slots', () => {
      assert.equal(SHOP_CONFIGS[ShopType.TRAINER].slots, 0);
    });
  });

  describe('Shop — generateStock', () => {

    it('returns an array', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.GENERAL, 3);
      assert.isArray(stock);
    });

    it('general stock contains consumables', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.GENERAL, 3);
      assert.greaterThan(stock.length, 0);
      for (const item of stock)
        assert.equal(item.category, 'consumable');
    });

    it('weaponsmith stock contains weapons or accessories', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.WEAPONSMITH, 3);
      assert.greaterThan(stock.length, 0);
      for (const item of stock)
        assert.ok(item.category === 'weapon' || item.category === 'accessory', `unexpected category ${item.category}`);
    });

    it('armorer stock contains armor or shields', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.ARMORER, 3);
      assert.greaterThan(stock.length, 0);
      for (const item of stock)
        assert.ok(item.category === 'armor' || item.category === 'shield', `unexpected category ${item.category}`);
    });

    it('trainer returns empty stock', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.TRAINER, 5);
      assert.equal(stock.length, 0);
    });

    it('stock items have valid fields', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.WEAPONSMITH, 5);
      for (const item of stock) {
        assert.ok(item.id, 'item should have id');
        assert.ok(item.name, 'item should have name');
        assert.typeOf(item.value, 'number', 'item value');
        assert.greaterThan(item.value, 0, 'item value should be positive');
      }
    });

    it('different seeds produce different stock', () => {
      const a = Shop.generateStock(new PRNG(1), ShopType.GENERAL, 3);
      const b = Shop.generateStock(new PRNG(999), ShopType.GENERAL, 3);
      const aNames = a.map(i => i.name).join(',');
      const bNames = b.map(i => i.name).join(',');
      assert.ok(aNames !== bNames || a.length !== b.length, 'different seeds should usually produce different stock');
    });

    it('higher party level can produce higher tier items', () => {
      let maxTier = 0;
      for (let seed = 0; seed < 200; ++seed) {
        const stock = Shop.generateStock(new PRNG(seed), ShopType.WEAPONSMITH, 9);
        for (const item of stock)
          if (item.tier > maxTier)
            maxTier = item.tier;
      }
      assert.greaterThan(maxTier, 1, 'high-level shop should stock tier > 1');
    });

    it('stock respects slot count', () => {
      const stock = Shop.generateStock(new PRNG(42), ShopType.GENERAL, 3);
      assert.ok(stock.length <= SHOP_CONFIGS[ShopType.GENERAL].slots);
    });
  });

  describe('Shop — buyPrice / sellPrice', () => {

    it('buyPrice returns item value', () => {
      const item = Items.createItem('short_sword');
      assert.equal(Shop.buyPrice(item), item.value);
    });

    it('sellPrice returns ~50% of value', () => {
      const item = Items.createItem('chain_mail');
      const sell = Shop.sellPrice(item);
      assert.equal(sell, Math.max(1, Math.floor(item.value * Shop.SELL_RATIO)));
    });

    it('sellPrice is at least 1', () => {
      const cheapItem = Items.createItem('healing_potion');
      assert.ok(Shop.sellPrice(cheapItem) >= 1);
    });

    it('buyPrice returns 0 for null', () => {
      assert.equal(Shop.buyPrice(null), 0);
    });

    it('sellPrice returns 0 for null', () => {
      assert.equal(Shop.sellPrice(null), 0);
    });

    it('SELL_RATIO is 0.5', () => {
      assert.equal(Shop.SELL_RATIO, 0.5);
    });
  });

  describe('Shop — buyItem', () => {

    it('buys an item from stock', () => {
      const stock = [Items.createItem('short_sword'), Items.createItem('dagger')];
      const result = Shop.buyItem(stock, stock[0].id, 100);
      assert.ok(result, 'should succeed');
      assert.equal(result.item.id, stock[0].id);
      assert.equal(result.newGold, 100 - stock[0].value);
      assert.equal(result.newStock.length, 1);
    });

    it('returns null if not enough gold', () => {
      const stock = [Items.createItem('plate_armor')];
      assert.isNull(Shop.buyItem(stock, stock[0].id, 1));
    });

    it('returns null if item not in stock', () => {
      const stock = [Items.createItem('short_sword')];
      assert.isNull(Shop.buyItem(stock, 'nonexistent', 1000));
    });

    it('removes purchased item from stock', () => {
      const stock = [Items.createItem('short_sword'), Items.createItem('dagger')];
      const result = Shop.buyItem(stock, stock[0].id, 1000);
      assert.equal(result.newStock.length, 1);
      assert.ok(!result.newStock.some(i => i.id === stock[0].id));
    });

    it('exact gold suffices', () => {
      const item = Items.createItem('dagger');
      const stock = [item];
      const result = Shop.buyItem(stock, item.id, item.value);
      assert.ok(result);
      assert.equal(result.newGold, 0);
    });
  });

  describe('Shop — sellItem', () => {

    it('sells an item from inventory', () => {
      const item = Items.createItem('short_sword');
      const inventory = [item];
      const result = Shop.sellItem(inventory, item.id, 50);
      assert.ok(result);
      assert.equal(result.price, Shop.sellPrice(item));
      assert.equal(result.newGold, 50 + Shop.sellPrice(item));
      assert.equal(result.newInventory.length, 0);
    });

    it('returns null for missing item', () => {
      assert.isNull(Shop.sellItem([], 'nonexistent', 100));
    });

    it('sells stackable consumable (decrements quantity)', () => {
      let item = Items.createItem('healing_potion');
      item = Object.freeze({ ...item, quantity: 3 });
      const inventory = [item];
      const result = Shop.sellItem(inventory, item.id, 0);
      assert.ok(result);
      assert.equal(result.newInventory.length, 1);
      assert.equal(result.newInventory[0].quantity, 2);
    });
  });

  describe('Shop — Training', () => {

    it('trainingCost scales with level', () => {
      assert.equal(Shop.trainingCost(1), 50);
      assert.equal(Shop.trainingCost(3), 150);
      assert.equal(Shop.trainingCost(5), 250);
    });

    it('canTrain returns true with enough xp and gold', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'Test', 1, prng);
      assert.ok(Shop.canTrain(char, 200, 200));
    });

    it('canTrain returns false with insufficient gold', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'Test', 3, prng);
      assert.ok(!Shop.canTrain(char, 1000, 10));
    });

    it('canTrain returns false with insufficient xp', () => {
      const prng = new PRNG(42);
      const char = Character.createCharacter('human', 'fighter', 'Test', 3, prng);
      assert.ok(!Shop.canTrain(char, 0, 1000));
    });

    it('canTrain returns false for null character', () => {
      assert.ok(!Shop.canTrain(null, 1000, 1000));
    });
  });
})();
