/*
 * RIPEMD-256 Hash Function - Universal AlgorithmFramework Implementation
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

  class RIPEMD256Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 32; // 256 bits
      this._Reset();
    }

    _Reset() {
      // RIPEMD-256 initialization values (8 x 32-bit words)
      // Two separate 128-bit initialization vectors
      this.h = new Uint32Array([
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476,  // First line
        0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567   // Second line
      ]);

      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Initialize() {
      this._Reset();
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      const input = new Uint8Array(data);
      this.totalLength += input.length;

      let offset = 0;

      // Process any remaining bytes in buffer
      if (this.bufferLength > 0) {
        const needed = 64 - this.bufferLength;
        const available = Math.min(needed, input.length);

        this.buffer.set(input.slice(0, available), this.bufferLength);
        this.bufferLength += available;
        offset = available;

        if (this.bufferLength === 64) {
          this._ProcessBlock(this.buffer);
          this.bufferLength = 0;
        }
      }

      // Process complete 64-byte blocks
      while (offset + 64 <= input.length) {
        this._ProcessBlock(input.slice(offset, offset + 64));
        offset += 64;
      }

      // Store remaining bytes in buffer
      if (offset < input.length) {
        const remaining = input.slice(offset);
        this.buffer.set(remaining, 0);
        this.bufferLength = remaining.length;
      }
    }

    Result() {
      // Save current state
      const originalH = this.h.slice();
      const originalBuffer = this.buffer.slice();
      const originalBufferLength = this.bufferLength;
      const originalTotalLength = this.totalLength;

      // Create padding
      const msgLength = this.totalLength;
      const padLength = (msgLength % 64 < 56) ? (56 - (msgLength % 64)) : (120 - (msgLength % 64));

      // Add padding
      const padding = new Uint8Array(padLength + 8);
      padding[0] = 0x80; // First padding bit is 1

      // Add length in bits as 64-bit little-endian
      const bitLength = msgLength * 8;
      const lengthBytes = OpCodes.Unpack32LE(bitLength);
      padding[padLength] = lengthBytes[0];
      padding[padLength + 1] = lengthBytes[1];
      padding[padLength + 2] = lengthBytes[2];
      padding[padLength + 3] = lengthBytes[3];
      // For practical message sizes, high 32 bits are always 0
      padding[padLength + 4] = 0;
      padding[padLength + 5] = 0;
      padding[padLength + 6] = 0;
      padding[padLength + 7] = 0;

      this.Feed(padding);

      // Convert hash to bytes (little-endian)
      const result = [];
      for (let i = 0; i < 8; i++) {
        const bytes = OpCodes.Unpack32LE(this.h[i]);
        result.push(...bytes);
      }

      // Restore original state (so Result() can be called multiple times)
      this.h = originalH;
      this.buffer = originalBuffer;
      this.bufferLength = originalBufferLength;
      this.totalLength = originalTotalLength;

      return result;
    }

    _ProcessBlock(block) {
      // Convert block to 16 32-bit words (little-endian)
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // Initialize working variables for both chains
      let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3];
      let aa = this.h[4], bb = this.h[5], cc = this.h[6], dd = this.h[7];

      // Round 1: Left chain uses f1 (x^y^z), Right chain uses f4 ((x&z)|(y&~z))
      // Left chain - sequential order, no constant
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[0]) >>> 0, 11);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[1]) >>> 0, 14);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[2]) >>> 0, 15);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[3]) >>> 0, 12);
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[4]) >>> 0, 5);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[5]) >>> 0, 8);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[6]) >>> 0, 7);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[7]) >>> 0, 9);
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[8]) >>> 0, 11);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[9]) >>> 0, 13);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[10]) >>> 0, 14);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[11]) >>> 0, 15);
      a = OpCodes.RotL32((a + (b ^ c ^ d) + X[12]) >>> 0, 6);
      d = OpCodes.RotL32((d + (a ^ b ^ c) + X[13]) >>> 0, 7);
      c = OpCodes.RotL32((c + (d ^ a ^ b) + X[14]) >>> 0, 9);
      b = OpCodes.RotL32((b + (c ^ d ^ a) + X[15]) >>> 0, 8);

      // Right chain - permuted order, constant 0x50A28BE6
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[5] + 0x50A28BE6) >>> 0, 8);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[14] + 0x50A28BE6) >>> 0, 9);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[7] + 0x50A28BE6) >>> 0, 9);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[0] + 0x50A28BE6) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[9] + 0x50A28BE6) >>> 0, 13);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[2] + 0x50A28BE6) >>> 0, 15);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[11] + 0x50A28BE6) >>> 0, 15);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[4] + 0x50A28BE6) >>> 0, 5);
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[13] + 0x50A28BE6) >>> 0, 7);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[6] + 0x50A28BE6) >>> 0, 7);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[15] + 0x50A28BE6) >>> 0, 8);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[8] + 0x50A28BE6) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb & dd) | (cc & ~dd)) + X[1] + 0x50A28BE6) >>> 0, 14);
      dd = OpCodes.RotL32((dd + ((aa & cc) | (bb & ~cc)) + X[10] + 0x50A28BE6) >>> 0, 14);
      cc = OpCodes.RotL32((cc + ((dd & bb) | (aa & ~bb)) + X[3] + 0x50A28BE6) >>> 0, 12);
      bb = OpCodes.RotL32((bb + ((cc & aa) | (dd & ~aa)) + X[12] + 0x50A28BE6) >>> 0, 6);

      // Swap a and aa
      let t = a; a = aa; aa = t;

      // Round 2: Left chain uses f2 ((x&y)|(~x&z)), Right chain uses f3 ((x|~y)^z)
      // Left chain - permuted order, constant 0x5A827999
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[7] + 0x5A827999) >>> 0, 7);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[4] + 0x5A827999) >>> 0, 6);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[13] + 0x5A827999) >>> 0, 8);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[1] + 0x5A827999) >>> 0, 13);
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[10] + 0x5A827999) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[6] + 0x5A827999) >>> 0, 9);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[15] + 0x5A827999) >>> 0, 7);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[3] + 0x5A827999) >>> 0, 15);
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[12] + 0x5A827999) >>> 0, 7);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[0] + 0x5A827999) >>> 0, 12);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[9] + 0x5A827999) >>> 0, 15);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[5] + 0x5A827999) >>> 0, 9);
      a = OpCodes.RotL32((a + ((b & c) | (~b & d)) + X[2] + 0x5A827999) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a & b) | (~a & c)) + X[14] + 0x5A827999) >>> 0, 7);
      c = OpCodes.RotL32((c + ((d & a) | (~d & b)) + X[11] + 0x5A827999) >>> 0, 13);
      b = OpCodes.RotL32((b + ((c & d) | (~c & a)) + X[8] + 0x5A827999) >>> 0, 12);

      // Right chain - permuted order, constant 0x5C4DD124
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[6] + 0x5C4DD124) >>> 0, 9);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[11] + 0x5C4DD124) >>> 0, 13);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[3] + 0x5C4DD124) >>> 0, 15);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[7] + 0x5C4DD124) >>> 0, 7);
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[0] + 0x5C4DD124) >>> 0, 12);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[13] + 0x5C4DD124) >>> 0, 8);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[5] + 0x5C4DD124) >>> 0, 9);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[10] + 0x5C4DD124) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[14] + 0x5C4DD124) >>> 0, 7);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[15] + 0x5C4DD124) >>> 0, 7);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[8] + 0x5C4DD124) >>> 0, 12);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[12] + 0x5C4DD124) >>> 0, 7);
      aa = OpCodes.RotL32((aa + ((bb | ~cc) ^ dd) + X[4] + 0x5C4DD124) >>> 0, 6);
      dd = OpCodes.RotL32((dd + ((aa | ~bb) ^ cc) + X[9] + 0x5C4DD124) >>> 0, 15);
      cc = OpCodes.RotL32((cc + ((dd | ~aa) ^ bb) + X[1] + 0x5C4DD124) >>> 0, 13);
      bb = OpCodes.RotL32((bb + ((cc | ~dd) ^ aa) + X[2] + 0x5C4DD124) >>> 0, 11);

      // Swap b and bb
      t = b; b = bb; bb = t;

      // Round 3: Left chain uses f3 ((x|~y)^z), Right chain uses f2 ((x&y)|(~x&z))
      // Left chain - permuted order, constant 0x6ED9EBA1
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[3] + 0x6ED9EBA1) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[10] + 0x6ED9EBA1) >>> 0, 13);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[14] + 0x6ED9EBA1) >>> 0, 6);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[4] + 0x6ED9EBA1) >>> 0, 7);
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[9] + 0x6ED9EBA1) >>> 0, 14);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[15] + 0x6ED9EBA1) >>> 0, 9);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[8] + 0x6ED9EBA1) >>> 0, 13);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[1] + 0x6ED9EBA1) >>> 0, 15);
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[2] + 0x6ED9EBA1) >>> 0, 14);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[7] + 0x6ED9EBA1) >>> 0, 8);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[0] + 0x6ED9EBA1) >>> 0, 13);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[6] + 0x6ED9EBA1) >>> 0, 6);
      a = OpCodes.RotL32((a + ((b | ~c) ^ d) + X[13] + 0x6ED9EBA1) >>> 0, 5);
      d = OpCodes.RotL32((d + ((a | ~b) ^ c) + X[11] + 0x6ED9EBA1) >>> 0, 12);
      c = OpCodes.RotL32((c + ((d | ~a) ^ b) + X[5] + 0x6ED9EBA1) >>> 0, 7);
      b = OpCodes.RotL32((b + ((c | ~d) ^ a) + X[12] + 0x6ED9EBA1) >>> 0, 5);

      // Right chain - permuted order, constant 0x6D703EF3
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[15] + 0x6D703EF3) >>> 0, 9);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[5] + 0x6D703EF3) >>> 0, 7);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[1] + 0x6D703EF3) >>> 0, 15);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[3] + 0x6D703EF3) >>> 0, 11);
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[7] + 0x6D703EF3) >>> 0, 8);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[14] + 0x6D703EF3) >>> 0, 6);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[6] + 0x6D703EF3) >>> 0, 6);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[9] + 0x6D703EF3) >>> 0, 14);
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[11] + 0x6D703EF3) >>> 0, 12);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[8] + 0x6D703EF3) >>> 0, 13);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[12] + 0x6D703EF3) >>> 0, 5);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[2] + 0x6D703EF3) >>> 0, 14);
      aa = OpCodes.RotL32((aa + ((bb & cc) | (~bb & dd)) + X[10] + 0x6D703EF3) >>> 0, 13);
      dd = OpCodes.RotL32((dd + ((aa & bb) | (~aa & cc)) + X[0] + 0x6D703EF3) >>> 0, 13);
      cc = OpCodes.RotL32((cc + ((dd & aa) | (~dd & bb)) + X[4] + 0x6D703EF3) >>> 0, 7);
      bb = OpCodes.RotL32((bb + ((cc & dd) | (~cc & aa)) + X[13] + 0x6D703EF3) >>> 0, 5);

      // Swap c and cc
      t = c; c = cc; cc = t;

      // Round 4: Left chain uses f4 ((x&z)|(y&~z)), Right chain uses f1 (x^y^z)
      // Left chain - permuted order, constant 0x8F1BBCDC
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[1] + 0x8F1BBCDC) >>> 0, 11);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[9] + 0x8F1BBCDC) >>> 0, 12);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[11] + 0x8F1BBCDC) >>> 0, 14);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[10] + 0x8F1BBCDC) >>> 0, 15);
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[0] + 0x8F1BBCDC) >>> 0, 14);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[8] + 0x8F1BBCDC) >>> 0, 15);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[12] + 0x8F1BBCDC) >>> 0, 9);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[4] + 0x8F1BBCDC) >>> 0, 8);
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[13] + 0x8F1BBCDC) >>> 0, 9);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[3] + 0x8F1BBCDC) >>> 0, 14);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[7] + 0x8F1BBCDC) >>> 0, 5);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[15] + 0x8F1BBCDC) >>> 0, 6);
      a = OpCodes.RotL32((a + ((b & d) | (c & ~d)) + X[14] + 0x8F1BBCDC) >>> 0, 8);
      d = OpCodes.RotL32((d + ((a & c) | (b & ~c)) + X[5] + 0x8F1BBCDC) >>> 0, 6);
      c = OpCodes.RotL32((c + ((d & b) | (a & ~b)) + X[6] + 0x8F1BBCDC) >>> 0, 5);
      b = OpCodes.RotL32((b + ((c & a) | (d & ~a)) + X[2] + 0x8F1BBCDC) >>> 0, 12);

      // Right chain - permuted order, no constant
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[8]) >>> 0, 15);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[6]) >>> 0, 5);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[4]) >>> 0, 8);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[1]) >>> 0, 11);
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[3]) >>> 0, 14);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[11]) >>> 0, 14);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[15]) >>> 0, 6);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[0]) >>> 0, 14);
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[5]) >>> 0, 6);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[12]) >>> 0, 9);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[2]) >>> 0, 12);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[13]) >>> 0, 9);
      aa = OpCodes.RotL32((aa + (bb ^ cc ^ dd) + X[9]) >>> 0, 12);
      dd = OpCodes.RotL32((dd + (aa ^ bb ^ cc) + X[7]) >>> 0, 5);
      cc = OpCodes.RotL32((cc + (dd ^ aa ^ bb) + X[10]) >>> 0, 15);
      bb = OpCodes.RotL32((bb + (cc ^ dd ^ aa) + X[14]) >>> 0, 8);

      // Swap d and dd
      t = d; d = dd; dd = t;

      // Update hash values - SEPARATE updates (not combined like RIPEMD-160)
      this.h[0] = (this.h[0] + a) >>> 0;
      this.h[1] = (this.h[1] + b) >>> 0;
      this.h[2] = (this.h[2] + c) >>> 0;
      this.h[3] = (this.h[3] + d) >>> 0;
      this.h[4] = (this.h[4] + aa) >>> 0;
      this.h[5] = (this.h[5] + bb) >>> 0;
      this.h[6] = (this.h[6] + cc) >>> 0;
      this.h[7] = (this.h[7] + dd) >>> 0;
    }
  }

  class RIPEMD256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RIPEMD-256";
      this.description = "RIPEMD-256 is an extension of RIPEMD-128 with 256-bit output. Uses two parallel computation lines with different initial values and no final combination. Part of the RIPEMD family designed as European alternatives to SHA algorithms.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "RIPEMD Family";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Documentation and references
      this.documentation = [
        new LinkItem("RIPEMD Family Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD256Digest.java")
      ];

      // Test vectors from official RIPEMD specification
      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("02ba4c4e5f8ecd1877fc52d64d30e37a2d9774fb1e5d026380ae0168e3c5522d"),
          text: "Empty string test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("f9333e45d857f5d90a91bab70a1eba0cfb1be4b0783c9acfcd883a9134692925"),
          text: "Single character 'a' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("afbd6e228b9d8cbbcef5ca2d03e6dba10ac0bc7dcbe4680e1e42d2e975459b65"),
          text: "String 'abc' test vector",
          uri: "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new RIPEMD256Instance(this);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new RIPEMD256Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RIPEMD256Algorithm, RIPEMD256Instance };
}));