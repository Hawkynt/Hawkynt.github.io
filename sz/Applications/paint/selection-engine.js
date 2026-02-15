;(function() {
  'use strict';

  const PaintApp = window.PaintApp || (window.PaintApp = {});

  // -----------------------------------------------------------------------
  // SelectionEngine: mask-based selection system
  // -----------------------------------------------------------------------
  class SelectionEngine {
    #maskCanvas;
    #maskCtx;
    #width = 0;
    #height = 0;
    #hasMask = false;
    #marchingAntsId = null;
    #dashOffset = 0;
    #clipboardData = null;

    init(w, h) {
      this.#width = w;
      this.#height = h;
      this.#maskCanvas = document.createElement('canvas');
      this.#maskCanvas.width = w;
      this.#maskCanvas.height = h;
      this.#maskCtx = this.#maskCanvas.getContext('2d', { willReadFrequently: true });
      this.clear();
    }

    resize(w, h) {
      const old = this.#hasMask ? this.#maskCtx.getImageData(0, 0, this.#width, this.#height) : null;
      this.#width = w;
      this.#height = h;
      this.#maskCanvas.width = w;
      this.#maskCanvas.height = h;
      if (old)
        this.#maskCtx.putImageData(old, 0, 0);
    }

    get hasMask() { return this.#hasMask; }
    get maskCanvas() { return this.#maskCanvas; }
    get width() { return this.#width; }
    get height() { return this.#height; }
    get clipboardData() { return this.#clipboardData; }

    clear() {
      this.#maskCtx.clearRect(0, 0, this.#width, this.#height);
      this.#hasMask = false;
      this.stopMarchingAnts();
    }

    selectAll() {
      this.#maskCtx.fillStyle = '#ffffff';
      this.#maskCtx.fillRect(0, 0, this.#width, this.#height);
      this.#hasMask = true;
    }

    invert() {
      if (!this.#hasMask) {
        this.selectAll();
        return;
      }
      const imgData = this.#maskCtx.getImageData(0, 0, this.#width, this.#height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
        // keep alpha at 255
        d[i + 3] = 255;
      }
      this.#maskCtx.putImageData(imgData, 0, 0);
    }

    // Mode: 'replace', 'add', 'subtract', 'intersect'
    #applyMode(mode) {
      if (mode === 'replace') {
        this.#maskCtx.clearRect(0, 0, this.#width, this.#height);
        return 'source-over';
      }
      if (mode === 'add')
        return 'source-over';
      if (mode === 'subtract') {
        return 'destination-out';
      }
      if (mode === 'intersect')
        return 'destination-in';
      return 'source-over';
    }

    selectRect(x, y, w, h, mode) {
      const op = this.#applyMode(mode);
      this.#maskCtx.globalCompositeOperation = op;
      this.#maskCtx.fillStyle = '#ffffff';
      this.#maskCtx.fillRect(x, y, w, h);
      this.#maskCtx.globalCompositeOperation = 'source-over';
      this.#hasMask = true;
    }

    selectLasso(points, mode) {
      if (points.length < 3)
        return;
      const op = this.#applyMode(mode);
      this.#maskCtx.globalCompositeOperation = op;
      this.#maskCtx.fillStyle = '#ffffff';
      this.#maskCtx.beginPath();
      this.#maskCtx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; ++i)
        this.#maskCtx.lineTo(points[i].x, points[i].y);
      this.#maskCtx.closePath();
      this.#maskCtx.fill();
      this.#maskCtx.globalCompositeOperation = 'source-over';
      this.#hasMask = true;
    }

    selectMagicWand(sx, sy, tolerance, sourceImageData, mode) {
      const w = this.#width;
      const h = this.#height;
      const src = sourceImageData.data;

      const idx = (sy * w + sx) * 4;
      const tr = src[idx];
      const tg = src[idx + 1];
      const tb = src[idx + 2];
      const ta = src[idx + 3];

      const visited = new Uint8Array(w * h);
      const selected = new Uint8Array(w * h);

      const stack = [[sx, sy]];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        const pi = cy * w + cx;
        if (visited[pi])
          continue;
        visited[pi] = 1;

        const i4 = pi * 4;
        const dr = Math.abs(src[i4] - tr);
        const dg = Math.abs(src[i4 + 1] - tg);
        const db = Math.abs(src[i4 + 2] - tb);
        const da = Math.abs(src[i4 + 3] - ta);
        if (dr > tolerance || dg > tolerance || db > tolerance || da > tolerance)
          continue;

        selected[pi] = 1;

        if (cx > 0) stack.push([cx - 1, cy]);
        if (cx < w - 1) stack.push([cx + 1, cy]);
        if (cy > 0) stack.push([cx, cy - 1]);
        if (cy < h - 1) stack.push([cx, cy + 1]);
      }

      // Build mask from selected pixels
      const op = this.#applyMode(mode);
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = w;
      tmpCanvas.height = h;
      const tmpCtx = tmpCanvas.getContext('2d');
      const tmpData = tmpCtx.createImageData(w, h);
      const td = tmpData.data;
      for (let i = 0; i < selected.length; ++i) {
        if (selected[i]) {
          const j = i * 4;
          td[j] = 255;
          td[j + 1] = 255;
          td[j + 2] = 255;
          td[j + 3] = 255;
        }
      }
      tmpCtx.putImageData(tmpData, 0, 0);

      this.#maskCtx.globalCompositeOperation = op;
      this.#maskCtx.drawImage(tmpCanvas, 0, 0);
      this.#maskCtx.globalCompositeOperation = 'source-over';
      this.#hasMask = true;
    }

    // Get the bounding box of the selection mask
    getBounds() {
      if (!this.#hasMask)
        return null;
      const imgData = this.#maskCtx.getImageData(0, 0, this.#width, this.#height);
      const d = imgData.data;
      let minX = this.#width, minY = this.#height, maxX = -1, maxY = -1;
      for (let y = 0; y < this.#height; ++y)
        for (let x = 0; x < this.#width; ++x) {
          if (d[(y * this.#width + x) * 4] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      if (maxX < 0)
        return null;
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    // Apply selection mask to a layer operation
    // Draw unrestricted, then mask the result
    applyMaskToLayer(layerCtx, originalImageData) {
      if (!this.#hasMask)
        return;
      const current = layerCtx.getImageData(0, 0, this.#width, this.#height);
      const cd = current.data;
      const od = originalImageData.data;
      const mask = this.#maskCtx.getImageData(0, 0, this.#width, this.#height).data;

      for (let i = 0; i < cd.length; i += 4) {
        const m = mask[i] / 255; // 0..1
        if (m < 1) {
          // Blend: use original where not selected
          cd[i] = Math.round(cd[i] * m + od[i] * (1 - m));
          cd[i + 1] = Math.round(cd[i + 1] * m + od[i + 1] * (1 - m));
          cd[i + 2] = Math.round(cd[i + 2] * m + od[i + 2] * (1 - m));
          cd[i + 3] = Math.round(cd[i + 3] * m + od[i + 3] * (1 - m));
        }
      }
      layerCtx.putImageData(current, 0, 0);
    }

    // Copy pixels from source within mask
    copyFromLayer(layerCtx) {
      if (!this.#hasMask) {
        this.#clipboardData = layerCtx.getImageData(0, 0, this.#width, this.#height);
        return;
      }
      const bounds = this.getBounds();
      if (!bounds)
        return;
      const src = layerCtx.getImageData(0, 0, this.#width, this.#height);
      const mask = this.#maskCtx.getImageData(0, 0, this.#width, this.#height);
      const result = new ImageData(bounds.w, bounds.h);
      const rd = result.data;
      const sd = src.data;
      const md = mask.data;

      for (let y = 0; y < bounds.h; ++y)
        for (let x = 0; x < bounds.w; ++x) {
          const si = ((bounds.y + y) * this.#width + (bounds.x + x)) * 4;
          const mi = si;
          const di = (y * bounds.w + x) * 4;
          const m = md[mi] / 255;
          rd[di] = sd[si];
          rd[di + 1] = sd[si + 1];
          rd[di + 2] = sd[si + 2];
          rd[di + 3] = Math.round(sd[si + 3] * m);
        }
      this.#clipboardData = { imageData: result, x: bounds.x, y: bounds.y };
    }

    // Cut: copy + fill masked area with transparent
    cutFromLayer(layerCtx) {
      this.copyFromLayer(layerCtx);
      if (!this.#hasMask)
        return;
      const imgData = layerCtx.getImageData(0, 0, this.#width, this.#height);
      const d = imgData.data;
      const mask = this.#maskCtx.getImageData(0, 0, this.#width, this.#height).data;
      for (let i = 0; i < d.length; i += 4) {
        const m = mask[i] / 255;
        if (m > 0) {
          d[i + 3] = Math.round(d[i + 3] * (1 - m));
        }
      }
      layerCtx.putImageData(imgData, 0, 0);
    }

    // Paste returns image data for the controller to create a new layer
    getPasteData() {
      return this.#clipboardData;
    }

    setClipboardData(data) {
      this.#clipboardData = data;
    }

    // Marching ants animation
    startMarchingAnts(overlayCtx, getDisplayTransform) {
      this.stopMarchingAnts();
      if (!this.#hasMask)
        return;

      const self = this;
      const animate = () => {
        self.#dashOffset = (self.#dashOffset + 0.5) % 8;
        self.#drawMarchingAnts(overlayCtx, getDisplayTransform);
        self.#marchingAntsId = requestAnimationFrame(animate);
      };
      this.#marchingAntsId = requestAnimationFrame(animate);
    }

    stopMarchingAnts() {
      if (this.#marchingAntsId != null) {
        cancelAnimationFrame(this.#marchingAntsId);
        this.#marchingAntsId = null;
      }
    }

    #drawMarchingAnts(overlayCtx, getDisplayTransform) {
      // Edge-detect the mask and draw the boundary
      const mask = this.#maskCtx.getImageData(0, 0, this.#width, this.#height);
      const d = mask.data;
      const w = this.#width;
      const h = this.#height;

      overlayCtx.clearRect(0, 0, overlayCtx.canvas.width, overlayCtx.canvas.height);

      overlayCtx.save();
      overlayCtx.setLineDash([4, 4]);
      overlayCtx.lineDashOffset = this.#dashOffset;
      overlayCtx.strokeStyle = '#000000';
      overlayCtx.lineWidth = 1;

      // Draw boundary pixels
      overlayCtx.beginPath();
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          const idx = (y * w + x) * 4;
          if (d[idx] < 128)
            continue;
          // Check if any neighbor is not selected (boundary pixel)
          const isEdge =
            x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
            d[((y - 1) * w + x) * 4] < 128 ||
            d[((y + 1) * w + x) * 4] < 128 ||
            d[(y * w + x - 1) * 4] < 128 ||
            d[(y * w + x + 1) * 4] < 128;
          if (isEdge) {
            // Draw boundary segments
            if (y === 0 || d[((y - 1) * w + x) * 4] < 128) {
              overlayCtx.moveTo(x, y);
              overlayCtx.lineTo(x + 1, y);
            }
            if (y === h - 1 || d[((y + 1) * w + x) * 4] < 128) {
              overlayCtx.moveTo(x, y + 1);
              overlayCtx.lineTo(x + 1, y + 1);
            }
            if (x === 0 || d[(y * w + x - 1) * 4] < 128) {
              overlayCtx.moveTo(x, y);
              overlayCtx.lineTo(x, y + 1);
            }
            if (x === w - 1 || d[(y * w + x + 1) * 4] < 128) {
              overlayCtx.moveTo(x + 1, y);
              overlayCtx.lineTo(x + 1, y + 1);
            }
          }
        }
      overlayCtx.stroke();

      // Draw white dashes offset by half
      overlayCtx.lineDashOffset = this.#dashOffset + 4;
      overlayCtx.strokeStyle = '#ffffff';
      overlayCtx.stroke();

      overlayCtx.restore();
    }

    // Check if a pixel is selected
    isSelected(x, y) {
      if (!this.#hasMask)
        return true; // no mask means everything selected
      if (x < 0 || y < 0 || x >= this.#width || y >= this.#height)
        return false;
      const d = this.#maskCtx.getImageData(x, y, 1, 1).data;
      return d[0] > 128;
    }

    getMaskImageData() {
      return this.#maskCtx.getImageData(0, 0, this.#width, this.#height);
    }
  }

  PaintApp.SelectionEngine = SelectionEngine;
})();
