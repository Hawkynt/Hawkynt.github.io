# CSC (Context Sorting Compression)

> LZ77 parsing (hash-chain match finder, 32 KiB window, 3-258 byte matches) whose flag/literal/length/distance channels are entropy-coded with logistic-domain context mixing over a shared binary arithmetic coder. Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Csc reference block.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | LZ77 + Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Fu Siyuan (concept); reduced clean-room reimplementation |
| Year | 2012 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/compression/csc.js`](../../../algorithms/compression/csc.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CSC Reference (fusiyuan2010)](https://github.com/fusiyuan2010/CSC)
- [LZ77 and LZ78 - Wikipedia](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [Context Mixing Notes](https://mattmahoney.net/dc/dce.html#Section_43)

## References

- [CSC Source Repository](https://github.com/fusiyuan2010/CSC)
- [Data Compression Explained](http://mattmahoney.net/dc/dce.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://github.com/fusiyuan2010/CSC)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte test](https://github.com/fusiyuan2010/CSC)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Mixed alphanumeric data](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text compression](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
