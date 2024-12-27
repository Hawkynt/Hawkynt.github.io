/**********************************************************************************************
 *
 * BaseKing block cipher
 *
 **********************************************************************************************/

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "BaseKing.h"

void printvec (const u16 *a) {
  printf ("%04hX %04hX %04hX %04hX %04hX %04hX %04hX %04hX %04hX %04hX %04hX %04hX\n",a[11],a[10],a[9],a[8],a[7],a[6],a[5],a[4],a[3],a[2],a[1],a[0]);
}

/****************************************************************************************/
void OutputNCheck (const u16*k, u16 *a)
{
  u16 plain[12];
  int i,checkok;
  struct BASEKINGstruct sp;

  BASEKINGkeysetup( k,&sp );

  for (i=0; i<12; i++) plain[i]=a[i];                     
  printf ("key               :"); printvec (k);
  printf ("plaintext         :"); printvec (a);
  BASEKINGencrypt ( &sp,a );
  printf ("ciphertext        :"); printvec (a);
  BASEKINGdecrypt ( &sp,a );
  printf ("checking          :"); printvec (a);

  for (i=0; (i<12)&&(checkok=(a[i]==plain[i])); i++);
  
  if (checkok) printf (" -----> OK !\n"); else
               printf (" -----> ######## WRONG ########## WRONG ########## WRONG ########\n");
}

/****************************************************************************************/
int main (void) {
  int i;
  u16 a[12], k[12];
                
  srand ((unsigned)time(NULL));


  a[0]=0x0; a[1]=0x1; a[2]=2; a[3]=3; a[4]=4; a[5]=5; a[6]=6; a[7]=7;
  a[8]=8; a[9]=9; a[10]=10; a[11]=11;
  k[0]=10; k[1]=11; k[2]=12; k[3]=13; k[4]=14; k[5]=15; k[6]=16; k[7]=17;
  k[8]=18; k[9]=19; k[10]=20; k[11]=21;
  OutputNCheck (k,a);

  for (i=0; i<12; i++) {a[i]=rand()&0xFFFF;}
  for (i=0; i<12; i++) {k[i]=rand()&0xFFFF;}
  OutputNCheck(k,a);

  return 0;
}
