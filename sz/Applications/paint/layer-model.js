;(function() {
  'use strict';

  const PaintApp = window.PaintApp || (window.PaintApp = {});

  // -----------------------------------------------------------------------
  // Layer: a single offscreen canvas with metadata
  // -----------------------------------------------------------------------
  class Layer {
    #canvas;
    #ctx;
    #name;
    #visible;
    #opacity;
    #blendMode;

    constructor(w, h, name) {
      this.#canvas = document.createElement('canvas');
      this.#canvas.width = w;
      this.#canvas.height = h;
      this.#ctx = this.#canvas.getContext('2d', { willReadFrequently: true });
      this.#ctx.imageSmoothingEnabled = false;
      this.#name = name;
      this.#visible = true;
      this.#opacity = 1.0;
      this.#blendMode = 'source-over';
    }

    get canvas() { return this.#canvas; }
    get ctx() { return this.#ctx; }
    get name() { return this.#name; }
    set name(v) { this.#name = v; }
    get visible() { return this.#visible; }
    set visible(v) { this.#visible = v; }
    get opacity() { return this.#opacity; }
    set opacity(v) { this.#opacity = Math.max(0, Math.min(1, v)); }
    get blendMode() { return this.#blendMode; }
    set blendMode(v) { this.#blendMode = v; }
    get width() { return this.#canvas.width; }
    get height() { return this.#canvas.height; }

    resize(w, h) {
      const imgData = this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
      this.#canvas.width = w;
      this.#canvas.height = h;
      this.#ctx.imageSmoothingEnabled = false;
      this.#ctx.putImageData(imgData, 0, 0);
    }

    clear() {
      this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }

    fillWhite() {
      this.#ctx.fillStyle = '#ffffff';
      this.#ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    }

    getImageData() {
      return this.#ctx.getImageData(0, 0, this.#canvas.width, this.#canvas.height);
    }

    putImageData(data) {
      this.#ctx.putImageData(data, 0, 0);
    }

    serialize() {
      return {
        name: this.#name,
        visible: this.#visible,
        opacity: this.#opacity,
        blendMode: this.#blendMode,
        dataUrl: this.#canvas.toDataURL()
      };
    }

    static deserialize(data, w, h) {
      return new Promise(resolve => {
        const layer = new Layer(w, h, data.name);
        layer.visible = data.visible;
        layer.opacity = data.opacity;
        layer.blendMode = data.blendMode;
        const img = new Image();
        img.onload = () => {
          layer.ctx.drawImage(img, 0, 0);
          resolve(layer);
        };
        img.onerror = () => resolve(layer);
        img.src = data.dataUrl;
      });
    }
  }

  // -----------------------------------------------------------------------
  // Blend modes -- Canvas composite operations
  // -----------------------------------------------------------------------
  const BLEND_MODES = [
    { value: 'source-over', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'darken', label: 'Darken' },
    { value: 'lighten', label: 'Lighten' },
    { value: 'color-dodge', label: 'Color Dodge' },
    { value: 'color-burn', label: 'Color Burn' },
    { value: 'hard-light', label: 'Hard Light' },
    { value: 'soft-light', label: 'Soft Light' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' }
  ];

  // -----------------------------------------------------------------------
  // LayerModel: manages an ordered array of layers
  // -----------------------------------------------------------------------
  class LayerModel {
    #layers = [];
    #activeIndex = 0;
    #width = 640;
    #height = 480;
    #onChange = null;

    get layers() { return this.#layers; }
    get activeIndex() { return this.#activeIndex; }
    set activeIndex(i) {
      if (i >= 0 && i < this.#layers.length)
        this.#activeIndex = i;
    }
    get activeLayer() { return this.#layers[this.#activeIndex]; }
    get width() { return this.#width; }
    get height() { return this.#height; }
    get count() { return this.#layers.length; }

    set onChange(fn) { this.#onChange = fn; }

    #notify() {
      if (typeof this.#onChange === 'function')
        this.#onChange();
    }

    init(w, h) {
      this.#width = w;
      this.#height = h;
      this.#layers = [];
      const bg = new Layer(w, h, 'Background');
      bg.fillWhite();
      this.#layers.push(bg);
      this.#activeIndex = 0;
      this.#notify();
    }

    getActiveCtx() {
      return this.#layers[this.#activeIndex].ctx;
    }

    getActiveCanvas() {
      return this.#layers[this.#activeIndex].canvas;
    }

    addLayer(name) {
      const n = name || ('Layer ' + (this.#layers.length + 1));
      const layer = new Layer(this.#width, this.#height, n);
      this.#layers.splice(this.#activeIndex + 1, 0, layer);
      this.#activeIndex = this.#activeIndex + 1;
      this.#notify();
      return this.#activeIndex;
    }

    deleteLayer(i) {
      if (this.#layers.length <= 1)
        return false;
      const idx = i != null ? i : this.#activeIndex;
      this.#layers.splice(idx, 1);
      if (this.#activeIndex >= this.#layers.length)
        this.#activeIndex = this.#layers.length - 1;
      else if (this.#activeIndex > idx)
        --this.#activeIndex;
      this.#notify();
      return true;
    }

    moveLayer(from, to) {
      if (from < 0 || from >= this.#layers.length || to < 0 || to >= this.#layers.length || from === to)
        return;
      const [layer] = this.#layers.splice(from, 1);
      this.#layers.splice(to, 0, layer);
      if (this.#activeIndex === from)
        this.#activeIndex = to;
      else {
        if (this.#activeIndex > from && this.#activeIndex <= to)
          --this.#activeIndex;
        else if (this.#activeIndex < from && this.#activeIndex >= to)
          ++this.#activeIndex;
      }
      this.#notify();
    }

    duplicateLayer(i) {
      const idx = i != null ? i : this.#activeIndex;
      const src = this.#layers[idx];
      const dup = new Layer(this.#width, this.#height, src.name + ' copy');
      dup.visible = src.visible;
      dup.opacity = src.opacity;
      dup.blendMode = src.blendMode;
      dup.ctx.drawImage(src.canvas, 0, 0);
      this.#layers.splice(idx + 1, 0, dup);
      this.#activeIndex = idx + 1;
      this.#notify();
    }

    mergeDown(i) {
      const idx = i != null ? i : this.#activeIndex;
      if (idx <= 0 || idx >= this.#layers.length)
        return false;
      const upper = this.#layers[idx];
      const lower = this.#layers[idx - 1];
      lower.ctx.globalAlpha = upper.opacity;
      lower.ctx.globalCompositeOperation = upper.blendMode;
      lower.ctx.drawImage(upper.canvas, 0, 0);
      lower.ctx.globalAlpha = 1;
      lower.ctx.globalCompositeOperation = 'source-over';
      this.#layers.splice(idx, 1);
      this.#activeIndex = idx - 1;
      this.#notify();
      return true;
    }

    flattenAll() {
      if (this.#layers.length <= 1)
        return;
      const tmp = document.createElement('canvas');
      tmp.width = this.#width;
      tmp.height = this.#height;
      const tctx = tmp.getContext('2d');
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, this.#width, this.#height);
      for (const layer of this.#layers) {
        if (!layer.visible)
          continue;
        tctx.globalAlpha = layer.opacity;
        tctx.globalCompositeOperation = layer.blendMode;
        tctx.drawImage(layer.canvas, 0, 0);
      }
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = 'source-over';
      this.#layers = [];
      const bg = new Layer(this.#width, this.#height, 'Background');
      bg.ctx.drawImage(tmp, 0, 0);
      this.#layers.push(bg);
      this.#activeIndex = 0;
      this.#notify();
    }

    compositeToDisplay(displayCtx) {
      const dw = displayCtx.canvas.width;
      const dh = displayCtx.canvas.height;
      displayCtx.clearRect(0, 0, dw, dh);

      // white background for compositing
      displayCtx.fillStyle = '#ffffff';
      displayCtx.fillRect(0, 0, this.#width, this.#height);

      for (const layer of this.#layers) {
        if (!layer.visible)
          continue;
        displayCtx.globalAlpha = layer.opacity;
        displayCtx.globalCompositeOperation = layer.blendMode;
        displayCtx.drawImage(layer.canvas, 0, 0);
      }
      displayCtx.globalAlpha = 1;
      displayCtx.globalCompositeOperation = 'source-over';
    }

    renderThumbnail(layerIndex, thumbCanvas) {
      const layer = this.#layers[layerIndex];
      if (!layer)
        return;
      const tctx = thumbCanvas.getContext('2d');
      tctx.clearRect(0, 0, thumbCanvas.width, thumbCanvas.height);

      // checkerboard for transparency
      const cw = thumbCanvas.width;
      const ch = thumbCanvas.height;
      const s = 4;
      for (let y = 0; y < ch; y += s)
        for (let x = 0; x < cw; x += s) {
          tctx.fillStyle = ((x / s + y / s) % 2 === 0) ? '#ccc' : '#fff';
          tctx.fillRect(x, y, s, s);
        }

      tctx.drawImage(layer.canvas, 0, 0, this.#width, this.#height, 0, 0, cw, ch);
    }

    resize(w, h) {
      this.#width = w;
      this.#height = h;
      for (const layer of this.#layers)
        layer.resize(w, h);
      this.#notify();
    }

    resizeCanvas(w, h, bgColor) {
      const oldW = this.#width;
      const oldH = this.#height;
      this.#width = w;
      this.#height = h;
      for (const layer of this.#layers) {
        const imgData = layer.getImageData();
        layer.canvas.width = w;
        layer.canvas.height = h;
        layer.ctx.imageSmoothingEnabled = false;
        layer.ctx.putImageData(imgData, 0, 0);
      }
      this.#notify();
    }

    stretchResize(w, h) {
      for (const layer of this.#layers) {
        const tmp = document.createElement('canvas');
        tmp.width = this.#width;
        tmp.height = this.#height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0);
        layer.canvas.width = w;
        layer.canvas.height = h;
        layer.ctx.imageSmoothingEnabled = false;
        layer.ctx.drawImage(tmp, 0, 0, this.#width, this.#height, 0, 0, w, h);
      }
      this.#width = w;
      this.#height = h;
      this.#notify();
    }

    stretchResizeWith(w, h, scalerFn) {
      for (const layer of this.#layers) {
        const srcData = layer.getImageData();
        const dstData = scalerFn(srcData, w, h);
        layer.canvas.width = dstData.width;
        layer.canvas.height = dstData.height;
        layer.ctx.putImageData(dstData, 0, 0);
      }
      this.#width = w;
      this.#height = h;
      this.#notify();
    }

    // Undo helpers
    serializeLayer(i) {
      return this.#layers[i].getImageData();
    }

    restoreLayer(i, imageData) {
      const layer = this.#layers[i];
      if (imageData.width !== layer.width || imageData.height !== layer.height) {
        layer.canvas.width = imageData.width;
        layer.canvas.height = imageData.height;
        layer.ctx.imageSmoothingEnabled = false;
      }
      layer.putImageData(imageData);
    }

    serializeAll() {
      return {
        width: this.#width,
        height: this.#height,
        activeIndex: this.#activeIndex,
        layers: this.#layers.map(l => ({
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          blendMode: l.blendMode,
          imageData: l.getImageData()
        }))
      };
    }

    restoreAll(state) {
      this.#width = state.width;
      this.#height = state.height;
      this.#layers = state.layers.map(s => {
        const layer = new Layer(state.width, state.height, s.name);
        layer.visible = s.visible;
        layer.opacity = s.opacity;
        layer.blendMode = s.blendMode;
        layer.putImageData(s.imageData);
        return layer;
      });
      this.#activeIndex = Math.min(state.activeIndex, this.#layers.length - 1);
      this.#notify();
    }

    // Image operations on active layer
    flipH() {
      const layer = this.activeLayer;
      const tmp = document.createElement('canvas');
      tmp.width = this.#width;
      tmp.height = this.#height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(layer.canvas, 0, 0);
      layer.ctx.clearRect(0, 0, this.#width, this.#height);
      layer.ctx.save();
      layer.ctx.translate(this.#width, 0);
      layer.ctx.scale(-1, 1);
      layer.ctx.drawImage(tmp, 0, 0);
      layer.ctx.restore();
    }

    flipV() {
      const layer = this.activeLayer;
      const tmp = document.createElement('canvas');
      tmp.width = this.#width;
      tmp.height = this.#height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(layer.canvas, 0, 0);
      layer.ctx.clearRect(0, 0, this.#width, this.#height);
      layer.ctx.save();
      layer.ctx.translate(0, this.#height);
      layer.ctx.scale(1, -1);
      layer.ctx.drawImage(tmp, 0, 0);
      layer.ctx.restore();
    }

    flipAllH() {
      for (let i = 0; i < this.#layers.length; ++i) {
        const old = this.#activeIndex;
        this.#activeIndex = i;
        this.flipH();
        this.#activeIndex = old;
      }
    }

    flipAllV() {
      for (let i = 0; i < this.#layers.length; ++i) {
        const old = this.#activeIndex;
        this.#activeIndex = i;
        this.flipV();
        this.#activeIndex = old;
      }
    }

    rotateAllCW() {
      const newW = this.#height;
      const newH = this.#width;
      for (const layer of this.#layers) {
        const tmp = document.createElement('canvas');
        tmp.width = this.#width;
        tmp.height = this.#height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0);
        layer.canvas.width = newW;
        layer.canvas.height = newH;
        layer.ctx.imageSmoothingEnabled = false;
        layer.ctx.save();
        layer.ctx.translate(newW, 0);
        layer.ctx.rotate(Math.PI / 2);
        layer.ctx.drawImage(tmp, 0, 0);
        layer.ctx.restore();
      }
      this.#width = newW;
      this.#height = newH;
      this.#notify();
    }

    rotateAllCCW() {
      const newW = this.#height;
      const newH = this.#width;
      for (const layer of this.#layers) {
        const tmp = document.createElement('canvas');
        tmp.width = this.#width;
        tmp.height = this.#height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0);
        layer.canvas.width = newW;
        layer.canvas.height = newH;
        layer.ctx.imageSmoothingEnabled = false;
        layer.ctx.save();
        layer.ctx.translate(0, newH);
        layer.ctx.rotate(-Math.PI / 2);
        layer.ctx.drawImage(tmp, 0, 0);
        layer.ctx.restore();
      }
      this.#width = newW;
      this.#height = newH;
      this.#notify();
    }

    rotateAll180() {
      for (const layer of this.#layers) {
        const tmp = document.createElement('canvas');
        tmp.width = this.#width;
        tmp.height = this.#height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(layer.canvas, 0, 0);
        layer.ctx.clearRect(0, 0, this.#width, this.#height);
        layer.ctx.save();
        layer.ctx.translate(this.#width, this.#height);
        layer.ctx.rotate(Math.PI);
        layer.ctx.drawImage(tmp, 0, 0);
        layer.ctx.restore();
      }
      this.#notify();
    }

    // Flatten to a single canvas for export
    flattenToCanvas() {
      const c = document.createElement('canvas');
      c.width = this.#width;
      c.height = this.#height;
      const tctx = c.getContext('2d');
      tctx.fillStyle = '#ffffff';
      tctx.fillRect(0, 0, this.#width, this.#height);
      for (const layer of this.#layers) {
        if (!layer.visible)
          continue;
        tctx.globalAlpha = layer.opacity;
        tctx.globalCompositeOperation = layer.blendMode;
        tctx.drawImage(layer.canvas, 0, 0);
      }
      return c;
    }

    // Load an image as a single background layer
    loadFromImage(img) {
      this.#width = img.width;
      this.#height = img.height;
      this.#layers = [];
      const bg = new Layer(img.width, img.height, 'Background');
      bg.ctx.drawImage(img, 0, 0);
      this.#layers.push(bg);
      this.#activeIndex = 0;
      this.#notify();
    }

    // Crop all layers to a bounding box
    cropTo(x, y, w, h) {
      for (const layer of this.#layers) {
        const imgData = layer.ctx.getImageData(x, y, w, h);
        layer.canvas.width = w;
        layer.canvas.height = h;
        layer.ctx.imageSmoothingEnabled = false;
        layer.putImageData(imgData);
      }
      this.#width = w;
      this.#height = h;
      this.#notify();
    }
  }

  PaintApp.Layer = Layer;
  PaintApp.LayerModel = LayerModel;
  PaintApp.BLEND_MODES = BLEND_MODES;
})();
