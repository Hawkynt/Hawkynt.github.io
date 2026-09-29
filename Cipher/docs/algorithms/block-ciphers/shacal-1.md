# SHACAL-1

> 160-bit block cipher based on the SHA-1 hash function compression function. Submitted to NESSIE but not selected due to SHA-1 weaknesses. Uses 80 rounds with SHA-1 operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Helena Handschuh, David Naccache |
| Year | 2000 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/block/shacal-1.js`](../../../algorithms/block/shacal-1.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 64 bytes (512 bits) |
| Block sizes | 20 bytes (160 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NESSIE Project](https://www.cosic.esat.kuleuven.be/nessie/)
- [Wikipedia - SHACAL](https://en.wikipedia.org/wiki/SHACAL)
- [FIPS 180-2 (SHA-1 Specification)](https://csrc.nist.gov/publications/fips/fips180-2/fips180-2.pdf)

## References

- [Crypto3 Implementation](https://github.com/nilfoundation/crypto3/blob/master/libs/block/include/nil/crypto3/block/shacal1.hpp)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SHA-1 IV as plaintext, pad("") as key - from the published SHA-1("") digest](https://datatracker.ietf.org/doc/html/rfc3174)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `67452301efcdab8998badcfe10325476c3d2e1f0` |
| `expected` | `72f480ed6e9d9f84999ae2f1852dc41aec052519` |

**Vector 2** — [SHA-1 IV as plaintext, pad("abc") as key - from the published SHA-1("abc") digest](https://datatracker.ietf.org/doc/html/rfc3174#section-7.3)

| Field | Value |
| --- | --- |
| `key` | `61626380000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000018` |
| `input` | `67452301efcdab8998badcfe10325476c3d2e1f0` |
| `expected` | `42541b355738d5e121834873681e6df6d8fdf6ad` |

**Vector 3** — [SHA-1 IV as plaintext, pad("message digest") as key - from the published SHA-1 digest](https://datatracker.ietf.org/doc/html/rfc3174#section-7.3)

| Field | Value |
| --- | --- |
| `key` | `6d657373616765206469676573748000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000070` |
| `input` | `67452301efcdab8998badcfe10325476c3d2e1f0` |
| `expected` | `59dd2fcdeabe3d10b4a4c32bfa14cea65943c8f3` |

---

[← All algorithms](../README.md)
