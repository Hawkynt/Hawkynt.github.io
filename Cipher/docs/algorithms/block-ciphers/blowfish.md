# Blowfish

> Bruce Schneier's Blowfish cipher with 64-bit blocks and variable key lengths from 32 to 448 bits. Uses key-dependent S-boxes and 16-round Feistel network.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Bruce Schneier |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/blowfish.js`](../../../algorithms/block/blowfish.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 4 bytes (32 bits) to 56 bytes (448 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Applied Cryptography - Blowfish](https://www.schneier.com/books/applied_cryptography/)
- [Official Blowfish Description](https://www.schneier.com/academic/blowfish/)
- [Blowfish Test Vectors](https://www.schneier.com/academic/blowfish/vectors.txt)

## References

- [OpenSSL Blowfish Implementation](https://github.com/openssl/openssl/blob/master/crypto/bf/)
- [libgcrypt Blowfish Implementation](https://github.com/gpg/libgcrypt/blob/master/cipher/blowfish.c)
- [Crypto++ Blowfish Implementation](https://github.com/weidai11/cryptopp/blob/master/blowfish.cpp)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Blowfish-448 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `4ef997456198dd78` |

**Vector 2** — [DarkCrypt Blowfish-448 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 3031323334353637` |
| `input` | `0001020304050607` |
| `expected` | `373c66bba50eb9cc` |

**Vector 3** — [DarkCrypt Blowfish-448 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738` |
| `input` | `1011121314151617` |
| `expected` | `c8ab0874262536bd` |

**Vector 4** — [Blowfish Official Test Vector #1 - All Zeros](https://www.schneier.com/academic/blowfish/vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `4ef997456198dd78` |

**Vector 5** — [Blowfish Official Test Vector #2 - All Ones](https://www.schneier.com/academic/blowfish/vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `51866fd5b85ecb8a` |

**Vector 6** — [Blowfish Official Test Vector #3 - Pattern Data](https://www.schneier.com/academic/blowfish/vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `input` | `1111111111111111` |
| `expected` | `61f9c3802281b096` |

**Vector 7** — [Blowfish ASCII Test Vector](https://www.schneier.com/academic/blowfish/)

| Field | Value |
| --- | --- |
| `key` | `544553544b455921` |
| `input` | `424c4f5746495348` |
| `expected` | `2532fa57d3acf5c5` |

**Vector 8** — [Blowfish Single Bit Test](https://www.schneier.com/academic/blowfish/vectors.txt)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000` |
| `input` | `8000000000000000` |
| `expected` | `6e6456626849cf27` |

---

[← All algorithms](../README.md)
