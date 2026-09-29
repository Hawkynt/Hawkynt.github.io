# Grain-128-AEAD

> NIST Lightweight Cryptography finalist combining 128-bit LFSR and NFSR with integrated authentication. Designed for resource-constrained environments with hardware-friendly shift register operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Martin Hell, Thomas Johansson, Willi Meier, Jonathan Sönnerup, Hirotaka Yoshida |
| Year | 2019 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/aead/grain128aead.js`](../../../algorithms/aead/grain128aead.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [Grain-128-AEAD Official Site](https://grain-128aead.github.io/)
- [NIST LWC Round 3 Submission](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [Grain-128-AEAD Specification](https://grain-128aead.github.io/grain-aead-v2.pdf)

## References

- [Official C Reference Implementation](https://github.com/Grain-128AEAD/Grain-128AEAD-sw-ref)
- [Official VHDL Hardware Implementation](https://github.com/Grain-128AEAD/Grain-128AEAD-VHDL)
- [Bouncy Castle Grain128AEAD Engine (this implementation follows it)](https://github.com/bcgit/bc-java)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle Test Vector #1 (32-byte PT, 31-byte AD)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `ead60ef559493acef6a3c238c018835d e3abb6aa621a9aa65efaf7b9d05bbe6c 0913dfc8674bacc9` |

**Vector 2** — [BouncyCastle Long AEAD Test (32-byte PT, 186-byte AD)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `731daa8b1d15317a1ccb4e3dd320095f b27e5bb2a10f2c669f870538637d4f16 2298c70430a2b560` |

**Vector 3** — [BouncyCastle Empty PT Test (empty PT, empty AD)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `d51fd5d16177b434` |

**Vector 4** — [BouncyCastle Empty PT with AD (empty PT, 1-byte AD)](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `99b7cdbf488f8dc0` |

**Vector 5** — [BouncyCastle Empty PT with 16-byte AD](https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/Grain128AEADTest.java)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `5e3b1d462a7ad158` |

---

[← All algorithms](../README.md)
