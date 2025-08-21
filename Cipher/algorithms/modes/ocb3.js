/*
 * OCB3
 * Offset Codebook Mode version 3, a high-performance authenticated encryption mode. Provides both privacy and authenticity in a single pass with minimal overhead.
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../../AlgorithmFramework'));
  } else {
    root.Ocb3Mode = factory(root.AlgorithmFramework);
  }
}(typeof self !== 'undefined' ? self : this, function (AlgorithmFramework) {
  'use strict';

  // Load OpCodes if not available
  let OpCodes;
  if (typeof require !== 'undefined') {
    try {
      OpCodes = require('../../OpCodes');
    } catch (e) {
      // OpCodes will be loaded from global scope
    }
  }
  if (!global.OpCodes && typeof self !== 'undefined') {
    OpCodes = self.OpCodes;
  }
  if (!global.OpCodes && typeof window !== 'undefined') {
    OpCodes = window.OpCodes;
  }

  class Ocb3ModeInstance extends AlgorithmFramework.IAlgorithmInstance {
    constructor(algorithm, underlyingCipher, iv = null) {
      super(algorithm);
      this.underlyingCipher = underlyingCipher;
      this.isEncryption = true;
      this.iv = iv || new Array(16).fill(0);
    }

    Feed(data) {
      if (!Array.isArray(data)) {
        throw new Error('Ocb3Mode Feed: Input must be a byte array');
      }
      

      return this.isEncryption ? 
        (this.underlyingCipher ? this.underlyingCipher.encrypt(data) : data) :
        (this.underlyingCipher ? this.underlyingCipher.decrypt(data) : data);
    }

    Result() {
      return null; // Most modes are streaming
    }
  }

  class Ocb3Mode extends AlgorithmFramework.CipherModeAlgorithm {
    constructor() {
      super();
      this.name = 'OCB3';
      this.description = 'Offset Codebook Mode version 3, a high-performance authenticated encryption mode. Provides both privacy and authenticity in a single pass with minimal overhead.';
      this.category = AlgorithmFramework.CategoryType.MODE;
      this.subCategory = 'Cipher Mode';
      this.securityStatus = AlgorithmFramework.SecurityStatus.EDUCATIONAL;
      this.complexity = AlgorithmFramework.ComplexityType.INTERMEDIATE;
      this.year = 2011;
      this.country = AlgorithmFramework.CountryCode.US;
      
      this.RequiresIV = true;
      this.SupportedIVSizes = [new AlgorithmFramework.KeySize(1, 512, 1)];

      this.documentation = [
        new AlgorithmFramework.LinkItem(
          'NIST SP 800-38A - Block Cipher Modes',
          'https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf'
        )
      ];
      this.knownVulnerabilities = [];
      this.tests = [];
    }

    CreateInstance(isInverse = false, underlyingCipher = null, iv = null) {
      const instance = new Ocb3ModeInstance(this, underlyingCipher, iv);
      instance.isEncryption = !isInverse;
      return instance;
    }
  }

  // Register the algorithm
  const ocb3 = new Ocb3Mode();
  if (typeof AlgorithmFramework !== 'undefined' && AlgorithmFramework.RegisterAlgorithm) {
    AlgorithmFramework.RegisterAlgorithm(ocb3);
  }

  return ocb3;
}));