;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /** Edge zone size in pixels for edge-snap detection. */
  const EDGE_ZONE = 12;

  /** Corner zone size in pixels. */
  const CORNER_ZONE = 32;

  /**
   * Pure calculation module for window snapping, magnetic alignment, and stretching.
   * No DOM dependency — all methods work with plain rect objects.
   */
  class SnapEngine {
    #config;

    constructor(config) {
      this.#config = config || {};
    }

    get config() { return this.#config; }

    updateConfig(config) {
      Object.assign(this.#config, config);
    }

    /**
     * Determine the edge-snap zone for a cursor position.
     * Returns { x, y, width, height } defining the snap target area, or null.
     */
    getEdgeSnapZone(cursorX, cursorY, screenW, screenH) {
      if (!this.#config['snap.enabled'])
        return null;

      const mode = this.#config['snap.mode'] || 'aquasnap';
      if (mode === 'disabled')
        return null;

      const halfW = Math.floor(screenW / 2);
      const halfH = Math.floor(screenH / 2);

      // Corner zones (check first — corners take priority)
      if (cursorX <= CORNER_ZONE && cursorY <= CORNER_ZONE)
        return { x: 0, y: 0, width: halfW, height: halfH }; // top-left quarter

      if (cursorX >= screenW - CORNER_ZONE && cursorY <= CORNER_ZONE)
        return { x: halfW, y: 0, width: screenW - halfW, height: halfH }; // top-right quarter

      if (cursorX <= CORNER_ZONE && cursorY >= screenH - CORNER_ZONE)
        return { x: 0, y: halfH, width: halfW, height: screenH - halfH }; // bottom-left quarter

      if (cursorX >= screenW - CORNER_ZONE && cursorY >= screenH - CORNER_ZONE)
        return { x: halfW, y: halfH, width: screenW - halfW, height: screenH - halfH }; // bottom-right quarter

      // Edge zones
      if (cursorY <= EDGE_ZONE)
        return { x: 0, y: 0, width: screenW, height: halfH }; // top → top half

      if (cursorX <= EDGE_ZONE)
        return { x: 0, y: 0, width: halfW, height: screenH }; // left half

      if (cursorX >= screenW - EDGE_ZONE)
        return { x: halfW, y: 0, width: screenW - halfW, height: screenH }; // right half

      // Bottom edge (optional — AquaSnap mode only)
      if (mode === 'aquasnap' && cursorY >= screenH - EDGE_ZONE)
        return { x: 0, y: halfH, width: screenW, height: screenH - halfH }; // bottom half

      return null;
    }

    /**
     * Calculate magnetic alignment adjustments.
     * Returns { dx, dy } — pixel offsets to apply to the window position.
     */
    getMagneticSnap(windowRect, otherRects, screenW, screenH) {
      const threshold = this.#config['snap.magnetDistance'] || 10;
      let dx = 0, dy = 0;
      let bestDx = Infinity, bestDy = Infinity;

      const wx1 = windowRect.x, wy1 = windowRect.y;
      const wx2 = wx1 + windowRect.width, wy2 = wy1 + windowRect.height;

      // Screen edge snapping
      if (this.#config['snap.magnetScreenEdges'] !== false) {
        // Left edge to screen left
        if (Math.abs(wx1) < threshold && Math.abs(wx1) < Math.abs(bestDx))
          { bestDx = -wx1; dx = bestDx; }
        // Right edge to screen right
        if (Math.abs(wx2 - screenW) < threshold && Math.abs(wx2 - screenW) < Math.abs(bestDx))
          { bestDx = screenW - wx2; dx = bestDx; }
        // Top edge to screen top
        if (Math.abs(wy1) < threshold && Math.abs(wy1) < Math.abs(bestDy))
          { bestDy = -wy1; dy = bestDy; }
        // Bottom edge to screen bottom
        if (Math.abs(wy2 - screenH) < threshold && Math.abs(wy2 - screenH) < Math.abs(bestDy))
          { bestDy = screenH - wy2; dy = bestDy; }
      }

      // Window-to-window snapping
      for (const r of otherRects) {
        const rx1 = r.x, ry1 = r.y;
        const rx2 = rx1 + r.width, ry2 = ry1 + r.height;

        // Only snap if there's vertical overlap (for horizontal snapping) or horizontal overlap (for vertical snapping)
        const vOverlap = wy1 < ry2 && wy2 > ry1;
        const hOverlap = wx1 < rx2 && wx2 > rx1;

        if (this.#config['snap.magnetOuterEdges'] !== false && vOverlap) {
          // Our left to their right
          const d1 = Math.abs(wx1 - rx2);
          if (d1 < threshold && d1 < Math.abs(bestDx))
            { bestDx = rx2 - wx1; dx = bestDx; }
          // Our right to their left
          const d2 = Math.abs(wx2 - rx1);
          if (d2 < threshold && d2 < Math.abs(bestDx))
            { bestDx = rx1 - wx2; dx = bestDx; }
        }

        if (this.#config['snap.magnetOuterEdges'] !== false && hOverlap) {
          // Our top to their bottom
          const d3 = Math.abs(wy1 - ry2);
          if (d3 < threshold && d3 < Math.abs(bestDy))
            { bestDy = ry2 - wy1; dy = bestDy; }
          // Our bottom to their top
          const d4 = Math.abs(wy2 - ry1);
          if (d4 < threshold && d4 < Math.abs(bestDy))
            { bestDy = ry1 - wy2; dy = bestDy; }
        }

        if (this.#config['snap.magnetInnerEdges']) {
          if (vOverlap) {
            // Our left to their left
            const d5 = Math.abs(wx1 - rx1);
            if (d5 < threshold && d5 < Math.abs(bestDx))
              { bestDx = rx1 - wx1; dx = bestDx; }
            // Our right to their right
            const d6 = Math.abs(wx2 - rx2);
            if (d6 < threshold && d6 < Math.abs(bestDx))
              { bestDx = rx2 - wx2; dx = bestDx; }
          }
          if (hOverlap) {
            // Our top to their top
            const d7 = Math.abs(wy1 - ry1);
            if (d7 < threshold && d7 < Math.abs(bestDy))
              { bestDy = ry1 - wy1; dy = bestDy; }
            // Our bottom to their bottom
            const d8 = Math.abs(wy2 - ry2);
            if (d8 < threshold && d8 < Math.abs(bestDy))
              { bestDy = ry2 - wy2; dy = bestDy; }
          }
        }

        // Corner-to-corner snapping
        if (this.#config['snap.magnetCorners'] !== false) {
          const cornerPairs = [
            [wx1, wy1, rx1, ry1], [wx1, wy1, rx2, ry2],
            [wx2, wy1, rx1, ry1], [wx2, wy1, rx2, ry2],
            [wx1, wy2, rx1, ry1], [wx1, wy2, rx2, ry2],
            [wx2, wy2, rx1, ry1], [wx2, wy2, rx2, ry2],
          ];
          for (const [ax, ay, bx, by] of cornerPairs) {
            const cdx = bx - ax, cdy = by - ay;
            if (Math.abs(cdx) < threshold && Math.abs(cdy) < threshold) {
              if (Math.abs(cdx) < Math.abs(bestDx))
                { bestDx = cdx; dx = bestDx; }
              if (Math.abs(cdy) < Math.abs(bestDy))
                { bestDy = cdy; dy = bestDy; }
            }
          }
        }
      }

      return { dx, dy };
    }

    /**
     * Calculate the stretch target for a double-click on a resize handle.
     * Returns { x, y, width, height } or null.
     */
    getStretchTarget(windowRect, dir, otherRects, screenW, screenH) {
      const cfg = this.#config;
      const stretchToNearest = (cfg['snap.stretchTarget'] || 'nearest') === 'nearest';

      let { x, y, width: w, height: h } = windowRect;
      const right = x + w, bottom = y + h;

      // Find nearest obstacles in each direction
      const findNearest = (edge, axis, positiveSide) => {
        let nearest = positiveSide
          ? (axis === 'x' ? screenW : screenH)
          : 0;

        if (!stretchToNearest || !otherRects.length)
          return nearest;

        for (const r of otherRects) {
          const rRight = r.x + r.width, rBottom = r.y + r.height;

          if (axis === 'x') {
            // Check vertical overlap
            if (y >= rBottom || bottom <= r.y)
              continue;
            if (positiveSide && r.x > edge && r.x < nearest)
              nearest = r.x;
            if (!positiveSide && rRight < edge && rRight > nearest)
              nearest = rRight;
          } else {
            // Check horizontal overlap
            if (x >= rRight || right <= r.x)
              continue;
            if (positiveSide && r.y > edge && r.y < nearest)
              nearest = r.y;
            if (!positiveSide && rBottom < edge && rBottom > nearest)
              nearest = rBottom;
          }
        }
        return nearest;
      };

      const canV = cfg['snap.stretchVertical'] !== false;
      const canH = cfg['snap.stretchHorizontal'] !== false;
      const canD = cfg['snap.stretchDiagonal'] !== false;

      // Single-axis stretching
      if (dir === 'e' && canH) {
        const target = findNearest(right, 'x', true);
        return { x, y, width: target - x, height: h };
      }
      if (dir === 'w' && canH) {
        const target = findNearest(x, 'x', false);
        return { x: target, y, width: right - target, height: h };
      }
      if (dir === 's' && canV) {
        const target = findNearest(bottom, 'y', true);
        return { x, y, width: w, height: target - y };
      }
      if (dir === 'n' && canV) {
        const target = findNearest(y, 'y', false);
        return { x, y: target, width: w, height: bottom - target };
      }

      // Diagonal stretching
      if (dir === 'se' && canD) {
        const targetX = findNearest(right, 'x', true);
        const targetY = findNearest(bottom, 'y', true);
        return { x, y, width: targetX - x, height: targetY - y };
      }
      if (dir === 'sw' && canD) {
        const targetX = findNearest(x, 'x', false);
        const targetY = findNearest(bottom, 'y', true);
        return { x: targetX, y, width: right - targetX, height: targetY - y };
      }
      if (dir === 'ne' && canD) {
        const targetX = findNearest(right, 'x', true);
        const targetY = findNearest(y, 'y', false);
        return { x, y: targetY, width: targetX - x, height: bottom - targetY };
      }
      if (dir === 'nw' && canD) {
        const targetX = findNearest(x, 'x', false);
        const targetY = findNearest(y, 'y', false);
        return { x: targetX, y: targetY, width: right - targetX, height: bottom - targetY };
      }

      return null;
    }
  }

  SZ.SnapEngine = SnapEngine;
})();
