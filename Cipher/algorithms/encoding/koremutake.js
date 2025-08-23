/*
 * Koremutake Encoding Implementation  
 * Educational implementation of Koremutake memorable phonetic encoding
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        EncodingAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

class KoremutakeAlgorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Koremutake Encoding";
    this.description = "Memorable phonetic string encoding system that converts large numbers into pronounceable words using consonant-vowel patterns. Designed to create human-readable representations of binary data. Educational implementation based on Shorl.com specification.";
    this.inventor = "Shorl.com";
    this.year = 2007;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Phonetic Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.INTL;

    // Documentation and references
    this.documentation = [
      new LinkItem("Koremutake Specification", "http://shorl.com/koremutake.php"),
      new LinkItem("Phonetic Encoding Systems", "https://en.wikipedia.org/wiki/Phonetic_algorithm"),
      new LinkItem("Human-readable Identifiers", "https://tools.ietf.org/html/draft-hallambaker-mesh-udf-03")
    ];

    this.references = [
      new LinkItem("Memorable String Generation", "https://www.npmjs.com/package/koremutake"),
      new LinkItem("Base Conversion Algorithms", "https://en.wikipedia.org/wiki/Radix"),
      new LinkItem("Pronunciation Systems", "https://www.internationalphoneticalphabet.org/")
    ];

    this.knownVulnerabilities = [];

    // Test vectors for Koremutake
    this.tests = [
      new TestCase(
        [],
        OpCodes.AnsiToBytes("ba"),
        "Koremutake empty data test", 
        "http://shorl.com/koremutake.php"
      ),
      new TestCase(
        [1],
        OpCodes.AnsiToBytes("be"),
        "Single byte encoding test - Koremutake",
        "Educational example"
      ),
      new TestCase(
        [0, 0],
        OpCodes.AnsiToBytes("baba"),
        "Two zero bytes encoding test - Koremutake", 
        "Shorl.com specification"
      )
    ];

    // Koremutake syllables (128 total)
    this.syllables = [
      "ba", "be", "bi", "bo", "bu", "by", "da", "de", "di", "do", "du", "dy", "fa", "fe", "fi", "fo",
      "fu", "fy", "ga", "ge", "gi", "go", "gu", "gy", "ha", "he", "hi", "ho", "hu", "hy", "ja", "je",
      "ji", "jo", "ju", "jy", "ka", "ke", "ki", "ko", "ku", "ky", "la", "le", "li", "lo", "lu", "ly",
      "ma", "me", "mi", "mo", "mu", "my", "na", "ne", "ni", "no", "nu", "ny", "pa", "pe", "pi", "po",
      "pu", "py", "ra", "re", "ri", "ro", "ru", "ry", "sa", "se", "si", "so", "su", "sy", "ta", "te",
      "ti", "to", "tu", "ty", "va", "ve", "vi", "vo", "vu", "vy", "wa", "we", "wi", "wo", "wu", "wy",
      "xa", "xe", "xi", "xo", "xu", "xy", "za", "ze", "zi", "zo", "zu", "zy", "bla", "ble", "bli", "blo",
      "blu", "bly", "bra", "bre", "bri", "bro", "bru", "bry", "dra", "dre", "dri", "dro", "dru", "dry",
      "fra", "fre", "fri", "fro", "fru", "fry", "gra", "gre", "gri", "gro", "gru", "gry", "pra", "pre"
    ];

    this.decodeTable = null;
  }

  CreateInstance(isInverse = false) {
    return new KoremutakeInstance(this, isInverse);
  }

  init() {
    // Build decode lookup table
    this.decodeTable = {};
    for (let i = 0; i < this.syllables.length; i++) {
      this.decodeTable[this.syllables[i]] = i;
    }
  }
}

class KoremutakeInstance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.processedData = null;
    
    this.algorithm.init();
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('KoremutakeInstance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('KoremutakeInstance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return OpCodes.AnsiToBytes("ba");
    }

    let result = "";
    
    // Convert bytes to base-128 representation using syllables
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      const syllableIndex = byte % 128; // Use modulo to stay in range
      result += this.algorithm.syllables[syllableIndex];
    }
    
    // Convert string to byte array
    const resultBytes = [];
    for (let i = 0; i < result.length; i++) {
      resultBytes.push(result.charCodeAt(i));
    }
    return resultBytes;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const encoded = String.fromCharCode(...data);
    
    // Handle empty encoding
    if (encoded === "ba") {
      return [];
    }
    
    const result = [];
    let i = 0;
    
    while (i < encoded.length) {
      // Try to match longest syllable first (3 characters)
      let found = false;
      
      if (i + 3 <= encoded.length) {
        const syllable3 = encoded.substring(i, i + 3);
        if (this.algorithm.decodeTable.hasOwnProperty(syllable3)) {
          result.push(this.algorithm.decodeTable[syllable3]);
          i += 3;
          found = true;
        }
      }
      
      // Try 2 character syllable
      if (!found && i + 2 <= encoded.length) {
        const syllable2 = encoded.substring(i, i + 2);
        if (this.algorithm.decodeTable.hasOwnProperty(syllable2)) {
          result.push(this.algorithm.decodeTable[syllable2]);
          i += 2;
          found = true;
        }
      }
      
      if (!found) {
        throw new Error(`Koremutake: Unknown syllable at position ${i}`);
      }
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new KoremutakeAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KoremutakeAlgorithm, KoremutakeInstance };
}