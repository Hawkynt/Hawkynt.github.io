# Pelican

> Pelican MAC is an AES-based message authentication code using a 4-round compression function. Provides 128-bit authentication tags with 128-bit keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Daemen, Rijmen |
| Year | 2005 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/mac/pelican.js`](../../../algorithms/mac/pelican.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Pelican Specification](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/pelican.pdf)

## References

- [LibTomCrypt Pelican](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican.c)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Pelican: Empty message (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `eb583715f834dee5a4d16ee4b9d7760e` |

**Vector 2** — [Pelican: 3-byte message (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102` |
| `expected` | `1c9740606c58172d0394197081c43854` |

**Vector 3** — [Pelican: 16-byte message (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `03cc46b8aca79c361e8c6ea67b893249` |

**Vector 4** — [Pelican: 32-byte message (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `89cc36581bdd4db578bbacf0ff8b0815` |

**Vector 5** — [Pelican: 35-byte message (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pelican/pelican_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202123` |
| `expected` | `4a7d454dcdb5da8d487816485d459599` |

---

[← All algorithms](../README.md)
