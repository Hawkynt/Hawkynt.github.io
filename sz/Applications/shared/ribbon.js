;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // Ribbon with tabs, File backstage and quick-access buttons. Keyboard:
  // Alt or F10 moves to the tabs, Alt+F opens the backstage, Left/Right/
  // Home/End switch tabs, Down or Tab goes into the panel, Escape leaves.
  // Tabs, panels and icon-only buttons carry roles and names for screen
  // readers.

  class Ribbon {

    #onAction;
    #backstage;
    #fileBtn = null;
    #altAlone = false;
    #returnFocus = null;

    constructor({ onAction }) {
      this.#onAction = onAction || (() => {});
      this.#wireTabSwitching();
      this.#wireBackstage();
      this.#wireActionButtons();
      this.#wireKeyboard();
    }

    #tabs() {
      const tabBar = document.querySelector('.ribbon-tab-bar');
      return tabBar ? [...tabBar.querySelectorAll('.ribbon-tab[data-tab]')].filter(t => t.offsetParent !== null) : [];
    }

    #wireTabSwitching() {
      const tabBar = document.querySelector('.ribbon-tab-bar');
      if (!tabBar) return;

      tabBar.setAttribute('role', 'tablist');
      for (const tab of tabBar.querySelectorAll('.ribbon-tab[data-tab]')) {
        const panel = document.getElementById('ribbon-' + tab.dataset.tab);
        if (!tab.id)
          tab.id = 'ribbon-tab-' + tab.dataset.tab;
        tab.setAttribute('role', 'tab');
        if (panel) {
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', tab.id);
          tab.setAttribute('aria-controls', panel.id);
        }
        tab.addEventListener('click', () => this.selectTab(tab.dataset.tab));
      }
      const active = tabBar.querySelector('.ribbon-tab.active[data-tab]');
      if (active)
        this.selectTab(active.dataset.tab);

      tabBar.addEventListener('keydown', (e) => {
        const tabs = this.#tabs();
        const i = tabs.indexOf(document.activeElement);
        if (i < 0)
          return;
        let next = null;
        if (e.key === 'ArrowRight')
          next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft')
          next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home')
          next = tabs[0];
        else if (e.key === 'End')
          next = tabs[tabs.length - 1];
        else if (e.key === 'ArrowDown') {
          const panel = document.getElementById('ribbon-' + tabs[i].dataset.tab);
          const first = panel && panel.querySelector('button:not([disabled]), select, input, [tabindex="0"]');
          if (first) {
            e.preventDefault();
            first.focus();
          }
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.#leave();
          return;
        }
        if (next) {
          e.preventDefault();
          this.selectTab(next.dataset.tab);
          next.focus();
        }
      });
    }

    selectTab(tabName) {
      const tabBar = document.querySelector('.ribbon-tab-bar');
      if (!tabBar) return;

      for (const t of tabBar.querySelectorAll('.ribbon-tab')) {
        const on = t.dataset.tab === tabName;
        t.classList.toggle('active', on);
        if (t.dataset.tab) {
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
        }
      }

      for (const p of document.querySelectorAll('.ribbon-panel'))
        p.classList.toggle('active', p.id === 'ribbon-' + tabName);
    }

    // ── keyboard ──────────────────────────────────────────────────

    #wireKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Alt') {
          this.#altAlone = !e.repeat;
          return;
        }
        this.#altAlone = false;
        if (e.defaultPrevented)
          return;
        if (e.key === 'F10' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          this.#enter();
        } else if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'f' || e.key === 'F') && this.#backstage) {
          e.preventDefault();
          this.openBackstage();
        } else if (e.key === 'Escape' && this.#backstage && this.#backstage.classList.contains('visible')) {
          e.preventDefault();
          this.closeBackstage();
        }
      }, true);
      document.addEventListener('keyup', (e) => {
        if (e.key !== 'Alt' || !this.#altAlone)
          return;
        this.#altAlone = false;
        const tabBar = document.querySelector('.ribbon-tab-bar');
        if (tabBar && tabBar.contains(document.activeElement))
          this.#leave();
        else
          this.#enter();
        e.preventDefault();
      }, true);
    }

    #enter() {
      const tabs = this.#tabs();
      const target = tabs.find(t => t.classList.contains('active')) || tabs[0] || this.#fileBtn;
      if (!target)
        return;
      const tabBar = document.querySelector('.ribbon-tab-bar');
      if (!tabBar || !tabBar.contains(document.activeElement))
        this.#returnFocus = document.activeElement;
      target.focus();
    }

    #leave() {
      const back = this.#returnFocus;
      this.#returnFocus = null;
      if (back && back.focus && back.isConnected && back !== document.body)
        back.focus();
      else if (document.activeElement)
        document.activeElement.blur();
    }

    #wireBackstage() {
      this.#backstage = document.querySelector('.backstage');
      if (!this.#backstage) return;

      this.#backstage.setAttribute('role', 'dialog');
      this.#backstage.setAttribute('aria-label', 'File');
      const fileBtn = document.querySelector('.ribbon-file-btn');
      this.#fileBtn = fileBtn;
      if (fileBtn) {
        fileBtn.setAttribute('aria-haspopup', 'dialog');
        fileBtn.addEventListener('click', () => this.openBackstage());
      }

      const backBtn = this.#backstage.querySelector('.backstage-back');
      if (backBtn) {
        if (!backBtn.getAttribute('aria-label'))
          backBtn.setAttribute('aria-label', 'Back');
        backBtn.addEventListener('click', () => this.closeBackstage());
      }

      // Up/Down walk the backstage commands
      this.#backstage.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')
          return;
        const items = [...this.#backstage.querySelectorAll('.backstage-back, .backstage-item')].filter(b => b.offsetParent !== null && !b.disabled);
        const i = items.indexOf(document.activeElement);
        if (i < 0 || !items.length)
          return;
        e.preventDefault();
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      });

      this.#backstage.addEventListener('pointerdown', (e) => {
        if (e.target === this.#backstage)
          this.closeBackstage();
      });

      for (const item of this.#backstage.querySelectorAll('.backstage-item[data-action]'))
        item.addEventListener('click', () => {
          this.closeBackstage();
          this.#onAction(item.dataset.action);
        });
    }

    openBackstage() {
      if (!this.#backstage)
        return;
      if (!this.#backstage.contains(document.activeElement) && !this.#returnFocus)
        this.#returnFocus = document.activeElement;
      this.#backstage.classList.add('visible');
      const first = this.#backstage.querySelector('.backstage-item');
      if (first)
        first.focus();
    }

    closeBackstage() {
      if (!this.#backstage)
        return;
      const wasOpen = this.#backstage.classList.contains('visible');
      this.#backstage.classList.remove('visible');
      if (wasOpen && this.#backstage.contains(document.activeElement))
        this.#leave();
    }

    #wireActionButtons() {
      // icon-only buttons are named by their tooltip
      for (const btn of document.querySelectorAll('.qat-btn, .rb-btn, .ribbon-file-btn'))
        if (!btn.getAttribute('aria-label') && btn.title && !/[A-Za-z]{2}/.test(btn.textContent))
          btn.setAttribute('aria-label', btn.title.replace(/\s*\(.*\)$/, ''));

      for (const btn of document.querySelectorAll('.qat-btn[data-action]'))
        btn.addEventListener('click', () => this.#onAction(btn.dataset.action));

      for (const btn of document.querySelectorAll('.rb-btn[data-action]'))
        btn.addEventListener('click', () => this.#onAction(btn.dataset.action));
    }

  }

  SZ.Ribbon = Ribbon;
})();
