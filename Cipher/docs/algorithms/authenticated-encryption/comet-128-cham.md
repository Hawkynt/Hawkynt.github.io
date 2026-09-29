# COMET-128-CHAM

> NIST Lightweight Cryptography candidate providing authenticated encryption with 128-bit security. Uses CHAM-128/128 block cipher in CTR-like mode with authentication tag.

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
| Source | [`algorithms/aead/comet-cham.js`](../../../algorithms/aead/comet-cham.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

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

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1: Empty plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `04744f36aab6d5f430d7b70b65c82c24` |

**Vector 2** — [NIST LWC KAT Count=2: Empty plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `67e521a56812eba8916faeed6ef568fc` |

**Vector 3** — [NIST LWC KAT Count=17: Empty plaintext, 16-byte AD (full block)](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `d2eb1621d6416296b8d957b4230a3646` |

**Vector 4** — [NIST LWC KAT Count=34: 1-byte plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `da1a04685f162bc5e548aa0bf007fd1786` |

**Vector 5** — [NIST LWC KAT Count=35: 1-byte plaintext, 1-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | `00` |
| `expected` | `16bf66003098f5f7d920b9a7d5c63ef814` |

**Vector 6** — [NIST LWC KAT Count=67: 2-byte plaintext, empty AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `0001` |
| `expected` | `da8e240846e93bdb066e02b53bd0fe8dc9c5` |

**Vector 7** — [NIST LWC KAT Count=69: 2-byte plaintext, 2-byte AD](https://csrc.nist.gov/projects/lightweight-cryptography/finalists)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `0001` |
| `input` | `0001` |
| `expected` | `19cb6a66f38fdf38c485cdea719e1367ac14` |

---

[← All algorithms](../README.md)
