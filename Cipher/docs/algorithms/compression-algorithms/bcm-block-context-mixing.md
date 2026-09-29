# BCM (Block Context Mixing)

> Burrows-Wheeler Transform with a compact order-0..2 context-mixing back end, BCM-style. Ported to be byte-for-byte identical to CompressionWorkbench's reduced BB_Bcm reference block.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | BWT + Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Ilya Muravyov (concept); reduced clean-room reimplementation |
| Year | 2010 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/bcm.js`](../../../algorithms/compression/bcm.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [BCM Reference (encode84)](https://github.com/encode84/bcm)
- [Burrows-Wheeler Transform](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)
- [Context Mixing](https://en.wikipedia.org/wiki/Context_mixing)

## References

- [BCM Compression Analysis](https://encode.su/threads/1738-bcm-Big-brother-of-bzip2)
- [Burrows-Wheeler SRC-RR-124](https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf)
- [Data Compression Explained](http://mattmahoney.net/dc/dce.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://github.com/encode84/bcm)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte test](https://github.com/encode84/bcm)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Simple repeated pattern](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `414141424242434343` |
| `expected` | _(empty)_ |

**Vector 4** — [Classic banana example](https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform)

| Field | Value |
| --- | --- |
| `input` | `62616e616e61` |
| `expected` | _(empty)_ |

**Vector 5** — [Mixed alphanumeric data](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 6** — [Repetitive text compression](https://encode.su/threads/1738-bcm-Big-brother-of-bzip2)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263616263616263616263` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
