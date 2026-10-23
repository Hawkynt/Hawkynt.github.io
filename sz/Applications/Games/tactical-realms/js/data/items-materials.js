;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).items || (TR._pending.items = []);
  TR._pending.items.push(

    // ── Special Materials ──────────────────────────────────────────────

    {
      id: 'adamantine',
      name: 'Adamantine',
      category: 'material',
      weight: 0,
      value: 3000,
      slot: null,
      properties: ['bypass_hardness', 'damage_reduction'],
      description: 'An ultrahard metal found in meteorites and extraordinary mineral veins. Weapons made of adamantine bypass hardness less than 20, and armor grants damage reduction.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'mithral',
      name: 'Mithral',
      category: 'material',
      weight: 0,
      value: 1000,
      slot: null,
      properties: ['lightweight', 'reduced_armor_check', 'reduced_arcane_failure'],
      description: 'A very rare silvery, glistening metal that is lighter than iron but just as hard. Mithral armor is one category lighter for movement and other limitations.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'cold_iron',
      name: 'Cold Iron',
      category: 'material',
      weight: 0,
      value: 100,
      slot: null,
      properties: ['bypass_dr_cold_iron', 'anti_fey', 'anti_demon'],
      description: 'Iron mined deep underground and forged at lower temperatures to preserve its special properties. Weapons made of cold iron overcome the damage reduction of demons and fey.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'alchemical_silver',
      name: 'Alchemical Silver',
      category: 'material',
      weight: 0,
      value: 20,
      slot: null,
      properties: ['bypass_dr_silver', 'reduced_damage'],
      description: 'A complex process involving binding silver to a weapon. Alchemical silver weapons bypass the damage reduction of creatures such as lycanthropes, but deal 1 less damage.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'darkwood',
      name: 'Darkwood',
      category: 'material',
      weight: 0,
      value: 10,
      slot: null,
      properties: ['lightweight', 'masterwork'],
      description: 'A rare magic-infused wood as hard as normal wood but very light. Any wooden or mostly wooden item made from darkwood weighs half as much and is automatically masterwork.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'dragonhide',
      name: 'Dragonhide',
      category: 'material',
      weight: 0,
      value: 500,
      slot: null,
      properties: ['energy_resistance', 'non_metal_armor'],
      description: 'Armor fashioned from dragon scales. Dragonhide armor costs double masterwork armor of that type, but druids can wear it without penalty. It may grant energy resistance matching the dragon type.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'living_steel',
      name: 'Living Steel',
      category: 'material',
      weight: 0,
      value: 2500,
      slot: null,
      properties: ['self_repairing', 'bypass_hardness'],
      description: 'A gleaming steel alloy that repairs itself over time. Living steel weapons and armor slowly mend damage, restoring 1 hit point of damage per day.',
      source: 'core/Dungeon-Masters-Guide',
    },
    {
      id: 'starmetal',
      name: 'Starmetal',
      category: 'material',
      weight: 0,
      value: 5000,
      slot: null,
      properties: ['bypass_dr_alignment', 'extra_damage_outsiders'],
      description: 'A rare ore smelted from meteoric iron with traces of extraplanar minerals. Starmetal weapons deal extra damage to outsiders and can bypass alignment-based damage reduction.',
      source: 'core/Dungeon-Masters-Guide',
    }

  );
})();
