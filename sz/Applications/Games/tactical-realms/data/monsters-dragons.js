;(function() {
  'use strict';
  const TR = (window.SZ || (window.SZ = {})).TacticalRealms || (window.SZ.TacticalRealms = {});
  (TR._pending || (TR._pending = {})).creatures || (TR._pending.creatures = []);

  // ============================================================
  // D&D 3.5e Dragon Age Category Scaling (Monster Manual / Draconomicon)
  //
  // Shared table: each age step provides stat offsets applied to
  // the dragon-type's base (Wyrmling) values.  Per-type base
  // definitions below supply Wyrmling-level absolutes; the
  // generator adds the deltas from this table for ages 2-12.
  //
  // Fields per age row:
  //   idx        – 1-based age category number
  //   age        – canonical age name
  //   sizeStep   – how many size categories above the Wyrmling size
  //   hdAdd      – racial HD to ADD to the Wyrmling HD
  //   naAdd      – natural-armor bonus to ADD
  //   strAdd     – Strength increase from Wyrmling
  //   conAdd     – Constitution increase from Wyrmling
  //   intAdd     – Intelligence increase from Wyrmling
  //   wisAdd     – Wisdom increase from Wyrmling
  //   chaAdd     – Charisma increase from Wyrmling
  //   crAdd      – CR increase from Wyrmling
  //   breathStep – breath-weapon damage step (index into per-type breath table)
  //   srBase     – if > 0, dragon gains SR equal to this + age-adjusted CR
  //   casterLevel– sorcerer caster level (0 = none); many gain at Young Adult (5)
  //   frightful  – true once the dragon gains Frightful Presence
  // ============================================================

  const DRAGON_AGE_CATEGORIES = Object.freeze([
    //                                             size  hd  na  str con int wis cha  cr  bStep sr  CL  fright
    { idx:  1, age: 'Wyrmling',       sizeStep: 0, hdAdd:  0, naAdd:  0, strAdd:  0, conAdd:  0, intAdd:  0, wisAdd:  0, chaAdd:  0, crAdd:  0, breathStep:  0, srBase:  0, casterLevel:  0, frightful: false },
    { idx:  2, age: 'Very Young',     sizeStep: 1, hdAdd:  3, naAdd:  3, strAdd:  4, conAdd:  2, intAdd:  2, wisAdd:  2, chaAdd:  2, crAdd:  2, breathStep:  1, srBase:  0, casterLevel:  0, frightful: false },
    { idx:  3, age: 'Young',          sizeStep: 2, hdAdd:  6, naAdd:  6, strAdd:  6, conAdd:  4, intAdd:  2, wisAdd:  2, chaAdd:  2, crAdd:  4, breathStep:  2, srBase:  0, casterLevel:  0, frightful: false },
    { idx:  4, age: 'Juvenile',       sizeStep: 3, hdAdd:  9, naAdd:  9, strAdd: 10, conAdd:  4, intAdd:  4, wisAdd:  4, chaAdd:  4, crAdd:  6, breathStep:  3, srBase:  0, casterLevel:  0, frightful: false },
    { idx:  5, age: 'Young Adult',    sizeStep: 3, hdAdd: 12, naAdd: 12, strAdd: 12, conAdd:  6, intAdd:  4, wisAdd:  4, chaAdd:  4, crAdd:  8, breathStep:  4, srBase: 17, casterLevel:  1, frightful: false },
    { idx:  6, age: 'Adult',          sizeStep: 4, hdAdd: 15, naAdd: 15, strAdd: 16, conAdd:  6, intAdd:  6, wisAdd:  6, chaAdd:  6, crAdd: 10, breathStep:  5, srBase: 17, casterLevel:  3, frightful: true  },
    { idx:  7, age: 'Mature Adult',   sizeStep: 4, hdAdd: 18, naAdd: 18, strAdd: 18, conAdd:  8, intAdd:  6, wisAdd:  6, chaAdd:  6, crAdd: 12, breathStep:  6, srBase: 17, casterLevel:  5, frightful: true  },
    { idx:  8, age: 'Old',            sizeStep: 5, hdAdd: 21, naAdd: 21, strAdd: 22, conAdd:  8, intAdd:  8, wisAdd:  8, chaAdd:  8, crAdd: 14, breathStep:  7, srBase: 17, casterLevel:  7, frightful: true  },
    { idx:  9, age: 'Very Old',       sizeStep: 5, hdAdd: 24, naAdd: 24, strAdd: 24, conAdd: 10, intAdd:  8, wisAdd:  8, chaAdd:  8, crAdd: 16, breathStep:  8, srBase: 17, casterLevel:  9, frightful: true  },
    { idx: 10, age: 'Ancient',        sizeStep: 6, hdAdd: 27, naAdd: 27, strAdd: 28, conAdd: 10, intAdd: 10, wisAdd: 10, chaAdd: 10, crAdd: 18, breathStep:  9, srBase: 17, casterLevel: 11, frightful: true  },
    { idx: 11, age: 'Wyrm',           sizeStep: 6, hdAdd: 30, naAdd: 30, strAdd: 30, conAdd: 12, intAdd: 10, wisAdd: 10, chaAdd: 10, crAdd: 20, breathStep: 10, srBase: 17, casterLevel: 13, frightful: true  },
    { idx: 12, age: 'Great Wyrm',     sizeStep: 7, hdAdd: 33, naAdd: 33, strAdd: 34, conAdd: 14, intAdd: 12, wisAdd: 12, chaAdd: 12, crAdd: 22, breathStep: 11, srBase: 17, casterLevel: 15, frightful: true  },
  ]);

  // Standard size progression ladder (index into this)
  const SIZE_LADDER = ['Fine', 'Diminutive', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan', 'Colossal'];

  // Fly-speed breakpoints by size: when a dragon crosses into a new size, its fly speed may change
  const FLY_BY_SIZE = { Tiny: 100, Small: 100, Medium: 150, Large: 150, Huge: 150, Gargantuan: 200, Colossal: 200 };

  // ============================================================
  // Per-type base definitions (all values at Wyrmling level)
  //
  // breathTable: array of 12 {dice,sides} for the 12 age steps
  // traitsBase: traits present from Wyrmling onward
  // traitsAtAge: map of ageIdx -> additional traits gained
  // languagesAtAge: map of ageIdx -> additional languages learned
  // ============================================================

  const DRAGON_TYPES = [

    // ──── CHROMATIC DRAGONS ────

    {
      key: 'black_dragon',
      namePrefix: 'Black Dragon',
      subtypes: ['water'],
      wyrmlingSizeIdx: 2, // Tiny
      speed: { land: 60, swim: 60 },
      stats: { str: 11, dex: 10, con: 13, int: 6, wis: 11, cha: 6 },
      naturalArmor: 4,
      racialHD: 4,
      cr: 3,
      passMode: 0b00111,
      breathTable: [
        { dice: 2, sides:  4 }, // Wyrmling
        { dice: 4, sides:  4 }, // Very Young
        { dice: 6, sides:  4 }, // Young
        { dice: 8, sides:  4 }, // Juvenile
        { dice: 10, sides: 4 }, // Young Adult
        { dice: 12, sides: 4 }, // Adult
        { dice: 14, sides: 4 }, // Mature Adult
        { dice: 16, sides: 4 }, // Old
        { dice: 18, sides: 4 }, // Very Old
        { dice: 20, sides: 4 }, // Ancient
        { dice: 22, sides: 4 }, // Wyrm
        { dice: 24, sides: 4 }, // Great Wyrm
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_acid', 'breath_weapon_acid_line', 'water_breathing'],
      traitsAtAge: {
        4: ['darkness'],                       // Juvenile
        6: ['corrupt_water'],                  // Adult
        8: ['plant_growth'],                   // Old
        9: ['insect_plague'],                  // Very Old
        12: ['charm_reptiles'],                // Great Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 10: ['Dwarven'], 12: ['Goblin'] },
    },

    {
      key: 'white_dragon',
      namePrefix: 'White Dragon',
      subtypes: ['cold'],
      wyrmlingSizeIdx: 2, // Tiny
      speed: { land: 60, swim: 60, burrow: 30 },
      stats: { str: 11, dex: 10, con: 13, int: 6, wis: 11, cha: 6 },
      naturalArmor: 3,
      racialHD: 3,
      cr: 2,
      passMode: 0b00111,
      breathTable: [
        { dice: 1, sides:  6 },
        { dice: 2, sides:  6 },
        { dice: 3, sides:  6 },
        { dice: 4, sides:  6 },
        { dice: 5, sides:  6 },
        { dice: 6, sides:  6 },
        { dice: 7, sides:  6 },
        { dice: 8, sides:  6 },
        { dice: 9, sides:  6 },
        { dice: 10, sides: 6 },
        { dice: 11, sides: 6 },
        { dice: 12, sides: 6 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_cold', 'vulnerability_fire', 'breath_weapon_cold_cone', 'icewalking'],
      traitsAtAge: {
        4: ['fog_cloud'],                      // Juvenile
        7: ['gust_of_wind'],                   // Mature Adult
        9: ['wall_of_ice'],                    // Very Old
        12: ['control_weather'],               // Great Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 4: ['Common'], 10: ['Giant'], 12: ['Dwarven'] },
    },

    {
      key: 'green_dragon',
      namePrefix: 'Green Dragon',
      subtypes: ['air'],
      wyrmlingSizeIdx: 3, // Small
      speed: { land: 40, swim: 40 },
      stats: { str: 13, dex: 10, con: 13, int: 10, wis: 11, cha: 10 },
      naturalArmor: 5,
      racialHD: 5,
      cr: 4,
      passMode: 0b00111,
      breathTable: [
        { dice: 2, sides:  6 },
        { dice: 4, sides:  6 },
        { dice: 6, sides:  6 },
        { dice: 8, sides:  6 },
        { dice: 10, sides: 6 },
        { dice: 12, sides: 6 },
        { dice: 14, sides: 6 },
        { dice: 16, sides: 6 },
        { dice: 18, sides: 6 },
        { dice: 20, sides: 6 },
        { dice: 22, sides: 6 },
        { dice: 24, sides: 6 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_acid', 'breath_weapon_acid_cone', 'water_breathing'],
      traitsAtAge: {
        4: ['suggestion'],                     // Juvenile
        8: ['dominate_person'],                // Old
        9: ['plant_growth'],                   // Very Old
        12: ['command_plants'],                // Great Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 4: ['Elven'], 10: ['Sylvan'], 12: ['Giant'] },
    },

    {
      key: 'blue_dragon',
      namePrefix: 'Blue Dragon',
      subtypes: ['earth'],
      wyrmlingSizeIdx: 3, // Small
      speed: { land: 40, burrow: 20 },
      stats: { str: 13, dex: 10, con: 13, int: 10, wis: 11, cha: 10 },
      naturalArmor: 6,
      racialHD: 6,
      cr: 5,
      passMode: 0b00011,
      breathTable: [
        { dice: 2, sides:  6 },
        { dice: 4, sides:  6 },
        { dice: 6, sides:  6 },
        { dice: 8, sides:  6 },
        { dice: 10, sides: 6 },
        { dice: 12, sides: 6 },
        { dice: 14, sides: 6 },
        { dice: 16, sides: 6 },
        { dice: 18, sides: 6 },
        { dice: 20, sides: 6 },
        { dice: 22, sides: 6 },
        { dice: 24, sides: 6 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_electricity', 'breath_weapon_lightning_line', 'create_destroy_water', 'sound_imitation'],
      traitsAtAge: {
        5: ['ventriloquism'],                  // Young Adult
        7: ['hallucinatory_terrain'],          // Mature Adult
        9: ['veil'],                           // Very Old
        11: ['mirage_arcana'],                 // Wyrm
        12: ['control_weather'],               // Great Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 6: ['Auran'], 10: ['Giant'], 12: ['Infernal'] },
    },

    {
      key: 'red_dragon',
      namePrefix: 'Red Dragon',
      subtypes: ['fire'],
      wyrmlingSizeIdx: 4, // Medium
      speed: { land: 40 },
      stats: { str: 17, dex: 10, con: 15, int: 10, wis: 11, cha: 10 },
      naturalArmor: 7,
      racialHD: 7,
      cr: 6,
      passMode: 0b00011,
      breathTable: [
        { dice: 2, sides:  8 },
        { dice: 4, sides:  8 },
        { dice: 6, sides:  8 },
        { dice: 8, sides:  8 },
        { dice: 10, sides: 8 },
        { dice: 12, sides: 8 },
        { dice: 14, sides: 8 },
        { dice: 16, sides: 8 },
        { dice: 18, sides: 8 },
        { dice: 20, sides: 8 },
        { dice: 22, sides: 8 },
        { dice: 24, sides: 8 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_fire', 'vulnerability_cold', 'breath_weapon_fire_cone', 'locate_object'],
      traitsAtAge: {
        5: ['suggestion'],                     // Young Adult
        8: ['find_the_path'],                  // Old
        10: ['discern_location'],              // Ancient
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 5: ['Ignan'], 6: ['Infernal'], 10: ['Dwarven'], 12: ['Abyssal'] },
    },

    // ──── METALLIC DRAGONS ────

    {
      key: 'brass_dragon',
      namePrefix: 'Brass Dragon',
      subtypes: ['fire'],
      wyrmlingSizeIdx: 2, // Tiny
      speed: { land: 60, burrow: 30 },
      stats: { str: 11, dex: 10, con: 13, int: 10, wis: 11, cha: 10 },
      naturalArmor: 4,
      racialHD: 4,
      cr: 3,
      passMode: 0b00011,
      breathTable: [
        { dice: 2, sides:  4 },
        { dice: 4, sides:  4 },
        { dice: 6, sides:  4 },
        { dice: 8, sides:  4 },
        { dice: 10, sides: 4 },
        { dice: 12, sides: 4 },
        { dice: 14, sides: 4 },
        { dice: 16, sides: 4 },
        { dice: 18, sides: 4 },
        { dice: 20, sides: 4 },
        { dice: 22, sides: 4 },
        { dice: 24, sides: 4 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_fire', 'vulnerability_cold', 'breath_weapon_fire_line', 'breath_weapon_sleep_cone', 'speak_with_animals'],
      traitsAtAge: {
        4: ['endure_elements'],                // Juvenile
        6: ['suggestion'],                     // Adult
        8: ['control_winds'],                  // Old
        10: ['control_weather'],               // Ancient
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 6: ['Ignan'], 10: ['Gnome'], 12: ['Halfling'] },
    },

    {
      key: 'copper_dragon',
      namePrefix: 'Copper Dragon',
      subtypes: ['earth'],
      wyrmlingSizeIdx: 2, // Tiny
      speed: { land: 40 },
      stats: { str: 11, dex: 10, con: 13, int: 12, wis: 13, cha: 12 },
      naturalArmor: 5,
      racialHD: 5,
      cr: 4,
      passMode: 0b00011,
      breathTable: [
        { dice: 2, sides:  4 },
        { dice: 4, sides:  4 },
        { dice: 6, sides:  4 },
        { dice: 8, sides:  4 },
        { dice: 10, sides: 4 },
        { dice: 12, sides: 4 },
        { dice: 14, sides: 4 },
        { dice: 16, sides: 4 },
        { dice: 18, sides: 4 },
        { dice: 20, sides: 4 },
        { dice: 22, sides: 4 },
        { dice: 24, sides: 4 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_acid', 'breath_weapon_acid_line', 'breath_weapon_slow_cone', 'spider_climb'],
      traitsAtAge: {
        4: ['stone_shape'],                    // Juvenile
        7: ['transmute_rock_to_mud'],          // Mature Adult
        9: ['wall_of_stone'],                  // Very Old
        11: ['move_earth'],                    // Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 4: ['Gnome'], 10: ['Elven'], 12: ['Halfling'] },
    },

    {
      key: 'bronze_dragon',
      namePrefix: 'Bronze Dragon',
      subtypes: ['water'],
      wyrmlingSizeIdx: 3, // Small
      speed: { land: 40, swim: 60 },
      stats: { str: 13, dex: 10, con: 13, int: 12, wis: 13, cha: 12 },
      naturalArmor: 5,
      racialHD: 6,
      cr: 5,
      passMode: 0b00111,
      breathTable: [
        { dice: 2, sides:  6 },
        { dice: 4, sides:  6 },
        { dice: 6, sides:  6 },
        { dice: 8, sides:  6 },
        { dice: 10, sides: 6 },
        { dice: 12, sides: 6 },
        { dice: 14, sides: 6 },
        { dice: 16, sides: 6 },
        { dice: 18, sides: 6 },
        { dice: 20, sides: 6 },
        { dice: 22, sides: 6 },
        { dice: 24, sides: 6 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_electricity', 'breath_weapon_lightning_line', 'breath_weapon_repulsion_cone', 'water_breathing', 'speak_with_animals_aquatic'],
      traitsAtAge: {
        4: ['polymorph_self'],                 // Juvenile
        6: ['create_food_and_water'],          // Adult
        7: ['fog_cloud'],                      // Mature Adult
        8: ['detect_thoughts'],                // Old
        10: ['control_water'],                 // Ancient
        12: ['control_weather'],               // Great Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 6: ['Aquan'], 10: ['Elven'], 12: ['Celestial'] },
    },

    {
      key: 'silver_dragon',
      namePrefix: 'Silver Dragon',
      subtypes: ['cold'],
      wyrmlingSizeIdx: 3, // Small
      speed: { land: 40 },
      stats: { str: 13, dex: 10, con: 13, int: 12, wis: 13, cha: 12 },
      naturalArmor: 6,
      racialHD: 7,
      cr: 6,
      passMode: 0b00011,
      breathTable: [
        { dice: 2, sides:  6 },
        { dice: 4, sides:  6 },
        { dice: 6, sides:  6 },
        { dice: 8, sides:  6 },
        { dice: 10, sides: 6 },
        { dice: 12, sides: 6 },
        { dice: 14, sides: 6 },
        { dice: 16, sides: 6 },
        { dice: 18, sides: 6 },
        { dice: 20, sides: 6 },
        { dice: 22, sides: 6 },
        { dice: 24, sides: 6 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_cold', 'vulnerability_fire', 'breath_weapon_cold_cone', 'breath_weapon_paralysis_cone', 'alternate_form', 'cloudwalking'],
      traitsAtAge: {
        4: ['feather_fall'],                   // Juvenile
        6: ['fog_cloud'],                      // Adult
        8: ['control_winds'],                  // Old
        10: ['control_weather'],               // Ancient
        12: ['reverse_gravity'],               // Great Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 6: ['Auran', 'Celestial'], 10: ['Elven'], 12: ['Dwarven'] },
    },

    {
      key: 'gold_dragon',
      namePrefix: 'Gold Dragon',
      subtypes: ['fire'],
      wyrmlingSizeIdx: 4, // Medium
      speed: { land: 60, swim: 60 },
      stats: { str: 17, dex: 10, con: 15, int: 14, wis: 15, cha: 14 },
      naturalArmor: 7,
      racialHD: 8,
      cr: 7,
      passMode: 0b00111,
      breathTable: [
        { dice: 2, sides:  8 },
        { dice: 4, sides:  8 },
        { dice: 6, sides:  8 },
        { dice: 8, sides:  8 },
        { dice: 10, sides: 8 },
        { dice: 12, sides: 8 },
        { dice: 14, sides: 8 },
        { dice: 16, sides: 8 },
        { dice: 18, sides: 8 },
        { dice: 20, sides: 8 },
        { dice: 22, sides: 8 },
        { dice: 24, sides: 8 },
      ],
      traitsBase: ['darkvision120', 'blindsense60', 'immunity_fire', 'vulnerability_cold', 'breath_weapon_fire_cone', 'breath_weapon_weakening_cone', 'alternate_form', 'water_breathing'],
      traitsAtAge: {
        4: ['bless'],                          // Juvenile
        6: ['luck_bonus'],                     // Adult
        7: ['detect_gems'],                    // Mature Adult
        8: ['geas'],                           // Old
        10: ['sunburst'],                      // Ancient
        11: ['foresight'],                     // Wyrm
      },
      languagesBase: ['Draconic'],
      languagesAtAge: { 3: ['Common'], 5: ['Celestial'], 6: ['Ignan'], 10: ['Dwarven'], 12: ['Elven'] },
      flySpeedOverride: { Tiny: 100, Small: 100, Medium: 200, Large: 200, Huge: 250, Gargantuan: 250, Colossal: 250 },
    },
  ];

  // ============================================================
  // XP and gold reward lookup by CR (simplified 3.5e table)
  // ============================================================
  const XP_BY_CR = {
     1:    300,   2:    600,   3:    900,   4:   1200,   5:   1600,
     6:   1800,   7:   2100,   8:   2400,   9:   2700,  10:   5000,
    11:   7500,  12:   8000,  13:  10000,  14:  11000,  15:  15000,
    16:  18000,  17:  18000,  18:  36000,  19:  44000,  20:  50000,
    21:  50000,  22:  56000,  23:  56000,  24:  70000,  25:  70000,
    26:  80000,  27:  80000,  28: 100000,
  };

  const GOLD_BY_CR = {
     1:    100,   2:    200,   3:    300,   4:    400,   5:    500,
     6:    600,   7:    700,   8:    800,   9:    900,  10:   2000,
    11:   2500,  12:   3000,  13:   3500,  14:   4000,  15:   5000,
    16:   5000,  17:   6000,  18:  10000,  19:  12000,  20:  15000,
    21:  15000,  22:  18000,  23:  18000,  24:  25000,  25:  25000,
    26:  30000,  27:  30000,  28:  40000,
  };

  // ============================================================
  // Generator: produce 12 creature entries per dragon type
  // ============================================================

  function buildIdSlug(ageStr) {
    return ageStr.toLowerCase().replace(/\s+/g, '_');
  }

  for (const dtype of DRAGON_TYPES) {
    for (const ageRow of DRAGON_AGE_CATEGORIES) {
      const ageSlug = buildIdSlug(ageRow.age);
      const id = dtype.key + '_' + ageSlug;

      // Size
      const sizeIdx = Math.min(dtype.wyrmlingSizeIdx + ageRow.sizeStep, SIZE_LADDER.length - 1);
      const size = SIZE_LADDER[sizeIdx];

      // Hit Dice
      const racialHD = dtype.racialHD + ageRow.hdAdd;

      // Ability scores
      const str = dtype.stats.str + ageRow.strAdd;
      const dex = dtype.stats.dex;   // Dex stays constant for true dragons
      const con = dtype.stats.con + ageRow.conAdd;
      const int = dtype.stats.int + ageRow.intAdd;
      const wis = dtype.stats.wis + ageRow.wisAdd;
      const cha = dtype.stats.cha + ageRow.chaAdd;

      // Natural armor
      const naturalArmor = dtype.naturalArmor + ageRow.naAdd;

      // CR
      const cr = dtype.cr + ageRow.crAdd;

      // BAB (dragons get full BAB = HD)
      const bab = racialHD;

      // Base saves (good for all three at HD level, dragon type):
      // Good save = HD/2 + 2, rounded down
      const goodSave = Math.floor(racialHD / 2) + 2;
      const baseSaves = { fort: goodSave, ref: goodSave, will: goodSave };

      // Breath weapon
      const bw = dtype.breathTable[ageRow.breathStep];

      // Speed (fly speed scales with size)
      const flyLookup = dtype.flySpeedOverride || FLY_BY_SIZE;
      const speed = Object.assign({}, dtype.speed);
      speed.fly = flyLookup[size] || 150;

      // Traits: base + any added at or before this age + frightful presence + SR
      const traits = [...dtype.traitsBase];
      for (let aidx = 1; aidx <= ageRow.idx; ++aidx) {
        if (dtype.traitsAtAge[aidx])
          traits.push(...dtype.traitsAtAge[aidx]);
      }
      if (ageRow.frightful && !traits.includes('frightful_presence'))
        traits.push('frightful_presence');
      if (ageRow.srBase > 0)
        traits.push('spell_resistance_' + (ageRow.srBase + cr));
      if (ageRow.casterLevel > 0)
        traits.push('sorcerer_casting_' + ageRow.casterLevel);

      // Languages: base + any gained at or before this age
      const languages = [...dtype.languagesBase];
      for (let aidx = 1; aidx <= ageRow.idx; ++aidx) {
        if (dtype.languagesAtAge[aidx])
          for (const lang of dtype.languagesAtAge[aidx])
            if (!languages.includes(lang))
              languages.push(lang);
      }

      // XP / Gold
      const xpReward  = XP_BY_CR[cr]   || Math.round(cr * 3000);
      const goldReward = GOLD_BY_CR[cr] || Math.round(cr * 1200);

      TR._pending.creatures.push({
        id,
        name: dtype.namePrefix + ', ' + ageRow.age,
        type: 'dragon',
        subtypes: dtype.subtypes,
        size,
        speed,
        stats: { str, dex, con, int, wis, cha },
        abilityMods: null,
        naturalArmor,
        hitDie: 'd12',
        racialHD,
        bab,
        baseSaves,
        cr,
        la: null,
        traits,
        languages,
        favoredClass: null,
        playable: false,
        availability: 'core',
        source: 'core/Monster-Manual',
        passMode: dtype.passMode,
        damageDice: bw.dice,
        damageSides: bw.sides,
        xpReward,
        goldReward,

        // Age-category metadata for runtime scaling / tooltip display
        ageCategory: ageRow.idx,
        ageName: ageRow.age,
        dragonType: dtype.key,
        casterLevel: ageRow.casterLevel,
      });
    }
  }

  // ============================================================
  // Expose the scaling table so other modules (e.g. encounter
  // builder, dragon-lair generators) can reference it directly.
  // ============================================================
  TR.DRAGON_AGE_CATEGORIES = DRAGON_AGE_CATEGORIES;

  // ============================================================
  // Misc dragon-type creatures (not true dragons -- no age table)
  // ============================================================
  TR._pending.creatures.push(

    { id: 'pseudodragon', name: 'Pseudodragon', type: 'dragon', subtypes: [], size: 'Tiny', speed: { land: 15, fly: 60 }, stats: { str: 6, dex: 15, con: 13, int: 10, wis: 12, cha: 10 }, abilityMods: null, naturalArmor: 2, hitDie: 'd12', racialHD: 2, bab: 2, baseSaves: { fort: 4, ref: 5, will: 4 }, cr: 1, la: null, traits: ['darkvision60', 'low_light_vision', 'blindsense60', 'telepathy60', 'immunity_sleep_paralysis', 'poison_sting', 'spell_resistance_19'], languages: ['Draconic'], favoredClass: null, playable: false, availability: 'core', source: 'core/Monster-Manual', passMode: 0b00011, damageDice: 1, damageSides: 3, xpReward: 300, goldReward: 100 },

    { id: 'wyvern', name: 'Wyvern', type: 'dragon', subtypes: [], size: 'Large', speed: { land: 20, fly: 60 }, stats: { str: 19, dex: 12, con: 16, int: 6, wis: 12, cha: 9 }, abilityMods: null, naturalArmor: 5, hitDie: 'd12', racialHD: 7, bab: 7, baseSaves: { fort: 8, ref: 6, will: 6 }, cr: 6, la: null, traits: ['darkvision60', 'low_light_vision', 'scent', 'improved_grab', 'poison_sting'], languages: ['Draconic'], favoredClass: null, playable: false, availability: 'core', source: 'core/Monster-Manual', passMode: 0b00011, damageDice: 2, damageSides: 6, xpReward: 1800, goldReward: 500 },

    { id: 'dragon_turtle', name: 'Dragon Turtle', type: 'dragon', subtypes: ['aquatic'], size: 'Huge', speed: { land: 20, swim: 30 }, stats: { str: 27, dex: 10, con: 21, int: 12, wis: 13, cha: 12 }, abilityMods: null, naturalArmor: 19, hitDie: 'd12', racialHD: 12, bab: 12, baseSaves: { fort: 13, ref: 8, will: 9 }, cr: 9, la: null, traits: ['darkvision60', 'low_light_vision', 'breath_weapon_steam_cone', 'capsize', 'immunity_fire_sleep_paralysis', 'aquatic'], languages: ['Draconic', 'Aquan'], favoredClass: null, playable: false, availability: 'core', source: 'core/Monster-Manual', passMode: 0b00101, damageDice: 3, damageSides: 6, xpReward: 2700, goldReward: 1000 }

  );
})();
