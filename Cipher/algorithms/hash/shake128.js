
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

  // SHAKE128 constants
  const SHAKE128_RATE = 168;        // Rate in bytes (1344 bits)
  const SHAKE128_CAPACITY = 32;     // Capacity in bytes (256 bits)
  const KECCAK_ROUNDS = 24;         // Number of Keccak-f[1600] rounds
  
  // Keccac round constants (24 rounds, as [low32, high32] pairs) - FIPS 202 compliant
  const RC = [
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ];
  
  // Rotation offsets for rho step
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];
  
  /**
   * 64-bit XOR operation
   * @param {Array} a - [low32, high32]
   * @param {Array} b - [low32, high32]
   * @returns {Array} XOR result [low32, high32]
   */
  function xor64(a, b) {
    return [a[0] ^ b[0], a[1] ^ b[1]];
  }

  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {Array} val - [low32, high32]
   * @param {number} positions - Rotation positions
   * @returns {Array} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;
    
    if (positions === 0) return [low, high];
    
    if (positions === 32) {
      return [high, low];
    } else if (positions < 32) {
      const newLow = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      const newHigh = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    } else {
      positions -= 32;
      const newLow = ((high << positions) | (low >>> (32 - positions))) >>> 0;
      const newHigh = ((low << positions) | (high >>> (32 - positions))) >>> 0;
      return [newLow, newHigh];
    }
  }
  
  /**
   * Keccak-f[1600] permutation
   * @param {Array} state - 25 x [low32, high32] state array
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }
      
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }
      
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }
      
      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }
      
      // Pi step
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = [state[i][0], state[i][1]];
      }
      
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }
      
      // Chi step
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }
        
        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [notNext[0] & row[(x + 2) % 5][0], notNext[1] & row[(x + 2) % 5][1]];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }
      
      // Iota step
      state[0] = xor64(state[0], RC[round]);
    }
  }
  
  /**
   * SHAKE128 hasher class
   */
  function Shake128Hasher() {
    this.state = new Array(25);
    for (let i = 0; i < 25; i++) {
      this.state[i] = [0, 0];
    }
    this.buffer = new Uint8Array(SHAKE128_RATE);
    this.bufferLength = 0;
    this.squeezing = false;
    this.squeezed = 0;
  }
  
  Shake128Hasher.prototype.absorb = function(data) {
    if (this.squeezing) {
      throw new Error('Cannot absorb after squeezing has started');
    }
    
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }
    
    let offset = 0;
    
    while (offset < data.length) {
      const remaining = SHAKE128_RATE - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);
      
      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }
      
      this.bufferLength += toCopy;
      offset += toCopy;
      
      // Process full blocks
      if (this.bufferLength === SHAKE128_RATE) {
        this.absorbBlock();
        this.bufferLength = 0;
      }
    }
  };
  
  Shake128Hasher.prototype.absorbBlock = function() {
    // XOR buffer into state (little-endian, 8 bytes per state element)
    for (let i = 0; i < SHAKE128_RATE; i += 8) {
      const stateIndex = Math.floor(i / 8);
      
      // Pack 8 bytes into two 32-bit words (little-endian)
      const low = OpCodes.Pack32LE(
        this.buffer[i] || 0,
        this.buffer[i + 1] || 0,
        this.buffer[i + 2] || 0,
        this.buffer[i + 3] || 0
      );
      const high = OpCodes.Pack32LE(
        this.buffer[i + 4] || 0,
        this.buffer[i + 5] || 0,
        this.buffer[i + 6] || 0,
        this.buffer[i + 7] || 0
      );
      
      // XOR into state
      this.state[stateIndex][0] ^= low;
      this.state[stateIndex][1] ^= high;
    }
    
    keccakF(this.state);
  };
  
  Shake128Hasher.prototype.finalize = function() {
    if (this.squeezing) {
      return;
    }
    
    // Pad with 0x1F (SHAKE padding)
    this.buffer[this.bufferLength] = 0x1F;
    
    // Fill rest with zeros except last byte
    for (let i = this.bufferLength + 1; i < SHAKE128_RATE - 1; i++) {
      this.buffer[i] = 0;
    }
    
    // Set last bit of last byte
    this.buffer[SHAKE128_RATE - 1] = 0x80;
    
    // Absorb final block
    this.absorbBlock();
    
    this.squeezing = true;
  };
  
  Shake128Hasher.prototype.squeeze = function(outputLength) {
    if (!this.squeezing) {
      this.finalize();
    }
    
    const output = new Uint8Array(outputLength);
    let outputOffset = 0;
    
    while (outputOffset < outputLength) {
      // Generate rate bytes from current state
      const available = Math.min(SHAKE128_RATE, outputLength - outputOffset);
      
      for (let i = 0; i < available && i < SHAKE128_RATE; i += 8) {
        const stateIndex = Math.floor(i / 8);
        const word = this.state[stateIndex];
        
        const bytes1 = OpCodes.Unpack32LE(word[0]);
        const bytes2 = OpCodes.Unpack32LE(word[1]);
        
        for (let j = 0; j < 4 && outputOffset < outputLength; j++) {
          output[outputOffset++] = bytes1[j];
        }
        for (let j = 0; j < 4 && outputOffset < outputLength; j++) {
          output[outputOffset++] = bytes2[j];
        }
      }
      
      // If we need more output, apply Keccak-f again
      if (outputOffset < outputLength) {
        keccakF(this.state);
      }
    }
    
    return output;
  };
  
   
  class SHAKE128Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SHAKE128";
      this.description = "SHAKE128 is an extendable-output function (XOF) from the SHA-3 family based on Keccak sponge construction. Provides variable-length output with 128-bit security level.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Family (XOF)";
      this.country = CountryCode.BE;
      this.securityStatus = SecurityStatus.ACTIVE;
      this.complexity = ComplexityType.MEDIUM;

      // Test vectors from NIST FIPS 202 and verification sources
      this.tests = [
        {
          text: "SHAKE128 Empty String - 16 bytes output",
          uri: "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf",
          input: [],
          outputLength: 16,
          expected: OpCodes.Hex8ToBytes("7f9c2ba4e88f827d616045507605853e")
        },
        {
          text: "SHAKE128 'abc' - 16 bytes output",
          uri: "https://asecuritysite.com/hash/shake",
          input: OpCodes.AnsiToBytes("abc"),
          outputLength: 16,
          expected: OpCodes.Hex8ToBytes("5881092dd818bf5cf8a3ddb793fbcba7")
        },
        {
          text: "SHAKE128 'abc' - 32 bytes output",
          uri: "https://asecuritysite.com/hash/shake",
          input: OpCodes.AnsiToBytes("abc"),
          outputLength: 32,
          expected: OpCodes.Hex8ToBytes("5881092dd818bf5cf8a3ddb793fbcba74097d5c526a6d35f97b83351940f2cc8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new SHAKE128AlgorithmInstance(this, isInverse);
    }
  }

  class SHAKE128AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // Default output size (can be changed)
      this.outputLength = 32; // XOF property for variable length

      // Initialize SHAKE128 hasher
      this.hasher = new Shake128Hasher();
    }

    /**
     * Initialize the hash function
     */
    Init() {
      this.hasher = new Shake128Hasher();
    }

    /**
     * Update hash with new data
     * @param {Array} data - Input data as byte array
     */
    Update(data) {
      this.hasher.absorb(data);
    }

    /**
     * Finalize and return hash
     * @returns {Array} Hash digest as byte array
     */
    Final() {
      return this.hasher.squeeze(this.outputLength || this.OutputSize);
    }

    /**
     * Hash a complete message in one operation
     * @param {Array} message - Message to hash as byte array
     * @returns {Array} Hash digest as byte array
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    KeySetup(key) {
      // Hashes don't use keys
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('SHAKE128 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this.hasher) {
        for (let i = 0; i < this.hasher.state.length; i++) {
          this.hasher.state[i] = [0, 0];
        }
        this.hasher.buffer.fill(0);
      }
    }

    /**
     * Feed method required by test suite - processes input data
     * @param {Array} data - Input data as byte array
     */
    Feed(data) {
      this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite - returns final hash
     * @returns {Array} Hash digest as byte array
     */
    Result() {
      return this.Final();
    }
  }
   
  // ===== REGISTRATION =====

  const algorithmInstance = new SHAKE128Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SHAKE128Algorithm, SHAKE128AlgorithmInstance };
}));