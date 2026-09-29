# Panama-LE

> Panama hash function with little-endian byte order. Belt-and-mill construction combining linear feedback shift register (belt) and nonlinear state machine (mill). Broken by collision attacks - use for legacy compatibility only.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Belt-and-Mill |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Joan Daemen, Craig Clapp |
| Year | 1998 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/panama.js`](../../../algorithms/hash/panama.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 32 bytes (256 bits) |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [Panama Specification (FSE'98)](http://www.weidai.com/scan-mirror/md.html#Panama)
- [Original Paper (FSE'98)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/panama.zip)
- [NESSIE Portfolio](https://www.cosic.esat.kuleuven.be/nessie/)

## References

- [Crypto++ Implementation](https://github.com/weidai11/cryptopp/blob/master/panama.cpp)
- [Crypto++ Test Vectors](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Panama-LE: Empty string (Crypto++ reference)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `aa0cc954d757d7ac7779ca3342334ca471abd47d5952ac91ed837ecd5b16922b` |

**Vector 2** — [Panama-LE: 'The quick brown fox jumps over the lazy dog' (Crypto++ reference)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `5f5ca355b90ac622b0aa7e654ef5f27e9e75111415b48b8afe3add1c6b89cba1` |

**Vector 3** — [Panama-LE: Repeated 'a' pattern (15625 repetitions, Crypto++ generated)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 …` (1000000 bytes; the full value is in the source) |
| `expected` | `af9c66fb6058e2232a5dfba063ee14b0f86f0e334e165812559435464dd9bb60` |

---

[← All algorithms](../README.md)
