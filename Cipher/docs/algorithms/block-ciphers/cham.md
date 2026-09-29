# CHAM

> Korean lightweight block cipher designed for resource-constrained devices. CHAM-128/128 uses 128-bit blocks with 128-bit keys and 112 rounds with ARX operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Koo, Roh, Kim, Jung, Lee, and Kwon |
| Year | 2017 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/cham.js`](../../../algorithms/block/cham.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CHAM: A Family of Lightweight Block Ciphers](https://link.springer.com/chapter/10.1007/978-3-319-78556-1_1)
- [ICISC 2017 Paper](https://eprint.iacr.org/2017/1032.pdf)

## References

- [Original CHAM Specification](https://eprint.iacr.org/2017/1032.pdf)
- [Lightweight Cryptography Research](https://csrc.nist.gov/projects/lightweight-cryptography)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CHAM-128/128 (Paper Vector)](https://eprint.iacr.org/2017/1032.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `346074c3c50057b532ec648df7329348` |

---

[← All algorithms](../README.md)
