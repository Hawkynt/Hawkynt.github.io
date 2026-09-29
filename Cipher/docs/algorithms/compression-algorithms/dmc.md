# DMC

> Dynamic Markov Compression. Predicts each bit with an adaptive finite-state Markov model (a binary tree that grows by cloning states shared by multiple significant paths) and codes it with a carryless binary arithmetic coder.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Modeling |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | Gordon V. Cormack, R. Nigel S. Horspool |
| Year | 1987 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/compression/dmc.js`](../../../algorithms/compression/dmc.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Data Compression Using Dynamic Markov Modelling (Cormack and Horspool, 1987)](https://doi.org/10.1093/comjnl/30.6.541)
- [Dynamic Markov compression - Wikipedia](https://en.wikipedia.org/wiki/Dynamic_Markov_compression)
- [Arithmetic coding - Wikipedia](https://en.wikipedia.org/wiki/Arithmetic_coding)

## References

- [A bit-level context modeling and arithmetic coding overview](https://www.cs.cmu.edu/~aberger/pdf/dmc.pdf)
- [Data Compression: The Complete Reference (Salomon)](https://www.springer.com/gp/book/9781846286025)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Repetitive input - 'AAAAAAAAAA'](https://doi.org/10.1093/comjnl/30.6.541)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | _(empty)_ |

**Vector 3** — [Text sample - 'the quick brown fox'](https://doi.org/10.1093/comjnl/30.6.541)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20666f78` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
