;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  const _map = new Map();
  for (const entry of (TR._pending?.items || []))
    _map.set(entry.id, Object.freeze(entry));
  if (TR._pending) delete TR._pending.items;

  // Indexes
  const _byCategory = new Map();
  const _bySlot = new Map();
  const _byProficiency = new Map();

  for (const item of _map.values()) {
    // By category
    if (!_byCategory.has(item.category))
      _byCategory.set(item.category, []);
    _byCategory.get(item.category).push(item);

    // By slot
    if (item.slot) {
      if (!_bySlot.has(item.slot))
        _bySlot.set(item.slot, []);
      _bySlot.get(item.slot).push(item);
    }

    // By proficiency
    if (item.proficiency) {
      if (!_byProficiency.has(item.proficiency))
        _byProficiency.set(item.proficiency, []);
      _byProficiency.get(item.proficiency).push(item);
    }
  }

  // Equipment slots
  const EQUIPMENT_SLOTS = Object.freeze([
    'head', 'face', 'neck', 'shoulders', 'body', 'torso',
    'arms', 'hands', 'ring1', 'ring2', 'waist', 'feet',
    'mainHand', 'offHand',
  ]);

  function emptyEquipment() {
    const eq = {};
    for (const slot of EQUIPMENT_SLOTS)
      eq[slot] = null;
    return eq;
  }

  // Treasure tables (CR-indexed, D&D 3.5e DMG Table 3-5 approximation)
  const TREASURE_BY_CR = Object.freeze([
    /* CR 0  */ { coins: 0, goods: 0, items: 0 },
    /* CR 1  */ { coins: 300, goods: 0.1, items: 0.05 },
    /* CR 2  */ { coins: 600, goods: 0.15, items: 0.08 },
    /* CR 3  */ { coins: 900, goods: 0.2, items: 0.1 },
    /* CR 4  */ { coins: 1200, goods: 0.25, items: 0.15 },
    /* CR 5  */ { coins: 1600, goods: 0.3, items: 0.2 },
    /* CR 6  */ { coins: 2000, goods: 0.35, items: 0.25 },
    /* CR 7  */ { coins: 2600, goods: 0.4, items: 0.3 },
    /* CR 8  */ { coins: 3400, goods: 0.5, items: 0.35 },
    /* CR 9  */ { coins: 4500, goods: 0.55, items: 0.4 },
    /* CR 10 */ { coins: 5800, goods: 0.6, items: 0.45 },
    /* CR 11 */ { coins: 7500, goods: 0.65, items: 0.5 },
    /* CR 12 */ { coins: 9800, goods: 0.7, items: 0.55 },
    /* CR 13 */ { coins: 13000, goods: 0.75, items: 0.6 },
    /* CR 14 */ { coins: 17000, goods: 0.8, items: 0.65 },
    /* CR 15 */ { coins: 22000, goods: 0.85, items: 0.7 },
    /* CR 16 */ { coins: 28000, goods: 0.85, items: 0.75 },
    /* CR 17 */ { coins: 36000, goods: 0.9, items: 0.8 },
    /* CR 18 */ { coins: 47000, goods: 0.9, items: 0.85 },
    /* CR 19 */ { coins: 61000, goods: 0.95, items: 0.9 },
    /* CR 20 */ { coins: 80000, goods: 0.95, items: 0.95 },
  ]);

  function generateTreasure(prng, cr) {
    const idx = Math.min(Math.max(0, Math.round(cr)), TREASURE_BY_CR.length - 1);
    const table = TREASURE_BY_CR[idx];
    const gold = Math.round(table.coins * (0.5 + prng.next()));
    const loot = [];

    // Chance to drop items by category
    const categories = ['weapon', 'armor', 'potion', 'ring', 'wondrous'];
    for (const cat of categories) {
      if (prng.next() < table.items) {
        const pool = _byCategory.get(cat);
        if (pool && pool.length > 0) {
          const maxCost = table.coins * 2;
          const affordable = pool.filter(i => (i.cost || 0) <= maxCost);
          if (affordable.length > 0)
            loot.push(affordable[prng.nextInt(0, affordable.length - 1)]);
        }
      }
    }

    return { gold, loot };
  }

  TR.ItemRegistry = Object.freeze({
    get: id => _map.get(id),
    getAll: () => [..._map.values()],
    has: id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    count: () => _map.size,

    byCategory: cat => _byCategory.get(cat) || [],
    bySlot: slot => _bySlot.get(slot) || [],
    byProficiency: prof => _byProficiency.get(prof) || [],
    weapons: () => _byCategory.get('weapon') || [],
    armor: () => _byCategory.get('armor') || [],
    shields: () => _byCategory.get('shield') || [],
    potions: () => _byCategory.get('potion') || [],

    EQUIPMENT_SLOTS,
    emptyEquipment,
    generateTreasure,
  });
})();
