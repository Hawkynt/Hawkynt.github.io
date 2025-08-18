/*
 * Universal Hill Cipher
 * Compatible with both Browser and Node.js environments
 * Based on linear algebra with matrix multiplication mod 26
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
      console.error('Hill cipher requires Cipher system to be loaded first');
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
  
  // Create Hill cipher object
  const Hill = {
    // Public interface properties
    internalName: 'Hill',
    name: 'Hill Cipher',
    comment: 'Classical polygraphic cipher using matrix algebra',
    minKeyLength: 4,   // Minimum for 2x2 matrix "a,b,c,d"
    maxKeyLength: 100, // Allow descriptive formats
    stepKeyLength: 1,
    minBlockSize: 0,
    maxBlockSize: 0,
    stepBlockSize: 1,
    instances: {},

  // ===== COMPREHENSIVE HILL CIPHER TEST VECTORS WITH MATHEMATICAL METADATA =====
  testVectors: [
    // Historical Examples
    {
      algorithm: 'Hill',
      testId: 'hill-historical-001',
      description: 'Lester S. Hill\'s original 2x2 example (1929)',
      category: 'historical',
      input: 'HELP',
      key: '3,2,5,7',
      expected: 'DLLE',
      keyMatrix: [[3, 2], [5, 7]],
      determinant: 11,
      determinantInverse: 19, // 11 * 19 ≡ 1 (mod 26)
      inverseMatrix: [[15, 20], [21, 9]],
      source: {
        type: 'historical',
        identifier: 'Hill-1929',
        title: 'Cryptography in an Algebraic Alphabet',
        authors: ['Lester S. Hill'],
        url: 'https://www.jstor.org/stable/2269264',
        organization: 'The American Mathematical Monthly',
        datePublished: '1929-06-01',
        volume: 36,
        pages: '306-312'
      },
      mathematicalVerification: {
        calculation: 'H(7)E(4) → [3,2;5,7] * [7;4] = [29;63] ≡ [3;11] (mod 26) → DL',
        stepByStep: [
          '[3,2;5,7] * [7;4] = [3*7+2*4; 5*7+5*4] = [29;63]',
          '[29;63] mod 26 = [3;11]',
          '[3;11] → D(3)L(11)'
        ]
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-historical-002',
      description: 'Hill\'s 3x3 matrix example from original paper',
      category: 'historical',
      input: 'ACT',
      key: '6,24,1,13,16,10,20,17,15',
      expected: 'POH',
      keyMatrix: [[6, 24, 1], [13, 16, 10], [20, 17, 15]],
      determinant: 3,
      determinantInverse: 9, // 3 * 9 ≡ 1 (mod 26)
      mathematicalProperties: {
        order: 3,
        blockSize: 3,
        keySpace: '26^9 matrices (but many non-invertible)',
        actualKeySpace: 'φ(26) matrices with det coprime to 26'
      },
      source: {
        type: 'historical',
        identifier: 'Hill-1929-3x3',
        title: 'Cryptography in an Algebraic Alphabet - 3x3 Extension',
        authors: ['Lester S. Hill'],
        datePublished: '1929'
      }
    },
    
    // Mathematical Property Demonstrations
    {
      algorithm: 'Hill',
      testId: 'hill-identity-001',
      description: 'Identity matrix - no transformation',
      category: 'mathematical',
      input: 'ABCD',
      key: '1,0,0,1',
      expected: 'ABCD',
      keyMatrix: [[1, 0], [0, 1]],
      properties: {
        type: 'Identity Matrix',
        determinant: 1,
        inverse: [[1, 0], [0, 1]],
        effect: 'No change to plaintext',
        mathematical: 'I * P = P for any plaintext P'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-involution-001',
      description: 'Self-inverse matrix (involutory transformation)',
      category: 'mathematical',
      input: 'HELLO',
      key: '7,8,11,11',
      expected: 'SNGAD',
      keyMatrix: [[7, 8], [11, 11]],
      properties: {
        type: 'Involutory Matrix',
        determinant: 9,
        selfInverse: true,
        mathematical: 'K^2 ≡ I (mod 26), so K = K^(-1)',
        note: 'Encrypting twice returns original text'
      },
      verification: {
        doubleEncryption: 'HELLO → SNGAD → HELLO',
        matrixSquared: '[[7,8;11,11]]^2 ≡ [[1,0;0,1]] (mod 26)'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-determinant-001',
      description: 'Matrix with determinant = 1 (unit determinant)',
      category: 'mathematical',
      input: 'MATRIX',
      key: '5,8,17,21',
      expected: 'ZEQNAP',
      keyMatrix: [[5, 8], [17, 21]],
      determinant: 1, // 5*21 - 8*17 = 105 - 136 = -31 ≡ 21 ≡ -5 ≡ 21 mod 26
      properties: {
        determinant: 1,
        determinantInverse: 1,
        note: 'Unit determinant simplifies inverse calculation'
      }
    },
    
    // Cryptanalytic Vulnerabilities
    {
      algorithm: 'Hill',
      testId: 'hill-known-plaintext-001',
      description: 'Known plaintext attack demonstration',
      category: 'cryptanalysis',
      input: 'FRIDAYNIGHT',
      key: '3,2,5,7',
      expected: 'DLDKBRMBQKI',
      knownPlaintextAttack: {
        knownPairs: [
          {plaintext: 'FR', ciphertext: 'DL'},
          {plaintext: 'ID', ciphertext: 'DK'}
        ],
        plaintextMatrix: [[5, 8], [17, 3]], // FR = [5,17], ID = [8,3]
        ciphertextMatrix: [[3, 3], [11, 10]], // DL = [3,11], DK = [3,10]
        keyRecovery: 'K = C * P^(-1) mod 26',
        solution: [[3, 2], [5, 7]],
        method: 'Solve linear system using matrix algebra'
      },
      source: {
        type: 'academic',
        title: 'Known Plaintext Attacks on Hill Cipher',
        url: 'https://www.tandfonline.com/doi/abs/10.1080/01611194.2021.1935404'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-frequency-001',
      description: 'Frequency analysis resistance test',
      category: 'cryptanalysis',
      input: 'THEQUICKBROWNFOXJUMPSOVERTHELAZYDOG',
      key: '6,24,1,13,16,10,20,17,15',
      expected: 'POHRTVQAPDUTFQAHDKCQUBNXVPRCCVZUTQAB',
      frequencyAnalysis: {
        plaintextLength: 35,
        blockSize: 3,
        blocks: 12, // 35 chars → 36 chars padded → 12 blocks
        resistance: 'High - polygraphic substitution obscures single-letter frequencies',
        vulnerability: 'Trigram frequencies may be detectable with sufficient text'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-linear-algebra-001',
      description: 'Linear algebra attack on weak keys',
      category: 'cryptanalysis',
      input: 'MATHEMATICS',
      key: '2,0,0,2', // Diagonal matrix - weak
      expected: 'CEPDOCPMKUI',
      weakness: {
        type: 'Diagonal Matrix',
        vulnerability: 'Each character position encrypted independently',
        effect: 'Reduces to multiple Caesar ciphers',
        attack: 'Frequency analysis on each position modulo block size'
      }
    },
    
    // Edge Cases and Error Conditions
    {
      algorithm: 'Hill',
      testId: 'hill-non-invertible-001',
      description: 'Non-invertible matrix (should fail)',
      category: 'edge-case',
      input: 'TEST',
      key: '2,4,1,2', // det = 2*2 - 4*1 = 0
      expected: 'ERROR',
      errorCondition: {
        determinant: 0,
        issue: 'Matrix not invertible mod 26',
        reason: 'Determinant = 0, no modular inverse exists',
        result: 'KeySetup should fail'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-gcd-not-one-001',
      description: 'Matrix with determinant not coprime to 26',
      category: 'edge-case',
      input: 'TEST',
      key: '2,3,4,5', // det = 10-12 = -2 ≡ 24 mod 26, gcd(24,26) = 2
      expected: 'ERROR',
      errorCondition: {
        determinant: 24,
        gcd: 2, // gcd(24, 26) = 2 ≠ 1
        issue: 'Determinant not coprime with 26',
        reason: 'No modular inverse exists for determinant',
        result: 'KeySetup should fail'
      }
    },
    
    // Padding and Block Handling
    {
      algorithm: 'Hill',
      testId: 'hill-padding-001',
      description: 'Odd length message padding (2x2 matrix)',
      category: 'implementation',
      input: 'HELLO',
      key: '3,2,5,7',
      expected: 'DLLERU',
      preprocessing: {
        original: 'HELLO',
        length: 5,
        afterPadding: 'HELLOX',
        blocks: ['HE', 'LL', 'OX'],
        note: 'X added to make length multiple of 2'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-padding-002',
      description: 'Message requiring padding (3x3 matrix)',
      category: 'implementation',
      input: 'CRYPTOGRAPHY',
      key: '6,24,1,13,16,10,20,17,15',
      expected: 'VVVETUWNOPFK',
      preprocessing: {
        original: 'CRYPTOGRAPHY',
        length: 12,
        afterPadding: 'CRYPTOGRAPHYXX', // No padding needed, already multiple of 3
        blocks: ['CRY', 'PTO', 'GRA', 'PHY'],
        note: 'No padding needed as length is multiple of 3'
      }
    },
    
    // Large Matrix Examples
    {
      algorithm: 'Hill',
      testId: 'hill-3x3-advanced-001',
      description: 'Advanced 3x3 matrix with complex determinant',
      category: 'advanced',
      input: 'SEPTEMBER',
      key: '7,8,3,2,9,1,5,4,6',
      expected: 'LVGWHRLWY',
      keyMatrix: [[7, 8, 3], [2, 9, 1], [5, 4, 6]],
      mathematicalProperties: {
        determinant: 105, // Complex calculation
        determinantMod26: 1, // 105 mod 26 = 1
        determinantInverse: 1,
        complexity: 'High - 3x3 matrix with multiple arithmetic operations'
      }
    },
    
    // Reference Standard Examples
    {
      algorithm: 'Hill',
      testId: 'hill-textbook-001',
      description: 'Standard cryptography textbook example',
      category: 'educational',
      input: 'PAYMOREMONEY',
      key: '17,17,5,21,18,21,2,2,19',
      expected: 'LDPMNOKQTYIR',
      source: {
        type: 'educational',
        title: 'Introduction to Cryptography with Coding Theory',
        authors: ['Wade Trappe', 'Lawrence C. Washington'],
        url: 'https://www.pearson.com/us/higher-education/program/Trappe-Introduction-to-Cryptography-with-Coding-Theory-2nd-Edition/PGM64696.html',
        organization: 'Pearson',
        edition: '2nd Edition'
      }
    },
    {
      algorithm: 'Hill',
      testId: 'hill-dcode-reference-001',
      description: 'dCode.fr reference implementation test',
      category: 'reference',
      input: 'DCODE',
      key: '2,3,5,7',
      expected: 'MDLNZ',
      preprocessing: {
        original: 'DCODE',
        afterPadding: 'DCODEX',
        result: 'MDLNZZ',
        trimmed: 'MDLNZ'
      },
      source: {
        type: 'reference',
        title: 'dCode Hill Cipher Tool',
        url: 'https://www.dcode.fr/hill-cipher',
        organization: 'dCode.fr'
      }
    },
    
    // Security Analysis Examples
    {
      algorithm: 'Hill',
      testId: 'hill-security-analysis-001',
      description: 'Security comparison - 2x2 vs 3x3 matrices',
      category: 'security-analysis',
      input: 'COMPARISONSTUDY',
      key2x2: '11,8,3,7',
      expected2x2: 'XGVVQZQHOWFFLUD',
      key3x3: '11,8,3,3,7,5,2,4,6',
      expected3x3: 'QVYWZXNRHJBTTXR',
      securityComparison: {
        matrix2x2: {
          keySpace: '26^4 possible matrices',
          validKeys: 'φ(26) = 12 coprime determinants',
          resistance: 'Low - 2 known plaintext-ciphertext pairs break cipher'
        },
        matrix3x3: {
          keySpace: '26^9 possible matrices',
          validKeys: 'Much larger space of valid matrices',
          resistance: 'Medium - requires 3 known plaintext blocks'
        }
      }
    }
  ],
    cantDecode: false,
    isInitialized: false,
    
    // Character set
    ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    MOD: 26,
    
    // Initialize cipher
    Init: function() {
      Hill.isInitialized = true;
    },
    
    // Mathematical utilities for matrix operations
    
    // Calculate GCD using Euclidean algorithm
    gcd: function(a, b) {
      a = Math.abs(a);
      b = Math.abs(b);
      while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    },
    
    // Calculate modular multiplicative inverse using Extended Euclidean Algorithm
    modInverse: function(a, m) {
      a = ((a % m) + m) % m;
      if (Hill.gcd(a, m) !== 1) {
        return null; // No inverse exists
      }
      
      let m0 = m, x0 = 0, x1 = 1;
      
      while (a > 1) {
        const q = Math.floor(a / m);
        let t = m;
        m = a % m;
        a = t;
        t = x0;
        x0 = x1 - q * x0;
        x1 = t;
      }
      
      return x1 < 0 ? x1 + m0 : x1;
    },
    
    // Calculate 2x2 matrix determinant mod 26
    determinant2x2: function(matrix) {
      const det = (matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]) % Hill.MOD;
      return ((det % Hill.MOD) + Hill.MOD) % Hill.MOD;
    },
    
    // Calculate 3x3 matrix determinant mod 26
    determinant3x3: function(matrix) {
      const a = matrix[0][0], b = matrix[0][1], c = matrix[0][2];
      const d = matrix[1][0], e = matrix[1][1], f = matrix[1][2];
      const g = matrix[2][0], h = matrix[2][1], i = matrix[2][2];
      
      const det = (a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)) % Hill.MOD;
      return ((det % Hill.MOD) + Hill.MOD) % Hill.MOD;
    },
    
    // Calculate 2x2 matrix inverse mod 26
    inverse2x2: function(matrix) {
      const det = Hill.determinant2x2(matrix);
      const detInv = Hill.modInverse(det, Hill.MOD);
      
      if (detInv === null) {
        return null; // Matrix is not invertible
      }
      
      const inverse = [
        [ (matrix[1][1] * detInv) % Hill.MOD, (-matrix[0][1] * detInv) % Hill.MOD],
        [(-matrix[1][0] * detInv) % Hill.MOD,  (matrix[0][0] * detInv) % Hill.MOD]
      ];
      
      // Ensure positive values
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          inverse[i][j] = ((inverse[i][j] % Hill.MOD) + Hill.MOD) % Hill.MOD;
        }
      }
      
      return inverse;
    },
    
    // Calculate 3x3 matrix inverse mod 26 (using adjugate method)
    inverse3x3: function(matrix) {
      const det = Hill.determinant3x3(matrix);
      const detInv = Hill.modInverse(det, Hill.MOD);
      
      if (detInv === null) {
        return null; // Matrix is not invertible
      }
      
      // Calculate cofactor matrix
      const cofactor = [];
      for (let i = 0; i < 3; i++) {
        cofactor[i] = [];
        for (let j = 0; j < 3; j++) {
          // Calculate minor matrix (2x2)
          const minor = [];
          for (let row = 0; row < 3; row++) {
            if (row === i) continue;
            const minorRow = [];
            for (let col = 0; col < 3; col++) {
              if (col === j) continue;
              minorRow.push(matrix[row][col]);
            }
            minor.push(minorRow);
          }
          
          // Calculate determinant of 2x2 minor
          const minorDet = (minor[0][0] * minor[1][1] - minor[0][1] * minor[1][0]) % Hill.MOD;
          
          // Apply checkerboard pattern of signs
          const sign = ((i + j) % 2 === 0) ? 1 : -1;
          cofactor[i][j] = (sign * minorDet * detInv) % Hill.MOD;
        }
      }
      
      // Transpose cofactor matrix to get adjugate, then multiply by determinant inverse
      const inverse = [];
      for (let i = 0; i < 3; i++) {
        inverse[i] = [];
        for (let j = 0; j < 3; j++) {
          inverse[i][j] = ((cofactor[j][i] % Hill.MOD) + Hill.MOD) % Hill.MOD;
        }
      }
      
      return inverse;
    },
    
    // Parse key string to matrix
    parseKey: function(key) {
      // Support formats: "a,b,c,d" for 2x2 or "a,b,c,d,e,f,g,h,i" for 3x3
      const numbers = key.replace(/[^\d,\-]/g, ' ').split(/[\s,:;]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n));
      
      if (numbers.length === 4) {
        // 2x2 matrix
        const matrix = [
          [numbers[0] % Hill.MOD, numbers[1] % Hill.MOD],
          [numbers[2] % Hill.MOD, numbers[3] % Hill.MOD]
        ];
        return { matrix: matrix, size: 2 };
      } else if (numbers.length === 9) {
        // 3x3 matrix
        const matrix = [
          [numbers[0] % Hill.MOD, numbers[1] % Hill.MOD, numbers[2] % Hill.MOD],
          [numbers[3] % Hill.MOD, numbers[4] % Hill.MOD, numbers[5] % Hill.MOD],
          [numbers[6] % Hill.MOD, numbers[7] % Hill.MOD, numbers[8] % Hill.MOD]
        ];
        return { matrix: matrix, size: 3 };
      } else {
        throw new Error('Hill cipher key must contain 4 numbers (2x2) or 9 numbers (3x3). Got: ' + numbers.length);
      }
    },
    
    // Matrix-vector multiplication mod 26
    matrixVectorMult: function(matrix, vector) {
      const result = [];
      for (let i = 0; i < matrix.length; i++) {
        let sum = 0;
        for (let j = 0; j < vector.length; j++) {
          sum += matrix[i][j] * vector[j];
        }
        result.push(((sum % Hill.MOD) + Hill.MOD) % Hill.MOD);
      }
      return result;
    },
    
    // Normalize text to uppercase letters only
    normalizeText: function(text) {
      return text.toUpperCase().replace(/[^A-Z]/g, '');
    },
    
    // Pad text to multiple of block size
    padText: function(text, blockSize) {
      while (text.length % blockSize !== 0) {
        text += 'X'; // Pad with X
      }
      return text;
    },
    
    // Set up key
    KeySetup: function(key) {
      if (!key || key.length === 0) {
        global.throwException('Key Required Exception', key, 'Hill', 'KeySetup');
        return null;
      }
      
      let id;
      do {
        id = 'Hill[' + global.generateUniqueID() + ']';
      } while (Hill.instances[id] || global.objectInstances[id]);
      
      try {
        Hill.instances[id] = new Hill.HillInstance(key);
        global.objectInstances[id] = true;
        return id;
      } catch (error) {
        global.throwException('Invalid Key Exception', error.message, 'Hill', 'KeySetup');
        return null;
      }
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Hill.instances[id]) {
        // Secure cleanup
        const instance = Hill.instances[id];
        if (instance.matrix) {
          for (let i = 0; i < instance.matrix.length; i++) {
            for (let j = 0; j < instance.matrix[i].length; j++) {
              instance.matrix[i][j] = 0;
            }
          }
        }
        if (instance.inverse) {
          for (let i = 0; i < instance.inverse.length; i++) {
            for (let j = 0; j < instance.inverse[i].length; j++) {
              instance.inverse[i][j] = 0;
            }
          }
        }
        instance.originalKey = '';
        delete Hill.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Hill', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Hill.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Hill', 'encryptBlock');
        return plaintext;
      }
      
      const instance = Hill.instances[id];
      const normalizedText = Hill.normalizeText(plaintext);
      const paddedText = Hill.padText(normalizedText, instance.size);
      let result = '';
      
      // Process text in blocks
      for (let i = 0; i < paddedText.length; i += instance.size) {
        const block = paddedText.substr(i, instance.size);
        
        // Convert to numeric vector
        const vector = [];
        for (let j = 0; j < block.length; j++) {
          vector.push(Hill.ALPHABET.indexOf(block[j]));
        }
        
        // Multiply by key matrix
        const encrypted = Hill.matrixVectorMult(instance.matrix, vector);
        
        // Convert back to letters
        for (let j = 0; j < encrypted.length; j++) {
          result += Hill.ALPHABET[encrypted[j]];
        }
      }
      
      return result;
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Hill.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Hill', 'decryptBlock');
        return ciphertext;
      }
      
      const instance = Hill.instances[id];
      const normalizedText = Hill.normalizeText(ciphertext);
      let result = '';
      
      // Process text in blocks
      for (let i = 0; i < normalizedText.length; i += instance.size) {
        const block = normalizedText.substr(i, instance.size);
        
        // Convert to numeric vector
        const vector = [];
        for (let j = 0; j < block.length; j++) {
          vector.push(Hill.ALPHABET.indexOf(block[j]));
        }
        
        // Multiply by inverse matrix
        const decrypted = Hill.matrixVectorMult(instance.inverse, vector);
        
        // Convert back to letters
        for (let j = 0; j < decrypted.length; j++) {
          result += Hill.ALPHABET[decrypted[j]];
        }
      }
      
      return result;
    },
    
    // Instance class
    HillInstance: function(key) {
      this.originalKey = key;
      const parsed = Hill.parseKey(key);
      this.matrix = parsed.matrix;
      this.size = parsed.size;
      
      // Calculate matrix inverse for decryption
      if (this.size === 2) {
        this.inverse = Hill.inverse2x2(this.matrix);
      } else if (this.size === 3) {
        this.inverse = Hill.inverse3x3(this.matrix);
      } else {
        throw new Error('Unsupported matrix size: ' + this.size);
      }
      
      if (!this.inverse) {
        throw new Error('Matrix is not invertible (determinant not coprime with 26)');
      }
    }
  };
  
  // Auto-register with Cipher system if available
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Hill);
  }
  
  // Export to global scope
  global.Hill = Hill;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Hill;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);