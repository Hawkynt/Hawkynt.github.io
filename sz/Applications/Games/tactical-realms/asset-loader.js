;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const SPRITE_SIZE = 16;
  const SPRITE_MARGIN = 0;
  const SPRITE_STEP = SPRITE_SIZE + SPRITE_MARGIN;

  function spriteRectM(tileIndex, sheetCols, margin) {
    const step = SPRITE_SIZE + margin;
    const col = tileIndex % sheetCols;
    const row = Math.floor(tileIndex / sheetCols);
    return Object.freeze({ x: col * step, y: row * step, w: SPRITE_SIZE, h: SPRITE_SIZE });
  }

  const OVERWORLD_COLS = 57;
  const OVERWORLD_MARGIN = 1;

  const OVERWORLD_TERRAIN_SPRITES = Object.freeze({
    GRASS:    spriteRectM(5,   OVERWORLD_COLS, OVERWORLD_MARGIN),
    FOREST:   spriteRectM(528, OVERWORLD_COLS, OVERWORLD_MARGIN),
    MOUNTAIN: spriteRectM(7,   OVERWORLD_COLS, OVERWORLD_MARGIN),
    DUNGEON:  spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
    TOWN:     spriteRectM(294, OVERWORLD_COLS, OVERWORLD_MARGIN),
    ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),
    CAMP:     spriteRectM(13,  OVERWORLD_COLS, OVERWORLD_MARGIN),
    WATER:    spriteRectM(0,   OVERWORLD_COLS, OVERWORLD_MARGIN),
    SAND:     spriteRectM(8,   OVERWORLD_COLS, OVERWORLD_MARGIN),
  });

  const SHEET_REGISTRY = Object.freeze({
    dungeon:    Object.freeze({ path: 'assets/dungeon-tilemap.png',    tileSize: 16, margin: 0, cols: 12 }),
    overworld:  Object.freeze({ path: 'assets/overworld-tilemap.png',  tileSize: 16, margin: 1, cols: 57 }),
    kenney1bit: Object.freeze({ path: 'assets/kenney-1bit/Tilesheet/colored-transparent_packed.png', tileSize: 16, margin: 0, cols: 49 }),
  });

  const ASSET_MANIFEST = Object.freeze(
    Object.fromEntries(Object.entries(SHEET_REGISTRY).map(([id, m]) => [id, m.path]))
  );

  const K1B_COLS = 49;
  const K1B_MARGIN = 0;

  function k1bRect(tileIndex) {
    return Object.freeze({ ...spriteRectM(tileIndex, K1B_COLS, K1B_MARGIN), sheet: 'kenney1bit' });
  }

  function spriteRect(tileIndex, sheetCols) {
    const col = tileIndex % sheetCols;
    const row = Math.floor(tileIndex / sheetCols);
    return Object.freeze({
      x: col * SPRITE_STEP,
      y: row * SPRITE_STEP,
      w: SPRITE_SIZE,
      h: SPRITE_SIZE,
    });
  }

  const DUNGEON_COLS = 12;

  const COMBAT_TERRAIN_SPRITES = Object.freeze({
    plains:        spriteRect(0, DUNGEON_COLS),
    forest:        spriteRect(6, DUNGEON_COLS),
    mountain:      spriteRect(24, DUNGEON_COLS),
    ruins:         spriteRect(12, DUNGEON_COLS),
    dungeon_floor: spriteRect(2, DUNGEON_COLS),
    water:         spriteRect(8, DUNGEON_COLS),
    swamp:         spriteRect(7, DUNGEON_COLS),
    lava:          spriteRect(29, DUNGEON_COLS),
    road:          spriteRect(1, DUNGEON_COLS),
    cave:          spriteRect(3, DUNGEON_COLS),
    wall:          spriteRect(36, DUNGEON_COLS),
  });

  const PARTY_SPRITES = Object.freeze({
    fighter:   spriteRect(88, DUNGEON_COLS),
    wizard:    spriteRect(84, DUNGEON_COLS),
    cleric:    spriteRect(100, DUNGEON_COLS),
    rogue:     spriteRect(112, DUNGEON_COLS),
    ranger:    spriteRect(112, DUNGEON_COLS),
    paladin:   spriteRect(97, DUNGEON_COLS),
    barbarian: spriteRect(110, DUNGEON_COLS),
    bard:      spriteRect(99, DUNGEON_COLS),
    warlock:   spriteRect(84, DUNGEON_COLS),
    sorcerer:  spriteRect(98, DUNGEON_COLS),
  });

  // Each enemy has a unique sprite from the Kenney 1-Bit Pack (49 cols, 1px margin).
  // Tile indices reference distinct humanoid/creature silhouettes from the sheet.
  // Combined with ENEMY_TINTS, every enemy type looks visually unique.
  const ENEMY_SPRITES = Object.freeze({
    // --- small humanoids (rows 0-1, small characters) ---
    goblin:          k1bRect(37),   // small hunched figure
    kobold:          k1bRect(38),   // small character variant
    rat:             k1bRect(39),   // tiny critter
    stirge:          k1bRect(94),   // small flying pest
    cockatrice:      k1bRect(90),   // small beaked creature
    // --- medium humanoids ---
    bandit:          k1bRect(25),   // round-helm rogue
    orc:             k1bRect(40),   // large helmeted brute
    skeleton:        k1bRect(76),   // skull-faced undead
    zombie:          k1bRect(73),   // shambling corpse
    gnoll:           k1bRect(75),   // hyena-man with weapon
    hobgoblin:       k1bRect(80),   // disciplined warrior
    bugbear:         k1bRect(42),   // heavy armored brute
    lizardfolk:      k1bRect(77),   // scaled warrior
    wight:           k1bRect(79),   // dark armored undead
    ghoul:           k1bRect(74),   // hunched undead
    // --- beast/animal types ---
    wolf:            k1bRect(83),   // four-legged beast
    dire_wolf:       k1bRect(84),   // larger beast variant
    worg:            k1bRect(85),   // evil wolf mount
    spider:          k1bRect(93),   // multi-legged creeper
    phase_spider:    k1bRect(92),   // ethereal spider
    basilisk:        k1bRect(91),   // reptilian beast
    manticore:       k1bRect(34),   // spiked beast
    owlbear:         k1bRect(31),   // wide heavy creature
    // --- winged creatures ---
    harpy:           k1bRect(36),   // winged humanoid
    wyvern:          k1bRect(86),   // winged serpent
    dragon_wyrmling: k1bRect(88),   // young dragon
    young_dragon:    k1bRect(87),   // larger dragon
    // --- undead & spectral ---
    wraith:          k1bRect(35),   // ghostly face
    vampire_spawn:   k1bRect(26),   // cloaked undead
    // --- large / giant ---
    troll:           k1bRect(41),   // tall regenerating brute
    ogre:            k1bRect(24),   // big dumb brute
    gargoyle:        k1bRect(32),   // stone sentinel
    hill_giant:      k1bRect(30),   // towering giant
    frost_giant:     k1bRect(29),   // ice-armored giant
    minotaur:        k1bRect(27),   // horned beast-man
    // --- casters & fiends ---
    dark_mage:       k1bRect(82),   // masked sorcerer
    lich:            k1bRect(78),   // robed arch-lich
    mind_flayer:     k1bRect(43),   // tentacled aberration
    fire_elemental:  k1bRect(28),   // blazing elemental
    death_knight:    k1bRect(33),   // fallen champion
    demon:           k1bRect(89),   // fiendish horror
    devil:           k1bRect(81),   // infernal schemer
  });

  const ITEM_SPRITES = Object.freeze({
    chest_closed:  spriteRect(89, DUNGEON_COLS),
    chest_open:    spriteRect(90, DUNGEON_COLS),
    potion_red:    spriteRect(115, DUNGEON_COLS),
    potion_blue:   spriteRect(116, DUNGEON_COLS),
    potion_green:  spriteRect(114, DUNGEON_COLS),
    sword:         spriteRect(104, DUNGEON_COLS),
    dagger:        spriteRect(103, DUNGEON_COLS),
    axe:           spriteRect(118, DUNGEON_COLS),
    hammer:        spriteRect(117, DUNGEON_COLS),
    shield:        spriteRect(102, DUNGEON_COLS),
    coin:          spriteRect(101, DUNGEON_COLS),
  });

  const ENEMY_TINTS = Object.freeze({
    // existing duplicate-sprite tints
    dire_wolf:       'rgba(80,0,0,0.3)',
    vampire_spawn:   'rgba(80,0,40,0.3)',
    lich:            'rgba(0,60,80,0.3)',
    hobgoblin:       'rgba(60,40,0,0.3)',
    minotaur:        'rgba(80,40,0,0.3)',
    ghoul:           'rgba(40,80,0,0.3)',
    wyvern:          'rgba(0,40,80,0.3)',
    dragon_wyrmling: 'rgba(80,0,0,0.3)',
    // Phase B new enemy tints
    kobold:          'rgba(120,90,20,0.3)',
    zombie:          'rgba(50,90,30,0.35)',
    stirge:          'rgba(100,0,20,0.3)',
    gnoll:           'rgba(120,80,20,0.3)',
    bugbear:         'rgba(90,50,10,0.3)',
    worg:            'rgba(50,50,50,0.35)',
    lizardfolk:      'rgba(20,100,30,0.3)',
    harpy:           'rgba(100,40,120,0.3)',
    cockatrice:      'rgba(80,100,20,0.3)',
    basilisk:        'rgba(30,110,40,0.3)',
    wight:           'rgba(20,30,100,0.35)',
    gargoyle:        'rgba(80,80,80,0.35)',
    owlbear:         'rgba(100,60,20,0.3)',
    manticore:       'rgba(100,20,20,0.3)',
    phase_spider:    'rgba(80,20,120,0.3)',
    hill_giant:      'rgba(110,70,20,0.3)',
    mind_flayer:     'rgba(80,20,100,0.35)',
    young_dragon:    'rgba(120,100,20,0.3)',
    death_knight:    'rgba(100,10,10,0.35)',
    fire_elemental:  'rgba(120,60,0,0.35)',
    frost_giant:     'rgba(40,80,120,0.3)',
    demon:           'rgba(120,30,10,0.35)',
    devil:           'rgba(100,10,20,0.3)',
  });

  const PARTY_TINTS = Object.freeze({
    ranger:  'rgba(0,50,0,0.25)',
    warlock: 'rgba(40,0,60,0.25)',
  });

  // Phase C: Dimension terrain sprites -- each dimension maps tile type names
  // to different tile indices from the overworld sheet for visual variety.
  // Tile indices mapped from visual inspection of the Kenney Roguelike/RPG tileset.
  const DIMENSION_TERRAIN_SPRITES = Object.freeze({
    material: OVERWORLD_TERRAIN_SPRITES,
    feywild: Object.freeze({
      GRASS:    spriteRectM(456, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST:   spriteRectM(529, OVERWORLD_COLS, OVERWORLD_MARGIN),
      MOUNTAIN: spriteRectM(7,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      WATER:    spriteRectM(2,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:     spriteRectM(9,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      DUNGEON:  spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
      TOWN:     spriteRectM(294, OVERWORLD_COLS, OVERWORLD_MARGIN),
      ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),
      CAMP:     spriteRectM(13,  OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    shadowfell: Object.freeze({
      GRASS:    spriteRectM(10,  OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST:   spriteRectM(530, OVERWORLD_COLS, OVERWORLD_MARGIN),
      MOUNTAIN: spriteRectM(7,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      WATER:    spriteRectM(3,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:     spriteRectM(9,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      DUNGEON:  spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
      TOWN:     spriteRectM(294, OVERWORLD_COLS, OVERWORLD_MARGIN),
      ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),
      CAMP:     spriteRectM(13,  OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    nine_hells: Object.freeze({
      GRASS:    spriteRectM(342, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST:   spriteRectM(531, OVERWORLD_COLS, OVERWORLD_MARGIN),
      MOUNTAIN: spriteRectM(7,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      WATER:    spriteRectM(285, OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:     spriteRectM(343, OVERWORLD_COLS, OVERWORLD_MARGIN),
      DUNGEON:  spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
      TOWN:     spriteRectM(294, OVERWORLD_COLS, OVERWORLD_MARGIN),
      ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),
      CAMP:     spriteRectM(13,  OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    underdark: Object.freeze({
      GRASS:    spriteRectM(399, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST:   spriteRectM(532, OVERWORLD_COLS, OVERWORLD_MARGIN),
      MOUNTAIN: spriteRectM(7,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      WATER:    spriteRectM(3,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:     spriteRectM(400, OVERWORLD_COLS, OVERWORLD_MARGIN),
      DUNGEON:  spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
      TOWN:     spriteRectM(294, OVERWORLD_COLS, OVERWORLD_MARGIN),
      ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),
      CAMP:     spriteRectM(13,  OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    abyss: Object.freeze({
      GRASS:    spriteRectM(285, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST:   spriteRectM(533, OVERWORLD_COLS, OVERWORLD_MARGIN),
      MOUNTAIN: spriteRectM(7,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      WATER:    spriteRectM(0,   OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:     spriteRectM(286, OVERWORLD_COLS, OVERWORLD_MARGIN),
      DUNGEON:  spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
      TOWN:     spriteRectM(294, OVERWORLD_COLS, OVERWORLD_MARGIN),
      ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),
      CAMP:     spriteRectM(13,  OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
  });

  function sheetRect(tileIndex, sheetId) {
    const meta = SHEET_REGISTRY[sheetId];
    if (!meta)
      return null;
    const step = meta.tileSize + meta.margin;
    const col = tileIndex % meta.cols;
    const row = Math.floor(tileIndex / meta.cols);
    return Object.freeze({
      x: col * step, y: row * step,
      w: meta.tileSize, h: meta.tileSize,
      sheet: sheetId,
    });
  }

  const HD_MAPS = { party: null, enemy: null, combat_terrain: null, item: null };
  const SD_MAPS = Object.freeze({
    party: PARTY_SPRITES, enemy: ENEMY_SPRITES,
    combat_terrain: COMBAT_TERRAIN_SPRITES, item: ITEM_SPRITES,
  });

  function resolveSprite(spriteId, category) {
    const hd = HD_MAPS[category];
    const sd = SD_MAPS[category];
    return (hd && hd[spriteId]) || (sd && sd[spriteId]) || null;
  }

  const PLAYER_SPRITE = spriteRect(97, DUNGEON_COLS);

  class AssetLoader {
    #images;
    #loaded;
    #total;
    #ready;

    constructor() {
      this.#images = new Map();
      this.#loaded = 0;
      this.#total = 0;
      this.#ready = false;
    }

    get ready() { return this.#ready; }
    get loaded() { return this.#loaded; }
    get total() { return this.#total; }
    get progress() { return this.#total > 0 ? this.#loaded / this.#total : 1; }

    has(id) { return this.#images.has(id); }
    get(id) { return this.#images.get(id) || null; }

    async loadAll(onProgress) {
      const entries = Object.entries(ASSET_MANIFEST);
      this.#total = entries.length;
      this.#loaded = 0;
      let successCount = 0;

      const promises = entries.map(([id, src]) =>
        this.#loadImage(id, src)
          .then(() => {
            ++this.#loaded;
            ++successCount;
            if (onProgress)
              onProgress(this.#loaded, this.#total, id);
          })
          .catch(() => {
            ++this.#loaded;
            if (onProgress)
              onProgress(this.#loaded, this.#total, id);
          })
      );

      await Promise.all(promises);
      this.#ready = successCount > 0;
      return this.#ready;
    }

    #loadImage(id, src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.#images.set(id, img);
          resolve(img);
        };
        img.onerror = () => reject(new Error(`Failed to load ${src}`));
        img.src = src;
      });
    }

    drawSprite(ctx, sheetId, rect, destX, destY, destSize) {
      const img = this.#images.get(sheetId);
      if (!img || !rect)
        return false;
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, destX, destY, destSize, destSize);
      return true;
    }
  }

  TR.AssetLoader = AssetLoader;
  TR.SHEET_REGISTRY = SHEET_REGISTRY;
  TR.ASSET_MANIFEST = ASSET_MANIFEST;
  TR.SPRITE_SIZE = SPRITE_SIZE;
  TR.COMBAT_TERRAIN_SPRITES = COMBAT_TERRAIN_SPRITES;
  TR.PARTY_SPRITES = PARTY_SPRITES;
  TR.ENEMY_SPRITES = ENEMY_SPRITES;
  TR.ITEM_SPRITES = ITEM_SPRITES;
  TR.PLAYER_SPRITE = PLAYER_SPRITE;
  TR.spriteRectM = spriteRectM;
  TR.sheetRect = sheetRect;
  TR.resolveSprite = resolveSprite;
  TR.OVERWORLD_COLS = OVERWORLD_COLS;
  TR.OVERWORLD_MARGIN = OVERWORLD_MARGIN;
  TR.OVERWORLD_TERRAIN_SPRITES = OVERWORLD_TERRAIN_SPRITES;
  TR.ENEMY_TINTS = ENEMY_TINTS;
  TR.PARTY_TINTS = PARTY_TINTS;
  TR.DIMENSION_TERRAIN_SPRITES = DIMENSION_TERRAIN_SPRITES;
  TR.K1B_COLS = K1B_COLS;
  TR.K1B_MARGIN = K1B_MARGIN;
})();
