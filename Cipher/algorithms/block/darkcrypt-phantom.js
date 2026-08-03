/*
 * Phantom (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The Phantom block cipher as implemented in the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). No public specification is known; this
 * is a from-scratch custom design (not a variant of any named public cipher).
 * 256-bit key, 128-bit block, big-endian words. Structure per block:
 *   - The 16-byte block is split into four 32-bit big-endian words L, R, A, B.
 *   - 16 body iterations, each consisting of two "half-rounds":
 *       half-round 1: A ^= mix(S0(F(L,k0)), S1(F(R,k1)))
 *       half-round 2: L ^= mix(S2(F(A,k2)), S3(F(B,k3)))
 *     (B is updated together with A in half-round 1, R together with L in half-round 2)
 *     using four consecutive 32-bit round-key words k0..k3 drawn from a 64-word table.
 *   - F(x,k) splits x and k each into high/low 16-bit halves and multiplies the
 *     corresponding halves modulo 65537 (IDEA-style multiplication, 0 represents 65536),
 *     recombining the two 16-bit results into a 32-bit word.
 *   - S0..S3 are four independent keyed-by-position byte substitution tables (256 entries
 *     each) applied to the four bytes of the 32-bit F() output and recombined.
 *   - mix() rotates the pair of 32-bit S-box outputs, treated as one little-endian-ordered
 *     64-bit word, left by 19 bits.
 *   - Decryption processes the same 64-word round-key table in reverse order with the two
 *     half-rounds swapped.
 * Key schedule: the 32-byte key is split into eight 32-bit big-endian words K0..K7; the
 * 64-word round-key table is built by selecting round-key[i] = K[idx[i]] for a fixed
 * 64-entry index permutation table (values 0..7).
 * As implemented in the DarkCrypt Total Commander plugin; test vectors verified
 * against the DarkCrypt implementation (crypt/decrypt round-trip verified).
 * Educational only.
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
          BlockCipherAlgorithm, IBlockCipherInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // 64-entry key-word index table (each value 0..7 selects one of the 8 key words to
  // form the per-round key-schedule word).
  const KEY_INDEX = [
    0,4,1,5,2,6,3,7, 1,0,3,2,5,4,7,6, 0,4,5,1,2,6,7,3, 7,6,5,4,3,2,1,0,
    0,4,3,7,1,5,2,6, 1,3,5,7,4,6,0,2, 1,0,2,3,5,4,6,7, 7,6,5,4,3,2,1,0
  ];

  // Four groups (round tag 0..3) of four 256-byte byte-substitution tables (one per input
  // byte position), 4096 bytes total.
  // Layout: SBOX[group*1024 + row*256 + byteValue], group=0..3, row=0..3 (byte 0=LSB..3=MSB).
  const PHANTOM_SBOX_HEX =
      "d6ca12e7cd897abcad79a42cc3505eb34b11e03d28ae0155594535b903264674bdf673b05a66be1878aaf976c87f70a99dab750271a520f30a978c3a160fcf9b" +
      "835d7c86dab1c692d899ce1c32fb6972234abbeecb93fdac44a38a0d532b543e097764d530511461a0e68b5f7d341b57e35becfea2d9d12539360befa76f9aa8" +
      "de00b8df4fed108e212fd484046cdc94f7ea4065b507a6c7f2389f6b873cc2f560d243fa4e8f2afcdbb4c14847f81e63ddb780f16ebfe8b6911a2785191f15e1" +
      "3b5641ff31cc7b3f822e1d520c7e9e5cd36d96172213e94c5805088d0e49e4249c6881f46ab298c49588e2424d29e5eb676237afc9d7ba902d06c5d0a133f0c0" +
      "77c52d2c6919fd5d8381945c925b0341c434660e89324a9ae3dcc3ef8fb3a5c04962f6fc4b8571a82f679b60d042e254443f98f73c07c2c8232bebc97e3565b1" +
      "0b2168dde05120f2f3d60a109f1fcb9c6452ec4e4304226c7ba0d538e48d59ae0dbff9487aa257871a7d065ab497ba4f957c09cea1e7e9f5538b8e02cc5eee36" +
      "d180cadb3b299993a38c40df1391901b7fd8ff7627164ce161af33f0c655b5e875a7173a96abed6e7458a4783182004501258608843730d2151caaf8282a6347" +
      "e5d49eadb0ded7cd726bb9bc056ffeb7fa70a6264d1214113d9dd9f41e24acbef1bb5fb8a9d388c7cf50560f8ada3e186db639466a2ebde673fb790cb2c11dea" +
      "da55621e9180ab019512b635075ac1af19cb8f8afdcddb36d7b547878daae38589c257ff52f1f32cc931866d4d971be28bdcc816537c0bd04bcc7f611120f045" +
      "b817660ed9ed2a084c02737b3f26a7f8c57aadbc671851eaa6d3a1a29a4f59a8fb6ab242d11f88d4282d769b235e823479ca64f430f713819e3906e184291a83" +
      "e946a9c4d53a2468d841e8b1b42f657d6394b3deb796495d5f326025efcfb974e578ba92acc08cbb5c6c6b099fe4eef669dd37f972901ca06f4e50ce990456fa" +
      "ae0f9de0444aec2bfcbd48eb3c10a55b58753d380afe05f2bf2293339c3ef5d2400c00e67e1415dfc7be27a403e721a31d71432ec677c36e540dd63b988eb070" +
      "61f3a025f2fb85bdd041e9c44fe19444676deca828d8d11e837a66e5b4a6105662045a5c00a198710e8c9795c1d46c534c48f40aed3e3a1f1b2949f6759a6a6e" +
      "c914862dfcd678e8090c26ef928abe2133d320ff346b76eb8bf0c6082be23c96dbbbaef5d25232ce0311c758ee4e893915bfe738f7e406fd6863c3555e5023cc" +
      "ad7b74708d472f59e0df6fb18f05313f4bd55d45a3b287220bc52ce3578e07803dba812a35af9bdc37aa69ca9f991da53051c0ac82600d771cf1d7183b845b65" +
      "b0b70fc2b39d915f16cb7fb6d97cea02bc01a9f8172742fa2e882493abfec8a443f9b5cf40dd54124d799e724ade73da46641990b8a27e9c367dcdb9e6131aa7" +
      "e7d252e80927e172fc4d53a7a6f874acb74076257e34b8c705b3d43c495979862b546f6781a8c16b14fb5c77200c75fd1b51ed4fdb388543fee6918d0fcbd06e" +
      "121e9ce0c3d1ffce5f4689f3ca7168cd922dd3c5f642ee1929ef2fc94e50dc048fea665b7ad83a55a93b112cdf1feb1a01ba618a390d6294909b3e8247b50736" +
      "976cf293cf448c41bc3fbf5aa5bb6d10f7af0ed74cb09f63b15d8b30e51cc803b400080bf528e233b63d028821a383dd8e0a22a2586a7c48aebd267fc6ecc4be" +
      "4ac22457f117c04b35e4841669ad73965e9878709e1d6515e9b2e3f4997b18d5377d9ad99dabcca423f0defa2e45a0d6605695b906a1aada8731806432f9132a" +
      "87565bf8711ec2d5f5e210f2d1faecc3e8ab747f8e0692d7a50ca42cb78ffc34acfdb2f7145f80add60a930882ed215594dcb9f10d867d8be3e7975a8344d9df" +
      "6103304bcd571ca333539c11093a29b31b1fcce1a2afb6137ac51a0b206f4301025859528df3d33edd5e174fbabb2d4df966b46aeb284776eabf88e5c7a79ec4" +
      "b02f39ef7c69a6a9dae9becb05120e4c753b626ddeb100325d40d045b8f6e04a50ce3dc9bc70e46eb5799f16ee3cfe68aa91aec03f385407492ee6988c253689" +
      "95d41d2b636c197842ff8a7224bd5c7727a122fbd2a831359b41602a9a154e847b2346486704d826f065db9da0997e90960ff4378164c1c66bcf7351c818ca85" +
      "0b71fddf9b97cbc59e15fb768c052b041ae1d96970349192f0b1eeb3ea25e4e9c1fef8016820a8f78a14293567ba666bc290320a5795c31c6461e0cfe6b6caad" +
      "f3861bc95e4324ac77a2b41e54a5e84dce0e4982f9e22a19bc3111a3ab58d499803db24116ebbb6d98ef4a50faf46e7317fc12dc877d5fdb0fa4c052bd3fd31f" +
      "be96bf46da88375bc86013f66accaa2223477927e7c6722f095a9c02dd7f8f0859400c2dede5b530d6944f7eec5da178d2d55375079a6210f24e6fd08b394528" +
      "c4743e4284388e4c51b7a6217b2ca063ff3acd8389b085f57a7c48a944f13c9dd78dd1aede93af9f2eb8035618655cc7064b0de31d003b36552633a76cd881b9" +
      "9c12cc01b01f1cfa8bb8ff50dde38f975a562777c09df585339e714c0af4612304c91d40ecc6b5bbcf45352cf70eaa76b767eefe6c483af2a8f84bf10d535451" +
      "7e03109a1370b1d7ba867a08acaf2b5778559bf3dba093948388b9ef3e992fe8a5e2e10f8a299f595c0247ce463d240b38c439918e19734358314f5e1a666d42" +
      "bde95b2ad5eaa2827c499622c1e769c220b3117b37abad64924ad460da9814e5c381e418c5f9b48472a73fde16a6bc2db2dffcbfbe5d348ccbd9aec8ed7589d8" +
      "ebc73c09d232631ea4d6e6797dd3a968d0620c44fb41e025216e0615f6ca90fd8ddc36804e1b6b5f3b28b6f017a3cdd187a16f302e26074d65955200747f6a05" +
      "727c4c24d26f1c6b28d3e93419be9ff2fe318fc5519712a229edce7665ef67ff034635172ea43b4f5d0dee57e14d398d77006a69f770502cb3bda045f178f040" +
      "ab9214c0e65352f5852368c960fcb24842a9712a9022070e9916cd01b69d83ec8759c4f9ded556c3068edaad33eab7d402418baeb894d9817491e3111a26d1e7" +
      "9b821da52b4b3f491e30278063059c55c6b17be49632ebdf8c737d0a7910201544dbcc1fe0bab0a61b9388d6e562e23d04087fcf1886b55f0b6e95bcb9754e8a" +
      "c75a9a98a7252f09d8dd435baab4f40c6ddc642dc2c85ce8fb7a0f36cbf8acaf583837f36cd0a34a3cfaf6a184bb475e6166213e7ec19e54d713a8cafdbf3a89" +
      "b77fd01b0542b033ff326d1819fd0ab551c816353457ea3f0fa927380bc794e121cc00e04e907780ed933e8e3d1a9943d5feef830e9bb698f97265a82b5928b9" +
      "56143c1788e8257b53235a509c091fd9954d6c10d2457c442df8b3f6f202fa978a61e59f554837a5be242285608b63adca4b7e03bfc95daf747884bd699196df" +
      "dba211897ab187769a04f0f50ce9cec6cfabac49156a8cb24aa0e3e670363966d858aebc4c6f31c4eec0d4dd5447c5f371aa3bd681f1d3fb5b1229da2ad13a1c" +
      "1edc26e2c3ec6b08a42ea3e75e6875cda1620d8df7cb07f44ffc9ebb6ea61d678f86e44682ebc101642040b47d79de5f419d062fd7c2a773b85c305292132cba" +
      "aaa58188617ed74723bc77ab39310a3e542982e2fb5cc2b903e52b952022ad709c5309645e433fdcbf9d9b8bec4f56a732696787bd288e5891216b1c2cc1f375" +
      "8a8378beb35d2e96eb7c719385ae333de979d3fdeaccb7d9681245416e44f0e1f6ba1ff8e6a0e0fecbc9d8c02fa90149cf11d4b6ee52de6c9fca1d1b901a766f" +
      "cd97b43b1772e89a15b1b51e51987b0e1494b20618d62ad1ff928c733c360b2d3757a20480a626c7dd99bbc6f1faa335556ad07f7a134d0d4c3884e33a30070f" +
      "50aff719008fc4fc4bb0a8d2a462ed08dfce7d02c5425bdb6040f2050cdab8594a5fe766f446746d484eefd5f9ac24a1f5c8c3165a892710863463258de49e65" +
      "eef05abc6bb8c72a7d39d9f48389ca0db2b93c94c15d011daacbc0ac278d739b52857fc94cd78cd572e3cc176fc3e52596a676901a9709f8e15ceb7e420a71c8" +
      "119e28b63d65d264aebaa49fad2e9da178157a1693312640b302d1532f5e6dd8033ececdb421f236e02bbe4fbd660b33a0e4686020131b5fc44d007cffecaf74" +
      "3a5132e88ffb8bc534d33b9163a3dd879530def784cffe984b502957c648592df1a7b0ea8188123f799a6cbf7b4641385bd0e68249436177a8d4866a1c04db06" +
      "1918f6e7ab07bb2356994e588ef9a20cb7690f4ac2f505fc45472214e2f3a98067759c6e6254a535dc101e2444080ed6b1ed55e92cdf923770fdfada8aef1fb5" +
      "b23698f5e6156730e7e3a117aa901b66b5798340cc6d8b3f686a849f2f72da5965db80cf39c2a776f84b1ad6f7b1d73b99c3e238701d713cd3620d87cd48e512" +
      "785ba306bcebfd4f85d964ef5d58c8a5a24a34d81f03a410a975528d28376f46e850d5f4f1207cf6c4acee5119ca8218e443417b21cb4e3af32425b0fec18986" +
      "329d3d0c9efc048f0e9301352294c0607e63ae08dc574cc7530badafde6cff42979b13092efacec9161c235e7d057a5fb72b7fd43e116b0fb80a479a2a8e8a56" +
      "e0494555d04d6961a6028174dd92ba07f026311ef291c6a02977bf33b67396882c9cf95444fb95dfbd27d25ce96eb9ec14eaa8d1b4b35abe8cab00bbe12dc5ed" +
      "da4bc317b0676e2047728e7d5139fa938cd9e7fc5eb4573db31ba91adfd3bbdda8c07bb7119b5f8f217498615312c94196c1b1a078315bbf5c89fdd6260e8043" +
      "ef1c97665a65f90f1ff092e2be642223099538de60db0dd529cc56490646108679d1ffbcc51890cd4c4e13627124b50aa4ce407ef63eaeaa2527f294d7634ffb" +
      "a72a339c4505d00c3b91769f992ecf7adc44a55de8ebad83e952f8703419f54aa13a03a66885042c488b6d079d6cbac2285059b837e01de4146b58d8b69ac608" +
      "c40255fe847ceae6b2d2eea34d73f7ed9e16abf1f4b9eccbe11581ca82c82d6f773c8869d4bd8d3fc735f3e5756a2b30321ea200af0b8a36015442ace37f872f" +
      "5234c412a85303bc9c960fc3292f68ef1c6b7ea5be5f99f495b987adf190e2a6ba229800b22d3025bf9175a7830804c03d701fd726487a725eac65b8e974f97b" +
      "8805d42c63bddce76dd8c16c1410660e4b4136379b318efc5762c546a4563a43555c3b514d3c71c978166115732bb51a8c4acc7c35dafa80d3f39fa0603fe5e8" +
      "5ac6d0ce4f4ef20c23f5dbe14507c2020b691750f85db4f0e692b621abfd679d93472eddc79effeb791df627406f7dd2587682860ab7d5b097aedeea447f848a" +
      "fb28af77d91e9a59cf49d6eee432a1b14cec641806a320e0ed01d1aa19bb851b39c8e3ca54386e112442fedf8f6acba95b89940d3e2a8bcdf7b3330981a2138d" +
      "acf0734d9e413f0c2a9010f84e241ca4f516f371f7bad02da66c68d587698dc6e17bb82181edb96f5e2ba7783c5c61efa55879ff20da4a6439c2f2226addaafe" +
      "6b752863578526389fa03ac43d0f43cbdcd7c0721dad047a988a14e3b5840d1b12eeb7f19d0966d88694c996808f0702e0fa7715058cb6139793e465f96ec782" +
      "9c17cda9d92eea747eeca8bd88ce56eb59bbaf4ccfcc5f3ec1404b7d08f4c536fcb3ca528e4906d3be67fb039ae8d60b7c0a27332c302591d4379b3bc32f2962" +
      "60a100921e3150bce62370f63435ae89dbdea3b444ab18d24f533254765d95b2bfd1e55b1a48fde91fa29942e7b05546b119476d83450e5a8b517fe2df1101c8";

  const PHANTOM_SBOX = OpCodes.Hex8ToBytes(PHANTOM_SBOX_HEX);

  // IDEA-style multiplication modulo 65537 (0x10001); the value 0 represents 65536 (2^16).
  function mulMod65537(a, b) {
    const A = a === 0 ? 65536 : a;
    const B = b === 0 ? 65536 : b;
    let p = (A * B) % 65537;
    if (p === 65536) p = 0;
    return p;
  }

  class DarkCryptPhantomAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Phantom (DarkCrypt)";
      this.description = "Custom block cipher bundled with the DarkCrypt Total Commander plugin. Four-branch structure combining IDEA-style modular multiplication, four keyed byte-substitution tables, and 64-bit rotate mixing over 16 body iterations (32 sub-rounds). 128-bit block, 256-bit key, big-endian words. No public specification is known.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / \"Zarya\" project)";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented custom design", "No public cryptanalysis exists; the cipher is not derived from any reviewed public design.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Phantom — - all-zero key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("8f1c19b78c1c66df9d154642162d7f8f")
        },
        {
          text: "DarkCrypt Phantom — - incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("c1a60b084f67838784ac4fc05217bb31")
        },
        {
          text: "DarkCrypt Phantom — - shifted incrementing key and plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("9684468689596000d31f8f5db1669c19")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptPhantomInstance(this, isInverse);
    }
  }

  class DarkCryptPhantomInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._roundTable = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._roundTable = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Phantom (DarkCrypt) requires exactly 32 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._roundTable = this._buildRoundTable(this._key);
    }

    get key() { return this._key ? [...this._key] : null; }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
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

    // Eight 32-bit big-endian key words, expanded to a 64-word round-key table by
    // selecting round-key[i] = K[KEY_INDEX[i]] (fixed permutation, values 0..7).
    _buildRoundTable(keyBytes) {
      const K = [
        OpCodes.Pack32BE(keyBytes[0], keyBytes[1], keyBytes[2], keyBytes[3]),
        OpCodes.Pack32BE(keyBytes[4], keyBytes[5], keyBytes[6], keyBytes[7]),
        OpCodes.Pack32BE(keyBytes[8], keyBytes[9], keyBytes[10], keyBytes[11]),
        OpCodes.Pack32BE(keyBytes[12], keyBytes[13], keyBytes[14], keyBytes[15]),
        OpCodes.Pack32BE(keyBytes[16], keyBytes[17], keyBytes[18], keyBytes[19]),
        OpCodes.Pack32BE(keyBytes[20], keyBytes[21], keyBytes[22], keyBytes[23]),
        OpCodes.Pack32BE(keyBytes[24], keyBytes[25], keyBytes[26], keyBytes[27]),
        OpCodes.Pack32BE(keyBytes[28], keyBytes[29], keyBytes[30], keyBytes[31])
      ];
      const table = new Array(64);
      for (let i = 0; i < 64; i++) table[i] = K[KEY_INDEX[i]];
      return table;
    }

    // F(x,k): split x and k into high/low 16-bit halves; multiply matching halves modulo
    // 65537 (IDEA-style); recombine the two 16-bit results into a 32-bit word.
    _f(x, k) {
      const xHi = OpCodes.And32(OpCodes.Shr32(x, 16), 0xFFFF), xLo = OpCodes.And32(x, 0xFFFF);
      const kHi = OpCodes.And32(OpCodes.Shr32(k, 16), 0xFFFF), kLo = OpCodes.And32(k, 0xFFFF);
      return OpCodes.Or32(OpCodes.Shl32(mulMod65537(xHi, kHi), 16), mulMod65537(xLo, kLo));
    }

    // S(group, v): apply four independent 256-entry byte-substitution tables (selected by
    // 'group' 0..3) to the four bytes of v (LSB..MSB) and recombine into a 32-bit word.
    _sbox(group, v) {
      const base = group * 1024;
      const b0 = PHANTOM_SBOX[base + 0 * 256 + OpCodes.And32(v, 0xFF)];
      const b1 = PHANTOM_SBOX[base + 1 * 256 + OpCodes.And32(OpCodes.Shr32(v, 8), 0xFF)];
      const b2 = PHANTOM_SBOX[base + 2 * 256 + OpCodes.And32(OpCodes.Shr32(v, 16), 0xFF)];
      const b3 = PHANTOM_SBOX[base + 3 * 256 + OpCodes.And32(OpCodes.Shr32(v, 24), 0xFF)];
      return OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(b0, OpCodes.Shl32(b1, 8)), OpCodes.Shl32(b2, 16)), OpCodes.Shl32(b3, 24));
    }

    // Rotate the pair (c0=low word, c1=high word), treated as one 64-bit little-endian
    // word, left by 19 bits.
    _mix64(c0, c1) {
      const n0 = OpCodes.Or32(OpCodes.Shl32(c0, 19), OpCodes.Shr32(c1, 13));
      const n1 = OpCodes.Or32(OpCodes.Shl32(c1, 19), OpCodes.Shr32(c0, 13));
      return [n0, n1];
    }

    _encryptBlock(block) {
      let L = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let R = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      let A = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      let B = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
      const rt = this._roundTable;
      let ptr = 0;
      for (let i = 0; i < 16; i++) {
        let t0 = this._sbox(0, this._f(L, rt[ptr]));
        let t1 = this._sbox(1, this._f(R, rt[ptr + 1]));
        [t0, t1] = this._mix64(t0, t1);
        A = OpCodes.Xor32(A, t0);
        B = OpCodes.Xor32(B, t1);
        ptr += 2;

        let u0 = this._sbox(2, this._f(A, rt[ptr]));
        let u1 = this._sbox(3, this._f(B, rt[ptr + 1]));
        [u0, u1] = this._mix64(u0, u1);
        L = OpCodes.Xor32(L, u0);
        R = OpCodes.Xor32(R, u1);
        ptr += 2;
      }
      return [...OpCodes.Unpack32BE(A), ...OpCodes.Unpack32BE(B), ...OpCodes.Unpack32BE(L), ...OpCodes.Unpack32BE(R)];
    }

    _decryptBlock(block) {
      let L = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let R = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
      let A = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
      let B = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
      const rt = this._roundTable;
      let ptr = 62;
      for (let i = 0; i < 16; i++) {
        let t0 = this._sbox(2, this._f(L, rt[ptr]));
        let t1 = this._sbox(3, this._f(R, rt[ptr + 1]));
        [t0, t1] = this._mix64(t0, t1);
        A = OpCodes.Xor32(A, t0);
        B = OpCodes.Xor32(B, t1);
        ptr -= 2;

        let u0 = this._sbox(0, this._f(A, rt[ptr]));
        let u1 = this._sbox(1, this._f(B, rt[ptr + 1]));
        [u0, u1] = this._mix64(u0, u1);
        L = OpCodes.Xor32(L, u0);
        R = OpCodes.Xor32(R, u1);
        ptr -= 2;
      }
      return [...OpCodes.Unpack32BE(A), ...OpCodes.Unpack32BE(B), ...OpCodes.Unpack32BE(L), ...OpCodes.Unpack32BE(R)];
    }
  }

  const algorithmInstance = new DarkCryptPhantomAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptPhantomAlgorithm, DarkCryptPhantomInstance };
}));
