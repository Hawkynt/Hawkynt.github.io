/* AlgorithmFramework.js
 * Browser + Worker + Node (CJS/AMD-friendly) UMD
 * (c)2006-2025 Hawkynt
*/
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    const mod = factory();
    module.exports = mod;
    // ESM compatibility
    module.exports.default = mod;
    // Also assign to global for algorithm files to access
    if (typeof global !== 'undefined') {
      global.AlgorithmFramework = mod;
    }
  } else {
    // Browser/Worker global
    root.AlgorithmFramework = factory();
  }
}(
  // Standard UMD root detection
  (function() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    if (typeof global !== 'undefined') return global;
    if (typeof self !== 'undefined') return self;
    throw new Error('Unable to locate global object');
  })(),
  function () {
    'use strict';
      
    //#region ===== ENUMS =====
    const CategoryType = Object.freeze({
      ASYMMETRIC: { 
        name: 'Asymmetric Ciphers', 
        color: '#dc3545', // Red
        icon: '🔐',
        description: 'Public-key cryptography algorithms' 
      },
      BLOCK: { 
        name: 'Block Ciphers', 
        color: '#007bff', // Blue
        icon: '🧱',
        description: 'Block-based symmetric encryption' 
      },
      STREAM: { 
        name: 'Stream Ciphers', 
        color: '#17a2b8', // Light blue
        icon: '🌊',
        description: 'Stream-based symmetric encryption' 
      },
      HASH: { 
        name: 'Hash Functions', 
        color: '#ffc107', // Yellow
        icon: '#️⃣',
        description: 'Cryptographic hash algorithms' 
      },
      CHECKSUM: { 
        name: 'Checksums', 
        color: '#20c997', // Teal
        icon: '✔️',
        description: 'Checksum and integrity verification algorithms' 
      },
      COMPRESSION: { 
        name: 'Compression Algorithms', 
        color: '#28a745', // Green
        icon: '🗜️',
        description: 'Data compression algorithms' 
      },
      ENCODING: { 
        name: 'Encoding Schemes', 
        color: '#6f42c1', // Violet
        icon: '📝',
        description: 'Data encoding and representation' 
      },
      CLASSICAL: { 
        name: 'Classical Ciphers', 
        color: '#fd7e14', // Orange
        icon: '📜',
        description: 'Historical and educational ciphers' 
      },
      MAC: { 
        name: 'Message Authentication', 
        color: '#e83e8c', // Pink
        icon: '✅',
        description: 'Message authentication codes' 
      },
      KDF: { 
        name: 'Key Derivation Functions', 
        color: '#343a40', // Dark gray
        icon: '🔑',
        description: 'Key derivation and stretching functions' 
      },
      ECC: { 
        name: 'Error Correction', 
        color: '#17a2b8', // Info blue
        icon: '🔧',
        description: 'Error correction codes' 
      },
      MODE: { 
        name: 'Cipher Modes', 
        color: '#495057', // Gray
        icon: '⚙️',
        description: 'Block cipher modes of operation' 
      },
      PADDING: { 
        name: 'Padding Schemes', 
        color: '#6c757d', // Gray
        icon: '📦',
        description: 'Data padding algorithms' 
      },
      AEAD: { 
        name: 'Authenticated Encryption', 
        color: '#dc3545', // Red variant
        icon: '🛡️',
        description: 'Authenticated encryption with associated data' 
      },
      SPECIAL: { 
        name: 'Special Algorithms', 
        color: '#6f42c1', // Purple
        icon: '✨',
        description: 'Special purpose algorithms' 
      },
      PQC: { 
        name: 'Post-Quantum Cryptography', 
        color: '#e83e8c', // Pink variant
        icon: '🔮',
        description: 'Quantum-resistant cryptographic algorithms' 
      },
      RANDOM: { 
        name: 'Random Number Generators', 
        color: '#6c757d', // Gray
        icon: '🎲',
        description: 'Pseudo-random number generators' 
      }
    });

    const SecurityStatus = Object.freeze({
      SECURE: { name: 'Secure', color: '#28a745', icon: '🛡️' },
      DEPRECATED: { name: 'Deprecated', color: '#ffc107', icon: '⚠️' },
      BROKEN: { name: 'Broken', color: '#dc3545', icon: '❌' },
      OBSOLETE: { name: 'Obsolete', color: '#6c757d', icon: '📰' },
      EXPERIMENTAL: { name: 'Experimental', color: '#17a2b8', icon: '🧪' },
      EDUCATIONAL: { name: 'Educational Only', color: '#fd7e14', icon: '🎓' }
    });

    const ComplexityType = Object.freeze({
      BEGINNER: { name: 'Beginner', color: '#28a745', level: 1 },
      INTERMEDIATE: { name: 'Intermediate', color: '#ffc107', level: 2 },
      ADVANCED: { name: 'Advanced', color: '#fd7e14', level: 3 },
      EXPERT: { name: 'Expert', color: '#dc3545', level: 4 },
      RESEARCH: { name: 'Research', color: '#6f42c1', level: 5 }
    });

    const CountryCode = Object.freeze({
      US: { icon: '🇺🇸', name: 'United States' },
      RU: { icon: '🇷🇺', name: 'Russia' },
      CN: { icon: '🇨🇳', name: 'China' },
      UA: { icon: '🇺🇦', name: 'Ukraine' },
      DE: { icon: '🇩🇪', name: 'Germany' },
      GB: { icon: '🇬🇧', name: 'United Kingdom' },
      FR: { icon: '🇫🇷', name: 'France' },
      JP: { icon: '🇯🇵', name: 'Japan' },
      KR: { icon: '🇰🇷', name: 'South Korea' },
      IL: { icon: '🇮🇱', name: 'Israel' },
      BE: { icon: '🇧🇪', name: 'Belgium' },
      CA: { icon: '🇨🇦', name: 'Canada' },
      AU: { icon: '🇦🇺', name: 'Australia' },
      IT: { icon: '🇮🇹', name: 'Italy' },
      NL: { icon: '🇳🇱', name: 'Netherlands' },
      CH: { icon: '🇨🇭', name: 'Switzerland' },
      SE: { icon: '🇸🇪', name: 'Sweden' },
      NO: { icon: '🇳🇴', name: 'Norway' },
      IN: { icon: '🇮🇳', name: 'India' },
      BR: { icon: '🇧🇷', name: 'Brazil' },
      INTL: { icon: '🌐', name: 'International' },
      ANCIENT: { icon: '🏛️', name: 'Ancient' },
      UNKNOWN: { icon: '❓', name: 'Unknown' }
    });
    //#endregion

    //#region ===== Core Classes =====

    /**
     * Link item with text description and URI
     */
    class LinkItem {
      /**
       * @param {string} text - Display text
       * @param {string} uri - URL reference
       */
      constructor(text, uri) {
        /** @type {string} */
        this.text = text
        /** @type {string} */
        this.uri = uri
      }
    }

    /**
     * Test case with input data and expected output
     */
    class TestCase extends LinkItem {
      /**
       * @param {byte[]} input - Input data bytes
       * @param {byte[]} expected - Expected output bytes
       * @param {string} description - Test description
       * @param {string} uri - Reference URI
       */
      constructor(input, expected, description = '', uri = '') {
        super(description, uri)
        /** @type {byte[]} */
        this.input = input
        /** @type {byte[]} */
        this.expected = expected
      }
    }

    /**
     * Known vulnerability information
     */
    class Vulnerability extends LinkItem {
      /**
       * @param {string} type - Vulnerability type (short name)
       * @param {string} description - What the weakness is
       * @param {string} mitigation - Mitigation strategy
       * @param {string} uri - Reference URI
       */
      constructor(type, description = '', mitigation = '', uri = '') {
        super(type, uri)
        /** @type {string} */
        this.description = description
        /** @type {string} */
        this.mitigation = mitigation
      }
    }

    /**
     * Authentication result for AEAD operations
     */
    class AuthResult {
      /**
       * @param {bool} success - Whether authentication succeeded
       * @param {byte[]} output - Output data if successful
       * @param {string} failureReason - Reason for failure if unsuccessful
       */
      constructor(success, output = null, failureReason = null) {
        /** @type {bool} */
        this.Success = success
        /** @type {byte[]} */
        this.Output = output
        /** @type {string} */
        this.FailureReason = failureReason
      }
    }

    /**
     * Key size specification with min, max, and step
     */
    class KeySize {
      /**
       * @param {int} minSize - Minimum key size in bytes
       * @param {int} maxSize - Maximum key size in bytes
       * @param {int} stepSize - Step size between valid sizes
       */
      constructor(minSize, maxSize, stepSize = 1) {
        /** @type {int} */
        this.minSize = minSize
        /** @type {int} */
        this.maxSize = maxSize
        /** @type {int} */
        this.stepSize = stepSize
      }
    }
    //#endregion

    //#region ===== Shared Construction Primitives =====
    //
    // Every defect this region exists to prevent was found in code that each
    // algorithm had written for itself. The pattern is always the same: a rule
    // that is easy to state and easy to get subtly wrong, restated by hand in
    // dozens of files, where the copies disagree and only some of them are
    // right. The fix is not to document the rule but to put the only correct
    // spelling of it somewhere a caller cannot route around.
    //
    // They live here rather than in OpCodes because none of them is a bit
    // operation. OpCodes is a namespace of pure width-and-endianness helpers;
    // these are the shapes the Feed/Result contract takes, which is exactly
    // what this file already describes. Keeping them here also means a
    // migrating algorithm deletes code and imports nothing: every file already
    // has AlgorithmFramework in its dependency list, whereas a third module
    // would need a new entry in 933 UMD headers and a new script tag ordered
    // correctly in the browser.
    //
    // None of these needs OpCodes, so this file keeps its empty dependency list
    // and its position in the browser's script order stays free.

    /**
     * Reduce any numeric value to a byte, without bit operators.
     * @param {number} value
     * @returns {int} 0..255
     */
    function _byte(value) {
      const reduced = Math.trunc(value) % 256
      return reduced < 0 ? reduced + 256 : reduced
    }

    /**
     * Merge the set bits of two bytes.
     *
     * This is the whole of the SHA-3 and Keccak defect in one function. The
     * padded block ends with pad10*1's terminating bit in the top bit of the
     * last rate byte, and it begins with a domain separator at the first free
     * byte. When exactly one byte is free those are the same byte, and writing
     * the terminating bit *over* the separator instead of *into* it silently
     * dropped the separator, so every message of length rate-1 (mod rate)
     * hashed to the wrong value. Merging is the only correct operation, so it
     * is the only one offered.
     *
     * @param {int} a
     * @param {int} b
     * @returns {int} 0..255 with every bit set in either input
     */
    function _mergeBits(a, b) {
      const left = _byte(a)
      const right = _byte(b)
      let merged = 0
      let weight = 1
      for (let bit = 0; bit < 8; bit++) {
        if (Math.floor(left / weight) % 2 === 1 || Math.floor(right / weight) % 2 === 1)
          merged += weight
        weight *= 2
      }
      return merged
    }

    /**
     * Encode a length into a fixed-width big- or little-endian field.
     * @param {number} value
     * @param {int} byteCount
     * @param {bool} littleEndian
     * @returns {byte[]}
     */
    function _encodeLength(value, byteCount, littleEndian) {
      const encoded = new Array(byteCount).fill(0)
      let remaining = Math.max(0, Math.trunc(value))
      for (let i = 0; i < byteCount; i++) {
        encoded[littleEndian ? i : byteCount - 1 - i] = remaining % 256
        remaining = Math.floor(remaining / 256)
      }
      return encoded
    }

    /**
     * Block-buffered absorption that never hands over the final block.
     *
     * A hash that buffers bytes and compresses the moment the buffer fills has
     * no way to know whether the block it just compressed was the last one.
     * BLAKE2b was written that way and its finalization flag therefore missed
     * every message whose length is an exact multiple of the block size - 128,
     * 256, 384 and so on all hashed to the wrong value, while BLAKE2s in the
     * same file held the block back and was right. The two copies of one rule
     * disagreed because there were two copies.
     *
     * This class holds a full block back until more data proves it is not the
     * last. The flush happens at the top of a loop iteration that is about to
     * copy at least one more byte, so on return from Absorb the held block is
     * final as far as anyone knows. There is no public flush: a caller cannot
     * compress the final block early because it is never handed one.
     *
     * Finalization goes through Finish, which is the only way to see the held
     * bytes. Absorbers that need the last block treated differently - a
     * finalization flag, a domain constant, a padded length - get it there, and
     * absorbers that do not simply pad and compress.
     */
    class BlockAbsorber {
      /**
       * @param {int} blockSize - bytes per block
       * @param {function(byte[]):void} processBlock - receives a full block
       *        that is known not to be the last
       */
      constructor(blockSize, processBlock) {
        if (!(blockSize > 0)) throw new Error('BlockAbsorber: blockSize must be positive')
        if (typeof processBlock !== 'function')
          throw new Error('BlockAbsorber: processBlock must be a function')

        /** @type {int} */
        this._blockSize = blockSize
        /** @type {function(byte[]):void} */
        this._processBlock = processBlock
        /** @type {byte[]} */
        this._held = new Array(blockSize).fill(0)
        /** @type {int} - bytes valid in _held */
        this._pending = 0
        /** @type {number} - bytes absorbed since construction */
        this._length = 0
      }

      /** @returns {int} bytes per block */
      get BlockSize() { return this._blockSize }

      /** @returns {int} bytes held back, 0..BlockSize */
      get Pending() { return this._pending }

      /** @returns {number} total bytes absorbed */
      get Length() { return this._length }

      /**
       * Absorb data. Complete blocks are processed except the last one held.
       * @param {byte[]} data
       * @returns {void}
       */
      Absorb(data) {
        if (!data || data.length === 0) return
        const blockSize = this._blockSize
        const total = data.length
        let offset = 0

        while (offset < total) {
          // Reaching here means at least one more byte follows, so the block
          // sitting in the buffer is provably not the last one.
          if (this._pending === blockSize) {
            this._processBlock(this._held)
            this._pending = 0
          }

          const take = Math.min(blockSize - this._pending, total - offset)
          for (let i = 0; i < take; i++)
            this._held[this._pending + i] = _byte(data[offset + i])

          this._pending += take
          offset += take
          this._length += take
        }
      }

      /**
       * Hand the held bytes to a finalizer.
       *
       * The finalizer decides what the last block means: pad it, flag it, split
       * it into two. It receives a copy, so calling Finish twice gives the same
       * answer and neither call can corrupt the other.
       *
       * @param {function(byte[], int, number):*} finalize - (held, pending, totalLength)
       * @returns {*} whatever the finalizer returned
       */
      Finish(finalize) {
        if (typeof finalize !== 'function')
          throw new Error('BlockAbsorber: finalize must be a function')
        return finalize(this._held.slice(0, this._pending), this._pending, this._length)
      }

      /**
       * Forget everything absorbed so far.
       * @returns {void}
       */
      Reset() {
        this._held.fill(0)
        this._pending = 0
        this._length = 0
      }
    }

    /**
     * The padded block or blocks that end a sponge absorption.
     *
     * Implements pad10*1 with a domain separator, FIPS 202 sections 5.1 and
     * B.2. The separator goes at the first free byte and the terminating bit in
     * the top bit of the last rate byte; when exactly one byte is free those
     * coincide and must merge, which is the case every hand-written copy of
     * this got wrong. Here the merge is unconditional and is the last write, so
     * there is no branch for a caller to get wrong and no way to reach the
     * overwrite.
     *
     * Returns whole rate blocks ready to absorb, so it serves an absorber that
     * holds its last block back as well as one that does not: a full held block
     * simply yields two blocks instead of one.
     *
     * @param {byte[]} held - trailing message bytes, may be empty
     * @param {int} pending - how many of them are valid, 0..rate
     * @param {int} rate - sponge rate in bytes
     * @param {int} separator - domain separator, e.g. 0x06 SHA-3, 0x1F SHAKE,
     *        0x04 cSHAKE, 0x01 original Keccak
     * @returns {byte[][]} one or two blocks of exactly rate bytes
     */
    function SpongePadBlocks(held, pending, rate, separator) {
      if (!(rate > 0)) throw new Error('SpongePadBlocks: rate must be positive')
      if (pending < 0 || pending > rate)
        throw new Error(`SpongePadBlocks: pending ${pending} outside 0..${rate}`)

      const blocks = []
      let block = new Array(rate).fill(0)
      for (let i = 0; i < pending; i++) block[i] = _byte(held[i])

      let used = pending
      if (used === rate) {
        blocks.push(block)
        block = new Array(rate).fill(0)
        used = 0
      }

      block[used] = _byte(separator)
      // Unconditional, and last. When used === rate - 1 this merges the
      // separator with the terminating bit rather than replacing it.
      block[rate - 1] = _mergeBits(block[rate - 1], 0x80)

      blocks.push(block)
      return blocks
    }

    /**
     * The padded block or blocks that end a Merkle-Damgard absorption.
     *
     * One pad byte, zero fill, then the message length in a fixed-width field
     * at the end of the last block, with a second block when the length no
     * longer fits. Thirty files spell this out by hand, each with its own
     * spelling of the boundary test, and a boundary test that is off by one
     * corrupts exactly one message length in every block.
     *
     * @param {byte[]} held - trailing message bytes
     * @param {int} pending - how many are valid, 0..blockSize
     * @param {number} totalLength - total message length in bytes
     * @param {object} options
     * @param {int} options.blockSize - bytes per block
     * @param {int} [options.padByte=0x80] - 0x01 for Tiger
     * @param {int} [options.lengthBytes=8] - 16 for SHA-512, 0 for no length field
     * @param {bool} [options.lengthLittleEndian=false] - true for MD4, MD5, RIPEMD
     * @param {bool} [options.lengthInBits=true] - false where the field counts bytes
     * @returns {byte[][]} the blocks still to be compressed, in order
     */
    function MerkleDamgardBlocks(held, pending, totalLength, options) {
      const settings = options || {}
      const blockSize = settings.blockSize
      if (!(blockSize > 0)) throw new Error('MerkleDamgardBlocks: blockSize must be positive')
      if (pending < 0 || pending > blockSize)
        throw new Error(`MerkleDamgardBlocks: pending ${pending} outside 0..${blockSize}`)

      const padByte = settings.padByte === undefined ? 0x80 : settings.padByte
      const lengthBytes = settings.lengthBytes === undefined ? 8 : settings.lengthBytes
      const littleEndian = settings.lengthLittleEndian === true
      const inBits = settings.lengthInBits !== false

      if (lengthBytes < 0 || lengthBytes >= blockSize)
        throw new Error(`MerkleDamgardBlocks: lengthBytes ${lengthBytes} does not fit a ${blockSize}-byte block`)

      const blocks = []
      let block = new Array(blockSize).fill(0)
      for (let i = 0; i < pending; i++) block[i] = _byte(held[i])

      let used = pending
      // A held block that is already full leaves nowhere for the pad byte, so
      // it goes out as it stands and the padding starts a fresh block. Getting
      // this wrong writes the pad byte past the end of the block, where the
      // compression function never reads it.
      if (used === blockSize) {
        blocks.push(block)
        block = new Array(blockSize).fill(0)
        used = 0
      }

      block[used] = _byte(padByte)
      used++

      if (used > blockSize - lengthBytes) {
        blocks.push(block)
        block = new Array(blockSize).fill(0)
      }

      if (lengthBytes > 0) {
        const encoded = _encodeLength(inBits ? totalLength * 8 : totalLength, lengthBytes, littleEndian)
        for (let i = 0; i < lengthBytes; i++) block[blockSize - lengthBytes + i] = encoded[i]
      }

      blocks.push(block)
      return blocks
    }

    //#endregion

    //#region ===== Base Interfaces =====

    /**
     * Base interface for all algorithm instances
     * Implements the Feed/Result pattern for streaming data processing
     */
    class IAlgorithmInstance {
      /**
       * @param {Algorithm} algorithm - The parent algorithm
       */
      constructor(algorithm) {
        /** @type {Algorithm} */
        this.algorithm = algorithm
        /** @type {bool} */
        this.isInverse = false
        /** @type {byte[]} */
        this.inputBuffer = []
      }

      /**
       * Feed data into the algorithm for processing.
       *
       * Accumulates. It does not reinitialise, it does not replace, and it does
       * not consume: Feed(a); Feed(b) leaves exactly what Feed(a || b) leaves,
       * which is the streaming contract every caller already assumes and which
       * 103 algorithms broke by re-deriving it. The three ways they broke it -
       * calling Init() per chunk, assigning instead of appending, and buffering
       * a remainder nothing read back - are all unreachable from here, because
       * there is only the append.
       *
       * Overriding this is still allowed, and an algorithm that genuinely needs
       * its whole input at once should override it to throw on the second call.
       * What is no longer necessary is re-deriving the common case: an instance
       * that does not override Feed at all now gets the correct one rather than
       * an error.
       *
       * @param {byte[]} data - Input data bytes
       * @returns {void}
       */
      Feed(data) {
        if (!data || data.length === 0) return
        if (!this.inputBuffer) this.inputBuffer = []
        // Appended one at a time rather than spread: a spread of a data-sized
        // array is an argument list, and a long enough message overflows the
        // call stack instead of hashing.
        for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i])
      }

      /**
       * Get the processed result
       * @returns {byte[]} Output data bytes
       */
      Result() { throw 'Result() not implemented' }

      /**
       * Dispose of sensitive data
       * @returns {void}
       */
      Dispose() {
        if (this.inputBuffer) {
          this.inputBuffer.length = 0
        }
      }
    }

    /**
     * Base class for all cryptographic algorithms
     */
    class Algorithm {
      constructor() {
        /** @type {string} */
        this.name = null
        /** @type {string} */
        this.description = null
        /** @type {string} */
        this.inventor = null
        /** @type {int} */
        this.year = null
        /** @type {object} */
        this.category = null
        /** @type {string} */
        this.subCategory = null
        /** @type {object} */
        this.securityStatus = null
        /** @type {object} */
        this.complexity = null
        /** @type {object} */
        this.country = null
        /** @type {LinkItem[]} */
        this.documentation = []
        /** @type {LinkItem[]} */
        this.references = []
        /** @type {Vulnerability[]} */
        this.knownVulnerabilities = []
        /** @type {TestCase[]} */
        this.tests = []
      }

      /**
       * Create an instance of this algorithm
       * @param {bool} isInverse - True for decryption/decompression, false for encryption/compression
       * @returns {IAlgorithmInstance} Algorithm instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }
    //#endregion

    //#region ===== Family Placeholders =====

    /** @extends Algorithm */
    class CryptoAlgorithm extends Algorithm {}

    /** @extends CryptoAlgorithm */
    class SymmetricCipherAlgorithm extends CryptoAlgorithm {}

    /** @extends CryptoAlgorithm */
    class AsymmetricCipherAlgorithm extends CryptoAlgorithm {}

    /**
     * Base class for block cipher algorithms
     * @extends SymmetricCipherAlgorithm
     */
    class BlockCipherAlgorithm extends SymmetricCipherAlgorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedKeySizes = []
        /** @type {KeySize[]} */
        this.SupportedBlockSizes = []
      }

      /**
       * Create an instance of this block cipher
       * @param {bool} isInverse - True for decryption, false for encryption
       * @returns {IBlockCipherInstance} Block cipher instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for stream cipher algorithms
     * @extends SymmetricCipherAlgorithm
     */
    class StreamCipherAlgorithm extends SymmetricCipherAlgorithm {
      /**
       * Create an instance of this stream cipher
       * @param {bool} isInverse - True for decryption, false for encryption
       * @returns {IAlgorithmInstance} Stream cipher instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for encoding algorithms
     * @extends Algorithm
     */
    class EncodingAlgorithm extends Algorithm {
      /**
       * Create an instance of this encoding algorithm
       * @param {bool} isInverse - True for decoding, false for encoding
       * @returns {IAlgorithmInstance} Encoding instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for compression algorithms
     * @extends Algorithm
     */
    class CompressionAlgorithm extends Algorithm {
      /**
       * Create an instance of this compression algorithm
       * @param {bool} isInverse - True for decompression, false for compression
       * @returns {IAlgorithmInstance} Compression instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /** @extends Algorithm */
    class ErrorCorrectionAlgorithm extends Algorithm {}

    /**
     * Base class for hash function algorithms
     * @extends Algorithm
     */
    class HashFunctionAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedOutputSizes = []
      }

      /**
       * Create an instance of this hash function
       * @param {bool} isInverse - Ignored for hash functions (always false)
       * @returns {IHashFunctionInstance} Hash function instance
       */
      CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented' }
    }

    /**
     * Base class for MAC algorithms
     * @extends Algorithm
     */
    class MacAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedMacSizes = []
        /** @type {bool} */
        this.NeedsKey = true
      }
    }

    /**
     * Base class for KDF algorithms
     * @extends Algorithm
     */
    class KdfAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedOutputSizes = []
        /** @type {bool} */
        this.SaltRequired = true
      }
    }

    /** @extends Algorithm */
    class PaddingAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {bool} */
        this.IsLengthIncluded = false
      }
    }

    /** @extends Algorithm */
    class CipherModeAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {bool} */
        this.RequiresIV = true
        /** @type {KeySize[]} */
        this.SupportedIVSizes = []
      }
    }

    /** @extends CryptoAlgorithm */
    class AeadAlgorithm extends CryptoAlgorithm {
      constructor() {
        super()
        /** @type {KeySize[]} */
        this.SupportedTagSizes = []
        /** @type {bool} */
        this.SupportsDetached = false
      }
    }

    /** @extends Algorithm */
    class RandomGenerationAlgorithm extends Algorithm {
      constructor() {
        super()
        /** @type {bool} */
        this.IsDeterministic = false
        /** @type {bool} */
        this.IsCryptographicallySecure = true
        /** @type {KeySize[]} */
        this.SupportedSeedSizes = []
      }
    }
    //#endregion

    //#region ===== Instance Interface Extensions =====

    /**
     * Instance interface for block ciphers
     * @extends IAlgorithmInstance
     */
    class IBlockCipherInstance extends IAlgorithmInstance {
      /**
       * @param {BlockCipherAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {int} - Block size in bytes */
        this.BlockSize = 0
        /** @type {int} - Key size in bytes */
        this.KeySize = 0
        /** @type {byte[]} - Encryption/decryption key */
        this._key = null
      }

      /**
       * Set the encryption/decryption key
       * @param {byte[]} keyBytes - Key bytes
       */
      set key(keyBytes) { this._key = keyBytes }

      /**
       * Get the current key
       * @returns {byte[]} Key bytes
       */
      get key() { return this._key }

      /**
       * Encrypt a single block
       * @param {byte[]} block - Input block
       * @returns {byte[]} Encrypted block
       */
      EncryptBlock(block) { throw 'EncryptBlock() not implemented' }

      /**
       * Decrypt a single block
       * @param {byte[]} block - Encrypted block
       * @returns {byte[]} Decrypted block
       */
      DecryptBlock(block) { throw 'DecryptBlock() not implemented' }

      /**
       * Refuse a buffered input that is not a whole number of blocks.
       *
       * A raw block cipher has no padding scheme and therefore no answer for a
       * trailing partial block. The only two things it can do are refuse and
       * silently drop it, and dropping it destroys data without saying so.
       * Refusal is the established behaviour and this is its one spelling.
       *
       * @param {int} [blockSize] - defaults to this.BlockSize
       * @returns {int} number of whole blocks buffered
       * @throws {Error} if the buffered length is not a multiple of blockSize
       */
      RequireBlockMultiple(blockSize) {
        const size = blockSize || this.BlockSize
        if (!(size > 0)) throw new Error('BlockSize not set')
        const length = this.inputBuffer ? this.inputBuffer.length : 0
        if (length % size !== 0)
          throw new Error(`Input length must be multiple of ${size} bytes`)
        return length / size
      }

      /**
       * Encrypt or decrypt every buffered block.
       *
       * The guard, the loop and the drain in one place. A caller never writes
       * the loop bound, so the truncating bound `i + blockSize <= length` -
       * which drops a trailing partial block without a word - cannot be written
       * here at all.
       *
       * @returns {byte[]} the processed bytes
       * @throws {Error} if no key is set, nothing was fed, or the input is not
       *         a whole number of blocks
       */
      Result() {
        if (!this.key) throw new Error('Key not set')
        if (!this.inputBuffer || this.inputBuffer.length === 0)
          throw new Error('No data fed')

        const blockSize = this.BlockSize
        this.RequireBlockMultiple(blockSize)

        const output = []
        for (let offset = 0; offset < this.inputBuffer.length; offset += blockSize) {
          const block = this.inputBuffer.slice(offset, offset + blockSize)
          const processed = this.isInverse ? this.DecryptBlock(block) : this.EncryptBlock(block)
          for (let i = 0; i < processed.length; i++) output.push(processed[i])
        }

        this.inputBuffer = []
        return output
      }
    }

    /**
     * Instance interface for hash functions
     * @extends IAlgorithmInstance
     */
    class IHashFunctionInstance extends IAlgorithmInstance {
      /**
       * @param {HashFunctionAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {int} - Output hash size in bytes */
        this.OutputSize = 0
      }
    }

    /**
     * Instance interface for MAC algorithms
     * @extends IAlgorithmInstance
     */
    class IMacInstance extends IAlgorithmInstance {
      /**
       * Compute MAC over data
       * @param {byte[]} data - Input data
       * @returns {byte[]} MAC bytes
       */
      ComputeMac(data) { throw 'ComputeMac() not implemented' }
    }

    /**
     * Instance interface for KDF algorithms
     * @extends IAlgorithmInstance
     */
    class IKdfInstance extends IAlgorithmInstance {
      /**
       * @param {KdfAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {int} - Output key size in bytes */
        this.OutputSize = 0
        /** @type {int} - Number of iterations */
        this.Iterations = 0
      }
    }

    /**
     * Instance interface for AEAD algorithms
     * @extends IAlgorithmInstance
     */
    class IAeadInstance extends IAlgorithmInstance {
      /**
       * @param {AeadAlgorithm} algorithm - Parent algorithm
       */
      constructor(algorithm) {
        super(algorithm)
        /** @type {byte[]} - Additional authenticated data */
        this.aad = []
        /** @type {int} - Authentication tag size in bytes */
        this.tagSize = 0
      }
    }

    /**
     * Instance interface for error correction algorithms
     * @extends IAlgorithmInstance
     */
    class IErrorCorrectionInstance extends IAlgorithmInstance {
      /**
       * Detect errors in data
       * @param {byte[]} data - Input data
       * @returns {bool} True if errors detected
       */
      DetectError(data) { throw 'DetectError() not implemented' }
    }

    /**
     * Instance interface for random number generators
     * @extends IAlgorithmInstance
     */
    class IRandomGeneratorInstance extends IAlgorithmInstance {
      /**
       * Generate random bytes
       * @param {int} count - Number of bytes to generate
       * @returns {byte[]} Random bytes
       */
      NextBytes(count) { throw 'NextBytes() not implemented' }
    }
    //#endregion

    // #region Registry
    const Algorithms = [];
    
    function RegisterAlgorithm(algorithm) { 
      // Validate algorithm
      if (!algorithm || typeof algorithm !== 'object') {
        throw new Error('RegisterAlgorithm: Invalid algorithm object');
      }
      
      if (!algorithm.name || typeof algorithm.name !== 'string') {
        throw new Error('RegisterAlgorithm: Algorithm must have a valid name');
      }
      
      // Check for duplicate names
      if (Algorithms.find(a => a.name === algorithm.name)) {
        throw new Error(`RegisterAlgorithm: Algorithm '${algorithm.name}' already registered`);
      }
      
      // Process and validate test vectors
      if (algorithm.tests && Array.isArray(algorithm.tests)) {
        algorithm.tests = algorithm.tests.map((test, index) => {
          return _processTestVector(test, index, algorithm.name);
        });
      }
      
      Algorithms.push(algorithm);
    }
    
    function _processTestVector(test, index, algorithmName) {
      // Ensure test is a TestCase object or convert it
      if (!(test instanceof TestCase)) {
        // Convert plain object to TestCase
        if (test && typeof test === 'object' && test.input !== undefined) {
          const description = test.text  || `Test vector #${index + 1}`;
          const uri = test.uri || '';

          // Allow test vectors without 'expected' for round-trip testing
          // If no expected value, use empty array to signal round-trip mode
          const expected = test.expected !== undefined ? test.expected : [];
          const result = new TestCase(test.input, expected, description, uri);

          // Copy any additional properties (key, iv, outputSize, etc.)
          Object.keys(test).forEach(key => {
            if (!['input', 'expected', 'text', 'uri'].includes(key))
              result[key] = test[key];

          });

          return result;
        } else {
          throw new Error(`RegisterAlgorithm: Invalid test vector #${index + 1} in algorithm '${algorithmName}' - must have at least 'input' field`);
        }
      }

      // Validate that test is a TestCase with at least input
      if (test.input === undefined) {
        throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' missing input`);
      }

      // Validate that input is byte array or null
      if (!Array.isArray(test.input) && test.input !== null) {
        throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' has invalid input (must be byte array or null)`);
      }

      // Validate that expected is byte array if provided (allow empty for round-trip)
      if (test.expected !== undefined && !Array.isArray(test.expected)) {
        throw new Error(`RegisterAlgorithm: Test vector #${index + 1} in algorithm '${algorithmName}' has invalid expected (must be byte array)`);
      }

      return test;
    }
    
    function Find(name) { return Algorithms.find(a => a.name === name) || null }
    function Clear() { Algorithms.length = 0 }
    // #endregion

    // === expose everything needed by consumers ===
    return {
      // registering
      RegisterAlgorithm,
      
      // enums
      CategoryType,
      SecurityStatus,
      ComplexityType,
      CountryCode,

      // core
      LinkItem,
      TestCase,
      Vulnerability,
      AuthResult,
      KeySize,

      // shared construction primitives
      BlockAbsorber,
      SpongePadBlocks,
      MerkleDamgardBlocks,

      // base + families
      Algorithm,
      CryptoAlgorithm,
      SymmetricCipherAlgorithm,
      AsymmetricCipherAlgorithm,
      BlockCipherAlgorithm,
      StreamCipherAlgorithm,
      EncodingAlgorithm,
      CompressionAlgorithm,
      ErrorCorrectionAlgorithm,
      HashFunctionAlgorithm,
      MacAlgorithm,
      KdfAlgorithm,
      PaddingAlgorithm,
      CipherModeAlgorithm,
      AeadAlgorithm,
      RandomGenerationAlgorithm,
      
      // instances
      IAlgorithmInstance,
      IBlockCipherInstance,
      IHashFunctionInstance,
      IMacInstance,
      IKdfInstance,
      IAeadInstance,
      IErrorCorrectionInstance,
      IRandomGeneratorInstance,

      // registry
      Algorithms,
      Find,
      Clear
    };
  }
));
