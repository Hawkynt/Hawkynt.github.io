# LUC

> LUC public key cryptosystem based on Lucas sequences over finite fields. Encryption is the Lucas function c = V_e(m, 1) mod n and recovery inverts it modulo each prime factor using the Jacobi symbol of the discriminant, then combines by CRT. Historical cryptosystem with no practical advantages over RSA but of pedagogical interest for Lucas function mathematics.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Lucas-based Cryptosystem |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Peter Smith, Michael Lennon |
| Year | 1993 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/asymmetric/luc.js`](../../../algorithms/asymmetric/luc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1024 bytes (8192 bits); 2048 bytes (16384 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Crypto++ LUC Implementation](https://github.com/weidai11/cryptopp/blob/master/luc.h)
- [LUC: A New Public Key System](https://link.springer.com/chapter/10.1007/3-540-48329-2_25)
- [Digital Signature Schemes Based on Lucas Functions](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=8a4c7b5e3e5d3e6f7a8b9c0d1e2f3a4b5c6d7e8f)
- [Wikipedia - Lucas Sequence](https://en.wikipedia.org/wiki/Lucas_sequence)

## References

- [Crypto++ Source - luc.cpp](https://github.com/weidai11/cryptopp/blob/master/luc.cpp)
- [Crypto++ Source - nbtheory.cpp (Lucas)](https://github.com/weidai11/cryptopp/blob/master/nbtheory.cpp)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LUC-1024 round-trip - c = V_e(m, 1) mod n recovered through InverseLucas](https://link.springer.com/chapter/10.1007/3-540-48329-2_25)

| Field | Value |
| --- | --- |
| `key` | `0400` |
| `input` | `74657374` |
| `expected` | `74657374` |

**Vector 2** — [LUC-2048 round-trip with leading zero octets](https://github.com/weidai11/cryptopp/blob/master/luc.h)

| Field | Value |
| --- | --- |
| `key` | `0800` |
| `input` | `0000000102030405` |
| `expected` | `0000000102030405` |

---

[← All algorithms](../README.md)
