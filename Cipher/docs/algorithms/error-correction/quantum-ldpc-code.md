# Quantum LDPC Code

> Quantum extension of low-density parity-check codes using sparse parity-check matrices for both X and Z stabilizers. Enables scalable quantum error correction with lower overhead than surface codes. Under active research for fault-tolerant quantum computing by IBM, Google, and Microsoft.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Daniel Gottesman, David MacKay |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/quantum-ldpc.js`](../../../algorithms/ecc/quantum-ldpc.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding Complexity | Iterative belief propagation decoding has high computational complexity and may not converge for all error patterns. | — |
| Error Floor Phenomenon | Like classical LDPC codes, QLDPC codes exhibit error floors at very low error rates due to near-codewords and trapping sets. | — |
| Classical Simulation Limitations | This implementation treats quantum states as classical bit arrays for educational purposes. Real quantum error correction operates on superposition states requiring quantum hardware. | — |
| Limited Distance | The [[7,1,3]] example code corrects only 1 arbitrary qubit error. Practical quantum computing requires larger codes with higher distance. | — |

## Documentation

- [Error Correction Zoo - Quantum LDPC](https://errorcorrectionzoo.org/c/qldpc)
- [MacKay et al. - Sparse Graph Codes](https://arxiv.org/abs/quant-ph/0304161)
- [Wikipedia - Quantum LDPC Codes](https://en.wikipedia.org/wiki/Quantum_error_correction#Quantum_LDPC_codes)
- [Steane Code (QLDPC Example)](https://errorcorrectionzoo.org/c/steane)

## References

- [MacKay-Mitchison-McFadden (2004)](https://ieeexplore.ieee.org/document/1337106)
- [Gottesman - Stabilizer Codes](https://arxiv.org/abs/quant-ph/9705052)
- [PRX Quantum - QLDPC Review](https://link.aps.org/doi/10.1103/PRXQuantum.2.040101)
- [Nielsen and Chuang - Quantum Computation](https://doi.org/10.1017/CBO9780511976667)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [QLDPC [[7,1,3]] encode logical |0⟩](https://errorcorrectionzoo.org/c/steane)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `00000000000000` |

**Vector 2** — [QLDPC [[7,1,3]] encode logical |1⟩](https://errorcorrectionzoo.org/c/steane)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `01010101010101` |

---

[← All algorithms](../README.md)
