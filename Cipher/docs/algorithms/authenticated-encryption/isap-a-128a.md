# ISAP-A-128A

> Side-channel resistant AEAD using Ascon permutation with 12/6/1 round configuration. Designed to protect against power analysis and timing attacks through limited permutation calls per key bit.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Stefan Mangard, Florian Mendel, Robert Primas |
| Year | 2017 |
| Origin | Not specified |
| Source | [`algorithms/aead/isap.js`](../../../algorithms/aead/isap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISAP v2.0 Specification](https://isap.isec.tugraz.at/)
- [NIST LWC Finalist](https://csrc.nist.gov/projects/lightweight-cryptography)
- [ISAP Paper (ToSC 2017)](https://tosc.iacr.org/index.php/ToSC/article/view/8625)
- [BouncyCastle Reference](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/ISAPEngine.java)

## References

- [ISAP Official Code Package (reference implementation)](https://github.com/isap-lwc/isap-code-package)
- [ISAP C++ Implementation (itzmeanjan)](https://github.com/itzmeanjan/isap)
- [NIST LWC Finalists Implementations (rweather)](https://github.com/rweather/lwc-finalists)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ISAP-A-128A: Empty PT, Empty AD (NIST LWC KAT Count=1)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `7b94ef35ae55ab272c9c44d6c1cf0102` |

**Vector 2** — [ISAP-A-128A: Empty PT, 1-byte AD (NIST LWC KAT Count=2)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `40fead6fdf1c2d6d6eae40deddff9f55` |

**Vector 3** — [ISAP-A-128A: Empty PT, 8-byte AD (NIST LWC KAT Count=9)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `7ae5f96bd1ae7f5b08fa85177750b6b3` |

**Vector 4** — [ISAP-A-128A: 1-byte PT, Empty AD (NIST LWC KAT Count=34)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `2cfacf138c6fdbbcc8763a7205fd66316d` |

**Vector 5** — [ISAP-A-128A: 8-byte PT, 8-byte AD (NIST LWC KAT)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001020304050607` |
| `input` | `0001020304050607` |
| `expected` | `2cde28dbbbd9131e4270dfff9b0c36c0824e86d98daed276` |

---

[← All algorithms](../README.md)
