# RePair

> Recursive pairing grammar compression. Repeatedly replaces the most frequent adjacent symbol pair with a new grammar rule until no pair repeats, producing a straight-line context-free grammar that generates the input exactly once.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Grammar-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | N. Jesper Larsson, Alistair Moffat |
| Year | 1999 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/compression/repair.js`](../../../algorithms/compression/repair.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Off-Line Dictionary-Based Compression (IEEE Proceedings)](https://ieeexplore.ieee.org/document/892708)
- [RePair - Wikipedia (Grammar-based codes)](https://en.wikipedia.org/wiki/Grammar-based_code)
- [Data Compression Conference 1999 paper](https://doi.org/10.1109/DCC.1999.755678)

## References

- [Larsson and Moffat original DCC'99 slides/paper](https://people.eng.unimelb.edu.au/ammoffat/abstracts/lm99dcc.html)
- [Grammar-based compression survey](https://en.wikipedia.org/wiki/Straight-line_grammar)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single repeated pair - 'aaaa' (RePair Wikipedia style example)](https://en.wikipedia.org/wiki/Grammar-based_code)

| Field | Value |
| --- | --- |
| `input` | `61616161` |
| `expected` | _(empty)_ |

**Vector 3** — [Repetitive text - 'abcabcabc'](https://en.wikipedia.org/wiki/Grammar-based_code)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263` |
| `expected` | _(empty)_ |

**Vector 4** — No repeated pairs - 'abcdef'

Source: Edge case - grammar reduces to zero rules

| Field | Value |
| --- | --- |
| `input` | `616263646566` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
