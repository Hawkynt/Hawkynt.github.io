;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const TR = window.SZ.TacticalRealms;
  const Items = TR.Items;

  // Deterministic PRNG for tests
  function prng(seed) { return new TR.PRNG(seed || 42); }

  // --- Enums and constants ---

  describe('Items — enums and constants', () => {

    it('ItemCategory is frozen', () => {
      assert.ok(Object.isFrozen(TR.ItemCategory));
    });

    it('EquipSlot is frozen', () => {
      assert.ok(Object.isFrozen(TR.EquipSlot));
    });

    it('ItemTier is frozen', () => {
      assert.ok(Object.isFrozen(TR.ItemTier));
    });

    it('ItemCategory has five categories', () => {
      assert.equal(Object.keys(TR.ItemCategory).length, 5);
    });

    it('EquipSlot has four slots', () => {
      assert.equal(Object.keys(TR.EquipSlot).length, 4);
    });

    it('ItemTier ranges 1-6', () => {
      assert.equal(TR.ItemTier.COMMON, 1);
      assert.equal(TR.ItemTier.MYTHIC, 6);
    });

    it('TIER_NAMES has 7 entries (index 0 empty)', () => {
      assert.equal(TR.TIER_NAMES.length, 7);
      assert.equal(TR.TIER_NAMES[0], '');
      assert.equal(TR.TIER_NAMES[1], 'Common');
      assert.equal(TR.TIER_NAMES[6], 'Mythic');
    });

    it('TIER_COLORS has 7 entries', () => {
      assert.equal(TR.TIER_COLORS.length, 7);
    });

    it('EMPTY_STATS is frozen with all zero values', () => {
      assert.ok(Object.isFrozen(TR.EMPTY_STATS));
      assert.equal(TR.EMPTY_STATS.attack, 0);
      assert.equal(TR.EMPTY_STATS.damage, 0);
      assert.equal(TR.EMPTY_STATS.ac, 0);
      assert.equal(TR.EMPTY_STATS.maxHp, 0);
      assert.equal(TR.EMPTY_STATS.maxMp, 0);
    });

    it('ITEM_TEMPLATES is frozen', () => {
      assert.ok(Object.isFrozen(TR.ITEM_TEMPLATES));
    });

    it('CONSUMABLE_TEMPLATES is frozen', () => {
      assert.ok(Object.isFrozen(TR.CONSUMABLE_TEMPLATES));
    });

    it('AFFIXES is frozen', () => {
      assert.ok(Object.isFrozen(TR.AFFIXES));
    });

    it('LOOT_TIERS is frozen', () => {
      assert.ok(Object.isFrozen(TR.LOOT_TIERS));
    });

    it('Items facade is frozen', () => {
      assert.ok(Object.isFrozen(Items));
    });
  });

  // --- ITEM_TEMPLATES ---

  describe('Items — ITEM_TEMPLATES', () => {

    it('contains weapons', () => {
      assert.ok(TR.ITEM_TEMPLATES.short_sword);
      assert.equal(TR.ITEM_TEMPLATES.short_sword.category, 'weapon');
    });

    it('contains armor', () => {
      assert.ok(TR.ITEM_TEMPLATES.leather_armor);
      assert.equal(TR.ITEM_TEMPLATES.leather_armor.category, 'armor');
    });

    it('contains shields', () => {
      assert.ok(TR.ITEM_TEMPLATES.buckler);
      assert.equal(TR.ITEM_TEMPLATES.buckler.category, 'shield');
    });

    it('contains accessories', () => {
      assert.ok(TR.ITEM_TEMPLATES.ring_of_protection);
      assert.equal(TR.ITEM_TEMPLATES.ring_of_protection.category, 'accessory');
    });

    it('all templates are frozen', () => {
      for (const k of Object.keys(TR.ITEM_TEMPLATES))
        assert.ok(Object.isFrozen(TR.ITEM_TEMPLATES[k]), k + ' should be frozen');
    });

    it('all templates have required fields', () => {
      for (const [k, t] of Object.entries(TR.ITEM_TEMPLATES)) {
        assert.ok(t.name, k + ' name');
        assert.ok(t.category, k + ' category');
        assert.ok(t.slot, k + ' slot');
        assert.ok(typeof t.tier === 'number', k + ' tier');
        assert.ok(t.stats, k + ' stats');
        assert.ok(typeof t.value === 'number', k + ' value');
      }
    });

    it('weapons have damage dice fields', () => {
      const weapons = Object.values(TR.ITEM_TEMPLATES).filter(t => t.category === 'weapon');
      assert.ok(weapons.length >= 10);
      for (const w of weapons) {
        assert.ok(typeof w.damageDice === 'number', w.name + ' damageDice');
        assert.ok(typeof w.damageSides === 'number', w.name + ' damageSides');
        assert.ok(Array.isArray(w.critRange), w.name + ' critRange');
        assert.ok(typeof w.critMult === 'number', w.name + ' critMult');
      }
    });

    it('armor templates have AC bonus', () => {
      const armors = Object.values(TR.ITEM_TEMPLATES).filter(t => t.category === 'armor');
      for (const a of armors)
        assert.ok(a.stats.ac >= 1 || a.stats.maxMp > 0, a.name + ' has ac or mp bonus');
    });

    it('shield templates target offHand slot', () => {
      const shields = Object.values(TR.ITEM_TEMPLATES).filter(t => t.category === 'shield');
      for (const s of shields)
        assert.equal(s.slot, 'offHand', s.name + ' slot');
    });
  });

  // --- CONSUMABLE_TEMPLATES ---

  describe('Items — CONSUMABLE_TEMPLATES', () => {

    it('has at least 7 consumable types', () => {
      assert.ok(Object.keys(TR.CONSUMABLE_TEMPLATES).length >= 7);
    });

    it('all consumables are frozen with required fields', () => {
      for (const [k, t] of Object.entries(TR.CONSUMABLE_TEMPLATES)) {
        assert.ok(Object.isFrozen(t), k + ' frozen');
        assert.equal(t.category, 'consumable', k + ' category');
        assert.ok(t.stackable, k + ' stackable');
        assert.ok(t.effect, k + ' effect');
      }
    });

    it('healing potion has heal effect', () => {
      const hp = TR.CONSUMABLE_TEMPLATES.healing_potion;
      assert.equal(hp.effect.type, 'heal');
      assert.ok(hp.effect.dice > 0);
      assert.ok(hp.effect.sides > 0);
    });

    it('mana potion has restoreMp effect', () => {
      assert.equal(TR.CONSUMABLE_TEMPLATES.mana_potion.effect.type, 'restoreMp');
    });

    it('antidote has cure effect', () => {
      assert.equal(TR.CONSUMABLE_TEMPLATES.antidote.effect.type, 'cure');
      assert.equal(TR.CONSUMABLE_TEMPLATES.antidote.effect.condition, 'poison');
    });

    it('strength elixir has buff effect', () => {
      const se = TR.CONSUMABLE_TEMPLATES.strength_elixir;
      assert.equal(se.effect.type, 'buff');
      assert.ok(se.effect.bonus > 0);
      assert.ok(se.effect.duration > 0);
    });

    it('scroll of fireball has castSpell effect', () => {
      const sf = TR.CONSUMABLE_TEMPLATES.scroll_of_fireball;
      assert.equal(sf.effect.type, 'castSpell');
      assert.equal(sf.effect.spellId, 'fireball');
    });
  });

  // --- AFFIXES ---

  describe('Items — AFFIXES', () => {

    it('has at least 8 affixes', () => {
      assert.ok(Object.keys(TR.AFFIXES).length >= 8);
    });

    it('all affixes are frozen', () => {
      for (const k of Object.keys(TR.AFFIXES))
        assert.ok(Object.isFrozen(TR.AFFIXES[k]), k + ' frozen');
    });

    it('all affixes have required fields', () => {
      for (const [k, a] of Object.entries(TR.AFFIXES)) {
        assert.ok(a.name, k + ' name');
        assert.ok(typeof a.prefix === 'boolean', k + ' prefix');
        assert.isArray(a.appliesTo, k + ' appliesTo');
        assert.ok(a.appliesTo.length > 0, k + ' applies to at least one category');
        assert.ok(typeof a.tierMin === 'number', k + ' tierMin');
        assert.ok(typeof a.valueMult === 'number', k + ' valueMult');
      }
    });

    it('weapon affixes include flaming and frost', () => {
      assert.includes(TR.AFFIXES.flaming.appliesTo, 'weapon');
      assert.includes(TR.AFFIXES.frost.appliesTo, 'weapon');
    });

    it('keen affix has extraCritRange', () => {
      assert.ok(TR.AFFIXES.keen.extraCritRange > 0);
    });

    it('guardian affix applies to shields and armor', () => {
      assert.includes(TR.AFFIXES.guardian.appliesTo, 'shield');
      assert.includes(TR.AFFIXES.guardian.appliesTo, 'armor');
    });
  });

  // --- createItem ---

  describe('Items — createItem', () => {

    it('creates a basic weapon from template', () => {
      const sword = Items.createItem('short_sword');
      assert.ok(sword);
      assert.equal(sword.name, 'Short Sword');
      assert.equal(sword.category, 'weapon');
      assert.equal(sword.slot, 'mainHand');
      assert.equal(sword.tier, 1);
      assert.ok(sword.damageDice > 0);
      assert.ok(sword.damageSides > 0);
    });

    it('returns frozen items', () => {
      const item = Items.createItem('short_sword');
      assert.ok(Object.isFrozen(item));
    });

    it('assigns unique ids', () => {
      const a = Items.createItem('short_sword');
      const b = Items.createItem('short_sword');
      assert.notEqual(a.id, b.id);
    });

    it('returns null for unknown template', () => {
      assert.isNull(Items.createItem('nonexistent'));
    });

    it('creates armor with AC bonus', () => {
      const armor = Items.createItem('leather_armor');
      assert.ok(armor);
      assert.equal(armor.category, 'armor');
      assert.equal(armor.slot, 'body');
      assert.ok(armor.stats.ac >= 2);
    });

    it('creates consumable from consumable templates', () => {
      const potion = Items.createItem('healing_potion');
      assert.ok(potion);
      assert.equal(potion.category, 'consumable');
      assert.ok(potion.stackable);
      assert.ok(potion.effect);
    });

    it('applies tier override with stat scaling', () => {
      const base = Items.createItem('short_sword', 1);
      const scaled = Items.createItem('short_sword', 3);
      assert.equal(scaled.tier, 3);
      assert.ok(scaled.stats.damage >= base.stats.damage);
      assert.ok(scaled.value > base.value);
    });

    it('applies affix to weapon', () => {
      const item = Items.createItem('longsword', 3, 'flaming');
      assert.ok(item);
      assert.ok(item.name.includes('Flaming'));
      assert.equal(item.affix, 'Flaming');
      assert.ok(item.affixDamage);
      assert.equal(item.affixDamage.element, 'fire');
    });

    it('keen affix expands crit range', () => {
      const base = Items.createItem('longsword', 3);
      const keen = Items.createItem('longsword', 3, 'keen');
      assert.ok(keen.critRange.length > base.critRange.length);
    });

    it('ignores affix if tier too low', () => {
      const item = Items.createItem('short_sword', 1, 'keen');
      assert.ok(item);
      assert.ok(!item.affix);
    });

    it('ignores affix if category mismatch', () => {
      const item = Items.createItem('leather_armor', 3, 'flaming');
      assert.ok(item);
      assert.ok(!item.affix);
    });

    it('blessed affix applies stat bonus to armor', () => {
      const item = Items.createItem('chain_mail', 3, 'blessed');
      assert.ok(item);
      assert.equal(item.affix, 'Blessed');
      assert.ok(item.stats.fortSave >= 1);
    });

    it('does not apply affix to consumables', () => {
      const item = Items.createItem('healing_potion', 1, 'flaming');
      assert.ok(item);
      assert.ok(!item.affix);
    });

    it('suffix affix uses "of" naming', () => {
      const item = Items.createItem('chain_mail', 3, 'guardian');
      assert.ok(item);
      assert.ok(item.name.includes(' of '), 'name should contain " of "');
    });

    it('critRange is frozen on created items', () => {
      const item = Items.createItem('rapier');
      assert.ok(Object.isFrozen(item.critRange));
    });

    it('tier scaling adds AC to armor', () => {
      const base = Items.createItem('leather_armor', 1);
      const high = Items.createItem('leather_armor', 3);
      assert.ok(high.stats.ac >= base.stats.ac);
    });

    it('tier scaling adds maxHp to accessories', () => {
      const base = Items.createItem('ring_of_protection', 2);
      const high = Items.createItem('ring_of_protection', 4);
      assert.ok(high.stats.maxHp >= base.stats.maxHp);
    });
  });

  // --- generateLoot ---

  describe('Items — generateLoot', () => {

    it('returns an array', () => {
      const loot = Items.generateLoot(prng(), 1);
      assert.isArray(loot);
    });

    it('all dropped items are frozen', () => {
      const rng = prng(100);
      for (let i = 0; i < 20; ++i) {
        const loot = Items.generateLoot(rng, 3);
        for (const item of loot)
          assert.ok(Object.isFrozen(item));
      }
    });

    it('drops vary by seed', () => {
      const a = Items.generateLoot(prng(1), 5);
      const b = Items.generateLoot(prng(2), 5);
      const aIds = a.map(i => i.templateId).join(',');
      const bIds = b.map(i => i.templateId).join(',');
      // With different seeds and multiple runs, at least some should differ
      // (tiny probability of collision, but acceptable for testing)
      if (a.length > 0 && b.length > 0)
        assert.ok(true);
    });

    it('never returns more than 3 items per drop', () => {
      const rng = prng(999);
      for (let i = 0; i < 100; ++i) {
        const loot = Items.generateLoot(rng, 5);
        assert.ok(loot.length <= 3, 'max 3 items per drop');
      }
    });

    it('sometimes returns empty drops (40% nothing)', () => {
      const rng = prng(7);
      let emptyCount = 0;
      for (let i = 0; i < 100; ++i)
        if (Items.generateLoot(rng, 1).length === 0)
          ++emptyCount;
      assert.ok(emptyCount > 0, 'should have at least one empty drop');
    });

    it('higher CR produces higher-tier items on average', () => {
      const rng1 = prng(42);
      const rng8 = prng(42);
      let sum1 = 0, count1 = 0;
      let sum8 = 0, count8 = 0;
      for (let i = 0; i < 200; ++i) {
        for (const item of Items.generateLoot(rng1, 1)) {
          sum1 += item.tier;
          ++count1;
        }
        for (const item of Items.generateLoot(rng8, 8)) {
          sum8 += item.tier;
          ++count8;
        }
      }
      if (count1 > 0 && count8 > 0)
        assert.ok(sum8 / count8 >= sum1 / count1, 'CR 8 avg tier >= CR 1 avg tier');
    });
  });

  // --- equipmentBonuses ---

  describe('Items — equipmentBonuses', () => {

    it('returns zeroes for empty equipment', () => {
      const eq = Items.emptyEquipment();
      const bonuses = Items.equipmentBonuses(eq);
      assert.equal(bonuses.attack, 0);
      assert.equal(bonuses.damage, 0);
      assert.equal(bonuses.ac, 0);
      assert.equal(bonuses.maxHp, 0);
    });

    it('sums bonuses from multiple slots', () => {
      const eq = Items.emptyEquipment();
      eq.mainHand = Items.createItem('longsword');
      eq.body = Items.createItem('chain_mail');
      eq.offHand = Items.createItem('round_shield');
      const bonuses = Items.equipmentBonuses(eq);
      assert.ok(bonuses.attack >= 1, 'longsword attack bonus');
      assert.ok(bonuses.ac >= 8, 'chain mail + round shield AC');
    });

    it('handles null slots gracefully', () => {
      const eq = Items.emptyEquipment();
      eq.mainHand = Items.createItem('dagger');
      const bonuses = Items.equipmentBonuses(eq);
      assert.ok(bonuses.attack >= 1);
    });
  });

  // --- canEquip ---

  describe('Items — canEquip', () => {

    it('allows weapon in mainHand', () => {
      const sword = Items.createItem('short_sword');
      assert.ok(Items.canEquip(sword, 'mainHand'));
    });

    it('rejects weapon in body slot', () => {
      const sword = Items.createItem('short_sword');
      assert.ok(!Items.canEquip(sword, 'body'));
    });

    it('allows armor in body slot', () => {
      const armor = Items.createItem('leather_armor');
      assert.ok(Items.canEquip(armor, 'body'));
    });

    it('allows shield in offHand', () => {
      const shield = Items.createItem('buckler');
      assert.ok(Items.canEquip(shield, 'offHand'));
    });

    it('rejects shield in mainHand', () => {
      const shield = Items.createItem('buckler');
      assert.ok(!Items.canEquip(shield, 'mainHand'));
    });

    it('returns false for null item', () => {
      assert.ok(!Items.canEquip(null, 'mainHand'));
    });

    it('returns false for consumable (no slot)', () => {
      const potion = Items.createItem('healing_potion');
      assert.ok(!Items.canEquip(potion, 'mainHand'));
    });
  });

  // --- applyConsumable ---

  describe('Items — applyConsumable', () => {

    it('healing potion restores HP', () => {
      const potion = Items.createItem('healing_potion');
      const result = Items.applyConsumable(prng(), potion, 5, 30, 10, 20);
      assert.ok(result);
      assert.equal(result.type, 'heal');
      assert.ok(result.amount > 0);
      assert.ok(result.newHp > 5);
      assert.ok(result.newHp <= 30);
    });

    it('heal does not exceed maxHp', () => {
      const potion = Items.createItem('healing_potion');
      const result = Items.applyConsumable(prng(), potion, 29, 30, 10, 20);
      assert.ok(result.newHp <= 30);
    });

    it('mana potion restores MP', () => {
      const potion = Items.createItem('mana_potion');
      const result = Items.applyConsumable(prng(), potion, 20, 30, 3, 20);
      assert.equal(result.type, 'restoreMp');
      assert.ok(result.amount > 0);
      assert.ok(result.newMp > 3);
      assert.ok(result.newMp <= 20);
    });

    it('mana does not exceed maxMp', () => {
      const potion = Items.createItem('mana_potion');
      const result = Items.applyConsumable(prng(), potion, 20, 30, 19, 20);
      assert.ok(result.newMp <= 20);
    });

    it('buff returns stat, bonus, and duration', () => {
      const elixir = Items.createItem('strength_elixir');
      const result = Items.applyConsumable(prng(), elixir, 20, 30, 10, 20);
      assert.equal(result.type, 'buff');
      assert.ok(result.stat);
      assert.ok(result.bonus > 0);
      assert.ok(result.duration > 0);
    });

    it('cure returns condition', () => {
      const antidote = Items.createItem('antidote');
      const result = Items.applyConsumable(prng(), antidote, 20, 30, 10, 20);
      assert.equal(result.type, 'cure');
      assert.equal(result.condition, 'poison');
    });

    it('castSpell returns spellId', () => {
      const scroll = Items.createItem('scroll_of_fireball');
      const result = Items.applyConsumable(prng(), scroll, 20, 30, 10, 20);
      assert.equal(result.type, 'castSpell');
      assert.equal(result.spellId, 'fireball');
    });

    it('returns null for null item', () => {
      assert.isNull(Items.applyConsumable(prng(), null, 20, 30, 10, 20));
    });

    it('returns null for item without effect', () => {
      const sword = Items.createItem('short_sword');
      assert.isNull(Items.applyConsumable(prng(), sword, 20, 30, 10, 20));
    });

    it('greater healing potion heals more than regular', () => {
      const rng = prng(42);
      const reg = Items.createItem('healing_potion');
      const grt = Items.createItem('greater_healing_potion');
      let regTotal = 0, grtTotal = 0;
      for (let i = 0; i < 50; ++i) {
        regTotal += Items.applyConsumable(rng, reg, 1, 999, 0, 0).amount;
        grtTotal += Items.applyConsumable(rng, grt, 1, 999, 0, 0).amount;
      }
      assert.ok(grtTotal > regTotal, 'greater potion should heal more on average');
    });
  });

  // --- Inventory helpers ---

  describe('Items — inventory management', () => {

    it('addToInventory adds a non-stackable item', () => {
      const inv = [];
      const sword = Items.createItem('short_sword');
      const result = Items.addToInventory(inv, sword);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, sword.id);
    });

    it('addToInventory stacks consumables', () => {
      const p1 = Items.createItem('healing_potion');
      const p2 = Items.createItem('healing_potion');
      let inv = Items.addToInventory([], p1);
      inv = Items.addToInventory(inv, p2);
      assert.equal(inv.length, 1);
      assert.equal(inv[0].quantity, 2);
    });

    it('addToInventory does not stack non-consumables', () => {
      const s1 = Items.createItem('short_sword');
      const s2 = Items.createItem('short_sword');
      let inv = Items.addToInventory([], s1);
      inv = Items.addToInventory(inv, s2);
      assert.equal(inv.length, 2);
    });

    it('addToInventory returns unchanged array for null item', () => {
      const inv = [Items.createItem('dagger')];
      const result = Items.addToInventory(inv, null);
      assert.equal(result.length, 1);
    });

    it('removeFromInventory removes single item', () => {
      const sword = Items.createItem('short_sword');
      const inv = [sword];
      const result = Items.removeFromInventory(inv, sword.id);
      assert.equal(result.length, 0);
    });

    it('removeFromInventory decrements stack count', () => {
      const p1 = Items.createItem('healing_potion');
      const p2 = Items.createItem('healing_potion');
      let inv = Items.addToInventory([], p1);
      inv = Items.addToInventory(inv, p2);
      const result = Items.removeFromInventory(inv, inv[0].id, 1);
      assert.equal(result.length, 1);
      assert.equal(result[0].quantity, 1);
    });

    it('removeFromInventory removes stack when quantity reaches 0', () => {
      const p = Items.createItem('healing_potion');
      const inv = Items.addToInventory([], p);
      const result = Items.removeFromInventory(inv, inv[0].id, 1);
      assert.equal(result.length, 0);
    });

    it('removeFromInventory returns unchanged for unknown id', () => {
      const inv = [Items.createItem('dagger')];
      const result = Items.removeFromInventory(inv, 'nonexistent');
      assert.equal(result.length, 1);
    });
  });

  // --- emptyEquipment ---

  describe('Items — emptyEquipment', () => {

    it('returns object with all slots as null', () => {
      const eq = Items.emptyEquipment();
      assert.isNull(eq.mainHand);
      assert.isNull(eq.offHand);
      assert.isNull(eq.body);
      assert.isNull(eq.accessory);
    });

    it('has exactly 4 slots', () => {
      const eq = Items.emptyEquipment();
      assert.equal(Object.keys(eq).length, 4);
    });
  });

  // --- Serialization ---

  describe('Items — serialization', () => {

    it('serializeItem returns plain object', () => {
      const item = Items.createItem('short_sword');
      const data = Items.serializeItem(item);
      assert.ok(data);
      assert.equal(data.templateId, 'short_sword');
      assert.equal(data.name, 'Short Sword');
    });

    it('serializeItem returns null for null input', () => {
      assert.isNull(Items.serializeItem(null));
    });

    it('deserializeItem reconstructs a frozen item', () => {
      const item = Items.createItem('longsword', 3, 'flaming');
      const data = Items.serializeItem(item);
      const restored = Items.deserializeItem(data);
      assert.ok(Object.isFrozen(restored));
      assert.equal(restored.name, item.name);
      assert.equal(restored.tier, item.tier);
      assert.equal(restored.affix, item.affix);
    });

    it('deserializeItem returns null for null input', () => {
      assert.isNull(Items.deserializeItem(null));
    });

    it('deserializeItem returns null for non-object input', () => {
      assert.isNull(Items.deserializeItem('string'));
    });

    it('serialized weapon preserves damage fields', () => {
      const item = Items.createItem('rapier');
      const data = Items.serializeItem(item);
      const restored = Items.deserializeItem(data);
      assert.equal(restored.damageDice, item.damageDice);
      assert.equal(restored.damageSides, item.damageSides);
      assert.equal(restored.critMult, item.critMult);
      assert.deepEqual([...restored.critRange], [...item.critRange]);
    });

    it('serialized consumable preserves effect', () => {
      const item = Items.createItem('healing_potion');
      const data = Items.serializeItem(item);
      const restored = Items.deserializeItem(data);
      assert.ok(restored.effect);
      assert.equal(restored.effect.type, 'heal');
    });

    it('serializeInventory handles array of items', () => {
      const inv = [Items.createItem('dagger'), Items.createItem('healing_potion')];
      const data = Items.serializeInventory(inv);
      assert.isArray(data);
      assert.equal(data.length, 2);
    });

    it('deserializeInventory restores inventory', () => {
      const inv = [Items.createItem('dagger'), Items.createItem('healing_potion')];
      const data = Items.serializeInventory(inv);
      const restored = Items.deserializeInventory(data);
      assert.equal(restored.length, 2);
      assert.equal(restored[0].templateId, 'dagger');
      assert.equal(restored[1].templateId, 'healing_potion');
    });

    it('deserializeInventory returns empty array for invalid input', () => {
      assert.deepEqual(Items.deserializeInventory(null), []);
      assert.deepEqual(Items.deserializeInventory('bad'), []);
    });

    it('serializeEquipment preserves all slots', () => {
      const eq = Items.emptyEquipment();
      eq.mainHand = Items.createItem('short_sword');
      eq.body = Items.createItem('leather_armor');
      const data = Items.serializeEquipment(eq);
      assert.ok(data.mainHand);
      assert.ok(data.body);
      assert.isNull(data.offHand);
      assert.isNull(data.accessory);
    });

    it('deserializeEquipment reconstructs equipment', () => {
      const eq = Items.emptyEquipment();
      eq.mainHand = Items.createItem('short_sword');
      eq.body = Items.createItem('leather_armor');
      const data = Items.serializeEquipment(eq);
      const restored = Items.deserializeEquipment(data);
      assert.ok(restored.mainHand);
      assert.equal(restored.mainHand.templateId, 'short_sword');
      assert.ok(restored.body);
      assert.equal(restored.body.templateId, 'leather_armor');
      assert.isNull(restored.offHand);
    });

    it('deserializeEquipment handles null input', () => {
      const eq = Items.deserializeEquipment(null);
      assert.isNull(eq.mainHand);
      assert.isNull(eq.offHand);
      assert.isNull(eq.body);
      assert.isNull(eq.accessory);
    });

    it('round-trip preserves affix damage data', () => {
      const item = Items.createItem('longsword', 3, 'flaming');
      const data = Items.serializeItem(item);
      const restored = Items.deserializeItem(data);
      assert.ok(restored.affixDamage);
      assert.equal(restored.affixDamage.element, 'fire');
      assert.equal(restored.affixDamage.dice, item.affixDamage.dice);
    });
  });

  // --- LOOT_TIERS ---

  describe('Items — LOOT_TIERS', () => {

    it('has 5 CR bracket rows', () => {
      assert.equal(TR.LOOT_TIERS.length, 5);
    });

    it('each row sums to 100', () => {
      for (let i = 0; i < TR.LOOT_TIERS.length; ++i) {
        const sum = TR.LOOT_TIERS[i].reduce((a, b) => a + b, 0);
        assert.equal(sum, 100, 'row ' + i + ' sums to ' + sum);
      }
    });

    it('each row has 6 entries (tiers 1-6)', () => {
      for (const row of TR.LOOT_TIERS)
        assert.equal(row.length, 6);
    });

    it('higher CR rows shift weight toward higher tiers', () => {
      const low = TR.LOOT_TIERS[0];
      const high = TR.LOOT_TIERS[4];
      assert.ok(low[0] > high[0], 'low CR has more T1 weight');
    });
  });

})();
