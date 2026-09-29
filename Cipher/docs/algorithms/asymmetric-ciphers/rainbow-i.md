# Rainbow-I

> Rainbow Ia, the round-three parameter set over GF(16) with 36 vinegar variables and layers of 32 and 32 oil variables. A two-layer unbalanced oil and vinegar signature: the secret central map is inverted one layer at a time, the public key is that map composed with two affine transforms. Broken by Beullens in 2022 and withdrawn from standardisation; kept for its construction and its published test vectors only.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Multivariate Digital Signature |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Jintai Ding, Dieter Schmidt |
| Year | 2005 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/rainbow.js`](../../../algorithms/asymmetric/rainbow.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) to 64 bytes (512 bits) in steps of 32 bytes |

## Parameter set details

| Name | Value |
| --- | --- |
| `name` | Rainbow-I |
| `gfSize` | `16` |
| `v1` | `36` |
| `o1` | `32` |
| `o2` | `32` |
| `hashLen` | `32` |
| `v2` | `68` |
| `n` | `100` |
| `m` | `64` |
| `v1b` | `18` |
| `v2b` | `34` |
| `o1b` | `16` |
| `o2b` | `16` |
| `nb` | `50` |
| `mb` | `32` |
| `saltBytes` | `16` |
| `seedBytes` | `32` |
| `sigBytes` | `66` |
| `triV1` | `666` |
| `triO1` | `528` |
| `triO2` | `528` |
| `triN` | `5050` |
| `skSeed` | `0` |
| `skSeedSize` | `32` |
| `s1` | `32` |
| `s1Size` | `512` |
| `t1` | `544` |
| `t1Size` | `576` |
| `t4` | `1120` |
| `t4Size` | `576` |
| `t3` | `1696` |
| `t3Size` | `512` |
| `l1F1` | `2208` |
| `l1F1Size` | `10656` |
| `l1F2` | `12864` |
| `l1F2Size` | `18432` |
| `l2F1` | `31296` |
| `l2F1Size` | `10656` |
| `l2F2` | `41952` |
| `l2F2Size` | `18432` |
| `l2F3` | `60384` |
| `l2F3Size` | `18432` |
| `l2F5` | `78816` |
| `l2F5Size` | `8448` |
| `l2F6` | `87264` |
| `l2F6Size` | `16384` |
| `skSize` | `103648` |
| `pkSeed` | `0` |
| `pkSeedSize` | `32` |
| `cQ3` | `32` |
| `cQ3Size` | `18432` |
| `cQ5` | `18464` |
| `cQ5Size` | `8448` |
| `cQ6` | `26912` |
| `cQ6Size` | `16384` |
| `cQ9` | `43296` |
| `cQ9Size` | `8448` |
| `cl2Q9` | `51744` |
| `cl2Q9Size` | `8448` |
| `cpkSize` | `60192` |
| `cskSize` | `64` |
| `pkSize` | `161600` |
| `eL1Q1` | `0` |
| `eL1Q1Size` | `10656` |
| `eL1Q2` | `10656` |
| `eL1Q2Size` | `18432` |
| `eL1Q3` | `29088` |
| `eL1Q3Size` | `18432` |
| `eL1Q5` | `47520` |
| `eL1Q5Size` | `8448` |
| `eL1Q6` | `55968` |
| `eL1Q6Size` | `16384` |
| `eL1Q9` | `72352` |
| `eL1Q9Size` | `8448` |
| `eL2Q1` | `80800` |
| `eL2Q1Size` | `10656` |
| `eL2Q2` | `91456` |
| `eL2Q2Size` | `18432` |
| `eL2Q3` | `109888` |
| `eL2Q3Size` | `18432` |
| `eL2Q5` | `128320` |
| `eL2Q5Size` | `8448` |
| `eL2Q6` | `136768` |
| `eL2Q6Size` | `16384` |
| `eL2Q9` | `153152` |
| `eL2Q9Size` | `8448` |
| `extSize` | `161600` |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Key recovery in a weekend](https://eprint.iacr.org/2022/214) | Beullens' rectangle MinRank attack finds the secret subspace of the second layer directly from the public key. The published attack recovers a Rainbow-I private key in about 53 hours on a laptop, against a claimed 2^128 of security, and the same method reduces the larger parameter sets well below their claims | None. The scheme is broken as specified; NIST dropped it at the end of the third round. Use a signature that is still standing |
| [Withdrawn from standardisation](https://doi.org/10.6028/NIST.IR.8413) | Rainbow was a third-round finalist and was not selected. No parameter set was raised to restore the claimed levels, and the scheme has no successor here | Use ML-DSA (FIPS 204), SLH-DSA (FIPS 205) or Falcon |
| [Published demonstration keys](https://eprint.iacr.org/2022/214) | The seeds in the test vectors are printed in this file, derive from published Known Answer Test data and confer no secrecy whatever | Nothing here is usable as a key. The scheme itself is broken, so there is no safe way to supply a real one either |

## Documentation

- [Rainbow round-three specification](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip)
- [NIST post-quantum project, round-three signatures](https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions)
- [Rainbow, a new multivariable polynomial signature scheme (Ding and Schmidt, 2005)](https://doi.org/10.1007/11496137_12)

## References

- [Breaking Rainbow takes a weekend on a laptop (Beullens, 2022)](https://eprint.iacr.org/2022/214)
- [NIST status report on the third round](https://doi.org/10.6028/NIST.IR.8413)
- [Improved cryptanalysis of UOV and Rainbow (Beullens, 2021)](https://eprint.iacr.org/2020/1343)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rainbow-I Ia Circumzenithal KAT entry 0](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip)

| Field | Value |
| --- | --- |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88847ec401b4b72631083a138e29d23 23d1759d7268af6b3edb06762722491f a2bc3e93dd9a10a995f9b38ab6c65b60 8ac9fe4b9a9e38ee4622d5bc61d8e1fe 912433` |

**Vector 2** — [Rainbow-I Ia Circumzenithal KAT entry 1](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip)

| Field | Value |
| --- | --- |
| `key` | `e82fcc97ca60ccb27bf6938c975658ae b8b4d37cffbde25d97e561f36c219ade 4b622de1350119c45a9f2e2ef3dc5df5 0a759d138cdfbd64c81cc7cc2f513345` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd4992f541ac65b6f3240547be53b796 eb3581385f9d4a0ef041c833feae4403 5730493c10ceefe90bfc61cc58d8eff7 12232740d0bd6e49bd95099f3cfa73ed ae6777a8` |

**Vector 3** — [Rainbow-I Ia Circumzenithal KAT entry 2](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip)

| Field | Value |
| --- | --- |
| `key` | `f333d36590910e7a5a6cbe567bcdd154 137eef62b92bf8dc1fdc900e7c194e5f 1d836e889e46259bcd1ccd2b369583c5 b47cfbb919ec2b72c280247cb15a5569` |
| `input` | `2b8c4b0f29363eaee469a7e33524538a a066ae98980eaa19d1f10593203da214 3b9e9e1973f7ff0e6c6aaa3c0b900e50 d003412efe96deece3046d8c46bc7709 228789775abdf56aed6416c90033780c b7a4984815da1b14660dcf34aa34bf82 cebbcf` |
| `expected` | `2b8c4b0f29363eaee469a7e33524538a a066ae98980eaa19d1f10593203da214 3b9e9e1973f7ff0e6c6aaa3c0b900e50 d003412efe96deece3046d8c46bc7709 228789775abdf56aed6416c90033780c b7a4984815da1b14660dcf34aa34bf82 cebbcfa7d2035a4219d6accf47a7a974 78f1b48c3e5eb9fb69b323fe3b14f9b8 7c45dc3650ddc23c09f010234f14c0f4 9f6cadc6d919ccf0912ae76f9bdb0d8d 0ac37e7473` |

---

[← All algorithms](../README.md)
