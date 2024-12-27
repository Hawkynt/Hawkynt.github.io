/*
 *  ROT13 Class
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
var ROT13=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  ROT13.szInternalName='ROT13';
  ROT13.szName='Rotate by 13';
  ROT13.szComment='This is the normal ROT13 Cipher Algorithm';
  ROT13.intMinKeyLength=0;
  ROT13.intMaxKeyLength=0;
  ROT13.intStepKeyLength=1;
  ROT13.intMinBlockSize=0;
  ROT13.intMaxBlockSize=0;
  ROT13.intStepBlockSize=1;
  ROT13.arrInstances=[];
  
  ROT13.boolCantDecode=false;
  ROT13.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  ROT13.Replacer=[];
  ROT13.Replacer.push(['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
                       'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm']);
  // =======================[ PUBLIC STATIC ]===========================
  ROT13.Init=function () {
    ROT13.boolInit=true;
  }
  
  ROT13.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='ROT13['+szGenerateUniqueID()+']';
    } while ((ROT13.arrInstances[szID]) || (ROT13.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    ROT13.arrInstances[szID]=new ROT13.classROT13(optional_szKey);
    return (szID);
  }
  
  ROT13.ClearData=function (szID) {
    if ((ROT13.arrInstances[szID]) && (ROT13.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete ROT13.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT13','ClearData');
      return (false);
    };
  }
  
  ROT13.szEncryptBlock=function (szID,szPlainText) {
    if ((ROT13.arrInstances[szID]) && (ROT13.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<ROT13.Replacer.length;intJ++) {
          if (ROT13.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=ROT13.Replacer[intJ][1].charAt(ROT13.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT13','szEncryptBlock');
    };
  }
  
  ROT13.szDecryptBlock=function (szID,szCipherText) {
    if ((ROT13.arrInstances[szID]) && (ROT13.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<ROT13.Replacer.length;intJ++) {
          if (ROT13.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=ROT13.Replacer[intJ][0].charAt(ROT13.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT13','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  ROT13.classROT13=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
var ROT5=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  ROT5.szInternalName='ROT5';
  ROT5.szName='Rotate by 5';
  ROT5.szComment='This is the normal ROT5 Cipher Algorithm';
  ROT5.intMinKeyLength=0;
  ROT5.intMaxKeyLength=0;
  ROT5.intStepKeyLength=1;
  ROT5.intMinBlockSize=0;
  ROT5.intMaxBlockSize=0;
  ROT5.intStepBlockSize=1;
  ROT5.arrInstances=[];
  
  ROT5.boolCantDecode=false;
  ROT5.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  ROT5.Replacer=[];
  ROT5.Replacer.push(['0123456789',
                      '5678901234']);
  // =======================[ PUBLIC STATIC ]===========================
  ROT5.Init=function () {
    ROT5.boolInit=true;
  }
  
  ROT5.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='ROT5['+szGenerateUniqueID()+']';
    } while ((ROT5.arrInstances[szID]) || (ROT5.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    ROT5.arrInstances[szID]=new ROT5.classROT5(optional_szKey);
    return (szID);
  }
  
  ROT5.ClearData=function (szID) {
    if ((ROT5.arrInstances[szID]) && (ROT5.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete ROT5.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT5','ClearData');
      return (false);
    };
  }
  
  ROT5.szEncryptBlock=function (szID,szPlainText) {
    if ((ROT5.arrInstances[szID]) && (ROT5.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<ROT5.Replacer.length;intJ++) {
          if (ROT5.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=ROT5.Replacer[intJ][1].charAt(ROT5.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT5','szEncryptBlock');
    };
  }
  
  ROT5.szDecryptBlock=function (szID,szCipherText) {
    if ((ROT5.arrInstances[szID]) && (ROT5.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<ROT5.Replacer.length;intJ++) {
          if (ROT5.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=ROT5.Replacer[intJ][0].charAt(ROT5.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT5','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  ROT5.classROT5=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
var ROT18=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  ROT18.szInternalName='ROT18';
  ROT18.szName='ROT18';
  ROT18.szComment='This is the normal ROT13 combined with ROT5 Cipher Algorithm';
  ROT18.intMinKeyLength=0;
  ROT18.intMaxKeyLength=0;
  ROT18.intStepKeyLength=1;
  ROT18.intMinBlockSize=0;
  ROT18.intMaxBlockSize=0;
  ROT18.intStepBlockSize=1;
  ROT18.arrInstances=[];
  
  ROT18.boolCantDecode=false;
  ROT18.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  ROT18.Replacer=[];
  ROT18.Replacer.push(['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                       'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm5678901234']);
  // =======================[ PUBLIC STATIC ]===========================
  ROT18.Init=function () {
    ROT18.boolInit=true;
  }
  
  ROT18.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='ROT18['+szGenerateUniqueID()+']';
    } while ((ROT18.arrInstances[szID]) || (ROT18.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    ROT18.arrInstances[szID]=new ROT18.classROT18(optional_szKey);
    return (szID);
  }
  
  ROT18.ClearData=function (szID) {
    if ((ROT18.arrInstances[szID]) && (ROT18.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete ROT18.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT18','ClearData');
      return (false);
    };
  }
  
  ROT18.szEncryptBlock=function (szID,szPlainText) {
    if ((ROT18.arrInstances[szID]) && (ROT18.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<ROT18.Replacer.length;intJ++) {
          if (ROT18.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=ROT18.Replacer[intJ][1].charAt(ROT18.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT18','szEncryptBlock');
    };
  }
  
  ROT18.szDecryptBlock=function (szID,szCipherText) {
    if ((ROT18.arrInstances[szID]) && (ROT18.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<ROT18.Replacer.length;intJ++) {
          if (ROT18.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=ROT18.Replacer[intJ][0].charAt(ROT18.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT18','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  ROT18.classROT18=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
var ROT47=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  ROT47.szInternalName='ROT47';
  ROT47.szName='Rotate by 47';
  ROT47.szComment='This is the normal ROT47 Cipher Algorithm';
  ROT47.intMinKeyLength=0;
  ROT47.intMaxKeyLength=0;
  ROT47.intStepKeyLength=1;
  ROT47.intMinBlockSize=0;
  ROT47.intMaxBlockSize=0;
  ROT47.intStepBlockSize=1;
  ROT47.arrInstances=[];
  
  ROT47.boolCantDecode=false;
  ROT47.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  ROT47.Replacer=[];
  ROT47.Replacer.push(['!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~',
                       'PQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNO']);
  // =======================[ PUBLIC STATIC ]===========================
  ROT47.Init=function () {
    ROT47.boolInit=true;
  }
  
  ROT47.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='ROT47['+szGenerateUniqueID()+']';
    } while ((ROT47.arrInstances[szID]) || (ROT47.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    ROT47.arrInstances[szID]=new ROT47.classROT47(optional_szKey);
    return (szID);
  }
  
  ROT47.ClearData=function (szID) {
    if ((ROT47.arrInstances[szID]) && (ROT47.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete ROT47.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT47','ClearData');
      return (false);
    };
  }
  
  ROT47.szEncryptBlock=function (szID,szPlainText) {
    if ((ROT47.arrInstances[szID]) && (ROT47.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szPlainText.length;intI++) {
        var chChar=szPlainText.charAt(intI);
        for (var intJ=0;intJ<ROT47.Replacer.length;intJ++) {
          if (ROT47.Replacer[intJ][0].indexOf(chChar)>-1) {
            chChar=ROT47.Replacer[intJ][1].charAt(ROT47.Replacer[intJ][0].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT47','szEncryptBlock');
    };
  }
  
  ROT47.szDecryptBlock=function (szID,szCipherText) {
    if ((ROT47.arrInstances[szID]) && (ROT47.arrInstances[szID]!=undefined)) {
      var szRet='';
      for (var intI=0;intI<szCipherText.length;intI++) {
        var chChar=szCipherText.charAt(intI);
        for (var intJ=0;intJ<ROT47.Replacer.length;intJ++) {
          if (ROT47.Replacer[intJ][1].indexOf(chChar)>-1) {
            chChar=ROT47.Replacer[intJ][0].charAt(ROT47.Replacer[intJ][1].indexOf(chChar));
          };
        };
        szRet+=chChar;
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROT47','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  ROT47.classROT47=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
var ROTx=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  ROTx.szInternalName='ROTx';
  ROTx.szName='Rotate by x';
  ROTx.szComment='This is the normal ROTx Cipher Algorithm';
  ROTx.intMinKeyLength=1;
  ROTx.intMaxKeyLength=0;
  ROTx.intStepKeyLength=1;
  ROTx.intMinBlockSize=0;
  ROTx.intMaxBlockSize=0;
  ROTx.intStepBlockSize=1;
  ROTx.arrInstances=[];
  
  ROTx.boolCantDecode=false;
  ROTx.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  ROTx.Chars='!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
  // =======================[ PUBLIC STATIC ]===========================
  ROTx.Init=function () {
    ROTx.boolInit=true;
  }
  
  ROTx.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='ROTx['+szGenerateUniqueID()+']';
    } while ((ROTx.arrInstances[szID]) || (ROTx.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    ROTx.arrInstances[szID]=new ROTx.classROTx(optional_szKey);
    return (szID);
  }
  
  ROTx.ClearData=function (szID) {
    if ((ROTx.arrInstances[szID]) && (ROTx.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete ROTx.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROTx','ClearData');
      return (false);
    };
  }
  
  ROTx.szEncryptBlock=function (szID,szPlainText) {
    if ((ROTx.arrInstances[szID]) && (ROTx.arrInstances[szID]!=undefined)) {
      var szRet='';
      if (ROTx.arrInstances[szID].szKey==parseInt(ROTx.arrInstances[szID].szKey)) {
        // Rotate by Number
        var intKey=parseInt(ROTx.arrInstances[szID].szKey);
        for (var intI=0;intI<szPlainText.length;intI++) {
          var chChar=szPlainText.charAt(intI);
          if (ROTx.Chars.indexOf(chChar)>-1) {
            var intNewPos=ROTx.Chars.indexOf(chChar)+intKey;
            while (intNewPos<0) intNewPos+=ROTx.Chars.length;
            chChar=ROTx.Chars.charAt(intNewPos % ROTx.Chars.length);
          };
          szRet+=chChar;
        };
      } else {
        // Rotate by Key
        for (var intI=0;intI<szPlainText.length;intI++) {
          var chChar=szPlainText.charAt(intI);
          if (ROTx.Chars.indexOf(chChar)>-1) {
            var intNewPos=ROTx.Chars.indexOf(chChar)+ROTx.arrInstances[szID].szKey.charCodeAt(intI % ROTx.arrInstances[szID].szKey.length);
            while (intNewPos<0) intNewPos+=ROTx.Chars.length;
            chChar=ROTx.Chars.charAt(intNewPos % ROTx.Chars.length);
          };
          szRet+=chChar;
        };
      };
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROTx','szEncryptBlock');
    };
  }
  
  ROTx.szDecryptBlock=function (szID,szCipherText) {
    if ((ROTx.arrInstances[szID]) && (ROTx.arrInstances[szID]!=undefined)) {
      var szRet='';
      if (ROTx.arrInstances[szID].szKey==parseInt(ROTx.arrInstances[szID].szKey)) {
        // Rotate by Number
        var intKey=parseInt(ROTx.arrInstances[szID].szKey);
        for (var intI=0;intI<szCipherText.length;intI++) {
          var chChar=szCipherText.charAt(intI);
          if (ROTx.Chars.indexOf(chChar)>-1) {
            var intNewPos=ROTx.Chars.indexOf(chChar)-intKey+ROTx.Chars.length;
            while (intNewPos<0) intNewPos+=ROTx.Chars.length;
            chChar=ROTx.Chars.charAt(intNewPos % ROTx.Chars.length);
          };
          szRet+=chChar;
        };
      } else {
        // Rotate by Key
        for (var intI=0;intI<szCipherText.length;intI++) {
          var chChar=szCipherText.charAt(intI);
          if (ROTx.Chars.indexOf(chChar)>-1) {
            var intNewPos=(ROTx.Chars.indexOf(chChar)-ROTx.arrInstances[szID].szKey.charCodeAt(intI % ROTx.arrInstances[szID].szKey.length));
            while (intNewPos<0) intNewPos+=ROTx.Chars.length;
            chChar=ROTx.Chars.charAt(intNewPos % ROTx.Chars.length);
          };
          szRet+=chChar;
        };
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'ROTx','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  ROTx.classROTx=function (szKey) {
    // Make Key Setup
    this.szKey=szKey;
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(ROT13);
  Cipher.AddCipher(ROT5);
  Cipher.AddCipher(ROT18);
  Cipher.AddCipher(ROT47);
  Cipher.AddCipher(ROTx);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','ROT','Constructor');
};
