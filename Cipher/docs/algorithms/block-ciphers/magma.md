# Magma

> Russian Federal block cipher standard GOST R 34.12-2015 with 64-bit blocks and 256-bit keys. Updated version of GOST 28147-89 using a 32-round Feistel network. Standardized in RFC 8891.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Russian Federal Security Service |
| Year | 2015 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/magma.js`](../../../algorithms/block/magma.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 8891 - GOST R 34.12-2015 Magma Specification](https://datatracker.ietf.org/doc/html/rfc8891)
- [GOST R 34.12-2015 Standard](https://tc26.ru/en/standards/)
- [Wikipedia - GOST (block cipher)](https://en.wikipedia.org/wiki/GOST_(block_cipher))

## References

- [gost-engine Reference Implementation (gost89.c)](https://github.com/gost-engine/engine/blob/master/gost89.c)
- [Botan GOST-28147-89 (Magma) Implementation](https://github.com/randombit/botan/blob/master/src/lib/block/gost_28147/gost_28147.cpp)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 8891 Section 5.1 - Encryption Test Vector](https://datatracker.ietf.org/doc/html/rfc8891#section-5.1)

| Field | Value |
| --- | --- |
| `key` | `ffeeddccbbaa99887766554433221100f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `fedcba9876543210` |
| `expected` | `4ee901e5c2d8ca3d` |

**Vector 2** — [RFC 8891 Section 5.2 - Decryption Test Vector](https://datatracker.ietf.org/doc/html/rfc8891#section-5.2)

| Field | Value |
| --- | --- |
| `key` | `ffeeddccbbaa99887766554433221100f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `inverse` | Yes |
| `input` | `4ee901e5c2d8ca3d` |
| `expected` | `fedcba9876543210` |

---

[← All algorithms](../README.md)
