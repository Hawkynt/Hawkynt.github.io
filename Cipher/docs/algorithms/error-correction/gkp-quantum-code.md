# GKP Quantum Code

> Classical simulation of Gottesman-Kitaev-Preskill code, a continuous variable quantum error correction code encoding qubits into oscillator modes using grid states in phase space. Corrects displacement errors using position and momentum stabilizers on square lattice with spacing 2sqrt(pi).

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Continuous Variable Quantum Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Daniel Gottesman, Alexei Kitaev, John Preskill |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/gkp-code.js`](../../../algorithms/ecc/gkp-code.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Dephasing Sensitivity | GKP codes are very sensitive to dephasing errors. Use in low-dephasing environments or with active error mitigation. | — |
| Finite Energy Approximation | Ideal GKP states require infinite energy. Physical implementations use finite-energy approximations with parameter epsilon controlling squeezing quality. | — |
| Classical Simulation Limits | Efficient classical simulation requires Gaussian approximations. Non-Gaussian effects make simulation exponentially expensive. | — |
| Fault Tolerance Threshold | Requires displacement errors less than sqrt(pi)/6 for fault-tolerant error correction. Above threshold, error rates increase. | — |

## Documentation

- [Original Paper - Gottesman, Kitaev, Preskill (2001)](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.64.012310)
- [Error Correction Zoo - Square-Lattice GKP](https://errorcorrectionzoo.org/c/gkp)
- [PRX Quantum Review (2021)](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.2.020101)
- [Strawberry Fields GKP Tutorial](https://strawberryfields.ai/photonics/demos/run_GKP_bosonic.html)
- [GKP Lattice Perspective](https://quantum-journal.org/papers/q-2022-02-10-648/)

## References

- [D. Gottesman, A. Kitaev, J. Preskill - Encoding a qubit in an oscillator (2001)](https://journals.aps.org/pra/abstract/10.1103/PhysRevA.64.012310)
- [A. L. Grimsmo, S. Puri - Quantum Error Correction with the GKP Code](https://arxiv.org/abs/2106.12989)
- [Xanadu GKP Implementation](https://github.com/XanaduAI/approximate-GKP-prep)
- [Realistic GKP Stabilizer States](https://arxiv.org/abs/2511.03874)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Square-lattice GKP: Encode logical |0> qubit](https://errorcorrectionzoo.org/c/gkp)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `latticeSpacing` | `2.507` |
| `input` | `00` |
| `expected` | `00000000000000000000000000000000000000000000000000` |

**Vector 2** — [Square-lattice GKP: Encode logical |1> qubit](https://errorcorrectionzoo.org/c/gkp)

| Field | Value |
| --- | --- |
| `logicalState` | `1` |
| `gridSize` | `5` |
| `latticeSpacing` | `2.507` |
| `input` | `01` |
| `expected` | `00000000000000000000000000010000000000000000000000` |

**Vector 3** — [Correct small displacement error in position](https://strawberryfields.ai/photonics/demos/run_GKP_bosonic.html)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `displacementType` | position |
| `displacementAmount` | `0.5` |
| `input` | `00010000000000000000000000000000000000000000000000` |
| `expected` | `00000000000000000000000000000000000000000000000000` |

**Vector 4** — [Apply Pauli X gate via position displacement sqrt(pi)](https://strawberryfields.ai/photonics/demos/run_GKP_bosonic.html)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `gateType` | X |
| `input` | `00` |
| `expected` | `00000000000000000000000000010000000000000000000000` |

**Vector 5** — [Apply Pauli Z gate via momentum displacement sqrt(pi)](https://strawberryfields.ai/photonics/demos/run_GKP_bosonic.html)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `gateType` | Z |
| `input` | `00` |
| `expected` | `00000000000000000000000000000000000000000000000000` |

**Vector 6** — [Measure position stabilizer eigenvalue (no error)](https://errorcorrectionzoo.org/c/gkp)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `measureStabilizer` | position |
| `alpha` | `3.545` |
| `input` | `00000000000000000000000000000000000000000000000000` |
| `expected` | `01` |

**Vector 7** — [Detect displacement error via stabilizer violation](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.2.020101)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `measureStabilizer` | position |
| `alpha` | `3.545` |
| `input` | `00010000000000000000000000000000000000000000000000` |
| `expected` | `00` |

**Vector 8** — [Finite-energy GKP state with epsilon damping](https://strawberryfields.ai/photonics/demos/run_GKP_bosonic.html)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `epsilon` | `0.1` |
| `input` | `00` |
| `expected` | `00000000000000000000000000000000000000000000000000` |

**Vector 9** — [Encode-decode round trip for logical |0>](https://errorcorrectionzoo.org/c/gkp)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `roundTrip` | Yes |
| `input` | `00` |
| `expected` | `00` |

**Vector 10** — [Round-trip with small displacement error correction](https://quantum-journal.org/papers/q-2022-02-10-648/)

| Field | Value |
| --- | --- |
| `logicalState` | `0` |
| `gridSize` | `5` |
| `roundTrip` | Yes |
| `injectError` | Yes |
| `displacementAmount` | `0.5` |
| `input` | `00` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
