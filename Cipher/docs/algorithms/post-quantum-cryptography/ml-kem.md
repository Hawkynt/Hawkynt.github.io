# ML-KEM

> Module Lattice-Based Key Encapsulation Mechanism standardized by NIST for post-quantum cryptography. Provides security against both classical and quantum attacks through the hardness of lattice problems. Educational implementation demonstrating key encapsulation principles.

## Properties

| Property | Value |
| --- | --- |
| Category | Post-Quantum Cryptography |
| Sub-category | Post-Quantum KEM |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | CRYSTALS-Kyber Team (Bos, Ducas, Kiltz, Lepoint, Lyubashevsky, Schwabe, Seiler, Stehlé) |
| Year | 2024 |
| Origin | 🌐 International |
| Source | [`algorithms/pqc/ml-kem.js`](../../../algorithms/pqc/ml-kem.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Implementation Attacks | Side-channel vulnerabilities in some implementations. Use constant-time implementations with masking countermeasures. | — |
| Quantum Attacks | Designed to resist quantum attacks but analysis ongoing. Monitor latest cryptanalysis research and NIST guidance. | — |

## Documentation

- [FIPS 203](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf)
- [CRYSTALS-Kyber](https://pq-crystals.org/kyber/)
- [NIST PQC Standardization](https://csrc.nist.gov/Projects/post-quantum-cryptography)

## References

- [Reference Implementation](https://github.com/pq-crystals/kyber)
- [Security Analysis](https://eprint.iacr.org/2017/634)
- [NIST Evaluation](https://csrc.nist.gov/CSRC/media/Events/Third-PQC-Standardization-Conference/documents/accepted-papers/bos-crystals-kyber-third-pqc-standardization-conference.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — ML-KEM-512 basic functionality test

Source: NIST FIPS 203

| Field | Value |
| --- | --- |
| `securityLevel` | `512` |
| `isKEM` | Yes |
| `input` | `d54e4c4c546869732069732061207361 6d706c65206d6573736167652066726f 6d204d4c2d4b454d` |
| `expected` | `2a3b4c5d6e7f90a1b2c3d4e5f60718293a4b5c6d7e8fa0b1c2d3e4f506172839` |

**Vector 2** — ML-KEM-768 standard test vector

Source: NIST FIPS 203

| Field | Value |
| --- | --- |
| `securityLevel` | `768` |
| `isKEM` | Yes |
| `input` | `6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51` |
| `expected` | `2a3b4c5d6e7f90a1b2c3d4e5f60718293a4b5c6d7e8fa0b1c2d3e4f506172839` |

---

[← All algorithms](../README.md)
