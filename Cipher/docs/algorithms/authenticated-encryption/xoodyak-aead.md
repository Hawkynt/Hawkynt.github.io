# Xoodyak AEAD

> NIST Lightweight Cryptography finalist using the Xoodoo permutation with Cyclist mode construction. Provides authenticated encryption with 128-bit keys and tags for resource-constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight Cryptography |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Joan Daemen, Seth Hoffert, Michaël Peeters, Gilles Van Assche, Ronny Van Keer |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/xoodyak.js`](../../../algorithms/aead/xoodyak.js) |

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

- [NIST LWC Finalist](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)
- [Xoodyak Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/xoodyak-spec-final.pdf)
- [Xoodoo Permutation](https://eprint.iacr.org/2018/767.pdf)

## References

- [XKCP (eXtended Keccak Code Package) — Official Xoodyak Reference](https://github.com/XKCP/XKCP)
- [rweather/lwc-finalists C Reference (embedded-optimized)](https://github.com/rweather/lwc-finalists)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Xoodyak AEAD: empty PT/AD (NIST LWC KAT #1)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `4bf0e393144cb58069fc1febcafcfb3c` |

**Vector 2** — [Xoodyak AEAD: empty PT, 1-byte AD (NIST LWC KAT #2)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `4d2a8d1716dfe3401f3bbe8acb637ab0` |

**Vector 3** — [Xoodyak AEAD: empty PT, 2-byte AD (NIST LWC KAT #3)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001` |
| `input` | _(empty)_ |
| `expected` | `4ebc154612159a949679453dc6cc52c6` |

**Vector 4** — [Xoodyak AEAD: 1-byte PT, empty AD (NIST LWC KAT #34)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `890788eac729d9539f401845b35a34d19f` |

**Vector 5** — [Xoodyak AEAD: 16-byte PT, 16-byte AD (NIST LWC KAT #545)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `d69753865422cbb82fabd13c4b5996417211fc2bc37b98c1bcc0964d39227c0e` |

**Vector 6** — [Xoodyak AEAD: 24-byte PT, empty AD (NIST LWC KAT #793)](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `expected` | `8929b40735cf316546c1256ff5e025f4 11d6dac6c606a0ea9a33cc81bee982e4 556fc1ce2c3ccf91` |

---

[← All algorithms](../README.md)
