;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  const _map = new Map();
  for (const entry of (TR._pending?.feats || []))
    _map.set(entry.id, Object.freeze(entry));
  if (TR._pending) delete TR._pending.feats;

  const _byType = new Map();
  for (const f of _map.values()) {
    if (!_byType.has(f.type))
      _byType.set(f.type, []);
    _byType.get(f.type).push(f);
  }

  function meetsPrerequisites(feat, character) {
    if (!feat.prerequisites)
      return true;
    const p = feat.prerequisites;

    if (p.bab && (character.bab || 0) < p.bab)
      return false;

    if (p.abilities) {
      for (const [ab, val] of Object.entries(p.abilities))
        if ((character.stats?.[ab] || 0) < val)
          return false;
    }

    if (p.feats) {
      const charFeats = character.feats || [];
      for (const reqFeat of p.feats)
        if (!charFeats.includes(reqFeat))
          return false;
    }

    if (p.skills) {
      for (const [skill, ranks] of Object.entries(p.skills))
        if ((character.skillRanks?.[skill] || 0) < ranks)
          return false;
    }

    if (p.spellcasting) {
      const sc = p.spellcasting;
      if (sc.level && (!character.maxSpellLevel || character.maxSpellLevel < sc.level))
        return false;
      if (sc.type && character.spellcastingType !== sc.type)
        return false;
    }

    if (p.classFeature) {
      const features = character.classFeatures || [];
      if (!features.includes(p.classFeature))
        return false;
    }

    return true;
  }

  // Get feats available to a character (meets prereqs, not already taken)
  function availableFeats(character) {
    const taken = new Set(character.feats || []);
    return [..._map.values()].filter(f => {
      if (taken.has(f.id) && !f.repeatable)
        return false;
      return meetsPrerequisites(f, character);
    });
  }

  // Feat slots: 1st, 3rd, 6th, 9th, 12th, 15th, 18th level
  function featSlotsAtLevel(level) {
    let count = 1; // level 1 feat
    for (let l = 3; l <= level; l += 3)
      ++count;
    return count;
  }

  // Fighter bonus feats: 1st, 2nd, 4th, 6th, 8th, ... (every even level)
  function fighterBonusFeats(fighterLevel) {
    if (fighterLevel < 1) return 0;
    return 1 + Math.floor(fighterLevel / 2);
  }

  TR.FeatRegistry = Object.freeze({
    get: id => _map.get(id),
    getAll: () => [..._map.values()],
    has: id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    count: () => _map.size,

    byType: type => _byType.get(type) || [],
    generalFeats: () => _byType.get('general') || [],
    fighterFeats: () => _byType.get('fighter') || [],
    metamagicFeats: () => _byType.get('metamagic') || [],

    meetsPrerequisites,
    availableFeats,
    featSlotsAtLevel,
    fighterBonusFeats,
  });
})();
