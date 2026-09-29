# PPMd (PPM with Dynamic Memory)

> Context trie with Method D escape estimation (escape frequency = number of distinct symbols observed), periodic rescaling, exclusion of already-coded symbols on escape, and a flat order(-1) fallback, entropy-coded with a multi-symbol range coder. Ported to be byte-for-byte identical to CompressionWorkbench's BB_Ppmd (Model H) reference block.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical (PPM) |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Dmitry Shkarin (concept); reduced clean-room reimplementation |
| Year | 1999 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/ppmd.js`](../../../algorithms/compression/ppmd.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [PPMd Overview - Wikipedia](https://en.wikipedia.org/wiki/Prediction_by_partial_matching)
- [7-Zip PPMd Method](https://www.7-zip.org/7z.html)
- [Data Compression Explained (PPM)](http://mattmahoney.net/dc/dce.html#Section_431)

## References

- [Shkarin PPMd var.H/I sources](http://www.compression.ru/ds/)
- [Method D Escape Estimation](https://en.wikipedia.org/wiki/Prediction_by_partial_matching#Method_D)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](http://www.compression.ru/ds/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0600000000` |

**Vector 2** — [Single byte test](http://www.compression.ru/ds/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Mixed alphanumeric data](http://mattmahoney.net/dc/dce.html#Section_431)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text compression](https://en.wikipedia.org/wiki/Prediction_by_partial_matching)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
