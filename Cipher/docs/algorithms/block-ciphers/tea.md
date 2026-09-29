# TEA

> Tiny Encryption Algorithm with 64-bit blocks and 128-bit keys using simple XOR, shift, and add operations. Fast but has known cryptanalytic weaknesses.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham |
| Year | 1994 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/block/tea.js`](../../../algorithms/block/tea.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Related-key attacks | TEA is vulnerable to related-key attacks due to weak key schedule | Use XTEA or modern ciphers like AES instead |
| Equivalent keys | Multiple keys can encrypt to the same ciphertext | Algorithm is obsolete - use modern alternatives |

## Documentation

- [TEA: A Tiny Encryption Algorithm](https://www.cix.co.uk/~klockstone/tea.htm)
- [Cambridge Computer Laboratory TEA](https://www.cl.cam.ac.uk/teaching/1415/SecurityII/tea.pdf)
- [Original TEA Paper](https://link.springer.com/chapter/10.1007/3-540-60590-8_29)

## References

- [Crypto++ TEA Implementation](https://github.com/weidai11/cryptopp/blob/master/tea.cpp)
- [Bouncy Castle TEA Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)
- [TEA Cryptanalysis Papers](https://eprint.iacr.org/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TEA All Zeros Test Vector](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `41ea3a0a94baa940` |

**Vector 2** — [TEA All Ones Test Vector](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `319bbefb016abdb2` |

**Vector 3** — [TEA Sequential Pattern Test](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba9876543210` |
| `input` | `0123456789abcdef` |
| `expected` | `17b5ba5198581091` |

**Vector 4** — [TEA ASCII Test Vector](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `key` | `59454c4c4f57205355424d4152494e45` |
| `input` | `48454c4c4f313233` |
| `expected` | `7adc06304f85383e` |

**Vector 5** — [TEA Single Bit Key Test](https://www.cix.co.uk/~klockstone/tea.htm)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `0000000000000000` |
| `expected` | `0c6d2a1d930c3fab` |

---

[← All algorithms](../README.md)
