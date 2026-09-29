/*
 * Keyak Authenticated Encryption - CAESAR Competition Round 3 Finalist
 * Keyak v2 (Lake Keyak) implementation
 * (c)2006-2025 Hawkynt
 *
 * Keyak is a family of authenticated encryption schemes based on the Keccak-p
 * permutation. Designed by the Keccak/SHA-3 team, it provides authenticated
 * encryption with associated data (AEAD) using the "Motorist" mode of operation.
 *
 * Lake Keyak is Keyak[b=1600, nr=12, Pi=1, c=256, tau=128]: the Keccak-p[1600,12]
 * permutation driven by a Motorist built on a single Piston.
 *
 * The Motorist layer below follows the pseudocode of the Keyak v2 specification
 * (Piston / Engine / Motorist, Sections 3 and 4). Derived byte rates for the
 * Lake instance are Rs = 168 (crypting rate) and Ra = 192 (injecting rate).
 *
 * Reference: https://keccak.team/keyak.html
 * Specification: https://keccak.team/files/Keyakv2-doc2.2.pdf
 * Test Vectors: https://github.com/samvartaka/keyak-python/tree/master/TestVectors
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

  // Keccak-p round constants (for rounds 12-23, used in 12-round variant)
  /** @type {uint32[][]} */
  const RC_ROWS = [
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ];
  /** @type {uint32[][]} */
  const RC = Object.freeze(RC_ROWS);

  /** @type {uint8[]} */
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];

  // 64-bit XOR operation
  /**
   * @param {uint32[]} a
   * @param {uint32[]} b
   * @returns {uint32[]}
   */
  function xor64(a, b) {
    /** @type {uint32[]} */
    const lane = [OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1])];
    return lane;
  }

  // 64-bit rotation (left)
  /**
   * @param {uint32[]} val
   * @param {int32} positions
   * @returns {uint32[]}
   */
  function rotl64(val, positions) {
    /** @type {uint32} */
    const low = val[0];
    /** @type {uint32} */
    const high = val[1];
    positions %= 64;
    /** @type {uint32[]} */
    let lane = [low, high];
    if (positions === 0) return lane;
    lane = [high, low];
    if (positions === 32) return lane;

    if (positions < 32) {
      lane = [
        OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions))),
        OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions)))
      ];
      return lane;
    }

    positions -= 32;
    lane = [
      OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions))),
      OpCodes.ToUint32(OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions)))
    ];
    return lane;
  }

  // Keccak-p[1600, nr] permutation - parameterized rounds
  /**
   * @param {uint32[][]} state
   * @param {int32} rounds
   */
  function keccakP(state, rounds) {
    const startRound = 24 - rounds;

    for (let round = startRound; round < 24; ++round) {
      // Theta
      /** @type {uint32[][]} */
      const C = new Array(5);
      for (let x = 0; x < 5; ++x) {
        /** @type {uint32[]} */
        const zero = [0, 0];
        C[x] = zero;
        for (let y = 0; y < 5; ++y) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }

      /** @type {uint32[][]} */
      const D = new Array(5);
      for (let x = 0; x < 5; ++x) {
        D[x] = xor64(C[OpCodes.And32(x + 4, 0xFF) % 5], rotl64(C[OpCodes.And32(x + 1, 0xFF) % 5], 1));
      }

      for (let x = 0; x < 5; ++x) {
        for (let y = 0; y < 5; ++y) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }

      // Rho
      for (let i = 0; i < 25; ++i) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi
      /** @type {uint32[][]} */
      const temp = new Array(25);
      for (let i = 0; i < 25; ++i) {
        /** @type {uint32[]} */
        const copy = [state[i][0], state[i][1]];
        temp[i] = copy;
      }
      for (let x = 0; x < 5; ++x) {
        for (let y = 0; y < 5; ++y) {
          /** @type {int32} */
          const target = y + 5 * ((2 * x + 3 * y) % 5);
          state[target] = temp[x + 5 * y];
        }
      }

      // Chi
      for (let y = 0; y < 5; ++y) {
        /** @type {uint32[][]} */
        const row = new Array(5);
        for (let x = 0; x < 5; ++x) {
          /** @type {uint32[]} */
          const copy = [state[x + 5 * y][0], state[x + 5 * y][1]];
          row[x] = copy;
        }
        for (let x = 0; x < 5; ++x) {
          /** @type {uint32[]} */
          const notNext = [OpCodes.Not32(row[OpCodes.And32(x + 1, 0xFF) % 5][0]), OpCodes.Not32(row[OpCodes.And32(x + 1, 0xFF) % 5][1])];
          /** @type {uint32[]} */
          const andResult = [OpCodes.And32(notNext[0], row[OpCodes.And32(x + 2, 0xFF) % 5][0]), OpCodes.And32(notNext[1], row[OpCodes.And32(x + 2, 0xFF) % 5][1])];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota
      state[0] = xor64(state[0], RC[round]);
    }
  }

  // Sequential byte stream. The Motorist pseudocode consumes its inputs one byte
  // at a time and stops as soon as a rate boundary is reached, so every input is
  // modelled as a cursor over a byte array rather than as a whole buffer.
  class ByteStream {
    /**
     * @param {uint8[]} [data] - Initial bytes (copied)
     */
    constructor(data) {
      /** @type {uint8[]} */
      this.data = [];
      if (data) {
        for (let i = 0; i < data.length; ++i) this.data.push(data[i]);
      }
      /** @type {int32} */
      this.pos = 0;
    }

    /**
     * @returns {boolean} true while unread bytes remain
     */
    hasMore() { return this.pos < this.data.length; }

    /**
     * @returns {uint8} the next byte
     */
    get() { return this.data[this.pos++]; }

    /**
     * @param {uint32} b - Byte to append (low 8 bits)
     */
    put(b) { this.data.push(OpCodes.ToByte(b)); }

    erase() {
      /** @type {uint8[]} */
      const empty = [];
      this.data = empty;
      this.pos = 0;
    }

    rewind() { this.pos = 0; }
  }

  // Piston: one Keccak-p state plus the four Motorist framing positions.
  //
  // The state holds b/8 = 200 bytes. Bytes 0 to Rs-1 carry keystream and body,
  // bytes 0 to Ra-1 receive injected metadata, and the four bytes at and above
  // Ra carry the frame counters:
  //   EOM         = Ra     end-of-message / tag-length frame
  //   CryptEnd    = Ra + 1 number of body bytes crypted in this block
  //   InjectStart = Ra + 2 offset at which metadata injection started
  //   InjectEnd   = Ra + 3 offset at which metadata injection ended
  class Piston {
    /**
     * @param {int32} rounds - Keccak-p rounds
     * @param {int32} Rs - Crypting rate in bytes
     * @param {int32} Ra - Injecting rate in bytes
     */
    constructor(rounds, Rs, Ra) {
      /** @type {int32} */
      this.rounds = rounds;
      /** @type {int32} */
      this.Rs = Rs;
      /** @type {int32} */
      this.Ra = Ra;
      /** @type {int32} */
      this.EOM = Ra;
      /** @type {int32} */
      this.CryptEnd = Ra + 1;
      /** @type {int32} */
      this.InjectStart = Ra + 2;
      /** @type {int32} */
      this.InjectEnd = Ra + 3;

      // State: 25 x 64-bit words (1600 bits total), each a [low32, high32] pair
      /** @type {uint32[][]} */
      this.state = new Array(25);
      for (let i = 0; i < 25; ++i) {
        /** @type {uint32[]} */
        const lane = [0, 0];
        this.state[i] = lane;
      }
    }

    // XOR a single byte into the state at a byte position (lanes are little-endian)
    /**
     * @param {int32} position
     * @param {uint32} value
     */
    xorByte(position, value) {
      /** @type {int32} */
      const lane = Math.floor(position / 8);
      /** @type {int32} */
      const byteInLane = position % 8;
      const v = OpCodes.ToByte(value);
      if (byteInLane < 4) {
        this.state[lane][0] = OpCodes.ToUint32(OpCodes.Xor32(this.state[lane][0], OpCodes.Shl32(v, byteInLane * 8)));
      } else {
        this.state[lane][1] = OpCodes.ToUint32(OpCodes.Xor32(this.state[lane][1], OpCodes.Shl32(v, (byteInLane - 4) * 8)));
      }
    }

    // Read a single byte of the state at a byte position
    /**
     * @param {int32} position
     * @returns {uint32}
     */
    getByte(position) {
      /** @type {int32} */
      const lane = Math.floor(position / 8);
      /** @type {int32} */
      const byteInLane = position % 8;
      if (byteInLane < 4) {
        return OpCodes.And32(OpCodes.Shr32(this.state[lane][0], byteInLane * 8), 0xFF);
      }
      return OpCodes.And32(OpCodes.Shr32(this.state[lane][1], (byteInLane - 4) * 8), 0xFF);
    }

    // Overwrite a single byte of the state (used when unwrapping)
    /**
     * @param {int32} position
     * @param {uint32} value
     */
    setByte(position, value) {
      this.xorByte(position, OpCodes.Xor32(this.getByte(position), OpCodes.ToByte(value)));
    }

    // Crypt consumes body bytes from I starting at offset omega and stops at Rs.
    // When wrapping, the plaintext is XORed into the state; when unwrapping, the
    // ciphertext replaces the corresponding state bytes.
    /**
     * @param {ByteStream} I
     * @param {ByteStream} O
     * @param {int32} omega
     * @param {boolean} unwrapFlag
     */
    Crypt(I, O, omega, unwrapFlag) {
      /** @type {boolean} */
      let more = I.hasMore();
      while (more && omega < this.Rs) {
        /** @type {uint8} */
        const x = I.get();
        O.put(OpCodes.Xor32(this.getByte(omega), x));
        if (unwrapFlag) {
          this.setByte(omega, x);
        } else {
          this.xorByte(omega, x);
        }
        ++omega;
        more = I.hasMore();
      }
      this.xorByte(this.CryptEnd, omega);
    }

    // Inject absorbs metadata. When the block already carries body bytes the
    // metadata starts at Rs, otherwise at 0; either way it stops at Ra.
    /**
     * @param {ByteStream} X
     * @param {boolean} cryptingFlag
     */
    Inject(X, cryptingFlag) {
      /** @type {int32} */
      let omega = cryptingFlag ? this.Rs : 0;
      this.xorByte(this.InjectStart, omega);

      /** @type {boolean} */
      let more = X.hasMore();
      while (more && omega < this.Ra) {
        this.xorByte(omega, X.get());
        ++omega;
        more = X.hasMore();
      }

      this.xorByte(this.InjectEnd, omega);
    }

    // Spark frames the block and applies the permutation
    /**
     * @param {boolean} eomFlag
     * @param {int32} l
     */
    Spark(eomFlag, l) {
      if (eomFlag) {
        this.xorByte(this.EOM, l === 0 ? 255 : l);
      } else {
        this.xorByte(this.EOM, 0);
      }
      keccakP(this.state, this.rounds);
    }

    /**
     * @param {ByteStream} T
     * @param {int32} l
     */
    GetTag(T, l) {
      if (l > this.Rs) throw new Error("The requested tag is too long");
      for (let i = 0; i < l; ++i) T.put(this.getByte(i));
    }
  }

  // Engine phases
  const PHASE_FRESH = 0;
  const PHASE_CRYPTED = 1;
  const PHASE_END_OF_CRYPT = 2;
  const PHASE_END_OF_MESSAGE = 3;

  // Engine: drives Pi parallel Pistons. Lake Keyak uses Pi = 1.
  class Engine {
    /**
     * @param {Piston[]} pistons - The parallel Pistons
     */
    constructor(pistons) {
      /** @type {int32} */
      this.Pi = pistons.length;
      /** @type {Piston[]} */
      this.Pistons = pistons;
      /** @type {int32} */
      this.phase = PHASE_FRESH;
      /** @type {int32[]} */
      this.Et = OpCodes.CreateArray(this.Pi, 0);
    }

    /**
     * @param {ByteStream} I
     * @param {ByteStream} O
     * @param {boolean} unwrapFlag
     */
    Crypt(I, O, unwrapFlag) {
      if (this.phase !== PHASE_FRESH) throw new Error("Engine.Crypt requires the fresh phase");

      for (let i = 0; i < this.Pi; ++i) {
        this.Pistons[i].Crypt(I, O, this.Et[i], unwrapFlag);
      }

      this.phase = I.hasMore() ? PHASE_CRYPTED : PHASE_END_OF_CRYPT;
    }

    /**
     * @param {ByteStream} A
     */
    Inject(A) {
      if (this.phase !== PHASE_FRESH && this.phase !== PHASE_CRYPTED && this.phase !== PHASE_END_OF_CRYPT) {
        throw new Error("Engine.Inject requires the fresh, crypted or endOfCrypt phase");
      }

      const cryptingFlag = (this.phase === PHASE_CRYPTED || this.phase === PHASE_END_OF_CRYPT);

      for (let i = 0; i < this.Pi; ++i) {
        this.Pistons[i].Inject(A, cryptingFlag);
      }

      /** @type {boolean} */
      const more = A.hasMore();
      if (this.phase === PHASE_CRYPTED || more) {
        this._spark(false, OpCodes.CreateArray(this.Pi, 0));
        this.phase = PHASE_FRESH;
      } else {
        this.phase = PHASE_END_OF_MESSAGE;
      }
    }

    /**
     * @param {ByteStream} T
     * @param {int32[]} l
     */
    GetTags(T, l) {
      if (this.phase !== PHASE_END_OF_MESSAGE) throw new Error("Engine.GetTags requires the endOfMessage phase");
      this._spark(true, l);

      for (let i = 0; i < this.Pi; ++i) {
        this.Pistons[i].GetTag(T, l[i]);
      }

      this.phase = PHASE_FRESH;
    }

    // Inject the same string into every Piston, optionally diversified per Piston
    /**
     * @param {ByteStream} X
     * @param {boolean} diversifyFlag
     */
    InjectCollective(X, diversifyFlag) {
      if (this.phase !== PHASE_FRESH) {
        throw new Error("Engine.InjectCollective requires the fresh phase");
      }

      /** @type {ByteStream[]} */
      const Xt = new Array(this.Pi);
      for (let i = 0; i < this.Pi; ++i) Xt[i] = new ByteStream();

      while (X.hasMore()) {
        /** @type {uint8} */
        const x = X.get();
        for (let i = 0; i < this.Pi; ++i) Xt[i].put(x);
      }

      if (diversifyFlag) {
        for (let i = 0; i < this.Pi; ++i) {
          Xt[i].put(this.Pi);
          Xt[i].put(i);
        }
      }

      for (let i = 0; i < this.Pi; ++i) Xt[i].rewind();

      while (Xt[0].hasMore()) {
        for (let i = 0; i < this.Pi; ++i) this.Pistons[i].Inject(Xt[i], false);
        if (Xt[0].hasMore()) this._spark(false, OpCodes.CreateArray(this.Pi, 0));
      }

      this.phase = PHASE_END_OF_MESSAGE;
    }

    /**
     * @param {boolean} eomFlag
     * @param {int32[]} l
     */
    _spark(eomFlag, l) {
      for (let i = 0; i < this.Pi; ++i) this.Pistons[i].Spark(eomFlag, l[i]);
      this.Et = l;
    }
  }

  // Motorist: the Keyak mode of operation on top of the Engine
  class Motorist {
    /**
     * @param {int32} rounds - Keccak-p rounds
     * @param {int32} b - Permutation width in bits
     * @param {int32} Pi - Number of Pistons
     * @param {int32} W - Lane size in bits
     * @param {int32} c - Capacity in bits
     * @param {int32} tau - Tag length in bits
     */
    constructor(rounds, b, Pi, W, c, tau) {
      /** @type {int32} */
      this.Pi = Pi;
      /** @type {int32} */
      this.W = W;
      /** @type {int32} */
      this.c = c;
      /** @type {int32} */
      this.tau = tau;

      // Rates from the Keyak v2 specification. For Lake Keyak (b=1600, W=64,
      // c=256) this gives Rs = 168 and Ra = 192.
      /** @type {int32} */
      const Rs = Math.floor(W / 8) * Math.floor((b - Math.max(c, 32)) / W);
      /** @type {int32} */
      const Ra = Math.floor(W / 8) * Math.floor((b - 32) / W);
      if (Rs > Ra) {
        throw new Error("Rs is larger than Ra");
      }
      /** @type {int32} */
      this.Rs = Rs;
      /** @type {int32} */
      this.Ra = Ra;

      /** @type {Piston[]} */
      const pistons = new Array(Pi);
      for (let i = 0; i < Pi; ++i) pistons[i] = new Piston(rounds, Rs, Ra);
      /** @type {Engine} */
      this.engine = new Engine(pistons);

      // Capacity rounded up to a whole number of lanes, in bits
      /** @type {int32} */
      this.cprime = W * Math.floor((c + W - 1) / W);
    }

    /**
     * @param {ByteStream} SUV
     * @param {boolean} tagFlag
     * @param {ByteStream} T
     * @param {boolean} unwrapFlag
     * @param {boolean} forgetFlag
     * @returns {boolean}
     */
    StartEngine(SUV, tagFlag, T, unwrapFlag, forgetFlag) {
      this.engine.InjectCollective(SUV, true);
      if (forgetFlag) this._makeKnot();
      return this._handleTag(tagFlag, T, unwrapFlag);
    }

    /**
     * @param {ByteStream} I
     * @param {ByteStream} O
     * @param {ByteStream} A
     * @param {ByteStream} T
     * @param {boolean} unwrapFlag
     * @param {boolean} forgetFlag
     * @returns {boolean}
     */
    Wrap(I, O, A, T, unwrapFlag, forgetFlag) {
      /** @type {boolean} */
      const bodyLeft = I.hasMore();
      /** @type {boolean} */
      const metadataLeft = A.hasMore();
      if (!bodyLeft && !metadataLeft) this.engine.Inject(A);

      while (I.hasMore()) {
        this.engine.Crypt(I, O, unwrapFlag);
        this.engine.Inject(A);
      }

      while (A.hasMore()) this.engine.Inject(A);

      if (this.Pi > 1 || forgetFlag) this._makeKnot();

      /** @type {boolean} */
      const ok = this._handleTag(true, T, unwrapFlag);
      if (!ok) O.erase();
      return ok;
    }

    // Squeeze a full-capacity intermediate tag and re-inject it, so that the
    // preceding state cannot be recovered from what follows
    _makeKnot() {
      const intermediate = new ByteStream();
      this.engine.GetTags(intermediate, OpCodes.CreateArray(this.Pi, this.cprime / 8));
      intermediate.rewind();
      this.engine.InjectCollective(intermediate, false);
    }

    /**
     * @param {boolean} tagFlag
     * @param {ByteStream} T
     * @param {boolean} unwrapFlag
     * @returns {boolean}
     */
    _handleTag(tagFlag, T, unwrapFlag) {
      const computed = new ByteStream();

      if (!tagFlag) {
        this.engine.GetTags(computed, OpCodes.CreateArray(this.Pi, 0));
        return true;
      }

      /** @type {int32[]} */
      const l = OpCodes.CreateArray(this.Pi, 0);
      l[0] = this.tau / 8;
      this.engine.GetTags(computed, l);

      if (!unwrapFlag) {
        T.erase();
        for (let i = 0; i < computed.data.length; ++i) T.put(computed.data[i]);
        return true;
      }

      if (computed.data.length !== T.data.length) {
        return false;
      }
      /** @type {uint32} */
      let diff = 0;
      for (let i = 0; i < computed.data.length; ++i) {
        diff = OpCodes.Or32(diff, OpCodes.Xor32(computed.data[i], T.data[i]));
      }
      return diff === 0;
    }
  }

  // Keyak: wraps the Motorist with the key pack that forms the start-up value
  class Keyak {
    /**
     * @param {int32} b - Permutation width in bits
     * @param {int32} rounds - Keccak-p rounds
     * @param {int32} Pi - Number of Pistons
     * @param {int32} c - Capacity in bits
     * @param {int32} tau - Tag length in bits
     */
    constructor(b, rounds, Pi, c, tau) {
      /** @type {int32} */
      this.b = b;
      /** @type {int32} */
      this.rounds = rounds;
      /** @type {int32} */
      this.Pi = Pi;
      /** @type {int32} */
      this.c = c;
      /** @type {int32} */
      this.tau = tau;
      /** @type {int32} */
      this.W = Math.max(Math.floor(b / 25), 8);
      /** @type {Motorist} */
      this.motorist = new Motorist(rounds, b, Pi, this.W, c, tau);
    }

    // The start-up value is keypack(K) followed by the nonce. It is absorbed as
    // a stream, so the nonce may be of any length.
    /**
     * @param {uint8[]} K
     * @param {uint8[]} N
     * @param {boolean} tagFlag
     * @param {ByteStream} T
     * @param {boolean} unwrapFlag
     * @param {boolean} forgetFlag
     * @returns {boolean}
     */
    StartEngine(K, N, tagFlag, T, unwrapFlag, forgetFlag) {
      /** @type {int32} */
      const lk = Math.floor(this.W / 8) * Math.floor((this.c + 9 + this.W - 1) / this.W);
      /** @type {uint8[]} */
      const suv = this._keyPack(K, lk);
      for (let i = 0; i < N.length; ++i) suv.push(N[i]);
      /** @type {boolean} */
      const ok = this.motorist.StartEngine(new ByteStream(suv), tagFlag, T, unwrapFlag, forgetFlag);
      return ok;
    }

    /**
     * @param {ByteStream} I
     * @param {ByteStream} O
     * @param {ByteStream} A
     * @param {ByteStream} T
     * @param {boolean} unwrapFlag
     * @param {boolean} forgetFlag
     * @returns {boolean}
     */
    Wrap(I, O, A, T, unwrapFlag, forgetFlag) {
      /** @type {boolean} */
      const ok = this.motorist.Wrap(I, O, A, T, unwrapFlag, forgetFlag);
      return ok;
    }

    // keypack(K, l) = enc8(l) || K || 0x01 || zero padding up to l bytes
    /**
     * @param {uint8[]} K
     * @param {int32} l
     * @returns {uint8[]}
     */
    _keyPack(K, l) {
      if (K.length + 2 > l) {
        throw new Error("The key does not fit in the key pack");
      }

      /** @type {uint8[]} */
      const result = [l];
      for (let i = 0; i < K.length; ++i) result.push(K[i]);
      result.push(0x01);
      while (result.length < l) result.push(0x00);
      return result;
    }
  }

  // Lake Keyak Algorithm
  class LakeKeyak extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Lake Keyak";
      this.description = "CAESAR competition finalist using Keccak-p[1600,12] in the Motorist mode with a single Piston. Primary recommended variant of the Keyak family with balanced security and performance.";
      this.inventor = "Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer";
      this.year = 2016;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      // Lake Keyak parameters: Keyak[b=1600, nr=12, Pi=1, c=256, tau=128]
      /** @type {int32} */
      this.width = 1600;
      /** @type {int32} */
      this.rounds = 12;
      /** @type {int32} */
      this.parallelism = 1;
      /** @type {int32} */
      this.capacity = 256;  // bits
      /** @type {int32} */
      this.tagBits = 128;

      // keypack holds enc8(l) || K || 0x01 within 40 bytes, so keys of up to 38
      // bytes fit; the collection exposes the usual 128 to 256 bit range.
      this.SupportedKeySizes = [new KeySize(16, 32, 8)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)]; // 128-bit tag
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem("Keyak Specification", "https://keccak.team/keyak.html"),
        new LinkItem("Keyak v2 Document", "https://keccak.team/files/Keyakv2-doc2.2.pdf"),
        new LinkItem("CAESAR Competition", "https://competitions.cr.yp.to/caesar-submissions.html")
      ];

      this.references = [
        new LinkItem("Keyak Python Implementation", "https://github.com/samvartaka/keyak-python"),
        new LinkItem("Keccak Team", "https://keccak.team/"),
        new LinkItem("Sponges and Engines Paper", "https://eprint.iacr.org/2016/028")
      ];

      // Test vectors are taken verbatim from the published Lake Keyak known-answer
      // file (TestVectors/LakeKeyak.txt of the reference distribution). Each entry
      // below is a StartEngine(K, N, tagFlag=False, forgetFlag=False) followed by a
      // Wrap(I, O, A, T, unwrapFlag=false, forgetFlag=False), which is exactly what
      // this one-shot AEAD interface performs. "expected" is the published
      // ciphertext O followed by the published tag T.
      this.tests = [
        {
          text: "Lake Keyak: 3-byte message with metadata, empty nonce",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("322b241d160f0801faf3ece5ded7d0c9"),
          nonce: OpCodes.Hex8ToBytes(""),
          aad: OpCodes.Hex8ToBytes("414243"),
          input: OpCodes.Hex8ToBytes("444546"),
          expected: OpCodes.Hex8ToBytes("b60b8e873cfb3393a2b01180bb493b24b53516")
        },
        {
          text: "Lake Keyak: 3-byte message with metadata and 1-byte nonce",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("332c251e17100902fbf4ede6dfd8d1ca"),
          nonce: OpCodes.Hex8ToBytes("f7"),
          aad: OpCodes.Hex8ToBytes("414243"),
          input: OpCodes.Hex8ToBytes("444546"),
          expected: OpCodes.Hex8ToBytes("96c21e0e7ebc5630c61c626624f00f6bbe745d")
        },
        {
          text: "Lake Keyak: 3-byte message with metadata and 2-byte nonce",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("342d261f18110a03fcf5eee7e0d9d2cb"),
          nonce: OpCodes.Hex8ToBytes("995a"),
          aad: OpCodes.Hex8ToBytes("414243"),
          input: OpCodes.Hex8ToBytes("444546"),
          expected: OpCodes.Hex8ToBytes("5058e692a71dae88d4e80116f9e9167071c124")
        },
        {
          // 169-byte body: one byte past the 168-byte crypting rate, so the body
          // spans two Motorist blocks. Published file, first Wrap of the session.
          text: "Lake Keyak: 169-byte message spanning two blocks, 150-byte nonce, no metadata",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("dccdbeafa09182736455463728190afb"),
          nonce: OpCodes.Hex8ToBytes("55d656d757d858d959da5adb5bdc5cdd5dde5edf5fe060e161e262e363e464e565e666e767e868e969ea6aeb6bec6ced6dee6eef6ff070f171f272f373f474f575f676f777f878f979fa7afb7bfc7cfd7dfe7eff7f00800181028203830484058506860787088809890a8a0b8b0c8c0d8d0e8e0f8f10901191129213931494159516961797189819991a9a1b9b1c9c1d9d1e9e1f9f20"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("bfb0a192837465564738291a0bfceddecebfb0a192837465564738291a0bfcedddcebfb0a192837465564738291a0bfcecddcebfb0a192837465564738291a0bfbecddcebfb0a192837465564738291a0afbecddcebfb0a19283746556473829190afbecddcebfb0a19283746556473828190afbecddcebfb0a19283746556473728190afbecddcebfb0a19283746556463728190afbecddcebfb0a19283746555463728190afbecdd"),
          expected: OpCodes.Hex8ToBytes("cce31783d03068c70a4625663f5f9f703d718b32d81f4d2334ee83d3695c8665b07ae40082fd44ea28dbfe0bde36fc3368780de260f38d6157920d807fb5d1451b4d19318266765b3a45c1a52250694abf4d6a307e2e735aad4d87b20ee48fea37e2bbb5949dd0baaad734501412f433c75d11defaed36071ec0beec1e4c4676f8b043c99fa6baa4dafc5ad4386bf1925b1e05ca7f3af7d393f3a0f1f688f888505e8b08456331182364f176345ba37b07828da7898e9ccb81")
        },
        {
          // 193-byte metadata: one byte past the 192-byte injecting rate, so the
          // metadata spans two Motorist blocks. Published file, first Wrap.
          text: "Lake Keyak: empty message with 193-byte metadata spanning two blocks",
          uri: "https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt",
          key: OpCodes.Hex8ToBytes("05e6c7a8896a4b2c0cedceaf90715233"),
          nonce: OpCodes.Hex8ToBytes("5c1dde9f5f20e1a26223e4a56526e7a86829eaab6b2cedae6e2ff0b17132f3b47435f6b77738f9ba7a3bfcbd7d3effc0804102c3834405c6864708c9894a0bcc8c4d0ecf8f5011d2925314d5955617d898591adb9b5c1dde9e5f20e1a16223e4a46526e7a76829eaaa6b2cedad6e2ff0b07132f3b37435f6b67738f9b97a3bfcbc7d3effbf804102c2834405c5864708c8894a0bcb8c"),
          aad: OpCodes.Hex8ToBytes("2304e5c6a788694a2a0beccdae8f70513112f3d4b59677583819fadbbc9d7e5f3f2001e2c3a48566462708e9caab8c6d4d2e0ff0d1b29374543516f7d8b99a7b5b3c1dfedfc0a18262432405e6c7a889694a2b0cedceaf9070513213f4d5b6977758391afbdcbd9e7e5f402102e3c4a58566472809eacbac8c6d4e2f10f1d2b39374553617f8d9ba9a7b5c3d1effe0c1a18263442506e7c8a8896a4b2c0deecfaf9071523314f5d6b69778593a1bfcddbd9e7f60412203e4c4a5866748290aebcb"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("a8652fdc09a7d4036ccf04658db6b83f")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new LakeKeyakInstance(this, isInverse);
    }
  }

  // Lake Keyak Instance
  /**
 * LakeKeyak cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IAeadInstance}
 */

  class LakeKeyakInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {LakeKeyak} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {KeySize[]} */
      this.keySizeList = algorithm.SupportedKeySizes;
      /** @type {boolean} */
      this.isInverse = isInverse;
      this.algorithm = algorithm;

      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]} */
      this._nonce = [];
      /** @type {uint8[]} */
      this._aad = [];

      /** @type {uint8[]} */
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

      // Validate key size
      const sizes = this.keySizeList;
      let isValidSize = false;
      for (let k = 0; k < sizes.length; k++) {
        const ks = sizes[k];
        if (keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize) {
          isValidSize = true;
          break;
        }
      }

      if (!isValidSize) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes");
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
      // The nonce is appended to the key pack and absorbed as a stream, block by
      // block, so Keyak places no upper bound on its length.
      /** @type {uint8[]} */
      let copy = [];
      if (nonceBytes) {
        copy = [...nonceBytes];
      }
      this._nonce = copy;
    }

    /**
     * @returns {uint8[]|null}
     */
    get nonce() {
      /** @type {uint8[]} */
      let copy = [];
      if (this._nonce) {
        copy = [...this._nonce];
      }
      return copy;
    }

    /**
     * @param {uint8[]|null} aadBytes
     */
    set aad(aadBytes) {
      /** @type {uint8[]} */
      let copy = [];
      if (aadBytes) {
        copy = [...aadBytes];
      }
      this._aad = copy;
    }

    /**
     * @returns {uint8[]|null}
     */
    get aad() {
      return [...this._aad];
    }


    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set or the tag does not verify
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // An empty message is a legitimate input to an AEAD: it still has to
      // produce a tag over the key, nonce and associated data, and that tag
      // still has to verify. A decrypt call with nothing at all is caught below
      // by the tag-length check instead.

      /** @type {LakeKeyak} */
      const alg = this.algorithm;
      /** @type {int32} */
      const tagSize = alg.tagBits / 8;

      /** @type {Keyak} */
      const keyak = new Keyak(alg.width, alg.rounds, alg.parallelism, alg.capacity, alg.tagBits);
      const tag = new ByteStream();
      /** @type {uint8[]} */
      let nonce = [];
      if (this._nonce) {
        nonce = this._nonce;
      }
      keyak.StartEngine(this._key, nonce, false, tag, false, false);

      /** @type {uint8[]} */
      let aad = [];
      if (this._aad) {
        aad = this._aad;
      }
      const metadata = new ByteStream(aad);
      const output = new ByteStream();
      /** @type {uint8[]} */
      let result;

      if (this.isInverse) {
        if (this.inputBuffer.length < tagSize) {
          throw new Error("Input too short for tag");
        }

        /** @type {uint8[]} */
        const ciphertext = this.inputBuffer.slice(0, this.inputBuffer.length - tagSize);
        const receivedTag = new ByteStream(this.inputBuffer.slice(this.inputBuffer.length - tagSize));

        /** @type {boolean} */
        const ok = keyak.Wrap(new ByteStream(ciphertext), output, metadata, receivedTag, true, false);
        if (!ok) {
          this.inputBuffer = [];
          throw new Error("Authentication tag verification failed");
        }

        result = output.data;
      } else {
        keyak.Wrap(new ByteStream(this.inputBuffer), output, metadata, tag, false, false);

        // Return ciphertext followed by tag
        result = output.data;
        for (let i = 0; i < tag.data.length; ++i) result.push(tag.data[i]);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new LakeKeyak());
}));
