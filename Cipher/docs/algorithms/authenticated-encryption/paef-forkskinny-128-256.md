# PAEF-ForkSkinny-128-256

> Parallel authenticated encryption with 128-bit blocks using ForkSkinny-128-256 tweakable block cipher. NIST Lightweight Cryptography finalist designed for efficient parallel processing.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Elena Andreeva, Virginie Lallemand, Antoon Purnal, Reza Reyhanitabar, Arnab Roy, Damian Vizar |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/forkae.js`](../../../algorithms/aead/forkae.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 14 bytes (112 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ForkAE Official Website](https://www.esat.kuleuven.be/cosic/forkae/)
- [NIST Lightweight Crypto](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [Reference C Implementation (rweather/lightweight-crypto)](https://github.com/rweather/lightweight-crypto)
- [ForkAE NIST LWC Round 2 Submission Package](https://csrc.nist.gov/Projects/lightweight-cryptography/round-2-candidates)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PAEF-ForkSkinny-128-256 Vector #1 (empty PT, empty AAD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `de1792af88e5988b82c8761f9edb783f` |

**Vector 2** — [PAEF-ForkSkinny-128-256 Vector #2 (empty PT, 1-byte AAD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d` |
| `aad` | `00` |
| `input` | _(empty)_ |
| `expected` | `9a6b44b77970fadfa42b056e12472c2c` |

**Vector 3** — [PAEF-ForkSkinny-128-256 Vector #34 (1-byte PT, empty AAD)](https://csrc.nist.gov/projects/lightweight-cryptography)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `000102030405060708090a0b0c0d` |
| `aad` | _(empty)_ |
| `input` | `00` |
| `expected` | `9f3aef46ff52fd2160cec9c6c21b59eb59` |

---

[← All algorithms](../README.md)
