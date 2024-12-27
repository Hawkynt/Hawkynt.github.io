/*
 *  BubbleBabble Class
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
var BubbleBabble=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  BubbleBabble.szInternalName='BubbleBabble';
  BubbleBabble.szName='BubbleBabble';
  BubbleBabble.szComment='This is the normal BubbleBabble Converting Algorithm';
  BubbleBabble.intMinKeyLength=0;
  BubbleBabble.intMaxKeyLength=0;
  BubbleBabble.intStepKeyLength=1;
  BubbleBabble.intMinBlockSize=0;
  BubbleBabble.intMaxBlockSize=0;
  BubbleBabble.intStepBlockSize=1;
  BubbleBabble.arrInstances=[];
  
  BubbleBabble.boolCantDecode=false;
  BubbleBabble.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  BubbleBabble.szVowels='aeiouy';
  BubbleBabble.szConsonants='bcdfghklmnprstvzx';
  // =======================[ PUBLIC STATIC ]===========================
  BubbleBabble.Init=function () {
    BubbleBabble.boolInit=true;
  }
  
  BubbleBabble.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='BubbleBabble['+szGenerateUniqueID()+']';
    } while ((BubbleBabble.arrInstances[szID]) || (BubbleBabble.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    BubbleBabble.arrInstances[szID]=new BubbleBabble.classBubbleBabble(optional_szKey);
    return (szID);
  }
  
  BubbleBabble.ClearData=function (szID) {
    if ((BubbleBabble.arrInstances[szID]) && (BubbleBabble.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete BubbleBabble.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'BubbleBabble','ClearData');
      return (false);
    };
  }
  
  BubbleBabble.szEncryptBlock=function (szID,szPlainText) {
    if ((BubbleBabble.arrInstances[szID]) && (BubbleBabble.arrInstances[szID]!=undefined)) {
      var szRet='';
      if ((szPlainText.length % 2)==1) szPlainText+=String.fromCharCode(0);
      var intSeed=1;
      var intRounds=Math.floor((szPlainText.length/2)+1);
      szRet+='x';
      // x|abab-b|abab-b|aba|x
      for (var intI=0;intI<intRounds;intI++) {
        var intIDX0;
        var intIDX1;
        var intIDX2;
        var intIDX3;
        var intIDX4;
        if (((intI+1)<intRounds) || ((szPlainText.length % 2) != 0)) {
          intIDX0=((( (szPlainText.charCodeAt(2 * intI) & 0xff) >>> 6) & 3) + intSeed) % 6;
          intIDX1=(   (szPlainText.charCodeAt(2 * intI) & 0xff) >>> 2) & 15;
          intIDX2=Math.floor(((  (szPlainText.charCodeAt(2 * intI) & 0xff) & 3) + (intSeed / 6)) % 6);
          szRet+=BubbleBabble.szVowels.charAt(intIDX0);
          szRet+=BubbleBabble.szConsonants.charAt(intIDX1);
          szRet+=BubbleBabble.szVowels.charAt(intIDX2);
          if ((intI+1)<intRounds) {
            intIDX3=( (szPlainText.charCodeAt(2 * intI + 1) & 0xff) >>> 4) & 15;
            intIDX4=  (szPlainText.charCodeAt(2 * intI + 1) & 0xff) & 15;
            // alert(intIDX0+' '+intIDX1+' '+intIDX2+' '+intIDX3+' '+intIDX4);
            szRet+=BubbleBabble.szConsonants.charAt(intIDX3);
            szRet+='-';
            szRet+=BubbleBabble.szConsonants.charAt(intIDX4);
            intSeed=Math.floor(((intSeed * 5) +
                 (((szPlainText.charCodeAt(2 * intI) & 0xff) * 7) +
                   (szPlainText.charCodeAt(2 * intI + 1) & 0xff))) % 36);
          };
          //alert(intSeed);
        } else {
          intIDX0=intSeed % 6;
          intIDX1=16;
          intIDX2=Math.floor(intSeed / 6);
          szRet+=BubbleBabble.szVowels.charAt(intIDX0);
          szRet+=BubbleBabble.szConsonants.charAt(intIDX1);
          szRet+=BubbleBabble.szVowels.charAt(intIDX2);
        };
      };
      szRet+='x';
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'BubbleBabble','szEncryptBlock');
    };
  }
  /*
    (x+y) % 6 = z   | while %
    while (z-y)<0 (z-y)+6
  */
  BubbleBabble.szDecryptBlock=function (szID,szCipherText) {
    if ((BubbleBabble.arrInstances[szID]) && (BubbleBabble.arrInstances[szID]!=undefined)) {
      var szRet='';
      var intSeed=1;
      // x|abab-b|abab-b|aba|x
      var intI=1;
      while (intI<szCipherText.length) {
        var intIDX0;
        var intIDX1;
        var intIDX2;
        var intIDX3;
        var intIDX4;
        var intChar1;
        var intChar2;
        var szCurPart=szCipherText.substr(intI,6);
        intI+=6;
        if (szCurPart.charAt(4)=='-') {
          intIDX0=BubbleBabble.szVowels.indexOf(szCurPart.charAt(0));
          intIDX1=BubbleBabble.szConsonants.indexOf(szCurPart.charAt(1));
          intIDX2=BubbleBabble.szVowels.indexOf(szCurPart.charAt(2));
          intIDX3=BubbleBabble.szConsonants.indexOf(szCurPart.charAt(3));
          intIDX4=BubbleBabble.szConsonants.indexOf(szCurPart.charAt(5));
          // alert(intIDX0+' '+intIDX1+' '+intIDX2+' '+intIDX3+' '+intIDX4);
          intIDX0=intIDX0-intSeed;
          while (intIDX0<0) intIDX0+=6;
          intIDX2=intIDX2 - Math.floor(intSeed / 6);
          while (intIDX2<0) intIDX2+=6;
          intChar1=(((intIDX0) << 6) & 192) | 
                   ((intIDX1 << 2 ) & 60) | 
                   ((intIDX2) & 3);
          //intIDX0=((( (szCipherText.charCodeAt(2 * intI) & 0xff) >>> 6) & 3) + intSeed) % 6;
          //intIDX1=(   (szCipherText.charCodeAt(2 * intI) & 0xff) >>> 2) & 15;
          //intIDX2=Math.floor(((  (szCipherText.charCodeAt(2 * intI) & 0xff) & 3) + (intSeed / 6)) % 6);
          szRet+=String.fromCharCode(intChar1);
          intChar2=((intIDX3 << 4) & 240) | 
                  intIDX4;
          szRet+=String.fromCharCode(intChar2);
          intSeed=Math.floor(((intSeed * 5) +
                 (((intChar1 & 0xff) * 7) +
                   (intChar2 & 0xff))) % 36);
          //alert(intSeed);
        } else {
          
        };
      };
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'BubbleBabble','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  BubbleBabble.classBubbleBabble=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(BubbleBabble);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','BubbleBabble','Constructor');
};
