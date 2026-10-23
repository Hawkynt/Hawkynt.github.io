;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatureSprites || (TR._pending.creatureSprites = {});
  const cs = TR._pending.creatureSprites;

  // Creature sprite registry — maps creature templateId to sprite definition.
  // Formats: 'icon' (single image), 'anim-sheet' (spritesheet), 'anim-set' (multi-file).
  // All support optional `tint` (CSS color string) and `faces` ('left' or
  // 'right') for side-on art, so battle scenes can turn it toward the foe.
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
  cs.wolf            = { type: 'icon', path: 'assets/monsters/Chaos/Icon27.png', faces: 'left' }; // dark wolf
  cs.worg            = { type: 'icon', path: 'assets/monsters/Chaos/Icon7.png' }; // maned hound
  cs.gnoll           = { type: 'icon', path: 'assets/monsters/Chaos/Icon33.png' }; // hyena brute
  cs.orc             = { type: 'icon', path: 'assets/monsters/Chaos/Icon50.png' }; // horned brute
  cs.bugbear         = { type: 'icon', path: 'assets/monsters/Chaos/Icon35.png' }; // shaggy goblinoid
  cs.harpy           = { type: 'icon', path: 'assets/monsters/Chaos/Icon45.png' }; // feathered bird-woman
  cs.zombie          = { type: 'icon', path: 'assets/monsters/Chaos/Icon9.png' }; // rotting hulk
  cs.ghoul           = { type: 'icon', path: 'assets/monsters/Chaos/Icon24.png' }; // gaunt ghoul
  cs.skeleton        = { type: 'icon', path: 'assets/monsters/Chaos/Icon38.png' }; // skull-faced warrior
  cs.troll           = { type: 'icon', path: 'assets/monsters/Chaos/Icon41.png' }; // lanky green troll
  cs.ogre            = { type: 'icon', path: 'assets/monsters/Chaos/Icon36.png', faces: 'left' }; // club-wielding ogre
  cs.minotaur        = { type: 'icon', path: 'assets/monsters/Chaos/Icon39.png' }; // horned bull-man
  cs.basilisk        = { type: 'icon', path: 'assets/monsters/Chaos/Icon8.png', faces: 'left' }; // crawling reptile
  cs.gargoyle        = { type: 'icon', path: 'assets/monsters/Chaos/Icon43.png', faces: 'left' }; // winged stone beast
  cs.owlbear         = { type: 'icon', path: 'assets/monsters/Chaos/Icon18.png' }; // owl-faced bear
  cs.manticore       = { type: 'icon', path: 'assets/monsters/Chaos/Icon28.png' }; // scorpion-tailed lion
  cs.vampire_spawn   = { type: 'icon', path: 'assets/monsters/Chaos/Icon14.png' }; // pale winged vampire
  cs.fire_elemental  = { type: 'icon', path: 'assets/monsters/Chaos/Icon47.png' }; // living flame
  cs.frost_giant     = { type: 'icon', path: 'assets/monsters/Chaos/Icon49.png' }; // ice-blue giant
  cs.wyvern          = { type: 'icon', path: 'assets/monsters/Chaos/Icon17.png', faces: 'left' }; // dark wyvern
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

  // --- every other creature of the registry ---------------------------------
  // Matched by name first, then by creature type. Tints recolour an icon of
  // the same body plan (a red dragon is the dragon icon washed in red).
  // Humanoid shapes that only have a map token here get a paper doll in
  // battle (BattleSprites.MONSTER_LOOKS).
  const C = (n, tint, faces) => ({ type: 'icon', path: `assets/monsters/Chaos/Icon${n}.png`, ...(tint ? { tint } : {}), ...(faces ? { faces } : {}) });
  const L = (n, tint, faces) => ({ type: 'icon', path: `assets/monsters/Low Level/Icon${n}.png`, ...(tint ? { tint } : {}), ...(faces ? { faces } : {}) });
  const P = (cls, tint) => ({ type: 'sheet', sheetId: 'dungeon', rect: TR.PARTY_SPRITES && TR.PARTY_SPRITES[cls], ...(tint ? { tint } : {}) });
  const E = (id, tint) => ({ type: 'sheet', sheetId: 'dungeon', rect: TR.ENEMY_SPRITES && TR.ENEMY_SPRITES[id], ...(tint ? { tint } : {}) });
  const wash = (r, g, b, a = 0.45) => `rgba(${r},${g},${b},${a})`;

  const DRAGON_TINTS = {
    red: wash(200, 30, 10, 0.5), blue: wash(30, 80, 220, 0.5), black: wash(20, 18, 30, 0.6), white: wash(235, 245, 255, 0.6),
    green: null, brass: wash(220, 170, 60, 0.5), copper: wash(190, 100, 40, 0.5), bronze: wash(150, 110, 40, 0.5),
    silver: wash(205, 215, 230, 0.55), gold: wash(250, 205, 40, 0.5),
  };
  const ELEMENT_TINTS = {
    air: wash(225, 240, 255, 0.6), dust: wash(180, 160, 120, 0.5), earth: wash(120, 90, 60, 0.45), fire: wash(230, 70, 10, 0.4),
    ice: wash(170, 220, 255, 0.55), magma: wash(200, 40, 0, 0.5), ooze: wash(90, 140, 40, 0.5), salt: wash(240, 240, 230, 0.55),
    steam: wash(230, 230, 240, 0.5), water: wash(40, 120, 220, 0.45),
  };

  const RULES = [
    // dragons
    [/^(red|blue|black|white|green|brass|copper|bronze|silver|gold)_dragon_/, id => C(23, DRAGON_TINTS[id.split('_')[0]])],
    [/^pseudodragon$/, () => C(23, wash(150, 90, 40, 0.4))],
    // elementals and the creatures of the elemental planes
    [/^fire_elemental_/, () => C(47)],
    [/^air_elemental_/, () => C(47, ELEMENT_TINTS.air)],
    [/^earth_elemental_/, () => C(15, ELEMENT_TINTS.earth)],
    [/^water_elemental_/, () => L(23, ELEMENT_TINTS.water)],
    [/^invisible_stalker$/, () => L(25, wash(255, 255, 255, 0.45))],
    [/^mephit_(\w+)$/, id => C(22, ELEMENT_TINTS[id.slice(7)])],
    [/^azer$/, () => P('fighter', wash(230, 110, 30, 0.45))],
    [/^xorn_/, () => C(19, wash(110, 95, 80, 0.55))],
    [/^tojanida_/, () => L(5, wash(40, 110, 160, 0.4))],
    [/^salamander_/, () => C(13, wash(220, 60, 10, 0.45))],
    [/^janni$/, () => E('hill_giant', wash(200, 160, 90, 0.4))],
    [/^djinni$/, () => E('hill_giant', wash(90, 150, 255, 0.45))],
    [/^efreeti$/, () => E('hill_giant', wash(220, 40, 20, 0.5))],
    [/^marid$/, () => E('hill_giant', wash(30, 90, 200, 0.5))],
    [/^dao$/, () => E('hill_giant', wash(120, 80, 40, 0.5))],
    // fiends
    [/^lemure$/, () => L(22, wash(200, 80, 100, 0.4))],
    [/^dretch$/, () => C(10, wash(120, 90, 80, 0.35))],
    [/^imp$/, () => C(22)],
    [/^quasit$/, () => C(22, wash(60, 140, 60, 0.45))],
    [/^howler$/, () => C(27, wash(120, 60, 40, 0.4), 'left')],
    [/^barghest$/, () => C(33, wash(60, 80, 160, 0.35))],
    [/^nightmare$/, () => C(27, wash(200, 50, 0, 0.3), 'left')],
    [/^bearded_devil$/, () => C(11, wash(90, 40, 30, 0.35))],
    [/^mezzoloth$/, () => L(39, wash(110, 60, 140, 0.45))],
    [/^babau$/, () => C(24, wash(20, 15, 25, 0.5))],
    [/^chain_devil$/, () => C(38, wash(120, 120, 130, 0.45))],
    [/^succubus$/, () => C(14)],
    [/^hellcat$/, () => C(27, wash(220, 60, 20, 0.4), 'left')],
    [/^erinyes$/, () => C(14, wash(200, 30, 30, 0.4))],
    [/^bone_devil$/, () => C(34, wash(230, 220, 190, 0.35))],
    [/^night_hag$/, () => C(24, wash(110, 50, 140, 0.45))],
    [/^vrock$/, () => C(17, wash(110, 120, 60, 0.3))],
    [/^rakshasa$/, () => C(27, wash(230, 140, 30, 0.45), 'left')],
    [/^nycaloth$/, () => C(37, wash(40, 110, 60, 0.45))],
    [/^barbed_devil$/, () => C(39, wash(150, 30, 20, 0.35))],
    [/^hezrou$/, () => L(48, wash(60, 70, 50, 0.4))],
    [/^retriever/, () => C(46, wash(80, 60, 50, 0.35))],
    [/^arcanaloth$/, () => C(33, wash(120, 60, 160, 0.4))],
    [/^glabrezu$/, () => C(19)],
    [/^ice_devil$/, () => L(39, wash(170, 220, 255, 0.55))],
    [/^ultroloth$/, () => C(26, wash(150, 150, 160, 0.5))],
    [/^nalfeshnee$/, () => C(30, wash(140, 50, 30, 0.35))],
    [/^horned_devil$/, () => C(11, wash(40, 20, 30, 0.45))],
    [/^marilith$/, () => C(13, wash(40, 140, 80, 0.4))],
    [/^balor$/, () => C(37)],
    [/^pit_fiend$/, () => C(37, wash(90, 0, 10, 0.4))],
    // aberrations
    [/^choker$/, () => C(24, wash(90, 110, 80, 0.4))],
    [/^darkmantle/, () => L(38, wash(30, 25, 40, 0.45))],
    [/^piercer$/, () => C(3, wash(120, 110, 100, 0.35))],
    [/^ettercap$/, () => C(31)],
    [/^ethereal_filcher/, () => C(26, wash(90, 120, 200, 0.4))],
    [/^grell$/, () => C(29, wash(220, 120, 140, 0.35))],
    [/^grick/, () => C(3)],
    [/^neogi$/, () => C(2)],
    [/^rust_monster/, () => C(5, wash(190, 90, 30, 0.5))],
    [/^carrion_crawler/, () => C(25)],
    [/^mimic/, () => C(40, wash(120, 80, 40, 0.45))],
    [/^otyugh/, () => C(20)],
    [/^cloaker/, () => L(38, wash(15, 10, 20, 0.55))],
    [/^gibbering_mouther/, () => C(21)],
    [/^will_o_wisp$/, () => C(47, wash(160, 210, 255, 0.6))],
    [/^eye_of_the_deep$/, () => C(42, wash(40, 100, 160, 0.4))],
    [/^aboleth$/, () => C(3, wash(40, 130, 130, 0.45))],
    [/^chuul$/, () => C(48, wash(40, 120, 110, 0.4))],
    [/^drider$/, () => C(46, wash(90, 40, 120, 0.45))],
    [/^intellect_devourer$/, () => C(29, wash(230, 140, 160, 0.4))],
    [/^phasm$/, () => L(28, wash(150, 90, 200, 0.45))],
    [/^umber_hulk$/, () => C(19, wash(40, 30, 20, 0.5))],
    [/^athach/, () => C(32)],
    [/^destrachan$/, () => C(8, wash(120, 110, 90, 0.45), 'left')],
    [/^mind_flayer/, () => C(44)],
    [/^naga_dark$/, () => C(13, wash(70, 40, 110, 0.45))],
    [/^naga_spirit$/, () => C(13, wash(20, 60, 30, 0.45))],
    [/^naga_guardian$/, () => C(13, wash(240, 190, 60, 0.3))],
    [/^delver$/, () => C(40, wash(110, 110, 120, 0.45))],
    [/^roper/, () => C(25, wash(120, 110, 100, 0.5))],
    [/^beholder/, () => C(42, wash(150, 90, 60, 0.35))],
    // animals
    [/^toad$/, () => L(48)],
    [/^cat$/, () => C(27, wash(180, 120, 60, 0.4), 'left')],
    [/^raven$/, () => L(47, wash(20, 20, 30, 0.65))],
    [/^(hawk|eagle)$/, () => L(47, wash(130, 90, 50, 0.45))],
    [/^owl$/, () => L(47, wash(150, 130, 100, 0.35))],
    [/^weasel$/, () => L(46, wash(150, 100, 50, 0.35))],
    [/^(dire_)?bat$/, id => id === 'bat' ? L(38) : L(34)],
    [/^swarm_bat$/, () => L(38, wash(60, 30, 30, 0.3))],
    [/^(monkey|dire_ape)$/, () => C(18)],
    [/^dog$/, () => C(7, wash(160, 110, 60, 0.4))],
    [/^(badger|dire_wolverine)$/, () => L(31)],
    [/snake/, id => C(3, /viper/.test(id) ? wash(60, 130, 50, 0.45) : wash(110, 90, 50, 0.45))],
    [/^hyena$/, () => C(33, wash(160, 130, 80, 0.3))],
    [/^(pony|donkey|mule|horse_light|horse_heavy|warhorse_heavy)$/, id => C(6, wash(130, 85, 45, /heavy/.test(id) ? 0.6 : 0.5))],
    [/^bison$/, () => C(6, wash(80, 55, 35, 0.6))],
    [/^(dire_)?boar$/, () => L(43)],
    [/^(leopard|cheetah)$/, () => C(27, wash(220, 170, 60, 0.45), 'left')],
    [/^(dire_)?lion$/, () => C(27, wash(210, 150, 60, 0.5), 'left')],
    [/^(dire_)?tiger$/, () => C(27, wash(230, 110, 20, 0.5), 'left')],
    [/^(crocodile|crocodile_giant|monitor_lizard)$/, () => C(8, wash(70, 110, 50, 0.5), 'left')],
    [/^shark_|^porpoise$|^manta_ray$|^whale_/, () => C(3, wash(70, 100, 140, 0.5))],
    [/^(squid|octopus)$/, id => C(25, id === 'octopus' ? wash(200, 80, 60, 0.45) : wash(200, 200, 220, 0.45))],
    [/^bear_(\w+)$|^dire_bear$/, id => C(18, id === 'bear_polar' ? wash(240, 240, 235, 0.6) : id === 'bear_black' ? wash(25, 20, 20, 0.5) : wash(110, 70, 40, 0.35))],
    [/^(elephant|rhinoceros)$/, id => C(32, id === 'rhinoceros' ? wash(120, 120, 120, 0.45) : wash(150, 140, 130, 0.35))],
    [/^dire_rat$/, () => L(46, wash(40, 30, 30, 0.4))],
    [/^swarm_rat$/, () => L(46, wash(80, 60, 50, 0.25))],
    // vermin
    [/^giant_ant_/, id => C(4, id === 'giant_ant_soldier' ? wash(180, 30, 20, 0.5) : wash(90, 50, 30, 0.5))],
    [/^giant_(bee|wasp)$/, id => L(42, id === 'giant_bee' ? null : wash(30, 30, 30, 0.25))],
    [/^giant_centipede$/, () => C(25, wash(150, 70, 30, 0.45))],
    [/^giant_spider_/, () => L(35)],
    [/^giant_scorpion_/, () => C(48, wash(140, 90, 40, 0.4))],
    [/^swarm_spider$/, () => L(36)],
    [/^swarm_locust$/, () => L(39, wash(140, 110, 50, 0.4))],
    // constructs
    [/^homunculus$/, () => C(22, wash(100, 120, 90, 0.5))],
    [/^iron_cobra$/, () => C(3, wash(70, 75, 85, 0.55))],
    [/^animated_object_/, () => E('gargoyle', wash(130, 90, 50, 0.4))],
    [/^stone_defender$|^stone_golem$/, () => C(49, wash(140, 135, 125, 0.6))],
    [/^nimblewright$|^shield_guardian$/, () => P('paladin', wash(160, 140, 90, 0.35))],
    [/^flesh_golem$/, () => C(9, wash(210, 160, 140, 0.45))],
    [/^clay_golem$/, () => C(9, wash(160, 110, 70, 0.55))],
    [/^iron_golem$/, () => C(49, wash(60, 60, 70, 0.6))],
    [/^mithral_golem$/, () => C(49, wash(220, 230, 240, 0.55))],
    [/^adamantine_golem$/, () => C(49, wash(30, 50, 40, 0.6))],
    [/^inevitable_/, () => P('paladin', wash(230, 190, 60, 0.4))],
    // fey
    [/^grig$/, () => L(39, wash(110, 160, 60, 0.3))],
    [/^thorn$/, () => L(12)],
    [/^campestri$/, () => L(3)],
    [/^redcap$/, () => L(44)],
    [/^(killmoulis|brownie|quickling|korred)$/, () => P('rogue', wash(120, 80, 40, 0.4))],
    [/^(sprite|pixie|atomie)$/, () => P('rogue', wash(120, 200, 255, 0.4))],
    [/^(nixie|nereid)$/, () => P('cleric', wash(60, 160, 200, 0.45))],
    [/^(dryad|nymph)$/, () => P('cleric', wash(100, 180, 80, 0.35))],
    [/^(satyr|fossergrim)$/, () => P('barbarian', wash(130, 90, 50, 0.35))],
    // giants
    [/^(firbolg|verbeeg|ettin|fomorian)$/, id => E('hill_giant', id === 'fomorian' ? wash(120, 90, 80, 0.4) : wash(170, 120, 80, 0.3))],
    [/^cyclops$/, () => E('hill_giant')],
    [/^stone_giant$/, () => C(49, wash(140, 135, 125, 0.55))],
    [/^fire_giant$/, () => C(49, wash(200, 60, 20, 0.5))],
    [/^cloud_giant$/, () => C(49, wash(230, 235, 245, 0.5))],
    [/^storm_giant$/, () => C(49, wash(70, 160, 140, 0.45))],
    // magical beasts
    [/^hippogriff$/, () => L(47, wash(140, 100, 60, 0.45))],
    [/^griffon$/, () => L(47, wash(210, 160, 60, 0.45))],
    [/^ankheg$/, () => C(5, wash(150, 100, 50, 0.5))],
    [/^(pegasus|unicorn)$/, () => C(6, wash(250, 250, 255, 0.55))],
    [/^displacer_beast$/, () => C(27, wash(60, 50, 140, 0.4), 'left')],
    [/^winter_wolf$/, () => C(27, wash(225, 240, 255, 0.6), 'left')],
    [/^hydra_/, () => C(3, wash(60, 120, 50, 0.5))],
    [/^bulette$/, () => C(40, wash(80, 100, 130, 0.5))],
    [/^chimera$/, () => C(28, wash(120, 60, 30, 0.3))],
    [/^remorhaz$/, () => C(25, wash(200, 220, 255, 0.5))],
    [/^behir$/, () => C(13, wash(40, 90, 200, 0.5))],
    [/^kraken$/, () => C(25, wash(120, 20, 30, 0.5))],
    [/^purple_worm$/, () => C(3, wash(110, 40, 150, 0.55))],
    [/^tarrasque$/, () => C(8, wash(90, 100, 40, 0.5), 'left')],
    // oozes and plants
    [/^gelatinous_cube$/, () => L(27)],
    [/^gray_ooze$/, () => L(28, wash(140, 140, 140, 0.6))],
    [/^green_slime$/, () => L(30)],
    [/^ochre_jelly$/, () => L(26)],
    [/^black_pudding$/, () => L(22, wash(15, 15, 20, 0.6))],
    [/^myconid$/, () => L(6)],
    [/^yellow_musk_creeper$/, () => L(18)],
    [/^assassin_vine$/, () => L(12, wash(40, 90, 30, 0.3))],
    [/^phantom_fungus$/, () => L(6, wash(220, 220, 240, 0.5))],
    [/^violet_fungus$/, () => L(8, wash(130, 60, 170, 0.5))],
    [/^shambling_mound$/, () => L(24, wash(40, 70, 30, 0.45))],
    [/^tendriculos$/, () => L(7)],
    [/^treant$/, () => L(2, wash(90, 110, 50, 0.45))],
    // undead
    [/^shadow$/, () => L(25, wash(10, 10, 20, 0.7))],
    [/^ghast$/, () => C(24, wash(80, 110, 70, 0.35))],
    [/^allip$/, () => L(25, wash(120, 70, 160, 0.5))],
    [/^spectre$/, () => L(25, wash(40, 50, 120, 0.5))],
    [/^banshee$/, () => L(25, wash(170, 230, 170, 0.5))],
    [/^mummy$/, () => E('wight', wash(200, 180, 130, 0.5))],
    [/^vampire$/, () => C(14, wash(120, 0, 20, 0.35))],
    [/^bodak$/, () => C(24, wash(30, 30, 30, 0.55))],
    [/^mohrg$/, () => C(38, wash(150, 30, 20, 0.35))],
    [/^demilich$/, () => C(16)],
    // humanoids
    [/^troglodyte$/, () => C(10, wash(90, 110, 80, 0.5))],
    [/^drow_warrior$/, () => P('rogue', wash(40, 20, 60, 0.55))],
    [/^duergar_warrior$/, () => P('fighter', wash(110, 110, 120, 0.5))],
    [/^githyanki_warrior$/, () => P('fighter', wash(170, 170, 60, 0.45))],
    [/^githzerai_monk$/, () => P('barbarian', wash(170, 170, 60, 0.4))],
    [/^sahuagin$/, () => C(8, wash(30, 110, 100, 0.45), 'left')],
    [/^centaur$/, () => C(6, wash(140, 95, 50, 0.5))],
    [/^yuan_ti/, () => C(13, wash(70, 120, 60, 0.4))],
    [/^medusa$/, () => C(13, wash(60, 150, 90, 0.35))],
    // the folk of the other planes
    [/^lantern_archon$/, () => C(47, wash(255, 240, 160, 0.6))],
    [/^(hound|trumpet)_archon$/, id => P('paladin', id === 'hound_archon' ? wash(200, 170, 110, 0.35) : wash(240, 220, 140, 0.4))],
    [/^(astral_deva|planetar|solar)$/, id => P('cleric', id === 'planetar' ? wash(110, 200, 120, 0.4) : id === 'solar' ? wash(255, 220, 90, 0.45) : wash(230, 230, 255, 0.4))],
    [/^(bralani|ghaele)_eladrin$/, id => P('ranger', id === 'ghaele_eladrin' ? wash(255, 230, 150, 0.4) : wash(170, 220, 255, 0.4))],
    [/^avoral_guardinal$/, () => L(47, wash(240, 240, 250, 0.55))],
    [/^leonal_guardinal$/, () => C(27, wash(230, 180, 70, 0.5), 'left')],
    [/^red_slaad$/, () => L(48, wash(200, 40, 30, 0.5))],
    [/^blue_slaad$/, () => L(48, wash(40, 80, 200, 0.5))],
    [/^green_slaad$/, () => L(48, wash(40, 160, 50, 0.4))],
    [/^gray_slaad$/, () => L(48, wash(140, 140, 150, 0.6))],
    [/^death_slaad$/, () => L(48, wash(30, 25, 35, 0.6))],
    [/^chaos_beast$/, () => C(21, wash(170, 60, 200, 0.4))],
    [/^formian_/, id => C(4, id === 'formian_myrmarch' ? wash(230, 180, 60, 0.5) : id === 'formian_taskmaster' ? wash(200, 140, 60, 0.5) : wash(190, 110, 40, 0.5))],
    [/^hell_hound$/, () => C(7, wash(200, 40, 10, 0.5))],
    [/^yeth_hound$/, () => C(7, wash(70, 70, 80, 0.55))],
    [/^shadow_mastiff$/, () => C(7, wash(15, 15, 25, 0.7))],
    [/^blink_dog$/, () => C(7, wash(220, 180, 80, 0.45))],
    [/^vargouille$/, () => L(38, wash(150, 90, 120, 0.4))],
    [/^achaierai$/, () => L(47, wash(40, 30, 50, 0.6))],
    [/^bebilith$/, () => L(35, wash(90, 40, 120, 0.45))],
    [/^nightwalker$/, () => L(25, wash(5, 5, 10, 0.75))],
    [/^ravid$/, () => C(3, wash(255, 250, 220, 0.55))],
    [/^arrowhawk_/, () => L(47, wash(120, 190, 255, 0.5))],
    [/^belker$/, () => C(47, wash(110, 110, 120, 0.6))],
    [/^magmin$/, () => C(47, wash(255, 130, 30, 0.35))],
    [/^thoqqua$/, () => C(3, wash(230, 90, 20, 0.5))],
    [/^rast$/, () => L(42, wash(220, 60, 20, 0.5))],
    [/^frost_worm$/, () => C(3, wash(220, 240, 255, 0.6))],
    [/^lillend$/, () => C(13, wash(220, 120, 220, 0.35))],
    [/^triton$/, () => P('cleric', wash(60, 160, 200, 0.45))],
    [/^xill$/, () => C(43, wash(200, 60, 40, 0.45))],
  ];

  // anything still unmatched falls back on its creature type
  const BY_TYPE = {
    aberration: () => C(29), animal: () => C(7, wash(140, 100, 60, 0.35)), construct: () => C(49, wash(140, 135, 125, 0.6)),
    dragon: () => C(23), elemental: () => C(47), fey: () => P('cleric', wash(100, 180, 80, 0.35)), giant: () => E('hill_giant'),
    humanoid: () => E('bandit'), magical_beast: () => C(28), monstrous_humanoid: () => C(43), ooze: () => L(28),
    outsider: () => C(37, wash(60, 30, 90, 0.35)), plant: () => L(11), undead: () => C(24), vermin: () => L(35),
  };

  const reg = TR.CreatureRegistry;
  if (reg)
    for (const m of reg.getMonsters()) {
      if (cs[m.id])
        continue;
      const rule = RULES.find(([re]) => re.test(m.id));
      const make = rule ? rule[1] : BY_TYPE[m.type];
      if (make)
        cs[m.id] = make(m.id);
    }
})();
