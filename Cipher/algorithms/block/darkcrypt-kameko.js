/*
 * Kameko (DarkCrypt) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The "Kameko" block cipher as implemented in the DarkCrypt Total Commander
 * plugin (Alexander Myasnikov, "Zarya" project). It has no known public
 * specification; this implementation was reconstructed entirely from the
 * DarkCrypt implementation's behavior.
 *
 * Structure:
 *   - 64-bit block (8 independent bytes), 512-bit key (64 bytes / 16
 *     32-bit little-endian words).
 *   - crypt() runs a fully unrolled 64-round chained byte-substitution
 *     network. Treating the block as 8 accumulator bytes state[0..7]
 *     (initialized to the plaintext bytes), round r = 0..63 updates
 *     exactly one byte, using the four bytes "ahead" of it (with 8-byte
 *     wraparound, always the CURRENT — possibly already-updated-this-pass —
 *     values):
 *       a = state[(r+1) mod 8], b = state[(r+2) mod 8],
 *       c = state[(r+3) mod 8], d = state[(r+4) mod 8]
 *       val = T1[sel1[r]+a] XOR T2[sel2[r]+b] XOR T3[sel3[r]+c] XOR T4[sel4[r]+d]
 *       state[r mod 8] = (state[r mod 8] + val) mod 256
 *     After round 63, state[0..7] is the ciphertext, in slot order.
 *     Decrypt runs the identical round formula for r = 63 downto 0 and
 *     SUBTRACTS instead of adds (state[r mod 8] = (state[r mod 8] - val)
 *     mod 256); this inverts cleanly because a round's 4 "source" bytes are
 *     always ones last written by an earlier-numbered round, so undoing
 *     rounds in reverse order never needs an already-reverted byte.
 *   - T1..T4 are four 256-byte windows of one static 1280-byte table,
 *     each window starting exactly 0x100 bytes after the last — i.e. they
 *     are 4 overlapping views of one contiguous byte blob, not 4
 *     independent tables. Because a selector byte and a state byte are
 *     each 0-255, sel+state can reach 510, deliberately spilling past a
 *     window's nominal 256 bytes into the next window's own data — the
 *     addressing never masks the sum to 8 bits, so the spillover is
 *     reproduced here verbatim via one flat 1536-byte table indexed as
 *     T1234[k*0x100 + sel + state].
 *   - sel1..sel4 (one selector byte per round, 64 rounds) are not separate
 *     arrays: they resolve to base+0x00/0x40/0x80/0xC0 of one single
 *     256-byte, key-derived table B (see setup() below) — i.e. B is simply
 *     split into 4 consecutive 64-byte quarters and used as the four
 *     selector streams.
 *   - setup() builds B from the 64-byte key in two stages:
 *     1) A 16-word "local key" (the raw key, packed little-endian) seeds a
 *        64-word working array W (W[i] = localKey[i mod 16]). W is then
 *        mixed for 64 rounds with a MARS/RC6-flavoured ARX+S-box round
 *        (two applications of a per-byte table substitution driven by a
 *        second static 8192-byte table MIX — 32 rows of 256 bytes, indexed
 *        by a rotating "row" selector value taken alternately from the
 *        round counter, a running additive accumulator A, the mixed value
 *        itself, and a running additive accumulator Q, each masked to 5
 *        bits and used as MIX[row*256 + byte]) combined with 32-bit
 *        rotations and the classic RC6/RC5 magic constants
 *        P=0xB7E15163, Q=0x9E3779B9. Full per-round detail:
 *          LK = localKey[i & 0xF]
 *          Qacc = Qacc + LK + Q                                 (Qacc0 = Q)
 *          t1 = W[i] + A                                        (A0 = P)
 *          comb1 = MIX[(i&31),byte3(t1)]<<24 | MIX[(A&31),byte2(t1)]<<16
 *                | MIX[(t1&31),byte1(t1)]<<8 | MIX[(Qacc&31),byte0(t1)]
 *          comb1 = ROL32(comb1, 11);  Qacc += comb1
 *          t2 = ROL32(comb1,16) + ((comb1<<6) XOR (comb1>>>8)) + LK
 *          comb2 = MIX[(Qacc&31),byte3(t2)]<<24 | MIX[(t2&31),byte2(t2)]<<16
 *                | MIX[(A&31),byte1(t2)]<<8 | MIX[(i&31),byte0(t2)]
 *          comb2 = ROL32(comb2, 11);  Qacc += comb2
 *          W[i] = comb2;  A += P
 *     2) The byte-view of the mixed W array (256 bytes) drives a modified
 *        RC4-style key-scheduling pass over an identity-initialized 256-
 *        byte array B, run for 3*256 = 768 iterations (i.e. the 256-byte
 *        keystream view of W is consumed 3 times over). Unlike textbook
 *        RC4 KSA, the running accumulator carried between iterations is
 *        not the plain index j but B[j] itself, and the update touches
 *        B[i] and B[B[j]] rather than swapping B[i] and B[j]:
 *          i = iterCount & 0xFF
 *          j = (carry + B[i] + Wbytes[i]) & 0xFF
 *          x = B[B[j]]
 *          B[i] = x;  B[B[j]] = B[i]_old;  carry = B[j]
 *     B is then used directly as the round-selector source for crypt()/
 *     decrypt() as described above.
 * All constants below match the DarkCrypt implementation exactly, including
 * operations, such as the unmasked sel+state sum, that a "clean-room" design
 * would likely have avoided. Verified against the DarkCrypt implementation,
 * including encrypt/decrypt round-trip. 64-bit blocks, 512-bit keys.
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

  const ROUNDS = 64;
  const P_CONST = 0xB7E15163;
  const Q_CONST = 0x9E3779B9;

  // Four overlapping 256-byte substitution windows, as one flat 1536-byte
  // blob. T[k][x] = T1234[k*0x100 + x].
  const T1234 = OpCodes.Hex8ToBytes(
    "2089efbc667ddd48d444512556ed939546e5117c73cf21147a8f19d733b78a8e" +
    "92d36ead01e4bd0e674ea224fda774ff9e2db93262a8faeb368dc3f7f03f9402" +
    "e0a9d6b43e16756c13aca19fa02f2babc2afb238c47017dc5915a4829d0855fb" +
    "d82c5eb3e2265a7728ca22ce2345e7f61d6d4a47b0063c91410d4d970c7f5fc7" +
    "396505e896d28118b50a79bb30c18bfcdb4058e960805035bf90da0b6a849b68" +
    "5b881f2af3427e871e1a57bab69af27b52a6d02798be71cd7269e15449a3636f" +
    "cc3dc8d9aa0fc61cc0fe86eade07ecf8c929b19c5c8343f9f5b8cb09f1001b2e" +
    "85ae4b125dd164784cd51053046b8c343a3703f461c5eee376314fe6dfa5993b" +
    "290d61409ceb9e8f1f855f585b013986972ed7d635ae171621b6694ea5728708" +
    "3c18e6e7faadb889b700f76f738411633f967f6ebf149daca40e7ef6204a6230" +
    "03c54b5a46a344657d4d3d4279491b5cf56cb59454ff56570bf4430c4f706d0a" +
    "e4023e2fa247e0c1d51a95a7515e332b5dd41d2cee75ecdd7c4ca6b478483a32" +
    "98afc0e12d090f1eb9278ae9bde39f07b1ea9293536a311080f2d89b0436068e" +
    "bea96445381c7a6bf3a1f0cd37251581fb90e8d97b5219282688fcd1e28ca034" +
    "8267dacbc741e5c4c8efdbc3ccabceedd0bbd3d2716813129ab3c2cade77dcdf" +
    "6683bc8d60c62223b28b910576cf74c9aaf199a859503b2afef924b0bafdf855" +
    "ad54f0430135fe2429ac736ddfc798bd5a2e95c1da82fa28cb0423edecf6d58f" +
    "a9b030173dce4522619b046db7dc2a40157b1de9fd69b7d101bf710c2e0708b7" +
    "a6c7a6074e2587fcae548ca4985e16b93b44b53cb04333191cbe8ac62c5a5cdd" +
    "95afba1931d232ed29cf1fe27279e60f3a198e3a62e83b03bd1c087483b94efa" +
    "ef2174ad5e2d683e7ab31296f6fa11084f9de1ee2f0a853a087e5244998d029e" +
    "cc3282353b20f3a0ac23186b2373e48f1ce04d37191c7859ba98315475b41e8a" +
    "864db69d3de61695360f6e20d59b6a4e1017598c9ea96088ba681ec74323da9f" +
    "d26d1cee2196adb4f7c9539669a4e43bcf65dd633478c71f0690cad7d1312ac3" +
    "57157536173714547476163555773456df9dfdbe9fbf9cdcfcfe9ebdddffbcde" +
    "cf8dedae8faf8cccecee8eadcdefacced391f1b293b390d0f0f292b1d1f3b0d2" +
    "d795f5b697b794d4f4f696b5d5f7b4d65f1d7d3e1f3f1c5c7c7e1e3d5d7f3c5e" +
    "db99f9ba9bbb98d8f8fa9ab9d9fbb8da43016122032300406062022141632042" +
    "c381e1a283a380c0e0e282a1c1e3a0c2c785e5a687a784c4e4e686a5c5e7a4c6" +
    "cb89e9aa8bab88c8e8ea8aa9c9eba8ca4b09692a0b2b0848686a0a29496b284a" +
    "5b19793a1b3b1858787a1a39597b385a47056526072704446466062545672446" +
    "4f0d6d2e0f2f0c4c6c6e0e2d4d6f2c4e53117132133310507072123151733052" +
    "abc3fb1af118e4727ae67dd8983c489f43fa4ff906562ae1cbb8670ee2421b15" +
    "864d09a7d275718511e3fe0f8917287eca54c088d64cdefda98a96e8af7cb578" +
    "f28b6ca587bc59d3935ca053d5bbd0b601f027c7b03dc95dfc36f6577392be55" +
    "4e661d5e74d7f3002c62608ccd2b5123ddf8adaa82d1cc0a0ba2654b228379c8" +
    "9e41ba4a40b39997161c3fdfee8f9b6f2d8effc4f59aa8c564eaeceb5f6d81ed" +
    "47358d1e4549ac2fe7213a100769c2e97bb295a3910429f430ce506aa43837b1" +
    "3b70c65a0226391934247f63bd3384dabf0d80dcb93220b41468ef9076315294" +
    "440c5b6ee52e9d9c58083e46f7131f03a6dbe0122577d96bcf05b7aea1c161d4" +
    "429ec7c68cf9258fc8c1a1ce380412f26a5013696d4d9c31c384af88d34f95a8" +
    "45781fd46c62fd32f81e6bab3f738564e73c0fca763da5e637774360daf41959" +
    "34010e48074015f1906599d549b6085c2f804c5df5c29dd9750302f792111663" +
    "e0a6f04a4400eefbaa2def06550b9fb14e9b8a225e8d2394cd899a393eac8235" +
    "98b026dbc97dcc727c79b5e571d0d11bbb580c677e7bb77446a7ea0a5a2187b3" +
    "6fdcc5bed83a1c29ebe82a93bde1ed91bfa36683960933e2df7057deb9fc14a0" +
    "52b4ecc0182caefeffa42853172e51475b10f3c43b2b41bad630e9e4b2cbad7a" +
    "5436868ef6bc248bd281cf5fd7971a7f1db861a920e3fadd56680d274ba26e05"
  );

  // 32 rows x 256 columns mixing table used by the key schedule.
  const MIX = OpCodes.Hex8ToBytes(
    "abc3fb1af118e4727ae67dd8983c489f43fa4ff906562ae1cbb8670ee2421b15" +
    "864d09a7d275718511e3fe0f8917287eca54c088d64cdefda98a96e8af7cb578" +
    "f28b6ca587bc59d3935ca053d5bbd0b601f027c7b03dc95dfc36f6577392be55" +
    "4e661d5e74d7f3002c62608ccd2b5123ddf8adaa82d1cc0a0ba2654b228379c8" +
    "9e41ba4a40b39997161c3fdfee8f9b6f2d8effc4f59aa8c564eaeceb5f6d81ed" +
    "47358d1e4549ac2fe7213a100769c2e97bb295a3910429f430ce506aa43837b1" +
    "3b70c65a0226391934247f63bd3384dabf0d80dcb93220b41468ef9076315294" +
    "440c5b6ee52e9d9c58083e46f7131f03a6dbe0122577d96bcf05b7aea1c161d4" +
    "429ec7c68cf9258fc8c1a1ce380412f26a5013696d4d9c31c384af88d34f95a8" +
    "45781fd46c62fd32f81e6bab3f738564e73c0fca763da5e637774360daf41959" +
    "34010e48074015f1906599d549b6085c2f804c5df5c29dd9750302f792111663" +
    "e0a6f04a4400eefbaa2def06550b9fb14e9b8a225e8d2394cd899a393eac8235" +
    "98b026dbc97dcc727c79b5e571d0d11bbb580c677e7bb77446a7ea0a5a2187b3" +
    "6fdcc5bed83a1c29ebe82a93bde1ed91bfa36683960933e2df7057deb9fc14a0" +
    "52b4ecc0182caefeffa42853172e51475b10f3c43b2b41bad630e9e4b2cbad7a" +
    "5436868ef6bc248bd281cf5fd7971a7f1db861a920e3fadd56680d274ba26e05" +
    "2cc63a1b3ded4c90da12e362a73b6a4f8ad1dc7ffcdba18bf379150e4dac6e2a" +
    "168323347ed2643fe970f4f6ec4096a681c30414273160cdc00121d4332b65cf" +
    "e692eab647b79b5bbb10aa4135fd4b58e2c7190553c1ddd8d09f1cf98c78d38d" +
    "c92febabcab87c1e0f5fa024bf28a3a5f1f229f8beb3a25e2d93d5d60894b08f" +
    "ce9a1f0c488ea4a852e884519d5d89d75c825677f7032ecc394599851dbda9f5" +
    "065913b2ba9871de95306b7425feb4e47d684a757ac89e4e6d222097380a46b9" +
    "445511076187c2915ab56cc59ce0fa736f18e169df63760bff0032261a503cee" +
    "54b1c4cbbcf0ef0943d9fbaf49e73e8667366642800d88577b7202e51737adae" +
    "0c551f18cf2f75390ee513a6485e9e02230f6e356aff96a1a984e94d86301b9a" +
    "05a3f073f6c571c4abaf2c34918bb18e43d57e3d0ab6fcd256d0eec894b88fc3" +
    "be3c5d7a6872877f76dbeae159379deb904f6fb2c2cb0b77f1d3d7e24e620711" +
    "128a7d58f73a2ae35738a080a84297ce10516009dd069bb0e8ba46a763360d8d" +
    "9c8c69a55450b9f93ed631175f641d497974ec81a26cfb20aaefad33282624b7" +
    "00fa6d227bcc9f894088f87c2e83b5032d781cb4c953d9a4c13b145a9215322b" +
    "95fd67d8d401fe44e4854a47ac16e6bbd1276699cd04caf298bd08da4be0c7e7" +
    "b370f393dedc5b454c6582f41a6baef5296141c6c0191e21253f5cdfbf52bced" +
    "74e97516b438d6528798a36fe51af66c018d5ad89335ab3bccaa7f037aef33af" +
    "dcdac0ad65839d3624e345fb11bb2c3739c7fe7bd5b5caa1d1b87e32c246b6c8" +
    "4484c9a5c18261f55420a2e7b319eab160349094e0a69a23ebc59c56fad05c1c" +
    "2d9695cf81e164210bfc0680bdb0048ac33d730813bf9fbc1d028630d71b1f15" +
    "4edd3fe2ee6b4d2ef0b7490e0a5d298948e82f4c4b58173e778fbe698e99518c" +
    "53d46a921ef8f40063d988a09bdb6726a80778712a3141cb0ff14a0d79123c55" +
    "ff9ecefdde62ac85f7ae4247727c687057f2276e50ba055ff9915e185b596d4f" +
    "2b2528431497a9a42266090ca7c6e4d2cd8bc4ecedd3763ae6107db9f3b2df40" +
    "56c3e0fe704361794dbde6aa1752cd221e3dc63cecc1e4ad6abaf42e04ae0ed1" +
    "b3abf2dea8a635b78f2794b459f689f15ab2b6af40e12f45ee15df64ea8bd9c7" +
    "25bf087463d8c53623f7c81803978c7371fb3a65193b28c00006d0c2d77cb511" +
    "93ed32101ce37ffc51dcc44cce33983454531af5240c82f8021ffa9e83cb857a" +
    "759ca1e7629f49726bd5572d584b4a378709eb9569a76ddb8dda6e6c3e0ad355" +
    "26991d9dd23f075c8ae841a0014642161330b9dd0fcc7e14a95b8eca50d6bbcf" +
    "21ff7bb8843976f047a33892ef122a0ba2a496680dbc5f1b5e312c9abe4ffdb1" +
    "4844c991ac902b209b05606f4e81d4f986e58878e9775d6729a5f3b0e27d8066" +
    "c0d7af022b2cbaeb43e407aa7f19390d9b74f1d39e6493f03bdd78d29de12ea8" +
    "894b035dcb6ab52a718dee1250d9ff998f66243d32978262f75a1c167b88cc48" +
    "5f0bbbf55c7aa0efd5b6a57dc9fb57d455832108b395406144527337cf0ca6dc" +
    "349f11257e319076c56d2781e9a2e6f65e1d14844d4c0f3035a7051aac10d84a" +
    "edab0e6ef88b8e283e2696fadbe74106c83f45fc562fc353fe67299ccdd61787" +
    "b1543c4f858aeace22c4f95146bfa9d142da9215a4b23323795b1bec80a16be3" +
    "5949cac1e09409f4f29a727ca36c2d7001e865c7bedeb01f91dfd0bdae6f044e" +
    "b40a75f3c269381360adbc36e23a77c663b88620b7586847008c1ee51898b9fd" +
    "6db2812f2c8be5524d50df9406650c1e6bf8b54345ac53496a273f0b0539c59f" +
    "7969ddfef79b11aa98b923029a3a3559d4ebc496cea69719636676d1afb46455" +
    "3e07bf319d12589925c0749e3d8d905c8ae262e7fffa952a1d084bc7f48e78d3" +
    "09b091c3e08feea45624574c75ae4814849217000310f19cbd28687dd85489a0" +
    "c2f5423446f95d2becfce847bce9cfdce4d6b386ea32c8131c93b13651827015" +
    "801b0d873bd23c0a85c1188316e326c6cd297bb72dcacca2be88da77414433a5" +
    "30db2eadf6716001d022615fa8a3678cab4e1f1a7ab6fb5ec9eff340bb04bacb" +
    "f0d97ce17fa16cdef20f5b4a20a9735ad538fdb8216e7237a76fed4f0ed7e67e" +
    "76b294b079f4a6ab4552a0c906c5823df5cc04e34b4e1d5e6f3cdd244c49bbf7" +
    "60bad7b5c0772126673243fbc798a4b3d4f8e51103866c9fbc23502e5166e19a" +
    "6ad990732fe9538bef83126901fc15fe74e4053b38407eeeca0dff93e71c300b" +
    "751847f9ebaab985f25837cdc3ced6e0d02c14c2c8e6acdf2072aee271a8bf48" +
    "9131c1f025a28afa0c1b68ea7cbe9b349681ed5ae8448f7a3a0280920063655c" +
    "0a879570a98d5d64b8daf633617d59411f0889cfdcb11ec6134ad2b6288c0fd8" +
    "35af9e22398e88a319adcb10a162a5b756782a6b297f463e4f57422d3f5b9c09" +
    "54974d552799fdecdbd1b4166ed307d57b17a7c4de0ef11a5f2b84bdf36d9d36" +
    "99c8588fdbfc79417131e6927d9697ae8af1c0bae0b81e562921398046c54c07" +
    "aa3759a0381050a38334c4572f8df73aca1b1a443d865ef272eea99b3e633c04" +
    "222603bb2bb1f67525f927e514b008e8cfb3e2a50af081fa4f4052897643c717" +
    "9865ed886760a447327f36d17a6294247bb6b7a10e2de96aab236bd518bf9fd9" +
    "c3fe48dee7788e5b12bc2afb874ef315da84114dfd7e707c6f35c15fce9368c6" +
    "eb300fc9907719136dddb21cf501167491d3d82cea5469df95851d5aa88cb928" +
    "cba26c5c0c61cc4a06e4be4b45d7d009492e9c66d23f8b05c202556ebda6ac53" +
    "5133ec5dcd9af473d6af82ffb5b4a79eef42e3e10df81fad9d003b0bdc6420d4" +
    "fff723ad8ccc5770955daa37b7694c4596e904643e16fcf9e583ee47a34af3dc" +
    "6219654dfd6b8f3a8038a09dd0335ef0cea77a110d5b0739c7db8d20a5ac826c" +
    "55a90be3291e2dd7de59280caf31be7f79723db06f2b10dd8566d8273675f50e" +
    "025c98dfcfcbbac35a424652bdb58a81ea4bec9377ae74e2b8b1638b9bd4607b" +
    "6e031225faeb902641492105f49792e62215b27e1a0f9cc24fb36a44efd9173f" +
    "6d3086bfda0ac448765306c073ca991b2c919f1d7d43fecd1861091c56c52401" +
    "a8888e54d1138967a62e50bbe73578ed9af8c6b63c3b14514e68a1d258a25f40" +
    "ab3494008471d3f11fd6f6b42fc908c8c187e1fbb9a47c32e02ae4d5e8bcf29e" +
    "704f95e1dcb109acbea9784181eff3de86df462a29ea2e799039b4f697ca4de4" +
    "1ee5bb9f58279bc7bfd6fc305d7a0763d1ecd093992857db050e36448fc267a4" +
    "e8fb83dab92c6bf2b2ba821115f449d3806aa372ce247f91d97d0da885261fa6" +
    "4bd5d787f7d24c660ab6a1eee70bb5044801c16fcdc9a0c4233e0310a2c5730c" +
    "5988cb1a62a5964e6471b7f8696dfef5cc538c33c8132dd4e2688e9298ffbc8a" +
    "9a5461e002c351771c2bab8b75a747509c4a84456e3c206076655caf40e3f114" +
    "6c319e35563a3837adb0ebe69d2f323f227ec00f2555bd08ae34cf18e9748952" +
    "fd1dfa19f98d947b435a16dd0012c65b7c3bf0425eaa3d171b5fb3d8ed06b821" +
    "d78892fd7b11eb77bc4917c44b2d23990b489c244a6f397ce24d962672b8a645" +
    "afd9077833d04138be66ad7d30efc14cdbe9291fbfd11643ce9dd8d4a2c0222e" +
    "750857ed32f58c9f5669134e5ffb79aa1e8085b425c534cb5e5b10ca3189e573" +
    "4094b7dc81b00270aefcf1da4f51df68e791a15019d5580076d6ac74eebbd382" +
    "0c8aa83567a7c32beccd8bc8953d2f1a6e460d036b7eba368305591c0ff3fa93" +
    "f98737f43ecc61deb90a27f76a60f8b15a6dea630e9864a3e63f5c2842a4e152" +
    "3c0471f284c9b2e08ea5abff65201bb3d22ab5188fc612cfb6157f2c4790f69a" +
    "7a3a1d6c06dd09e886e4bd44a08df0629b9e1455e3549753a9015dc2c73b21fe" +
    "07603b6b492c57f97674ab7735d93a3c26e3ba8c960d29d7a0ce80254730847c" +
    "e61f148a46c0056e3482b12ef21121f7dcc637e81ac2ec87696c40ed169b1ec9" +
    "b7394b9210902f221b0a1281f57b6a535c2042035063cd9a6f1585f1dd734328" +
    "cb95e1867ee744f8418304bfcc0cc4be88b85a246201a7a1aad451c1f3a6c593" +
    "75bd0e0655582ab4da64ac54d3fc68a4d1569e8efdfb7fa272df97c717f4f64f" +
    "66233fe948e2ebc399318d98ad189dbc8f79de0f45d89ca88927fef0597d3d1c" +
    "32095ba9615f0b5d2beaa3b03371d54cb500c87a6d02ee67e594a5708bffcfbb" +
    "4edbb6aed2efcae49f08b2364d38783ee0af2db91d5e65521391d6fad019b34a" +
    "c4cbc292ef1a287c7e53fb02386d6b2934b65d4ce2f5d3908271edf67a7f9116" +
    "01ca08a649feff33d873d907426a880ad4ae93062426cd59c758f2b7d605e685" +
    "12c3fc36b01c4f27c51925afdbe187cef7a810e9bd64d51518c995705e7b5cad" +
    "d145202ef36ffa14525111c132bee0572bb8480f8c9e68096199aa1ebf1b809b" +
    "13a704dc552da9a430c8b1b33e6c22a356cc35f1eae4783d03632f46ee8dd297" +
    "3be779663a8976babbe354210b00a172ebd73c0c41505f8a96da8e17379a0e6e" +
    "62b4e8d0ab4ac0677d5a83fd47a243a58be59ff84e3f44b59865392a1f74dd84" +
    "df6940c6f9f49d77b260bc0d9c864bb975f0ac8fa0315b941dde4d2c2381cfec" +
    "8b6de88818733be98cf150d5444f30b192a1c9ed97f9f0fdc30b0d5c6a0e8a66" +
    "d8eab2742bcbb07e40ba422c607259027baeada829277c122e4815431a5fb7c5" +
    "ef98aa8006c64a94c4330ce2680782246923e36c265204161ffee54df3819184" +
    "dc4be15d194e9dbf9c7035d438555108773e6b67bcbdabff49e722a39b99dbc8" +
    "f2715ad18fd289463ff6c0349ff864c77d32a6eed6b3793a20050114a4ebce86" +
    "216fcda0fa96acaf1095e08e763dfc8713540ade5309b9cfd0d9369aa2a5585b" +
    "f7da2aec25e67fb517b863a7c178d76e2f8d85617af51b93119eca3c5ef431b4" +
    "cc83454c4100561c90be1edddf3928c2fbbb372d62b6476557751de4a903d30f" +
    "6c51daec1fdeef117208ce3a3f924a1c5b1e8b43a04fab730daec617d723e0c1" +
    "37a97cbb0298e6caba5413b538f3643146909b244583bd9f63f0d3f83d8db1d5" +
    "825cc5e98c4e297a3c326eb45e19d6c3dde72e212c20b7e1785db9dfd86dd401" +
    "e42f35cc0e9cb69987368ec8b375f11dfcc7c0e5ed2d2b1b59ac68a3477bf430" +
    "6b090f4dad12dc223ea674f29deea4570581708f034cd148eaaa568549d279f9" +
    "8ae365501869f7a127c425fa96cbaf7d526a71977741bfa267e855409e3b5a66" +
    "a510ffd9a815bcbed00bf689f5005862cd06b295c98688fe7f6184eb07264bb0" +
    "0c0480331afbe244765fcfdb34b8c2399a0a28916f7e949353a742fd2a146016" +
    "206b53f94d1f3bd7aca57d60ab7f6947a6ce9ad2ccb7750bd4a070d3db143fbf" +
    "b6b3355d2a5bf1da7c6d3240169bd1c7fafb614bc21d1aa49774a19ee499e12b" +
    "4ff8fdcb55ea50b4a76a516c87397266f38bfed9d868f726173077255e951c12" +
    "3a15d5df8c4add88ec54c91ebc71cf2243452ff5980e09c0422e2db5d679c859" +
    "0fb29f67943eef52033691389d7380aad0926ff6a87eb88d63c4bbeee94ce758" +
    "baae7a4805b96e8a89c381a3af76195f8f21045c96e0a902297b934e649cb00a" +
    "0cbef0c18e0de8ad01dc18e5fc06ed62bd3c3728103d33271bffa2c607238378" +
    "57deeb8665569041b12449e6cdc58511342ce382f25a081346440084e231caf4" +
    "7c3f6c1e79323e1f6d29a05d4ce9dae0c7d9ba2512e6b966adcc5bc837b08d72" +
    "ff62bff4a9ecf0859d4a43c9d70897005a90f230cd414d0a87073b5401cf5f22" +
    "f9237093716e96a7fba2f888094059b22f28a66bd1eab6fcbe553c4e80671cd0" +
    "ac4713f78375f3eb7f2e5c7a57e1f1768eeffd4b03184952619b4845950b0de4" +
    "8f3a92dde36f0fa3866aa59fb5c0f6ee35ed7e6526e8fe73bc7b3889b1aa9a8c" +
    "bbd43d2cdc825e680e4491202bc3561927b3e2b49e78dbe5d614f52dd5c24f17" +
    "1d461194b71636991ad89850c6ab02c4811b045115a1ae245834c50c8a0577b8" +
    "d2dea4397d2acbcace42bdc169df6310fa31a8063360539c74848be7af6421d3" +
    "afcefc2b652cfe25578ce122bbb6f4990ce00d4b5d189426dc5c6a01a0acebc8" +
    "77cfca8d51c955bd113c2e97ef002fb2c15b7df75ed18147860f90fa6b3f0246" +
    "e729ad0a2a2769dd0889b9f5053ecd2df6e67fa6ba6e234c541bec3684d90b1e" +
    "3a9253d793d5a366647b72cbbe03c0d22138f3a7e49a6dded0968b070931e54f" +
    "633b0471ff13b8986710fbbfa116d86274a25632ea5f607678b76f41f8ab497c" +
    "c270839bc7a49fb382404a5a8e73e2f99c8a15db44c391f21afdf033aec45217" +
    "4839199de8ccbc8f7ea51cc5ee284e87b150207a1d30b56c427514f124584d43" +
    "e9b045da9559df853dc60e79d335e38012eda99e61883437d6b4d406aa1fa868" +
    "efc2cc87643ccde71b519f959e1138521ae0a6ac8ab05530078e241581d7bd17" +
    "bc4b05ba68d1f22eb1e1e890eeb87ce357cf7b9bea5e5fa85dfad4adb34d1c88" +
    "2c2536aac00e22c9b56b0c218bd3ebfdc8a70f6cec0af6bbab54df840bf93df3" +
    "4aed1002aedb8d652de46241761f3aff91d2d9d6e21942169c0da5deb9c7dc44" +
    "7a8f98313fb6439771bf787fa12a6d50f84746e5dda280795aa91ee9d0038663" +
    "378369be32c3a44f72496a23487d35c133349a828c99597e5828b7fbc66f1d56" +
    "6e0192c44e776706b4da08fef0f5943b3ef1f42796cae6144c9d7393c5b27540" +
    "12295c2f742604cb1853af66d55b00892b7060fcd80920ce45a313618539f7a0" +
    "bbdeaad6c719da095cbfbc10ba8404c06d0e4a028c27b59f17abaf4111715fce" +
    "0b3a86074b61b44eea98978825435aade15dcfe791a08e34a23b72faeb583735" +
    "281f782bc8d467839b2d211ec4b27bc530ed38a747a3323cd53d13c32acc2f3e" +
    "a8b8d7ef42e3e292f2a9ddae8948f84505ec70f056ac155201d9fbd10a24b654" +
    "33fdbe6f80538a7c6bb0a42977cad2397f9d2cdb55144fee0c93e094964c6587" +
    "227616cdbdcb8299446e6349e91d06088b3f739568dfe67446f37ee58f31b769" +
    "660f79620381f7fe1b0df175505751c6b3b9a6e81c9aa5c9a16a8d9e23f6c260" +
    "26d02eff1a5b856459f900dcf59cc1207dd35e3690fc4dd840b1187a12e46cf4" +
    "fad21401702b56bed32ff68f94bb03b8cafbc40e346f68c71fba285c19d83acd" +
    "cbcc32aa4800e5c8c61d1ca9eda0e747eb62837a609ce99ff3376dd0886c179e" +
    "359d76bda3d18d8a77b13d5007df30e4f5b7f927a206f45d5e4e825495b65b59" +
    "31acc596b58cc24c4df1a44508a5b302adf7bf9064cefd3f13b03678914f9b18" +
    "108740c3c971979358654449de267f2174c167732a61123c2de892ff99b2afb4" +
    "0479532955b90fe238d7980aabd4a8c0d5dcae423eea6685203b5725fee64311" +
    "8e9af0692c72eed95222ec7c4b2ee1846323cf7b4a0cf8bcf28109051b6adbd6" +
    "8b7d1e1a0b6ee3895fef7e5a8015e0dd416b39a78651fcda24167533a1460da6" +
    "35848dd70bb550fbf28f2156125ebced02ad437a09611a169be5b02326b88615" +
    "8563956a1ce0660e146f40decfa796eceb710dca7da58a76fa03c2ac3b3629c3" +
    "f03a33a979209a4fccd94cff92f3bbb7d4e842bdf459105acd6c606d9405f6c9" +
    "f168aa80e70c5c312e135b061d891b3c9c37efdafd919fa0ddbff801c5eee48e" +
    "a6787ecb5149e32508c63f67b490328cc0df4100112ddcd5e1fc445439e9a8a4" +
    "2ace1f9d580a2b97996bb97fd62762b645c7a11957186ed2fe8207a34e877473" +
    "8188d3a22f38229ee64a3e7753287083e2af930f04c86572b25246c4db984bd1" +
    "34c1ea3d6455b1f78bf5477c4d7bd8b35f17ae2c5dd01ebeab24f969ba487530" +
    "4f93cb45ca51cf427af6f29d0904b959eefc2c21dd83bd299c700ab6b55a66ea" +
    "82baceed5da83d806b5f1f9f02129490db6de6e1177cbb26cc8c5ee40c84a63b" +
    "6474d150ecf5e5c1e055538e2ffdf7b1c8ab674c60df765805927b3895e375f0" +
    "35485b0b16e9d8e78897ae918d6931d31ba26114d044fbad083768be777e181c" +
    "652df83cbceb0d224aa1a32a4743c3c6acd48bf3327901e2c920b27dd22e239a" +
    "06f48578b74bef3f3a63ded96a9973c424101e4daabf27c7c07f4186da0f89af" +
    "ff2bfa1dd60ee8258a36a5520346c26e4ea015348162d7b0f1b313409bb81a5c" +
    "56a9f9a7546f0033feb496199e718f7211a49887303928493ecd6cc5dc07d557" +
    "f453fa8d8664adeae7e17a639897c7c0d63207cd69baec14167ebe79d8751873" +
    "acefdf52f974c3cff34ae233852130cebb00b5c5a2c19f51e0503eb8414f36fb" +
    "d9a0edc46c9aa45deba155907d25a55a7b1d1b0e2672f76a0c844cfe89b3d14d" +
    "fd3b5878c9c2128c3888ee87cb837177d3349423ccf8674b15b6d0afe92d9cca" +
    "c6935be69e3afc43bc28f17f3576572fdae8689592d45f2be3f082101a462cdc" +
    "5c0d458a6e17dbf5199b607ca320bf3d6299a9f2b14065612e390256dd4eaba8" +
    "8e0b8fb054274804e4429196a606b78b9d6dbd3703c82a08d7473fb901b40f24" +
    "663c4411051fe559705e0a6f49de13ae2281d5f6ff2909b23180a76b1cd2aa1e" +
    "990a607641f686b86be13770c608909587a633abd584f907b6227ea3c7b9e388" +
    "835dd6d896124b098f01fc7c6a307f18fbe739c87b6f16d782ed4389e0af27df" +
    "346c4564db401967e2fe65acd450a45cd97ddd52a5c30df51b695f23f47454be" +
    "3a312bb7c26251ba79e98a47d0100cbb8db03661e85acbaeece6b294ad05ee91" +
    "bd0bef721f2a354d1c569ad3bfdc983f4a258085faeb244f92b39f63f02600f3" +
    "777a4caa38f18cb53da80f28295e9c49e4a1932ca98b75681e0244c1581542ff" +
    "9ece4e3e1acad232cc8ecd71cf031114fdc457a0ea813bb4202166e5bc59f8f7" +
    "46c99d78556d13dad1c0f2dec5a2b13c1d532f736e2d5b2e060ea79b48170497" +
    "1cb133875ebe6195c3fb9b122c71b4dc5d6e55261e780627fcc1176ddb899fad" +
    "2a77d2501af2115fce3559ee044ba93a2b0363a3935a578343c8824c0ec6e648" +
    "4eba6bb3900b3bfa8e8f6667027d237681fdc021f5207bb7f9166f99a7844136" +
    "ac30696aa1cb7c85601f8bd847f4e99dcdede1d43d7949b2c2b9c43274252918" +
    "b60c8ce0a614c5a8ea9e10968addf8b85be5a4ff75374442e4af1da005545309" +
    "24eb3151cae2084597f74f9298ccf1bd687f52d69a7301d03ff6c7df2d3eae28" +
    "5cb565efa21b6280bf72d900342ee38d91d7aa15e719070dda226c4d0ab0d156" +
    "88f313c940ec4a2fbb9cbc387edeabcf58f0d370643c0f4694fe7a86e839d5a5" +
    "42ea4d1d23cfad978363f9059b57dce22b5eaec81341d203ed65b54f541cdefd" +
    "0a793909d086f6677d45ba50848df292be4c94e5cd2fd7cb209eec12a63c3291" +
    "08b23a0efa71f16b667673da344926c9f71aa9986ae1aaa57ec3950cf0d94e81" +
    "a3f838e627e7b4eea12a7277e9563f8788d85a1bbb6cc246d319df018c535c55" +
    "b08bfc17e4efc7d1d52858ab109ccc6847dbc48e0f370d64523e8aa7997c2c36" +
    "7fd62ddd7448e0217ab744189d07605135b86e5d80c114f3629f596da200220b" +
    "787b40c090ca61a0f49670b15bffacd425fbb3433382af6fc504f530e8b65f8f" +
    "bf11024bb989311f759abc3b2969069315bd1ea44a852ea8eb16fecec624e33d" +
    "d744cd97e41ef87a91ec50b120af89f3d46ad321725c188209ba3f4cc2e68768" +
    "e05170366758160574889c0ba1c931f02bb66d55ca8ee20f694f6181bc79f249" +
    "3b452a57e8dc9083c0fe404162631275d5fb394bc524988cad06c4acaada2d3e" +
    "d230647f9a2cd9a503e1867ccbbd7d600273bf5de3a2a9ae32a01d9f8437f65e" +
    "9b9600156e4e1046c8230e14be19018db8947eeb3a7b386f26f9f15243b7c3b0" +
    "34de1778c11a8ad813f7cf1b041f3c224dfadb485b92083d5ab4b2d0eebbed99" +
    "a70dceffe5b3a80a5f7185a325dfab0753c66b5627ccb9d18fa48b9565d69359" +
    "e980ef762f1cb54a35dd119d77c728f4662947542e42f5fdfc6c33e7ea9e0ca6" +
    "8b6eddcc9a0666e005e878d0fc248d0c1788eb1d5e1e324bbd7aacce2c68fd6d" +
    "3df86a01e128877f8ad327fe64e9e7ef3103d94c19795271f27b91a914abf75d" +
    "04ad9f354f22a6b162aa46612eb67cbebaf4a7c29075f9ed2a4d55c0b999cfd7" +
    "d10f4925c4a5e398c620420a96833e800950a26b12d8d5d46ce2118e1a6fa876" +
    "b710730dc59295ff395482e5b3519b639774af265b48dac3c95f2d85b89e3afa" +
    "94a4a12f4323f1cac81ff58177401b3b08e6b038dfb2474a9c413ca31657fb02" +
    "d20e4e602bb57deac1dee4a09d15f0ae0b59365cbc331837c78486458f935300" +
    "1372cb896734dc58303fbbb4d6db652921f670bfec697ef3cd8c56ee1c5a4407" +
    "24637db5fa486f1678a9c4e5bc080fc5c0dbcf5e895165d92eab2cbe75f75da8" +
    "79981799e39f3f55b81541b41de677dac91a3bd2d4af46ecd79b1f32ce69f4fe" +
    "2f748f40930331c784bbf519e288ffd0e09425a014604a81ac43eacb271ce762" +
    "1e4d450156b0d661de703e0db7a14b2d3ccc5f7159dc375c82e46bb65a3839f6" +
    "58f09610864ea39a352647d5ed9518060c7bebbaf1914c490452908d229e33df" +
    "a55b833d7f8ca734c87376f26d8be92bc19d11eeca97c228d89c0030e1adfd20" +
    "b287bfae6409d1e86cf354027ca22336804f07852192eff93addb1b36672a48a" +
    "7a507e1baacd440e6a4205a6fcfbc36e8ed30a68f853572abd13c612b9290b67"
  );

  class DarkCryptKamekoAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Kameko (DarkCrypt)";
      this.description = "Non-standard 64-round chained byte-substitution cipher from the DarkCrypt Total Commander plugin. 64-bit block (8 independently-updated accumulator bytes), 512-bit key. Each round mixes 4 static S-box lookups selected by a key-derived byte stream built with a MARS/RC6-flavoured ARX+S-box mixer followed by a modified RC4-style scheduling pass. No public specification exists.";
      this.inventor = "Alexander Myasnikov (DarkCrypt \"Zarya\" project)";
      this.year = 2009;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.RU;

      this.SupportedKeySizes = [new KeySize(64, 64, 0)];  // fixed 512-bit
      this.SupportedBlockSizes = [new KeySize(8, 8, 0)];   // fixed 64-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Undocumented non-standard design", "No public specification or cryptanalysis exists. Not recommended for real use.", "Use AES or another vetted cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Kameko — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("9cd697d1f1d2bc61")
        },
        {
          text: "DarkCrypt Kameko — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"),
          expected: OpCodes.Hex8ToBytes("e7550435398a572f")
        },
        {
          text: "DarkCrypt Kameko — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("1011121314151617"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f40"),
          expected: OpCodes.Hex8ToBytes("8359f00dd5101cf4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptKamekoInstance(this, isInverse);
    }
  }

  class DarkCryptKamekoInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._B = null;
      this.inputBuffer = [];
      this.BlockSize = 8;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) { this._key = null; this._B = null; this.KeySize = 0; return; }
      if (keyBytes.length !== 64)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Kameko (DarkCrypt) requires exactly 64 bytes`);
      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._B = this._scheduleKey(this._key);
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

    // One of the four overlapping 256-byte substitution windows (see file header).
    _T(k, sel, val) {
      return T1234[k * 0x100 + sel + val];
    }

    _mix(row5, byteVal) {
      return MIX[row5 * 256 + byteVal];
    }

    // Key schedule: 64-byte key -> 256-byte selector table B (see file header for full derivation).
    _scheduleKey(key) {
      const localKey = new Array(16);
      for (let i = 0; i < 16; i++)
        localKey[i] = OpCodes.Pack32LE(key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]);

      const W = new Array(64);
      for (let i = 0; i < 64; i++) W[i] = localKey[OpCodes.And32(i, 0xF)];

      let A = OpCodes.ToUint32(P_CONST);
      let Qacc = OpCodes.ToUint32(Q_CONST);

      for (let i = 0; i < 64; i++) {
        const LK = localKey[OpCodes.And32(i, 0xF)];
        Qacc = OpCodes.ToUint32(Qacc + LK + Q_CONST);

        const t1 = OpCodes.ToUint32(W[i] + A);
        const rowI = OpCodes.And32(i, 0x1F);
        const rowA = OpCodes.And32(A, 0x1F);
        const b3a = OpCodes.And32(OpCodes.Shr32(t1, 24), 0xFF), b2a = OpCodes.And32(OpCodes.Shr32(t1, 16), 0xFF);
        const rowT1 = OpCodes.And32(t1, 0x1F);
        const b1a = OpCodes.And32(OpCodes.Shr32(t1, 8), 0xFF), b0a = OpCodes.And32(t1, 0xFF);
        const rowQ1 = OpCodes.And32(Qacc, 0x1F);

        let comb1 = OpCodes.ToUint32(
          OpCodes.Shl32(this._mix(rowI, b3a), 24) |
          OpCodes.Shl32(this._mix(rowA, b2a), 16) |
          OpCodes.Shl32(this._mix(rowT1, b1a), 8) |
          this._mix(rowQ1, b0a)
        );
        comb1 = OpCodes.RotL32(comb1, 11);
        Qacc = OpCodes.ToUint32(Qacc + comb1);

        const mangled = OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Shl32(comb1, 6), OpCodes.Shr32(comb1, 8)));
        const t2 = OpCodes.ToUint32(OpCodes.RotL32(comb1, 16) + mangled + LK);

        const rowQ2 = OpCodes.And32(Qacc, 0x1F);
        const rowT2 = OpCodes.And32(t2, 0x1F);
        const b3b = OpCodes.And32(OpCodes.Shr32(t2, 24), 0xFF), b2b = OpCodes.And32(OpCodes.Shr32(t2, 16), 0xFF);
        const b1b = OpCodes.And32(OpCodes.Shr32(t2, 8), 0xFF), b0b = OpCodes.And32(t2, 0xFF);

        let comb2 = OpCodes.ToUint32(
          OpCodes.Shl32(this._mix(rowQ2, b3b), 24) |
          OpCodes.Shl32(this._mix(rowT2, b2b), 16) |
          OpCodes.Shl32(this._mix(rowA, b1b), 8) |
          this._mix(rowI, b0b)
        );
        comb2 = OpCodes.RotL32(comb2, 11);
        Qacc = OpCodes.ToUint32(Qacc + comb2);
        W[i] = comb2;

        A = OpCodes.ToUint32(A + P_CONST);
      }

      const Wbytes = new Array(256);
      for (let i = 0; i < 64; i++) {
        const bytes = OpCodes.Unpack32LE(W[i]);
        Wbytes[i*4] = bytes[0]; Wbytes[i*4+1] = bytes[1]; Wbytes[i*4+2] = bytes[2]; Wbytes[i*4+3] = bytes[3];
      }

      const B = new Array(256);
      for (let i = 0; i < 256; i++) B[i] = i;

      let carry = 0;
      for (let iter = 0; iter < 0x300; iter++) {
        const i = OpCodes.And32(iter, 0xFF);
        const Si = B[i];
        const Ki = Wbytes[i];
        let j = OpCodes.And32(OpCodes.ToUint32(carry + Si + Ki), 0xFF);
        const Sj = B[j];
        const x = B[Sj];
        B[i] = x;
        B[Sj] = Si;
        carry = Sj;
      }

      return B;
    }

    _round(B, state, r) {
      const sel1 = B[r], sel2 = B[64 + r], sel3 = B[128 + r], sel4 = B[192 + r];
      const a = state[OpCodes.And32(r + 1, 7)], b = state[OpCodes.And32(r + 2, 7)], c = state[OpCodes.And32(r + 3, 7)], d = state[OpCodes.And32(r + 4, 7)];
      return OpCodes.And32(OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this._T(0, sel1, a), this._T(1, sel2, b)), this._T(2, sel3, c)), this._T(3, sel4, d)), 0xFF);
    }

    _encryptBlock(block) {
      const B = this._B;
      const state = [...block];
      for (let r = 0; r < ROUNDS; r++) {
        const val = this._round(B, state, r);
        state[OpCodes.And32(r, 7)] = OpCodes.And32(state[OpCodes.And32(r, 7)] + val, 0xFF);
      }
      return state;
    }

    _decryptBlock(block) {
      const B = this._B;
      const state = [...block];
      for (let r = ROUNDS - 1; r >= 0; r--) {
        const val = this._round(B, state, r);
        state[OpCodes.And32(r, 7)] = OpCodes.And32(state[OpCodes.And32(r, 7)] - val, 0xFF);
      }
      return state;
    }
  }

  const algorithmInstance = new DarkCryptKamekoAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptKamekoAlgorithm, DarkCryptKamekoInstance };
}));
