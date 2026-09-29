# Keccak-384

> Original Keccak-384 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 384-bit digests.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Keccak Family |
| Variant | 384 |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2012 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/keccak.js`](../../../algorithms/hash/keccak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 48 bytes (384 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Keccak Team](https://keccak.team/)
- [Original Keccak](http://keccak.noekeon.org/)

## References

- [Crypto++ Keccak](https://github.com/weidai11/cryptopp/blob/master/keccak.cpp)
- [Keccak Test Vectors](http://keccak.noekeon.org/KeccakKAT-3.zip)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Keccak-384: Empty (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `2c23146a63a29acf99e73b88f8c24eaa 7dc60aa771780ccc006afbfa8fe2479b 2dd2b21362337441ac12b515911957ff` |

**Vector 2** — [Keccak-384: 'abc' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `f7df1165f033337be098e7d288ad6a2f 74409d7a60b49c36642218de161b1f99 f8c681e4afaf31a34db29fb763e3c28e` |

**Vector 3** — [Keccak-384: 'The quick brown fox...' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `283990fa9d5fb731d786c5bbee94ea4d b4910f18c62c03d173fc0a5e494422e8 a0b3da7574dae7fa0baf005e504063b3` |

**Vector 4** — [Keccak-384: Long message (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `b41e8896428f1bcbb51e17abd6acc980 52a3502e0d5bf7fa1af949b4d3c855e7 c4dc2c390326b3f3e74c7b1e2b9a3657` |

---

[← All algorithms](../README.md)
