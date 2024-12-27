/**********************************************************************************************
 *
 * BaseKing block cipher - KeySetup Routine
 *
 *
 **********************************************************************************************/
 
#include <stdio.h>
#include <stdlib.h>
#include "BaseKing.h"
 
extern void Mu(u16 *a);
extern void Theta(const u16 *k, u16 *a, u16 RC);

/*==================================================================================*/
/* Null vector */
/*----------------------------------------------------------------------------------*/
u16 NullVector[12] = {0,0,0,0,0,0,0,0,0,0,0,0};
/*==================================================================================*/

/*==================================================================================*/
void BASEKINGkeysetup(const u16* const key, 
                      struct BASEKINGstruct * const sp)
/*==================================================================================*/
{
  u16 *ke=sp->ke;
  u16 *kd=sp->kd;
  int i;
  for (i=0; i<12; i++) kd[i]=ke[i]=key[i];
  Theta (NullVector,kd,0x0000);
  Mu(kd);
}