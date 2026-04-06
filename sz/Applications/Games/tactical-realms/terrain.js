;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // All terrain data comes from data/terrain-types.js via TerrainRegistry
  function _resolve(id) {
    if (TR.TerrainRegistry) {
      const reg = TR.TerrainRegistry.get(id);
      if (reg) return reg;
    }
    return null;
  }

  function _allTerrain() {
    return TR.TerrainRegistry ? TR.TerrainRegistry.getAll() : [];
  }

  const Terrain = {
    get TERRAIN_TYPES() { return _allTerrain(); },

    byId(id) {
      return _resolve(id);
    },

    moveCost(id) {
      const t = _resolve(id);
      return t ? t.moveCost : Infinity;
    },

    coverBonus(id) {
      const t = _resolve(id);
      return t ? t.coverAC : 0;
    },

    attackMod(id) {
      const t = _resolve(id);
      return t ? t.attackMod : 0;
    },

    passMode(id) {
      const t = _resolve(id);
      if (!t) return 0b00001;
      if (t.passMode !== undefined) return t.passMode;
      if (t.moveCost >= 99) {
        if (t.id === 'water' || t.id === 'deep_water') return 0b00110;
        if (t.id === 'lava') return 0b00010;
        return 0b10000;
      }
      return 0b00001;
    },

    concealment(id) {
      const t = _resolve(id);
      if (!t) return 0;
      if (t.concealment !== undefined) return t.concealment;
      return 0;
    },

    isDestructible(id) {
      const t = _resolve(id);
      return !!(t && t.destructible);
    },

    destructibleInfo(id) {
      const t = _resolve(id);
      if (!t || !t.destructible) return null;
      return { hardness: t.hardness || 0, hp: t.hp || 0, breakDC: t.breakDC || 25, breaksInto: t.breaksInto || 'rubble' };
    },

    allIds() {
      return _allTerrain().map(t => t.id);
    },

    getAll() {
      return _allTerrain();
    },
  };

  TR.Terrain = Terrain;
})();
