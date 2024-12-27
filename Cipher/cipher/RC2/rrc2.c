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

#include "rrc2.h"

/* global consts from the Appendix: */
#include "rrc2_consts.c"

/*
From pgut01@cs.auckland.ac.nz Sun Feb 11 07:45:03 1996 
 
 
 
                           Ron Rivest's Cipher No.2 
                           ------------------------ 
  
Ron Rivest's Cipher No.2 (hereafter referred to as RRC.2, other people may 
refer to it by other names) is word oriented, operating on a block of 64 bits 
divided into four 16-bit words, with a key table of 64 words.  All data units 
are little-endian.  This functional description of the algorithm is based in 
the paper "The RC5 Encryption Algorithm" (RC5 is a trademark of RSADSI), using 
the same general layout, terminology, and pseudocode style. 


Notation and RRC.2 Primitive Operations 
  
RRC.2 uses the following primitive operations: 
  
1. Two's-complement addition of words, denoted by "+".  The inverse operation, 
   subtraction, is denoted by "-". 
2. Bitwise exclusive OR, denoted by "^". 
3. Bitwise AND, denoted by "&". 
4. Bitwise NOT, denoted by "~". 
5. A left-rotation of words; the rotation of word x left by y is denoted 
   x <<< y.  The inverse operation, right-rotation, is denoted x >>> y. 

These operations are directly and efficiently supported by most processors. 
*/

/* Well, unfortunately rotation is not easily available in C... */
#define	LROT(x,y)	((x)<<(y)|(x)>>(sizeof(x)*8-(y)))
#define RROT(x,y)	((x)>>(y)|(x)<<(sizeof(x)*8-(y)))

/*
The RRC.2 Algorithm 
  
RRC.2 consists of three components, a *key expansion* algorithm, an 
*encryption* algorithm, and a *decryption* algorithm. 
  
  
Key Expansion 
  
The purpose of the key-expansion routine is to expand the user's key K to fill 
the expanded key array S, so S resembles an array of random binary words 
determined by the user's secret key K. 
  
Initialising the S-box 

RRC.2 uses a single 256-byte S-box derived from the ciphertext contents of 
Beale Cipher No.1 XOR'd with a one-time pad.  The Beale Ciphers predate modern 
cryptography by enough time that there should be no concerns about trapdoors 
hidden in the data.  They have been published widely, and the S-box can be 
easily recreated from the one-time pad values and the Beale Cipher data taken 
from a standard source.  To initialise the S-box: 

  for i = 0 to 255 do 
    sBox[ i ] = ( beale[ i ] mod 256 ) ^ pad[ i ] 
*/

void initialise_SBox( SBox* sbox )

{
	int	i;
	
	for(i=0; i<=255; i++) {
		(*sbox).b[i] = (Beale[i] % 256 ) ^ Pad[i]; /* compiler should replace % with & */
	}
}		

/* 
The contents of Beale Cipher No.1 and the necessary one-time pad are given as 
an appendix at the end of this document.  For efficiency, implementors may wish 
to skip the Beale Cipher expansion and store the sBox table directly. 
  
Expanding the Secret Key to 128 Bytes 
  
The secret key is first expanded to fill 128 bytes (64 words).  The expansion 
consists of taking the sum of the first and last bytes in the user key, looking 
up the sum (modulo 256) in the S-box, and appending the result to the key.  The 
operation is repeated with the second byte and new last byte of the key until 
all 128 bytes have been generated.  Note that the following pseudocode treats 
the S array as an array of 128 bytes rather than 64 words. 

  for j = 0 to length-1 do 
    S[ j ] = K[ j ] 
  for j = length to 127 do 
    s[ j ] = sBox[ ( S[ j-length ] + S[ j-1 ] ) mod 256 ]; 
*/

void expand_key(char* key, int length, S* s, SBox* sbox)
{
	int	j;
	
	for(j=0; j<length; j++) {
		(*s).b[j] = (byte) key[j];
	}
	for(j=length; j<=127; j++) {
		(*s).b[j] = (*sbox).b[ ((*s).b[j-length] + (*s).b[j-1]) % 256 ];
	}

/*  
At this point it is possible to perform a truncation of the effective key 
length to ease the creation of espionage-enabled software products.  However 
since the author cannot conceive why anyone would want to do this, it will not 
be considered further. 
  
The final phase of the key expansion involves replacing the first byte of S 
with the entry selected from the S-box: 
  
  S[ 0 ] = sBox[ S[ 0 ] ] 
*/  

	(*s).b[0] = (*sbox).b[(*s).b[0]];
}	

/*  
Encryption 
  
The cipher has 16 full rounds, each divided into 4 subrounds.  Two of the full 
rounds perform an additional transformation on the data.  Note that the 
following pseudocode treats the S array as an array of 64 words rather than 128 
bytes. 
*/

void encrypt(word data[4], S* s)
/* Naaa, we're not going to use 4 parameters. An array will do! */
{
	int	i,j;                  /* rather silly thing since i*4==j; compiler should take care */    
	word	w0,w1,w2,w3;          /* I save myself some typing here */
	
/*  
  for i = 0 to 15 do 
    j = i * 4; 
    word0 = ( word0 + ( word1 & ~word3 ) + ( word2 & word3 ) + S[ j+0 ] ) <<< 1 
    word1 = ( word1 + ( word2 & ~word0 ) + ( word3 & word0 ) + S[ j+1 ] ) <<< 2 
    word2 = ( word2 + ( word3 & ~word1 ) + ( word0 & word1 ) + S[ j+2 ] ) <<< 3 
    word3 = ( word3 + ( word0 & ~word2 ) + ( word1 & word2 ) + S[ j+3 ] ) <<< 5 
*/

	/* Init: Get words out of array! */
	w0 = data[0];
	w1 = data[1];
	w2 = data[2];
	w3 = data[3]; 

	for(i=0; i<=15; i++) {
		j = i*4;
		w0 = LROT( (word) (w0 + ( w1 & (~ w3) ) + ( w2 & w3 ) + (*s).w[j+0]), 1);
		w1 = LROT( (word) (w1 + ( w2 & (~ w0) ) + ( w3 & w0 ) + (*s).w[j+1]), 2);
		w2 = LROT( (word) (w2 + ( w3 & (~ w1) ) + ( w0 & w1 ) + (*s).w[j+2]), 3);
		w3 = LROT( (word) (w3 + ( w0 & (~ w2) ) + ( w1 & w2 ) + (*s).w[j+3]), 5);
		
/*  
In addition the fifth and eleventh rounds add the contents of the S-box indexed 
by one of the data words to another of the data words following the four 
subrounds as follows: 
  
    word0 = word0 + S[ word3 & 63 ]; 
    word1 = word1 + S[ word0 & 63 ]; 
    word2 = word2 + S[ word1 & 63 ]; 
    word3 = word3 + S[ word2 & 63 ]; 
*/

		/* Tricky. 5th + 11th round -> i==4, and i==10 */
		if ( (i==4) || (i==10) ) {
			w0 = w0 + (*s).w[ w3 & 63 ];
			w1 = w1 + (*s).w[ w0 & 63 ];
			w2 = w2 + (*s).w[ w1 & 63 ];
			w3 = w3 + (*s).w[ w2 & 63 ];
		}
	} 

	/* Fini: copy Args back into array! */
	data[0] = w0;
	data[1] = w1;
	data[2] = w2;
	data[3] = w3;
}

/*  
Decryption 
  
The decryption operation is simply the inverse of the encryption operation. 
Note that the following pseudocode treats the S array as an array of 64 words 
rather than 128 bytes. 
*/

void decrypt(word data[4], S* s)
	/* data: see encrypt */
{

/*
  for i = 15 downto 0 do 
    j = i * 4; 
    word3 = ( word3 >>> 5 ) - ( word0 & ~word2 ) - ( word1 & word2 ) - S[ j+3 ] 
    word2 = ( word2 >>> 3 ) - ( word3 & ~word1 ) - ( word0 & word1 ) - S[ j+2 ] 
    word1 = ( word1 >>> 2 ) - ( word2 & ~word0 ) - ( word3 & word0 ) - S[ j+1 ] 
    word0 = ( word0 >>> 1 ) - ( word1 & ~word3 ) - ( word2 & word3 ) - S[ j+0 ] 
*/

	int	i,j;            /* see encrypt() */
	word	w0,w1,w2,w3;	/* dito */
	
	/* get words from array */
	w0 = data[0];
	w1 = data[1];
	w2 = data[2];
	w3 = data[3];
	
	for(i=15; i>=0; i--) {
		j = i*4;
		
		w3 = RROT(w3,5) - (w0 & (~ w2))	- (w1 & w2) - (*s).w[j+3];
		w2 = RROT(w2,3) - (w3 & (~ w1)) - (w0 & w1) - (*s).w[j+2];
		w1 = RROT(w1,2) - (w2 & (~ w0)) - (w3 & w0) - (*s).w[j+1];
		w0 = RROT(w0,1) - (w1 & (~ w3)) - (w2 & w3) - (*s).w[j+0];
		
/*		
In addition the fifth and eleventh rounds subtract the contents of the S-box 
indexed by one of the data words from another one of the data words following 
the four subrounds as follows: 
  
    word3 = word3 - S[ word2 & 63 ] 
    word2 = word2 - S[ word1 & 63 ] 
    word1 = word1 - S[ word0 & 63 ] 
    word0 = word0 - S[ word3 & 63 ] 
*/

		/* very tricky: 5th + 11th round -> i==11, i==5 */
		if ((i==11) || (i==5))  {
			w3 = w3 - (*s).w[w2 & 63];
			w2 = w2 - (*s).w[w1 & 63];
			w1 = w1 - (*s).w[w0 & 63];
			w0 = w0 - (*s).w[w3 & 63];
		}
	}

	/* Fini: copy Args back into array! */
	data[0] = w0;
	data[1] = w1;
	data[2] = w2;
	data[3] = w3;
}

/*  
Test Vectors 
  
The following test vectors may be used to test the correctness of an RRC.2 
implementation: 
  
  Key:      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
  Plain:    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
  Cipher:   0x1C, 0x19, 0x8A, 0x83, 0x8D, 0xF0, 0x28, 0xB7 
  
  Key:      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01 
  Plain:    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
  Cipher:   0x21, 0x82, 0x9C, 0x78, 0xA9, 0xF9, 0xC0, 0x74 
  
  Key:      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
  Plain:    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF 
  Cipher:   0x13, 0xDB, 0x35, 0x17, 0xD3, 0x21, 0x86, 0x9E 
  
  Key:      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F 
  Plain:    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
  Cipher:   0x50, 0xDC, 0x01, 0x62, 0xBD, 0x75, 0x7F, 0x31 
*/

void rrc2_test()
/* This routines tests conformance with the spec. If e.g. the type tests fail,
   we still have an otherwise fine cipher (I think), but not compatible with
   the rrc2 spec. */
{
        /* testvectors done by copy&paste */
	const byte key1[16] = { 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
        };
        const byte plain1[8] = {
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
        };
        const byte cipher1[8] = {
            0x1C, 0x19, 0x8A, 0x83, 0x8D, 0xF0, 0x28, 0xB7 
        };
  
  	const byte key2[16] = {
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01 
        };
        const byte plain2[8] = {
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
        };
        const byte cipher2[8] = {
            0x21, 0x82, 0x9C, 0x78, 0xA9, 0xF9, 0xC0, 0x74 
        };
        
        const byte key3[16] = {
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
        };
        const byte plain3[8] = {
            0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF 
        };
        const byte cipher3[8] = {
            0x13, 0xDB, 0x35, 0x17, 0xD3, 0x21, 0x86, 0x9E 
        };
  
  	const byte key4[16] = {
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 
            0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F 
        };
        const byte plain4[8] = {
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 
        };
        const byte cipher4[8] = {
            0x50, 0xDC, 0x01, 0x62, 0xBD, 0x75, 0x7F, 0x31 
        };
        
        byte	key[16], data[8];
        
        const word	w0 = 0xC5C5;
        const word	w1 = 0x5C5C;
        
        word	w2;
        union {word w; byte b[2];} e;
	
	/* test types */
	assert( sizeof(byte)==1 );
	assert( sizeof(word)==2 );
	
	/* test ops */
	assert( LROT(1,3) == 8 );
	assert( LROT(0,7) == 0 );
	w2 = LROT(w0,8); assert( w2 == w0 );
	w2 = LROT(w0,4); assert( w2 == w1 );
	
	assert( RROT(8,3) == 1 );
	assert( RROT(0,7) == 0 );
	w2 = RROT(w0,8); assert( w2 == w0 );
	w2 = RROT(w1,4); assert( w2 == w0 );
	
	/* test Little-Endian */
	e.b[1] = 0xfe; 
	e.b[2] = 0xaf;
	assert( e.w = 0xaffe );

	/* test test-vectors */

#define	TEST_VECTOR(k,pl,c)	\
		memcpy(key,k,sizeof(key)); \
		memcpy(data,pl,sizeof(data)); \
		rrc2_encrypt(data,sizeof(data),key,sizeof(key)); \
		assert(memcmp(data,c,sizeof(data))==0); \
		rrc2_decrypt(data,sizeof(data),key,sizeof(key)); \
		assert(memcmp(data,pl,sizeof(data))==0);

	TEST_VECTOR(key1,plain1,cipher1);
	TEST_VECTOR(key2,plain2,cipher2);
	TEST_VECTOR(key3,plain3,cipher3);
	TEST_VECTOR(key4,plain4,cipher4);

}
  
/*
Appendix: Beale Cipher No.1, "The Locality of the Vault", and One-time Pad for 
         Creating the S-Box 
  
Beale Cipher No.1. 
  
  71, 194,  38,1701,  89,  76,  11,  83,1629,  48,  94,  63, 132,  16, 111,  95, 
  84, 341, 975,  14,  40,  64,  27,  81, 139, 213,  63,  90,1120,   8,  15,   3, 
 126,2018,  40,  74, 758, 485, 604, 230, 436, 664, 582, 150, 251, 284, 308, 231, 
 124, 211, 486, 225, 401, 370,  11, 101, 305, 139, 189,  17,  33,  88, 208, 193, 
 145,   1,  94,  73, 416, 918, 263,  28, 500, 538, 356, 117, 136, 219,  27, 176, 
 130,  10, 460,  25, 485,  18, 436,  65,  84, 200, 283, 118, 320, 138,  36, 416, 
 280,  15,  71, 224, 961,  44,  16, 401,  39,  88,  61, 304,  12,  21,  24, 283, 
 134,  92,  63, 246, 486, 682,   7, 219, 184, 360, 780,  18,  64, 463, 474, 131, 
 160,  79,  73, 440,  95,  18,  64, 581,  34,  69, 128, 367, 460,  17,  81,  12, 
 103, 820,  62, 110,  97, 103, 862,  70,  60,1317, 471, 540, 208, 121, 890, 346, 
  36, 150,  59, 568, 614,  13, 120,  63, 219, 812,2160,1780,  99,  35,  18,  21, 
 136, 872,  15,  28, 170,  88,   4,  30,  44, 112,  18, 147, 436, 195, 320,  37, 
 122, 113,   6, 140,   8, 120, 305,  42,  58, 461,  44, 106, 301,  13, 408, 680, 
  93,  86, 116, 530,  82, 568,   9, 102,  38, 416,  89,  71, 216, 728, 965, 818, 
   2,  38, 121, 195,  14, 326, 148, 234,  18,  55, 131, 234, 361, 824,   5,  81, 
 623,  48, 961,  19,  26,  33,  10,1101, 365,  92,  88, 181, 275, 346, 201, 206 
  
One-time Pad. 
  
 158, 186, 223,  97,  64, 145, 190, 190, 117, 217, 163,  70, 206, 176, 183, 194, 
 146,  43, 248, 141,   3,  54,  72, 223, 233, 153,  91, 210,  36, 131, 244, 161, 
 105, 120, 113, 191, 113,  86,  19, 245, 213, 221,  43,  27, 242, 157,  73, 213, 
 193,  92, 166,  10,  23, 197, 112, 110, 193,  30, 156,  51, 125,  51, 158,  67, 
 197, 215,  59, 218, 110, 246, 181,   0, 135,  76, 164,  97,  47,  87, 234, 108, 
 144, 127,   6,   6, 222, 172,  80, 144,  22, 245, 207,  70, 227, 182, 146, 134, 
 119, 176,  73,  58, 135,  69,  23, 198,   0, 170,  32, 171, 176, 129,  91,  24, 
 126,  77, 248,   0, 118,  69,  57,  60, 190, 171, 217,  61, 136, 169, 196,  84, 
 168, 167, 163, 102, 223,  64, 174, 178, 166, 239, 242, 195, 249,  92,  59,  38, 
 241,  46, 236,  31,  59, 114,  23,  50, 119, 186,   7,  66, 212,  97, 222, 182, 
 230, 118, 122,  86, 105,  92, 179, 243, 255, 189, 223, 164, 194, 215,  98,  44, 
  17,  20,  53, 153, 137, 224, 176, 100, 208, 114,  36, 200, 145, 150, 215,  20, 
  87,  44, 252,  20, 235, 242, 163, 132,  63,  18,   5, 122,  74,  97,  34,  97, 
 142,  86, 146, 221, 179, 166, 161,  74,  69, 182,  88, 120, 128,  58,  76, 155, 
  15,  30,  77, 216, 165, 117, 107,  90, 169, 127, 143, 181, 208, 137, 200, 127, 
 170, 195,  26,  84, 255, 132, 150,  58, 103, 250, 120, 221, 237,  37,   8,  99 


Implementation 
  
A non-US based programmer who has never seen any encryption code before will 
shortly be implementing RRC.2 based solely on this specification and not on 
knowledge of any other encryption algorithms.  Stand by. 
*/

/* Well, that's not me, I suppose... Anyway... */

void rrc2_encrypt(byte* data,int length_of_data, char* key, int length_of_key)
{
	SBox	sbox;
	S	s;
	int	i;

	initialise_SBox(&sbox);

	expand_key(key,length_of_key,&s,&sbox);

	assert((length_of_data % (sizeof(word)*4)) == 0); /* data must be multiple of blocksize */
	
	for(i=0; i<length_of_data; i+=BLOCK_SIZE, data+=BLOCK_SIZE) {
		encrypt((word *)data,&s);
	}
}
	
void rrc2_decrypt(byte* data,int length_of_data, char* key, int length_of_key)
{
	SBox	sbox;
	S	s;
	int	i;
	
	initialise_SBox(&sbox);
	expand_key(key,length_of_key,&s,&sbox);
	
	assert((length_of_data % (sizeof(word)*4)) == 0); /* data must be multiple of blocksize */
	
	for(i=0; i<length_of_data; i+=BLOCK_SIZE, data+=BLOCK_SIZE) {
		decrypt((word *)data,&s);
	}
}

/* FINI rrc2.c */
