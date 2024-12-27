/*
 *  %CiphersName% Class
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
var %CiphersName%=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  %CiphersName%.szInternalName='%CiphersName%';
  %CiphersName%.szName='%CiphersName%';
  %CiphersName%.szComment='This is the normal %CiphersName% Cipher Algorithm';
  %CiphersName%.intMinKeyLength=0;
  %CiphersName%.intMaxKeyLength=0;
  %CiphersName%.intStepKeyLength=1;
  %CiphersName%.intMinBlockSize=0;
  %CiphersName%.intMaxBlockSize=0;
  %CiphersName%.intStepBlockSize=1;
  %CiphersName%.arrInstances=[];
  
  %CiphersName%.boolCantDecode=false;
  %CiphersName%.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  // TODO:
  // =======================[ PUBLIC STATIC ]===========================
  %CiphersName%.Init=function () {
    // TODO:
    %CiphersName%.boolInit=true;
  }
  
  %CiphersName%.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='%CiphersName%['+szGenerateUniqueID()+']';
    } while ((%CiphersName%.arrInstances[szID]) || (%CiphersName%.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    %CiphersName%.arrInstances[szID]=new %CiphersName%.class%CiphersName%(optional_szKey);
    return (szID);
  }
  
  %CiphersName%.ClearData=function (szID) {
    if ((%CiphersName%.arrInstances[szID]) && (%CiphersName%.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete %CiphersName%.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'%CiphersName%','ClearData');
      return (false);
    };
  }
  
  %CiphersName%.szEncryptBlock=function (szID,szPlainText) {
    if ((%CiphersName%.arrInstances[szID]) && (%CiphersName%.arrInstances[szID]!=undefined)) {
      var szRet='';
      // TODO:
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'%CiphersName%','szEncryptBlock');
    };
  }
  
  %CiphersName%.szDecryptBlock=function (szID,szCipherText) {
    if ((%CiphersName%.arrInstances[szID]) && (%CiphersName%.arrInstances[szID]!=undefined)) {
      var szRet='';
      // TODO:
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'%CiphersName%','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  %CiphersName%.class%CiphersName%=function (szKey) {
    // Make Key Setup
    // TODO:
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(%CiphersName%);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','%CiphersName%','Constructor');
};
