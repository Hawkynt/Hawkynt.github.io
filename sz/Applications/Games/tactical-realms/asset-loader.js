;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const SPRITE_SIZE = 16;
  const SPRITE_MARGIN = 1;
  const SPRITE_STEP = SPRITE_SIZE + SPRITE_MARGIN;

  function spriteRectM(tileIndex, sheetCols, margin) {
    const step = SPRITE_SIZE + margin;
    const col = tileIndex % sheetCols;
    const row = Math.floor(tileIndex / sheetCols);
    return Object.freeze({ x: col * step, y: row * step, w: SPRITE_SIZE, h: SPRITE_SIZE });
  }

  const OVERWORLD_COLS = 57;
  const OVERWORLD_MARGIN = 1;

  // Hand-drawn landmarks (pixel-art.js) replace tiles the Kenney sheet lacks.
  const landmark = name => (TR.PixelArt ? TR.PixelArt.rect(name) : null);

  // Indices verified against tools/sheet-preview.html.
  const OVERWORLD_TERRAIN_SPRITES = Object.freeze({
    GRASS:    spriteRectM(5,   OVERWORLD_COLS, OVERWORLD_MARGIN),   // plain grass
    FOREST:   spriteRectM(528, OVERWORLD_COLS, OVERWORLD_MARGIN),   // round tree
    MOUNTAIN: landmark('peak') || spriteRectM(1308, OVERWORLD_COLS, OVERWORLD_MARGIN),
    DUNGEON:  landmark('cave') || spriteRectM(150, OVERWORLD_COLS, OVERWORLD_MARGIN),
    TOWN:     landmark('town') || spriteRectM(207, OVERWORLD_COLS, OVERWORLD_MARGIN),
    ROAD:     spriteRectM(121, OVERWORLD_COLS, OVERWORLD_MARGIN),   // paving stones
    CAMP:     spriteRectM(470, OVERWORLD_COLS, OVERWORLD_MARGIN),   // campfire
    WATER:    spriteRectM(0,   OVERWORLD_COLS, OVERWORLD_MARGIN),
    SAND:     spriteRectM(8,   OVERWORLD_COLS, OVERWORLD_MARGIN),
  });

  const SHEET_REGISTRY = Object.freeze({
    dungeon:    Object.freeze({ path: 'assets/dungeon-tilemap.png',    tileSize: 16, margin: 1, cols: 12 }),
    overworld:  Object.freeze({ path: 'assets/overworld-tilemap.png',  tileSize: 16, margin: 1, cols: 57 }),
  });

  const ASSET_MANIFEST = Object.freeze(
    Object.fromEntries(Object.entries(SHEET_REGISTRY).map(([id, m]) => [id, m.path]))
  );

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

  // Indices verified against tools/sheet-preview.html. Outdoor terrain comes
  // from the overworld sheet, underground terrain from the dungeon sheet.
  const owRect = i => Object.freeze({ ...spriteRectM(i, OVERWORLD_COLS, OVERWORLD_MARGIN), sheet: 'overworld' });

  const COMBAT_TERRAIN_SPRITES = Object.freeze({
    plains:        owRect(5),                      // grass
    forest:        owRect(528),                    // tree (overlay)
    mountain:      owRect(1308),                   // mossy rocks (overlay)
    ruins:         spriteRect(12, DUNGEON_COLS),   // cracked earth floor
    dungeon_floor: spriteRect(0, DUNGEON_COLS),    // earth floor
    water:         owRect(0),
    swamp:         owRect(592),                    // reeds (overlay)
    lava:          owRect(1084),                   // scorched ground
    road:          owRect(121),                    // paving stones
    cave:          spriteRect(0, DUNGEON_COLS),    // earth floor (darkened in TERRAIN_LAYERS)
    wall:          spriteRect(40, DUNGEON_COLS),   // brick wall
    sand:          owRect(8),
  });

  const PARTY_SPRITES = Object.freeze({
    fighter:   spriteRect(88, DUNGEON_COLS),   // bare-armed warrior
    wizard:    spriteRect(84, DUNGEON_COLS),   // purple-hat wizard
    cleric:    spriteRect(100, DUNGEON_COLS),  // grey-haired priest
    rogue:     spriteRect(85, DUNGEON_COLS),   // light-clad youth
    ranger:    spriteRect(112, DUNGEON_COLS),  // green bandana
    paladin:   spriteRect(97, DUNGEON_COLS),   // open helm knight
    barbarian: spriteRect(86, DUNGEON_COLS),   // bald brawler
    bard:      spriteRect(99, DUNGEON_COLS),   // long-haired minstrel
    warlock:   spriteRect(111, DUNGEON_COLS),  // hooded figure
    sorcerer:  spriteRect(98, DUNGEON_COLS),   // young mage
  });

  // Enemy fallbacks on the dungeon sheet when no creature icon exists.
  // Monsters live at 108-112 and 120-124; heroes at 84-88 and 96-100.
  // Combined with ENEMY_TINTS, enemies sharing a tile stay distinguishable.
  const ENEMY_SPRITES = Object.freeze({
    // --- goblinoids and brigands (green bandana, row 9 col 4) ---
    goblin:          spriteRect(112, DUNGEON_COLS),
    bandit:          spriteRect(112, DUNGEON_COLS),
    orc:             spriteRect(112, DUNGEON_COLS),
    hobgoblin:       spriteRect(112, DUNGEON_COLS),
    bugbear:         spriteRect(112, DUNGEON_COLS),
    gnoll:           spriteRect(112, DUNGEON_COLS),
    kobold:          spriteRect(86, DUNGEON_COLS),
    // --- vermin (rat, row 10 col 3) ---
    rat:             spriteRect(123, DUNGEON_COLS),
    wolf:            spriteRect(123, DUNGEON_COLS),
    dire_wolf:       spriteRect(123, DUNGEON_COLS),
    worg:            spriteRect(123, DUNGEON_COLS),
    owlbear:         spriteRect(123, DUNGEON_COLS),
    manticore:       spriteRect(123, DUNGEON_COLS),
    // --- spiders (row 10 col 2) ---
    spider:          spriteRect(122, DUNGEON_COLS),
    phase_spider:    spriteRect(122, DUNGEON_COLS),
    // --- serpents and reptiles (row 10 col 4) ---
    cockatrice:      spriteRect(124, DUNGEON_COLS),
    basilisk:        spriteRect(124, DUNGEON_COLS),
    lizardfolk:      spriteRect(124, DUNGEON_COLS),
    // --- undead (ghost, row 10 col 1) ---
    skeleton:        spriteRect(121, DUNGEON_COLS),
    zombie:          spriteRect(121, DUNGEON_COLS),
    ghoul:           spriteRect(121, DUNGEON_COLS),
    wight:           spriteRect(121, DUNGEON_COLS),
    wraith:          spriteRect(121, DUNGEON_COLS),
    vampire_spawn:   spriteRect(121, DUNGEON_COLS),
    // --- winged (bat, row 10 col 0) ---
    stirge:          spriteRect(120, DUNGEON_COLS),
    harpy:           spriteRect(120, DUNGEON_COLS),
    wyvern:          spriteRect(120, DUNGEON_COLS),
    dragon_wyrmling: spriteRect(120, DUNGEON_COLS),
    young_dragon:    spriteRect(120, DUNGEON_COLS),
    // --- giants and brutes (cyclops, row 9 col 1) ---
    troll:           spriteRect(109, DUNGEON_COLS),
    ogre:            spriteRect(109, DUNGEON_COLS),
    minotaur:        spriteRect(109, DUNGEON_COLS),
    hill_giant:      spriteRect(109, DUNGEON_COLS),
    frost_giant:     spriteRect(109, DUNGEON_COLS),
    // --- robed casters (hooded, row 9 col 3) ---
    dark_mage:       spriteRect(111, DUNGEON_COLS),
    lich:            spriteRect(111, DUNGEON_COLS),
    mind_flayer:     spriteRect(111, DUNGEON_COLS),
    // --- armoured (closed helm, row 8 col 0) ---
    gargoyle:        spriteRect(96, DUNGEON_COLS),
    death_knight:    spriteRect(96, DUNGEON_COLS),
    // --- fiends and elementals (red horror, row 9 col 2) ---
    fire_elemental:  spriteRect(110, DUNGEON_COLS),
    demon:           spriteRect(110, DUNGEON_COLS),
    devil:           spriteRect(110, DUNGEON_COLS),
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
    goblin:          'rgba(60,100,20,0.3)',
    kobold:          'rgba(120,90,20,0.3)',
    rat:             'rgba(100,80,40,0.3)',
    stirge:          'rgba(100,0,20,0.3)',
    cockatrice:      'rgba(80,100,20,0.3)',
    bandit:          'rgba(80,60,20,0.3)',
    orc:             'rgba(60,80,20,0.3)',
    hobgoblin:       'rgba(60,40,0,0.3)',
    bugbear:         'rgba(90,50,10,0.3)',
    skeleton:        'rgba(60,60,80,0.35)',
    zombie:          'rgba(50,90,30,0.35)',
    ghoul:           'rgba(40,80,0,0.3)',
    wight:           'rgba(20,30,100,0.35)',
    wraith:          'rgba(60,20,80,0.35)',
    vampire_spawn:   'rgba(80,0,40,0.3)',
    wolf:            'rgba(70,50,30,0.3)',
    dire_wolf:       'rgba(80,0,0,0.3)',
    worg:            'rgba(50,50,50,0.35)',
    spider:          'rgba(30,30,30,0.35)',
    phase_spider:    'rgba(80,20,120,0.3)',
    basilisk:        'rgba(30,110,40,0.3)',
    owlbear:         'rgba(100,60,20,0.3)',
    manticore:       'rgba(100,20,20,0.3)',
    troll:           'rgba(40,90,40,0.3)',
    ogre:            'rgba(90,70,30,0.3)',
    minotaur:        'rgba(80,40,0,0.3)',
    hill_giant:      'rgba(110,70,20,0.3)',
    frost_giant:     'rgba(40,80,120,0.3)',
    dark_mage:       'rgba(50,0,70,0.3)',
    lich:            'rgba(0,60,80,0.3)',
    mind_flayer:     'rgba(80,20,100,0.35)',
    harpy:           'rgba(100,40,120,0.3)',
    wyvern:          'rgba(0,40,80,0.3)',
    dragon_wyrmling: 'rgba(80,0,0,0.3)',
    young_dragon:    'rgba(120,100,20,0.3)',
    gargoyle:        'rgba(80,80,80,0.35)',
    death_knight:    'rgba(100,10,10,0.35)',
    fire_elemental:  'rgba(120,60,0,0.35)',
    demon:           'rgba(120,30,10,0.35)',
    devil:           'rgba(100,10,20,0.3)',
    lizardfolk:      'rgba(20,100,30,0.3)',
    gnoll:           'rgba(120,80,20,0.3)',
  });

  const PARTY_TINTS = Object.freeze({
    ranger:  'rgba(0,50,0,0.25)',
    warlock: 'rgba(40,0,60,0.25)',
  });

  // Dimension terrain sprites -- each plane swaps ground and vegetation for
  // themed tiles of the overworld sheet; landmarks, roads and camps are shared.
  // Indices verified against tools/sheet-preview.html.
  const DIMENSION_TERRAIN_SPRITES = Object.freeze({
    material: OVERWORLD_TERRAIN_SPRITES,
    feywild: Object.freeze({
      ...OVERWORLD_TERRAIN_SPRITES,
      GRASS:  spriteRectM(402, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST: spriteRectM(529, OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:   spriteRectM(65, OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    shadowfell: Object.freeze({
      ...OVERWORLD_TERRAIN_SPRITES,
      GRASS:  spriteRectM(64, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST: spriteRectM(597, OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:   spriteRectM(9, OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    nine_hells: Object.freeze({
      ...OVERWORLD_TERRAIN_SPRITES,
      GRASS:  spriteRectM(1086, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST: spriteRectM(654, OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:   spriteRectM(8, OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    underdark: Object.freeze({
      ...OVERWORLD_TERRAIN_SPRITES,
      GRASS:  spriteRectM(9, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST: spriteRectM(276, OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:   spriteRectM(7, OVERWORLD_COLS, OVERWORLD_MARGIN),
    }),
    abyss: Object.freeze({
      ...OVERWORLD_TERRAIN_SPRITES,
      GRASS:  spriteRectM(1257, OVERWORLD_COLS, OVERWORLD_MARGIN),
      FOREST: spriteRectM(530, OVERWORLD_COLS, OVERWORLD_MARGIN),
      SAND:   spriteRectM(1086, OVERWORLD_COLS, OVERWORLD_MARGIN),
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

  const TERRAIN_LAYERS = Object.freeze({
    plains:        Object.freeze([{ sprite: 'plains' }]),
    forest:        Object.freeze([{ sprite: 'plains' }, { sprite: 'forest' }]),
    mountain:      Object.freeze([{ sprite: 'plains' }, { sprite: 'mountain' }]),
    ruins:         Object.freeze([{ sprite: 'dungeon_floor' }, { sprite: 'ruins' }]),
    dungeon_floor: Object.freeze([{ sprite: 'dungeon_floor' }]),
    water:         Object.freeze([{ sprite: 'water' }]),
    swamp:         Object.freeze([{ sprite: 'water' }, { sprite: 'swamp' }]),
    desert:        Object.freeze([{ sprite: 'sand' }]),
    snow:          Object.freeze([{ sprite: 'plains', tint: 'rgba(240,246,255,0.85)' }]),
    lava:          Object.freeze([{ sprite: 'lava' }]),
    bridge:        Object.freeze([{ sprite: 'water' }, { sprite: 'road' }]),
    road:          Object.freeze([{ sprite: 'road' }]),
    cave:          Object.freeze([{ sprite: 'cave', tint: 'rgba(10,5,15,0.35)' }]),
    wall:          Object.freeze([{ sprite: 'wall' }]),
  });

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

    // Generated sheets (pixel-art.js) are served alongside the loaded images.
    has(id) { return this.#images.has(id) || !!this.#generated(id); }
    get(id) { return this.#images.get(id) || this.#generated(id); }

    #generated(id) {
      return (TR.PixelArt && TR.PixelArt.get(id)) || (TR.TerrainArt && TR.TerrainArt.get(id)) || null;
    }

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
      const img = this.get(rect && rect.sheet || sheetId);
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
  TR.TERRAIN_LAYERS = TERRAIN_LAYERS;
})();
