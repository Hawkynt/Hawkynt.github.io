# CSS Quantum Code

> Quantum stabilizer code constructed from two classical linear codes C1 and C2 where the dual of C2 is a subset of C1. Corrects quantum errors (bit-flip X and phase-flip Z errors). Steane [[7,1,3]] code corrects one qubit error. Foundation for fault-tolerant quantum computing. Used in quantum computers by IBM, Google.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quantum Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Robert Calderbank, Peter Shor, Andrew Steane |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/css-quantum-code.js`](../../../algorithms/ecc/css-quantum-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Qubit Error Correction Only | Steane [[7,1,3]] code can only correct 1 arbitrary qubit error (bit-flip, phase-flip, or both). Multiple errors cause decoding failure. | — |
| Overhead Cost | Encodes 1 logical qubit into 7 physical qubits (7x overhead). Higher-distance CSS codes have even larger overhead. | — |
| Classical Simulation Limitations | This implementation treats quantum states as classical bit arrays for educational purposes. Real quantum error correction requires quantum hardware and preserves superposition states. | — |
| Measurement Errors | Does not account for measurement errors in syndrome extraction, which real quantum systems must address through fault-tolerant protocols. | — |

## Documentation

- [Error Correction Zoo - CSS Code](https://errorcorrectionzoo.org/c/css)
- [Wikipedia - CSS Code](https://en.wikipedia.org/wiki/CSS_code)
- [Quantum Error Correction Tutorial](https://www.scottaaronson.com/qclec/9.pdf)
- [IBM Quantum Computing](https://quantum-computing.ibm.com/composer/docs/iqx/guide/quantum-error-correction)

## References

- [Steane's Original Paper (1996)](https://arxiv.org/abs/quant-ph/9605011)
- [Calderbank&Shor (1996)](https://arxiv.org/abs/quant-ph/9512032)
- [Nielsen&Chuang - Quantum Computation](https://doi.org/10.1017/CBO9780511976667)
- [Preskill - Quantum Error Correction Notes](http://theory.caltech.edu/~preskill/ph219/chap7.pdf)
- [Gottesman - Stabilizer Codes](https://arxiv.org/abs/quant-ph/9705052)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Steane [[7,1,3]] encode logical qubit state 0](https://errorcorrectionzoo.org/c/steane)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `00000000000000` |

**Vector 2** — [Steane [[7,1,3]] encode logical qubit state 1](https://errorcorrectionzoo.org/c/steane)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `01010101010101` |

---

[← All algorithms](../README.md)
