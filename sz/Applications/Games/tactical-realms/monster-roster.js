;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Who lives where, and how many of them make a fair fight.
  //
  // forBiome() gathers the creatures of a biome: its encounter table first,
  // then every creature of the registry whose kind fits the land (frost
  // creatures on the tundra, the aquatic ones in the sea, fiends in the
  // lower planes). encounter() builds a group whose encounter level matches
  // the party's level, preferring a pack of one kind over a mixed crowd.
  //
  // Encounter levels follow the open rules: two creatures of CR c are EL
  // c + 2, four are c + 4, and so on; that is, every creature counts with
  // a "power" of 2^(CR/2) and a group's EL is 2 * log2 of the summed power.

  const SQRT2 = Math.SQRT2;
  const MAX_GROUP = 6;

  // overworld and dungeon biome names to the biome registry's ids
  const ALIASES = Object.freeze({
    forest: 'temperate_forest', woods: 'temperate_forest', plains: 'temperate_plains', grassland: 'temperate_plains', road: 'temperate_plains',
    hills: 'hill', mountains: 'mountain', peaks: 'mountain', desert: 'desert_sand', badlands: 'desert_rock', mesa: 'desert_rock',
    snow: 'arctic_tundra', tundra: 'arctic_tundra', taiga: 'arctic_tundra', frozen: 'arctic_glacier', glacier: 'arctic_glacier', ice: 'arctic_glacier',
    jungle: 'tropical_jungle', rainforest: 'tropical_jungle', savanna: 'temperate_plains', bog: 'marsh', wetland: 'marsh',
    cave: 'underground', cavern: 'underground', dungeon: 'underground', underdark: 'underground', crypt: 'shadow',
    lava: 'lava_field', volcanic: 'lava_field', volcano: 'lava_field', ash: 'ash_waste', infernal: 'infernal_waste', hell: 'infernal_waste',
    ocean: 'underwater_reef', sea: 'underwater_reef', coast: 'underwater_reef', beach: 'underwater_reef', water: 'underwater_reef', deep: 'underwater_deep',
    feywild: 'feywild_grove', celestial: 'celestial_garden', ruins: 'temperate_plains',
  });

  // What else fits each biome besides its table.
  const KIN = Object.freeze({
    arctic_tundra:    { re: /white_dragon|frost|ice|winter|polar|yeti/, subtypes: ['cold'] },
    arctic_glacier:   { re: /white_dragon|silver_dragon|frost|ice|winter|polar/, subtypes: ['cold'] },
    desert_sand:      { re: /blue_dragon|brass_dragon|scorpion|mummy|dust|salt|gnoll|hyena|janni|sphinx|camel/ },
    desert_rock:      { re: /blue_dragon|brass_dragon|basilisk|manticore|scorpion|lion|medusa|bulette|cockatrice/ },
    temperate_forest: { re: /green_dragon|wolf|bear|boar|owl|spider|ettercap|dryad|treant|elk|dire_(?!rat)|satyr|assassin_vine|centaur/, types: ['fey'] },
    tropical_jungle:  { re: /green_dragon|snake|ape|monkey|tiger|leopard|yuan_ti|lizard|vine|shambling|crocodile|spider/ },
    temperate_plains: { re: /goblin|kobold|bandit|gnoll|ankheg|bulette|horse|pony|bison|hawk|eagle|wolf|centaur|griffon|hippogriff|lion|orc\b|^orc$/ },
    swamp:            { re: /black_dragon|lizard|troll|wisp|hag|shambling|hydra|crocodile|toad|naga|ochre|otyugh|stirge/ },
    marsh:            { re: /black_dragon|lizard|stirge|toad|wisp|crocodile|troglodyte|giant_centipede|leech|shambling/ },
    mountain:         { re: /red_dragon|silver_dragon|giant|griffon|wyvern|chimera|eagle|hippogriff|ettin|ogre|manticore|harpy|goat/ },
    hill:             { re: /ogre|goblin|hobgoblin|bugbear|hill_giant|worg|ettin|troll|orc|copper_dragon|dwarf|badger/ },
    underground:      { re: /drow|duergar|mind_flayer|beholder|umber|drider|purple_worm|aboleth|grick|carrion|choker|darkmantle|piercer|roper|cloaker|otyugh|ooze|jelly|pudding|cube|myconid|fungus|troglodyte|delver|neogi|grell|xorn|rust_monster|chuul|gibbering|destrachan|kobold|ant_|centipede|spider|bat|rat/, types: ['ooze', 'aberration'] },
    underwater_reef:  { re: /sahuagin|nixie|nereid|shark|octopus|squid|porpoise|manta|water_elemental|tojanida|bronze_dragon|crocodile|chuul/, subtypes: ['aquatic'] },
    underwater_deep:  { re: /kraken|aboleth|sahuagin|squid|shark|whale|water_elemental|eye_of_the_deep/, subtypes: ['aquatic'] },
    lava_field:       { re: /fire|red_dragon|salamander|magma|efreeti|azer|hellcat/, subtypes: ['fire'] },
    ash_waste:        { re: /fire|dust|magma|salamander|bodak|skeleton|zombie|wight|mohrg/ },
    cloud:            { re: /air_elemental|djinni|cloud_giant|storm_giant|pegasus|griffon|hippogriff|silver_dragon|eagle|invisible_stalker/, subtypes: ['air'] },
    shadow:           { types: ['undead'] },
    astral_void:      { re: /githyanki|githzerai|mind_flayer|intellect_devourer|silver_dragon/ },
    ethereal_mist:    { re: /phase|ethereal|phasm|night_hag|allip|spectre|ghost|wraith/, subtypes: ['incorporeal'] },
    infernal_waste:   { re: /devil|imp$|lemure|hellcat|erinyes|barghest|nightmare|night_hag|loth$/, subtypes: ['lawful'] },
    celestial_garden: { re: /unicorn|pegasus|griffon|lion|gold_dragon|silver_dragon|inevitable|nymph/ },
    feywild_grove:    { re: /green_dragon|unicorn|treant|vine|owl/, types: ['fey'] },
    abyss:            { re: /demon|dretch|vrock|balor|marilith|hezrou|glabrezu|quasit|babau|succubus|nalfeshnee|howler|retriever_fiend|loth$/, subtypes: ['chaotic'] },
    elemental_fire:   { re: /fire|salamander|magma|efreeti|azer/, subtypes: ['fire'] },
    elemental_water:  { re: /water|marid|tojanida/, subtypes: ['water'] },
    elemental_earth:  { re: /earth|dao|xorn|salt/, subtypes: ['earth'] },
    elemental_air:    { re: /air|djinni|invisible_stalker|dust/, subtypes: ['air'] },
    mechanus_grid:    { re: /inevitable|golem|iron_cobra|shield_guardian|nimblewright|animated_object|homunculus/ },
  });

  const registry = () => TR.CreatureRegistry || null;
  const legacy = () => (TR.CombatEngine && TR.CombatEngine.ENEMY_TEMPLATES) || {};

  // The creature's challenge rating, or null when the game cannot spawn it.
  function crOf(id) {
    const r = registry();
    const m = r ? r.getMonster(id) : null;
    if (m && typeof m.cr === 'number')
      return m.cr;
    const t = legacy()[id];
    return t && typeof t.cr === 'number' ? t.cr : null;
  }

  const power = cr => cr >= 1 ? Math.pow(2, cr / 2) : Math.max(0.05, cr) * SQRT2;

  // Encounter level of a group given as creature ids.
  function encounterLevel(ids) {
    let sum = 0;
    for (const id of ids) {
      const cr = crOf(id);
      if (cr != null)
        sum += power(cr);
    }
    return sum > 0 ? 2 * Math.log2(sum) : 0;
  }

  function resolveBiome(biomeId) {
    const id = String(biomeId || '').toLowerCase();
    const B = TR.BiomeRegistry;
    if (B && B.has(id))
      return id;
    if (ALIASES[id])
      return ALIASES[id];
    // a plane or region name containing a known word
    for (const [word, target] of Object.entries(ALIASES))
      if (id.includes(word))
        return target;
    return KIN[id] ? id : 'temperate_plains';
  }

  function kinOf(m, kin) {
    if (!kin)
      return false;
    if (kin.re && kin.re.test(m.id))
      return true;
    if (kin.types && kin.types.includes(m.type))
      return true;
    return !!(kin.subtypes && (m.subtypes || []).some(s => kin.subtypes.includes(s)));
  }

  const _cache = new Map();

  // Creature ids that live in a biome, its encounter table first.
  // forBiome(biomeId, { crMin = 0, crMax = Infinity } = {}) -> string[]
  function forBiome(biomeId, { crMin = 0, crMax = Infinity } = {}) {
    const id = resolveBiome(biomeId);
    let all = _cache.get(id);
    if (!all) {
      const seen = new Set();
      const B = TR.BiomeRegistry ? TR.BiomeRegistry.get(id) : null;
      for (const c of (B && B.encounterTable) || [])
        if (crOf(c) != null)
          seen.add(c);
      const r = registry();
      if (r)
        for (const m of r.getMonsters())
          if (!seen.has(m.id) && typeof m.cr === 'number' && kinOf(m, KIN[id]))
            seen.add(m.id);
      all = [...seen];
      _cache.set(id, all);
    }
    return all.filter(c => {
      const cr = crOf(c);
      return cr >= crMin && cr <= crMax;
    });
  }

  function tableOf(biomeId) {
    const B = TR.BiomeRegistry ? TR.BiomeRegistry.get(resolveBiome(biomeId)) : null;
    return new Set((B && B.encounterTable) || []);
  }

  const rand = prng => prng && typeof prng.next === 'function' ? prng.next() : Math.random();

  function weightedPick(items, weight, prng) {
    let total = 0;
    for (const it of items)
      total += weight(it);
    let r = rand(prng) * total;
    for (const it of items) {
      r -= weight(it);
      if (r <= 0)
        return it;
    }
    return items[items.length - 1];
  }

  // How many creatures of CR cr bring a group to the target EL.
  function countFor(cr, el) {
    const n = Math.round(Math.pow(2, el / 2) / power(cr));
    return Math.max(1, Math.min(MAX_GROUP, n));
  }

  // A fair fight for a party of the given level in a biome.
  // encounter(biomeId, partyLevel, prng) -> [{ templateId, targetLevel? }]
  function encounter(biomeId, partyLevel, prng) {
    const el = Math.max(1, Math.round(partyLevel || 1));
    const table = tableOf(biomeId);
    // a group of up to six of a kind spans six ELs below the target
    let pool = forBiome(biomeId, { crMin: Math.max(0, el - 6), crMax: el });
    // nothing weak enough lives here: a single creature a little above the
    // party, else the common beasts and brigands of the plains
    if (!pool.length)
      pool = forBiome(biomeId, { crMax: el + 1 });
    if (!pool.length)
      pool = forBiome('temperate_plains', { crMin: Math.max(0, el - 6), crMax: el });
    if (!pool.length)
      pool = forBiome(biomeId);
    if (!pool.length)
      return [];

    // well-matched creatures and the biome's own table come up most
    const weight = id => {
      const cr = crOf(id);
      const off = Math.abs(el - 2 - cr);
      return (table.has(id) ? 3 : 1) / (1 + off * 0.6);
    };
    const pick = weightedPick(pool, weight, prng);
    const cr = crOf(pick);
    const out = [];

    // too weak even as a full pack: grow the creature instead
    if (cr < el - 6 || (cr < el && countFor(cr, el) === MAX_GROUP && encounterLevel(Array(MAX_GROUP).fill(pick)) < el - 1)) {
      const m = registry() && registry().getMonster(pick);
      const hd = Math.max(1, Math.round((m && m.racialHD) || (legacy()[pick] && legacy()[pick].hitDice) || 1));
      const n = 4;
      const lift = el - (cr + 4);
      for (let i = 0; i < n; ++i)
        out.push({ templateId: pick, targetLevel: Math.max(hd, Math.round(hd + lift * 1.5)) });
      return out;
    }

    let n = countFor(cr, el);
    // a mixed group now and then: a stronger leader of the same kind
    if (n >= 3 && rand(prng) < 0.35) {
      const kind = registry() && registry().getMonster(pick) ? registry().getMonster(pick).type : null;
      const leaders = pool.filter(id => id !== pick && crOf(id) > cr && crOf(id) <= Math.min(el, cr + 3)
        && (!kind || (registry().getMonster(id) || {}).type === kind));
      if (leaders.length) {
        const lead = leaders[Math.floor(rand(prng) * leaders.length)];
        out.push({ templateId: lead });
        while (n > 1 && encounterLevel([lead, ...Array(n).fill(pick)]) > el + 0.5)
          --n;
      }
    }
    for (let i = 0; i < n; ++i)
      out.push({ templateId: pick });
    return out;
  }

  TR.MonsterRoster = Object.freeze({ forBiome, encounter, encounterLevel, crOf, resolveBiome, ALIASES, KIN });
})();
