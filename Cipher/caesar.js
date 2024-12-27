/*
 *  Caesar Class
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
var Caesar=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  Caesar.szInternalName='Caesar';
  Caesar.szName='Caesar';
  Caesar.szComment='This is the normal Caesar Cipher Algorithm';
  Caesar.intMinKeyLength=0;
  Caesar.intMaxKeyLength=0;
  Caesar.intStepKeyLength=1;
  Caesar.intMinBlockSize=0;
  Caesar.intMaxBlockSize=0;
  Caesar.intStepBlockSize=1;
  Caesar.arrInstances=[];
  
  Caesar.boolCantDecode=false;
  Caesar.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  Caesar.Replacer=[];
  Caesar.Replacer.push(['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                        'DEFGHIJKLMNOPQRSTUVWXYZABCdefghijklmnopqrstuvwxyzabc3456789012']);
  // =======================[ PUBLIC STATIC ]===========================
  Caesar.Init=function () {
    Caesar.boolInit=true;
  }
  
  Caesar.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='Caesar['+szGenerateUniqueID()+']';
    } while ((Caesar.arrInstances[szID]) || (Caesar.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    Caesar.arrInstances[szID]=new Caesar.classCaesar(optional_szKey);
    return (szID);
  }
  
  Caesar.ClearData=function (szID) {
    if ((Caesar.arrInstances[szID]) && (Caesar.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete Caesar.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Caesar','ClearData');
      return (false);
    };
  }
  
  Caesar.szEncryptBlock=function (szID,szPlainText) {
    if ((Caesar.arrInstances[szID]) && (Caesar.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<Caesar.Replacer.length;intJ++) {
          if (Caesar.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=Caesar.Replacer[intJ][1].charAt(Caesar.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Caesar','szEncryptBlock');
    };
  }
  
  Caesar.szDecryptBlock=function (szID,szCipherText) {
    if ((Caesar.arrInstances[szID]) && (Caesar.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<Caesar.Replacer.length;intJ++) {
          if (Caesar.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=Caesar.Replacer[intJ][0].charAt(Caesar.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'Caesar','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  Caesar.classCaesar=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(Caesar);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','Caesar','Constructor');
};
