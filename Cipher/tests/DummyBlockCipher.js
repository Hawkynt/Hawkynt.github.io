/*
 * DummyBlockCipher - Simple identity cipher for testing modes of operation
 * Returns input XORed with key for testing purposes only
 * (c)2006-2025 Hawkynt
 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../AlgorithmFramework'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../AlgorithmFramework'));
  } else {
    root.DummyBlockCipher = factory(root.AlgorithmFramework).DummyBlockCipher;
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function(AlgorithmFramework) {
  'use strict';

  const { BlockCipherAlgorithm, IBlockCipherInstance, KeySize } = AlgorithmFramework;

  class DummyBlockCipher extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "DummyBlockCipher";
      this.description = "Identity cipher for testing modes (XOR with key)";
      this.SupportedBlockSizes = [new KeySize(16, 16, 1)];
      this.SupportedKeySizes = [new KeySize(16, 32, 1)];
      this.BlockSize = 16;
    }

    CreateInstance(isInverse = false) {
      return new DummyBlockCipherInstance(this, isInverse);
    }
  }

  class DummyBlockCipherInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);

        // Pad if necessary
        while (block.length < 16) {
          block.push(0);
        }

        // Simple XOR with key (identity-like operation)
        for (let j = 0; j < 16; j++) {
          output.push(block[j] ^ this._key[j % this._key.length]);
        }
      }

      this.inputBuffer = [];
      return output.slice(0, this.inputBuffer.length || output.length);
    }
  }

  return { DummyBlockCipher, DummyBlockCipherInstance };
}));
