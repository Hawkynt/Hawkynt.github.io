# REDOC III

> Enhanced version of IBM's REDOC II cipher with 128-bit blocks and 256-bit keys. Features improved security and stronger diffusion compared to REDOC II. Educational implementation only.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | IBM Research |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/redoc.js`](../../../algorithms/block/redoc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Educational Implementation](https://eprint.iacr.org/) | Simplified implementation may not capture full security properties of original design | Use only for educational purposes and cryptographic research |

## Documentation

- [IBM Cryptographic Research Publications](https://www.ibm.com/security/cryptography/)
- [Data-Dependent Cipher Design Papers](https://link.springer.com/conference/fse)
- [Advanced Cryptography Textbooks](https://www.springer.com/gp/computer-science/security-and-cryptology)

## References

- [CEX Cryptographic Library](https://github.com/Steppenwolfe65/CEX)
- [Academic Research on Experimental Ciphers](https://eprint.iacr.org/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — REDOC III Enhanced Test Vector

Source: Based on simplified implementation

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedc98765432101122334455667788990102030405060708` |
| `input` | `123456789abcdef01357bd24680ace02` |
| `expected` | `9f6d56c2affa6003aeaad32e147c2dd6` |

---

[← All algorithms](../README.md)
