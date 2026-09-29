# MAYO-5

> MAYO at NIST level 5: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 12, smaller than the 142 equations, which is what makes the public key small. Signing is restored by whipping the quadratic map into 12 copies combined through matrices that represent multiplication by powers of z in a degree-142 extension of GF(16); the whipped map still vanishes on the oil space, and 12·12 ≥ 142 makes the linear system in the oil variables solvable again. Signatures are 964 octets and public keys 5554.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Multivariate Digital Signature |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Ward Beullens, Fabio Campos, Sofía Celi, Basil Hess, Matthias J. Kannwischer |
| Year | 2021 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/asymmetric/mayo.js`](../../../algorithms/asymmetric/mayo.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 40 bytes (320 bits) |

## Parameter set details

| Name | Value |
| --- | --- |
| `name` | MAYO-5 |
| `n` | `154` |
| `m` | `142` |
| `o` | `12` |
| `k` | `12` |
| `saltBytes` | `40` |
| `digestBytes` | `64` |
| `pkSeedBytes` | `16` |
| `tail` | `04000801` |
| `whip` | `12` |
| `level` | `5` |

## Derived sizes

| Name | Value |
| --- | --- |
| `v` | `142` |
| `oBytes` | `852` |
| `vBytes` | `71` |
| `p1Bytes` | `720863` |
| `p2Bytes` | `120984` |
| `p3Bytes` | `5538` |
| `cskBytes` | `40` |
| `cpkBytes` | `5554` |
| `sigBytes` | `964` |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Under evaluation, not standardised](https://pqmayo.org/assets/specs/mayo-round3.pdf) | — | MAYO is a candidate in the NIST additional-signatures process and its parameters have already moved twice under unpublished attacks: the round-two whipping schedule was replaced because its Z matrix was not MDS, and MAYO-2 changed from n = 82 to n = 86 shortly before the round-three deadline. Treat it as experimental |
| [Round-two parameters are not interoperable](https://pqmayo.org/assets/specs/mayo-round3.pdf) | — | A round-two implementation disagrees with this one: the whipping schedule was reordered and verification gained a linear term. Signatures do not cross the version boundary |
| [Published demonstration keys](https://github.com/PQCMayo/MAYO-C) | — | The secret keys in the test vectors are printed in the source, come from a published KAT file and confer no confidentiality. Supply a secret key of 40 random octets for any use beyond demonstration |

## Documentation

- [MAYO specification, round 3](https://pqmayo.org/assets/specs/mayo-round3.pdf)
- [MAYO project site](https://pqmayo.org/)
- [Beullens - MAYO: Practical Post-Quantum Signatures from Oil-and-Vinegar Maps (SAC 2021)](https://eprint.iacr.org/2021/1144)
- [NIST PQC additional digital signature schemes](https://csrc.nist.gov/projects/pqc-dig-sig/round-3-additional-signatures)

## References

- [MAYO-C reference implementation and KAT files](https://github.com/PQCMayo/MAYO-C)
- [MAYO-sage reference implementation](https://github.com/PQCMayo/MAYO-sage)
- [FIPS 202 - SHA-3 and the SHAKE functions](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MAYO-5 KAT entry 0 (NIST round-3 additional signatures)](https://github.com/PQCMayo/MAYO-C/blob/main/KAT/PQCsignKAT_40_MAYO_5.rsp)

| Field | Value |
| --- | --- |
| `key` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b4974` |
| `randomizer` | `33b3c07507e4201748494d832b6ee2a6 c93bff9b0ee343b550d1f85a3d0de0d7 04c6d17842951309` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `9f77e9b30b56547579e95d8c4c3f6904 a9624a9606db56d4269f30f17fa04af3 ee5f194ede5f74e0c38788972f793c7e 50513226b9ef28193b74989ee9ffa8cd …` (997 bytes; the full value is in the source) |

**Vector 2** — [MAYO-5 KAT entry 1 (NIST round-3 additional signatures)](https://github.com/PQCMayo/MAYO-C/blob/main/KAT/PQCsignKAT_40_MAYO_5.rsp)

| Field | Value |
| --- | --- |
| `key` | `4b622de1350119c45a9f2e2ef3dc5df5 0a759d138cdfbd64c81cc7cc2f513345 d5a45a4ced06403c` |
| `randomizer` | `08e25538484cd7f1613248fe6c9f6b4e c14be684c6defdd1e41333b6e9052ac4 340e314eea2c99f7` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `15db05faa3a08fb2077ca65be466b6e1 fc9139e696e7852938742949180b4ca5 99f5007a7885204522f027e5d163db76 c6a71779bf6674462a007e681fedc8cc …` (1030 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
