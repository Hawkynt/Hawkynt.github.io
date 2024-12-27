/*
 *  Anubis Class
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
var Anubis=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  Anubis.szInternalName='Anubis';
  Anubis.szName='Anubis';
  Anubis.szComment='This is an implementation of the tweaked Anubis Cipher Algorithm from http://paginas.terra.com.br/informatica/paulobarreto/AnubisPage.html';
  Anubis.intMinKeyLength=16;
  Anubis.intMaxKeyLength=40;
  Anubis.intStepKeyLength=4;
  Anubis.intMinBlockSize=16;
  Anubis.intMaxBlockSize=16;
  Anubis.intStepBlockSize=1;
  Anubis.arrInstances=[];
  
  Anubis.boolCantDecode=false;
  Anubis.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  Anubis.arrT0=[]; // [256]
  Anubis.arrT1=[]; // [256]
  Anubis.arrT2=[]; // [256]
  Anubis.arrT3=[]; // [256]
  Anubis.arrT4=[]; // [256]
  Anubis.arrT5=[]; // [256]
  // =======================[ PUBLIC STATIC ]===========================
  Anubis.Init=function () {
    for (var intX = 0; intX < 256; intX++) {
      var byteC = Anubis.szSBox.charCodeAt(Math.floor(intX/2));
      var intS1 = ((intX & 1) == 0) ? byteC >>> 8 : byteC & 0xff;
      var intS2 = intS1 << 1;
      if (intS2 >= 0x100) {
          intS2 ^= 0x11d; // reduce s2 (mod ROOT)
      };
      var intS4 = intS2 << 1;
      if (intS4 >= 0x100) {
          intS4 ^= 0x11d; // reduce intS4 (mod ROOT)
      };
      var intS6 = intS4 ^ intS2;
      var intS8 = intS4 << 1;
      if (intS8 >= 0x100) {
          intS8 ^= 0x11d; // reduce intS8 (mod ROOT)
      };
      var intX2 = intX  << 1;
      if (intX2 >= 0x100) {
          intX2 ^= 0x11d; // reduce intX2 (mod ROOT)
      };
      var intX4 = intX2 << 1;
      if (intX4 >= 0x100) {
          intX4 ^= 0x11d; // reduce intX4 (mod ROOT)
      };
      var intX6 = intX2 ^ intX4;
      var intX8 = intX4 << 1;
      if (intX8 >= 0x100) {
          intX8 ^= 0x11d; // reduce intX8 (mod ROOT)
      };
      Anubis.arrT0[intX] = (intS1 << 24) | (intS2 << 16) | (intS4 << 8) | intS6; // [ S[intX], 2S[intX], 4S[intX], 6S[intX]]
      Anubis.arrT1[intX] = (intS2 << 24) | (intS1 << 16) | (intS6 << 8) | intS4; // [2S[intX],  S[intX], 6S[intX], 4S[intX]]
      Anubis.arrT2[intX] = (intS4 << 24) | (intS6 << 16) | (intS1 << 8) | intS2; // [4S[intX], 6S[intX],  S[intX], 2S[intX]]
      Anubis.arrT3[intX] = (intS6 << 24) | (intS4 << 16) | (intS2 << 8) | intS1; // [6S[intX], 4S[intX], 2S[intX],  S[intX]]
      Anubis.arrT4[intX] = (intS1 << 24) | (intS1 << 16) | (intS1 << 8) | intS1; // [ S[intX],  S[intX],  S[intX],  S[intX]]
      Anubis.arrT5[intX] = (intX  << 24) | (intX2 << 16) | (intX6 << 8) | intX8; // [   intX,    2x,    6x,    8x]
    };
    Anubis.boolInit=true;
  }
  
  Anubis.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='Anubis['+szGenerateUniqueID()+']';
    } while ((Anubis.arrInstances[szID]) || (Anubis.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    Anubis.arrInstances[szID]=new Anubis.classAnubis(optional_szKey);
    return (szID);
  }
  
  Anubis.ClearData=function (szID) {
    if ((Anubis.arrInstances[szID]) && (Anubis.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete Anubis.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Anubis','ClearData');
      return (false);
    };
  }
  
  Anubis.szEncryptBlock=function (szID,szPlainText) {
    if ((Anubis.arrInstances[szID]) && (Anubis.arrInstances[szID]!=undefined)) {
      return (Anubis.Crypt(szPlainText,Anubis.arrInstances[szID].arrRoundKeyEnc));
    } else {
      throwException('Unknown Object Reference Exception',szID,'Anubis','szEncryptBlock');
    };
  }
  
  Anubis.szDecryptBlock=function (szID,szCipherText) {
    if ((Anubis.arrInstances[szID]) && (Anubis.arrInstances[szID]!=undefined)) {
      return (Anubis.Crypt(szCipherText,Anubis.arrInstances[szID].arrRoundKeyDec));
    } else {
      throwException('Unknown Object Reference Exception',szID,'Anubis','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // Encrypts or decrypts a 16 Byte Block
  Anubis.Crypt=function (szText,arrRoundKey) {
    var szRet='';
    // Crypt
    var arrState=[]; // [4]
    var arrInter=[]; // [4]
    var intR=arrRoundKey.length-1; // Number of Rounds
    var intI;
    var intJ;
    /*
     * map byte array block to cipher state (mu)
     * and add initial round key (sigma[K^0]):
     */
    intJ=0;
    for (intI = 0; intI < 4; intI++) {
      arrState[intI] =
        ((szText.charCodeAt(intJ++) & 0xff) << 24) ^
        ((szText.charCodeAt(intJ++) & 0xff) << 16) ^
        ((szText.charCodeAt(intJ++) & 0xff) <<  8) ^
        ((szText.charCodeAt(intJ++) & 0xff)      ) ^
        arrRoundKey[0][intI];
    };
    // R - 1 full rounds:
    for (var intR2 = 1; intR2 < intR; intR2++) {
      arrInter[0] =
        Anubis.arrT0[(arrState[0] >>> 24) & 0xff] ^
        Anubis.arrT1[(arrState[1] >>> 24) & 0xff] ^
        Anubis.arrT2[(arrState[2] >>> 24) & 0xff] ^
        Anubis.arrT3[(arrState[3] >>> 24) & 0xff] ^
        arrRoundKey[intR2][0];
      arrInter[1] =
        Anubis.arrT0[(arrState[0] >>> 16) & 0xff] ^
        Anubis.arrT1[(arrState[1] >>> 16) & 0xff] ^
        Anubis.arrT2[(arrState[2] >>> 16) & 0xff] ^
        Anubis.arrT3[(arrState[3] >>> 16) & 0xff] ^
        arrRoundKey[intR2][1];
      arrInter[2] =
        Anubis.arrT0[(arrState[0] >>>  8) & 0xff] ^
        Anubis.arrT1[(arrState[1] >>>  8) & 0xff] ^
        Anubis.arrT2[(arrState[2] >>>  8) & 0xff] ^
        Anubis.arrT3[(arrState[3] >>>  8) & 0xff] ^
        arrRoundKey[intR2][2];
      arrInter[3] =
        Anubis.arrT0[(arrState[0]       ) & 0xff] ^
        Anubis.arrT1[(arrState[1]       ) & 0xff] ^
        Anubis.arrT2[(arrState[2]       ) & 0xff] ^
        Anubis.arrT3[(arrState[3]       ) & 0xff] ^
        arrRoundKey[intR2][3];
      for (intI = 0; intI < 4; intI++) {
        arrState[intI] = arrInter[intI];
      };
    };
    /*
     * last round:
     */
    arrInter[0] =
      (Anubis.arrT0[(arrState[0] >>> 24) & 0xff] & 0xff000000) ^
      (Anubis.arrT1[(arrState[1] >>> 24) & 0xff] & 0x00ff0000) ^
      (Anubis.arrT2[(arrState[2] >>> 24) & 0xff] & 0x0000ff00) ^
      (Anubis.arrT3[(arrState[3] >>> 24) & 0xff] & 0x000000ff) ^
      arrRoundKey[intR][0];
    arrInter[1] =
      (Anubis.arrT0[(arrState[0] >>> 16) & 0xff] & 0xff000000) ^
      (Anubis.arrT1[(arrState[1] >>> 16) & 0xff] & 0x00ff0000) ^
      (Anubis.arrT2[(arrState[2] >>> 16) & 0xff] & 0x0000ff00) ^
      (Anubis.arrT3[(arrState[3] >>> 16) & 0xff] & 0x000000ff) ^
      arrRoundKey[intR][1];
    arrInter[2] =
      (Anubis.arrT0[(arrState[0] >>>  8) & 0xff] & 0xff000000) ^
      (Anubis.arrT1[(arrState[1] >>>  8) & 0xff] & 0x00ff0000) ^
      (Anubis.arrT2[(arrState[2] >>>  8) & 0xff] & 0x0000ff00) ^
      (Anubis.arrT3[(arrState[3] >>>  8) & 0xff] & 0x000000ff) ^
      arrRoundKey[intR][2];
    arrInter[3] =
      (Anubis.arrT0[(arrState[0]       ) & 0xff] & 0xff000000) ^
      (Anubis.arrT1[(arrState[1]       ) & 0xff] & 0x00ff0000) ^
      (Anubis.arrT2[(arrState[2]       ) & 0xff] & 0x0000ff00) ^
      (Anubis.arrT3[(arrState[3]       ) & 0xff] & 0x000000ff) ^
      arrRoundKey[intR][3];
    // map cipher state to byte array block (mu^{-1}):
    for (intI = 0; intI < 4; intI++) {
      var intW = arrInter[intI];
      szRet+=String.fromCharCode((intW >>> 24) & 0xff);
      szRet+=String.fromCharCode((intW >>> 16) & 0xff);
      szRet+=String.fromCharCode((intW >>>  8) & 0xff);
      szRet+=String.fromCharCode((intW       ) & 0xff);
    };
    return (szRet);
  }
  
  // =======================[ PRIVATE CLASS ]===========================
  Anubis.classAnubis=function (szKey) {
    // Make Key Setup
    var intI;
    var intJ;
    var intN=Math.floor(szKey.length/4);
    var arrKappa=[]; // [intN]
    var arrInter=[]; // [intN]
    // determine number of rounds from key size:
    var intR = 8 + intN;
    this.arrRoundKeyEnc = []; // [intR+1]
    for (intI=0;intI<(intR+1);intI++) {
      this.arrRoundKeyEnc[intI]=[]; // [4]
    }; // int[intR  + 1][4];
    this.arrRoundKeyDec = new Array(intR+1);
    for (intI=0;intI<(intR+1);intI++) {
      this.arrRoundKeyDec[intI]=[]; // [4]
    }; // int[intR  + 1][4];
    // map byte array cipher key to initial key state (mu):
    intJ = 0
    for (intI = 0; intI < intN; intI++) {
      arrKappa[intI]=((szKey.charCodeAt(intJ++) & 0xff) << 24) ^
                     ((szKey.charCodeAt(intJ++) & 0xff) << 16) ^
                     ((szKey.charCodeAt(intJ++) & 0xff) <<  8) ^
                     ((szKey.charCodeAt(intJ++) & 0xff)      );
    };
    // generate R + 1 round keys:
    for (var intR2 = 0; intR2 <= intR; intR2++) {
      var intK0, intK1, intK2, intK3;
      /*
       * generate r-th round key K^r:
       */
      intK0 = Anubis.arrT4[(arrKappa[intN - 1] >>> 24) & 0xff];
      intK1 = Anubis.arrT4[(arrKappa[intN - 1] >>> 16) & 0xff];
      intK2 = Anubis.arrT4[(arrKappa[intN - 1] >>>  8) & 0xff];
      intK3 = Anubis.arrT4[(arrKappa[intN - 1]       ) & 0xff];
      for (intI = intN - 2; intI >= 0; intI--) {
        intK0 = Anubis.arrT4[(arrKappa[intI] >>> 24) & 0xff] ^
          (Anubis.arrT5[(intK0 >>> 24)       ] & 0xff000000) ^
          (Anubis.arrT5[(intK0 >>> 16) & 0xff] & 0x00ff0000) ^
          (Anubis.arrT5[(intK0 >>>  8) & 0xff] & 0x0000ff00) ^
          (Anubis.arrT5[(intK0       ) & 0xff] & 0x000000ff);
        intK1 = Anubis.arrT4[(arrKappa[intI] >>> 16) & 0xff] ^
          (Anubis.arrT5[(intK1 >>> 24)       ] & 0xff000000) ^
          (Anubis.arrT5[(intK1 >>> 16) & 0xff] & 0x00ff0000) ^
          (Anubis.arrT5[(intK1 >>>  8) & 0xff] & 0x0000ff00) ^
          (Anubis.arrT5[(intK1       ) & 0xff] & 0x000000ff);
        intK2 = Anubis.arrT4[(arrKappa[intI] >>>  8) & 0xff] ^
          (Anubis.arrT5[(intK2 >>> 24)       ] & 0xff000000) ^
          (Anubis.arrT5[(intK2 >>> 16) & 0xff] & 0x00ff0000) ^
          (Anubis.arrT5[(intK2 >>>  8) & 0xff] & 0x0000ff00) ^
          (Anubis.arrT5[(intK2       ) & 0xff] & 0x000000ff);
        intK3 = Anubis.arrT4[(arrKappa[intI]       ) & 0xff] ^
          (Anubis.arrT5[(intK3 >>> 24)       ] & 0xff000000) ^
          (Anubis.arrT5[(intK3 >>> 16) & 0xff] & 0x00ff0000) ^
          (Anubis.arrT5[(intK3 >>>  8) & 0xff] & 0x0000ff00) ^
          (Anubis.arrT5[(intK3       ) & 0xff] & 0x000000ff);
      };
      this.arrRoundKeyEnc[intR2][0] = intK0;
      this.arrRoundKeyEnc[intR2][1] = intK1;
      this.arrRoundKeyEnc[intR2][2] = intK2;
      this.arrRoundKeyEnc[intR2][3] = intK3;
      /*
       * compute kappa^{r+1} from kappa^r:
       */
      for (intI = 0; intI < intN; intI++) {
        arrInter[intI] = 
          Anubis.arrT0[(arrKappa[     intI               ] >>> 24) & 0xff] ^
          Anubis.arrT1[(arrKappa[(intN + intI - 1) % intN] >>> 16) & 0xff] ^
          Anubis.arrT2[(arrKappa[(intN + intI - 2) % intN] >>>  8) & 0xff] ^
          Anubis.arrT3[(arrKappa[(intN + intI - 3) % intN]       ) & 0xff];
      };
      arrKappa[0] =
        (Anubis.arrT0[4*intR2    ] & 0xff000000) ^
        (Anubis.arrT1[4*intR2 + 1] & 0x00ff0000) ^
        (Anubis.arrT2[4*intR2 + 2] & 0x0000ff00) ^
        (Anubis.arrT3[4*intR2 + 3] & 0x000000ff) ^
        arrInter[0];
      for (intI = 1; intI < intN; intI++) {
        arrKappa[intI] = arrInter[intI];
      }
    };
    // generate inverse key schedule: K'^0 = K^R, K'^R = K^0, K'^r = theta(K^{R-r}):
    for (intI = 0; intI < 4; intI++) {
      this.arrRoundKeyDec[0][intI] = this.arrRoundKeyEnc[intR][intI];
      this.arrRoundKeyDec[intR][intI] = this.arrRoundKeyEnc[0][intI];
    };
    for (var intR2 = 1; intR2 < intR; intR2++) {
      for (intI = 0; intI < 4; intI++) {
        var intV = this.arrRoundKeyEnc[intR - intR2][intI];
        this.arrRoundKeyDec[intR2][intI] =
          Anubis.arrT0[Anubis.arrT4[(intV >>> 24) & 0xff] & 0xff] ^
          Anubis.arrT1[Anubis.arrT4[(intV >>> 16) & 0xff] & 0xff] ^
          Anubis.arrT2[Anubis.arrT4[(intV >>>  8) & 0xff] & 0xff] ^
          Anubis.arrT3[Anubis.arrT4[(intV       ) & 0xff] & 0xff];
      };
    };
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
  Anubis.szSBox = 
    "\uba54\u2f74\u53d3\ud24d\u50ac\u8dbf\u7052\u9a4c" +
    "\uead5\u97d1\u3351\u5ba6\ude48\ua899\udb32\ub7fc" +
    "\ue39e\u919b\ue2bb\u416e\ua5cb\u6b95\ua1f3\ub102" +
    "\uccc4\u1d14\uc363\uda5d\u5fdc\u7dcd\u7f5a\u6c5c" +
    "\uf726\uffed\ue89d\u6f8e\u19a0\uf089\u0f07\uaffb" +
    "\u0815\u0d04\u0164\udf76\u79dd\u3d16\u3f37\u6d38" +
    "\ub973\ue935\u5571\u7b8c\u7288\uf62a\u3e5e\u2746" +
    "\u0c65\u6861\u03c1\u57d6\ud958\ud866\ud73a\uc83c" +
    "\ufa96\ua798\uecb8\uc7ae\u694b\uaba9\u670a\u47f2" +
    "\ub522\ue5ee\ube2b\u8112\u831b\u0e23\uf545\u21ce" +
    "\u492c\uf9e6\ub628\u1782\u1a8b\ufe8a\u09c9\u874e" +
    "\ue12e\ue4e0\ueb90\ua41e\u8560\u0025\uf4f1\u940b" +
    "\ue775\uef34\u31d4\ud086\u7ead\ufd29\u303b\u9ff8" +
    "\uc613\u0605\uc511\u777c\u7a78\u361c\u3959\u1856" +
    "\ub3b0\u2420\ub292\ua3c0\u4462\u10b4\u8443\u93c2" +
    "\u4abd\u8f2d\ubc9c\u6a40\ucfa2\u804f\u1fca\uaa42";
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(Anubis);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','Anubis','Constructor');
};
