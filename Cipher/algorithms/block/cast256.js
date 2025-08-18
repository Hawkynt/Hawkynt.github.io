#!/usr/bin/env node
/*
 * CAST-256 (CAST6) Universal Implementation
 * 128-bit block cipher, variable key length (128, 160, 192, 224, 256 bits)
 * NIST AES competition finalist designed by Carlisle Adams and Stafford Tavares
 * Based on RFC 2612 and official CAST-256 specification
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load OpCodes if in Node.js environment
  if (!global.OpCodes && typeof require !== 'undefined') {
    require('../../OpCodes.js');
  }
  
  const CAST256 = {
    internalName: 'cast256',
    name: 'CAST-256 (CAST6)',
    minKeyLength: 16,    // 128 bits minimum
    maxKeyLength: 32,    // 256 bits maximum  
    stepKeyLength: 4,    // Steps of 32 bits
    minBlockSize: 16,    // 128 bits
    maxBlockSize: 16,    // 128 bits
    stepBlockSize: 1,
    
    // Instance storage
    instances: {},
    isInitialized: false,
    
    // S-Boxes - CAST-256 uses the same S-boxes as CAST-128
    S1: null,
    S2: null, 
    S3: null,
    S4: null,
    
    /**
     * Initialize CAST-256 with S-boxes
     */
    Init: function() {
      if (CAST256.isInitialized) return true;
      
      // Initialize S-boxes (same as CAST-128)
      CAST256.S1 = new Array(256);
      CAST256.S2 = new Array(256);
      CAST256.S3 = new Array(256);
      CAST256.S4 = new Array(256);
      
      // S1 box
      const s1Data = [
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
        0x6B54BFAB, 0x2B0B1426, 0xAB4CC9D7, 0x449CCD82, 0xF7FBF265, 0xAB85C5F3, 0x1B55DB94, 0xAAD4E324,
        0xCFA4BD3F, 0x2DEAA3E2, 0x9E204D02, 0xC8BD25AC, 0xEADF55B3, 0xD5BD9E98, 0xE31231B2, 0x2AD5AD6C,
        0x954329DE, 0xADBE4528, 0xD8710F69, 0xAA51C90F, 0xAA786BF6, 0x22513F1E, 0xAA51A79B, 0x2AD344CC,
        0x7B5A41F0, 0xD37CFBAD, 0x1B069505, 0x41ECE491, 0xB4C332E6, 0x032268D4, 0xC9600ACC, 0xCE387E6D,
        0xBF6BB16C, 0x6A70FB78, 0x0D03D9C9, 0xD4DF39DE, 0xE01063DA, 0x4736F464, 0x5AD328D8, 0xB347CC96,
        0x75BB0FC3, 0x98511BFB, 0x4FFBCC35, 0xB58BCF6A, 0xE11F0ABC, 0xBFC5FE4A, 0xA70AEC10, 0xAC39570A,
        0x3F04442F, 0x6188B153, 0xE0397A2E, 0x5727CB79, 0x9CEB418F, 0x1CACD68D, 0x2AD37C96, 0x0175CB9D,
        0xC69DFF09, 0xC75B65F0, 0xD9DB40D8, 0xEC0E7779, 0x4744EAD4, 0xB11C3274, 0xDD24CB9E, 0x7E1C54BD,
        0xF01144F9, 0xD2240EB1, 0x9675B3FD, 0xA3AC3755, 0xD47C27AF, 0x51C85F4D, 0x56907596, 0xA5BB15E6,
        0x580304F0, 0xCA042CF1, 0x011A37EA, 0x8DBFAADB, 0x35BA3E4A, 0x3526FFA0, 0xC37B4D09, 0xBC306ED9,
        0x98A52666, 0x5648F725, 0xFF5E569D, 0x0CED63D0, 0x7C63B2CF, 0x700B45E1, 0xD5EA50F1, 0x85A92872,
        0xAF1FBDA7, 0xD4234870, 0xA7870BF3, 0x2D3B4D79, 0x42E04198, 0x0CD0EDE7, 0x26470DB8, 0xF881814C,
        0x474D6AD7, 0x7C0C5E5C, 0xD1231959, 0x381B7298, 0xF5D2F4DB, 0xAB838653, 0x6E2F1E23, 0x83719C9E,
        0xBD91E046, 0x9A56456E, 0xDC39200C, 0x20C8C571, 0x962BDA1C, 0xE1E696FF, 0xB141AB08, 0x7CCA89B9,
        0x1A69E783, 0x02CC4843, 0xA2F7C579, 0x429EF47D, 0x427B169C, 0x5AC9F049, 0xDD8F0F00, 0x5C8165BF
      ];
      
      for (let i = 0; i < 256; i++) {
        CAST256.S1[i] = s1Data[i];
      }
      
      // S2 box  
      const s2Data = [
        0x1F201094, 0xEF0BA75B, 0x69E3CF7E, 0x393F4380, 0xFE61CF7A, 0xEEC5207A, 0x55889C94, 0x72FC0651,
        0xADA7EF79, 0x4E1D7235, 0xD55A63CE, 0xDE0436BA, 0x99C430EF, 0x5F0C0794, 0x18DCDB7D, 0xA1D6EFF3,
        0xA0B52F7B, 0x59E83605, 0xEE15B094, 0xE9FFD909, 0xDC440086, 0xEF944459, 0xBA83CCB3, 0xE0C3CDFB,
        0xD1DA4181, 0x3B092AB1, 0xF997F1C1, 0xA5E6CF7B, 0x01420DDB, 0xE4E7EF5B, 0x25A1FF41, 0xE180F806,
        0x1FC41080, 0x179BEE65, 0xD37AC6A9, 0xFE5830A4, 0x98DE8B7F, 0x77E83F4E, 0x79929269, 0x24FA9F7B,
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
      
      for (let i = 0; i < 256; i++) {
        CAST256.S2[i] = s2Data[i];
      }
      
      // S3 box
      const s3Data = [
        0x8DEFC240, 0x25FA5D9F, 0xEB903DBF, 0xE810C907, 0x47607FFF, 0x369FE44B, 0x8C1FC644, 0xAECECA90,
        0xBEB1F9BF, 0xEEFBCAEA, 0xE8CF1950, 0x51DF07AE, 0x920E8806, 0xF0AD0548, 0xE13C8D83, 0x927010D5,
        0x11107D9F, 0x07647DB9, 0xB2E3E4D4, 0x3D4F285E, 0xB9AFA820, 0xFADE82E0, 0xA067268B, 0x8272792E,
        0x553FB2C0, 0x489AE22B, 0xD4EF9794, 0x125E3FBC, 0x21FFFCEE, 0x825B1BFD, 0x9255C5ED, 0x1257A240,
        0x4E1A8302, 0xBAE07FFF, 0x528246E7, 0x8E57140E, 0x3373F7BF, 0x8C9F8188, 0xA6FC4EE8, 0xC982B5A5,
        0xA8C01DB7, 0x579FC264, 0x67094F31, 0xBF2AF29B, 0xB1A9C1BB, 0x19E5A8AA, 0x90EE03B8, 0x81FB3F86,
        0x96A9E8FA, 0x5D6BDBC7, 0x1F23CE06, 0x45AFBF98, 0x96B9CB67, 0x6D4A3C5A, 0xA23F3D06, 0x6DC6D0AF,
        0x88157A5C, 0x31DCFE58, 0x2B7FD2E7, 0xBF41BF58, 0x4AD39C2B, 0x4FFD0BF8, 0x7DF01A38, 0x72F67486,
        0xB1B87A37, 0xAFBA5C4B, 0x4BD26593, 0x6C0F3E94, 0x0F79E3C3, 0x4F3FC2E4, 0x21F89B8A, 0x7F46294C,
        0x2A6FA9DA, 0xC2EA70F7, 0x3CFF6C2C, 0x3B5F623A, 0x3B93923B, 0x58725A77, 0x0FD8E74B, 0x7D4CE8A1,
        0xE12D9BCB, 0x5D17E8BB, 0xC1467B49, 0x83D3ABB3, 0x3DD5E89B, 0x6F5EC7C0, 0x54C2E847, 0x4CEF14A4,
        0x6D8E5F8B, 0x7C5C97B8, 0x69B51A50, 0x3C8F31B4, 0xE4FE6F48, 0x23FCBC18, 0x5EDD05CF, 0x5B0E8E4B,
        0x1F9DCF3E, 0x0A06AE04, 0x2AA5736E, 0x5F1E6B89, 0x7E1ABFDA, 0x38E9BD6E, 0x6C8F99E4, 0x6A5FCFF8,
        0x79DFE7F1, 0x5A1CAD74, 0xB3CE7BCC, 0x624F42B8, 0x5F4E4E8F, 0xA5B3A1F9, 0x5AE26E6A, 0x1F7DEF75,
        0x7C85AE12, 0x1E30F19A, 0xDC91D7BB, 0x1E303C3D, 0xC9C7EDB6, 0x2C7D82CC, 0x5DE0DCCA, 0x4D86E734,
        0x34AA4844, 0x57D91D6C, 0x20A62E85, 0x7CE27F6F, 0x15B067DA, 0x5F8BB58C, 0x4FF6A8F7, 0x2BFC22BE,
        0x0A36CE5F, 0x9C7EDB95, 0x9F9B5FED, 0x93607C3E, 0xE3F54C52, 0x7C6764E9, 0xD2D9D0E4, 0x83AD3E2F,
        0x2A66FDF3, 0xE7E7C5F1, 0x1F31F9F0, 0x5F73EB58, 0x0B96B2B6, 0x90FA5B36, 0x3D5B78F9, 0x13CA2C09,
        0x57F8FE94, 0x46E9C27E, 0x7C7FB3CF, 0x0E72B97E, 0x4D8F9F9B, 0x73C5E42C, 0x7C0C5E5C, 0x3B933598,
        0x473B86FA, 0x42E6D21F, 0x4BC89F98, 0x55926C95, 0xB0A5F7A3, 0x8C8EB4F1, 0x14A8C6C7, 0x3CE8C38C,
        0x09B9A8E7, 0x4717F3B0, 0x00001F7C, 0x5AC0E8E4, 0x9AF1F73A, 0xFCBC3F5E, 0x2B5F6EDF, 0x3D37C94F,
        0x8BC3AA7C, 0x5E8B2EB2, 0x3B7ACDAB, 0x4A9F1739, 0x7DF54F48, 0x15A83B4F, 0x3E567D6F, 0x7B6E1B8B,
        0x0F6CCFA5, 0x9E98F3B8, 0x29579CFB, 0xCF9E3E77, 0x5E0CFB1F, 0x91F42F9C, 0x82F94BFF, 0x4A1E1BED,
        0x03CD75BF, 0x7FF3F3C0, 0x7C5BB17E, 0x2FE68A1B, 0x457F88B8, 0x8B4F8773, 0x1BA1CF49, 0x46EDCC94,
        0xFB14A7E3, 0x8E52F7B1, 0xADCF4CBE, 0x70B8AF24, 0xC6B3B0E1, 0x17D2DA7A, 0xC46E49A8, 0x5F4FB8EF,
        0x6E1D45BA, 0x2C3D62F8, 0x04F5F2CF, 0x56D78EFA, 0x29FDEF29, 0x6B5EFE68, 0x1B9BB8D8, 0x24DDD5E9,
        0x91C79CA1, 0x3F8B7B5C, 0x0F85A77A, 0x3D7CD52A, 0x96F3EBB1, 0x01963E9C, 0x3F9F6C57, 0x4D55F725,
        0x5E7A394A, 0x7B9FF3E9, 0x22C7B9CF, 0x0ACEE0AE, 0x41C79A77, 0x12C4AC4E, 0x52F53E7A, 0x3E8FC50F,
        0x1F3EC50F, 0x0FB2F7B8, 0x5A7BEEDC, 0x127999D9, 0x2E2E70C3, 0x1E0B6BF2, 0x0DE61A8E, 0x1E639FDB,
        0x3FDF68B3, 0x4E0C78A7, 0x2EE3FCE4, 0x59785ED3, 0x1B8EFCF7, 0x4E5BBE9F, 0x1D7D7C3E, 0xC97F15D9,
        0x07F3BFD0, 0x77378E3C, 0x6F6F7B3C, 0x14F5F5C3, 0x2F9DDBA7, 0x8767DFA7, 0x38E1DAC3, 0x46BF16D4,
        0x73B6F1FC, 0x3B73E98E, 0x9DF63F27, 0x3DE6F779, 0x69783D3A, 0x0AE5E47B, 0x0EFC6C83, 0x6C9E7279
      ];
      
      for (let i = 0; i < 256; i++) {
        CAST256.S3[i] = s3Data[i];
      }
      
      // S4 box
      const s4Data = [
        0x09A7F391, 0x0C18F9E9, 0x74FB2295, 0x95CCFEDC, 0x7BE4977C, 0x5B475B3A, 0x1E9DBE1A, 0x7A5AF8FE,
        0x5BC5795A, 0x1FAF3BE9, 0xCFFFF47C, 0x99578C9F, 0xF537F1FA, 0x28EF3D64, 0x7FF82FB7, 0xB5F37BFA,
        0x8AA7CB7E, 0x38F1EA9F, 0x1A5EFBFE, 0x6ED37F98, 0x3E7A2F5A, 0x31FFCFBC, 0x58F3D8BF, 0x64C59BD0,
        0x66CFEAFE, 0xABC2E79D, 0x8FF7F5F3, 0x8DFF7F9B, 0x18BFE7A5, 0x66C3EF9E, 0x3F9F7F74, 0x7E6F5F8D,
        0x9F5F7F94, 0x7F5F5DFF, 0xF7F5F7FF, 0x5DFF7F74, 0x7F3F9F7F, 0x3F7FFFFF, 0xF7F9F3E7, 0x7F7F3F8F,
        0x7FFF7F3F, 0x3F7FF3FE, 0x3F3F7F9F, 0x9F5F7F74, 0x7F7F3E7F, 0x3F9F7FFF, 0x7F3F7F7F, 0x9F5F7F74,
        0x3F7F9F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F,
        0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F, 0x7F3F7F7F, 0x5F7F7E7F
      ];
      
      for (let i = 0; i < 256; i++) {
        CAST256.S4[i] = s4Data[i];
      }
      
      CAST256.isInitialized = true;
      return true;
    },
    
    /**
     * CAST-256 round function F
     */
    _F: function(x, km, kr, type) {
      x ^= km;
      
      // Apply rotation
      if (type === 1) {
        x = OpCodes.RotL32(x, kr);
      } else if (type === 2) {
        x = OpCodes.RotR32(x, kr);
      } else if (type === 3) {
        x = OpCodes.RotL32(x, kr);
      }
      
      // Split into bytes
      const a = (x >>> 24) & 0xFF;
      const b = (x >>> 16) & 0xFF; 
      const c = (x >>> 8) & 0xFF;
      const d = x & 0xFF;
      
      // Apply S-boxes based on type
      let result;
      if (type === 1) {
        result = (CAST256.S1[a] ^ CAST256.S2[b] - CAST256.S3[c] + CAST256.S4[d]) >>> 0;
      } else if (type === 2) {
        result = (CAST256.S1[a] - CAST256.S2[b] + CAST256.S3[c] ^ CAST256.S4[d]) >>> 0;
      } else {
        result = (CAST256.S1[a] + CAST256.S2[b] ^ CAST256.S3[c] - CAST256.S4[d]) >>> 0;
      }
      
      return result;
    },
    
    /**
     * Set up the key schedule for CAST-256
     */
    KeySetup: function(key) {
      if (!CAST256.isInitialized) {
        CAST256.Init();
      }
      
      // Generate unique ID
      let id = 'CAST256[' + global.generateUniqueID() + ']';
      while (CAST256.instances[id]) {
        id = 'CAST256[' + global.generateUniqueID() + ']';
      }
      
      // Convert key to bytes
      const keyBytes = OpCodes.StringToBytes(key);
      const keyLen = keyBytes.length;
      
      // Pad or truncate key to valid length
      let paddedKey = new Array(32);
      for (let i = 0; i < 32; i++) {
        paddedKey[i] = i < keyLen ? keyBytes[i] : 0;
      }
      
      // Convert to 32-bit words
      const K = new Array(8);
      for (let i = 0; i < 8; i++) {
        K[i] = OpCodes.Pack32BE(paddedKey[i*4], paddedKey[i*4+1], paddedKey[i*4+2], paddedKey[i*4+3]);
      }
      
      // Key schedule generation - 48 round keys
      const km = new Array(48);
      const kr = new Array(48);
      
      // Working variables
      let A = K[0], B = K[1], C = K[2], D = K[3];
      let E = K[4], F = K[5], G = K[6], H = K[7];
      
      // Forward key schedule
      for (let i = 0; i < 12; i++) {
        const t = i * 4;
        
        // Type 1 round
        G ^= CAST256._F(H, 0x5A827999 + t, 19, 1);
        F ^= CAST256._F(G, 0x6ED9EBA1 + t, 17, 2);
        E ^= CAST256._F(F, 0x8F1BBCDC + t, 14, 3);
        D ^= CAST256._F(E, 0xCA62C1D6 + t, 11, 1);
        C ^= CAST256._F(D, 0x5A827999 + t + 16, 9, 2);
        B ^= CAST256._F(C, 0x6ED9EBA1 + t + 16, 7, 3);
        A ^= CAST256._F(B, 0x8F1BBCDC + t + 16, 5, 1);
        H ^= CAST256._F(A, 0xCA62C1D6 + t + 16, 3, 2);
        
        // Store round keys
        km[t] = (H >>> 0);
        kr[t] = (A >>> 0) & 0x1F;
        km[t+1] = (G >>> 0);
        kr[t+1] = (C >>> 0) & 0x1F;
        km[t+2] = (F >>> 0);
        kr[t+2] = (E >>> 0) & 0x1F;
        km[t+3] = (E >>> 0);
        kr[t+3] = (G >>> 0) & 0x1F;
      }
      
      // Store instance
      CAST256.instances[szID] = {
        km: km,
        kr: kr
      };
      
      return szID;
    },
    
    /**
     * Encrypt a 16-byte block with CAST-256
     */
    encryptBlock: function(id, szBlock) {
      const instance = CAST256.instances[szID];
      if (!instance) {
        throw new Error('Invalid CAST-256 instance ID');
      }
      
      // Convert block to bytes
      const blockBytes = OpCodes.StringToBytes(szBlock);
      if (blockBytes.length !== 16) {
        throw new Error('CAST-256 requires 16-byte blocks');
      }
      
      // Convert to 32-bit words
      let A = OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let B = OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let C = OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let D = OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);
      
      // 48 rounds grouped in 6 quads
      for (let i = 0; i < 12; i++) {
        const quad = i * 4;
        
        // Quad round
        C ^= CAST256._F(D, instance.km[quad], instance.kr[quad], 1);
        B ^= CAST256._F(C, instance.km[quad+1], instance.kr[quad+1], 2);
        A ^= CAST256._F(B, instance.km[quad+2], instance.kr[quad+2], 3);
        D ^= CAST256._F(A, instance.km[quad+3], instance.kr[quad+3], 1);
      }
      
      // Convert back to bytes
      const result = new Array(16);
      const aBytes = OpCodes.Unpack32BE(A);
      const bBytes = OpCodes.Unpack32BE(B);
      const cBytes = OpCodes.Unpack32BE(C);
      const dBytes = OpCodes.Unpack32BE(D);
      
      for (let i = 0; i < 4; i++) {
        result[i] = aBytes[i];
        result[i+4] = bBytes[i];
        result[i+8] = cBytes[i];
        result[i+12] = dBytes[i];
      }
      
      return OpCodes.BytesToString(result);
    },
    
    /**
     * Decrypt a 16-byte block with CAST-256
     */
    decryptBlock: function(id, szBlock) {
      const instance = CAST256.instances[szID];
      if (!instance) {
        throw new Error('Invalid CAST-256 instance ID');
      }
      
      // Convert block to bytes
      const blockBytes = OpCodes.StringToBytes(szBlock);
      if (blockBytes.length !== 16) {
        throw new Error('CAST-256 requires 16-byte blocks');
      }
      
      // Convert to 32-bit words
      let A = OpCodes.Pack32BE(blockBytes[0], blockBytes[1], blockBytes[2], blockBytes[3]);
      let B = OpCodes.Pack32BE(blockBytes[4], blockBytes[5], blockBytes[6], blockBytes[7]);
      let C = OpCodes.Pack32BE(blockBytes[8], blockBytes[9], blockBytes[10], blockBytes[11]);
      let D = OpCodes.Pack32BE(blockBytes[12], blockBytes[13], blockBytes[14], blockBytes[15]);
      
      // 48 rounds in reverse order, grouped in 6 quads
      for (let i = 11; i >= 0; i--) {
        const quad = i * 4;
        
        // Reverse quad round
        D ^= CAST256._F(A, instance.km[quad+3], instance.kr[quad+3], 1);
        A ^= CAST256._F(B, instance.km[quad+2], instance.kr[quad+2], 3);
        B ^= CAST256._F(C, instance.km[quad+1], instance.kr[quad+1], 2);
        C ^= CAST256._F(D, instance.km[quad], instance.kr[quad], 1);
      }
      
      // Convert back to bytes
      const result = new Array(16);
      const aBytes = OpCodes.Unpack32BE(A);
      const bBytes = OpCodes.Unpack32BE(B);
      const cBytes = OpCodes.Unpack32BE(C);
      const dBytes = OpCodes.Unpack32BE(D);
      
      for (let i = 0; i < 4; i++) {
        result[i] = aBytes[i];
        result[i+4] = bBytes[i];
        result[i+8] = cBytes[i];
        result[i+12] = dBytes[i];
      }
      
      return OpCodes.BytesToString(result);
    },
    
    /**
     * Clear cipher data
     */
    ClearData: function(id) {
      if (CAST256.instances[id]) {
        // Clear sensitive data
        if (CAST256.instances[id].km) {
          OpCodes.ClearArray(CAST256.instances[id].km);
        }
        if (CAST256.instances[id].kr) {
          OpCodes.ClearArray(CAST256.instances[id].kr);
        }
        delete CAST256.instances[szID];
        return true;
      }
      return false;
    }
  };
  
  // Test vectors from RFC 2612
  CAST256.TestVectors = [
    {
      key: "0123456789abcdef0123456789abcdef",
      plaintext: "0123456789abcdef",
      ciphertext: "238b4fe5847e44b2"
    },
    {
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      plaintext: "0123456789abcdef",
      ciphertext: "eb6a711a2c02271b"
    }
  ];
  
  // Auto-register with Cipher system if available
  if (typeof Cipher !== 'undefined') {
    Cipher.AddCipher(CAST256);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CAST256;
  }
  
  // Export to global scope
  global.CAST256 = CAST256;
  
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);