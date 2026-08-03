/*
 * DECIM (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * DECIM as implemented in the DarkCrypt Total Commander plugin. The
 * published DECIM (Berbain, Billet, Canteaut, Courtois, Gilbert, Goubin,
 * Gouget, Granboulan, Lauradoux, Minier, Pornin, Sibert; eSTREAM Phase 2
 * hardware candidate) uses an 80-bit key, a 64-bit IV, a 192-bit
 * maximum-length LFSR, and a 7-variable quadratic symmetric Boolean filter
 * function applied twice (f1/f2) per clock to feed the ABSG (Alternating
 * Step Boolean Generator) decimation mechanism.
 *
 * The DarkCrypt implementation is a NON-STANDARD variant that only reuses
 * the ABSG automaton itself unmodified; every other component differs from
 * the published paper:
 *  - The internal LFSR is 288 bits (not 192), stored one bit per byte.
 *  - The 128-bit key is loaded twice into the low 256 register bits: once
 *    verbatim into bits [0..127], and once more into bits [128..255],
 *    where the second copy is XORed with the 128-bit IV. The remaining 32
 *    bits [256..287] are filled with a fixed alternating 0/1 pattern.
 *  - The linear feedback recursion draws on 14 tap positions (relative to
 *    the LFSR base): 0,3,4,41,84,103,134,163,164,165,206,253,270,283.
 *  - The nonlinear filter bit combines 14 tap positions (1,21,39,51,73,
 *    120,159,187,203,236,244,263,276,287): bit 1 of the *integer* sum of
 *    13 of those taps, XORed with the parity (XOR) of all 14 taps. This
 *    generalizes the "2nd bit of the Hamming weight" trick the DECIM paper
 *    describes for its 7-variable filter, but over a differently sized,
 *    differently placed tap set — it does not correspond to the published
 *    f1/f2 tap lists.
 *  - During the 1152-round (4x LFSR-length) initialization warm-up, the
 *    bit shifted into the LFSR is (linear feedback) XOR (filter bit) XOR
 *    (LFSR bit 1); the ABSG automaton is not run at all during warm-up.
 *  - During normal keystream generation the LFSR is fed only the pure
 *    linear feedback bit, the filter bit is fed to the standard 1-bit-input
 *    ABSG automaton, and ABSG-accepted output bits are queued into a
 *    64-bit FIFO exactly like the paper's buffering idea.
 *  - crypt() only drives the ABSG-mediated path for 4 LFSR clocks per
 *    output attempt; whenever that leaves the 64-bit FIFO empty and more
 *    output is still needed, the implementation instead falls back to enqueuing RAW,
 *    non-ABSG-decimated filter bits directly (with an additional off-by-
 *    one slot shift relative to the ABSG enqueue path). Because the ABSG
 *    acceptance rate is roughly 1/3, this raw fallback path — not the
 *    "real" ABSG path — supplies the large majority of the keystream.
 *    This is reproduced here exactly as found; it is not part of, and
 *    does not match, the published DECIM specification.
 *  - Output bits are packed into bytes LSB-first, in FIFO consumption
 *    order.
 * 128-bit key, 128-bit IV. Educational only.
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
}((function () {
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
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  const LFSR_LEN = 288;
  const WARMUP_ROUNDS = 4 * LFSR_LEN; // 1152, matches the DarkCrypt implementation's warm-up loop
  const QUEUE_LEN = 64;

  // LFSR-relative tap indices (0-based), as implemented in the DarkCrypt Total Commander plugin.
  const FEEDBACK_TAPS = [0, 3, 4, 41, 84, 103, 134, 163, 164, 165, 206, 253, 270, 283];
  const FILTER_XOR_TAPS = [1, 21, 39, 51, 73, 120, 159, 187, 203, 236, 244, 263, 276, 287];
  const FILTER_SUM_TAPS = [21, 39, 51, 73, 120, 159, 187, 203, 236, 244, 263, 276, 287];

  class DarkCryptDecimAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "DECIM (DarkCrypt)";
      this.description = "Non-standard DECIM-derived stream cipher (288-bit byte-per-bit LFSR, 128-bit key, 128-bit IV, 1152-round warm-up, standard 1-bit ABSG decimation with a raw non-ABSG fallback path supplying most output) as implemented in the DarkCrypt Total Commander plugin. Deviates substantially from the published eSTREAM DECIM specification.";
      this.inventor = "Come Berbain, Olivier Billet, Anne Canteaut, Nicolas Courtois, Henri Gilbert, Louis Goubin, Aline Gouget, Louis Granboulan, Cedric Lauradoux, Marine Minier, Thomas Pornin, Herve Sibert";
      this.year = 2005;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FR;

      this.SupportedKeySizes = [new KeySize(16, 16, 0)];   // fixed 128-bit
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("Decim, a new stream cipher for hardware applications (eSTREAM submission)", "https://www.ecrypt.eu.org/stream/p3ciphers/decim/decim_p3.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Non-standard LFSR, filter and mixed decimation path",
          "The 288-bit LFSR, its feedback taps, and its 14-tap nonlinear filter do not correspond to the published 192-bit-LFSR/7-variable-filter DECIM design, and most keystream bits bypass the ABSG decimation mechanism entirely via a raw fallback path in crypt(). This is an unanalyzed, non-standard construction only superficially related to DECIM.",
          "Use a vetted, published stream cipher."
        )
      ];

      // Test vectors generated from the DarkCrypt implementation (setup(key,iv) then crypt(in,out,len) XOR).
      this.tests = [
        {
          text: "DarkCrypt Decim — keystream from incrementing key, zero IV, zero input",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("535799e1c601fbac6025a80feeeed2fed772c4ff3b48341777ff80737e59cfb5ebce023453a3d2cfb25c6889931b6cb1fc4541969c1ff6420617673d47e77b94fc345b80e5540e094005f1218310d793ae24a0ae51d0c3347bdda0e82e70875494555c05451c7f1ee71db7d3f5fd7de727bfcd1ff70521a9e132286dc6f8ce42")
        },
        {
          text: "DarkCrypt Decim — incrementing plaintext, incrementing key, zero IV",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          iv: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("53569be2c204fdab682ca204e2e3dcf1c763d6ec2f5d22006fe69a686244d1aacbef20177786f4e89a7542a2bf36429ecc7473a5a82ac0753e2e5d067bda45ab")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptDecimInstance(this, isInverse);
    }
  }

  class DarkCryptDecimInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._iv = null;

      this._lfsr = null;        // 288-entry bit array (0/1)
      this._c = 0; this._p = 0; this._n = 0; this._out = 0; // ABSG automaton state
      this._queue = null;       // 64-entry FIFO of ABSG/raw output bits
      this._queueCount = 0;
      this._bitCount = 0;       // bits accumulated into current output byte
      this._accByte = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; return; }
      if (keyBytes.length !== 16)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. DECIM (DarkCrypt) requires exactly 16 bytes`);
      this._key = [...keyBytes];
      this._tryInit();
    }
    get key() { return this._key ? [...this._key] : null; }

    set iv(ivBytes) {
      if (!ivBytes) { this._iv = null; return; }
      if (ivBytes.length !== 16)
        throw new Error(`Invalid IV size: ${ivBytes.length} bytes. DECIM (DarkCrypt) requires exactly 16 bytes`);
      this._iv = [...ivBytes];
      this._tryInit();
    }
    get iv() { return this._iv ? [...this._iv] : null; }

    set nonce(nonceBytes) { this.iv = nonceBytes; }
    get nonce() { return this.iv; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._lfsr) throw new Error("Key/IV not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._lfsr) throw new Error("Key/IV not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = this._crypt(this.inputBuffer);
      this.inputBuffer = [];
      return output;
    }

    _tryInit() {
      if (!this._key || !this._iv) { this._lfsr = null; return; }

      const lfsr = new Array(LFSR_LEN).fill(0);

      // LFSR[0..127] = key bits, LSB-first per byte.
      for (let i = 0; i < 128; i++) {
        const byteIdx = OpCodes.Shr32(i, 3), bitIdx = OpCodes.And32(i, 7);
        lfsr[i] = OpCodes.AndN(OpCodes.Shr32(this._key[byteIdx], bitIdx), 1);
      }
      // LFSR[128..255] = key bits again, XORed with the IV bits (also LSB-first).
      for (let i = 0; i < 128; i++) {
        const byteIdx = OpCodes.Shr32(i, 3), bitIdx = OpCodes.And32(i, 7);
        const kBit = OpCodes.AndN(OpCodes.Shr32(this._key[byteIdx], bitIdx), 1);
        const vBit = OpCodes.AndN(OpCodes.Shr32(this._iv[byteIdx], bitIdx), 1);
        lfsr[128 + i] = OpCodes.XorN(kBit, vBit);
      }
      // LFSR[256..287]: fixed alternating pattern (absolute index odd -> 1).
      for (let idx = 256; idx < LFSR_LEN; idx++) lfsr[idx] = (idx % 2 === 1) ? 1 : 0;

      this._lfsr = lfsr;
      this._c = 0; this._p = 0; this._n = 0; this._out = 0;
      this._queue = new Array(QUEUE_LEN).fill(0);
      this._queueCount = 0;
      this._bitCount = 0;
      this._accByte = 0;

      // Initialization warm-up: feedback bit also folds in the filter bit and LFSR[1];
      // the ABSG automaton is not clocked here.
      for (let i = 0; i < WARMUP_ROUNDS; i++) {
        const { feedback, filterBit } = this._computeFeedbackAndFilter();
        const newBit = OpCodes.XorN(OpCodes.XorN(feedback, filterBit), this._lfsr[1]);
        this._shiftInsert(newBit);
      }

      // Reset ABSG automaton and FIFO after warm-up, then fill the FIFO to capacity
      // using the real ABSG-mediated path.
      this._c = 0; this._p = 0; this._n = 0; this._out = 0;
      this._queue.fill(0);
      this._queueCount = 0;
      this._bitCount = 0;
      this._accByte = 0;

      while (this._queueCount < QUEUE_LEN) this._absgEnqueueClock();

      this._bitCount = 0;
      this._accByte = 0;
    }

    // Computes the linear feedback bit and the nonlinear filter bit from the
    // current LFSR contents, without modifying the LFSR.
    _computeFeedbackAndFilter() {
      const lfsr = this._lfsr;

      let feedback = 0;
      for (let i = 0; i < FEEDBACK_TAPS.length; i++) feedback = OpCodes.XorN(feedback, lfsr[FEEDBACK_TAPS[i]]);

      let xorAll = 0;
      for (let i = 0; i < FILTER_XOR_TAPS.length; i++) xorAll = OpCodes.XorN(xorAll, lfsr[FILTER_XOR_TAPS[i]]);

      let sum = 0;
      for (let i = 0; i < FILTER_SUM_TAPS.length; i++) sum += lfsr[FILTER_SUM_TAPS[i]];

      const filterBit = OpCodes.XorN(OpCodes.AndN(OpCodes.Shr32(sum, 1), 1), xorAll);

      return { feedback, filterBit };
    }

    // Discards LFSR[0] and shifts every remaining bit down by one position,
    // inserting newBit at the top (position LFSR_LEN-1).
    _shiftInsert(newBit) {
      const lfsr = this._lfsr;
      lfsr.shift();
      lfsr.push(newBit);
    }

    // Standard 1-bit-input ABSG automaton transition (c,p,n,out state).
    _absgStep(d) {
      if (this._c === 0) {
        this._p = d;
        this._n = 0;
        this._out = 0;
        this._c = 1;
      } else {
        const newOut = OpCodes.XorN(this._n, d);
        const newN = OpCodes.XorN(this._p, d);
        const newC = OpCodes.XorN(this._p, d);
        this._out = newOut;
        this._n = newN;
        this._c = newC;
        // p is left unchanged in this branch.
      }
    }

    // One "proper" keystream-generation clock: pure linear feedback shifts into
    // the LFSR, the filter bit drives the ABSG automaton, and an accepted
    // ABSG output bit (when c returns to 0) is enqueued at the FIFO tail.
    _absgEnqueueClock() {
      const { feedback, filterBit } = this._computeFeedbackAndFilter();
      this._shiftInsert(feedback);
      this._absgStep(filterBit);
      if (this._c === 0 && this._queueCount < QUEUE_LEN) {
        this._queue[this._queueCount] = this._out;
        this._queueCount++;
      }
    }

    // One "raw" fallback clock, used by crypt() when the FIFO has run dry mid-stream:
    // enqueues the RAW filter bit directly, bypassing the ABSG automaton, at an
    // index one past the current count (reproducing the DarkCrypt implementation's off-by-one slot use).
    _rawEnqueueClock() {
      const { feedback, filterBit } = this._computeFeedbackAndFilter();
      this._shiftInsert(feedback);
      this._queueCount++;
      const idx = this._queueCount;
      if (idx >= this._queue.length) this._queue.length = idx + 1;
      this._queue[idx] = filterBit;
    }

    // Consumes one bit from the FIFO head into the byte-packer (LSB-first),
    // shifting the FIFO down by one. Returns a completed byte whenever 8 bits
    // had already been accumulated at entry (matching the DarkCrypt implementation's packer).
    _dequeue() {
      const flag = (this._bitCount === 8);
      let byteOut = null;
      if (flag) {
        byteOut = OpCodes.And32(this._accByte, 0xFF);
        this._bitCount = 0;
        this._accByte = 0;
      }
      const bit = this._queue[0];
      this._accByte = OpCodes.OrN(this._accByte, OpCodes.Shl32(bit, this._bitCount));
      this._bitCount++;
      for (let i = 0; i < this._queue.length - 1; i++) this._queue[i] = this._queue[i + 1];
      this._queue[this._queue.length - 1] = 0;
      this._queueCount--;
      return { flag, byteOut };
    }

    // Reproduces crypt()'s exact control flow: 4 ABSG-mediated clocks per attempt,
    // one dequeue attempt, and — only once the FIFO is completely empty and more
    // output is still needed — up to 4 passes of {8 raw clocks + one dequeue
    // attempt} to refill it.
    _crypt(input) {
      const len = input.length;
      const out = new Array(len);
      let processed = 0;
      if (len <= 0) return out;

      while (true) {
        for (let i = 0; i < 4; i++) this._absgEnqueueClock();

        let { flag, byteOut } = this._dequeue();
        if (flag) {
          out[processed] = OpCodes.XorN(input[processed], byteOut);
          processed++;
        }

        if (this._queueCount === 0 && processed < len) {
          for (let pass = 0; pass < 4; pass++) {
            for (let k = 0; k < 8; k++) this._rawEnqueueClock();
            const r = this._dequeue();
            if (r.flag) {
              out[processed] = OpCodes.XorN(input[processed], r.byteOut);
              processed++;
            }
          }
        }

        if (processed < len) continue;
        break;
      }

      return out;
    }
  }

  const algorithmInstance = new DarkCryptDecimAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptDecimAlgorithm, DarkCryptDecimInstance };
}));
