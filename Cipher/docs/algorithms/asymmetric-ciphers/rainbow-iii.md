# Rainbow-III

> Rainbow IIIc, the round-three parameter set over GF(256) with 68 vinegar variables and layers of 32 and 48 oil variables. A two-layer unbalanced oil and vinegar signature: the secret central map is inverted one layer at a time, the public key is that map composed with two affine transforms. Broken by Beullens in 2022 and withdrawn from standardisation; kept for its construction and its published test vectors only.

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
| `name` | Rainbow-III |
| `gfSize` | `256` |
| `v1` | `68` |
| `o1` | `32` |
| `o2` | `48` |
| `hashLen` | `48` |
| `v2` | `100` |
| `n` | `148` |
| `m` | `80` |
| `v1b` | `68` |
| `v2b` | `100` |
| `o1b` | `32` |
| `o2b` | `48` |
| `nb` | `148` |
| `mb` | `80` |
| `saltBytes` | `16` |
| `seedBytes` | `32` |
| `sigBytes` | `164` |
| `triV1` | `2346` |
| `triO1` | `528` |
| `triO2` | `1176` |
| `triN` | `11026` |
| `skSeed` | `0` |
| `skSeedSize` | `32` |
| `s1` | `32` |
| `s1Size` | `1536` |
| `t1` | `1568` |
| `t1Size` | `2176` |
| `t4` | `3744` |
| `t4Size` | `3264` |
| `t3` | `7008` |
| `t3Size` | `1536` |
| `l1F1` | `8544` |
| `l1F1Size` | `75072` |
| `l1F2` | `83616` |
| `l1F2Size` | `69632` |
| `l2F1` | `153248` |
| `l2F1Size` | `112608` |
| `l2F2` | `265856` |
| `l2F2Size` | `104448` |
| `l2F3` | `370304` |
| `l2F3Size` | `156672` |
| `l2F5` | `526976` |
| `l2F5Size` | `25344` |
| `l2F6` | `552320` |
| `l2F6Size` | `73728` |
| `skSize` | `626048` |
| `pkSeed` | `0` |
| `pkSeedSize` | `32` |
| `cQ3` | `32` |
| `cQ3Size` | `104448` |
| `cQ5` | `104480` |
| `cQ5Size` | `16896` |
| `cQ6` | `121376` |
| `cQ6Size` | `49152` |
| `cQ9` | `170528` |
| `cQ9Size` | `37632` |
| `cl2Q9` | `208160` |
| `cl2Q9Size` | `56448` |
| `cpkSize` | `264608` |
| `cskSize` | `64` |
| `pkSize` | `882080` |
| `eL1Q1` | `0` |
| `eL1Q1Size` | `75072` |
| `eL1Q2` | `75072` |
| `eL1Q2Size` | `69632` |
| `eL1Q3` | `144704` |
| `eL1Q3Size` | `104448` |
| `eL1Q5` | `249152` |
| `eL1Q5Size` | `16896` |
| `eL1Q6` | `266048` |
| `eL1Q6Size` | `49152` |
| `eL1Q9` | `315200` |
| `eL1Q9Size` | `37632` |
| `eL2Q1` | `352832` |
| `eL2Q1Size` | `112608` |
| `eL2Q2` | `465440` |
| `eL2Q2Size` | `104448` |
| `eL2Q3` | `569888` |
| `eL2Q3Size` | `156672` |
| `eL2Q5` | `726560` |
| `eL2Q5Size` | `25344` |
| `eL2Q6` | `751904` |
| `eL2Q6Size` | `73728` |
| `eL2Q9` | `825632` |
| `eL2Q9Size` | `56448` |
| `extSize` | `882080` |

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

**Vector 1** — [Rainbow-III classic KAT entry 0, reconstructed: the submission left this response file ungenerated, so the record was rebuilt from the published request seed and checked against the nistkat-sha256 1eb9bb6e63cfdbd0... that PQClean publishes over it](https://github.com/PQClean/PQClean/blob/6cd3167b397e1150289a383baef52bc6cfc9eadf/crypto_sign/rainbowIII-classic/META.yml)

| Field | Value |
| --- | --- |
| `key` | `7c9935a0b07694aa0c6d10e4db6b1add2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c86033c99a65042be545eed707341bd1 4f73ca178f2a5b244a87e847dcab29a9 086676d7a7a4b35e3904a9edd7b399b1 bd104a19373a415029bccd4c707b416e ed683f13a9189ef0bdc151116cbf6d6a 9d4bc019faa58fd770b6f567a410c700 b48c488a375c33866f3febb8dedf239c 64ff9a36f092e3d6192b9a0726b06672 a540a892fa7ba47dbe7f3e66bf394ed3 28a107b8edceb39ad2e43c6ee441f39e ce871397ac` |

**Vector 2** — [Rainbow-III circumzenithal KAT entry 0, reconstructed: the submission left this response file ungenerated, so the record was rebuilt from the published request seed and checked against the nistkat-sha256 1b5cbbdef12492ba... that PQClean publishes over it](https://github.com/PQClean/PQClean/blob/6cd3167b397e1150289a383baef52bc6cfc9eadf/crypto_sign/rainbowIII-circumzenithal/META.yml)

| Field | Value |
| --- | --- |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8451f524fef128edbe93814c041d5ed d2c8a0226e05e13942b5b832c864a961 84261745a5b530d09d51773c3e6f3c82 97e3a8e6e4dbd23e56bda10b5c3a491f 7a5d9ea819d712fc6565429f965fd726 4041e5f2007085de29930b20b187bb9e 5bc4bcac01c35cabc97f5ec6476c4213 8c3d18a1dbd23ba22b31b21bdbe5421a c1b837a793123c80e2b5028a0763872e 76e45f6aa9d675e2d667e6f68024d5ef 1143d21713` |

---

[← All algorithms](../README.md)
