# Delta Filter

> Pure, size-preserving delta transform: each byte is stored as the difference from the byte a fixed distance behind it (distance=1 here), with no entropy coding or run-length pass. Used as a predictor step ahead of a general-purpose compressor. Generalizes to any fixed distance (e.g. sample width or pixel stride); this instance fixes distance=1 to match CompressionWorkbench's BB_Delta default.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Various (general technique) |
| Year | 1950 |
| Origin | ❓ Unknown |
| Source | [`algorithms/compression/delta-filter.js`](../../../algorithms/compression/delta-filter.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Delta Encoding - Wikipedia](https://en.wikipedia.org/wiki/Delta_encoding)
- [PNG Delta Filters](http://libpng.org/pub/png/spec/1.2/PNG-Filters.html)
- [Time Series Compression](https://www.vldb.org/pvldb/vol8/p1816-pelkonen.pdf)

## References

- [PNG Reference Implementation](http://libpng.org/pub/png/libpng.html)
- [TIFF Differencing Predictor](https://www.adobe.io/open/standards/TIFF.html)
- [CompressionWorkbench DeltaFilter (reference implementation)](https://github.com/Hawkynt)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data test

Source: Edge case test

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single byte test - first `distance` bytes are copied unchanged

Source: Minimal delta test

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `41` |

**Vector 3** — [Incrementing sequence - pure delta, no compression](https://en.wikipedia.org/wiki/Delta_encoding)

| Field | Value |
| --- | --- |
| `input` | `0a0c0e10` |
| `expected` | `0a020202` |

**Vector 4** — Regression: 256 repeated bytes - output length equals input length (no RLE)

Source: Regression test distinguishing this from the Delta + RLE compressor

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `61000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |

---

[← All algorithms](../README.md)
