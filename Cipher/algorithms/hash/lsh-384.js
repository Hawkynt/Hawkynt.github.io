/*
 * LSH-384 - Korean Hash Function Standard (384-bit)
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * LSH (Lightweight Secure Hash) is a Korean cryptographic hash function
 * standardized by KISA (Korea Internet & Security Agency)
 * Uses 512-bit internal processing with 384-bit output
 * Reference: https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do
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

  const { RegisterAlgorithm, CategoryType, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // LSH-512 constants
  const LSH512_MSG_BLK_BYTE_LEN = 256;
  const NUM_STEPS = 28;
  const ROT_EVEN_ALPHA = 23;
  const ROT_EVEN_BETA = 59;
  const ROT_ODD_ALPHA = 7;
  const ROT_ODD_BETA = 3;

  // Gamma rotation constants
  const g_gamma512 = Object.freeze([0, 16, 32, 48, 8, 24, 40, 56]);

  // Initial values for LSH-384 (16 x 64-bit words)
  const LSH512_IV384 = Object.freeze([
    0x53156a66292808f6n, 0xb2c4f362b204c2bcn, 0xb84b7213bfa05c4en, 0x976ceb7c1b299f73n,
    0xdf0cc63c0570ae97n, 0xda4441baa486ce3fn, 0x6559f5d9b5f2acc2n, 0x22dacf19b4b52a16n,
    0xbbcdacefde80953an, 0xc9891a2879725b3en, 0x7c9fe6330237e440n, 0xa30ba550553f7431n,
    0xbb08043fb34e3e30n, 0xa0dec48d54618eadn, 0x150317267464bc57n, 0x32d1501fde63dc93n
  ]);

  // Step constants (28 steps × 8 words = 224 constants)
  const LSH512_StepConstants = Object.freeze([
    0x97884283c938982an, 0xba1fca93533e2355n, 0xc519a2e87aeb1c03n, 0x9a0fc95462af17b1n,
    0xfc3dda8ab019a82bn, 0x02825d079a895407n, 0x79f2d0a7ee06a6f7n, 0xd76d15eed9fdf5fen,
    0x1fcac64d01d0c2c1n, 0xd9ea5de69161790fn, 0xdebc8b6366071fc8n, 0xa9d91db711c6c94bn,
    0x3a18653ac9c1d427n, 0x84df64a223dd5b09n, 0x6cc37895f4ad9e70n, 0x448304c8d7f3f4d5n,
    0xea91134ed29383e0n, 0xc4484477f2da88e8n, 0x9b47eec96d26e8a6n, 0x82f6d4c8d89014f4n,
    0x527da0048b95fb61n, 0x644406c60138648dn, 0x303c0e8aa24c0edcn, 0xc787cda0cbe8ca19n,
    0x7ba46221661764can, 0x0c8cbc6acd6371acn, 0xe336b836940f8f41n, 0x79cb9da168a50976n,
    0xd01da49021915cb3n, 0xa84accc7399cf1f1n, 0x6c4a992cee5aeb0cn, 0x4f556e6cb4b2e3e0n,
    0x200683877d7c2f45n, 0x9949273830d51db8n, 0x19eeeecaa39ed124n, 0x45693f0a0dae7fefn,
    0xedc234b1b2ee1083n, 0xf3179400d68ee399n, 0xb6e3c61b4945f778n, 0xa4c3db216796c42fn,
    0x268a0b04f9ab7465n, 0xe2705f6905f2d651n, 0x08ddb96e426ff53dn, 0xaea84917bc2e6f34n,
    0xaff6e664a0fe9470n, 0x0aab94d765727d8cn, 0x9aa9e1648f3d702en, 0x689efc88fe5af3d3n,
    0xb0950ffea51fd98bn, 0x52cfc86ef8c92833n, 0xe69727b0b2653245n, 0x56f160d3ea9da3e2n,
    0xa6dd4b059f93051fn, 0xb6406c3cd7f00996n, 0x448b45f3ccad9ec8n, 0x079b8587594ec73bn,
    0x45a50ea3c4f9653bn, 0x22983767c1f15b85n, 0x7dbed8631797782bn, 0x485234be88418638n,
    0x842850a5329824c5n, 0xf6aca914c7f9a04cn, 0xcfd139c07a4c670cn, 0xa3210ce0a8160242n,
    0xeab3b268be5ea080n, 0xbacf9f29b34ce0a7n, 0x3c973b7aaf0fa3a8n, 0x9a86f346c9c7be80n,
    0xac78f5d7cabcea49n, 0xa355bddcc199ed42n, 0xa10afa3ac6b373dbn, 0xc42ded88be1844e5n,
    0x9e661b271cff216an, 0x8a6ec8dd002d8861n, 0xd3d2b629beb34be4n, 0x217a3a1091863f1an,
    0x256ecda287a733f5n, 0xf9139a9e5b872fe5n, 0xac0535017a274f7cn, 0xf21b7646d65d2aa9n,
    0x048142441c208c08n, 0xf937a5dd2db5e9ebn, 0xa688dfe871ff30b7n, 0x9bb44aa217c5593bn,
    0x943c702a2edb291an, 0x0cae38f9e2b715den, 0xb13a367ba176cc28n, 0x0d91bd1d3387d49bn,
    0x85c386603cac940cn, 0x30dd830ae39fd5e4n, 0x2f68c85a712fe85dn, 0x4ffeecb9dd1e94d6n,
    0xd0ac9a590a0443aen, 0xbae732dc99ccf3ean, 0xeb70b21d1842f4d9n, 0x9f4eda50bb5c6fa8n,
    0x4949e69ce940a091n, 0x0e608dee8375ba14n, 0x983122cba118458cn, 0x4eeba696fbb36b25n,
    0x7d46f3630e47f27en, 0xa21a0f7666c0dea4n, 0x5c22cf355b37cec4n, 0xee292b0c17cc1847n,
    0x9330838629e131dan, 0x6eee7c71f92fce22n, 0xc953ee6cb95dd224n, 0x3a923d92af1e9073n,
    0xc43a5671563a70fbn, 0xbc2985dd279f8346n, 0x7ef2049093069320n, 0x17543723e3e46035n,
    0xc3b409b00b130c6dn, 0x5d6aee6b28fdf090n, 0x1d425b26172ff6edn, 0xcccfd041cdaf03adn,
    0xfe90c7c790ab6cbfn, 0xe5af6304c722ca02n, 0x70f695239999b39en, 0x6b8b5b07c844954cn,
    0x77bdb9bb1e1f7a30n, 0xc859599426ee80edn, 0x5f9d813d4726e40an, 0x9ca0120f7cb2b179n,
    0x8f588f583c182cbdn, 0x951267cbe9eccce7n, 0x678bb8bd334d520en, 0xf6e662d00cd9e1b7n,
    0x357774d93d99aaa7n, 0x21b2edbb156f6eb5n, 0xfd1ebe846e0aee69n, 0x3cb2218c2f642b15n,
    0xe7e7e7945444ea4cn, 0xa77a33b5d6b9b47cn, 0xf34475f0809f6075n, 0xdd4932dce6bb99adn,
    0xacec4e16d74451dcn, 0xd4a0a8d084de23d6n, 0x1bdd42f278f95866n, 0xeed3adbb938f4051n,
    0xcfcf7be8992f3733n, 0x21ade98c906e3123n, 0x37ba66711fffd668n, 0x267c0fc3a255478an,
    0x993a64ee1b962e88n, 0x754979556301faaan, 0xf920356b7251be81n, 0xc281694f22cf923fn,
    0x9f4b6481c8666b02n, 0xcf97761cfe9f5444n, 0xf220d7911fd63e9fn, 0xa28bd365f79cd1b0n,
    0xd39f5309b1c4b721n, 0xbec2ceb864fca51fn, 0x1955a0ddc410407an, 0x43eab871f261d201n,
    0xeaafe64a2ed16da1n, 0x670d931b9df39913n, 0x12f868b0f614de91n, 0x2e5f395d946e8252n,
    0x72f25cbb767bd8f4n, 0x8191871d61a1c4ddn, 0x6ef67ea1d450ba93n, 0x2ea32a645433d344n,
    0x9a963079003f0f8bn, 0x74a0aeb9918cac7an, 0x0b6119a70af36fa3n, 0x8d9896f202f0d480n,
    0x654f1831f254cd66n, 0x1318a47f0366a25en, 0x65752076250b4e01n, 0xd1cd8eb888071772n,
    0x30c6a9793f4e9b25n, 0x154f684b1e3926een, 0x6c7ac0b1fe6312aen, 0x262f88f4f3c5550dn,
    0xb4674a24472233cbn, 0x2bbd23826a090071n, 0xda95969b30594f66n, 0x9f5c47408f1e8a43n,
    0xf77022b88de9c055n, 0x64b7b36957601503n, 0xe73b72b06175c11an, 0x55b87de8b91a6233n,
    0x1bb16e6b6955ff7fn, 0xe8e0a5ec7309719cn, 0x702c31cb89a8b640n, 0xfba387cfada8cde2n,
    0x6792db4677aa164cn, 0x1c6b1cc0b7751867n, 0x22ae2311d736dc01n, 0x0e3666a1d37c9588n,
    0xcd1fd9d4bf557e9an, 0xc986925f7c7b0e84n, 0x9c5dfd55325ef6b0n, 0x9f2b577d5676b0ddn,
    0xfa6e21be21c062b3n, 0x8787dd782c8d7f83n, 0xd0d134e90e12dd23n, 0x449d087550121d96n,
    0xecf9ae9414d41967n, 0x5018f1dbf789934dn, 0xfa5b52879155a74cn, 0xca82d4d3cd278e7cn,
    0x688fdfdfe22316adn, 0x0f6555a4ba0d030an, 0xa2061df720f000f3n, 0xe1a57dc5622fb3dan,
    0xe6a842a8e8ed8153n, 0x690acdd3811ce09dn, 0x55adda18e6fcf446n, 0x4d57a8a0f4b60b46n,
    0xf86fbfc20539c415n, 0x74bafa5ec7100d19n, 0xa824151810f0f495n, 0x8723432791e38ebbn,
    0x8eeaeb91d66ed539n, 0x73d8a1549dfd7e06n, 0x0387f2ffe3f13a9bn, 0xa5004995aac15193n,
    0x682f81c73efdda0dn, 0x2fb55925d71d268dn, 0xcc392d2901e58a3dn, 0xaa666ab975724a42n
  ]);

  // 64-bit mask for BigInt operations
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  // 64-bit rotation using BigInt
  function rotl64(val, n) {
    n = BigInt(n) % 64n;
    return ((val << n) | (val >> (64n - n))) & MASK64;
  }

  class LSH384Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-384";
      this.description = "Korean cryptographic hash function standard producing 384-bit digests. Uses 512-bit internal processing with 28-step compression and 64-bit operations.";
      this.inventor = "Korea Internet & Security Agency (KISA)";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "LSH Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedHashSizes = [new KeySize(48, 48, 1)];
      this.BlockSize = 256;

      this.documentation = [
        new LinkItem("KISA LSH Page", "https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do"),
        new LinkItem("LSH Specification", "https://seed.kisa.or.kr/kisa/Board/22/detailView.do")
      ];

      this.references = [
        new LinkItem("Crypto++ LSH-512 Family", "https://github.com/weidai11/cryptopp/blob/master/lsh512.cpp"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt")
      ];

      this.tests = [
        {
          text: "LSH-384: Empty (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("dbb259cf22459368ab2c52b3e1c977288b38670adcb91cae6b8b6a2d646e76f8bd53e5cab0e47c856f55249b895c1730")
        },
        {
          text: "LSH-384: Single byte (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: OpCodes.Hex8ToBytes("76"),
          expected: OpCodes.Hex8ToBytes("52ff6386afce2189733ab9f206dd87774c22c1475b22f4e72cb7f603c1ac54402c63cabe2cf10cf01697a0da717de9ec")
        },
        {
          text: "LSH-384: Two bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: OpCodes.Hex8ToBytes("0adc"),
          expected: OpCodes.Hex8ToBytes("483c7ae2baf4323296482c47e02323aa2aa6d3b0cdd1d386b91d8ba1f707025ca0b469515e72cd593f027d21367e36c7")
        },
        {
          text: "LSH-384: Three bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: OpCodes.Hex8ToBytes("3c0f2e"),
          expected: OpCodes.Hex8ToBytes("66f0262b988628d2691f9b0d87e123c48eff9ac3e6549bc96c808359b1ae596c16d51c256b2c21f59e5d92ccc2509221")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new LSH384Instance(this);
    }
  }

  class LSH384Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);

      // State: 16 x 64-bit words (cv_l[8] + cv_r[8])
      this.cv_l = new Array(8);
      this.cv_r = new Array(8);

      // Sub-messages for compression (32 x 64-bit words)
      this.submsg_e_l = new Array(8);
      this.submsg_e_r = new Array(8);
      this.submsg_o_l = new Array(8);
      this.submsg_o_r = new Array(8);

      // Message buffer
      this.buffer = new Uint8Array(LSH512_MSG_BLK_BYTE_LEN);
      this.bufferLength = 0;

      this._init();
    }

    _init() {
      // Initialize with LSH-384 IV
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = LSH512_IV384[i];
        this.cv_r[i] = LSH512_IV384[i + 8];
      }

      // Clear sub-messages
      for (let i = 0; i < 8; i++) {
        this.submsg_e_l[i] = 0n;
        this.submsg_e_r[i] = 0n;
        this.submsg_o_l[i] = 0n;
        this.submsg_o_r[i] = 0n;
      }

      this.bufferLength = 0;
    }

    _load_msg_blk(msgblk) {
      // Load 256 bytes into 32 x 64-bit words (little-endian)
      const view = new DataView(msgblk.buffer, msgblk.byteOffset, msgblk.byteLength);

      for (let i = 0; i < 8; i++) {
        this.submsg_e_l[i] = view.getBigUint64(i * 8, true);
        this.submsg_e_r[i] = view.getBigUint64(64 + i * 8, true);
        this.submsg_o_l[i] = view.getBigUint64(128 + i * 8, true);
        this.submsg_o_r[i] = view.getBigUint64(192 + i * 8, true);
      }
    }

    _msg_exp_even() {
      let temp;

      temp = this.submsg_e_l[0];
      this.submsg_e_l[0] = (this.submsg_o_l[0] + this.submsg_e_l[3]) & MASK64;
      this.submsg_e_l[3] = (this.submsg_o_l[3] + this.submsg_e_l[1]) & MASK64;
      this.submsg_e_l[1] = (this.submsg_o_l[1] + this.submsg_e_l[2]) & MASK64;
      this.submsg_e_l[2] = (this.submsg_o_l[2] + temp) & MASK64;

      temp = this.submsg_e_l[4];
      this.submsg_e_l[4] = (this.submsg_o_l[4] + this.submsg_e_l[7]) & MASK64;
      this.submsg_e_l[7] = (this.submsg_o_l[7] + this.submsg_e_l[6]) & MASK64;
      this.submsg_e_l[6] = (this.submsg_o_l[6] + this.submsg_e_l[5]) & MASK64;
      this.submsg_e_l[5] = (this.submsg_o_l[5] + temp) & MASK64;

      temp = this.submsg_e_r[0];
      this.submsg_e_r[0] = (this.submsg_o_r[0] + this.submsg_e_r[3]) & MASK64;
      this.submsg_e_r[3] = (this.submsg_o_r[3] + this.submsg_e_r[1]) & MASK64;
      this.submsg_e_r[1] = (this.submsg_o_r[1] + this.submsg_e_r[2]) & MASK64;
      this.submsg_e_r[2] = (this.submsg_o_r[2] + temp) & MASK64;

      temp = this.submsg_e_r[4];
      this.submsg_e_r[4] = (this.submsg_o_r[4] + this.submsg_e_r[7]) & MASK64;
      this.submsg_e_r[7] = (this.submsg_o_r[7] + this.submsg_e_r[6]) & MASK64;
      this.submsg_e_r[6] = (this.submsg_o_r[6] + this.submsg_e_r[5]) & MASK64;
      this.submsg_e_r[5] = (this.submsg_o_r[5] + temp) & MASK64;
    }

    _msg_exp_odd() {
      let temp;

      temp = this.submsg_o_l[0];
      this.submsg_o_l[0] = (this.submsg_e_l[0] + this.submsg_o_l[3]) & MASK64;
      this.submsg_o_l[3] = (this.submsg_e_l[3] + this.submsg_o_l[1]) & MASK64;
      this.submsg_o_l[1] = (this.submsg_e_l[1] + this.submsg_o_l[2]) & MASK64;
      this.submsg_o_l[2] = (this.submsg_e_l[2] + temp) & MASK64;

      temp = this.submsg_o_l[4];
      this.submsg_o_l[4] = (this.submsg_e_l[4] + this.submsg_o_l[7]) & MASK64;
      this.submsg_o_l[7] = (this.submsg_e_l[7] + this.submsg_o_l[6]) & MASK64;
      this.submsg_o_l[6] = (this.submsg_e_l[6] + this.submsg_o_l[5]) & MASK64;
      this.submsg_o_l[5] = (this.submsg_e_l[5] + temp) & MASK64;

      temp = this.submsg_o_r[0];
      this.submsg_o_r[0] = (this.submsg_e_r[0] + this.submsg_o_r[3]) & MASK64;
      this.submsg_o_r[3] = (this.submsg_e_r[3] + this.submsg_o_r[1]) & MASK64;
      this.submsg_o_r[1] = (this.submsg_e_r[1] + this.submsg_o_r[2]) & MASK64;
      this.submsg_o_r[2] = (this.submsg_e_r[2] + temp) & MASK64;

      temp = this.submsg_o_r[4];
      this.submsg_o_r[4] = (this.submsg_e_r[4] + this.submsg_o_r[7]) & MASK64;
      this.submsg_o_r[7] = (this.submsg_e_r[7] + this.submsg_o_r[6]) & MASK64;
      this.submsg_o_r[6] = (this.submsg_e_r[6] + this.submsg_o_r[5]) & MASK64;
      this.submsg_o_r[5] = (this.submsg_e_r[5] + temp) & MASK64;
    }

    _msg_add_even() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= this.submsg_e_l[i];
        this.cv_r[i] ^= this.submsg_e_r[i];
      }
    }

    _msg_add_odd() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= this.submsg_o_l[i];
        this.cv_r[i] ^= this.submsg_o_r[i];
      }
    }

    _add_blk() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = (this.cv_l[i] + this.cv_r[i]) & MASK64;
      }
    }

    _rotate_blk(alpha) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = rotl64(this.cv_l[i], alpha);
      }
    }

    _xor_with_const(const_v, offset) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= LSH512_StepConstants[offset + i];
      }
    }

    _rotate_msg_gamma() {
      for (let i = 1; i < 8; i++) {
        this.cv_r[i] = rotl64(this.cv_r[i], g_gamma512[i]);
      }
    }

    _word_perm() {
      let temp;

      temp = this.cv_l[0];
      this.cv_l[0] = this.cv_l[6];
      this.cv_l[6] = this.cv_r[6];
      this.cv_r[6] = this.cv_r[2];
      this.cv_r[2] = this.cv_l[1];
      this.cv_l[1] = this.cv_l[4];
      this.cv_l[4] = this.cv_r[4];
      this.cv_r[4] = this.cv_r[0];
      this.cv_r[0] = this.cv_l[2];
      this.cv_l[2] = this.cv_l[5];
      this.cv_l[5] = this.cv_r[7];
      this.cv_r[7] = this.cv_r[1];
      this.cv_r[1] = temp;

      temp = this.cv_l[3];
      this.cv_l[3] = this.cv_l[7];
      this.cv_l[7] = this.cv_r[5];
      this.cv_r[5] = this.cv_r[3];
      this.cv_r[3] = temp;
    }

    _mix(alpha, beta, const_v_offset) {
      this._add_blk();
      this._rotate_blk(alpha);
      this._xor_with_const(null, const_v_offset);

      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = (this.cv_r[i] + this.cv_l[i]) & MASK64;
      }

      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = rotl64(this.cv_r[i], beta);
      }

      this._add_blk();
      this._rotate_msg_gamma();
    }

    _compress(msgblk) {
      this._load_msg_blk(msgblk);

      // Step 0 (even)
      this._msg_add_even();
      this._mix(ROT_EVEN_ALPHA, ROT_EVEN_BETA, 0);
      this._word_perm();

      // Step 1 (odd)
      this._msg_add_odd();
      this._mix(ROT_ODD_ALPHA, ROT_ODD_BETA, 8);
      this._word_perm();

      // Steps 2-27
      for (let i = 1; i < NUM_STEPS / 2; i++) {
        // Even step
        this._msg_exp_even();
        this._msg_add_even();
        this._mix(ROT_EVEN_ALPHA, ROT_EVEN_BETA, 16 * i);
        this._word_perm();

        // Odd step
        this._msg_exp_odd();
        this._msg_add_odd();
        this._mix(ROT_ODD_ALPHA, ROT_ODD_BETA, 16 * i + 8);
        this._word_perm();
      }

      // Final message addition
      this._msg_exp_even();
      this._msg_add_even();
    }

    Feed(data) {
      if (!data || data.length === 0) return;

      let offset = 0;

      // Fill buffer
      while (offset < data.length && this.bufferLength < LSH512_MSG_BLK_BYTE_LEN) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      // Process complete blocks
      while (this.bufferLength === LSH512_MSG_BLK_BYTE_LEN) {
        this._compress(this.buffer);
        this.bufferLength = 0;

        while (offset < data.length && this.bufferLength < LSH512_MSG_BLK_BYTE_LEN) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    Result() {
      // Padding: 0x80 followed by zeros
      this.buffer[this.bufferLength] = 0x80;
      for (let i = this.bufferLength + 1; i < LSH512_MSG_BLK_BYTE_LEN; i++) {
        this.buffer[i] = 0;
      }

      this._compress(this.buffer);

      // Finalization: XOR cv_l with cv_r
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] ^= this.cv_r[i];
      }

      // Extract 384-bit hash (6 x 64-bit words, little-endian)
      const hash = new Uint8Array(48);
      const hashView = new DataView(hash.buffer);

      for (let i = 0; i < 6; i++) {
        hashView.setBigUint64(i * 8, this.cv_l[i], true);
      }

      return Array.from(hash);
    }
  }

  const algorithmInstance = new LSH384Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { LSH384Algorithm, LSH384Instance };
}));
