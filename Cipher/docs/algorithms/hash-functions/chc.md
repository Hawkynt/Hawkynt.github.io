# CHC

> Cipher Hash Construction builds a cryptographic hash from a block cipher using Matyas-Meyer-Oseas construction. Default implementation uses AES-128.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Construction |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Tom St Denis |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/chc.js`](../../../algorithms/hash/chc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [LibTomCrypt CHC Implementation](https://github.com/libtom/libtomcrypt/blob/develop/src/hashes/chc/chc.c)
- [Matyas-Meyer-Oseas Construction](https://en.wikipedia.org/wiki/One-way_compression_function#Matyas%E2%80%93Meyer%E2%80%93Oseas)
- [LibTomCrypt Documentation](https://github.com/libtom/libtomcrypt/blob/develop/doc/crypt.pdf)

## References

- [Hash Functions from Block Ciphers](https://www.iacr.org/archive/crypto2004/31520570/pq.pdf)
- [LibTomCrypt Source Repository](https://github.com/libtom/libtomcrypt)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LibTomCrypt Test Vector - 'hello world' with AES-128](https://github.com/libtom/libtomcrypt/blob/develop/src/hashes/chc/chc.c)

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f20776f726c64` |
| `expected` | `cf579dc30a0eea610d5447c43c06f54e` |

---

[← All algorithms](../README.md)
