#include "opt-sj.h"

/* 
   Optimized test implementation of SKIPJACK algorithm 
   Mark Tillotson <markt@chaos.org.uk>, 25 June 98

   based on unoptimized implementation of
   Panu Rissanen <bande@lut.fi> 960624

   SKIPJACK and KEA Algorithm Specifications 
   Version 2.0 
   29 May 1998
*/

static const uint8 ftable [0x100] = 
{ 
  0xa3,0xd7,0x09,0x83,0xf8,0x48,0xf6,0xf4,0xb3,0x21,0x15,0x78,0x99,0xb1,0xaf,0xf9,
  0xe7,0x2d,0x4d,0x8a,0xce,0x4c,0xca,0x2e,0x52,0x95,0xd9,0x1e,0x4e,0x38,0x44,0x28,
  0x0a,0xdf,0x02,0xa0,0x17,0xf1,0x60,0x68,0x12,0xb7,0x7a,0xc3,0xe9,0xfa,0x3d,0x53,
  0x96,0x84,0x6b,0xba,0xf2,0x63,0x9a,0x19,0x7c,0xae,0xe5,0xf5,0xf7,0x16,0x6a,0xa2,
  0x39,0xb6,0x7b,0x0f,0xc1,0x93,0x81,0x1b,0xee,0xb4,0x1a,0xea,0xd0,0x91,0x2f,0xb8,
  0x55,0xb9,0xda,0x85,0x3f,0x41,0xbf,0xe0,0x5a,0x58,0x80,0x5f,0x66,0x0b,0xd8,0x90,
  0x35,0xd5,0xc0,0xa7,0x33,0x06,0x65,0x69,0x45,0x00,0x94,0x56,0x6d,0x98,0x9b,0x76,
  0x97,0xfc,0xb2,0xc2,0xb0,0xfe,0xdb,0x20,0xe1,0xeb,0xd6,0xe4,0xdd,0x47,0x4a,0x1d,
  0x42,0xed,0x9e,0x6e,0x49,0x3c,0xcd,0x43,0x27,0xd2,0x07,0xd4,0xde,0xc7,0x67,0x18,
  0x89,0xcb,0x30,0x1f,0x8d,0xc6,0x8f,0xaa,0xc8,0x74,0xdc,0xc9,0x5d,0x5c,0x31,0xa4,
  0x70,0x88,0x61,0x2c,0x9f,0x0d,0x2b,0x87,0x50,0x82,0x54,0x64,0x26,0x7d,0x03,0x40,
  0x34,0x4b,0x1c,0x73,0xd1,0xc4,0xfd,0x3b,0xcc,0xfb,0x7f,0xab,0xe6,0x3e,0x5b,0xa5,
  0xad,0x04,0x23,0x9c,0x14,0x51,0x22,0xf0,0x29,0x79,0x71,0x7e,0xff,0x8c,0x0e,0xe2,
  0x0c,0xef,0xbc,0x72,0x75,0x6f,0x37,0xa1,0xec,0xd3,0x8e,0x62,0x8b,0x86,0x10,0xe8,
  0x08,0x77,0x11,0xbe,0x92,0x4f,0x24,0xc5,0x32,0x36,0x9d,0xcf,0xf3,0xa6,0xbb,0xac,
  0x5e,0x6c,0xa9,0x13,0x57,0x25,0xb5,0xe3,0xbd,0xa8,0x3a,0x01,0x05,0x59,0x2a,0x46
};



/* code 5 g-functions separately, so key array 
 * indexing guaranteed fixed-offset 
 */

#define g(k0,k1,k2,k3,in,out) \
{ \
  uint8 g1 = (in>>8) & 0xff ; \
  uint8 g2 = in & 0xff ; \
  uint8 g3 = ftable [g2 ^ key[k0]] ^ g1 ; \
  uint8 g4 = ftable [g3 ^ key[k1]] ^ g2 ; \
  uint8 g5 = ftable [g4 ^ key[k2]] ^ g3 ; \
  uint8 g6 = ftable [g5 ^ key[k3]] ^ g4 ; \
  out = (g5<<8) | g6 ; \
}

#define g0(in,out) g(0,1,2,3,in,out)
#define g4(in,out) g(4,5,6,7,in,out)
#define g8(in,out) g(8,9,0,1,in,out)
#define g2(in,out) g(2,3,4,5,in,out)
#define g6(in,out) g(6,7,8,9,in,out)

 
#define g_inv(k0,k1,k2,k3,in,out) \
{ \
  uint8 g6 = in & 0xff ; \
  uint8 g5 = (in>>8) & 0xff ; \
  uint8 g4 = ftable [g5 ^ key[k3]] ^ g6 ; \
  uint8 g3 = ftable [g4 ^ key[k2]] ^ g5 ; \
  uint8 g2 = ftable [g3 ^ key[k1]] ^ g4 ; \
  uint8 g1 = ftable [g2 ^ key[k0]] ^ g3 ; \
  out = (g1<<8) | g2 ; \
}


#define g0_inv(in,out) g_inv(0,1,2,3,in,out)
#define g4_inv(in,out) g_inv(4,5,6,7,in,out)
#define g8_inv(in,out) g_inv(8,9,0,1,in,out)
#define g2_inv(in,out) g_inv(2,3,4,5,in,out)
#define g6_inv(in,out) g_inv(6,7,8,9,in,out)




/* optimized version of Skipjack algorithm
 *
 * the appropriate g-function is inlined for each round
 *
 * the data movement is minimized by rotating the names of the 
 * variables w1..w4, not their contents (saves 3 moves per round)
 *
 * the loops are completely unrolled (needed to staticize choice of g)
 *
 * compiles to about 700 instructions on a Sparc (gcc -O)
 * which is about 90 instructions per byte, 22 per round.
 */
extern void skipjack_forwards (uint8 * plain, uint8 * cipher, uint8 * key)
{
  /* setup 4 16-bit portions */
  uint16 w1 = (plain[0] << 8) | plain[1];
  uint16 w2 = (plain[2] << 8) | plain[3];
  uint16 w3 = (plain[4] << 8) | plain[5];
  uint16 w4 = (plain[6] << 8) | plain[7];

  /* first 8 rounds */
  g0 (w1, w1) ; w4 ^= w1 ^ 1 ;
  g4 (w4, w4) ; w3 ^= w4 ^ 2 ;
  g8 (w3, w3) ; w2 ^= w3 ^ 3 ;
  g2 (w2, w2) ; w1 ^= w2 ^ 4 ;
  g6 (w1, w1) ; w4 ^= w1 ^ 5 ;
  g0 (w4, w4) ; w3 ^= w4 ^ 6 ;
  g4 (w3, w3) ; w2 ^= w3 ^ 7 ;
  g8 (w2, w2) ; w1 ^= w2 ^ 8 ;

  /* second 8 rounds */
  w2 ^= w1 ^ 9  ; g2 (w1, w1) ;
  w1 ^= w4 ^ 10 ; g6 (w4, w4) ;
  w4 ^= w3 ^ 11 ; g0 (w3, w3) ;
  w3 ^= w2 ^ 12 ; g4 (w2, w2) ;
  w2 ^= w1 ^ 13 ; g8 (w1, w1) ;
  w1 ^= w4 ^ 14 ; g2 (w4, w4) ;
  w4 ^= w3 ^ 15 ; g6 (w3, w3) ;
  w3 ^= w2 ^ 16 ; g0 (w2, w2) ;

  /* third 8 rounds */
  g4 (w1, w1) ; w4 ^= w1 ^ 17 ;
  g8 (w4, w4) ; w3 ^= w4 ^ 18 ;
  g2 (w3, w3) ; w2 ^= w3 ^ 19 ;
  g6 (w2, w2) ; w1 ^= w2 ^ 20 ;
  g0 (w1, w1) ; w4 ^= w1 ^ 21 ;
  g4 (w4, w4) ; w3 ^= w4 ^ 22 ;
  g8 (w3, w3) ; w2 ^= w3 ^ 23 ;
  g2 (w2, w2) ; w1 ^= w2 ^ 24 ;

  /* last 8 rounds */
  w2 ^= w1 ^ 25 ; g6 (w1, w1) ;
  w1 ^= w4 ^ 26 ; g0 (w4, w4) ;
  w4 ^= w3 ^ 27 ; g4 (w3, w3) ;
  w3 ^= w2 ^ 28 ; g8 (w2, w2) ;
  w2 ^= w1 ^ 29 ; g2 (w1, w1) ;
  w1 ^= w4 ^ 30 ; g6 (w4, w4) ;
  w4 ^= w3 ^ 31 ; g0 (w3, w3) ;
  w3 ^= w2 ^ 32 ; g4 (w2, w2) ;

  /* pack into byte vector */
  cipher [0] = w1 >> 8 ;  cipher [1] = w1 & 0xff ;
  cipher [2] = w2 >> 8 ;  cipher [3] = w2 & 0xff ;
  cipher [4] = w3 >> 8 ;  cipher [5] = w3 & 0xff ;
  cipher [6] = w4 >> 8 ;  cipher [7] = w4 & 0xff ;
}


extern void skipjack_backwards (uint8 * cipher, uint8 * plain, uint8 * key)
{
  /* setup 4 16-bit portions */
  uint16 w1 = (cipher[0] << 8) | cipher[1];
  uint16 w2 = (cipher[2] << 8) | cipher[3];
  uint16 w3 = (cipher[4] << 8) | cipher[5];
  uint16 w4 = (cipher[6] << 8) | cipher[7];

  /* first 8 rounds */
  g4_inv (w2, w2) ; w3 ^= w2 ^ 32 ;
  g0_inv (w3, w3) ; w4 ^= w3 ^ 31 ;
  g6_inv (w4, w4) ; w1 ^= w4 ^ 30 ;
  g2_inv (w1, w1) ; w2 ^= w1 ^ 29 ;
  g8_inv (w2, w2) ; w3 ^= w2 ^ 28 ;
  g4_inv (w3, w3) ; w4 ^= w3 ^ 27 ;
  g0_inv (w4, w4) ; w1 ^= w4 ^ 26 ;
  g6_inv (w1, w1) ; w2 ^= w1 ^ 25 ;

  /* second 8 rounds */
  w1 ^= w2 ^ 24 ; g2_inv (w2, w2) ;
  w2 ^= w3 ^ 23 ; g8_inv (w3, w3) ;
  w3 ^= w4 ^ 22 ; g4_inv (w4, w4) ;
  w4 ^= w1 ^ 21 ; g0_inv (w1, w1) ;
  w1 ^= w2 ^ 20 ; g6_inv (w2, w2) ;
  w2 ^= w3 ^ 19 ; g2_inv (w3, w3) ;
  w3 ^= w4 ^ 18 ; g8_inv (w4, w4) ;
  w4 ^= w1 ^ 17 ; g4_inv (w1, w1) ;

  /* third 8 rounds */
  g0_inv (w2, w2) ; w3 ^= w2 ^ 16 ;
  g6_inv (w3, w3) ; w4 ^= w3 ^ 15 ;
  g2_inv (w4, w4) ; w1 ^= w4 ^ 14 ;
  g8_inv (w1, w1) ; w2 ^= w1 ^ 13 ;
  g4_inv (w2, w2) ; w3 ^= w2 ^ 12 ;
  g0_inv (w3, w3) ; w4 ^= w3 ^ 11 ;
  g6_inv (w4, w4) ; w1 ^= w4 ^ 10 ;
  g2_inv (w1, w1) ; w2 ^= w1 ^ 9 ;

  /* last 8 rounds */
  w1 ^= w2 ^ 8 ; g8_inv (w2, w2) ;
  w2 ^= w3 ^ 7 ; g4_inv (w3, w3) ;
  w3 ^= w4 ^ 6 ; g0_inv (w4, w4) ;
  w4 ^= w1 ^ 5 ; g6_inv (w1, w1) ;
  w1 ^= w2 ^ 4 ; g2_inv (w2, w2) ;
  w2 ^= w3 ^ 3 ; g8_inv (w3, w3) ;
  w3 ^= w4 ^ 2 ; g4_inv (w4, w4) ;
  w4 ^= w1 ^ 1 ; g0_inv (w1, w1) ;

  /* pack into byte vector */
  plain [0] = w1 >> 8 ;  plain [1] = w1 & 0xff ;
  plain [2] = w2 >> 8 ;  plain [3] = w2 & 0xff ;
  plain [4] = w3 >> 8 ;  plain [5] = w3 & 0xff ;
  plain [6] = w4 >> 8 ;  plain [7] = w4 & 0xff ;
}

