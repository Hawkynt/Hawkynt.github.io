# PMAC

> Parallelizable Message Authentication Code using AES-128. Provides provably secure message authentication with parallel processing capability.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Block Cipher MAC |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Phillip Rogaway |
| Year | 2002 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/pmac.js`](../../../algorithms/mac/pmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [PMAC: Parallelizable Message Authentication Code](https://web.cs.ucdavis.edu/~rogaway/papers/pmac.pdf)
- [LibTomCrypt PMAC Implementation](https://github.com/libtom/libtomcrypt)

## References

- [LibTomCrypt PMAC Source](https://github.com/libtom/libtomcrypt/tree/develop/src/mac/pmac)
- [PMAC Security Proof](https://eprint.iacr.org/2002/039)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LibTomCrypt PMAC-AES-128-0B (Empty)](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | `4399572cd6ea5341b8d35876a7098af7` |

**Vector 2** — [LibTomCrypt PMAC-AES-128-3B](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102` |
| `expected` | `256ba5193c1b991b4df0c51f388a9e27` |

**Vector 3** — [LibTomCrypt PMAC-AES-128-16B](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ebbd822fa458daf6dfdad7c27da76338` |

**Vector 4** — [LibTomCrypt PMAC-AES-128-20B](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `0412ca150bbf79058d8c75a58c993f55` |

**Vector 5** — [LibTomCrypt PMAC-AES-128-32B](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `e97ac04e9e5e3399ce5355cd7407bc75` |

**Vector 6** — [LibTomCrypt PMAC-AES-128-34B](https://github.com/libtom/libtomcrypt/blob/develop/src/mac/pmac/pmac_test.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021` |
| `expected` | `5cba7d5eb24f7c86ccc54604e53d5512` |

---

[← All algorithms](../README.md)
