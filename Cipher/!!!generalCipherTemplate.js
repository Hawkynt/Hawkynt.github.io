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
 *   KeySetup(key):szID              --> returns szID of Algos internal Object after creating it
 *   EncryptBlock(id,szBlock):String --> Encrypt a Block
 *   DecryptBlock(id,szBlock):String --> Decrypt a Block
 *   ClearData(id)                   --> deletes an Algos Object
 */
if (!window.objectInstances) window.objectInstances=[];
var %CiphersName%=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  %CiphersName%.internalName='%CiphersName%';
  %CiphersName%.name='%CiphersName%';
  %CiphersName%.comment='This is the normal %CiphersName% Cipher Algorithm';
  %CiphersName%.minKeyLength=0;
  %CiphersName%.maxKeyLength=0;
  %CiphersName%.stepKeyLength=1;
  %CiphersName%.minBlockSize=0;
  %CiphersName%.maxBlockSize=0;
  %CiphersName%.stepBlockSize=1;
  %CiphersName%.instances=[];
  
  %CiphersName%.cantDecode=false;
  %CiphersName%.isInitialized=false;
  // =======================[ PRIVATE STATIC ]==========================
  // TODO:
  // =======================[ PUBLIC STATIC ]===========================
  %CiphersName%.Init=function () {
    // TODO:
    %CiphersName%.isInitialized=true;
  }
  
  %CiphersName%.KeySetup=function (optional_key) {
    var id;
    do {
      id ='%CiphersName%['+szGenerateUniqueID()+']';
    } while ((%CiphersName%.instances[id]) || (%CiphersName%.instances[id]!=undefined) || (window.objectInstances[id]) || (window.objectInstances[id]!=undefined));
    %CiphersName%.instances[id]=new %CiphersName%.class%CiphersName%(optional_key);
    return (id);
  }
  
  %CiphersName%.ClearData=function (id) {
    if ((%CiphersName%.instances[id]) && (%CiphersName%.instances[id]!=undefined)) {
      window.objectInstances[id]=undefined;
      delete %CiphersName%.instances[id];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',id,'%CiphersName%','ClearData');
      return (false);
    };
  }
  
  %CiphersName%.encryptBlock=function (id,plaintext) {
    if ((%CiphersName%.instances[id]) && (%CiphersName%.instances[id]!=undefined)) {
      var result='';
      // TODO:
      return (result);
    } else {
      throwException('Unknown Object Reference Exception',id,'%CiphersName%','encryptBlock');
    };
  }
  
  %CiphersName%.decryptBlock=function (id,ciphertext) {
    if ((%CiphersName%.instances[id]) && (%CiphersName%.instances[id]!=undefined)) {
      var result='';
      // TODO:
      return result;
    } else {
      throwException('Unknown Object Reference Exception',id,'%CiphersName%','decryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  %CiphersName%.class%CiphersName%=function (key) {
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
