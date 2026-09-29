# Cat Code

> Bosonic quantum error correction using superpositions of coherent states (cat states) in cavity modes. Encodes qubit as |0⟩ = (|α⟩+|-α⟩)/N and |1⟩ = (|α⟩-|-α⟩)/N. Protects against photon loss with exponential bit-flip suppression scaling as e^(-2α²). Developed by Mirrahimi, Leghtas, and Albert (2014). Experimentally implemented in superconducting circuits by Alice&Bob quantum computing.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Bosonic Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Mazyar Mirrahimi, Zaki Leghtas, Victor Albert |
| Year | 2014 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/ecc/cat-code.js`](../../../algorithms/ecc/cat-code.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Phase-Flip Vulnerability | Cat codes suppress bit-flip errors exponentially with \|α\|² but phase-flip errors increase linearly. Requires concatenation with outer codes (e.g., surface code) for full protection. Typical approach: cat code suppresses bit-flips, outer code corrects phase-flips. | — |
| Coherent State Approximation | Classical simulation uses truncated Fock basis representation. Real quantum implementation requires cavity QED hardware with strong dispersive coupling and multi-photon driven dissipation for autonomous error correction. | — |
| Limited Distance | Two-component cat code (S=1) can detect single photon loss. Higher-component codes (S>1) required for correcting multiple losses, increasing hardware complexity. | — |
| Decoherence Time | Cat state coherence requires cavity quality factor Q > 10⁶ and temperatures T &lt; 50 mK. Experimental lifetimes reach 1-10ms for \|α\|=2, limiting gate operation speeds. | — |

## Documentation

- [Error Correction Zoo - Cat Code](https://errorcorrectionzoo.org/c/cat)
- [Error Correction Zoo - Two-Component Cat Code](https://errorcorrectionzoo.org/c/two-legged-cat)
- [Mirrahimi et al. - Dynamically Protected Cat-Qubits (2014)](https://arxiv.org/abs/1312.2017)
- [Grimm et al. - Stabilization of Cat Qubits (2020)](https://www.nature.com/articles/s41586-020-2587-z)
- [Alice&Bob - Cat Qubit Explained](https://alice-bob.com/blog/cat-qubit-explained-with-photonics/)
- [Microsoft Azure - Cat Qubits Resource Estimator](https://quantum.microsoft.com/en-us/insights/blogs/qsharp/evaluating-cat-qubits-for-fault-tolerant-quantum-computing-using-azure-quantum-resource-estimator)

## References

- [Leghtas et al. - Hardware-Efficient Autonomous QEC (2015)](https://arxiv.org/abs/1207.0679)
- [Albert et al. - Performance and Structure of Cat Codes (2019)](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.97.032346)
- [Campagne-Ibarcq et al. - Quantum Error Correction of Cat Qubit (2020)](https://www.nature.com/articles/s41586-020-2603-3)
- [Puri et al. - Stabilized Cat in Driven Nonlinear Cavity (2017)](https://www.science.org/doi/10.1126/sciadv.1701626)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Encode logical |0⟩ as even cat state with α=2.0](https://errorcorrectionzoo.org/c/two-legged-cat)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `input` | `00` |
| `expected` | `00` |

**Vector 2** — [Encode logical |1⟩ as odd cat state with α=2.0](https://errorcorrectionzoo.org/c/two-legged-cat)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `input` | `01` |
| `expected` | `01` |

**Vector 3** — [Photon parity measurement on even cat state (no errors)](https://arxiv.org/abs/1312.2017)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `parityMeasurement` | Yes |
| `input` | `00` |
| `expected` | `00` |

**Vector 4** — [Photon parity measurement on odd cat state (no errors)](https://arxiv.org/abs/1312.2017)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `parityMeasurement` | Yes |
| `input` | `01` |
| `expected` | `01` |

**Vector 5** — [Encode with smaller coherent amplitude α=1.0](https://errorcorrectionzoo.org/c/cat)

| Field | Value |
| --- | --- |
| `alpha` | `1` |
| `input` | `00` |
| `expected` | `00` |

**Vector 6** — [Encode with larger coherent amplitude α=3.0 (enhanced bit-flip suppression)](https://alice-bob.com/blog/cat-qubit-explained-with-photonics/)

| Field | Value |
| --- | --- |
| `alpha` | `3` |
| `input` | `01` |
| `expected` | `01` |

**Vector 7** — [Single photon loss error detection and recovery](https://www.nature.com/articles/s41586-020-2587-z)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `simulatePhotonLoss` | Yes |
| `input` | `00` |
| `expected` | `00` |

**Vector 8** — [Encode two logical qubits in separate cavity modes](https://errorcorrectionzoo.org/c/cat)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `input` | `0001` |
| `expected` | `0001` |

**Vector 9** — [Verify cat state fidelity remains high (F > 0.99) for α=2](https://www.nature.com/articles/s41586-020-2603-3)

| Field | Value |
| --- | --- |
| `alpha` | `2` |
| `checkFidelity` | Yes |
| `minFidelity` | `0.99` |
| `input` | `00` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
