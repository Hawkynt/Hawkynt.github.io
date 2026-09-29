# MAYO-3

> MAYO at NIST level 3: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 10, smaller than the 108 equations, which is what makes the public key small. Signing is restored by whipping the quadratic map into 11 copies combined through matrices that represent multiplication by powers of z in a degree-108 extension of GF(16); the whipped map still vanishes on the oil space, and 11·10 ≥ 108 makes the linear system in the oil variables solvable again. Signatures are 681 octets and public keys 2986.

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
| Key sizes | 32 bytes (256 bits) |

## Parameter set details

| Name | Value |
| --- | --- |
| `name` | MAYO-3 |
| `n` | `118` |
| `m` | `108` |
| `o` | `10` |
| `k` | `11` |
| `saltBytes` | `32` |
| `digestBytes` | `48` |
| `pkSeedBytes` | `16` |
| `tail` | `08000107` |
| `whip` | `11` |
| `level` | `3` |

## Derived sizes

| Name | Value |
| --- | --- |
| `v` | `108` |
| `oBytes` | `540` |
| `vBytes` | `54` |
| `p1Bytes` | `317844` |
| `p2Bytes` | `58320` |
| `p3Bytes` | `2970` |
| `cskBytes` | `32` |
| `cpkBytes` | `2986` |
| `sigBytes` | `681` |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Under evaluation, not standardised](https://pqmayo.org/assets/specs/mayo-round3.pdf) | — | MAYO is a candidate in the NIST additional-signatures process and its parameters have already moved twice under unpublished attacks: the round-two whipping schedule was replaced because its Z matrix was not MDS, and MAYO-2 changed from n = 82 to n = 86 shortly before the round-three deadline. Treat it as experimental |
| [Round-two parameters are not interoperable](https://pqmayo.org/assets/specs/mayo-round3.pdf) | — | A round-two implementation disagrees with this one: the whipping schedule was reordered and verification gained a linear term. Signatures do not cross the version boundary |
| [Published demonstration keys](https://github.com/PQCMayo/MAYO-C) | — | The secret keys in the test vectors are printed in the source, come from a published KAT file and confer no confidentiality. Supply a secret key of 32 random octets for any use beyond demonstration |

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

**Vector 1** — [MAYO-3 KAT entry 0 (NIST round-3 additional signatures)](https://github.com/PQCMayo/MAYO-C/blob/main/KAT/PQCsignKAT_32_MAYO_3.rsp)

| Field | Value |
| --- | --- |
| `key` | `7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d` |
| `randomizer` | `8626ed79d451140800e03b59b956f8210e556067407d13dc90fa9e8b872bfb8f` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `053a904de04bc6be49ecd7cb357dd5a3 2f91716411758116007cb810cdc13a26 e3fe939ca105eb1644afc6f5eaf8b691 f8a5a1be8b92049d520c163e6e41408e …` (714 bytes; the full value is in the source) |

**Vector 2** — [MAYO-3 KAT entry 1 (NIST round-3 additional signatures)](https://github.com/PQCMayo/MAYO-C/blob/main/KAT/PQCsignKAT_32_MAYO_3.rsp)

| Field | Value |
| --- | --- |
| `key` | `4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64c81cc7cc2f513345` |
| `randomizer` | `e82fcc97ca60ccb27bf6938c975658aeb8b4d37cffbde25d97e561f36c219ade` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `521f79daf4371456e06fad989a84c5eb 203faa615d1517c745bd187e5023f08a 1587bd229e773deba27125b39b68c169 bb4510fb8876f23f72de9e9cfd735205 …` (747 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
