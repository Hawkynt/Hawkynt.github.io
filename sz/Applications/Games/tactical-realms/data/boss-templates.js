;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).bossTemplates || (TR._pending.bossTemplates = {});
  const bt = TR._pending.bossTemplates;

  // Boss templates: enhanced enemies with phase transitions
  // base: templateId from enemy-templates, phases trigger at HP thresholds

  bt.goblin_chieftain = {
    base: 'hobgoblin', name: 'Goblin Chieftain', tier: 1,
    hpMult: 2.5, acBonus: 2, babBonus: 2, extraHD: 3,
    phases: [
      { hpThreshold: 0.75, name: 'Enraged', babBonus: 1, damageMult: 1.5 },
      { hpThreshold: 0.25, name: 'Desperate', babBonus: 2, damageMult: 2.0, acBonus: -2 },
    ],
    xpReward: 200, goldReward: 100,
  };
  bt.dire_alpha = {
    base: 'dire_wolf', name: 'Dire Alpha', tier: 2,
    hpMult: 2.0, acBonus: 2, babBonus: 2, extraHD: 4,
    phases: [
      { hpThreshold: 0.50, name: 'Howl', babBonus: 2, damageMult: 1.5 },
    ],
    xpReward: 300, goldReward: 120,
  };
  bt.necromancer = {
    base: 'dark_mage', name: 'Necromancer', tier: 3,
    hpMult: 3.0, acBonus: 3, babBonus: 1, extraHD: 5,
    phases: [
      { hpThreshold: 0.50, name: 'Dark Ritual', babBonus: 1, damageMult: 1.5 },
      { hpThreshold: 0.25, name: 'Lich Form', babBonus: 2, damageMult: 2.0, acBonus: 3 },
    ],
    xpReward: 500, goldReward: 200,
  };
  bt.dragon = {
    base: 'young_dragon', name: 'Adult Dragon', tier: 4,
    hpMult: 2.0, acBonus: 3, babBonus: 3, extraHD: 6,
    phases: [
      { hpThreshold: 0.75, name: 'Breath Weapon', babBonus: 1, damageMult: 1.25 },
      { hpThreshold: 0.50, name: 'Wing Buffet', babBonus: 2, damageMult: 1.5 },
      { hpThreshold: 0.25, name: 'Draconic Fury', babBonus: 3, damageMult: 2.0 },
    ],
    xpReward: 800, goldReward: 400,
  };
  bt.lich_king = {
    base: 'lich', name: 'Lich King', tier: 5,
    hpMult: 3.0, acBonus: 4, babBonus: 2, extraHD: 8,
    phases: [
      { hpThreshold: 0.50, name: 'Phylactery Shield', acBonus: 5, damageMult: 1.5 },
      { hpThreshold: 0.25, name: 'Soul Harvest', babBonus: 3, damageMult: 2.5, acBonus: -2 },
    ],
    xpReward: 1200, goldReward: 600,
  };
  bt.demon_lord = {
    base: 'demon', name: 'Demon Lord', tier: 6,
    hpMult: 3.0, acBonus: 5, babBonus: 4, extraHD: 10,
    phases: [
      { hpThreshold: 0.75, name: 'Hellfire', babBonus: 1, damageMult: 1.5 },
      { hpThreshold: 0.50, name: 'Infernal Rage', babBonus: 3, damageMult: 2.0 },
      { hpThreshold: 0.25, name: 'Ascension', babBonus: 5, damageMult: 2.5, acBonus: 3 },
    ],
    xpReward: 2000, goldReward: 1000,
  };
})();
