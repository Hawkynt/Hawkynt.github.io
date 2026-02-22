;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  class Ribbon {

    #onAction;
    #backstage;

    constructor({ onAction }) {
      this.#onAction = onAction || (() => {});
      this.#wireTabSwitching();
      this.#wireBackstage();
      this.#wireActionButtons();
    }

    #wireTabSwitching() {
      const tabBar = document.querySelector('.ribbon-tab-bar');
      if (!tabBar) return;

      for (const tab of tabBar.querySelectorAll('.ribbon-tab[data-tab]'))
        tab.addEventListener('click', () => this.selectTab(tab.dataset.tab));
    }

    selectTab(tabName) {
      const tabBar = document.querySelector('.ribbon-tab-bar');
      if (!tabBar) return;

      for (const t of tabBar.querySelectorAll('.ribbon-tab'))
        t.classList.toggle('active', t.dataset.tab === tabName);

      for (const p of document.querySelectorAll('.ribbon-panel'))
        p.classList.toggle('active', p.id === 'ribbon-' + tabName);
    }

    #wireBackstage() {
      this.#backstage = document.querySelector('.backstage');
      if (!this.#backstage) return;

      const fileBtn = document.querySelector('.ribbon-file-btn');
      if (fileBtn)
        fileBtn.addEventListener('click', () => this.openBackstage());

      const backBtn = this.#backstage.querySelector('.backstage-back');
      if (backBtn)
        backBtn.addEventListener('click', () => this.closeBackstage());

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
      if (this.#backstage)
        this.#backstage.classList.add('visible');
    }

    closeBackstage() {
      if (this.#backstage)
        this.#backstage.classList.remove('visible');
    }

    #wireActionButtons() {
      for (const btn of document.querySelectorAll('.qat-btn[data-action]'))
        btn.addEventListener('click', () => this.#onAction(btn.dataset.action));

      for (const btn of document.querySelectorAll('.rb-btn[data-action]'))
        btn.addEventListener('click', () => this.#onAction(btn.dataset.action));
    }

  }

  SZ.Ribbon = Ribbon;
})();
