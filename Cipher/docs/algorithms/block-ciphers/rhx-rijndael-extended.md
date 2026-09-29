# RHX (Rijndael Extended)

> Professional extended Rijndael/AES with 256/512/1024-bit keys from CEX Cryptographic Library. Enhanced security margins with increased rounds (22/30/38) and HKDF-based key expansion.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Extended Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | John Underhill (CEX) |
| Year | 2018 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/block/rhx.js`](../../../algorithms/block/rhx.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits); 64 bytes (512 bits); 128 bytes (1024 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Extended Cipher Analysis | Extended versions of standard ciphers may have different security properties | Use only for educational purposes and research into extended cipher designs |

## Documentation

- [CEX Cryptographic Library Documentation](https://github.com/Steppenwolfe65/CEX/blob/master/Docs/CEX.pdf)
- [FIPS 197 - Advanced Encryption Standard (AES)](https://csrc.nist.gov/publications/detail/fips/197/final)
- [RFC 5869 - HKDF Key Derivation Function](https://tools.ietf.org/html/rfc5869)

## References

- [CEX Library C++ Implementation](https://github.com/Steppenwolfe65/CEX/tree/master/CEX/RHX.cpp)
- [CEX Cryptographic Library](https://github.com/Steppenwolfe65/CEX)
- [Post-Quantum Cryptography Resources](https://csrc.nist.gov/Projects/Post-Quantum-Cryptography)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RHX-256 ECB Test Vector #1](https://github.com/QRCS-CORP/CEX/blob/master/CEX/RHX.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `434d237c44f64a17e6d4bbd510d0fdbf` |

**Vector 2** — [RHX-512 ECB Test Vector #1](https://github.com/QRCS-CORP/CEX/blob/master/CEX/RHX.h)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `3a906880382ab4b3e90b1aa6a1927b9f` |

**Vector 3** — [RHX-1024 ECB Test Vector #1](https://github.com/QRCS-CORP/CEX/blob/master/CEX/RHX.h)

| Field | Value |
| --- | --- |
| `key` | `374a5d708396a9bccfe2f5081b2e4154 677a8da0b3c6d9ecff1225384b5e7184 97aabdd0e3f6091c2f4255687b8ea1b4 c7daed001326394c5f728598abbed1e4 f70a1d304356697c8fa2b5c8dbee0114 273a4d60738699acbfd2e5f80b1e3144 576a7d90a3b6c9dcef0215283b4e6174 879aadc0d3e6f90c1f3245586b7e91a4` |
| `input` | `fedcba98765432100123456789abcdef` |
| `expected` | `2e339ff7e921e8ad3c9d9830606d8f1e` |

---

[← All algorithms](../README.md)
