;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const DEFAULT_WIDTH = 1280;
  const DEFAULT_HEIGHT = 720;
  const DEFAULT_TILE_SIZE = 32;

  function brighten(hex, f) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7)
      return hex;
    const n = parseInt(hex.slice(1), 16);
    const ch = sh => Math.min(255, Math.round(((n >> sh) & 255) * f));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  class Renderer {
    _canvas;
    _ctx;
    _buffer;
    _bufCtx;
    _width;
    _height;
    _tileSize;
    _camera;
    _assets;
    _compositor;
    _lightCanvas = null;

    get width() { return this._width; }
    get height() { return this._height; }
    get tileSize() { return this._tileSize; }

    set assets(loader) { this._assets = loader; }
    get assets() { return this._assets; }
    get bufCtx() { return this._bufCtx; }

    get compositor() { return this._compositor; }

    get camera() {
      return { x: this._camera.x, y: this._camera.y };
    }

    set camera(pos) {
      this._camera.x = pos.x;
      this._camera.y = pos.y;
    }

    constructor(canvas, { width, height, tileSize } = {}) {
      this._width = width || DEFAULT_WIDTH;
      this._height = height || DEFAULT_HEIGHT;
      this._tileSize = tileSize || DEFAULT_TILE_SIZE;
      this._camera = { x: 0, y: 0 };
      this._assets = null;
      this._compositor = new TR.SpriteCompositor(1024);

      if (canvas) {
        this._canvas = canvas;
        canvas.width = this._width;
        canvas.height = this._height;
        this._ctx = canvas.getContext('2d');

        if (typeof OffscreenCanvas !== 'undefined') {
          this._buffer = new OffscreenCanvas(this._width, this._height);
        } else {
          this._buffer = document.createElement('canvas');
          this._buffer.width = this._width;
          this._buffer.height = this._height;
        }
        this._bufCtx = this._buffer.getContext('2d');
      } else {
        this._canvas = null;
        this._ctx = null;
        this._buffer = null;
        this._bufCtx = null;
      }
    }

    centerOn(worldX, worldY) {
      this._camera.x = worldX - Math.floor(this._width / 2);
      this._camera.y = worldY - Math.floor(this._height / 2);
    }

    worldToScreen(worldX, worldY) {
      return {
        x: worldX - this._camera.x,
        y: worldY - this._camera.y
      };
    }

    screenToWorld(screenX, screenY) {
      return {
        x: screenX + this._camera.x,
        y: screenY + this._camera.y
      };
    }

    isVisible(worldX, worldY, w, h) {
      const sx = worldX - this._camera.x;
      const sy = worldY - this._camera.y;
      return sx + w > 0 && sx < this._width && sy + h > 0 && sy < this._height;
    }

    beginFrame() {
      if (!this._bufCtx)
        return;
      this._bufCtx.clearRect(0, 0, this._width, this._height);
    }

    endFrame() {
      if (!this._ctx || !this._buffer)
        return;
      this._ctx.clearRect(0, 0, this._width, this._height);
      this._ctx.drawImage(this._buffer, 0, 0);
    }


    // groundGetter: optional (col, row) => painted ground id; with it every
    // plane draws its own painted ground, roads and features.
    drawImage(image, x, y, w, h) {
      if (!this._bufCtx || !image)
        return;
      this._bufCtx.drawImage(image, x, y, w, h);
    }




  }

  TR.Renderer = Renderer;
})();
