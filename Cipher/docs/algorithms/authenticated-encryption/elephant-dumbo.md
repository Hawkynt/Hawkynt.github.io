# Elephant-Dumbo

> Elephant AEAD variant using Spongent-π[160] permutation with 80 rounds. NIST Lightweight Cryptography finalist designed for constrained environments.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Tim Beyne, Yu Long Chen, Christoph Dobraunig, Bart Mennink |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/elephant.js`](../../../algorithms/aead/elephant.js) |

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

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Elephant Official Site](https://www.esat.kuleuven.be/cosic/elephant/)
- [NIST LWC Finalist Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/elephant-spec-final.pdf)

## References

- [Rhys Weatherley Reference C Implementation](https://github.com/rweather/lightweight-crypto)
- [Elephant C++ Implementation (itzmeanjan)](https://github.com/itzmeanjan/elephant)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Vector #1 (empty PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `6655b717736adff3` |

**Vector 2** — [NIST LWC KAT Vector #2 (empty PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `b6925c1c8ca1058e` |

**Vector 3** — [NIST LWC KAT Vector #17 (empty PT, 16-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `19361bf080366f41` |

**Vector 4** — [NIST LWC KAT Vector #529 (16-byte PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0867290ad29d219c4bf3bf0bd652099ba0e7fce07c71c3eb` |

---

[← All algorithms](../README.md)
