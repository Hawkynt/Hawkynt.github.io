# Keccak-256

> Original Keccak-256 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Widely used in blockchain applications like Ethereum.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Keccak Family |
| Variant | 256 |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2012 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/keccak.js`](../../../algorithms/hash/keccak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 32 bytes (256 bits) |

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

**Vector 1** — [Keccak-256: Empty (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` |

**Vector 2** — [Keccak-256: 'abc' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45` |

**Vector 3** — [Keccak-256: 'The quick brown fox...' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15` |

**Vector 4** — [Keccak-256: Long message (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `45d3b367a6904e6e8d502ee04999a7c27647f91fa845d456525fd352ae3d7371` |

---

[← All algorithms](../README.md)
