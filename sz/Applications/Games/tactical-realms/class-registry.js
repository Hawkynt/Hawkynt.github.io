;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  const _map = new Map();
  for (const entry of (TR._pending?.classes || []))
    _map.set(entry.id, Object.freeze(entry));
  if (TR._pending) delete TR._pending.classes;

  const _base = [];
  const _prestige = [];
  const _npc = [];

  for (const c of _map.values()) {
    if (c.type === 'base')
      _base.push(c);
    else if (c.type === 'prestige')
      _prestige.push(c);
    else if (c.type === 'npc')
      _npc.push(c);
  }

  function calcBAB(progression, level) {
    if (progression === 'full')
      return level;
    if (progression === '3/4')
      return Math.floor(level * 3 / 4);
    return Math.floor(level / 2);
  }

  function calcSave(isGood, level) {
    if (isGood)
      return 2 + Math.floor(level / 2);
    return Math.floor(level / 3);
  }

  // Get spells per day, auto-extending beyond table max via epic progression:
  // every 2 levels beyond the table, gain +1 spell at each known spell level.
  function getSpellsPerDay(classDef, classLevel) {
    if (!classDef.spellsPerDay || classLevel < 1)
      return null;
    const tableMax = classDef.spellsPerDay.length;
    if (classLevel <= tableMax)
      return classDef.spellsPerDay[classLevel - 1] || null;
    const base = classDef.spellsPerDay[tableMax - 1];
    if (!base) return null;
    const epicBonuses = Math.floor((classLevel - tableMax) / 2);
    const extended = [...base];
    for (let i = 0; i < extended.length; ++i)
      if (extended[i] > 0)
        extended[i] += epicBonuses;
    return extended;
  }

  function meetsPrerequisites(classDef, character) {
    if (!classDef.prerequisites)
      return true;
    const prereq = classDef.prerequisites;
    if (prereq.bab && character.bab < prereq.bab)
      return false;
    if (prereq.skills) {
      for (const [skill, ranks] of Object.entries(prereq.skills))
        if ((character.skills?.[skill] || 0) < ranks)
          return false;
    }
    if (prereq.feats) {
      for (const feat of prereq.feats)
        if (!character.feats?.includes(feat))
          return false;
    }
    if (prereq.spellcasting) {
      const sc = prereq.spellcasting;
      if (sc.level && (!character.maxSpellLevel || character.maxSpellLevel < sc.level))
        return false;
    }
    return true;
  }

  function getFeaturesAtLevel(classDef, classLevel) {
    if (!classDef.features)
      return [];
    return classDef.features.filter(f => f.level === classLevel);
  }

  TR.ClassRegistry = Object.freeze({
    get: id => _map.get(id),
    getAll: () => [..._map.values()],
    has: id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    count: () => _map.size,

    getBaseClasses: () => [..._base],
    getPrestigeClasses: () => [..._prestige],
    getNPCClasses: () => [..._npc],

    calcBAB,
    calcSave,
    getSpellsPerDay,
    meetsPrerequisites,
    getFeaturesAtLevel,
    // Get spell schools a class can access (from spellcasting.spellSchools in class data)
    getSpellSchools: classId => {
      const cls = _map.get(classId);
      return cls?.spellcasting?.spellSchools || [];
    },
  });
})();
