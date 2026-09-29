# LOKI91

> Enhanced version of LOKI89 addressing cryptanalytic weaknesses. 64-bit Feistel cipher with improved S-boxes and key schedule designed for better resistance to attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Lawrie Brown, Josef Pieprzyk |
| Year | 1991 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/loki.js`](../../../algorithms/block/loki.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Related-Key Attacks](https://link.springer.com/chapter/10.1007/3-540-57220-1_66) | Vulnerable to certain classes of related-key differential attacks | Use LOKI97 or modern ciphers for any security application |

## Documentation

- [LOKI91 Improvement Paper](https://link.springer.com/chapter/10.1007/3-540-57220-1_66)
- [Enhanced LOKI Design](https://www.unsw.adfa.edu.au/~lpb/papers/loki91.pdf)

## References

- [LOKI91 Specification](https://www.unsw.adfa.edu.au/~lpb/papers/loki91.pdf)
- [Brown&Pieprzyk 1991](https://link.springer.com/chapter/10.1007/3-540-57220-1_66)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LOKI91 Educational Test Vector](https://www.unsw.adfa.edu.au/~lpb/papers/loki91.pdf)

| Field | Value |
| --- | --- |
| `key` | `133457799bbcdff1` |
| `input` | `0123456789abcdef` |
| `expected` | `418df9e7dd8aa563` |

---

[← All algorithms](../README.md)
