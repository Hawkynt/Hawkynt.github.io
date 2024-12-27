/*
 *  Cipher Class
 *  (c)2006 Hawkynt
 *
 *  Methods:
 *    objGetCipher(szCipherName):objCipher                    Gets a Ciphers Class
 *    boolExistsCipher(szCipherName):bool                     Returns true if Cipher exists and false if not
 *    AddCipher(objCipher)                                    Adds a Cipher to the available list
 *    InitCipher(szCipherName[,szKey]):szID                   Setup a Cipher Object with Key if given and return its handle
 *    ClearData(szID)                                         Deletes a cipher Object and releases its handle
 *    getCiphers():arrCiphers                                 Get a List of all available Ciphers
 *    szEncrypt(szID,szPlaintText[,szBlockMode):szCipherText  Encrypt a String with the Cipher Object Reference given and BlockMode if given (uses ECB as Default)
 *    szDecrypt(szID,szCypherText[,szBlockMode):szPlainText   Decrypt a String with the Cipher Object Reference given and BlockMode if given (uses ECB as Default)
 */
if (!window.XObjectInstances) window.XObjectInstances=[];
var Cipher=new Object();
{
  // ===================================================================
  // STATIC PUBLIC
  // ===================================================================
  // Array of known Ciphers
  Cipher.arrCiphers=[];
  // Instances of Cipher Wrapper
  Cipher.arrInstances=[];
  // Cipher
  // Needed Functions
  //  KeySetup(szKey):String            --> returns szID of Ciphers internal Object
  //  EncryptBlock(szID,szBlock):String --> Encrypt a Block
  //  DecryptBlock(szID,szBlock):String --> Decrypt a Block
  //
  // Needed Attributes
  //  szName                            --> Name of Cipher
  //  szInternalName                    --> Short Name of Cipher for internal use
  //  szCommment                        --> a comment for the Cipher
  //  intMinKeyLength                   --> Minimum Key Size in Bytes
  //  intMaxKeyLength                   --> Maximum Key Size in Bytes
  //  intStepKeyLength                  --> Key Steps in Bytes
  //  intMinBlockSize                   --> Minimum Block Size in Bytes
  //  intMaxBlockSize                   --> Maximum Block Size in Bytes
  //  intStepBlockSize                  --> Block Size Steps in Bytes
  //  arrInstances                      --> Instances of Cipher in use
  //
  Cipher.boolExistsCipher=function (szCipherName) {
    if ((Cipher.arrCiphers[szCipherName]) && (Cipher.arrCiphers[szCipherName]!=undefined)) {
      return (true);
    } else {
      return (false);
    };
  }
  
  Cipher.objGetCipher=function(szCipherName) {
    if ((Cipher.arrCiphers[szCipherName]) && (Cipher.arrCiphers[szCipherName]!=undefined)) {
      return (Cipher.arrCiphers[szCipherName]);
    } else {
      throwException('Unknown Cipher Exception',szCipherName,'Cipher','objGetCipher');
    };
  }
  
  Cipher.AddCipher=function (objCipher) {
    if ((!objCipher.szInternalName) || (objCipher.szInternalName==undefined)) {
      throwException('Missing Internal Name Exception',objCipher,'Cipher','AddCipher');
    } else {
      if ((!objCipher.szName) || (objCipher.szName==undefined)) {
        throwException('Missing Cipher Name Exception',objCipher.szInternalName,'Cipher','AddCipher');
      } else {
        if (objCipher.intMinKeyLength==undefined) {
          throwException('Missing Minimal Key Length Exception',objCipher.szName,'Cipher','AddCipher');
        } else {
          if (objCipher.intMaxKeyLength==undefined) {
            throwException('Missing Maximal Key Length Exception',objCipher.szName,'Cipher','AddCipher');
          } else {
            if (objCipher.intStepKeyLength==undefined) {
              throwException('Missing Key Length Stepping Exception',objCipher.szName,'Cipher','AddCipher');
            } else {
              if (objCipher.intMinBlockSize==undefined) {
                throwException('Missing Minimal Block Size Exception',objCipher.szName,'Cipher','AddCipher');
              } else {
                if (objCipher.intMaxBlockSize==undefined) {
                  throwException('Missing Maximal Block Size Exception',objCipher.szName,'Cipher','AddCipher');
                } else {
                  if (objCipher.intStepBlockSize==undefined) {
                    throwException('Missing Block Size Stepping Exception',objCipher.szName,'Cipher','AddCipher');
                  } else {
                    if ((!objCipher.arrInstances) || (objCipher.arrInstances==undefined)) {
                      throwException('Missing Class Instances Lookup Exception',objCipher.szName,'Cipher','AddCipher');
                    } else {
                      if (Cipher.arrCiphers[objCipher.szInternalName]) {
                        throwException('Class Already Exists Exception',objCipher.szName,'Cipher','AddCipher');
                      } else {
                        Cipher.arrCiphers[objCipher.szInternalName]=objCipher;
                        var szKey='';
                        while (szKey.length<objCipher.intMinKeyLength) {
                          szKey+=String.fromCharCode(0);
                        };
                        var szID=Cipher.InitCipher(objCipher.szInternalName,szKey);
                        if (szID!=undefined) {
                          var szEncode='';
                          while (szEncode.length<objCipher.intMinBlockSize) {
                            szEncode+=String.fromCharCode(0);
                          };
                          var szDecode=Cipher.szDecrypt(szID,Cipher.szEncrypt(szID,szEncode,'ECB'),'ECB');
                          Cipher.ClearData(szID);
                          if (szEncode==szDecode) {
                            return (true);
                          } else {
                            throwException('Cipher Validation Exception',objCipher.szName,'Cipher','AddCipher');
                          };
                        } else {
                          throwException('Cipher Validation Exception',objCipher.szName,'Cipher','AddCipher');
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
    return (false);
  }
  
  Cipher.InitCipher=function (szCipherName,optional_szKey) {
    if ((Cipher.arrCiphers[szCipherName]) && (Cipher.arrCiphers[szCipherName]!=undefined)) {
      var szID;
      do {
        szID='Cipher['+szGenerateUniqueID()+']';
      } while ((Cipher.arrInstances[szID]) || (Cipher.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
      Cipher.arrInstances[szID]=new Object();
      window.XObjectInstances[szID]=Cipher.arrInstances[szID];
      Cipher.arrInstances[szID].szCipherName=szCipherName;
      Cipher.arrInstances[szID].objUsedCipher=Cipher.arrCiphers[szCipherName];
      Cipher.arrInstances[szID].szExternalKey=optional_szKey;
      var objUsedCipher=Cipher.arrInstances[szID].objUsedCipher;
      if (objUsedCipher.boolInit==false) objUsedCipher.Init();
      // Key extending or cutting
      var szKey=Cipher.arrInstances[szID].szExternalKey;
      // If Key is too small
      if (objUsedCipher.intMinKeyLength>0) {
        while ((szKey.length<objUsedCipher.intMinKeyLength) && (szKey.length>0)) {
          szKey+=Cipher.arrInstances[szID].szExternalKey;
        };
      };
      // If Key is too large
      if (objUsedCipher.intMaxKeyLength>0) {
        if (szKey.length>objUsedCipher.intMaxKeyLength) {
          szKey=szKey.substr(0,objUsedCipher.intMaxKeyLength);
        };
      };
      // If Key is not bounded to Padding
      if (objUsedCipher.intStepKeyLength>1) {
        var intModulo=(szKey.length-objUsedCipher.intMinKeyLength) % objUsedCipher.intStepKeyLength;
        if (intModulo>0) {
          if ((szKey.length-intModulo)<objUsedCipher.intMinKeyLength) {
            // Upper Bound fill
            szKey+=szKey.substr(0,objUsedCipher.intStepKeyLength-intModulo);
          } else {
            // Lower Bound Cut
            szKey=szKey.substr(0,szKey.length-intModulo);
          };
        };
      };
      Cipher.arrInstances[szID].szInternalKey=szKey;
      if (((szKey.length<objUsedCipher.intMinKeyLength) && (objUsedCipher.intMinKeyLength>0)) || ((szKey.length>objUsedCipher.intMaxKeyLength) && (objUsedCipher.intMaxKeyLength>0))) {
        // invalid Key Length
        if (Cipher.intMinKeyLength==objUsedCipher.intMaxKeyLength) {
          throwException('Invalid Key Length Exception','Key Length is '+(szKey.length*8)+' Bits, but must be '+(objUsedCipher.intMaxKeyLength*8)+' Bits','Cipher','InitCipher');
        } else {
          throwException('Invalid Key Length Exception','Key Length is '+(szKey.length*8)+' Bits, but must be between '+(objUsedCipher.intMinKeyLength*8)+' Bits and '+(objUsedCipher.intMaxKeyLength*8)+' Bits','Cipher','InitCipher');
        };
        window.XObjectInstances[szID]=undefined;
        delete Cipher.arrInstances[szID];
      } else {
        // proceed
        Cipher.arrInstances[szID].szCiphersID=objUsedCipher.KeySetup(Cipher.arrInstances[szID].szInternalKey);
      };
      return (szID);
    } else {
      throwException('Unknown Cipher Exception',szCipherName,'Cipher','InitCipher');
    };
  }
  
  Cipher.ClearData=function (szID) {
    if ((Cipher.arrInstances[szID]) && (Cipher.arrInstances[szID]!=undefined)) {
      Cipher.arrInstances[szID].objUsedCipher.ClearData(Cipher.arrInstances[szID].szCiphersID);
      window.XObjectInstances[szID]=undefined;
      delete Cipher.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Cipher','ClearData');
    };
  }
  
  Cipher.getCiphers=function () {
    var arrRet=[];
    for (var szI in Cipher.arrCiphers) {
      arrRet.push(szI);
    };
    return (arrRet);
  }
  
  Cipher.szEncrypt=function (szID,szInputBuffer,optional_szMode) {
    var szRet='';
    var szMode;
    if ((optional_szMode) && (optional_szMode!=undefined)) {
      szMode=optional_szMode.toUpperCase();
    } else {
      szMode='ECB';
    };
    // TODO:implement Block Modes
    if ((Cipher.arrInstances[szID]) && (Cipher.arrInstances[szID]!=undefined)) {
      var objCurrentCipher=Cipher.arrInstances[szID].objUsedCipher;
      if (szMode=='ECB') {
        // Electronic Codebook
        var szBlock;
        if (objCurrentCipher.intMaxBlockSize==0) {
          szBlock=szInputBuffer;
          szRet=Cipher.szEncryptBlock(szID,szBlock);
        } else {
          var intI=0;
          while (intI<szInputBuffer.length) {
            var intBytesLeft=szInputBuffer.length-intI;
            if (intBytesLeft>objCurrentCipher.intMaxBlockSize) {
              // Full Maximal Sized Block
              szBlock=szInputBuffer.substr(intI,objCurrentCipher.intMaxBlockSize);
              intI+=objCurrentCipher.intMaxBlockSize;
            } else {
              // hmmm no maximal block f**k
              if (intBytesLeft<objCurrentCipher.intMinBlockSize) {
                // Too less for full Block so fill with Zeroes
                szBlock=szInputBuffer.substr(intI,szInputBuffer.length-intI);
                intI+=szInputBuffer.length-intI;
                while (szBlock.length<objCurrentCipher.intMinBlockSize) {
                  szBlock+=String.fromCharCode(0);
                };
              } else {
                // Minimal Block and Padding filled with Zeroes
                szBlock=szInputBuffer.substr(intI,szInputBuffer.length-intI);
                intI+=szInputBuffer.length-intI;
                var intModulo=(szBlock.length-objCurrentCipher.intMinBlockSize) % objCurrentCipher.intStepBlockSize;
                if (intModulo>0) {
                  // Must be padded
                  intModulo=objCurrentCipher.intStepBlockSize-intModulo;
                  while (intModulo>0) {
                    szBlock+=String.fromCharCode(0);
                    intModulo--;
                  };
                };
              };
            };
            szRet+=Cipher.szEncryptBlock(szID,szBlock);
          };
        };
      } else {
        throwException('Unknown Block Mode Exception',szMode,'Cipher','szEncrypt');
        szRet=szInputBuffer;
      };
    } else {
      throwException('Unknown Object Reference Exception',szID,'Cipher','szEncrypt');
      szRet=szInputBuffer;
    };
    return (szRet);
  }
  
  Cipher.szDecrypt=function (szID,szInputBuffer,optional_szMode) {
    var szRet='';
    var szMode;
    if (optional_szMode!=undefined) {
      szMode=optional_szMode.toUpperCase();
    } else {
      szMode='ECB';
    };
    // TODO:implement Block Modes
    if ((Cipher.arrInstances[szID]) && (Cipher.arrInstances[szID]!=undefined)) {
      var objCurrentCipher=Cipher.arrCiphers[Cipher.arrInstances[szID].szCipherName];
      if (szMode=='ECB') {
        // Electronic Codebook
        var szBlock;
        if (objCurrentCipher.intMaxBlockSize==0) {
          szBlock=szInputBuffer;
          szRet=Cipher.szDecryptBlock(szID,szBlock);
        } else {
          var intI=0;
          while (intI<szInputBuffer.length) {
            var intBytesLeft=szInputBuffer.length-intI;
            if (intBytesLeft>objCurrentCipher.intMaxBlockSize) {
              // Full Maximal Sized Block
              szBlock=szInputBuffer.substr(intI,objCurrentCipher.intMaxBlockSize);
              intI+=objCurrentCipher.intMaxBlockSize;
            } else {
              // hmmm no maximal block f**k
              if (intBytesLeft<objCurrentCipher.intMinBlockSize) {
                // Too less for full Block so fill with Zeroes
                szBlock=szInputBuffer.substr(intI,szInputBuffer.length-intI);
                intI+=szInputBuffer.length-intI;
                while (szBlock.length<objCurrentCipher.intMinBlockSize) {
                  szBlock+=String.fromCharCode(0);
                };
              } else {
                // Minimal Block and Padding filled with Zeroes
                szBlock=szInputBuffer.substr(intI,szInputBuffer.length-intI);
                intI+=szInputBuffer.length-intI;
                var intModulo=(szBlock.length-objCurrentCipher.intMinBlockSize) % objCurrentCipher.intStepBlockSize;
                if (intModulo>0) {
                  // Must be padded
                  intModulo=objCurrentCipher.intStepBlockSize-intModulo;
                  while (intModulo>0) {
                    szBlock+=String.fromCharCode(0);
                    intModulo--;
                  };
                };
              };
            };
            szRet+=Cipher.szDecryptBlock(szID,szBlock);
          };
        };
      } else {
        throwException('Unknown Block Mode Exception',szMode,'Cipher','szDecrypt');
        szRet=szInputBuffer;
      };
    } else {
      throwException('Unknown Object Reference Exception',szID,'Cipher','szDecrypt');
      szRet=szInputBuffer;
    };
    return (szRet);
  }
  
  Cipher.szEncryptBlock=function (szID,szBlock) {
    var szRet;
    if ((Cipher.arrInstances[szID]) && (Cipher.arrInstances[szID]!=undefined)) {
      szRet=Cipher.arrInstances[szID].objUsedCipher.szEncryptBlock(Cipher.arrInstances[szID].szCiphersID,szBlock);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Cipher','szEncryptBlock');
      szRet=szBlock;
    };
    return (szRet);
  }
  
  Cipher.szDecryptBlock=function (szID,szBlock) {
    var szRet;
    if ((Cipher.arrInstances[szID]) && (Cipher.arrInstances[szID]!=undefined)) {
      szRet=Cipher.arrInstances[szID].objUsedCipher.szDecryptBlock(Cipher.arrInstances[szID].szCiphersID,szBlock);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Cipher','szDecryptBlock');
      szRet=szBlock;
    };
    return (szRet);
  }
};