;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  const _map = new Map();
  for (const entry of (TR._pending?.creatures || []))
    _map.set(entry.id, Object.freeze(entry));
  if (TR._pending) delete TR._pending.creatures;

  // Index by type and CR for fast lookups
  const _byType = new Map();
  const _byCR = new Map();
  const _playable = [];
  const _monsters = [];

  for (const c of _map.values()) {
    // Index by creature type
    if (!_byType.has(c.type))
      _byType.set(c.type, []);
    _byType.get(c.type).push(c);

    // Index by CR (monsters only)
    if (c.cr != null) {
      if (!_byCR.has(c.cr))
        _byCR.set(c.cr, []);
      _byCR.get(c.cr).push(c);
    }

    // Separate playable races from monsters
    if (c.playable)
      _playable.push(c);
    else
      _monsters.push(c);
  }

  TR.CreatureRegistry = Object.freeze({
    get: id => _map.get(id),
    getAll: () => [..._map.values()],
    has: id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    count: () => _map.size,

    // Playable races
    getRaces: () => [..._playable],
    getRacesByAvailability: avail => _playable.filter(r => r.availability === avail),
    getCoreRaces: () => _playable.filter(r => r.availability === 'core'),

    // Monsters (non-playable)
    getMonsters: () => [..._monsters],
    getMonstersByCR: cr => _byCR.get(cr) || [],
    getMonstersInCRRange: (minCR, maxCR) => _monsters.filter(m => m.cr >= minCR && m.cr <= maxCR),
    getMonstersByType: type => _byType.get(type)?.filter(c => !c.playable) || [],
    getMonstersByPlane: planeId => _monsters.filter(m => {
      if (!m.planes) return planeId === 'material';
      return m.planes.includes(planeId);
    }),

    // Lookup helpers for backward compat
    getRace: id => {
      const c = _map.get(id);
      return c && c.playable ? c : null;
    },
    getMonster: id => {
      const c = _map.get(id);
      return c && !c.playable ? c : null;
    },
  });
})();
