# XTEA

> Extended TEA cipher by Wheeler and Needham with improved key schedule and better security than TEA. Uses 64 rounds with 64-bit blocks and 128-bit keys. Educational cipher for understanding Feistel networks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham |
| Year | 1997 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/block/xtea.js`](../../../algorithms/block/xtea.js) |

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
| [Limited analysis](https://www.schneier.com/academic/) | Less cryptanalysis compared to modern ciphers, potential unknown weaknesses exist | Use modern standardized ciphers like AES for production applications |
| [Related-key attacks](https://eprint.iacr.org/) | While improved over TEA, XTEA may still be vulnerable to certain related-key attacks | Avoid key reuse and use proper key management practices |

## Documentation

- [TEA extensions and corrections](https://www.cix.co.uk/~klockstone/xtea.htm)
- [Cambridge Computer Laboratory](https://www.cl.cam.ac.uk/teaching/1415/SecurityII/)
- [Block TEA improvements](https://link.springer.com/chapter/10.1007/3-540-60590-8_29)

## References

- [Crypto++ XTEA Implementation](https://github.com/weidai11/cryptopp/blob/master/xtea.cpp)
- [Bouncy Castle XTEA Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)
- [Python XTEA Implementation](https://pypi.org/project/xtea/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [XTEA All Zeros Test Vector](https://www.cix.co.uk/~klockstone/xtea.htm)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `dee9d4d8f7131ed9` |

**Vector 2** — [XTEA Pattern Test Vector](https://www.cix.co.uk/~klockstone/xtea.htm)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef0123456789abcdef` |
| `input` | `0123456789abcdef` |
| `expected` | `27e795e076b2b537` |

---

[← All algorithms](../README.md)
