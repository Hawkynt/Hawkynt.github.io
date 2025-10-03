
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

  class RIPEMD320Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 40; // 320 bits
      this._Initialize();
    }

    _Initialize() {
      // RIPEMD-320 initialization values (from Bouncy Castle reference)
      this.h = new Uint32Array([
        0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0,  // H0-H4 (left pipeline)
        0x76543210, 0xFEDCBA98, 0x89ABCDEF, 0x01234567, 0x3C2D1E0F   // H5-H9 (right pipeline)
      ]);

      this.buffer = new Uint8Array(64);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Initialize() {
      this._Initialize();
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
      // Pack as 64-bit little-endian (low 32 bits first, then high 32 bits)
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
      for (let i = 0; i < 10; i++) {
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
      // Convert block to 32-bit words (little-endian)
      const X = new Array(16);
      for (let i = 0; i < 16; i++) {
        X[i] = OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
      }

      // RIPEMD auxiliary functions
      const f1 = (x, y, z) => x ^ y ^ z;
      const f2 = (x, y, z) => (x & y) | (~x & z);
      const f3 = (x, y, z) => (x | ~y) ^ z;
      const f4 = (x, y, z) => (x & z) | (y & ~z);
      const f5 = (x, y, z) => x ^ (y | ~z);

      // Rotation left function
      const RL = (x, n) => OpCodes.RotL32(x, n);

      // Initialize working variables (Bouncy Castle uses: a,b,c,d,e and aa,bb,cc,dd,ee)
      let a = this.h[0];
      let b = this.h[1];
      let c = this.h[2];
      let d = this.h[3];
      let e = this.h[4];
      let aa = this.h[5];
      let bb = this.h[6];
      let cc = this.h[7];
      let dd = this.h[8];
      let ee = this.h[9];

      let t; // temp for swaps

      // Round 1-16 (left: f1, right: f5)
      a = (RL((a + f1(b,c,d) + X[ 0]) | 0, 11) + e) | 0; c = RL(c, 10);
      e = (RL((e + f1(a,b,c) + X[ 1]) | 0, 14) + d) | 0; b = RL(b, 10);
      d = (RL((d + f1(e,a,b) + X[ 2]) | 0, 15) + c) | 0; a = RL(a, 10);
      c = (RL((c + f1(d,e,a) + X[ 3]) | 0, 12) + b) | 0; e = RL(e, 10);
      b = (RL((b + f1(c,d,e) + X[ 4]) | 0,  5) + a) | 0; d = RL(d, 10);
      a = (RL((a + f1(b,c,d) + X[ 5]) | 0,  8) + e) | 0; c = RL(c, 10);
      e = (RL((e + f1(a,b,c) + X[ 6]) | 0,  7) + d) | 0; b = RL(b, 10);
      d = (RL((d + f1(e,a,b) + X[ 7]) | 0,  9) + c) | 0; a = RL(a, 10);
      c = (RL((c + f1(d,e,a) + X[ 8]) | 0, 11) + b) | 0; e = RL(e, 10);
      b = (RL((b + f1(c,d,e) + X[ 9]) | 0, 13) + a) | 0; d = RL(d, 10);
      a = (RL((a + f1(b,c,d) + X[10]) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f1(a,b,c) + X[11]) | 0, 15) + d) | 0; b = RL(b, 10);
      d = (RL((d + f1(e,a,b) + X[12]) | 0,  6) + c) | 0; a = RL(a, 10);
      c = (RL((c + f1(d,e,a) + X[13]) | 0,  7) + b) | 0; e = RL(e, 10);
      b = (RL((b + f1(c,d,e) + X[14]) | 0,  9) + a) | 0; d = RL(d, 10);
      a = (RL((a + f1(b,c,d) + X[15]) | 0,  8) + e) | 0; c = RL(c, 10);

      aa = (RL((aa + f5(bb,cc,dd) + X[ 5] + 0x50a28be6) | 0,  8) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f5(aa,bb,cc) + X[14] + 0x50a28be6) | 0,  9) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f5(ee,aa,bb) + X[ 7] + 0x50a28be6) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f5(dd,ee,aa) + X[ 0] + 0x50a28be6) | 0, 11) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f5(cc,dd,ee) + X[ 9] + 0x50a28be6) | 0, 13) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f5(bb,cc,dd) + X[ 2] + 0x50a28be6) | 0, 15) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f5(aa,bb,cc) + X[11] + 0x50a28be6) | 0, 15) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f5(ee,aa,bb) + X[ 4] + 0x50a28be6) | 0,  5) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f5(dd,ee,aa) + X[13] + 0x50a28be6) | 0,  7) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f5(cc,dd,ee) + X[ 6] + 0x50a28be6) | 0,  7) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f5(bb,cc,dd) + X[15] + 0x50a28be6) | 0,  8) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f5(aa,bb,cc) + X[ 8] + 0x50a28be6) | 0, 11) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f5(ee,aa,bb) + X[ 1] + 0x50a28be6) | 0, 14) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f5(dd,ee,aa) + X[10] + 0x50a28be6) | 0, 14) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f5(cc,dd,ee) + X[ 3] + 0x50a28be6) | 0, 12) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f5(bb,cc,dd) + X[12] + 0x50a28be6) | 0,  6) + ee) | 0; cc = RL(cc, 10);

      t = a; a = aa; aa = t;

      // Round 17-32 (left: f2, right: f4)
      e = (RL((e + f2(a,b,c) + X[ 7] + 0x5a827999) | 0,  7) + d) | 0; b = RL(b, 10);
      d = (RL((d + f2(e,a,b) + X[ 4] + 0x5a827999) | 0,  6) + c) | 0; a = RL(a, 10);
      c = (RL((c + f2(d,e,a) + X[13] + 0x5a827999) | 0,  8) + b) | 0; e = RL(e, 10);
      b = (RL((b + f2(c,d,e) + X[ 1] + 0x5a827999) | 0, 13) + a) | 0; d = RL(d, 10);
      a = (RL((a + f2(b,c,d) + X[10] + 0x5a827999) | 0, 11) + e) | 0; c = RL(c, 10);
      e = (RL((e + f2(a,b,c) + X[ 6] + 0x5a827999) | 0,  9) + d) | 0; b = RL(b, 10);
      d = (RL((d + f2(e,a,b) + X[15] + 0x5a827999) | 0,  7) + c) | 0; a = RL(a, 10);
      c = (RL((c + f2(d,e,a) + X[ 3] + 0x5a827999) | 0, 15) + b) | 0; e = RL(e, 10);
      b = (RL((b + f2(c,d,e) + X[12] + 0x5a827999) | 0,  7) + a) | 0; d = RL(d, 10);
      a = (RL((a + f2(b,c,d) + X[ 0] + 0x5a827999) | 0, 12) + e) | 0; c = RL(c, 10);
      e = (RL((e + f2(a,b,c) + X[ 9] + 0x5a827999) | 0, 15) + d) | 0; b = RL(b, 10);
      d = (RL((d + f2(e,a,b) + X[ 5] + 0x5a827999) | 0,  9) + c) | 0; a = RL(a, 10);
      c = (RL((c + f2(d,e,a) + X[ 2] + 0x5a827999) | 0, 11) + b) | 0; e = RL(e, 10);
      b = (RL((b + f2(c,d,e) + X[14] + 0x5a827999) | 0,  7) + a) | 0; d = RL(d, 10);
      a = (RL((a + f2(b,c,d) + X[11] + 0x5a827999) | 0, 13) + e) | 0; c = RL(c, 10);
      e = (RL((e + f2(a,b,c) + X[ 8] + 0x5a827999) | 0, 12) + d) | 0; b = RL(b, 10);

      ee = (RL((ee + f4(aa,bb,cc) + X[ 6] + 0x5c4dd124) | 0,  9) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f4(ee,aa,bb) + X[11] + 0x5c4dd124) | 0, 13) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f4(dd,ee,aa) + X[ 3] + 0x5c4dd124) | 0, 15) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f4(cc,dd,ee) + X[ 7] + 0x5c4dd124) | 0,  7) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f4(bb,cc,dd) + X[ 0] + 0x5c4dd124) | 0, 12) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f4(aa,bb,cc) + X[13] + 0x5c4dd124) | 0,  8) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f4(ee,aa,bb) + X[ 5] + 0x5c4dd124) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f4(dd,ee,aa) + X[10] + 0x5c4dd124) | 0, 11) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f4(cc,dd,ee) + X[14] + 0x5c4dd124) | 0,  7) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f4(bb,cc,dd) + X[15] + 0x5c4dd124) | 0,  7) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f4(aa,bb,cc) + X[ 8] + 0x5c4dd124) | 0, 12) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f4(ee,aa,bb) + X[12] + 0x5c4dd124) | 0,  7) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f4(dd,ee,aa) + X[ 4] + 0x5c4dd124) | 0,  6) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f4(cc,dd,ee) + X[ 9] + 0x5c4dd124) | 0, 15) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f4(bb,cc,dd) + X[ 1] + 0x5c4dd124) | 0, 13) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f4(aa,bb,cc) + X[ 2] + 0x5c4dd124) | 0, 11) + dd) | 0; bb = RL(bb, 10);

      t = b; b = bb; bb = t;

      // Round 33-48 (left: f3, right: f3)
      d = (RL((d + f3(e,a,b) + X[ 3] + 0x6ed9eba1) | 0, 11) + c) | 0; a = RL(a, 10);
      c = (RL((c + f3(d,e,a) + X[10] + 0x6ed9eba1) | 0, 13) + b) | 0; e = RL(e, 10);
      b = (RL((b + f3(c,d,e) + X[14] + 0x6ed9eba1) | 0,  6) + a) | 0; d = RL(d, 10);
      a = (RL((a + f3(b,c,d) + X[ 4] + 0x6ed9eba1) | 0,  7) + e) | 0; c = RL(c, 10);
      e = (RL((e + f3(a,b,c) + X[ 9] + 0x6ed9eba1) | 0, 14) + d) | 0; b = RL(b, 10);
      d = (RL((d + f3(e,a,b) + X[15] + 0x6ed9eba1) | 0,  9) + c) | 0; a = RL(a, 10);
      c = (RL((c + f3(d,e,a) + X[ 8] + 0x6ed9eba1) | 0, 13) + b) | 0; e = RL(e, 10);
      b = (RL((b + f3(c,d,e) + X[ 1] + 0x6ed9eba1) | 0, 15) + a) | 0; d = RL(d, 10);
      a = (RL((a + f3(b,c,d) + X[ 2] + 0x6ed9eba1) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f3(a,b,c) + X[ 7] + 0x6ed9eba1) | 0,  8) + d) | 0; b = RL(b, 10);
      d = (RL((d + f3(e,a,b) + X[ 0] + 0x6ed9eba1) | 0, 13) + c) | 0; a = RL(a, 10);
      c = (RL((c + f3(d,e,a) + X[ 6] + 0x6ed9eba1) | 0,  6) + b) | 0; e = RL(e, 10);
      b = (RL((b + f3(c,d,e) + X[13] + 0x6ed9eba1) | 0,  5) + a) | 0; d = RL(d, 10);
      a = (RL((a + f3(b,c,d) + X[11] + 0x6ed9eba1) | 0, 12) + e) | 0; c = RL(c, 10);
      e = (RL((e + f3(a,b,c) + X[ 5] + 0x6ed9eba1) | 0,  7) + d) | 0; b = RL(b, 10);
      d = (RL((d + f3(e,a,b) + X[12] + 0x6ed9eba1) | 0,  5) + c) | 0; a = RL(a, 10);

      dd = (RL((dd + f3(ee,aa,bb) + X[15] + 0x6d703ef3) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f3(dd,ee,aa) + X[ 5] + 0x6d703ef3) | 0,  7) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f3(cc,dd,ee) + X[ 1] + 0x6d703ef3) | 0, 15) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f3(bb,cc,dd) + X[ 3] + 0x6d703ef3) | 0, 11) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f3(aa,bb,cc) + X[ 7] + 0x6d703ef3) | 0,  8) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f3(ee,aa,bb) + X[14] + 0x6d703ef3) | 0,  6) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f3(dd,ee,aa) + X[ 6] + 0x6d703ef3) | 0,  6) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f3(cc,dd,ee) + X[ 9] + 0x6d703ef3) | 0, 14) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f3(bb,cc,dd) + X[11] + 0x6d703ef3) | 0, 12) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f3(aa,bb,cc) + X[ 8] + 0x6d703ef3) | 0, 13) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f3(ee,aa,bb) + X[12] + 0x6d703ef3) | 0,  5) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f3(dd,ee,aa) + X[ 2] + 0x6d703ef3) | 0, 14) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f3(cc,dd,ee) + X[10] + 0x6d703ef3) | 0, 13) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f3(bb,cc,dd) + X[ 0] + 0x6d703ef3) | 0, 13) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f3(aa,bb,cc) + X[ 4] + 0x6d703ef3) | 0,  7) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f3(ee,aa,bb) + X[13] + 0x6d703ef3) | 0,  5) + cc) | 0; aa = RL(aa, 10);

      t = c; c = cc; cc = t;

      // Round 49-64 (left: f4, right: f2)
      c = (RL((c + f4(d,e,a) + X[ 1] + 0x8f1bbcdc) | 0, 11) + b) | 0; e = RL(e, 10);
      b = (RL((b + f4(c,d,e) + X[ 9] + 0x8f1bbcdc) | 0, 12) + a) | 0; d = RL(d, 10);
      a = (RL((a + f4(b,c,d) + X[11] + 0x8f1bbcdc) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f4(a,b,c) + X[10] + 0x8f1bbcdc) | 0, 15) + d) | 0; b = RL(b, 10);
      d = (RL((d + f4(e,a,b) + X[ 0] + 0x8f1bbcdc) | 0, 14) + c) | 0; a = RL(a, 10);
      c = (RL((c + f4(d,e,a) + X[ 8] + 0x8f1bbcdc) | 0, 15) + b) | 0; e = RL(e, 10);
      b = (RL((b + f4(c,d,e) + X[12] + 0x8f1bbcdc) | 0,  9) + a) | 0; d = RL(d, 10);
      a = (RL((a + f4(b,c,d) + X[ 4] + 0x8f1bbcdc) | 0,  8) + e) | 0; c = RL(c, 10);
      e = (RL((e + f4(a,b,c) + X[13] + 0x8f1bbcdc) | 0,  9) + d) | 0; b = RL(b, 10);
      d = (RL((d + f4(e,a,b) + X[ 3] + 0x8f1bbcdc) | 0, 14) + c) | 0; a = RL(a, 10);
      c = (RL((c + f4(d,e,a) + X[ 7] + 0x8f1bbcdc) | 0,  5) + b) | 0; e = RL(e, 10);
      b = (RL((b + f4(c,d,e) + X[15] + 0x8f1bbcdc) | 0,  6) + a) | 0; d = RL(d, 10);
      a = (RL((a + f4(b,c,d) + X[14] + 0x8f1bbcdc) | 0,  8) + e) | 0; c = RL(c, 10);
      e = (RL((e + f4(a,b,c) + X[ 5] + 0x8f1bbcdc) | 0,  6) + d) | 0; b = RL(b, 10);
      d = (RL((d + f4(e,a,b) + X[ 6] + 0x8f1bbcdc) | 0,  5) + c) | 0; a = RL(a, 10);
      c = (RL((c + f4(d,e,a) + X[ 2] + 0x8f1bbcdc) | 0, 12) + b) | 0; e = RL(e, 10);

      cc = (RL((cc + f2(dd,ee,aa) + X[ 8] + 0x7a6d76e9) | 0, 15) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f2(cc,dd,ee) + X[ 6] + 0x7a6d76e9) | 0,  5) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f2(bb,cc,dd) + X[ 4] + 0x7a6d76e9) | 0,  8) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f2(aa,bb,cc) + X[ 1] + 0x7a6d76e9) | 0, 11) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f2(ee,aa,bb) + X[ 3] + 0x7a6d76e9) | 0, 14) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f2(dd,ee,aa) + X[11] + 0x7a6d76e9) | 0, 14) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f2(cc,dd,ee) + X[15] + 0x7a6d76e9) | 0,  6) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f2(bb,cc,dd) + X[ 0] + 0x7a6d76e9) | 0, 14) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f2(aa,bb,cc) + X[ 5] + 0x7a6d76e9) | 0,  6) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f2(ee,aa,bb) + X[12] + 0x7a6d76e9) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f2(dd,ee,aa) + X[ 2] + 0x7a6d76e9) | 0, 12) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f2(cc,dd,ee) + X[13] + 0x7a6d76e9) | 0,  9) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f2(bb,cc,dd) + X[ 9] + 0x7a6d76e9) | 0, 12) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f2(aa,bb,cc) + X[ 7] + 0x7a6d76e9) | 0,  5) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f2(ee,aa,bb) + X[10] + 0x7a6d76e9) | 0, 15) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f2(dd,ee,aa) + X[14] + 0x7a6d76e9) | 0,  8) + bb) | 0; ee = RL(ee, 10);

      t = d; d = dd; dd = t;

      // Round 65-80 (left: f5, right: f1)
      b = (RL((b + f5(c,d,e) + X[ 4] + 0xa953fd4e) | 0,  9) + a) | 0; d = RL(d, 10);
      a = (RL((a + f5(b,c,d) + X[ 0] + 0xa953fd4e) | 0, 15) + e) | 0; c = RL(c, 10);
      e = (RL((e + f5(a,b,c) + X[ 5] + 0xa953fd4e) | 0,  5) + d) | 0; b = RL(b, 10);
      d = (RL((d + f5(e,a,b) + X[ 9] + 0xa953fd4e) | 0, 11) + c) | 0; a = RL(a, 10);
      c = (RL((c + f5(d,e,a) + X[ 7] + 0xa953fd4e) | 0,  6) + b) | 0; e = RL(e, 10);
      b = (RL((b + f5(c,d,e) + X[12] + 0xa953fd4e) | 0,  8) + a) | 0; d = RL(d, 10);
      a = (RL((a + f5(b,c,d) + X[ 2] + 0xa953fd4e) | 0, 13) + e) | 0; c = RL(c, 10);
      e = (RL((e + f5(a,b,c) + X[10] + 0xa953fd4e) | 0, 12) + d) | 0; b = RL(b, 10);
      d = (RL((d + f5(e,a,b) + X[14] + 0xa953fd4e) | 0,  5) + c) | 0; a = RL(a, 10);
      c = (RL((c + f5(d,e,a) + X[ 1] + 0xa953fd4e) | 0, 12) + b) | 0; e = RL(e, 10);
      b = (RL((b + f5(c,d,e) + X[ 3] + 0xa953fd4e) | 0, 13) + a) | 0; d = RL(d, 10);
      a = (RL((a + f5(b,c,d) + X[ 8] + 0xa953fd4e) | 0, 14) + e) | 0; c = RL(c, 10);
      e = (RL((e + f5(a,b,c) + X[11] + 0xa953fd4e) | 0, 11) + d) | 0; b = RL(b, 10);
      d = (RL((d + f5(e,a,b) + X[ 6] + 0xa953fd4e) | 0,  8) + c) | 0; a = RL(a, 10);
      c = (RL((c + f5(d,e,a) + X[15] + 0xa953fd4e) | 0,  5) + b) | 0; e = RL(e, 10);
      b = (RL((b + f5(c,d,e) + X[13] + 0xa953fd4e) | 0,  6) + a) | 0; d = RL(d, 10);

      bb = (RL((bb + f1(cc,dd,ee) + X[12]) | 0,  8) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f1(bb,cc,dd) + X[15]) | 0,  5) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f1(aa,bb,cc) + X[10]) | 0, 12) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f1(ee,aa,bb) + X[ 4]) | 0,  9) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f1(dd,ee,aa) + X[ 1]) | 0, 12) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f1(cc,dd,ee) + X[ 5]) | 0,  5) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f1(bb,cc,dd) + X[ 8]) | 0, 14) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f1(aa,bb,cc) + X[ 7]) | 0,  6) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f1(ee,aa,bb) + X[ 6]) | 0,  8) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f1(dd,ee,aa) + X[ 2]) | 0, 13) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f1(cc,dd,ee) + X[13]) | 0,  6) + aa) | 0; dd = RL(dd, 10);
      aa = (RL((aa + f1(bb,cc,dd) + X[14]) | 0,  5) + ee) | 0; cc = RL(cc, 10);
      ee = (RL((ee + f1(aa,bb,cc) + X[ 0]) | 0, 15) + dd) | 0; bb = RL(bb, 10);
      dd = (RL((dd + f1(ee,aa,bb) + X[ 3]) | 0, 13) + cc) | 0; aa = RL(aa, 10);
      cc = (RL((cc + f1(dd,ee,aa) + X[ 9]) | 0, 11) + bb) | 0; ee = RL(ee, 10);
      bb = (RL((bb + f1(cc,dd,ee) + X[11]) | 0, 11) + aa) | 0; dd = RL(dd, 10);

      // Update state (Bouncy Castle line 446-455)
      // H0 += a, H1 += b, H2 += c, H3 += d, H4 += ee
      // H5 += aa, H6 += bb, H7 += cc, H8 += dd, H9 += e
      this.h[0] = (this.h[0] + a) | 0;
      this.h[1] = (this.h[1] + b) | 0;
      this.h[2] = (this.h[2] + c) | 0;
      this.h[3] = (this.h[3] + d) | 0;
      this.h[4] = (this.h[4] + ee) | 0;  // Note: ee from right pipeline
      this.h[5] = (this.h[5] + aa) | 0;
      this.h[6] = (this.h[6] + bb) | 0;
      this.h[7] = (this.h[7] + cc) | 0;
      this.h[8] = (this.h[8] + dd) | 0;
      this.h[9] = (this.h[9] + e) | 0;   // Note: e from left pipeline
    }
  }

  class RIPEMD320Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "RIPEMD-320";
      this.description = "Extended RIPEMD hash function producing 320-bit digest. Uses dual 160-bit computation pipelines for enhanced security margin. Part of the RIPEMD family designed as European alternative to MD/SHA.";
      this.inventor = "Hans Dobbertin, Antoon Bosselaers, Bart Preneel";
      this.year = 1996;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Documentation and references
      this.documentation = [
        new LinkItem("RIPEMD-160: A Strengthened Version of RIPEMD", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html"),
        new LinkItem("ISO/IEC 10118-3:2004 Standard", "https://www.iso.org/standard/39876.html"),
        new LinkItem("Wikipedia Article", "https://en.wikipedia.org/wiki/RIPEMD")
      ];

      this.references = [
        new LinkItem("OpenSSL Implementation", "https://github.com/openssl/openssl/tree/master/crypto/ripemd"),
        new LinkItem("Bouncy Castle Java Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD320Digest.java"),
        new LinkItem("Original Specification", "https://homes.esat.kuleuven.be/~bosselae/ripemd160.html")
      ];

      // Test vectors from Bouncy Castle test suite
      this.tests = [
        {
          input: [],
          expected: OpCodes.Hex8ToBytes("22d65d5661536cdc75c1fdf5c6de7b41b9f27325ebc61e8557177d705a0ec880151c3a32a00899b8"),
          text: "Empty string test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        },
        {
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("ce78850638f92658a5a585097579926dda667a5716562cfcf6fbe77f63542f99b04705d6970dff5d"),
          text: "Single character 'a' test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        },
        {
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("de4c01b3054f8930a79d09ae738e92301e5a17085beffdc1b8d116713e74f82fa942d64cdbc4682d"),
          text: "String 'abc' test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        },
        {
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("cabdb1810b92470a2093aa6bce05952c28348cf43ff60841975166bb40ed234004b8824463e6b009"),
          text: "Alphabet test vector (Bouncy Castle)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/RIPEMD320DigestTest.java"
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions don't have an inverse operation
      if (isInverse) {
        return null;
      }
      return new RIPEMD320Instance(this);
    }
  }




  // ===== REGISTRATION =====

  const algorithmInstance = new RIPEMD320Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { RIPEMD320Algorithm, RIPEMD320Instance };
}));
