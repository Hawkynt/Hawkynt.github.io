/*
 * Spook AEAD - NIST Lightweight Cryptography Candidate
 * Professional implementation following NIST LWC submission specification
 * (c)2006-2025 Hawkynt
 *
 * Spook is a masked authenticated encryption algorithm designed for side-channel
 * protection. It combines the Clyde-128 tweakable block cipher with Shadow-512
 * or Shadow-384 sponge-based permutations to provide authenticated encryption.
 *
 * This implementation includes all four official variants:
 * - Spook-128-512-su: 128-bit key (single-user), Shadow-512, 32-byte rate, 128-bit tag
 * - Spook-128-384-su: 128-bit key (single-user), Shadow-384, 16-byte rate, 128-bit tag
 * - Spook-128-512-mu: 256-bit key (multi-user), Shadow-512, 32-byte rate, 128-bit tag
 * - Spook-128-384-mu: 256-bit key (multi-user), Shadow-384, 16-byte rate, 128-bit tag
 *
 * This is Spook v2, the NIST LWC round-2 version: Clyde-128 and Shadow both use
 * six steps and the on-the-fly tweakey schedule below. It is verified against
 * the full 1089-vector NIST submission KAT file for each of the four variants.
 *
 * The design targets:
 * - Leakage-resistant modes (CIML2 integrity even with a leaking tag check)
 * - Efficient masking of the Clyde-128 bitslice tweakable block cipher
 * - Nonce misuse-resilience
 *
 * Reference: https://csrc.nist.gov/Projects/lightweight-cryptography
 * Specification: https://www.spook.dev/assets/TOSC_Spook.pdf (Spook v2)
 * NIST round-2 spec: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/Spook-spec-round2.pdf
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Constants
  const CLYDE128_BLOCK_SIZE = 16;
  const CLYDE128_KEY_SIZE = 16;
  const CLYDE128_TWEAK_SIZE = 16;
  const CLYDE128_STEPS = 6;

  const SHADOW512_STATE_SIZE = 64;
  const SHADOW512_RATE = 32;

  const SHADOW384_STATE_SIZE = 48;
  const SHADOW384_RATE = 16;

  const SPOOK_TAG_SIZE = 16;
  const SPOOK_NONCE_SIZE = 16;
  const SPOOK_SU_KEY_SIZE = 16;
  const SPOOK_MU_KEY_SIZE = 32;

  // Round constants for Clyde-128 (6 steps, 8 values per step)
  /** @type {uint8[][]} */
  const RC = [
    [1, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 0, 1, 1, 1]
  ];

  // Helper: Load 32-bit word from byte array (little-endian)
  /**
   * @param {uint8[]} bytes
   * @param {int32} offset
   * @returns {uint32}
   */
  function loadWord32LE(bytes, offset) {
    return OpCodes.Pack32LE(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
  }

  // Helper: Store 32-bit word to byte array (little-endian)
  /**
   * @param {uint8[]} bytes
   * @param {int32} offset
   * @param {uint32} word
   */
  function storeWord32LE(bytes, offset, word) {
    const unpacked = OpCodes.Unpack32LE(word);
    bytes[offset] = unpacked[0];
    bytes[offset + 1] = unpacked[1];
    bytes[offset + 2] = unpacked[2];
    bytes[offset + 3] = unpacked[3];
  }

  // Clyde-128 S-box (operates on 4 x 32-bit words)
  /**
   * @param {uint32[]} st
   */
  function clyde128Sbox(st) {
    const s0 = st[0], s1 = st[1], s2 = st[2], s3 = st[3];
    const c = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(s0, s1), s2));
    const d = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(s3, s0), s1));
    st[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(c, d), s3));
    st[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(c, s3), s0));
    st[0] = d;
    st[1] = c;
  }

  // Clyde-128 inverse S-box
  /**
   * @param {uint32[]} st
   */
  function clyde128InvSbox(st) {
    const s0 = st[0], s1 = st[1], s2 = st[2], s3 = st[3];
    const d = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(s0, s1), s2));
    const a = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(s1, d), s3));
    const b = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(d, a), s0));
    st[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.And32(a, b), s1));
    st[0] = a;
    st[1] = b;
    st[3] = d;
  }

  // Clyde-128 L-box (operates on pair of 32-bit words)
  /**
   * @param {uint32} x
   * @param {uint32} y
   * @returns {uint32[]}
   */
  function clyde128Lbox(x, y) {
    let c = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotR32(x, 12)));
    let d = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotR32(y, 12)));
    c = OpCodes.ToUint32(OpCodes.Xor32(c, OpCodes.RotR32(c, 3)));
    d = OpCodes.ToUint32(OpCodes.Xor32(d, OpCodes.RotR32(d, 3)));
    x = OpCodes.ToUint32(OpCodes.Xor32(c, OpCodes.RotL32(x, 15)));
    y = OpCodes.ToUint32(OpCodes.Xor32(d, OpCodes.RotL32(y, 15)));
    c = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(x, 1)));
    d = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(y, 1)));
    x = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(d, 6)));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(c, 7)));
    x = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotR32(c, 15)));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotR32(d, 15)));
    return [x, y];
  }

  // Clyde-128 inverse L-box
  /**
   * @param {uint32} x
   * @param {uint32} y
   * @returns {uint32[]}
   */
  function clyde128InvLbox(x, y) {
    let a = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(x, 7)));
    let b = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(y, 7)));
    x = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(a, 1)));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(b, 1)));
    x = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(a, 12)));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(b, 12)));
    a = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(x, 1)));
    b = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(y, 1)));
    x = OpCodes.ToUint32(OpCodes.Xor32(x, OpCodes.RotL32(b, 6)));
    y = OpCodes.ToUint32(OpCodes.Xor32(y, OpCodes.RotL32(a, 7)));
    a = OpCodes.ToUint32(OpCodes.Xor32(a, OpCodes.RotL32(x, 15)));
    b = OpCodes.ToUint32(OpCodes.Xor32(b, OpCodes.RotL32(y, 15)));
    x = OpCodes.RotR32(a, 16);
    y = OpCodes.RotR32(b, 16);
    return [x, y];
  }

  // Clyde-128 encryption (tweakable block cipher)
  /**
   * @param {uint8[]} key
   * @param {uint32[]} outWords
   * @param {uint32[]} inWords
   * @param {uint32[]} tweak
   */
  function clyde128Encrypt(key, outWords, inWords, tweak) {
    // Load key
    const k0 = loadWord32LE(key, 0);
    const k1 = loadWord32LE(key, 4);
    const k2 = loadWord32LE(key, 8);
    const k3 = loadWord32LE(key, 12);

    // Copy inWords and tweak to working arrays
    /** @type {uint32[]} */
    const st = [inWords[0], inWords[1], inWords[2], inWords[3]];
    /** @type {uint32[]} */
    const t = [tweak[0], tweak[1], tweak[2], tweak[3]];

    // Add initial tweakey
    st[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[0], k0), t[0]));
    st[1] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[1], k1), t[1]));
    st[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[2], k2), t[2]));
    st[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[3], k3), t[3]));

    // Perform all rounds in pairs
    for (let step = 0; step < CLYDE128_STEPS; ++step) {
      // First round of step
      clyde128Sbox(st);
      const lbox1 = clyde128Lbox(st[0], st[1]);
      st[0] = lbox1[0];
      st[1] = lbox1[1];
      const lbox2 = clyde128Lbox(st[2], st[3]);
      st[2] = lbox2[0];
      st[3] = lbox2[1];
      st[0] = OpCodes.ToUint32(OpCodes.Xor32(st[0], RC[step][0]));
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], RC[step][1]));
      st[2] = OpCodes.ToUint32(OpCodes.Xor32(st[2], RC[step][2]));
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], RC[step][3]));

      // Second round of step
      clyde128Sbox(st);
      const lbox3 = clyde128Lbox(st[0], st[1]);
      st[0] = lbox3[0];
      st[1] = lbox3[1];
      const lbox4 = clyde128Lbox(st[2], st[3]);
      st[2] = lbox4[0];
      st[3] = lbox4[1];
      st[0] = OpCodes.ToUint32(OpCodes.Xor32(st[0], RC[step][4]));
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], RC[step][5]));
      st[2] = OpCodes.ToUint32(OpCodes.Xor32(st[2], RC[step][6]));
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], RC[step][7]));

      // Update tweakey
      const c = OpCodes.ToUint32(OpCodes.Xor32(t[2], t[0]));
      const d = OpCodes.ToUint32(OpCodes.Xor32(t[3], t[1]));
      t[2] = t[0];
      t[3] = t[1];
      t[0] = c;
      t[1] = d;

      // Add tweakey to st
      st[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[0], k0), t[0]));
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[1], k1), t[1]));
      st[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[2], k2), t[2]));
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[3], k3), t[3]));
    }

    // Store result
    outWords[0] = st[0];
    outWords[1] = st[1];
    outWords[2] = st[2];
    outWords[3] = st[3];
  }

  // Clyde-128 decryption
  /**
   * @param {uint8[]} key
   * @param {uint32[]} outWords
   * @param {uint8[]} input
   * @param {uint32[]} tweak
   */
  function clyde128Decrypt(key, outWords, input, tweak) {
    // Load key
    const k0 = loadWord32LE(key, 0);
    const k1 = loadWord32LE(key, 4);
    const k2 = loadWord32LE(key, 8);
    const k3 = loadWord32LE(key, 12);

    // Copy tweak
    /** @type {uint32[]} */
    const t = [tweak[0], tweak[1], tweak[2], tweak[3]];

    // Load ciphertext
    /** @type {uint32[]} */
    const st = [
      loadWord32LE(input, 0),
      loadWord32LE(input, 4),
      loadWord32LE(input, 8),
      loadWord32LE(input, 12)
    ];

    // Perform all rounds in reverse
    for (let step = CLYDE128_STEPS - 1; step >= 0; --step) {
      // Add tweakey
      st[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[0], k0), t[0]));
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[1], k1), t[1]));
      st[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[2], k2), t[2]));
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[3], k3), t[3]));

      // Update tweakey
      const a = OpCodes.ToUint32(OpCodes.Xor32(t[2], t[0]));
      const b = OpCodes.ToUint32(OpCodes.Xor32(t[3], t[1]));
      t[0] = t[2];
      t[1] = t[3];
      t[2] = a;
      t[3] = b;

      // Inverse second round
      st[0] = OpCodes.ToUint32(OpCodes.Xor32(st[0], RC[step][4]));
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], RC[step][5]));
      st[2] = OpCodes.ToUint32(OpCodes.Xor32(st[2], RC[step][6]));
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], RC[step][7]));
      const invLbox1 = clyde128InvLbox(st[0], st[1]);
      st[0] = invLbox1[0];
      st[1] = invLbox1[1];
      const invLbox2 = clyde128InvLbox(st[2], st[3]);
      st[2] = invLbox2[0];
      st[3] = invLbox2[1];
      clyde128InvSbox(st);

      // Inverse first round
      st[0] = OpCodes.ToUint32(OpCodes.Xor32(st[0], RC[step][0]));
      st[1] = OpCodes.ToUint32(OpCodes.Xor32(st[1], RC[step][1]));
      st[2] = OpCodes.ToUint32(OpCodes.Xor32(st[2], RC[step][2]));
      st[3] = OpCodes.ToUint32(OpCodes.Xor32(st[3], RC[step][3]));
      const invLbox3 = clyde128InvLbox(st[0], st[1]);
      st[0] = invLbox3[0];
      st[1] = invLbox3[1];
      const invLbox4 = clyde128InvLbox(st[2], st[3]);
      st[2] = invLbox4[0];
      st[3] = invLbox4[1];
      clyde128InvSbox(st);
    }

    // Add final tweakey
    st[0] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[0], k0), t[0]));
    st[1] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[1], k1), t[1]));
    st[2] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[2], k2), t[2]));
    st[3] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(st[3], k3), t[3]));

    // Store result
    outWords[0] = st[0];
    outWords[1] = st[1];
    outWords[2] = st[2];
    outWords[3] = st[3];
  }

  // Shadow-512 permutation
  /**
   * @param {uint8[]} stateBytes
   */
  function shadow512(stateBytes) {
    // Load st as 16 x 32-bit words
    /** @type {uint32[]} */
    const st = new Array(16);
    for (let i = 0; i < 16; ++i) {
      st[i] = loadWord32LE(stateBytes, i * 4);
    }

    // Perform all rounds in pairs
    for (let step = 0; step < CLYDE128_STEPS; ++step) {
      // Apply S-box and L-box to all 4 bundles
      for (let bundle = 0; bundle < 4; ++bundle) {
        const base = bundle * 4;
        /** @type {uint32[]} */
        const bundleState = [st[base], st[base + 1], st[base + 2], st[base + 3]];

        // First round
        clyde128Sbox(bundleState);
        const lbox1 = clyde128Lbox(bundleState[0], bundleState[1]);
        bundleState[0] = lbox1[0];
        bundleState[1] = lbox1[1];
        const lbox2 = clyde128Lbox(bundleState[2], bundleState[3]);
        bundleState[2] = lbox2[0];
        bundleState[3] = lbox2[1];
        bundleState[0] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[0], OpCodes.Shl32(RC[step][0], bundle)));
        bundleState[1] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[1], OpCodes.Shl32(RC[step][1], bundle)));
        bundleState[2] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[2], OpCodes.Shl32(RC[step][2], bundle)));
        bundleState[3] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[3], OpCodes.Shl32(RC[step][3], bundle)));

        // Second round (S-box only, L-box after diffusion)
        clyde128Sbox(bundleState);

        st[base] = bundleState[0];
        st[base + 1] = bundleState[1];
        st[base + 2] = bundleState[2];
        st[base + 3] = bundleState[3];
      }

      // Apply diffusion layer to rows
      for (let row = 0; row < 4; ++row) {
        const w = st[row];
        const x = st[row + 4];
        const y = st[row + 8];
        const z = st[row + 12];
        const c = OpCodes.ToUint32(OpCodes.Xor32(w, x));
        const d = OpCodes.ToUint32(OpCodes.Xor32(y, z));
        st[row] = OpCodes.ToUint32(OpCodes.Xor32(x, d));
        st[row + 4] = OpCodes.ToUint32(OpCodes.Xor32(w, d));
        st[row + 8] = OpCodes.ToUint32(OpCodes.Xor32(c, z));
        st[row + 12] = OpCodes.ToUint32(OpCodes.Xor32(c, y));
      }

      // Add round constants again
      for (let bundle = 0; bundle < 4; ++bundle) {
        const base = bundle * 4;
        st[base] = OpCodes.ToUint32(OpCodes.Xor32(st[base], OpCodes.Shl32(RC[step][4], bundle)));
        st[base + 1] = OpCodes.ToUint32(OpCodes.Xor32(st[base + 1], OpCodes.Shl32(RC[step][5], bundle)));
        st[base + 2] = OpCodes.ToUint32(OpCodes.Xor32(st[base + 2], OpCodes.Shl32(RC[step][6], bundle)));
        st[base + 3] = OpCodes.ToUint32(OpCodes.Xor32(st[base + 3], OpCodes.Shl32(RC[step][7], bundle)));
      }
    }

    // Store st back
    for (let i = 0; i < 16; ++i) {
      storeWord32LE(stateBytes, i * 4, st[i]);
    }
  }

  // Shadow-384 permutation
  /**
   * @param {uint8[]} stateBytes
   */
  function shadow384(stateBytes) {
    // Load st as 12 x 32-bit words (3 bundles)
    /** @type {uint32[]} */
    const st = new Array(12);
    for (let i = 0; i < 12; ++i) {
      st[i] = loadWord32LE(stateBytes, i * 4);
    }

    // Perform all rounds in pairs
    for (let step = 0; step < CLYDE128_STEPS; ++step) {
      // Apply S-box and L-box to all 3 bundles
      for (let bundle = 0; bundle < 3; ++bundle) {
        const base = bundle * 4;
        /** @type {uint32[]} */
        const bundleState = [st[base], st[base + 1], st[base + 2], st[base + 3]];

        // First round
        clyde128Sbox(bundleState);
        const lbox1 = clyde128Lbox(bundleState[0], bundleState[1]);
        bundleState[0] = lbox1[0];
        bundleState[1] = lbox1[1];
        const lbox2 = clyde128Lbox(bundleState[2], bundleState[3]);
        bundleState[2] = lbox2[0];
        bundleState[3] = lbox2[1];
        bundleState[0] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[0], OpCodes.Shl32(RC[step][0], bundle)));
        bundleState[1] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[1], OpCodes.Shl32(RC[step][1], bundle)));
        bundleState[2] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[2], OpCodes.Shl32(RC[step][2], bundle)));
        bundleState[3] = OpCodes.ToUint32(OpCodes.Xor32(bundleState[3], OpCodes.Shl32(RC[step][3], bundle)));

        // Second round (S-box only, L-box after diffusion)
        clyde128Sbox(bundleState);

        st[base] = bundleState[0];
        st[base + 1] = bundleState[1];
        st[base + 2] = bundleState[2];
        st[base + 3] = bundleState[3];
      }

      // Apply diffusion layer to rows (Shadow-384 specific)
      for (let row = 0; row < 4; ++row) {
        const x = st[row];
        const y = st[row + 4];
        const z = st[row + 8];
        st[row] = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(x, y), z));
        st[row + 4] = OpCodes.ToUint32(OpCodes.Xor32(x, z));
        st[row + 8] = OpCodes.ToUint32(OpCodes.Xor32(x, y));
      }

      // Add round constants again
      for (let bundle = 0; bundle < 3; ++bundle) {
        const base = bundle * 4;
        st[base] = OpCodes.ToUint32(OpCodes.Xor32(st[base], OpCodes.Shl32(RC[step][4], bundle)));
        st[base + 1] = OpCodes.ToUint32(OpCodes.Xor32(st[base + 1], OpCodes.Shl32(RC[step][5], bundle)));
        st[base + 2] = OpCodes.ToUint32(OpCodes.Xor32(st[base + 2], OpCodes.Shl32(RC[step][6], bundle)));
        st[base + 3] = OpCodes.ToUint32(OpCodes.Xor32(st[base + 3], OpCodes.Shl32(RC[step][7], bundle)));
      }
    }

    // Store st back
    for (let i = 0; i < 12; ++i) {
      storeWord32LE(stateBytes, i * 4, st[i]);
    }
  }

  /**
   * Expected ciphertext||tag of the six NIST LWC KAT counts the algorithm
   * tests (1, 2, 34, 50, 562 and 1089), in that order.
   * @param {int32} shadowSize - 512 or 384
   * @param {string} variant - su (single-user) or mu (multi-user)
   * @returns {string[]} Hexadecimal ciphertext||tag per count
   */
  function spookKatExpected(shadowSize, variant) {
    if (shadowSize === 384 && variant === 'su') {
      return [
        "FC48E447519B6B75D2BCBF63040F5A18",
        "00B0214E9F2A7FBE2CE22EBE42337867",
        "C844F77B117566B8C9DBEA56D38BEAA1B1",
        "2E5EF88B13B0113F9B655EA5D4D61217BA",
        "C83E1BFC0D2DC1CCAEEB2040C4148B52164779A962FFEE8B06C3E9601E9C24C4AA",
        "2E0DB88E6D535A8B74665A5ADB9F5EEE3135DA199D8D519842297EE2A6798668252B19C5F323ECE12A80541EADC1809E"
      ];
    }
    if (shadowSize === 384 && variant === 'mu') {
      return [
        "F415781FC0DD665660200DA92DA17D2A",
        "F7C7B3FC3752534A734908386D3C29DF",
        "26BDA1F2538E0859C6B17555D63F61E8C1",
        "8C1C498DA9EC7CFD168EF5950843473D34",
        "26F5383F4A9DB286C0CEDD286DB1A2684E21BECC46092BC5FF4B25A6526981F52E",
        "3B8D8FA82875D7B9C9FB57EEFD9A54F3D1D3CCA478C654B0B06AC6773F4ED0225CF891BC8212F0D2866536FE04BB5068"
      ];
    }
    if (shadowSize === 512 && variant === 'su') {
      return [
        "E3E9A30ABC6D23284B31F81783A8E810",
        "703AE36267F531A7215E2C09B1351922",
        "2848C938FCE8CD25C243326E56778432AB",
        "F2AF92F1A1B050FC59C33A213366095021",
        "28BD311FD0CD7F7674D7E62980620497D8837D06FF9F8059C34C7D452AA51AF672",
        "9D1A32CE941DCD220CC33300FD0512AE8332E1E720898671B8B6EB9D08704031E1C0BE40A40322A13A95D3288F6DE8DB"
      ];
    }
    if (shadowSize === 512 && variant === 'mu') {
      return [
        "2EF04011DD3048E837440A3022718522",
        "080E0CEB34E942238BE8C87E91E6F8A5",
        "59652011CF0BFAD1D4544FD4B40D820CE8",
        "38146D8D332522F5E08B482CAD26A0704A",
        "591F6B9032EF281AE0E7DDD30092B828D28B2DFB7DBE155CE23F27B05A013D7BFC",
        "3401C24A5DC2699436C15A6A99EF3A76E4309F86AC7DD43295BBAA038FA6FD8E9A17A05D14DEA6E28198885D40451583"
      ];
    }
    throw new Error('Spook has no KAT vectors for Spook-128-' + shadowSize + '-' + variant);
  }

  // Base Spook AEAD Algorithm
  class SpookAead extends AeadAlgorithm {
    /**
     * @param {string} variant - su (single-user) or mu (multi-user)
     * @param {int32} shadowSize - 512 or 384
     */
    constructor(variant, shadowSize) {
      super();

      /** @type {string} */
      this.variant = variant;
      /** @type {int32} */
      this.shadowSize = shadowSize;

      this.name = "Spook-128-" + shadowSize + "-" + variant;
      this.description = "NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses " + (shadowSize === 512 ? 'Shadow-512' : 'Shadow-384') + " permutation with Clyde-128 tweakable block cipher. The " + (variant === 'su' ? 'single-user' : 'multi-user') + " variant offers " + (variant === 'su' ? '128-bit' : '256-bit') + " key security.";
      this.inventor = "Davide Bellizia, Francesco Berti, Olivier Bronchain, Gaetan Cassiers, Sebastien Duval, Chun Guo, Gregor Leander, Gaetan Leurent, Itamar Levi, Charles Momin, Olivier Pereira, Thomas Peters, Francois-Xavier Standaert, Friedrich Wiemer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.BE;

      // Algorithm capabilities
      const keySize = variant === 'su' ? SPOOK_SU_KEY_SIZE : SPOOK_MU_KEY_SIZE;
      this.SupportedKeySizes = [new KeySize(keySize, keySize, 1)];
      this.SupportedNonceSizes = [new KeySize(SPOOK_NONCE_SIZE, SPOOK_NONCE_SIZE, 1)];
      this.SupportedTagSizes = [new KeySize(SPOOK_TAG_SIZE, SPOOK_TAG_SIZE, 1)];
      this.SupportsDetached = false;

      // Documentation
      this.documentation = [
        new LinkItem("NIST LWC Project Page", "https://csrc.nist.gov/Projects/lightweight-cryptography"),
        new LinkItem("Spook Official Website", "https://www.spook.dev/"),
        new LinkItem("NIST LWC Submission", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/spook-spec-round2.pdf")
      ];

      // Reference implementations
      this.references = [
        new LinkItem("Spook Official Reference Implementations", "https://www.spook.dev/implementations.html"),
        new LinkItem("Spook High-End Software Implementations (uclcrypto/spook-he, GitHub)", "https://github.com/uclcrypto/spook-he"),
        new LinkItem("NIST LWC Known-Answer-Test vectors (rweather/lightweight-crypto, MIT)", "https://github.com/rweather/lightweight-crypto/tree/master/test/kat")
      ];

      // Test vectors from NIST LWC KAT files: the official round-2 submission
      // vectors, taken verbatim from the published KAT files. Selected counts
      // exercise the empty case, the associated-data padding path, the
      // partial-block path, a plaintext that spans more than one sponge rate
      // block, and the both-full-blocks case.
      const katUri = "https://github.com/rweather/lightweight-crypto/blob/master/test/kat/" + this.name + ".txt";
      const katText = "NIST LWC round-2 KAT " + this.name + " Count = ";
      const katKey = variant === 'su'
        ? "000102030405060708090A0B0C0D0E0F"
        : "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F";
      const nonce = "000102030405060708090A0B0C0D0E0F";
      const block16 = "000102030405060708090A0B0C0D0E0F";
      const block32 = "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F";
      const pt17 = "000102030405060708090A0B0C0D0E0F10";
      const expected = spookKatExpected(shadowSize, variant);
      this.tests = [
        {
          text: katText + "1 (PT 0 bytes, AD 0 bytes)",
          uri: katUri,
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes(katKey),
          nonce: OpCodes.Hex8ToBytes(nonce),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes(expected[0])
        },
        {
          text: katText + "2 (PT 0 bytes, AD 1 bytes)",
          uri: katUri,
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes(katKey),
          nonce: OpCodes.Hex8ToBytes(nonce),
          aad: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes(expected[1])
        },
        {
          text: katText + "34 (PT 1 bytes, AD 0 bytes)",
          uri: katUri,
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes(katKey),
          nonce: OpCodes.Hex8ToBytes(nonce),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes(expected[2])
        },
        {
          text: katText + "50 (PT 1 bytes, AD 16 bytes)",
          uri: katUri,
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes(katKey),
          nonce: OpCodes.Hex8ToBytes(nonce),
          aad: OpCodes.Hex8ToBytes(block16),
          expected: OpCodes.Hex8ToBytes(expected[3])
        },
        {
          text: katText + "562 (PT 17 bytes, AD 0 bytes)",
          uri: katUri,
          input: OpCodes.Hex8ToBytes(pt17),
          key: OpCodes.Hex8ToBytes(katKey),
          nonce: OpCodes.Hex8ToBytes(nonce),
          aad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes(expected[4])
        },
        {
          text: katText + "1089 (PT 32 bytes, AD 32 bytes)",
          uri: katUri,
          input: OpCodes.Hex8ToBytes(block32),
          key: OpCodes.Hex8ToBytes(katKey),
          nonce: OpCodes.Hex8ToBytes(nonce),
          aad: OpCodes.Hex8ToBytes(block32),
          expected: OpCodes.Hex8ToBytes(expected[5])
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new SpookAeadInstance(this, isInverse);
    }
  }

  // Spook AEAD Instance
  /**
 * SpookAead cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SpookAeadInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {SpookAead} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._nonce = null;
      /** @type {uint8[]|null} */
      this._ad = null;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {string} */
      this._variant = algorithm.variant;
      /** @type {int32} */
      this._shadowSize = algorithm.shadowSize;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      const expectedSize = this._variant === 'su' ? SPOOK_SU_KEY_SIZE : SPOOK_MU_KEY_SIZE;
      if (keyBytes.length !== expectedSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (expected " + expectedSize + ")");
      }

      this._key = [...keyBytes];
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]|null} nonceBytes
     */
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== SPOOK_NONCE_SIZE) {
        throw new Error("Invalid nonce size: " + nonceBytes.length + " bytes (expected " + SPOOK_NONCE_SIZE + ")");
      }

      this._nonce = [...nonceBytes];
    }

    /**
     * @returns {uint8[]|null}
     */
    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    // Canonical AEAD associated-data property used by the framework.
    /**
     * @param {uint8[]|null} aadBytes
     */
    set aad(aadBytes) {
      /** @type {uint8[]} */
      let copy = [];
      if (aadBytes) {
        copy = [...aadBytes];
      }
      this._ad = copy;
    }

    /**
     * @returns {uint8[]|null}
     */
    get aad() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._ad) {
        copy = [...this._ad];
      }
      return copy;
    }

    // Aliases kept for callers that use the shorter/longer spellings.
    /**
     * @param {uint8[]|null} adBytes
     */
    set ad(adBytes) {
      this.aad = adBytes;
    }

    /**
     * @returns {uint8[]|null}
     */
    get ad() {
      return this.aad;
    }

    /**
     * @param {uint8[]|null} adBytes
     */
    set associatedData(adBytes) {
      this.aad = adBytes;
    }

    /**
     * @returns {uint8[]|null}
     */
    get associatedData() {
      return this.aad;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (!this._nonce) throw new Error("Nonce not set");

      if (this.isInverse) {
        return this._decrypt();
      } else {
        return this._encrypt();
      }
    }

    /**
     * @returns {uint8[]}
     */
    _encrypt() {
      const plaintext = this.inputBuffer;
      const key = this._key;
      const nonce = this._nonce;
      /** @type {uint8[]} */
      let ad = [];
      if (this._ad) {
        ad = this._ad;
      }

      // Initialize sponge state
      const state = this._initializeState(key, nonce);

      // Process associated data
      if (ad.length > 0) {
        this._absorbAD(state, ad);
      }

      // Encrypt plaintext
      /** @type {uint8[]} */
      const ciphertext = [];
      if (plaintext.length > 0) {
        this._encryptData(state, ciphertext, plaintext);
      }

      // Compute authentication tag
      const tag = this._computeTag(state, key);

      // Clear input buffer
      this.inputBuffer = [];

      // Return ciphertext || tag
      return ciphertext.concat(tag);
    }

    /**
     * @returns {uint8[]}
     */
    _decrypt() {
      const ciphertextWithTag = this.inputBuffer;
      const key = this._key;
      const nonce = this._nonce;
      /** @type {uint8[]} */
      let ad = [];
      if (this._ad) {
        ad = this._ad;
      }

      // Validate length
      if (ciphertextWithTag.length < SPOOK_TAG_SIZE) {
        throw new Error("Invalid ciphertext: too short for tag");
      }

      // Split ciphertext and tag
      const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - SPOOK_TAG_SIZE);
      const receivedTag = ciphertextWithTag.slice(ciphertextWithTag.length - SPOOK_TAG_SIZE);

      // Initialize sponge state
      const state = this._initializeState(key, nonce);

      // Process associated data
      if (ad.length > 0) {
        this._absorbAD(state, ad);
      }

      // Decrypt ciphertext
      /** @type {uint8[]} */
      const plaintext = [];
      if (ciphertext.length > 0) {
        this._decryptData(state, plaintext, ciphertext);
      }

      // Verify authentication tag
      const computedTag = this._computeTag(state, key);

      // Constant-time tag comparison
      /** @type {uint32} */
      let tagMatch = 1;
      for (let i = 0; i < SPOOK_TAG_SIZE; ++i) {
        tagMatch = OpCodes.And32(tagMatch, (receivedTag[i] === computedTag[i]) ? 1 : 0);
      }

      // Clear input buffer
      this.inputBuffer = [];

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }

    /**
     * Apply the Shadow permutation that matches this variant
     * @param {uint8[]} state - sponge state bytes
     */
    _permute(state) {
      if (this._shadowSize === 512) {
        shadow512(state);
      } else {
        shadow384(state);
      }
    }

    /**
     * @param {uint8[]} key
     * @param {uint8[]} nonce
     * @returns {uint8[]}
     */
    _initializeState(key, nonce) {
      /** @type {int32} */
      const shadowSize = this._shadowSize;
      const stateSize = shadowSize === 512 ? SHADOW512_STATE_SIZE : SHADOW384_STATE_SIZE;
      /** @type {uint8[]} */
      const state = OpCodes.CreateArray(stateSize, 0);

      // Handle multi-user variant
      if (this._variant === 'mu') {
        // Copy public tweak (second half of key) to first block
        for (let i = 0; i < CLYDE128_BLOCK_SIZE; ++i) {
          state[i] = key[CLYDE128_BLOCK_SIZE + i];
        }
        // Set bit 126 and clear bit 127
        state[CLYDE128_BLOCK_SIZE - 1] = OpCodes.And32(state[CLYDE128_BLOCK_SIZE - 1], 0x7F);
        state[CLYDE128_BLOCK_SIZE - 1] = OpCodes.Or32(state[CLYDE128_BLOCK_SIZE - 1], 0x40);
      }

      // Copy nonce to second block
      for (let i = 0; i < CLYDE128_BLOCK_SIZE; ++i) {
        state[CLYDE128_BLOCK_SIZE + i] = nonce[i];
      }

      // Apply Clyde-128 to initialize state
      /** @type {uint32[]} */
      const tweakWords = new Array(4);
      /** @type {uint32[]} */
      const inputWords = new Array(4);
      /** @type {uint32[]} */
      const outputWords = new Array(4);

      // Load tweak words (first block, words 0-3)
      for (let i = 0; i < 4; ++i) {
        tweakWords[i] = loadWord32LE(state, i * 4);
      }

      // Load input words (second block, words 4-7)
      for (let i = 0; i < 4; ++i) {
        inputWords[i] = loadWord32LE(state, (4 + i) * 4);
      }

      // Encrypt: output goes to 4th block (512) or 3rd block (384)
      clyde128Encrypt(key, outputWords, inputWords, tweakWords);

      // Store result back to state (4th block for 512, 3rd block for 384)
      const outputOffset = shadowSize === 512 ? 12 : 8;
      for (let i = 0; i < 4; ++i) {
        storeWord32LE(state, (outputOffset + i) * 4, outputWords[i]);
      }

      // Apply permutation
      if (shadowSize === 512) {
        shadow512(state);
      } else {
        shadow384(state);
      }

      return state;
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} ad
     */
    _absorbAD(state, ad) {
      /** @type {int32} */
      const shadowSize = this._shadowSize;
      const rate = shadowSize === 512 ? SHADOW512_RATE : SHADOW384_RATE;

      let offset = 0;

      // Process full blocks
      while (ad.length - offset >= rate) {
        for (let i = 0; i < rate; ++i) {
          state[i] = OpCodes.Xor32(state[i], ad[offset + i]);
        }
        this._permute(state);
        offset += rate;
      }

      // Process final partial block
      if (ad.length > offset) {
        const remaining = ad.length - offset;
        for (let i = 0; i < remaining; ++i) {
          state[i] = OpCodes.Xor32(state[i], ad[offset + i]);
        }
        state[remaining] = OpCodes.Xor32(state[remaining], 0x01);
        state[rate] = OpCodes.Xor32(state[rate], 0x02);
        this._permute(state);
      }
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} output
     * @param {uint8[]} plaintext
     */
    _encryptData(state, output, plaintext) {
      /** @type {int32} */
      const shadowSize = this._shadowSize;
      const rate = shadowSize === 512 ? SHADOW512_RATE : SHADOW384_RATE;

      state[rate] = OpCodes.Xor32(state[rate], 0x01);

      let offset = 0;

      // Process full blocks. The sponge is a duplex: the rate bytes absorb the
      // plaintext and the resulting state bytes are the ciphertext, so the
      // state must be updated in place (state[i] ^= m[i]; c[i] = state[i]).
      while (plaintext.length - offset >= rate) {
        for (let i = 0; i < rate; ++i) {
          const c = OpCodes.ToByte(OpCodes.Xor32(state[i], plaintext[offset + i]));
          state[i] = c;
          output.push(c);
        }
        this._permute(state);
        offset += rate;
      }

      // Process final partial block
      if (plaintext.length > offset) {
        const remaining = plaintext.length - offset;
        for (let i = 0; i < remaining; ++i) {
          const c = OpCodes.ToByte(OpCodes.Xor32(state[i], plaintext[offset + i]));
          state[i] = c;
          output.push(c);
        }
        state[remaining] = OpCodes.Xor32(state[remaining], 0x01);
        state[rate] = OpCodes.Xor32(state[rate], 0x02);
        this._permute(state);
      }
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} output
     * @param {uint8[]} ciphertext
     */
    _decryptData(state, output, ciphertext) {
      /** @type {int32} */
      const shadowSize = this._shadowSize;
      const rate = shadowSize === 512 ? SHADOW512_RATE : SHADOW384_RATE;

      state[rate] = OpCodes.Xor32(state[rate], 0x01);

      let offset = 0;

      // Process full blocks
      while (ciphertext.length - offset >= rate) {
        for (let i = 0; i < rate; ++i) {
          const p = OpCodes.And32(OpCodes.Xor32(state[i], ciphertext[offset + i]), 0xFF);
          output.push(p);
          state[i] = ciphertext[offset + i];
        }
        this._permute(state);
        offset += rate;
      }

      // Process final partial block
      if (ciphertext.length > offset) {
        const remaining = ciphertext.length - offset;
        for (let i = 0; i < remaining; ++i) {
          const p = OpCodes.And32(OpCodes.Xor32(state[i], ciphertext[offset + i]), 0xFF);
          output.push(p);
          state[i] = ciphertext[offset + i];
        }
        state[remaining] = OpCodes.Xor32(state[remaining], 0x01);
        state[rate] = OpCodes.Xor32(state[rate], 0x02);
        this._permute(state);
      }
    }

    /**
     * @param {uint8[]} state
     * @param {uint8[]} key
     * @returns {uint8[]}
     */
    _computeTag(state, key) {
      // Set domain separation bit (byte 31, bit 7)
      state[CLYDE128_BLOCK_SIZE * 2 - 1] = OpCodes.Or32(state[CLYDE128_BLOCK_SIZE * 2 - 1], 0x80);

      // Extract tag using Clyde-128
      // clyde128_encrypt(key, output=W[0-3], input=W[0-3], tweak=W[4-7])
      /** @type {uint32[]} */
      const inputWords = new Array(4);
      /** @type {uint32[]} */
      const tweakWords = new Array(4);
      /** @type {uint32[]} */
      const outputWords = new Array(4);

      // Load input words (first block, words 0-3)
      for (let i = 0; i < 4; ++i) {
        inputWords[i] = loadWord32LE(state, i * 4);
      }

      // Load tweak words (second block, words 4-7)
      for (let i = 0; i < 4; ++i) {
        tweakWords[i] = loadWord32LE(state, (i + 4) * 4);
      }

      // Encrypt to generate tag
      clyde128Encrypt(key, outputWords, inputWords, tweakWords);

      // Convert to byte array (first 16 bytes = tag)
      /** @type {uint8[]} */
      const tag = new Array(SPOOK_TAG_SIZE);
      for (let i = 0; i < 4; ++i) {
        storeWord32LE(tag, i * 4, outputWords[i]);
      }

      return tag;
    }
  }

  // Register all four variants
  RegisterAlgorithm(new SpookAead('su', 512));
  RegisterAlgorithm(new SpookAead('su', 384));
  RegisterAlgorithm(new SpookAead('mu', 512));
  RegisterAlgorithm(new SpookAead('mu', 384));

  return {
    SpookAead,
    SpookAeadInstance
  };
}));
