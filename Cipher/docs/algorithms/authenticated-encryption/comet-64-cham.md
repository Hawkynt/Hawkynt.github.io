# COMET-64-CHAM

> NIST Lightweight Cryptography candidate providing authenticated encryption with 64-bit blocks. Uses CHAM-64/128 block cipher in CTR-like mode with 64-bit authentication tag.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Lightweight AEAD |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Donghoon Chang, Mohona Ghosh, Kishan Chand Gupta, Arpan Jati, Abhishek Kumar, Dukjae Moon, Indranil Ray, Somitra Kumar Sanadhya |
| Year | 2019 |
| Origin | 🇮🇳 India |
| Source | [`algorithms/aead/comet64-cham.js`](../../../algorithms/aead/comet64-cham.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 15 bytes (120 bits) |
| Tag sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official COMET Website](https://www.isical.ac.in/~lightweight/comet/)
- [NIST LWC Finalist Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/comet-spec-final.pdf)
- [NIST LWC Project Page](https://csrc.nist.gov/projects/lightweight-cryptography)
- [GitHub Reference Implementation](https://github.com/rweather/lightweight-crypto)

## References

- [NIST LWC Round 2 Submission Package (Reference C)](https://csrc.nist.gov/projects/lightweight-cryptography/round-2-candidates)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1: Empty plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `e1123a4a8615d94a` |

**Vector 2** — [NIST LWC KAT Count=2: Empty plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `9155fd4256f9fd88` |

**Vector 3** — [NIST LWC KAT Count=3: Empty plaintext, 2-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `0001` |
| `input` | _(empty)_ |
| `expected` | `cf999e648f2d3a81` |

**Vector 4** — [NIST LWC KAT Count=9: Empty plaintext, 8-byte AD (full block)](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `912f24ea7c82e9e4` |

**Vector 5** — [NIST LWC KAT Count=17: Empty plaintext, 16-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `4b6fcf412cacf2fe` |

**Vector 6** — [NIST LWC KAT Count=34: 1-byte plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `8b55b6a35ea7f8ea01` |

**Vector 7** — [NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `5087ec65cc665179ac` |

**Vector 8** — [NIST LWC KAT Count=67: 2-byte plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | _(empty)_ |
| `input` | `0001` |
| `expected` | `8bc349e9c18dd8eb5dc7` |

**Vector 9** — [NIST LWC KAT Count=68: 2-byte plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `00` |
| `input` | `0001` |
| `expected` | `503556a8e9ef057d37a0` |

**Vector 10** — [NIST LWC KAT Count=100: 3-byte plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | _(empty)_ |
| `input` | `000102` |
| `expected` | `8bc3311fb743e202f0e7b8` |

---

[← All algorithms](../README.md)
