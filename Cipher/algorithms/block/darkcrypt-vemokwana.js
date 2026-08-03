/*
 * Vemokwana (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * A generalized-Feistel block cipher from the DarkCrypt Total Commander plugin
 * (Alexander Myasnikov, "Zarya" project). No public specification exists for
 * this cipher; the implementation below is as found in the DarkCrypt plugin
 * and validated bit-exact against vectors generated from that implementation.
 *
 * 128-bit block (4x32-bit words), 512-bit key (16x32-bit words), little-endian.
 *
 * Structure (shared "GTEA-family" key-setup pattern seen across several DarkCrypt ciphers,
 * built around a 128x256-byte S-box -- only the first 32 rows are used by this particular
 * cipher):
 *   - key schedule: 64 round-key words are produced by an RC5/RC6-style mixing loop (using
 *     the RC5 constants P=0xB7E15163, Q=0x9E3779B9) combined with 4 S-box lookups per step
 *     (rows selected by the round index / running accumulators, masked to 5 bits), then that
 *     64-word buffer is used as key material to RC4-key-schedule a 256-byte permutation table;
 *     the permutation table, reinterpreted as 64 little-endian dwords, is the actual per-round
 *     subkey array RK[0..63] used by crypt()/decrypt(). Whitening words W[0..7] = key[0..7] +
 *     key[8..15] (word-wise mod 2^32); W[0..3] added to the block before round 0, W[4..7]
 *     XORed in after the last round.
 *   - round function: 64 rounds processed 8 at a time. The first 4 sub-steps of every group of
 *     8 update v0..v3 in a ring (v0+=f(v1)+((v1^r)+RK[r]), ..., v3+=f(v0')+((v0'^(r+3))+RK[r+3]))
 *     using f(x)=(x<<6)^(x>>>8); the 4 resulting values are then each multiplied by a fixed
 *     32-bit constant and reduced modulo 2^32-1 (a Park-Miller-style modular multiplication),
 *     the 4 results are mixed through a small XOR diffusion network, and the mixed values feed
 *     the next 4 sub-steps (r+4..r+7) of the same ring construction, whose outputs (taken in
 *     reverse order) become v0..v3 for the next group of 8 rounds.
 * decrypt() is implemented as its own separate routine (not algebraically derived here); it
 * undoes the XOR diffusion, the modular multiplications (by different constants) and the ring
 * updates in reverse. Both directions were validated against the DarkCrypt implementation for
 * all three reference vectors, including round-trip.
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

  const DELTA = 0x9E3779B9;
  const PCONST = 0xB7E15163;
  const ROWMASK = 0x1F;   // this cipher only draws from the first 32 rows of the shared S-box
  const SCHED_N = 64;     // round-key schedule size / round count

  // 32 rows x 256 columns S-box, as implemented in the DarkCrypt Total Commander plugin.
  // Shared table design also seen (with different row-count masks) in other DarkCrypt
  // "GTEA-family" ciphers.
  const SBOX = OpCodes.Hex8ToBytes(
    "abc3fb1af118e4727ae67dd8983c489f43fa4ff906562ae1cbb8670ee2421b15864d09a7d275718511e3fe0f8917287eca54c088d64cdefda98a96e8af7cb578f28b6ca587bc59d3935ca053d5bbd0b601f027c7b03dc95dfc36f6577392be554e661d5e" +
    "74d7f3002c62608ccd2b5123ddf8adaa82d1cc0a0ba2654b228379c89e41ba4a40b39997161c3fdfee8f9b6f2d8effc4f59aa8c564eaeceb5f6d81ed47358d1e4549ac2fe7213a100769c2e97bb295a3910429f430ce506aa43837b13b70c65a02263919" +
    "34247f63bd3384dabf0d80dcb93220b41468ef9076315294440c5b6ee52e9d9c58083e46f7131f03a6dbe0122577d96bcf05b7aea1c161d4429ec7c68cf9258fc8c1a1ce380412f26a5013696d4d9c31c384af88d34f95a845781fd46c62fd32f81e6bab" +
    "3f738564e73c0fca763da5e637774360daf4195934010e48074015f1906599d549b6085c2f804c5df5c29dd9750302f792111663e0a6f04a4400eefbaa2def06550b9fb14e9b8a225e8d2394cd899a393eac823598b026dbc97dcc727c79b5e571d0d11b" +
    "bb580c677e7bb77446a7ea0a5a2187b36fdcc5bed83a1c29ebe82a93bde1ed91bfa36683960933e2df7057deb9fc14a052b4ecc0182caefeffa42853172e51475b10f3c43b2b41bad630e9e4b2cbad7a5436868ef6bc248bd281cf5fd7971a7f1db861a9" +
    "20e3fadd56680d274ba26e052cc63a1b3ded4c90da12e362a73b6a4f8ad1dc7ffcdba18bf379150e4dac6e2a168323347ed2643fe970f4f6ec4096a681c30414273160cdc00121d4332b65cfe692eab647b79b5bbb10aa4135fd4b58e2c7190553c1ddd8" +
    "d09f1cf98c78d38dc92febabcab87c1e0f5fa024bf28a3a5f1f229f8beb3a25e2d93d5d60894b08fce9a1f0c488ea4a852e884519d5d89d75c825677f7032ecc394599851dbda9f5065913b2ba9871de95306b7425feb4e47d684a757ac89e4e6d222097" +
    "380a46b9445511076187c2915ab56cc59ce0fa736f18e169df63760bff0032261a503cee54b1c4cbbcf0ef0943d9fbaf49e73e8667366642800d88577b7202e51737adae0c551f18cf2f75390ee513a6485e9e02230f6e356aff96a1a984e94d86301b9a" +
    "05a3f073f6c571c4abaf2c34918bb18e43d57e3d0ab6fcd256d0eec894b88fc3be3c5d7a6872877f76dbeae159379deb904f6fb2c2cb0b77f1d3d7e24e620711128a7d58f73a2ae35738a080a84297ce10516009dd069bb0e8ba46a763360d8d9c8c69a5" +
    "5450b9f93ed631175f641d497974ec81a26cfb20aaefad33282624b700fa6d227bcc9f894088f87c2e83b5032d781cb4c953d9a4c13b145a9215322b95fd67d8d401fe44e4854a47ac16e6bbd1276699cd04caf298bd08da4be0c7e7b370f393dedc5b45" +
    "4c6582f41a6baef5296141c6c0191e21253f5cdfbf52bced74e97516b438d6528798a36fe51af66c018d5ad89335ab3bccaa7f037aef33afdcdac0ad65839d3624e345fb11bb2c3739c7fe7bd5b5caa1d1b87e32c246b6c84484c9a5c18261f55420a2e7" +
    "b319eab160349094e0a69a23ebc59c56fad05c1c2d9695cf81e164210bfc0680bdb0048ac33d730813bf9fbc1d028630d71b1f154edd3fe2ee6b4d2ef0b7490e0a5d298948e82f4c4b58173e778fbe698e99518c53d46a921ef8f40063d988a09bdb6726" +
    "a80778712a3141cb0ff14a0d79123c55ff9ecefdde62ac85f7ae4247727c687057f2276e50ba055ff9915e185b596d4f2b2528431497a9a42266090ca7c6e4d2cd8bc4ecedd3763ae6107db9f3b2df4056c3e0fe704361794dbde6aa1752cd221e3dc63c" +
    "ecc1e4ad6abaf42e04ae0ed1b3abf2dea8a635b78f2794b459f689f15ab2b6af40e12f45ee15df64ea8bd9c725bf087463d8c53623f7c81803978c7371fb3a65193b28c00006d0c2d77cb51193ed32101ce37ffc51dcc44cce33983454531af5240c82f8" +
    "021ffa9e83cb857a759ca1e7629f49726bd5572d584b4a378709eb9569a76ddb8dda6e6c3e0ad35526991d9dd23f075c8ae841a0014642161330b9dd0fcc7e14a95b8eca50d6bbcf21ff7bb8843976f047a33892ef122a0ba2a496680dbc5f1b5e312c9a" +
    "be4ffdb14844c991ac902b209b05606f4e81d4f986e58878e9775d6729a5f3b0e27d8066c0d7af022b2cbaeb43e407aa7f19390d9b74f1d39e6493f03bdd78d29de12ea8894b035dcb6ab52a718dee1250d9ff998f66243d32978262f75a1c167b88cc48" +
    "5f0bbbf55c7aa0efd5b6a57dc9fb57d455832108b395406144527337cf0ca6dc349f11257e319076c56d2781e9a2e6f65e1d14844d4c0f3035a7051aac10d84aedab0e6ef88b8e283e2696fadbe74106c83f45fc562fc353fe67299ccdd61787b1543c4f" +
    "858aeace22c4f95146bfa9d142da9215a4b23323795b1bec80a16be35949cac1e09409f4f29a727ca36c2d7001e865c7bedeb01f91dfd0bdae6f044eb40a75f3c269381360adbc36e23a77c663b88620b7586847008c1ee51898b9fd6db2812f2c8be552" +
    "4d50df9406650c1e6bf8b54345ac53496a273f0b0539c59f7969ddfef79b11aa98b923029a3a3559d4ebc496cea69719636676d1afb464553e07bf319d12589925c0749e3d8d905c8ae262e7fffa952a1d084bc7f48e78d309b091c3e08feea45624574c" +
    "75ae4814849217000310f19cbd28687dd85489a0c2f5423446f95d2becfce847bce9cfdce4d6b386ea32c8131c93b13651827015801b0d873bd23c0a85c1188316e326c6cd297bb72dcacca2be88da77414433a530db2eadf6716001d022615fa8a3678c" +
    "ab4e1f1a7ab6fb5ec9eff340bb04bacbf0d97ce17fa16cdef20f5b4a20a9735ad538fdb8216e7237a76fed4f0ed7e67e76b294b079f4a6ab4552a0c906c5823df5cc04e34b4e1d5e6f3cdd244c49bbf760bad7b5c0772126673243fbc798a4b3d4f8e511" +
    "03866c9fbc23502e5166e19a6ad990732fe9538bef83126901fc15fe74e4053b38407eeeca0dff93e71c300b751847f9ebaab985f25837cdc3ced6e0d02c14c2c8e6acdf2072aee271a8bf489131c1f025a28afa0c1b68ea7cbe9b349681ed5ae8448f7a" +
    "3a0280920063655c0a879570a98d5d64b8daf633617d59411f0889cfdcb11ec6134ad2b6288c0fd835af9e22398e88a319adcb10a162a5b756782a6b297f463e4f57422d3f5b9c0954974d552799fdecdbd1b4166ed307d57b17a7c4de0ef11a5f2b84bd" +
    "f36d9d3699c8588fdbfc79417131e6927d9697ae8af1c0bae0b81e562921398046c54c07aa3759a0381050a38334c4572f8df73aca1b1a443d865ef272eea99b3e633c04222603bb2bb1f67525f927e514b008e8cfb3e2a50af081fa4f4052897643c717" +
    "9865ed886760a447327f36d17a6294247bb6b7a10e2de96aab236bd518bf9fd9c3fe48dee7788e5b12bc2afb874ef315da84114dfd7e707c6f35c15fce9368c6eb300fc9907719136dddb21cf501167491d3d82cea5469df95851d5aa88cb928cba26c5c" +
    "0c61cc4a06e4be4b45d7d009492e9c66d23f8b05c202556ebda6ac535133ec5dcd9af473d6af82ffb5b4a79eef42e3e10df81fad9d003b0bdc6420d4fff723ad8ccc5770955daa37b7694c4596e904643e16fcf9e583ee47a34af3dc6219654dfd6b8f3a" +
    "8038a09dd0335ef0cea77a110d5b0739c7db8d20a5ac826c55a90be3291e2dd7de59280caf31be7f79723db06f2b10dd8566d8273675f50e025c98dfcfcbbac35a424652bdb58a81ea4bec9377ae74e2b8b1638b9bd4607b6e031225faeb902641492105" +
    "f49792e62215b27e1a0f9cc24fb36a44efd9173f6d3086bfda0ac448765306c073ca991b2c919f1d7d43fecd1861091c56c52401a8888e54d1138967a62e50bbe73578ed9af8c6b63c3b14514e68a1d258a25f40ab3494008471d3f11fd6f6b42fc908c8" +
    "c187e1fbb9a47c32e02ae4d5e8bcf29e704f95e1dcb109acbea9784181eff3de86df462a29ea2e799039b4f697ca4de41ee5bb9f58279bc7bfd6fc305d7a0763d1ecd093992857db050e36448fc267a4e8fb83dab92c6bf2b2ba821115f449d3806aa372" +
    "ce247f91d97d0da885261fa64bd5d787f7d24c660ab6a1eee70bb5044801c16fcdc9a0c4233e0310a2c5730c5988cb1a62a5964e6471b7f8696dfef5cc538c33c8132dd4e2688e9298ffbc8a9a5461e002c351771c2bab8b75a747509c4a84456e3c2060" +
    "76655caf40e3f1146c319e35563a3837adb0ebe69d2f323f227ec00f2555bd08ae34cf18e9748952fd1dfa19f98d947b435a16dd0012c65b7c3bf0425eaa3d171b5fb3d8ed06b821d78892fd7b11eb77bc4917c44b2d23990b489c244a6f397ce24d9626" +
    "72b8a645afd9077833d04138be66ad7d30efc14cdbe9291fbfd11643ce9dd8d4a2c0222e750857ed32f58c9f5669134e5ffb79aa1e8085b425c534cb5e5b10ca3189e5734094b7dc81b00270aefcf1da4f51df68e791a15019d5580076d6ac74eebbd382" +
    "0c8aa83567a7c32beccd8bc8953d2f1a6e460d036b7eba368305591c0ff3fa93f98737f43ecc61deb90a27f76a60f8b15a6dea630e9864a3e63f5c2842a4e1523c0471f284c9b2e08ea5abff65201bb3d22ab5188fc612cfb6157f2c4790f69a7a3a1d6c" +
    "06dd09e886e4bd44a08df0629b9e1455e3549753a9015dc2c73b21fe07603b6b492c57f97674ab7735d93a3c26e3ba8c960d29d7a0ce80254730847ce61f148a46c0056e3482b12ef21121f7dcc637e81ac2ec87696c40ed169b1ec9b7394b9210902f22" +
    "1b0a1281f57b6a535c2042035063cd9a6f1585f1dd734328cb95e1867ee744f8418304bfcc0cc4be88b85a246201a7a1aad451c1f3a6c59375bd0e0655582ab4da64ac54d3fc68a4d1569e8efdfb7fa272df97c717f4f64f66233fe948e2ebc399318d98" +
    "ad189dbc8f79de0f45d89ca88927fef0597d3d1c32095ba9615f0b5d2beaa3b03371d54cb500c87a6d02ee67e594a5708bffcfbb4edbb6aed2efcae49f08b2364d38783ee0af2db91d5e65521391d6fad019b34ac4cbc292ef1a287c7e53fb02386d6b29" +
    "34b65d4ce2f5d3908271edf67a7f911601ca08a649feff33d873d907426a880ad4ae93062426cd59c758f2b7d605e68512c3fc36b01c4f27c51925afdbe187cef7a810e9bd64d51518c995705e7b5cadd145202ef36ffa14525111c132bee0572bb8480f" +
    "8c9e68096199aa1ebf1b809b13a704dc552da9a430c8b1b33e6c22a356cc35f1eae4783d03632f46ee8dd2973be779663a8976babbe354210b00a172ebd73c0c41505f8a96da8e17379a0e6e62b4e8d0ab4ac0677d5a83fd47a243a58be59ff84e3f44b5" +
    "9865392a1f74dd84df6940c6f9f49d77b260bc0d9c864bb975f0ac8fa0315b941dde4d2c2381cfec8b6de88818733be98cf150d5444f30b192a1c9ed97f9f0fdc30b0d5c6a0e8a66d8eab2742bcbb07e40ba422c607259027baeada829277c122e481543" +
    "1a5fb7c5ef98aa8006c64a94c4330ce2680782246923e36c265204161ffee54df3819184dc4be15d194e9dbf9c7035d438555108773e6b67bcbdabff49e722a39b99dbc8f2715ad18fd289463ff6c0349ff864c77d32a6eed6b3793a20050114a4ebce86" +
    "216fcda0fa96acaf1095e08e763dfc8713540ade5309b9cfd0d9369aa2a5585bf7da2aec25e67fb517b863a7c178d76e2f8d85617af51b93119eca3c5ef431b4cc83454c4100561c90be1edddf3928c2fbbb372d62b6476557751de4a903d30f6c51daec" +
    "1fdeef117208ce3a3f924a1c5b1e8b43a04fab730daec617d723e0c137a97cbb0298e6caba5413b538f3643146909b244583bd9f63f0d3f83d8db1d5825cc5e98c4e297a3c326eb45e19d6c3dde72e212c20b7e1785db9dfd86dd401e42f35cc0e9cb699" +
    "87368ec8b375f11dfcc7c0e5ed2d2b1b59ac68a3477bf4306b090f4dad12dc223ea674f29deea4570581708f034cd148eaaa568549d279f98ae365501869f7a127c425fa96cbaf7d526a71977741bfa267e855409e3b5a66a510ffd9a815bcbed00bf689" +
    "f5005862cd06b295c98688fe7f6184eb07264bb00c0480331afbe244765fcfdb34b8c2399a0a28916f7e949353a742fd2a146016206b53f94d1f3bd7aca57d60ab7f6947a6ce9ad2ccb7750bd4a070d3db143fbfb6b3355d2a5bf1da7c6d3240169bd1c7" +
    "fafb614bc21d1aa49774a19ee499e12b4ff8fdcb55ea50b4a76a516c87397266f38bfed9d868f726173077255e951c123a15d5df8c4add88ec54c91ebc71cf2243452ff5980e09c0422e2db5d679c8590fb29f67943eef52033691389d7380aad0926ff6" +
    "a87eb88d63c4bbeee94ce758baae7a4805b96e8a89c381a3af76195f8f21045c96e0a902297b934e649cb00a0cbef0c18e0de8ad01dc18e5fc06ed62bd3c3728103d33271bffa2c60723837857deeb8665569041b12449e6cdc58511342ce382f25a0813" +
    "46440084e231caf47c3f6c1e79323e1f6d29a05d4ce9dae0c7d9ba2512e6b966adcc5bc837b08d72ff62bff4a9ecf0859d4a43c9d70897005a90f230cd414d0a87073b5401cf5f22f9237093716e96a7fba2f888094059b22f28a66bd1eab6fcbe553c4e" +
    "80671cd0ac4713f78375f3eb7f2e5c7a57e1f1768eeffd4b03184952619b4845950b0de48f3a92dde36f0fa3866aa59fb5c0f6ee35ed7e6526e8fe73bc7b3889b1aa9a8cbbd43d2cdc825e680e4491202bc3561927b3e2b49e78dbe5d614f52dd5c24f17" +
    "1d461194b71636991ad89850c6ab02c4811b045115a1ae245834c50c8a0577b8d2dea4397d2acbcace42bdc169df6310fa31a8063360539c74848be7af6421d3afcefc2b652cfe25578ce122bbb6f4990ce00d4b5d189426dc5c6a01a0acebc877cfca8d" +
    "51c955bd113c2e97ef002fb2c15b7df75ed18147860f90fa6b3f0246e729ad0a2a2769dd0889b9f5053ecd2df6e67fa6ba6e234c541bec3684d90b1e3a9253d793d5a366647b72cbbe03c0d22138f3a7e49a6dded0968b070931e54f633b0471ff13b898" +
    "6710fbbfa116d86274a25632ea5f607678b76f41f8ab497cc270839bc7a49fb382404a5a8e73e2f99c8a15db44c391f21afdf033aec452174839199de8ccbc8f7ea51cc5ee284e87b150207a1d30b56c427514f124584d43e9b045da9559df853dc60e79" +
    "d335e38012eda99e61883437d6b4d406aa1fa868efc2cc87643ccde71b519f959e1138521ae0a6ac8ab05530078e241581d7bd17bc4b05ba68d1f22eb1e1e890eeb87ce357cf7b9bea5e5fa85dfad4adb34d1c882c2536aac00e22c9b56b0c218bd3ebfd" +
    "c8a70f6cec0af6bbab54df840bf93df34aed1002aedb8d652de46241761f3aff91d2d9d6e21942169c0da5deb9c7dc447a8f98313fb6439771bf787fa12a6d50f84746e5dda280795aa91ee9d0038663378369be32c3a44f72496a23487d35c133349a82" +
    "8c99597e5828b7fbc66f1d566e0192c44e776706b4da08fef0f5943b3ef1f42796cae6144c9d7393c5b2754012295c2f742604cb1853af66d55b00892b7060fcd80920ce45a313618539f7a0bbdeaad6c719da095cbfbc10ba8404c06d0e4a028c27b59f" +
    "17abaf4111715fce0b3a86074b61b44eea98978825435aade15dcfe791a08e34a23b72faeb583735281f782bc8d467839b2d211ec4b27bc530ed38a747a3323cd53d13c32acc2f3ea8b8d7ef42e3e292f2a9ddae8948f84505ec70f056ac155201d9fbd1" +
    "0a24b65433fdbe6f80538a7c6bb0a42977cad2397f9d2cdb55144fee0c93e094964c6587227616cdbdcb8299446e6349e91d06088b3f739568dfe67446f37ee58f31b769660f79620381f7fe1b0df175505751c6b3b9a6e81c9aa5c9a16a8d9e23f6c260" +
    "26d02eff1a5b856459f900dcf59cc1207dd35e3690fc4dd840b1187a12e46cf4fad21401702b56bed32ff68f94bb03b8cafbc40e346f68c71fba285c19d83acdcbcc32aa4800e5c8c61d1ca9eda0e747eb62837a609ce99ff3376dd0886c179e359d76bd" +
    "a3d18d8a77b13d5007df30e4f5b7f927a206f45d5e4e825495b65b5931acc596b58cc24c4df1a44508a5b302adf7bf9064cefd3f13b03678914f9b18108740c3c971979358654449de267f2174c167732a61123c2de892ff99b2afb40479532955b90fe2" +
    "38d7980aabd4a8c0d5dcae423eea6685203b5725fee643118e9af0692c72eed95222ec7c4b2ee1846323cf7b4a0cf8bcf28109051b6adbd68b7d1e1a0b6ee3895fef7e5a8015e0dd416b39a78651fcda24167533a1460da635848dd70bb550fbf28f2156" +
    "125ebced02ad437a09611a169be5b02326b886158563956a1ce0660e146f40decfa796eceb710dca7da58a76fa03c2ac3b3629c3f03a33a979209a4fccd94cff92f3bbb7d4e842bdf459105acd6c606d9405f6c9f168aa80e70c5c312e135b061d891b3c" +
    "9c37efdafd919fa0ddbff801c5eee48ea6787ecb5149e32508c63f67b490328cc0df4100112ddcd5e1fc445439e9a8a42ace1f9d580a2b97996bb97fd62762b645c7a11957186ed2fe8207a34e8774738188d3a22f38229ee64a3e7753287083e2af930f" +
    "04c86572b25246c4db984bd134c1ea3d6455b1f78bf5477c4d7bd8b35f17ae2c5dd01ebeab24f969ba4875304f93cb45ca51cf427af6f29d0904b959eefc2c21dd83bd299c700ab6b55a66ea82baceed5da83d806b5f1f9f02129490db6de6e1177cbb26" +
    "cc8c5ee40c84a63b6474d150ecf5e5c1e055538e2ffdf7b1c8ab674c60df765805927b3895e375f035485b0b16e9d8e78897ae918d6931d31ba26114d044fbad083768be777e181c652df83cbceb0d224aa1a32a4743c3c6acd48bf3327901e2c920b27d" +
    "d22e239a06f48578b74bef3f3a63ded96a9973c424101e4daabf27c7c07f4186da0f89afff2bfa1dd60ee8258a36a5520346c26e4ea015348162d7b0f1b313409bb81a5c56a9f9a7546f0033feb496199e718f7211a49887303928493ecd6cc5dc07d557" +
    "f453fa8d8664adeae7e17a639897c7c0d63207cd69baec14167ebe79d8751873acefdf52f974c3cff34ae233852130cebb00b5c5a2c19f51e0503eb8414f36fbd9a0edc46c9aa45deba155907d25a55a7b1d1b0e2672f76a0c844cfe89b3d14dfd3b5878" +
    "c9c2128c3888ee87cb837177d3349423ccf8674b15b6d0afe92d9ccac6935be69e3afc43bc28f17f3576572fdae8689592d45f2be3f082101a462cdc5c0d458a6e17dbf5199b607ca320bf3d6299a9f2b14065612e390256dd4eaba88e0b8fb054274804" +
    "e4429196a606b78b9d6dbd3703c82a08d7473fb901b40f24663c4411051fe559705e0a6f49de13ae2281d5f6ff2909b23180a76b1cd2aa1e990a607641f686b86be13770c608909587a633abd584f907b6227ea3c7b9e388835dd6d896124b098f01fc7c" +
    "6a307f18fbe739c87b6f16d782ed4389e0af27df346c4564db401967e2fe65acd450a45cd97ddd52a5c30df51b695f23f47454be3a312bb7c26251ba79e98a47d0100cbb8db03661e85acbaeece6b294ad05ee91bd0bef721f2a354d1c569ad3bfdc983f" +
    "4a258085faeb244f92b39f63f02600f3777a4caa38f18cb53da80f28295e9c49e4a1932ca98b75681e0244c1581542ff9ece4e3e1acad232cc8ecd71cf031114fdc457a0ea813bb4202166e5bc59f8f746c99d78556d13dad1c0f2dec5a2b13c1d532f73" +
    "6e2d5b2e060ea79b481704971cb133875ebe6195c3fb9b122c71b4dc5d6e55261e780627fcc1176ddb899fad2a77d2501af2115fce3559ee044ba93a2b0363a3935a578343c8824c0ec6e6484eba6bb3900b3bfa8e8f6667027d237681fdc021f5207bb7" +
    "f9166f99a7844136ac30696aa1cb7c85601f8bd847f4e99dcdede1d43d7949b2c2b9c43274252918b60c8ce0a614c5a8ea9e10968addf8b85be5a4ff75374442e4af1da00554530924eb3151cae2084597f74f9298ccf1bd687f52d69a7301d03ff6c7df" +
    "2d3eae285cb565efa21b6280bf72d900342ee38d91d7aa15e719070dda226c4d0ab0d15688f313c940ec4a2fbb9cbc387edeabcf58f0d370643c0f4694fe7a86e839d5a542ea4d1d23cfad978363f9059b57dce22b5eaec81341d203ed65b54f541cdefd" +
    "0a793909d086f6677d45ba50848df292be4c94e5cd2fd7cb209eec12a63c329108b23a0efa71f16b667673da344926c9f71aa9986ae1aaa57ec3950cf0d94e81a3f838e627e7b4eea12a7277e9563f8788d85a1bbb6cc246d319df018c535c55b08bfc17" +
    "e4efc7d1d52858ab109ccc6847dbc48e0f370d64523e8aa7997c2c367fd62ddd7448e0217ab744189d07605135b86e5d80c114f3629f596da200220b787b40c090ca61a0f49670b15bffacd425fbb3433382af6fc504f530e8b65f8fbf11024bb989311f" +
    "759abc3b2969069315bd1ea44a852ea8eb16fecec624e33dd744cd97e41ef87a91ec50b120af89f3d46ad321725c188209ba3f4cc2e68768e05170366758160574889c0ba1c931f02bb66d55ca8ee20f694f6181bc79f2493b452a57e8dc9083c0fe4041" +
    "62631275d5fb394bc524988cad06c4acaada2d3ed230647f9a2cd9a503e1867ccbbd7d600273bf5de3a2a9ae32a01d9f8437f65e9b9600156e4e1046c8230e14be19018db8947eeb3a7b386f26f9f15243b7c3b034de1778c11a8ad813f7cf1b041f3c22" +
    "4dfadb485b92083d5ab4b2d0eebbed99a70dceffe5b3a80a5f7185a325dfab0753c66b5627ccb9d18fa48b9565d69359e980ef762f1cb54a35dd119d77c728f4662947542e42f5fdfc6c33e7ea9e0ca68b6eddcc9a0666e005e878d0fc248d0c1788eb1d" +
    "5e1e324bbd7aacce2c68fd6d3df86a01e128877f8ad327fe64e9e7ef3103d94c19795271f27b91a914abf75d04ad9f354f22a6b162aa46612eb67cbebaf4a7c29075f9ed2a4d55c0b999cfd7d10f4925c4a5e398c620420a96833e800950a26b12d8d5d4" +
    "6ce2118e1a6fa876b710730dc59295ff395482e5b3519b639774af265b48dac3c95f2d85b89e3afa94a4a12f4323f1cac81ff58177401b3b08e6b038dfb2474a9c413ca31657fb02d20e4e602bb57deac1dee4a09d15f0ae0b59365cbc331837c7848645" +
    "8f9353001372cb896734dc58303fbbb4d6db652921f670bfec697ef3cd8c56ee1c5a440724637db5fa486f1678a9c4e5bc080fc5c0dbcf5e895165d92eab2cbe75f75da879981799e39f3f55b81541b41de677dac91a3bd2d4af46ecd79b1f32ce69f4fe" +
    "2f748f40930331c784bbf519e288ffd0e09425a014604a81ac43eacb271ce7621e4d450156b0d661de703e0db7a14b2d3ccc5f7159dc375c82e46bb65a3839f658f09610864ea39a352647d5ed9518060c7bebbaf1914c490452908d229e33dfa55b833d" +
    "7f8ca734c87376f26d8be92bc19d11eeca97c228d89c0030e1adfd20b287bfae6409d1e86cf354027ca22336804f07852192eff93addb1b36672a48a7a507e1baacd440e6a4205a6fcfbc36e8ed30a68f853572abd13c612b9290b67"  );

  function u32(x) { return OpCodes.ToUint32(x); }
  function rol32(x, n) { return OpCodes.RotL32(u32(x), OpCodes.And32(n, 31)); }
  function fMix(x) { return u32(OpCodes.Xor32(OpCodes.Shl32(x, 6), OpCodes.Shr32(x, 8))); }
  function sbLookup(row, col) { return SBOX[OpCodes.And32(row, ROWMASK) * 256 + OpCodes.And32(col, 0xFF)]; }

  // Multiply-and-reduce modulo 2^32-1 (Park-Miller-style), matching the exact bit pattern
  // used by the DarkCrypt implementation (64-bit product, fold high+low, +1 correction on
  // overflow past 0xFFFFFFFF -- note 0xFFFFFFFF itself is left as-is, a redundant "zero"
  // representation).
  function mulReduceM(a, b) {
    const prod = BigInt(OpCodes.ToUint32(a)) * BigInt(OpCodes.ToUint32(b));
    const lo = OpCodes.AndN(prod, 0xFFFFFFFFn);
    const hi = OpCodes.ShiftRn(prod, 32n);
    const sum = lo + hi;
    if (sum > 0xFFFFFFFFn) return OpCodes.ToUint32(Number(OpCodes.AndN(sum, 0xFFFFFFFFn) + 1n));
    return OpCodes.ToUint32(Number(sum));
  }

  class DarkCryptVemokwanaAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Vemokwana (DarkCrypt)";
      this.description = "Generalized-Feistel block cipher from the DarkCrypt Total Commander plugin: RC5/RC6-style S-box-driven key schedule feeding an RC4-permuted subkey table, 64 rounds mixing modular multiplication (mod 2^32-1) with an XOR diffusion network. 128-bit block, 512-bit key. No public specification exists.";
      this.inventor = "Alexander Myasnikov (DarkCrypt / \"Zarya\" project)";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];   // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard, unanalyzed design", "Custom generalized-Feistel construction with no public cryptanalysis; not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors generated from the DarkCrypt implementation (raw primitive: setup(key)+crypt(block)).
      this.tests = [
        {
          text: "DarkCrypt Vemokwana — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("0c45790a79707fd5fcf1d880c8899b29")
        },
        {
          text: "DarkCrypt Vemokwana — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("1b293690e9710673d59f19df54c25564")
        },
        {
          text: "DarkCrypt Vemokwana — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("b82a0b5215332c45eae0ec930a792603")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptVemokwanaInstance(this, isInverse);
    }
  }

  class DarkCryptVemokwanaInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this.KeySize = 0; this._sched = null; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Vemokwana (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._sched = this._buildSchedule(this._key);
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

    _keyWords(key) {
      const words = new Array(16);
      for (let i = 0; i < 16; i++)
        words[i] = OpCodes.Pack32LE(key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]);
      return words;
    }

    // Builds the 64-entry round-key array RK[] and the 8 whitening words W[] from the 512-bit key.
    _buildSchedule(key) {
      const K = this._keyWords(key);
      const RKinit = new Array(SCHED_N);
      for (let i = 0; i < SCHED_N; i++) RKinit[i] = K[OpCodes.And32(i, 0xF)];

      let A = DELTA;
      let P = PCONST;
      for (let idx = 0; idx < SCHED_N; idx++) {
        const kw = K[OpCodes.And32(idx, 0xF)];
        A = u32(A + kw + DELTA);
        const T = u32(RKinit[idx] + P);
        const rowIdx = OpCodes.And32(idx, ROWMASK);
        const rowP = OpCodes.And32(P, ROWMASK);
        const b0 = sbLookup(rowIdx, OpCodes.Shr32(T, 24));
        const b1 = sbLookup(rowP, OpCodes.And32(OpCodes.Shr32(T, 16), 0xFF));
        const rowT = OpCodes.And32(T, ROWMASK);
        const b2 = sbLookup(rowT, OpCodes.And32(OpCodes.Shr32(T, 8), 0xFF));
        const rowA = OpCodes.And32(A, ROWMASK);
        const b3 = sbLookup(rowA, OpCodes.And32(T, 0xFF));
        const mix = u32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(b0, 24), OpCodes.Shl32(b1, 16)), OpCodes.Shl32(b2, 8)), b3));
        const F1 = rol32(mix, 11);
        A = u32(A + F1);
        let U = u32(rol32(F1, 16) + fMix(F1));
        U = u32(U + kw);
        const rowA2 = OpCodes.And32(A, ROWMASK);
        const c0 = sbLookup(rowA2, OpCodes.Shr32(U, 24));
        const rowU = OpCodes.And32(U, ROWMASK);
        const c1 = sbLookup(rowU, OpCodes.And32(OpCodes.Shr32(U, 16), 0xFF));
        const c2 = sbLookup(rowP, OpCodes.And32(OpCodes.Shr32(U, 8), 0xFF));   // reuses the row saved before P's increment
        const c3 = sbLookup(rowIdx, OpCodes.And32(U, 0xFF));          // reuses the row saved before idx moved on
        const mix2 = u32(OpCodes.Or32(OpCodes.Or32(OpCodes.Or32(OpCodes.Shl32(c0, 24), OpCodes.Shl32(c1, 16)), OpCodes.Shl32(c2, 8)), c3));
        const F2 = rol32(mix2, 11);
        A = u32(A + F2);
        RKinit[idx] = F2;
        P = u32(P + PCONST);
      }

      // RC4-style key schedule over 256 bytes, keyed by RKinit's low 256 bytes.
      const RKbytes = new Uint8Array(256);
      for (let i = 0; i < SCHED_N && i * 4 < 256; i++) {
        const w = OpCodes.ToUint32(RKinit[i]);
        RKbytes[i * 4] = OpCodes.And32(w, 0xFF);
        RKbytes[i * 4 + 1] = OpCodes.And32(OpCodes.Shr32(w, 8), 0xFF);
        RKbytes[i * 4 + 2] = OpCodes.And32(OpCodes.Shr32(w, 16), 0xFF);
        RKbytes[i * 4 + 3] = OpCodes.And32(OpCodes.Shr32(w, 24), 0xFF);
      }
      const S = new Uint8Array(256);
      for (let i = 0; i < 256; i++) S[i] = i;
      let j = 0;
      for (let c = 0; c < 0x300; c++) {
        const i = OpCodes.And32(c, 0xFF);
        const a = S[i];
        const kb = RKbytes[i];
        j = OpCodes.And32(j + a + kb, 0xFF);
        const m = S[j];
        const d = S[m];
        S[i] = d;
        S[m] = a;
        j = m;
      }
      const RK = new Array(64);
      for (let i = 0; i < 64; i++)
        RK[i] = OpCodes.Pack32LE(S[i * 4], S[i * 4 + 1], S[i * 4 + 2], S[i * 4 + 3]);

      const W = new Array(8);
      for (let i = 0; i < 8; i++) W[i] = u32(K[i] + K[i + 8]);

      return { RK, W };
    }

    _encryptBlock(block) {
      const { RK, W } = this._sched;
      let v0 = u32(W[0] + OpCodes.Pack32LE(block[0], block[1], block[2], block[3]));
      let v1 = u32(W[1] + OpCodes.Pack32LE(block[4], block[5], block[6], block[7]));
      let v2 = u32(W[2] + OpCodes.Pack32LE(block[8], block[9], block[10], block[11]));
      let v3 = u32(W[3] + OpCodes.Pack32LE(block[12], block[13], block[14], block[15]));

      for (let r = 0; r < SCHED_N; r += 8) {
        v0 = u32(v0 + fMix(v1) + u32(OpCodes.Xor32(v1, r) + RK[r]));
        v1 = u32(v1 + fMix(v2) + u32(OpCodes.Xor32(v2, (r + 1)) + RK[r + 1]));
        v2 = u32(v2 + fMix(v3) + u32(OpCodes.Xor32(v3, (r + 2)) + RK[r + 2]));
        const D3 = u32(fMix(v0) + v3 + u32(OpCodes.Xor32(v0, (r + 3)) + RK[r + 3])); // v3-update term, uses new v0

        const R1raw = mulReduceM(0x025F1CDB, v0);
        const R1 = OpCodes.And32(R1raw, 1) ? u32(OpCodes.Xor32(R1raw, 0x2AAAAAAA)) : R1raw;
        const R2 = mulReduceM(0x04BE39B6, v1);
        const R3 = mulReduceM(0x12F8E6D8, v2);
        const R4 = mulReduceM(0x2F8E6D81, D3);

        const Amix = u32(OpCodes.Xor32(R1, R3));
        const Bmix = u32(OpCodes.Xor32(R2, R4));
        const nvA = u32(OpCodes.Xor32(R1, Bmix));
        const nvB = u32(OpCodes.Xor32(R2, Amix));
        const nvC = u32(OpCodes.Xor32(R3, Bmix));
        const nvD = u32(OpCodes.Xor32(R4, Amix));

        const NV0 = u32(nvC + RK[r + 4] + u32(OpCodes.Xor32((r + 4), nvD) + fMix(nvD)));
        const NV1 = u32(OpCodes.Xor32((r + 5), nvA) + RK[r + 5] + u32(fMix(nvA) + nvD));
        const NV2 = u32(RK[r + 6] + nvA + u32(OpCodes.Xor32((r + 6), nvB) + fMix(nvB)));
        const NV3 = u32(RK[r + 7] + nvB + u32(OpCodes.Xor32((r + 7), NV0) + fMix(NV0)));

        v0 = NV3; v1 = NV2; v2 = NV1; v3 = NV0;
      }

      return [
        ...OpCodes.Unpack32LE(u32(OpCodes.Xor32(v0, W[4]))),
        ...OpCodes.Unpack32LE(u32(OpCodes.Xor32(v1, W[5]))),
        ...OpCodes.Unpack32LE(u32(OpCodes.Xor32(v2, W[6]))),
        ...OpCodes.Unpack32LE(u32(OpCodes.Xor32(v3, W[7])))
      ];
    }

    _decryptBlock(block) {
      const { RK, W } = this._sched;
      let A = u32(OpCodes.Xor32(OpCodes.Pack32LE(block[0], block[1], block[2], block[3]), W[4]));
      let B = u32(OpCodes.Xor32(OpCodes.Pack32LE(block[4], block[5], block[6], block[7]), W[5]));
      let C = u32(OpCodes.Xor32(OpCodes.Pack32LE(block[8], block[9], block[10], block[11]), W[6]));
      let D = u32(OpCodes.Xor32(OpCodes.Pack32LE(block[12], block[13], block[14], block[15]), W[7]));

      let S1 = fMix(D);
      for (let r = SCHED_N - 1; r >= 0; r -= 8) {
        A = u32(A - S1 - u32(OpCodes.Xor32(D, r) + RK[r]));
        B = u32(B - u32(fMix(A) + u32(OpCodes.Xor32((r - 1), A) + RK[r - 1])));
        C = u32(C - u32(fMix(B) + u32(OpCodes.Xor32((r - 2), B) + RK[r - 2])));
        D = u32(D - u32(fMix(C) + u32(OpCodes.Xor32((r - 3), C) + RK[r - 3])));
        const rNext = u32(r - 4);

        const Amix = u32(OpCodes.Xor32(B, D));
        const Cmix = u32(OpCodes.Xor32(A, C));
        B = u32(OpCodes.Xor32(B, Cmix));
        A = u32(OpCodes.Xor32(A, Amix));
        D = u32(OpCodes.Xor32(D, Cmix));
        C = u32(OpCodes.Xor32(C, Amix));

        const Bp = OpCodes.And32(B, 1) ? u32(OpCodes.Xor32(B, 0x2AAAAAAA)) : B;
        const Ra = mulReduceM(0x0DAD4694, Bp);
        const Rb = mulReduceM(0x06D6A34A, A);
        const Rc = mulReduceM(0x81B5A8D2, D);
        const Rd = mulReduceM(0x281B5A8D, C);

        const Y = u32(Rd - RK[rNext] - u32(OpCodes.Xor32(Ra, rNext) + fMix(Ra)));
        S1 = fMix(Y);
        const Rc2 = u32(Rc - RK[rNext - 1]);
        const Z = u32(Rc2 - u32(OpCodes.Xor32((r - 5), Y) + fMix(Y)));
        const Rb2 = u32(Rb - RK[rNext - 2]);
        const Wc = u32(Rb2 - u32(OpCodes.Xor32((r - 6), Z) + fMix(Z)));
        const Final = u32(u32(Ra - RK[rNext - 3]) - u32(OpCodes.Xor32((r - 7), Wc) + fMix(Wc)));

        A = Final; B = Wc; C = Z; D = Y;
      }

      return [
        ...OpCodes.Unpack32LE(u32(A - W[0])),
        ...OpCodes.Unpack32LE(u32(B - W[1])),
        ...OpCodes.Unpack32LE(u32(C - W[2])),
        ...OpCodes.Unpack32LE(u32(D - W[3]))
      ];
    }
  }

  const algorithmInstance = new DarkCryptVemokwanaAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptVemokwanaAlgorithm, DarkCryptVemokwanaInstance };
}));
