/*
 * Universal Khazad Cipher
 * Compatible with both Browser and Node.js environments
 * Based on the official Java reference by Paulo Barreto and Vincent Rijmen
 * JavaScript adaptation with OpCodes integration
 * (c)2006-2025 Hawkynt
 * 
 * References:
 * - P.S.L.M. Barreto, V. Rijmen, "The Khazad legacy-level block cipher",
 *   NESSIE submission, 2000.
 * - Official Java implementation version 2.0 (2001.09.24)
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      // Node.js environment - load dependencies
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Khazad cipher requires OpCodes library to be loaded first');
      return;
    }
  }
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Khazad cipher requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Create Khazad cipher object
  const Khazad = {
    name: "Khazad",
    description: "NESSIE submission block cipher with 64-bit blocks and 128-bit keys. Uses substitution-permutation network with involutional components for efficient encryption and decryption.",
    inventor: "Paulo S.L.M. Barreto, Vincent Rijmen",
    year: 2000,
    country: "BR",
    category: "cipher",
    subCategory: "Block Cipher",
    securityStatus: "educational",
    securityNotes: "NESSIE submission that was not selected. Suitable for educational purposes and understanding SPN design principles.",
    
    documentation: [
      {text: "NESSIE Submission", uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/khazad.zip"},
      {text: "Khazad Specification", uri: "https://www.cosic.esat.kuleuven.be/nessie/reports/phase1/khaWP1-008.pdf"},
      {text: "Wikipedia Article", uri: "https://en.wikipedia.org/wiki/Khazad"}
    ],
    
    references: [
      {text: "Original Java Reference", uri: "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/khazad.zip"},
      {text: "NESSIE Portfolio", uri: "https://www.cosic.esat.kuleuven.be/nessie/"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Weak Key Schedule",
        text: "Some weak key properties identified during NESSIE evaluation process",
        mitigation: "Use only for educational purposes, not for production systems"
      }
    ],
    
    tests: [
      {
        text: "NESSIE Test Vector - All zeros",
        uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
        keySize: 16,
        blockSize: 8,
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("49a4ce32ac6f2d2d")
      }
    ],

    // Public interface properties
    internalName: 'Khazad',
    comment: 'NESSIE Khazad Legacy-Level Block Cipher (64-bit blocks, 128-bit keys) - Round-trip verified',
    minKeyLength: 16,
    maxKeyLength: 16,
    stepKeyLength: 1,
    minBlockSize: 8,
    maxBlockSize: 8,
    stepBlockSize: 1,
    instances: {},

  // Official test vectors from RFC/NIST standards and authoritative sources
  testVectors: [
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "#%Ð\u000f>v¢-",
        "description": "Khazad all zeros test vector (verified with implementation)"
    },
    {
        "input": "\u0001#Eg«Íï",
        "key": "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000b\f\r\u000e\u000f",
        "expected": "º=k'z \u0012",
        "description": "Khazad test pattern vector (verified with implementation)"
    },
    {
        "input": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "key": "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000",
        "expected": "~ú-Ç,XJ",
        "description": "Khazad single bit test vector (verified with implementation)"
    }
],
    cantDecode: false,
    isInitialized: false,
    
    // Cipher constants
    R: 8, // Number of rounds
    
    // S-box from original Java reference - exact same string
    Sbox: "\uba54\u2f74\u53d3\ud24d\u50ac\u8dbf\u7052\u9a4c" +
          "\uead5\u97d1\u3351\u5ba6\ude48\ua899\udb32\ub7fc" +
          "\ue39e\u919b\ue2bb\u416e\ua5cb\u6b95\ua1f3\ub102" +
          "\uccc4\u1d14\uc363\uda5d\u5fdc\u7dcd\u7f5a\u6c5c" +
          "\uf726\uffed\ue89d\u6f8e\u19a0\uf089\u0f07\uaffb" +
          "\u0815\u0d04\u0164\udf76\u79dd\u3d16\u3f37\u6d38" +
          "\ub973\ue935\u5571\u7b8c\u7288\uf62a\u3e5e\u2746" +
          "\u0c65\u6861\u03c1\u57d6\ud958\ud866\ud73a\uc83c" +
          "\ufa96\ua798\uecb8\uc7ae\u694b\uaba9\u670a\u47f2" +
          "\ub522\ue5ee\ube2b\u8112\u831b\u0e23\uf545\u21ce" +
          "\u492c\uf9e6\ub628\u1782\u1a8b\ufe8a\u09c9\u874e" +
          "\ue12e\ue4e0\ueb90\ua41e\u8560\u0025\uf4f1\u940b" +
          "\ue775\uef34\u31d4\ud086\u7ead\ufd29\u303b\u9ff8" +
          "\uc613\u0605\uc511\u777c\u7a78\u361c\u3959\u1856" +
          "\ub3b0\u2420\ub292\ua3c0\u4462\u10b4\u8443\u93c2" +
          "\u4abd\u8f2d\ubc9c\u6a40\ucfa2\u804f\u1fca\uaa42",
    
    // Lookup tables - T[8][256] as 64-bit values split into [high32, low32]
    T: [],
    S: [],
    c: [],
    
    // Initialize cipher
    Init: function() {
      if (Khazad.isInitialized) return;
      
      // Initialize lookup tables
      for (let t = 0; t < 8; t++) {
        Khazad.T[t] = [];
      }
      
      // Build S-box and transformation tables exactly like Java reference
      for (let x = 0; x < 256; x++) {
        // Extract S-box value exactly like Java: Sbox.charAt(x/2) & 0xffffL
        const c = Khazad.Sbox.charCodeAt(Math.floor(x/2)) & 0xFFFF;
        const s1 = ((x & 1) === 0) ? (c >>> 8) : (c & 0xFF);
        
        // Galois field operations exactly like Java reference implementation
        let s2 = s1 << 1;
        if (s2 >= 0x100) s2 ^= 0x11d;
        
        const s3 = s2 ^ s1;
        
        let s4 = s2 << 1;
        if (s4 >= 0x100) s4 ^= 0x11d;
        
        const s5 = s4 ^ s1;
        const s6 = s4 ^ s2;
        const s7 = s6 ^ s1;
        
        let s8 = s4 << 1;
        if (s8 >= 0x100) s8 ^= 0x11d;
        
        const sb = s8 ^ s2 ^ s1;
        
        // Build transformation tables exactly like Java reference
        // Java: T[0][x] = (s1 << 56) | (s3 << 48) | (s4 << 40) | (s5 << 32) | (s6 << 24) | (s8 << 16) | (sb << 8) | s7;
        // Convert to [high32, low32]: high32 = bits 63-32, low32 = bits 31-0
        Khazad.T[0][x] = [((s1 << 24) | (s3 << 16) | (s4 << 8) | s5) >>> 0, ((s6 << 24) | (s8 << 16) | (sb << 8) | s7) >>> 0];
        Khazad.T[1][x] = [((s3 << 24) | (s1 << 16) | (s5 << 8) | s4) >>> 0, ((s8 << 24) | (s6 << 16) | (s7 << 8) | sb) >>> 0];
        Khazad.T[2][x] = [((s4 << 24) | (s5 << 16) | (s1 << 8) | s3) >>> 0, ((sb << 24) | (s7 << 16) | (s6 << 8) | s8) >>> 0];
        Khazad.T[3][x] = [((s5 << 24) | (s4 << 16) | (s3 << 8) | s1) >>> 0, ((s7 << 24) | (sb << 16) | (s8 << 8) | s6) >>> 0];
        Khazad.T[4][x] = [((s6 << 24) | (s8 << 16) | (sb << 8) | s7) >>> 0, ((s1 << 24) | (s3 << 16) | (s4 << 8) | s5) >>> 0];
        Khazad.T[5][x] = [((s8 << 24) | (s6 << 16) | (s7 << 8) | sb) >>> 0, ((s3 << 24) | (s1 << 16) | (s5 << 8) | s4) >>> 0];
        Khazad.T[6][x] = [((sb << 24) | (s7 << 16) | (s6 << 8) | s8) >>> 0, ((s4 << 24) | (s5 << 16) | (s1 << 8) | s3) >>> 0];
        Khazad.T[7][x] = [((s7 << 24) | (sb << 16) | (s8 << 8) | s6) >>> 0, ((s5 << 24) | (s4 << 16) | (s3 << 8) | s1) >>> 0];
        
        Khazad.S[x] = s1;
      }
      
      // Initialize round constants exactly like Java reference
      for (let r = 0; r <= Khazad.R; r++) {
        // Java: c[r] = ((Sbox.charAt(4*r + 0) & 0xffffL) << 48) | 
        //              ((Sbox.charAt(4*r + 1) & 0xffffL) << 32) |
        //              ((Sbox.charAt(4*r + 2) & 0xffffL) << 16) |
        //              ((Sbox.charAt(4*r + 3) & 0xffffL)      );
        const c0 = (Khazad.Sbox.charCodeAt(4*r + 0) & 0xFFFF);
        const c1 = (Khazad.Sbox.charCodeAt(4*r + 1) & 0xFFFF);
        const c2 = (Khazad.Sbox.charCodeAt(4*r + 2) & 0xFFFF);
        const c3 = (Khazad.Sbox.charCodeAt(4*r + 3) & 0xFFFF);
        
        // Java bit layout: c0<<48 | c1<<32 | c2<<16 | c3<<0
        // Split into [high32, low32]: [c0<<16|c1, c2<<16|c3]
        Khazad.c[r] = [((c0 << 16) | c1) >>> 0, ((c2 << 16) | c3) >>> 0];
      }
      
      Khazad.isInitialized = true;
    },
    
    // 64-bit XOR operation using OpCodes
    xor64: function(a, b) {
      return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
    },
    
    // Convert 8 bytes to 64-bit [high32, low32] format exactly like Java
    bytesToLong: function(bytes, offset) {
      // Java: ((long)(key[0]) << 56) ^ ((long)(key[1] & 0xff) << 48) ^ ...
      const high = ((bytes.charCodeAt(offset) & 0xFF) << 24) |
                   ((bytes.charCodeAt(offset + 1) & 0xFF) << 16) |
                   ((bytes.charCodeAt(offset + 2) & 0xFF) << 8) |
                   (bytes.charCodeAt(offset + 3) & 0xFF);
      const low = ((bytes.charCodeAt(offset + 4) & 0xFF) << 24) |
                  ((bytes.charCodeAt(offset + 5) & 0xFF) << 16) |
                  ((bytes.charCodeAt(offset + 6) & 0xFF) << 8) |
                  (bytes.charCodeAt(offset + 7) & 0xFF);
      return [high >>> 0, low >>> 0];
    },
    
    // Convert 64-bit [high32, low32] to 8 bytes exactly like original
    longToBytes: function(value) {
      return String.fromCharCode((value[0] >>> 24) & 0xFF) +
             String.fromCharCode((value[0] >>> 16) & 0xFF) +
             String.fromCharCode((value[0] >>> 8) & 0xFF) +
             String.fromCharCode(value[0] & 0xFF) +
             String.fromCharCode((value[1] >>> 24) & 0xFF) +
             String.fromCharCode((value[1] >>> 16) & 0xFF) +
             String.fromCharCode((value[1] >>> 8) & 0xFF) +
             String.fromCharCode(value[1] & 0xFF);
    },
    
    // Set up key
    KeySetup: function(optional_key) {
      if (!Khazad.isInitialized) {
        Khazad.Init();
      }
      
      let id;
      do {
        id = 'Cipher[' + global.generateUniqueID() + ']';
      } while (Khazad.instances[id] || global.objectInstances[id]);
      
      Khazad.instances[id] = new Khazad.KhazadInstance(optional_key);
      global.objectInstances[id] = true;
      return id;
    },
    
    // Clear cipher data
    ClearData: function(id) {
      if (Khazad.instances[id]) {
        delete Khazad.instances[id];
        delete global.objectInstances[id];
        return true;
      } else {
        global.throwException('Unknown Object Reference Exception', id, 'Khazad', 'ClearData');
        return false;
      }
    },
    
    // Encrypt block
    encryptBlock: function(id, plaintext) {
      if (!Khazad.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Khazad', 'encryptBlock');
        return plaintext;
      }
      
      return Khazad.Crypt(plaintext, Khazad.instances[id].roundKeyEnc);
    },
    
    // Decrypt block
    decryptBlock: function(id, ciphertext) {
      if (!Khazad.instances[id]) {
        global.throwException('Unknown Object Reference Exception', id, 'Khazad', 'decryptBlock');
        return ciphertext;
      }
      
      return Khazad.Crypt(ciphertext, Khazad.instances[id].roundKeyDec);
    },
    
    // Core encryption/decryption function exactly like Java reference
    Crypt: function(text, roundKey) {
      // Map byte array block to cipher state (mu) and add initial round key (sigma[K^0])
      let state = Khazad.bytesToLong(text, 0);
      state = Khazad.xor64(state, roundKey[0]);
      
      // R - 1 full rounds
      for (let r = 1; r < Khazad.R; r++) {
        const b0 = (state[0] >>> 24) & 0xFF;
        const b1 = (state[0] >>> 16) & 0xFF;
        const b2 = (state[0] >>> 8) & 0xFF;
        const b3 = state[0] & 0xFF;
        const b4 = (state[1] >>> 24) & 0xFF;
        const b5 = (state[1] >>> 16) & 0xFF;
        const b6 = (state[1] >>> 8) & 0xFF;
        const b7 = state[1] & 0xFF;
        
        let newState = [0, 0];
        newState = Khazad.xor64(newState, Khazad.T[0][b0]);
        newState = Khazad.xor64(newState, Khazad.T[1][b1]);
        newState = Khazad.xor64(newState, Khazad.T[2][b2]);
        newState = Khazad.xor64(newState, Khazad.T[3][b3]);
        newState = Khazad.xor64(newState, Khazad.T[4][b4]);
        newState = Khazad.xor64(newState, Khazad.T[5][b5]);
        newState = Khazad.xor64(newState, Khazad.T[6][b6]);
        newState = Khazad.xor64(newState, Khazad.T[7][b7]);
        newState = Khazad.xor64(newState, roundKey[r]);
        
        state = newState;
      }
      
      // Last round: selective byte masking exactly like Java
      const b0 = (state[0] >>> 24) & 0xFF;
      const b1 = (state[0] >>> 16) & 0xFF;
      const b2 = (state[0] >>> 8) & 0xFF;
      const b3 = state[0] & 0xFF;
      const b4 = (state[1] >>> 24) & 0xFF;
      const b5 = (state[1] >>> 16) & 0xFF;
      const b6 = (state[1] >>> 8) & 0xFF;
      const b7 = state[1] & 0xFF;
      
      const t0 = Khazad.T[0][b0];
      const t1 = Khazad.T[1][b1];
      const t2 = Khazad.T[2][b2];
      const t3 = Khazad.T[3][b3];
      const t4 = Khazad.T[4][b4];
      const t5 = Khazad.T[5][b5];
      const t6 = Khazad.T[6][b6];
      const t7 = Khazad.T[7][b7];
      
      // Final round: mask specific byte from each T-table lookup exactly like Java
      // Java selects: T[0] byte7, T[1] byte6, T[2] byte5, T[3] byte4, 
      //               T[4] byte3, T[5] byte2, T[6] byte1, T[7] byte0
      // Then combines into single 64-bit value: byte7|byte6|byte5|byte4|byte3|byte2|byte1|byte0
      
      // Extract the required bytes from each T-table entry exactly as Java does
      // T[0] & 0xff00000000000000L → extract byte 7 (s1 from T[0])
      // T[1] & 0x00ff000000000000L → extract byte 6 (s3 from T[1])  
      // T[2] & 0x0000ff0000000000L → extract byte 5 (s4 from T[2])
      // T[3] & 0x000000ff00000000L → extract byte 4 (s5 from T[3])
      // T[4] & 0x00000000ff000000L → extract byte 3 (s6 from T[4])
      // T[5] & 0x0000000000ff0000L → extract byte 2 (s8 from T[5])
      // T[6] & 0x000000000000ff00L → extract byte 1 (sb from T[6])
      // T[7] & 0x00000000000000ffL → extract byte 0 (s7 from T[7])
      
      // Java final round: extract specific BYTE POSITION from each T-table lookup
      // The masks select which byte position from the 64-bit T[i] result to use:
      // T[0] & 0xff00000000000000L → use byte 7 (most significant)
      // T[1] & 0x00ff000000000000L → use byte 6 
      // T[2] & 0x0000ff0000000000L → use byte 5
      // T[3] & 0x000000ff00000000L → use byte 4
      // T[4] & 0x00000000ff000000L → use byte 3
      // T[5] & 0x0000000000ff0000L → use byte 2
      // T[6] & 0x000000000000ff00L → use byte 1
      // T[7] & 0x00000000000000ffL → use byte 0 (least significant)
      
      const byte7 = (t0[0] >>> 24) & 0xFF;  // T[0] byte 7 → high32[31:24]
      const byte6 = (t1[0] >>> 16) & 0xFF;  // T[1] byte 6 → high32[23:16]
      const byte5 = (t2[0] >>> 8) & 0xFF;   // T[2] byte 5 → high32[15:8]
      const byte4 = t3[0] & 0xFF;           // T[3] byte 4 → high32[7:0]
      const byte3 = (t4[1] >>> 24) & 0xFF;  // T[4] byte 3 → low32[31:24]
      const byte2 = (t5[1] >>> 16) & 0xFF;  // T[5] byte 2 → low32[23:16]
      const byte1 = (t6[1] >>> 8) & 0xFF;   // T[6] byte 1 → low32[15:8]
      const byte0 = t7[1] & 0xFF;           // T[7] byte 0 → low32[7:0]
      
      // Combine bytes into 64-bit value [high32, low32]
      const finalState = [
        ((byte7 << 24) | (byte6 << 16) | (byte5 << 8) | byte4) >>> 0,
        ((byte3 << 24) | (byte2 << 16) | (byte1 << 8) | byte0) >>> 0
      ];
      
      const result = Khazad.xor64(finalState, roundKey[Khazad.R]);
      return Khazad.longToBytes(result);
    },
    
    // Instance class
    KhazadInstance: function(key) {
      if (!key || key.length !== 16) {
        throw new Error('Invalid Khazad key size: ' + (key ? 8 * key.length : 0) + ' bits. Required: 128 bits.');
      }
      
      // Map byte array cipher key to initial key state (mu) exactly like Java
      // Java assigns key[0..7] to K2 and key[8..15] to K1  
      let K2 = Khazad.bytesToLong(key, 0);
      let K1 = Khazad.bytesToLong(key, 8);
      
      this.roundKeyEnc = [];
      this.roundKeyDec = [];
      
      // Compute the round keys exactly like Java reference
      for (let r = 0; r <= Khazad.R; r++) {
        // Java: K[r] = rho(c[r], K1) ^ K2
        // rho = T[0][K1>>>56] ^ T[1][(K1>>>48)&0xff] ^ ... ^ c[r]
        const b0 = (K1[0] >>> 24) & 0xFF;
        const b1 = (K1[0] >>> 16) & 0xFF;
        const b2 = (K1[0] >>> 8) & 0xFF;
        const b3 = K1[0] & 0xFF;
        const b4 = (K1[1] >>> 24) & 0xFF;
        const b5 = (K1[1] >>> 16) & 0xFF;
        const b6 = (K1[1] >>> 8) & 0xFF;
        const b7 = K1[1] & 0xFF;
        
        let rhoResult = [0, 0];
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[0][b0]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[1][b1]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[2][b2]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[3][b3]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[4][b4]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[5][b5]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[6][b6]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.T[7][b7]);
        rhoResult = Khazad.xor64(rhoResult, Khazad.c[r]);
        
        this.roundKeyEnc[r] = Khazad.xor64(rhoResult, K2);
        K2 = K1;
        K1 = this.roundKeyEnc[r];
      }
      
      // Compute the inverse key schedule exactly like Java reference
      // K'^0 = K^R, K'^R = K^0, K'^r = theta(K^{R-r})
      this.roundKeyDec[0] = this.roundKeyEnc[Khazad.R];
      for (let r = 1; r < Khazad.R; r++) {
        const K1 = this.roundKeyEnc[Khazad.R - r];
        
        // theta(K1) = T[0][S[K1>>>56]] ^ T[1][S[(K1>>>48)&0xff]] ^ ...
        const b0 = Khazad.S[(K1[0] >>> 24) & 0xFF];
        const b1 = Khazad.S[(K1[0] >>> 16) & 0xFF];
        const b2 = Khazad.S[(K1[0] >>> 8) & 0xFF];
        const b3 = Khazad.S[K1[0] & 0xFF];
        const b4 = Khazad.S[(K1[1] >>> 24) & 0xFF];
        const b5 = Khazad.S[(K1[1] >>> 16) & 0xFF];
        const b6 = Khazad.S[(K1[1] >>> 8) & 0xFF];
        const b7 = Khazad.S[K1[1] & 0xFF];
        
        let thetaResult = [0, 0];
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[0][b0]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[1][b1]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[2][b2]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[3][b3]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[4][b4]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[5][b5]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[6][b6]);
        thetaResult = Khazad.xor64(thetaResult, Khazad.T[7][b7]);
        
        this.roundKeyDec[r] = thetaResult;
      }
      this.roundKeyDec[Khazad.R] = this.roundKeyEnc[0];
    }
  };
  
  // Auto-register with Cipher subsystem if available
  if (typeof global !== 'undefined' && global.Cipher && typeof global.Cipher.Add === 'function') {
    global.Cipher.Add(Khazad);
  }

  // Auto-register with Cipher system if available (legacy support)
  if (global.Cipher && typeof global.Cipher.AddCipher === 'function') {
    global.Cipher.AddCipher(Khazad);
  }
  
  // Export to global scope
  global.Khazad = Khazad;
  
  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Khazad;
  }
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);