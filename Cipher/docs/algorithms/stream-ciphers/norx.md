# NORX

> Educational implementation of NORX authenticated encryption algorithm. CAESAR competition candidate designed for high performance on 64-bit platforms with AEAD capabilities.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Jean-Philippe Aumasson, Philipp Jovanovic, Samuel Neves |
| Year | 2014 |
| Origin | Not specified |
| Source | [`algorithms/stream/norx.js`](../../../algorithms/stream/norx.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Educational Implementation](https://github.com/norx/norx) | This is a simplified educational implementation | Use official reference implementation for any serious applications |

## Documentation

- [NORX Reference Implementation](https://github.com/norx/norx)
- [CAESAR Competition](https://competitions.cr.yp.to/caesar.html)
- [NORX Specification Paper](https://www.aumasson.jp/data/papers/AJN14.pdf)

## References

- [Official GitHub Repository](https://github.com/norx/norx)
- [NORX64-4-4 Reference](https://github.com/norx/norx/tree/master/norx6444)
- [Test Vectors](https://github.com/norx/norx/blob/master/norx6444/kat.h)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NORX Educational Test Vector 1 (Empty)](https://github.com/norx/norx)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [NORX Educational Test Vector 2 (Single Byte)](https://github.com/norx/norx)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00` |
| `expected` | `ed` |

**Vector 3** — [NORX Educational Test Vector 3 (Two Bytes)](https://github.com/norx/norx)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001` |
| `expected` | `ed8d` |

**Vector 4** — [NORX Educational Test Vector 4 (Block)](https://github.com/norx/norx)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ed8d2b96f14ee5531c78fe507f8ac3fe` |

---

[← All algorithms](../README.md)
