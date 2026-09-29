# KDF2

> KDF2 Key Derivation Function as defined in IEEE 1363 and ISO/IEC 18033-2. Iterative hash-based KDF using a counter to generate cryptographic keys from shared secrets using optional salt.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Counter-based KDF |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | IEEE 1363, ISO/IEC 18033 |
| Year | 2000 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/kdf2.js`](../../../algorithms/kdf/kdf2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 2147483647 bytes (17179869176 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Hash Function Strength | KDF2 security depends on the chosen hash function. SHA-1 is considered weak; use SHA-256 or stronger. | — |
| Counter Overflow | KDF2 uses 32-bit counter; output limited to 2^32 - 1 hash blocks (approx 16GB for SHA-1) | — |
| Salt Usage | Unlike HKDF, KDF2 treats salt as optional input rather than domain separation parameter | — |

## Documentation

- [IEEE 1363 - Standard Specifications for Public Key Cryptography](https://standards.ieee.org/ieee/1363/6171/)
- [ISO/IEC 18033-2 - Encryption Algorithms Part 2](https://www.iso.org/standard/69210.html)
- [Botan Library KDF2 Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/kdf2/kdf2.cpp)

## References

- [Botan KDF2 Reference Implementation](https://github.com/randombit/botan/tree/master/src/lib/kdf/kdf2)
- [Botan KDF2 Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KDF2(SHA-1) Test Vector 1 - 1 byte output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec)

| Field | Value |
| --- | --- |
| `salt` | `bf0b2ecd1724a348211d8c0ca7` |
| `outputSize` | `1` |
| `hashFunction` | SHA-1 |
| `input` | `fd7a43ea8a443c580c0de618ecc013704505eff8b5a4a9` |
| `expected` | `79` |

**Vector 2** — [KDF2(SHA-1) Test Vector 2 - 2 byte output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec)

| Field | Value |
| --- | --- |
| `salt` | `55a4e9dd5f4ca2ef82` |
| `outputSize` | `2` |
| `hashFunction` | SHA-1 |
| `input` | `701f3480dfe95f57941f804b1b2413ef` |
| `expected` | `fbec` |

**Vector 3** — [KDF2(SHA-1) BouncyCastle Test Vector - full block (no salt)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf2.vec)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `outputSize` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `ca7c0f8c3ffa87a96e1b74ac8e6af594347bb40a` |
| `expected` | `744ab703f5bc082e59185f6d049d2d367db245c2` |

---

[← All algorithms](../README.md)
