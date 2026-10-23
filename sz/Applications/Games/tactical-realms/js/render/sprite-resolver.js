;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Maps creature IDs to sprite configs. Four formats supported:
  //   icon       -- single image per mob, no animation
  //   sheet      -- rect from an existing sprite sheet (dungeon tilemap)
  //   anim-sheet -- one sheet per mob, anims in rows, frames as columns
  //   anim-set   -- one sheet per mob per animation type (multiple files)
  // All formats support optional `tint` (CSS color string).
  // Creature sprites consumed from data/creature-sprites.js via _pending
  const _csPending = TR._pending?.creatureSprites || {};
  const _csObj = {};
  for (const [key, val] of Object.entries(_csPending))
    _csObj[key] = Object.freeze({ ...val });
  if (TR._pending) delete TR._pending.creatureSprites;
  const CREATURE_SPRITE_REGISTRY = Object.freeze(_csObj);

  const DIRECTION_OPPOSITES = Object.freeze({
    left: 'right', right: 'left', up: 'down', down: 'up',
  });

  class SpriteResolver {
    #assetLoader;
    #loadedImages;
    #failedPaths;
    #pendingLoads;

    constructor(assetLoader) {
      this.#assetLoader = assetLoader || null;
      this.#loadedImages = new Map();
      this.#failedPaths = new Set();
      this.#pendingLoads = new Set();
    }

    get loadedCount() { return this.#loadedImages.size; }

    isLoaded(path) { return this.#loadedImages.has(path); }

    preloadCreatures(creatureIds) {
      for (const id of creatureIds) {
        const entry = CREATURE_SPRITE_REGISTRY[id];
        if (!entry)
          continue;
        if (entry.type === 'icon')
          this.#getOrLoadImage(entry.path);
        else if (entry.type === 'anim-sheet')
          this.#getOrLoadImage(entry.path);
        else if (entry.type === 'anim-set' && entry.anims)
          for (const anim of Object.values(entry.anims))
            if (anim.path)
              this.#getOrLoadImage(anim.path);
      }
    }

    resolve(creatureId, category, animType, direction, frame) {
      if (!creatureId)
        return null;

      animType = animType || 'stand';
      direction = direction || 'down';
      frame = frame || 0;

      // Priority 1: CREATURE_SPRITE_REGISTRY
      const entry = CREATURE_SPRITE_REGISTRY[creatureId];
      if (entry) {
        const result = this.#resolveEntry(entry, animType, direction, frame);
        if (result)
          return result;
      }

      // Priority 2: dungeon tilemap via TR.resolveSprite
      const sheetResult = this.#resolveSheet(creatureId, category);
      if (sheetResult)
        return sheetResult;

      // Priority 3: null -- caller draws colored circle with letter
      return null;
    }

    #resolveEntry(entry, animType, direction, frame) {
      switch (entry.type) {
        case 'icon':
          return this.#resolveIcon(entry);
        case 'sheet':
          return this.#resolveSheetEntry(entry);
        case 'anim-sheet':
          return this.#resolveAnimSheet(entry, animType, direction, frame);
        case 'anim-set':
          return this.#resolveAnimSet(entry, animType, direction, frame);
        default:
          return null;
      }
    }

    #resolveIcon(entry) {
      const img = this.#getOrLoadImage(entry.path);
      if (!img)
        return null;
      return {
        img,
        srcX: 0, srcY: 0,
        srcW: img.width || img.naturalWidth || 32,
        srcH: img.height || img.naturalHeight || 32,
        flip: false,
        tint: entry.tint || null,
      };
    }

    #resolveSheetEntry(entry) {
      const loader = this.#assetLoader;
      const sheetId = entry.sheetId || 'dungeon';
      if (!loader || !loader.ready || !loader.has(sheetId))
        return null;
      const img = loader.get(sheetId);
      if (!img || !entry.rect)
        return null;
      return {
        img,
        srcX: entry.rect.x, srcY: entry.rect.y,
        srcW: entry.rect.w, srcH: entry.rect.h,
        flip: false,
        tint: entry.tint || null,
      };
    }

    #resolveAnimSheet(entry, animType, direction, frame) {
      const img = this.#getOrLoadImage(entry.path);
      if (!img || !entry.anims)
        return null;

      const anim = this.#resolveAnimType(entry.anims, animType);
      if (!anim)
        return null;

      const fw = entry.frameW || 32;
      const fh = entry.frameH || 32;
      const totalFrames = anim.frames || 1;
      const safeFrame = frame % totalFrames;

      let row = anim.row || 0;
      let flip = false;

      if (anim.directions) {
        const dirResult = this.#resolveDirection(anim.directions, direction);
        row = anim.row + dirResult.offset;
        flip = dirResult.flip;
      }

      return {
        img,
        srcX: safeFrame * fw,
        srcY: row * fh,
        srcW: fw,
        srcH: fh,
        flip,
        tint: entry.tint || null,
      };
    }

    #resolveAnimSet(entry, animType, direction, frame) {
      if (!entry.anims)
        return null;

      const anim = this.#resolveAnimType(entry.anims, animType);
      if (!anim || !anim.path)
        return null;

      const img = this.#getOrLoadImage(anim.path);
      if (!img)
        return null;

      const fw = entry.frameW || 64;
      const fh = entry.frameH || 64;
      const totalFrames = anim.frames || 1;
      const safeFrame = frame % totalFrames;

      let flip = false;
      let dirRow = 0;
      if (anim.directions) {
        const dirResult = this.#resolveDirection(anim.directions, direction);
        dirRow = dirResult.offset;
        flip = dirResult.flip;
      }

      return {
        img,
        srcX: safeFrame * fw,
        srcY: dirRow * fh,
        srcW: fw,
        srcH: fh,
        flip,
        tint: entry.tint || null,
      };
    }

    #resolveAnimType(anims, requested) {
      if (anims[requested])
        return anims[requested];
      if (anims.stand)
        return anims.stand;
      if (anims.idle)
        return anims.idle;
      const keys = Object.keys(anims);
      return keys.length > 0 ? anims[keys[0]] : null;
    }

    #resolveDirection(directions, requested) {
      if (directions[requested])
        return { offset: directions[requested], flip: false };

      const opposite = DIRECTION_OPPOSITES[requested];
      if (opposite && directions[opposite])
        return { offset: directions[opposite], flip: true };

      if (directions.down)
        return { offset: directions.down, flip: false };

      const keys = Object.keys(directions);
      if (keys.length > 0)
        return { offset: directions[keys[0]], flip: false };

      return { offset: 0, flip: false };
    }

    #resolveSheet(creatureId, category) {
      const resolve = TR.resolveSprite;
      const loader = this.#assetLoader;
      if (!resolve || !loader || !loader.ready)
        return null;

      const rect = resolve(creatureId, category);
      if (!rect)
        return null;

      const sheetId = rect.sheet || 'dungeon';
      if (!loader.has(sheetId))
        return null;

      const img = loader.get(sheetId);
      if (!img)
        return null;

      const tintMap = category === 'party' ? TR.PARTY_TINTS : TR.ENEMY_TINTS;
      const tint = tintMap && tintMap[creatureId] ? tintMap[creatureId] : null;

      return {
        img,
        srcX: rect.x, srcY: rect.y,
        srcW: rect.w, srcH: rect.h,
        flip: false,
        tint,
      };
    }

    #getOrLoadImage(path) {
      if (this.#loadedImages.has(path))
        return this.#loadedImages.get(path);

      if (this.#failedPaths.has(path))
        return null;

      if (this.#pendingLoads.has(path))
        return null;

      this.#pendingLoads.add(path);
      const img = new Image();
      img.onload = () => {
        this.#loadedImages.set(path, img);
        this.#pendingLoads.delete(path);
      };
      img.onerror = () => {
        this.#failedPaths.add(path);
        this.#pendingLoads.delete(path);
      };
      img.src = path;
      return null;
    }
  }

  TR.SpriteResolver = SpriteResolver;
  TR.CREATURE_SPRITE_REGISTRY = CREATURE_SPRITE_REGISTRY;
})();
