;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const GRID_W = 80;
  const GRID_H = 80;
  const PADDING = 8;
  const STORAGE_KEY = 'sz-icon-positions';

  class Desktop {
    #element;
    #bgElement;
    #iconArea;
    #icons = [];
    #occupiedCells = new Map(); // "col,row" -> icon id
    #savedPositions = null;

    constructor(element) {
      this.#element = element;
      this.#bgElement = element.querySelector('#sz-background');
      this.#iconArea = element.querySelector('#sz-icon-area');
      this.#element.addEventListener('pointerdown', (e) => {
        if (e.target === this.#element || e.target === this.#bgElement || e.target === this.#iconArea)
          this.#deselectAll();
      });
      this.#loadPositions();
    }

    async setBackground(src, mode = 'cover') {
      const fallback = '/system/wallpapers/bliss.svg';
      let finalSrc = src;

      if (src.startsWith('/')) {
        try {
          const content = await SZ.system.vfs.read(src);
          if (content) {
            finalSrc = content;
          } else {
            finalSrc = await SZ.system.vfs.read(fallback);
          }
        } catch (e) {
          console.error(`VFS read error for ${src}:`, e);
          finalSrc = await SZ.system.vfs.read(fallback);
        }
      }

      this.#bgElement.onerror = async () => {
        this.#bgElement.onerror = null;
        const fallbackContent = await SZ.system.vfs.read(fallback);
        if (this.#bgElement.src !== fallbackContent)
          this.#bgElement.src = fallbackContent;
      };

      if (mode === 'tile') {
        // Tile mode: hide <img>, use CSS background on parent
        this.#bgElement.style.display = 'none';
        this.#element.style.backgroundImage = `url('${finalSrc}')`;
        this.#element.style.backgroundRepeat = 'repeat';
        this.#element.style.backgroundSize = 'auto';
        this.#element.style.backgroundPosition = 'top left';
      } else {
        // Standard mode: use <img> with object-fit
        this.#bgElement.style.display = '';
        this.#element.style.backgroundImage = '';
        this.#bgElement.src = finalSrc;
        this.#bgElement.style.objectFit = mode === 'center' ? 'none' : mode;
        if (mode === 'center' || mode === 'none') {
          // Center mode: natural size, centered
          this.#bgElement.style.width = 'auto';
          this.#bgElement.style.height = 'auto';
          this.#bgElement.style.position = 'absolute';
          this.#bgElement.style.top = '50%';
          this.#bgElement.style.left = '50%';
          this.#bgElement.style.transform = 'translate(-50%, -50%)';
        } else {
          this.#bgElement.style.width = '';
          this.#bgElement.style.height = '';
          this.#bgElement.style.position = '';
          this.#bgElement.style.top = '';
          this.#bgElement.style.left = '';
          this.#bgElement.style.transform = '';
        }
      }
    }

    addIcon(icon) {
      this.#icons.push(icon);
      this.#iconArea.appendChild(icon.element);

      // Wire up drag-end callback
      icon.onDragEnd = (ic, rawX, rawY) => this.#handleIconDrop(ic, rawX, rawY);

      // Restore saved position or assign next available cell
      const saved = this.#savedPositions?.[icon.id];
      if (saved != null) {
        const col = saved.col;
        const row = saved.row;
        const cellKey = col + ',' + row;
        if (!this.#occupiedCells.has(cellKey)) {
          this.#occupiedCells.set(cellKey, icon.id);
          icon.setPosition(this.#cellToPixel(col, row).x, this.#cellToPixel(col, row).y);
          return;
        }
      }

      // No saved position or cell taken -- assign next available
      const { col, row } = this.#nextAvailableCell();
      this.#occupiedCells.set(col + ',' + row, icon.id);
      icon.setPosition(this.#cellToPixel(col, row).x, this.#cellToPixel(col, row).y);
      this.#savePositions();
    }

    clearIcons() {
      this.#icons = [];
      this.#occupiedCells.clear();
      this.#iconArea.innerHTML = '';
    }

    // -- Grid helpers ---------------------------------------------------------

    #cellToPixel(col, row) {
      return {
        x: PADDING + col * GRID_W,
        y: PADDING + row * GRID_H,
      };
    }

    #pixelToCell(px, py) {
      return {
        col: Math.max(0, Math.round((px - PADDING) / GRID_W)),
        row: Math.max(0, Math.round((py - PADDING) / GRID_H)),
      };
    }

    #maxGridDimensions() {
      const areaW = this.#iconArea.clientWidth || this.#element.clientWidth;
      const areaH = this.#iconArea.clientHeight || this.#element.clientHeight;
      return {
        cols: Math.max(1, Math.floor((areaW - PADDING) / GRID_W)),
        rows: Math.max(1, Math.floor((areaH - PADDING) / GRID_H)),
      };
    }

    #nextAvailableCell() {
      const { cols, rows } = this.#maxGridDimensions();
      // Fill top-to-bottom, then left-to-right (like Windows)
      for (let col = 0; col < cols; ++col)
        for (let row = 0; row < rows; ++row)
          if (!this.#occupiedCells.has(col + ',' + row))
            return { col, row };

      // Overflow: extend columns beyond the visible area
      let col = cols;
      for (;;) {
        for (let row = 0; row < rows; ++row)
          if (!this.#occupiedCells.has(col + ',' + row))
            return { col, row };
        ++col;
      }
    }

    #findNearestEmptyCell(targetCol, targetRow, excludeId) {
      const { cols, rows } = this.#maxGridDimensions();
      // Clamp into visible area
      targetCol = Math.max(0, Math.min(targetCol, cols - 1));
      targetRow = Math.max(0, Math.min(targetRow, rows - 1));

      const key = targetCol + ',' + targetRow;
      const occupant = this.#occupiedCells.get(key);
      if (!occupant || occupant === excludeId)
        return { col: targetCol, row: targetRow };

      // Spiral outward to find the nearest empty cell
      for (let radius = 1; radius < cols + rows; ++radius)
        for (let dc = -radius; dc <= radius; ++dc)
          for (let dr = -radius; dr <= radius; ++dr) {
            if (Math.abs(dc) !== radius && Math.abs(dr) !== radius)
              continue;
            const c = targetCol + dc;
            const r = targetRow + dr;
            if (c < 0 || r < 0 || c >= cols || r >= rows)
              continue;
            const k = c + ',' + r;
            const occ = this.#occupiedCells.get(k);
            if (!occ || occ === excludeId)
              return { col: c, row: r };
          }

      // Fallback: find any free cell
      return this.#nextAvailableCell();
    }

    // -- Drag handling --------------------------------------------------------

    #handleIconDrop(icon, rawX, rawY) {
      // Remove from old cell
      for (const [key, id] of this.#occupiedCells)
        if (id === icon.id) {
          this.#occupiedCells.delete(key);
          break;
        }

      // Snap to nearest empty grid cell
      const { col: targetCol, row: targetRow } = this.#pixelToCell(rawX, rawY);
      const { col, row } = this.#findNearestEmptyCell(targetCol, targetRow, icon.id);

      this.#occupiedCells.set(col + ',' + row, icon.id);
      icon.setPosition(this.#cellToPixel(col, row).x, this.#cellToPixel(col, row).y);
      this.#savePositions();
    }

    // -- Persistence ----------------------------------------------------------

    #loadPositions() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw)
          this.#savedPositions = JSON.parse(raw);
      } catch { /* ignore corrupt data */ }
    }

    #savePositions() {
      const positions = {};
      for (const icon of this.#icons) {
        const { col, row } = this.#pixelToCell(icon.x, icon.y);
        positions[icon.id] = { col, row };
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      } catch { /* storage full -- silently ignore */ }
    }

    // -- Selection ------------------------------------------------------------

    #deselectAll() {
      for (const icon of this.#icons) icon.deselect();
      this.#element.dispatchEvent(new CustomEvent('sz:desktop-click', { bubbles: true }));
    }
  }

  SZ.Desktop = Desktop;
})();
