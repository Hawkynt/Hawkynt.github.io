# MDC-2

> Modification Detection Code 2, an ISO/IEC 10118-2 standard hash function based on DES encryption. Produces 128-bit hashes using Davies-Meyer construction.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Function |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | Brachtl, Coppersmith, Hyden, Matyas, Meyer, Oseas, Pilpel, Schilling |
| Year | 1988 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/mdc2.js`](../../../algorithms/hash/mdc2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 16 bytes (128 bits) |

## Security

**Status:** ⚠️ Deprecated

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISO/IEC 10118-2:2010 Standard](https://www.iso.org/standard/44737.html)
- [OpenSSL MDC2 Documentation](https://www.openssl.org/docs/man1.1.1/man3/MDC2.html)
- [Research Paper on MDC-2](https://link.springer.com/chapter/10.1007/3-540-39118-5_24)

## References

- [MDC-2 in ISO Standards](https://www.iso.org/standard/44737.html)
- [OpenSSL Implementation](https://github.com/openssl/openssl/blob/master/crypto/mdc2/mdc2dgst.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [OpenSSL Test Vector - 'Now is the time for all ' (pad_type=2)](https://github.com/openssl/openssl/blob/master/test/mdc2test.c)

| Field | Value |
| --- | --- |
| `padType` | `2` |
| `input` | `4e6f77206973207468652074696d6520666f7220616c6c20` |
| `expected` | `2e4679b5add9ca7535d87afeab33bee2` |

**Vector 2** — [OpenSSL Test Vector - 'Now is the time for all ' (pad_type=1, default)](https://github.com/openssl/openssl/blob/master/test/mdc2test.c)

| Field | Value |
| --- | --- |
| `padType` | `1` |
| `input` | `4e6f77206973207468652074696d6520666f7220616c6c20` |
| `expected` | `42e50cd224baceba760bdd2bd409281a` |

---

[← All algorithms](../README.md)
