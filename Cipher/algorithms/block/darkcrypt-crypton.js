/*
 * Crypton v1.0 (DarkCrypt variant) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * The CRYPTON block cipher (Chae Hoon Lim, 1999 AES candidate) as implemented by the
 * DarkCrypt Total Commander plugin's "CRYPTON-v1.0-256-OPT" table-optimized build.
 * 128-bit blocks, fixed 256-bit keys, 12 rounds (11 main rounds plus a final
 * substitution round), little-endian word packing.
 *
 * This is NOT the standard CRYPTON v1.0 reference key schedule/S-box construction
 * (see algorithms/block/crypton.js for that, which follows the NIST IR 6391 vectors
 * exactly but does not reproduce this plugin's output). The "-OPT" build uses its
 * own precomputed round tables (four 256-entry mix tables T0..T3 for the round
 * function and key-diffusion stage, plus four 256-entry byte substitution tables
 * used only in the final round) and a key schedule built from those same mix tables
 * via a byte-wise table lookup ("EK" stage), a cross-group XOR mix, then a 12-group
 * affine diffusion (whole-word rotates ROTL8/16/24 and per-byte 2-bit rotates,
 * combined with fixed round constants), with the final round-key group derived via
 * an additional GF(2)-linear "phi" mixing step (AND-mask/rotate/XOR against four
 * fixed 32-bit masks). The decrypt key schedule reuses the encrypt round keys: the
 * first and last 4-word groups are shared verbatim, and each interior group is the
 * same "phi" mixing step applied (with a cyclically shifted mask assignment) to the
 * mirrored encrypt-schedule group.
 *
 * All constants and tables below match the DarkCrypt plugin's tables and round
 * constants exactly. Test vectors verified against the DarkCrypt implementation
 * (crypt/decrypt round-trip verified for many probe keys).
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

  // ===== TABLES (matching the DarkCrypt "-OPT" build exactly) =====

  // Four 256-entry 32-bit round/key-diffusion mix tables.
  const T0_HEX = "234363602ccce0ec194951582a8aa2a81bcbd3d80e8e828c2646626400c0c0c0370733343c0c303c140410143fcff3fc13031310044440442989a1a8118191903b0b3338384870780d8d818c2fcfe3ec02c2c2c02a0a222830c0f0f017c7d3d4214161601e8e929c2585a1a43c8cb0bc084840481505111412021210074743442dcde1ec024242401a0a1218330333303808303808c8c0c817071314108090902686a2a415c5d1d41d4d515c254561642a4a62683ecef2fc0f8f838c2181a1a0138393900acac2c82f0f232c0c0c000c28486068184850581fcfd3dc34c4f0f405454144110111102080a0a02787a3a422022220168692943bcbf3f83d4d717c1d0d111c3484b0b40484808420c0e0e03f8fb3bc1747535429c9e1e80a0a02080e4e424c038383800cccc0cc3a4a7278314171703909313807c7c3c432023230344470743d0d313c1eced2dc1040505005858184060602042f4f636c1343535028c8e0e82d8da1ac028282801909111821c1e1e03a8ab2b8360632340bcbc3c80e0e020c2808202833c3f3f01b8b93980a4a424822426260148490941f0f131c3d8db1bc36c6f2f4274763640141414018c8d0d811c1d1d02d0d212c2484a0a4068682843787b3b40101010005c5c1c43080b0b0354571740202020039c9f1f82c0c202c290921282e4e626c12c2d2d01f4f535c0b8b83883cccf0fc1a4a525824c4e0e43f4f737c1dcdd1dc07070304154551543181b1b02b0b23280989818832427270180810183a0a32380c4c404c3686b2b423c3e3e0008080800ecec2cc094941480fcfc3cc2b4b63683989b1b832c2f2f00d0d010c1cccd0dc24446064158591940646424437c7f3f4100010101a8a9298200020202282a2a03f0f333c16c6d2d407878384304070703e0e323c210121203dcdf1fc0d4d414c3b4b737803c3c3c02e8ea2ac090901080a8a8288040400043383b3b01444505438c8f0f830003030000000001646525414c4d0d427c7e3e4250521243b8bb3b82c8ca0ac18889098334373702acae2e809c9c1c81d8d919c0f4f434c3e4e727c030303002b8ba3a8128292902888a0a8034343400f0f030c3acaf2f8240420241c4c505c1e0e121c2040606031013130178793940dcdc1cc06c6c2c43949717835c5f1f41e4e525c25c5e1e434043034364672741c0c101c018181803282b2b02f8fa3ac0b0b03081b4b535819c9d1d822c2e2e0270723242d4d616c10c0d0d00888808801c1c1c01141515026c6e2e41c8c909c374773743e8eb2bc19899198230323201acad2d82bcbe3e8124252502e0e222c3585b1b408080008050501042c4c606c3888b0b81b0b13182383a3a0294961680c8c808c13c3d3d0004040402606222431c1f1f004c4c0c41f8f939c350531342ecee2ec3c4c707c0b4b434816061214";
  const T1_HEX = "8c0d8d81b03383b364254561a82a8aa26c2f4f63383a0a329819899100030303dc1cccd0f030c0f050104050fc3fcff34c0c4c4010110111a42686a244064642ec2ccce0e021c1e134360632bc3f8fb3080b0b03a82888a0c003c3c35c1f4f5384058581783a4a7294168692f032c2f22021012154144450480848401c1d0d11b43787b30809090168284860cc0cccc0e020c0e0202303235c1c4c5040024242981a8a92541747537435457194158591a82989a1f83bcbf33c3e0e32840686824c0e4e42282b0b23bc3c8cb030300030a02181a1602141617c3f4f73d013c3d31415051144044440800282829c1e8e9288088880581a4a52ec2fcfe3f435c5f174344470d012c2d21012021280038383fc3ecef25c1d4d51a42787a328280820383909310c0e0e0230330333e829c9e1c405c5c1e424c4e01c1f0f13c808c8c0d011c1d1f434c4f0783b4b73400141411416061218180810bc3d8db14c0d4d41a02383a3b43686b2080a0a026424446084078783e82acae2d818c8d02c2f0f2338380830a02080a0cc0fcfc36c2e4e622829092188098981501242527c3c4c70f436c6f2d81bcbd39c1d8d91040505016023436344074743b43484b090128292181a0a12dc1eced20404040014170713c002c2c2d415c5d108080800e427c7e3b03080b0a42484a0b83989b1480b4b437c3d4d712c2e0e22f033c3f36829496190138393fc3dcdf1743747731c1c0c1054154551c406c6c2ac2c8ca024260622c809c9c160204060e828c8e030310131d81acad28c0f8f8300020202383b0b33242505213c3f0f33ac2d8da1e426c6e2c80bcbc33434043070334373901181915416465218190911dc1fcfd340004040682a4a6280008080880a8a82fc3cccf0581b4b531c1e0e12c001c1c1f838c8f084048480f437c7f334350531ec2dcde10c0f0f03b83a8ab224240420282a0a2210100010cc0ecec250114151e023c3e3c000c0c00000000058194951501343539c1f8f9394148490ec2ecee2b03282b260224262cc0dcdc1a82b8ba324270723743646723c3d0d31f839c9f10c0c0c00ac2e8ea2480a4a42a02282a20c0d0d013c3c0c30e82bcbe390108090703141717838487080018181c404c4c05c1e4e5234370733181b0b13e425c5e1d417c7d37839497194178793d010c0d0d819c9d17030407004060602c80acac2bc3e8eb22c2c0c206c2d4d6164274763880b8b839c1c8c90b43585b140034343202202220407070344054541981b8b9370324272dc1dcdd1f83acaf2642646628c0c8c80682b4b63ac2f8fa348094941b83888b0d416c6d22020002014140410b03181b1e022c2e26c2c4c608c0e8e82a42585a1303202324c0f4f430001010198188890c407c7c3101303137c3e4e72d414c4d0b83b8bb3f031c1f12c2d0d2158184850";
  const T2_HEX = "b1b031817270324272743646b3bc3f8fa0ac2c8ce2ec2ece5154154583800383e1ec2dcda2a82a8a43440747d0d818c8333033039194158560602040c0c404c493981b8b31383909121c1e0e000c0c0c02080a0a111c1d0df3fc3fcf222426068188098953581b4b22202202f1f031c1d0d414c440400040c0c808c863642747919c1d8da0a42484303c3c0ce3e427c7c2c406c6b1b43585f3f437c7d0dc1ccc6160214171783949111415058284068670783848626c2e4ee3e82bcb32303202b0b03080c2c80aca434c0f4f23202303d2d012c2f3f83bcb525c1e4e0008080820242404414c0d4d82880a8a101010000108090951501141a3a02383939c1f8ff2f436c663682b4b21202101c3c003c3010c0d0d3038380891981989131c1f0f101c1c0c9090108060642444f2fc3ece83880b8ba2a4268640480848b1bc3d8d53501343e1e021c1e2e82aca53541747a2ac2e8e80840484b2b03282414405453134350502000202737c3f4fd1d819c9c3c407c722282a0ad0d010c0707c3c4cc1c809c91018180861642545000000009394178723282b0b0204060662682a4a30343404f3f033c3202c2c0c92901282e3ec2fcfd1dc1dcd72783a4a52541646a2a02282404c0c4c80880888b1b839895050104071743545d3d013c3e0e424c411101101c2cc0ece43480b4ba3a42787f1fc3dcd333c3f0fb2bc3e8e81800181828c0e8ed1d415c552581a4a41480949424002425054144470703040a1a02181d3dc1fcf83840787a3a82b8b717c3d4df0f434c41210120201040505222c2e0e23242707030c0f0fc1c001c1303030006264264690981888313c3d0dc3c80bcbb0b83888e2e426c6909c1c8c63602343e3e023c3b0bc3c8c11181909f2f83aca32383a0a232c2f0f929c1e8ef2f032c2636c2f4f12181a0a2028280833383b0bc2c002c2020c0e0e03000303c0c000c0b3b4378751581949a1a82989d3d417c77074344481840585d2d416c6a1ac2d8d41400141e0ec2ccc808c0c8c71703141f0f030c093901383515c1d4db2b4368613181b0b60682848e1e425c54044044403040707e0e020c010141404a0a82888f1f839c973703343c1cc0dcd424c0e4e21242505b3b83b8b31303101535c1f4f42480a4ac0cc0ccc838c0f8f91901181d2dc1ece616c2d4d73783b4bf1f435c5b3b0338321282909a0a0208013141707606c2c4cd2d81acae0e828c8000404049294168682800282525012423234360643400343505c1c4cd3d81bcb818c0d8d80800080d1d011c1e2e022c2b0b434845058184842440646b2b83a8ae1e829c90100010120202000f0fc3ccc1310130312141606f0f838c8909414846260224233343707c3cc0fcf6168294992981a8aa3ac2f8f73743747c1c405c5323c3e0e727c3e4ea1a42585212c2d0d03080b0b";
  const T3_HEX = "81b1b031c6f2f4368e828c0e07030407427270324b63682bc5d1d415c0e0e02046727436012120214a52581a041014148fb3bc3fc3c3c0034941480988a0a8288ca0ac2c0d010c0d42424002c9f1f839cee2ec2e083038384450541443737033455154158991981940707030cdc1cc0d838380030f131c1f81a1a0214e424c0ecde1ec2d0c101c1ccfd3dc1f052124258aa2a82a80909010878384078bb3b83b47434407446064248ba3a82b01313031c8d0d818cef2fc3e4d717c3d4f535c1f033330338b83880bc4f0f4344a42480a8591941586a2a42602121012ccc0cc0c4060602048404808050104058f838c0fc4c0c4048db1bc3d0e222c2e819190118b93981b4353501307232427ced2dc1e09313839c1e1e0210f030c0f4d616c2d0e121c1ecae2e82ac1c1c0014b73783b0c000c0c4753541700303030c5f1f4350a02080a8ea2ac2e4662642683b3b0330d111c1d848084048890981809212829cff3fc3f82b2b0320d313c3d80a0a0200622242645414405cbc3c80b07131417898188090531343588b0b8384c606c2c4b53581b02020002c6e2e426cad2d81a022220224f737c3f8c909c1cc8e0e828c1f1f031c9d1d8194363602304000404c4d0d414c7c3c407c3e3e02386929416404040000a22282a8cb0bc3c82828002c8c0c808c0d0d0100911181942525012476364274c707c3ccaf2f83a063234368d919c1dc9c1c8090a32383a4343400384a0a424081018180f232c2f4c505c1c0c303c3c456164258e929c1ecbd3d81bc7e3e42700000000c2f2f0328d818c0dc6c2c406879394174f636c2f8080800085b1b4350b23282b0a12181ac1d1d011c7f3f4370602040608202828c2e2e022ccd0dc1c4a62682a0b33383b84b0b4344161602104303434c2c2c0024850581849717839c3f3f0330e020c0e46424406051114150c202c2c030300038ab2b83a8682840682929012c0c0c000c9e1e82948707838cfe3ec2f87b3b437010100014e626c2ecdd1dc1d4951581900202020cbe3e82b4a72783a89a1a829ccf0fc3c0232303246525416c7d3d4170313101380b0b03082a2a0224470743406121416cac2c80a4c404c0c85818405c8f0f8384f434c0f88808808c6d2d416849094140323202389b1b8398da1ac2d42626022c2d2d012405050104141400107333437cbf3f83b45717435cce0ec2ccfc3cc0f4e525c1ec3d3d0138c808c0c4961682908000808c4e0e424417170318a92981a0420242401111011c0f0f0308fa3ac2f4d414c0dcec2cc0e83939013477374378a82880a4b43480b4d515c1dc5c1c4050010101087a3a42786b2b4360e323c3e09010809cdf1fc3d0b13181b4e727c3e415150110f333c3f4860682885a1a42583a3a0238eb2bc3ec5e1e4250d212c2d8f939c1f81818001444044040b03080b";

  // Four 256-entry byte substitution tables used only in the final round.
  const SB0_HEX = "63ec59aadb8e66c0373c14ff1344a9913b788defc22af0d7619ea5bc48151247ed421a3338c81790a6d55d656afe8fa193ca2f0c6858dff44511a0a72296fb7d1db484e0bf57e90a4e83cc7a7139c732743dde5085066f53e8ad8219e1ba36cb0e28f39b4a62941fbdf66741d8d12da486b701c5b07502f92c296ed25f8bfc5ae47fdd0755b12b8972183a4cb6e380ce49cf6bb9f20ddc649546f7109a20a23fd687703e21fd4d7bc3ae098a04b354f8300056d4e725bbac9873eac99d4f7e03ab92a8430ffa245c1e603197cdc679f55ee534761c81b2af0b5bd9e2276dd088c151e69c77be9923daeb522eb508056cb81ba3698cd34026f1c49f35ee7c4b16";
  const SB1_HEX = "8db365aa6f3a9903dcf050ff4c11a646ece136bf0ba8c35f857a96f22154481db70968cce0235c429a577595a9fb3e864e2bbc30a1617fd31544829e885aeff574d21283fe5da728390e33e9c5e41fc8d1f47b411618bd4da3b60a6487ead82f38a0cf6e2989527cf6db9d056347b4921ade0417c2d508e7b0a4b94b7d2ef36993fd771c55c6ac26c960e831da8f023b253fade6cb3473915619df406a808afc5b1ec1f884f735ed0fba242a10ce51e3c00059539f94eeb262cdab27763df90cae4aa20d3ceb90717881c45e371be5d77997d0d97006cabe2c6d678b9cb5432207459b72ddfa668c6baf49b8d62014b1e26c8ea5324f0198c7137ed4bbf12d58";
  const SB2_HEX = "b17276bfacee5583edaa47d8339560c49b391e0c0a1dff26895b22f1d440c8679da43ce7c6b5f7dc61791586786eeb32b0ca4f23d2fb5e08244d8a100951a39ff66b21c30d38991f1c9064fe8ba648bd53e1ea57ae84b24535027fd9c72ad07cc9186500972b066a34f32c92efdd7a56a24c88b95075d3e411ce4ba7fd3fbe818ed55a49425470a1df87ab7df412052e270fc13066983dcbb8e69c63e3bc19fa3a2f9ef26f1a283bc20e03c0b759a9d77485d6ad41ec8c71f0935db61b68e54407e014a8f973cd4e25bb315f4acc8f91de6d7bf5b329a0176cdae80496825236435cdb8d80d1e2b45846bae90120fc1316f8946237cf699aaf77c53e7ea52d0b";
  const SB3_HEX = "b1f68e07726bd5e076215a14bfc349a8ac0d42f9ee385473559970cd831fa14eed1cdf25aa9087bb4764ab31d8fe7d5f338bf44a95a612cc6048058fc4bd2e919b5327de39e10f6d1eeac17b0c5730f50aae66b31d849829ffb23da02645cb178935b86c5b02e6da227f9ce8f1d96304d4c7e396402abc82c8d01952677cfa369dc93a43a4182f5c3c659edbe700f28dc6976f80b52b1ad1f70628e2dc6a3bb46134c25879f30e46152c03ba8692c0e978efb7016edd5920eb7aa9fc3256d713b0a27416ca4c85f84f88d69423b9ad62d2504137fb75eccf5ed38c6908e4719a2411f0af4dce93778a4b5dc510a7b63e09fd1b7e513f68a5a3bee52d9f81440b";

  function hexToU32Table(hex) {
    const n = hex.length / 8;
    const table = new Uint32Array(n);
    for (let i = 0; i < n; i++)
      table[i] = OpCodes.ToUint32(parseInt(hex.substr(i * 8, 8), 16));
    return table;
  }

  const T = [hexToU32Table(T0_HEX), hexToU32Table(T1_HEX), hexToU32Table(T2_HEX), hexToU32Table(T3_HEX)];
  const SB = [OpCodes.Hex8ToBytes(SB0_HEX), OpCodes.Hex8ToBytes(SB1_HEX), OpCodes.Hex8ToBytes(SB2_HEX), OpCodes.Hex8ToBytes(SB3_HEX)];

  // Masks used by the final-group "phi" key-diffusion step.
  const MB = [0xcffccffc, 0xf33ff33f, 0xfccffccf, 0x3ff33ff3];

  // Round constants for the 12 key-schedule diffusion groups (offsets 0x00..0xB0),
  // plus the constant used for the final phi-mixed group (0xC0).
  const GROUP_CONST = [
    0xA54FF53A, 0xE1BEE8AC, 0x1E2DDC1E, 0x5A9CCF90, 0x970BC302, 0xD37AB674,
    0x0FE9A9E6, 0x4C589D58, 0x88C790CA, 0xC536843C, 0x01A577AE, 0x3E146B20
  ];
  const POS_CONST = [0xACACACAC, 0x59595959, 0xB2B2B2B2, 0x65656565];
  const FINAL_GROUP_CONST = 0x7A835E92;

  // ===== BIT-DIFFUSION HELPERS =====

  function byteRotR2(x) {
    const lo = OpCodes.And32(x, 0x03030303);
    const hi = OpCodes.And32(x, 0xFCFCFCFC);
    return OpCodes.Xor32(OpCodes.Shl32(lo, 6), OpCodes.Shr32(hi, 2));
  }

  function byteRotL2(x) {
    const lo = OpCodes.And32(x, 0x3F3F3F3F);
    const hi = OpCodes.And32(x, 0xC0C0C0C0);
    return OpCodes.Xor32(OpCodes.Shl32(lo, 2), OpCodes.Shr32(hi, 6));
  }

  // phiN: GF(2)-linear mask/rotate/combine step used for the final encrypt round-key
  // group and for deriving every interior decrypt round-key group from its mirrored
  // encrypt group.
  function phiN(word, n0, n1, n2, n3) {
    const a = OpCodes.And32(word, MB[n0]);
    const b = OpCodes.RotL32(OpCodes.And32(word, MB[n1]), 8);
    const c = OpCodes.RotL32(OpCodes.And32(word, MB[n2]), 16);
    const d = OpCodes.RotL32(OpCodes.And32(word, MB[n3]), 24);
    return OpCodes.Xor32(OpCodes.Xor32(a, b), OpCodes.Xor32(c, d));
  }

  // Mask-index tuple used by phiN for decrypt-schedule group i, position p:
  // tupleFor((p + 2*i) mod 4).
  function tupleFor(index) {
    const m = n => ((n % 4) + 4) % 4;
    return [m(2 - index), m(1 - index), m(0 - index), m(3 - index)];
  }

  function byteAt(word, pos) {
    return OpCodes.And32(OpCodes.Shr32(word, pos * 8), 0xff);
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DarkCryptCryptonAlgorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      this.name = "Crypton v1.0 (DarkCrypt)";
      this.description = "CRYPTON v1.0 as implemented by the DarkCrypt Total Commander plugin's table-optimized \"-OPT\" build. Uses its own precomputed mix/substitution tables and key-diffusion constants rather than the NIST IR 6391 reference construction. 128-bit block, fixed 256-bit key.";
      this.inventor = "Chae Hoon Lim (CRYPTON v1.0); DarkCrypt \"-OPT\" table build";
      this.year = 1999;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.KR;

      this.SupportedKeySizes = [new KeySize(32, 32, 0)];   // fixed 256-bit
      this.SupportedBlockSizes = [new KeySize(16, 16, 0)]; // fixed 128-bit

      this.documentation = [
        new LinkItem("DarkCrypt plugin (Total Commander PlugRing)", "https://totalcmd.net/plugring/darkcrypttc.html"),
        new LinkItem("NIST IR 6391 - CRYPTON Block Cipher", "https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Non-standard variant", "Table-optimized DarkCrypt build with its own mix/substitution tables and key-diffusion constants; does not match the published CRYPTON v1.0 reference vectors and is unanalyzed as a distinct construction.", "Use AES or another vetted, standardized cipher.")
      ];

      // Test vectors verified against the DarkCrypt implementation.
      this.tests = [
        {
          text: "DarkCrypt Cryptonv1-256 — zero key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("eb195fb347aef6beb7542c635e7421fc")
        },
        {
          text: "DarkCrypt Cryptonv1-256 — incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
          expected: OpCodes.Hex8ToBytes("11c5088c50f36307386e6b76bd127c67")
        },
        {
          text: "DarkCrypt Cryptonv1-256 — shifted incrementing key/plaintext",
          uri: "https://totalcmd.net/plugring/darkcrypttc.html",
          input: OpCodes.Hex8ToBytes("101112131415161718191a1b1c1d1e1f"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20"),
          expected: OpCodes.Hex8ToBytes("6cb522538e44fd52fd3d22970e774091")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new DarkCryptCryptonInstance(this, isInverse);
    }
  }

  class DarkCryptCryptonInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.encRoundKeys = null;
      this.decRoundKeys = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
      this.KeySize = 0;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.encRoundKeys = null;
        this.decRoundKeys = null;
        this.KeySize = 0;
        return;
      }
      if (keyBytes.length !== 32)
        throw new Error(`Invalid key size: ${keyBytes.length} bytes. Crypton v1.0 (DarkCrypt) requires exactly 32 bytes`);

      this._key = [...keyBytes];
      this.KeySize = keyBytes.length;
      this._generateRoundKeys(keyBytes);
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
      const rk = this.isInverse ? this.decRoundKeys : this.encRoundKeys;
      for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
        const block = this.inputBuffer.slice(i, i + this.BlockSize);
        output.push(...this._processBlock(block, rk));
      }
      this.inputBuffer = [];
      return output;
    }

    // Builds both the encrypt and decrypt 52-word round-key schedules from the
    // 32-byte key, exactly mirroring the DarkCrypt plugin's key-setup computation.
    _generateRoundKeys(keyBytes) {
      const K = new Array(8);
      for (let i = 0; i < 8; i++)
        K[i] = OpCodes.Pack32LE(keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]);

      // Stage 1: derive 8 diffused key words via byte-wise lookups into T0..T3.
      const EK = new Array(8);
      EK[0] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[0], 0)], T[1][byteAt(K[2], 0)]), OpCodes.Xor32(T[2][byteAt(K[4], 0)], T[3][byteAt(K[6], 0)]));
      EK[1] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[6], 2)], T[1][byteAt(K[0], 2)]), OpCodes.Xor32(T[2][byteAt(K[2], 2)], T[3][byteAt(K[4], 2)]));
      EK[2] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[5], 0)], T[1][byteAt(K[7], 0)]), OpCodes.Xor32(T[2][byteAt(K[1], 0)], T[3][byteAt(K[3], 0)]));
      EK[3] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[3], 2)], T[1][byteAt(K[5], 2)]), OpCodes.Xor32(T[2][byteAt(K[7], 2)], T[3][byteAt(K[1], 2)]));
      EK[4] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[4], 1)], T[1][byteAt(K[6], 1)]), OpCodes.Xor32(T[2][byteAt(K[0], 1)], T[3][byteAt(K[2], 1)]));
      EK[5] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[2], 3)], T[1][byteAt(K[4], 3)]), OpCodes.Xor32(T[2][byteAt(K[6], 3)], T[3][byteAt(K[0], 3)]));
      EK[6] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[1], 1)], T[1][byteAt(K[3], 1)]), OpCodes.Xor32(T[2][byteAt(K[5], 1)], T[3][byteAt(K[7], 1)]));
      EK[7] = OpCodes.Xor32(OpCodes.Xor32(T[0][byteAt(K[7], 3)], T[1][byteAt(K[1], 3)]), OpCodes.Xor32(T[2][byteAt(K[3], 3)], T[3][byteAt(K[5], 3)]));

      // Stage 2: cross-group XOR mix (each half is folded into the other).
      const sum0123 = OpCodes.Xor32(OpCodes.Xor32(EK[0], EK[1]), OpCodes.Xor32(EK[2], EK[3]));
      const sum4567 = OpCodes.Xor32(OpCodes.Xor32(EK[4], EK[5]), OpCodes.Xor32(EK[6], EK[7]));
      const D = new Array(8);
      for (let i = 0; i < 4; i++) D[i] = OpCodes.Xor32(EK[i], sum4567);
      for (let i = 4; i < 8; i++) D[i] = OpCodes.Xor32(EK[i], sum0123);

      // Stage 3: 12-group affine diffusion producing round keys 0..47.
      // Two independent 4-word chains ("A" from D[0..3], "B" from D[4..7]) advance
      // by a fixed recurrence after each group they feed.
      let seqA = [D[0], D[1], D[2], D[3]];
      let seqB = [D[4], D[5], D[6], D[7]];
      const encRk = new Array(52).fill(0);

      for (let g = 0; g < 6; g++) {
        const offA = (2 * g) * 4, offB = (2 * g + 1) * 4;
        const gcA = GROUP_CONST[2 * g], gcB = GROUP_CONST[2 * g + 1];
        for (let i = 0; i < 4; i++) {
          encRk[offA + i] = OpCodes.Xor32(OpCodes.Xor32(seqA[i], gcA), POS_CONST[i]);
          encRk[offB + i] = OpCodes.Xor32(OpCodes.Xor32(seqB[i], gcB), POS_CONST[i]);
        }
        seqA = [
          OpCodes.RotL32(seqA[1], 24),
          OpCodes.RotL32(seqA[2], 16),
          byteRotR2(seqA[3]),
          byteRotR2(seqA[0])
        ];
        seqB = [
          byteRotL2(seqB[3]),
          byteRotL2(seqB[0]),
          OpCodes.RotL32(seqB[1], 8),
          OpCodes.RotL32(seqB[2], 16)
        ];
      }

      // Stage 4: final round-key group (48..51) via the phi diffusion step.
      const X = [0, 1, 2, 3].map(i => OpCodes.Xor32(OpCodes.Xor32(seqA[i], FINAL_GROUP_CONST), POS_CONST[i]));
      encRk[48] = phiN(X[0], 2, 1, 0, 3);
      encRk[49] = phiN(X[1], 1, 0, 3, 2);
      encRk[50] = phiN(X[2], 0, 3, 2, 1);
      encRk[51] = phiN(X[3], 3, 2, 1, 0);

      // Decrypt schedule: first/last groups are shared verbatim with the encrypt
      // schedule; every interior group is phi-mixed from its mirrored group.
      const decRk = new Array(52).fill(0);
      for (let p = 0; p < 4; p++) {
        decRk[p] = encRk[48 + p];
        decRk[48 + p] = encRk[p];
      }
      for (let i = 1; i <= 11; i++) {
        for (let p = 0; p < 4; p++) {
          const tuple = tupleFor((p + 2 * i) % 4);
          decRk[4 * i + p] = phiN(encRk[4 * (12 - i) + p], tuple[0], tuple[1], tuple[2], tuple[3]);
        }
      }

      this.encRoundKeys = encRk;
      this.decRoundKeys = decRk;
    }

    // Shared round function for both encryption and decryption; only the round-key
    // schedule passed in differs.
    _processBlock(bytes, rk) {
      let w = [
        OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]),
        OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]),
        OpCodes.Pack32LE(bytes[8], bytes[9], bytes[10], bytes[11]),
        OpCodes.Pack32LE(bytes[12], bytes[13], bytes[14], bytes[15])
      ];

      for (let i = 0; i < 4; i++) w[i] = OpCodes.Xor32(w[i], rk[i]);

      for (let round = 1; round <= 11; round++) {
        const shift = (round % 2 === 1) ? 0 : 2;
        const next = new Array(4);
        for (let i = 0; i < 4; i++) {
          let v = 0;
          for (let j = 0; j < 4; j++)
            v = OpCodes.Xor32(v, T[(i + j + shift) % 4][byteAt(w[j], i)]);
          next[i] = OpCodes.Xor32(v, rk[4 * round + i]);
        }
        w = next;
      }

      const outWords = new Array(4);
      for (let k = 0; k < 4; k++) {
        let v = 0;
        for (let j = 0; j < 4; j++) {
          const tblIdx = (k + 2 + j) % 4;
          v = OpCodes.Or32(v, OpCodes.Shl32(SB[tblIdx][byteAt(w[j], k)], 8 * j));
        }
        outWords[k] = OpCodes.Xor32(v, rk[48 + k]);
      }

      const result = [];
      for (let k = 0; k < 4; k++) result.push(...OpCodes.Unpack32LE(outWords[k]));
      return result;
    }
  }

  const algorithmInstance = new DarkCryptCryptonAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { DarkCryptCryptonAlgorithm, DarkCryptCryptonInstance };
}));
