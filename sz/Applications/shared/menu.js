;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  class MenuBar {

    #onAction;
    #menuBar;
    #openMenu;

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
      this.#wire();
    }

    #wire() {
      this.#menuBar.addEventListener('pointerdown', (e) => {
        const entry = e.target.closest('.menu-entry') || e.target.closest('[data-action]');
        if (entry) {
          const action = entry.dataset.action;
          this.closeMenus();
          if (action)
            this.#onAction(action);
          return;
        }

        const item = e.target.closest('.menu-item');
        if (!item) return;

        if (this.#openMenu === item) {
          this.closeMenus();
          return;
        }

        this.closeMenus();
        item.classList.add('open');
        this.#openMenu = item;
      });

      this.#menuBar.addEventListener('pointerenter', (e) => {
        if (!this.#openMenu) return;
        const item = e.target.closest('.menu-item');
        if (item && item !== this.#openMenu) {
          this.closeMenus();
          item.classList.add('open');
          this.#openMenu = item;
        }
      }, true);

      document.addEventListener('pointerdown', (e) => {
        if (this.#openMenu && !e.target.closest('.menu-bar'))
          this.closeMenus();
      });
    }

    closeMenus() {
      if (this.#openMenu) {
        this.#openMenu.classList.remove('open');
        this.#openMenu = null;
      }
    }

  }

  SZ.MenuBar = MenuBar;
})();
