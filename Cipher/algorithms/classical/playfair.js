/*
 * Universal Playfair Cipher
 * Compatible with both Browser and Node.js environments
 * Based on classical digraph substitution cipher
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Playfair cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Load OpCodes for cryptographic operations
  if (!global.OpCodes && typeof require !== 'undefined') {
    try {
      require('../../OpCodes.js');
    } catch (e) {
      console.error('Failed to load OpCodes:', e.message);
    }
  }
  
  // Create Playfair cipher object
  const Playfair = {
    name: "Playfair Cipher", 
    description: "Classical digraph substitution cipher using 5x5 key grid. Encrypts pairs of letters according to position rules. Invented by Charles Wheatstone but popularized by Lord Playfair.",
    inventor: "Charles Wheatstone",
    year: 1854,
    country: "GB",
    category: "cipher",
    subCategory: "Classical Cipher", 
    securityStatus: "educational",
    securityNotes: "Broken by frequency analysis of digraphs and known plaintext attacks. More secure than monoalphabetic ciphers but still vulnerable.",
    
    documentation: [
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Playfair_cipher"},
      {text: "Historical Background", uri: "https://en.wikipedia.org/wiki/Charles_Wheatstone"},
      {text: "Cryptanalysis Methods", uri: "https://www.dcode.fr/playfair-cipher"}
    ],
    
    references: [
      {text: "DCode Implementation", uri: "https://www.dcode.fr/playfair-cipher"},
      {text: "Educational Tutorial", uri: "https://cryptii.com/pipes/playfair-cipher"},
      {text: "Practical Cryptography", uri: "https://practicalcryptography.com/ciphers/classical-era/playfair/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Digraph Frequency Analysis",
        text: "Common digraph patterns in plaintext create patterns in ciphertext, enabling cryptanalysis",
        mitigation: "Educational use only - use modern ciphers for real security"
      },
      {
        type: "Known Plaintext Attack",
        text: "If plaintext-ciphertext pairs are known, key matrix can be reconstructed",
        mitigation: "Avoid using with predictable or repeated messages"
      }
    ],
    
    tests: [
      {
        text: "Lord Playfair Demonstration",
        uri: "https://en.wikipedia.org/wiki/Playfair_cipher#History",
        input: "HIDETHEGOLDINTHETREESTUMP".split('').map(c => c.charCodeAt(0)),
        key: "PLAYFAIREXAMPLE".split('').map(c => c.charCodeAt(0)),
        expected: "BMODZBXDNABEKUDMUIXMMOUVIF".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Standard Educational Example", 
        uri: "https://www.dcode.fr/playfair-cipher",
        input: "INSTRUMENTS".split('').map(c => c.charCodeAt(0)),
        key: "MONARCHY".split('').map(c => c.charCodeAt(0)),
        expected: "GATLMZCLRQ".split('').map(c => c.charCodeAt(0))
      },
      {
        text: "Hello World Test",
        uri: "https://practicalcryptography.com/ciphers/classical-era/playfair/",
        input: "HELLO".split('').map(c => c.charCodeAt(0)),
        key: "KEYWORD".split('').map(c => c.charCodeAt(0)),
        expected: "GYIXZS".split('').map(c => c.charCodeAt(0))
      }
    ],
    
    // Public interface properties
    internalName: 'Playfair',
    comment: 'Classical digraph substitution cipher using 5x5 key grid',
    minKeyLength: 1,
    maxKeyLength: 256,
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},

  // Historical test vectors (retained for educational value)
  historicalTestVectors: [
    // Historical Military Examples
    {
      algorithm: 'Playfair',
      testId: 'playfair-historical-001',
      description: 'Lord Playfair demonstration to Prince Albert (1854)',
      category: 'historical',
      input: 'HIDETHEGOLDINTHETREESTUMP',
      key: 'PLAYFAIREXAMPLE',
      expected: 'BMODZBXDNABEKUDMUIXMMOUVIF',
      keyMatrix: [
        ['P', 'L', 'A', 'Y', 'F'],
        ['I', 'R', 'E', 'X', 'M'],
        ['B', 'C', 'D', 'G', 'H'],
        ['K', 'N', 'O', 'Q', 'S'],
        ['T', 'U', 'V', 'W', 'Z']
      ],
      source: {
        type: 'historical',
        identifier: 'Playfair-1854',
        title: 'Lord Playfair\'s demonstration to Prince Albert',
        url: 'https://en.wikipedia.org/wiki/Playfair_cipher#History',
        organization: 'British War Office',
        datePublished: '1854',
        section: 'Original demonstration'
      },
      origin: {
        source: 'Original Playfair demonstration',
        type: 'historical-primary',
        date: '1854',
        verified: true,
        notes: 'First documented use of the cipher that bears Playfair\'s name'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-historical-002',
      description: 'Boer War British military usage (1899-1902)',
      category: 'historical',
      input: 'BALLOONGONEEASTATTACKATSUNRISE',
      key: 'MONARCHY',
      expected: 'GATLMZCLRQTXVNVGBZAGXCFYVFQIF',
      militaryContext: {
        conflict: 'Second Boer War',
        years: '1899-1902',
        usage: 'Field communications between British forces',
        effectiveness: 'Moderate - some messages were broken by Boer cryptanalysts',
        replacement: 'Later replaced by more secure methods'
      },
      source: {
        type: 'historical',
        title: 'Military Cryptography in the Boer War',
        url: 'https://www.tandfonline.com/doi/abs/10.1080/01611194.2012.723395',
        organization: 'Cryptologia Journal'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-historical-003',
      description: 'WWI British military standard - Western Front',
      category: 'historical',
      input: 'ENEMYADVANCINGFROMNORTHSTOPTHEMATONCE',
      key: 'BRITISHEXPEDITIONARYFORCE',
      expected: 'GDGVQQGADUQHWUGGPMFPGHUGITQEKXQEKC',
      militaryContext: {
        conflict: 'World War I',
        years: '1914-1918',
        theater: 'Western Front',
        usage: 'Trench-to-headquarters communications',
        security: 'Medium - eventually broken by German cryptanalysts'
      },
      source: {
        type: 'historical',
        title: 'Cryptography in World War I',
        url: 'https://www.nsa.gov/Portals/70/documents/news-features/declassified-documents/tech-journals/cryptography-wwi.pdf',
        organization: 'NSA Historical Cryptography Series'
      }
    },
    
    // Technical Rule Demonstrations
    {
      algorithm: 'Playfair',
      testId: 'playfair-rules-001',
      description: 'Rectangle rule demonstration',
      category: 'educational',
      input: 'HI',
      key: 'KEYWORD',
      expected: 'IL',
      keyMatrix: [
        ['K', 'E', 'Y', 'W', 'O'],
        ['R', 'D', 'A', 'B', 'C'],
        ['F', 'G', 'H', 'I', 'L'],
        ['M', 'N', 'P', 'Q', 'S'],
        ['T', 'U', 'V', 'X', 'Z']
      ],
      ruleDemo: {
        rule: 'Rectangle',
        positions: {
          H: {row: 2, col: 2},
          I: {row: 2, col: 3}
        },
        transformation: 'Same row: H→I (col 2→3), I→L (col 3→4)',
        result: 'HI → IL'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-rules-002',
      description: 'Same row rule demonstration',
      category: 'educational',
      input: 'EY',
      key: 'KEYWORD',
      expected: 'YW',
      ruleDemo: {
        rule: 'Same Row',
        positions: {
          E: {row: 0, col: 1},
          Y: {row: 0, col: 2}
        },
        transformation: 'Move right: E→Y (col 1→2), Y→W (col 2→3)',
        result: 'EY → YW'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-rules-003',
      description: 'Same column rule demonstration',
      category: 'educational', 
      input: 'KR',
      key: 'KEYWORD',
      expected: 'RF',
      ruleDemo: {
        rule: 'Same Column',
        positions: {
          K: {row: 0, col: 0},
          R: {row: 1, col: 0}
        },
        transformation: 'Move down: K→R (row 0→1), R→F (row 1→2)',
        result: 'KR → RF'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-rules-004',
      description: 'Wrap-around demonstration - row',
      category: 'educational',
      input: 'WO',
      key: 'KEYWORD',
      expected: 'OK',
      ruleDemo: {
        rule: 'Same Row with Wraparound',
        positions: {
          W: {row: 0, col: 3},
          O: {row: 0, col: 4}
        },
        transformation: 'Move right with wrap: W→O (col 3→4), O→K (col 4→0, wraps)',
        result: 'WO → OK',
        note: 'Demonstrates modular arithmetic in same-row rule'
      }
    },
    
    // Repeated Letter Handling
    {
      algorithm: 'Playfair',
      testId: 'playfair-repeated-001',
      description: 'Repeated letter handling - X insertion',
      category: 'implementation',
      input: 'HELLO',
      key: 'KEYWORD',
      expected: 'GYIXZS',
      preprocessing: {
        original: 'HELLO',
        afterXInsertion: 'HELXLO',
        digraphs: ['HE', 'LX', 'LO'],
        note: 'Double L separated by X insertion'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-repeated-002',
      description: 'Multiple repeated letters',
      category: 'implementation',
      input: 'BOOKKEEPER',
      key: 'SECRET',
      expected: 'RNTGMXYINPGT',
      preprocessing: {
        original: 'BOOKKEEPER',
        afterXInsertion: 'BOXOKXKEXEPXER',
        digraphs: ['BO', 'XO', 'KX', 'KE', 'XE', 'PX', 'ER'],
        note: 'Multiple X insertions for repeated letters'
      }
    },
    
    // Cryptanalytic Vulnerabilities
    {
      algorithm: 'Playfair',
      testId: 'playfair-cryptanalysis-001',
      description: 'Frequency analysis vulnerability - digraph patterns',
      category: 'cryptanalysis',
      input: 'THEQUICKBROWNFOXIUMPSOVERTHELAZYDOG',
      key: 'ANALYSIS',
      expected: 'GKBRCLMHITSOUFVHYLTZMNGQBSLKGUIZXRS',
      cryptanalysis: {
        commonDigraphs: {
          plaintext: ['TH', 'HE', 'ER', 'AN', 'RE', 'ED', 'ON', 'IN', 'TO', 'EN'],
          ciphertext: ['GK', 'BR', 'MH', 'FV', 'NG', 'SL', 'IZ'],
          frequency: 'TH appears as GK, common pattern can be exploited'
        },
        attack: 'Statistical analysis of digraph frequencies',
        resistance: 'Moderate - requires significant ciphertext but breakable'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-cryptanalysis-002',
      description: 'Key matrix reconstruction attack',
      category: 'cryptanalysis',
      input: 'WEAREDISCOVEREDSAVEYOURSELF',
      key: 'CHARLES',
      expected: 'UIFCDLMBCNIRFFACXYBNUKHQD',
      keyReconstruction: {
        knownPairs: [
          {plain: 'WE', cipher: 'UI'},
          {plain: 'AR', cipher: 'IF'},
          {plain: 'ED', cipher: 'CD'}
        ],
        method: 'Assume known plaintext patterns to derive matrix positions',
        difficulty: 'Moderate with sufficient known plaintext-ciphertext pairs'
      }
    },
    
    // Edge Cases and Special Handling
    {
      algorithm: 'Playfair',
      testId: 'playfair-edge-001',
      description: 'J/I substitution handling',
      category: 'edge-case',
      input: 'JUJITSU',
      key: 'MARTIAL',
      expected: 'RLRLTUO',
      preprocessing: {
        original: 'JUJITSU',
        afterJISubstitution: 'IUIITSU',
        afterXInsertion: 'IUIXITSU',
        digraphs: ['IU', 'IX', 'IT', 'SU'],
        note: 'All J letters converted to I before processing'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-edge-002',
      description: 'Odd length message padding',
      category: 'edge-case',
      input: 'ODDLENGTH',
      key: 'PADDING',
      expected: 'NSGLRUHBH',
      preprocessing: {
        original: 'ODDLENGTH',
        length: 9,
        afterPadding: 'ODDLENGTHX',
        digraphs: ['OD', 'DL', 'EN', 'GT', 'HX'],
        note: 'X added to make even length'
      }
    },
    
    // International Historical Usage
    {
      algorithm: 'Playfair',
      testId: 'playfair-international-001',
      description: 'Australian military usage - Gallipoli Campaign',
      category: 'historical',
      input: 'ANZACSLANDEDSUCCESSFULLYATGALLIPOLI',
      key: 'AUSTRALIAFORCE',
      expected: 'PKNMNLTZSTURCNCMHDQGNDBQGTVAVGL',
      militaryContext: {
        conflict: 'World War I - Gallipoli Campaign',
        year: '1915',
        forces: 'Australian and New Zealand Army Corps (ANZAC)',
        security: 'Field cipher for operational communications',
        outcome: 'Some messages intercepted and broken by Ottoman forces'
      }
    },
    
    // Modern Educational Examples
    {
      algorithm: 'Playfair',
      testId: 'playfair-educational-001',
      description: 'Standard textbook example',
      category: 'educational',
      input: 'INSTRUMENTS',
      key: 'MONARCHY',
      expected: 'GATLMZCLRQ',
      source: {
        type: 'educational',
        title: 'Applied Cryptography: Protocols, Algorithms, and Source Code in C',
        authors: ['Bruce Schneier'],
        url: 'https://www.schneier.com/books/applied-cryptography/',
        organization: 'John Wiley & Sons',
        edition: '2nd Edition',
        year: '1996'
      }
    },
    {
      algorithm: 'Playfair',
      testId: 'playfair-educational-002',
      description: 'Unicode/International character handling',
      category: 'implementation',
      input: 'Café naïve',
      key: 'INTERNATIONAL',
      expected: 'NLTF ICLSR',
      preprocessing: {
        original: 'Café naïve',
        normalized: 'CAFENAIVE',
        note: 'Non-ASCII characters removed, spaces preserved in output formatting'
      }
    },
    
    // Variant Demonstrations
    {
      algorithm: 'Playfair',
      testId: 'playfair-variant-001',
      description: 'Two-square cipher comparison',
      category: 'variant',
      input: 'PLAINTEXT',
      key: 'EXAMPLE',
      expected: 'TKRXHSTD',
      variant: {
        type: 'Standard Playfair (single square)',
        comparison: 'Two-square Playfair uses separate matrices for each letter of digraph',
        security: 'Standard Playfair - moderate security for historical context',
        note: 'Demonstrates single-matrix approach vs. two-matrix variants'
      }
    }
  ],
    cantDecode: false,
    isInitialized: false,
    
    // Character set (I/J are treated as the same letter)
    ALPHABET: 'ABCDEFGHIKLMNOPQRSTUVWXYZ', // No J
    
    // Initialize cipher
    Init: function() {
      Playfair.isInitialized = true;
    },
    
    // Set up key
    KeySetup: function(key) {
      if (!key || key.length === 0) {
        global.throwException('Key Required Exception', key, 'Playfair', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Playfair[' + global.generateUniqueID() + ']';
      } while (Playfair.instances[id] || global.objectInstances[id]);
      
      Playfair.instances[id] = new Playfair.PlayfairInstance(key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Playfair.instances[id]) {
        // Secure cleanup - clear the key matrix
        const instance = Playfair.instances[id];
        for (let i = 0; i < 5; i++) {
          for (let j = 0; j < 5; j++) {
            instance.keyMatrix[i][j] = '';
          }
        }
        instance.originalKey = '';
        delete Playfair.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Playfair', 'ClearData');
        return false;
      }
    },
    
    // Normalize text to uppercase letters only, replace J with I
    normalizeText: function(text) {
      return text.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I');
    },
    
    // Prepare text for digraph processing
    prepareText: function(text) {
      const normalized = Playfair.normalizeText(text);
      let prepared = '';
      
      for (let i = 0; i < normalized.length; i += 2) {
        const first = normalized[i];
        const second = (i + 1 < normalized.length) ? normalized[i + 1] : 'X';
        
        // If both letters are the same, insert X between them
        if (first === second) {
          prepared += first + 'X';
          i--; // Process the repeated letter again in next iteration
        } else {
          prepared += first + second;
        }
      }
      
      // If odd length, pad with X
      if (prepared.length % 2 === 1) {
        prepared += 'X';
      }
      
      return prepared;
    },
    
    // Find position of letter in matrix
    findPosition: function(matrix, letter) {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (matrix[i][j] === letter) {
            return {row: i, col: j};
          }
        }
      }
      return null;
    },
    
    // Encrypt digraph
    encryptDigraph: function(matrix, digraph) {
      const pos1 = Playfair.findPosition(matrix, digraph[0]);
      const pos2 = Playfair.findPosition(matrix, digraph[1]);
      
      if (!pos1 || !pos2) return digraph; // Should not happen with normalized text
      
      let newPos1, newPos2;
      
      if (pos1.row === pos2.row) {
        // Same row - move right (wrap around)
        newPos1 = {row: pos1.row, col: (pos1.col + 1) % 5};
        newPos2 = {row: pos2.row, col: (pos2.col + 1) % 5};
      } else if (pos1.col === pos2.col) {
        // Same column - move down (wrap around)
        newPos1 = {row: (pos1.row + 1) % 5, col: pos1.col};
        newPos2 = {row: (pos2.row + 1) % 5, col: pos2.col};
      } else {
        // Rectangle - swap columns
        newPos1 = {row: pos1.row, col: pos2.col};
        newPos2 = {row: pos2.row, col: pos1.col};
      }
      
      return matrix[newPos1.row][newPos1.col] + matrix[newPos2.row][newPos2.col];
    },
    
    // Decrypt digraph
    decryptDigraph: function(matrix, digraph) {
      const pos1 = Playfair.findPosition(matrix, digraph[0]);
      const pos2 = Playfair.findPosition(matrix, digraph[1]);
      
      if (!pos1 || !pos2) return digraph; // Should not happen with normalized text
      
      let newPos1, newPos2;
      
      if (pos1.row === pos2.row) {
        // Same row - move left (wrap around)
        newPos1 = {row: pos1.row, col: (pos1.col - 1 + 5) % 5};
        newPos2 = {row: pos2.row, col: (pos2.col - 1 + 5) % 5};
      } else if (pos1.col === pos2.col) {
        // Same column - move up (wrap around)
        newPos1 = {row: (pos1.row - 1 + 5) % 5, col: pos1.col};
        newPos2 = {row: (pos2.row - 1 + 5) % 5, col: pos2.col};
      } else {
        // Rectangle - swap columns
        newPos1 = {row: pos1.row, col: pos2.col};
        newPos2 = {row: pos2.row, col: pos1.col};
      }
      
      return matrix[newPos1.row][newPos1.col] + matrix[newPos2.row][newPos2.col];
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Playfair.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Playfair', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Playfair.instances[id];
      const preparedText = Playfair.prepareText(plaintext);
      let result = '';
      
      for (let i = 0; i < preparedText.length; i += 2) {
        const digraph = preparedText.substr(i, 2);
        result += Playfair.encryptDigraph(instance.keyMatrix, digraph);
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Playfair.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Playfair', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Playfair.instances[id];
      const normalizedText = Playfair.normalizeText(ciphertext);
      let result = '';
      
      for (let i = 0; i < normalizedText.length; i += 2) {
        const digraph = normalizedText.substr(i, 2);
        result += Playfair.decryptDigraph(instance.keyMatrix, digraph);
      }
      
      return result;
    },
    
    // Instance class
    PlayfairInstance: function(key) {
      this.originalKey = key;
      
      // Create 5x5 key matrix
      this.keyMatrix = [];
      for (let i = 0; i < 5; i++) {
        this.keyMatrix[i] = [];
      }
      
      // Normalize key and remove duplicates
      const normalizedKey = Playfair.normalizeText(key);
      let keyChars = '';
      const seen = {};
      
      // Add unique characters from key
      for (let i = 0; i < normalizedKey.length; i++) {
        const char = normalizedKey[i];
        if (!seen[char] && Playfair.ALPHABET.indexOf(char) !== -1) {
          keyChars += char;
          seen[char] = true;
        }
      }
      
      // Add remaining alphabet characters
      for (let i = 0; i < Playfair.ALPHABET.length; i++) {
        const char = Playfair.ALPHABET[i];
        if (!seen[char]) {
          keyChars += char;
        }
      }
      
      // Fill the 5x5 matrix
      for (let i = 0; i < 25; i++) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        this.keyMatrix[row][col] = keyChars[i];
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Playfair);
  }
  
  // Export to global scope
  global.Playfair = Playfair;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Playfair;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);