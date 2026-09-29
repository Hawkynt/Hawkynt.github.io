# Rainbow-V

> Rainbow Vc, the round-three parameter set over GF(256) with 96 vinegar variables and layers of 36 and 64 oil variables. A two-layer unbalanced oil and vinegar signature: the secret central map is inverted one layer at a time, the public key is that map composed with two affine transforms. Broken by Beullens in 2022 and withdrawn from standardisation; kept for its construction and its published test vectors only.

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
| `name` | Rainbow-V |
| `gfSize` | `256` |
| `v1` | `96` |
| `o1` | `36` |
| `o2` | `64` |
| `hashLen` | `64` |
| `v2` | `132` |
| `n` | `196` |
| `m` | `100` |
| `v1b` | `96` |
| `v2b` | `132` |
| `o1b` | `36` |
| `o2b` | `64` |
| `nb` | `196` |
| `mb` | `100` |
| `saltBytes` | `16` |
| `seedBytes` | `32` |
| `sigBytes` | `212` |
| `triV1` | `4656` |
| `triO1` | `666` |
| `triO2` | `2080` |
| `triN` | `19306` |
| `skSeed` | `0` |
| `skSeedSize` | `32` |
| `s1` | `32` |
| `s1Size` | `2304` |
| `t1` | `2336` |
| `t1Size` | `3456` |
| `t4` | `5792` |
| `t4Size` | `6144` |
| `t3` | `11936` |
| `t3Size` | `2304` |
| `l1F1` | `14240` |
| `l1F1Size` | `167616` |
| `l1F2` | `181856` |
| `l1F2Size` | `124416` |
| `l2F1` | `306272` |
| `l2F1Size` | `297984` |
| `l2F2` | `604256` |
| `l2F2Size` | `221184` |
| `l2F3` | `825440` |
| `l2F3Size` | `393216` |
| `l2F5` | `1218656` |
| `l2F5Size` | `42624` |
| `l2F6` | `1261280` |
| `l2F6Size` | `147456` |
| `skSize` | `1408736` |
| `pkSeed` | `0` |
| `pkSeedSize` | `32` |
| `cQ3` | `32` |
| `cQ3Size` | `221184` |
| `cQ5` | `221216` |
| `cQ5Size` | `23976` |
| `cQ6` | `245192` |
| `cQ6Size` | `82944` |
| `cQ9` | `328136` |
| `cQ9Size` | `74880` |
| `cl2Q9` | `403016` |
| `cl2Q9Size` | `133120` |
| `cpkSize` | `536136` |
| `cskSize` | `64` |
| `pkSize` | `1930600` |
| `eL1Q1` | `0` |
| `eL1Q1Size` | `167616` |
| `eL1Q2` | `167616` |
| `eL1Q2Size` | `124416` |
| `eL1Q3` | `292032` |
| `eL1Q3Size` | `221184` |
| `eL1Q5` | `513216` |
| `eL1Q5Size` | `23976` |
| `eL1Q6` | `537192` |
| `eL1Q6Size` | `82944` |
| `eL1Q9` | `620136` |
| `eL1Q9Size` | `74880` |
| `eL2Q1` | `695016` |
| `eL2Q1Size` | `297984` |
| `eL2Q2` | `993000` |
| `eL2Q2Size` | `221184` |
| `eL2Q3` | `1214184` |
| `eL2Q3Size` | `393216` |
| `eL2Q5` | `1607400` |
| `eL2Q5Size` | `42624` |
| `eL2Q6` | `1650024` |
| `eL2Q6Size` | `147456` |
| `eL2Q9` | `1797480` |
| `eL2Q9Size` | `133120` |
| `extSize` | `1930600` |

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

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rainbow-V Vc Classic KAT entry 0](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip)

| Field | Value |
| --- | --- |
| `key` | `7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c815040f890f2bf56f8b04b1d8b9ba21 d303c490868a0a10c9ffc04a2af9d1f3 122d14f7c6d5e0b1d914cc23d763c061 b2fd34df8cb0d75f12111244241fa7a1 36c440c2d40782390fe5ef3c15ed5539 285b437da0447e361853e98982e1f16a a0506babffbba8282baa0a307c50eba7 9596ad26ebece897e7b4de3b601a515c 08775526522915ed03f08baa23afed42 24c8e50ed67fbccfab62c58872ce880c 850d3a03f21b2703c5c085fa410a5fcb 3559e50d6bbc6a06faba309962f2922e 0d014c5eb074090543c9478050169fcc fbc0e9ba11` |

**Vector 2** — [Rainbow-V Vc Circumzenithal KAT entry 0](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/Rainbow-Round3.zip)

| Field | Value |
| --- | --- |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8d1f97d1310f57af3509f66307985b7 f341234ce8f7516e4b61f9e53b1282ce 66b9526321c66954e1753d1a9c8ba401 2b9c5a211f0287c72705141f71a9aaec 350e81f6ec67ed10e1bd61dcdfa4ac87 553563e0fee31927e5877741d5dcdf03 c44e50cf80bb3d15856af49f2c68a7ed ac52fd2957f96a7113dce51785edf0ab 8538c1eaad694e8514cdc7872664412b cf9884c185bade87781016826e32e08c 1ec6275c6f8588a11ff6575d704505d4 ab794d047bec1104c00dad3bcfc2de42 267b3552bd74090543c9478050169fcc fbc0e9ba11` |

---

[← All algorithms](../README.md)
