/*
 *  BASE64 Class
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
var BASE64=new Object();
{
  // =======================[ PUBLIC INTERFACE ]==========================
  BASE64.szInternalName='BASE64';
  BASE64.szName='BASE64';
  BASE64.szComment='This is the normal BASE64 Converting Algorithm';
  BASE64.intMinKeyLength=0;
  BASE64.intMaxKeyLength=0;
  BASE64.intStepKeyLength=1;
  BASE64.intMinBlockSize=0;
  BASE64.intMaxBlockSize=0;
  BASE64.intStepBlockSize=1;
  BASE64.arrInstances=[];
  
  BASE64.boolCantDecode=false;
  BASE64.boolInit=false;
  // =======================[ PRIVATE STATIC ]============================
  BASE64.Chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  BASE64.arrB64Table=[];
  BASE64.arrF64Table=[];
  // =======================[ PUBLIC STATIC ]=============================
  BASE64.Init=function () {
    for (var intI=0;intI<BASE64.Chars.length;intI++) {
      BASE64.arrB64Table[intI]=BASE64.Chars.charAt(intI);
      BASE64.arrF64Table[BASE64.arrB64Table[intI]]=intI;
    };
    BASE64.boolInit=true;
  }
  
  BASE64.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='BASE64['+szGenerateUniqueID()+']';
    } while ((BASE64.arrInstances[szID]) || (BASE64.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    BASE64.arrInstances[szID]=new BASE64.classBASE64(optional_szKey);
    return (szID);
  }
  
  BASE64.ClearData=function (szID) {
    if ((BASE64.arrInstances[szID]) && (BASE64.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete BASE64.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'BASE64','ClearData');
      return (false);
    };
  }
  
  BASE64.szEncryptBlock=function (szID,szPlainText) {
    if ((BASE64.arrInstances[szID]) && (BASE64.arrInstances[szID]!=undefined)) {
      var szRet='';
      var intTextLen=szPlainText.length;
      var arrString=[];
      var arrRet=[];
      // String to Unicode Array
      for (var intI=0;intI<szPlainText.length;intI++) {
        arrString[intI]=szPlainText.charCodeAt(intI);
      };
      // Initialize Padding
      if ((intTextLen % 3)==1) {
        arrString[arrString.length]=0;
        arrString[arrString.length]=0;
      } else if ((intTextLen % 3)==2) {
        arrString[arrString.length]=0;
      };
      // Convert
      var intI=0;
      while (intI<arrString.length) {
        arrRet[arrRet.length]=BASE64.arrB64Table[arrString[intI] >> 2];
        arrRet[arrRet.length]=BASE64.arrB64Table[((arrString[intI] & 3) << 4) | (arrString[intI+1] >> 4)];
        arrRet[arrRet.length]=BASE64.arrB64Table[((arrString[intI+1] & 15) << 2) | (arrString[intI+2] >> 6)];
        arrRet[arrRet.length]=BASE64.arrB64Table[arrString[intI+2] & 63];
        intI+=3;
      };
      // Do Padding
      if ((intTextLen % 3)==1) {
        arrRet[arrRet.length-2]='=';
        arrRet[arrRet.length-1]='=';
      } else if ((intTextLen % 3)==2) {
        arrRet[arrRet.length-1]='=';
      };
      szRet=arrRet.join('');
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'BASE64','szEncryptBlock');
    };
  }
  
  BASE64.szDecryptBlock=function (szID,szText) {
    if ((BASE64.arrInstances[szID]) && (BASE64.arrInstances[szID]!=undefined)) {
      var szRet='';
      var szString=szText;
      var arrRet=[];
      // Remove unneccesary Characters
      szString=szString.replace(/\n|\r/g,'');
      szString=szString.replace(/=/g,'');
      var intI=0;
      while (intI<szString.length)
      {
        arrRet[arrRet.length] = (BASE64.arrF64Table[szString.charAt(intI)]<<2) | (BASE64.arrF64Table[szString.charAt(intI+1)]>>4);
        arrRet[arrRet.length] = (((BASE64.arrF64Table[szString.charAt(intI+1)]&15)<<4) | (BASE64.arrF64Table[szString.charAt(intI+2)]>>2));
        arrRet[arrRet.length] = (((BASE64.arrF64Table[szString.charAt(intI+2)]&3)<<6) | (BASE64.arrF64Table[szString.charAt(intI+3)]));
        intI+=4;
      };
      if (szString.length % 4 == 2) {
        arrRet = arrRet.slice(0, arrRet.length-2);
      } else if (szString.length % 4 == 3) {
        arrRet = arrRet.slice(0, arrRet.length-1);
      };
      for (intI=0;intI<arrRet.length;intI++) {
        szRet+=String.fromCharCode(arrRet[intI]);
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'BASE64','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE CLASS ]=============================
  BASE64.classBASE64=function (szKey) {
    // Make Key Setup
    this.szKey=szKey;
  }
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(BASE64);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','BASE64','Constructor');
};
