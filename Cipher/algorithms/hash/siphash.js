/*
 * SipHash-2-4 - Cryptographically Secure PRF for Hash Tables
 * Educational implementation designed by Jean-Philippe Aumasson and Daniel J. Bernstein
 */

(function(global) {
  'use strict';
  
  // Environment detection and dependency loading
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const SipHash = {
    name: "SipHash-2-4",
    description: "Fast cryptographically secure pseudorandom function designed for hash tables and data structures requiring collision resistance.",
    inventor: "Jean-Philippe Aumasson, Daniel J. Bernstein",
    year: 2012,
    country: global.AlgorithmFramework ? global.AlgorithmFramework.CountryCode.INTL : "Switzerland/USA",
    category: global.AlgorithmFramework ? global.AlgorithmFramework.CategoryType.HASH : "hash",
    subCategory: "MAC/PRF",
    securityStatus: global.AlgorithmFramework ? global.AlgorithmFramework.SecurityStatus.EDUCATIONAL : null, // Cryptographically secure PRF
    
    documentation: [
      {text: "SipHash Paper", uri: "https://cr.yp.to/siphash/siphash-20120918.pdf"},
      {text: "RFC 9018 (DNS Cookie usage)", uri: "https://www.rfc-editor.org/rfc/rfc9018.txt"},
      {text: "SipHash Official Repository", uri: "https://github.com/veorq/SipHash"}
    ],
    
    references: [
      {text: "Redis Hash Table Usage", uri: "https://github.com/redis/redis"},
      {text: "Linux Kernel Usage", uri: "https://git.kernel.org/"},
      {text: "Rust HashMap Implementation", uri: "https://github.com/rust-lang/rust"}
    ],
    
    knownVulnerabilities: [
      {
        type: "Key Management",
        text: "Security depends on secret key - key reuse or weak keys reduce security",
        mitigation: "Use strong random 128-bit keys, rotate keys periodically"
      }
    ],
    
    // The reference vectors.h holds 64 entries: entry i is the digest of the
    // first i bytes of 00 01 .. 3f under the key 00 01 .. 0f. It stores each
    // result little-endian, which is the byte order an implementation emits;
    // the paper prints the same numbers big-endian. The entries below are the
    // boundary lengths - empty, one byte, one under a block, exactly a block,
    // one over, and two whole blocks.
    tests: [
      {
        text: "vectors.h entry 0 - empty message",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: [],
        expected: OpCodes.Hex8ToBytes("310e0edd47db6f72")
      },
      {
        text: "vectors.h entry 1 - one byte",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("00"),
        expected: OpCodes.Hex8ToBytes("fd67dc93c539f874")
      },
      {
        text: "vectors.h entry 7 - one byte under the 8-byte block",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("00010203040506"),
        expected: OpCodes.Hex8ToBytes("37d1018bf50002ab")
      },
      {
        text: "vectors.h entry 8 - exactly one block",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("0001020304050607"),
        expected: OpCodes.Hex8ToBytes("6224939a79f5f593")
      },
      {
        text: "vectors.h entry 9 - one byte over a block",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("000102030405060708"),
        expected: OpCodes.Hex8ToBytes("b0e4a90bdf82009e")
      },
      {
        text: "vectors.h entry 16 - two whole blocks",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("db9bc2577fcc2a3f")
      },
      {
        text: "vectors.h entry 63 - 63 bytes",
        uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e"),
        expected: OpCodes.Hex8ToBytes("724506eb4c328a95")
      }
    ],
    
    // SipHash constants
    KEY_SIZE: 16,
    OUTPUT_SIZE: 8,
    C_ROUNDS: 2,
    D_ROUNDS: 4,
    
    // Current state
    key: null,
    
    // Initialize
    Init: function() {
      this.key = new Array(this.KEY_SIZE).fill(0);
      return true;
    },
    
    // Key setup (128-bit key required)
    KeySetup: function(key, options) {
      if (key && key.length >= this.KEY_SIZE) {
        this.key = key.slice(0, this.KEY_SIZE);
      } else {
        // Use zero key for testing
        this.key = new Array(this.KEY_SIZE).fill(0);
      }
      return "siphash-" + this.key[0].toString(16) + this.key[1].toString(16);
    },
    
    // 64-bit operations using 32-bit arithmetic
    add64: function(a, b) {
      const low = OpCodes.ToDWord(a[0] + b[0]);
      const high = OpCodes.ToDWord(a[1] + b[1] + (low < a[0] ? 1 : 0));
      return [low, high];
    },
    
    xor64: function(a, b) {
      return [OpCodes.XorN(a[0], b[0]), OpCodes.XorN(a[1], b[1])];
    },
    
    rotl64: function(val, positions) {
      const [low, high] = val;
      positions %= 64;

      if (positions === 0) return [low, high];
      if (positions === 32) return [high, low];

      if (positions < 32) {
        const newHigh = OpCodes.ToDWord(OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions)));
        const newLow = OpCodes.ToDWord(OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions)));
        return [newLow, newHigh];
      } else {
        positions -= 32;
        const newHigh = OpCodes.ToDWord(OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions)));
        const newLow = OpCodes.ToDWord(OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions)));
        return [newLow, newHigh];
      }
    },
    
    // SipRound function
    sipRound: function(v0, v1, v2, v3) {
      v0 = this.add64(v0, v1);
      v1 = this.rotl64(v1, 13);
      v1 = this.xor64(v1, v0);
      v0 = this.rotl64(v0, 32);
      
      v2 = this.add64(v2, v3);
      v3 = this.rotl64(v3, 16);
      v3 = this.xor64(v3, v2);
      
      v0 = this.add64(v0, v3);
      v3 = this.rotl64(v3, 21);
      v3 = this.xor64(v3, v0);
      
      v2 = this.add64(v2, v1);
      v1 = this.rotl64(v1, 17);
      v1 = this.xor64(v1, v2);
      v2 = this.rotl64(v2, 32);
      
      return [v0, v1, v2, v3];
    },
    
    // Convert bytes to 64-bit little-endian word
    bytesToWord64LE: function(bytes, offset) {
      const low = OpCodes.Pack32LE(
        bytes[offset] || 0, bytes[offset + 1] || 0,
        bytes[offset + 2] || 0, bytes[offset + 3] || 0
      );
      const high = OpCodes.Pack32LE(
        bytes[offset + 4] || 0, bytes[offset + 5] || 0,
        bytes[offset + 6] || 0, bytes[offset + 7] || 0
      );
      return [low, high];
    },
    
    // Convert 64-bit word to bytes (little-endian)
    word64ToBytes: function(word) {
      const bytes = new Array(8);
      const lowBytes = OpCodes.Unpack32LE(word[0]);
      const highBytes = OpCodes.Unpack32LE(word[1]);
      
      for (let i = 0; i < 4; i++) {
        bytes[i] = lowBytes[i];
        bytes[i + 4] = highBytes[i];
      }
      
      return bytes;
    },
    
    // Main SipHash function
    // Main SipHash function.
    //
    // The state is four 64-bit words. They are held as BigInt here because the
    // split 32-bit form this file used before had its four initialisation
    // constants transposed, and a single 64-bit value cannot be half wrong.
    siphash: function(message, key) {
      if (!key) key = this.key;
      if (key.length !== this.KEY_SIZE) {
        throw new Error("SipHash requires 128-bit (16-byte) key");
      }

      const MASK64 = 0xFFFFFFFFFFFFFFFFn;
      const le64 = (bytes, offset) => {
        let value = 0n;
        for (let i = 7; i >= 0; i--) {
          value = OpCodes.ShiftLn(value, 8n) + BigInt(bytes[offset + i] || 0);
        }
        return value;
      };

      const k0 = le64(key, 0);
      const k1 = le64(key, 8);

      // The initialisation constants spell "somepseudorandomlygeneratedbytes".
      let v0 = OpCodes.XorN(k0, 0x736f6d6570736575n);
      let v1 = OpCodes.XorN(k1, 0x646f72616e646f6dn);
      let v2 = OpCodes.XorN(k0, 0x6c7967656e657261n);
      let v3 = OpCodes.XorN(k1, 0x7465646279746573n);

      const sipRound = () => {
        v0 = OpCodes.AndN(v0 + v1, MASK64);
        v1 = OpCodes.RotL64n(v1, 13);
        v1 = OpCodes.XorN(v1, v0);
        v0 = OpCodes.RotL64n(v0, 32);

        v2 = OpCodes.AndN(v2 + v3, MASK64);
        v3 = OpCodes.RotL64n(v3, 16);
        v3 = OpCodes.XorN(v3, v2);

        v0 = OpCodes.AndN(v0 + v3, MASK64);
        v3 = OpCodes.RotL64n(v3, 21);
        v3 = OpCodes.XorN(v3, v0);

        v2 = OpCodes.AndN(v2 + v1, MASK64);
        v1 = OpCodes.RotL64n(v1, 17);
        v1 = OpCodes.XorN(v1, v2);
        v2 = OpCodes.RotL64n(v2, 32);
      };

      const absorb = m => {
        v3 = OpCodes.XorN(v3, m);
        for (let i = 0; i < this.C_ROUNDS; i++) sipRound();
        v0 = OpCodes.XorN(v0, m);
      };

      // Whole 8-byte blocks
      const messageLen = message.length;
      const whole = messageLen - (messageLen % 8);
      for (let offset = 0; offset < whole; offset += 8) absorb(le64(message, offset));

      // The final block always exists: the tail bytes, zero filled, with the
      // low byte of the message length in the top byte. An empty message goes
      // through this path like any other, which is why there is no special case.
      const finalBlock = new Array(8).fill(0);
      for (let i = 0; i < messageLen - whole; i++) finalBlock[i] = message[whole + i];
      finalBlock[7] = OpCodes.AndN(messageLen, 0xFF);
      absorb(le64(finalBlock, 0));

      // Finalization
      v2 = OpCodes.XorN(v2, 0xffn);
      for (let i = 0; i < this.D_ROUNDS; i++) sipRound();

      const result = OpCodes.XorN(OpCodes.XorN(v0, v1), OpCodes.XorN(v2, v3));
      const out = new Array(8);
      for (let i = 0; i < 8; i++) out[i] = Number(OpCodes.AndN(OpCodes.ShiftRn(result, BigInt(8 * i)), 0xffn));
      return out;
    },
    
    // Process input for universal interface
    ProcessInput: function(input) {
      // The empty message is an ordinary case: it produces one padded final
      // block whose last byte carries the length, exactly like any other tail.
      return this.siphash(input || [], this.key);
    },
    
    // Universal cipher interface  
    EncryptBlock: function(blockIndex, plaintext) {
      return this.ProcessInput(plaintext);
    },
    
    DecryptBlock: function(blockIndex, ciphertext) {
      throw new Error("SipHash is a one-way PRF and cannot be decrypted");
    },
    
    ClearData: function() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
        this.key = new Array(this.KEY_SIZE).fill(0);
      }
    },
    
    // Instance creation for AlgorithmFramework
    CreateInstance: function(isInverse) {
      const instance = Object.create(this);
      instance.Init();
      
      // Add Feed method required by testing framework
      instance.Feed = function(data) {
        this._inputBuffer = (this._inputBuffer || []).concat(data);
      };
      
      // Add Result method required by testing framework  
      instance.Result = function() {
        return this.ProcessInput(this._inputBuffer || []);
      };
      
      return instance;
    }
  };
  
  // Auto-register with AlgorithmFramework if available
  if (global.AlgorithmFramework && typeof global.AlgorithmFramework.RegisterAlgorithm === 'function') {
    global.AlgorithmFramework.RegisterAlgorithm(SipHash);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SipHash;
  }
  
  // Global export
  global.SipHash = SipHash;
  
})(typeof global !== 'undefined' ? global : window);