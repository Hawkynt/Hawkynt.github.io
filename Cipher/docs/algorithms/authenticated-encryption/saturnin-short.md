# SATURNIN-Short

> Optimized AEAD cipher for short messages (≤15 bytes plaintext, no associated data). Single-block operation with 256-bit key and nonce, producing 256-bit ciphertext.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Anne Canteaut, Sébastien Duval, Gaëtan Leurent, María Naya-Plasencia, Léo Perrin, Thomas Pornin, André Schrottenloher |
| Year | 2019 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/aead/saturnin.js`](../../../algorithms/aead/saturnin.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |
| `supportsAAD` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official Specification](https://project.inria.fr/saturnin/)
- [NIST LWC Submission](https://csrc.nist.gov/Projects/lightweight-cryptography)

## References

- [rweather/lightweight-crypto C Reference Implementation](https://github.com/rweather/lightweight-crypto/blob/master/src/individual/Saturnin/saturnin.c)
- [Saturnin Project Site (reference package)](https://project.inria.fr/saturnin/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SATURNIN-Short KAT Count 1 (empty message)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-Short.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `ef142fc810ce92839726d600fccfd7119050da25a3ec5586c7c43ca668e3c8c0` |

**Vector 2** — [SATURNIN-Short KAT Count 13 (12-byte message)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-Short.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b` |
| `expected` | `20a7207939100227c9e3cab563ab1fe472a971711e12a5cad360b6757f8d8d14` |

**Vector 3** — [SATURNIN-Short KAT Count 16 (15-byte message, maximum length)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-Short.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e` |
| `expected` | `f8b7dbf80e519cf80e03a207a4798a5a0144f9392169faebf781bf4da9bdb0e4` |

---

[← All algorithms](../README.md)
