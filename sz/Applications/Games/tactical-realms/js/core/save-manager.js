;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const MAX_BUFFER_SIZE = 400 * 1024;
  const SAVE_VERSION = 2;

  // No migration chain — only the latest save version is supported.
  // Old saves from incompatible versions are discarded on load.

  class SaveManager {
    #crypto;
    #storage;
    #version;
    #prefix;
    #activeBuffer;

    constructor({ crypto, storage, version, prefix } = {}) {
      this.#crypto = crypto || new TR.SaveCrypto();
      this.#storage = storage || localStorage;
      this.#version = version || SAVE_VERSION;
      this.#prefix = prefix || 'sz-tactical-realms';
      this.#activeBuffer = this.#detectActiveBuffer();
    }

    #key(suffix) {
      return `${this.#prefix}-${suffix}`;
    }

    #bufferKey(buf) {
      return this.#key(`save-${buf}`);
    }

    #metaKey() {
      return this.#key('meta');
    }

    #settingsKey() {
      return this.#key('settings');
    }

    #detectActiveBuffer() {
      const meta = this.#readMeta();
      return meta ? meta.active : 'A';
    }

    #readMeta() {
      try {
        const raw = this.#storage.getItem(this.#metaKey());
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    #writeMeta(meta) {
      this.#storage.setItem(this.#metaKey(), JSON.stringify(meta));
    }

    #readBuffer(buf) {
      try {
        const raw = this.#storage.getItem(this.#bufferKey(buf));
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    #writeBuffer(buf, data) {
      const json = JSON.stringify(data);
      if (json.length > MAX_BUFFER_SIZE)
        this.#rotateBuffer();
      this.#storage.setItem(this.#bufferKey(buf), json);
    }

    #rotateBuffer() {
      this.#activeBuffer = this.#activeBuffer === 'A' ? 'B' : 'A';
      this.#storage.removeItem(this.#bufferKey(this.#activeBuffer));
    }

    async save(state) {
      const saveData = {
        version: this.#version,
        timestamp: Date.now(),
        state
      };

      const buffer = this.#readBuffer(this.#activeBuffer);
      const blocks = buffer ? buffer.blocks || [] : [];
      const index = blocks.length;

      let block;
      if (index === 0) {
        block = await this.#crypto.encryptGenesis(saveData);
      } else {
        const prevBlock = blocks[blocks.length - 1];
        block = await this.#crypto.encryptChained(saveData, prevBlock, index);
      }

      blocks.push(block);

      const bufferData = { blocks, lastSave: Date.now() };
      this.#writeBuffer(this.#activeBuffer, bufferData);
      this.#writeMeta({ active: this.#activeBuffer, version: this.#version, lastSave: Date.now() });

      return { buffer: this.#activeBuffer, index };
    }

    async load() {
      const primary = this.#readBuffer(this.#activeBuffer);
      const secondary = this.#readBuffer(this.#activeBuffer === 'A' ? 'B' : 'A');

      const buffer = primary || secondary;
      if (!buffer || !buffer.blocks || buffer.blocks.length === 0)
        return null;

      const lastBlock = buffer.blocks[buffer.blocks.length - 1];
      const prevBlock = buffer.blocks.length > 1 ? buffer.blocks[buffer.blocks.length - 2] : null;

      try {
        const data = await this.#crypto.decryptBlock(lastBlock.cipher, lastBlock.header, prevBlock);
        return data;
      } catch (err) {
        if (primary && secondary && secondary.blocks && secondary.blocks.length > 0) {
          const fallbackLast = secondary.blocks[secondary.blocks.length - 1];
          const fallbackPrev = secondary.blocks.length > 1 ? secondary.blocks[secondary.blocks.length - 2] : null;
          try {
            const data = await this.#crypto.decryptBlock(fallbackLast.cipher, fallbackLast.header, fallbackPrev);
            return data;
          } catch (_) {
            return null;
          }
        }
        return null;
      }
    }

    hasSave() {
      const meta = this.#readMeta();
      if (!meta)
        return false;
      const buffer = this.#readBuffer(meta.active);
      return !!(buffer && buffer.blocks && buffer.blocks.length > 0);
    }

    getSummary() {
      const meta = this.#readMeta();
      if (!meta)
        return null;
      const buffer = this.#readBuffer(meta.active);
      if (!buffer || !buffer.blocks || buffer.blocks.length === 0)
        return null;
      return {
        lastSave: buffer.lastSave,
        blockCount: buffer.blocks.length,
        activeBuffer: meta.active,
        version: meta.version
      };
    }

    deleteSave() {
      this.#storage.removeItem(this.#bufferKey('A'));
      this.#storage.removeItem(this.#bufferKey('B'));
      this.#storage.removeItem(this.#metaKey());
      this.#activeBuffer = 'A';
    }

    saveSettings(settings) {
      this.#storage.setItem(this.#settingsKey(), JSON.stringify(settings));
    }

    loadSettings() {
      try {
        const raw = this.#storage.getItem(this.#settingsKey());
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }
  }

  TR.SaveManager = SaveManager;
})();
