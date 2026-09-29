# Rabin

> Rabin public key cryptosystem based on quadratic residues modulo composite numbers. Security equivalent to integer factorization. Each ciphertext decrypts to four possible plaintexts requiring disambiguation.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Public Key Cryptosystem |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Michael O. Rabin |
| Year | 1979 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/asymmetric/rabin.js`](../../../algorithms/asymmetric/rabin.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1024 bytes (8192 bits); 2048 bytes (16384 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Rabin Paper (1979)](https://courses.csail.mit.edu/6.857/2009/handouts/rabin.pdf)
- [Crypto++ Rabin Implementation](https://github.com/weidai11/cryptopp/blob/master/rabin.cpp)
- [Wikipedia - Rabin Cryptosystem](https://en.wikipedia.org/wiki/Rabin_cryptosystem)
- [Handbook of Applied Cryptography - Chapter 8](http://cacr.uwaterloo.ca/hac/)

## References

- [Crypto++ rabin.h](https://github.com/weidai11/cryptopp/blob/master/rabin.h)
- [Crypto++ rabin.cpp](https://github.com/weidai11/cryptopp/blob/master/rabin.cpp)
- [Crypto++ Integer Implementation](https://github.com/weidai11/cryptopp/blob/master/integer.cpp)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rabin Round-trip Test - Crypto++ Implementation Pattern](https://github.com/weidai11/cryptopp/blob/master/rabin.cpp)

| Field | Value |
| --- | --- |
| `key` | `0400` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `48656c6c6f20576f726c64` |

**Vector 2** — [Rabin-2048 round-trip](https://github.com/weidai11/cryptopp/blob/master/rabin.cpp)

| Field | Value |
| --- | --- |
| `key` | `0800` |
| `input` | `546865207365636f6e64206b65792073697a65` |
| `expected` | `546865207365636f6e64206b65792073697a65` |

---

[← All algorithms](../README.md)
