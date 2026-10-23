;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  const _map = new Map();
  for (const entry of (TR._pending?.skills || []))
    _map.set(entry.id, Object.freeze(entry));
  if (TR._pending) delete TR._pending.skills;

  const _byAbility = new Map();
  for (const s of _map.values()) {
    if (!_byAbility.has(s.ability))
      _byAbility.set(s.ability, []);
    _byAbility.get(s.ability).push(s);
  }

  // Max ranks = character level + 3 (class skill) or half that (cross-class)
  function maxRanks(charLevel, isClassSkill) {
    return isClassSkill ? charLevel + 3 : Math.floor((charLevel + 3) / 2);
  }

  // Skill check: d20 + ranks + ability mod + misc
  function skillCheck(prng, ranks, abilityMod, misc) {
    const roll = prng.d20();
    const total = roll + ranks + abilityMod + (misc || 0);
    return { roll, total };
  }

  // Opposed skill check
  function opposedCheck(prng, activeRanks, activeMod, activeMisc, passiveRanks, passiveMod, passiveMisc) {
    const active = skillCheck(prng, activeRanks, activeMod, activeMisc);
    const passive = skillCheck(prng, passiveRanks, passiveMod, passiveMisc);
    return {
      active,
      passive,
      success: active.total >= passive.total,
    };
  }

  // Take 10 / Take 20 (no threat, no time pressure)
  function take10(ranks, abilityMod, misc) {
    return 10 + ranks + abilityMod + (misc || 0);
  }

  function take20(ranks, abilityMod, misc) {
    return 20 + ranks + abilityMod + (misc || 0);
  }

  TR.SkillRegistry = Object.freeze({
    get: id => _map.get(id),
    getAll: () => [..._map.values()],
    has: id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    count: () => _map.size,

    byAbility: ability => _byAbility.get(ability) || [],
    trainedOnly: () => [..._map.values()].filter(s => s.trained),

    maxRanks,
    skillCheck,
    opposedCheck,
    take10,
    take20,
  });
})();
