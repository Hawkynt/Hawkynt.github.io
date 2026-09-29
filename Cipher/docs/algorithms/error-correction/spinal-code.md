# Spinal Code

> Rateless codes achieving capacity on unknown channels. Hash-based incremental redundancy. State machine generates pseudo-random symbols. Receiver uses sequential decoding (bubble decoder). Used in WiFi and modern wireless. No feedback needed. Asymptotically capacity-achieving.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Rateless Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Jonathan Perry, Hari Balakrishnan |
| Year | 2012 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/spinal-code.js`](../../../algorithms/ecc/spinal-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity Exponential | Bubble decoder complexity grows exponentially with message length. Practical for k=4 to k=16 bits. | — |
| Hash Function Selection | Security depends on hash function properties. Poor hash functions reduce decoding efficiency. | — |
| Bubble Decoder Pruning | Aggressive pruning reduces decoding quality. Requires careful threshold tuning per channel. | — |

## Documentation

- [Spinal Codes (Perry, Iannucci, Fleming, Balakrishnan, Shah)](https://people.eecs.berkeley.edu/~sylvia/cs268-2014/papers/spinal.pdf)
- [Fountain / Rateless Codes - Wikipedia](https://en.wikipedia.org/wiki/Fountain_code)
- [Spinal Codes - Devavrat Shah publication page](https://devavrat.mit.edu/publication/spinal-codes/)
- [Shannon Capacity Theory](https://en.wikipedia.org/wiki/Shannon%27s_source_coding_theorem)

## References

- [Perry, Iannucci, Fleming, Balakrishnan, Shah - Spinal Codes, ACM SIGCOMM 2012](https://dl.acm.org/doi/10.1145/2377677.2377684)
- [Information Theory and Coding](https://en.wikipedia.org/wiki/Channel_capacity)
- [Spinal Codes - Semantic Scholar entry](https://www.semanticscholar.org/paper/Spinal-codes-Perry-Iannucci/7a70d9bf3b2194dd5df11d7ad23ebb06bd95ea9f)
- [Incremental Redundancy Techniques](https://en.wikipedia.org/wiki/Automatic_repeat_request)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Spinal code all-zero message k=4

Source: Self-computed: this implementation's spine hash and symbol generator

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `010000000101010000000000` |

**Vector 2** — Spinal code alternating pattern k=4

Source: Self-computed: this implementation's spine hash and symbol generator

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `010101010000000001000000` |

**Vector 3** — Spinal code all-ones message k=4

Source: Self-computed: this implementation's spine hash and symbol generator

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `010000000001010001010101` |

**Vector 4** — Spinal code alternating pattern phase2 k=4

Source: Self-computed: this implementation's spine hash and symbol generator

| Field | Value |
| --- | --- |
| `input` | `00010001` |
| `expected` | `000000000000010001010000` |

---

[← All algorithms](../README.md)
