/*
 * Al-Kindi Frequency Analysis Implementation
 * Historical Cryptanalysis Method from 9th Century
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load dependencies
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }
  
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }
  
  if (!global.AlgorithmFramework) {
    console.error('AlgorithmFramework is required');
    return;
  }
  
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          CryptoAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;

  class AlKindiFrequency extends CryptoAlgorithm {
    constructor() {
      super();
      this.name = "Al-Kindi Frequency Analysis";
      this.description = "Historical frequency analysis method developed by Al-Kindi (Alkindus) in 9th century Baghdad. First systematic approach to cryptanalysis using statistical analysis of letter frequencies to break substitution ciphers.";
      this.category = CategoryType.CLASSICAL;
      this.subCategory = "Frequency Analysis";
      this.securityStatus = SecurityStatus.HISTORICAL;
      this.securityNotes = "Educational cryptanalysis tool demonstrating frequency analysis principles. Shows vulnerability of simple substitution ciphers to statistical attacks.";
      this.inventor = "Abu Yusuf Yaqub ibn Ishaq al-Kindi";
      this.year = 850;
      this.country = "Iraq (Abbasid Caliphate)";
      this.complexity = ComplexityType.LOW;
    
      
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
          text: "Caesar Cipher Analysis",
          uri: "Historical cryptanalysis examples",
        ciphertext: OpCodes.StringToBytes("WKRV LV D VHFUHW PHVVDJH"),
        plaintext: OpCodes.StringToBytes("THIS IS A SECRET MESSAGE"),
        shift: 3, // Caesar cipher for testing
        language: "english"
        },
        {
          text: "Substitution Analysis",
          uri: "Educational examples",
          input: global.OpCodes?.AnsiToBytes("HELLO WORLD") || [72, 69, 76, 76, 79, 32, 87, 79, 82, 76, 68],
          key: global.OpCodes?.AnsiToBytes("english") || [101, 110, 103, 108, 105, 115, 104],
          expected: global.OpCodes?.AnsiToBytes("EBIIL TLOIA") || [69, 66, 73, 73, 76, 32, 84, 76, 79, 73, 65]
        }
      ];

    }
    
    CreateInstance(isInverse = false) {
      return new AlKindiFrequencyInstance(this, isInverse);
    }
  }
  
  class AlKindiFrequencyInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm, isInverse);
      this.isInverse = isInverse;
      this.language = 'english';
      this.analysisResults = null;
      this.inputBuffer = [];
    }
    
    get ENGLISH_FREQ() {
      return {
      'A': 8.12, 'B': 1.49, 'C': 2.78, 'D': 4.25, 'E': 12.02, 'F': 2.23,
      'G': 2.02, 'H': 6.09, 'I': 6.97, 'J': 0.15, 'K': 0.77, 'L': 4.03,
      'M': 2.41, 'N': 6.75, 'O': 7.51, 'P': 1.93, 'Q': 0.10, 'R': 5.99,
        'S': 6.33, 'T': 9.06, 'U': 2.76, 'V': 0.98, 'W': 2.36, 'X': 0.15,
        'Y': 1.97, 'Z': 0.07
      };
    }
    
    
    Initialize() {
      this.analysisResults = null;
      return true;
    }
    
    // Property setter for key (test framework compatibility)
    set key(keyData) {
      this._keyData = keyData;
      const keyString = keyData ? String.fromCharCode(...keyData) : "english";
      this.language = keyString || 'english';
    }
    
    get key() {
      return this.language || "english";
    }

    SetKey(key) {
      this.key = key;
      return true;
    }
    
    countFrequencies(text) {
      const frequencies = {};
      let totalLetters = 0;
      
      // Initialize counts
      for (let c = 65; c <= 90; c++) { // A-Z
        frequencies[String.fromCharCode(c)] = 0;
      }
      
      // Count letters
      for (let i = 0; i < text.length; i++) {
        const char = String.fromCharCode(text[i]).toUpperCase();
        if (char >= 'A' && char <= 'Z') {
          frequencies[char]++;
          totalLetters++;
        }
      }
      
      // Convert to percentages
      const percentages = {};
      for (const letter in frequencies) {
        percentages[letter] = totalLetters > 0 ? (frequencies[letter] / totalLetters) * 100 : 0;
      }
      
      return {
        counts: frequencies,
        percentages: percentages,
        totalLetters: totalLetters
      };
    }
    
    chiSquared(observed, expected) {
      let chiSq = 0;
      
      for (const letter in observed) {
        if (expected[letter] && expected[letter] > 0) {
          const diff = observed[letter] - expected[letter];
          chiSq += (diff * diff) / expected[letter];
        }
      }
      
      return chiSq;
    }
    
    tryCaesarShifts(ciphertext) {
      const results = [];
      
      for (let shift = 0; shift < 26; shift++) {
        const decrypted = this.applyCaesarShift(ciphertext, shift);
        const frequencies = this.countFrequencies(decrypted);
        const chiSq = this.chiSquared(frequencies.percentages, this.ENGLISH_FREQ);
        
        results.push({
          shift: shift,
          decrypted: decrypted,
          chiSquared: chiSq,
          frequencies: frequencies,
          text: String.fromCharCode(...decrypted)
        });
      }
      
      // Sort by chi-squared (lower is better)
      results.sort((a, b) => a.chiSquared - b.chiSquared);
      
      return results;
    }
    
    applyCaesarShift(ciphertext, shift) {
      const result = [];
      
      for (let i = 0; i < ciphertext.length; i++) {
        const char = String.fromCharCode(ciphertext[i]);
        
        if (char >= 'A' && char <= 'Z') {
          const shifted = ((char.charCodeAt(0) - 65 - shift + 26) % 26) + 65;
          result.push(shifted);
        } else if (char >= 'a' && char <= 'z') {
          const shifted = ((char.charCodeAt(0) - 97 - shift + 26) % 26) + 97;
          result.push(shifted);
        } else {
          result.push(ciphertext[i]);
        }
      }
      
      return result;
    }
    
    analyzeSubstitution(ciphertext) {
      const cipherFreq = this.countFrequencies(ciphertext);
      
      // Sort cipher letters by frequency
      const cipherSorted = Object.entries(cipherFreq.percentages)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // Sort English letters by frequency
      const englishSorted = Object.entries(this.ENGLISH_FREQ)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // Create mapping
      const substitutionMap = {};
      for (let i = 0; i < Math.min(cipherSorted.length, englishSorted.length); i++) {
        substitutionMap[cipherSorted[i]] = englishSorted[i];
      }
      
      // Apply substitution
      const decrypted = [];
      for (let i = 0; i < ciphertext.length; i++) {
        const char = String.fromCharCode(ciphertext[i]).toUpperCase();
        if (substitutionMap[char]) {
          decrypted.push(substitutionMap[char].charCodeAt(0));
        } else {
          decrypted.push(ciphertext[i]);
        }
      }
      
      return {
        mapping: substitutionMap,
        decrypted: decrypted,
        cipherFrequencies: cipherFreq,
        text: String.fromCharCode(...decrypted)
      };
    }
    
    analyze(ciphertext) {
      const frequencies = this.countFrequencies(ciphertext);
      
      // Try Caesar cipher analysis
      const caesarResults = this.tryCaesarShifts(ciphertext);
      
      // Try general substitution analysis
      const substitutionResult = this.analyzeSubstitution(ciphertext);
      
      this.analysisResults = {
        originalText: String.fromCharCode(...ciphertext),
        frequencies: frequencies,
        caesarAnalysis: caesarResults.slice(0, 5), // Top 5 results
        substitutionAnalysis: substitutionResult,
        bestCaesarGuess: caesarResults[0],
        recommendations: this.generateRecommendations(frequencies, caesarResults[0])
      };
      
      return this.analysisResults;
    }
    
    generateRecommendations(frequencies, bestCaesar) {
      const recommendations = [];
      
      // Check if it looks like English
      const eFreq = frequencies.percentages['E'] || 0;
      const tFreq = frequencies.percentages['T'] || 0;
      
      if (eFreq > 10 && tFreq > 7) {
        recommendations.push("High E and T frequencies suggest English plaintext");
      }
      
      if (bestCaesar.chiSquared < 50) {
        recommendations.push(`Caesar cipher likely with shift ${bestCaesar.shift}`);
      } else {
        recommendations.push("May be a more complex substitution cipher");
      }
      
      if (frequencies.totalLetters < 100) {
        recommendations.push("Text too short for reliable frequency analysis");
      }
      
      return recommendations;
    }
    
    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer = [...data];
    }

    // Get the result of the transformation  
    Result() {
      if (!this.inputBuffer || this.inputBuffer.length === 0) {
        return [];
      }
      
      return this.Process(this.inputBuffer, !this.isInverse);
    }

    Process(input, isEncryption = true) {
      // For analysis tool, return analysis results (best guess)
      const analysis = this.analyze(input);
      return analysis.bestCaesarGuess.decrypted;
    }
    
    ClearData() {
      this.analysisResults = null;
    }
  }
  
  // Register the algorithm
  RegisterAlgorithm(new AlKindiFrequency());
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);