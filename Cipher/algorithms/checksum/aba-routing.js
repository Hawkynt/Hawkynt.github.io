/*
 * ABA Routing Number Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * ABA Routing Number check digit for US bank routing numbers.
 * 9-digit code identifying financial institutions in the United States.
 * Uses weighted modulo-10 algorithm for validation.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework || !OpCodes) {
    throw new Error('AlgorithmFramework and OpCodes dependencies are required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

  class ABARoutingChecksumAlgorithm extends Algorithm {
    constructor() {
      super();

      this.name = "ABA-Routing";
      this.description = "ABA Routing Number check digit for US bank identification. 9-digit code using weighted modulo-10 algorithm with weights 3,7,1 repeating. Found on checks for ACH transfers, wire transfers, and direct deposits. Administered by American Bankers Association.";
      this.inventor = "American Bankers Association";
      this.year = 1910;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Banking Identifier";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 8; // Single digit 0-9

      this.documentation = [
        new LinkItem("ABA Routing Number on Wikipedia", "https://en.wikipedia.org/wiki/ABA_routing_transit_number"),
        new LinkItem("Federal Reserve Routing Directory", "https://www.frbservices.org/"),
        new LinkItem("ABA Routing Number Lookup", "https://www.routingnumbers.org/")
      ];

      this.notes = [
        "Format: 9 digits (8 data + 1 check)",
        "First 4 digits: Federal Reserve routing symbol",
        "Next 4 digits: ABA institution identifier",
        "Last digit: Check digit",
        "Weights: 3,7,1,3,7,1,3,7 for positions 1-8",
        "Algorithm: (3×d1 + 7×d2 + 1×d3 + ... + 7×d8) mod 10 = d9",
        "Found on: Bottom left of checks (MICR line)",
        "Example: 021000021 (JP Morgan Chase)",
        "Validates: ACH, wire transfers, direct deposit"
      ];

      this.tests = [
        {
          text: "JP Morgan Chase (021000021)",
          uri: "https://en.wikipedia.org/wiki/ABA_routing_transit_number",
          input: OpCodes.AnsiToBytes("02100002"),
          expected: [0x01] // Check digit 1 (021000021)
        },
        {
          text: "Routing number 026000013",
          uri: "https://en.wikipedia.org/wiki/ABA_routing_transit_number",
          input: OpCodes.AnsiToBytes("02600001"),
          expected: [0x03] // Check digit 3 (026000013)
        },
        {
          text: "Routing number 121000028",
          uri: "https://en.wikipedia.org/wiki/ABA_routing_transit_number",
          input: OpCodes.AnsiToBytes("12100002"),
          expected: [0x08] // Check digit 8 (121000028)
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new ABARoutingChecksumInstance(this, isInverse);
    }
  }

  class ABARoutingChecksumInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.digits = [];
      this.weights = [3, 7, 1, 3, 7, 1, 3, 7]; // Repeating pattern
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // Extract digits
      for (let i = 0; i < data.length; i++) {
        const char = String.fromCharCode(data[i]);
        if (char >= '0' && char <= '9') {
          this.digits.push(data[i] - 0x30);
        }
      }
    }

    Result() {
      if (this.digits.length === 0) {
        this.digits = [];
        return [0];
      }

      // Calculate weighted sum
      let sum = 0;
      for (let i = 0; i < Math.min(this.digits.length, 8); i++) {
        sum += this.digits[i] * this.weights[i];
      }

      // Check digit calculation: (10 - sum mod 10) mod 10
      const checkDigit = (10 - (sum % 10)) % 10;

      this.digits = [];
      return [checkDigit];
    }
  }

  RegisterAlgorithm(new ABARoutingChecksumAlgorithm());

  return { ABARoutingChecksumAlgorithm, ABARoutingChecksumInstance };
}));
