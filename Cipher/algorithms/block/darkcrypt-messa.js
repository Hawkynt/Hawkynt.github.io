/*
 * MESSA (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A 31-round block cipher from the DarkCrypt Total Commander plugin (Alexander
 * Myasnikov, "Zarya" project). No public specification exists for this cipher.
 * 64-bit block (2x32-bit words), 512-bit key, little-endian.
 *
 * Core primitive F(x, n): substitutes each byte of x through one of four fixed
 * 256-byte S-boxes (top byte -> box0, ... low byte -> box3), packs the four
 * substituted bytes back big-endian (box0's byte -> bits 31..24), then rotates
 * the result left by n (mod 32).
 *
 * Key schedule (setup()): builds a 64-word (256-byte) mutable round table from
 * the 512-bit key in three stages:
 *   1. The table is seeded to the identity permutation [0..63], then scrambled
 *      by 8 key-independent passes (each pass substituting every entry through a
 *      fixed 256-byte lookup table and a per-pass 1024-byte slice of an 8KB
 *      lookup table, then through F(., 11)).
 *   2. Phase 1 runs 10 rounds. Each round calls an internal key/table mixing
 *      routine that walks the table in a 64x16x4 nested loop --
 *      mixing in one key dword per 16-iteration "block" via variable-position
 *      byte extraction and table-row-selected lookups combined through F(., 11)
 *      -- ending in a long fixed post-mix of the table using only the running
 *      hash accumulator. Rounds 0-8 additionally fold the raw 64-byte key buffer
 *      through a second internal routine that performs a further table-driven
 *      1024-iteration keyed permutation, bracketed by simple F(keyword, 11)
 *      passes over the key buffer (round 0 only after that call;
 *      rounds 1-8 both before and after).
 *   3. Phase 2 runs 10 more iterations, each folding the key buffer through TWO
 *      passes of a spread-and-rotate transform (word -> F(((word<<6)^(word>>>9))
 *      + ROL32(word,16), 11)), sandwiching another call to the permutation
 *      routine, followed by one more call to the table-mixing routine. The key
 *      buffer's final state becomes the 64-byte (16-dword) per-round-pair
 *      addend table K used by crypt()/decrypt().
 *
 * Round function: 31 rounds, alternating between two structurally different
 * table-lookup/rotate steps depending on round parity (even rounds walk the
 * table with a fixed step of 8 bytes per round; odd rounds index the table with
 * the low 5 bits of the running state), each combining a table lookup, a
 * spread-and-rotate mix, and one call to F(., 11) to update one of the two
 * 32-bit halves. Decryption runs the same 31-round construction counting
 * down instead of up, with the two parity-dependent branches swapped
 * accordingly.
 *
 * As implemented in the DarkCrypt Total Commander plugin; test vectors
 * verified against the DarkCrypt implementation (setup+crypt / setup+decrypt
 * round-trip verified).
 *
 * 64-bit blocks, 512-bit keys. Educational only.
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

  // ---- Constant tables (9472 bytes total): a 256-byte lookup table, an 8KB
  // (8 x 1024-byte) lookup table used by the key-schedule mixing routine, and
  // four 256-byte substitution boxes used by the core primitive F().
  const T1 = OpCodes.Hex8ToBytes(
    "a3d70983f848f6f4b321157899b1aff9e72d4d8ace4cca2e5295d91e4e3844280adf02a017f1606812b77ac3e9fa3d5396846bbaf2639a197caee5f5f7166aa239b67b0fc193811beeb41aead0912fb855b9da853f41bfe05a58805f660bd89035d5c0a7" +
    "33066569450094566d989b7697fcb2c2b0fedb20e1ebd6e4dd474a1d42ed9e6e493ccd4327d207d4dec7671889cb301f8dc68faac874dcc95d5c31a47088612c9f0d2b8750825464267d0340344b1c73d1c4fd3bccfb7fabe63e5ba5ad04239c145122f0" +
    "2979717eff8c0ee20cefbc72756f37a1ecd38e628b8610e8087711be924f24c532369dcff3a6bbac5e6ca9135725b5e3bda83a0105592a46"
  );
  const T2 = OpCodes.Hex8ToBytes(
    "68d2d3ba194dfc5493bc712fb9cd9c740251f553b86b68d3bd6f6bd26429d74d0d5df050268ae9ac830e8a8d79c6dcbfaddd90700755f652c852b39a612dd44c658f23eaa67362d5f166a497b2636ed1ffcc55330859f3512a71ed5b04a2f7a6815f7fde" +
    "753dd848329ae5a8c75eb699904b70dbfac8563251e6c4b72bd719fc48ab38e3dc42bf9eef7eae91cd56b09b4daf3be26dd6d0bb5819c341cba5b26e0baef2a5c00b40cbdab1bd6bfb6ea2951fbefea118eb08f34ffeceb10a080602db1749ccf33751c4" +
    "6974271d44503c14e82b58c3f291a563954f73da3469e75d3e61e15f8b5779dc94e9877dde134acd9ee1817f2f75ee5ac1adb46c316de45c0cfb04f7be986a2624db1cff7e932aed6f8725e8d34eba9dcea1b16f8c028f8e7d642b191abafda017e70df0" +
    "971e8689333c110f1b1c09072986ecaf30cb10fb2820180841543f153934170d14100c0405040301e98dac64845b7cdfb3c59a7680f98b798e537addc9f4473d4e583a16c3fc413febdc5937c4a9b76dd8e0483867ded6b9a2d195736a8326e9e1d45f35" +
    "1c49ff55a8d993718af18d7b860a898ca7d59672921a858809ff07f682a87e2ac6f8423e3b65e25ebb9c69274305ca463c30140cec89af65d5bdb868f899a3610f0c0503e2235ec11641f957a97f67d69a4376d9257de8589f4775d8e385aa66ac7b64d7" +
    "d2e84e3acf0745c8ccf0443c35cf13faf462a79601a6f4a7c25ab5987b9729ec62dad5b8fc3b54c72c82efaed0b9bb697a31dd4b3d96e0ab379ee6a9e681a96722281e0a4601c9471def0bf25beec2b5aa88662256b332e5719f2fee7cc2dfbe87ac7d2b" +
    "bf3e9e815a483612b5369883776c2d1b3638120eaf8c652306f302f54c09cf45a5846321d11f4fce7039db499cb0742c3ac316f959bf37e654e2c7b688a078284b5c3917b0329b8272682e1a9d16808b21df1ffe9812838a2d241b09ca0346c9a1269487" +
    "6b25d24e42a33ee196b8722e53b731e447a73de0608b20ebea7aad900eaaf1a46678221eab2e9285fd9da06000000000b1946f2503f701f412e30ef1fe6aa194272c1d0b5cbb34e7bcc99f75749b2cefe4d05c34f5c45331a37761d4b7676dd0a4229786" +
    "9be5827e238eeaad2ed31afd8da47b29f0c05030d7ec4d3bd946bc9f3fc715f8f93f57c65f4c35131e180a0611140f05f63352c555443311b6c1997791ed847c8ff58e7a85fd8878eed85a366c70241cdde44b392079eb59786028181345fa5645f6c8b3" +
    "4afacdb0b4906c24a080602040f2cbb2e072ab9215b6f8a3e7275dc0490dcc44f795a662504030105eeac1b4ae2a91845211c543e576a893ed2f5bc27f35de4a73cedabd89068c8f99b4772d76cad9bcd64ab99cdfb5be6a5d1dc040d41b4ccf10b2fba2" +
    "ba3a9d806e21d14f637c211fc50f43ca3892e3aa5715c642d268bad34d1954fcbc932f71cdb9749c510253f56bb8d3686fbdd26b29644dd75d0d50f08a26ace90e838d8ac679bfdcddad7090550752f652c89ab32d614cd48f65ea2373a6d56266f197a4" +
    "63b2d16eccff3355590851f3712a5beda204a6f75f81de7f3d7548d89a32a8e55ec799b64b90db70c8fa3256e651b7c4d72bfc19ab48e33842dc9ebf7eef91ae56cd9bb0af4de23bd66dbbd0195841c3a5cb6eb2ae0ba5f20bc0cb40b1da6bbd6efb95a2" +
    "be1fa1feeb18f308fe4fb1ce080a020617dbcc4937f3c45174691d275044143c2be8c35891f263a54f95da7369345de7613e5fe1578bdc79e9947d8713decd4ae19e7f81752f5aeeadc16cb46d315ce4fb0cf70498be266adb24ff1c937eed2a876fe825" +
    "4ed39dbaa1ce6fb1028c8e8f647d192bba1aa0fde717f00d1e9789863c330f111c1b07098629afeccb30fb10202808185441153f34390d171014040c040501038de964ac5b84df7cc5b3769af980798b538edd7af4c93d47584e163afcc33f41dceb3759" +
    "a9c46db7e0d83848de67b9d6d1a27395836ae926d4e1355f491c55ffd9a87193f18a7b8d0a868c89d5a772961a928885ff09f607a8822a7ef8c63e42653b5ee29cbb2769054346ca303c0c1489ec65afbdd568b899f861a30c0f030523e2c15e411657f9" +
    "7fa9d667439ad9767d2558e8479fd87585e366aa7bacd764e8d23a4e07cfc845f0cc3c44cf35fa1362f496a7a601a7f45ac298b5977bec29da62b8d53bfcc754822caeefb9d069bb317a4bdd963dabe09e37a9e681e667a928220a1e014647c9ef1df20b" +
    "ee5bb5c288aa2266b356e5329f71ee2fc27cbedfac872b7d3ebf819e485a123636b583986c771b2d38360e128caf2365f306f502094c45cf84a521631fd1ce4f397049dbb09c2c74c33af916bf59e637e254b6c7a08828785c4b173932b0829b68721a2e" +
    "169d8b80df21fe1f12988a83242d091b03cac94626a18794256b4ed2a342e13eb8962e72b753e431a747e03d8b60eb207aea90adaa0ea4f178661e222eab85929dfd60a00000000094b1256ff703f401e312f10e6afe94a12c270b1dbb5ce734c9bc759f" +
    "9b74ef2cd0e4345cc4f5315377a3d46167b7d06d22a48697e59b7e828e23adead32efd1aa48d297bc0f03050ecd73b4d46d99fbcc73ff8153ff9c6574c5f1335181e060a1411050f33f6c55244551133c1b67799ed917c84f58f7a8efd857888d8ee365a" +
    "706c1c24e4dd394b792059eb60781828451356faf645b3c8fa4ab0cd90b4246c80a02060f240b2cb72e092abb615a3f827e7c05d0d4944cc95f762a640501030ea5eb4c12aae8491115243c576e593a82fedc25b357f4adece73bdda06898f8cb4992d77" +
    "ca76bcd94ad69cb9b5df6abe1d5d40c01bd4cf4cb210a2fb3aba809d216e4fd17c631f210fc5ca439238aae3155742c6d3ba68d2fc54194d712f93bc9c74b9cdf553025168d3b86b6bd2bd6fd74d6429f0500d5de9ac268a8a8d830edcbf79c69070addd" +
    "f6520755b39ac852d44c612d23ea658f62d5a673a497f1666ed1b2635533ffccf3510859ed5b2a71f7a604a27fde815fd848753de5a8329ab699c75e70db904b5632fac8c4b751e619fc2bd738e348abbf9edc42ae91ef7eb09bcd563be24dafd0bb6dd6" +
    "c3415819b26ecba5f2a50bae40cbc00bbd6bdab1a295fb6efea11fbe08f318ebceb14ffe06020a0849ccdb1751c4f337271d69743c14445058c3e82ba563f29173da954fe75d3469e15f3e6179dc8b57877d94e94acdde13817f9ee1ee5a2f75b46cc1ad" +
    "e45c316d04f70cfb6a26be981cff24db2aed7e9325e86f87ba9dd34eb16fcea18f8e8c022b197d64fda01aba0df017e78689971e110f333c09071b1cecaf298610fb30cb180828203f154154170d39340c04141003010504ac64e98d7cdf845b9a76b3c5" +
    "8b7980f97add8e53473dc9f43a164e58413fc3fc5937ebdcb76dc4a94838d8e0d6b967de9573a2d126e96a835f35e1d4ff551c499371a8d98d7b8af1898c860a9672a7d58588921a07f609ff7e2a82a8423ec6f8e25e3b656927bb9cca464305140c3c30" +
    "af65ec89b868d5bda361f89905030f0c5ec1e223f957164167d6a97f76d99a43e858257d75d89f47aa66e38564d7ac7b4e3ad2e845c8cf07443cccf013fa35cfa796f462f4a701a6b598c25a29ec7b97d5b862da54c7fc3befae2c82bb69d0b9dd4b7a31" +
    "e0ab3d96e6a9379ea967e6811e0a2228c94746010bf21defc2b55bee6622aa8832e556b32fee719fdfbe7cc27d2b87ac9e81bf3e36125a489883b5362d1b776c120e36386523af8c02f506f3cf454c096321a5844fced11fdb497039742c9cb016f93ac3" +
    "37e659bfc7b654e2782888a039174b5c9b82b0322e1a7268808b9d161ffe21df838a98121b092d2446c9ca039487a126d24e6b253ee142a3722e96b831e453b73de047a720eb608bad90ea7af1a40eaa221e66789285ab2ea060fd9d000000006f25b194" +
    "01f403f70ef112e3a194fe6a1d0b272c34e75cbb9f75bcc92cef749b5c34e4d05331f5c461d4a3776dd0b7679786a422827e9be5eaad238e1afd2ed37b298da45030f0c04d3bd7ecbc9fd94615f83fc757c6f93f35135f4c0a061e180f05111452c5f633" +
    "331155449977b6c1847c91ed8e7a8ff5887885fd5a36eed8241c6c704b39dde4eb59207928187860fa561345c8b345f6cdb04afa6c24b4906020a080cbb240f2ab92e072f8a315b65dc0e727cc44490da662f79530105040c1b45eea9184ae2ac5435211" +
    "a893e5765bc2ed2fde4a7f35dabd73ce8c8f8906772d99b4d9bc76cab99cd64abe6adfb5c0405d1d4ccfd41bfba210b29d80ba3ad14f6e21211f637c43cac50fe3aa3892c6425715bad3d26854fc4d192f71bc93749ccdb953f55102d3686bb8d26b6fbd" +
    "4dd7296450f05d0dace98a268d8a0e83bfdcc6797090ddad52f655079ab352c84cd42d61ea238f65d56273a697a466f1d16e63b23355ccff51f359085bed712aa6f7a204de7f5f8148d83d75a8e59a3299b65ec7db704b903256c8fab7c4e651fc19d72b" +
    "e338ab489ebf42dc91ae7eef9bb056cde23baf4dbbd0d66d41c319586eb2a5cba5f2ae0bcb400bc06bbdb1da95a26efba1febe1ff308eb18b1cefe4f0206080acc4917dbc45137f31d277469143c5044c3582be863a591f2da734f955de769345fe1613e" +
    "dc79578b7d87e994cd4a13de7f81e19e5aee752f6cb4adc15ce46d31f704fb0c266a98beff1cdb24ed2a937ee825876f9dba4ed36fb1a1ce8e8f028c192b647da0fdba1af00de71789861e970f113c3307091c1bafec8629fb10cb3008182028153f5441" +
    "0d173439040c10140103040564ac8de9df7c5b84769ac5b3798bf980dd7a538e3d47f4c9163a584e3f41fcc33759dceb6db7a9c43848e0d8b9d6de677395d1a2e926836a355fd4e155ff491c7193d9a87b8df18a8c890a867296d5a788851a92f607ff09" +
    "2a7ea8823e42f8c65ee2653b27699cbb46ca05430c14303c65af89ec68b8bdd561a399f803050c0fc15e23e257f94116d6677fa9d976439a58e87d25d875479f66aa85e3d7647bac3a4ee8d2c84507cf3c44f0ccfa13cf3596a762f4a7f4a60198b55ac2" +
    "ec29977bb8d5da62c7543bfcaeef822c69bbb9d04bdd317aabe0963da9e69e3767a981e60a1e282247c90146f20bef1db5c2ee5b226688aae532b356ee2f9f71bedfc27c2b7dac87819e3ebf1236485a839836b51b2d6c770e12383623658caff502f306" +
    "45cf094c216384a5ce4f1fd149db39702c74b09cf916c33ae637bf59b6c7e2542878a08817395c4b829b32b01a2e68728b80169dfe1fdf218a831298091b242dc94603ca879426a14ed2256be13ea3422e72b896e431b753e03da747eb208b6090ad7aea" +
    "a4f1aa0e1e22786685922eab60a09dfd00000000256f94b1f401f703f10ee31294a16afe0b1d2c27e734bb5c759fc9bcef2c9b74345cd0e43153c4f5d46177a3d06d67b7869722a47e82e59badea8e23fd1ad32e297ba48d3050c0f03b4decd79fbc46d9" +
    "f815c73fc6573ff913354c5f060a181e050f1411c55233f6113344557799c1b67c84ed917a8ef58f7888fd85365ad8ee1c24706c394be4dd59eb79201828607856fa4513b3c8f645b0cdfa4a246c90b4206080a0b2cbf24092ab72e0a3f8b615c05d27e7" +
    "44cc0d4962a695f710304050b4c1ea5e84912aae43c5115293a876e5c25b2fed4ade357fbddace738f8c06892d77b499bcd9ca769cb94ad66abeb5df40c01d5dcf4c1bd4a2fbb210809d3aba4fd1216e1f217c63ca430fc5aae3923842c61557016ab9bb" +
    "b1669ae5cd1465e2511b8725a457a2f703bed6d004b5ded6fe8552b3ad4abafd63e009cf84961c091a4d91a54d37a73da35caaf1e117a47bf98e5ab5ac2003461184e6c4c268cc550da8c6dc99d085aaaa41b2fb9c0fe2c755ae59f320c1befee5a27aad" +
    "7fcc29d7e80abc713be696e09edb8dac2215d195ceaab33293734b70fd3b8463d052fc41e61cac7d947843760661b1bddaf1329b17e557795cb341f94b5616800cc27f67cc7edc59409f61e1e3c3cb10302fe1810e16100c5e672e92663f6ea253cfe84e" +
    "6c9ca078730e56b0349a3f573ced9ee68e35d2d38023c2df2ed7aef26e48cf13596c2694605edf1f9b04eac119f34775893edad5ffefeb08f2472dd4c7b7ab38b9113b54a236134af4269c6910ee5f7f8d8b04034fe3c856479469e7eaded31a98ba3c11" +
    "2d697822153138126afd11c5db9b8b20385840306b97a87e237f682e1c2c2018070b080621ab074527cab6f85f0d97297264ef0b29dca6f4b3b2f58e628ab074bda4e58285fca5b21ef84f73a895dd900877a1b1442abf37a53d1b4c8beab5beb66d92e3" +
    "4a3caf3b7c72ff07839d140f4321b7319fb13417f8e4e30ed6334dfcbaafed848728cad9f54c25d2cfc00a892474602826a00f4305df676d3a8c2f5b091d180a7d1846bcb87b82ef1899fece35f086ec9512facd32fb8eea2fbd17491f92f6c8a683cd9c" +
    "424b0e8ab4b9fd88dc908326c563c45352a551f5ef01b477be1a33520f7ca9b76f2276a86df619c302d46f6becbf62a776d131dd78c721d128b61f4f364e503cc8cb028fe4c8c3162c03c199ee6b0dcc81497b64b00c235e1d4699a3d13845faa0e27c21" +
    "7ea6906caef46c2d41f5d85a2a627024e96005caf1f9fb04c6dd1283e77615c650713e9ee2a972abc4097de8d58d9b2c8854636e251ed993d8255df06581b872a9ff642b46fed05c96ac2c1dc0bca33e91a7241b3f5348364540068cb2d84c35f7984ab9" +
    "9d655b7cca1f6de4864273629a6e537aab2b0b40d759f4475bb849ff5ad2f044bcce5c393d87275d00000000fb5a35def6f2f302edd5db1ccb75d45f3145583a8f5f6b6856108f23b7072b588ce1bdb897c695a6168feec20aa3cedab5d344336755d719" +
    "64eb01c9c9a1bb34df2e55f690cd9da0a188c59afa308c65d286932a68297eae79ad986a123a30141b27281e613466a477bb886658069f2f6943c7157b79f701756fe70d82f7adb454c4e048af9ed5969219f2cb48e8c050bf708ae93e39f18d3724e987" +
    "fc513dd8e07d1dc03932f98bd94fe44b4e8971ed7a134ebac1d61a853391375170b080602b08c99fbbc5543fd4e72297de44ec4d74055eb6ebb46aa1145b81a98a800c05c30275ee135089aff32d946f0bc97761ddfa3a9d577a3698498279eba7e97427" +
    "f09342bf5dd9f8424c5d1e8671da39dbd3ec2a916a01bbb966b1e59a14cde2651b51258757a4f7a2be03d0d6b504d6de85feb3524aadfdbae063cf099684091c4d1aa591374d3da75ca3f1aa17e17ba48ef9b55a20ac46038411c4e668c255cca80ddcc6" +
    "d099aa8541aafbb20f9cc7e2ae55f359c120febea2e5ad7acc7fd7290ae871bce63be096db9eac8d152295d1aace32b37393704b3bfd638452d041fc1ce67dac789476436106bdb1f1da9b32e5177957b35cf941564b8016c20c677f7ecc59dc9f40e161" +
    "c3e310cb2f3081e1160e0c10675e922e3f66a26ecf534ee89c6c78a00e73b0569a34573fed3ce69e358ed3d22380dfc2d72ef2ae486e13cf6c5994265e601fdf049bc1eaf31975473e89d5daefff08eb47f2d42db7c738ab11b9543b36a24a1326f4699c" +
    "ee107f5f8b8d0304e34f56c89447e769deea1ad3ba98113c692d227831151238fd6ac5119bdb208b58383040976b7ea87f232e682c1c18200b070608ab214507ca27f8b60d5f299764720befdc29f4a6b2b38ef58a6274b0a4bd82e5fc85b2a5f81e734f" +
    "95a890dd7708b1a12a4437bf3da54c1bea8bbeb56db6e3923c4a3baf727c07ff9d830f14214331b7b19f1734e4f80ee333d6fc4dafba84ed2887d9ca4cf5d225c0cf890a74242860a026430fdf056d678c3a5b2f1d090a18187dbc467bb8ef829918cefe" +
    "f035ec861295cdfafb32ea8ebd2f4917921fc8f683a69ccd4b428a0eb9b488fd90dc268363c553c4a552f55101ef77b41abe52337c0fb7a9226fa876f66dc319d4026b6fbfeca762d176dd31c778d121b6284f1f4e363c50cbc88f02c8e416c3032c99c1" +
    "6beecc0d4981647b0cb05e23461da39938d1fa45e2a0217ca67e6c90f4ae2d6cf5415ad8622a247060e9ca05f9f104fbddc6831276e7c61571509e3ea9e2ab7209c4e87d8dd52c9b54886e631e2593d925d8f05d816572b8ffa92b64fe465cd0ac961d2c" +
    "bcc03ea3a7911b24533f364840458c06d8b2354c98f7b94a659d7c5b1fcae46d428662736e9a7a532bab400b59d747f4b85bff49d25a44f0cebc395c873d5d27000000005afbde35f2f602f3d5ed1cdb75cb5fd445313a585f8f686b1056238f07b7582b" +
    "e18cb8bdc697a6958f16c2eea30adaced3b53344556719d7eb64c901a1c934bb2edff655cd90a09d88a19ac530fa658c86d22a932968ae7ead796a983a121430271b1e283461a466bb77668806582f9f436915c7797b01f76f750de7f782b4adc45448e0" +
    "9eaf96d51992cbf2e84850c070bfe98a393e8df1243787e951fcd83d7de0c01d32398bf94fd94be4894eed71137aba4ed6c1851a91335137b0706080082b9fc9c5bb3f54e7d4972244de4dec0574b65eb4eba16a5b14a981808a050c02c3ee755013af89" +
    "2df36f94c90b6177fadd9d3a7a5798368249eb79e9a7277493f0bf42d95d42f85d4c861eda71db39ecd3912ab9bb016a9ae5b16665e2cd148725511ba2f7a457d6d003beded604b552b3fe85bafdad4a09cf63e01c09849691a51a4da73d4d37aaf1a35c" +
    "a47be1175ab5f98e0346ac20e6c41184cc55c268c6dc0da885aa99d0b2fbaa41e2c79c0f59f355aebefe20c17aade5a229d77fccbc71e80a96e03be68dac9edbd1952215b332ceaa4b7093738463fd3bfc41d052ac7de61c43769478b1bd0661329bdaf1" +
    "577917e541f95cb316804b567f670cc2dc59cc7e61e1409fcb10e3c3e181302f100c0e162e925e676ea2663fe84e53cfa0786c9c56b0730e3f57349a9ee63cedd2d38e35c2df8023aef22ed7cf136e482694596cdf1f605eeac19b04477519f3dad5893e" +
    "eb08ffef2dd4f247ab38c7b73b54b911134aa2369c69f4265f7f10ee04038d8bc8564fe369e74794d31aeade3c1198ba78222d693812153111c56afd8b20db9b40303858a87e6b97682e237f20181c2c0806070b074521abb6f827ca97295f0def0b7264" +
    "a6f429dcf58eb3b2b074628ae582bda4a5b285fc4f731ef8dd90a895a1b10877bf37442a1b4ca53db5be8bea92e3b66daf3b4a3cff077c72140f839db731432134179fb1e30ef8e44dfcd633ed84baafcad9872825d2f54c0a89cfc0602824740f4326a0" +
    "676d05df2f5b3a8c180a091d46bc7d1882efb87bfece189986ec35f0facd95128eea32fb17492fbdf6c81f92cd9ca6830e8a424bfd88b4b98326dc90c453c56351f552a5b477ef013352be1aa9b70f7c76a86f2219c36df66f6b02d462a7ecbf31dd76d1" +
    "21d178c71f4f28b6503c364e028fc8cbc316e4c8c1992c030dccee6b7b648149235eb00c99a31d4645fad1387c21a0e2906c7ea66c2daef4d85a41f570242a6205cae960fb04f1f91283c6dd15c6e7763e9e507172abe2a97de8c4099b2cd58d636e8854" +
    "d993251e5df0d825b8726581642ba9ffd05c46fe2c1d96aca33ec0bc241b91a748363f53068c45404c35b2d84ab9f7985b7c9d656de4ca1f73628642537a9a6e0b40ab2bf447d75949ff5bb8f0445ad25c39bcce275d3d870000000035defb5af302f6f2" +
    "db1cedd5d45fcb75583a31456b688f5f8f2356102b58b707bdb88ce195a697c6eec2168fceda0aa34433b5d3d719675501c964ebbb34c9a155f6df2e9da090cdc59aa1888c65fa30932ad2867eae6829986a79ad3014123a281e1b2766a46134886677bb" +
    "9f2f5806c7156943f7017b79e70d756fadb482f7e04854c4d596af9ef2cb9219c05048e88ae9bf70f18d3e39e98737243dd8fc511dc0e07df98b3932e44bd94f71ed4e894eba7a131a85c1d637513391806070b0c99f2b08543fbbc52297d4e7ec4dde44" +
    "5eb674056aa1ebb481a9145b0c058a8075eec30289af1350946ff32d77610bc93a9dddfa3698577a79eb49827427a7e942bff093f8425dd91e864c5d39db71da2a91d3ecbbb96a01e59a66b1e26514cd25871b51f7a257a4d0d6be03d6deb504b35285fe" +
    "fdba4aadcf09e063091c9684a5914d1a3da7374df1aa5ca37ba417e1b55a8ef9460320acc4e6841155cc68c2dcc6a80daa85d099fbb241aac7e20f9cf359ae55febec120ad7aa2e5d729cc7f71bc0ae8e096e63bac8ddb9e95d1152232b3aace704b7393" +
    "63843bfd41fc52d07dac1ce676437894bdb161069b32f1da7957e517f941b35c8016564b677fc20c59dc7ecce1619f4010cbc3e381e12f300c10160e922e675ea26e3f664ee8cf5378a09c6cb0560e73573f9a34e69eed3cd3d2358edfc22380f2aed72e" +
    "13cf486e94266c591fdf5e60c1ea049b7547f319d5da3e8908ebefffd42d47f238abb7c7543b11b94a1336a2699c26f47f5fee1003048b8d56c8e34fe76994471ad3deea113cba982278692d12383115c511fd6a208b9bdb304058387ea8976b2e687f23" +
    "18202c1c06080b074507ab21f8b6ca2729970d5f0bef6472f4a6dc298ef5b2b374b08a6282e5a4bdb2a5fc85734ff81e90dd95a8b1a1770837bf2a444c1b3da5beb5ea8be3926db63baf3c4a07ff727c0f149d8331b721431734b19f0ee3e4f8fc4d33d6" +
    "84edafbad9ca2887d2254cf5890ac0cf28607424430fa0266d67df055b2f8c3a0a181d09bc46187def827bb8cefe9918ec86f035cdfa1295ea8efb324917bd2fc8f6921f9ccd83a68a0e4b4288fdb9b4268390dc53c463c5f551a55277b401ef52331abe" +
    "b7a97c0fa876226fc319f66d6b6fd402a762bfecdd31d176d121c7784f1fb6283c504e368f02cbc816c3c8e499c1032ccc0d6bee647b49815e230cb0a399461dfa4538d1217ce2a06c90a67e2d6cf4ae5ad8f5412470622aca0560e904fbf9f18312ddc6" +
    "c61576e79e3e7150ab72a9e2e87d09c42c9b8dd56e63548893d91e25f05d25d872b881652b64ffa95cd0fe461d2cac963ea3bcc01b24a7913648533f8c064045354cd8b2b94a98f77c5b659de46d1fca627342867a536e9a400b2bab47f459d7ff49b85b" +
    "44f0d25a395ccebc5d27873d00000000de355afb02f3f2f61cdbd5ed5fd475cb3a584531686b5f8f238f1056582b07b7b8bde18ca695c697c2ee8f16dacea30a3344d3b519d75567c901eb6434bba1c9f6552edfa09dcd909ac588a1658c30fa2a9386d2" +
    "ae7e29686a98ad7914303a121e28271ba46634616688bb772f9f065815c7436901f7797b0de76f75b4adf78248e0c45496d59eafcbf2199250c0e848e98a70bf8df1393e87e92437d83d51fcc01d7de08bf932394be44fd9ed71894eba4e137a851ad6c1" +
    "513791336080b0709fc9082b3f54c5bb9722e7d44dec44deb65e0574a16ab4eba9815b14050c808aee7502c3af8950136f942df36177c90b9d3afadd98367a57eb7982492774e9a7bf4293f042f8d95d861e5d4cdb39da71912aecd3"
  );
  const FSBOX1 = OpCodes.Hex8ToBytes(
    "4e4b444c464d4f4a4243484140474549aeaba4aca6adafaaa2a3a8a1a0a7a5a99e9b949c969d9f9a92939891909795992e2b242c262d2f2a2223282120272529dedbd4dcd6dddfdad2d3d8d1d0d7d5d98e8b848c868d8f8a82838881808785890e0b040c" +
    "060d0f0a0203080100070509eeebe4ece6edefeae2e3e8e1e0e7e5e96e6b646c666d6f6a6263686160676569bebbb4bcb6bdbfbab2b3b8b1b0b7b5b91e1b141c161d1f1a1213181110171519cecbc4ccc6cdcfcac2c3c8c1c0c7c5c97e7b747c767d7f7a" +
    "7273787170777579fefbf4fcf6fdfffaf2f3f8f1f0f7f5f95e5b545c565d5f5a52535851505755593e3b343c363d3f3a3233383130373539"
  );
  const FSBOX2 = OpCodes.Hex8ToBytes(
    "575d5a515058595f5e54565c5b525553878d8a818088898f8e84868c8b828583171d1a111018191f1e14161c1b121513d7dddad1d0d8d9dfded4d6dcdbd2d5d3a7adaaa1a0a8a9afaea4a6acaba2a5a3373d3a313038393f3e34363c3b323533474d4a41" +
    "4048494f4e44464c4b424543272d2a212028292f2e24262c2b222523e7edeae1e0e8e9efeee4e6ecebe2e5e3f7fdfaf1f0f8f9fffef4f6fcfbf2f5f3c7cdcac1c0c8c9cfcec4c6cccbc2c5c3777d7a717078797f7e74767c7b727573676d6a616068696f" +
    "6e64666c6b626563070d0a010008090f0e04060c0b020503979d9a919098999f9e94969c9b929593b7bdbab1b0b8b9bfbeb4b6bcbbb2b5b3"
  );
  const FSBOX3 = OpCodes.Hex8ToBytes(
    "646b6a606762616d63666865696c6f6ec4cbcac0c7c2c1cdc3c6c8c5c9cccfce747b7a707772717d73767875797c7f7e141b1a101712111d13161815191c1f1e545b5a505752515d53565855595c5f5ef4fbfaf0f7f2f1fdf3f6f8f5f9fcfffed4dbdad0" +
    "d7d2d1ddd3d6d8d5d9dcdfde848b8a808782818d83868885898c8f8e444b4a404742414d43464845494c4f4ea4abaaa0a7a2a1ada3a6a8a5a9acafae949b9a909792919d93969895999c9f9ee4ebeae0e7e2e1ede3e6e8e5e9ecefee040b0a000702010d" +
    "03060805090c0f0e343b3a303732313d33363835393c3f3eb4bbbab0b7b2b1bdb3b6b8b5b9bcbfbe242b2a202722212d23262825292c2f2e"
  );
  const FSBOX4 = OpCodes.Hex8ToBytes(
    "d1dfddd0d5d7dad4d9d2d3ded6dbd8d2b1bfbdb0b5b7bab4b9b2b3beb6bbb8b2414f4d4045474a444942434e464b4842111f1d1015171a141912131e161b1812313f3d3035373a343932333e363b3832f1fffdf0f5f7faf4f9f2f3fef6fbf8f2515f5d50" +
    "55575a545952535e565b5852919f9d9095979a949992939e969b9892010f0d0005070a040902030e060b0802a1afada0a5a7aaa4a9a2a3aea6aba8a2e1efede0e5e7eae4e9e2e3eee6ebe8e2717f7d7075777a747972737e767b7872616f6d6065676a64" +
    "6962636e666b6862818f8d8085878a848982838e868b8882212f2d2025272a242922232e262b2822c1cfcdc0c5c7cac4c9c2c3cec6cbc8c2"
  );

  // Layout of the shared per-key working buffer `mem` (byte-addressable),
  // used as a flat address space by the routines below so their table/stack
  // offsets read naturally against fixed base addresses:
  //   0x900c  .. 0x910c             T1 (256 bytes)
  //   0x910c  .. 0xb10c             T2 (8192 bytes)
  //   0xb10c  .. 0xb50c             FSBOX1..FSBOX4 (256 bytes each)
  //   0xc000  .. 0xc100             the mutable 64-word round table
  //   0x10000 .. 0x20000            setup()'s own local stack frame (key buffer etc.)
  //   0x20000 .. 0x30000            func401070's local stack frame
  //   0x30000 .. 0x40000            func4018d0's local stack frame
  //   0x40000 .. 0x50000            crypt()/decrypt()'s local stack frame
  const MEM_SIZE = 0x60000;
  const STACK_SETUP = 0x10000;
  const STACK_401070 = 0x20000;
  const STACK_4018D0 = 0x30000;
  const STACK_CRYPT = 0x40000;

  function rd8(mem, addr) { return mem[addr]; }
  function wr8(mem, addr, v) { mem[addr] = OpCodes.And32(v, 0xFF); }
  function rd32(mem, addr) { return OpCodes.Pack32LE(mem[addr], mem[addr + 1], mem[addr + 2], mem[addr + 3]); }
  function wr32(mem, addr, v) {
    const b = OpCodes.Unpack32LE(v);
    mem[addr] = b[0]; mem[addr + 1] = b[1]; mem[addr + 2] = b[2]; mem[addr + 3] = b[3];
  }

  function divmod(edx, eax, divisor) {
    const dividend = (OpCodes.ShiftLn(BigInt(OpCodes.Shr32(edx, 0)), 32n)) | BigInt(OpCodes.Shr32(eax, 0));
    const d = BigInt(OpCodes.Shr32(divisor, 0));
    const q = dividend / d, r = dividend % d;
    return { q: OpCodes.Shr32(Number(OpCodes.AndN(q, 0xFFFFFFFFn)), 0), r: OpCodes.Shr32(Number(OpCodes.AndN(r, 0xFFFFFFFFn)), 0) };
  }

  function makeMem() {
    const mem = new Uint8Array(MEM_SIZE);
    mem.set(T1, 0x900c);
    mem.set(T2, 0x910c);
    mem.set(FSBOX1, 0xb10c);
    mem.set(FSBOX2, 0xb20c);
    mem.set(FSBOX3, 0xb30c);
    mem.set(FSBOX4, 0xb40c);
    return mem;
  }

  // F(x, n): byte-substitute each of the 4 bytes of x through FSBOX1..4, repack
  // big-endian (top byte's substitute -> top byte of result), rotate left n.
  function F(mem, eax, edx) {
    const b3 = OpCodes.And32((OpCodes.Shr32(eax, 24)), 0xFF), b2 = OpCodes.And32((OpCodes.Shr32(eax, 16)), 0xFF), b1 = OpCodes.And32((OpCodes.Shr32(eax, 8)), 0xFF), b0 = OpCodes.And32(eax, 0xFF);
    const combined = OpCodes.Pack32BE(rd8(mem, 0xb10c + b3), rd8(mem, 0xb20c + b2), rd8(mem, 0xb30c + b1), rd8(mem, 0xb40c + b0));
    return OpCodes.RotL32(combined, OpCodes.And32(edx, 0xFF));
  }

  // Table/key-schedule mixing routine. Walks the 64-word
  // round table in a 64(outer) x 16(middle) x 4(inner, step 8) nested loop, mixing
  // in the key (via `edxIn`, a pointer into the caller's key buffer) and a
  // running hash accumulator (`eaxIn`, carried across successive calls), ending
  // in a long fixed post-mix. Returns the updated hash accumulator.
  function func401070(mem, eaxIn, edxIn) {
    let eax = eaxIn, ebx = 0, ecx = 0, edx = edxIn, esi = 0, edi = 0, ebp = 0, esp = STACK_401070;
    function rd32L(a) { return rd32(mem, a); }
    function wr32L(a, v) { wr32(mem, a, v); }
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ecx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, esi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, edi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebp);
      esp = OpCodes.Shr32(((esp - 0x34)), 0);
      edi = OpCodes.Shr32((eax), 0);
      wr32L((OpCodes.Shr32(((esp)+0x10), 0)), edx);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, eax))), 0);
      wr32L((OpCodes.Shr32(((esp)+0xc), 0)), eax);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)+0x0), 0))), 0);
      edx = OpCodes.Shr32(((OpCodes.Shr32(((edx)+0x0), 0))), 0);

      do {
          edx = OpCodes.Shr32(((OpCodes.Xor32(edx, edx))), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0xc), 0)))), 0);
          wr32L((OpCodes.Shr32(((esp)+0x18), 0)), edx);
          wr32L((OpCodes.Shr32(((esp)+0x20), 0)), edx);
          eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
          edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
          edx = OpCodes.Shr32(((edx + eax)), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
          wr32L((OpCodes.Shr32(((esp)+0x2c), 0)), edx);
          wr32L((OpCodes.Shr32(((esp)+0x14), 0)), eax);
          eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)+0x0), 0))), 0);
          edx = OpCodes.Shr32(((OpCodes.Shr32(((edx)), 0))), 0);

        do {
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x18), 0)))), 0);
            eax = OpCodes.Shr32(((eax + 1)), 0);
            wr32L((OpCodes.Shr32(((esp)+0x1c), 0)), eax);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x14), 0)))), 0);
            wr32L((OpCodes.Shr32(((esp)+0x30), 0)), eax);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x20), 0)))), 0);
            eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
            esi = OpCodes.Shr32((eax), 0);
            eax = OpCodes.Shr32(((0 - eax)), 0);
            wr32L((OpCodes.Shr32(((esp)+0x28), 0)), 0xdeadbeef);
            eax = OpCodes.Shr32(((eax + 0xfc)), 0);
            ebx = OpCodes.Shr32(((OpCodes.Xor32(ebx, ebx))), 0);
            wr32L((OpCodes.Shr32(((esp)+0x24), 0)), eax);

          do {
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esi)+0xc000), 0)))), 0);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esi)+0xc000), 0)))), 0);
              eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
              edx = OpCodes.Shr32((OpCodes.Shr32(edx, 0x9)), 0);
              eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esi)+0xc000), 0)))), 0);
              edx = OpCodes.Shr32(((edx + eax)), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x30), 0)))), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(ebx, 0xFF))), 0xFF))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              ebp = OpCodes.Shr32((edi), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
              ebp = OpCodes.Shr32(((OpCodes.And32(ebp, 0x7))), 0);
              eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xff))), 0);
              ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0xa)), 0);
              wr32L((OpCodes.Shr32(((esp)+0x4), 0)), edx);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+(eax*4)+0x910c), 0)))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x2c), 0)))), 0);
              ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32(((OpCodes.Shr32(((edx)+(ecx)), 0))), 0);
              edx = OpCodes.Shr32((0xb), 0);
              eax = F(mem, eax, edx);
              eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x10)), 0);
              wr32L((OpCodes.Shr32(((esp)), 0)), eax);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x30), 0)))), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(ebx, 0xFF))), 0xFF))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
              ecx = OpCodes.Shr32((eax), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xff))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x2c), 0)))), 0);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+(ecx*4)+0x910c), 0)))), 0);
              ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32(((OpCodes.Shr32(((edx)+(ecx)), 0))), 0);
              edx = OpCodes.Shr32((0xb), 0);
              eax = F(mem, eax, edx);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)), 0)))), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
              edx = OpCodes.Shr32(((edx | eax)), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x30), 0)))), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(ebx, 0xFF))), 0xFF))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
              ecx = OpCodes.Shr32((eax), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xff))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x2c), 0)))), 0);
              wr32L((OpCodes.Shr32(((esp)+0x8), 0)), edx);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+(ecx*4)+0x910c), 0)))), 0);
              ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32(((OpCodes.Shr32(((edx)+(ecx)), 0))), 0);
              edx = OpCodes.Shr32((0xb), 0);
              eax = F(mem, eax, edx);
              eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
              wr32L((OpCodes.Shr32(((esp)), 0)), eax);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x30), 0)))), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(ebx, 0xFF))), 0xFF))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
              ecx = OpCodes.Shr32((eax), 0);
              ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xff))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x2c), 0)))), 0);
              edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+(ecx*4)+0x910c), 0)))), 0);
              ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
              eax = OpCodes.Shr32(((OpCodes.Shr32(((edx)+(ebp)), 0))), 0);
              edx = OpCodes.Shr32((0xb), 0);
              eax = F(mem, eax, edx);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
              eax = OpCodes.Shr32(((OpCodes.Xor32(eax, rd32L((OpCodes.Shr32(((esp)), 0)))))), 0);
              eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x8), 0))))), 0);
              edx = OpCodes.Shr32((0xb), 0);
              eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x4), 0))))), 0);
              eax = F(mem, eax, edx);
              wr32L((OpCodes.Shr32(((esi)+0xc000), 0)), eax);
              edx = OpCodes.Shr32((edi), 0);
              eax = OpCodes.Shr32((edi), 0);
              edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x6)), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
              eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
              ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x1c), 0)))), 0);
              edx = OpCodes.Shr32(((OpCodes.Shr32(((edi)+(eax)), 0))), 0);
              ecx = OpCodes.Shr32((Math.imul(ecx|0, edi|0)), 0);
              wr32L((OpCodes.Shr32(((esp)+0x8), 0)), edx);
              edx = OpCodes.Shr32((0xb), 0);
              eax = OpCodes.Shr32((ecx), 0);
              eax = F(mem, eax, edx);
              edx = OpCodes.Shr32((0xb), 0);
              ebp = OpCodes.Shr32((eax), 0);
              eax = OpCodes.Shr32((ecx), 0);
              ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x10)), 0);
              eax = F(mem, eax, edx);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
              edx = OpCodes.Shr32((0xb), 0);
              ebp = OpCodes.Shr32(((ebp | eax)), 0);
              eax = OpCodes.Shr32((ecx), 0);
              eax = F(mem, eax, edx);
              eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
              edx = OpCodes.Shr32((0xb), 0);
              wr32L((OpCodes.Shr32(((esp)+0x4), 0)), eax);
              eax = OpCodes.Shr32((ecx), 0);
              eax = F(mem, eax, edx);
              ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
              eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
              edx = OpCodes.Shr32(((OpCodes.Xor32(edx, edx))), 0);
              ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, eax))), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x24), 0)))), 0);
              ecx = OpCodes.Shr32(((ecx + ebp)), 0);
              ebp = OpCodes.Shr32((0xfffffffe), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)+0xc000), 0)))), 0);
              { const _q = divmod(edx, eax, ebp); eax = _q.q; edx = _q.r; }
              ecx = OpCodes.Shr32(((ecx + rd32L((OpCodes.Shr32(((esp)+0x28), 0))))), 0);
              ecx = OpCodes.Shr32(((ecx + rd32L((OpCodes.Shr32(((esi)+0xc000), 0))))), 0);
              ebp = OpCodes.Shr32(((OpCodes.Shr32(((edx)+0x1), 0))), 0);
              eax = OpCodes.Shr32((ecx), 0);
              edx = OpCodes.Shr32(((OpCodes.Xor32(edx, edx))), 0);
              { const _q = divmod(edx, eax, ebp); eax = _q.q; edx = _q.r; }
              wr32L((OpCodes.Shr32(((esp)+0x20), 0)), (rd32L((OpCodes.Shr32(((esp)+0x20), 0))) + 1));
              esi = OpCodes.Shr32(((esi + 0x4)), 0);
              ebx = OpCodes.Shr32(((ebx + 0x8)), 0);
              eax = OpCodes.Shr32((edx), 0);
              edx = OpCodes.Shr32((0xb), 0);
              eax = OpCodes.Shr32(((OpCodes.Xor32(eax, 0xfedababa))), 0);
              wr32L((OpCodes.Shr32(((esp)+0x24), 0)), (rd32L((OpCodes.Shr32(((esp)+0x24), 0))) - 0x4));
              eax = F(mem, eax, edx);
              eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x8), 0))))), 0);
              wr32L((OpCodes.Shr32(((esp)+0x28), 0)), (rd32L((OpCodes.Shr32(((esp)+0x28), 0))) - 0x21524111));
              edi = OpCodes.Shr32(((edi + eax)), 0);
              // (flags not needed - loop bound handled by wrapping JS loop)

          } while (ebx !== 0x20);
            ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x18), 0)))), 0);
            ebx = OpCodes.Shr32(((ebx + 1)), 0);
            wr32L((OpCodes.Shr32(((esp)+0x14), 0)), (rd32L((OpCodes.Shr32(((esp)+0x14), 0))) + 0x4));
            wr32L((OpCodes.Shr32(((esp)+0x18), 0)), ebx);
            // (flags not needed - loop bound handled by wrapping JS loop)

        } while (ebx !== 0x10);
          ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0xc), 0)))), 0);
          ebp = OpCodes.Shr32(((ebp + 1)), 0);
          wr32L((OpCodes.Shr32(((esp)+0xc), 0)), ebp);
          // (flags not needed - loop bound handled by wrapping JS loop)

      } while (ebp !== 0x40);
      edx = OpCodes.Shr32((0xb), 0);
      eax = OpCodes.Shr32((edi), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((ecx | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, ebx))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((ecx + eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32(((ebx | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      ebp = OpCodes.Shr32((esi), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, esi))), 0);
      ebx = OpCodes.Shr32(((ebx + eax)), 0);
      ecx = OpCodes.Shr32(((ecx - 0x21524111)), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((ebx)+0xdeadbeef), 0))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, eax))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x10)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((ebx), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32(((esi | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      ebx = OpCodes.Shr32((ebp), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebx)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, ebx))), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32(((eax - 0x21524111)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      eax = OpCodes.Shr32(((eax + edi)), 0);
      eax = F(mem, eax, edx);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32((eax), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32(((esi | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, eax))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      ecx = OpCodes.Shr32(((ecx + esi)), 0);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      esi = OpCodes.Shr32((ebp), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((ebp | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esi)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      esi = OpCodes.Shr32(((OpCodes.Xor32(esi, eax))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((esi)+(ebp)), 0))), 0);
      ecx = OpCodes.Shr32(((ecx - 0x21524111)), 0);
      eax = OpCodes.Shr32(((eax - 0x21524111)), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, eax))), 0);
      eax = OpCodes.Shr32((edi), 0);
      ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((ebp | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      esi = OpCodes.Shr32(((OpCodes.Xor32(esi, eax))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((esi)+(ebp)+0xdeadbeef), 0))), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      eax = OpCodes.Shr32(((eax + edi)), 0);
      ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x10)), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebx = OpCodes.Shr32(((ebx | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((ebp | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      esi = OpCodes.Shr32((ecx), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, ecx))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((ebp + eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      ecx = OpCodes.Shr32((esi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((ecx | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, esi))), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      ebp = OpCodes.Shr32(((ebp - 0x21524111)), 0);
      eax = OpCodes.Shr32(((eax - 0x21524111)), 0);
      ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((OpCodes.Xor32(ebp, eax))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32(((esi | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, eax))), 0);
      ecx = OpCodes.Shr32(((ecx + esi)), 0);
      ecx = OpCodes.Shr32(((ecx - 0x21524111)), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((ecx)+(ebp)), 0))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      eax = OpCodes.Shr32(((eax + edi)), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      wr32L((OpCodes.Shr32(((esp)+0x8), 0)), eax);
      eax = OpCodes.Shr32((edi), 0);
      ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((ebp | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      esi = OpCodes.Shr32((ecx), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, ecx))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((ebp + eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      esi = OpCodes.Shr32((OpCodes.Shr32(esi, 0x10)), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      esi = OpCodes.Shr32(((esi | ecx)), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      ebp = OpCodes.Shr32(((ebp - 0x21524111)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, ecx))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32(((esi + eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      ebp = OpCodes.Shr32((OpCodes.Shl32(ebp, 0x6)), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      esi = OpCodes.Shr32(((esi - 0x21524111)), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      esi = OpCodes.Shr32((OpCodes.Shr32(esi, 0x9)), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      ebp = OpCodes.Shr32(((OpCodes.Xor32(ebp, esi))), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x10), 0)))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + esi)), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x10)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      ecx = OpCodes.Shr32(((ecx | eax)), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      edx = OpCodes.Shr32((0xb), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esi)+(eax*4)), 0)))), 0);
      eax = OpCodes.Shr32((edi), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32(((OpCodes.And32(eax, 0xf))), 0);
      eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
      eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)+0x10), 0))))), 0);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)), 0)))), 0);
      esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x6)), 0);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, esi))), 0);
      eax = OpCodes.Shr32(((eax + ecx)), 0);
      eax = OpCodes.Shr32(((eax - 0x21524111)), 0);
      eax = OpCodes.Shr32(((eax + ebp)), 0);
      edx = OpCodes.Shr32((0xb), 0);
      eax = OpCodes.Shr32(((eax + edi)), 0);
      eax = F(mem, eax, edx);
      eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, rd32L((OpCodes.Shr32(((esp)+0x8), 0)))))), 0);
      eax = OpCodes.Shr32(((eax + ebx)), 0);
      esp = OpCodes.Shr32(((esp + 0x34)), 0);
      ebp = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      edi = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      esi = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      ecx = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      ebx = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);

    return eax;
  }

  // Key-buffer permutation routine. Operates on a
  // 256-byte scratch window (this function's own local stack), keyed by the
  // 64-byte buffer pointed to by `eaxIn`, over 1024 iterations; folds its
  // final state back into the round table (0xc000..0xc100) via F(., 11).
  function func4018d0(mem, eaxIn) {
    let eax = eaxIn, ebx = 0, ecx = 0, edx = 0, esi = 0, edi = 0, ebp = 0, esp = STACK_4018D0;
    function rd32L(a) { return rd32(mem, a); }
    function wr32L(a, v) { wr32(mem, a, v); }
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ecx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, edx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, esi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, edi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebp);
      esp = OpCodes.Shr32(((esp - 0x10)), 0);
      wr32L((OpCodes.Shr32(((esp)+0xc), 0)), eax);
      ebx = OpCodes.Shr32((0x1), 0);
      edi = OpCodes.Shr32(((OpCodes.Xor32(edi, edi))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)+0x0), 0))), 0);
      edx = OpCodes.Shr32(((OpCodes.Shr32(((edx)+0x0), 0))), 0);

      do {
          eax = OpCodes.Shr32((edi), 0);
          eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x3f))), 0);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x2)), 0);
          edx = OpCodes.Shr32((0xb), 0);
          wr32L((OpCodes.Shr32(((esp)+0x4), 0)), eax);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)+0xc000), 0)))), 0);
          eax = F(mem, eax, edx);
          ecx = OpCodes.Shr32((eax), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)+0xc000), 0)))), 0);
          ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x10)), 0);
          eax = F(mem, eax, edx);
          eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
          ecx = OpCodes.Shr32(((ecx | eax)), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)+0xc000), 0)))), 0);
          eax = F(mem, eax, edx);
          esi = OpCodes.Shr32((eax), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax)+0xc000), 0)))), 0);
          esi = OpCodes.Shr32((OpCodes.Shl32(esi, 0x6)), 0);
          eax = F(mem, eax, edx);
          eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, esi))), 0);
          ebp = OpCodes.Shr32((ebx), 0);
          ecx = OpCodes.Shr32(((ecx + eax)), 0);
          esi = OpCodes.Shr32(((OpCodes.Shr32(((ebx)+0x1), 0))), 0);
          wr32L((OpCodes.Shr32(((esp)+0x8), 0)), ecx);
          ecx = OpCodes.Shr32((esi), 0);
          ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0x3f))), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx*4)+0xc000), 0)))), 0);
          eax = F(mem, eax, edx);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x10)), 0);
          edx = OpCodes.Shr32((0xb), 0);
          wr32L((OpCodes.Shr32(((esp)+0x4), 0)), eax);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx*4)+0xc000), 0)))), 0);
          eax = F(mem, eax, edx);
          edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
          eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
          edx = OpCodes.Shr32(((edx | eax)), 0);
          wr32L((OpCodes.Shr32(((esp)), 0)), edx);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx*4)+0xc000), 0)))), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = F(mem, eax, edx);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
          edx = OpCodes.Shr32((0xb), 0);
          wr32L((OpCodes.Shr32(((esp)+0x4), 0)), eax);
          eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx*4)+0xc000), 0)))), 0);
          ebp = OpCodes.Shr32(((OpCodes.And32(ebp, 0x3f))), 0);
          eax = F(mem, eax, edx);
          eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
          ebx = OpCodes.Shr32(((OpCodes.And32(ebx, 0xf))), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, rd32L((OpCodes.Shr32(((esp)+0x4), 0)))))), 0);
          ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x2)), 0);
          eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((esp)), 0))))), 0);
          ebx = OpCodes.Shr32(((ebx + rd32L((OpCodes.Shr32(((esp)+0xc), 0))))), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, rd32L((OpCodes.Shr32(((esp)+0x8), 0)))))), 0);
          ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32((0xb), 0xFF))), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, rd32L((OpCodes.Shr32(((ebx)), 0)))))), 0);
          edx = OpCodes.Shr32((0x8), 0);
          eax = OpCodes.Shr32((OpCodes.RotL32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
          eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((ebp*4)+0xc000), 0))))), 0);
          eax = F(mem, eax, edx);
          wr32L((OpCodes.Shr32(((ebp*4)+0xc000), 0)), eax);
          ebx = OpCodes.Shr32((esi), 0);
          edi = OpCodes.Shr32(((edi + 1)), 0);

      } while (esi !== 0x401);

  }

  function setup(mem, keyBytes64) {
    let eax = 0, ebx = 0, ecx = 0, edx = 0, esi = 0, edi = 0, ebp = 0, esp = STACK_SETUP;
    function rd32L(a) { return rd32(mem, a); }
    function wr32L(a, v) { wr32(mem, a, v); }
    const KEYSRC = 0x50000;
    for (let i = 0; i < 64; i++) wr8(mem, KEYSRC + i, keyBytes64[i]);
    wr32L(esp + 4, KEYSRC); // pass the key-pointer argument on the working stack
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, esi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, edi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebp);
      esp = OpCodes.Shr32(((esp - 0x40)), 0);
      edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x54), 0)))), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, eax))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)), 0))), 0);

      do {
          eax = OpCodes.Shr32(((eax + 1)), 0);
          ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((edx)), 0)))), 0);
          edx = OpCodes.Shr32(((edx + 0x4)), 0);
          wr32L((OpCodes.Shr32(((esp)+(eax*4)-0x4), 0)), ecx);
          // (flags not needed - loop bound handled by wrapping JS loop)

      } while (eax !== 0x10);
      edx = OpCodes.Shr32(((OpCodes.Xor32(edx, edx))), 0);
      eax = OpCodes.Shr32(((OpCodes.Xor32(eax, eax))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)+0x0), 0))), 0);
      edx = OpCodes.Shr32(((OpCodes.Shr32(((edx)+0x0), 0))), 0);

      do {
          wr32L((OpCodes.Shr32(((edx)+0xc000), 0)), eax);
          eax = OpCodes.Shr32(((eax + 1)), 0);
          edx = OpCodes.Shr32(((edx + 0x4)), 0);
          // (flags not needed - loop bound handled by wrapping JS loop)

      } while (eax !== 0x40);
      esi = OpCodes.Shr32(((OpCodes.Xor32(esi, esi))), 0);
      edi = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32((0xff), 0);

      do {
          ebx = OpCodes.Shr32((esi), 0);
          ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, ecx))), 0);

        do {
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx)+0xc000), 0)))), 0);
            eax = OpCodes.Shr32(((OpCodes.And32(eax, ebp))), 0);
            eax = OpCodes.Shr32((rd8(mem, (OpCodes.Shr32(((eax)+0x900c), 0)))), 0);
            edx = OpCodes.Shr32((edi), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebx)+(eax*4)+0x910c), 0)))), 0);
            ecx = OpCodes.Shr32(((ecx + 0x4)), 0);
            eax = F(mem, eax, edx);
            wr32L((OpCodes.Shr32(((ecx)+0xbffc), 0)), eax);

        } while (ecx !== 0x100);
          esi = OpCodes.Shr32(((esi + 0x400)), 0);
          // (flags not needed - loop bound handled by wrapping JS loop)

      } while (esi !== 0x2000);
      esi = OpCodes.Shr32((0xdeadbeef), 0);
      ebx = OpCodes.Shr32(((OpCodes.Xor32(ebx, ebx))), 0);
      edi = OpCodes.Shr32((0xb), 0);
      ebp = OpCodes.Shr32(((OpCodes.Xor32(ebp, ebp))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)+0x0), 0))), 0);

      // Phase 1: 10 rounds, each calling func401070 to build both the round
      // S-box table and a running hash seed; rounds 0-8 also fold the key buffer
      // through func4018d0 and an F()-based transform (round 0 skips the initial
      // pre-transform; round 9 skips everything but the func401070 call).
      for (let round = 0; round < 10; round++) {
          edx = OpCodes.Shr32((esp), 0);
          eax = OpCodes.Shr32((esi), 0);
          eax = func401070(mem, eax, edx);
          esi = OpCodes.Shr32((eax), 0);

        if (round !== 9) {
          if (round !== 0) { ecx = 0; do {
              edx = OpCodes.Shr32((edi), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
              ecx = OpCodes.Shr32(((ecx + 0x4)), 0);
              eax = F(mem, eax, edx);
              wr32L((OpCodes.Shr32(((esp)+(ecx)-0x4), 0)), eax);

          } while (ecx !== 0x40); }
          eax = esp; func4018d0(mem, eax);
          ecx = 0; do {
              edx = OpCodes.Shr32((edi), 0);
              eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
              ecx = OpCodes.Shr32(((ecx + 0x4)), 0);
              eax = F(mem, eax, edx);
              wr32L((OpCodes.Shr32(((esp)+(ecx)-0x4), 0)), eax);

          } while (ecx !== 0x40);
        }
      }
      // Phase 2: 10 more iterations, each folding the key buffer through TWO
      // spread+rotate F()-transforms (sandwiching a func4018d0 call) before
      // calling func401070 again; the final key-buffer state becomes K[0..31].
      ebp = 0x0B;
      for (let j = 0; j < 10; j++) {
        ecx = 0; do {
            edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x10)), 0);
            eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
            ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            edx = OpCodes.Shr32(((edx | eax)), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            ebx = OpCodes.Shr32((OpCodes.Shr32(ebx, 0x9)), 0);
            eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
            eax = OpCodes.Shr32(((OpCodes.Xor32(eax, ebx))), 0);
            eax = OpCodes.Shr32(((eax + edx)), 0);
            edx = OpCodes.Shr32((ebp), 0);
            ecx = OpCodes.Shr32(((ecx + 0x4)), 0);
            eax = F(mem, eax, edx);
            wr32L((OpCodes.Shr32(((esp)+(ecx)-0x4), 0)), eax);
            // (flags not needed - loop bound handled by wrapping JS loop)

        } while (ecx !== 0x40);
        eax = esp; func4018d0(mem, eax);
        ecx = 0; do {
            ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            ebx = OpCodes.Shr32((OpCodes.Shl32(ebx, 0x10)), 0);
            eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x10)), 0);
            edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            ebx = OpCodes.Shr32(((ebx | eax)), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+(ecx)), 0)))), 0);
            edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x6)), 0);
            eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
            eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
            edx = OpCodes.Shr32((ebp), 0);
            eax = OpCodes.Shr32(((eax + ebx)), 0);
            ecx = OpCodes.Shr32(((ecx + 0x4)), 0);
            eax = F(mem, eax, edx);
            wr32L((OpCodes.Shr32(((esp)+(ecx)-0x4), 0)), eax);
            // (flags not needed - loop bound handled by wrapping JS loop)

        } while (ecx !== 0x40);
          edx = OpCodes.Shr32((esp), 0);
          eax = OpCodes.Shr32((esi), 0);
          eax = func401070(mem, eax, edx);
          edi = OpCodes.Shr32(((edi + 1)), 0);
          esi = OpCodes.Shr32((eax), 0);

      }

  }

  function crypt(mem, blockPtr) {
    let eax = 0, ebx = 0, ecx = 0, edx = 0, esi = 0, edi = 0, ebp = 0, esp = STACK_CRYPT;
    function rd32L(a) { return rd32(mem, a); }
    function wr32L(a, v) { wr32(mem, a, v); }
    wr32L(esp + 4, blockPtr);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, esi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, edi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebp);
      esp = OpCodes.Shr32(((esp - 0x10)), 0);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x24), 0)))), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x24), 0)))), 0);
      edi = OpCodes.Shr32(((OpCodes.Xor32(edi, edi))), 0);
      ebp = OpCodes.Shr32((0x80), 0);
      wr32L((OpCodes.Shr32(((esp)+0xc), 0)), edi);
      ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ecx)+0x4), 0)))), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebx)), 0)))), 0);

      do {
          edx = OpCodes.Shr32((ebx), 0);
          esi = OpCodes.Shr32((ebx), 0);
          edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x6)), 0);
          esi = OpCodes.Shr32((OpCodes.Shr32(esi, 0x9)), 0);
          eax = OpCodes.Shr32((ebx), 0);
          esi = OpCodes.Shr32(((OpCodes.Xor32(esi, edx))), 0);
          edx = OpCodes.Shr32(((OpCodes.Shr32(((ebx)+(esi)), 0))), 0);
          esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0xc), 0)))), 0);
          edx = OpCodes.Shr32(((edx + rd32L((OpCodes.Shr32(((esi)+0xc000), 0))))), 0);
          esi = OpCodes.Shr32((edx), 0);
          eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x1f))), 0);
          esi = OpCodes.Shr32(((OpCodes.Xor32(esi, ecx))), 0);
          ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(eax, 0xFF))), 0xFF))), 0);
          eax = OpCodes.Shr32((esi), 0);
          eax = OpCodes.Shr32((OpCodes.RotL32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
          esi = OpCodes.Shr32((eax), 0);
          ecx = OpCodes.Shr32((eax), 0);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
          wr32L((OpCodes.Shr32(((esp)), 0)), eax);
          eax = OpCodes.Shr32((esi), 0);
          eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, rd32L((OpCodes.Shr32(((esp)), 0)))))), 0);
          edx = OpCodes.Shr32(((OpCodes.Shr32(((esi)+(eax)), 0))), 0);
          wr32L((OpCodes.Shr32(((esp)+0x8), 0)), edx);
          eax = OpCodes.Shr32((edx), 0);
          edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0xc), 0)))), 0);
          eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((edx)+0xc004), 0))))), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = F(mem, eax, edx);
          ebx = OpCodes.Shr32(((OpCodes.Xor32(ebx, eax))), 0);

          eax = OpCodes.Shr32((edi), 0);
          eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x1))), 0);
          wr32L((OpCodes.Shr32(((esp)+0x4), 0)), eax);
          eax = OpCodes.Shr32((esi), 0);
          edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
          eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x1f))), 0);
          // (flags not needed - loop bound handled by wrapping JS loop)

        if (edx === 1) {
            edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x8), 0)))), 0);
            ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax*4)+0xc000), 0)))), 0);
            ecx = OpCodes.Shr32(((ecx + edx)), 0);
            ebx = OpCodes.Shr32(((ebx + ecx)), 0);
            ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(eax, 0xFF))), 0xFF))), 0);
            eax = OpCodes.Shr32((ebx), 0);
            eax = OpCodes.Shr32((OpCodes.RotL32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
            ecx = OpCodes.Shr32((eax), 0);
            edx = OpCodes.Shr32((eax), 0);
            ecx = OpCodes.Shr32((OpCodes.Shl32(ecx, 0x6)), 0);
            edx = OpCodes.Shr32((OpCodes.Shr32(edx, 0x9)), 0);
            ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, edx))), 0);
            ebx = OpCodes.Shr32((eax), 0);
            ecx = OpCodes.Shr32(((ecx + eax)), 0);
            eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x1f))), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax*4)+0xc000), 0)))), 0);
            edx = OpCodes.Shr32((0xb), 0);
            eax = OpCodes.Shr32(((eax + ecx)), 0);

        } else {
            ecx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x8), 0)))), 0);
            ecx = OpCodes.Shr32(((ecx + rd32L((OpCodes.Shr32(((ebp)+0xc000), 0))))), 0);
            ebx = OpCodes.Shr32(((ebx + ecx)), 0);
            ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0xFFFFFF00))|(OpCodes.And32(((OpCodes.And32(eax, 0xFF))), 0xFF))), 0);
            eax = OpCodes.Shr32((ebx), 0);
            eax = OpCodes.Shr32((OpCodes.RotL32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
            edx = OpCodes.Shr32((eax), 0);
            ecx = OpCodes.Shr32((eax), 0);
            edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x6)), 0);
            ecx = OpCodes.Shr32((OpCodes.Shr32(ecx, 0x9)), 0);
            ebx = OpCodes.Shr32((eax), 0);
            ecx = OpCodes.Shr32(((OpCodes.Xor32(ecx, edx))), 0);
            eax = OpCodes.Shr32(((eax + ecx)), 0);
            edx = OpCodes.Shr32((0xb), 0);
            eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((ebp)+0xc004), 0))))), 0);
            ebp = OpCodes.Shr32(((ebp + 0x8)), 0);

        }
          eax = F(mem, eax, edx);
          ecx = OpCodes.Shr32(((OpCodes.Shr32(((esi)+(eax)), 0))), 0);

          wr32L((OpCodes.Shr32(((esp)+0xc), 0)), (rd32L((OpCodes.Shr32(((esp)+0xc), 0))) + 0x4));
          eax = OpCodes.Shr32((ebx), 0);
          edi = OpCodes.Shr32(((edi + 1)), 0);
          ebx = OpCodes.Shr32((ecx), 0);
          ecx = OpCodes.Shr32((eax), 0);
          // (flags not needed - loop bound handled by wrapping JS loop)

      } while (edi !== 0x1F);
      edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x24), 0)))), 0);
      wr32L((OpCodes.Shr32(((edx)+0x4), 0)), eax);
      wr32L((OpCodes.Shr32(((edx)), 0)), ebx);
      esp = OpCodes.Shr32(((esp + 0x10)), 0);
      ebp = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      edi = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      esi = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      ebx = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);


  }

  function decrypt(mem, blockPtr) {
    let eax = 0, ebx = 0, ecx = 0, edx = 0, esi = 0, edi = 0, ebp = 0, esp = STACK_CRYPT;
    function rd32L(a) { return rd32(mem, a); }
    function wr32L(a, v) { wr32(mem, a, v); }
    wr32L(esp + 4, blockPtr);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebx);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, esi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, edi);
      esp = OpCodes.Shr32((esp - 4), 0); wr32L(esp, ebp);
      esp = OpCodes.Shr32(((esp - 0xc)), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x20), 0)))), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x20), 0)))), 0);
      edi = OpCodes.Shr32((0x1e), 0);
      wr32L((OpCodes.Shr32(((esp)+0x8), 0)), 0x100);
      ebp = OpCodes.Shr32((0x78), 0);
      ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebx)+0x4), 0)))), 0);
      esi = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esi)), 0)))), 0);
      eax = OpCodes.Shr32(((OpCodes.Shr32(((eax)+0x0), 0))), 0);
      edx = OpCodes.Shr32(((OpCodes.Shr32(((edx)), 0))), 0);

      do {
          ecx = OpCodes.Shr32((esi), 0);
          esi = OpCodes.Shr32((ebx), 0);
          edx = OpCodes.Shr32((esi), 0);
          edx = OpCodes.Shr32((OpCodes.Shr32(edx, 0x9)), 0);
          wr32L((OpCodes.Shr32(((esp)), 0)), edx);
          edx = OpCodes.Shr32((esi), 0);
          edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x6)), 0);
          eax = OpCodes.Shr32((edi), 0);
          edx = OpCodes.Shr32(((OpCodes.Xor32(edx, rd32L((OpCodes.Shr32(((esp)), 0)))))), 0);
          eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x1))), 0);
          edx = OpCodes.Shr32(((edx + esi)), 0);
          ebx = OpCodes.Shr32((ecx), 0);
          wr32L((OpCodes.Shr32(((esp)+0x4), 0)), edx);

        if (eax === 1) {
            eax = OpCodes.Shr32((esi), 0);
            eax = OpCodes.Shr32(((OpCodes.And32(eax, 0x1f))), 0);
            ebx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((eax*4)+0xc000), 0)))), 0);
            eax = OpCodes.Shr32(((OpCodes.Shr32(((edx)+(ebx)), 0))), 0);
            edx = OpCodes.Shr32((0xb), 0);
            ebx = OpCodes.Shr32((ecx), 0);
            eax = F(mem, eax, edx);
            ebx = OpCodes.Shr32(((ebx - eax)), 0);
            eax = OpCodes.Shr32((ebx), 0);
            edx = OpCodes.Shr32((ebx), 0);
            eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
            edx = OpCodes.Shr32((OpCodes.Shr32(edx, 0x9)), 0);
            eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
            edx = OpCodes.Shr32(((OpCodes.Shr32(((ebx)+(eax)), 0))), 0);
            ecx = OpCodes.Shr32((ebx), 0);
            ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0x1f))), 0);
            eax = OpCodes.Shr32((esi), 0);
            edx = OpCodes.Shr32(((edx + rd32L((OpCodes.Shr32(((ecx*4)+0xc000), 0))))), 0);
            eax = OpCodes.Shr32((OpCodes.RotR32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);

        } else {
            edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x8), 0)))), 0);
            edx = OpCodes.Shr32(((edx - 0x8)), 0);
            eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x4), 0)))), 0);
            eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((edx)+0xc004), 0))))), 0);
            wr32L((OpCodes.Shr32(((esp)+0x8), 0)), edx);
            edx = OpCodes.Shr32((0xb), 0);
            eax = F(mem, eax, edx);
            ebx = OpCodes.Shr32(((ebx - eax)), 0);
            edx = OpCodes.Shr32((ebx), 0);
            eax = OpCodes.Shr32((ebx), 0);
            edx = OpCodes.Shr32((OpCodes.Shl32(edx, 0x6)), 0);
            eax = OpCodes.Shr32((OpCodes.Shr32(eax, 0x9)), 0);
            eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
            edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x8), 0)))), 0);
            ecx = OpCodes.Shr32((ebx), 0);
            eax = OpCodes.Shr32(((eax + ebx)), 0);
            edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((edx)+0xc000), 0)))), 0);
            ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0x1f))), 0);
            edx = OpCodes.Shr32(((edx + eax)), 0);
            eax = OpCodes.Shr32((esi), 0);
            eax = OpCodes.Shr32((OpCodes.RotR32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);

        }
          esi = OpCodes.Shr32((eax), 0);
          esi = OpCodes.Shr32(((esi - edx)), 0);
          eax = OpCodes.Shr32((ebx), 0);
          edx = OpCodes.Shr32((ebx), 0);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
          edx = OpCodes.Shr32((OpCodes.Shr32(edx, 0x9)), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
          eax = OpCodes.Shr32(((eax + ebx)), 0);
          edx = OpCodes.Shr32((0xb), 0);
          eax = OpCodes.Shr32(((eax + rd32L((OpCodes.Shr32(((ebp)+0xc004), 0))))), 0);
          eax = F(mem, eax, edx);
          esi = OpCodes.Shr32(((OpCodes.Xor32(esi, eax))), 0);
          eax = OpCodes.Shr32((esi), 0);
          edx = OpCodes.Shr32((esi), 0);
          eax = OpCodes.Shr32((OpCodes.Shl32(eax, 0x6)), 0);
          edx = OpCodes.Shr32((OpCodes.Shr32(edx, 0x9)), 0);
          ecx = OpCodes.Shr32((esi), 0);
          eax = OpCodes.Shr32(((OpCodes.Xor32(eax, edx))), 0);
          edx = OpCodes.Shr32((rd32L((OpCodes.Shr32(((ebp)+0xc000), 0)))), 0);
          eax = OpCodes.Shr32(((eax + esi)), 0);
          ecx = OpCodes.Shr32(((OpCodes.And32(ecx, 0x1f))), 0);
          edx = OpCodes.Shr32(((edx + eax)), 0);
          eax = OpCodes.Shr32((ebx), 0);
          ebp = OpCodes.Shr32(((ebp - 0x4)), 0);
          eax = OpCodes.Shr32((OpCodes.RotR32(eax, (OpCodes.And32(ecx, 0xFF)))), 0);
          ebx = OpCodes.Shr32((eax), 0);
          edi = OpCodes.Shr32(((edi - 1)), 0);
          ebx = OpCodes.Shr32(((OpCodes.Xor32(ebx, edx))), 0);

      } while (edi !== 0xFFFFFFFF);
      eax = OpCodes.Shr32((rd32L((OpCodes.Shr32(((esp)+0x20), 0)))), 0);
      wr32L((OpCodes.Shr32(((eax)+0x4), 0)), ebx);
      wr32L((OpCodes.Shr32(((eax)), 0)), esi);
      esp = OpCodes.Shr32(((esp + 0xc)), 0);
      ebp = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      edi = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      esi = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);
      ebx = OpCodes.Shr32((rd32L(esp)), 0); esp = OpCodes.Shr32((esp + 4), 0);


  }

  class DarkCryptMESSAAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "MESSA (DarkCrypt)";
      this.description = "31-round block cipher from the DarkCrypt Total Commander plugin. Key-dependent 64-word round table built via a three-stage key schedule (fixed warm-up scramble, 10-round key/table mixing, 10-iteration key-buffer finalization). 64-bit block, 512-bit key.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / \"Zarya\" project)";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];    // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Unanalyzed non-standard cipher", "No public specification or third-party cryptanalysis exists for this cipher. Not recommended for real use.", "Use AES or another vetted, publicly analyzed cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Messa — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("bd8de5f59862ed38")
        },
        {
          text: "DarkCrypt Messa — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("b538a173d13fc77f")
        },
        {
          text: "DarkCrypt Messa — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("94e00bceae69da25")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptMESSAInstance(this, isInverse);
    }
  }

  class DarkCryptMESSAInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._mem = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._mem = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. MESSA (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._mem = makeMem();
      setup(this._mem, this._key);
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

    _encryptBlock(block) {
      const BLOCK_ADDR = 0x51000;
      for (let i = 0; i < 8; i++) wr8(this._mem, BLOCK_ADDR + i, block[i]);
      crypt(this._mem, BLOCK_ADDR);
      const out = [];
      for (let i = 0; i < 8; i++) out.push(rd8(this._mem, BLOCK_ADDR + i));
      return out;
    }

    _decryptBlock(block) {
      const BLOCK_ADDR = 0x51000;
      for (let i = 0; i < 8; i++) wr8(this._mem, BLOCK_ADDR + i, block[i]);
      decrypt(this._mem, BLOCK_ADDR);
      const out = [];
      for (let i = 0; i < 8; i++) out.push(rd8(this._mem, BLOCK_ADDR + i));
      return out;
    }
  }

  const algorithmInstance = new DarkCryptMESSAAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptMESSAAlgorithm, DarkCryptMESSAInstance };
}));
