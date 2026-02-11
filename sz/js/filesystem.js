;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class ShellItem {
    constructor({ name, icon, type, appId, action }) {
      this.name = name;
      this.icon = icon || '';
      this.type = type || 'shortcut';  // 'shortcut' | 'folder' | 'separator'
      this.appId = appId || null;
      this.action = action || null;
    }
  }

  class ShellFolder {
    #systemItems = [];
    #localStorageKey;

    constructor(localStorageKey) {
      this.#localStorageKey = localStorageKey;
    }

    addSystemItem(item) {
      this.#systemItems.push(item instanceof ShellItem ? item : new ShellItem(item));
    }

    getItems() {
      const local = this.#loadLocal();
      const all = [...this.#systemItems, ...local];
      all.sort((a, b) => {
        if (a.type === 'separator' || b.type === 'separator')
          return 0;
        return a.name.localeCompare(b.name);
      });
      return all;
    }

    addLocalItem(item) {
      const local = this.#loadLocal();
      local.push(item instanceof ShellItem ? item : new ShellItem(item));
      this.#saveLocal(local);
    }

    removeLocalItem(name) {
      const local = this.#loadLocal().filter(i => i.name !== name);
      this.#saveLocal(local);
    }

    #loadLocal() {
      try {
        const raw = localStorage.getItem(this.#localStorageKey);
        if (!raw)
          return [];
        return JSON.parse(raw).map(i => new ShellItem(i));
      } catch {
        return [];
      }
    }

    #saveLocal(items) {
      localStorage.setItem(this.#localStorageKey, JSON.stringify(items));
    }
  }

  class FileSystem {
    desktop = new ShellFolder('sz-fs-desktop');
    startMenu = new ShellFolder('sz-fs-startmenu');
    programs = new Map();

    addProgramCategory(name) {
      if (!this.programs.has(name))
        this.programs.set(name, new ShellFolder('sz-fs-programs-' + name.toLowerCase().replace(/\s+/g, '-')));
      return this.programs.get(name);
    }
  }

  SZ.FileSystem = FileSystem;
  SZ.ShellFolder = ShellFolder;
  SZ.ShellItem = ShellItem;
})();
