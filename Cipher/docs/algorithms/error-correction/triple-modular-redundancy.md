# Triple Modular Redundancy

> Simplest fault-tolerant system replicating data three times and using majority voting for error correction. Can correct single-bit errors per triplicate. Code rate 1/3. Widely used in safety-critical systems including spacecraft, nuclear reactors, and medical devices. Simple but effective.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Redundancy Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (classical technique) |
| Year | 1950 |
| Origin | Not specified |
| Source | [`algorithms/ecc/triple-modular-redundancy.js`](../../../algorithms/ecc/triple-modular-redundancy.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Low Code Rate | Code rate is only 1/3 (200% overhead), extremely inefficient. | — |
| Single Point of Failure | The voter itself can be a single point of failure requiring voter redundancy. | — |

## Documentation

- [Wikipedia - TMR](https://en.wikipedia.org/wiki/Triple_modular_redundancy)
- [Fault Tolerance](https://www.tutorialspoint.com/fault-tolerant-systems)
- [Redundancy Techniques](https://www.ece.cmu.edu/~koopman/des_s99/tmr/)

## References

- [TMR in Space Systems](https://ntrs.nasa.gov/citations/19830013696)
- [Voting Systems](https://ieeexplore.ieee.org/document/1675745)
- [Safety-Critical Applications](https://www.sciencedirect.com/topics/engineering/triple-modular-redundancy)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TMR all zeros](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `000000000000000000000000` |

**Vector 2** — [TMR all ones](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `010101010101010101010101` |

**Vector 3** — [TMR pattern 1010](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `010101000000010101000000` |

**Vector 4** — [TMR single bit](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `010101` |

---

[← All algorithms](../README.md)
