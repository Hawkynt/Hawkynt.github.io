/****************************************************************************
*                                                                            *
*                     Specification and Implementation of                    *
*                       RRC2 - Ron Rivest Cipher Nr. 2                       *
*                                                                            *
*       Specification by P. Gutmann (as obtained from usenet).                *
*                                                                            *
*       Implementation done on 13/15.02.96 by Daniel Vogelheim.              *
*                                                                            *
*       This document is placed into the public domain.                      *
*       I'd appriciate if my name was mentioned in derivative works.         *
*                                                                            *
 *****************************************************************************/

#include <sys/types.h>
#include <assert.h>
#include <string.h>

/* Types: */

typedef unsigned char byte;
typedef unsigned short word;

typedef union {	byte b[256];
		word w[128]; } SBox;
	 
typedef union {	byte b[128];
		word w[64]; } S;

#define BLOCK_SIZE (sizeof(word)*4)

/* internal functions from the spec */
void initialise_SBox(SBox* sbox);
void expand_key(char* key, int length, S* s, SBox* sbox);
void encrypt(word data[4], S* s);
void decrypt(word data[4], S* s);
void rrc2_test();

/* my stream routines */
void rrc2_encrypt(byte* data,int length_of_data, char* key, int length_of_key);
void rrc2_decrypt(byte* data,int length_of_data, char* key, int length_of_key);

/* FINI rrc2.h*/
