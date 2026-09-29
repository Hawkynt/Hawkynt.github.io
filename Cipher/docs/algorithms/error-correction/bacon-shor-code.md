# Bacon-Shor Code

> Subsystem quantum error correction code combining Shor's 9-qubit code concepts with gauge freedom. [[9,1,3]] configuration encodes 1 logical qubit in 9 physical qubits arranged in 3×3 lattice with distance 3. Uses X-gauge and Z-gauge operators for error correction without full syndrome extraction, enabling simpler two-qubit measurements compared to stabilizer codes. Gauge subsystems provide fault-tolerant error correction without entangled ancillary states. Used in quantum computing research at IonQ, Rigetti.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Subsystem Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Dave Bacon, Peter Shor |
| Year | 2006 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/bacon-shor-code.js`](../../../algorithms/ecc/bacon-shor-code.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsErrorDetection` | Yes |
| `supportsErrorCorrection` | Yes |
| `isSubsystemCode` | Yes |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Error Correction Only | [[9,1,3]] Bacon-Shor code can correct only 1 arbitrary qubit error. Multiple errors cause decoding failure. Larger lattices (e.g., 5×5 for distance 5) needed for higher error tolerance. | — |
| Gauge Qubit Overhead | Encodes 1 logical qubit into 9 physical qubits with 4 gauge degrees of freedom (9 = 1 logical + 4 stabilizers + 4 gauge). High overhead compared to LDPC quantum codes. | — |
| Classical Simulation Approximation | This implementation represents quantum states as classical bit arrays for educational purposes. Real quantum Bacon-Shor codes preserve superposition and require quantum hardware with proper syndrome measurement circuits. | — |
| Correlated Errors | Gauge freedom simplifies syndrome extraction but can mask certain correlated error patterns. Fault-tolerant protocols required for practical quantum computing applications. | — |

## Documentation

- [Error Correction Zoo - Bacon-Shor Code](https://errorcorrectionzoo.org/c/bacon_shor)
- [Bacon-Shor Code - Wikipedia](https://en.wikipedia.org/wiki/Bacon%E2%80%93Shor_code)
- [Original Paper - Bacon (2006)](https://arxiv.org/abs/quant-ph/0506023)
- [Subsystem Fault Tolerance (IBM)](https://arxiv.org/abs/1708.02821)
- [Comparing Shor and Steane Error Correction](https://www.science.org/doi/10.1126/sciadv.adp2008)
- [Quantum Error Correction Tutorial](https://arxiv.org/abs/0905.2794)

## References

- [Bacon - Operator Quantum Error Correction](https://arxiv.org/abs/quant-ph/0506023)
- [Poulin - Unified Framework for Subsystem Codes](https://arxiv.org/abs/quant-ph/0601066)
- [Ahn et al. - Fault-Tolerant Bacon-Shor Code](https://arxiv.org/abs/1708.02821)
- [Dynamical Logical Qubits](https://arxiv.org/abs/2403.03291)
- [Improved Performance with Steane's Method](https://arxiv.org/abs/2403.01659)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Bacon-Shor [[9,1,3]] encode OpCodes.OrN(logical, 0)⟩](https://errorcorrectionzoo.org/c/bacon_shor)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `000000000000000000` |

**Vector 2** — [Bacon-Shor [[9,1,3]] encode OpCodes.OrN(logical, 1)⟩](https://errorcorrectionzoo.org/c/bacon_shor)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `010101000000000000` |

**Vector 3** — [Encode two logical qubits in Bacon-Shor code](https://errorcorrectionzoo.org/c/bacon_shor)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `000000000000000000010101000000000000` |

---

[← All algorithms](../README.md)
