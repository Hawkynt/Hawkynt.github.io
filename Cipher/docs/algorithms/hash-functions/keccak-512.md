# Keccak-512

> Original Keccak-512 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 512-bit digests.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Keccak Family |
| Variant | 512 |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2012 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/keccak.js`](../../../algorithms/hash/keccak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 64 bytes (512 bits) |

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

**Vector 1** — [Keccak-512: Empty (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0eab42de4c3ceb9235fc91acffe746b2 9c29a8c366b7c60e4e67c466f36a4304 c00fa9caf9d87976ba469bcbe06713b4 35f091ef2769fb160cdab33d3670680e` |

**Vector 2** — [Keccak-512: 'abc' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `18587dc2ea106b9a1563e32b3312421c a164c7f1f07bc922a9c83d77cea3a1e5 d0c69910739025372dc14ac964262937 9540c17e2a65b19d77aa511a9d00bb96` |

**Vector 3** — [Keccak-512: 'The quick brown fox...' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `d135bb84d0439dbac432247ee573a23e a7d3c9deb2a968eb31d47c4fb45f1ef4 422d6c531b5b9bd6f449ebcc449ea94d 0a8f05f62130fda612da53c79659f609` |

**Vector 4** — [Keccak-512: Long message (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `6aa6d3669597df6d5a007b00d09c2079 5b5c4218234e1698a944757a488ecdc0 9965435d97ca32c3cfed7201ff30e070 cd947f1fc12b9d9214c467d342bcba5d` |

---

[← All algorithms](../README.md)
