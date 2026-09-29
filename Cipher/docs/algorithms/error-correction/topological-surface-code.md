# Topological Surface Code

> Classical simulation of topological surface code, a 2D lattice quantum error correction code with stabilizer measurements. Educational implementation demonstrating syndrome extraction and error correction principles from Kitaev's fault-tolerant quantum computing framework.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Alexei Kitaev |
| Year | 1997 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/surface-code.js`](../../../algorithms/ecc/surface-code.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Quantum Hardware Required | Surface codes require quantum hardware with physical qubits. Classical simulation is exponentially expensive. | — |
| Threshold Requirements | Requires physical error rates below ~1% threshold for effective error correction. Above threshold, logical error rates increase. | — |
| Resource Overhead | Distance-3 code requires 17 physical qubits per logical qubit. Distance-5 requires 49 qubits. Overhead grows quadratically. | — |

## Documentation

- [Kitaev's Original Paper (1997)](https://arxiv.org/abs/quant-ph/9707021)
- [Topological Quantum Memory (2002)](https://arxiv.org/abs/quant-ph/0110143)
- [Error Correction Zoo - Surface Code](https://errorcorrectionzoo.org/c/surface)
- [Google Quantum AI - Surface Code](https://www.nature.com/articles/s41586-022-05434-1)
- [IBM Qiskit Surface Codes](https://github.com/The-Singularity-Research/QISKit-Surface-Codes)

## References

- [Fault-tolerant quantum computation by anyons](https://arxiv.org/abs/quant-ph/9707021)
- [Dennis, Kitaev, Landahl, Preskill - Topological quantum memory](https://arxiv.org/abs/quant-ph/0110143)
- [Google Willow Surface Code](https://www.nature.com/articles/s41586-024-08449-y)
- [Surface codes: Towards practical large-scale quantum computation](https://arxiv.org/abs/1208.0928)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Distance-3 planar surface code - no errors](https://errorcorrectionzoo.org/c/surface)

| Field | Value |
| --- | --- |
| `distance` | `3` |
| `input` | `0000000000000000000000000000000000` |
| `expected` | `0000000000000000000000000000000000` |

**Vector 2** — [Distance-3 planar surface code - X error detection via stabilizers](https://arxiv.org/abs/quant-ph/0110143)

| Field | Value |
| --- | --- |
| `distance` | `3` |
| `input` | `0001000000000000000000000000000000` |
| `expected` | `0000000000000000000000000000000000` |

**Vector 3** — [Distance-3 planar surface code - Z error detection via stabilizers](https://arxiv.org/abs/quant-ph/0110143)

| Field | Value |
| --- | --- |
| `distance` | `3` |
| `errorType` | Z |
| `input` | `0001000000000000000000000000000000` |
| `expected` | `0000000000000000000000000000000000` |

**Vector 4** — [Encode logical |0> state in distance-3 surface code](https://errorcorrectionzoo.org/c/surface)

| Field | Value |
| --- | --- |
| `distance` | `3` |
| `logicalState` | `0` |
| `input` | `00` |
| `expected` | `0000000000000000000000000000000000` |

**Vector 5** — [Encode logical |1> state in distance-3 surface code](https://errorcorrectionzoo.org/c/surface)

| Field | Value |
| --- | --- |
| `distance` | `3` |
| `logicalState` | `1` |
| `input` | `01` |
| `expected` | `0101010101010101010101010101010101` |

**Vector 6** — [Distance-5 planar surface code - no errors](https://www.nature.com/articles/s41586-024-08449-y)

| Field | Value |
| --- | --- |
| `distance` | `5` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00` |
| `expected` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00` |

**Vector 7** — [Syndrome extraction for X stabilizer violation](https://arxiv.org/abs/1208.0928)

| Field | Value |
| --- | --- |
| `distance` | `3` |
| `syndromeExtraction` | Yes |
| `input` | `0000010000000000000000000000000000` |
| `expected` | `0001010000000000` |

---

[← All algorithms](../README.md)
