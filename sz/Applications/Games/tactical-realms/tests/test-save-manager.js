;(function() {
  'use strict';
  const { describe, it, beforeEach, assert } = window.TestRunner;
  const { SaveManager, SaveCrypto } = window.SZ.TacticalRealms;

  function createMemoryStorage() {
    const store = new Map();
    return {
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, val) { store.set(key, val); },
      removeItem(key) { store.delete(key); },
      clear() { store.clear(); },
      _store: store
    };
  }

  describe('SaveManager', () => {
    let storage;
    let crypto;
    let mgr;

    beforeEach(() => {
      storage = createMemoryStorage();
      crypto = new SaveCrypto();
      mgr = new SaveManager({ crypto, storage, prefix: 'test-tr' });
    });

    it('hasSave() returns false when no save exists', () => {
      assert.ok(!mgr.hasSave());
    });

    it('save() and hasSave() returns true after saving', async () => {
      await mgr.save({ gold: 100 });
      assert.ok(mgr.hasSave());
    });

    it('save() and load() roundtrip', async () => {
      const state = { party: ['Fighter', 'Mage'], gold: 250 };
      await mgr.save(state);
      const loaded = await mgr.load();
      assert.equal(loaded.state.gold, 250);
      assert.deepEqual(loaded.state.party, ['Fighter', 'Mage']);
    });

    it('multiple saves load the latest', async () => {
      await mgr.save({ step: 1 });
      await mgr.save({ step: 2 });
      await mgr.save({ step: 3 });
      const loaded = await mgr.load();
      assert.equal(loaded.state.step, 3);
    });

    it('getSummary() returns null when no save', () => {
      assert.isNull(mgr.getSummary());
    });

    it('getSummary() returns correct info after saves', async () => {
      await mgr.save({ x: 1 });
      await mgr.save({ x: 2 });
      const summary = mgr.getSummary();
      assert.equal(summary.blockCount, 2);
      assert.ok(summary.lastSave > 0);
      assert.ok(summary.activeBuffer);
    });

    it('deleteSave() clears everything', async () => {
      await mgr.save({ test: true });
      assert.ok(mgr.hasSave());
      mgr.deleteSave();
      assert.ok(!mgr.hasSave());
      assert.isNull(mgr.getSummary());
    });

    it('load() returns null when no save', async () => {
      const result = await mgr.load();
      assert.isNull(result);
    });

    it('saveSettings() and loadSettings() roundtrip', () => {
      mgr.saveSettings({ volume: 0.8, difficulty: 'hard' });
      const loaded = mgr.loadSettings();
      assert.equal(loaded.volume, 0.8);
      assert.equal(loaded.difficulty, 'hard');
    });

    it('loadSettings() returns null when none saved', () => {
      assert.isNull(mgr.loadSettings());
    });

    it('save preserves version and timestamp', async () => {
      await mgr.save({ data: 'test' });
      const loaded = await mgr.load();
      assert.equal(loaded.version, 2);
      assert.ok(loaded.timestamp > 0);
    });

    it('independent managers with different prefixes do not interfere', async () => {
      const mgr2 = new SaveManager({ crypto, storage, prefix: 'test-other' });
      await mgr.save({ game: 'A' });
      await mgr2.save({ game: 'B' });
      const loadA = await mgr.load();
      const loadB = await mgr2.load();
      assert.equal(loadA.state.game, 'A');
      assert.equal(loadB.state.game, 'B');
    });

    it('corrupted primary buffer falls back to secondary', async () => {
      await mgr.save({ original: true });
      const meta = JSON.parse(storage.getItem('test-tr-meta'));
      const activeKey = `test-tr-save-${meta.active}`;
      storage.setItem(activeKey, '{"blocks":[{"cipher":"GARBAGE","header":{"mode":"xor","k":0,"idx":0}}]}');
      const otherBuf = meta.active === 'A' ? 'B' : 'A';
      const goodBlock = await crypto.encryptGenesis({ fallback: true });
      storage.setItem(`test-tr-save-${otherBuf}`, JSON.stringify({ blocks: [goodBlock], lastSave: Date.now() }));
      const loaded = await mgr.load();
      assert.ok(loaded);
      assert.equal(loaded.fallback, true);
    });

    it('load() returns null when both buffers corrupt', async () => {
      await mgr.save({ data: 1 });
      const meta = JSON.parse(storage.getItem('test-tr-meta'));
      storage.setItem(`test-tr-save-${meta.active}`, '{"blocks":[{"cipher":"BAD","header":{"mode":"xor","k":0,"idx":0}}]}');
      const other = meta.active === 'A' ? 'B' : 'A';
      storage.setItem(`test-tr-save-${other}`, '{"blocks":[{"cipher":"BAD","header":{"mode":"xor","k":0,"idx":0}}]}');
      const loaded = await mgr.load();
      assert.isNull(loaded);
    });
  });
})();
