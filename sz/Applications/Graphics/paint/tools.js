;(function() {
  'use strict';

  const PaintApp = window.PaintApp || (window.PaintApp = {});

  // -----------------------------------------------------------------------
  // Tool registry: each tool has { onDown, onMove, onUp, onCancel }
  // The controller provides a context object with state and helpers
  // -----------------------------------------------------------------------
  const Tools = {};

  // -----------------------------------------------------------------------
  // Pencil
  // -----------------------------------------------------------------------
  Tools.pencil = {
    onDown(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.fgColor, state.brushSize, state.brushShape);
      ctx.beginPath();
      ctx.moveTo(cx.x + 0.5, cx.y + 0.5);
      ctx.lineTo(cx.x + 0.5, cx.y + 0.5);
      ctx.stroke();
    },
    onMove(cx, state) {
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.fgColor, state.brushSize, state.brushShape);
      _drawLine(ctx, state.lastX, state.lastY, cx.x, cx.y);
    },
    onUp() {}
  };

  // -----------------------------------------------------------------------
  // Eraser
  // -----------------------------------------------------------------------
  Tools.eraser = {
    onDown(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      const size = state.brushSize * 3;
      _setupCtx(ctx, state.bgColor, size, state.brushShape);
      ctx.beginPath();
      ctx.moveTo(cx.x + 0.5, cx.y + 0.5);
      ctx.lineTo(cx.x + 0.5, cx.y + 0.5);
      ctx.stroke();
    },
    onMove(cx, state) {
      const ctx = state.getActiveCtx();
      const size = state.brushSize * 3;
      _setupCtx(ctx, state.bgColor, size, state.brushShape);
      _drawLine(ctx, state.lastX, state.lastY, cx.x, cx.y);
    },
    onUp() {}
  };

  // -----------------------------------------------------------------------
  // Line
  // -----------------------------------------------------------------------
  Tools.line = {
    onDown() {},
    onMove(cx, state) {
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _setupCtx(octx, state.drawColor, state.brushSize, state.brushShape);
      _drawLine(octx, state.startX, state.startY, cx.x, cx.y);
    },
    onUp(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.drawColor, state.brushSize, state.brushShape);
      _drawLine(ctx, state.startX, state.startY, cx.x, cx.y);
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  // -----------------------------------------------------------------------
  // Rectangle
  // -----------------------------------------------------------------------
  Tools.rect = {
    onDown() {},
    onMove(cx, state) {
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _setupCtx(octx, state.drawColor, state.brushSize, state.brushShape);
      _drawRect(octx, state.startX, state.startY, cx.x, cx.y, state.fillMode === 'filled');
    },
    onUp(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.drawColor, state.brushSize, state.brushShape);
      _drawRect(ctx, state.startX, state.startY, cx.x, cx.y, state.fillMode === 'filled');
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  // -----------------------------------------------------------------------
  // Ellipse
  // -----------------------------------------------------------------------
  Tools.ellipse = {
    onDown() {},
    onMove(cx, state) {
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _setupCtx(octx, state.drawColor, state.brushSize, state.brushShape);
      _drawEllipse(octx, state.startX, state.startY, cx.x, cx.y, state.fillMode === 'filled');
    },
    onUp(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.drawColor, state.brushSize, state.brushShape);
      _drawEllipse(ctx, state.startX, state.startY, cx.x, cx.y, state.fillMode === 'filled');
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  // -----------------------------------------------------------------------
  // Rounded Rectangle
  // -----------------------------------------------------------------------
  Tools['rounded-rect'] = {
    onDown() {},
    onMove(cx, state) {
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _setupCtx(octx, state.drawColor, state.brushSize, state.brushShape);
      _drawRoundedRect(octx, state.startX, state.startY, cx.x, cx.y, state.cornerRadius, state.fillMode === 'filled');
    },
    onUp(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.drawColor, state.brushSize, state.brushShape);
      _drawRoundedRect(ctx, state.startX, state.startY, cx.x, cx.y, state.cornerRadius, state.fillMode === 'filled');
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  // -----------------------------------------------------------------------
  // Fill / Bucket
  // -----------------------------------------------------------------------
  Tools.fill = {
    onDown(cx, state) {
      state.pushUndo();
      _floodFill(state.getActiveCtx(), state.layerModel.width, state.layerModel.height, cx.x, cx.y, state.drawColor);
    },
    onMove() {},
    onUp() {}
  };

  // -----------------------------------------------------------------------
  // Text
  // -----------------------------------------------------------------------
  Tools.text = {
    onDown(cx, state) {
      state.showTextInput(cx.x, cx.y);
    },
    onMove() {},
    onUp() {}
  };

  // -----------------------------------------------------------------------
  // Color Picker
  // -----------------------------------------------------------------------
  Tools.picker = {
    onDown(cx, state) {
      _pickColor(cx, state);
    },
    onMove(cx, state) {
      _pickColor(cx, state);
    },
    onUp() {}
  };

  function _pickColor(cx, state) {
    const ctx = state.getActiveCtx();
    const px = ctx.getImageData(
      Math.max(0, Math.min(cx.x, state.layerModel.width - 1)),
      Math.max(0, Math.min(cx.y, state.layerModel.height - 1)),
      1, 1
    ).data;
    const picked = '#' + ((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1);
    state.setColor(picked, cx.button);
  }

  // -----------------------------------------------------------------------
  // Gradient
  // -----------------------------------------------------------------------
  Tools.gradient = {
    onDown() {},
    onMove(cx, state) {
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _drawGradientPreview(octx, state.startX, state.startY, cx.x, cx.y, state.fgColor, state.bgColor, state.gradientMode);
    },
    onUp(cx, state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _drawGradientPreview(ctx, state.startX, state.startY, cx.x, cx.y, state.fgColor, state.bgColor, state.gradientMode);
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  function _drawGradientPreview(ctx, x1, y1, x2, y2, color1, color2, mode) {
    let grad;
    if (mode === 'radial') {
      const r = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      grad = ctx.createRadialGradient(x1, y1, 0, x1, y1, Math.max(1, r));
    } else
      grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // -----------------------------------------------------------------------
  // Clone Stamp
  // -----------------------------------------------------------------------
  Tools.clone = {
    _sourceOffset: null,
    _sourceSet: false,

    onDown(cx, state) {
      if (state.altKey) {
        this._sourceOffset = { x: cx.x, y: cx.y };
        this._sourceSet = true;
        return;
      }
      if (!this._sourceSet)
        return;
      state.pushUndo();
      this._clone(cx, state);
    },
    onMove(cx, state) {
      if (!this._sourceSet || state.altKey)
        return;
      this._clone(cx, state);
    },
    onUp() {},

    _clone(cx, state) {
      if (!this._sourceOffset)
        return;
      const ctx = state.getActiveCtx();
      const dx = cx.x - state.startX;
      const dy = cx.y - state.startY;
      const sx = this._sourceOffset.x + dx;
      const sy = this._sourceOffset.y + dy;
      const r = Math.floor(state.brushSize / 2);
      const w = state.layerModel.width;
      const h = state.layerModel.height;

      const srcX = Math.max(0, sx - r);
      const srcY = Math.max(0, sy - r);
      const srcW = Math.min(w - srcX, state.brushSize);
      const srcH = Math.min(h - srcY, state.brushSize);
      if (srcW <= 0 || srcH <= 0)
        return;

      const data = ctx.getImageData(srcX, srcY, srcW, srcH);
      ctx.putImageData(data, cx.x - r, cx.y - r);
    }
  };

  // -----------------------------------------------------------------------
  // Blur Brush
  // -----------------------------------------------------------------------
  Tools['blur-brush'] = {
    onDown(cx, state) {
      state.pushUndo();
      this._apply(cx, state);
    },
    onMove(cx, state) {
      this._apply(cx, state);
    },
    onUp() {},

    _apply(cx, state) {
      const ctx = state.getActiveCtx();
      const r = Math.max(2, Math.floor(state.brushSize / 2));
      const w = state.layerModel.width;
      const h = state.layerModel.height;
      const sx = Math.max(0, cx.x - r);
      const sy = Math.max(0, cx.y - r);
      const sw = Math.min(w - sx, r * 2);
      const sh = Math.min(h - sy, r * 2);
      if (sw <= 2 || sh <= 2)
        return;
      const imgData = ctx.getImageData(sx, sy, sw, sh);
      _boxBlur3x3(imgData);
      ctx.putImageData(imgData, sx, sy);
    }
  };

  // -----------------------------------------------------------------------
  // Sharpen Brush
  // -----------------------------------------------------------------------
  Tools['sharpen-brush'] = {
    onDown(cx, state) {
      state.pushUndo();
      this._apply(cx, state);
    },
    onMove(cx, state) {
      this._apply(cx, state);
    },
    onUp() {},

    _apply(cx, state) {
      const ctx = state.getActiveCtx();
      const r = Math.max(2, Math.floor(state.brushSize / 2));
      const w = state.layerModel.width;
      const h = state.layerModel.height;
      const sx = Math.max(0, cx.x - r);
      const sy = Math.max(0, cx.y - r);
      const sw = Math.min(w - sx, r * 2);
      const sh = Math.min(h - sy, r * 2);
      if (sw <= 2 || sh <= 2)
        return;
      const imgData = ctx.getImageData(sx, sy, sw, sh);
      _sharpen3x3(imgData);
      ctx.putImageData(imgData, sx, sy);
    }
  };

  // -----------------------------------------------------------------------
  // Airbrush / Spray
  // -----------------------------------------------------------------------
  Tools.airbrush = {
    _intervalId: null,
    _cx: null,
    _state: null,

    onDown(cx, state) {
      state.pushUndo();
      this._cx = cx;
      this._state = state;
      this._spray();
      this._intervalId = setInterval(() => this._spray(), 50);
    },
    onMove(cx) {
      this._cx = cx;
    },
    onUp() {
      if (this._intervalId != null) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
    },
    onCancel() {
      if (this._intervalId != null) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
    },

    _spray() {
      if (!this._cx || !this._state)
        return;
      const ctx = this._state.getActiveCtx();
      const r = this._state.brushSize;
      const density = Math.max(1, Math.floor(r * r / 4));
      ctx.fillStyle = this._state.drawColor;
      for (let i = 0; i < density; ++i) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r;
        const px = Math.round(this._cx.x + Math.cos(angle) * dist);
        const py = Math.round(this._cx.y + Math.sin(angle) * dist);
        ctx.fillRect(px, py, 1, 1);
      }
    }
  };

  // -----------------------------------------------------------------------
  // Polygon (click-to-place vertices)
  // -----------------------------------------------------------------------
  Tools.polygon = {
    _points: [],
    _active: false,

    onDown(cx, state) {
      if (!this._active) {
        this._points = [{ x: cx.x, y: cx.y }];
        this._active = true;
        return;
      }
      // Check if clicking near first vertex to close
      const first = this._points[0];
      const dist = Math.sqrt((cx.x - first.x) ** 2 + (cx.y - first.y) ** 2);
      if (this._points.length >= 3 && dist < 8) {
        this._commit(state);
        return;
      }
      this._points.push({ x: cx.x, y: cx.y });
    },
    onMove(cx, state) {
      if (!this._active)
        return;
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _setupCtx(octx, state.drawColor, state.brushSize, state.brushShape);
      octx.beginPath();
      octx.moveTo(this._points[0].x + 0.5, this._points[0].y + 0.5);
      for (let i = 1; i < this._points.length; ++i)
        octx.lineTo(this._points[i].x + 0.5, this._points[i].y + 0.5);
      octx.lineTo(cx.x + 0.5, cx.y + 0.5);
      octx.stroke();
    },
    onUp() {},
    onDblClick(cx, state) {
      if (this._active && this._points.length >= 2)
        this._commit(state);
    },
    onCancel(state) {
      this._points = [];
      this._active = false;
      if (state)
        state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    },

    _commit(state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.drawColor, state.brushSize, state.brushShape);
      ctx.beginPath();
      ctx.moveTo(this._points[0].x + 0.5, this._points[0].y + 0.5);
      for (let i = 1; i < this._points.length; ++i)
        ctx.lineTo(this._points[i].x + 0.5, this._points[i].y + 0.5);
      ctx.closePath();
      if (state.fillMode === 'filled')
        ctx.fill();
      ctx.stroke();
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
      this._points = [];
      this._active = false;
    },

    isMultiClick() { return true; }
  };

  // -----------------------------------------------------------------------
  // Bezier Curves
  // -----------------------------------------------------------------------
  Tools.bezier = {
    _points: [],
    _active: false,

    onDown(cx, state) {
      this._points.push({ x: cx.x, y: cx.y });
      if (!this._active)
        this._active = true;
    },
    onMove(cx, state) {
      if (!this._active)
        return;
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      _setupCtx(octx, state.drawColor, state.brushSize, state.brushShape);

      const pts = [...this._points, { x: cx.x, y: cx.y }];
      _drawBezierPath(octx, pts);

      // Draw control point handles
      octx.fillStyle = '#0080ff';
      for (const p of this._points) {
        octx.fillRect(p.x - 2, p.y - 2, 5, 5);
      }
    },
    onUp() {},
    onDblClick(cx, state) {
      if (this._active && this._points.length >= 2)
        this._commit(state);
    },
    onCancel(state) {
      this._points = [];
      this._active = false;
      if (state)
        state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    },

    _commit(state) {
      state.pushUndo();
      const ctx = state.getActiveCtx();
      _setupCtx(ctx, state.drawColor, state.brushSize, state.brushShape);
      _drawBezierPath(ctx, this._points);
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
      this._points = [];
      this._active = false;
    },

    isMultiClick() { return true; }
  };

  function _drawBezierPath(ctx, pts) {
    if (pts.length < 2)
      return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x + 0.5, pts[0].y + 0.5);
    if (pts.length === 2)
      ctx.lineTo(pts[1].x + 0.5, pts[1].y + 0.5);
    else if (pts.length === 3)
      ctx.quadraticCurveTo(pts[1].x + 0.5, pts[1].y + 0.5, pts[2].x + 0.5, pts[2].y + 0.5);
    else {
      // For 4+ points, chain bezier curves
      for (let i = 1; i < pts.length - 2; i += 3) {
        if (i + 2 < pts.length)
          ctx.bezierCurveTo(
            pts[i].x + 0.5, pts[i].y + 0.5,
            pts[i + 1].x + 0.5, pts[i + 1].y + 0.5,
            pts[i + 2].x + 0.5, pts[i + 2].y + 0.5
          );
        else if (i + 1 < pts.length)
          ctx.quadraticCurveTo(
            pts[i].x + 0.5, pts[i].y + 0.5,
            pts[i + 1].x + 0.5, pts[i + 1].y + 0.5
          );
        else
          ctx.lineTo(pts[i].x + 0.5, pts[i].y + 0.5);
      }
    }
    ctx.stroke();
  }

  // -----------------------------------------------------------------------
  // Selection tools (rect-select, lasso, magic-wand)
  // Handled mostly in controller, tools just track coordinates
  // -----------------------------------------------------------------------
  Tools['rect-select'] = {
    onDown() {},
    onMove(cx, state) {
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      octx.save();
      octx.setLineDash([4, 4]);
      octx.strokeStyle = '#000';
      octx.lineWidth = 1;
      const lx = Math.min(state.startX, cx.x);
      const ly = Math.min(state.startY, cx.y);
      const w = Math.abs(cx.x - state.startX);
      const h = Math.abs(cx.y - state.startY);
      octx.strokeRect(lx + 0.5, ly + 0.5, w, h);
      octx.setLineDash([4, 4]);
      octx.lineDashOffset = 4;
      octx.strokeStyle = '#fff';
      octx.strokeRect(lx + 0.5, ly + 0.5, w, h);
      octx.restore();
    },
    onUp(cx, state) {
      const lx = Math.min(state.startX, cx.x);
      const ly = Math.min(state.startY, cx.y);
      const w = Math.abs(cx.x - state.startX);
      const h = Math.abs(cx.y - state.startY);
      if (w > 1 && h > 1)
        state.selectRect(lx, ly, w, h);
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  Tools.lasso = {
    _points: [],

    onDown(cx) {
      this._points = [{ x: cx.x, y: cx.y }];
    },
    onMove(cx, state) {
      this._points.push({ x: cx.x, y: cx.y });
      const octx = state.overlayCtx;
      octx.clearRect(0, 0, octx.canvas.width, octx.canvas.height);
      octx.save();
      octx.setLineDash([3, 3]);
      octx.strokeStyle = '#000';
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(this._points[0].x + 0.5, this._points[0].y + 0.5);
      for (let i = 1; i < this._points.length; ++i)
        octx.lineTo(this._points[i].x + 0.5, this._points[i].y + 0.5);
      octx.stroke();
      octx.restore();
    },
    onUp(cx, state) {
      if (this._points.length >= 3)
        state.selectLasso(this._points);
      this._points = [];
      state.overlayCtx.clearRect(0, 0, state.overlayCtx.canvas.width, state.overlayCtx.canvas.height);
    }
  };

  Tools['magic-wand'] = {
    onDown(cx, state) {
      state.selectMagicWand(cx.x, cx.y);
    },
    onMove() {},
    onUp() {}
  };

  // -----------------------------------------------------------------------
  // Pan
  // -----------------------------------------------------------------------
  Tools.pan = {
    _scrollStart: null,

    onDown(cx, state) {
      this._scrollStart = { x: state.canvasArea.scrollLeft, y: state.canvasArea.scrollTop, mx: cx.clientX, my: cx.clientY };
    },
    onMove(cx, state) {
      if (!this._scrollStart)
        return;
      state.canvasArea.scrollLeft = this._scrollStart.x - (cx.clientX - this._scrollStart.mx);
      state.canvasArea.scrollTop = this._scrollStart.y - (cx.clientY - this._scrollStart.my);
    },
    onUp() {
      this._scrollStart = null;
    }
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function _setupCtx(ctx, color, width, shape) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = shape === 'square' ? 'butt' : 'round';
    ctx.lineJoin = shape === 'square' ? 'miter' : 'round';
  }

  function _drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, y1 + 0.5);
    ctx.lineTo(x2 + 0.5, y2 + 0.5);
    ctx.stroke();
  }

  function _drawRect(ctx, x1, y1, x2, y2, filled) {
    const lx = Math.min(x1, x2);
    const ly = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (filled)
      ctx.fillRect(lx, ly, w, h);
    else
      ctx.strokeRect(lx + 0.5, ly + 0.5, w, h);
  }

  function _drawEllipse(ctx, x1, y1, x2, y2, filled) {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
    if (filled)
      ctx.fill();
    else
      ctx.stroke();
  }

  function _drawRoundedRect(ctx, x1, y1, x2, y2, radius, filled) {
    const lx = Math.min(x1, x2);
    const ly = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(lx + 0.5, ly + 0.5, w, h, r);
    if (filled)
      ctx.fill();
    else
      ctx.stroke();
  }

  function _floodFill(ctx, canvasW, canvasH, sx, sy, fillColor) {
    sx = Math.max(0, Math.min(sx, canvasW - 1));
    sy = Math.max(0, Math.min(sy, canvasH - 1));
    const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
    const data = imageData.data;
    const idx = (sy * canvasW + sx) * 4;
    const tr = data[idx], tg = data[idx + 1], tb = data[idx + 2], ta = data[idx + 3];

    const tmp = document.createElement('canvas');
    tmp.width = 1;
    tmp.height = 1;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = fillColor;
    tctx.fillRect(0, 0, 1, 1);
    const fc = tctx.getImageData(0, 0, 1, 1).data;
    const fr = fc[0], fg2 = fc[1], fb = fc[2], fa = fc[3];

    if (tr === fr && tg === fg2 && tb === fb && ta === fa)
      return;

    const visited = new Uint8Array(canvasW * canvasH);
    const stack = [[sx, sy]];

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      let pi = cy * canvasW + cx;
      if (visited[pi])
        continue;
      let i4 = pi * 4;
      if (Math.abs(data[i4] - tr) > 0 || Math.abs(data[i4 + 1] - tg) > 0 || Math.abs(data[i4 + 2] - tb) > 0 || Math.abs(data[i4 + 3] - ta) > 0)
        continue;

      let lx = cx;
      while (lx > 0) {
        const li = (cy * canvasW + (lx - 1)) * 4;
        if (Math.abs(data[li] - tr) > 0 || Math.abs(data[li + 1] - tg) > 0 || Math.abs(data[li + 2] - tb) > 0 || Math.abs(data[li + 3] - ta) > 0)
          break;
        --lx;
      }
      let rx = cx;
      while (rx < canvasW - 1) {
        const ri = (cy * canvasW + (rx + 1)) * 4;
        if (Math.abs(data[ri] - tr) > 0 || Math.abs(data[ri + 1] - tg) > 0 || Math.abs(data[ri + 2] - tb) > 0 || Math.abs(data[ri + 3] - ta) > 0)
          break;
        ++rx;
      }
      for (let x = lx; x <= rx; ++x) {
        const si = (cy * canvasW + x) * 4;
        data[si] = fr;
        data[si + 1] = fg2;
        data[si + 2] = fb;
        data[si + 3] = fa;
        visited[cy * canvasW + x] = 1;
      }
      for (let x = lx; x <= rx; ++x) {
        if (cy > 0 && !visited[(cy - 1) * canvasW + x]) stack.push([x, cy - 1]);
        if (cy < canvasH - 1 && !visited[(cy + 1) * canvasW + x]) stack.push([x, cy + 1]);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function _boxBlur3x3(imgData) {
    const w = imgData.width;
    const h = imgData.height;
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; ++y)
      for (let x = 1; x < w - 1; ++x)
        for (let c = 0; c < 3; ++c) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ++ky)
            for (let kx = -1; kx <= 1; ++kx)
              sum += copy[((y + ky) * w + (x + kx)) * 4 + c];
          d[(y * w + x) * 4 + c] = Math.round(sum / 9);
        }
  }

  function _sharpen3x3(imgData) {
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const w = imgData.width;
    const h = imgData.height;
    const d = imgData.data;
    const copy = new Uint8ClampedArray(d);
    for (let y = 1; y < h - 1; ++y)
      for (let x = 1; x < w - 1; ++x)
        for (let c = 0; c < 3; ++c) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ++ky)
            for (let kx = -1; kx <= 1; ++kx)
              sum += copy[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
          d[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(sum)));
        }
  }

  PaintApp.Tools = Tools;
})();
