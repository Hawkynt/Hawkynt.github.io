/*
 * Al-Kindi Frequency Analysis Implementation
 * Historical Cryptanalysis Method from 9th Century
 * (c)2006-2025 Hawkynt
 */


(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }
  
  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class AlKindiFrequency extends CryptoAlgorithm {
      constructor() {
        super();
        this.name = "Al-Kindi Frequency Analysis";
        this.description = "Historical frequency analysis method developed by Al-Kindi (Alkindus) in 9th century Baghdad. First systematic approach to cryptanalysis using statistical analysis of letter frequencies to break substitution ciphers.";
        this.category = CategoryType.CLASSICAL;
        this.subCategory = "Frequency Analysis";
        this.securityStatus = SecurityStatus.EDUCATIONAL;
        this.securityNotes = "Educational cryptanalysis tool demonstrating frequency analysis principles. Shows vulnerability of simple substitution ciphers to statistical attacks.";
        this.inventor = "Abu Yusuf Yaqub ibn Ishaq al-Kindi";
        this.year = 850;
        this.country = CountryCode.ANCIENT;
        this.complexity = ComplexityType.BEGINNER;

        this.documentation = [
          new LinkItem("History of Cryptography", "https://en.wikipedia.org/wiki/Al-Kindi"),
          new LinkItem("Frequency Analysis", "https://en.wikipedia.org/wiki/Frequency_analysis"),
          new LinkItem("Medieval Cryptography", "https://www.maa.org/press/periodicals/convergence/cryptology-in-the-medieval-islamic-world")
        ];

        this.references = [
          new LinkItem("Al-Kindi's Manuscript", "https://www.lib.cam.ac.uk/collections/departments/taylor-schechter-genizah-research-unit"),
          new LinkItem("Islamic Golden Age", "https://www.encyclopedia.com/science/encyclopedias-almanacs-transcripts-and-maps/al-kindi-abu-yusuf-yaqub-ibn-ishaq"),
          new LinkItem("Cryptanalysis History", "https://crypto.stanford.edu/pbc/notes/crypto/classical.html")
        ];

        this.knownVulnerabilities = [
          "Only effective against simple substitution ciphers",
          "Requires knowledge of plaintext language frequency patterns"
        ];

        this.tests = [
          {
            text: "Caesar Cipher Analysis (ciphertext shifted by 3, recovered by frequency analysis)",
            uri: "Historical cryptanalysis examples",
            input: OpCodes.AnsiToBytes("WKRV LV D VHFUHW PHVVDJH"),
            expected: OpCodes.AnsiToBytes("THOS IS A SECRET MESSAGE"),
            language: "english"
          },
          {
            text: "Substitution Analysis",
            uri: "Educational examples",
            input: OpCodes.AnsiToBytes("HELLO WORLD"),
            key: OpCodes.AnsiToBytes("english"),
            expected: OpCodes.AnsiToBytes("EBIIL TLOIA")
          }
        ];

      }

      /**
       * Create new instance
       * @param {boolean} [isInverse=false] - Unused: analysis has no inverse
       * @returns {AlKindiFrequencyInstance} New instance
       */
      CreateInstance(isInverse = false) {
        return new AlKindiFrequencyInstance(this, isInverse);
      }
    }

    /** @type {string} */
    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    /**
     * Letter frequencies of a text. Counts and percentages are indexed by
     * letter, A = 0 .. Z = 25.
     * @class
     */
    class LetterFrequencies {
      /**
       * @param {int32[]} counts - Occurrences of each letter
       * @param {float64[]} percentages - Share of each letter in percent
       * @param {int32} totalLetters - Characters counted as letters
       */
      constructor(counts, percentages, totalLetters) {
        /** @type {int32[]} */
        this.counts = counts;
        /** @type {float64[]} */
        this.percentages = percentages;
        /** @type {int32} */
        this.totalLetters = totalLetters;
      }
    }

    /**
     * One Caesar shift tried against the ciphertext
     * @class
     */
    class CaesarGuess {
      /**
       * @param {int32} shift - Shift undone
       * @param {uint8[]} decrypted - Text with the shift undone
       * @param {float64} chiSquared - Distance from English letter frequencies
       * @param {LetterFrequencies} frequencies - Letter frequencies of the decryption
       * @param {string} text - The decryption as text
       */
      constructor(shift, decrypted, chiSquared, frequencies, text) {
        /** @type {int32} */
        this.shift = shift;
        /** @type {uint8[]} */
        this.decrypted = decrypted;
        /** @type {float64} */
        this.chiSquared = chiSquared;
        /** @type {LetterFrequencies} */
        this.frequencies = frequencies;
        /** @type {string} */
        this.text = text;
      }
    }

    /**
     * A frequency-rank substitution guess
     * @class
     */
    class SubstitutionGuess {
      /**
       * @param {string[]} mapping - English letter guessed for each cipher letter (A = 0)
       * @param {uint8[]} decrypted - Text with the guess applied
       * @param {LetterFrequencies} cipherFrequencies - Letter frequencies of the ciphertext
       * @param {string} text - The decryption as text
       */
      constructor(mapping, decrypted, cipherFrequencies, text) {
        /** @type {string[]} */
        this.mapping = mapping;
        /** @type {uint8[]} */
        this.decrypted = decrypted;
        /** @type {LetterFrequencies} */
        this.cipherFrequencies = cipherFrequencies;
        /** @type {string} */
        this.text = text;
      }
    }

    /**
     * Everything the analysis found
     * @class
     */
    class FrequencyAnalysis {
      /**
       * @param {string} originalText - Analysed text
       * @param {LetterFrequencies} frequencies - Its letter frequencies
       * @param {CaesarGuess[]} caesarAnalysis - The five best Caesar shifts
       * @param {SubstitutionGuess} substitutionAnalysis - Frequency-rank substitution guess
       * @param {CaesarGuess} bestCaesarGuess - Best Caesar shift
       * @param {string[]} recommendations - Conclusions in words
       */
      constructor(originalText, frequencies, caesarAnalysis, substitutionAnalysis, bestCaesarGuess, recommendations) {
        /** @type {string} */
        this.originalText = originalText;
        /** @type {LetterFrequencies} */
        this.frequencies = frequencies;
        /** @type {CaesarGuess[]} */
        this.caesarAnalysis = caesarAnalysis;
        /** @type {SubstitutionGuess} */
        this.substitutionAnalysis = substitutionAnalysis;
        /** @type {CaesarGuess} */
        this.bestCaesarGuess = bestCaesarGuess;
        /** @type {string[]} */
        this.recommendations = recommendations;
      }
    }

    class AlKindiFrequencyInstance extends IAlgorithmInstance {
      /**
       * @param {AlKindiFrequency} algorithm - Parent algorithm instance
       * @param {boolean} [isInverse=false] - Unused
       */
      constructor(algorithm, isInverse = false) {
        super(algorithm, isInverse);
        /** @type {boolean} */
        this.isInverse = isInverse;
        /** @type {string} */
        this.language = 'english';
        /** @type {FrequencyAnalysis|null} */
        this.analysisResults = null;
        /** @type {uint8[]} */
        this.inputBuffer = [];
        /** @type {uint8[]|null} */
        this._keyData = null;
      }

      /**
       * English letter frequencies in percent, A = 0 .. Z = 25
       * @returns {float64[]} Frequencies
       */
      get ENGLISH_FREQ() {
        return [
          8.12, 1.49, 2.78, 4.25, 12.02, 2.23,
          2.02, 6.09, 6.97, 0.15, 0.77, 4.03,
          2.41, 6.75, 7.51, 1.93, 0.10, 5.99,
          6.33, 9.06, 2.76, 0.98, 2.36, 0.15,
          1.97, 0.07
        ];
      }

      /**
       * @returns {boolean} Always true
       */
      Initialize() {
        this.analysisResults = null;
        return true;
      }

      /**
       * Language name (test framework compatibility)
       * @param {uint8[]|null} keyData - Language name bytes
       */
      set key(keyData) {
        this._keyData = keyData;
        /** @type {string} */
        const keyString = keyData ? String.fromCharCode(...keyData) : "english";
        this.language = keyString ? keyString : 'english';
      }

      /**
       * Get a copy of the key bytes last set; the language is read through language
       * @returns {uint8[]|null} Copy of the key bytes, or null when none were set
       */
      get key() {
        return this._keyData ? this._keyData.slice() : null;
      }

      /**
       * @param {uint8[]|null} key - Language name bytes
       * @returns {boolean} Always true
       */
      SetKey(key) {
        this.key = key;
        return true;
      }

      /**
       * Count letters (case-insensitive). A byte whose upper case is more
       * than one letter (0xDF becomes "SS") counts towards the total without
       * counting as any single letter.
       * @param {uint8[]} text - Bytes
       * @returns {LetterFrequencies} Counts and percentages
       */
      countFrequencies(text) {
        /** @type {int32[]} */
        const counts = OpCodes.CreateArray(26, 0);
        /** @type {int32} */
        let totalLetters = 0;

        // Count letters
        for (let i = 0; i < text.length; i++) {
          /** @type {string} */
          const char = String.fromCharCode(text[i]).toUpperCase();
          if (char >= 'A' && char <= 'Z') {
            if (char.length === 1) counts[char.charCodeAt(0) - 65]++;
            totalLetters++;
          }
        }

        // Convert to percentages
        /** @type {float64[]} */
        const percentages = [];
        for (let k = 0; k < 26; k++) {
          percentages.push(totalLetters > 0 ? (counts[k] / totalLetters) * 100 : 0);
        }

        return new LetterFrequencies(counts, percentages, totalLetters);
      }

      /**
       * @param {float64[]} observed - Observed percentages, A = 0
       * @param {float64[]} expected - Expected percentages, A = 0
       * @returns {float64} Chi-squared distance
       */
      chiSquared(observed, expected) {
        /** @type {float64} */
        let chiSq = 0;

        for (let k = 0; k < 26; k++) {
          if (expected[k] && expected[k] > 0) {
            /** @type {float64} */
            const diff = observed[k] - expected[k];
            chiSq += (diff * diff) / expected[k];
          }
        }

        return chiSq;
      }

      /**
       * @param {uint8[]} ciphertext - Bytes
       * @returns {CaesarGuess[]} All 26 shifts, best (lowest chi-squared) first
       */
      tryCaesarShifts(ciphertext) {
        /** @type {CaesarGuess[]} */
        const results = [];

        for (let shift = 0; shift < 26; shift++) {
          /** @type {uint8[]} */
          const decrypted = this.applyCaesarShift(ciphertext, shift);
          /** @type {LetterFrequencies} */
          const frequencies = this.countFrequencies(decrypted);
          /** @type {float64} */
          const chiSq = this.chiSquared(frequencies.percentages, this.ENGLISH_FREQ);
          /** @type {string} */
          const text = String.fromCharCode(...decrypted);

          results.push(new CaesarGuess(shift, decrypted, chiSq, frequencies, text));
        }

        // Sort by chi-squared (lower is better); stable, so ties keep shift order
        for (let i = 1; i < results.length; i++) {
          /** @type {CaesarGuess} */
          const entry = results[i];
          /** @type {int32} */
          let j = i - 1;
          while (j >= 0 && results[j].chiSquared - entry.chiSquared > 0) {
            results[j + 1] = results[j];
            j--;
          }
          results[j + 1] = entry;
        }

        return results;
      }

      /**
       * @param {uint8[]} ciphertext - Bytes
       * @param {int32} shift - Shift to undo
       * @returns {uint8[]} Letters shifted back in their own case, other bytes unchanged
       */
      applyCaesarShift(ciphertext, shift) {
        /** @type {uint8[]} */
        const result = [];

        for (let i = 0; i < ciphertext.length; i++) {
          /** @type {string} */
          const char = String.fromCharCode(ciphertext[i]);

          if (char >= 'A' && char <= 'Z') {
            /** @type {int32} */
            const shifted = ((char.charCodeAt(0) - 65 - shift + 26) % 26) + 65;
            result.push(shifted);
          } else if (char >= 'a' && char <= 'z') {
            /** @type {int32} */
            const shifted = ((char.charCodeAt(0) - 97 - shift + 26) % 26) + 97;
            result.push(shifted);
          } else {
            result.push(ciphertext[i]);
          }
        }

        return result;
      }

      /**
       * Letters ordered by descending frequency; ties keep alphabetical order
       * @param {float64[]} values - Value per letter, A = 0
       * @returns {int32[]} Letter indices
       */
      _rankLetters(values) {
        /** @type {int32[]} */
        const order = [];
        for (let k = 0; k < 26; k++) order.push(k);
        for (let i = 1; i < order.length; i++) {
          /** @type {int32} */
          const entry = order[i];
          /** @type {int32} */
          let j = i - 1;
          while (j >= 0 && values[entry] - values[order[j]] > 0) {
            order[j + 1] = order[j];
            j--;
          }
          order[j + 1] = entry;
        }
        return order;
      }

      /**
       * @param {uint8[]} ciphertext - Bytes
       * @returns {SubstitutionGuess} Frequency-rank substitution guess
       */
      analyzeSubstitution(ciphertext) {
        /** @type {LetterFrequencies} */
        const cipherFreq = this.countFrequencies(ciphertext);

        // Sort cipher letters and English letters by frequency
        /** @type {int32[]} */
        const cipherSorted = this._rankLetters(cipherFreq.percentages);
        /** @type {int32[]} */
        const englishSorted = this._rankLetters(this.ENGLISH_FREQ);

        // Create mapping
        /** @type {string[]} */
        const substitutionMap = [];
        for (let k = 0; k < 26; k++) substitutionMap.push('');
        for (let i = 0; i < 26; i++) {
          substitutionMap[cipherSorted[i]] = LETTERS.charAt(englishSorted[i]);
        }

        // Apply substitution
        /** @type {uint8[]} */
        const decrypted = [];
        for (let i = 0; i < ciphertext.length; i++) {
          /** @type {string} */
          const char = String.fromCharCode(ciphertext[i]).toUpperCase();
          if (char.length === 1 && char >= 'A' && char <= 'Z') {
            decrypted.push(substitutionMap[char.charCodeAt(0) - 65].charCodeAt(0));
          } else {
            decrypted.push(ciphertext[i]);
          }
        }

        /** @type {string} */
        const text = String.fromCharCode(...decrypted);
        return new SubstitutionGuess(substitutionMap, decrypted, cipherFreq, text);
      }

      /**
       * @param {uint8[]} ciphertext - Bytes
       * @returns {FrequencyAnalysis} Everything the analysis found
       */
      analyze(ciphertext) {
        /** @type {LetterFrequencies} */
        const frequencies = this.countFrequencies(ciphertext);

        // Try Caesar cipher analysis
        /** @type {CaesarGuess[]} */
        const caesarResults = this.tryCaesarShifts(ciphertext);

        // Try general substitution analysis
        /** @type {SubstitutionGuess} */
        const substitutionResult = this.analyzeSubstitution(ciphertext);

        /** @type {string} */
        const originalText = String.fromCharCode(...ciphertext);
        this.analysisResults = new FrequencyAnalysis(
          originalText,
          frequencies,
          caesarResults.slice(0, 5), // Top 5 results
          substitutionResult,
          caesarResults[0],
          this.generateRecommendations(frequencies, caesarResults[0])
        );

        return this.analysisResults;
      }

      /**
       * @param {LetterFrequencies} frequencies - Letter frequencies of the ciphertext
       * @param {CaesarGuess} bestCaesar - Best Caesar shift
       * @returns {string[]} Conclusions in words
       */
      generateRecommendations(frequencies, bestCaesar) {
        /** @type {string[]} */
        const recommendations = [];

        // Check if it looks like English
        /** @type {float64} */
        const eShare = frequencies.percentages[4];
        /** @type {float64} */
        const tShare = frequencies.percentages[19];
        /** @type {float64} */
        const eFreq = eShare ? eShare : 0;
        /** @type {float64} */
        const tFreq = tShare ? tShare : 0;

        if (eFreq > 10 && tFreq > 7) {
          recommendations.push("High E and T frequencies suggest English plaintext");
        }

        if (bestCaesar.chiSquared < 50) {
          recommendations.push("Caesar cipher likely with shift " + bestCaesar.shift);
        } else {
          recommendations.push("May be a more complex substitution cipher");
        }

        if (frequencies.totalLetters < 100) {
          recommendations.push("Text too short for reliable frequency analysis");
        }

        return recommendations;
      }

      /**
       * @returns {uint8[]} The best Caesar decryption of the buffered text
       */
      Result() {
        if (!this.inputBuffer || this.inputBuffer.length === 0) {
          /** @type {uint8[]} */
          const empty = [];
          return empty;
        }

        return this.Process(this.inputBuffer, !this.isInverse);
      }

      /**
       * @param {uint8[]} input - Bytes
       * @param {boolean} [isEncryption=true] - Unused
       * @returns {uint8[]} The best Caesar decryption
       */
      Process(input, isEncryption = true) {
        // For analysis tool, return analysis results (best guess)
        /** @type {FrequencyAnalysis} */
        const analysis = this.analyze(input);
        return analysis.bestCaesarGuess.decrypted;
      }

      /**
       * @returns {void}
       */
      ClearData() {
        this.analysisResults = null;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new AlKindiFrequency();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { AlKindiFrequency, AlKindiFrequencyInstance };
}));