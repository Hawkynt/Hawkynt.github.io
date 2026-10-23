;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // --- Item categories and equipment slots ---

  const ItemCategory = Object.freeze({
    WEAPON:     'weapon',
    ARMOR:      'armor',
    SHIELD:     'shield',
    ACCESSORY:  'accessory',
    CONSUMABLE: 'consumable',
  });

  const EquipSlot = Object.freeze({
    MAIN_HAND: 'mainHand',
    OFF_HAND:  'offHand',
    BODY:      'body',
    ACCESSORY: 'accessory',
  });

  // --- Item tiers (1 = common … 6 = legendary) ---

  const ItemTier = Object.freeze({
    COMMON:    1,
    UNCOMMON:  2,
    RARE:      3,
    EPIC:      4,
    LEGENDARY: 5,
    MYTHIC:    6,
  });

  const TIER_NAMES = Object.freeze([
    '', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic',
  ]);

  const TIER_COLORS = Object.freeze([
    '', '#aaa', '#5f5', '#55f', '#c5f', '#fa0', '#f55',
  ]);

  // --- Stat bonus keys used by equipment ---

  const EMPTY_STATS = Object.freeze({
    attack: 0, damage: 0, ac: 0,
    maxHp: 0, maxMp: 0,
    fortSave: 0, refSave: 0, willSave: 0,
  });

  function _stats(overrides) {
    return Object.freeze({ ...EMPTY_STATS, ...overrides });
  }

  // --- Weapon, armor, shield, accessory templates ---

  const ITEM_TEMPLATES = Object.freeze({
    // Weapons — slot: mainHand
    short_sword: Object.freeze({
      name: 'Short Sword', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 1, damageDice: 1, damageSides: 6, critRange: [20], critMult: 2,
      stats: _stats({ attack: 0 }), value: 10,
    }),
    dagger: Object.freeze({
      name: 'Dagger', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 1, damageDice: 1, damageSides: 4, critRange: [19, 20], critMult: 2,
      stats: _stats({ attack: 1 }), value: 5,
    }),
    mace: Object.freeze({
      name: 'Mace', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 1, damageDice: 1, damageSides: 8, critRange: [20], critMult: 2,
      stats: _stats({}), value: 12,
    }),
    staff: Object.freeze({
      name: 'Quarterstaff', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 1, damageDice: 1, damageSides: 6, critRange: [20], critMult: 2,
      stats: _stats({ maxMp: 2 }), value: 8,
    }),
    longsword: Object.freeze({
      name: 'Longsword', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 2, damageDice: 1, damageSides: 8, critRange: [19, 20], critMult: 2,
      stats: _stats({ attack: 1 }), value: 30,
    }),
    warhammer: Object.freeze({
      name: 'Warhammer', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 2, damageDice: 1, damageSides: 10, critRange: [20], critMult: 3,
      stats: _stats({}), value: 35,
    }),
    greataxe: Object.freeze({
      name: 'Greataxe', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 3, damageDice: 1, damageSides: 12, critRange: [20], critMult: 3,
      stats: _stats({ attack: 1, damage: 1 }), value: 60,
    }),
    greatsword: Object.freeze({
      name: 'Greatsword', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 3, damageDice: 2, damageSides: 6, critRange: [19, 20], critMult: 2,
      stats: _stats({ attack: 2 }), value: 65,
    }),
    flail: Object.freeze({
      name: 'Flail', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 2, damageDice: 1, damageSides: 8, critRange: [20], critMult: 2,
      stats: _stats({ damage: 1 }), value: 28,
    }),
    rapier: Object.freeze({
      name: 'Rapier', category: ItemCategory.WEAPON, slot: EquipSlot.MAIN_HAND,
      tier: 2, damageDice: 1, damageSides: 6, critRange: [18, 19, 20], critMult: 2,
      stats: _stats({ attack: 2 }), value: 32,
    }),

    // Armor — slot: body
    leather_armor: Object.freeze({
      name: 'Leather Armor', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 1, stats: _stats({ ac: 2 }), value: 10,
    }),
    studded_leather: Object.freeze({
      name: 'Studded Leather', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 1, stats: _stats({ ac: 3 }), value: 20,
    }),
    chain_shirt: Object.freeze({
      name: 'Chain Shirt', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 2, stats: _stats({ ac: 4 }), value: 40,
    }),
    scale_mail: Object.freeze({
      name: 'Scale Mail', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 2, stats: _stats({ ac: 5 }), value: 50,
    }),
    chain_mail: Object.freeze({
      name: 'Chain Mail', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 3, stats: _stats({ ac: 6 }), value: 80,
    }),
    plate_armor: Object.freeze({
      name: 'Plate Armor', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 4, stats: _stats({ ac: 8 }), value: 200,
    }),
    robe: Object.freeze({
      name: 'Robe', category: ItemCategory.ARMOR, slot: EquipSlot.BODY,
      tier: 1, stats: _stats({ ac: 1, maxMp: 3 }), value: 8,
    }),

    // Shields — slot: offHand
    buckler: Object.freeze({
      name: 'Buckler', category: ItemCategory.SHIELD, slot: EquipSlot.OFF_HAND,
      tier: 1, stats: _stats({ ac: 1 }), value: 5,
    }),
    round_shield: Object.freeze({
      name: 'Round Shield', category: ItemCategory.SHIELD, slot: EquipSlot.OFF_HAND,
      tier: 2, stats: _stats({ ac: 2 }), value: 15,
    }),
    tower_shield: Object.freeze({
      name: 'Tower Shield', category: ItemCategory.SHIELD, slot: EquipSlot.OFF_HAND,
      tier: 3, stats: _stats({ ac: 3, attack: -2 }), value: 30,
    }),

    // Accessories — slot: accessory
    ring_of_protection: Object.freeze({
      name: 'Ring of Protection', category: ItemCategory.ACCESSORY, slot: EquipSlot.ACCESSORY,
      tier: 2, stats: _stats({ ac: 1 }), value: 50,
    }),
    amulet_of_health: Object.freeze({
      name: 'Amulet of Health', category: ItemCategory.ACCESSORY, slot: EquipSlot.ACCESSORY,
      tier: 2, stats: _stats({ maxHp: 5 }), value: 45,
    }),
    cloak_of_resistance: Object.freeze({
      name: 'Cloak of Resistance', category: ItemCategory.ACCESSORY, slot: EquipSlot.ACCESSORY,
      tier: 3, stats: _stats({ fortSave: 1, refSave: 1, willSave: 1 }), value: 80,
    }),
    ring_of_power: Object.freeze({
      name: 'Ring of Power', category: ItemCategory.ACCESSORY, slot: EquipSlot.ACCESSORY,
      tier: 3, stats: _stats({ maxMp: 5, damage: 1 }), value: 75,
    }),
    boots_of_speed: Object.freeze({
      name: 'Boots of Speed', category: ItemCategory.ACCESSORY, slot: EquipSlot.ACCESSORY,
      tier: 4, stats: _stats({ refSave: 2, attack: 1 }), value: 120,
    }),
    amulet_of_fortitude: Object.freeze({
      name: 'Amulet of Fortitude', category: ItemCategory.ACCESSORY, slot: EquipSlot.ACCESSORY,
      tier: 4, stats: _stats({ maxHp: 10, fortSave: 2 }), value: 130,
    }),
  });

  // --- Consumable templates ---

  const CONSUMABLE_TEMPLATES = Object.freeze({
    healing_potion: Object.freeze({
      name: 'Healing Potion', category: ItemCategory.CONSUMABLE,
      tier: 1, stackable: true, maxStack: 99, value: 15,
      effect: Object.freeze({ type: 'heal', dice: 2, sides: 8, flat: 0 }),
    }),
    greater_healing_potion: Object.freeze({
      name: 'Greater Healing Potion', category: ItemCategory.CONSUMABLE,
      tier: 3, stackable: true, maxStack: 99, value: 50,
      effect: Object.freeze({ type: 'heal', dice: 4, sides: 8, flat: 4 }),
    }),
    mana_potion: Object.freeze({
      name: 'Mana Potion', category: ItemCategory.CONSUMABLE,
      tier: 1, stackable: true, maxStack: 99, value: 20,
      effect: Object.freeze({ type: 'restoreMp', dice: 2, sides: 6, flat: 0 }),
    }),
    greater_mana_potion: Object.freeze({
      name: 'Greater Mana Potion', category: ItemCategory.CONSUMABLE,
      tier: 3, stackable: true, maxStack: 99, value: 60,
      effect: Object.freeze({ type: 'restoreMp', dice: 4, sides: 6, flat: 4 }),
    }),
    antidote: Object.freeze({
      name: 'Antidote', category: ItemCategory.CONSUMABLE,
      tier: 1, stackable: true, maxStack: 99, value: 10,
      effect: Object.freeze({ type: 'cure', condition: 'poison' }),
    }),
    strength_elixir: Object.freeze({
      name: 'Strength Elixir', category: ItemCategory.CONSUMABLE,
      tier: 2, stackable: true, maxStack: 99, value: 40,
      effect: Object.freeze({ type: 'buff', stat: 'str', bonus: 2, duration: 5 }),
    }),
    scroll_of_fireball: Object.freeze({
      name: 'Scroll of Fireball', category: ItemCategory.CONSUMABLE,
      tier: 3, stackable: true, maxStack: 99, value: 75,
      effect: Object.freeze({ type: 'castSpell', spellId: 'fireball' }),
    }),
  });

  // --- Affixes applied to non-consumable items ---

  const AFFIXES = Object.freeze({
    flaming: Object.freeze({
      name: 'Flaming', prefix: true,
      appliesTo: [ItemCategory.WEAPON],
      bonusDice: 1, bonusSides: 6, element: 'fire',
      tierMin: 2, valueMult: 1.5,
    }),
    frost: Object.freeze({
      name: 'Frost', prefix: true,
      appliesTo: [ItemCategory.WEAPON],
      bonusDice: 1, bonusSides: 4, element: 'cold',
      tierMin: 2, valueMult: 1.4,
    }),
    keen: Object.freeze({
      name: 'Keen', prefix: true,
      appliesTo: [ItemCategory.WEAPON],
      extraCritRange: 1,
      tierMin: 3, valueMult: 1.6,
    }),
    blessed: Object.freeze({
      name: 'Blessed', prefix: false,
      appliesTo: [ItemCategory.ARMOR, ItemCategory.SHIELD],
      statBonus: _stats({ fortSave: 1, refSave: 1, willSave: 1 }),
      tierMin: 2, valueMult: 1.4,
    }),
    fortified: Object.freeze({
      name: 'Fortified', prefix: false,
      appliesTo: [ItemCategory.ARMOR],
      statBonus: _stats({ maxHp: 5 }),
      tierMin: 2, valueMult: 1.3,
    }),
    arcane: Object.freeze({
      name: 'Arcane', prefix: true,
      appliesTo: [ItemCategory.WEAPON, ItemCategory.ARMOR, ItemCategory.ACCESSORY],
      statBonus: _stats({ maxMp: 3 }),
      tierMin: 2, valueMult: 1.3,
    }),
    vicious: Object.freeze({
      name: 'Vicious', prefix: true,
      appliesTo: [ItemCategory.WEAPON],
      statBonus: _stats({ damage: 2 }),
      tierMin: 3, valueMult: 1.5,
    }),
    guardian: Object.freeze({
      name: 'Guardian', prefix: false,
      appliesTo: [ItemCategory.SHIELD, ItemCategory.ARMOR],
      statBonus: _stats({ ac: 1 }),
      tierMin: 3, valueMult: 1.5,
    }),
  });

  // --- Loot tier tables keyed by CR range ---

  const LOOT_TIERS = Object.freeze([
    Object.freeze([75, 25, 0, 0, 0, 0]),   // CR 0-1
    Object.freeze([40, 45, 15, 0, 0, 0]),   // CR 2-3
    Object.freeze([10, 35, 40, 15, 0, 0]),  // CR 4-5
    Object.freeze([0, 15, 35, 35, 15, 0]),  // CR 6-7
    Object.freeze([0, 0, 20, 35, 35, 10]),  // CR 8+
  ]);

  function _lootTierIndex(cr) {
    if (cr <= 1) return 0;
    if (cr <= 3) return 1;
    if (cr <= 5) return 2;
    if (cr <= 7) return 3;
    return 4;
  }

  // --- Unique item instance id counter ---

  let _nextItemId = 1;

  function _genId() {
    return 'item_' + (_nextItemId++);
  }

  // --- Item factory ---

  function createItem(templateId, tierOverride, affix) {
    const tmpl = ITEM_TEMPLATES[templateId] || CONSUMABLE_TEMPLATES[templateId];
    if (!tmpl)
      return null;

    const tier = tierOverride || tmpl.tier;
    const isConsumable = tmpl.category === ItemCategory.CONSUMABLE;

    // Merge base stats with affix stat bonus
    let stats = tmpl.stats || EMPTY_STATS;
    let name = tmpl.name;
    let value = Math.round(tmpl.value * (1 + (tier - tmpl.tier) * 0.3));
    let resolvedAffix = null;

    if (affix && !isConsumable) {
      const affixDef = typeof affix === 'string' ? AFFIXES[affix] : affix;
      if (affixDef && affixDef.appliesTo.includes(tmpl.category) && tier >= affixDef.tierMin) {
        resolvedAffix = affixDef;
        name = affixDef.prefix
          ? affixDef.name + ' ' + tmpl.name
          : tmpl.name + ' of ' + affixDef.name;
        value = Math.round(value * (affixDef.valueMult || 1));
        if (affixDef.statBonus) {
          const merged = {};
          for (const k of Object.keys(EMPTY_STATS))
            merged[k] = (stats[k] || 0) + (affixDef.statBonus[k] || 0);
          stats = Object.freeze(merged);
        }
      }
    }

    // Tier scaling: each tier above base adds a small stat bump
    const tierDelta = tier - tmpl.tier;
    if (tierDelta > 0 && !isConsumable) {
      const scaled = {};
      for (const k of Object.keys(EMPTY_STATS))
        scaled[k] = (stats[k] || 0);
      if (tmpl.category === ItemCategory.WEAPON)
        scaled.damage += tierDelta;
      else if (tmpl.category === ItemCategory.ARMOR || tmpl.category === ItemCategory.SHIELD)
        scaled.ac += Math.floor(tierDelta / 2);
      else
        scaled.maxHp += tierDelta * 2;
      stats = Object.freeze(scaled);
    }

    const item = {
      id: _genId(),
      templateId,
      name,
      category: tmpl.category,
      slot: tmpl.slot || null,
      tier,
      stats,
      value,
      stackable: !!tmpl.stackable,
      quantity: 1,
    };

    // Weapon-specific fields
    if (tmpl.damageDice !== undefined) {
      item.damageDice = tmpl.damageDice;
      item.damageSides = tmpl.damageSides;
      item.critRange = tmpl.critRange ? [...tmpl.critRange] : [20];
      item.critMult = tmpl.critMult || 2;
      if (resolvedAffix) {
        if (resolvedAffix.bonusDice)
          item.affixDamage = { dice: resolvedAffix.bonusDice, sides: resolvedAffix.bonusSides, element: resolvedAffix.element };
        if (resolvedAffix.extraCritRange) {
          const minCrit = Math.min(...item.critRange) - resolvedAffix.extraCritRange;
          for (let c = minCrit; c < Math.min(...item.critRange); ++c)
            if (c >= 1)
              item.critRange.push(c);
          item.critRange.sort((a, b) => a - b);
        }
      }
      Object.freeze(item.critRange);
    }

    // Consumable-specific fields
    if (tmpl.effect)
      item.effect = tmpl.effect;

    if (resolvedAffix)
      item.affix = resolvedAffix.name;

    return Object.freeze(item);
  }

  // --- Loot generation ---

  function _pickTier(prng, cr) {
    const weights = LOOT_TIERS[_lootTierIndex(cr)];
    let roll = prng.nextInt(1, 100);
    for (let i = 0; i < weights.length; ++i) {
      roll -= weights[i];
      if (roll <= 0)
        return i + 1; // tier 1-6
    }
    return 1;
  }

  function _pickTemplate(prng, category) {
    const pool = category === ItemCategory.CONSUMABLE
      ? Object.keys(CONSUMABLE_TEMPLATES)
      : Object.keys(ITEM_TEMPLATES).filter(k => ITEM_TEMPLATES[k].category === category);
    if (pool.length === 0)
      return null;
    return pool[prng.nextInt(0, pool.length - 1)];
  }

  function _pickAffix(prng, tier, category) {
    if (tier < 2 || prng.nextInt(1, 100) > 30 + tier * 10)
      return null;
    const eligible = Object.keys(AFFIXES).filter(k => {
      const a = AFFIXES[k];
      return a.tierMin <= tier && a.appliesTo.includes(category);
    });
    if (eligible.length === 0)
      return null;
    return eligible[prng.nextInt(0, eligible.length - 1)];
  }

  function generateLoot(prng, cr) {
    const drops = [];
    const roll = prng.nextInt(1, 100);

    // Drop chance: 40% nothing, 40% 1 item, 15% 1+consumable, 5% 2 items
    let equipCount = 0;
    let consumableCount = 0;
    if (roll <= 40) {
      return drops; // nothing
    } else if (roll <= 80) {
      equipCount = 1;
    } else if (roll <= 95) {
      equipCount = 1;
      consumableCount = 1;
    } else {
      equipCount = 2;
    }

    for (let i = 0; i < equipCount; ++i) {
      const tier = _pickTier(prng, cr);
      const categories = [ItemCategory.WEAPON, ItemCategory.ARMOR, ItemCategory.SHIELD, ItemCategory.ACCESSORY];
      const cat = categories[prng.nextInt(0, categories.length - 1)];
      const tmplId = _pickTemplate(prng, cat);
      if (tmplId) {
        const affix = _pickAffix(prng, tier, cat);
        const item = createItem(tmplId, tier, affix);
        if (item)
          drops.push(item);
      }
    }

    for (let i = 0; i < consumableCount; ++i) {
      const tmplId = _pickTemplate(prng, ItemCategory.CONSUMABLE);
      if (tmplId) {
        const item = createItem(tmplId);
        if (item)
          drops.push(item);
      }
    }

    return drops;
  }

  // --- Equipment helpers ---

  function equipmentBonuses(equipment) {
    const totals = {};
    for (const k of Object.keys(EMPTY_STATS))
      totals[k] = 0;
    for (const slot of Object.values(EquipSlot)) {
      const item = equipment[slot];
      if (!item || !item.stats)
        continue;
      for (const k of Object.keys(totals))
        totals[k] += item.stats[k] || 0;
    }
    return totals;
  }

  function canEquip(item, slot) {
    if (!item || !item.slot)
      return false;
    return item.slot === slot;
  }

  function applyConsumable(prng, item, currentHp, maxHp, currentMp, maxMp) {
    if (!item || !item.effect)
      return null;
    const e = item.effect;
    const result = { type: e.type, amount: 0 };
    if (e.type === 'heal' || e.type === 'restoreMp') {
      let total = e.flat || 0;
      for (let i = 0; i < (e.dice || 0); ++i)
        total += prng.nextInt(1, e.sides);
      result.amount = total;
      if (e.type === 'heal')
        result.newHp = Math.min(maxHp, currentHp + total);
      else
        result.newMp = Math.min(maxMp, currentMp + total);
    } else if (e.type === 'buff') {
      result.stat = e.stat;
      result.bonus = e.bonus;
      result.duration = e.duration;
    } else if (e.type === 'cure') {
      result.condition = e.condition;
    } else if (e.type === 'castSpell') {
      result.spellId = e.spellId;
    }
    return result;
  }

  // --- Inventory helpers ---

  function addToInventory(inventory, item) {
    if (!item)
      return inventory;
    if (item.stackable) {
      const existing = inventory.find(i => i.templateId === item.templateId);
      if (existing) {
        const maxStack = (CONSUMABLE_TEMPLATES[item.templateId] || {}).maxStack || 99;
        if (existing.quantity < maxStack) {
          const updated = { ...existing, quantity: existing.quantity + item.quantity };
          return inventory.map(i => i.id === existing.id ? Object.freeze(updated) : i);
        }
      }
    }
    return [...inventory, item];
  }

  function removeFromInventory(inventory, itemId, count) {
    const idx = inventory.findIndex(i => i.id === itemId);
    if (idx === -1)
      return inventory;
    const item = inventory[idx];
    if (item.stackable && item.quantity > (count || 1)) {
      const updated = Object.freeze({ ...item, quantity: item.quantity - (count || 1) });
      return inventory.map((it, i) => i === idx ? updated : it);
    }
    return inventory.filter((_, i) => i !== idx);
  }

  // --- Serialization ---

  function serializeItem(item) {
    if (!item)
      return null;
    const data = {
      id: item.id,
      templateId: item.templateId,
      name: item.name,
      category: item.category,
      slot: item.slot,
      tier: item.tier,
      stats: { ...item.stats },
      value: item.value,
      stackable: item.stackable,
      quantity: item.quantity,
    };
    if (item.damageDice !== undefined) {
      data.damageDice = item.damageDice;
      data.damageSides = item.damageSides;
      data.critRange = [...item.critRange];
      data.critMult = item.critMult;
    }
    if (item.affixDamage)
      data.affixDamage = { ...item.affixDamage };
    if (item.effect)
      data.effect = { ...item.effect };
    if (item.affix)
      data.affix = item.affix;
    return data;
  }

  function deserializeItem(data) {
    if (!data || typeof data !== 'object')
      return null;
    const item = {
      id: data.id || _genId(),
      templateId: data.templateId,
      name: data.name,
      category: data.category,
      slot: data.slot || null,
      tier: data.tier || 1,
      stats: Object.freeze({ ...EMPTY_STATS, ...data.stats }),
      value: data.value || 0,
      stackable: !!data.stackable,
      quantity: data.quantity || 1,
    };
    if (data.damageDice !== undefined) {
      item.damageDice = data.damageDice;
      item.damageSides = data.damageSides;
      item.critRange = Object.freeze(data.critRange || [20]);
      item.critMult = data.critMult || 2;
    }
    if (data.affixDamage)
      item.affixDamage = Object.freeze({ ...data.affixDamage });
    if (data.effect)
      item.effect = Object.freeze({ ...data.effect });
    if (data.affix)
      item.affix = data.affix;
    return Object.freeze(item);
  }

  function serializeInventory(inventory) {
    return (inventory || []).map(serializeItem);
  }

  function deserializeInventory(data) {
    if (!Array.isArray(data))
      return [];
    return data.map(deserializeItem).filter(Boolean);
  }

  function serializeEquipment(equipment) {
    const out = {};
    for (const slot of Object.values(EquipSlot))
      out[slot] = equipment[slot] ? serializeItem(equipment[slot]) : null;
    return out;
  }

  function deserializeEquipment(data) {
    const out = {};
    for (const slot of Object.values(EquipSlot))
      out[slot] = data && data[slot] ? deserializeItem(data[slot]) : null;
    return out;
  }

  function emptyEquipment() {
    const eq = {};
    for (const slot of Object.values(EquipSlot))
      eq[slot] = null;
    return eq;
  }

  // --- Exports ---

  TR.ItemCategory = ItemCategory;
  TR.EquipSlot = EquipSlot;
  TR.ItemTier = ItemTier;
  TR.TIER_NAMES = TIER_NAMES;
  TR.TIER_COLORS = TIER_COLORS;
  TR.ITEM_TEMPLATES = ITEM_TEMPLATES;
  TR.CONSUMABLE_TEMPLATES = CONSUMABLE_TEMPLATES;
  TR.AFFIXES = AFFIXES;
  TR.LOOT_TIERS = LOOT_TIERS;
  TR.EMPTY_STATS = EMPTY_STATS;

  TR.Items = Object.freeze({
    createItem,
    generateLoot,
    equipmentBonuses,
    canEquip,
    applyConsumable,
    addToInventory,
    removeFromInventory,
    serializeItem,
    deserializeItem,
    serializeInventory,
    deserializeInventory,
    serializeEquipment,
    deserializeEquipment,
    emptyEquipment,
  });
})();
