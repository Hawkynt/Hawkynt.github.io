# RaptorQ

> RaptorQ codes are standardized fountain codes defined in RFC 6330. They provide excellent error correction performance with minimal overhead and are used in commercial applications including 3GPP MBMS, HTTP Live Streaming, and 5G broadcast systems. Supports systematic encoding and optimal decoding complexity.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Fountain Codes |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | Michael Luby, Amin Shokrollahi, et al. |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/raptorq-codes.js`](../../../algorithms/ecc/raptorq-codes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 56403 bytes (451224 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |
| `isSystematic` | Yes |
| `isStandardized` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 6330 - RaptorQ Forward Error Correction](https://tools.ietf.org/rfc/rfc6330.txt)
- [RaptorQ Technical Specification](https://www.ietf.org/rfc/rfc6330.html)
- [3GPP MBMS Specification](https://www.3gpp.org/specifications)
- [Qualcomm RaptorQ Implementation](https://github.com/openrq-team/OpenRQ)

## References

- [libRaptorQ C++11 RFC 6330 Implementation](https://github.com/LucaFulchir/libRaptorQ)
- [go-raptorq RFC 6330 Implementation](https://github.com/harmony-one/go-raptorq)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RaptorQ RFC 6330 test vector - 5 symbols](https://tools.ietf.org/rfc/rfc6330.txt)

| Field | Value |
| --- | --- |
| `K` | `5` |
| `T` | `1` |
| `Al` | `4` |
| `WS` | `8` |
| `input` | `48656c6c6f` |
| `expected` | `48656c6c6f2d` |

**Vector 2** — [RaptorQ RFC 6330 test vector - 100 symbols](https://tools.ietf.org/rfc/rfc6330.txt)

| Field | Value |
| --- | --- |
| `K` | `100` |
| `T` | `1` |
| `Al` | `4` |
| `WS` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 60616263` |
| `expected` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 6061626300197b48341956100004` |

---

[← All algorithms](../README.md)
