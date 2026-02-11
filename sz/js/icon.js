;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const DRAG_THRESHOLD = 4;

  class Icon {
    #element;
    #config;
    #x = 0;
    #y = 0;
    #dragState = null;
    #onDragEnd = null;

    constructor({ id, title, iconSrc, onLaunch }) {
      this.#config = { id, title, iconSrc, onLaunch };
      this.#element = document.createElement('div');
      this.#element.className = 'sz-icon';
      this.#element.dataset.appId = id;
      this.#element.innerHTML = `
        <img src="${iconSrc}" alt="${title}" draggable="false">
        <div class="sz-icon-label">${title}</div>
      `;

      this.#element.addEventListener('pointerdown', (e) => this.#onPointerDown(e));
      this.#element.addEventListener('pointermove', (e) => this.#onPointerMove(e));
      this.#element.addEventListener('pointerup', (e) => this.#onPointerUp(e));
      this.#element.addEventListener('pointercancel', (e) => this.#onPointerUp(e));
      this.#element.addEventListener('dblclick', () => {
        if (onLaunch) onLaunch(id);
      });
    }

    get element() { return this.#element; }
    get id() { return this.#config.id; }
    get x() { return this.#x; }
    get y() { return this.#y; }

    set onDragEnd(fn) { this.#onDragEnd = fn; }

    deselect() { this.#element.classList.remove('selected'); }
    select() { this.#element.classList.add('selected'); }

    setIconSrc(src) {
      this.#element.querySelector('img').src = src;
    }

    setPosition(x, y) {
      this.#x = x;
      this.#y = y;
      this.#element.style.left = x + 'px';
      this.#element.style.top = y + 'px';
      this.#element.style.transform = '';
    }

    #onPointerDown(e) {
      e.stopPropagation();

      // Select this icon, deselect others
      this.#element.parentElement?.querySelectorAll('.sz-icon.selected').forEach(el => el.classList.remove('selected'));
      this.#element.classList.add('selected');

      // Only left button
      if (e.button !== 0)
        return;

      this.#dragState = {
        pointerId: e.pointerId,
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startIconX: this.#x,
        startIconY: this.#y,
        dragging: false,
      };
      this.#element.setPointerCapture(e.pointerId);
    }

    #onPointerMove(e) {
      if (!this.#dragState || this.#dragState.pointerId !== e.pointerId)
        return;

      const dx = e.clientX - this.#dragState.startPointerX;
      const dy = e.clientY - this.#dragState.startPointerY;

      if (!this.#dragState.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD)
          return;
        this.#dragState.dragging = true;
        this.#element.classList.add('dragging');
      }

      // GPU-composited movement via translate3d relative to the icon's CSS left/top position
      const tx = this.#dragState.startIconX + dx - this.#x;
      const ty = this.#dragState.startIconY + dy - this.#y;
      this.#element.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    }

    #onPointerUp(e) {
      if (!this.#dragState || this.#dragState.pointerId !== e.pointerId)
        return;

      const wasDragging = this.#dragState.dragging;
      const dx = e.clientX - this.#dragState.startPointerX;
      const dy = e.clientY - this.#dragState.startPointerY;

      try { this.#element.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      this.#element.classList.remove('dragging');
      this.#element.style.transform = '';
      this.#dragState = null;

      if (wasDragging && this.#onDragEnd) {
        const rawX = this.#x + dx;
        const rawY = this.#y + dy;
        this.#onDragEnd(this, rawX, rawY);
      }
    }
  }

  SZ.Icon = Icon;
})();
