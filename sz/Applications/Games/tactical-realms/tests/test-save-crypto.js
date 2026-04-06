;(function() {
  'use strict';
  const { describe, it, assert, skip } = window.TestRunner;
  const SaveCrypto = window.SZ.TacticalRealms.SaveCrypto;

  const requireCrypto = () => {
    if (!SaveCrypto.isAvailable())
      skip('Web Crypto not available (serve via http:// to enable)');
  };

  describe('SaveCrypto', () => {

    it('isAvailable() returns a boolean', () => {
      assert.typeOf(SaveCrypto.isAvailable(), 'boolean');
    });

    it('XOR fallback: encryptGenesis roundtrip', async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'crypto');
      try {
        Object.defineProperty(window, 'crypto', { value: undefined, writable: true, configurable: true });
        const sc = new SaveCrypto();
        const data = { test: 'hello', num: 42 };
        const block = await sc.encryptGenesis(data);
        assert.equal(block.header.mode, 'xor');
        assert.equal(block.header.idx, 0);
        const decrypted = await sc.decryptBlock(block.cipher, block.header, null);
        assert.deepEqual(decrypted, data);
      } finally {
        if (original)
          Object.defineProperty(window, 'crypto', original);
        else
          delete window.crypto;
      }
    });

    it('XOR fallback: encryptChained roundtrip', async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'crypto');
      try {
        Object.defineProperty(window, 'crypto', { value: undefined, writable: true, configurable: true });
        const sc = new SaveCrypto();
        const data1 = { step: 1 };
        const block1 = await sc.encryptGenesis(data1);
        const data2 = { step: 2 };
        const block2 = await sc.encryptChained(data2, block1, 1);
        assert.equal(block2.header.mode, 'xor');
        assert.equal(block2.header.idx, 1);
        const decrypted = await sc.decryptBlock(block2.cipher, block2.header, block1);
        assert.deepEqual(decrypted, data2);
      } finally {
        if (original)
          Object.defineProperty(window, 'crypto', original);
        else
          delete window.crypto;
      }
    });

    it('XOR fallback: tampered cipher fails to parse', async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'crypto');
      try {
        Object.defineProperty(window, 'crypto', { value: undefined, writable: true, configurable: true });
        const sc = new SaveCrypto();
        const block = await sc.encryptGenesis({ valid: true });
        const tampered = 'AAAA' + block.cipher.substring(4);
        let failed = false;
        try {
          const result = await sc.decryptBlock(tampered, block.header, null);
          if (!result || typeof result !== 'object' || result.valid !== true)
            failed = true;
        } catch (_) {
          failed = true;
        }
        assert.ok(failed, 'Tampered data should fail or produce wrong result');
      } finally {
        if (original)
          Object.defineProperty(window, 'crypto', original);
        else
          delete window.crypto;
      }
    });

    it('AES-GCM: encryptGenesis roundtrip', async () => {
      requireCrypto();
      const sc = new SaveCrypto();
      const data = { name: 'Gandalf', level: 20, items: ['staff', 'ring'] };
      const block = await sc.encryptGenesis(data);
      assert.equal(block.header.mode, 'aes');
      assert.equal(block.header.idx, 0);
      assert.ok(block.header.iv);
      const decrypted = await sc.decryptBlock(block.cipher, block.header, null);
      assert.deepEqual(decrypted, data);
    });

    it('AES-GCM: encryptChained roundtrip', async () => {
      requireCrypto();
      const sc = new SaveCrypto();
      const data1 = { step: 'genesis' };
      const block1 = await sc.encryptGenesis(data1);
      const data2 = { step: 'chain1', gold: 500 };
      const block2 = await sc.encryptChained(data2, block1, 1);
      assert.equal(block2.header.idx, 1);
      assert.equal(block2.header.chain, 0);
      const decrypted = await sc.decryptBlock(block2.cipher, block2.header, block1);
      assert.deepEqual(decrypted, data2);
    });

    it('AES-GCM: multi-block chain integrity', async () => {
      requireCrypto();
      const sc = new SaveCrypto();
      let prevBlock = null;
      const blocks = [];
      for (let i = 0; i < 5; ++i) {
        const data = { index: i, value: `block-${i}` };
        const block = i === 0
          ? await sc.encryptGenesis(data)
          : await sc.encryptChained(data, prevBlock, i);
        blocks.push(block);
        prevBlock = block;
      }
      for (let i = 0; i < 5; ++i) {
        const prev = i > 0 ? blocks[i - 1] : null;
        const result = await sc.decryptBlock(blocks[i].cipher, blocks[i].header, prev);
        assert.equal(result.index, i);
        assert.equal(result.value, `block-${i}`);
      }
    });

    it('AES-GCM: tampered cipher throws', async () => {
      requireCrypto();
      const sc = new SaveCrypto();
      const block = await sc.encryptGenesis({ secret: 'data' });
      const tampered = 'ZZZZ' + block.cipher.substring(4);
      await assert.rejects(
        () => sc.decryptBlock(tampered, block.header, null),
        'Tampered AES-GCM should throw'
      );
    });

    it('AES-GCM: different IVs produce different ciphertexts', async () => {
      requireCrypto();
      const sc = new SaveCrypto();
      const data = { same: 'data' };
      const block1 = await sc.encryptGenesis(data);
      const block2 = await sc.encryptGenesis(data);
      assert.notEqual(block1.cipher, block2.cipher);
    });

    it('encryptGenesis handles complex nested objects', async () => {
      const sc = new SaveCrypto();
      const complex = {
        party: [{ name: 'A', stats: { str: 10 } }],
        map: { tiles: [[1, 2], [3, 4]] },
        flag: true,
        empty: null
      };
      const block = await sc.encryptGenesis(complex);
      const result = await sc.decryptBlock(block.cipher, block.header, null);
      assert.deepEqual(result, complex);
    });

    it('encryptGenesis handles empty object', async () => {
      const sc = new SaveCrypto();
      const block = await sc.encryptGenesis({});
      const result = await sc.decryptBlock(block.cipher, block.header, null);
      assert.deepEqual(result, {});
    });
  });
})();
