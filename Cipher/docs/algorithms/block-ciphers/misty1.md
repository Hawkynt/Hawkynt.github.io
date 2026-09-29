# MISTY1

> Japanese block cipher by Mitsuru Matsui designed for provable security. Uses 64-bit blocks and 128-bit keys with 8-round FL/FO structure. First practical cipher with decorrelation theory proof.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Mitsuru Matsui |
| Year | 1996 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/misty.js`](../../../algorithms/block/misty.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 2994 - MISTY1 Specification](https://tools.ietf.org/rfc/rfc2994.txt)
- [CRYPTREC Evaluation](https://www.cryptrec.go.jp/english/)
- [Wikipedia Article](https://en.wikipedia.org/wiki/MISTY1)

## References

- [Original MISTY1 Paper](https://link.springer.com/chapter/10.1007/3-540-69053-0_5)
- [Decorrelation Theory](https://crypto.stanford.edu/~dabo/papers/decorrelation.pdf)
- [CRYPTREC Report](https://www.cryptrec.go.jp/english/method.html)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 2994 Appendix A - first 64-bit block](https://www.rfc-editor.org/rfc/rfc2994.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `0123456789abcdef` |
| `expected` | `8b1da5f56ab3d07c` |

**Vector 2** — [RFC 2994 Appendix A - second 64-bit block](https://www.rfc-editor.org/rfc/rfc2994.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `fedcba9876543210` |
| `expected` | `04b68240b13be95d` |

**Vector 3** — [RFC 2994 Appendix A - 128-bit plaintext in ECB mode](https://www.rfc-editor.org/rfc/rfc2994.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `8b1da5f56ab3d07c04b68240b13be95d` |

**Vector 4** — [NESSIE submission testvectors.txt - set 1, vector 0](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/misty1.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `b5eda7d64fcd2a02` |

**Vector 5** — [NESSIE submission testvectors.txt - single low key bit](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/misty1.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `0000000000000000` |
| `expected` | `2049aa1be3546aed` |

**Vector 6** — [NESSIE submission testvectors.txt - repeating 0x6c](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/misty1.zip)

| Field | Value |
| --- | --- |
| `key` | `6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c` |
| `input` | `6c6c6c6c6c6c6c6c` |
| `expected` | `a0cc24a85b11e9cd` |

**Vector 7** — [NESSIE submission testvectors.txt - all ones](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/misty1.zip)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `651f3092afa551d0` |

---

[← All algorithms](../README.md)
