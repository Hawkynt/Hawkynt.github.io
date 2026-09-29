# Context Predictor (order-2/1/0)

> Most-frequent-symbol predictor over an order-2/1/0 byte context hierarchy with a hit/miss bitmap. Not the Context Tree Weighting (CTW) method despite the legacy name this block previously used.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Unknown (educational most-frequent-symbol predictor) |
| Year | 1995 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/compression/ctw.js`](../../../algorithms/compression/ctw.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Context modeling - Wikipedia](https://en.wikipedia.org/wiki/Context_mixing)
- [Prediction by Partial Matching](https://en.wikipedia.org/wiki/Prediction_by_partial_matching)

## References

- [Statistical Compression Survey](https://homepages.cwi.nl/~paulv/papers/statsmodcourse.pdf)
- [Data Compression Course](https://web.stanford.edu/class/ee398a/)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0000000002` |

**Vector 2** — [Single byte - the empty model predicts zero, so it misses](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000020041` |

**Vector 3** — [Single character](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `30` |
| `expected` | `01000000020030` |

**Vector 4** — [Two symbols](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `3031` |
| `expected` | `0200000002003031` |

**Vector 5** — [Alternating pattern - the order-1 context predicts the tail](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `30313031` |
| `expected` | `0400000002303031` |

**Vector 6** — [Structured pattern](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `3030313130303131` |
| `expected` | `08000000024730313130` |

**Vector 7** — [Repeating sequence](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `616263616263` |
| `expected` | `06000000021c616263` |

**Vector 8** — [Run of one byte - every position after the first is predicted](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161` |
| `expected` | `10000000027fff61` |

---

[← All algorithms](../README.md)
