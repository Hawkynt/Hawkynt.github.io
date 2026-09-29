# REDOC II

> IBM's experimental data-dependent cipher from the 1980s with 80-bit blocks and 160-bit keys. Uses data-dependent permutations, substitutions, and enclave operations with 10 rounds. Educational implementation only.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | IBM Research |
| Year | 1980 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/redoc.js`](../../../algorithms/block/redoc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 10 bytes (80 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Educational Implementation](https://eprint.iacr.org/) | Simplified implementation may not reflect full security of original design | Use only for educational purposes and cryptographic research |

## Documentation

- [IBM Cryptographic Research Documents](https://www.ibm.com/security/cryptography/)
- [Fast Software Encryption Proceedings](https://link.springer.com/conference/fse)

## References

- [Data-Dependent Cipher Design Research](https://eprint.iacr.org/)
- [IBM Internal Research Archives](https://researcher.watson.ibm.com/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — REDOC II Reference Test Vector

Source: Based on simplified implementation

| Field | Value |
| --- | --- |
| `key` | `724d3e0e5b71e9aa3898ffde1a9bd5f80c6d4e5f` |
| `input` | `41424344454647484950` |
| `expected` | `b925a9cfc61993fb7e70` |

---

[← All algorithms](../README.md)
