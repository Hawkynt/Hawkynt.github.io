# CMIX

> Reduced context-mixing model set (hashed orders 0,1,2,3,4,6 plus a word context and a match model, mixed by one logistic-domain mixer with two chained SSE stages). Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Cmix reference block. NOT the full cmix ensemble (dozens of models, neural/LSTM sub-models, multiple mixer layers) - that reference is impractical to reproduce and this port intentionally matches only the documented reduced subset.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Byron Knoll (concept); reduced clean-room reimplementation |
| Year | 2013 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/compression/cmix.js`](../../../algorithms/compression/cmix.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [cmix Reference (byronknoll)](https://github.com/byronknoll/cmix)
- [cmix Overview](https://www.byronknoll.com/cmix.html)
- [Context Mixing - Wikipedia](https://en.wikipedia.org/wiki/Context_mixing)

## References

- [cmix blog write-up](http://byronknoll.blogspot.com/2014/01/cmix.html)
- [Data Compression Explained (text)](https://www.mattmahoney.net/dc/text.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://github.com/byronknoll/cmix)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte test](https://github.com/byronknoll/cmix)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Mixed alphanumeric data](https://www.mattmahoney.net/dc/text.html)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text compression](https://www.byronknoll.com/cmix.html)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
