;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).spellTerrainEffects || (TR._pending.spellTerrainEffects = {});
  const ste = TR._pending.spellTerrainEffects;

  // Spells that interact with terrain/obstacles.
  // Each spell defines what it can do to terrain and which materials it affects.
  // This is the single source of truth for spell-terrain interactions.

  ste.disintegrate           = { action: 'destroy', instantKill: true, materials: ['stone', 'wood', 'iron', 'earth'] };
  ste.passwall               = { action: 'bypass', duration: 10, materials: ['stone', 'wood', 'earth'] };
  ste.stone_shape            = { action: 'reshape', materials: ['stone'] };
  ste.shatter                = { action: 'damage', bonusDamage: 40, materials: ['stone', 'crystal', 'glass'] };
  ste.knock                  = { action: 'unlock', materials: ['iron', 'wood'] };
  ste.warp_wood              = { action: 'damage', bonusDamage: 20, materials: ['wood'] };
  ste.transmute_rock_to_mud  = { action: 'destroy', materials: ['stone'] };
  ste.move_earth             = { action: 'reshape', materials: ['earth'] };
  ste.wall_of_stone          = { action: 'create', creates: 'stone_wall', materials: [] };
  ste.wall_of_fire           = { action: 'create', creates: 'fire_wall', materials: [] };
  ste.wall_of_ice            = { action: 'create', creates: 'ice_wall', materials: [] };
  ste.wall_of_force          = { action: 'create', creates: 'force_wall', materials: [] };
  ste.earthquake             = { action: 'destroy', materials: ['stone', 'earth', 'wood'] };
  ste.control_water          = { action: 'reshape', materials: ['water'] };
  ste.control_weather        = { action: 'reshape', materials: ['air'] };
})();
