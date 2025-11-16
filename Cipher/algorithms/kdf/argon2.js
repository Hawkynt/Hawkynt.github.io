/*
 * Argon2 Password Hashing Competition Winner (2015)
 * Universal Implementation - Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Based on PHC reference implementation and RFC 9106 specification
 * Implements all three variants: Argon2d, Argon2i, and Argon2id
 *
 * Educational implementation for learning purposes only.
 * Use proven cryptographic libraries for production systems.
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
          KdfAlgorithm, IKdfInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ARGON2 CONSTANTS =====

  const ARGON2_VERSION = 0x13; // Version 1.3 (current standard)
  const ARGON2_BLOCK_SIZE = 1024; // Block size in bytes (1 KB)
  const ARGON2_QWORDS_IN_BLOCK = ARGON2_BLOCK_SIZE / 8; // 128 qwords per block
  const ARGON2_SYNC_POINTS = 4; // Number of synchronization points

  // Argon2 variant types
  const Argon2Type = Object.freeze({
    Argon2d: 0,  // Data-dependent (max resistance to GPU attacks)
    Argon2i: 1,  // Data-independent (side-channel resistant)
    Argon2id: 2  // Hybrid (recommended for general use)
  });

  // ===== BLAKE2B LONG HASH =====

  /**
   * Blake2b-based long hash function used in Argon2
   * Similar to Blake2b but can produce outputs > 64 bytes
   */
  function blake2bLong(input, outputLength) {
    const BLAKE2B_OUTBYTES = 64;

    if (outputLength <= BLAKE2B_OUTBYTES) {
      return blake2b(input, null, outputLength);
    }

    // For outputs > 64 bytes, use extended construction
    const result = new Uint8Array(outputLength);

    // First block: H0 = H(LE32(outputLength) || input)
    const lengthBytes = new Uint8Array(4);
    lengthBytes[0] = outputLength & 0xFF;
    lengthBytes[1] = (outputLength >> 8) & 0xFF;
    lengthBytes[2] = (outputLength >> 16) & 0xFF;
    lengthBytes[3] = (outputLength >> 24) & 0xFF;

    const firstInput = new Uint8Array(lengthBytes.length + input.length);
    firstInput.set(lengthBytes, 0);
    firstInput.set(input, lengthBytes.length);

    const v = blake2b(firstInput, null, BLAKE2B_OUTBYTES);
    result.set(v.slice(0, Math.min(BLAKE2B_OUTBYTES / 2, outputLength)), 0);

    let pos = BLAKE2B_OUTBYTES / 2;

    // Generate remaining blocks: Hi = H(Hi-1)
    let prevHash = v;
    while (pos < outputLength) {
      const currentHash = blake2b(prevHash, null, BLAKE2B_OUTBYTES);
      const toCopy = Math.min(BLAKE2B_OUTBYTES / 2, outputLength - pos);
      result.set(currentHash.slice(0, toCopy), pos);
      pos += BLAKE2B_OUTBYTES / 2;
      prevHash = currentHash;
    }

    return result;
  }

  /**
   * Standard Blake2b hash function
   */
  function blake2b(input, key, outputLength) {
    const BLAKE2B_BLOCKBYTES = 128;
    const BLAKE2B_OUTBYTES = 64;

    const IV = [
      BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
      BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
      BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
      BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
    ];

    const SIGMA = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
      [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
      [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
      [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
      [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
      [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
      [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
      [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
      [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
    ];

    function rotr64(x, n) {
      const mask = BigInt('0xffffffffffffffff');
      x = x & mask;
      n = BigInt(n) & BigInt(63);
      return ((x >> n) | (x << (BigInt(64) - n))) & mask;
    }

    function G(v, a, b, c, d, x, y) {
      const mask = BigInt('0xffffffffffffffff');
      v[a] = (v[a] + v[b] + x) & mask;
      v[d] = rotr64(v[d] ^ v[a], 32);
      v[c] = (v[c] + v[d]) & mask;
      v[b] = rotr64(v[b] ^ v[c], 24);
      v[a] = (v[a] + v[b] + y) & mask;
      v[d] = rotr64(v[d] ^ v[a], 16);
      v[c] = (v[c] + v[d]) & mask;
      v[b] = rotr64(v[b] ^ v[c], 63);
    }

    function compress(h, block, counter, finalBlock) {
      const v = new Array(16);

      for (let i = 0; i < 8; i++) v[i] = h[i];
      for (let i = 0; i < 8; i++) v[i + 8] = IV[i];

      v[12] ^= counter & BigInt('0xffffffffffffffff');
      v[13] ^= (counter >> BigInt(64)) & BigInt('0xffffffffffffffff');
      if (finalBlock) v[14] ^= BigInt('0xffffffffffffffff');

      for (let round = 0; round < 12; round++) {
        const s = SIGMA[round % 10];
        G(v, 0, 4, 8, 12, block[s[0]], block[s[1]]);
        G(v, 1, 5, 9, 13, block[s[2]], block[s[3]]);
        G(v, 2, 6, 10, 14, block[s[4]], block[s[5]]);
        G(v, 3, 7, 11, 15, block[s[6]], block[s[7]]);
        G(v, 0, 5, 10, 15, block[s[8]], block[s[9]]);
        G(v, 1, 6, 11, 12, block[s[10]], block[s[11]]);
        G(v, 2, 7, 8, 13, block[s[12]], block[s[13]]);
        G(v, 3, 4, 9, 14, block[s[14]], block[s[15]]);
      }

      for (let i = 0; i < 8; i++) {
        h[i] ^= v[i] ^ v[i + 8];
      }
    }

    function bytesToWords64LE(bytes) {
      const words = [];
      for (let i = 0; i < bytes.length; i += 8) {
        let word = BigInt(0);
        for (let j = 0; j < 8 && i + j < bytes.length; j++) {
          word |= BigInt(bytes[i + j]) << BigInt(j * 8);
        }
        words.push(word);
      }
      return words;
    }

    function words64ToBytes(words, length) {
      const bytes = new Uint8Array(length);
      let byteIndex = 0;
      for (let i = 0; i < words.length && byteIndex < length; i++) {
        let word = words[i];
        for (let j = 0; j < 8 && byteIndex < length; j++) {
          bytes[byteIndex++] = Number(word & BigInt('0xff'));
          word >>= BigInt(8);
        }
      }
      return bytes;
    }

    // Initialize state
    const h = [...IV];
    h[0] ^= BigInt(outputLength || BLAKE2B_OUTBYTES) |
            (BigInt(key ? key.length : 0) << BigInt(8)) |
            (BigInt(1) << BigInt(16)) |
            (BigInt(1) << BigInt(24));

    let counter = BigInt(0);
    const buffer = new Uint8Array(BLAKE2B_BLOCKBYTES);
    let bufferPos = 0;

    // Process key if provided
    if (key && key.length > 0) {
      const keyPadded = new Uint8Array(BLAKE2B_BLOCKBYTES);
      for (let i = 0; i < key.length && i < 64; i++) {
        keyPadded[i] = key[i];
      }
      counter += BigInt(BLAKE2B_BLOCKBYTES);
      const m = bytesToWords64LE(keyPadded);
      while (m.length < 16) m.push(BigInt(0));
      compress(h, m, counter, false);
    }

    // Process input
    for (let i = 0; i < input.length; i++) {
      buffer[bufferPos++] = input[i];

      if (bufferPos === BLAKE2B_BLOCKBYTES) {
        counter += BigInt(BLAKE2B_BLOCKBYTES);
        const m = bytesToWords64LE(buffer);
        while (m.length < 16) m.push(BigInt(0));
        compress(h, m, counter, false);
        bufferPos = 0;
      }
    }

    // Final block
    counter += BigInt(bufferPos);
    for (let i = bufferPos; i < BLAKE2B_BLOCKBYTES; i++) {
      buffer[i] = 0;
    }
    const m = bytesToWords64LE(buffer);
    while (m.length < 16) m.push(BigInt(0));
    compress(h, m, counter, true);

    return words64ToBytes(h, outputLength || BLAKE2B_OUTBYTES);
  }

  // ===== ARGON2 CORE FUNCTIONS =====

  /**
   * fBlaMka mixing function: fBlaMka(x, y) = x + y + 2 * (x & 0xFFFFFFFF) * (y & 0xFFFFFFFF)
   */
  function fBlaMka(x, y) {
    const mask32 = BigInt('0xFFFFFFFF');
    const mask64 = BigInt('0xFFFFFFFFFFFFFFFF');
    const xy = (x & mask32) * (y & mask32);
    return (x + y + (xy << BigInt(1))) & mask64;
  }

  /**
   * BlaMka G permutation function
   */
  function blamkaG(a, b, c, d) {
    a = fBlaMka(a, b);
    d = OpCodes.RotR64n(d ^ a, 32);
    c = fBlaMka(c, d);
    b = OpCodes.RotR64n(b ^ c, 24);
    a = fBlaMka(a, b);
    d = OpCodes.RotR64n(d ^ a, 16);
    c = fBlaMka(c, d);
    b = OpCodes.RotR64n(b ^ c, 63);
    return [a, b, c, d];
  }

  /**
   * Argon2 block compression function (P permutation)
   */
  function blamkaRound(block) {
    // Apply column-wise permutation
    for (let i = 0; i < 8; i++) {
      const [a, b, c, d] = blamkaG(
        block[i], block[i + 32], block[i + 64], block[i + 96]
      );
      block[i] = a;
      block[i + 32] = b;
      block[i + 64] = c;
      block[i + 96] = d;
    }

    for (let i = 0; i < 8; i++) {
      const [a, b, c, d] = blamkaG(
        block[i + 8], block[i + 40], block[i + 72], block[i + 104]
      );
      block[i + 8] = a;
      block[i + 40] = b;
      block[i + 72] = c;
      block[i + 104] = d;
    }

    for (let i = 0; i < 8; i++) {
      const [a, b, c, d] = blamkaG(
        block[i + 16], block[i + 48], block[i + 80], block[i + 112]
      );
      block[i + 16] = a;
      block[i + 48] = b;
      block[i + 80] = c;
      block[i + 112] = d;
    }

    for (let i = 0; i < 8; i++) {
      const [a, b, c, d] = blamkaG(
        block[i + 24], block[i + 56], block[i + 88], block[i + 120]
      );
      block[i + 24] = a;
      block[i + 56] = b;
      block[i + 88] = c;
      block[i + 120] = d;
    }

    // Apply row-wise permutation
    for (let i = 0; i < 8; i++) {
      const idx = i * 16;
      const [a, b, c, d] = blamkaG(
        block[idx], block[idx + 4], block[idx + 8], block[idx + 12]
      );
      block[idx] = a;
      block[idx + 4] = b;
      block[idx + 8] = c;
      block[idx + 12] = d;
    }

    for (let i = 0; i < 8; i++) {
      const idx = i * 16;
      const [a, b, c, d] = blamkaG(
        block[idx + 1], block[idx + 5], block[idx + 9], block[idx + 13]
      );
      block[idx + 1] = a;
      block[idx + 5] = b;
      block[idx + 9] = c;
      block[idx + 13] = d;
    }

    for (let i = 0; i < 8; i++) {
      const idx = i * 16;
      const [a, b, c, d] = blamkaG(
        block[idx + 2], block[idx + 6], block[idx + 10], block[idx + 14]
      );
      block[idx + 2] = a;
      block[idx + 6] = b;
      block[idx + 10] = c;
      block[idx + 14] = d;
    }

    for (let i = 0; i < 8; i++) {
      const idx = i * 16;
      const [a, b, c, d] = blamkaG(
        block[idx + 3], block[idx + 7], block[idx + 11], block[idx + 15]
      );
      block[idx + 3] = a;
      block[idx + 7] = b;
      block[idx + 11] = c;
      block[idx + 15] = d;
    }
  }

  /**
   * Compress two blocks into one using BlaMka
   */
  function compressBlocks(block1, block2) {
    const R = new Array(ARGON2_QWORDS_IN_BLOCK);
    const Z = new Array(ARGON2_QWORDS_IN_BLOCK);

    // R = block1 XOR block2
    for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      R[i] = block1[i] ^ block2[i];
    }

    // Z = P(R)
    for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      Z[i] = R[i];
    }
    blamkaRound(Z);

    // Result = Z XOR R
    for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      R[i] ^= Z[i];
    }

    return R;
  }

  /**
   * Initial hashing of inputs (H0)
   */
  function initialHash(password, salt, timeCost, memoryCost, parallelism, outputLength, type, secret, ad) {
    // Build initial hash input: H0 = H(
    //   LE32(parallelism) || LE32(outputLength) || LE32(memoryCost) || LE32(timeCost) ||
    //   LE32(version) || LE32(type) ||
    //   LE32(pwdlen) || password ||
    //   LE32(saltlen) || salt ||
    //   LE32(secretlen) || secret ||
    //   LE32(adlen) || ad
    // )

    const params = [
      parallelism, outputLength, memoryCost, timeCost,
      ARGON2_VERSION, type,
      password.length
    ];

    let totalLength = 4 * params.length + password.length + 4 + salt.length;
    if (secret && secret.length > 0) totalLength += 4 + secret.length;
    if (ad && ad.length > 0) totalLength += 4 + ad.length;

    const input = new Uint8Array(totalLength);
    let pos = 0;

    // Write parameters as LE32
    for (const param of params) {
      input[pos++] = param & 0xFF;
      input[pos++] = (param >> 8) & 0xFF;
      input[pos++] = (param >> 16) & 0xFF;
      input[pos++] = (param >> 24) & 0xFF;
    }

    // Write password
    input.set(password, pos);
    pos += password.length;

    // Write salt length and salt
    input[pos++] = salt.length & 0xFF;
    input[pos++] = (salt.length >> 8) & 0xFF;
    input[pos++] = (salt.length >> 16) & 0xFF;
    input[pos++] = (salt.length >> 24) & 0xFF;
    input.set(salt, pos);
    pos += salt.length;

    // Write secret if present
    if (secret && secret.length > 0) {
      input[pos++] = secret.length & 0xFF;
      input[pos++] = (secret.length >> 8) & 0xFF;
      input[pos++] = (secret.length >> 16) & 0xFF;
      input[pos++] = (secret.length >> 24) & 0xFF;
      input.set(secret, pos);
      pos += secret.length;
    }

    // Write associated data if present
    if (ad && ad.length > 0) {
      input[pos++] = ad.length & 0xFF;
      input[pos++] = (ad.length >> 8) & 0xFF;
      input[pos++] = (ad.length >> 16) & 0xFF;
      input[pos++] = (ad.length >> 24) & 0xFF;
      input.set(ad, pos);
      pos += ad.length;
    }

    return blake2b(input, null, 64);
  }

  /**
   * Generate initial block for a lane
   */
  function generateInitialBlock(h0, lane, i) {
    const input = new Uint8Array(72);
    input.set(h0, 0);
    input[64] = lane & 0xFF;
    input[65] = (lane >> 8) & 0xFF;
    input[66] = (lane >> 16) & 0xFF;
    input[67] = (lane >> 24) & 0xFF;
    input[68] = i & 0xFF;
    input[69] = (i >> 8) & 0xFF;
    input[70] = (i >> 16) & 0xFF;
    input[71] = (i >> 24) & 0xFF;

    const blockBytes = blake2bLong(input, ARGON2_BLOCK_SIZE);
    const block = new Array(ARGON2_QWORDS_IN_BLOCK);

    for (let j = 0; j < ARGON2_QWORDS_IN_BLOCK; j++) {
      let qword = BigInt(0);
      const offset = j * 8;
      for (let k = 0; k < 8; k++) {
        qword |= BigInt(blockBytes[offset + k]) << BigInt(k * 8);
      }
      block[j] = qword;
    }

    return block;
  }

  /**
   * Index generation for Argon2i/Argon2id (data-independent addressing)
   */
  function generateAddresses(position, memory, zeroBlock, inputBlock, addressBlock) {
    inputBlock[0] = BigInt(position.pass);
    inputBlock[1] = BigInt(position.lane);
    inputBlock[2] = BigInt(position.slice);
    inputBlock[3] = BigInt(memory.length);
    inputBlock[4] = BigInt(position.timeCost);
    inputBlock[5] = BigInt(position.type);

    for (let i = 6; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      inputBlock[i] = BigInt(0);
    }

    const tmpBlock = compressBlocks(zeroBlock, inputBlock);
    const tmpBlock2 = compressBlocks(zeroBlock, tmpBlock);

    for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      addressBlock[i] = tmpBlock2[i];
    }
  }

  /**
   * Get reference block index
   */
  function getRefIndex(position, pseudoRand, sameLane, memory, segmentLength, laneLength) {
    let referenceAreaSize;
    let startPos;

    if (position.pass === 0) {
      if (position.slice === 0) {
        referenceAreaSize = position.index - 1;
      } else {
        if (sameLane) {
          referenceAreaSize = position.slice * segmentLength + position.index - 1;
        } else {
          referenceAreaSize = position.slice * segmentLength - (position.index === 0 ? 1 : 0);
        }
      }
    } else {
      if (sameLane) {
        referenceAreaSize = laneLength - segmentLength + position.index - 1;
      } else {
        referenceAreaSize = laneLength - segmentLength - (position.index === 0 ? 1 : 0);
      }
    }

    const relativePos = Number(pseudoRand & BigInt('0xFFFFFFFF'));
    const relativePosBig = BigInt(relativePos);
    let area = (relativePosBig * relativePosBig) >> BigInt(32);
    area = (BigInt(referenceAreaSize) - BigInt(1) - ((BigInt(referenceAreaSize) * area) >> BigInt(32)));

    if (position.pass !== 0 && position.slice !== ARGON2_SYNC_POINTS - 1) {
      startPos = 0;
    } else {
      startPos = position.pass !== 0 ?
        ((position.slice + 1) * segmentLength) :
        0;
    }

    const absPos = (startPos + Number(area)) % laneLength;
    return absPos;
  }

  /**
   * Fill a segment of a lane
   */
  function fillSegment(position, memory, segmentLength, laneLength, lanes, timeCost, type) {
    const dataIndependent = (type === Argon2Type.Argon2i) ||
                           (type === Argon2Type.Argon2id && position.pass === 0 && position.slice < ARGON2_SYNC_POINTS / 2);

    const zeroBlock = new Array(ARGON2_QWORDS_IN_BLOCK).fill(BigInt(0));
    const inputBlock = new Array(ARGON2_QWORDS_IN_BLOCK).fill(BigInt(0));
    const addressBlock = new Array(ARGON2_QWORDS_IN_BLOCK).fill(BigInt(0));
    let addressCounter = 0;

    if (dataIndependent) {
      generateAddresses({ ...position, timeCost, type }, memory, zeroBlock, inputBlock, addressBlock);
    }

    const startingIndex = position.pass === 0 && position.slice === 0 ? 2 : 0;
    const currentOffset = position.lane * laneLength + position.slice * segmentLength + startingIndex;

    let prevOffset;
    if (startingIndex === 0 && position.slice === 0) {
      prevOffset = position.lane * laneLength + laneLength - 1;
    } else {
      prevOffset = currentOffset - 1;
    }

    for (let i = startingIndex; i < segmentLength; i++) {
      if (currentOffset + i >= memory.length) break;

      const localPos = {
        pass: position.pass,
        lane: position.lane,
        slice: position.slice,
        index: i,
        timeCost,
        type
      };

      let pseudoRand;
      if (dataIndependent) {
        if (addressCounter % ARGON2_QWORDS_IN_BLOCK === 0) {
          inputBlock[6]++;
          generateAddresses(localPos, memory, zeroBlock, inputBlock, addressBlock);
          addressCounter = 0;
        }
        pseudoRand = addressBlock[addressCounter++];
      } else {
        pseudoRand = memory[prevOffset][0];
      }

      const refLane = position.pass === 0 && position.slice === 0 ?
        position.lane :
        Number((pseudoRand >> BigInt(32)) % BigInt(lanes));

      const sameLane = refLane === position.lane;
      const refIndex = getRefIndex(localPos, pseudoRand, sameLane, memory, segmentLength, laneLength);
      const refBlock = memory[refLane * laneLength + refIndex];

      const currentBlock = compressBlocks(memory[prevOffset], refBlock);

      if (position.pass === 0) {
        memory[currentOffset + i] = currentBlock;
      } else {
        for (let j = 0; j < ARGON2_QWORDS_IN_BLOCK; j++) {
          memory[currentOffset + i][j] ^= currentBlock[j];
        }
      }

      prevOffset = currentOffset + i;
    }
  }

  /**
   * Main Argon2 computation
   */
  function argon2(password, salt, timeCost, memoryCost, parallelism, outputLength, type, secret, ad) {
    // Validate parameters
    if (timeCost < 1) throw new Error('Time cost must be at least 1');
    if (memoryCost < 8 * parallelism) throw new Error('Memory cost too small');
    if (parallelism < 1) throw new Error('Parallelism must be at least 1');
    if (outputLength < 4) throw new Error('Output length must be at least 4');

    // Calculate memory layout
    const memoryBlocks = Math.floor(memoryCost / parallelism) * parallelism;
    const laneLength = Math.floor(memoryBlocks / parallelism);
    const segmentLength = Math.floor(laneLength / ARGON2_SYNC_POINTS);

    // Initial hash
    const h0 = initialHash(password, salt, timeCost, memoryCost, parallelism, outputLength, type, secret, ad);

    // Allocate memory
    const memory = new Array(memoryBlocks);

    // Fill first two blocks of each lane
    for (let lane = 0; lane < parallelism; lane++) {
      memory[lane * laneLength + 0] = generateInitialBlock(h0, lane, 0);
      memory[lane * laneLength + 1] = generateInitialBlock(h0, lane, 1);
    }

    // Process all passes
    for (let pass = 0; pass < timeCost; pass++) {
      for (let slice = 0; slice < ARGON2_SYNC_POINTS; slice++) {
        for (let lane = 0; lane < parallelism; lane++) {
          const position = { pass, lane, slice };
          fillSegment(position, memory, segmentLength, laneLength, parallelism, timeCost, type);
        }
      }
    }

    // Final block XOR
    const finalBlock = new Array(ARGON2_QWORDS_IN_BLOCK);
    for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      finalBlock[i] = memory[laneLength - 1][i];
    }

    for (let lane = 1; lane < parallelism; lane++) {
      const lastBlockIndex = lane * laneLength + laneLength - 1;
      for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
        finalBlock[i] ^= memory[lastBlockIndex][i];
      }
    }

    // Convert final block to bytes
    const finalBlockBytes = new Uint8Array(ARGON2_BLOCK_SIZE);
    for (let i = 0; i < ARGON2_QWORDS_IN_BLOCK; i++) {
      let qword = finalBlock[i];
      const offset = i * 8;
      for (let j = 0; j < 8; j++) {
        finalBlockBytes[offset + j] = Number(qword & BigInt('0xFF'));
        qword >>= BigInt(8);
      }
    }

    // Generate final output
    return blake2bLong(finalBlockBytes, outputLength);
  }

  // ===== ALGORITHM CLASSES =====

  /**
   * Argon2d - Data-dependent variant
   */
  class Argon2dAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      this.name = "Argon2d";
      this.description = "Password Hashing Competition winner (2015) - data-dependent variant providing maximum resistance to GPU cracking attacks but vulnerable to side-channel attacks. Uses memory access patterns dependent on password content.";
      this.inventor = "Alex Biryukov, Daniel Dinu, Dmitry Khovratovich";
      this.year = 2015;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(4, 1024, 1)];
      this.SaltRequired = true;

      this.documentation = [
        new LinkItem("RFC 9106 - Argon2 Memory-Hard Function for Password Hashing", "https://datatracker.ietf.org/doc/html/rfc9106"),
        new LinkItem("Argon2 Specification", "https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf"),
        new LinkItem("Password Hashing Competition", "https://www.password-hashing.net/")
      ];

      this.references = [
        new LinkItem("PHC Winner Argon2 Reference Implementation", "https://github.com/P-H-C/phc-winner-argon2"),
        new LinkItem("Botan Argon2 Implementation", "https://botan.randombit.net/"),
        new LinkItem("NIST - Password-Based Key Derivation", "https://csrc.nist.gov/projects/password-hashing")
      ];

      // Test vectors from Botan argon2.vec (official test vectors)
      this.tests = [
        {
          text: "Botan Official Test Vector - Argon2d (M=32, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 32,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("512b391b6f1162975371d30919734294f868e3be3984f3c1a13a4db9fabe4acb")
        },
        {
          text: "Botan Official Test Vector - Argon2d (M=64, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 64,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("ab75c7556cd63bbaa818e02dbdfe8c69e80375d64b31d6a7b2bf41da7f7c9951")
        },
        {
          text: "Botan Official Test Vector - Argon2d (M=128, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 128,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("5fc18a6a56b67cadf60287babc490ca0e866f0880a2b51e56a0ab0a640179d13")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, Argon2Type.Argon2d);
    }
  }

  /**
   * Argon2i - Data-independent variant
   */
  class Argon2iAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      this.name = "Argon2i";
      this.description = "Password Hashing Competition winner (2015) - data-independent variant resistant to side-channel attacks. Memory access patterns are independent of password content, making it suitable for password hashing in environments with potential side-channel threats.";
      this.inventor = "Alex Biryukov, Daniel Dinu, Dmitry Khovratovich";
      this.year = 2015;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(4, 1024, 1)];
      this.SaltRequired = true;

      this.documentation = [
        new LinkItem("RFC 9106 - Argon2 Memory-Hard Function for Password Hashing", "https://datatracker.ietf.org/doc/html/rfc9106"),
        new LinkItem("Argon2 Specification", "https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf"),
        new LinkItem("Password Hashing Competition", "https://www.password-hashing.net/")
      ];

      this.references = [
        new LinkItem("PHC Winner Argon2 Reference Implementation", "https://github.com/P-H-C/phc-winner-argon2"),
        new LinkItem("Botan Argon2 Implementation", "https://botan.randombit.net/"),
        new LinkItem("NIST - Password-Based Key Derivation", "https://csrc.nist.gov/projects/password-hashing")
      ];

      // Test vectors from Botan argon2.vec (official test vectors)
      this.tests = [
        {
          text: "Botan Official Test Vector - Argon2i (M=32, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 32,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("c814d9d1dc7f37aa13f0d77f2494bda1c8de6b016dd388d29952a4c4672b6ce8")
        },
        {
          text: "Botan Official Test Vector - Argon2i (M=64, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 64,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0f639e5eb9ae1d4d582ccb6033b95551f916a2bdf48ae23d2b8ba4414eb6a182")
        },
        {
          text: "Botan Official Test Vector - Argon2i (M=128, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 128,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("88031ec2094b24a9c4399e7f3fdaa5701dc3bae89917c6ba582e924a547a623d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, Argon2Type.Argon2i);
    }
  }

  /**
   * Argon2id - Hybrid variant (RECOMMENDED)
   */
  class Argon2idAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      this.name = "Argon2id";
      this.description = "Password Hashing Competition winner (2015) - hybrid variant combining Argon2d and Argon2i. RECOMMENDED for general password hashing. First half uses data-independent addressing (Argon2i), second half uses data-dependent (Argon2d), providing both side-channel resistance and GPU attack resistance.";
      this.inventor = "Alex Biryukov, Daniel Dinu, Dmitry Khovratovich";
      this.year = 2015;
      this.category = CategoryType.KDF;
      this.subCategory = "Memory-Hard Password Hashing";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      this.SupportedOutputSizes = [new KeySize(4, 1024, 1)];
      this.SaltRequired = true;

      this.documentation = [
        new LinkItem("RFC 9106 - Argon2 Memory-Hard Function for Password Hashing", "https://datatracker.ietf.org/doc/html/rfc9106"),
        new LinkItem("Argon2 Specification", "https://github.com/P-H-C/phc-winner-argon2/blob/master/argon2-specs.pdf"),
        new LinkItem("Password Hashing Competition", "https://www.password-hashing.net/")
      ];

      this.references = [
        new LinkItem("PHC Winner Argon2 Reference Implementation", "https://github.com/P-H-C/phc-winner-argon2"),
        new LinkItem("Botan Argon2 Implementation", "https://botan.randombit.net/"),
        new LinkItem("NIST - Password-Based Key Derivation", "https://csrc.nist.gov/projects/password-hashing")
      ];

      // Test vectors from Botan argon2.vec (official test vectors)
      this.tests = [
        {
          text: "Botan Official Test Vector - Argon2id (M=32, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 32,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659")
        },
        {
          text: "Botan Official Test Vector - Argon2id (M=64, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 64,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("4275ee5ad887fe3270e82f01e97db8af3cf63fc7f2102bfea84b305f416a4544")
        },
        {
          text: "Botan Official Test Vector - Argon2id (M=128, T=3, P=4)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/argon2.vec",
          input: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          password: OpCodes.Hex8ToBytes("0101010101010101010101010101010101010101010101010101010101010101"),
          salt: OpCodes.Hex8ToBytes("02020202020202020202020202020202"),
          secret: OpCodes.Hex8ToBytes("0303030303030303"),
          ad: OpCodes.Hex8ToBytes("040404040404040404040404"),
          M: 128,
          T: 3,
          P: 4,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("8ec72f253bd35d55c3e49c587c77665c9c7fcff26cb3cabe179039b7c4281a48")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new Argon2Instance(this, Argon2Type.Argon2id);
    }
  }

  /**
   * Argon2 Instance - Shared by all variants
   */
  class Argon2Instance extends IKdfInstance {
    constructor(algorithm, variant) {
      super(algorithm);
      this.variant = variant;
      this._password = null;
      this._salt = null;
      this._secret = null;
      this._ad = null;
      this._M = 32; // Memory cost in KB (reduced for educational testing)
      this._T = 3;  // Time cost (iterations)
      this._P = 4;  // Parallelism
      this.OutputSize = 32;
    }

    get password() { return this._password; }
    set password(pwd) {
      this._password = pwd instanceof Uint8Array ? pwd : new Uint8Array(pwd);
    }

    get salt() { return this._salt; }
    set salt(saltData) {
      this._salt = saltData instanceof Uint8Array ? saltData : new Uint8Array(saltData);
    }

    get secret() { return this._secret; }
    set secret(sec) {
      this._secret = sec instanceof Uint8Array ? sec : new Uint8Array(sec);
    }

    get ad() { return this._ad; }
    set ad(adData) {
      this._ad = adData instanceof Uint8Array ? adData : new Uint8Array(adData);
    }

    get M() { return this._M; }
    set M(m) { this._M = m; }

    get T() { return this._T; }
    set T(t) { this._T = t; }

    get P() { return this._P; }
    set P(p) { this._P = p; }

    get outputSize() { return this.OutputSize; }
    set outputSize(value) { this.OutputSize = value; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!this._password) {
        this._password = data instanceof Uint8Array ? data : new Uint8Array(data);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */
    Result() {
      if (!this._password || !this._salt) {
        throw new Error('Password and salt required for Argon2');
      }

      return Array.from(argon2(
        this._password,
        this._salt,
        this._T || 3,
        this._M || 32,
        this._P || 4,
        this.OutputSize || 32,
        this.variant,
        this._secret || new Uint8Array(0),
        this._ad || new Uint8Array(0)
      ));
    }
  }

  // Register all three variants
  RegisterAlgorithm(new Argon2dAlgorithm());
  RegisterAlgorithm(new Argon2iAlgorithm());
  RegisterAlgorithm(new Argon2idAlgorithm());

  // Return for module systems
  return {
    Argon2dAlgorithm,
    Argon2iAlgorithm,
    Argon2idAlgorithm,
    Argon2Instance,
    Argon2Type
  };
}));
