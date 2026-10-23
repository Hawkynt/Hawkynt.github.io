;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  // -- TerrainRegistry ------------------------------------------------------

  const _terrainMap = new Map();
  for (const entry of (TR._pending?.terrainTypes || []))
    _terrainMap.set(entry.id, Object.freeze(entry));
  delete TR._pending.terrainTypes;

  TR.TerrainRegistry = Object.freeze({
    get:    id => _terrainMap.get(id),
    getAll: ()  => [..._terrainMap.values()],
    has:    id => _terrainMap.has(id),
    filter: fn => [..._terrainMap.values()].filter(fn),
  });

  // -- BiomeRegistry --------------------------------------------------------

  const _biomeMap = new Map();
  for (const entry of (TR._pending?.biomes || []))
    _biomeMap.set(entry.id, Object.freeze(entry));
  delete TR._pending.biomes;

  TR.BiomeRegistry = Object.freeze({
    get:    id => _biomeMap.get(id),
    getAll: ()  => [..._biomeMap.values()],
    has:    id => _biomeMap.has(id),
    filter: fn => [..._biomeMap.values()].filter(fn),
  });
})();
