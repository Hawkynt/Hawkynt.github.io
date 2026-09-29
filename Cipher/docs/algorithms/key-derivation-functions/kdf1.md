# KDF1

> KDF1 Key Derivation Function from IEEE 1363. Single-hash KDF limited to one hash block output, used primarily for compatibility with legacy systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Basic KDF |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | IEEE 1363 Working Group |
| Year | 2000 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/kdf1.js`](../../../algorithms/kdf/kdf1.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits); 64 bytes (512 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Hash Block Limitation | KDF1 (IEEE 1363) limited to single hash output - maximum 20 bytes for SHA-1, 32 for SHA-256, 64 for SHA-512 | — |
| Legacy Algorithm | KDF1 provided for compatibility only. Use KDF2, HKDF, or KDF1-ISO-18033 for new systems | — |
| Hash Function Strength | Security depends on hash function choice. SHA-1 is considered weak; use SHA-256 or stronger | — |

## Documentation

- [IEEE 1363 - Standard Specifications for Public Key Cryptography](https://standards.ieee.org/ieee/1363/6171/)
- [Botan Library KDF1 Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/kdf1/kdf1.cpp)

## References

- [Botan KDF1 Reference Implementation](https://github.com/randombit/botan/tree/master/src/lib/kdf/kdf1)
- [Botan KDF1 Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KDF1(SHA-1) Test Vector 1 - Full hash output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `outputSize` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `61736f67696a6f7367696a736f69676a 736f6964676a6f696a6f736467696a73 6f6964676a736f6964676a736f696a` |
| `expected` | `a0d760447f105ce64db99ff2fc92f961f24e7d9c` |

**Vector 2** — [KDF1(SHA-1) Test Vector 2 - Truncated output (10 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `outputSize` | `10` |
| `hashFunction` | SHA-1 |
| `input` | `61736f67696a6f7367696a736f69676a 736f6964676a6f696a6f736467696a73 6f6964676a736f6964676a736f696a` |
| `expected` | `a0d760447f105ce64db9` |

**Vector 3** — [KDF1(SHA-1) Test Vector 3 - With salt (full output)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

| Field | Value |
| --- | --- |
| `salt` | `6f6964676a736f6964676a736f696a` |
| `outputSize` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `61736f67696a6f7367696a736f69676a736f6964676a6f696a6f736467696a73` |
| `expected` | `a0d760447f105ce64db99ff2fc92f961f24e7d9c` |

**Vector 4** — [KDF1(SHA-1) Test Vector 4 - With salt (full output, different split)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

| Field | Value |
| --- | --- |
| `salt` | `736f6964676a736f6964676a736f696a` |
| `outputSize` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `61736f67696a6f7367696a736f69676a736f6964676a6f696a6f736467696a` |
| `expected` | `a0d760447f105ce64db99ff2fc92f961f24e7d9c` |

**Vector 5** — [KDF1(SHA-1) Test Vector 5 - Full hash output with newline](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `outputSize` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `617361736f67696a6f7367696a736f69 676a736f6964676a6f696a6f73646769 6a736f6964676a736f6964676a736f69 6a0a` |
| `expected` | `dbfefa0ea12d352c4ae5b0af17d061e0e2c469a8` |

**Vector 6** — [KDF1(SHA-1) Test Vector 6 - With salt and newline](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/kdf1.vec)

| Field | Value |
| --- | --- |
| `salt` | `6a736f6964676a736f6964676a736f696a0a` |
| `outputSize` | `20` |
| `hashFunction` | SHA-1 |
| `input` | `617361736f67696a6f7367696a736f69676a736f6964676a6f696a6f73646769` |
| `expected` | `dbfefa0ea12d352c4ae5b0af17d061e0e2c469a8` |

---

[← All algorithms](../README.md)
