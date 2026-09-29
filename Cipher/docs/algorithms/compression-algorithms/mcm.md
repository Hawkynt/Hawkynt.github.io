# MCM

> Two-level context-mixing network: local (orders 0-2), medium (orders 3-4) and wide (order 6 + sparse skip-1) model groups, each mixed by their own mixer, combined by a top-level mixer and refined by two chained SSE stages. Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Mcm reference block.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Mathieu Chartier (concept); reduced clean-room reimplementation |
| Year | 2013 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/compression/mcm.js`](../../../algorithms/compression/mcm.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [MCM Reference (mathieuchartier)](https://github.com/mathieuchartier/mcm)
- [MCM Discussion Thread](https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier)
- [Context Mixing - Wikipedia](https://en.wikipedia.org/wiki/Context_mixing)

## References

- [MCM Source Repository](https://github.com/mathieuchartier/mcm)
- [Data Compression Explained](http://mattmahoney.net/dc/dce.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://github.com/mathieuchartier/mcm)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte test](https://github.com/mathieuchartier/mcm)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Mixed alphanumeric data](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text compression](https://encode.su/threads/2121-MCM-new-compressor-by-Mathieu-Chartier)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
