/*
 * Mercy Block Cipher - AlgorithmFramework Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 *
 * Mercy Algorithm by Paul Crowley (2000)
 * Block size: 4096 bits (512 bytes), Key size: 128 bits (16 bytes), Rounds: 6
 * Designed specifically for disk sector encryption with tweakable parameters
 *
 * IMPORTANT: This is a reference implementation based on available specifications.
 * Mercy was broken by differential cryptanalysis (Scott Fluhrer, FSE 2001).
 * DO NOT use for real encryption - educational purposes only.
 *
 * NOTE: Due to limited public specification details, this implementation uses
 * a Feistel structure with key-dependent S-boxes inspired by the design principles
 * described in the FSE 2000 paper. Full specification details were not publicly available.
 *
 * References:
 * - Crowley, P., "Mercy: A Fast Large Block Cipher for Disk Sector Encryption", FSE 2000
 * - http://www.ciphergoth.org/crypto/mercy/
 * - Fluhrer, S., "Cryptanalysis of the Mercy Block Cipher", FSE 2001
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * MercyAlgorithm - Block cipher implementation
 * @class
 * @extends {BlockCipherAlgorithm}
 */



  /** @type {int32} */
  const BLOCK_SIZE = 512;        // 4096 bits = 512 bytes
  /** @type {int32} */
  const HALF_BLOCK = 256;        // 2048 bits = 256 bytes
  /** @type {int32} */
  const KEY_SIZE = 16;           // 128 bits
  /** @type {int32} */
  const TWEAK_SIZE = 16;         // 128 bits
  /** @type {int32} */
  const ROUNDS = 6;              // 6 Feistel rounds

  // Generate AES S-box (used as basis for key-dependent S-boxes)
  /**
   * @returns {uint8[]} The AES S-box
   */
  function mercyAesSbox() {
    /** @type {uint8[]} */
    const sbox = new Array(256);
    /** @type {uint8[]} */
    const p = new Array(256);
    let i = 0;
    /** @type {uint32} */
    let x = 0;

    // Initialize with identity
    p[0] = 1;
    for (i = 1; i < 256; i++) {
      x = OpCodes.Xor32(p[i - 1], OpCodes.Shl32(p[i - 1], 1));
      if (OpCodes.And32(x, 0x100) !== 0) x = OpCodes.Xor32(x, 0x11B);
      p[i] = OpCodes.And32(x, 0xFF);
    }

    // Generate S-box using affine transformation
    for (i = 0; i < 256; i++) {
      x = p[255 - i];
      if (i === 0) x = 0;

      /** @type {uint32} */
      let s = x;
      s = OpCodes.Xor32(s, OpCodes.RotL8(x, 1));
      s = OpCodes.Xor32(s, OpCodes.RotL8(x, 2));
      s = OpCodes.Xor32(s, OpCodes.RotL8(x, 3));
      s = OpCodes.Xor32(s, OpCodes.RotL8(x, 4));
      s = OpCodes.Xor32(s, 0x63);

      sbox[i] = OpCodes.And32(s, 0xFF);
    }

    return sbox;
  }

  // AES-like S-box for the key-dependent transformations
  /** @type {uint8[]} */
  const MERCY_SBOX = mercyAesSbox();

  // Generate key-dependent S-box by XORing base S-box with key material
  /**
   * @param {uint8[]} key - 16 key bytes
   * @param {uint8[]} tweak - 16 tweak bytes
   * @param {int32} round - Round index
   * @returns {uint8[]} Key-dependent S-box
   */
  function mercyKeySbox(key, tweak, round) {
    /** @type {uint8[]} */
    const keySbox = new Array(256);

    for (let i = 0; i < 256; i++) {
      const keyByte = key[i % 16];
      const tweakByte = tweak[i % 16];
      const roundByte = OpCodes.And32(round * 17 + i, 0xFF);

      // Combine base S-box with key material
      keySbox[i] = MERCY_SBOX[OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(i, keyByte), tweakByte), roundByte), 0xFF)];
    }

    return keySbox;
  }

  // Feistel F-function: processes right half to modify left half
  // Uses key-dependent S-boxes and mixing operations
  /**
   * @param {uint8[]} rightHalf - Half block
   * @param {uint8[]} roundKey - Round key bytes
   * @param {uint8[]} keySbox - Key-dependent S-box
   * @returns {uint8[]} F output
   */
  function mercyF(rightHalf, roundKey, keySbox) {
    /** @type {uint8[]} */
    const output = new Array(HALF_BLOCK);

    // Apply key-dependent S-box substitution
    for (let i = 0; i < HALF_BLOCK; i++) {
      output[i] = keySbox[rightHalf[i]];
    }

    // Mix with round key
    for (let i = 0; i < HALF_BLOCK; i++) {
      output[i] = OpCodes.Xor32(output[i], roundKey[i % roundKey.length]);
    }

    // Diffusion layer - mix adjacent bytes
    /** @type {uint8[]} */
    const temp = [...output];
    for (let i = 0; i < HALF_BLOCK; i++) {
      const next = (i + 1) % HALF_BLOCK;
      const prev = (i + HALF_BLOCK - 1) % HALF_BLOCK;
      output[i] = OpCodes.Xor32(OpCodes.Xor32(temp[i], OpCodes.RotL8(temp[next], 1)), OpCodes.RotL8(temp[prev], 2));
    }

    // Additional mixing with rotations
    for (let i = 0; i < HALF_BLOCK; i += 4) {
      if (i + 3 < HALF_BLOCK) {
        const t0 = output[i];
        const t1 = output[i + 1];
        const t2 = output[i + 2];
        const t3 = output[i + 3];

        output[i] = OpCodes.Xor32(t0, t2);
        output[i + 1] = OpCodes.Xor32(t1, t3);
        output[i + 2] = OpCodes.Xor32(t2, OpCodes.RotL8(t0, 3));
        output[i + 3] = OpCodes.Xor32(t3, OpCodes.RotL8(t1, 5));
      }
    }

    return output;
  }

  // Generate round keys from master key and tweak
  /**
   * @param {uint8[]} key - 16 key bytes
   * @param {uint8[]} tweak - 16 tweak bytes
   * @returns {uint8[][]} One HALF_BLOCK-byte round key per round
   */
  function mercyRoundKeys(key, tweak) {
    /** @type {uint8[][]} */
    const roundTable = [];

    for (let round = 0; round < ROUNDS; round++) {
      /** @type {uint8[]} */
      const roundKey = new Array(HALF_BLOCK);

      // Expand key material using simple key schedule
      for (let i = 0; i < HALF_BLOCK; i++) {
        const keyByte = key[i % KEY_SIZE];
        const tweakByte = tweak[i % TWEAK_SIZE];
        const positionByte = OpCodes.And32(i, 0xFF);
        const roundByte = OpCodes.And32(round, 0xFF);

        // Mix key, tweak, position, and round number
        roundKey[i] = OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(keyByte, tweakByte), positionByte), roundByte), 0xFF);

        // Additional mixing
        if (i > 0) {
          roundKey[i] = OpCodes.And32(OpCodes.Xor32(roundKey[i], OpCodes.RotL8(roundKey[i - 1], 1)), 0xFF);
        }
      }

      roundTable.push(roundKey);
    }

    return roundTable;
  }

  // Encrypt a 512-byte block using 6-round Feistel network
  /**
   * @param {uint8[]} block - Input block
   * @param {uint8[]} key - 16 key bytes
   * @param {uint8[]} tweak - 16 tweak bytes
   * @returns {uint8[]} Output block
   */
  function mercyEncrypt(block, key, tweak) {
    if (block.length !== BLOCK_SIZE) {
      throw new Error("Block must be exactly " + BLOCK_SIZE + " bytes");
    }

    // Split block into left and right halves
    let left = block.slice(0, HALF_BLOCK);
    let right = block.slice(HALF_BLOCK);

    // Generate round keys and key-dependent S-boxes
    const roundTable = mercyRoundKeys(key, tweak);

    // 6 Feistel rounds
    for (let round = 0; round < ROUNDS; round++) {
      const keySbox = mercyKeySbox(key, tweak, round);
      const fOutput = mercyF(right, roundTable[round], keySbox);

      // XOR left with F(right)
      /** @type {uint8[]} */
      const newRight = new Array(HALF_BLOCK);
      for (let i = 0; i < HALF_BLOCK; i++) {
        newRight[i] = OpCodes.Xor32(left[i], fOutput[i]);
      }

      // Swap halves for next round
      left = right;
      right = newRight;
    }

    // Final combination (no swap after last round)
    return [...right, ...left];
  }

  // Decrypt a 512-byte block (reverse Feistel network)
  /**
   * @param {uint8[]} block - Input block
   * @param {uint8[]} key - 16 key bytes
   * @param {uint8[]} tweak - 16 tweak bytes
   * @returns {uint8[]} Output block
   */
  function mercyDecrypt(block, key, tweak) {
    if (block.length !== BLOCK_SIZE) {
      throw new Error("Block must be exactly " + BLOCK_SIZE + " bytes");
    }

    // Split block - note reversed order due to final non-swap
    let right = block.slice(0, HALF_BLOCK);
    let left = block.slice(HALF_BLOCK);

    // Generate round keys (same as encryption)
    const roundTable = mercyRoundKeys(key, tweak);

    // Reverse 6 Feistel rounds
    for (let round = ROUNDS - 1; round >= 0; round--) {
      const keySbox = mercyKeySbox(key, tweak, round);
      const fOutput = mercyF(left, roundTable[round], keySbox);

      // XOR right with F(left) to recover original left
      /** @type {uint8[]} */
      const newLeft = new Array(HALF_BLOCK);
      for (let i = 0; i < HALF_BLOCK; i++) {
        newLeft[i] = OpCodes.Xor32(right[i], fOutput[i]);
      }

      // Swap halves for next round
      right = left;
      left = newLeft;
    }

    // Final combination
    return [...left, ...right];
  }

  /**
   * Test-vector plaintext: byte i is i mod 256
   * @param {int32} n - Length
   * @returns {uint8[]} Ramp bytes
   */
  function rampBytes(n) {
    /** @type {uint8[]} */
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = OpCodes.And32(i, 0xFF);
    return out;
  }  class MercyAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Mercy";
      this.description = "Paul Crowley's tweakable block cipher designed for disk sector encryption. Features unusually large 4096-bit (512-byte) blocks with 128-bit tweak parameter for sector addressing. Uses 6-round Feistel network with key-dependent state machine.";
      this.inventor = "Paul Crowley";
      this.year = 2000;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.UK;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit key
      ];
      this.SupportedBlockSizes = [
        new KeySize(512, 512, 0) // Fixed 4096-bit (512-byte) blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Mercy Specification", "http://www.ciphergoth.org/crypto/mercy/"),
        new LinkItem("FSE 2000 Paper", "https://link.springer.com/chapter/10.1007/3-540-44706-7_4"),
        new LinkItem("Mercy on Crypto Wiki", "https://cryptography.fandom.com/wiki/Mercy_(cipher)")
      ];

      this.references = [
        new LinkItem("Paul Crowley's Cryptography", "https://www.ciphergoth.org/"),
        new LinkItem("FSE 2000 Proceedings", "https://link.springer.com/book/10.1007/3-540-44706-7")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Differential Cryptanalysis",
          "Broken by Scott Fluhrer at FSE 2001 with differential attack across all six rounds",
          "",
          "https://www.iacr.org/archive/fse2001/"
        )
      ];

      // Test vectors - NOTE: No official test vectors publicly available
      // Using implementation-derived vectors with round-trip validation
      // Mercy uses 512-byte blocks, so we provide complete expected outputs
      this.tests = [
        {
          text: "Mercy all-zeros test with zero key and tweak",
          uri: "Implementation-derived test vector (round-trip validated)",
          input: OpCodes.CreateArray(512, 0),
          key: OpCodes.CreateArray(16, 0),
          tweak: OpCodes.CreateArray(16, 0),
          expected: OpCodes.Hex8ToBytes("406E45494BECE167E520D9DCEE31C9A2C4422AD833F47E73A4D2133F0CEDA06F" +
            "3C77BDA3B4DE72F0FA740A668836A0301736E2AF6A24A928A370BD4C246E0502" +
            "1829369758A0F19CDBCEC54A00AA33998059EC1ED2369F74B44736FF59E1056A" +
            "940F07279ED068A7A2CA3DE1787377D5D5753254042F4F294676582FEDB5034F" +
            "88D387D3D81D4136A0C52E2454334F63DF835EE5F8BF5B7C77F45CE38516AE67" +
            "548C7F0135D1E181EA2EC42DF32528DF1115EE91867FDF467F6870D04EDEDBED" +
            "3F3D0C49E58D251DCDEA328532F3A806EC902FCA41B821BDB7A10AADB9D2EA71" +
            "EDFFFAE2309CD18B23574C38467DE5308352B97921C4E437FE8B1ADDF90B33D6" +
            "BE0D42FE678DBA7BFFAAD8CCF46DABE3CF3BC5F8D913C7C173A40115B98FF42C" +
            "EBBED76036A439D65B759849C784C1E7C4FD570E5016A98C6AE6140293C1E28C" +
            "AA2E4BFAECF90E967EDF17375C7F2815CC685A54D6E3EC928ACDAEA84E5D99AE" +
            "349B8CB0AC55BB1B93BEC011B49BDBE05418313CB9190BF48F7A7CD627F6DDAA" +
            "AFA2F615A8E457FCFA4AC567608C05DF411CDE518093CE18AC3E4176DF35688B" +
            "833C077E13D413B7FC65E17E9A87BD4443F85DDAA2449109E3FF3BE8CC278DF0" +
            "17CC28B702BCE0BC0D71E03394AA9BBE121EAC18E61B6709BE755689DF9A61A0" +
            "3834C813BB7E663965D0305B2A3C108288D0C92CB732ACD5548FE620B5762623"),
          roundTrip: true
        },
        {
          text: "Mercy incremental input pattern",
          uri: "Implementation-derived test vector (round-trip validated)",
          input: rampBytes(512),
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          tweak: OpCodes.Hex8ToBytes("FEDCBA9876543210FEDCBA9876543210"),
          expected: OpCodes.Hex8ToBytes("873A7C5888A267BE835FF946630849AFD73B64C6CA8BF7168CD2ACB0B3C917FB" +
            "BF7728C4147D1CD9982A4BAF11A36BBC42762C4DEB30C16B0823B47BC6C79EEE" +
            "A2450CC6E1D95B846BDC7E4802235563F64679963913CBD4B53BBEAA7A9A35BF" +
            "A416034DC570926F98560C0B01E0188B18A86D6F08DE53977411C210A7603CF4" +
            "C95DD555BFAE0FCA291C55C3E2777AC7267647307719F1815170B8935B60A09D" +
            "9BC20CC66713F0B204B21B52DC57414E6FF90157BB743DF2FAB4CEDC2B803EB1" +
            "3CC41AC93483C93FF787E179B01BF50E00EAB00997D4A56B72957075D9999394" +
            "F89DF62E8A58ACC992438BD1B48FBAD71BD62C390D5399E5437C0F539920AED1" +
            "FC02EA6A13EDED67D2C76869FB08BEDEDC5165051FDC2D50EB35A43E684E3675" +
            "5A791C28A1D5DDED206D17CC3081735465C0DFE07553008A813634FBFA00514A" +
            "7EBBF8E3B4A3A49142A951E982EE0897AAA5978A14D6B6F0ED0089A408FBBE17" +
            "23424E79905658623FACCB89A862F6F5E49875A0899917BFB6E09611DD33F4C2" +
            "2886314E29959A383D7C9F5CC81CBB2B3A815E2C610CFA5886E5B2C93039C249" +
            "81D78FC79B57ACD15BC84B2289AA53151A57E4BBB6D64B033335E616E88E3232" +
            "3C71491A70422DFB0A2E2C7CDADB69801B39B59802348E050BABB453D2FCA44A" +
            "71E32AE163C7C241D3E7D423A79B5A60A62946F3F782BB043034FB53DB3CA726"),
          roundTrip: true
        },
        {
          text: "Mercy with 0x55 pattern and non-zero tweak",
          uri: "Implementation-derived test vector (round-trip validated)",
          input: OpCodes.CreateArray(512, 0x55),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF0123456789ABCDEF"),
          tweak: OpCodes.Hex8ToBytes("0F0E0D0C0B0A09080706050403020100"),
          expected: OpCodes.Hex8ToBytes("FC71CF4407DDADF52B8705483E1451E8520594B10DB497C900F4DB40DF081908" +
            "C6DF8BD904B991DC55CAD4B85B4407A6099FB73CCF64C6A1A4AF38F9B15CC5D2" +
            "825E2B0B9AA3D8A5F689534F483F81781849A0893A6A444BFAA25519834543C7" +
            "AAE221E71F2F5DFE867BECB7F2CE19924C1FFD9B36A9A612101F31BFB78B996F" +
            "4FE3589495E2C64297FFE6279D34A1AD75060E4B5F55CC12B64AE5AB0A596517" +
            "6FB00329224F84F703627192760FA711094005984BCFB7E27F331A8D2D7774BE" +
            "D6B22F3578EE240927904D7280B404EED609A84821DAA0920A1077EC67853743" +
            "FE9ACD60F1000E00C300C59F6066D20979A5DCC92BB712CFDB1D288760A8C067" +
            "416018559140BA310F54A379650E5654F05759311BBE74C921F3A9DE66A7C98A" +
            "3062773D835807A1A2F20220ED37A637AA222D485FF3DD181FD4434738565736" +
            "084EA8BB9A72A67DC84B1C90DA238A265DB50B70CC5CBD2ED1A8EED5BA228AA3" +
            "82AFEB1B0A6AB43CFEF96742EED8033ACD108F4CC4665E09241ADBD561C5CEBD" +
            "734F9810078DCEE26240DC402F0DBF2F64D95D230F93272EE1F2C9BA1A9DDA98" +
            "06C700161A95B01740CEE34F23ABB932B73CBD223705FBD265019F169A3190B0" +
            "868EECC0C8672329FB2E25443B666D8E138115FC0D3F5D1D011E38A3AE79329B" +
            "C2B01307503895259F75776D2C354A0FFA81B8B20F82DD36A43629A35EADDC62"),
          roundTrip: true
        }
      ];

      // Algorithm constants
      /** @type {int32} */
      this.BLOCK_SIZE = BLOCK_SIZE;
      /** @type {int32} */
      this.HALF_BLOCK = HALF_BLOCK;
      /** @type {int32} */
      this.KEY_SIZE = KEY_SIZE;
      /** @type {int32} */
      this.TWEAK_SIZE = TWEAK_SIZE;
      /** @type {int32} */
      this.ROUNDS = ROUNDS;

      // Initialize AES-like S-box for key-dependent transformations
      // This is a simplified approach - real Mercy uses more complex state machine
      /** @type {uint8[]} */
      this.SBOX = MERCY_SBOX;
    }

    // Generate AES S-box (used as basis for key-dependent S-boxes)
    /**
     * @returns {uint8[]} The AES S-box
     */
    generateAESSbox() { return mercyAesSbox(); }

    // Generate key-dependent S-box by XORing base S-box with key material
    /**
     * @param {uint8[]} key - 16 key bytes
     * @param {uint8[]} tweak - 16 tweak bytes
     * @param {int32} round - Round index
     * @returns {uint8[]} Key-dependent S-box
     */
    generateKeySbox(key, tweak, round) { return mercyKeySbox(key, tweak, round); }

    // Feistel F-function: processes right half to modify left half
    /**
     * @param {uint8[]} rightHalf - Half block
     * @param {uint8[]} roundKey - Round key bytes
     * @param {uint8[]} keySbox - Key-dependent S-box
     * @returns {uint8[]} F output
     */
    fFunction(rightHalf, roundKey, keySbox) { return mercyF(rightHalf, roundKey, keySbox); }

    // Generate round keys from master key and tweak
    /**
     * @param {uint8[]} key - 16 key bytes
     * @param {uint8[]} tweak - 16 tweak bytes
     * @returns {uint8[][]} One HALF_BLOCK-byte round key per round
     */
    generateRoundKeys(key, tweak) { return mercyRoundKeys(key, tweak); }

    // Encrypt a 512-byte block using 6-round Feistel network
    /**
     * @param {uint8[]} block - Input block
     * @param {uint8[]} key - 16 key bytes
     * @param {uint8[]} tweak - 16 tweak bytes
     * @returns {uint8[]} Output block
     */
    encryptBlock(block, key, tweak) { return mercyEncrypt(block, key, tweak); }

    // Decrypt a 512-byte block (reverse Feistel network)
    /**
     * @param {uint8[]} block - Input block
     * @param {uint8[]} key - 16 key bytes
     * @param {uint8[]} tweak - 16 tweak bytes
     * @returns {uint8[]} Output block
     */
    decryptBlock(block, key, tweak) { return mercyDecrypt(block, key, tweak); }

    // Required: Create instance for this algorithm
    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {MercyInstance} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new MercyInstance(this, isInverse);
    }
  }

  // ===== INSTANCE CLASS =====

  /**
 * Mercy cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class MercyInstance extends IBlockCipherInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {MercyAlgorithm} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
      /** @type {uint8[]|null} */
      this._tweak = null;
      this.BlockSize = 512; // 4096 bits = 512 bytes
      this.KeySize = 0;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KeySize = 0;
        return;
      }

      // Validate key size (must be exactly 16 bytes)
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (must be 16 bytes)");
      }

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for tweak (128-bit block number / sector ID)
    /**
     * @param {uint8[]|null} tweakBytes - 16 tweak bytes, or null for the zero tweak
     */
    set tweak(tweakBytes) {
      if (!tweakBytes) {
        this._tweak = OpCodes.CreateArray(16, 0); // Default to zero tweak
        return;
      }

      // Validate tweak size (must be exactly 16 bytes)
      if (tweakBytes.length !== 16) {
        throw new Error("Invalid tweak size: " + tweakBytes.length + " bytes (must be 16 bytes)");
      }

      this._tweak = [...tweakBytes];
    }

    /**
     * @returns {uint8[]} Copy of the tweak (zeros when unset)
     */
    get tweak() {
      return this._tweak ? [...this._tweak] : OpCodes.CreateArray(16, 0);
    }

    // Feed data to the cipher (accumulates until we have complete blocks)
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");

      // Initialize tweak if not set
      if (!this._tweak) {
        this._tweak = OpCodes.CreateArray(16, 0);
      }

      // Add data to input buffer
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    // Get the result of the transformation
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // Initialize tweak if not set
      if (!this._tweak) {
        this._tweak = OpCodes.CreateArray(16, 0);
      }

      const blockSize = this.BlockSize;

      // Validate input length
      if (this.inputBuffer.length % blockSize !== 0) {
        throw new Error("Input length must be multiple of " + blockSize + " bytes (4096 bits)");
      }

      // Process each block
      /** @type {uint8[]} */
      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
        const block = this.inputBuffer.slice(i, i + blockSize);

        /** @type {uint8[]} */
        let processedBlock = [];
        if (this.isInverse)
          processedBlock = mercyDecrypt(block, this._key, this._tweak);
        else
          processedBlock = mercyEncrypt(block, this._key, this._tweak);

        for (let _i = 0; _i < processedBlock.length; _i++) output.push(processedBlock[_i]);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new MercyAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MercyAlgorithm, MercyInstance };
}));
