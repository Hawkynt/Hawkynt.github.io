# Elephant-Jumbo

> Elephant AEAD variant using Spongent-π[176] permutation with 90 rounds. NIST Lightweight Cryptography finalist offering higher security margin.

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

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST LWC KAT Vector #1 (empty PT, empty AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `1407ef22639e4ae1` |

**Vector 2** — [NIST LWC KAT Vector #2 (empty PT, 1-byte AD)](https://csrc.nist.gov/Projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b` |
| `associatedData` | `00` |
| `input` | _(empty)_ |
| `expected` | `ba8c57132b2035be` |

---

[← All algorithms](../README.md)
