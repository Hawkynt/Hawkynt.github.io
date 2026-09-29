# SHAKE128

> SHAKE128 is an extendable-output function (XOF) from NIST FIPS 202 with 128-bit security. Based on Keccak sponge construction with variable-length output capability.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | SHA-3 XOF |
| Variant | 128 |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2015 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/shake.js`](../../../algorithms/hash/shake.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

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

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SHAKE128 Empty String - 16 bytes output](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | _(empty)_ |
| `expected` | `7f9c2ba4e88f827d616045507605853e` |

**Vector 2** — [SHAKE128 'abc' - 16 bytes output](https://asecuritysite.com/hash/shake)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `616263` |
| `expected` | `5881092dd818bf5cf8a3ddb793fbcba7` |

**Vector 3** — [SHAKE128 'abc' - 32 bytes output](https://asecuritysite.com/hash/shake)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `616263` |
| `expected` | `5881092dd818bf5cf8a3ddb793fbcba74097d5c526a6d35f97b83351940f2cc8` |

---

[← All algorithms](../README.md)
