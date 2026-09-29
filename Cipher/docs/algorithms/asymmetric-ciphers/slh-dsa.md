# SLH-DSA

> NIST FIPS 205 stateless hash-based signature scheme, the standardised form of SPHINCS+. Signs with a hypertree of WOTS+ one-time keys over a FORS few-time signature, so its security reduces to the hash function alone rather than to any algebraic assumption. All twelve parameter sets are implemented over both the SHA-2 and SHAKE instantiations.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Signature |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | Daniel J. Bernstein, Andreas Hülsing, Stefan Kölbl, Ruben Niederhagen, Joost Rijneveld, Peter Schwabe |
| Year | 2024 |
| Origin | Not specified |
| Source | [`algorithms/asymmetric/slh-dsa.js`](../../../algorithms/asymmetric/slh-dsa.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits); 96 bytes (768 bits); 128 bytes (1024 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [FIPS 205: Stateless Hash-Based Digital Signature Standard](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf)
- [NIST FIPS 205 publication record](https://csrc.nist.gov/pubs/fips/205/final)
- [SPHINCS+ project site](https://sphincs.org/)

## References

- [NIST ACVP SLH-DSA test vectors](https://github.com/usnistgov/ACVP-Server/tree/master/gen-val/json-files)
- [SPHINCS+ submission to the NIST PQC project](https://csrc.nist.gov/Projects/post-quantum-cryptography/post-quantum-cryptography-standardization/round-3-submissions)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SLH-DSA-SHA2-128f key generation, ACVP keyGen tcId 21](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128f |
| `input` | `c42bcb3b5a6f331f5cce899253c6d9e2 9ff2b7ead7a04bab1794db8cc659c3b4 a868f1bd5debc12d4c9fad66aabd0a94` |
| `expected` | `a868f1bd5debc12d4c9fad66aabd0a94b546df247be4c457f3d467cdfcfabd39` |

**Vector 2** — [SLH-DSA-SHA2-128s key generation, ACVP keyGen tcId 1](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128s |
| `input` | `173d04c938c1c36bf289c3c022d04b14 63ae23c41aa546da589774ac20b745c4 0d794777914c99766827f0f09ca972be` |
| `expected` | `0d794777914c99766827f0f09ca972be0162c10219d422adba1359e6aa65299c` |

**Vector 3** — [SLH-DSA-SHAKE-128f key generation, ACVP keyGen tcId 31](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHAKE-128f |
| `input` | `3956ab391b4d22fc907af0740326d061 ab0eb206436f2b86ebe086d77739b3e4 56505c229f4e7fa6b201714c7dcc9da3` |
| `expected` | `56505c229f4e7fa6b201714c7dcc9da366578f1f24c3fe371c97c14ce0e79cdc` |

**Vector 4** — [SLH-DSA-SHA2-192f key generation, ACVP keyGen tcId 61](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-192f |
| `input` | `a021b4b9d6dee168722bc10225e50a94 6642af630c3c7c7d69e3a40ba09df2ac 165b792a07f064ac5fc28d8c99a580f4 ee4823d09e79854706daa80ae3179b5b c8c2e9409d6328a3` |
| `expected` | `ee4823d09e79854706daa80ae3179b5b c8c2e9409d6328a33577fd584bc0784c 559cdb2437a46f7f753c336369419acf` |

**Vector 5** — [SLH-DSA-SHA2-256f key generation, ACVP keyGen tcId 101](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-keyGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-256f |
| `input` | `18523702a0fe2c9e488948b127185bab 93d3f02c3d7c23a1b379f762de0509e5 6ab0d9f93540bd809d1d2e8a050440aa 81e853750470e2b00c959dbd3be40e2b d7125f5d00ba47f1fc8d4c32c2f57c44 4bd384d7ce770bc50dd5980c1d1264d0` |
| `expected` | `d7125f5d00ba47f1fc8d4c32c2f57c44 4bd384d7ce770bc50dd5980c1d1264d0 0ad5197ffcbaafe11b1e413f26adb150 4ce1c3f5c40c1dcda14e99fd126d5b81` |

**Vector 6** — [SLH-DSA-SHA2-128f deterministic signature, ACVP sigGen tcId 115](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128f |
| `key` | `53725a3c2b994d52ddba83ec584de28b b56fd81661f82b2ae2100517bf14b215 20ff7c085298b7313788a15a6eedac2f e846bd0c772aa74975b45ffc49b4f678` |
| `input` | `6d` |
| `expected` | `42a4aa49a6c6a324b1e6e08f3c77c605 899c4a45509ebae96f459f2dd1d3cacd 7627ca3f3fa805c174e867514de85f33 eb70e85564bcc073aedb042154d24cc4 …` (17088 bytes; the full value is in the source) |

**Vector 7** — [SLH-DSA-SHA2-128s verifies the ACVP sigGen tcId 276 signature](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128s |
| `publicKey` | `6792d6936ca60069bb5151e5762d5e0a8c48872a8861b23d9b1cfae3a70b5d05` |
| `signature` | `eff14891bdd61a6408829a65d3db8977 54cbe8923efaa63251c73776c06f569b a3f26635e1d943756ca9264ebf3d2795 dd103925624f58e0da163b30cf17b2a4 …` (7856 bytes; the full value is in the source) |
| `input` | `0c` |
| `expected` | `01` |

**Vector 8** — [SLH-DSA-SHA2-128s rejects that signature against a message with one bit flipped](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128s |
| `publicKey` | `6792d6936ca60069bb5151e5762d5e0a8c48872a8861b23d9b1cfae3a70b5d05` |
| `signature` | `eff14891bdd61a6408829a65d3db8977 54cbe8923efaa63251c73776c06f569b a3f26635e1d943756ca9264ebf3d2795 dd103925624f58e0da163b30cf17b2a4 …` (7856 bytes; the full value is in the source) |
| `input` | `0d` |
| `expected` | `00` |

**Vector 9** — [SLH-DSA-SHA2-128s rejects that signature with one bit of the FORS part flipped](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128s |
| `publicKey` | `6792d6936ca60069bb5151e5762d5e0a8c48872a8861b23d9b1cfae3a70b5d05` |
| `signature` | `eff14891bdd61a6408829a65d3db8977 54cbe8923efaa63251c73776c06f569b a3f26635e1d943756ca9264ebf3d2795 dd103925624f58e0da163b30cf17b2a4 …` (7856 bytes; the full value is in the source) |
| `input` | `0c` |
| `expected` | `00` |

**Vector 10** — [SLH-DSA-SHA2-128s rejects the signature under a different public key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHA2-128s |
| `publicKey` | `6792d6936ca60069bb5151e5762d5e0a8c48872a8861b23d9b1cfae3a70b5d04` |
| `signature` | `eff14891bdd61a6408829a65d3db8977 54cbe8923efaa63251c73776c06f569b a3f26635e1d943756ca9264ebf3d2795 dd103925624f58e0da163b30cf17b2a4 …` (7856 bytes; the full value is in the source) |
| `input` | `0c` |
| `expected` | `00` |

**Vector 11** — [SLH-DSA-SHAKE-128s verifies the ACVP sigGen tcId 292 signature](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHAKE-128s |
| `publicKey` | `6146e92a0ce7c6f48876970a313c600005d6702b2c1d729e9dd5e7517d2e02fe` |
| `signature` | `240f5a369c8ae87c92041f618c89e701 4f8119197b6a56a3e4cb24bccbea3ba2 289d6dc8db14f04d8a3601b0321433a8 436e133d7697021b798c3ac6940ff295 …` (7856 bytes; the full value is in the source) |
| `input` | `36` |
| `expected` | `01` |

**Vector 12** — [SLH-DSA-SHAKE-128s rejects that signature with one bit of the hypertree part flipped](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/SLH-DSA-sigGen-FIPS205/internalProjection.json)

| Field | Value |
| --- | --- |
| `parameterSet` | SLH-DSA-SHAKE-128s |
| `publicKey` | `6146e92a0ce7c6f48876970a313c600005d6702b2c1d729e9dd5e7517d2e02fe` |
| `signature` | `240f5a369c8ae87c92041f618c89e701 4f8119197b6a56a3e4cb24bccbea3ba2 289d6dc8db14f04d8a3601b0321433a8 436e133d7697021b798c3ac6940ff295 …` (7856 bytes; the full value is in the source) |
| `input` | `36` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
