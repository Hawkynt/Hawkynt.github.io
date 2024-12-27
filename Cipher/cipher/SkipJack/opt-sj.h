/* machine dependent really: */
typedef unsigned char  uint8 ;
typedef unsigned short uint16 ;
typedef unsigned long  uint32 ;

extern void skipjack_forwards (uint8 * plain, uint8 * cipher, uint8 * key) ;
extern void skipjack_backwards (uint8 * cipher, uint8 * plain, uint8 * key) ;
