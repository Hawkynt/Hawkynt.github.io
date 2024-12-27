/*
 *  Koremutake Class
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
var Koremutake=new Object();
{
  // =======================[ PUBLIC INTERFACE ]========================
  Koremutake.szInternalName='Koremutake';
  Koremutake.szName='Koremutake';
  Koremutake.szComment='This is the normal Koremutake Converting Algorithm';
  Koremutake.intMinKeyLength=0;
  Koremutake.intMaxKeyLength=0;
  Koremutake.intStepKeyLength=1;
  Koremutake.intMinBlockSize=0;
  Koremutake.intMaxBlockSize=0;
  Koremutake.intStepBlockSize=1;
  Koremutake.arrInstances=[];
  
  Koremutake.boolCantDecode=false;
  Koremutake.boolInit=false;
  // =======================[ PRIVATE STATIC ]==========================
  Koremutake.arrSillables=[
    'BA', 'BE', 'BI', 'BO', 'BU', 'BY', 
    'DA', 'DE', 'DI', 'DO', 'DU', 'DY', 
    'FA', 'FE', 'FI', 'FO', 'FU', 'FY', 
    'GA', 'GE', 'GI', 'GO', 'GU', 'GY', 
    'HA', 'HE', 'HI', 'HO', 'HU', 'HY', 
    'JA', 'JE', 'JI', 'JO', 'JU', 'JY', 
    'KA', 'KE', 'KI', 'KO', 'KU', 'KY', 
    'LA', 'LE', 'LI', 'LO', 'LU', 'LY', 
    'MA', 'ME', 'MI', 'MO', 'MU', 'MY', 
    'NA', 'NE', 'NI', 'NO', 'NU', 'NY', 
    'PA', 'PE', 'PI', 'PO', 'PU', 'PY', 
    'RA', 'RE', 'RI', 'RO', 'RU', 'RY', 
    'SA', 'SE', 'SI', 'SO', 'SU', 'SY', 
    'TA', 'TE', 'TI', 'TO', 'TU', 'TY', 
    'VA', 'VE', 'VI', 'VO', 'VU', 'VY', 
    'BRA', 'BRE', 'BRI', 'BRO', 'BRU', 'BRY', 
    'DRA', 'DRE', 'DRI', 'DRO', 'DRU', 'DRY', 
    'FRA', 'FRE', 'FRI', 'FRO', 'FRU', 'FRY', 
    'GRA', 'GRE', 'GRI', 'GRO', 'GRU', 'GRY', 
    'PRA', 'PRE', 'PRI', 'PRO', 'PRU', 'PRY', 
    'STA', 'STE', 'STI', 'STO', 'STU', 'STY', 
    'TRA', 'TRE'
  ];
  
  // =======================[ PUBLIC STATIC ]===========================
  Koremutake.Init=function () {
    Koremutake.boolInit=true;
  }
  
  Koremutake.KeySetup=function (optional_szKey) {
    var szID;
    do {
      szID='Koremutake['+szGenerateUniqueID()+']';
    } while ((Koremutake.arrInstances[szID]) || (Koremutake.arrInstances[szID]!=undefined) || (window.XObjectInstances[szID]) || (window.XObjectInstances[szID]!=undefined));
    Koremutake.arrInstances[szID]=new Koremutake.classKoremutake(optional_szKey);
    return (szID);
  }
  
  Koremutake.ClearData=function (szID) {
    if ((Koremutake.arrInstances[szID]) && (Koremutake.arrInstances[szID]!=undefined)) {
      window.XObjectInstances[szID]=undefined;
      delete Koremutake.arrInstances[szID];
      return (true);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Koremutake','ClearData');
      return (false);
    };
  }
  
  Koremutake.szEncryptBlock=function (szID,$szPlainText) {
    if ((Koremutake.arrInstances[szID]) && (Koremutake.arrInstances[szID]!=undefined)) {
      var $szRet='';
      // Encrypt
      var $szByteStream='';
      var $intI=0;
      var $intMaxI=$szPlainText.length
      while (($intI<$intMaxI) || ($szByteStream.length>0)) {
        // Get more Bits if needed
        if ($szByteStream.length<7) {
          // if szString not empty
          if ($intI<$intMaxI) {
            //  get 7 bits from szString
            var $byteChar=$szPlainText.charCodeAt($intI) & 255;
            $szByteStream=$szByteStream+szByte2Binary($byteChar);
            $intI++;
          } else {
            // else
            //  get null bits until szByteStream is 7 Bits wide
            var $intLeft=7-($szByteStream.length % 7);
            $szByteStream+='00000000'.substr(0,$intLeft);
          }
        };
        // get 7 Bits from Bytestream to intTmp and remove them
        var $szTmp=$szByteStream.substr(0,7);
        var $intTmp=IntBinary2Int($szTmp);
        $szByteStream=$szByteStream.substr(7,$szByteStream.length-7);
        // append Koremutake.arrSillables[intTmp]
        $szRet+=Koremutake.arrSillables[$intTmp];
      };
      return ($szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Koremutake','szEncryptBlock');
    };
  }
  
  Koremutake.szDecryptBlock=function (szID,$szCipherText) {
    if ((Koremutake.arrInstances[szID]) && (Koremutake.arrInstances[szID]!=undefined)) {
      var $szRet='';
      // Decrypt
      var $szBuffer='';
      var $szString=$szCipherText.toUpperCase();
      var $intI=0;
      var $intMaxI=$szString.length;
      var $boolIgnoreLast=false;
      do {
        if ($szBuffer.length>7) {
          var $szByte=$szBuffer.substr(0,8);
          $szBuffer=$szBuffer.substr(8,$szBuffer.length-8);
          var $intChar=IntBinary2Int($szByte);
          $szRet+=String.fromCharCode($intChar);
        } else {
          // try 2 chars
          if ($intI<$intMaxI) {
            var $szSillable;
            var $byteIDX=-1;
            $szSillable=$szString.substr($intI,2);
            $byteIDX=byteKore2Byte($szSillable);
            if ($byteIDX==-1) {
              // try 3 chars
              $szSillable=$szString.substr($intI,3);
              $byteIDX=byteKore2Byte($szSillable);
              $intI+=3;
            } else {
              $intI+=2;
            }
            $szBuffer+=szByte2Binary($byteIDX).substr(1,7);
          } else {
            var $intLeft=8-($szBuffer.length %8);
            $szBuffer='00000000'.substr(0,$intLeft)+$szBuffer;
            $boolIgnoreLast=true;
          }
        }
      } while (($szBuffer.length>0) || ($intI<$intMaxI));
      if ($boolIgnoreLast) {
        $szRet=$szRet.substr(0,$szRet.length-1);
      }
      return ($szRet);
    } else {
      throwException('Unknown Object Reference Exception',szID,'Koremutake','szEncryptBlock');
    };
  }
  // =======================[ PRIVATE FUNCTIONS ]=======================
  function byteKore2Byte($szText) {
    var $byteRet=-1;
    var $intI=0;
    var $intMaxI=Koremutake.arrSillables.length;
    var $boolFound=false;
    while (($intI<$intMaxI) && !($boolFound)) {
      if (Koremutake.arrSillables[$intI]==$szText) {
        $boolFound=true;
        $byteRet=$intI;
      } else {
        $intI++;
      }
    };
    return($byteRet);
  }
  
  function szByte2Binary($byteChar) {
    var $szRet='';
    for (var $intI=7;$intI>=0;$intI--) {
      if (($byteChar-Math.pow(2,$intI))>=0) {
        $szRet=$szRet+'1';
        $byteChar=$byteChar-Math.pow(2,$intI);
      } else {
        $szRet=$szRet+'0';
      }
    }
    return($szRet);
  }
  
  function IntBinary2Int($szText) {
    var $intRet=0;
    var $intMaxI=$szText.length-1;
    for (var $intI=$intMaxI;$intI>=0;$intI--) {
      var $chrChar=$szText.charAt($intI);
      if ($chrChar=='1') {
        $intRet=$intRet+Math.pow(2,($intMaxI-$intI));
      }
    }
    return ($intRet);
  }
  // =======================[ PRIVATE CLASS ]===========================
  Koremutake.classKoremutake=function (szKey) {
    // Make Key Setup
  }
  // ==============[ S-BOX, U-BOX, V-BOX, P-BOX and C-BOX DATA ]========
};
if ((Cipher) && (Cipher!=undefined)) {
  Cipher.AddCipher(Koremutake);
} else {
  throwException('Missing Cipher Library Exception','Cipher::AddCipher','Koremutake','Constructor');
};
