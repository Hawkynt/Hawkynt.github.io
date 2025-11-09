/*
 * NMEA 0183 Checksum Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * NMEA 0183 sentence checksum for GPS/marine navigation systems.
 * XOR-based checksum between '$' and '*' delimiters.
 * Standard protocol for marine electronics communication.
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

  class NMEA0183Algorithm extends Algorithm {
    constructor() {
      super();

      this.name = "NMEA-0183";
      this.description = "NMEA 0183 sentence checksum for GPS and marine navigation systems. XOR of all characters between '$' and '*' delimiters. Standard protocol format: $...data...*CC where CC is 2-digit hex checksum. Used in marine electronics worldwide.";
      this.inventor = "National Marine Electronics Association";
      this.year = 1983;
      this.category = CategoryType.CHECKSUM;
      this.subCategory = "Navigation Protocol";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      this.checksumSize = 8; // 8-bit checksum

      this.documentation = [
        new LinkItem("NMEA 0183 on Wikipedia", "https://en.wikipedia.org/wiki/NMEA_0183"),
        new LinkItem("NMEA Sentence Structure", "https://www.nmea.org/content/STANDARDS/NMEA_0183_Standard"),
        new LinkItem("GPS Sentence Parsing", "http://aprs.gids.nl/nmea/")
      ];

      this.notes = [
        "Sentence format: $<data>*<checksum>",
        "Checksum: XOR of all bytes between $ and *",
        "Output: 2-digit hexadecimal (00-FF)",
        "Common sentences: GPGGA, GPGLL, GPGSA, GPGSV, GPRMC",
        "Used in: GPS receivers, marine navigation, AIS",
        "Simple but effective for detecting transmission errors",
        "Not designed for security, only error detection"
      ];

      this.tests = [
        {
          text: "GPRMC sentence",
          uri: "https://en.wikipedia.org/wiki/NMEA_0183",
          input: OpCodes.AnsiToBytes("GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W"),
          expected: [0x73] // Actual NMEA checksum
        },
        {
          text: "GPGGA sentence",
          uri: "NMEA sentence checksum",
          input: OpCodes.AnsiToBytes("GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,"),
          expected: [0x47]
        },
        {
          text: "Simple test",
          uri: "XOR checksum",
          input: OpCodes.AnsiToBytes("TEST"),
          expected: [0x54 ^ 0x45 ^ 0x53 ^ 0x54] // T^E^S^T
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // Checksums have no inverse
      return new NMEA0183Instance(this, isInverse);
    }
  }

  class NMEA0183Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.checksum = 0;
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      // XOR all bytes
      for (let i = 0; i < data.length; i++) {
        this.checksum ^= data[i];
      }
    }

    Result() {
      const result = [this.checksum & 0xFF];
      this.checksum = 0;
      return result;
    }
  }

  RegisterAlgorithm(new NMEA0183Algorithm());

  return { NMEA0183Algorithm, NMEA0183Instance };
}));
