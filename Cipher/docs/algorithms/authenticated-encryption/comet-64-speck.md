# COMET-64-SPECK

> NIST Lightweight Cryptography candidate providing authenticated encryption with 64-bit blocks. Uses SPECK-64/128 ARX cipher in CTR-like mode with 64-bit authentication tag.

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
| Source | [`algorithms/aead/comet64-speck.js`](../../../algorithms/aead/comet64-speck.js) |

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
- [SPECK Specification](https://eprint.iacr.org/2013/404.pdf)

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
| `expected` | `d633b901593e5dfc` |

**Vector 2** — [NIST LWC KAT Count=2: Empty plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `9073a58ec98cd1c1` |

**Vector 3** — [NIST LWC KAT Count=3: Empty plaintext, 2-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `0001` |
| `input` | _(empty)_ |
| `expected` | `70c62ef9e8d20c2d` |

**Vector 4** — [NIST LWC KAT Count=9: Empty plaintext, 8-byte AD (full block)](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `0001020304050607` |
| `input` | _(empty)_ |
| `expected` | `67cab3fb65731afa` |

**Vector 5** — [NIST LWC KAT Count=17: Empty plaintext, 16-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `657684fb59323ae4` |

**Vector 6** — [NIST LWC KAT Count=34: 1-byte plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `ccfd543f711a9794eb` |

**Vector 7** — [NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `e8c1b687b7fdc8d826` |

**Vector 8** — [NIST LWC KAT Count=42: 1-byte plaintext, 8-byte AD (full block)](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `0001020304050607` |
| `input` | `00` |
| `expected` | `6dd3a86775755daaad` |

**Vector 9** — [NIST LWC KAT Count=10: Empty plaintext, 9-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `000102030405060708` |
| `input` | _(empty)_ |
| `expected` | `459d3a0efd66e5ba` |

**Vector 10** — [NIST LWC KAT Count=6: Empty plaintext, 5-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e` |
| `associatedData` | `0001020304` |
| `input` | _(empty)_ |
| `expected` | `eeb5cdf87a340dcb` |

---

[← All algorithms](../README.md)
