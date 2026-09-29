# Tornado Code

> First practical fountain codes with linear-time encoding/decoding. Precursor to LT and Raptor codes. Uses irregular bipartite graph structure. Designed for erasure channels. Encoding generates check symbols using XOR of source symbols. Near-optimal overhead for erasure recovery.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Erasure Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Michael Luby, Michael Mitzenmacher |
| Year | 1997 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/tornado-code.js`](../../../algorithms/ecc/tornado-code.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRateless` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Failure Probability | Tornado codes have a non-zero probability of decoding failure. The failure probability depends on the degree distribution, overhead factor, and number of erasures. High overhead (>50%) is typically required for reliable decoding. | 🎓 Educational Only |
| Irregular Graph Overhead | The irregular bipartite graph structure creates uneven distribution of check nodes. Some source symbols may have higher degree than others, creating potential bottlenecks in belief propagation decoding. | 🎓 Educational Only |
| Erasure Pattern Dependency | Decoding success is highly dependent on the specific pattern of erasures received. Some erasure patterns may lead to failure even with sufficient symbol count due to graph structure mismatch. | 🎓 Educational Only |

## Documentation

- [Tornado Codes Paper](https://www.icsi.berkeley.edu/pubs/theory/luby98practical.pdf)
- [Digital Fountain Survey](https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf)
- [Erasure Codes Overview](https://en.wikipedia.org/wiki/Erasure_code)

## References

- [LDPC Encoder/Decoder (irregular-graph code family)](https://github.com/tavildar/LDPC)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-computed round-trip verification vector - Tornado encoding with all-zero symbols](https://www.icsi.berkeley.edu/pubs/theory/luby98practical.pdf)

| Field | Value |
| --- | --- |
| `k` | `8` |
| `stages` | `3` |
| `seed` | `12345` |
| `overhead` | `0.5` |
| `input` | `0000000000000000` |
| `expected` | `000000000000000000000000` |

**Vector 2** — [Self-computed round-trip verification vector - Tornado encoding with sequential pattern](https://www.icsi.berkeley.edu/pubs/theory/luby98practical.pdf)

| Field | Value |
| --- | --- |
| `k` | `8` |
| `stages` | `3` |
| `seed` | `54321` |
| `overhead` | `0.25` |
| `input` | `0102030405060708` |
| `expected` | `0102030405060708030000` |

**Vector 3** — [Self-computed round-trip verification vector - Tornado encoding with alternating bit pattern](https://www.icsi.berkeley.edu/pubs/theory/luby98practical.pdf)

| Field | Value |
| --- | --- |
| `k` | `8` |
| `stages` | `3` |
| `seed` | `99999` |
| `overhead` | `0.5` |
| `input` | `aa55aa55aa55aa55` |
| `expected` | `aa55aa55aa55aa55ffaa0000` |

**Vector 4** — [Self-computed round-trip verification vector - Tornado full recovery with arbitrary pattern](https://www.icsi.berkeley.edu/pubs/theory/luby98practical.pdf)

| Field | Value |
| --- | --- |
| `k` | `8` |
| `stages` | `3` |
| `seed` | `11111` |
| `overhead` | `0.25` |
| `input` | `123456789abcdef0` |
| `expected` | `123456789abcdef01a0000` |

---

[← All algorithms](../README.md)
