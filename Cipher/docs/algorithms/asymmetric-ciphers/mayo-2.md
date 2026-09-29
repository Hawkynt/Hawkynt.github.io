# MAYO-2

> MAYO at NIST level 1: an Oil-and-Vinegar signature over GF(16) whose oil space has dimension 13, smaller than the 64 equations, which is what makes the public key small. Signing is restored by whipping the quadratic map into 5 copies combined through matrices that represent multiplication by powers of z in a degree-64 extension of GF(16); the whipped map still vanishes on the oil space, and 5·13 ≥ 64 makes the linear system in the oil variables solvable again. Signatures are 239 octets and public keys 2928.

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
| Key sizes | 24 bytes (192 bits) |

## Parameter set details

| Name | Value |
| --- | --- |
| `name` | MAYO-2 |
| `n` | `86` |
| `m` | `64` |
| `o` | `13` |
| `k` | `5` |
| `saltBytes` | `24` |
| `digestBytes` | `32` |
| `pkSeedBytes` | `16` |
| `tail` | `08000208` |
| `whip` | `5` |
| `level` | `1` |

## Derived sizes

| Name | Value |
| --- | --- |
| `v` | `73` |
| `oBytes` | `475` |
| `vBytes` | `37` |
| `p1Bytes` | `86432` |
| `p2Bytes` | `30368` |
| `p3Bytes` | `2912` |
| `cskBytes` | `24` |
| `cpkBytes` | `2928` |
| `sigBytes` | `239` |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Under evaluation, not standardised](https://pqmayo.org/assets/specs/mayo-round3.pdf) | — | MAYO is a candidate in the NIST additional-signatures process and its parameters have already moved twice under unpublished attacks: the round-two whipping schedule was replaced because its Z matrix was not MDS, and MAYO-2 changed from n = 82 to n = 86 shortly before the round-three deadline. Treat it as experimental |
| [Round-two parameters are not interoperable](https://pqmayo.org/assets/specs/mayo-round3.pdf) | — | A round-two implementation disagrees with this one: the whipping schedule was reordered and verification gained a linear term. Signatures do not cross the version boundary |
| [Published demonstration keys](https://github.com/PQCMayo/MAYO-C) | — | The secret keys in the test vectors are printed in the source, come from a published KAT file and confer no confidentiality. Supply a secret key of 24 random octets for any use beyond demonstration |

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

**Vector 1** — [MAYO-2 KAT entry 0 (NIST round-3 additional signatures)](https://github.com/PQCMayo/MAYO-C/blob/main/KAT/PQCsignKAT_24_MAYO_2.rsp)

| Field | Value |
| --- | --- |
| `key` | `7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb14803` |
| `randomizer` | `8626ed79d451140800e03b59b956f8210e556067407d13dc` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `7afea7506473b4e69557362cbfc6623d b51478bc05fba14a837ee440ef31ffcb dc51c9d7604ab7b87042897faed5a375 ad62cce65590815fa66045a86e028d86 …` (272 bytes; the full value is in the source) |

**Vector 2** — [MAYO-2 KAT entry 1 (NIST round-3 additional signatures)](https://github.com/PQCMayo/MAYO-C/blob/main/KAT/PQCsignKAT_24_MAYO_2.rsp)

| Field | Value |
| --- | --- |
| `key` | `4b622de1350119c45a9f2e2ef3dc5df50a759d138cdfbd64` |
| `randomizer` | `e82fcc97ca60ccb27bf6938c975658aeb8b4d37cffbde25d` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `b3a8e9f2c0d1739194923c49b794a4f4 39d9afdb7bc63f9ad3128099e36ee9ce 57447d316d2a50b8c7d99be0ceb9b277 78e28d85d3c2590a5cce6dfcd4bc5dc9 …` (305 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
