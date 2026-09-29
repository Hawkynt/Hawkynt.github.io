# DES

> Data Encryption Standard, the first widely adopted symmetric encryption algorithm. 64-bit blocks with 56-bit keys. Broken by brute force attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | IBM |
| Year | 1975 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/des.js`](../../../algorithms/block/des.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [FIPS 46-3 Specification](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)
- [NIST SP 800-67 Rev 2](https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final)
- [RFC 4772 - Security Implications](https://tools.ietf.org/rfc/rfc4772.txt)

## References

- [ANSI X3.92-1981 Standard](https://webstore.ansi.org/standards/incits/ansix3921981r1999)
- [DES Challenge Results](https://en.wikipedia.org/wiki/DES_Challenges)
- [NIST CAVP Test Vectors](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FIPS 46-3 Weak Key Test Vector #1](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)

| Field | Value |
| --- | --- |
| `key` | `0101010101010101` |
| `input` | `8000000000000000` |
| `expected` | `95f8a5e5dd31d900` |

**Vector 2** — [FIPS 46-3 Weak Key Test Vector #2](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)

| Field | Value |
| --- | --- |
| `key` | `0101010101010101` |
| `input` | `4000000000000000` |
| `expected` | `dd7f121ca5015619` |

**Vector 3** — [FIPS 46-3 Single Bit Key Test](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)

| Field | Value |
| --- | --- |
| `key` | `8001010101010101` |
| `input` | `0000000000000000` |
| `expected` | `95a8d72813daa94d` |

**Vector 4** — [DES Standard Test Pattern - Handbook of Applied Cryptography](https://crypto.stackexchange.com/questions/65996/64-des-full-example-with-all-the-stages)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef` |
| `input` | `4e6f772069732074` |
| `expected` | `3fa40e8a984d4815` |

**Vector 5** — [DES Educational Test Vector](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)

| Field | Value |
| --- | --- |
| `key` | `133457799bbcdff1` |
| `input` | `0123456789abcdef` |
| `expected` | `85e813540f0ab405` |

---

[← All algorithms](../README.md)
