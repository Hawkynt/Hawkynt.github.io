;(function() {
  'use strict';
  const TR = window.SZ.TacticalRealms;

  // Movement mode bitmask constants
  const PassMode = Object.freeze({
    WALK:     0b00001,   // 1  - standard ground movement
    FLY:      0b00010,   // 2  - flying movement
    SWIM:     0b00100,   // 4  - swimming movement
    BURROW:   0b01000,   // 8  - burrowing through earth
    ETHEREAL: 0b10000,   // 16 - ethereal/incorporeal (phase through walls)
  });

  // Check if a creature can enter a tile
  function canTraverse(creaturePassMode, tilePassMode) {
    return (creaturePassMode & tilePassMode) !== 0;
  }

  // Derive creature passMode from race speed types + active effects
  function creaturePassMode(speeds, effects) {
    let mode = 0;
    if (speeds) {
      if (speeds.land > 0)   mode |= PassMode.WALK;
      if (speeds.fly > 0)    mode |= PassMode.FLY;
      if (speeds.swim > 0)   mode |= PassMode.SWIM;
      if (speeds.burrow > 0) mode |= PassMode.BURROW;
    }
    // Active spell/ability effects can grant movement modes
    if (effects) {
      for (const eff of effects) {
        if (eff.grantsMovement)
          mode |= eff.grantsMovement;
      }
    }
    // Default: at least WALK if no speed info
    if (mode === 0) mode = PassMode.WALK;
    return mode;
  }

  // Wall destruction mechanics
  function canDestroyObstacle(terrain) {
    return terrain && terrain.destructible && terrain.hp > 0;
  }

  // Apply damage to a destructible obstacle
  // Returns { destroyed, remainingHp, damageDealt }
  function damageObstacle(terrain, rawDamage, bypassHardness) {
    if (!terrain || !terrain.destructible)
      return { destroyed: false, remainingHp: terrain?.hp || 0, damageDealt: 0 };

    const hardness = terrain.hardness || 0;
    const effectiveHardness = bypassHardness ? Math.floor(hardness / 2) : hardness;
    const damageDealt = Math.max(0, rawDamage - effectiveHardness);
    const remainingHp = Math.max(0, (terrain.hp || 0) - damageDealt);
    const destroyed = remainingHp <= 0;

    return { destroyed, remainingHp, damageDealt };
  }

  // Strength check to break through
  // D&D 3.5e: d20 + STR mod vs breakDC
  function breakCheck(prng, strMod, breakDC) {
    const roll = prng.d20();
    const total = roll + strMod;
    return { roll, total, success: total >= breakDC };
  }

  // Spell-terrain effects consumed from data/spell-terrain-effects.js
  const _stePending = TR._pending?.spellTerrainEffects || {};
  const TERRAIN_SPELLS = Object.freeze({ ..._stePending });
  if (TR._pending) delete TR._pending.spellTerrainEffects;

  function spellInteractsWithTerrain(spellId, terrainMaterial) {
    const def = TERRAIN_SPELLS[spellId];
    if (!def) return null;
    if (def.materials && def.materials.length > 0 && !def.materials.includes(terrainMaterial)) return null;
    return def;
  }

  TR.PassMode = PassMode;
  TR.Passability = Object.freeze({
    canTraverse,
    creaturePassMode,
    canDestroyObstacle,
    damageObstacle,
    breakCheck,
    spellInteractsWithTerrain,
    TERRAIN_SPELLS,
  });
})();
