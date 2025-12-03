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
 * The algorithm provides protection against:
 * - Differential power analysis (DPA)
 * - First-order side-channel attacks through masking
 * - Nonce misuse resistance
 *
 * Reference: https://csrc.nist.gov/Projects/lightweight-cryptography
 * Specification: https://www.spook.dev/
 * C Reference: https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking
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
  const RC = [
    [1, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 1],
    [1, 0, 1, 0, 0, 1, 0, 1],
    [1, 1, 1, 0, 0, 1, 1, 1]
  ];

  // Helper: Load 32-bit word from byte array (little-endian)
  function loadWord32LE(bytes, offset) {
    return OpCodes.Pack32LE(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
  }

  // Helper: Store 32-bit word to byte array (little-endian)
  function storeWord32LE(bytes, offset, word) {
    const unpacked = OpCodes.Unpack32LE(word);
    bytes[offset] = unpacked[0];
    bytes[offset + 1] = unpacked[1];
    bytes[offset + 2] = unpacked[2];
    bytes[offset + 3] = unpacked[3];
  }

  // Clyde-128 S-box (operates on 4 x 32-bit words)
  function clyde128Sbox(state) {
    const s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];
    const c = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(s0, s1), s2));
    const d = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(s3, s0), s1));
    state[2] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(c, d), s3));
    state[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(c, s3), s0));
    state[0] = d;
    state[1] = c;
  }

  // Clyde-128 inverse S-box
  function clyde128InvSbox(state) {
    const s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];
    const d = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(s0, s1), s2));
    const a = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(s1, d), s3));
    const b = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(d, a), s0));
    state[2] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.AndN(a, b), s1));
    state[0] = a;
    state[1] = b;
    state[3] = d;
  }

  // Clyde-128 L-box (operates on pair of 32-bit words)
  function clyde128Lbox(x, y) {
    let c = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotR32(x, 12)));
    let d = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotR32(y, 12)));
    c = OpCodes.ToUint32(OpCodes.XorN(c, OpCodes.RotR32(c, 3)));
    d = OpCodes.ToUint32(OpCodes.XorN(d, OpCodes.RotR32(d, 3)));
    x = OpCodes.ToUint32(OpCodes.XorN(c, OpCodes.RotL32(x, 15)));
    y = OpCodes.ToUint32(OpCodes.XorN(d, OpCodes.RotL32(y, 15)));
    c = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(x, 1)));
    d = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(y, 1)));
    x = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(d, 6)));
    y = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(c, 7)));
    x = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotR32(c, 15)));
    y = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotR32(d, 15)));
    return [x, y];
  }

  // Clyde-128 inverse L-box
  function clyde128InvLbox(x, y) {
    let a = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(x, 7)));
    let b = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(y, 7)));
    x = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(a, 1)));
    y = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(b, 1)));
    x = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(a, 12)));
    y = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(b, 12)));
    a = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(x, 1)));
    b = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(y, 1)));
    x = OpCodes.ToUint32(OpCodes.XorN(x, OpCodes.RotL32(b, 6)));
    y = OpCodes.ToUint32(OpCodes.XorN(y, OpCodes.RotL32(a, 7)));
    a = OpCodes.ToUint32(OpCodes.XorN(a, OpCodes.RotL32(x, 15)));
    b = OpCodes.ToUint32(OpCodes.XorN(b, OpCodes.RotL32(y, 15)));
    x = OpCodes.RotR32(a, 16);
    y = OpCodes.RotR32(b, 16);
    return [x, y];
  }

  // Clyde-128 encryption (tweakable block cipher)
  function clyde128Encrypt(key, output, input, tweak) {
    // Load key
    const k0 = loadWord32LE(key, 0);
    const k1 = loadWord32LE(key, 4);
    const k2 = loadWord32LE(key, 8);
    const k3 = loadWord32LE(key, 12);

    // Copy input and tweak to working arrays
    const state = [input[0], input[1], input[2], input[3]];
    const t = [tweak[0], tweak[1], tweak[2], tweak[3]];

    // Add initial tweakey
    state[0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[0], k0), t[0]));
    state[1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[1], k1), t[1]));
    state[2] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[2], k2), t[2]));
    state[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[3], k3), t[3]));

    // Perform all rounds in pairs
    for (let step = 0; step < CLYDE128_STEPS; ++step) {
      // First round of step
      clyde128Sbox(state);
      const lbox1 = clyde128Lbox(state[0], state[1]);
      state[0] = lbox1[0];
      state[1] = lbox1[1];
      const lbox2 = clyde128Lbox(state[2], state[3]);
      state[2] = lbox2[0];
      state[3] = lbox2[1];
      state[0] = OpCodes.ToUint32(OpCodes.XorN(state[0], RC[step][0]));
      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], RC[step][1]));
      state[2] = OpCodes.ToUint32(OpCodes.XorN(state[2], RC[step][2]));
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], RC[step][3]));

      // Second round of step
      clyde128Sbox(state);
      const lbox3 = clyde128Lbox(state[0], state[1]);
      state[0] = lbox3[0];
      state[1] = lbox3[1];
      const lbox4 = clyde128Lbox(state[2], state[3]);
      state[2] = lbox4[0];
      state[3] = lbox4[1];
      state[0] = OpCodes.ToUint32(OpCodes.XorN(state[0], RC[step][4]));
      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], RC[step][5]));
      state[2] = OpCodes.ToUint32(OpCodes.XorN(state[2], RC[step][6]));
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], RC[step][7]));

      // Update tweakey
      const c = OpCodes.ToUint32(OpCodes.XorN(t[2], t[0]));
      const d = OpCodes.ToUint32(OpCodes.XorN(t[3], t[1]));
      t[2] = t[0];
      t[3] = t[1];
      t[0] = c;
      t[1] = d;

      // Add tweakey to state
      state[0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[0], k0), t[0]));
      state[1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[1], k1), t[1]));
      state[2] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[2], k2), t[2]));
      state[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[3], k3), t[3]));
    }

    // Store result
    output[0] = state[0];
    output[1] = state[1];
    output[2] = state[2];
    output[3] = state[3];
  }

  // Clyde-128 decryption
  function clyde128Decrypt(key, output, input, tweak) {
    // Load key
    const k0 = loadWord32LE(key, 0);
    const k1 = loadWord32LE(key, 4);
    const k2 = loadWord32LE(key, 8);
    const k3 = loadWord32LE(key, 12);

    // Copy tweak
    const t = [tweak[0], tweak[1], tweak[2], tweak[3]];

    // Load ciphertext
    const state = [
      loadWord32LE(input, 0),
      loadWord32LE(input, 4),
      loadWord32LE(input, 8),
      loadWord32LE(input, 12)
    ];

    // Perform all rounds in reverse
    for (let step = CLYDE128_STEPS - 1; step >= 0; --step) {
      // Add tweakey
      state[0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[0], k0), t[0]));
      state[1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[1], k1), t[1]));
      state[2] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[2], k2), t[2]));
      state[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[3], k3), t[3]));

      // Update tweakey
      const a = OpCodes.ToUint32(OpCodes.XorN(t[2], t[0]));
      const b = OpCodes.ToUint32(OpCodes.XorN(t[3], t[1]));
      t[0] = t[2];
      t[1] = t[3];
      t[2] = a;
      t[3] = b;

      // Inverse second round
      state[0] = OpCodes.ToUint32(OpCodes.XorN(state[0], RC[step][4]));
      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], RC[step][5]));
      state[2] = OpCodes.ToUint32(OpCodes.XorN(state[2], RC[step][6]));
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], RC[step][7]));
      const invLbox1 = clyde128InvLbox(state[0], state[1]);
      state[0] = invLbox1[0];
      state[1] = invLbox1[1];
      const invLbox2 = clyde128InvLbox(state[2], state[3]);
      state[2] = invLbox2[0];
      state[3] = invLbox2[1];
      clyde128InvSbox(state);

      // Inverse first round
      state[0] = OpCodes.ToUint32(OpCodes.XorN(state[0], RC[step][0]));
      state[1] = OpCodes.ToUint32(OpCodes.XorN(state[1], RC[step][1]));
      state[2] = OpCodes.ToUint32(OpCodes.XorN(state[2], RC[step][2]));
      state[3] = OpCodes.ToUint32(OpCodes.XorN(state[3], RC[step][3]));
      const invLbox3 = clyde128InvLbox(state[0], state[1]);
      state[0] = invLbox3[0];
      state[1] = invLbox3[1];
      const invLbox4 = clyde128InvLbox(state[2], state[3]);
      state[2] = invLbox4[0];
      state[3] = invLbox4[1];
      clyde128InvSbox(state);
    }

    // Add final tweakey
    state[0] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[0], k0), t[0]));
    state[1] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[1], k1), t[1]));
    state[2] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[2], k2), t[2]));
    state[3] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(state[3], k3), t[3]));

    // Store result
    output[0] = state[0];
    output[1] = state[1];
    output[2] = state[2];
    output[3] = state[3];
  }

  // Shadow-512 permutation
  function shadow512(stateBytes) {
    // Load state as 16 x 32-bit words
    const state = new Array(16);
    for (let i = 0; i < 16; ++i) {
      state[i] = loadWord32LE(stateBytes, i * 4);
    }

    // Perform all rounds in pairs
    for (let step = 0; step < CLYDE128_STEPS; ++step) {
      // Apply S-box and L-box to all 4 bundles
      for (let bundle = 0; bundle < 4; ++bundle) {
        const base = bundle * 4;
        const bundleState = [state[base], state[base + 1], state[base + 2], state[base + 3]];

        // First round
        clyde128Sbox(bundleState);
        const lbox1 = clyde128Lbox(bundleState[0], bundleState[1]);
        bundleState[0] = lbox1[0];
        bundleState[1] = lbox1[1];
        const lbox2 = clyde128Lbox(bundleState[2], bundleState[3]);
        bundleState[2] = lbox2[0];
        bundleState[3] = lbox2[1];
        bundleState[0] = OpCodes.ToUint32(OpCodes.XorN(bundleState[0], OpCodes.Shl32(RC[step][0], bundle)));
        bundleState[1] = OpCodes.ToUint32(OpCodes.XorN(bundleState[1], OpCodes.Shl32(RC[step][1], bundle)));
        bundleState[2] = OpCodes.ToUint32(OpCodes.XorN(bundleState[2], OpCodes.Shl32(RC[step][2], bundle)));
        bundleState[3] = OpCodes.ToUint32(OpCodes.XorN(bundleState[3], OpCodes.Shl32(RC[step][3], bundle)));

        // Second round (S-box only, L-box after diffusion)
        clyde128Sbox(bundleState);

        state[base] = bundleState[0];
        state[base + 1] = bundleState[1];
        state[base + 2] = bundleState[2];
        state[base + 3] = bundleState[3];
      }

      // Apply diffusion layer to rows
      for (let row = 0; row < 4; ++row) {
        const w = state[row];
        const x = state[row + 4];
        const y = state[row + 8];
        const z = state[row + 12];
        const c = OpCodes.ToUint32(OpCodes.XorN(w, x));
        const d = OpCodes.ToUint32(OpCodes.XorN(y, z));
        state[row] = OpCodes.ToUint32(OpCodes.XorN(x, d));
        state[row + 4] = OpCodes.ToUint32(OpCodes.XorN(w, d));
        state[row + 8] = OpCodes.ToUint32(OpCodes.XorN(c, z));
        state[row + 12] = OpCodes.ToUint32(OpCodes.XorN(c, y));
      }

      // Add round constants again
      for (let bundle = 0; bundle < 4; ++bundle) {
        const base = bundle * 4;
        state[base] = OpCodes.ToUint32(OpCodes.XorN(state[base], OpCodes.Shl32(RC[step][4], bundle)));
        state[base + 1] = OpCodes.ToUint32(OpCodes.XorN(state[base + 1], OpCodes.Shl32(RC[step][5], bundle)));
        state[base + 2] = OpCodes.ToUint32(OpCodes.XorN(state[base + 2], OpCodes.Shl32(RC[step][6], bundle)));
        state[base + 3] = OpCodes.ToUint32(OpCodes.XorN(state[base + 3], OpCodes.Shl32(RC[step][7], bundle)));
      }
    }

    // Store state back
    for (let i = 0; i < 16; ++i) {
      storeWord32LE(stateBytes, i * 4, state[i]);
    }
  }

  // Shadow-384 permutation
  function shadow384(stateBytes) {
    // Load state as 12 x 32-bit words (3 bundles)
    const state = new Array(12);
    for (let i = 0; i < 12; ++i) {
      state[i] = loadWord32LE(stateBytes, i * 4);
    }

    // Perform all rounds in pairs
    for (let step = 0; step < CLYDE128_STEPS; ++step) {
      // Apply S-box and L-box to all 3 bundles
      for (let bundle = 0; bundle < 3; ++bundle) {
        const base = bundle * 4;
        const bundleState = [state[base], state[base + 1], state[base + 2], state[base + 3]];

        // First round
        clyde128Sbox(bundleState);
        const lbox1 = clyde128Lbox(bundleState[0], bundleState[1]);
        bundleState[0] = lbox1[0];
        bundleState[1] = lbox1[1];
        const lbox2 = clyde128Lbox(bundleState[2], bundleState[3]);
        bundleState[2] = lbox2[0];
        bundleState[3] = lbox2[1];
        bundleState[0] = OpCodes.ToUint32(OpCodes.XorN(bundleState[0], OpCodes.Shl32(RC[step][0], bundle)));
        bundleState[1] = OpCodes.ToUint32(OpCodes.XorN(bundleState[1], OpCodes.Shl32(RC[step][1], bundle)));
        bundleState[2] = OpCodes.ToUint32(OpCodes.XorN(bundleState[2], OpCodes.Shl32(RC[step][2], bundle)));
        bundleState[3] = OpCodes.ToUint32(OpCodes.XorN(bundleState[3], OpCodes.Shl32(RC[step][3], bundle)));

        // Second round (S-box only, L-box after diffusion)
        clyde128Sbox(bundleState);

        state[base] = bundleState[0];
        state[base + 1] = bundleState[1];
        state[base + 2] = bundleState[2];
        state[base + 3] = bundleState[3];
      }

      // Apply diffusion layer to rows (Shadow-384 specific)
      for (let row = 0; row < 4; ++row) {
        const x = state[row];
        const y = state[row + 4];
        const z = state[row + 8];
        state[row] = OpCodes.ToUint32(OpCodes.XorN(OpCodes.XorN(x, y), z));
        state[row + 4] = OpCodes.ToUint32(OpCodes.XorN(x, z));
        state[row + 8] = OpCodes.ToUint32(OpCodes.XorN(x, y));
      }

      // Add round constants again
      for (let bundle = 0; bundle < 3; ++bundle) {
        const base = bundle * 4;
        state[base] = OpCodes.ToUint32(OpCodes.XorN(state[base], OpCodes.Shl32(RC[step][4], bundle)));
        state[base + 1] = OpCodes.ToUint32(OpCodes.XorN(state[base + 1], OpCodes.Shl32(RC[step][5], bundle)));
        state[base + 2] = OpCodes.ToUint32(OpCodes.XorN(state[base + 2], OpCodes.Shl32(RC[step][6], bundle)));
        state[base + 3] = OpCodes.ToUint32(OpCodes.XorN(state[base + 3], OpCodes.Shl32(RC[step][7], bundle)));
      }
    }

    // Store state back
    for (let i = 0; i < 12; ++i) {
      storeWord32LE(stateBytes, i * 4, state[i]);
    }
  }

  // Base Spook AEAD Algorithm
  class SpookAead extends AeadAlgorithm {
    constructor(variant, shadowSize) {
      super();

      this.variant = variant;
      this.shadowSize = shadowSize;

      this.name = `Spook-128-${shadowSize}-${variant}`;
      this.description = `NIST Lightweight Cryptography candidate providing authenticated encryption with side-channel protection. Uses ${shadowSize === 512 ? 'Shadow-512' : 'Shadow-384'} permutation with Clyde-128 tweakable block cipher. The ${variant === 'su' ? 'single-user' : 'multi-user'} variant offers ${variant === 'su' ? '128-bit' : '256-bit'} key security.`;
      this.inventor = "Daemen, Massolino, Mehrdad, Rotella";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.FR;

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

      // Test vectors from NIST LWC KAT files
      this.tests = this._getTestVectors();
    }

    _getTestVectors() {
      const vectors = [];

      if (this.variant === 'su' && this.shadowSize === 512) {
        // Spook-128-512-su test vectors
        vectors.push({
          text: "NIST LWC KAT #1 - Empty PT, Empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("E3E9A30ABC6D23284B31F81783A8E810")
        });

        vectors.push({
          text: "NIST LWC KAT #2 - Empty PT, 1-byte AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes(""),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("703AE36267F531A7215E2C09B1351922")
        });

        vectors.push({
          text: "NIST LWC KAT #34 - 1-byte PT, Empty AD",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography",
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          ad: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("2848C938FCE8CD25C243326E56778432AB")
        });
      }

      return vectors;
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
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._ad = null;
      this.inputBuffer = [];
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

      const expectedSize = this.algorithm.variant === 'su' ? SPOOK_SU_KEY_SIZE : SPOOK_MU_KEY_SIZE;
      if (keyBytes.length !== expectedSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${expectedSize})`);
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

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== SPOOK_NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${SPOOK_NONCE_SIZE})`);
      }

      this._nonce = [...nonceBytes];
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set ad(adBytes) {
      this._ad = adBytes ? [...adBytes] : [];
    }

    get ad() {
      return this._ad ? [...this._ad] : [];
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
      this.inputBuffer.push(...data);
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

    _encrypt() {
      const plaintext = this.inputBuffer;
      const key = this._key;
      const nonce = this._nonce;
      const ad = this._ad || [];

      // Initialize sponge state
      const state = this._initializeState(key, nonce);

      // Process associated data
      if (ad.length > 0) {
        this._absorbAD(state, ad);
      }

      // Encrypt plaintext
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

    _decrypt() {
      const ciphertextWithTag = this.inputBuffer;
      const key = this._key;
      const nonce = this._nonce;
      const ad = this._ad || [];

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
      const plaintext = [];
      if (ciphertext.length > 0) {
        this._decryptData(state, plaintext, ciphertext);
      }

      // Verify authentication tag
      const computedTag = this._computeTag(state, key);

      // Constant-time tag comparison
      let tagMatch = 1;
      for (let i = 0; i < SPOOK_TAG_SIZE; ++i) {
        tagMatch &= (receivedTag[i] === computedTag[i]) ? 1 : 0;
      }

      // Clear input buffer
      this.inputBuffer = [];

      if (!tagMatch) {
        throw new Error("Authentication tag verification failed");
      }

      return plaintext;
    }

    _initializeState(key, nonce) {
      const shadowSize = this.algorithm.shadowSize;
      const stateSize = shadowSize === 512 ? SHADOW512_STATE_SIZE : SHADOW384_STATE_SIZE;
      const state = new Array(stateSize).fill(0);

      // Handle multi-user variant
      if (this.algorithm.variant === 'mu') {
        // Copy public tweak (second half of key) to first block
        for (let i = 0; i < CLYDE128_BLOCK_SIZE; ++i) {
          state[i] = key[CLYDE128_BLOCK_SIZE + i];
        }
        // Set bit 126 and clear bit 127
        state[CLYDE128_BLOCK_SIZE - 1] &= 0x7F;
        state[CLYDE128_BLOCK_SIZE - 1] |= 0x40;
      }

      // Copy nonce to second block
      for (let i = 0; i < CLYDE128_BLOCK_SIZE; ++i) {
        state[CLYDE128_BLOCK_SIZE + i] = nonce[i];
      }

      // Apply Clyde-128 to initialize state
      const tweakWords = new Array(4);
      const inputWords = new Array(4);
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

    _absorbAD(state, ad) {
      const shadowSize = this.algorithm.shadowSize;
      const rate = shadowSize === 512 ? SHADOW512_RATE : SHADOW384_RATE;
      const permute = shadowSize === 512 ? shadow512 : shadow384;

      let offset = 0;

      // Process full blocks
      while (ad.length - offset >= rate) {
        for (let i = 0; i < rate; ++i) {
          state[i] = OpCodes.XorN(state[i], ad[offset + i]);
        }
        permute(state);
        offset += rate;
      }

      // Process final partial block
      if (ad.length > offset) {
        const remaining = ad.length - offset;
        for (let i = 0; i < remaining; ++i) {
          state[i] = OpCodes.XorN(state[i], ad[offset + i]);
        }
        state[remaining] = OpCodes.XorN(state[remaining], 0x01);
        state[rate] = OpCodes.XorN(state[rate], 0x02);
        permute(state);
      }
    }

    _encryptData(state, output, plaintext) {
      const shadowSize = this.algorithm.shadowSize;
      const rate = shadowSize === 512 ? SHADOW512_RATE : SHADOW384_RATE;
      const permute = shadowSize === 512 ? shadow512 : shadow384;

      state[rate] = OpCodes.XorN(state[rate], 0x01);

      let offset = 0;

      // Process full blocks
      while (plaintext.length - offset >= rate) {
        for (let i = 0; i < rate; ++i) {
          const c = OpCodes.AndN(OpCodes.XorN(state[i], plaintext[offset + i]), 0xFF);
          output.push(c);
        }
        permute(state);
        offset += rate;
      }

      // Process final partial block
      if (plaintext.length > offset) {
        const remaining = plaintext.length - offset;
        for (let i = 0; i < remaining; ++i) {
          const c = OpCodes.AndN(OpCodes.XorN(state[i], plaintext[offset + i]), 0xFF);
          output.push(c);
        }
        state[remaining] = OpCodes.XorN(state[remaining], 0x01);
        state[rate] = OpCodes.XorN(state[rate], 0x02);
        permute(state);
      }
    }

    _decryptData(state, output, ciphertext) {
      const shadowSize = this.algorithm.shadowSize;
      const rate = shadowSize === 512 ? SHADOW512_RATE : SHADOW384_RATE;
      const permute = shadowSize === 512 ? shadow512 : shadow384;

      state[rate] = OpCodes.XorN(state[rate], 0x01);

      let offset = 0;

      // Process full blocks
      while (ciphertext.length - offset >= rate) {
        for (let i = 0; i < rate; ++i) {
          const p = OpCodes.AndN(OpCodes.XorN(state[i], ciphertext[offset + i]), 0xFF);
          output.push(p);
          state[i] = ciphertext[offset + i];
        }
        permute(state);
        offset += rate;
      }

      // Process final partial block
      if (ciphertext.length > offset) {
        const remaining = ciphertext.length - offset;
        for (let i = 0; i < remaining; ++i) {
          const p = OpCodes.AndN(OpCodes.XorN(state[i], ciphertext[offset + i]), 0xFF);
          output.push(p);
          state[i] = ciphertext[offset + i];
        }
        state[remaining] = OpCodes.XorN(state[remaining], 0x01);
        state[rate] = OpCodes.XorN(state[rate], 0x02);
        permute(state);
      }
    }

    _computeTag(state, key) {
      // Set domain separation bit (byte 31, bit 7)
      state[CLYDE128_BLOCK_SIZE * 2 - 1] = OpCodes.OrN(state[CLYDE128_BLOCK_SIZE * 2 - 1], 0x80);

      // Extract tag using Clyde-128
      // clyde128_encrypt(key, output=W[0-3], input=W[0-3], tweak=W[4-7])
      const inputWords = new Array(4);
      const tweakWords = new Array(4);
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
