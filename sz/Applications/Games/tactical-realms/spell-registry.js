;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  const _map = new Map();
  for (const entry of (TR._pending?.spells || []))
    _map.set(entry.id, Object.freeze(entry));
  if (TR._pending) delete TR._pending.spells;

  // Indexes for fast lookups
  const _bySchool = new Map();
  const _byLevel = new Map();       // keyed as "classId:level"
  const _byClassList = new Map();   // classId -> [spells]

  for (const s of _map.values()) {
    // Index by school
    if (!_bySchool.has(s.school))
      _bySchool.set(s.school, []);
    _bySchool.get(s.school).push(s);

    // Index by class + spell level
    if (s.level) {
      for (const [cls, lvl] of Object.entries(s.level)) {
        const key = `${cls}:${lvl}`;
        if (!_byLevel.has(key))
          _byLevel.set(key, []);
        _byLevel.get(key).push(s);

        if (!_byClassList.has(cls))
          _byClassList.set(cls, []);
        _byClassList.get(cls).push(s);
      }
    }
  }

  function spellDC(spell, classId, casterAbilityMod) {
    const spellLevel = spell.level?.[classId] ?? 0;
    return 10 + spellLevel + casterAbilityMod;
  }

  function casterLevelCheck(prng, casterLevel, targetSR) {
    const roll = prng.d20();
    const total = roll + casterLevel;
    return { roll, total, success: total >= targetSR };
  }

  TR.SpellRegistry = Object.freeze({
    get: id => _map.get(id),
    getAll: () => [..._map.values()],
    has: id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    count: () => _map.size,

    bySchool: school => _bySchool.get(school) || [],
    byClassAndLevel: (classId, spellLevel) => _byLevel.get(`${classId}:${spellLevel}`) || [],
    forClass: classId => _byClassList.get(classId) || [],

    spellDC,
    casterLevelCheck,
  });
})();
