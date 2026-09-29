# XXTEA

> Corrected Block TEA by Needham and Wheeler with variable block sizes and enhanced security over TEA/XTEA. Supports blocks from 8 bytes to 1KB with 128-bit keys and improved diffusion.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Roger Needham, David Wheeler |
| Year | 1998 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/block/xxtea.js`](../../../algorithms/block/xxtea.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) to 1024 bytes (8192 bits) in steps of 4 bytes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Limited standardization](https://www.schneier.com/academic/) | Not widely standardized or analyzed compared to modern ciphers | Use standardized ciphers like AES for production security applications |
| [Variable block complexity](https://eprint.iacr.org/) | Variable block sizes may introduce implementation complexities and edge cases | Careful implementation and testing required for security-critical applications |

## Documentation

- [Block TEA corrections and improvements](https://www.cix.co.uk/~klockstone/xxtea.htm)
- [Variable block cipher design](https://link.springer.com/chapter/10.1007/3-540-60590-8_29)
- [Cambridge Cryptography Research](https://www.cl.cam.ac.uk/research/security/)

## References

- [Crypto++ XXTEA Implementation](https://github.com/weidai11/cryptopp/blob/master/tea.cpp)
- [Node.js XXTEA Implementation](https://www.npmjs.com/package/xxtea)
- [Python XXTEA Implementation](https://pypi.org/project/xxtea/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [XXTEA 8-byte block - all zeros](https://github.com/an0maly/Crypt-XXTEA/blob/master/t/test-vectors.t)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `ab043705808c5d57` |

**Vector 2** — [XXTEA 8-byte block - mixed key](https://github.com/an0maly/Crypt-XXTEA/blob/master/t/test-vectors.t)

| Field | Value |
| --- | --- |
| `key` | `0102040810204080fffefcf8f0e0c080` |
| `input` | `0000000000000000` |
| `expected` | `d1e78be2c746728a` |

**Vector 3** — [XXTEA 8-byte block - all ones plaintext](https://github.com/an0maly/Crypt-XXTEA/blob/master/t/test-vectors.t)

| Field | Value |
| --- | --- |
| `key` | `9e3779b99b9773e9b979379e6b695156` |
| `input` | `ffffffffffffffff` |
| `expected` | `67ed0ea8e8973fc5` |

---

[← All algorithms](../README.md)
