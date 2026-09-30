;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatureSprites || (TR._pending.creatureSprites = {});
  const cs = TR._pending.creatureSprites;

  // Creature sprite registry — maps creature templateId to sprite definition.
  // Formats: 'icon' (single image), 'anim-sheet' (spritesheet), 'anim-set' (multi-file).
  // All support optional `tint` (CSS color string).
  // Every icon was matched by looking at it (tools/sheet-preview.html). Creatures
  // without a fitting icon use a dungeon-sheet sprite instead (bottom of file).

  // --- Low Level folder ---
  cs.rat          = { type: 'icon', path: 'assets/monsters/Low Level/Icon46.png' }; // fat rat
  cs.spider       = { type: 'icon', path: 'assets/monsters/Low Level/Icon35.png' }; // giant spider
  cs.phase_spider = { type: 'icon', path: 'assets/monsters/Low Level/Icon32.png' }; // violet spider
  cs.stirge       = { type: 'icon', path: 'assets/monsters/Low Level/Icon42.png' }; // blood-sucking wasp
  cs.cockatrice   = { type: 'icon', path: 'assets/monsters/Low Level/Icon47.png' }; // rooster beast
  cs.dire_wolf    = { type: 'icon', path: 'assets/monsters/Low Level/Icon43.png' }; // red-eyed dire beast
  cs.lizardfolk   = { type: 'icon', path: 'assets/monsters/Low Level/Icon48.png' }; // spined reptile
  cs.wraith       = { type: 'icon', path: 'assets/monsters/Low Level/Icon25.png' }; // spectral figure

  // --- Chaos folder ---
  cs.goblin          = { type: 'icon', path: 'assets/monsters/Chaos/Icon12.png' }; // green goblin with blade
  cs.kobold          = { type: 'icon', path: 'assets/monsters/Chaos/Icon10.png' }; // small tailed reptilian
  cs.wolf            = { type: 'icon', path: 'assets/monsters/Chaos/Icon27.png' }; // dark wolf
  cs.worg            = { type: 'icon', path: 'assets/monsters/Chaos/Icon7.png' }; // maned hound
  cs.gnoll           = { type: 'icon', path: 'assets/monsters/Chaos/Icon33.png' }; // hyena brute
  cs.orc             = { type: 'icon', path: 'assets/monsters/Chaos/Icon50.png' }; // horned brute
  cs.bugbear         = { type: 'icon', path: 'assets/monsters/Chaos/Icon35.png' }; // shaggy goblinoid
  cs.harpy           = { type: 'icon', path: 'assets/monsters/Chaos/Icon45.png' }; // feathered bird-woman
  cs.zombie          = { type: 'icon', path: 'assets/monsters/Chaos/Icon9.png' }; // rotting hulk
  cs.ghoul           = { type: 'icon', path: 'assets/monsters/Chaos/Icon24.png' }; // gaunt ghoul
  cs.skeleton        = { type: 'icon', path: 'assets/monsters/Chaos/Icon38.png' }; // skull-faced warrior
  cs.troll           = { type: 'icon', path: 'assets/monsters/Chaos/Icon41.png' }; // lanky green troll
  cs.ogre            = { type: 'icon', path: 'assets/monsters/Chaos/Icon36.png' }; // club-wielding ogre
  cs.minotaur        = { type: 'icon', path: 'assets/monsters/Chaos/Icon39.png' }; // horned bull-man
  cs.basilisk        = { type: 'icon', path: 'assets/monsters/Chaos/Icon8.png' }; // crawling reptile
  cs.gargoyle        = { type: 'icon', path: 'assets/monsters/Chaos/Icon43.png' }; // winged stone beast
  cs.owlbear         = { type: 'icon', path: 'assets/monsters/Chaos/Icon18.png' }; // owl-faced bear
  cs.manticore       = { type: 'icon', path: 'assets/monsters/Chaos/Icon28.png' }; // scorpion-tailed lion
  cs.vampire_spawn   = { type: 'icon', path: 'assets/monsters/Chaos/Icon14.png' }; // pale winged vampire
  cs.fire_elemental  = { type: 'icon', path: 'assets/monsters/Chaos/Icon47.png' }; // living flame
  cs.frost_giant     = { type: 'icon', path: 'assets/monsters/Chaos/Icon49.png' }; // ice-blue giant
  cs.wyvern          = { type: 'icon', path: 'assets/monsters/Chaos/Icon17.png' }; // dark wyvern
  cs.dragon_wyrmling = { type: 'icon', path: 'assets/monsters/Chaos/Icon23.png' }; // young green dragon
  cs.lich            = { type: 'icon', path: 'assets/monsters/Chaos/Icon34.png' }; // skull-crowned sorcerer
  cs.mind_flayer     = { type: 'icon', path: 'assets/monsters/Chaos/Icon44.png' }; // tentacle-faced aberration
  cs.demon           = { type: 'icon', path: 'assets/monsters/Chaos/Icon37.png' }; // red winged demon
  cs.devil           = { type: 'icon', path: 'assets/monsters/Chaos/Icon11.png' }; // horned devil

  // --- tinted variants ---
  cs.young_dragon = { type: 'icon', path: 'assets/monsters/Chaos/Icon23.png', tint: 'rgba(160,20,10,0.35)' }; // young red dragon
  cs.death_knight = { type: 'icon', path: 'assets/monsters/Chaos/Icon38.png', tint: 'rgba(40,0,20,0.45)' }; // blackened skull knight

  // --- dungeon sheet (no fitting icon) ---
  const sheet = id => ({ type: 'sheet', sheetId: 'dungeon', rect: TR.ENEMY_SPRITES && TR.ENEMY_SPRITES[id] });
  cs.bandit     = sheet('bandit');     // green-bandana brigand
  cs.hobgoblin  = { ...sheet('hobgoblin'), tint: 'rgba(150,60,20,0.35)' };
  cs.dark_mage  = sheet('dark_mage');  // hooded caster
  cs.wight      = { ...sheet('wight'), tint: 'rgba(20,40,120,0.35)' };
  cs.hill_giant = sheet('hill_giant'); // cyclops
})();
