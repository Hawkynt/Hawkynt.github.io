;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  class SpriteCompositor {
    #cache;
    #order;
    #maxSize;
    #corsBlocked;
    #stage;
    #stageCtx;
    #hits;
    #misses;

    constructor(maxSize = 1024) {
      this.#cache = new Map();
      this.#order = [];
      this.#maxSize = maxSize;
      this.#corsBlocked = false;
      this.#stage = null;
      this.#stageCtx = null;
      this.#hits = 0;
      this.#misses = 0;
    }

    get corsBlocked() { return this.#corsBlocked; }

    stats() {
      return {
        hits: this.#hits,
        misses: this.#misses,
        size: this.#cache.size,
        maxSize: this.#maxSize,
      };
    }

    invalidate() {
      this.#cache.clear();
      this.#order.length = 0;
      this.#hits = 0;
      this.#misses = 0;
    }

    drawComposite(ctx, layers, destSize, dx, dy) {
      if (!ctx || !layers || layers.length === 0)
        return;

      const key = this.#makeKey(layers, destSize);

      const cached = this.#cache.get(key);
      if (cached) {
        ++this.#hits;
        this.#touchLRU(key);
        ctx.drawImage(cached, dx, dy);
        return;
      }

      ++this.#misses;

      if (!this.#corsBlocked) {
        try {
          this.#ensureStage(destSize);
          const stage = this.#stageCtx;
          stage.clearRect(0, 0, destSize, destSize);
          stage.imageSmoothingEnabled = false;

          for (const layer of layers) {
            if (!layer.img || !layer.rect)
              continue;
            stage.globalCompositeOperation = 'source-over';
            stage.drawImage(layer.img, layer.rect.x, layer.rect.y, layer.rect.w, layer.rect.h, 0, 0, destSize, destSize);
            if (layer.tint) {
              stage.globalCompositeOperation = 'source-atop';
              stage.fillStyle = layer.tint;
              stage.fillRect(0, 0, destSize, destSize);
            }
          }
          stage.globalCompositeOperation = 'source-over';

          let cacheCanvas;
          if (typeof OffscreenCanvas !== 'undefined') {
            cacheCanvas = new OffscreenCanvas(destSize, destSize);
            cacheCanvas.getContext('2d').drawImage(this.#stage, 0, 0);
          } else {
            cacheCanvas = document.createElement('canvas');
            cacheCanvas.width = destSize;
            cacheCanvas.height = destSize;
            cacheCanvas.getContext('2d').drawImage(this.#stage, 0, 0);
          }

          this.#store(key, cacheCanvas);
          ctx.drawImage(this.#stage, 0, 0, destSize, destSize, dx, dy, destSize, destSize);
          return;
        } catch (_) {
          this.#corsBlocked = true;
        }
      }

      // CORS fallback: draw layers directly onto target ctx
      ctx.imageSmoothingEnabled = false;
      for (const layer of layers) {
        if (!layer.img || !layer.rect)
          continue;
        ctx.drawImage(layer.img, layer.rect.x, layer.rect.y, layer.rect.w, layer.rect.h, dx, dy, destSize, destSize);
        if (layer.tint) {
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = layer.tint;
          ctx.fillRect(dx, dy, destSize, destSize);
          ctx.restore();
        }
      }
    }

    #makeKey(layers, destSize) {
      let key = '' + destSize;
      for (const layer of layers) {
        const r = layer.rect;
        key += '|' + (r.sheet || '') + ':' + r.x + ',' + r.y + ',' + r.w + ',' + r.h;
        if (layer.tint)
          key += '~' + layer.tint;
      }
      return key;
    }

    #ensureStage(size) {
      if (this.#stage && this.#stage.width >= size && this.#stage.height >= size)
        return;
      if (typeof OffscreenCanvas !== 'undefined')
        this.#stage = new OffscreenCanvas(size, size);
      else {
        this.#stage = document.createElement('canvas');
        this.#stage.width = size;
        this.#stage.height = size;
      }
      this.#stageCtx = this.#stage.getContext('2d');
    }

    #touchLRU(key) {
      const idx = this.#order.indexOf(key);
      if (idx !== -1)
        this.#order.splice(idx, 1);
      this.#order.push(key);
    }

    #store(key, canvas) {
      this.#cache.set(key, canvas);
      this.#order.push(key);
      while (this.#order.length > this.#maxSize) {
        const evictKey = this.#order.shift();
        this.#cache.delete(evictKey);
      }
    }
  }

  TR.SpriteCompositor = SpriteCompositor;
})();
