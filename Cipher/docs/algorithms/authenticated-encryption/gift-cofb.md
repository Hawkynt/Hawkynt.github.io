# GIFT-COFB

> NIST Lightweight Cryptography finalist combining GIFT-128 block cipher with COFB authenticated encryption mode. Provides efficient authenticated encryption for resource-constrained devices.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Subhadeep Banik, Avik Chakraborti, Tetsu Iwata, Kazuhiko Minematsu, Mridul Nandi, Thomas Peyrin, Yu Sasaki, Siang Meng Sim, Yosuke Todo |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/gift-cofb.js`](../../../algorithms/aead/gift-cofb.js) |

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

- [GIFT-COFB Official Site](https://www.isical.ac.in/~lightweight/COFB/)
- [NIST LWC Finalist](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [GIFT-COFB Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/gift-cofb-spec-final.pdf)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [GIFT-COFB Optimized Implementation (Adomnicai, co-designer)](https://github.com/aadomn/gift)
- [Official GIFT Reference Implementation](https://github.com/giftcipher/gift)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count 1 (empty PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `368965836d36614de2fc24d0f801b9af` |

**Vector 2** — [NIST LWC KAT Count 2 (empty PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `ae5dcdd1285d5177fe251deb99d727dc` |

**Vector 3** — [NIST LWC KAT Count 17 (empty PT, 16-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `709657d81ddc509aa20dc66f18ff9907` |

**Vector 4** — [NIST LWC KAT Count 34 (1-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `5df96db329e92688242ef4e06f94fe1bd9` |

**Vector 5** — [NIST LWC KAT Count 529 (16-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `5d595fc00a309301719b30ad9e6d720fede74d8c9d1332ada0413fc514e14918` |

**Vector 6** — [NIST LWC KAT Count 545 (16-byte PT, 16-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `3bff715a56cba49d1f7ac0691a966fdcbf77814044bf3fc9a9debbd393f545d4` |

**Vector 7** — [NIST LWC KAT Count 1057 (32-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `5d595fc00a309301719b30ad9e6d720f 6f6f4759a224a9688eb4c75686a1b801 660053cfdc1cc57345fd8e411feb6e52` |

---

[← All algorithms](../README.md)
