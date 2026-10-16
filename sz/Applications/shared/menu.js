;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  /** Pixels a finger may move and still count as a tap. */
  const TAP_SLOP = 10;

  // Menu bar with pointer and keyboard control, as in Windows:
  //   Alt or F10 activates the bar, Alt+letter opens the menu with that
  //   initial; Left/Right walk the menus, Up/Down the entries, Enter or
  //   Space runs an entry, a letter jumps to the next entry starting with
  //   it, Right/Left open and close a submenu, Escape steps back out.
  // Roles and states are set for screen readers.

  class MenuBar {

    #onAction;
    #menuBar;
    #openMenu;
    #keyboard = false;
    #altAlone = false;
    #returnFocus = null;

    constructor(first, second) {
      // Support both calling conventions:
      //   new MenuBar({ onAction })                       -- single-arg config
      //   new MenuBar(domElement, { actionName: fn, ... }) -- two-arg legacy
      if (first instanceof HTMLElement || first instanceof Element) {
        const handlers = second || {};
        if (typeof handlers.onAction === 'function')
          this.#onAction = handlers.onAction;
        else
          this.#onAction = (action) => { if (typeof handlers[action] === 'function') handlers[action](); };
        this.#menuBar = first.classList.contains('menu-bar') ? first : first.closest('.menu-bar') || first;
      } else {
        const opts = first || {};
        this.#onAction = opts.onAction || (() => {});
        this.#menuBar = document.querySelector('.menu-bar');
      }
      this.#openMenu = null;
      if (!this.#menuBar) return;
      this.#annotate();
      this.#wire();
    }

    // ── structure ─────────────────────────────────────────────────

    #items() {
      return [...this.#menuBar.querySelectorAll(':scope > .menu-item')].filter(i => i.offsetParent !== null || i.classList.contains('open'));
    }

    #entries(container) {
      return [...container.children].filter(e => e.classList.contains('menu-entry') && !e.classList.contains('disabled') && e.style.display !== 'none' && !e.hidden);
    }

    #labelOf(el) {
      for (const n of el.childNodes)
        if (n.nodeType === 3 && n.textContent.trim())
          return n.textContent.trim();
      const label = el.querySelector(':scope > .menu-label, :scope > span:not(.shortcut):not(.menu-shortcut):not(.menu-icon)');
      return (label ? label.textContent : el.textContent).trim();
    }

    #annotate() {
      const bar = this.#menuBar;
      bar.setAttribute('role', 'menubar');
      for (const item of bar.querySelectorAll(':scope > .menu-item')) {
        item.setAttribute('role', 'menuitem');
        item.setAttribute('aria-haspopup', 'true');
        item.setAttribute('aria-expanded', 'false');
        item.tabIndex = -1;
      }
      for (const menu of bar.querySelectorAll('.menu-dropdown, .menu-submenu'))
        menu.setAttribute('role', 'menu');
      for (const sep of bar.querySelectorAll('.menu-separator, .menu-sep'))
        sep.setAttribute('role', 'separator');
      this.#refreshEntryStates();
    }

    #refreshEntryStates() {
      for (const entry of this.#menuBar.querySelectorAll('.menu-entry')) {
        const check = entry.classList.contains('checkbox') ? 'menuitemcheckbox' : entry.classList.contains('radio') ? 'menuitemradio' : 'menuitem';
        entry.setAttribute('role', check);
        if (check !== 'menuitem')
          entry.setAttribute('aria-checked', entry.classList.contains('checked') ? 'true' : 'false');
        if (entry.classList.contains('disabled'))
          entry.setAttribute('aria-disabled', 'true');
        else
          entry.removeAttribute('aria-disabled');
        if (entry.classList.contains('has-submenu'))
          entry.setAttribute('aria-haspopup', 'true');
        entry.tabIndex = -1;
      }
    }

    // ── pointer ───────────────────────────────────────────────────

    // The mouse acts on press as in Windows. Touch and pen act on release,
    // and only for a tap: a finger that moved more than TAP_SLOP px (or was
    // taken over by the browser for scrolling) neither runs an entry nor
    // closes the menu, so long menus can be scrolled with the finger.
    #wire() {
      const isHover = (e) => !e.pointerType || e.pointerType === 'mouse';
      let tap = null;
      let swallow = false;

      this.#menuBar.addEventListener('pointerdown', (e) => {
        if (isHover(e))
          this.#press(e.target);
      });

      document.addEventListener('pointerdown', (e) => {
        if (isHover(e) && this.#openMenu && !e.target.closest('.menu-bar'))
          this.closeMenus();
      });

      document.addEventListener('pointerdown', (e) => {
        swallow = false;
        tap = isHover(e) ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, target: e.target };
      }, true);

      document.addEventListener('pointermove', (e) => {
        if (tap && tap.id === e.pointerId && (Math.abs(e.clientX - tap.x) > TAP_SLOP || Math.abs(e.clientY - tap.y) > TAP_SLOP))
          tap = null;
      }, true);

      const cancel = () => { tap = null; };
      document.addEventListener('pointercancel', cancel, true);
      document.addEventListener('contextmenu', cancel, true);

      document.addEventListener('pointerup', (e) => {
        if (!tap || tap.id !== e.pointerId)
          return;
        const target = tap.target;
        tap = null;
        if (this.#menuBar.contains(target)) {
          // the tapped dropdown may vanish: keep the follow-up click off what lies beneath
          swallow = e.pointerType === 'touch' && !!this.#openMenu;
          this.#press(target, true);
        } else if (this.#openMenu && !target.closest('.menu-bar'))
          this.closeMenus();
      }, true);

      document.addEventListener('touchend', (e) => {
        if (swallow && e.cancelable)
          e.preventDefault();
        swallow = false;
      }, { capture: true, passive: false });

      this.#menuBar.addEventListener('pointerenter', (e) => {
        if (!this.#openMenu) return;
        // a submenu shown on hover inside a scrolling dropdown must not be clipped
        const parent = e.target.closest && e.target.closest('.has-submenu');
        if (parent && this.#menuBar.contains(parent))
          this.#placeSubmenu(parent);
        if (!isHover(e)) return;
        const item = e.target.closest('.menu-item');
        if (item && item !== this.#openMenu && this.#menuBar.contains(item))
          this.#open(item, false);
      }, true);

      document.addEventListener('keydown', (e) => this.#onKeyDown(e), true);
      document.addEventListener('keyup', (e) => this.#onKeyUp(e), true);
      window.addEventListener('blur', () => { if (this.#keyboard) this.#leave(); });
    }

    #press(target, touch) {
      const entry = target.closest('.menu-entry') || target.closest('[data-action]');
      if (entry) {
        if (entry.classList.contains('disabled'))
          return;
        if (entry.classList.contains('has-submenu') && !entry.dataset.action) {
          // without hover a tap opens or folds the submenu
          if (touch) {
            if (entry.classList.contains('open'))
              this.#closeSubmenu(entry);
            else {
              for (const s of entry.parentElement.querySelectorAll(':scope > .has-submenu.open'))
                this.#closeSubmenu(s);
              this.#openSubmenu(entry);
            }
          }
          return;
        }
        this.#run(entry);
        return;
      }

      const item = target.closest('.menu-item');
      if (!item) return;
      // a tap on the empty part of an open dropdown keeps it open
      if (touch && target.closest('.menu-dropdown'))
        return;

      if (this.#openMenu === item) {
        this.closeMenus();
        return;
      }

      this.#keyboard = false;
      this.#open(item, false);
    }

    // ── keyboard ──────────────────────────────────────────────────

    #onKeyDown(e) {
      if (e.key === 'Alt') {
        this.#altAlone = !e.repeat;
        return;
      }
      this.#altAlone = false;

      const active = this.#keyboard || this.#openMenu;
      if (!active) {
        if (e.defaultPrevented)
          return;
        if (e.key === 'F10' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.#enter();
          return;
        }
        if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
          const item = this.#itemByLetter(e.key);
          if (item) {
            e.preventDefault();
            this.#enter(true);
            this.#open(item, true);
          }
        }
        return;
      }

      const focused = document.activeElement;
      const inBar = this.#menuBar.contains(focused);
      if (!inBar && !this.#openMenu)
        return;

      const items = this.#items();
      const item = this.#openMenu || (focused && focused.closest('.menu-item'));
      const sub = focused && focused.closest('.menu-submenu');
      const list = sub || (this.#openMenu && this.#openMenu.querySelector(':scope > .menu-dropdown'));
      let handled = true;

      switch (e.key) {
        case 'ArrowLeft':
          if (sub) {
            this.#closeSubmenu(sub.parentElement);
            sub.parentElement.focus();
          } else
            this.#moveItem(items, item, -1);
          break;
        case 'ArrowRight':
          if (focused && focused.classList.contains('has-submenu'))
            this.#openSubmenu(focused);
          else
            this.#moveItem(items, item, 1);
          break;
        case 'ArrowDown':
          if (!this.#openMenu && item)
            this.#open(item, true);
          else if (list)
            this.#moveEntry(list, focused, 1);
          break;
        case 'ArrowUp':
          if (!this.#openMenu && item)
            this.#open(item, true, true);
          else if (list)
            this.#moveEntry(list, focused, -1);
          break;
        case 'Home':
        case 'End':
          if (list) {
            const entries = this.#entries(list);
            this.#focus(entries[e.key === 'Home' ? 0 : entries.length - 1]);
          }
          break;
        case 'Enter':
        case ' ':
          if (focused && focused.classList.contains('menu-entry')) {
            if (focused.classList.contains('has-submenu') && !focused.dataset.action)
              this.#openSubmenu(focused);
            else
              this.#run(focused);
          } else if (item)
            this.#open(item, true);
          break;
        case 'Escape':
          if (sub) {
            this.#closeSubmenu(sub.parentElement);
            sub.parentElement.focus();
          } else if (this.#openMenu) {
            const was = this.#openMenu;
            this.#closeOpen();
            if (this.#keyboard)
              this.#focus(was);
            else
              this.closeMenus();
          } else
            this.#leave();
          break;
        case 'Tab':
          this.#leave();
          handled = false;
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            if (list) {
              const entries = this.#entries(list);
              const letter = e.key.toLowerCase();
              const start = entries.indexOf(focused);
              for (let i = 1; i <= entries.length; ++i) {
                const cand = entries[(start + i) % entries.length];
                if (this.#labelOf(cand).replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase().startsWith(letter)) {
                  this.#focus(cand);
                  break;
                }
              }
            } else {
              const target = this.#itemByLetter(e.key);
              if (target)
                this.#open(target, true);
            }
          } else
            handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    #onKeyUp(e) {
      if (e.key !== 'Alt' || !this.#altAlone)
        return;
      this.#altAlone = false;
      if (this.#keyboard || this.#openMenu)
        this.#leave();
      else
        this.#enter();
      e.preventDefault();
    }

    #itemByLetter(key) {
      const letter = key.toLowerCase();
      return this.#items().find(i => this.#labelOf(i).replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase().startsWith(letter)) || null;
    }

    #enter(silent) {
      this.#keyboard = true;
      this.#menuBar.classList.add('keyboard');
      if (!this.#menuBar.contains(document.activeElement))
        this.#returnFocus = document.activeElement;
      this.#refreshEntryStates();
      if (!silent)
        this.#focus(this.#items()[0]);
    }

    #leave() {
      this.closeMenus();
      this.#keyboard = false;
      this.#menuBar.classList.remove('keyboard');
      for (const el of this.#menuBar.querySelectorAll('.focused'))
        el.classList.remove('focused');
      const back = this.#returnFocus;
      this.#returnFocus = null;
      if (this.#menuBar.contains(document.activeElement)) {
        if (back && back.focus && back.isConnected && back !== document.body)
          back.focus();
        if (this.#menuBar.contains(document.activeElement))
          document.activeElement.blur();
      }
    }

    #focus(el) {
      if (!el)
        return;
      for (const f of this.#menuBar.querySelectorAll('.focused'))
        f.classList.remove('focused');
      el.classList.add('focused');
      el.focus({ preventScroll: true });
      // a dropdown limited to the window scrolls along with the keyboard
      const box = el.parentElement && el.parentElement.closest('.menu-dropdown, .menu-submenu');
      if (box && box.style.overflowY === 'auto') {
        const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
        if (r.top < b.top)
          box.scrollTop -= b.top - r.top;
        else if (r.bottom > b.bottom)
          box.scrollTop += r.bottom - b.bottom;
      }
    }

    #moveItem(items, current, dir) {
      if (!items.length)
        return;
      const i = items.indexOf(current);
      const next = items[(i + dir + items.length) % items.length];
      if (this.#openMenu)
        this.#open(next, true);
      else
        this.#focus(next);
    }

    #moveEntry(list, current, dir) {
      const entries = this.#entries(list);
      if (!entries.length)
        return;
      const i = entries.indexOf(current);
      this.#focus(entries[i < 0 ? (dir > 0 ? 0 : entries.length - 1) : (i + dir + entries.length) % entries.length]);
    }

    #open(item, focusEntry, fromEnd) {
      this.#closeOpen();
      item.classList.add('open');
      item.setAttribute('aria-expanded', 'true');
      this.#openMenu = item;
      this.#fit(item.querySelector(':scope > .menu-dropdown'));
      // apps enable, disable and check entries at any time
      this.#refreshEntryStates();
      if (focusEntry) {
        const entries = this.#entries(item.querySelector(':scope > .menu-dropdown') || item);
        this.#focus(fromEnd ? entries[entries.length - 1] : entries[0]);
        if (!entries.length)
          this.#focus(item);
      }
    }

    // A dropdown taller or wider than the window (phones, small windows)
    // is limited to the visible area and scrolls inside itself.
    #fit(menu) {
      if (!menu)
        return;
      menu.style.maxHeight = '';
      menu.style.overflowY = '';
      if (!menu.dataset.szFixed)
        menu.style.left = '';
      for (const sub of menu.querySelectorAll('.menu-submenu'))
        if (sub.dataset.szFixed && sub !== menu)
          this.#unfix(sub);
      let r = menu.getBoundingClientRect();
      const vw = window.innerWidth, vh = window.innerHeight;
      // a submenu placed against the window moves up before it gets cut
      if (menu.dataset.szFixed && r.bottom > vh - 2) {
        menu.style.top = Math.max(2, vh - 2 - r.height) + 'px';
        r = menu.getBoundingClientRect();
      }
      const room = vh - r.top - 2;
      if (r.height > room && room > 48) {
        menu.style.maxHeight = room + 'px';
        menu.style.overflowY = 'auto';
        if (!menu.dataset.szScrollWired) {
          menu.dataset.szScrollWired = '1';
          menu.addEventListener('scroll', () => {
            for (const sub of menu.querySelectorAll('.menu-submenu'))
              if (sub.dataset.szFixed && sub.parentElement.parentElement === menu)
                this.#placeSubmenu(sub.parentElement);
          });
        }
      }
      if (r.right > vw - 2 && r.width < vw) {
        const shift = Math.max(2 - r.left, vw - 2 - r.right);
        if (shift < 0)
          menu.style.left = ((parseFloat(getComputedStyle(menu).left) || 0) + shift) + 'px';
      }
    }

    // Inside a dropdown that scrolls, a submenu would be clipped by it: it is
    // then placed against the window next to its entry instead.
    #placeSubmenu(entry) {
      const sub = entry.querySelector(':scope > .menu-submenu');
      if (!sub)
        return;
      let box = entry.parentElement && entry.parentElement.closest('.menu-dropdown, .menu-submenu');
      while (box && box.style.overflowY !== 'auto')
        box = box.parentElement && box.parentElement.closest('.menu-dropdown, .menu-submenu');
      if (!box) {
        if (sub.dataset.szFixed)
          this.#unfix(sub);
        return;
      }
      const r = entry.getBoundingClientRect();
      sub.dataset.szFixed = '1';
      sub.style.position = 'fixed';
      sub.style.left = r.right + 'px';
      sub.style.top = r.top + 'px';
      this.#fit(sub);
    }

    #unfix(sub) {
      delete sub.dataset.szFixed;
      sub.style.position = '';
      sub.style.left = '';
      sub.style.top = '';
      sub.style.maxHeight = '';
      sub.style.overflowY = '';
    }

    #openSubmenu(entry) {
      const sub = entry.querySelector(':scope > .menu-submenu');
      if (!sub)
        return;
      entry.classList.add('open');
      entry.setAttribute('aria-expanded', 'true');
      if (!sub.dataset.szFixed)
        this.#fit(sub);
      this.#placeSubmenu(entry);
      this.#focus(this.#entries(sub)[0]);
    }

    #closeSubmenu(entry) {
      entry.classList.remove('open');
      entry.setAttribute('aria-expanded', 'false');
    }

    #closeOpen() {
      if (!this.#openMenu)
        return;
      for (const s of this.#openMenu.querySelectorAll('.has-submenu.open'))
        this.#closeSubmenu(s);
      this.#openMenu.classList.remove('open');
      this.#openMenu.setAttribute('aria-expanded', 'false');
      this.#openMenu = null;
    }

    #run(entry) {
      const action = entry.dataset.action;
      const keyboard = this.#keyboard;
      this.closeMenus();
      if (keyboard)
        this.#leave();
      if (action)
        this.#onAction(action);
    }

    closeMenus() {
      this.#closeOpen();
      if (!this.#keyboard)
        for (const el of this.#menuBar.querySelectorAll('.focused'))
          el.classList.remove('focused');
    }

  }

  SZ.MenuBar = MenuBar;
})();
