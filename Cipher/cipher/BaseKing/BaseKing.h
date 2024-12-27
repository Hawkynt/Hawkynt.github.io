/**********************************************************************************************
 *
 * BaseKing block cipher - Header file for encrypt & decrypt
 *
 **********************************************************************************************/

typedef unsigned short int u16 ;         

struct BASEKINGstruct {
  u16 ke[12];    /* The key to use for encryption */
  u16 kd[12];    /* The key to use for decryption */
};

void BASEKINGkeysetup(const u16* const key, 
                      struct BASEKINGstruct * const sp);

void BASEKINGencrypt(const struct BASEKINGstruct * const sp, 
                     u16* const a);

void BASEKINGdecrypt(const struct BASEKINGstruct * const sp,
                     u16* const a);

