/*
 *  Mystery Class
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
var Mystery=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  Mystery.szInternalName='Mystery';
  Mystery.szName='Mystery';
  Mystery.szComment='This is the normal Mystery Cipher Algorithm';
  Mystery.intMinKeyLength=0;
  Mystery.intMaxKeyLength=0;
  Mystery.intStepKeyLength=1;
  Mystery.intMinBlockSize=0;
  Mystery.intMaxBlockSize=0;
  Mystery.intStepBlockSize=1;
  Mystery.arrInstances=[];
  
  Mystery.boolCantDecode=false;
  Mystery.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  Mystery.Replacer=[];
  Mystery.Replacer.push(['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                         'QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890']);
  // =======================[ PUBLIC STATIC ]===========================
  Mystery.Init=function () {
    Mystery.boolInit=true;
  }
  
  Mystery.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='Mystery['+szGenerateUniqueID()+']';
    } while ((Mystery.arrInstances[szID]) || (Mystery.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    Mystery.arrInstances[szID]=new Mystery.classMystery(optional_szKey);
    return (szID);
  }
  
  Mystery.ClearData=function (szID) {
    if ((Mystery.arrInstances[szID]) && (Mystery.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete Mystery.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Mystery','ClearData');
      return (false);
    };
  }
  
  Mystery.szEncryptBlock=function (szID,szPlainText) {
    if ((Mystery.arrInstances[szID]) && (Mystery.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<Mystery.Replacer.length;intJ++) {
          if (Mystery.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=Mystery.Replacer[intJ][1].charAt(Mystery.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Mystery','szEncryptBlock');
    };
  }
  
  Mystery.szDecryptBlock=function (szID,szCipherText) {
    if ((Mystery.arrInstances[szID]) && (Mystery.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<Mystery.Replacer.length;intJ++) {
          if (Mystery.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=Mystery.Replacer[intJ][0].charAt(Mystery.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'Mystery','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  Mystery.classMystery=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(Mystery);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','Mystery','Constructor');
};
