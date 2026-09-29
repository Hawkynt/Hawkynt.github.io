# Panama-BE

> Panama hash function with big-endian byte order. Belt-and-mill construction combining linear feedback shift register (belt) and nonlinear state machine (mill). Broken by collision attacks - use for legacy compatibility only.

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

**Vector 1** — [Panama-BE: Empty string (Crypto++ reference)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `e81aa04523532dd7267e5c5bc3ba0e289837a62ba032350351980e960a84b0af` |

**Vector 2** — [Panama-BE: 'The quick brown fox jumps over the lazy dog' (Crypto++ reference)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `8fa7dadce0110f979a0b795e76b2c25628d8bda88747758149c42e3bc13f85bc` |

**Vector 3** — [Panama-BE: Repeated 'a' pattern (15625 repetitions, Crypto++ generated)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/panama.txt)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 …` (1000000 bytes; the full value is in the source) |
| `expected` | `cb34f0937e8d870d3bd7ff6311765f2c229a6c2154e4db119538db5159437cab` |

---

[← All algorithms](../README.md)
