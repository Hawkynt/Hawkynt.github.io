# Schwaemm256-256

> NIST Lightweight Cryptography finalist using SPARKLE-512 permutation. Maximum security variant with 256-bit security level for key, nonce, and tag.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/aead/sparkle.js`](../../../algorithms/aead/sparkle.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Tag sizes | 32 bytes (256 bits) |

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

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Count=1 (empty PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `1e41c39049501061a480341dc8551f3cce171900eb8f90ba5c54b2a7cc2bfdf2` |

**Vector 2** — [NIST LWC KAT Count=2 (empty PT, 1-byte AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `6af0f211bc7ff4186eea03d37025f294036be6e90970713e5b5a630fff07dcbe` |

**Vector 3** — [NIST LWC KAT Count=34 (1-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | `00` |
| `expected` | `bbe3ced9ab9967846e9f39911beba2ff c4585c560043e4381e5fdaf8789265d7 91` |

**Vector 4** — [NIST LWC KAT Count=1057 (32-byte PT, empty AD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `bb5918195dc5d4d944594a7b63d64601 40be022efb65d13c16fb50a48f224b69 7e6b81dca1366d43ee20b152ad39cefc b6103d3ec26a1dc5277b117ada1ed1bb` |

---

[← All algorithms](../README.md)
