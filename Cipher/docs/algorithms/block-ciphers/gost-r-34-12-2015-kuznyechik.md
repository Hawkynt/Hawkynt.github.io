# GOST R 34.12-2015 (Kuznyechik)

> Modern Russian Federal Standard GOST R 34.12-2015 (Kuznyechik). Substitution-permutation network with 128-bit blocks and 256-bit keys. Educational implementation of the cipher that replaced GOST 28147-89.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Russian cryptographers |
| Year | 2015 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/gost.js`](../../../algorithms/block/gost.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [GOST R 34.12-2015 Standard](https://www.tc26.ru/en/standard/gost/)
- [Kuznyechik Specification](https://tools.ietf.org/rfc/rfc7801.txt)
- [Wikipedia - Kuznyechik](https://en.wikipedia.org/wiki/Kuznyechik)

## References

- [RFC 7801 - GOST R 34.12-2015](https://tools.ietf.org/rfc/rfc7801.txt)
- [TC26 GOST Standards](https://www.tc26.ru/en/standard/gost/)
- [Cryptographic Research - Kuznyechik](https://eprint.iacr.org/2016/071.pdf)
- [NIST Post-Quantum Analysis](https://csrc.nist.gov/projects/post-quantum-cryptography)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GOST R 34.12-2015 (Kuznyechik) test vector from RFC 7801](https://tools.ietf.org/rfc/rfc7801.txt)

| Field | Value |
| --- | --- |
| `key` | `8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef` |
| `input` | `1122334455667700ffeeddccbbaa9988` |
| `expected` | `7f679d90bebc24305a468d42b9d4edcd` |

**Vector 2** — [GOST R 34.12-2015 (Kuznyechik) test vector 2 from RFC 7801](https://tools.ietf.org/rfc/rfc7801.txt)

| Field | Value |
| --- | --- |
| `key` | `8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef` |
| `input` | `00112233445566778899aabbcceeff0a` |
| `expected` | `b429912c6e0032f9285452d76718d08b` |

---

[← All algorithms](../README.md)
