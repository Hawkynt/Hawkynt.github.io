/*
 * LSH (Lightweight Secure Hash) - Korean Hash Function Family
 * Professional implementation matching Crypto++ reference
 * (c)2006-2025 Hawkynt
 *
 * Implements all 5 LSH variants:
 * - LSH-224 (224-bit output, 32-bit operations)
 * - LSH-256 (256-bit output, 32-bit operations)
 * - LSH-384 (384-bit output, 64-bit operations)
 * - LSH-512 (512-bit output, 64-bit operations)
 * - LSH-512-256 (256-bit output, 64-bit operations)
 *
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

  // ============================================================================
  // LSH-256 FAMILY (32-bit operations)
  // ============================================================================

  // LSH256 Constants
  const LSH256_MSG_BLK_BYTE_LEN = 128;
  const LSH256_NUM_STEPS = 26;
  const LSH256_ROT_EVEN_ALPHA = 29;
  const LSH256_ROT_EVEN_BETA = 1;
  const LSH256_ROT_ODD_ALPHA = 5;
  const LSH256_ROT_ODD_BETA = 17;
  const LSH256_GAMMA = new Uint32Array([0, 8, 16, 24, 24, 16, 8, 0]);

  // LSH-224 Initial Values
  const LSH256_IV224 = new Uint32Array([
    0x068608D3, 0x62D8F7A7, 0xD76652AB, 0x4C600A43,
    0xBDC40AA8, 0x1ECA0B68, 0xDA1A89BE, 0x3147D354,
    0x707EB4F9, 0xF65B3862, 0x6B0B2ABE, 0x56B8EC0A,
    0xCF237286, 0xEE0D1727, 0x33636595, 0x8BB8D05F
  ]);

  // LSH-256 Initial Values
  const LSH256_IV256 = new Uint32Array([
    0x46a10f1f, 0xfddce486, 0xb41443a8, 0x198e6b9d,
    0x3304388d, 0xb0f5a3c7, 0xb36061c4, 0x7adbd553,
    0x105d5378, 0x2f74de54, 0x5c2f2d95, 0xf2553fbe,
    0x8051357a, 0x138668c8, 0x47aa4484, 0xe01afb41
  ]);

  // LSH256 Step Constants (208 constants for 26 steps × 8 words)
  const LSH256_StepConstants = new Uint32Array([
    0x917caf90, 0x6c1b10a2, 0x6f352943, 0xcf778243, 0x2ceb7472, 0x29e96ff2, 0x8a9ba428, 0x2eeb2642,
    0x0e2c4021, 0x872bb30e, 0xa45e6cb2, 0x46f9c612, 0x185fe69e, 0x1359621b, 0x263fccb2, 0x1a116870,
    0x3a6c612f, 0xb2dec195, 0x02cb1f56, 0x40bfd858, 0x784684b6, 0x6cbb7d2e, 0x660c7ed8, 0x2b79d88a,
    0xa6cd9069, 0x91a05747, 0xcdea7558, 0x00983098, 0xbecb3b2e, 0x2838ab9a, 0x728b573e, 0xa55262b5,
    0x745dfa0f, 0x31f79ed8, 0xb85fce25, 0x98c8c898, 0x8a0669ec, 0x60e445c2, 0xfde295b0, 0xf7b5185a,
    0xd2580983, 0x29967709, 0x182df3dd, 0x61916130, 0x90705676, 0x452a0822, 0xe07846ad, 0xaccd7351,
    0x2a618d55, 0xc00d8032, 0x4621d0f5, 0xf2f29191, 0x00c6cd06, 0x6f322a67, 0x58bef48d, 0x7a40c4fd,
    0x8beee27f, 0xcd8db2f2, 0x67f2c63b, 0xe5842383, 0xc793d306, 0xa15c91d6, 0x17b381e5, 0xbb05c277,
    0x7ad1620a, 0x5b40a5bf, 0x5ab901a2, 0x69a7a768, 0x5b66d9cd, 0xfdee6877, 0xcb3566fc, 0xc0c83a32,
    0x4c336c84, 0x9be6651a, 0x13baa3fc, 0x114f0fd1, 0xc240a728, 0xec56e074, 0x009c63c7, 0x89026cf2,
    0x7f9ff0d0, 0x824b7fb5, 0xce5ea00f, 0x605ee0e2, 0x02e7cfea, 0x43375560, 0x9d002ac7, 0x8b6f5f7b,
    0x1f90c14f, 0xcdcb3537, 0x2cfeafdd, 0xbf3fc342, 0xeab7b9ec, 0x7a8cb5a3, 0x9d2af264, 0xfacedb06,
    0xb052106e, 0x99006d04, 0x2bae8d09, 0xff030601, 0xa271a6d6, 0x0742591d, 0xc81d5701, 0xc9a9e200,
    0x02627f1e, 0x996d719d, 0xda3b9634, 0x02090800, 0x14187d78, 0x499b7624, 0xe57458c9, 0x738be2c9,
    0x64e19d20, 0x06df0f36, 0x15d1cb0e, 0x0b110802, 0x2c95f58c, 0xe5119a6d, 0x59cd22ae, 0xff6eac3c,
    0x467ebd84, 0xe5ee453c, 0xe79cd923, 0x1c190a0d, 0xc28b81b8, 0xf6ac0852, 0x26efd107, 0x6e1ae93b,
    0xc53c41ca, 0xd4338221, 0x8475fd0a, 0x35231729, 0x4e0d3a7a, 0xa2b45b48, 0x16c0d82d, 0x890424a9,
    0x017e0c8f, 0x07b5a3f5, 0xfa73078e, 0x583a405e, 0x5b47b4c8, 0x570fa3ea, 0xd7990543, 0x8d28ce32,
    0x7f8a9b90, 0xbd5998fc, 0x6d7a9688, 0x927a9eb6, 0xa2fc7d23, 0x66b38e41, 0x709e491a, 0xb5f700bf,
    0x0a262c0f, 0x16f295b9, 0xe8111ef5, 0x0d195548, 0x9f79a0c5, 0x1a41cfa7, 0x0ee7638a, 0xacf7c074,
    0x30523b19, 0x09884ecf, 0xf93014dd, 0x266e9d55, 0x191a6664, 0x5c1176c1, 0xf64aed98, 0xa4b83520,
    0x828d5449, 0x91d71dd8, 0x2944f2d6, 0x950bf27b, 0x3380ca7d, 0x6d88381d, 0x4138868e, 0x5ced55c4,
    0x0fe19dcb, 0x68f4f669, 0x6e37c8ff, 0xa0fe6e10, 0xb44b47b0, 0xf5c0558a, 0x79bf14cf, 0x4a431a20,
    0xf17f68da, 0x5deb5fd1, 0xa600c86d, 0x9f6c7eb0, 0xff92f864, 0xb615e07f, 0x38d3e448, 0x8d5d3a6a,
    0x70e843cb, 0x494b312e, 0xa6c93613, 0x0beb2f4f, 0x928b5d63, 0xcbf66035, 0x0cb82c80, 0xea97a4f7,
    0x592c0f3b, 0x947c5f77, 0x6fff49b9, 0xf71a7e5a, 0x1de8c0f5, 0xc2569600, 0xc4e4ac8c, 0x823c9ce1
  ]);

  // ============================================================================
  // LSH-512 FAMILY (64-bit operations)
  // ============================================================================

  // LSH512 constants
  const LSH512_MSG_BLK_BYTE_LEN = 256;
  const LSH512_NUM_STEPS = 28;
  const LSH512_ROT_EVEN_ALPHA = 23;
  const LSH512_ROT_EVEN_BETA = 59;
  const LSH512_ROT_ODD_ALPHA = 7;
  const LSH512_ROT_ODD_BETA = 3;
  const LSH512_GAMMA = Object.freeze([0, 16, 32, 48, 8, 24, 40, 56]);

  // LSH-384 Initial Values
  const LSH512_IV384 = Object.freeze([
    0x53156a66292808f6n, 0xb2c4f362b204c2bcn, 0xb84b7213bfa05c4en, 0x976ceb7c1b299f73n,
    0xdf0cc63c0570ae97n, 0xda4441baa486ce3fn, 0x6559f5d9b5f2acc2n, 0x22dacf19b4b52a16n,
    0xbbcdacefde80953an, 0xc9891a2879725b3en, 0x7c9fe6330237e440n, 0xa30ba550553f7431n,
    0xbb08043fb34e3e30n, 0xa0dec48d54618eadn, 0x150317267464bc57n, 0x32d1501fde63dc93n
  ]);

  // LSH-512 Initial Values
  const LSH512_IV512 = Object.freeze([
    0xadd50f3c7f07094en, 0xe3f3cee8f9418a4fn, 0xb527ecde5b3d0ae9n, 0x2ef6dec68076f501n,
    0x8cb994cae5aca216n, 0xfbb9eae4bba48cc7n, 0x650a526174725fean, 0x1f9a61a73f8d8085n,
    0xb6607378173b539bn, 0x1bc99853b0c0b9edn, 0xdf727fc19b182d47n, 0xdbef360cf893a457n,
    0x4981f5e570147e80n, 0xd00c4490ca7d3e30n, 0x5d73940c0e4ae1ecn, 0x894085e2edb2d819n
  ]);

  // LSH-512-256 Initial Values
  const LSH512_IV256 = Object.freeze([
    0x6dc57c33df989423n, 0xd8ea7f6e8342c199n, 0x76df8356f8603ac4n, 0x40f1b44de838223an,
    0x39ffe7cfc31484cdn, 0x39c4326cc5281548n, 0x8a2ff85a346045d8n, 0xff202aa46dbdd61en,
    0xcf785b3cd5fcdb8bn, 0x1f0323b64a8150bfn, 0xff75d972f29ea355n, 0x2e567f30bf1ca9e1n,
    0xb596875bf8ff6dban, 0xfcca39b089ef4615n, 0xecff4017d020b4b6n, 0x7e77384c772ed802n
  ]);

  // LSH512 Step Constants (224 constants for 28 steps × 8 words)
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
    return OpCodes.OrN(OpCodes.ShiftLn(val, n), OpCodes.ShiftRn(val, 64n - n))&MASK64;
  }

  // ============================================================================
  // LSH-256 FAMILY INSTANCE (32-bit operations)
  // ============================================================================

  /**
 * LSH256 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LSH256Instance extends IHashFunctionInstance {
    constructor(algorithm, iv, outputSize) {
      super(algorithm);
      this.iv = iv;
      this.outputSize = outputSize;
      this.cv_l = new Uint32Array(8);
      this.cv_r = new Uint32Array(8);
      this.sub_msgs = new Uint32Array(32);
      this.last_block = new Uint8Array(LSH256_MSG_BLK_BYTE_LEN);
      this.remain_databitlen = 0;
      this._initialize();
    }

    _initialize() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = this.iv[i];
        this.cv_r[i] = this.iv[i + 8];
      }
      this.sub_msgs.fill(0);
      this.remain_databitlen = 0;
    }

    _load_msg_blk(msgblk) {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);

      for (let i = 0; i < 8; i++) {
        submsg_e_l[i] = OpCodes.Pack32LE(msgblk[i*4], msgblk[i*4+1], msgblk[i*4+2], msgblk[i*4+3]);
        submsg_e_r[i] = OpCodes.Pack32LE(msgblk[32+i*4], msgblk[32+i*4+1], msgblk[32+i*4+2], msgblk[32+i*4+3]);
        submsg_o_l[i] = OpCodes.Pack32LE(msgblk[64+i*4], msgblk[64+i*4+1], msgblk[64+i*4+2], msgblk[64+i*4+3]);
        submsg_o_r[i] = OpCodes.Pack32LE(msgblk[96+i*4], msgblk[96+i*4+1], msgblk[96+i*4+2], msgblk[96+i*4+3]);
      }
    }

    _msg_exp_even() {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);

      let temp;
      temp = submsg_e_l[0];
      submsg_e_l[0] = OpCodes.ToUint32(submsg_o_l[0] + submsg_e_l[3]);
      submsg_e_l[3] = OpCodes.ToUint32(submsg_o_l[3] + submsg_e_l[1]);
      submsg_e_l[1] = OpCodes.ToUint32(submsg_o_l[1] + submsg_e_l[2]);
      submsg_e_l[2] = OpCodes.ToUint32(submsg_o_l[2] + temp);
      temp = submsg_e_l[4];
      submsg_e_l[4] = OpCodes.ToUint32(submsg_o_l[4] + submsg_e_l[7]);
      submsg_e_l[7] = OpCodes.ToUint32(submsg_o_l[7] + submsg_e_l[6]);
      submsg_e_l[6] = OpCodes.ToUint32(submsg_o_l[6] + submsg_e_l[5]);
      submsg_e_l[5] = OpCodes.ToUint32(submsg_o_l[5] + temp);
      temp = submsg_e_r[0];
      submsg_e_r[0] = OpCodes.ToUint32(submsg_o_r[0] + submsg_e_r[3]);
      submsg_e_r[3] = OpCodes.ToUint32(submsg_o_r[3] + submsg_e_r[1]);
      submsg_e_r[1] = OpCodes.ToUint32(submsg_o_r[1] + submsg_e_r[2]);
      submsg_e_r[2] = OpCodes.ToUint32(submsg_o_r[2] + temp);
      temp = submsg_e_r[4];
      submsg_e_r[4] = OpCodes.ToUint32(submsg_o_r[4] + submsg_e_r[7]);
      submsg_e_r[7] = OpCodes.ToUint32(submsg_o_r[7] + submsg_e_r[6]);
      submsg_e_r[6] = OpCodes.ToUint32(submsg_o_r[6] + submsg_e_r[5]);
      submsg_e_r[5] = OpCodes.ToUint32(submsg_o_r[5] + temp);
    }

    _msg_exp_odd() {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);

      let temp;
      temp = submsg_o_l[0];
      submsg_o_l[0] = OpCodes.ToUint32(submsg_e_l[0] + submsg_o_l[3]);
      submsg_o_l[3] = OpCodes.ToUint32(submsg_e_l[3] + submsg_o_l[1]);
      submsg_o_l[1] = OpCodes.ToUint32(submsg_e_l[1] + submsg_o_l[2]);
      submsg_o_l[2] = OpCodes.ToUint32(submsg_e_l[2] + temp);
      temp = submsg_o_l[4];
      submsg_o_l[4] = OpCodes.ToUint32(submsg_e_l[4] + submsg_o_l[7]);
      submsg_o_l[7] = OpCodes.ToUint32(submsg_e_l[7] + submsg_o_l[6]);
      submsg_o_l[6] = OpCodes.ToUint32(submsg_e_l[6] + submsg_o_l[5]);
      submsg_o_l[5] = OpCodes.ToUint32(submsg_e_l[5] + temp);
      temp = submsg_o_r[0];
      submsg_o_r[0] = OpCodes.ToUint32(submsg_e_r[0] + submsg_o_r[3]);
      submsg_o_r[3] = OpCodes.ToUint32(submsg_e_r[3] + submsg_o_r[1]);
      submsg_o_r[1] = OpCodes.ToUint32(submsg_e_r[1] + submsg_o_r[2]);
      submsg_o_r[2] = OpCodes.ToUint32(submsg_e_r[2] + temp);
      temp = submsg_o_r[4];
      submsg_o_r[4] = OpCodes.ToUint32(submsg_e_r[4] + submsg_o_r[7]);
      submsg_o_r[7] = OpCodes.ToUint32(submsg_e_r[7] + submsg_o_r[6]);
      submsg_o_r[6] = OpCodes.ToUint32(submsg_e_r[6] + submsg_o_r[5]);
      submsg_o_r[5] = OpCodes.ToUint32(submsg_e_r[5] + temp);
    }

    _msg_add_even() {
      const submsg_e_l = new Uint32Array(this.sub_msgs.buffer, 0, 8);
      const submsg_e_r = new Uint32Array(this.sub_msgs.buffer, 32, 8);
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.Xor32(this.cv_l[i], submsg_e_l[i]);
        this.cv_r[i] = OpCodes.Xor32(this.cv_r[i], submsg_e_r[i]);
      }
    }

    _msg_add_odd() {
      const submsg_o_l = new Uint32Array(this.sub_msgs.buffer, 64, 8);
      const submsg_o_r = new Uint32Array(this.sub_msgs.buffer, 96, 8);
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.Xor32(this.cv_l[i], submsg_o_l[i]);
        this.cv_r[i] = OpCodes.Xor32(this.cv_r[i], submsg_o_r[i]);
      }
    }

    _add_blk() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.ToUint32(this.cv_l[i] + this.cv_r[i]);
      }
    }

    _rotate_blk(r) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.RotL32(this.cv_l[i], r);
      }
    }

    _xor_with_const(const_v) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.Xor32(this.cv_l[i], const_v[i]);
      }
    }

    _rotate_msg_gamma() {
      for (let i = 1; i < 7; i++) {
        this.cv_r[i] = OpCodes.RotL32(this.cv_r[i], LSH256_GAMMA[i]);
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

    _mix(alpha, beta, const_v) {
      this._add_blk();
      this._rotate_blk(alpha);
      this._xor_with_const(const_v);
      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = OpCodes.ToUint32(this.cv_r[i] + this.cv_l[i]);
      }
      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = OpCodes.RotL32(this.cv_r[i], beta);
      }
      this._add_blk();
      this._rotate_msg_gamma();
    }

    _compress(msgblk) {
      this._load_msg_blk(msgblk);

      this._msg_add_even();
      const const_v0 = LSH256_StepConstants.subarray(0, 8);
      this._mix(LSH256_ROT_EVEN_ALPHA, LSH256_ROT_EVEN_BETA, const_v0);
      this._word_perm();

      this._msg_add_odd();
      const const_v1 = LSH256_StepConstants.subarray(8, 16);
      this._mix(LSH256_ROT_ODD_ALPHA, LSH256_ROT_ODD_BETA, const_v1);
      this._word_perm();

      for (let i = 1; i < LSH256_NUM_STEPS / 2; i++) {
        this._msg_exp_even();
        this._msg_add_even();
        const const_ve = LSH256_StepConstants.subarray(16 * i, 16 * i + 8);
        this._mix(LSH256_ROT_EVEN_ALPHA, LSH256_ROT_EVEN_BETA, const_ve);
        this._word_perm();

        this._msg_exp_odd();
        this._msg_add_odd();
        const const_vo = LSH256_StepConstants.subarray(16 * i + 8, 16 * i + 16);
        this._mix(LSH256_ROT_ODD_ALPHA, LSH256_ROT_ODD_BETA, const_vo);
        this._word_perm();
      }

      this._msg_exp_even();
      this._msg_add_even();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      let databytelen = data.length;
      let dataOffset = 0;
      let remain_msg_byte = OpCodes.Shr32(this.remain_databitlen, 3);

      if (databytelen + remain_msg_byte < LSH256_MSG_BLK_BYTE_LEN) {
        for (let i = 0; i < databytelen; i++) {
          this.last_block[remain_msg_byte + i] = data[dataOffset + i];
        }
        this.remain_databitlen += databytelen * 8;
        return;
      }

      if (remain_msg_byte > 0) {
        const more_byte = LSH256_MSG_BLK_BYTE_LEN - remain_msg_byte;
        for (let i = 0; i < more_byte; i++) {
          this.last_block[remain_msg_byte + i] = data[dataOffset + i];
        }
        this._compress(this.last_block);
        dataOffset += more_byte;
        databytelen -= more_byte;
        remain_msg_byte = 0;
        this.remain_databitlen = 0;
      }

      while (databytelen >= LSH256_MSG_BLK_BYTE_LEN) {
        const block = data.slice(dataOffset, dataOffset + LSH256_MSG_BLK_BYTE_LEN);
        this._compress(block);
        dataOffset += LSH256_MSG_BLK_BYTE_LEN;
        databytelen -= LSH256_MSG_BLK_BYTE_LEN;
      }

      if (databytelen > 0) {
        for (let i = 0; i < databytelen; i++) {
          this.last_block[i] = data[dataOffset + i];
        }
        this.remain_databitlen = databytelen * 8;
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      const remain_msg_byte = OpCodes.Shr32(this.remain_databitlen, 3);

      this.last_block[remain_msg_byte] = 0x80;
      for (let i = remain_msg_byte + 1; i < LSH256_MSG_BLK_BYTE_LEN; i++) {
        this.last_block[i] = 0;
      }

      this._compress(this.last_block);

      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.Xor32(this.cv_l[i], this.cv_r[i]);
      }

      const hash = new Uint8Array(this.outputSize);
      const hashView = new DataView(hash.buffer);
      for (let i = 0; i < this.outputSize / 4; i++) {
        hashView.setUint32(i * 4, this.cv_l[i], true);
      }

      return Array.from(hash);
    }
  }

  // ============================================================================
  // LSH-512 FAMILY INSTANCE (64-bit operations)
  // ============================================================================

  /**
 * LSH512 cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class LSH512Instance extends IHashFunctionInstance {
    constructor(algorithm, iv, outputSize) {
      super(algorithm);
      this.iv = iv;
      this.outputSize = outputSize;
      this.cv_l = new Array(8);
      this.cv_r = new Array(8);
      this.submsg_e_l = new Array(8);
      this.submsg_e_r = new Array(8);
      this.submsg_o_l = new Array(8);
      this.submsg_o_r = new Array(8);
      this.buffer = new Uint8Array(LSH512_MSG_BLK_BYTE_LEN);
      this.bufferLength = 0;
      this._init();
    }

    _init() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = this.iv[i];
        this.cv_r[i] = this.iv[i + 8];
      }

      for (let i = 0; i < 8; i++) {
        this.submsg_e_l[i] = 0n;
        this.submsg_e_r[i] = 0n;
        this.submsg_o_l[i] = 0n;
        this.submsg_o_r[i] = 0n;
      }

      this.bufferLength = 0;
    }

    _load_msg_blk(msgblk) {
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
      this.submsg_e_l[0] = OpCodes.AndN(this.submsg_o_l[0] + this.submsg_e_l[3], MASK64);
      this.submsg_e_l[3] = OpCodes.AndN(this.submsg_o_l[3] + this.submsg_e_l[1], MASK64);
      this.submsg_e_l[1] = OpCodes.AndN(this.submsg_o_l[1] + this.submsg_e_l[2], MASK64);
      this.submsg_e_l[2] = OpCodes.AndN(this.submsg_o_l[2] + temp, MASK64);

      temp = this.submsg_e_l[4];
      this.submsg_e_l[4] = OpCodes.AndN(this.submsg_o_l[4] + this.submsg_e_l[7], MASK64);
      this.submsg_e_l[7] = OpCodes.AndN(this.submsg_o_l[7] + this.submsg_e_l[6], MASK64);
      this.submsg_e_l[6] = OpCodes.AndN(this.submsg_o_l[6] + this.submsg_e_l[5], MASK64);
      this.submsg_e_l[5] = OpCodes.AndN(this.submsg_o_l[5] + temp, MASK64);

      temp = this.submsg_e_r[0];
      this.submsg_e_r[0] = OpCodes.AndN(this.submsg_o_r[0] + this.submsg_e_r[3], MASK64);
      this.submsg_e_r[3] = OpCodes.AndN(this.submsg_o_r[3] + this.submsg_e_r[1], MASK64);
      this.submsg_e_r[1] = OpCodes.AndN(this.submsg_o_r[1] + this.submsg_e_r[2], MASK64);
      this.submsg_e_r[2] = OpCodes.AndN(this.submsg_o_r[2] + temp, MASK64);

      temp = this.submsg_e_r[4];
      this.submsg_e_r[4] = OpCodes.AndN(this.submsg_o_r[4] + this.submsg_e_r[7], MASK64);
      this.submsg_e_r[7] = OpCodes.AndN(this.submsg_o_r[7] + this.submsg_e_r[6], MASK64);
      this.submsg_e_r[6] = OpCodes.AndN(this.submsg_o_r[6] + this.submsg_e_r[5], MASK64);
      this.submsg_e_r[5] = OpCodes.AndN(this.submsg_o_r[5] + temp, MASK64);
    }

    _msg_exp_odd() {
      let temp;

      temp = this.submsg_o_l[0];
      this.submsg_o_l[0] = OpCodes.AndN(this.submsg_e_l[0] + this.submsg_o_l[3], MASK64);
      this.submsg_o_l[3] = OpCodes.AndN(this.submsg_e_l[3] + this.submsg_o_l[1], MASK64);
      this.submsg_o_l[1] = OpCodes.AndN(this.submsg_e_l[1] + this.submsg_o_l[2], MASK64);
      this.submsg_o_l[2] = OpCodes.AndN(this.submsg_e_l[2] + temp, MASK64);

      temp = this.submsg_o_l[4];
      this.submsg_o_l[4] = OpCodes.AndN(this.submsg_e_l[4] + this.submsg_o_l[7], MASK64);
      this.submsg_o_l[7] = OpCodes.AndN(this.submsg_e_l[7] + this.submsg_o_l[6], MASK64);
      this.submsg_o_l[6] = OpCodes.AndN(this.submsg_e_l[6] + this.submsg_o_l[5], MASK64);
      this.submsg_o_l[5] = OpCodes.AndN(this.submsg_e_l[5] + temp, MASK64);

      temp = this.submsg_o_r[0];
      this.submsg_o_r[0] = OpCodes.AndN(this.submsg_e_r[0] + this.submsg_o_r[3], MASK64);
      this.submsg_o_r[3] = OpCodes.AndN(this.submsg_e_r[3] + this.submsg_o_r[1], MASK64);
      this.submsg_o_r[1] = OpCodes.AndN(this.submsg_e_r[1] + this.submsg_o_r[2], MASK64);
      this.submsg_o_r[2] = OpCodes.AndN(this.submsg_e_r[2] + temp, MASK64);

      temp = this.submsg_o_r[4];
      this.submsg_o_r[4] = OpCodes.AndN(this.submsg_e_r[4] + this.submsg_o_r[7], MASK64);
      this.submsg_o_r[7] = OpCodes.AndN(this.submsg_e_r[7] + this.submsg_o_r[6], MASK64);
      this.submsg_o_r[6] = OpCodes.AndN(this.submsg_e_r[6] + this.submsg_o_r[5], MASK64);
      this.submsg_o_r[5] = OpCodes.AndN(this.submsg_e_r[5] + temp, MASK64);
    }

    _msg_add_even() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.XorN(this.cv_l[i], this.submsg_e_l[i]);
        this.cv_r[i] = OpCodes.XorN(this.cv_r[i], this.submsg_e_r[i]);
      }
    }

    _msg_add_odd() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.XorN(this.cv_l[i], this.submsg_o_l[i]);
        this.cv_r[i] = OpCodes.XorN(this.cv_r[i], this.submsg_o_r[i]);
      }
    }

    _add_blk() {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.AndN(this.cv_l[i] + this.cv_r[i], MASK64);
      }
    }

    _rotate_blk(alpha) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = rotl64(this.cv_l[i], alpha);
      }
    }

    _xor_with_const(offset) {
      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.XorN(this.cv_l[i], LSH512_StepConstants[offset + i]);
      }
    }

    _rotate_msg_gamma() {
      for (let i = 1; i < 8; i++) {
        this.cv_r[i] = rotl64(this.cv_r[i], LSH512_GAMMA[i]);
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
      this._xor_with_const(const_v_offset);

      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = OpCodes.AndN(this.cv_r[i] + this.cv_l[i], MASK64);
      }

      for (let i = 0; i < 8; i++) {
        this.cv_r[i] = rotl64(this.cv_r[i], beta);
      }

      this._add_blk();
      this._rotate_msg_gamma();
    }

    _compress(msgblk) {
      this._load_msg_blk(msgblk);

      this._msg_add_even();
      this._mix(LSH512_ROT_EVEN_ALPHA, LSH512_ROT_EVEN_BETA, 0);
      this._word_perm();

      this._msg_add_odd();
      this._mix(LSH512_ROT_ODD_ALPHA, LSH512_ROT_ODD_BETA, 8);
      this._word_perm();

      for (let i = 1; i < LSH512_NUM_STEPS / 2; i++) {
        this._msg_exp_even();
        this._msg_add_even();
        this._mix(LSH512_ROT_EVEN_ALPHA, LSH512_ROT_EVEN_BETA, 16 * i);
        this._word_perm();

        this._msg_exp_odd();
        this._msg_add_odd();
        this._mix(LSH512_ROT_ODD_ALPHA, LSH512_ROT_ODD_BETA, 16 * i + 8);
        this._word_perm();
      }

      this._msg_exp_even();
      this._msg_add_even();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      let offset = 0;

      while (offset < data.length && this.bufferLength < LSH512_MSG_BLK_BYTE_LEN) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      while (this.bufferLength === LSH512_MSG_BLK_BYTE_LEN) {
        this._compress(this.buffer);
        this.bufferLength = 0;

        while (offset < data.length && this.bufferLength < LSH512_MSG_BLK_BYTE_LEN) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      this.buffer[this.bufferLength] = 0x80;
      for (let i = this.bufferLength + 1; i < LSH512_MSG_BLK_BYTE_LEN; i++) {
        this.buffer[i] = 0;
      }

      this._compress(this.buffer);

      for (let i = 0; i < 8; i++) {
        this.cv_l[i] = OpCodes.XorN(this.cv_l[i], this.cv_r[i]);
      }

      const hash = new Uint8Array(this.outputSize);
      const hashView = new DataView(hash.buffer);

      for (let i = 0; i < this.outputSize / 8; i++) {
        hashView.setBigUint64(i * 8, this.cv_l[i], true);
      }

      return Array.from(hash);
    }
  }

  // ============================================================================
  // ALGORITHM CLASSES
  // ============================================================================

  /**
 * LSH224Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class LSH224Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-224";
      this.description = "Korean Lightweight Secure Hash producing 224-bit digests. Developed by Korea Internet&Security Agency (KISA) as part of Korean cryptographic standards.";
      this.inventor = "Korea Internet&Security Agency (KISA)";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Korean Hash";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedHashSizes = [new KeySize(28, 28, 1)];
      this.BlockSize = 128;

      this.documentation = [
        new LinkItem("LSH Specification", "https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do"),
        new LinkItem("KISA Standards", "https://seed.kisa.or.kr/")
      ];

      this.references = [
        new LinkItem("Crypto++ LSH", "https://github.com/weidai11/cryptopp/blob/master/lsh256.cpp"),
        new LinkItem("LSH Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt")
      ];

      this.tests = [
        {
          text: "LSH-224: Empty (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("48a0d55b2b3d91f26e06f7110fe9ce8ea0e2656bbe344cb1c5930653")
        },
        {
          text: "LSH-224: Single byte (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("ca"),
          expected: OpCodes.Hex8ToBytes("4253e6e91b3c37f75c231d53ca6dc8464885250d2058c41d495bd08f")
        },
        {
          text: "LSH-224: Two bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("40ea"),
          expected: OpCodes.Hex8ToBytes("11302cc1282f57a8b107cbf1e495e0e81cae7561803c039d60e48720")
        },
        {
          text: "LSH-224: Four bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("8f62d29f"),
          expected: OpCodes.Hex8ToBytes("81959fa33ebfab68af7522d0aa87b51d7c15894a538dd6b9e78666ef")
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
      return new LSH256Instance(this, LSH256_IV224, 28);
    }
  }

  /**
 * LSH256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class LSH256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-256";
      this.description = "Korean Lightweight Secure Hash producing 256-bit digests. Developed by Korea Internet&Security Agency (KISA) as part of Korean cryptographic standards.";
      this.inventor = "Korea Internet&Security Agency (KISA)";
      this.year = 2014;
      this.category = CategoryType.HASH;
      this.subCategory = "Korean Hash";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedHashSizes = [new KeySize(32, 32, 1)];
      this.BlockSize = 128;

      this.documentation = [
        new LinkItem("LSH Specification", "https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do"),
        new LinkItem("KISA Standards", "https://seed.kisa.or.kr/")
      ];

      this.references = [
        new LinkItem("Crypto++ LSH", "https://github.com/weidai11/cryptopp/blob/master/lsh256.cpp"),
        new LinkItem("LSH Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt")
      ];

      this.tests = [
        {
          text: "LSH-256: Empty (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("f3cd416a03818217726cb47f4e4d2881c9c29fd445c18b66fb19dea1a81007c1")
        },
        {
          text: "LSH-256: Single byte (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("ce"),
          expected: OpCodes.Hex8ToBytes("862f86db654094840d86df7881732fd69b7227ee4f7943868162feb733a9ca5b")
        },
        {
          text: "LSH-256: Two bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("8b6c"),
          expected: OpCodes.Hex8ToBytes("da96b21314cfd129fdbaa620dc3d0e2b5b3e087e90e6c147cc6b9950fde4b40e")
        },
        {
          text: "LSH-256: Four bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh256.txt",
          input: OpCodes.Hex8ToBytes("a546a625"),
          expected: OpCodes.Hex8ToBytes("48da0960d72bab0f52f7f33f063f6b4fb9b6c73e15d08f865bb62e22fb7eaa8a")
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
      return new LSH256Instance(this, LSH256_IV256, 32);
    }
  }

  /**
 * LSH384Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class LSH384Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-384";
      this.description = "Korean cryptographic hash function standard producing 384-bit digests. Uses 512-bit internal processing with 28-step compression and 64-bit operations.";
      this.inventor = "Korea Internet&Security Agency (KISA)";
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

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new LSH512Instance(this, LSH512_IV384, 48);
    }
  }

  /**
 * LSH512Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class LSH512Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-512";
      this.description = "Korean cryptographic hash function standard producing 512-bit digests. Designed by KISA with 28-step compression function and 64-bit operations.";
      this.inventor = "Korea Internet&Security Agency (KISA)";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "LSH Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedHashSizes = [new KeySize(64, 64, 1)];
      this.BlockSize = 256;

      this.documentation = [
        new LinkItem("KISA LSH Page", "https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do"),
        new LinkItem("LSH Specification", "https://seed.kisa.or.kr/kisa/Board/22/detailView.do")
      ];

      this.references = [
        new LinkItem("Crypto++ LSH-512", "https://github.com/weidai11/cryptopp/blob/master/lsh512.cpp"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt")
      ];

      this.tests = [
        {
          text: "LSH-512: Empty (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("118a2ff2a99e3b2134125e2baf20ebe3bdd034d5a69b29c22fc4995063340b46697801d7f7fb0070568f78e8ed514215fc70af27d6f27b01aa8a1da72b14ce7c")
        },
        {
          text: "LSH-512: Single byte (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: OpCodes.Hex8ToBytes("41"),
          expected: OpCodes.Hex8ToBytes("32e896b21bec19c15254f7a1f089f748e05918a68e6d829fb1a62b7d5822ad98b7de274f7dc6c73e6f52c5f0b7633666dbe6048661351d811105ee015b9dcac9")
        },
        {
          text: "LSH-512: Two bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: OpCodes.Hex8ToBytes("3c57"),
          expected: OpCodes.Hex8ToBytes("e86ac1ef43519446927c26d907fa5a3a64b3f4b1888ef10ffc6b687ec73ac5bfd9db4ad7427011d35243adc98d2c2b1b58a28bd22179668b43a2816d07c65963")
        },
        {
          text: "LSH-512: Three bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512.txt",
          input: OpCodes.Hex8ToBytes("abfcde"),
          expected: OpCodes.Hex8ToBytes("732442e8c76252c6d6fc950ccd7fd6d5a8a8114be245a3076c3f6732b80294478b136bc52fe8db4e01766711a71aa69179361804c2791c77ec2383c1be480501")
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
      return new LSH512Instance(this, LSH512_IV512, 64);
    }
  }

  /**
 * LSH512_256Algorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class LSH512_256Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = "LSH-512-256";
      this.description = "Korean cryptographic hash function standard producing 256-bit digests. Uses 512-bit internal processing with 28-step compression and 64-bit operations.";
      this.inventor = "Korea Internet&Security Agency (KISA)";
      this.year = 2015;
      this.category = CategoryType.HASH;
      this.subCategory = "LSH Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedHashSizes = [new KeySize(32, 32, 1)];
      this.BlockSize = 256;

      this.documentation = [
        new LinkItem("KISA LSH Page", "https://seed.kisa.or.kr/kisa/algorithm/EgovLSHInfo.do"),
        new LinkItem("LSH Specification", "https://seed.kisa.or.kr/kisa/Board/22/detailView.do")
      ];

      this.references = [
        new LinkItem("Crypto++ LSH-512 Family", "https://github.com/weidai11/cryptopp/blob/master/lsh512.cpp"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512_256.txt")
      ];

      this.tests = [
        {
          text: "LSH-512-256: Empty (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512_256.txt",
          input: [],
          expected: OpCodes.Hex8ToBytes("706df4ebf100f06d5cc9f6c79be5297c3f6f515801dd10fbc1b665a2d7bdb653")
        },
        {
          text: "LSH-512-256: Single byte (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512_256.txt",
          input: OpCodes.Hex8ToBytes("1a"),
          expected: OpCodes.Hex8ToBytes("4153823632396658 72545914 061d19df 20e803c7 446ed603 df0b1614 2fbcc731".replace(/ /g, ''))
        },
        {
          text: "LSH-512-256: Two bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512_256.txt",
          input: OpCodes.Hex8ToBytes("efca"),
          expected: OpCodes.Hex8ToBytes("2bf860b81103b1b85e117dfe1d436170f4b4dd32d5471cfc6a210ba305901e8e")
        },
        {
          text: "LSH-512-256: Three bytes (Crypto++)",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/lsh512_256.txt",
          input: OpCodes.Hex8ToBytes("082f78"),
          expected: OpCodes.Hex8ToBytes("4112d19e66e222f3ed565f6823583120424287b1d09276f69b61d4ebfbb72f91")
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
      return new LSH512Instance(this, LSH512_IV256, 32);
    }
  }

  // Register all algorithms
  const algorithms = [
    new LSH224Algorithm(),
    new LSH256Algorithm(),
    new LSH384Algorithm(),
    new LSH512Algorithm(),
    new LSH512_256Algorithm()
  ];

  algorithms.forEach(algo => {
    if (!AlgorithmFramework.Find(algo.name)) {
      RegisterAlgorithm(algo);
    }
  });

  return {
    LSH224Algorithm,
    LSH256Algorithm,
    LSH384Algorithm,
    LSH512Algorithm,
    LSH512_256Algorithm
  };
}));
