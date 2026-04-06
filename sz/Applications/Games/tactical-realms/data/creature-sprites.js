;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatureSprites || (TR._pending.creatureSprites = {});
  const cs = TR._pending.creatureSprites;

  // Creature sprite registry — maps creature templateId to sprite definition.
  // Formats: 'icon' (single image), 'anim-sheet' (spritesheet), 'anim-set' (multi-file).
  // All support optional `tint` (CSS color string).

  // --- Low Level folder (tier 0-2 enemies) ---
  cs.rat        = { type: 'icon', path: 'assets/monsters/Low Level/Icon10.png' };
  cs.goblin     = { type: 'icon', path: 'assets/monsters/Low Level/Icon15.png' };
  cs.kobold     = { type: 'icon', path: 'assets/monsters/Low Level/Icon7.png' };
  cs.wolf       = { type: 'icon', path: 'assets/monsters/Low Level/Icon4.png' };
  cs.spider     = { type: 'icon', path: 'assets/monsters/Low Level/Icon1.png' };
  cs.stirge     = { type: 'icon', path: 'assets/monsters/Low Level/Icon6.png' };
  cs.cockatrice = { type: 'icon', path: 'assets/monsters/Low Level/Icon17.png' };
  cs.bandit     = { type: 'icon', path: 'assets/monsters/Low Level/Icon5.png' };
  cs.zombie     = { type: 'icon', path: 'assets/monsters/Low Level/Icon9.png' };
  cs.skeleton   = { type: 'icon', path: 'assets/monsters/Low Level/Icon12.png' };
  cs.gnoll      = { type: 'icon', path: 'assets/monsters/Low Level/Icon3.png' };
  cs.lizardfolk = { type: 'icon', path: 'assets/monsters/Low Level/Icon11.png' };
  cs.orc        = { type: 'icon', path: 'assets/monsters/Low Level/Icon8.png' };
  cs.dire_wolf  = { type: 'icon', path: 'assets/monsters/Low Level/Icon14.png' };
  cs.hobgoblin  = { type: 'icon', path: 'assets/monsters/Low Level/Icon16.png' };
  cs.bugbear    = { type: 'icon', path: 'assets/monsters/Low Level/Icon2.png' };
  cs.harpy      = { type: 'icon', path: 'assets/monsters/Low Level/Icon18.png' };
  cs.worg       = { type: 'icon', path: 'assets/monsters/Low Level/Icon13.png' };
  cs.dark_mage  = { type: 'icon', path: 'assets/monsters/Low Level/Icon19.png' };
  cs.ghoul      = { type: 'icon', path: 'assets/monsters/Low Level/Icon20.png' };

  // --- Chaos folder (tier 3+ enemies) ---
  cs.troll           = { type: 'icon', path: 'assets/monsters/Chaos/Icon7.png' };
  cs.ogre            = { type: 'icon', path: 'assets/monsters/Chaos/Icon18.png' };
  cs.wraith          = { type: 'icon', path: 'assets/monsters/Chaos/Icon3.png' };
  cs.wight           = { type: 'icon', path: 'assets/monsters/Chaos/Icon4.png' };
  cs.basilisk        = { type: 'icon', path: 'assets/monsters/Chaos/Icon13.png' };
  cs.gargoyle        = { type: 'icon', path: 'assets/monsters/Chaos/Icon8.png' };
  cs.owlbear         = { type: 'icon', path: 'assets/monsters/Chaos/Icon5.png' };
  cs.manticore       = { type: 'icon', path: 'assets/monsters/Chaos/Icon2.png' };
  cs.phase_spider    = { type: 'icon', path: 'assets/monsters/Chaos/Icon9.png' };
  cs.minotaur        = { type: 'icon', path: 'assets/monsters/Chaos/Icon10.png' };
  cs.vampire_spawn   = { type: 'icon', path: 'assets/monsters/Chaos/Icon14.png' };
  cs.fire_elemental  = { type: 'icon', path: 'assets/monsters/Chaos/Icon16.png' };
  cs.hill_giant      = { type: 'icon', path: 'assets/monsters/Chaos/Icon20.png' };
  cs.wyvern          = { type: 'icon', path: 'assets/monsters/Chaos/Icon6.png' };
  cs.lich            = { type: 'icon', path: 'assets/monsters/Chaos/Icon15.png' };
  cs.dragon_wyrmling = { type: 'icon', path: 'assets/monsters/Chaos/Icon17.png' };
  cs.mind_flayer     = { type: 'icon', path: 'assets/monsters/Chaos/Icon12.png' };
  cs.young_dragon    = { type: 'icon', path: 'assets/monsters/Chaos/Icon6.png' };
  cs.death_knight    = { type: 'icon', path: 'assets/monsters/Chaos/Icon15.png' };
  cs.frost_giant     = { type: 'icon', path: 'assets/monsters/Chaos/Icon19.png' };
  cs.demon           = { type: 'icon', path: 'assets/monsters/Chaos/Icon11.png' };
  cs.devil           = { type: 'icon', path: 'assets/monsters/Chaos/Icon1.png' };
})();
