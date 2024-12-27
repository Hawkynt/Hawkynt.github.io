/*
 *  LZSS Class
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
var LZSS=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  LZSS.szInternalName='LZSS';
  LZSS.szName='LZSS';
  LZSS.szComment='This is the normal LZSS Compression Algorithm';
  LZSS.intMinKeyLength=0;
  LZSS.intMaxKeyLength=0;
  LZSS.intStepKeyLength=1;
  LZSS.intMinBlockSize=0;
  LZSS.intMaxBlockSize=0;
  LZSS.intStepBlockSize=1;
  LZSS.arrInstances=[];
  
  LZSS.boolCantDecode=false;
  LZSS.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  LZSS.intN=4096;
  LZSS.intF=18;
  LZSS.intTHRESHOLD=2;
  LZSS.intNIL=LZSS.intN;
  // =======================[ PUBLIC STATIC ]===========================
  LZSS.Init=function () {
    // TODO:
    LZSS.boolInit=true;
  }
  
  LZSS.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='LZSS['+szGenerateUniqueID()+']';
    } while ((LZSS.arrInstances[szID]) || (LZSS.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    LZSS.arrInstances[szID]=new LZSS.classLZSS(optional_szKey);
    return (szID);
  }
  
  LZSS.ClearData=function (szID) {
    if ((LZSS.arrInstances[szID]) && (LZSS.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete LZSS.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'LZSS','ClearData');
      return (false);
    };
  }
  
  LZSS.szEncryptBlock=function (szID,szPlainText) {
    if ((LZSS.arrInstances[szID]) && (LZSS.arrInstances[szID]!=undefined)) {
      var szRet='';
      var objLZSS=LZSS.arrInstances[szID];
      /*
        int  i, c, len, r, s, last_match_length, code_buf_ptr;
        unsigned char  code_buf[17], mask;
      */
      objLZSS.InitTree();
      // TODO:
      
      return (szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'LZSS','szEncryptBlock');
    };
  }
  
  LZSS.szDecryptBlock=function (szID,szCipherText) {
    if ((LZSS.arrInstances[szID]) && (LZSS.arrInstances[szID]!=undefined)) {
      var szRet='';
      // TODO:
      return szRet;
    } else {
      throwException('Unknown Object Reference Exception',szID,'LZSS','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  // =======================[ PRIVATE CLASS ]===========================
  LZSS.classLZSS=function (szKey) {
    // Make Key Setup
    this.intTextSize=0;
    this.intCodeSize=0;
    this.arrTextBuf=[]; // [LZSS.intN+LZSS.intF-1]
    this.intMatchPosition;
    this.intMatchLength;
    this.arrLSon=[]; // [LZSS.intN+1]
    this.arrRSon=[]; // [LZSS.intN+257]
    this.arrDad=[]; // [LZSS.intN+1]
    this.arrInBuffer=[];
    this.arrOutBuffer=[];
    
    this.InitTree=function () {
      var intI;
      for (intI = LZSS.intN + 1; intI <= LZSS.intN + 256; intI++) {
        this.arrRSon[intI] = LZSS.intNIL;
      };
      for (intI = 0; intI < LZSS.intN; intI++) {
        this.arrDad[intI] = LZSS.intNIL;
      };
    }
    
    this.InsertNode=function (intR) {
      var  intI, intP, intCmp=1;
      intP=LZSS.intN+1+this.arrTextBuf[intR+0];
      this.arrRSon[intR]=LZSS.intNIL;
      this.arrLSon[intR]=LZSS.intNIL;
      this.intMatchLength=0;
      for ( ; ; ) {
        if (intCmp>=0) {
          if (this.arrRSon[intP]!=LZSS.intNIL) {
            intP=this.arrRSon[intP];
          } else {
            this.arrRSon[intP]=intR;
            this.arrDad[intR]=intP;
            return;
          };
        } else {
          if (this.arrLSon[intP] != LZSS.intNIL) {
            intP = this.arrLSon[intP];
          } else {
            this.arrLSon[intP] = intR;
            this.arrDad[intR] = intP;
            return;
          };
        };
        for (intI=1;intI<LZSS.intF;intI++) {
          if ((intCmp = this.arrTextBuf[intR+intI] - this.arrTextBuf[intP + intI]) != 0)  break;
        };
        if (intI>this.intMatchLength) {
          this.intMatchPosition=intP;
          if ((this.intMatchLength=intI)>=this.intF) {
            break;
          };
        };
      };
      this.arrDad[intR]=this.arrDad[intP];
      this.arrLSon[intR]=this.arrLSon[intP];
      this.arrRSon[intR]=this.arrRSon[intP];
      this.arrDad[this.arrLSon[intP]]=intR;
      this.arrDad[this.arrRSon[intP]]=intR;
      if (this.arrRSon[this.arrDad[intP]] == intP) {
        this.arrRSon[this.arrDad[intP]] = intR;
      } else {
        this.arrLSon[this.arrDad[intP]] = intR;
      };
      this.arrDad[intP]=LZSS.intNIL;
    }
    
    this.DeleteNode=function (intP)  /* deletes node p from tree */
    {
      var intQ;
      if (this.arrDad[intP] == LZSS.intNIL) {
        return;  // not in tree
      };
      if (this.arrRSon[intP] == LZSS.intNIL) {
        intQ = this.arrLSon[intP];
      } else if (this.arrLSon[intP] == LZSS.intNIL) {
        intQ = this.arrRSon[intP];
      } else {
        intQ = this.arrLSon[intP];
        if (this.arrRSon[intQ] != LZSS.intNIL) {
          do {
            intQ = this.arrRSon[intQ];
          } while (this.arrRSon[intQ] != LZSS.intNIL);
          this.arrRSon[this.arrDad[intQ]] = this.arrLSon[intQ];
          this.arrDad[this.arrLSon[intQ]] = this.arrDad[intQ];
          this.arrLSon[intQ] = this.arrLSon[intP];
          this.arrDad[this.arrLSon[intP]] = intQ;
        }
        this.arrRSon[intQ] = this.arrRSon[intP];
        this.arrDad[this.arrRSon[intP]] = intQ;
      };
      this.arrDad[intQ] = this.arrDad[intP];
      if (this.arrRSon[this.arrDad[intP]] == intP) {
        this.arrRSon[this.arrDad[intP]] = intQ;
      } else {
        this.arrLSon[this.arrDad[intP]] = intQ;
      };
      this.arrDad[intP] = LZSS.intNIL;
    }
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(LZSS);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','LZSS','Constructor');
};
