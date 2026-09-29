# Shannon-Fano Coding

> Variable-length prefix-free coding algorithm that predates Huffman coding. Divides symbols recursively by frequency to create binary codes, though not always optimal.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Claude Shannon, Robert Fano |
| Year | 1948 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/shannon-fano.js`](../../../algorithms/compression/shannon-fano.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [A Mathematical Theory of Communication](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf)
- [Shannon-Fano Coding - Wikipedia](https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding)
- [Information Theory Primer](https://web.stanford.edu/class/ee276/)
- [Data Compression History](https://www.data-compression.com/theory.shtml)

## References

- [MIT Information Theory Course](https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/)
- [Shannon-Fano vs Huffman Analysis](https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf)
- [Rosetta Code Implementation](https://rosettacode.org/wiki/Shannon-Fano_coding)
- [Educational Examples](https://www2.cs.duke.edu/csed/poop/huff/info/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Basic frequency encoding](https://en.wikipedia.org/wiki/Shannon%E2%80%93Fano_coding)

| Field | Value |
| --- | --- |
| `input` | `414141424243` |
| `expected` | `06000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (518 bytes; the full value is in the source) |

**Vector 2** — [Alphabet frequency test](https://www2.cs.duke.edu/csed/poop/huff/info/)

| Field | Value |
| --- | --- |
| `input` | `414243444546` |
| `expected` | `06000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (518 bytes; the full value is in the source) |

**Vector 3** — [Repeated pattern encoding](https://www.cs.cmu.edu/~ckingsf/bioinfo-lectures/shannon.pdf)

| Field | Value |
| --- | --- |
| `input` | `414241424142` |
| `expected` | `06000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (517 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
