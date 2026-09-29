# PAQ8hp (High Performance)

> Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a match model, combined with PAQ8-style context-selected mixing - 16 weight vectors chosen by the previous byte's high nibble - and refined by a single SSE stage). Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Paq8hp reference block. NOT the full PAQ8hp ensemble (word/sparse/indirect/PPM-style/media-detector models behind a large mixing network) - that reference is impractical to reproduce and this port intentionally matches only the documented reduced subset.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Matt Mahoney, Alexander Ratushnyak, PAQ Team (concept); reduced clean-room reimplementation |
| Year | 2007 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/paq8hp.js`](../../../algorithms/compression/paq8hp.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [PAQ8 Family Overview](https://www.mattmahoney.net/dc/paq.html)
- [PAQ8hp Archive](http://mattmahoney.net/dc/paq8hp12any.zip)
- [Context Mixing - Wikipedia](https://en.wikipedia.org/wiki/Context_mixing)

## References

- [Hutter Prize](http://prize.hutter1.net/)
- [Data Compression Explained](http://mattmahoney.net/dc/dce.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://www.mattmahoney.net/dc/paq.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte test](https://www.mattmahoney.net/dc/paq.html)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Mixed alphanumeric data](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text compression](http://prize.hutter1.net/)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
