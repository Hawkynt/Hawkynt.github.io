# LEA

> Lightweight Encryption Algorithm, Korean national standard (KS X 3246). ARX-based block cipher with 128-bit blocks, optimized for high-speed software implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Deukjo Hong, Jung-Keun Lee, Dong-Chan Kim, Daesung Kwon, Kwon Ho Ryu, Dong-Geon Lee |
| Year | 2013 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/lea.js`](../../../algorithms/block/lea.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LEA Specification](https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do)
- [ISO/IEC 29192-2:2019](https://www.iso.org/standard/56552.html)
- [LEA Design Paper](https://eprint.iacr.org/2013/794.pdf)

## References

- [KISA Reference Implementation](https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do)
- [LEA GitHub Repository](https://github.com/hkscy/LEA)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LEA-128 Test Vector - KS X 3246](https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do)

| Field | Value |
| --- | --- |
| `key` | `0f1e2d3c4b5a69788796a5b4c3d2e1f0` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `9fc84e3528c6c6185532c7a704648bfd` |

**Vector 2** — [LEA-192 Test Vector - KS X 3246](https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do)

| Field | Value |
| --- | --- |
| `key` | `0f1e2d3c4b5a69788796a5b4c3d2e1f0f0e1d2c3b4a59687` |
| `input` | `202122232425262728292a2b2c2d2e2f` |
| `expected` | `6fb95e325aad1b878cdcf5357674c6f2` |

**Vector 3** — [LEA-256 Test Vector - KS X 3246](https://seed.kisa.or.kr/kisa/algorithm/EgovLeaInfo.do)

| Field | Value |
| --- | --- |
| `key` | `0f1e2d3c4b5a69788796a5b4c3d2e1f0f0e1d2c3b4a5968778695a4b3c2d1e0f` |
| `input` | `303132333435363738393a3b3c3d3e3f` |
| `expected` | `d651aff647b189c13a8900ca27f9e197` |

---

[← All algorithms](../README.md)
