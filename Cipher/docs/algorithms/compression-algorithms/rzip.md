# RZIP

> Long-range redundancy-elimination compressor that indexes the entire input with a rolling hash so LZ77-style (offset,length) matches can be found at arbitrary distances, far beyond a classic 32K/64K sliding window. Literal bytes are entropy-coded with a self-contained order-0 canonical Huffman stage.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Long-Range |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Andrew Tridgell |
| Year | 1998 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/compression/rzip.js`](../../../algorithms/compression/rzip.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [rzip - a large-file compression program (project home)](https://rzip.samba.org/)
- [Andrew Tridgell, "Efficient Algorithms for Sorting and Synchronization" (PhD thesis, ANU, 1999)](https://www.samba.org/~tridge/phd_thesis.pdf)
- [rzip(1) manual page](https://manpages.ubuntu.com/manpages/focal/man1/rzip.1.html)

## References

- [Rzip - Wikipedia](https://en.wikipedia.org/wiki/Rzip)
- [lrzip - Long Range ZIP (rzip descendant)](https://github.com/ckolivas/lrzip)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RZIP round-trip - empty input](https://rzip.samba.org/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [RZIP round-trip - single byte](https://rzip.samba.org/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [RZIP round-trip - long repetitive run (2000 bytes)](https://rzip.samba.org/)

| Field | Value |
| --- | --- |
| `input` | `42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 …` (2000 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 4** — [RZIP round-trip - alternating byte pattern](https://rzip.samba.org/)

| Field | Value |
| --- | --- |
| `input` | `58595859585958595859585958595859 58595859585958595859585958595859 58595859585958595859585958595859 58595859585958595859585958595859 …` (600 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 5** — [RZIP round-trip - pseudo-random binary sample](https://rzip.samba.org/)

| Field | Value |
| --- | --- |
| `input` | `05048ba2e81c7e8c98c80abef712b375 65f567f3fea96c7f496cac2716da4f01 764a92f603c74d52f48baaa89f29edc4 75b954b693c2713474ab85df64ecbe24 …` (500 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 6** — [RZIP round-trip - identical blocks separated by 40KB of filler (long-range match, exceeds a 32K/64K sliding window)](https://www.samba.org/~tridge/phd_thesis.pdf)

| Field | Value |
| --- | --- |
| `input` | `525a49502d4c4f4e472d52414e47452d 4d41524b45522d424c4f434b2d303132 3334353637383941424344454610df9e 68ab5bc80b2f78ef4420b08ebf3fb252 …` (40090 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 7** — [RZIP round-trip - spec-flavoured description text](https://rzip.samba.org/)

| Field | Value |
| --- | --- |
| `input` | `525a49502066696e6473206c6f6e6720 64697374616e636520726564756e6461 6e637920696e207468652077686f6c65 2066696c65207573696e67206120726f 6c6c696e672068617368206469637469 6f6e6172792c207468656e2072656c69 6573206f6e2061207365636f6e642073 7461676520636f6d70726573736f7220 666f7220656e74726f707920636f6469 6e67206f6620746865206c6974657261 6c20646174612e` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
