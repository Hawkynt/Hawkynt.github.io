;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const SHADOW_OFFSET_X = 3;
  const SHADOW_OFFSET_Y = 3;
  const TRAIL_INTERVAL = 50;

  class CursorEffects {
    constructor(desktopEl) {
      this._desktopEl = desktopEl;
      this._shadowEnabled = false;
      this._trailEnabled = false;
      this._trailLength = 5;
      this._cursorImageUrl = '';
      this._lastTrailTime = 0;
      this._lastX = 0;
      this._lastY = 0;
      this._destroyed = false;
      this._trailEls = [];
      this._trailPositions = [];

      // Create overlay container
      this._container = document.createElement('div');
      this._container.id = 'sz-cursor-effects';
      document.body.appendChild(this._container);

      // Create shadow element
      this._shadowEl = document.createElement('div');
      this._shadowEl.className = 'sz-cursor-shadow';
      this._container.appendChild(this._shadowEl);

      // Bind pointer listener
      this._onPointerMove = this._onPointerMove.bind(this);
      document.addEventListener('pointermove', this._onPointerMove, { passive: true });
    }

    setShadowEnabled(enabled) {
      this._shadowEnabled = !!enabled;
      this._shadowEl.classList.toggle('active', this._shadowEnabled);
    }

    setTrailEnabled(enabled) {
      this._trailEnabled = !!enabled;
      if (!this._trailEnabled)
        this._clearTrailElements();
      else
        this._ensureTrailElements();
    }

    setTrailLength(len) {
      this._trailLength = Math.max(3, Math.min(10, len | 0));
      if (this._trailEnabled)
        this._ensureTrailElements();
    }

    setCursorImage(url) {
      this._cursorImageUrl = url || '';
      this._applyCursorImage();
    }

    applyCustomCursors(cursors) {
      if (!cursors)
        return;
      const root = document.documentElement;
      for (const [type, value] of Object.entries(cursors))
        root.style.setProperty('--sz-cursor-' + type, value);
    }

    applySettings(settings) {
      this.setShadowEnabled(settings.get('cursor.shadow'));
      this.setTrailEnabled(settings.get('cursor.trail'));
      this.setTrailLength(settings.get('cursor.trailLen') || 5);
    }

    destroy() {
      this._destroyed = true;
      document.removeEventListener('pointermove', this._onPointerMove);
      this._container.remove();
    }

    _onPointerMove(e) {
      if (this._destroyed)
        return;

      const x = e.clientX;
      const y = e.clientY;
      this._lastX = x;
      this._lastY = y;

      if (this._shadowEnabled)
        this._shadowEl.style.transform =
          `translate3d(${x + SHADOW_OFFSET_X}px, ${y + SHADOW_OFFSET_Y}px, 0)`;

      if (this._trailEnabled) {
        const now = performance.now();
        if (now - this._lastTrailTime >= TRAIL_INTERVAL) {
          this._lastTrailTime = now;
          this._trailPositions.push({ x, y, time: now });
          while (this._trailPositions.length > this._trailLength)
            this._trailPositions.shift();
          this._updateTrail();
        }
      }
    }

    _updateTrail() {
      const positions = this._trailPositions;
      const len = positions.length;
      const elements = this._trailEls;

      for (let i = 0; i < elements.length; ++i) {
        const el = elements[i];
        if (i < len) {
          const pos = positions[len - 1 - i];
          const ratio = 1 - (i / elements.length);
          el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
          el.style.opacity = Math.max(0.05, ratio * 0.4);
        } else {
          el.style.opacity = 0;
        }
      }
    }

    _ensureTrailElements() {
      while (this._trailEls.length > this._trailLength) {
        const el = this._trailEls.pop();
        el.remove();
      }
      while (this._trailEls.length < this._trailLength) {
        const el = document.createElement('div');
        el.className = 'sz-cursor-trail';
        this._container.appendChild(el);
        this._trailEls.push(el);
      }
      this._applyCursorImage();
    }

    _clearTrailElements() {
      for (const el of this._trailEls)
        el.remove();
      this._trailEls.length = 0;
      this._trailPositions.length = 0;
    }

    _applyCursorImage() {
      const imgUrl = this._cursorImageUrl || this._defaultCursorSvgUrl();
      this._shadowEl.style.backgroundImage = `url("${imgUrl}")`;
      this._shadowEl.style.backgroundSize = 'contain';
      this._shadowEl.style.backgroundRepeat = 'no-repeat';
      for (const el of this._trailEls) {
        el.style.backgroundImage = `url("${imgUrl}")`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
      }
    }

    _defaultCursorSvgUrl() {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
        `<path d="M4 1 L4 27 L10 21 L16 31 L20 29 L14 19 L22 19 Z" ` +
        `fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>` +
        `</svg>`;
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
  }

  SZ.CursorEffects = CursorEffects;
})();
