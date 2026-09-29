# Context Tree Weighting (Willems)

> Genuine Context Tree Weighting (Willems/Shtarkov/Tjalkens): a depth-16 binary context tree with a Krichevsky-Trofimov estimator per node, recursively weighted between each node's own estimate and the product of its children, driving a binary arithmetic coder. Distinct from "Context Predictor (order-2/1/0)" in ctw.js, which despite its historic filename is an unrelated most-frequent-symbol predictor.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Frans Willems, Yuri Shtarkov, Tjalling Tjalkens |
| Year | 1995 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/compression/ctw-willems.js`](../../../algorithms/compression/ctw-willems.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Context Tree Weighting - Wikipedia](https://en.wikipedia.org/wiki/Context_tree_weighting)
- [The Context-Tree Weighting Method: Basic Properties (IEEE)](https://ieeexplore.ieee.org/document/382012)

## References

- [The Context-Tree Weighting Method](https://pure.tue.nl/ws/portalfiles/portal/1134430/200411859.pdf)
- [Krichevsky-Trofimov Estimator](https://en.wikipedia.org/wiki/Krichevsky%E2%80%93Trofimov_estimator)
- [Data Compression Course](https://web.stanford.edu/class/ee398a/)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte literal](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000006280` |

**Vector 3** — [Two bytes](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `0200000062cf00` |

**Vector 4** — [Text with no repetition](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b00000066312f2a8b787dd38a2b3780` |

**Vector 5** — [Repeated text sample (4x)](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b400000077578191c1ef6951402bbff4 0fe06e7fad93efe76eb8f98e1d9de8bb 6a368862d7cdf641fdba96d3defdd470 4484af640788b71c09c0defd04d4ebfe 1e479d281c4c77864b08fd5b07143359 2a699635b9714ef58ca147a1bdb6360a 763ad1d9a0d36fd82886b218` |

**Vector 6** — [256 repeated bytes](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000070e865c932a56d` |

**Vector 7** — [All 256 byte values](https://en.wikipedia.org/wiki/Context_tree_weighting)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000244b9e5f41569b1e4e74c0ae 47a08ce9844e4ff26153655c8e96877c 32b6d6f2e2308caf9d1470a06095d867 ab488e38112ff7ab7038045b6bce6523 …` (261 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
