# SATURNIN-CTR-Cascade

> Advanced AEAD cipher based on 256-bit block cipher with CTR-Cascade construction. NIST Lightweight Cryptography Round 2 candidate optimized for high security and performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Anne Canteaut, Sébastien Duval, Gaëtan Leurent, María Naya-Plasencia, Léo Perrin, Thomas Pornin, André Schrottenloher |
| Year | 2019 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/aead/saturnin.js`](../../../algorithms/aead/saturnin.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

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

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SATURNIN-CTR-Cascade KAT Count 1 (empty plaintext, empty AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-CTR-Cascade.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `ba6f18356b82c46910fe1738e72d99a43250269b8fe631ce0c1c6a38a5afc6cb` |

**Vector 2** — [SATURNIN-CTR-Cascade KAT Count 35 (1-byte plaintext, 1-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-CTR-Cascade.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `00` |
| `input` | `00` |
| `expected` | `73a4facf5ae96450e8bb1a98fe2492a1 acd92b322d60280d229463545d22b5ad cb` |

**Vector 3** — [SATURNIN-CTR-Cascade KAT Count 69 (2-byte plaintext, 2-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-CTR-Cascade.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `0001` |
| `input` | `0001` |
| `expected` | `73a3db8d008657a5844bcd7fb9f7ac58 05f83b1715754970a7004d9e481ea475 d4e9` |

**Vector 4** — [SATURNIN-CTR-Cascade KAT Count 1089 (32-byte plaintext, 32-byte AD)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SATURNIN-CTR-Cascade.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `73a3610620a34b523a47ea4eddff83ac 52370b3a1643965ace464be43f5033f5 e9e56ed79c0be6ed0b3a96fc6cf741e1 d5e5398f23f98d8208fba00f43ba6bc7` |

---

[← All algorithms](../README.md)
