;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const DRAG_THRESHOLD = 5;
  const DOUBLE_CLICK_MS = 400;
  const DOUBLE_CLICK_DIST = 10;

  class InputHandler {
    #canvas;
    #canvasW;
    #canvasH;
    #tileSize;
    #listeners;
    #pointerDown;
    #dragStartPos;
    #isDragging;
    #boundHandlers;
    #keysDown;
    #lastClickTime;
    #lastClickPos;

    constructor(canvas, { width = 1280, height = 720, tileSize = 32 } = {}) {
      this.#canvas = canvas;
      this.#canvasW = width;
      this.#canvasH = height;
      this.#tileSize = tileSize;
      this.#listeners = new Map();
      this.#pointerDown = false;
      this.#dragStartPos = null;
      this.#isDragging = false;
      this.#keysDown = new Set();
      this.#lastClickTime = 0;
      this.#lastClickPos = null;

      this.#boundHandlers = {
        pointerdown: (e) => this.#onPointerDown(e),
        pointermove: (e) => this.#onPointerMove(e),
        pointerup: (e) => this.#onPointerUp(e),
        contextmenu: (e) => this.#onContextMenu(e),
        keydown: (e) => this.#onKeyDown(e),
        keyup: (e) => this.#onKeyUp(e),
      };

      if (canvas) {
        canvas.addEventListener('pointerdown', this.#boundHandlers.pointerdown);
        canvas.addEventListener('pointermove', this.#boundHandlers.pointermove);
        canvas.addEventListener('pointerup', this.#boundHandlers.pointerup);
        canvas.addEventListener('contextmenu', this.#boundHandlers.contextmenu);
        canvas.setAttribute('tabindex', '0');
        canvas.addEventListener('keydown', this.#boundHandlers.keydown);
        canvas.addEventListener('keyup', this.#boundHandlers.keyup);
      }
    }

    #screenToCanvas(e) {
      const rect = this.#canvas.getBoundingClientRect();
      const scaleX = this.#canvasW / rect.width;
      const scaleY = this.#canvasH / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    screenToTile(x, y, camera) {
      const worldX = x + (camera ? camera.x : 0);
      const worldY = y + (camera ? camera.y : 0);
      return {
        col: Math.floor(worldX / this.#tileSize),
        row: Math.floor(worldY / this.#tileSize)
      };
    }

    #onPointerDown(e) {
      if (e.button === 2)
        return;
      this.#pointerDown = true;
      this.#isDragging = false;
      const pos = this.#screenToCanvas(e);
      this.#dragStartPos = pos;
      this.#canvas.setPointerCapture(e.pointerId);
    }

    #onPointerMove(e) {
      const pos = this.#screenToCanvas(e);

      if (this.#pointerDown && this.#dragStartPos) {
        const dx = pos.x - this.#dragStartPos.x;
        const dy = pos.y - this.#dragStartPos.y;
        if (!this.#isDragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
          this.#isDragging = true;
          this.#emit('dragStart', { x: this.#dragStartPos.x, y: this.#dragStartPos.y });
        }
        if (this.#isDragging)
          this.#emit('dragMove', { x: pos.x, y: pos.y, dx, dy });
      } else {
        this.#emit('hover', { x: pos.x, y: pos.y });
      }
    }

    #onPointerUp(e) {
      const pos = this.#screenToCanvas(e);

      if (this.#isDragging) {
        this.#emit('dragEnd', { x: pos.x, y: pos.y });
        this.#lastClickTime = 0;
        this.#lastClickPos = null;
      } else if (this.#pointerDown && e.button !== 2) {
        this.#emit('click', { x: pos.x, y: pos.y });

        const now = performance.now();
        if (this.#lastClickPos) {
          const dx = pos.x - this.#lastClickPos.x;
          const dy = pos.y - this.#lastClickPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (now - this.#lastClickTime < DOUBLE_CLICK_MS && dist < DOUBLE_CLICK_DIST) {
            this.#emit('doubleClick', { x: pos.x, y: pos.y });
            this.#lastClickTime = 0;
            this.#lastClickPos = null;
          } else {
            this.#lastClickTime = now;
            this.#lastClickPos = { x: pos.x, y: pos.y };
          }
        } else {
          this.#lastClickTime = now;
          this.#lastClickPos = { x: pos.x, y: pos.y };
        }
      }

      this.#pointerDown = false;
      this.#isDragging = false;
      this.#dragStartPos = null;

      try {
        this.#canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }

    #onContextMenu(e) {
      e.preventDefault();
      const pos = this.#screenToCanvas(e);
      this.#emit('rightClick', { x: pos.x, y: pos.y });
    }

    #onKeyDown(e) {
      const key = e.key;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key)) {
        e.preventDefault();
        this.#keysDown.add(key.toLowerCase());
      }
    }

    #onKeyUp(e) {
      this.#keysDown.delete(e.key.toLowerCase());
    }

    get keysDown() { return this.#keysDown; }

    getMovementDirection() {
      let dx = 0, dy = 0;
      if (this.#keysDown.has('arrowup') || this.#keysDown.has('w'))
        dy = -1;
      if (this.#keysDown.has('arrowdown') || this.#keysDown.has('s'))
        dy = 1;
      if (this.#keysDown.has('arrowleft') || this.#keysDown.has('a'))
        dx = -1;
      if (this.#keysDown.has('arrowright') || this.#keysDown.has('d'))
        dx = 1;
      return { dx, dy };
    }

    on(eventType, cb) {
      if (!this.#listeners.has(eventType))
        this.#listeners.set(eventType, []);
      this.#listeners.get(eventType).push(cb);
    }

    off(eventType, cb) {
      const list = this.#listeners.get(eventType);
      if (!list)
        return;
      const idx = list.indexOf(cb);
      if (idx >= 0)
        list.splice(idx, 1);
    }

    destroy() {
      if (!this.#canvas)
        return;
      this.#canvas.removeEventListener('pointerdown', this.#boundHandlers.pointerdown);
      this.#canvas.removeEventListener('pointermove', this.#boundHandlers.pointermove);
      this.#canvas.removeEventListener('pointerup', this.#boundHandlers.pointerup);
      this.#canvas.removeEventListener('contextmenu', this.#boundHandlers.contextmenu);
      this.#canvas.removeEventListener('keydown', this.#boundHandlers.keydown);
      this.#canvas.removeEventListener('keyup', this.#boundHandlers.keyup);
      this.#keysDown.clear();
      this.#listeners.clear();
    }

    #emit(eventType, detail) {
      const list = this.#listeners.get(eventType);
      if (!list)
        return;
      for (const cb of list)
        cb(detail);
    }
  }

  TR.InputHandler = InputHandler;
})();
