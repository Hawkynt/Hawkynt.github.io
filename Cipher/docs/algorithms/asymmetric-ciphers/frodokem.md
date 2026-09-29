# FrodoKEM

> Learning With Errors Key Encapsulation Mechanism. Conservative lattice-based post-quantum cryptography using unstructured lattices and standard LWE assumption. Educational implementation of NIST PQC finalist.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | LWE-Based Post-Quantum KEM |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Joppe Bos, Craig Costello, Léo Ducas, Ilya Mironov, Michael Naehrig, Valeria Nikolaenko, Ananth Raghunathan, Douglas Stebila |
| Year | 2016 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/frodokem.js`](../../../algorithms/asymmetric/frodokem.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 640 bytes (5120 bits); 976 bytes (7808 bits); 1344 bytes (10752 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Lattice Reduction | Vulnerable to lattice reduction attacks if LWE parameters are insufficient. Use conservative parameters with sufficient noise and dimension. | — |
| Timing Attacks | Variable-time operations can leak information about secret keys. Implement constant-time operations and protect against side-channels. | — |

## Documentation

- [FrodoKEM Official Site](https://frodokem.org/)
- [NIST PQC Round 3 FrodoKEM](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/FrodoKEM-Round3.zip)
- [Learning With Errors Problem](https://en.wikipedia.org/wiki/Learning_with_errors)
- [Lattice-Based Cryptography](https://en.wikipedia.org/wiki/Lattice-based_cryptography)

## References

- [FrodoKEM Reference Implementation](https://github.com/Microsoft/FrodoKEM)
- [Standard LWE Paper](https://eprint.iacr.org/2016/659)
- [NIST PQC Competition](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [Regev's LWE](https://cims.nyu.edu/~regev/papers/lwesurvey.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FrodoKEM-640 round-trip under the parameter set named 640](https://frodokem.org/files/FrodoKEM-specification-20210604.pdf)

| Field | Value |
| --- | --- |
| `key` | `363430` |
| `input` | `01020304050607080910111213141516` |
| `expected` | `01020304050607080910111213141516` |

**Vector 2** — [FrodoKEM-976 round-trip under the parameter set named 976](https://frodokem.org/files/FrodoKEM-specification-20210604.pdf)

| Field | Value |
| --- | --- |
| `key` | `393736` |
| `input` | `deadbeefcafebabe0123456789abcdef` |
| `expected` | `deadbeefcafebabe0123456789abcdef` |

**Vector 3** — [FrodoKEM-1344 round-trip under the parameter set named 1344](https://frodokem.org/files/FrodoKEM-specification-20210604.pdf)

| Field | Value |
| --- | --- |
| `key` | `31333434` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |

---

[← All algorithms](../README.md)
