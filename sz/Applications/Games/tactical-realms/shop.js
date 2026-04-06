;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { Items, ItemCategory, ITEM_TEMPLATES, CONSUMABLE_TEMPLATES, LOOT_TIERS } = TR;

  // --- Shop type definitions ---

  const ShopType = Object.freeze({
    GENERAL:     'general',
    WEAPONSMITH: 'weaponsmith',
    ARMORER:     'armorer',
    TRAINER:     'trainer',
  });

  const SHOP_CONFIGS = Object.freeze({
    [ShopType.GENERAL]: Object.freeze({
      name: 'General Store',
      categories: Object.freeze([ItemCategory.CONSUMABLE]),
      slots: 8,
    }),
    [ShopType.WEAPONSMITH]: Object.freeze({
      name: 'Weaponsmith',
      categories: Object.freeze([ItemCategory.WEAPON, ItemCategory.ACCESSORY]),
      slots: 6,
    }),
    [ShopType.ARMORER]: Object.freeze({
      name: 'Armorer',
      categories: Object.freeze([ItemCategory.ARMOR, ItemCategory.SHIELD]),
      slots: 6,
    }),
    [ShopType.TRAINER]: Object.freeze({
      name: 'Trainer',
      categories: Object.freeze([]),
      slots: 0,
    }),
  });

  // --- Tier selection based on party level ---

  function _partyTierIndex(partyLevel) {
    if (partyLevel <= 2) return 0;
    if (partyLevel <= 4) return 1;
    if (partyLevel <= 6) return 2;
    if (partyLevel <= 8) return 3;
    return 4;
  }

  function _pickShopTier(prng, partyLevel) {
    const weights = LOOT_TIERS[_partyTierIndex(partyLevel)];
    let roll = prng.nextInt(1, 100);
    for (let i = 0; i < weights.length; ++i) {
      roll -= weights[i];
      if (roll <= 0)
        return i + 1;
    }
    return 1;
  }

  // --- Stock generation ---

  function generateStock(prng, shopType, partyLevel) {
    const config = SHOP_CONFIGS[shopType];
    if (!config || config.slots === 0)
      return [];

    const stock = [];
    const categories = config.categories;

    for (let i = 0; i < config.slots; ++i) {
      const cat = categories[prng.nextInt(0, categories.length - 1)];
      const tier = cat === ItemCategory.CONSUMABLE ? 0 : _pickShopTier(prng, partyLevel);

      let pool;
      if (cat === ItemCategory.CONSUMABLE)
        pool = Object.keys(CONSUMABLE_TEMPLATES);
      else
        pool = Object.keys(ITEM_TEMPLATES).filter(k => ITEM_TEMPLATES[k].category === cat);

      if (pool.length === 0)
        continue;

      const tmplId = pool[prng.nextInt(0, pool.length - 1)];

      let affix = null;
      if (cat !== ItemCategory.CONSUMABLE && tier >= 2 && prng.nextInt(1, 100) <= 20 + partyLevel * 5) {
        const eligible = Object.keys(TR.AFFIXES).filter(k => {
          const a = TR.AFFIXES[k];
          return a.tierMin <= tier && a.appliesTo.includes(cat);
        });
        if (eligible.length > 0)
          affix = eligible[prng.nextInt(0, eligible.length - 1)];
      }

      const item = Items.createItem(tmplId, tier || undefined, affix);
      if (item)
        stock.push(item);
    }

    return stock;
  }

  // --- Buy/sell price calculations ---

  const SELL_RATIO = 0.5;

  function buyPrice(item) {
    if (!item) return 0;
    return item.value;
  }

  function sellPrice(item) {
    if (!item) return 0;
    return Math.max(1, Math.floor(item.value * SELL_RATIO));
  }

  // --- Buy transaction ---

  function buyItem(stock, itemId, gold) {
    const idx = stock.findIndex(i => i.id === itemId);
    if (idx === -1)
      return null;
    const item = stock[idx];
    const cost = buyPrice(item);
    if (gold < cost)
      return null;
    const newStock = stock.filter((_, i) => i !== idx);
    return { item, cost, newStock, newGold: gold - cost };
  }

  // --- Sell transaction ---

  function sellItem(inventory, itemId, gold) {
    const idx = inventory.findIndex(i => i.id === itemId);
    if (idx === -1)
      return null;
    const item = inventory[idx];
    const price = sellPrice(item);
    const newInventory = Items.removeFromInventory(inventory, itemId, 1);
    return { item, price, newInventory, newGold: gold + price };
  }

  // --- Training costs (level-up at trainer) ---

  function trainingCost(characterLevel) {
    return 50 * characterLevel;
  }

  function canTrain(character, xp, gold) {
    if (!character) return false;
    const needed = trainingCost(character.level);
    return gold >= needed && xp >= character.level * 100;
  }

  // --- Exports ---

  TR.ShopType = ShopType;
  TR.SHOP_CONFIGS = SHOP_CONFIGS;

  TR.Shop = Object.freeze({
    generateStock,
    buyPrice,
    sellPrice,
    buyItem,
    sellItem,
    trainingCost,
    canTrain,
    SELL_RATIO,
  });
})();
