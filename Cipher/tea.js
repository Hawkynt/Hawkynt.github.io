/*
 *  TEA Class
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
var TEA=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  TEA.szInternalName='TEA';
  TEA.szName='Tiny Encryption Algorithm';
  TEA.szComment='This is the normal TEA Cipher Algorithm';
  TEA.intMinKeyLength=16;
  TEA.intMaxKeyLength=16;
  TEA.intStepKeyLength=1;
  TEA.intMinBlockSize=8;
  TEA.intMaxBlockSize=8;
  TEA.intStepBlockSize=1;
  TEA.arrInstances=[];
  
  TEA.boolCantDecode=false;
  TEA.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  TEA.intRounds=32;
  TEA.intDelta=0x9e3779b9;
  // =======================[ PUBLIC STATIC ]===========================
  TEA.Init=function () {
    TEA.boolInit=true;
  }
  
  TEA.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='TEA['+szGenerateUniqueID()+']';
    } while ((TEA.arrInstances[szID]) || (TEA.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    TEA.arrInstances[szID]=new TEA.classTEA(optional_szKey);
    return (szID);
  }
  
  TEA.ClearData=function (szID) {
    if ((TEA.arrInstances[szID]) && (TEA.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete TEA.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'TEA','ClearData');
      return (false);
    };
  }
  
  TEA.szEncryptBlock=function (szID,szPlainText) {
    if ((TEA.arrInstances[szID]) && (TEA.arrInstances[szID]!=undefined)) {
      var szRet='';
      // Crypt
      var objTEA=TEA.arrInstances[szID];
      var intY=
        (szPlainText.charCodeAt(0) & 0xff) << 24 |
        (szPlainText.charCodeAt(1) & 0xff) << 16 |
        (szPlainText.charCodeAt(2) & 0xff) << 8  |
        (szPlainText.charCodeAt(3) & 0xff)        ;
      var intZ=
        (szPlainText.charCodeAt(4) & 0xff) << 24 |
        (szPlainText.charCodeAt(5) & 0xff) << 16 |
        (szPlainText.charCodeAt(6) & 0xff) << 8  |
        (szPlainText.charCodeAt(7) & 0xff)        ;
      var intLimit=TEA.intDelta*TEA.intRounds;
      var intSum=0;
      while(intSum!=intLimit) {
        intY+=((intZ<<4)^(intZ>>5)) + (intZ^intSum) + objTEA.arrKey[intSum&3];
        intSum+=TEA.intDelta;
        intZ+=((intY<<4)^(intY>>5)) + (intY^intSum) + objTEA.arrKey[(intSum>>11)&3];
      };
      szRet = 
        String.fromCharCode((intY >>> 24) & 0xff) + 
        String.fromCharCode((intY >>> 16) & 0xff) + 
        String.fromCharCode((intY >>>  8) & 0xff) + 
        String.fromCharCode((intY       ) & 0xff) + 
        String.fromCharCode((intZ >>> 24) & 0xff) + 
        String.fromCharCode((intZ >>> 16) & 0xff) + 
        String.fromCharCode((intZ >>>  8) & 0xff) + 
        String.fromCharCode((intZ       ) & 0xff) ;
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'TEA','szEncryptBlock');
    };
  }
  
  TEA.szDecryptBlock=function (szID,szCipherText) {
    if ((TEA.arrInstances[szID]) && (TEA.arrInstances[szID]!=undefined)) {
      var szRet='';
      var objTEA=TEA.arrInstances[szID];
      // Decrypt
      var intY=
        (szCipherText.charCodeAt(0) & 0xff) << 24 |
        (szCipherText.charCodeAt(1) & 0xff) << 16 |
        (szCipherText.charCodeAt(2) & 0xff) << 8  |
        (szCipherText.charCodeAt(3) & 0xff)        ;
      var intZ=
        (szCipherText.charCodeAt(4) & 0xff) << 24 |
        (szCipherText.charCodeAt(5) & 0xff) << 16 |
        (szCipherText.charCodeAt(6) & 0xff) << 8  |
        (szCipherText.charCodeAt(7) & 0xff)        ;
      var intSum=TEA.intDelta*TEA.intRounds;
      while(intSum>0) {
        intZ-=((intY<<4)^(intY>>5)) + (intY^intSum) + objTEA.arrKey[(intSum>>11)&3];
        intSum-=TEA.intDelta;
        intY-=((intZ<<4)^(intZ>>5)) + (intZ^intSum) + objTEA.arrKey[intSum&3];
      };
      szRet = 
        String.fromCharCode((intY >>> 24) & 0xff) + 
        String.fromCharCode((intY >>> 16) & 0xff) + 
        String.fromCharCode((intY >>>  8) & 0xff) + 
        String.fromCharCode((intY       ) & 0xff) + 
        String.fromCharCode((intZ >>> 24) & 0xff) + 
        String.fromCharCode((intZ >>> 16) & 0xff) + 
        String.fromCharCode((intZ >>>  8) & 0xff) + 
        String.fromCharCode((intZ       ) & 0xff) ;
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'TEA','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  TEA.classTEA=function (szKey) {
    // Make Key Setup
    this.arrKey=[]; // [4]
    for (var intI=0;intI<4;intI++) {
      this.arrKey[intI]=szKey.charCodeAt(intI) & 0xff;
    };
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(TEA);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','TEA','Constructor');
};
