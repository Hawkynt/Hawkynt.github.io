;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatureTypes || (TR._pending.creatureTypes = {});
  const ct = TR._pending.creatureTypes;

  // D&D 3.5e SRD creature type classifications
  // Drives hit die, BAB progression, and save progressions for monsters
  ct.aberration          = { hitDie: 8,  bab: 'medium', goodSaves: ['will'] };
  ct.animal              = { hitDie: 8,  bab: 'medium', goodSaves: ['fort', 'ref'] };
  ct.construct           = { hitDie: 10, bab: 'medium', goodSaves: [] };
  ct.dragon              = { hitDie: 12, bab: 'full',   goodSaves: ['fort', 'ref', 'will'] };
  ct.elemental           = { hitDie: 8,  bab: 'medium', goodSaves: ['ref'] };
  ct.fey                 = { hitDie: 6,  bab: 'poor',   goodSaves: ['ref', 'will'] };
  ct.giant               = { hitDie: 8,  bab: 'medium', goodSaves: ['fort'] };
  ct.humanoid            = { hitDie: 8,  bab: 'medium', goodSaves: ['fort'] };
  ct.magical_beast       = { hitDie: 10, bab: 'full',   goodSaves: ['fort', 'ref'] };
  ct.monstrous_humanoid  = { hitDie: 8,  bab: 'full',   goodSaves: ['ref', 'will'] };
  ct.ooze                = { hitDie: 10, bab: 'medium', goodSaves: [] };
  ct.outsider            = { hitDie: 8,  bab: 'full',   goodSaves: ['fort', 'ref', 'will'] };
  ct.plant               = { hitDie: 8,  bab: 'medium', goodSaves: ['fort'] };
  ct.undead              = { hitDie: 12, bab: 'poor',   goodSaves: ['will'] };
  ct.vermin              = { hitDie: 8,  bab: 'medium', goodSaves: ['fort'] };
})();
