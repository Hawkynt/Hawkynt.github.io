/*
 * Whirlpool Hash Function - AlgorithmFramework Implementation
 * Based on ISO/IEC 10118-3:2004 specification and RHash reference implementation
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

  // Whirlpool constants
  const WHIRLPOOL_BLOCKSIZE = 64;    // 512 bits = 64 bytes
  const WHIRLPOOL_ROUNDS = 10;       // Number of rounds

  // Round constants from RHash reference implementation
  const RC = Object.freeze([
    0x1823c6e887b8014fn,
    0x36a6d2f5796f9152n,
    0x60bc9b8ea30c7b35n,
    0x1de0d7c22e4bfe57n,
    0x157737e59ff04adan,
    0x58c9290ab1a06b85n,
    0xbd5d10f4cb3e0567n,
    0xe427418ba77d95d8n,
    0xfbee7c66dd17479en,
    0xca2dbf07ad5a8333n
  ]);

  // Whirlpool S-box lookup table (SB0 - first of 8 tables from libtomcrypt/RHash)
  const SB0 = Object.freeze([
    0x18186018c07830d8n, 0x23238c2305af4626n, 0xc6c63fc67ef991b8n, 0xe8e887e8136fcdfbn,
    0x878726874ca113cbn, 0xb8b8dab8a9626d11n, 0x0101040108050209n, 0x4f4f214f426e9e0dn,
    0x3636d836adee6c9bn, 0xa6a6a2a6590451ffn, 0xd2d26fd2debdb90cn, 0xf5f5f3f5fb06f70en,
    0x7979f979ef80f296n, 0x6f6fa16f5fcede30n, 0x91917e91fcef3f6dn, 0x52525552aa07a4f8n,
    0x60609d6027fdc047n, 0xbcbccabc89766535n, 0x9b9b569baccd2b37n, 0x8e8e028e048c018an,
    0xa3a3b6a371155bd2n, 0x0c0c300c603c186cn, 0x7b7bf17bff8af684n, 0x3535d435b5e16a80n,
    0x1d1d741de8693af5n, 0xe0e0a7e05347ddb3n, 0xd7d77bd7f6acb321n, 0xc2c22fc25eed999cn,
    0x2e2eb82e6d965c43n, 0x4b4b314b627a9629n, 0xfefedffea321e15dn, 0x575741578216aed5n,
    0x15155415a8412abdn, 0x7777c1779fb6eee8n, 0x3737dc37a5eb6e92n, 0xe5e5b3e57b56d79en,
    0x9f9f469f8cd92313n, 0xf0f0e7f0d317fd23n, 0x4a4a354a6a7f9420n, 0xdada4fda9e95a944n,
    0x58587d58fa25b0a2n, 0xc9c903c906ca8fcfn, 0x2929a429558d527cn, 0x0a0a280a5022145an,
    0xb1b1feb1e14f7f50n, 0xa0a0baa0691a5dc9n, 0x6b6bb16b7fdad614n, 0x85852e855cab17d9n,
    0xbdbdcebd8173673cn, 0x5d5d695dd234ba8fn, 0x1010401080502090n, 0xf4f4f7f4f303f507n,
    0xcbcb0bcb16c08bddn, 0x3e3ef83eedc67cd3n, 0x0505140528110a2dn, 0x676781671fe6ce78n,
    0xe4e4b7e47353d597n, 0x27279c2725bb4e02n, 0x4141194132588273n, 0x8b8b168b2c9d0ba7n,
    0xa7a7a6a7510153f6n, 0x7d7de97dcf94fab2n, 0x95956e95dcfb3749n, 0xd8d847d88e9fad56n,
    0xfbfbcbfb8b30eb70n, 0xeeee9fee2371c1cdn, 0x7c7ced7cc791f8bbn, 0x6666856617e3cc71n,
    0xdddd53dda68ea77bn, 0x17175c17b84b2eafn, 0x4747014702468e45n, 0x9e9e429e84dc211an,
    0xcaca0fca1ec589d4n, 0x2d2db42d75995a58n, 0xbfbfc6bf9179632en, 0x07071c07381b0e3fn,
    0xadad8ead012347acn, 0x5a5a755aea2fb4b0n, 0x838336836cb51befn, 0x3333cc3385ff66b6n,
    0x636391633ff2c65cn, 0x02020802100a0412n, 0xaaaa92aa39384993n, 0x7171d971afa8e2den,
    0xc8c807c80ecf8dc6n, 0x19196419c87d32d1n, 0x494939497270923bn, 0xd9d943d9869aaf5fn,
    0xf2f2eff2c31df931n, 0xe3e3abe34b48dba8n, 0x5b5b715be22ab6b9n, 0x88881a8834920dbcn,
    0x9a9a529aa4c8293en, 0x262698262dbe4c0bn, 0x3232c8328dfa64bfn, 0xb0b0fab0e94a7d59n,
    0xe9e983e91b6acff2n, 0x0f0f3c0f78331e77n, 0xd5d573d5e6a6b733n, 0x80803a8074ba1df4n,
    0xbebec2be997c6127n, 0xcdcd13cd26de87ebn, 0x3434d034bde46889n, 0x48483d487a759032n,
    0xffffdbffab24e354n, 0x7a7af57af78ff48dn, 0x90907a90f4ea3d64n, 0x5f5f615fc23ebe9dn,
    0x202080201da0403dn, 0x6868bd6867d5d00fn, 0x1a1a681ad07234can, 0xaeae82ae192c41b7n,
    0xb4b4eab4c95e757dn, 0x54544d549a19a8cen, 0x93937693ece53b7fn, 0x222288220daa442fn,
    0x64648d6407e9c863n, 0xf1f1e3f1db12ff2an, 0x7373d173bfa2e6ccn, 0x12124812905a2482n,
    0x40401d403a5d807an, 0x0808200840281048n, 0xc3c32bc356e89b95n, 0xecec97ec337bc5dfn,
    0xdbdb4bdb9690ab4dn, 0xa1a1bea1611f5fc0n, 0x8d8d0e8d1c830791n, 0x3d3df43df5c97ac8n,
    0x97976697ccf1335bn, 0x0000000000000000n, 0xcfcf1bcf36d483f9n, 0x2b2bac2b4587566en,
    0x7676c57697b3ece1n, 0x8282328264b019e6n, 0xd6d67fd6fea9b128n, 0x1b1b6c1bd87736c3n,
    0xb5b5eeb5c15b7774n, 0xafaf86af112943ben, 0x6a6ab56a77dfd41dn, 0x50505d50ba0da0ean,
    0x45450945124c8a57n, 0xf3f3ebf3cb18fb38n, 0x3030c0309df060adn, 0xefef9bef2b74c3c4n,
    0x3f3ffc3fe5c37edan, 0x55554955921caac7n, 0xa2a2b2a2791059dbn, 0xeaea8fea0365c9e9n,
    0x656589650fecca6an, 0xbabad2bab9686903n, 0x2f2fbc2f65935e4an, 0xc0c027c04ee79d8en,
    0xdede5fdebe81a160n, 0x1c1c701ce06c38fcn, 0xfdfdd3fdbb2ee746n, 0x4d4d294d52649a1fn,
    0x92927292e4e03976n, 0x7575c9758fbceafan, 0x06061806301e0c36n, 0x8a8a128a249809aen,
    0xb2b2f2b2f940794bn, 0xe6e6bfe66359d185n, 0x0e0e380e70361c7en, 0x1f1f7c1ff8633ee7n,
    0x6262956237f7c455n, 0xd4d477d4eea3b53an, 0xa8a89aa829324d81n, 0x96966296c4f43152n,
    0xf9f9c3f99b3aef62n, 0xc5c533c566f697a3n, 0x2525942535b14a10n, 0x59597959f220b2abn,
    0x84842a8454ae15d0n, 0x7272d572b7a7e4c5n, 0x3939e439d5dd72ecn, 0x4c4c2d4c5a619816n,
    0x5e5e655eca3bbc94n, 0x7878fd78e785f09fn, 0x3838e038ddd870e5n, 0x8c8c0a8c14860598n,
    0xd1d163d1c6b2bf17n, 0xa5a5aea5410b57e4n, 0xe2e2afe2434dd9a1n, 0x616199612ff8c24en,
    0xb3b3f6b3f1457b42n, 0x2121842115a54234n, 0x9c9c4a9c94d62508n, 0x1e1e781ef0663ceen,
    0x4343114322528661n, 0xc7c73bc776fc93b1n, 0xfcfcd7fcb32be54fn, 0x0404100420140824n,
    0x51515951b208a2e3n, 0x99995e99bcc72f25n, 0x6d6da96d4fc4da22n, 0x0d0d340d68391a65n,
    0xfafacffa8335e979n, 0xdfdf5bdfb684a369n, 0x7e7ee57ed79bfca9n, 0x242490243db44819n,
    0x3b3bec3bc5d776fen, 0xabab96ab313d4b9an, 0xcece1fce3ed181f0n, 0x1111441188552299n,
    0x8f8f068f0c890383n, 0x4e4e254e4a6b9c04n, 0xb7b7e6b7d1517366n, 0xebeb8beb0b60cbe0n,
    0x3c3cf03cfdcc78c1n, 0x81813e817cbf1ffdn, 0x94946a94d4fe3540n, 0xf7f7fbf7eb0cf31cn,
    0xb9b9deb9a1676f18n, 0x13134c13985f268bn, 0x2c2cb02c7d9c5851n, 0xd3d36bd3d6b8bb05n,
    0xe7e7bbe76b5cd38cn, 0x6e6ea56e57cbdc39n, 0xc4c437c46ef395aan, 0x03030c03180f061bn,
    0x565645568a13acdcn, 0x44440d441a49885en, 0x7f7fe17fdf9efea0n, 0xa9a99ea921374f88n,
    0x2a2aa82a4d825467n, 0xbbbbd6bbb16d6b0an, 0xc1c123c146e29f87n, 0x53535153a202a6f1n,
    0xdcdc57dcae8ba572n, 0x0b0b2c0b58271653n, 0x9d9d4e9d9cd32701n, 0x6c6cad6c47c1d82bn,
    0x3131c43195f562a4n, 0x7474cd7487b9e8f3n, 0xf6f6fff6e309f115n, 0x464605460a438c4cn,
    0xacac8aac092645a5n, 0x89891e893c970fb5n, 0x14145014a04428b4n, 0xe1e1a3e15b42dfban,
    0x16165816b04e2ca6n, 0x3a3ae83acdd274f7n, 0x6969b9696fd0d206n, 0x09092409482d1241n,
    0x7070dd70a7ade0d7n, 0xb6b6e2b6d954716fn, 0xd0d067d0ceb7bd1en, 0xeded93ed3b7ec7d6n,
    0xcccc17cc2edb85e2n, 0x424215422a578468n, 0x98985a98b4c22d2cn, 0xa4a4aaa4490e55edn,
    0x2828a0285d885075n, 0x5c5c6d5cda31b886n, 0xf8f8c7f8933fed6bn, 0x8686228644a411c2n
  ]);

  // Extract byte from 64-bit word at position (0-7)
  // pos 0 = MSB (bits 56-63), pos 7 = LSB (bits 0-7)
  function getByte(word, pos) {
    const shift = BigInt(((~pos) & 7) * 8);
    return Number((word >> shift) & 0xFFn);
  }

  // Rotate right for 64-bit BigInt
  function rotr64(value, bits) {
    const shift = BigInt(bits);
    return ((value >> shift) | (value << (64n - shift))) & 0xFFFFFFFFFFFFFFFFn;
  }

  // Whirlpool theta_pi_gamma operation using single S-box with rotations (Botan approach)
  function whirlpoolOp(x0, x1, x2, x3, x4, x5, x6, x7) {
    const s0 = SB0[getByte(x0, 0)];
    const s1 = SB0[getByte(x1, 1)];
    const s2 = SB0[getByte(x2, 2)];
    const s3 = SB0[getByte(x3, 3)];
    const s4 = SB0[getByte(x4, 4)];
    const s5 = SB0[getByte(x5, 5)];
    const s6 = SB0[getByte(x6, 6)];
    const s7 = SB0[getByte(x7, 7)];

    return s0 ^ rotr64(s1, 8) ^ rotr64(s2, 16) ^ rotr64(s3, 24) ^
           rotr64(s4, 32) ^ rotr64(s5, 40) ^ rotr64(s6, 48) ^ rotr64(s7, 56);
  }

  /**
 * WhirlpoolAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class WhirlpoolAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Whirlpool";
      this.description = "Whirlpool is a cryptographic hash function designed by Vincent Rijmen and Paulo S. L. M. Barreto. It produces a 512-bit hash value and is based on a substantially modified AES.";
      this.inventor = "Vincent Rijmen, Paulo S. L. M. Barreto";
      this.year = 2000;
      this.category = CategoryType.HASH;
      this.subCategory = "AES-Based Hash";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.MULTI;

      // Hash-specific metadata
      this.SupportedOutputSizes = [64]; // 512 bits

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 64; // 512 bits = 64 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("ISO/IEC 10118-3:2004", "https://www.iso.org/standard/39876.html"),
        new LinkItem("Whirlpool Specification", "https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/whirlpool.zip")
      ];

      this.references = [
        new LinkItem("Wikipedia: Whirlpool", "https://en.wikipedia.org/wiki/Whirlpool_(hash_function)"),
        new LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/")
      ];

      // Test vectors from ISO/IEC 10118-3
      this.tests = [
        {
          text: "ISO/IEC Test Vector - Empty String",
          uri: "https://www.iso.org/standard/39876.html",
          input: [],
          expected: OpCodes.Hex8ToBytes("19fa61d75522a4669b44e39c1d2e1726c530232130d407f89afee0964997f7a73e83be698b288febcf88e3e03c4f0757ea8964e59b63d93708b138cc42a66eb3")
        },
        {
          text: "ISO/IEC Test Vector - 'a'",
          uri: "https://www.iso.org/standard/39876.html",
          input: [97], // "a"
          expected: OpCodes.Hex8ToBytes("8aca2602792aec6f11a67206531fb7d7f0dff59413145e6973c45001d0087b42d11bc645413aeff63a42391a39145a591a92200d560195e53b478584fdae231a")
        },
        {
          text: "ISO/IEC Test Vector - 'abc'",
          uri: "https://www.iso.org/standard/39876.html",
          input: [97, 98, 99], // "abc"
          expected: OpCodes.Hex8ToBytes("4e2448a4c6f486bb16b6562c73b4020bf3043e3a731bce721ae1b303d97e6d4c7181eebdb6c57e277d0e34957114cbd6c797fc9d95d8b582d225292076d4eef5")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new WhirlpoolAlgorithmInstance(this, isInverse);
    }
  }

  /**
 * WhirlpoolAlgorithm cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class WhirlpoolAlgorithmInstance extends IHashFunctionInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 64; // 512 bits = 64 bytes

      this.init();
    }

    // Initialize Whirlpool state
    init() {
      // 8 64-bit words (512 bits total) - initialized to all zeros
      this.state = new Array(8).fill(0n);
      this.buffer = new Array(WHIRLPOOL_BLOCKSIZE).fill(0);
      this.bufferLength = 0;
      this.totalLength = 0;
    }

    Init() {
      this.init();
    }

    /**
     * Whirlpool compression function based on RHash implementation
     */
    processBlock(block) {
      // Convert block to 64-bit words (big-endian)
      const blockWords = new Array(8);
      for (let i = 0; i < 8; i++) {
        blockWords[i] = 0n;
        for (let j = 0; j < 8; j++) {
          blockWords[i] = (blockWords[i] << 8n) | BigInt(block[i * 8 + j]);
        }
      }

      // Initialize key schedule array (11 rounds * 8 words)
      const K = new Array(11 * 8);
      for (let i = 0; i < 8; i++) {
        K[i] = this.state[i];
      }

      // Generate key schedule for 10 rounds
      for (let r = 1; r <= WHIRLPOOL_ROUNDS; r++) {
        const prevIdx = 8 * (r - 1);
        const currIdx = 8 * r;
        K[currIdx + 0] = whirlpoolOp(K[prevIdx+0], K[prevIdx+7], K[prevIdx+6], K[prevIdx+5],
                                      K[prevIdx+4], K[prevIdx+3], K[prevIdx+2], K[prevIdx+1]) ^ RC[r-1];
        K[currIdx + 1] = whirlpoolOp(K[prevIdx+1], K[prevIdx+0], K[prevIdx+7], K[prevIdx+6],
                                      K[prevIdx+5], K[prevIdx+4], K[prevIdx+3], K[prevIdx+2]);
        K[currIdx + 2] = whirlpoolOp(K[prevIdx+2], K[prevIdx+1], K[prevIdx+0], K[prevIdx+7],
                                      K[prevIdx+6], K[prevIdx+5], K[prevIdx+4], K[prevIdx+3]);
        K[currIdx + 3] = whirlpoolOp(K[prevIdx+3], K[prevIdx+2], K[prevIdx+1], K[prevIdx+0],
                                      K[prevIdx+7], K[prevIdx+6], K[prevIdx+5], K[prevIdx+4]);
        K[currIdx + 4] = whirlpoolOp(K[prevIdx+4], K[prevIdx+3], K[prevIdx+2], K[prevIdx+1],
                                      K[prevIdx+0], K[prevIdx+7], K[prevIdx+6], K[prevIdx+5]);
        K[currIdx + 5] = whirlpoolOp(K[prevIdx+5], K[prevIdx+4], K[prevIdx+3], K[prevIdx+2],
                                      K[prevIdx+1], K[prevIdx+0], K[prevIdx+7], K[prevIdx+6]);
        K[currIdx + 6] = whirlpoolOp(K[prevIdx+6], K[prevIdx+5], K[prevIdx+4], K[prevIdx+3],
                                      K[prevIdx+2], K[prevIdx+1], K[prevIdx+0], K[prevIdx+7]);
        K[currIdx + 7] = whirlpoolOp(K[prevIdx+7], K[prevIdx+6], K[prevIdx+5], K[prevIdx+4],
                                      K[prevIdx+3], K[prevIdx+2], K[prevIdx+1], K[prevIdx+0]);
      }

      // Initialize state with block XOR key
      let B0 = blockWords[0] ^ K[0];
      let B1 = blockWords[1] ^ K[1];
      let B2 = blockWords[2] ^ K[2];
      let B3 = blockWords[3] ^ K[3];
      let B4 = blockWords[4] ^ K[4];
      let B5 = blockWords[5] ^ K[5];
      let B6 = blockWords[6] ^ K[6];
      let B7 = blockWords[7] ^ K[7];

      // 10 rounds of Whirlpool transformation
      for (let r = 1; r <= WHIRLPOOL_ROUNDS; r++) {
        const keyIdx = 8 * r;
        const T0 = whirlpoolOp(B0, B7, B6, B5, B4, B3, B2, B1) ^ K[keyIdx + 0];
        const T1 = whirlpoolOp(B1, B0, B7, B6, B5, B4, B3, B2) ^ K[keyIdx + 1];
        const T2 = whirlpoolOp(B2, B1, B0, B7, B6, B5, B4, B3) ^ K[keyIdx + 2];
        const T3 = whirlpoolOp(B3, B2, B1, B0, B7, B6, B5, B4) ^ K[keyIdx + 3];
        const T4 = whirlpoolOp(B4, B3, B2, B1, B0, B7, B6, B5) ^ K[keyIdx + 4];
        const T5 = whirlpoolOp(B5, B4, B3, B2, B1, B0, B7, B6) ^ K[keyIdx + 5];
        const T6 = whirlpoolOp(B6, B5, B4, B3, B2, B1, B0, B7) ^ K[keyIdx + 6];
        const T7 = whirlpoolOp(B7, B6, B5, B4, B3, B2, B1, B0) ^ K[keyIdx + 7];

        B0 = T0;
        B1 = T1;
        B2 = T2;
        B3 = T3;
        B4 = T4;
        B5 = T5;
        B6 = T6;
        B7 = T7;
      }

      // Miyaguchi-Preneel: hash = hash XOR final_state XOR block
      this.state[0] ^= B0 ^ blockWords[0];
      this.state[1] ^= B1 ^ blockWords[1];
      this.state[2] ^= B2 ^ blockWords[2];
      this.state[3] ^= B3 ^ blockWords[3];
      this.state[4] ^= B4 ^ blockWords[4];
      this.state[5] ^= B5 ^ blockWords[5];
      this.state[6] ^= B6 ^ blockWords[6];
      this.state[7] ^= B7 ^ blockWords[7];
    }

    /**
     * Update with data
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        const bytes = [];
        for (let i = 0; i < data.length; i++) {
          bytes.push(data.charCodeAt(i) & 0xFF);
        }
        data = bytes;
      }

      this.totalLength += data.length;
      let offset = 0;

      // Fill buffer first
      while (offset < data.length && this.bufferLength < WHIRLPOOL_BLOCKSIZE) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      // Process full buffer
      if (this.bufferLength === WHIRLPOOL_BLOCKSIZE) {
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }

      // Process remaining full blocks
      while (offset + WHIRLPOOL_BLOCKSIZE <= data.length) {
        const block = data.slice(offset, offset + WHIRLPOOL_BLOCKSIZE);
        this.processBlock(block);
        offset += WHIRLPOOL_BLOCKSIZE;
      }

      // Store remaining bytes in buffer
      while (offset < data.length) {
        this.buffer[this.bufferLength++] = data[offset++];
      }
    }

    /**
     * Finalize and return hash
     */
    Final() {
      // Whirlpool padding: 0x80 + zeros + 64-bit length (like reference)
      this.buffer[this.bufferLength++] = 0x80;

      // Check if we need another block for the length
      if (this.bufferLength > 56) {
        // Fill current block with zeros and process it
        while (this.bufferLength < WHIRLPOOL_BLOCKSIZE) {
          this.buffer[this.bufferLength++] = 0x00;
        }
        this.processBlock(this.buffer);
        this.bufferLength = 0;
      }

      // Fill with zeros up to length field
      while (this.bufferLength < 56) {
        this.buffer[this.bufferLength++] = 0x00;
      }

      // Append 64-bit length in big-endian format (like reference implementation)
      const bitLength = this.totalLength * 8;
      for (let i = 0; i < 8; i++) {
        this.buffer[56 + i] = Number((BigInt(bitLength) >> BigInt(56 - i * 8)) & 0xFFn);
      }
      this.bufferLength = 64;

      // Process final block
      this.processBlock(this.buffer);

      // Convert state BigInt array to bytes (big-endian)
      const result = new Array(64);
      for (let i = 0; i < 8; i++) {
        const word = this.state[i];
        for (let j = 0; j < 8; j++) {
          result[i * 8 + j] = Number((word >> BigInt(56 - j * 8)) & 0xFFn);
        }
      }

      return result;
    }

    /**
     * Hash a complete message
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    // Interface compatibility methods
    KeySetup(key) {
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('Whirlpool is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this.state) {
        OpCodes.ClearArray(this.state);
      }
      if (this.buffer) {
        OpCodes.ClearArray(this.buffer);
      }
      this.totalLength = 0;
      this.bufferLength = 0;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      this.Init();
      this.Update(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      return this.Final();
    }
  }

  // Register the algorithm
  const algorithmInstance = new WhirlpoolAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { WhirlpoolAlgorithm, WhirlpoolAlgorithmInstance };
}));