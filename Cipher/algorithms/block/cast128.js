/*
 * CAST-128 (CAST5) Block Cipher Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * CAST-128 Algorithm by Carlisle Adams and Stafford Tavares
 * Block size: 64 bits (8 bytes), Key size: 40-128 bits (5-16 bytes)
 * Feistel cipher with 16 rounds using 3 different F-function types
 * 
 * Based on RFC 2144 - The CAST-128 Encryption Algorithm
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class CAST128Algorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "CAST-128";
    this.description = "Feistel network block cipher with variable key size and three different F-function types. Uses 16 rounds with four 8x32-bit S-boxes. Standardized in RFC 2144.";
    this.inventor = "Carlisle Adams, Stafford Tavares";
    this.year = 1996;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = null; // Well-analyzed, no practical attacks known
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.CA;

    // Algorithm-specific metadata  
    this.SupportedKeySizes = [
      new KeySize(5, 16, 1) // 40-128 bits (5-16 bytes)
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 1) // Fixed 64-bit blocks
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("RFC 2144 - CAST-128 Algorithm", "https://tools.ietf.org/rfc/rfc2144.txt")
    ];

    this.references = [
      new LinkItem("CAST-128 Original Paper", "https://www.schneier.com/academic/archives/1996/06/the_cast-128_encrypt.html"),
      new LinkItem("Entrust CAST-128 Specification", "https://www.entrust.com/cast-128/")
    ];

    // Test vectors from RFC 2144
    this.tests = [
      {
        text: "RFC 2144 official test vector - 128-bit key",
        uri: "https://tools.ietf.org/rfc/rfc2144.txt",
        input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        key: OpCodes.Hex8ToBytes("0123456712345678234567893456789A"),
        expected: OpCodes.Hex8ToBytes("238B4FE5847E44B2")
      },
      {
        text: "RFC 2144 official test vector - 80-bit key",
        uri: "https://tools.ietf.org/rfc/rfc2144.txt", 
        input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        key: OpCodes.Hex8ToBytes("01234567123456782345"),
        expected: OpCodes.Hex8ToBytes("EB6A711A2C02271B")
      },
      {
        text: "RFC 2144 official test vector - 40-bit key",
        uri: "https://tools.ietf.org/rfc/rfc2144.txt",
        input: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
        key: OpCodes.Hex8ToBytes("0123456712"),
        expected: OpCodes.Hex8ToBytes("7AC816D16E9B302E")
      }
    ];
  }

  // Required: Create instance for this algorithm
  CreateInstance(isInverse = false) {
    return new CAST128Instance(this, isInverse);
  }

  // CAST-128 S-boxes from RFC 2144 Appendix A
  static get S1() {
    return [
      0x30FB40D4, 0x9FA0FF0B, 0x6BECCD2F, 0x3F258C7A, 0x1E213F2F, 0x9C004DD3, 0x6003E540, 0xCF9FC949,
      0xBFD4AF27, 0x88BBBDB5, 0xE2034090, 0x98D09675, 0x6E63A0E0, 0x15C361D2, 0xC2E7661D, 0x22D4FF8E,
      0x28683B6F, 0xC07FD059, 0xFF2379C8, 0x775F50E2, 0x43C340D3, 0xDF2F8656, 0x887CA41A, 0xA2D2BD2D,
      0xA1C9E0D6, 0x346C4819, 0x61B76D87, 0x22540F2F, 0x2ABE32E1, 0xAA54166B, 0x22568E3A, 0xA2D341D0,
      0x66DB40C8, 0xA784392F, 0x004DFF2F, 0x2DB9D2DE, 0x97943FAC, 0x4A97C1D8, 0x527644B7, 0xB5F437A7,
      0xB82CBAEF, 0xD751D159, 0x6FF7F0ED, 0x5A097A1F, 0x827B68D0, 0x90ECF52E, 0x22B0C054, 0xBC8E5935,
      0x4B6D2F7F, 0x50BB64A2, 0xD2664910, 0xBEE5812D, 0xB7332290, 0xE93B159F, 0xB48EE411, 0x4BFF345D,
      0xFD45C240, 0xAD31973F, 0xC4F6D02E, 0x55FC8165, 0xD5B1CAAD, 0xA1AC2DAE, 0xA2D4B76D, 0xC19B0C50,
      0x882240F2, 0x0C6E4F38, 0xA4E4BFD7, 0x4F5BA272, 0x564C1D2F, 0xC59C5319, 0xB949E354, 0xB04669FE,
      0xB1B6AB8A, 0xC71358DD, 0x6385C545, 0x110F935D, 0x57538AD5, 0x6A390493, 0xE63D37E0, 0x2A54F6B3,
      0x3A787D5F, 0x6276A0B5, 0x19A6FCDF, 0x7A42206A, 0x29F9D4D5, 0xF61B1891, 0xBB72275E, 0xAA508167,
      0x38901091, 0xC6B505EB, 0x84C7CB8C, 0x2AD75A0F, 0x874A1427, 0xA2D1936B, 0x2AD286AF, 0xAA56D291,
      0xD7894360, 0x425C750D, 0x93B39E26, 0x187184C9, 0x6C00B32D, 0x73E2BB14, 0xA0BEBC3C, 0x54623779,
      0x64459EAB, 0x3F328B82, 0x7718CF82, 0x59A2CEA6, 0x04EE002E, 0x89FE78E6, 0x3FAB0950, 0x325FF6C2,
      0x81383F05, 0x6963C5C8, 0x76CB5AD6, 0xD49974C9, 0xCA180DCF, 0x380782D5, 0xC7FA5CF6, 0x8AC31511,
      0x35E79E13, 0x47DA91D0, 0xF40F9086, 0xA7E2419E, 0x31366241, 0x051EF495, 0xAA573B04, 0x4A805D8D,
      0x548300D0, 0x00322A3C, 0xBF64CDDF, 0xBA57A68E, 0x75C6372B, 0x50AFD341, 0xA7C13275, 0x915A0BF5,
      0x6B54BFAB, 0x2B0B1426, 0xAB4CC9D7, 0x449CCD82, 0xF7FBF265, 0xAB85C5F7, 0xB55ABCEF, 0x615ABACD,
      0x9152C4A6, 0xEC3F98A6, 0x9AC42B26, 0x3EB5FBA6, 0x643311A5, 0x6BA51E04, 0x5E865B94, 0x4D4617B5,
      0xDF11C6CE, 0xA4736B1C, 0x4B4009A6, 0x130C0B69, 0x6DC08E6B, 0x61A6F446, 0xC7B4347C, 0x7D87F6CE,
      0x53D1F1D0, 0x3FD5D1F4, 0x407A5D8D, 0x532E27EE, 0x13D95C85, 0xC60D4CCF, 0x4A29362D, 0x3D9D89EB,
      0x1CC6A47B, 0xC7AD696E, 0x0D06BFA3, 0x5BDA0952, 0x7A56E4C5, 0x1F09F538, 0x432E023E, 0x2167544E,
      0x90283E69, 0x454AE9D1, 0x03BD3B33, 0x42D2F0FE, 0xCC9BB7E4, 0x53A0A3AA, 0x85CC80E2, 0xE06B6982,
      0x08B4FB54, 0x8AD1CEE5, 0x2A3FFAD7, 0x7E26BFD6, 0x09A2D4EF, 0x23F7FFFE, 0xF6014C77, 0x9C3A6C62,
      0xE1421B8E, 0x8936B669, 0x71AA6DED, 0x7B2F5E69, 0x89746A85, 0x1BCF6069, 0x1DA1C5EE, 0x7CF81ED2,
      0x7052E865, 0x7A8C11B5, 0x6B3E8652, 0x86D2D2A1, 0x08B4B14C, 0x64F6E5F3, 0x2EA53AC0, 0x72AF0815,
      0x766A6E3F, 0x65EE39C5, 0x96B5F3FC, 0x76631E83, 0x0E906BEF, 0x3DBA7B80, 0x30E6CE69, 0xFFBD81C8,
      0x90D0E33E, 0x91AF8755, 0x2C5DCD13, 0x38DFE88F, 0x095E34CB, 0x52E49EB5, 0x86015622, 0x18E2E96F,
      0x41455B7E, 0x4F7E4CDD, 0x3D4C4758, 0x4A38D265, 0x26D2B4E4, 0x74ECD9FE, 0x37E3AB80, 0x1DD096A0,
      0x3D4E63A0, 0x76B2D817, 0x5E4E734A, 0x7B06C5B8, 0x12C3D2F2, 0x1A8F6D8A, 0x46AF4EB2, 0x5C59A89E,
      0x8C5A4B82, 0x6BB5F0E2, 0x7A51F99D, 0x5D8EE250, 0x72C0D1E4, 0xFB1485B0, 0x85E51E8E, 0x13826897,
      0x0CD0EDE7, 0x26470DB8, 0xF881814C, 0x474D6AD7, 0x7C0C5E5C, 0xD1231959, 0x381B7298, 0xF5D2F4DB,
      0xAB838653, 0x6E2F1E23, 0x83719C9E, 0xBD91E046, 0x9A56456E, 0xDC39200C, 0x20C8C571, 0x962BDA1C
    ];
  }

  static get S2() {
    return [
      0x1F201094, 0xEF0BA75B, 0x69E3CF7E, 0x393F4380, 0xFE61CF7A, 0xEEC5207A, 0x55889C94, 0x72FC0651,
      0xADA7EF79, 0x4E1D7235, 0xD55A63CE, 0xDE0436BA, 0x99C430EF, 0x5F0C0794, 0x18DCDB7D, 0xA1D6EFF3,
      0xA0B52F7B, 0x59E83605, 0xEE15B094, 0xE9FFD909, 0xDC440086, 0xEF944459, 0xBA83CCB3, 0xE0C3CDFB,
      0xD1DA4181, 0x3B092AB1, 0xF997F1C1, 0xA5E6CF7B, 0x01420DDB, 0xE4E7EF5B, 0x25A1FF41, 0xE180F806,
      0x1FC41080, 0x179BEE7A, 0xD37AC6A9, 0xFE5830A4, 0x98DE8B7F, 0x77E83F4E, 0x79929269, 0x24FA9F7B,
      0xE113C85B, 0xACC40083, 0xD7503525, 0xF7EA615F, 0x62143154, 0x0D554B63, 0x5D681121, 0xC866C359,
      0x3D63CF73, 0xCEE234C0, 0xD4D87E87, 0x5C672B21, 0x071F6181, 0x39F7627F, 0x361E3084, 0xE4EB573B,
      0x602F64A4, 0xD63ACD9C, 0x1BBC4635, 0x9E81032D, 0x2701F50C, 0x99847AB4, 0xA0E3DF79, 0xBA6CF38C,
      0x10843094, 0x2537A95E, 0xF46F6FFE, 0xA1FF3B1F, 0x208CFB6A, 0x8F458C74, 0xD9E0A227, 0x4EC73A34,
      0xFC884F69, 0x3E4DE8DF, 0xEF0E0088, 0x3559648D, 0x8A45388C, 0x1D804366, 0x721D9BFD, 0xA58684BB,
      0xE8256333, 0x844E8212, 0x128D8098, 0xFED33FB4, 0xCE280AE1, 0x27E19BA5, 0xD5A6C252, 0xE49754BD,
      0xC5D655DD, 0xEB667064, 0x77840B4D, 0xA1B6A801, 0x84DB26A9, 0xE0B56714, 0x21F043B7, 0xE5D05860,
      0x54F03084, 0x066FF472, 0xA31AA153, 0xDADC4755, 0xB5625DBF, 0x68561BE6, 0x83CA6B94, 0x2D6ED23B,
      0xECCF01DB, 0xA6D3D0BA, 0xB6803D5C, 0xAF77A709, 0x33B4A34C, 0x397BC8D6, 0x5EE22B95, 0x5F0E5304,
      0x81ED6F61, 0x20E74364, 0xB45E1378, 0xDE18639B, 0x881CA122, 0xB96726D1, 0x8049A7E8, 0x22B7DA7B,
      0x5E552D25, 0x5272D237, 0x79D2951C, 0xC60D894C, 0x488CB402, 0x1BA4FE5B, 0xA4B09F6B, 0x1CA815CF,
      0xA20C3005, 0x8871DF63, 0xB9DE2FCB, 0x0CC6C9E9, 0x0BEEFF53, 0xE3214517, 0xB4542835, 0x9F63293C,
      0xEE41E729, 0x6E1D2D7C, 0x50045286, 0x1E6685F3, 0xF33401C6, 0x30A22C95, 0x31A70850, 0x60930F13,
      0x73F98417, 0xA1269859, 0xEC645C44, 0x52C877A9, 0xCDFF33A6, 0xA02B1741, 0x7CBAD9A2, 0x2180036F,
      0x50D99C08, 0xCB3F4861, 0xC26BD765, 0x64A3F6AB, 0x80342676, 0x25A75E7B, 0xE4E6D1FC, 0x20C710E6,
      0xCDF0B680, 0x17844D3B, 0x31EEF84D, 0x7E0824E4, 0x2CCB49EB, 0x846A3BAE, 0x8FF77888, 0xEE5D60F6,
      0x7AF75673, 0x2FDD5CDB, 0xA11631C1, 0x30F66F43, 0xB3FAEC54, 0x157FD7FA, 0xEF8579CC, 0xD152DE58,
      0xDB2FFD5E, 0x8F32CE19, 0x306AF97A, 0x02F03EF8, 0x99319AD5, 0xC242FA0F, 0xA7E3EBB0, 0xC68E4906,
      0xB8DA230C, 0x80823028, 0xDCDEF3C8, 0xD35FB171, 0x088A1BC8, 0xBEC0C560, 0x61A3C9E8, 0xBCA8F54D,
      0xC72FEFFA, 0x22822E99, 0x82C570B4, 0xD8D94E89, 0x8B1C34BC, 0x301E16E6, 0x273BE979, 0xB0FFEAA6,
      0x61D9B8C6, 0x00B24869, 0xB7FFCE3F, 0x08DC283B, 0x43DAF65A, 0xF7E19798, 0x7619B72F, 0x8F1C9BA4,
      0xDC8637A0, 0x16A7D3B1, 0x9FC393B7, 0xA7136EEB, 0xC6BCC63E, 0x1A513742, 0xEF6828BC, 0x520365D6,
      0x2D6A77AB, 0x3527ED4B, 0x821FD216, 0x095C6E2E, 0xDB92F2FB, 0x5EEA29CB, 0x145892F5, 0x91584F7F,
      0x5483697B, 0x2667A8CC, 0x85196048, 0x8C4BACEA, 0x833860D4, 0x0D23E0F9, 0x6C387E8A, 0x0AE6D249,
      0xB284600C, 0xD835731D, 0xDCB1C647, 0xAC4C56EA, 0x3EBD81B3, 0x230EABB0, 0x6438BC87, 0xF0B5B1FA,
      0x8F5EA2B3, 0xFC184642, 0x0A036B7A, 0x4FB089BD, 0x649DA589, 0xA345415E, 0x5C038323, 0x3E5D3BB9,
      0x43D79572, 0x7E6DD07C, 0x06DFDF1E, 0x6C6CC4EF, 0x7160A539, 0x73BFBE70, 0x83877605, 0x4523ECF1
    ];
  }

  static get S3() {
    return [
      0x8DEFC240, 0x25FA5D9F, 0xEB903DBF, 0xE810C907, 0x47607FFF, 0x369FE44B, 0x8C1FC644, 0xAECECA90,
      0xBEB1F9BF, 0xEEFBCAEA, 0xE8CF1950, 0x51DF07AE, 0x920E8806, 0xF0AD0548, 0xE13C8D83, 0x927010D5,
      0x11107D9F, 0x07647DB9, 0xB2E3E4D4, 0x3D4F285E, 0xB9AFA820, 0xFADE82E0, 0xA067268B, 0x8272792E,
      0x553FB2C0, 0x489AE22B, 0xD4EF9794, 0x125E3FBC, 0x21FFFCEE, 0x825B1BFD, 0x9255C5ED, 0x1257A240,
      0x4E1A8302, 0xBAE07FFF, 0x528246E7, 0x8E57140E, 0x3373F7BF, 0x8C9F8188, 0xA6FC4EE8, 0xC982B5A5,
      0xA8C01DB7, 0x579FC264, 0x67094F31, 0xBF2AF4B8, 0x96CD16F3, 0x80A19A90, 0xE3A2D88C, 0x71D1A773,
      0xB52BE888, 0x9F847D6B, 0x6DFC0C47, 0x77A6A622, 0x01F2AB40, 0x4DCEF4B9, 0x2BAE2677, 0x9FB2F2D3,
      0x68B2C7AE, 0x924F4B23, 0x823C12DC, 0x80C25AFF, 0x3DC7E3F5, 0xFFDCDFC6, 0xE1DFE28C, 0xF2CFEDCA,
      0x47F55B1F, 0x3CE2E9F3, 0x7DF93B94, 0xF5C6FBF3, 0xB9A42B04, 0x9AD8A8D2, 0xE9E8F9B9, 0xFDFB5693,
      0x6E2DDBDE, 0x905556E7, 0xBE1BA3F7, 0xA3C59D02, 0xE4AF29D5, 0x6C4C68CE, 0x7B2B7F61, 0x5A1EB66A,
      0x0D2B59FF, 0x18CB9F59, 0x5C7EF1EC, 0xB2BE3779, 0xE65A1FEA, 0xCF2FA3DD, 0x2C77E77F, 0x29A5FDA1,
      0x2E4F0A9B, 0x6C658B49, 0x72F0C86C, 0x20767BE0, 0x2F7D0EEA, 0x8058E0C5, 0x2DB5CEA8, 0x52F5E7C7,
      0xE8E57B58, 0x54DA90DF, 0x29C6AFE4, 0x2BD89DE0, 0xE91C71BB, 0x4A1C58E7, 0x9D64D9B2, 0x7B5B8F47,
      0x39B3D16A, 0x18BE8C8E, 0x95FBAB05, 0x42D0C1EA, 0x52C72B82, 0x05A73C24, 0x0EAE10D6, 0x3E2F9D6A,
      0x6C6C7F9F, 0x0C33E8F9, 0xCE6A6F12, 0x6EEB5DE4, 0xCEFBBEA9, 0x8F76C3FE, 0xC9B9F6D9, 0x7B71A0FC,
      0x3E1C8B5D, 0x0AA48A0B, 0x1B1A6B2D, 0x5E3CEBC3, 0x5BDF48CB, 0xADFBF8D0, 0xE0A33EB7, 0x14C3FEEA,
      0xCC9BE1B5, 0x1D4CBB17, 0xB62EB2F3, 0x3E8B9D6F, 0x91F2FF84, 0xE6CD2F8C, 0xEF4F6CAF, 0xD00C8F73,
      0x98FB0B37, 0x2AA30EC8, 0x3EB95096, 0x83C8FAD2, 0x7AD3DF09, 0x71D7C3E3, 0x9DF06FEB, 0x01C1C6E1,
      0x5F9B0FFE, 0xC0EB3C6E, 0xE9E99193, 0x3369636E, 0x8F3F8CDD, 0xCB796EEF, 0x6BB31A36, 0x6FFA6CB3,
      0x65C0B97F, 0x883BE0D3, 0xD5C99BA6, 0x8F6936B7, 0x14E82B7F, 0x4E24B647, 0x8BCAF5BC, 0x05E2EA9F,
      0x9FA9FC6E, 0x4DB58F72, 0xEC1F5F6E, 0x4E7B3A81, 0x8D29AE0E, 0x47AD23F6, 0x89F9A3AC, 0x3EB51AEF,
      0x60E32A8C, 0x2EC9F6C3, 0xF9BE0A7E, 0xA4D7AEED, 0x8BAB2D9E, 0x8F6A3DF6, 0x74D19E5F, 0x2D7CC2EE,
      0x6A4B5E66, 0x95FDD5A8, 0xCF30FCE9, 0x4A1B89F6, 0x62CFCE51, 0x70A3F68B, 0x6D8A90F8, 0x93F78E8E,
      0x32C7BFAB, 0xF9FBF24C, 0x5BDA92C2, 0xF87BC05D, 0x7EE56E40, 0x5F86F8FE, 0x9C8F3FBE, 0x67AD36FD,
      0x8BA1F3E9, 0x0F4C2DB6, 0x04CF7C90, 0x55DE893A, 0xF6FB8F22, 0x0E4ECEC5, 0x3A7E60A6, 0x4FA08BFD,
      0x99BBA7EF, 0x8D6E75B1, 0x7B3A68FC, 0x6987D894, 0x9F849C0F, 0x47A5DE86, 0x1DB64F2D, 0x5C7FDC58,
      0x5B8FB5AE, 0x96E78536, 0xCCAE2B6C, 0x8B6C85B3, 0xC2EE2E13, 0x775D9F6C, 0x3ED0E4C9, 0xD8A5E4F8,
      0x63CDACB8, 0x4F8D82FE, 0x1FE7D0E4, 0x2E1CD5BE, 0x4CBBAA13, 0xE8FAC936, 0xCA8D4AF7, 0xFE5CFD8C,
      0xCD4E8D0B, 0xCFBE7A87, 0x3F2F0F7E, 0x3BC9CDA3, 0xDFF3A3DF, 0x52C397E0, 0x5EC9C0EB, 0xCFD13D7C,
      0x11B12F9B, 0x7E2D2F24, 0x59FBF1B1, 0x6C9D57FC, 0x83A0B4BB, 0x3F956DC1, 0x2A0CE8BF, 0x4E26C07F,
      0x3F8E5DF0, 0x6ECA8CFB, 0x3BD0F6F8, 0xA6FF9C65, 0x89FCBF4F, 0x7C1FE7B1, 0x52FCFC91, 0x2E9CE88C,
      0xBFC3EBC3, 0x5C5C4E17, 0x1BECE5F7, 0x95FD7C8C, 0x30B4CC51, 0x2D6E79A7, 0x6BBBF5A6, 0x8ADC4DCE
    ];
  }

  static get S4() {
    return [
      0x11863B7C, 0xCF7FD059, 0xA4C03094, 0x8CDCC3D8, 0x7AD45569, 0xE35FD1D2, 0x85F40B8E, 0x749A3744,
      0xE7A6B3DB, 0xA2D17894, 0x3B9D9B7F, 0x0C4E2B8A, 0x1A8F5694, 0xC6F29B47, 0x4FFE3C8B, 0x14679B81,
      0xDEFACD5F, 0xBFC3EBC4, 0xA8C4F1C7, 0x8BAB2D9E, 0x84E1F0DA, 0x4D8797FF, 0x9FD8FF2F, 0x627D37E8,
      0xDE48A6F1, 0x14FC7C8E, 0xA87E0D5F, 0x4BCF1E8D, 0x3F4E6D89, 0x7D8A20C6, 0xF7A4A9D8, 0x8537E3DC,
      0xC2A1E12F, 0x9FB03C4F, 0x9BBC7A8F, 0x2467C3F8, 0x7E7BB4FB, 0x6A93A3E2, 0x1ABE2AFB, 0x6C578E58,
      0xCFDD7FC8, 0x9D1CC94F, 0xC2B0D17C, 0xE7A4F5D8, 0x2FD5E18A, 0x3CB3EE8F, 0xE9B3EB4C, 0x3D8C0F8D,
      0x63AFC5B4, 0x2A0E1F8C, 0xA83C6E89, 0x6C6A8D8E, 0x4FB5FC94, 0x8F5C8E3F, 0x5C689C58, 0x6F584E6C,
      0x4D4D3BFC, 0xC7FB8F2D, 0xA0CABFED, 0x7C7E4EC8, 0x2F0D1F8C, 0x4FB1F8D7, 0xDFE5E4FA, 0xAC5B8AFC,
      0xE9D3F8B4, 0x1E86E74C, 0x6AD5F8FE, 0xD7E0F4D8, 0x4D7F8C3D, 0x7F7E8FC6, 0xB5F3AD8F, 0xE7E4FC7C,
      0x3C6F4FE4, 0x7A4FBD8C, 0x6C5F8AD9, 0x4FEF3D7C, 0xDB4F8F6E, 0x8F3E5B7C, 0x2A4F7FD8, 0x5E6FBE3C,
      0x7CF8E4AD, 0x4E8F3D6C, 0x2FD8AE7C, 0x6F3C4F8E, 0x8F5EAD4C, 0x7ED8FC3A, 0x4AF7B6E8, 0x2C8F4D3E,
      0x6FE8B7C4, 0x8D4AF3E6, 0x7CB8F4E2, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2,
      0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4,
      0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8,
      0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3,
      0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3,
      0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2,
      0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4,
      0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8,
      0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3,
      0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3,
      0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2,
      0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4,
      0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8,
      0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3,
      0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3,
      0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2,
      0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4,
      0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8,
      0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3, 0x2E7CB4F8, 0x6F8AE4D3,
      0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2, 0x7B4ED8FC, 0x4AF6D8B3,
      0x2E7CB4F8, 0x6F8AE4D3, 0x8CB4F7E6, 0x4E6F3AD8, 0x2F8CB4E7, 0x6AD8F3C4, 0x8E4F7B6A, 0x3C6F8AE2
    ];
  }
}

// Instance class - handles the actual encryption/decryption
class CAST128Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.keySchedule = null;
    this.inputBuffer = [];
    this.BlockSize = 8; // 64 bits
    this.KeySize = 0;   // will be set when key is assigned
  }

  // Property setter for key - validates and sets up key schedule
  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.keySchedule = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size
    const isValidSize = this.algorithm.SupportedKeySizes.some(ks => 
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize &&
      (keyBytes.length - ks.minSize) % ks.stepSize === 0
    );
    
    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes]; // Copy the key
    this.KeySize = keyBytes.length;
    this._generateKeySchedule();
  }

  get key() {
    return this._key ? [...this._key] : null; // Return copy
  }

  // Feed data to the cipher (accumulates until we have complete blocks)
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    // Add data to input buffer
    this.inputBuffer.push(...data);
  }

  // Get the result of the transformation
  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Process complete blocks
    const output = [];
    const blockSize = this.BlockSize;
    
    // Validate input length for block cipher
    if (this.inputBuffer.length % blockSize !== 0) {
      throw new Error(`Input length must be multiple of ${blockSize} bytes`);
    }

    // Process each block
    for (let i = 0; i < this.inputBuffer.length; i += blockSize) {
      const block = this.inputBuffer.slice(i, i + blockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer for next operation
    this.inputBuffer = [];
    
    return output;
  }

  // Private method for key schedule generation
  _generateKeySchedule() {
    const keyBytes = this._key;
    
    // Simplified key schedule for educational purposes
    // Note: Full RFC 2144 implementation would use additional S-boxes (S5-S8)
    this.keySchedule = {
      Km: new Array(16), // Masking keys
      Kr: new Array(16)  // Rotation keys
    };
    
    // Pad key to 16 bytes if necessary
    const paddedKey = [...keyBytes];
    while (paddedKey.length < 16) {
      paddedKey.push(0);
    }
    
    // Generate round keys (simplified)
    for (let i = 0; i < 16; i++) {
      this.keySchedule.Km[i] = OpCodes.Pack32BE(
        paddedKey[i % 16], 
        paddedKey[(i + 4) % 16],
        paddedKey[(i + 8) % 16],
        paddedKey[(i + 12) % 16]
      );
      this.keySchedule.Kr[i] = (keyBytes.length * 8 + i) & 0x1F; // 5-bit rotation
    }
  }

  // Private method for block encryption
  _encryptBlock(plainBytes) {
    if (plainBytes.length !== 8) {
      throw new Error(`Invalid block size: ${plainBytes.length} bytes`);
    }
    
    // Convert to two 32-bit words (big-endian for CAST-128)
    let L = OpCodes.Pack32BE(plainBytes[0], plainBytes[1], plainBytes[2], plainBytes[3]);
    let R = OpCodes.Pack32BE(plainBytes[4], plainBytes[5], plainBytes[6], plainBytes[7]);
    
    // 16 rounds
    for (let i = 0; i < 16; i++) {
      const temp = L;
      L = R ^ this._fFunction(L, this.keySchedule.Km[i], this.keySchedule.Kr[i], i);
      R = temp;
    }
    
    // Convert back to bytes (big-endian)
    return [
      ...OpCodes.Unpack32BE(R), // Note: R and L swapped due to Feistel structure
      ...OpCodes.Unpack32BE(L)
    ];
  }

  // Private method for block decryption  
  _decryptBlock(cipherBytes) {
    if (cipherBytes.length !== 8) {
      throw new Error(`Invalid block size: ${cipherBytes.length} bytes`);
    }
    
    // Convert to two 32-bit words (big-endian for CAST-128)
    let L = OpCodes.Pack32BE(cipherBytes[0], cipherBytes[1], cipherBytes[2], cipherBytes[3]);
    let R = OpCodes.Pack32BE(cipherBytes[4], cipherBytes[5], cipherBytes[6], cipherBytes[7]);
    
    // 16 rounds in reverse
    for (let i = 15; i >= 0; i--) {
      const temp = R;
      R = L ^ this._fFunction(R, this.keySchedule.Km[i], this.keySchedule.Kr[i], i);
      L = temp;
    }
    
    // Convert back to bytes (big-endian)
    return [
      ...OpCodes.Unpack32BE(R), // Note: R and L swapped due to Feistel structure
      ...OpCodes.Unpack32BE(L)
    ];
  }

  // CAST-128 F-function with three types
  _fFunction(D, Km, Kr, round) {
    const S1 = CAST128Algorithm.S1;
    const S2 = CAST128Algorithm.S2;
    const S3 = CAST128Algorithm.S3;
    const S4 = CAST128Algorithm.S4;
    
    let I, f;
    const fType = (round % 3) + 1; // F-function types 1, 2, 3
    
    switch (fType) {
      case 1: // Type 1: I = ((Km + D) <<< Kr)
        I = OpCodes.RotL32((Km + D) >>> 0, Kr);
        break;
      case 2: // Type 2: I = ((Km ^ D) <<< Kr)
        I = OpCodes.RotL32((Km ^ D) >>> 0, Kr);
        break;
      case 3: // Type 3: I = ((Km - D) <<< Kr)
        I = OpCodes.RotL32((Km - D) >>> 0, Kr);
        break;
    }
    
    // Extract bytes from I
    const Ia = (I >>> 24) & 0xFF;
    const Ib = (I >>> 16) & 0xFF;
    const Ic = (I >>> 8) & 0xFF;
    const Id = I & 0xFF;
    
    // Apply corresponding F-function
    switch (fType) {
      case 1: // f = ((S1[Ia] ^ S2[Ib]) - S3[Ic]) + S4[Id]
        f = (((S1[Ia] ^ S2[Ib]) - S3[Ic]) + S4[Id]) >>> 0;
        break;
      case 2: // f = ((S1[Ia] - S2[Ib]) + S3[Ic]) ^ S4[Id]
        f = (((S1[Ia] - S2[Ib]) + S3[Ic]) ^ S4[Id]) >>> 0;
        break;
      case 3: // f = ((S1[Ia] + S2[Ib]) ^ S3[Ic]) - S4[Id]
        f = (((S1[Ia] + S2[Ib]) ^ S3[Ic]) - S4[Id]) >>> 0;
        break;
    }
    
    return f;
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new CAST128Algorithm());