# cSHAKE256

> cSHAKE256 is a customizable extendable-output function based on SHAKE256 from NIST SP 800-185. Supports function name and customization string parameters for domain separation.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Extendable-Output Function |
| Variant | 256 |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | NIST |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/cshake.js`](../../../algorithms/hash/cshake.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
- [Keccak Team](https://keccak.team/)

## References

- [BouncyCastle Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/CSHAKEDigest.java)
- [NIST Examples](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [cSHAKE256: 00010203, S='Email Signature', 64 bytes (NIST)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf)

| Field | Value |
| --- | --- |
| `customization` | `456d61696c205369676e6174757265` |
| `outputSize` | `64` |
| `input` | `00010203` |
| `expected` | `d008828e2b80ac9d2218ffee1d070c48 b8e4c87bff32c9699d5b6896eee0edd1 64020e2be0560858d9c00c037e34a969 37c561a74c412bb4c746469527281c8c` |

**Vector 2** — [cSHAKE256: 200 bytes, S='Email Signature', 64 bytes (NIST)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf)

| Field | Value |
| --- | --- |
| `customization` | `456d61696c205369676e6174757265` |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7` |
| `expected` | `07dc27b11e51fbac75bc7b3c1d983e8b 4b85fb1defaf218912ac864302730917 27f42b17ed1df63e8ec118f04b23633c 1dfb1574c8fb55cb45da8e25afb092bb` |

**Vector 3** — [cSHAKE256: NIST ACVP tc50 - N='TupleHash', 65-byte message, 32-byte output](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-256-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `functionName` | `5475706c6548617368` |
| `customization` | `5d4d725b69572d3e277b734925693a79 566164457b7021575e593c563e523d67 7378583a2e4555614530575d6374697d 59426664603e216c4b3a7d2f3b542053 5e2d542b317e6c312c23206c38447368 703e7c7a6b582854776c6e7347474670 2f257d56405f6d595554575e3e3553` |
| `outputSize` | `32` |
| `input` | `31a5b91183d04c3f2adf8a92507e4451 5ce6cb5bb8129862da36b773f692a011 83576b88da8a1f21741c6fbfaaad821e db05e3e3f5b29e9d2e949ba2f2c05b9a 9e` |
| `expected` | `fae091032fc8c74b7d3912a783eb6c0598e65e576fe71e5ded3c057120bd6022` |

**Vector 4** — [cSHAKE256: NIST ACVP tc58 - N='ParallelHash', 5-byte message, 39-byte output](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-256-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `functionName` | `506172616c6c656c48617368` |
| `customization` | `76442d313e542c662e522a56255a413c 4e7457302433555a445b245825515651 452c4836453b787159514934636f5e46 2353663a435521646d516b625052625a 7b563178332c76337b66545069427654 7d5b554f6b3c2f6f2a6447724e374028 6e6d372c5e6434765d523e5b204f794a` |
| `outputSize` | `39` |
| `input` | `d5d7e7517f` |
| `expected` | `442be69b2afd7c8282839920a8446aaf 16a5049d3d018eac87e04cf9225870ef ca6f88db415829` |

---

[← All algorithms](../README.md)
