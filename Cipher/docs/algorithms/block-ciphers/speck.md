# Speck

> NSA's lightweight ARX (Addition-Rotation-XOR) cipher designed for software efficiency. Speck64/128 variant uses 64-bit blocks with 128-bit keys and 27 rounds. Companion to Simon cipher.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | NSA (National Security Agency) |
| Year | 2013 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/speck.js`](../../../algorithms/block/speck.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Reduced-round attacks | Various attacks exist against reduced-round variants (not full 27 rounds) | Use full-round implementation and consider alternatives for high-security applications |

## Documentation

- [The Simon and Speck Families of Lightweight Block Ciphers](https://eprint.iacr.org/2013/404.pdf)
- [NSA Simon and Speck Specification](https://nsacyber.github.io/simon-speck/)
- [Lightweight Cryptography Standardization](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [NSA Reference Implementation](https://github.com/nsacyber/simon-speck-supercop)
- [Cryptanalysis of Speck variants](https://eprint.iacr.org/2016/1010.pdf)
- [NIST Lightweight Cryptography](https://csrc.nist.gov/Projects/Lightweight-Cryptography)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Speck64/128 - Simon and Speck paper Appendix C (byte-serialised)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/speck.txt)

| Field | Value |
| --- | --- |
| `key` | `0001020308090a0b1011121318191a1b` |
| `input` | `2d4375747465723b` |
| `expected` | `8b024e4548a56f8c` |

**Vector 2** — [Speck64/128 - Crypto++ TestVectors #2](https://github.com/weidai11/cryptopp/blob/master/TestVectors/speck.txt)

| Field | Value |
| --- | --- |
| `key` | `64b76fa61ce980ab2f71098d75d66e5f` |
| `input` | `1589a8bbff4c7a85` |
| `expected` | `2f1d122370946bda` |

**Vector 3** — [Speck64/128 - Crypto++ TestVectors #3](https://github.com/weidai11/cryptopp/blob/master/TestVectors/speck.txt)

| Field | Value |
| --- | --- |
| `key` | `5524abb77240eb5c4554fad4ab730ddf` |
| `input` | `f85fa0721a3c9ad6` |
| `expected` | `2a740170155b33ee` |

**Vector 4** — [Speck64/128 - Crypto++ TestVectors #4](https://github.com/weidai11/cryptopp/blob/master/TestVectors/speck.txt)

| Field | Value |
| --- | --- |
| `key` | `922bf30e46f8cd8cb624d0bcff7ae7a2` |
| `input` | `35b7e6e160815a52` |
| `expected` | `f1761c9cbe6621e9` |

---

[← All algorithms](../README.md)
