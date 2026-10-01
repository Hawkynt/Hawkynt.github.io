# SEAL-3.0-LE

> Software-optimized stream cipher designed by Rogaway and Coppersmith using SHA-1-based table generation. Generates 1024 bytes of keystream per iteration. Little-endian variant. Broken - theoretical attacks exist.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Phil Rogaway, Don Coppersmith |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/seal.js`](../../../algorithms/stream/seal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| IV sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `isBigEndian` | No |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Theoretical Attack | SEAL has known theoretical weaknesses and is considered broken for modern cryptographic applications. | Use modern stream ciphers like ChaCha20 or XSalsa20 for new systems. |

## Documentation

- [SEAL Specification (FSE'94)](https://web.cs.ucdavis.edu/~rogaway/papers/seal.pdf)
- [Crypto++ SEAL Implementation](https://github.com/weidai11/cryptopp/blob/master/seal.cpp)

## References

- [Crypto++ seal.cpp (reference SEAL 3.0 implementation)](https://github.com/weidai11/cryptopp/blob/master/seal.cpp)
- [Crypto++ seal.h (SEAL 3.0 class definitions)](https://github.com/weidai11/cryptopp/blob/master/seal.h)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Derived from Crypto++ SEAL-3.0-BE Test Vector via 32-bit word byte-order transform (LE variant shares identical internal computation)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/seal.txt)

| Field | Value |
| --- | --- |
| `key` | `67452301efcdab8998badcfe10325476c3d2e1f0` |
| `iv` | `013577af` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1024 bytes; the full value is in the source) |
| `expected` | `9505a0379cc4849b051ebea40f537306 fd97b05fbd3fa1f6cdde2c6c7ceefd81 e7c3bd2aff9a20648322a100855067ef 534b63c1e6599028d95eaba7eb010c48 …` (1024 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
