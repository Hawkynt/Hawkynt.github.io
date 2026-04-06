;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // --- Draggable/resizable floating window system for combat UI ---
  // All combat HUD elements are HTML overlays on top of the canvas.

  function makeDraggable(el, handleEl) {
    let dragging = false, startX, startY, origLeft, origTop;
    (handleEl || el).addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, pre, .no-drag')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origLeft = el.offsetLeft;
      origTop = el.offsetTop;
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      el.style.left = (origLeft + e.clientX - startX) + 'px';
      el.style.top = (origTop + e.clientY - startY) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    });
    el.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('lostpointercapture', () => { dragging = false; });
  }

  function makeResizable(el, minW, minH) {
    const handle = document.createElement('div');
    handle.className = 'fwin-resize-handle';
    el.appendChild(handle);
    let resizing = false, startX, startY, origW, origH;
    handle.addEventListener('pointerdown', (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      origW = el.offsetWidth;
      origH = el.offsetHeight;
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    });
    handle.addEventListener('pointermove', (e) => {
      if (!resizing) return;
      el.style.width = Math.max(minW || 120, origW + e.clientX - startX) + 'px';
      el.style.height = Math.max(minH || 80, origH + e.clientY - startY) + 'px';
    });
    handle.addEventListener('pointerup', () => { resizing = false; });
    handle.addEventListener('lostpointercapture', () => { resizing = false; });
  }

  class CombatUI {
    #wrap;
    #logWin;
    #logText;
    #logLastLen;
    #actionWin;
    #activeCharOverlay;
    #initBar;
    #visible;
    #onAction;

    constructor(canvasWrap) {
      this.#wrap = canvasWrap;
      this.#visible = false;
      this.#logLastLen = 0;
      this.#onAction = null;
      this.#build();
    }

    #build() {
      // --- Combat Log floating window ---
      this.#logWin = this.#createFloatingWindow('fwin-log', 'Combat Log', {
        right: '8px', bottom: '48px', width: '360px', height: '200px',
        resizable: true, minimizable: true, copyable: true,
      });
      this.#logText = this.#logWin.querySelector('.fwin-body pre');

      // --- Action bar (horizontal, movable) ---
      this.#actionWin = document.createElement('div');
      this.#actionWin.className = 'fwin fwin-actions';
      this.#actionWin.innerHTML = `<div class="fwin-action-row" id="combatActionRow"></div>`;
      this.#actionWin.style.cssText = 'bottom:48px;left:50%;transform:translateX(-50%);';
      // Prevent clicks from falling through to canvas
      this.#actionWin.addEventListener('pointerdown', e => e.stopPropagation());
      this.#wrap.appendChild(this.#actionWin);
      makeDraggable(this.#actionWin);

      // --- Active character overlay (top center) ---
      this.#activeCharOverlay = document.createElement('div');
      this.#activeCharOverlay.className = 'fwin fwin-active-char';
      this.#activeCharOverlay.style.cssText = 'top:4px;left:50%;transform:translateX(-50%);';
      this.#wrap.appendChild(this.#activeCharOverlay);

      // --- Initiative bar (bottom) ---
      this.#initBar = document.createElement('div');
      this.#initBar.className = 'combat-init-bar';
      this.#wrap.appendChild(this.#initBar);
    }

    #createFloatingWindow(id, title, opts) {
      const win = document.createElement('div');
      win.className = 'fwin';
      win.id = id;
      win.style.cssText = `right:${opts.right||'8px'};bottom:${opts.bottom||'8px'};width:${opts.width||'300px'};height:${opts.height||'180px'};`;

      const header = document.createElement('div');
      header.className = 'fwin-titlebar';
      header.innerHTML = `<span>${title}</span><span class="fwin-btns"></span>`;
      const btns = header.querySelector('.fwin-btns');

      if (opts.copyable) {
        const copyBtn = document.createElement('button');
        copyBtn.textContent = '\u{1F4CB}';
        copyBtn.title = 'Copy to clipboard';
        copyBtn.addEventListener('click', () => {
          const pre = win.querySelector('.fwin-body pre');
          if (pre) navigator.clipboard?.writeText(pre.textContent).catch(() => {});
        });
        btns.appendChild(copyBtn);
      }
      if (opts.minimizable) {
        const minBtn = document.createElement('button');
        minBtn.textContent = '\u2013';
        minBtn.title = 'Minimize';
        minBtn.addEventListener('click', () => {
          const body = win.querySelector('.fwin-body');
          const handle = win.querySelector('.fwin-resize-handle');
          if (body.hidden) {
            body.hidden = false;
            if (handle) handle.hidden = false;
            win.style.height = win.dataset.prevH || opts.height || '180px';
            minBtn.textContent = '\u2013';
          } else {
            win.dataset.prevH = win.style.height;
            body.hidden = true;
            if (handle) handle.hidden = true;
            win.style.height = 'auto';
            minBtn.textContent = '\u25A1';
          }
        });
        btns.appendChild(minBtn);
      }

      win.appendChild(header);
      makeDraggable(win, header);

      const body = document.createElement('div');
      body.className = 'fwin-body';
      body.innerHTML = '<pre class="no-drag"></pre>';
      win.appendChild(body);

      if (opts.resizable)
        makeResizable(win, 200, 100);

      this.#wrap.appendChild(win);
      return win;
    }

    set onAction(fn) { this.#onAction = fn; }

    show() {
      this.#visible = true;
      this.#logWin.hidden = false;
      this.#actionWin.hidden = false;
      this.#activeCharOverlay.hidden = false;
      this.#initBar.hidden = false;
    }

    hide() {
      this.#visible = false;
      this.#logWin.hidden = true;
      this.#actionWin.hidden = true;
      this.#activeCharOverlay.hidden = true;
      this.#initBar.hidden = true;
      this.#logLastLen = 0;
    }

    get isVisible() { return this.#visible; }

    // --- Update methods called each frame ---

    updateLog(messages) {
      if (!messages || messages.length === this.#logLastLen) return;
      this.#logLastLen = messages.length;
      this.#logText.textContent = messages.join('\n');
      this.#logText.parentElement.scrollTop = this.#logText.parentElement.scrollHeight;
    }

    updateActions(buttons) {
      const row = this.#actionWin.querySelector('#combatActionRow');
      if (!row) return;
      // Only rebuild if the button list changed (avoids detaching DOM elements every frame)
      const sig = buttons.map(b => `${b.label}:${b.disabled ? 1 : 0}:${b.action||''}`).join('|');
      if (row.dataset.sig === sig) return;
      row.dataset.sig = sig;
      row.innerHTML = '';
      for (const btn of buttons) {
        const el = document.createElement('button');
        el.className = 'fwin-action-btn' + (btn.disabled ? ' disabled' : '');
        el.textContent = btn.label;
        el.disabled = !!btn.disabled;
        if (!btn.disabled)
          el.addEventListener('click', () => this.#onAction?.(btn.action || btn.label));
        row.appendChild(el);
      }
    }

    updateActiveChar(unit) {
      const sig = unit ? `${unit.id}:${unit.currentHp}` : '';
      if (this.#activeCharOverlay.dataset.sig === sig) return;
      this.#activeCharOverlay.dataset.sig = sig;
      if (!unit) {
        this.#activeCharOverlay.innerHTML = '';
        return;
      }
      const hpPct = Math.max(0, unit.currentHp / unit.maxHp * 100);
      const hpColor = hpPct > 50 ? '#4a4' : hpPct > 25 ? '#aa4' : '#a44';
      const factionColor = unit.faction === 'party' ? '#6af' : '#f66';
      this.#activeCharOverlay.innerHTML =
        `<span style="color:${factionColor};font-weight:bold">${unit.logName}</span>` +
        `<span class="fwin-ac-stat">HP:${unit.currentHp}/${unit.maxHp}</span>` +
        `<span class="fwin-ac-stat">AC:${unit.ac}</span>` +
        `<span class="fwin-ac-stat">BAB:+${unit.bab}</span>` +
        `<div class="fwin-ac-hpbar"><div style="width:${hpPct}%;background:${hpColor}"></div></div>`;
    }

    updateInitBar(turnOrder, currentIndex, round, unitLookup) {
      const sig = `${currentIndex}:${round}`;
      if (this.#initBar.dataset.sig === sig) return;
      this.#initBar.dataset.sig = sig;
      if (!turnOrder || turnOrder.length === 0) {
        this.#initBar.innerHTML = '';
        return;
      }

      let html = '';
      const totalSlots = Math.max(turnOrder.length * 2, 20);
      let currentRound = round;
      let idx = currentIndex;

      for (let slot = 0; slot < totalSlots; ++slot) {
        if (idx >= turnOrder.length) {
          // Round separator
          ++currentRound;
          idx = 0;
          html += `<span class="init-sep">R${currentRound}</span>`;
        }
        const entry = turnOrder[idx];
        const unit = unitLookup(entry.id);
        if (!unit) { ++idx; continue; }
        const isActive = slot === 0;
        const isDead = !unit.isAlive;
        const fClass = isDead ? 'init-dead' : unit.faction === 'party' ? 'init-party' : 'init-enemy';
        const activeClass = isActive ? ' init-active' : '';
        const name = unit.name.length > 8 ? unit.name.substring(0, 7) + '\u2026' : unit.name;
        html += `<span class="init-unit ${fClass}${activeClass}" title="${unit.logName} HP:${unit.currentHp}/${unit.maxHp}">${name}</span>`;
        ++idx;
      }

      this.#initBar.innerHTML = html;
    }
  }

  TR.CombatUI = CombatUI;
})();
