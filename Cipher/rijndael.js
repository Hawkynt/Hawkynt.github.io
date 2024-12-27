/*
 *  Rijndael Class
 *  (c)2006 Hawkynt
 *
 *  Attributes:
 *   szName                            --> Name of Cipher
 *   szInternalName                    --> Short Name of Cipher for internal use
 *   szCommment                        --> a comment for the Cipher
 *   intMinKeyLength                   --> Minimum Key Size in Bytes
 *   intMaxKeyLength                   --> Maximum Key Size in Bytes
 *   intStepKeyLength                  --> Key Steps in Bytes
 *   intMinBlockSize                   --> Minimum Block Size in Bytes
 *   intMaxBlockSize                   --> Maximum Block Size in Bytes
 *   intStepBlockSize                  --> Block Size Steps in Bytes
 *   arrInstances                      --> Instances of Cipher in use
 *   boolCantDecode                    --> No Decoding Routine Present
 *   boolInit                          --> is true if Algo has been initialized once
 *
 *  Methods:
 *   Init()                            --> Initializes the Algo
 *   KeySetup(szKey):szID              --> returns szID of Algos internal Object after creating it
 *   EncryptBlock(szID,szBlock):String --> Encrypt a Block
 *   DecryptBlock(szID,szBlock):String --> Decrypt a Block
 *   ClearData(szID)                   --> deletes an Algos Object
 */
if (!window.XObjectInstances) window.XObjectInstances=[];
var Rijndael=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  Rijndael.szInternalName='Rijndael';
  Rijndael.szName='Rijndael';
  Rijndael.szComment='This is an implementation of the Rijndael Cipher Algorithm on http://www-cse.ucsd.edu/~fritz';
  Rijndael.intMinKeyLength=8;
  Rijndael.intMaxKeyLength=16;
  Rijndael.intStepKeyLength=4;
  Rijndael.intMinBlockSize=8;
  Rijndael.intMaxBlockSize=16;
  Rijndael.intStepBlockSize=4;
  Rijndael.arrInstances=[];
  
  Rijndael.boolCantDecode=false;
  Rijndael.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  // =======================[ PUBLIC STATIC ]===========================
  Rijndael.Init=function () {
    Rijndael.boolInit=true;
  }
  
  Rijndael.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='Rijndael['+szGenerateUniqueID()+']';
    } while ((Rijndael.arrInstances[szID]) || (Rijndael.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    Rijndael.arrInstances[szID]=new Rijndael.classRijndael(optional_szKey);
    return (szID);
  }
  
  Rijndael.ClearData=function (szID) {
    if ((Rijndael.arrInstances[szID]) && (Rijndael.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete Rijndael.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Rijndael','ClearData');
      return (false);
    };
  }
  
  Rijndael.szEncryptBlock=function (szID,szPlainText) {
    if ((Rijndael.arrInstances[szID]) && (Rijndael.arrInstances[szID]!=undefined)) {
      var szRet='',objRijndael=Rijndael.arrInstances[szID],intI,intJ,intR;
      objRijndael.keyExpansion(szPlainText);
      var intNb=objRijndael.intNb,intNr=objRijndael.intNr,intNk=objRijndael.intNk,arrExpandedKey=objRijndael.arrExpandedKey;
      // Packing
      var arrState=[];
      arrState[0]=[];
      arrState[1]=[];
      arrState[2]=[];
      arrState[3]=[];
      for (intI=0;intI<szPlainText.length;intI+=4) {
        arrState[0][intI/4]=szPlainText.charCodeAt(intI  ) & 0xff;
        arrState[1][intI/4]=szPlainText.charCodeAt(intI+1) & 0xff;
        arrState[2][intI/4]=szPlainText.charCodeAt(intI+2) & 0xff;
        arrState[3][intI/4]=szPlainText.charCodeAt(intI+3) & 0xff;
      };
      //Rijndael.addRoundKey(arrState, objRijndael.arrExpandedKey);
      for (intI=0;intI<intNb;intI++) {
        arrState[0][intI] ^= ( arrExpandedKey[intI]        & 0xFF);
        arrState[1][intI] ^= ((arrExpandedKey[intI] >>  8) & 0xFF);
        arrState[2][intI] ^= ((arrExpandedKey[intI] >> 16) & 0xFF);
        arrState[3][intI] ^= ((arrExpandedKey[intI] >> 24) & 0xFF);
      };
      for (intR=1; intR<objRijndael.intNr; intR++) {
        //Rijndael.Round(arrState, arrExpandedKey.slice(intNb*intR, intNb*(intR+1)));
        //  byteSub(state, "encrypt");
        for (intI = 0; intI < 4; intI++) {
          for (intJ = 0; intJ < intNb; intJ++) {
            arrState[intI][intJ] = Rijndael.arrSBox[arrState[intI][intJ]];
          };
        };
        //  shiftRow(state, "encrypt");
        for (intI=1; intI<4; intI++) {
          // arrState[intI] = cyclicShiftLeft(arrState[intI], Rijndael.arrShiftOffsets[intNb][intI]);
          var arrTemp=arrState[intI].slice(0,Rijndael.arrShiftOffsets[intNb][intI]);
          arrState[intI]=arrState[intI].slice(Rijndael.arrShiftOffsets[intNb][intI]).concat(arrTemp);
        };
        //  mixColumn(state, "encrypt");
        var arrTemp = [];                           // Result of matrix multiplications
        for (intJ = 0; intJ < intNb; intJ++) {      // Go through each column...
          for (intI = 0; intI < 4; intI++) {        // and for each row in the column...
            arrTemp[intI] = 
              Rijndael.mult_GF256(arrState[ intI       ][intJ], 2) ^          // perform mixing
              Rijndael.mult_GF256(arrState[(intI+1) % 4][intJ], 3) ^ 
                                  arrState[(intI+2) % 4][intJ]     ^ 
                                  arrState[(intI+3) % 4][intJ];
          };
          for (intI = 0; intI < 4; intI++) {
            arrState[intI][intJ] = arrTemp[intI];
          };
        };
        //  addRoundKey(state, roundKey);
        for (intI=0;intI<intNb;intI++) {
          arrState[0][intI] ^= ( arrExpandedKey[intI+intNb*intR]        & 0xFF);
          arrState[1][intI] ^= ((arrExpandedKey[intI+intNb*intR] >>  8) & 0xFF);
          arrState[2][intI] ^= ((arrExpandedKey[intI+intNb*intR] >> 16) & 0xFF);
          arrState[3][intI] ^= ((arrExpandedKey[intI+intNb*intR] >> 24) & 0xFF);
        };
      };
      //Rijndael.FinalRound(arrState, objRijndael.arrExpandedKey.slice(objRijndael.intNb*objRijndael.intNr)); 
      //  byteSub(state, "encrypt");
      for (intI = 0; intI < 4; intI++) {
        for (intJ = 0; intJ < intNb; intJ++) {
          arrState[intI][intJ] = Rijndael.arrSBox[arrState[intI][intJ]];
        };
      };
      //  shiftRow(state, "encrypt");
      for (intI=1; intI<4; intI++) {
        // arrState[intI] = cyclicShiftLeft(arrState[intI], Rijndael.arrShiftOffsets[intNb][intI]);
        var arrTemp=arrState[intI].slice(0,Rijndael.arrShiftOffsets[intNb][intI]);
        arrState[intI]=arrState[intI].slice(Rijndael.arrShiftOffsets[intNb][intI]).concat(arrTemp);
      };
      //  addRoundKey(state, roundKey);
      for (intI=0;intI<intNb;intI++) {
        arrState[0][intI] ^= ( arrExpandedKey[intI+intNb*intNr]        & 0xFF);
        arrState[1][intI] ^= ((arrExpandedKey[intI+intNb*intNr] >>  8) & 0xFF);
        arrState[2][intI] ^= ((arrExpandedKey[intI+intNb*intNr] >> 16) & 0xFF);
        arrState[3][intI] ^= ((arrExpandedKey[intI+intNb*intNr] >> 24) & 0xFF);
      };
      // Unpacking
      for (intI=0;intI<arrState[0].length;intI++) {
        szRet+= 
          String.fromCharCode(arrState[0][intI]) + 
          String.fromCharCode(arrState[1][intI]) + 
          String.fromCharCode(arrState[2][intI]) + 
          String.fromCharCode(arrState[3][intI]);
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Rijndael','szEncryptBlock');
    };
  }
  
  Rijndael.szDecryptBlock=function (szID,szCipherText) {
    if ((Rijndael.arrInstances[szID]) && (Rijndael.arrInstances[szID]!=undefined)) {
      var szRet='',objRijndael=Rijndael.arrInstances[szID],intI,intJ,intR;
      objRijndael.keyExpansion(szCipherText);
      var intNb=objRijndael.intNb,intNr=objRijndael.intNr,intNk=objRijndael.intNk,arrExpandedKey=objRijndael.arrExpandedKey;
      // Packing
      var arrState=[];
      arrState[0]=[];
      arrState[1]=[];
      arrState[2]=[];
      arrState[3]=[];
      for (intI=0;intI<szCipherText.length;intI+=4) {
        arrState[0][intI/4]=szCipherText.charCodeAt(intI  ) & 0xff;
        arrState[1][intI/4]=szCipherText.charCodeAt(intI+1) & 0xff;
        arrState[2][intI/4]=szCipherText.charCodeAt(intI+2) & 0xff;
        arrState[3][intI/4]=szCipherText.charCodeAt(intI+3) & 0xff;
      };
      //InverseFinalRound(block, expandedKey.slice(intNb*intNr)); 
      //  addRoundKey(state, roundKey);
      for (intI=0;intI<intNb;intI++) {
        arrState[0][intI] ^= ( arrExpandedKey[intI+intNb*intNr]        & 0xFF);
        arrState[1][intI] ^= ((arrExpandedKey[intI+intNb*intNr] >>  8) & 0xFF);
        arrState[2][intI] ^= ((arrExpandedKey[intI+intNb*intNr] >> 16) & 0xFF);
        arrState[3][intI] ^= ((arrExpandedKey[intI+intNb*intNr] >> 24) & 0xFF);
      };
      //  shiftRow(state, "decrypt");
      for (intI=1; intI<4; intI++) {
        // arrState[intI] = cyclicShiftLeft(arrState[intI], intNb-Rijndael.arrShiftOffsets[intNb][intI]);
        var arrTemp=arrState[intI].slice(0,intNb-Rijndael.arrShiftOffsets[intNb][intI]);
        arrState[intI]=arrState[intI].slice(intNb-Rijndael.arrShiftOffsets[intNb][intI]).concat(arrTemp);
      };
      //  byteSub(state, "decrypt");  
      for (intI = 0; intI < 4; intI++) {
        for (intJ = 0; intJ < intNb; intJ++) {
          arrState[intI][intJ] = Rijndael.arrSBoxInverse[arrState[intI][intJ]];
        };
      };
      for (intR = intNr - 1; intR>0; intR--) {
        //InverseRound(block, expandedKey.slice(intNb*intR, intNb*(intR+1)));
        //  addRoundKey(state, roundKey);
        for (intI=0;intI<intNb;intI++) {
          arrState[0][intI] ^= ( arrExpandedKey[intI+intNb*intR]        & 0xFF);
          arrState[1][intI] ^= ((arrExpandedKey[intI+intNb*intR] >>  8) & 0xFF);
          arrState[2][intI] ^= ((arrExpandedKey[intI+intNb*intR] >> 16) & 0xFF);
          arrState[3][intI] ^= ((arrExpandedKey[intI+intNb*intR] >> 24) & 0xFF);
        };
        //    mixColumn(state, "decrypt");
        var arrTemp = [];                           // Result of matrix multiplications
        for (intJ = 0; intJ < intNb; intJ++) {      // Go through each column...
          for (intI = 0; intI < 4; intI++) {        // and for each row in the column...
            arrTemp[intI] = 
              Rijndael.mult_GF256(arrState[ intI       ][intJ], 0xE) ^          // perform mixing
              Rijndael.mult_GF256(arrState[(intI+1) % 4][intJ], 0xB) ^ 
              Rijndael.mult_GF256(arrState[(intI+2) % 4][intJ], 0xD) ^ 
              Rijndael.mult_GF256(arrState[(intI+3) % 4][intJ], 0x9);
          };
          for (intI = 0; intI < 4; intI++) {
            arrState[intI][intJ] = arrTemp[intI];
          };
        };
        //    shiftRow(state, "decrypt");
        for (intI=1; intI<4; intI++) {
          // arrState[intI] = cyclicShiftLeft(arrState[intI], intNb-Rijndael.arrShiftOffsets[intNb][intI]);
          var arrTemp=arrState[intI].slice(0,intNb-Rijndael.arrShiftOffsets[intNb][intI]);
          arrState[intI]=arrState[intI].slice(intNb-Rijndael.arrShiftOffsets[intNb][intI]).concat(arrTemp);
        };
        //    byteSub(state, "decrypt");
        for (intI = 0; intI < 4; intI++) {
          for (intJ = 0; intJ < intNb; intJ++) {
            arrState[intI][intJ] = Rijndael.arrSBoxInverse[arrState[intI][intJ]];
          };
        };
      };
      //Rijndael.addRoundKey(arrState, objRijndael.arrExpandedKey);
      for (intI=0;intI<intNb;intI++) {
        arrState[0][intI] ^= ( arrExpandedKey[intI]        & 0xFF);
        arrState[1][intI] ^= ((arrExpandedKey[intI] >>  8) & 0xFF);
        arrState[2][intI] ^= ((arrExpandedKey[intI] >> 16) & 0xFF);
        arrState[3][intI] ^= ((arrExpandedKey[intI] >> 24) & 0xFF);
      };
      // Unpacking
      for (intI=0;intI<arrState[0].length;intI++) {
        szRet+= 
          String.fromCharCode(arrState[0][intI]) + 
          String.fromCharCode(arrState[1][intI]) + 
          String.fromCharCode(arrState[2][intI]) + 
          String.fromCharCode(arrState[3][intI]);
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'Rijndael','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  Rijndael.xtime=function (intPoly) {
    intPoly <<= 1;
    return ((intPoly & 0x100) ? (intPoly ^ 0x11B) : (intPoly));
  }
  
  Rijndael.mult_GF256=function(intX, intY) {
    var intBit, intResult = 0;
    for (intBit = 1; intBit < 256; intBit *= 2, intY = Rijndael.xtime(intY)) {
      if (intX & intBit) 
      intResult ^= intY;
    };
    return intResult;
  }
  
  // =======================[ PRIVATE CLASS ]===========================
  Rijndael.classRijndael=function (szKey) {
    // Make Key Setup
    this.arrExpandedKey=[];
    this.szKey=szKey;
    this.intNk;
    this.intNb;
    this.intNr;
    
    this.keyExpansion=function (szBlock) {
      var intTemp;
      this.intNk = this.szKey.length / 4;
      this.intNb = szBlock.length / 4;
      this.intNr = Rijndael.arrRoundsArray[this.intNk][this.intNb];
      for (var intJ=0; intJ < this.intNk; intJ++) {
        this.arrExpandedKey[intJ] = 
          ((this.szKey.charCodeAt(4*intJ  ) & 0xff)      ) | 
          ((this.szKey.charCodeAt(4*intJ+1) & 0xff) <<  8) | 
          ((this.szKey.charCodeAt(4*intJ+2) & 0xff) << 16) | 
          ((this.szKey.charCodeAt(4*intJ+3) & 0xff) << 24);
      };
      for (intJ = this.intNk; intJ < this.intNb * (this.intNr + 1); intJ++) {
        intTemp = this.arrExpandedKey[intJ - 1];
        if (intJ % this.intNk == 0) {
          intTemp = 
            ( (Rijndael.arrSBox[(intTemp >>  8) & 0xFF]      ) |
              (Rijndael.arrSBox[(intTemp >> 16) & 0xFF] <<  8) |
              (Rijndael.arrSBox[(intTemp >> 24) & 0xFF] << 16) |
              (Rijndael.arrSBox[ intTemp        & 0xFF] << 24) ) 
            ^ Rijndael.arrRcon[Math.floor(intJ / this.intNk) - 1];
        } else if (this.intNk > 6 && intJ % this.intNk == 4) {
          intTemp = 
            (Rijndael.arrSBox[(intTemp >> 24) & 0xFF] << 24) |
            (Rijndael.arrSBox[(intTemp >> 16) & 0xFF] << 16) |
            (Rijndael.arrSBox[(intTemp >>  8) & 0xFF] <<  8) |
            (Rijndael.arrSBox[ intTemp        & 0xFF]);
        };
        this.arrExpandedKey[intJ] = this.arrExpandedKey[intJ-this.intNk] ^ intTemp;
      };
    }
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
  // The number of rounds for the cipher, indexed by [Nk][Nb]
  Rijndael.arrRoundsArray = [
       0,  0,  0,  0,
    [  0,  0,  0,  0, 10,  0, 12,  0, 14],  0, 
    [  0,  0,  0,  0, 12,  0, 12,  0, 14],  0, 
    [  0,  0,  0,  0, 14,  0, 14,  0, 14]
  ];
  
  // The number of bytes to shift by in shiftRow, indexed by [Nb][row]
  Rijndael.arrShiftOffsets = [
       0,  0,  0,  0,
    [  0,  1,  2,  3],  0,
    [  0,  1,  2,  3],  0,
    [  0,  1,  3,  4]
  ];
  
  // The round constants used in subkey expansion
  Rijndael.arrRcon = [ 
    0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 
    0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 
    0xab, 0x4d, 0x9a, 0x2f, 0x5e, 0xbc, 
    0x63, 0xc6, 0x97, 0x35, 0x6a, 0xd4, 
    0xb3, 0x7d, 0xfa, 0xef, 0xc5, 0x91
  ];
  
  // Precomputed lookup table for the SBox
  Rijndael.arrSBox = [
     99, 124, 119, 123, 242, 107, 111, 197,  48,   1, 103,  43, 254, 215, 171, 
    118, 202, 130, 201, 125, 250,  89,  71, 240, 173, 212, 162, 175, 156, 164, 
    114, 192, 183, 253, 147,  38,  54,  63, 247, 204,  52, 165, 229, 241, 113, 
    216,  49,  21,   4, 199,  35, 195,  24, 150,   5, 154,   7,  18, 128, 226, 
    235,  39, 178, 117,   9, 131,  44,  26,  27, 110,  90, 160,  82,  59, 214, 
    179,  41, 227,  47, 132,  83, 209,   0, 237,  32, 252, 177,  91, 106, 203, 
    190,  57,  74,  76,  88, 207, 208, 239, 170, 251,  67,  77,  51, 133,  69, 
    249,   2, 127,  80,  60, 159, 168,  81, 163,  64, 143, 146, 157,  56, 245, 
    188, 182, 218,  33,  16, 255, 243, 210, 205,  12,  19, 236,  95, 151,  68,  
    23,  196, 167, 126,  61, 100,  93,  25, 115,  96, 129,  79, 220,  34,  42, 
    144, 136,  70, 238, 184,  20, 222,  94,  11, 219, 224,  50,  58,  10,  73,
      6,  36,  92, 194, 211, 172,  98, 145, 149, 228, 121, 231, 200,  55, 109, 
    141, 213,  78, 169, 108,  86, 244, 234, 101, 122, 174,   8, 186, 120,  37,  
     46,  28, 166, 180, 198, 232, 221, 116,  31,  75, 189, 139, 138, 112,  62, 
    181, 102,  72,   3, 246,  14,  97,  53,  87, 185, 134, 193,  29, 158, 225,
    248, 152,  17, 105, 217, 142, 148, 155,  30, 135, 233, 206,  85,  40, 223,
    140, 161, 137,  13, 191, 230,  66, 104,  65, 153,  45,  15, 176,  84, 187,  
     22
  ];
  
  // Precomputed lookup table for the inverse SBox
  Rijndael.arrSBoxInverse = [
     82,   9, 106, 213,  48,  54, 165,  56, 191,  64, 163, 158, 129, 243, 215, 
    251, 124, 227,  57, 130, 155,  47, 255, 135,  52, 142,  67,  68, 196, 222, 
    233, 203,  84, 123, 148,  50, 166, 194,  35,  61, 238,  76, 149,  11,  66, 
    250, 195,  78,   8,  46, 161, 102,  40, 217,  36, 178, 118,  91, 162,  73, 
    109, 139, 209,  37, 114, 248, 246, 100, 134, 104, 152,  22, 212, 164,  92, 
    204,  93, 101, 182, 146, 108, 112,  72,  80, 253, 237, 185, 218,  94,  21,  
     70,  87, 167, 141, 157, 132, 144, 216, 171,   0, 140, 188, 211,  10, 247, 
    228,  88,   5, 184, 179,  69,   6, 208,  44,  30, 143, 202,  63,  15,   2, 
    193, 175, 189,   3,   1,  19, 138, 107,  58, 145,  17,  65,  79, 103, 220, 
    234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116,  34, 231, 173,
     53, 133, 226, 249,  55, 232,  28, 117, 223, 110,  71, 241,  26, 113,  29, 
     41, 197, 137, 111, 183,  98,  14, 170,  24, 190,  27, 252,  86,  62,  75, 
    198, 210, 121,  32, 154, 219, 192, 254, 120, 205,  90, 244,  31, 221, 168,
     51, 136,   7, 199,  49, 177,  18,  16,  89,  39, 128, 236,  95,  96,  81,
    127, 169,  25, 181,  74,  13,  45, 229, 122, 159, 147, 201, 156, 239, 160,
    224,  59,  77, 174,  42, 245, 176, 200, 235, 187,  60, 131,  83, 153,  97, 
     23,  43,   4, 126, 186, 119, 214,  38, 225, 105,  20,  99,  85,  33,  12,
    125
  ];
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(Rijndael);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','Rijndael','Constructor');
};
