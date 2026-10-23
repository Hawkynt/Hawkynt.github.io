;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  // Default AI tier by plane category
  const CATEGORY_AI_TIER = { prime: 1, transitive: 2, inner: 2, outer: 3, demiplane: 2 };

  const _map = new Map();
  for (const entry of (TR._pending?.planes || [])) {
    // Derive aiTier from explicit field or category default
    const aiTier = entry.aiTier ?? CATEGORY_AI_TIER[entry.category] ?? 1;
    _map.set(entry.id, Object.freeze({ ...entry, aiTier }));
  }
  delete TR._pending.planes;

  TR.PlaneRegistry = Object.freeze({
    get:    id => _map.get(id),
    getAll: ()  => [..._map.values()],
    has:    id => _map.has(id),
    filter: fn => [..._map.values()].filter(fn),
    aiTierForPlane: id => { const p = _map.get(id); return p ? p.aiTier : 1; },
  });
})();
