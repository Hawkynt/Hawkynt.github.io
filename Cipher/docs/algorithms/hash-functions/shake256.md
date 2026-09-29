# SHAKE256

> SHAKE256 is an extendable-output function (XOF) from NIST FIPS 202 with 256-bit security. Can produce variable-length output, making it suitable for applications requiring arbitrary hash lengths.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | SHA-3 XOF |
| Variant | 256 |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2015 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/shake.js`](../../../algorithms/hash/shake.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST FIPS 202](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)
- [Keccak Team](https://keccak.team/)

## References

- [Crypto++ SHAKE](https://github.com/weidai11/cryptopp/blob/master/sha3.cpp)
- [NIST Test Vectors](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SHAKE256: Empty, 64 bytes (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | _(empty)_ |
| `expected` | `46b9dd2b0ba88d13233b3feb743eeb24 3fcd52ea62b81b82b50c27646ed5762f d75dc4ddd8c0f200cb05019d67b592f6 fc821c49479ab48640292eacb3b7c4be` |

**Vector 2** — [SHAKE256: Single byte, 64 bytes (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `af` |
| `expected` | `b7cbfeda173533a5fb72340c9af14b82 545bc9fa02828da3b6773094289fb8fe 75cff7d0bdfb6015f3068907a1ba2461 1631d1dbe4eadf8d95a9f6b6021231b7` |

**Vector 3** — [SHAKE256: Two bytes, 64 bytes (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `4fd6` |
| `expected` | `426d6fcdfb2387a470c4b55b999315c6 9c9cbbcac337b98d5f5cb38accfe99e2 b195432bb464b2e857ff20db2a10563b f93fb518e6f246397c1c86ce19a7c1c1` |

**Vector 4** — [SHAKE256: Four bytes, 64 bytes (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/shake.txt)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `fae3e468` |
| `expected` | `5b3f24082085a8e223cdfdc2d644f559 befef6ef22288d87717cc7af1a9fcb18 dfde7ad7e38838015894f7acc98e420d b10ded4e85837b1b19cfe0007dc3fc4a` |

---

[← All algorithms](../README.md)
