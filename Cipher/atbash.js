/*
 *  Atbash Class
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
var Atbash=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  Atbash.szInternalName='Atbash';
  Atbash.szName='Atbash';
  Atbash.szComment='This is the normal Atbash Cipher Algorithm';
  Atbash.intMinKeyLength=0;
  Atbash.intMaxKeyLength=0;
  Atbash.intStepKeyLength=1;
  Atbash.intMinBlockSize=0;
  Atbash.intMaxBlockSize=0;
  Atbash.intStepBlockSize=1;
  Atbash.arrInstances=[];
  
  Atbash.boolCantDecode=false;
  Atbash.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  Atbash.Replacer=[];
  Atbash.Replacer.push(['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                        'ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqponmlkjihgfedcba9876543210']);
  // =======================[ PUBLIC STATIC ]===========================
  Atbash.Init=function () {
    Atbash.boolInit=true;
  }
  
  Atbash.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='Atbash['+szGenerateUniqueID()+']';
    } while ((Atbash.arrInstances[szID]) || (Atbash.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    Atbash.arrInstances[szID]=new Atbash.classAtbash(optional_szKey);
    return (szID);
  }
  
  Atbash.ClearData=function (szID) {
    if ((Atbash.arrInstances[szID]) && (Atbash.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete Atbash.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Atbash','ClearData');
      return (false);
    };
  }
  
  Atbash.szEncryptBlock=function (szID,szPlainText) {
    if ((Atbash.arrInstances[szID]) && (Atbash.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<Atbash.Replacer.length;intJ++) {
          if (Atbash.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=Atbash.Replacer[intJ][1].charAt(Atbash.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Atbash','szEncryptBlock');
    };
  }
  
  Atbash.szDecryptBlock=function (szID,szCipherText) {
    if ((Atbash.arrInstances[szID]) && (Atbash.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<Atbash.Replacer.length;intJ++) {
          if (Atbash.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=Atbash.Replacer[intJ][0].charAt(Atbash.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'Atbash','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  Atbash.classAtbash=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(Atbash);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','Atbash','Constructor');
};
