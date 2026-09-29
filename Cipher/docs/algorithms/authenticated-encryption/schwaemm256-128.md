# Schwaemm256-128

> NIST Lightweight Cryptography finalist using SPARKLE-384 permutation. Primary recommended variant with 256-bit nonce and 128-bit security.

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
- [NIST LWC Final Round](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)

## References

- [Official Sparkle Reference Implementation](https://github.com/cryptolu/sparkle)
- [rweather/lwc-finalists C Reference (embedded-optimized)](https://github.com/rweather/lwc-finalists)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1 (empty PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `9e3f9f2e8e26e7d00a9eb92730717a51` |

**Vector 2** — [NIST LWC KAT Count=2 (empty PT, 1-byte AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `57f83c3e696ae65582dd27fe6fc2f239` |

**Vector 3** — [NIST LWC KAT Count=17 (empty PT, 16-byte AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `07126e0ff608d8eb866a4b7e33bf7b21` |

**Vector 4** — [NIST LWC KAT Count=34 (1-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `9b6f7db3323c0b372a4584082e5ab4265c` |

**Vector 5** — [NIST LWC KAT Count=529 (16-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `9bac759db8d6d0c50ea19385a3456ba7bfae89698782544828f11895d2ee85e9` |

**Vector 6** — [NIST LWC KAT Count=1057 (32-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `9bac759db8d6d0c50ea19385a3456ba7 e061097ccb2683b3f4253c36569a3d15 a3a5e0afdfe60754eb50684fe945aa6a` |

---

[← All algorithms](../README.md)
