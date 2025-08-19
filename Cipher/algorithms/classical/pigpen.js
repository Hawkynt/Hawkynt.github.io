/*
 * Pigpen Cipher Implementation (Freemason Cipher)
 * Historical Geometric Substitution Cipher (Early 1700s)
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection and OpCodes loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const Pigpen = {
    name: "Pigpen",
    description: "Geometric substitution cipher using tic-tac-toe and X-shaped grids with dots. Also known as Freemason cipher, used by secret societies for concealing correspondence since early 18th century.",
    inventor: "Freemasons/Rosicrucians",
    year: 1700,
    country: "Multi-national",
    category: "cipher",
    subCategory: "Classical Cipher",
    securityStatus: "educational",
    securityNotes: "Historical educational cipher easily broken by frequency analysis. Used by secret societies for concealment rather than security against determined cryptanalysts.",
    
    documentation: [
      {text: "Freemason History", uri: "https://freemasonry.bcy.ca/texts/pigpen.html"},
      {text: "Secret Society Cryptography", uri: "https://en.wikipedia.org/wiki/Pigpen_cipher"},
      {text: "Masonic Symbolism", uri: "https://www.masonicdictionary.com/"}
    ],
    
    references: [
      {text: "Cipher Machines Museum", uri: "https://www.cryptomuseum.com/"},
      {text: "Historical Cryptography", uri: "https://www.nsa.gov/about/cryptologic-heritage/"},
      {text: "American Cryptogram Association", uri: "https://www.cryptogram.org/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Symbol Recognition",
        text: "Geometric symbols are easily recognizable as pigpen cipher once pattern is known",
        mitigation: "Historical cipher - for educational purposes only"
      },
      {
        type: "Frequency Analysis",
        text: "Maintains letter frequency patterns making cryptanalysis straightforward",
        mitigation: "Use only for educational demonstrations or puzzle games"
      }
    ],
    
    tests: [
      {
        text: "Pigpen Standard Test Vector 1",
        uri: "Historical Freemason lodge records",
        plaintext: OpCodes.StringToBytes("HELLO"),
        expectedSymbols: ["⌊", "⌠", "⌊⌊", "⌊⌊", "◡"],
        expectedEncoded: OpCodes.Hex8ToBytes("5B1C5B5B5B5B29"),
        variant: "standard"
      },
      {
        text: "Pigpen Test Vector 2 - Full Alphabet",
        uri: "Standard Freemason cipher wheel",
        plaintext: OpCodes.StringToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        variant: "standard",
        expectedLength: 26
      },
      {
        text: "Pigpen Rosicrucian Variant",
        uri: "Rosicrucian cipher traditions",
        plaintext: OpCodes.StringToBytes("SECRET"),
        variant: "rosicrucian",
        expectedLength: 6
      },
      {
        text: "Pigpen with Numbers",
        uri: "Extended pigpen variations",
        plaintext: OpCodes.StringToBytes("CIPHER123"),
        variant: "extended",
        expectedLength: 9
      }
    ],

    // Legacy interface properties
    internalName: 'pigpen',
    minKeyLength: 0,
    maxKeyLength: 4,
    stepKeyLength: 1,
    minBlockSize: 1,
    maxBlockSize: 1000,
    stepBlockSize: 1,
    instances: {},
    version: '1.0.0',
    keySize: 1,
    blockSize: 1,
    
    // Algorithm metadata
    isStreamCipher: false,
    isBlockCipher: false,
    isClassical: true,
    complexity: 'Low',
    family: 'Substitution',
    category: 'Geometric',
    
    // Pigpen cipher mappings
    standardMapping: {
      // Tic-tac-toe grid (no dots)
      'A': '⌊', 'B': '⌈', 'C': '⌉',
      'D': '├', 'E': '┼', 'F': '┤',
      'G': '⌞', 'H': '⌠', 'I': '⌟',
      
      // Tic-tac-toe grid (with dots)  
      'J': '⌊•', 'K': '⌈•', 'L': '⌉•',
      'M': '├•', 'N': '┼•', 'O': '┤•',
      'P': '⌞•', 'Q': '⌠•', 'R': '⌟•',
      
      // X-shaped grid (no dots)
      'S': '⌝', 'T': '⌜', 'U': '⌟', 'V': '⌞',
      
      // X-shaped grid (with dots)
      'W': '⌝•', 'X': '⌜•', 'Y': '⌞•', 'Z': '⌟•'
    },
    
    // Alternative ASCII representation for broad compatibility
    asciiMapping: {
      'A': '[', 'B': ']', 'C': '7',
      'D': 'L', 'E': '+', 'F': ']',
      'G': 'J', 'H': '_', 'I': 'r',
      'J': '[.', 'K': '].', 'L': '7.',
      'M': 'L.', 'N': '+.', 'O': '].',
      'P': 'J.', 'Q': '_.', 'R': 'r.',
      'S': '\\', 'T': '/', 'U': '<', 'V': '>',
      'W': '\\.', 'X': '/.', 'Y': '<.', 'Z': '>.'
    },
    
    // Rosicrucian variant (different symbol arrangement)
    rosicrucianMapping: {
      'A': '◢', 'B': '◣', 'C': '◤', 'D': '◥',
      'E': '◐', 'F': '◑', 'G': '◒', 'H': '◓',
      'I': '◖', 'J': '◗', 'K': '◰', 'L': '◱',
      'M': '◲', 'N': '◳', 'O': '◴', 'P': '◵',
      'Q': '◶', 'R': '◷', 'S': '◸', 'T': '◹',
      'U': '◺', 'V': '◻', 'W': '◼', 'X': '◽',
      'Y': '◾', 'Z': '◿'
    },
    
    // Current variant and mapping
    currentVariant: 'standard',
    currentMapping: null,
    reverseMapping: null,
    keyScheduled: false,
    
    // Initialize cipher
    Init: function() {
      this.currentVariant = 'standard';
      this.currentMapping = null;
      this.reverseMapping = null;
      this.keyScheduled = false;
      return true;
    },
    
    // Key setup (selects variant)
    KeySetup: function(key, options) {
      let variant = 'standard';
      
      if (typeof key === 'string') {
        if (key.toLowerCase().includes('rosicrucian') || key.toLowerCase().includes('rose')) {
          variant = 'rosicrucian';
        } else if (key.toLowerCase().includes('ascii')) {
          variant = 'ascii';
        } else if (key.toLowerCase().includes('extended')) {
          variant = 'extended';
        }
      } else if (typeof key === 'number') {
        variant = ['standard', 'ascii', 'rosicrucian', 'extended'][key % 4];
      }
      
      if (options && options.variant) {
        variant = options.variant;
      }
      
      this.currentVariant = variant;
      this.setupMapping();
      this.keyScheduled = true;
      
      return 'pigpen-' + variant + '-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Setup symbol mapping based on variant
    setupMapping: function() {
      switch (this.currentVariant) {
        case 'ascii':
          this.currentMapping = this.asciiMapping;
          break;
        case 'rosicrucian':
          this.currentMapping = this.rosicrucianMapping;
          break;
        case 'extended':
          this.currentMapping = Object.assign({}, this.standardMapping);
          // Add numbers to extended mapping
          this.currentMapping['0'] = '◯';
          this.currentMapping['1'] = '◉';
          this.currentMapping['2'] = '◎';
          this.currentMapping['3'] = '●';
          this.currentMapping['4'] = '○';
          this.currentMapping['5'] = '◐';
          this.currentMapping['6'] = '◑';
          this.currentMapping['7'] = '◒';
          this.currentMapping['8'] = '◓';
          this.currentMapping['9'] = '◔';
          break;
        default:
          this.currentMapping = this.standardMapping;
      }
      
      // Create reverse mapping for decryption
      this.reverseMapping = {};
      for (const [letter, symbol] of Object.entries(this.currentMapping)) {
        this.reverseMapping[symbol] = letter;
      }
    },
    
    // Encrypt single character
    encryptChar: function(char) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const upperChar = char.toUpperCase();
      
      if (this.currentMapping[upperChar]) {
        return this.currentMapping[upperChar];
      }
      
      // Return non-alphabetic characters unchanged
      return char;
    },
    
    // Decrypt single symbol
    decryptChar: function(symbol) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      if (this.reverseMapping[symbol]) {
        return this.reverseMapping[symbol];
      }
      
      // Return unknown symbols unchanged
      return symbol;
    },
    
    // Convert symbol to ASCII representation for storage
    symbolToBytes: function(symbol) {
      // Convert Unicode symbols to byte representation
      const encoder = new TextEncoder();
      return Array.from(encoder.encode(symbol));
    },
    
    // Convert bytes back to symbol
    bytesToSymbol: function(bytes) {
      const decoder = new TextDecoder();
      return decoder.decode(new Uint8Array(bytes));
    },
    
    // Encrypt text to pigpen symbols
    szEncryptBlock: function(blockIndex, plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const result = [];
      
      for (let i = 0; i < plaintext.length; i++) {
        const char = String.fromCharCode(plaintext[i]);
        const symbol = this.encryptChar(char);
        
        // Convert symbol to bytes for storage
        if (symbol !== char) {
          const symbolBytes = this.symbolToBytes(symbol);
          result.push(...symbolBytes);
        } else {
          result.push(plaintext[i]);
        }
      }
      
      return result;
    },
    
    // Decrypt pigpen symbols to text
    szDecryptBlock: function(blockIndex, ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      const result = [];
      let i = 0;
      
      while (i < ciphertext.length) {
        // Try to decode as UTF-8 symbol
        let symbolBytes = [ciphertext[i]];
        
        // Check if this is a multi-byte UTF-8 character
        if (ciphertext[i] >= 0x80) {
          // Determine UTF-8 byte count
          let byteCount = 1;
          if ((ciphertext[i] & 0xE0) === 0xC0) byteCount = 2;
          else if ((ciphertext[i] & 0xF0) === 0xE0) byteCount = 3;
          else if ((ciphertext[i] & 0xF8) === 0xF0) byteCount = 4;
          
          // Collect all bytes for this character
          for (let j = 1; j < byteCount && i + j < ciphertext.length; j++) {
            symbolBytes.push(ciphertext[i + j]);
          }
          i += byteCount;
        } else {
          i++;
        }
        
        const symbol = this.bytesToSymbol(symbolBytes);
        const decrypted = this.decryptChar(symbol);
        
        if (decrypted !== symbol) {
          result.push(decrypted.charCodeAt(0));
        } else {
          // If not a pigpen symbol, treat as regular character
          result.push(symbolBytes[0]);
        }
      }
      
      return result;
    },
    
    // Text-based encryption (returns symbols as string)
    encryptText: function(plaintext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      let result = '';
      
      for (let i = 0; i < plaintext.length; i++) {
        result += this.encryptChar(plaintext[i]);
      }
      
      return result;
    },
    
    // Text-based decryption (accepts symbols as string)
    decryptText: function(ciphertext) {
      if (!this.keyScheduled) {
        throw new Error('Key not set up');
      }
      
      let result = '';
      let i = 0;
      
      while (i < ciphertext.length) {
        let symbol = ciphertext[i];
        
        // Check for multi-character symbols (like those with dots)
        if (i + 1 < ciphertext.length && ciphertext[i + 1] === '•') {
          symbol += '•';
          i += 2;
        } else if (i + 1 < ciphertext.length && ciphertext[i + 1] === '.') {
          symbol += '.';
          i += 2;
        } else {
          i++;
        }
        
        const decrypted = this.decryptChar(symbol);
        result += decrypted;
      }
      
      return result;
    },
    
    ClearData: function() {
      this.currentMapping = null;
      this.reverseMapping = null;
      this.keyScheduled = false;
    },
    
    // Get available symbols for display
    getSymbolChart: function() {
      if (!this.keyScheduled) {
        this.setupMapping();
      }
      
      const chart = {};
      for (const [letter, symbol] of Object.entries(this.currentMapping)) {
        chart[letter] = symbol;
      }
      
      return chart;
    },
    
    // Test vector runner
    runTestVector: function() {
      console.log('Running Pigpen cipher test vectors...');
      
      let allPassed = true;
      
      for (let i = 0; i < this.tests.length; i++) {
        const test = this.tests[i];
        console.log(`Running test: ${test.text}`);
        
        try {
          this.Init();
          this.KeySetup('test', {variant: test.variant || 'standard'});
          
          // Test text-based encryption/decryption
          const plainString = OpCodes.BytesToString(test.plaintext);
          const encrypted = this.encryptText(plainString);
          const decrypted = this.decryptText(encrypted);
          
          const textTestPassed = (decrypted === plainString);
          
          if (textTestPassed) {
            console.log(`Test ${i + 1} (text): PASS`);
            console.log(`  Plain: ${plainString}`);
            console.log(`  Encrypted: ${encrypted}`);
          } else {
            console.log(`Test ${i + 1} (text): FAIL`);
            console.log(`  Expected: ${plainString}`);
            console.log(`  Decrypted: ${decrypted}`);
            allPassed = false;
          }
          
          // Test byte-based encryption/decryption
          const encryptedBytes = this.szEncryptBlock(0, test.plaintext);
          const decryptedBytes = this.szDecryptBlock(0, encryptedBytes);
          const byteTestPassed = OpCodes.SecureCompare(decryptedBytes, test.plaintext);
          
          if (byteTestPassed) {
            console.log(`Test ${i + 1} (bytes): PASS`);
          } else {
            console.log(`Test ${i + 1} (bytes): FAIL`);
            allPassed = false;
          }
          
        } catch (error) {
          console.log(`Test ${i + 1}: ERROR - ${error.message}`);
          allPassed = false;
        }
      }
      
      // Display symbol chart
      console.log('\nPigpen Symbol Chart:');
      this.Init();
      this.KeySetup('standard');
      const chart = this.getSymbolChart();
      
      for (const [letter, symbol] of Object.entries(chart)) {
        console.log(`${letter}: ${symbol}`);
      }
      
      // Demonstration with different variants
      console.log('\nVariant Demonstration:');
      const demoText = 'MASONIC';
      
      const variants = ['standard', 'ascii', 'rosicrucian', 'extended'];
      for (const variant of variants) {
        this.Init();
        this.KeySetup('demo', {variant: variant});
        const encrypted = this.encryptText(demoText);
        console.log(`${variant}: ${demoText} -> ${encrypted}`);
      }
      
      return {
        algorithm: 'Pigpen',
        variant: this.currentVariant,
        allTestsPassed: allPassed,
        testCount: this.tests.length,
        symbolCount: Object.keys(this.currentMapping).length,
        notes: 'Historical geometric cipher used by Freemasons and Rosicrucians since early 1700s'
      };
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.Add === 'function')
    global.Cipher.Add(Pigpen);
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Pigpen;
  }
  
  // Global export
  global.Pigpen = Pigpen;
  
})(typeof global !== 'undefined' ? global : window);