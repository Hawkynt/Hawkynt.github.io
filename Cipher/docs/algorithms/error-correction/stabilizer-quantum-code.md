# Stabilizer Quantum Code

> Most general framework for quantum error correction using stabilizer formalism. Stabilizer group S consists of commuting Pauli operators that define the code space as the simultaneous +1 eigenspace of all stabilizers. Includes CSS codes, Shor code, and surface codes as special cases. This implementation demonstrates the [[5,1,3]] five-qubit perfect code - the smallest quantum code that can correct an arbitrary single-qubit error. Foundation of fault-tolerant quantum computing.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Quantum Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Daniel Gottesman |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/stabilizer-quantum-code.js`](../../../algorithms/ecc/stabilizer-quantum-code.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsErrorDetection` | Yes |
| `supportsErrorCorrection` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Gottesman's PhD Thesis](https://arxiv.org/abs/quant-ph/9705052)
- [Error Correction Zoo - Stabilizer Codes](https://errorcorrectionzoo.org/c/stabilizer)
- [Nielsen&Chuang - Quantum Computation](http://mmrc.amss.cas.cn/tlb/201702/W020170224608149940643.pdf)
- [Five-Qubit Code](https://errorcorrectionzoo.org/c/stab_5_1_3)
- [Stabilizer Formalism - Wikipedia](https://en.wikipedia.org/wiki/Stabilizer_code)
- [Quantum Error Correction Tutorial](https://arxiv.org/abs/0904.2557)

## References

- [Five-Qubit Stabilizer Code Implementation (Qiskit)](https://github.com/bernwo/five-qubit-code)
- [Qiskit StabilizerState Implementation](https://github.com/Qiskit/qiskit/blob/main/qiskit/quantum_info/states/stabilizerstate.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Five-qubit code encode logical |0⟩](https://errorcorrectionzoo.org/c/stab_5_1_3)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `0000000000` |

**Vector 2** — [Five-qubit code encode logical |1⟩](https://errorcorrectionzoo.org/c/stab_5_1_3)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `0101010101` |

**Vector 3** — [Encode two logical qubits](https://errorcorrectionzoo.org/c/stab_5_1_3)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `00000000000101010101` |

---

[← All algorithms](../README.md)
