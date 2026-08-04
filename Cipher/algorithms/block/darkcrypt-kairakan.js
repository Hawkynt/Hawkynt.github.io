/*
 * KAIRAKAN (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * KAIRAKAN as implemented in the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). No public specification exists; this
 * implementation was reconstructed from the DarkCrypt implementation's
 * setup()/crypt()/decrypt() behavior. The source path
 * "tc_darkcrypt_mp\gtea\kairakan\kairakan.c" ties this cipher to DarkCrypt's
 * "gtea" (generalized TEA) family, matching the reconstructed structure
 * below: a TEA-style ARX round function generalized from TEA's 2-word ring
 * to a 4-word ring, with an added per-word byte-substitution layer.
 *
 * Block: 128 bits, as 4 little-endian 32-bit words A,B,C,D.
 * Key: 256 bits, as 8 little-endian 32-bit words K0..K7.
 *
 * Key schedule (from setup()): eight fixed 256-byte
 * substitution tables, BASE_SBOX[
        {
          text: "DarkCrypt KAIRAKAN - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6795457b71425ad102e674fcbb6dc37f")
        },
        {
          text: "DarkCrypt KAIRAKAN - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("cf82c6ffee48c2740ee52110b06133b9")
        },
        {
          text: "DarkCrypt KAIRAKAN - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("159425a76c6113fd120c042391f901ba")
        },
0..7] shown below.
 * For each key-dword index i (0..7) and each byte
 * position j (0..3) within that dword, setup() builds a 256-entry table
 *     T[i][j][k] = BASE_SBOX[i][ key[4*i+j] XOR k ]   for k = 0..255
 * i.e. a per-key-byte substitution table keyed off one of 8 fixed S-boxes
 * selected by the key-dword index. These 8*4*256 = 8192 entries are what
 * the round function below calls "group i" (i = 0..7).
 *
 * Word substitution (substituteWord, "refreshes" a word after each mix
 * step, using tables T[group][0..3]): given word w with bytes b3..b0 (MSB
 * to LSB),
 *     w ^= T[group][0][b3]                  (only changes bits 0-7)
 *     w ^= T[group][1][(w>>16)&0xFF] << 8    (only changes bits 8-15)
 *     w ^= T[group][2][(w>>8)&0xFF] << 16    (only changes bits 16-23)
 *     w ^= T[group][3][w&0xFF] << 24         (only changes bits 24-31)
 * Each step reads a byte of the word as it stood after the PRECEDING step,
 * cascading the substitution across the whole word; this is invertible
 * (see _inverseSubstituteWord) purely from the cascade structure, without
 * requiring the underlying 256-byte tables to be permutations themselves.
 *
 * Round function: initial whitening adds (not XORs) K0..K3 into A,B,C,D,
 * then A is immediately rotated left 11 and substituted with group 0. The
 * cipher then performs 32 numbered "mix" steps over the 4-word ring (order
 * B,C,D,A,B,C,D,A,...), each of the form
 *     target = target + ((source XOR stepNumber) + f(source))   (mod 2^32)
 * where f(x) = (x<<6) XOR (x>>>8) -- the same shift-xor idea as DarkCrypt's
 * XTEA variant (which uses shifts 6/9), here with shifts 6/8 and
 * generalized to 4 words. After most steps the freshly written word is
 * rotated left 11 and substituted (advancing through table groups 0..7,
 * wrapping), preparing it as a future source. Two irregularities in this
 * behavior were found (not guessable from a "clean" 32-round design) and
 * are reproduced exactly below as an explicit, unrolled 32-step sequence:
 *   - at step pairs (8,9) and (24,25) the SAME already-substituted source
 *     word is reused for two consecutive step numbers before it is next
 *     substituted (D contributes to A twice running, using the identical
 *     D value both times);
 *   - between steps 16 and 17, word A is substituted twice in a row
 *     (groups 7 then 1) with no mix step in between.
 * Finally A,B,C,D are XORed with K4..K7 and stored as the four output
 * words, in that order.
 *
 * Test vectors verified against the DarkCrypt implementation. Educational only.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([
        '../../AlgorithmFramework', '../../OpCodes'], factory);
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // Eight fixed 256-byte substitution tables, as used by the DarkCrypt
  // implementation (2048 bytes total).
  const BASE_SBOX = Object.freeze(OpCodes.Hex8ToBytes(
    'a3d70983f848f6f4b321157899b1aff9e72d4d8ace4cca2e5295d91e4e3844280adf02a017f1606812b77ac3e9fa3d5' +
    '396846bbaf2639a197caee5f5f7166aa239b67b0fc193811beeb41aead0912fb855b9da853f41bfe05a58805f660bd89' +
    '035d5c0a733066569450094566d989b7697fcb2c2b0fedb20e1ebd6e4dd474a1d42ed9e6e493ccd4327d207d4dec7671' +
    '889cb301f8dc68faac874dcc95d5c31a47088612c9f0d2b8750825464267d0340344b1c73d1c4fd3bccfb7fabe63e5ba' +
    '5ad04239c145122f02979717eff8c0ee20cefbc72756f37a1ecd38e628b8610e8087711be924f24c532369dcff3a6bba' +
    'c5e6ca9135725b5e3bda83a0105592a46429ec7c68cf9258fc8c1a1ce380412f26a5013696d4d9c31c384af88d34f95a' +
    '845781fd46c62fd32f81e6bab3f738564e73c0fca763da5e637774360daf4195934010e48074015f1906599d549b6085' +
    'c2f804c5df5c29dd9750302f792111663e0a6f04a4400eefbaa2def06550b9fb14e9b8a225e8d2394cd899a393eac823' +
    '598b026dbc97dcc727c79b5e571d0d11bbb580c677e7bb77446a7ea0a5a2187b36fdcc5bed83a1c29ebe82a93bde1ed9' +
    '1bfa36683960933e2df7057deb9fc14a052b4ecc0182caefeffa42853172e51475b10f3c43b2b41bad630e9e4b2cbad7' +
    'a5436868ef6bc248bd281cf5fd7971a7f1db861a920e3fadd56680d274ba26e052cc63a1b3ded4c90da12e362a73b6a4' +
    'f8ad1dc7ffcdba18bf379150e4dac6e2a168323347ed2643fe970f4f6ec4096a681c30414273160cdc00121d4332b65c' +
    'fe692eab647b79b5bbb10aa4135fd4b58e2c7190553c1ddd8d09f1cf98c78d38dc92febabcab87c1e0f5fa024bf28a3a' +
    '5f1f229f8beb3a25e2d93d5d60894b08fce9a1f0c488ea4a852e884519d5d89d75c825677f7032ecc394599851dbda9f' +
    '5065913b2ba9871de95306b7425feb4e47d684a757ac89e4e6d222097380a46b9445511076187c2915ab56cc59ce0fa7' +
    '36f18e169df63760bff0032261a503cee54b1c4cbbcf0ef0943d9fbaf49e73e8667366642800d88577b7202e51737ada' +
    'e0c551f18cf2f75390ee513a6485e9e02230f6e356aff96a1a984e94d86301b9a05a3f073f6c571c4abaf2c34918bb18' +
    'e43d57e3d0ab6fcd256d0eec894b88fc3be3c5d7a6872877f76dbeae159379deb904f6fb2c2cb0b77f1d3d7e24e62071' +
    '1128a7d58f73a2ae35738a080a84297ce10516009dd069bb0e8ba46a763360d8d9c8c69a55450b9f93ed631175f641d4' +
    '97974ec81a26cfb20aaefad33282624b700fa6d227bcc9f894088f87c2e83b5032d781cb4c953d9a4c13b145a9215322' +
    'b95fd67d8d401fe44e4854a47ac16e6bbd1276699cd04caf298bd08da4be0c7e7b370f393dedc5b454c6582f41a6baef' +
    '5296141c6c0191e21253f5cdfbf52bced74e97516b438d6528798a36fe51af66c018d5ad89335ab3bccaa7f037aef33a' +
    'fdcdac0ad65839d3624e345fb11bb2c3739c7fe7bd5b5caa1d1b87e32c246b6c84484c9a5c18261f55420a2e7b319eab' +
    '160349094e0a69a23ebc59c56fad05c1c2d9695cf81e164210bfc0680bdb0048ac33d730813bf9fbc1d028630d71b1f1' +
    '54edd3fe2ee6b4d2ef0b7490e0a5d298948e82f4c4b58173e778fbe698e99518c53d46a921ef8f40063d988a09bdb672' +
    '6a80778712a3141cb0ff14a0d79123c55ff9ecefdde62ac85f7ae4247727c687057f2276e50ba055ff9915e185b596d4' +
    'f2b2528431497a9a42266090ca7c6e4d2cd8bc4ecedd3763ae6107db9f3b2df4056c3e0fe704361794dbde6aa1752cd2' +
    '21e3dc63cecc1e4ad6abaf42e04ae0ed1b3abf2dea8a635b78f2794b459f689f15ab2b6af40e12f45ee15df64ea8bd9c' +
    '725bf087463d8c53623f7c81803978c7371fb3a65193b28c00006d0c2d77cb51193ed32101ce37ffc51dcc44cce33983' +
    '454531af5240c82f8021ffa9e83cb857a759ca1e7629f49726bd5572d584b4a378709eb9569a76ddb8dda6e6c3e0ad35' +
    '526991d9dd23f075c8ae841a0014642161330b9dd0fcc7e14a95b8eca50d6bbcf21ff7bb8843976f047a33892ef122a0' +
    'ba2a496680dbc5f1b5e312c9abe4ffdb14844c991ac902b209b05606f4e81d4f986e58878e9775d6729a5f3b0e27d806' +
    '6c0d7af022b2cbaeb43e407aa7f19390d9b74f1d39e6493f03bdd78d29de12ea8894b035dcb6ab52a718dee1250d9ff9' +
    '98f66243d32978262f75a1c167b88cc485f0bbbf55c7aa0efd5b6a57dc9fb57d455832108b395406144527337cf0ca6d' +
    'c349f11257e319076c56d2781e9a2e6f65e1d14844d4c0f3035a7051aac10d84aedab0e6ef88b8e283e2696fadbe7410' +
    '6c83f45fc562fc353fe67299ccdd61787b1543c4f858aeace22c4f95146bfa9d142da9215a4b23323795b1bec80a16be' +
    '35949cac1e09409f4f29a727ca36c2d7001e865c7bedeb01f91dfd0bdae6f044eb40a75f3c269381360adbc36e23a77c' +
    '663b88620b7586847008c1ee51898b9fd6db2812f2c8be5524d50df9406650c1e6bf8b54345ac53496a273f0b0539c59' +
    'f7969ddfef79b11aa98b923029a3a3559d4ebc496cea69719636676d1afb464553e07bf319d12589925c0749e3d8d905' +
    'c8ae262e7fffa952a1d084bc7f48e78d309b091c3e08feea45624574c75ae4814849217000310f19cbd28687dd85489a' +
    '0c2f5423446f95d2becfce847bce9cfdce4d6b386ea32c8131c93b13651827015801b0d873bd23c0a85c1188316e326c' +
    '6cd297bb72dcacca2be88da77414433a530db2eadf6716001d022615fa8a3678cab4e1f1a7ab6fb5ec9eff340bb04bac' +
    'bf0d97ce17fa16cdef20f5b4a20a9735ad538fdb8216e7237a76fed4f0ed7e67e'
  ));

  class DarkCryptKairakanAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();
      this.name = "KAIRAKAN (DarkCrypt)";
      this.description = "KAIRAKAN as implemented in the DarkCrypt Total Commander plugin. 128-bit block, 256-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt plugin)";
      this.year = 2013;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.RU;
      this.SupportedKeySizes = [new KeySize(32, 32, 0)];
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)];
      this.documentation = [new LinkItem("DarkCrypt plugin", "https://totalcmd.net/plugring/darkcrypttc.html")];
      this.tests = [
        {
          text: "DarkCrypt KAIRAKAN - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("6795457b71425ad102e674fcbb6dc37f")
        },
        {
          text: "DarkCrypt KAIRAKAN - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("cf82c6ffee48c2740ee52110b06133b9")
        },
        {
          text: "DarkCrypt KAIRAKAN - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("159425a76c6113fd120c042391f901ba")
        }
      ];
    }

    CreateInstance(isInverse = false) { return new DarkCryptKairakanInstance(this, isInverse); }
  }

  class DarkCryptKairakanInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._K = null;
      this._T = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._K = null; this._T = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. KAIRAKAN (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._K = this._keyDwords(this._key);
      this._T = this._buildTables(this._key);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");
      if (this.inputBuffer.length % this.BlockSize !== 0)
        throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...(this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block)));
      }
      this.inputBuffer = [];
      return output;
    }

    _keyDwords(key) {
      const K = new Array(8);
      for (let i = 0; i < 8; i++)
        K[i] = OpCodes.Pack32LE(key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]);
      return K;
    }

    // T[i][j][k] = BASE_SBOX[i][ key[4*i+j] XOR k ], i=0..7 (key dword), j=0..3 (byte pos)
    _buildTables(key) {
      const T = new Array(8);
      for (let i = 0; i < 8; i++) {
        const group = new Array(4);
        for (let j = 0; j < 4; j++) {
          const kb = key[4*i + j];
          const sub = new Array(256);
          for (let k = 0; k < 256; k++) sub[k] = BASE_SBOX[i*256 + OpCodes.Xor32(kb, k)];
          group[j] = sub;
        }
        T[i] = group;
      }
      return T;
    }

    _substituteWord(w, Tg) {
      w = OpCodes.Xor32(w, Tg[0][OpCodes.GetByte(w, 3)]);
      w = OpCodes.Xor32(w, OpCodes.Shl32(Tg[1][OpCodes.GetByte(w, 2)], 8));
      w = OpCodes.Xor32(w, OpCodes.Shl32(Tg[2][OpCodes.GetByte(w, 1)], 16));
      w = OpCodes.Xor32(w, OpCodes.Shl32(Tg[3][OpCodes.GetByte(w, 0)], 24));
      return OpCodes.ToUint32(w);
    }

    _inverseSubstituteWord(w, Tg) {
      const b0 = OpCodes.GetByte(w, 0), b1 = OpCodes.GetByte(w, 1);
      const b2 = OpCodes.GetByte(w, 2), b3 = OpCodes.GetByte(w, 3);
      const o2 = OpCodes.Xor32(b2, Tg[2][b1]);
      const o1 = OpCodes.Xor32(b1, Tg[1][o2]);
      const o3 = OpCodes.Xor32(b3, Tg[3][b0]);
      const o0 = OpCodes.Xor32(b0, Tg[0][o3]);
      return OpCodes.Pack32LE(o0, o1, o2, o3);
    }

    _f(x) {
      return OpCodes.Xor32(OpCodes.Shl32(x, 6), OpCodes.Shr32(x, 8));
    }

    _mixTerm(src, stepNumber) {
      return OpCodes.ToUint32(OpCodes.Xor32(src, stepNumber) + this._f(src));
    }

    // Explicit, unrolled 32-step mix/refresh sequence (see header comment for the
    // two irregular spots at steps 8/9, 24/25 (reused unrefreshed source) and
    // 16/17 (extra refresh of word A)).
    _encryptBlock(block) {
      const T = this._T, K = this._K;
      let A = OpCodes.ToUint32(K[0] + OpCodes.Pack32LE(block[0], block[1], block[2], block[3]));
      let B = OpCodes.ToUint32(K[1] + OpCodes.Pack32LE(block[4], block[5], block[6], block[7]));
      let C = OpCodes.ToUint32(K[2] + OpCodes.Pack32LE(block[8], block[9], block[10], block[11]));
      let D = OpCodes.ToUint32(K[3] + OpCodes.Pack32LE(block[12], block[13], block[14], block[15]));

      A = this._substituteWord(OpCodes.RotL32(A, 11), T[0]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 1));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[1]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 2));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[2]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 3));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[3]);
      A = OpCodes.ToUint32(A + this._mixTerm(D, 4));
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[4]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 5));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[5]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 6));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[6]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 7));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[7]);
      A = OpCodes.ToUint32(A + this._mixTerm(D, 8));
      A = OpCodes.ToUint32(A + this._mixTerm(D, 9));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[0]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 10));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[1]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 11));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[2]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 12));
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[3]);
      A = OpCodes.ToUint32(A + this._mixTerm(D, 13));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[4]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 14));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[5]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 15));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[6]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 16));
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[7]);
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[1]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 17));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[0]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 18));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[3]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 19));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[2]);
      A = OpCodes.ToUint32(A + this._mixTerm(D, 20));
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[5]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 21));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[4]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 22));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[7]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 23));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[6]);
      A = OpCodes.ToUint32(A + this._mixTerm(D, 24));
      A = OpCodes.ToUint32(A + this._mixTerm(D, 25));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[1]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 26));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[0]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 27));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[3]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 28));
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[2]);
      A = OpCodes.ToUint32(A + this._mixTerm(D, 29));
      D = this._substituteWord(OpCodes.RotL32(D, 11), T[5]);
      D = OpCodes.ToUint32(D + this._mixTerm(C, 30));
      C = this._substituteWord(OpCodes.RotL32(C, 11), T[4]);
      C = OpCodes.ToUint32(C + this._mixTerm(B, 31));
      B = this._substituteWord(OpCodes.RotL32(B, 11), T[7]);
      B = OpCodes.ToUint32(B + this._mixTerm(A, 32));
      A = this._substituteWord(OpCodes.RotL32(A, 11), T[6]);

      const out0 = OpCodes.Xor32(A, K[4]), out1 = OpCodes.Xor32(B, K[5]);
      const out2 = OpCodes.Xor32(C, K[6]), out3 = OpCodes.Xor32(D, K[7]);
      return [...OpCodes.Unpack32LE(out0), ...OpCodes.Unpack32LE(out1),
              ...OpCodes.Unpack32LE(out2), ...OpCodes.Unpack32LE(out3)];
    }

    // Exact algebraic inverse of _encryptBlock: same 64 operations, in reverse order,
    // each individually inverted (subtraction instead of addition, inverse substitution
    // + right-rotate instead of left-rotate + substitution).
    _decryptBlock(block) {
      const T = this._T, K = this._K;
      let A = OpCodes.Xor32(OpCodes.Pack32LE(block[0], block[1], block[2], block[3]), K[4]);
      let B = OpCodes.Xor32(OpCodes.Pack32LE(block[4], block[5], block[6], block[7]), K[5]);
      let C = OpCodes.Xor32(OpCodes.Pack32LE(block[8], block[9], block[10], block[11]), K[6]);
      let D = OpCodes.Xor32(OpCodes.Pack32LE(block[12], block[13], block[14], block[15]), K[7]);

      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[6]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 32));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[7]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 31));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[4]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 30));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[5]), 11);
      A = OpCodes.ToUint32(A - this._mixTerm(D, 29));
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[2]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 28));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[3]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 27));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[0]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 26));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[1]), 11);
      A = OpCodes.ToUint32(A - this._mixTerm(D, 25));
      A = OpCodes.ToUint32(A - this._mixTerm(D, 24));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[6]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 23));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[7]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 22));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[4]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 21));
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[5]), 11);
      A = OpCodes.ToUint32(A - this._mixTerm(D, 20));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[2]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 19));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[3]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 18));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[0]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 17));
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[1]), 11);
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[7]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 16));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[6]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 15));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[5]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 14));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[4]), 11);
      A = OpCodes.ToUint32(A - this._mixTerm(D, 13));
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[3]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 12));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[2]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 11));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[1]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 10));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[0]), 11);
      A = OpCodes.ToUint32(A - this._mixTerm(D, 9));
      A = OpCodes.ToUint32(A - this._mixTerm(D, 8));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[7]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 7));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[6]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 6));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[5]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 5));
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[4]), 11);
      A = OpCodes.ToUint32(A - this._mixTerm(D, 4));
      D = OpCodes.RotR32(this._inverseSubstituteWord(D, T[3]), 11);
      D = OpCodes.ToUint32(D - this._mixTerm(C, 3));
      C = OpCodes.RotR32(this._inverseSubstituteWord(C, T[2]), 11);
      C = OpCodes.ToUint32(C - this._mixTerm(B, 2));
      B = OpCodes.RotR32(this._inverseSubstituteWord(B, T[1]), 11);
      B = OpCodes.ToUint32(B - this._mixTerm(A, 1));
      A = OpCodes.RotR32(this._inverseSubstituteWord(A, T[0]), 11);

      const in0 = OpCodes.ToUint32(A - K[0]), in1 = OpCodes.ToUint32(B - K[1]);
      const in2 = OpCodes.ToUint32(C - K[2]), in3 = OpCodes.ToUint32(D - K[3]);
      return [...OpCodes.Unpack32LE(in0), ...OpCodes.Unpack32LE(in1),
              ...OpCodes.Unpack32LE(in2), ...OpCodes.Unpack32LE(in3)];
    }
  }

  const algorithmInstance = new DarkCryptKairakanAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKairakanAlgorithm, DarkCryptKairakanInstance };
}));
