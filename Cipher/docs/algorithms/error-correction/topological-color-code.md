# Topological Color Code

> 2D topological quantum code on hexagonal lattice with 3-coloring. Supports transversal gates beyond Clifford group enabling fault-tolerant universal quantum computing. Triangular lattice structure with color-coded stabilizers (X and Z operators on each colored face). Superior gate implementation compared to surface codes for certain operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Hector Bombin, Miguel Angel Martin-Delgado |
| Year | 2006 |
| Origin | 🌐 International |
| Source | [`algorithms/ecc/color-code.js`](../../../algorithms/ecc/color-code.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distance-3 Error Correction Limit | The [[7,1,3]] color code can only correct single qubit errors. For practical quantum computing, higher-distance codes (d≥5) are needed but require significantly more qubits. | — |
| Syndrome Extraction Complexity | Color codes require measuring stabilizers on all three colors of faces (plaquettes), which is more complex than surface codes requiring only two types of stabilizers. | — |
| Qubit Overhead | Encodes 1 logical qubit into 7 physical qubits for distance-3. Higher distances scale as n ≈ d² qubits, similar to surface codes. | — |
| Classical Simulation Limitations | This implementation simulates quantum states as classical bit patterns for educational purposes. Real color codes require quantum hardware and preserve superposition states, entanglement, and phase information. | — |
| Decoder Complexity | Optimal decoding for color codes is NP-hard. Practical decoders use approximate algorithms (Möbius matching, restriction decoders) with sub-optimal performance. | — |

## Documentation

- [Error Correction Zoo - Color Code](https://errorcorrectionzoo.org/c/color)
- [Error Correction Zoo - 2D Color Code](https://errorcorrectionzoo.org/c/2d_color)
- [Quantum Journal - Boundaries and Twist Defects](https://quantum-journal.org/papers/q-2018-10-19-101/)
- [Wikipedia - Topological Quantum Computing](https://en.wikipedia.org/wiki/Topological_quantum_computer)

## References

- [Bombin and Martin-Delgado (2006) - Original Paper](https://arxiv.org/abs/quant-ph/0605138)
- [Bombin (2015) - Gauge Color Codes](https://arxiv.org/abs/1311.0879)
- [Kubica (2018) - Unfolding Color Code](https://arxiv.org/abs/1708.07131)
- [Delfosse et al (2020) - Decoder for Triangular Color Code](https://arxiv.org/abs/2108.11395)
- [Landahl et al (2011) - Fault-Tolerant Quantum Computing](https://arxiv.org/abs/1108.5738)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Color code [[7,1,3]] encode logical |0⟩](https://errorcorrectionzoo.org/c/color)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `00000000000000` |

**Vector 2** — [Color code [[7,1,3]] encode logical |1⟩](https://errorcorrectionzoo.org/c/color)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `01010101010101` |

---

[← All algorithms](../README.md)
