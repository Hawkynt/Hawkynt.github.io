# Simon

> NSA's lightweight block cipher family designed for resource-constrained environments. Simon64/128 variant uses 64-bit blocks with 128-bit keys and 44 rounds. Optimized for hardware implementation.

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
| Source | [`algorithms/block/simon.js`](../../../algorithms/block/simon.js) |

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
| Reduced-round attacks | Various attacks exist against reduced-round variants (not full 44 rounds) | Use full-round implementation and consider alternatives for high-security applications |

## Documentation

- [The Simon and Speck Families of Lightweight Block Ciphers](https://eprint.iacr.org/2013/404.pdf)
- [NSA Simon and Speck Specification](https://nsacyber.github.io/simon-speck/)
- [Lightweight Cryptography Standardization](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [NSA Reference Implementation](https://github.com/nsacyber/simon-speck-supercop)
- [Cryptanalysis of Simon variants](https://eprint.iacr.org/2014/448.pdf)
- [NIST Lightweight Cryptography](https://csrc.nist.gov/Projects/Lightweight-Cryptography)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Simon64/128 - Simon and Speck paper Appendix B (byte-serialised)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simon.txt)

| Field | Value |
| --- | --- |
| `key` | `0001020308090a0b1011121318191a1b` |
| `input` | `756e64206c696b65` |
| `expected` | `7aa0dfb920fcc844` |

**Vector 2** — [Simon64/128 - Crypto++ TestVectors #2](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simon.txt)

| Field | Value |
| --- | --- |
| `key` | `435ccae27799f6117c08652eb81e0ebe` |
| `input` | `ef4a99d6e0d6992c` |
| `expected` | `b172958be0f28647` |

**Vector 3** — [Simon64/128 - Crypto++ TestVectors #3](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simon.txt)

| Field | Value |
| --- | --- |
| `key` | `6cce23b05650d41237fc83805a76eddc` |
| `input` | `6e27377afc08ecf4` |
| `expected` | `c889752d52f046e5` |

**Vector 4** — [Simon64/128 - Crypto++ TestVectors #4](https://github.com/weidai11/cryptopp/blob/master/TestVectors/simon.txt)

| Field | Value |
| --- | --- |
| `key` | `c2358c444168bad0ab5067fd536885f1` |
| `input` | `547ab26aa85da02d` |
| `expected` | `bd99b9583d4c5449` |

---

[← All algorithms](../README.md)
