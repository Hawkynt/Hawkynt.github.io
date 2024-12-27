/**********************************************************************************************
 *
 * BaseKing block cipher - Core Routines
 *
 *
 * key            :0015 0014 0013 0012 0011 0010 000F 000E 000D 000C 000B 000A
 * plaintext      :000B 000A 0009 0008 0007 0006 0005 0004 0003 0002 0001 0000
 * ciphertext     :3256 A250 8DD3 4215 0DC1 1BBC 0C5A 8B11 2EB5 AACA 78D9 B7A0
 * checking       :000B 000A 0009 0008 0007 0006 0005 0004 0003 0002 0001 0000
 *
 **********************************************************************************************/
 
#include <stdio.h>
#include <stdlib.h>
typedef unsigned short int u16 ;         
     
 
/*==================================================================================*/
/* Number of computation rounds in the block cipher */
/*----------------------------------------------------------------------------------*/
#define   NRHO		11	/* number of round is 11 */
/*----------------------------------------------------------------------------------*/
/* Shift Constants */
/*----------------------------------------------------------------------------------*/
unsigned r[12] = {0,8,1,15,5,10,7,6,13,14,2,3};
/*==================================================================================*/


/*==================================================================================*/
/* Some DEFINE... */
/*----------------------------------------------------------------------------------*/
#define rol16(a,r) (((a)<<(r)) ^ ((a)>>(16-(r))))
#define ror16(a,r) (((a)>>(r)) ^ ((a)<<(16-(r))))
/*==================================================================================*/


/*==================================================================================*/
void Mu(u16 *a) { 
/*----------------------------------------------------------------------------------*
 * inverts the order of words a
 *==================================================================================*/
  int i;
  u16 b[12];
  
  for (i=0; i<12; i++) b[11-i]=a[i];
  for (i=0; i<12; i++) a[i]=b[i];
}

/*==================================================================================*/
void Theta(const u16 *k, u16 *a, u16 RC) { 
/*----------------------------------------------------------------------------------*
 * the linear step 
 *==================================================================================*/
  u16 A[4];
  u16 B[6];
  
  a[0]^=k[0];    a[1]^=k[1];    a[2] ^=k[2]^RC; a[3] ^=k[3]^RC;
  a[4]^=k[4];    a[5]^=k[5];    a[6] ^=k[6];    a[7] ^=k[7];
  a[8]^=k[8]^RC; a[9]^=k[9]^RC; a[10]^=k[10];   a[11]^=k[11];

  B[0]=a[0] ^ a [4] ^ a[8];
  A[1]=a[1] ^ a [5] ^ a[9];
  A[2]=a[2] ^ a [6] ^ a[10];
  A[3]=a[3] ^ a [7] ^ a[11];
  A[0]=B[0] ^ A [1];  A[1]^=A[2];   A[2]^=A[3];   A[3]^=B[0];
  B[0]=a[0] ^ a [6]; B[1]=a[1] ^ a [7];  B[2]=a[2] ^ a [8];
  B[3]=a[3] ^ a [9]; B[4]=a[4] ^ a [10]; B[5]=a[5] ^ a [11];
  a[0]  ^= A[2] ^ B[3];  a[1]  ^= A[3] ^ B[4];
  a[2]  ^= A[0] ^ B[5];  a[3]  ^= A[1] ^ B[0];
  a[4]  ^= A[2] ^ B[1];  a[5]  ^= A[3] ^ B[2];
  a[6]  ^= A[0] ^ B[3];  a[7]  ^= A[1] ^ B[4];
  a[8]  ^= A[2] ^ B[5];  a[9]  ^= A[3] ^ B[0];
  a[10] ^= A[0] ^ B[1];  a[11] ^= A[1] ^ B[2];
}

/*==================================================================================*/
void Pi1(u16 *a) { 
/*----------------------------------------------------------------------------------*
 * Permutation Pi1
 *==================================================================================*/
  int  j;
  for (j=0; j<12; j++) a[j] = rol16(a[j],r[j]);
}

/*==================================================================================*/
void Gamma(u16 *a) { 
/*----------------------------------------------------------------------------------*
 * the nonlinear step
 *==================================================================================*/
  int  i;
  u16 aa[2*12];
  
  for (i=0; i<12; i++) aa[i] = aa[i+12]=a[i]; /* to remove modulo in index below */
  for (i=0; i<12; i++) a[i] = aa[i] ^ (aa[i+4] | ~aa[i+8]);
}

/*==================================================================================*/
void Pi2(u16 *a) { 
/*----------------------------------------------------------------------------------*
 * Permutation Pi2
 *==================================================================================*/
  int  j;
  for (j=0; j<12; j++) a[j] = ror16(a[j],r[11-j]);
}

/*==================================================================================*/
void BaseKing(const u16 *k, u16 *a, const u16 *RC) {
/*----------------------------------------------------------------------------------*
 * The core routine
 *==================================================================================*/
  int i;

  for (i=0; i<NRHO; i++) {
    Theta(k,a,RC[i]);
    Pi1(a);
    Gamma(a);
    Pi2(a);
  }

  Theta(k,a,RC[NRHO]);
  Mu(a);
}