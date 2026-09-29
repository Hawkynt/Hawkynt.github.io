# Bicycle Code

> Quantum LDPC code using bicycle graph construction with circulant matrices. Stabilizer generator matrix has structure H_X = H_Z = (A|A^T) where A is circulant and commutes with its transpose. First quantum LDPC codes, enabling efficient syndrome measurement with sparse parity checks. Used in Microsoft's topological quantum computing approach and recent quantum computing research.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | David MacKay, Graeme Mitchison, Paul McFadden |
| Year | 2004 |
| Origin | Not specified |
| Source | [`algorithms/ecc/bicycle-code.js`](../../../algorithms/ecc/bicycle-code.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 2 bytes (16 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsErrorDetection` | Yes |
| `supportsErrorCorrection` | Yes |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Error Correction | The [[6,2,2]] bicycle code has distance d=2, which only allows error detection, not correction. Larger bicycle codes with higher distance are needed for actual error correction. | — |
| Circulant Commutation Constraint | Not all circulant matrices commute with their transpose. The choice of first row must be carefully selected to satisfy A·A^T = A^T·A for valid bicycle code construction. | — |
| Classical Simulation Limitations | This implementation represents quantum states as classical bit arrays for educational purposes. Real quantum bicycle codes operate on superposition states requiring quantum hardware. | — |
| Decoding Complexity | LDPC decoding via belief propagation can have high computational complexity and may not converge for all error patterns, especially near the error floor. | — |

## Documentation

- [Error Correction Zoo - Bicycle Code](https://errorcorrectionzoo.org/c/bicycle)
- [MacKay et al. - Sparse Graph Codes](https://arxiv.org/abs/quant-ph/0304161)
- [IEEE Publication](https://ieeexplore.ieee.org/document/1337106)
- [Generalized Bicycle Codes](https://errorcorrectionzoo.org/c/generalized_bicycle)
- [Microsoft Quantum - Bicycle Codes](https://www.microsoft.com/en-us/research/project/quantum-computing/)

## References

- [Sparse Graph Codes for Quantum Error-Correction (2004)](https://arxiv.org/abs/quant-ph/0304161)
- [IEEE Trans. Info Theory Vol. 50 (2004)](https://ieeexplore.ieee.org/document/1337106)
- [Gottesman - Stabilizer Codes](https://arxiv.org/abs/quant-ph/9705052)
- [Distance Bounds for Generalized Bicycle Codes](https://arxiv.org/abs/2203.17216)
- [List Decoding and New Bicycle Code Constructions](https://arxiv.org/abs/2511.02951)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Bicycle [[6,2,2]] encode logical |00⟩](https://errorcorrectionzoo.org/c/bicycle)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `000000000000` |

**Vector 2** — [Bicycle [[6,2,2]] encode logical |01⟩](https://errorcorrectionzoo.org/c/bicycle)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `000000010101` |

**Vector 3** — [Bicycle [[6,2,2]] encode logical |10⟩](https://errorcorrectionzoo.org/c/bicycle)

| Field | Value |
| --- | --- |
| `input` | `0100` |
| `expected` | `010101000000` |

**Vector 4** — [Bicycle [[6,2,2]] encode logical |11⟩](https://errorcorrectionzoo.org/c/bicycle)

| Field | Value |
| --- | --- |
| `input` | `0101` |
| `expected` | `010101010101` |

---

[← All algorithms](../README.md)
