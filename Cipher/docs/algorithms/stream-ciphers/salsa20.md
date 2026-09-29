# Salsa20

> ARX-based stream cipher designed for high performance and security using Addition, Rotation, and XOR operations. Part of eSTREAM portfolio with no S-boxes or lookup tables required.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Daniel J. Bernstein |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/salsa20.js`](../../../algorithms/stream/salsa20.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 16 bytes |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Salsa20 Specification](https://cr.yp.to/snuffle/spec.pdf)
- [RFC 7914](https://tools.ietf.org/html/rfc7914)
- [eSTREAM Portfolio](https://www.ecrypt.eu.org/stream/)

## References

- [Official Reference Implementation (D.J. Bernstein, public domain)](https://cr.yp.to/snuffle/salsa20/ref/salsa20.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [eSTREAM Salsa20 Set 1, Vector 0 (128-bit key)](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `nonce` | `0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `4dfa5e481da23ea09a31022050859936` |

**Vector 2** — [eSTREAM Salsa20 Set 6, Vector 0 (256-bit key)](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/salsa20/)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e3be8fdd8beca2e3ea8ef9475b29a6e7` |

---

[← All algorithms](../README.md)
