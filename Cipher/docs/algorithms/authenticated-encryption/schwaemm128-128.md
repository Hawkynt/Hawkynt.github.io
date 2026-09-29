# Schwaemm128-128

> NIST Lightweight Cryptography finalist using SPARKLE-256 permutation. Compact variant with 128-bit security level for both confidentiality and authentication.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/sparkle.js`](../../../algorithms/aead/sparkle.js) |

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

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Sparkle Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf)
- [Sparkle Project Website](https://sparkle-lwc.github.io/)

## References

- [Official Sparkle Reference Implementation](https://github.com/cryptolu/sparkle)
- [rweather/lwc-finalists C Reference (embedded-optimized)](https://github.com/rweather/lwc-finalists)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1 (empty PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `ddce77cdb748e6d053cab7e9190a8349` |

**Vector 2** — [NIST LWC KAT Count=2 (empty PT, 1-byte AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `d2a4133e82b64f800b6dab2403fb094d` |

**Vector 3** — [NIST LWC KAT Count=17 (empty PT, 16-byte AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `8b7aee52d40c7e0edf9cb56ffae5d882` |

**Vector 4** — [NIST LWC KAT Count=34 (1-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `fe2647aa4fb548acf44067bec0337b4d25` |

**Vector 5** — [NIST LWC KAT Count=529 (16-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `fedad36d1a592aeb931ba52ba4056865f5544dd3488406f6aadf8edaae271727` |

**Vector 6** — [NIST LWC KAT Count=1057 (32-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `fedad36d1a592aeb931ba52ba4056865 b4f5faff255ab36e0bcc7e4086a87aba d8bd1eebd6ccf00c9ea721db29727a03` |

---

[← All algorithms](../README.md)
