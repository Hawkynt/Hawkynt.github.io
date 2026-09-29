# FAEST

> FAEST, the VOLE-in-the-head signature of the NIST additional-signatures process: a zero-knowledge proof of knowledge of an AES key k with AES_k(x) = y for a public (x, y), made non-interactive by Fiat-Shamir over SHAKE. All twelve second-round parameter sets, FAEST and FAEST-EM at 128, 192 and 256 bits in small and fast variants; key generation, signing and verification, checked against the submission's Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Digital Signature |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Carsten Baum, Ward Beullens, Lennart Braun, Cyprien Delpech de Saint Guilhem, Michael Klooß, Christian Majenz, Shibam Mukherjee, Emmanuela Orsini, Sebastian Ramacher, Christian Rechberger, Lawrence Roy, Peter Scholl |
| Year | 2023 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/faest.js`](../../../algorithms/asymmetric/faest.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits); 40 bytes (320 bits); 48 bytes (384 bits); 64 bytes (512 bits) |

## Parameter sets

| `name` | `secretKeySize` | `publicKeySize` | `signatureSize` |
| --- | --- | --- | --- |
| FAEST-128s | `32` | `32` | `4506` |
| FAEST-128f | `32` | `32` | `5924` |
| FAEST-192s | `40` | `48` | `11260` |
| FAEST-192f | `40` | `48` | `14948` |
| FAEST-256s | `48` | `48` | `20696` |
| FAEST-256f | `48` | `48` | `26548` |
| FAEST-EM-128s | `32` | `32` | `3906` |
| FAEST-EM-128f | `32` | `32` | `5060` |
| FAEST-EM-192s | `48` | `48` | `9340` |
| FAEST-EM-192f | `48` | `48` | `12380` |
| FAEST-EM-256s | `64` | `64` | `17984` |
| FAEST-EM-256f | `64` | `64` | `23476` |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Under evaluation, not standardised](https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures) | FAEST is a second-round candidate of the NIST call for additional signatures. Its parameters changed between rounds - grinding and the batch all-but-one vector commitment arrived in version 2 - and first-round signatures do not verify here | Treat it as experimental; use ML-DSA or SLH-DSA where a standard is required |
| [Deterministic signing by default](https://faest.info/) | Without supplied randomness this implementation signs with an empty rho, the deterministic mode the specification permits. Deterministic signing is sound here, but a fault or side-channel attacker benefits from repeated identical computations | Supply fresh randomness through the randomness property when the environment is exposed |
| [Published demonstration keys](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip) | The secret keys in the test vectors are printed in this file and come from published Known Answer Test data; they confer no secrecy | Generate a secret key from a proper random source for any use beyond demonstration |

## Documentation

- [FAEST specification v2.0 and submission package (NIST additional signatures, round 2)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)
- [FAEST project site](https://faest.info/)
- [NIST PQC additional digital signature schemes, round 2](https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures)

## References

- [FAEST reference implementation](https://github.com/faest-sign/faest-ref)
- [Publicly Verifiable Zero-Knowledge and Post-Quantum Signatures From VOLE-in-the-Head (CRYPTO 2023)](https://eprint.iacr.org/2023/996)
- [FIPS 197 - Advanced Encryption Standard](https://doi.org/10.6028/NIST.FIPS.197-upd1)
- [FIPS 202 - SHA-3 and the SHAKE functions](https://doi.org/10.6028/NIST.FIPS.202)

## Test vectors

40 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FAEST-128f faest_128f/PQCsignKAT_32.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (5924 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |

**Vector 2** — [FAEST-128f faest_128f/PQCsignKAT_32.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 3** — [FAEST-128s faest_128s/PQCsignKAT_32.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (4506 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128s |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8688d74253ac919a4e577c8dc14c3d7 8deadac09f3ade29592117f547bdcd2e …` (4539 bytes; the full value is in the source) |

**Vector 4** — [FAEST-128s faest_128s/PQCsignKAT_32.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128s |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8688d74253ac919a4e577c8dc14c3d7 8deadac09f3ade29592117f547bdcd2e …` (4539 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 5** — [FAEST-192f faest_192f/PQCsignKAT_40.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (14948 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-192f |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb14803` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8285b3affd827e75e6f5e1afdf1ab5b 6223a063a810034c108540af1960a78b …` (14981 bytes; the full value is in the source) |

**Vector 6** — [FAEST-192f faest_192f/PQCsignKAT_40.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-192f |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 1a18f506f7d78bdf5800c9f57f6d23e2 9475d6ecbdaf42cc0150f4dc9e3ee3ba` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8285b3affd827e75e6f5e1afdf1ab5b 6223a063a810034c108540af1960a78b …` (14981 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 7** — [FAEST-192s faest_192s/PQCsignKAT_40.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (11260 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-192s |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb14803` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c822b0f5adaea8bc7a98e3bf9b486bb0 922a9007aa8a3427a0a2223cbd8d7a33 …` (11293 bytes; the full value is in the source) |

**Vector 8** — [FAEST-192s faest_192s/PQCsignKAT_40.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-192s |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 1a18f506f7d78bdf5800c9f57f6d23e2 9475d6ecbdaf42cc0150f4dc9e3ee3ba` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c822b0f5adaea8bc7a98e3bf9b486bb0 922a9007aa8a3427a0a2223cbd8d7a33 …` (11293 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 9** — [FAEST-256f faest_256f/PQCsignKAT_48.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (26548 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-256f |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8fba3cd899dde8a9f99c1260d949dc0 cd6a3f897b1d324880ad6f274426eef0 …` (26581 bytes; the full value is in the source) |

**Vector 10** — [FAEST-256f faest_256f/PQCsignKAT_48.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-256f |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 0f4fd96ccd125c5d5d5a1364a30c16a2 dcc2fd677611012bbe4c7caacc4cc1ab` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8fba3cd899dde8a9f99c1260d949dc0 cd6a3f897b1d324880ad6f274426eef0 …` (26581 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 11** — [FAEST-256s faest_256s/PQCsignKAT_48.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (20696 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-256s |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8b4081d68d0786792a9969a501d79b2 3faf6d2a6a65624ef371e740e5462f5d …` (20729 bytes; the full value is in the source) |

**Vector 12** — [FAEST-256s faest_256s/PQCsignKAT_48.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-256s |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 0f4fd96ccd125c5d5d5a1364a30c16a2 dcc2fd677611012bbe4c7caacc4cc1ab` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8b4081d68d0786792a9969a501d79b2 3faf6d2a6a65624ef371e740e5462f5d …` (20729 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 13** — [FAEST-EM-128f faest_em_128f/PQCsignKAT_32.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (5060 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-128f |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8465b73c8a98d4c00e4490db1c3d4a8 7fdc15b24169a5b75f130f561a614ce4 …` (5093 bytes; the full value is in the source) |

**Vector 14** — [FAEST-EM-128f faest_em_128f/PQCsignKAT_32.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d0d059099f9081de485b4505b390bf71e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8465b73c8a98d4c00e4490db1c3d4a8 7fdc15b24169a5b75f130f561a614ce4 …` (5093 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 15** — [FAEST-EM-128s faest_em_128s/PQCsignKAT_32.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (3906 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-128s |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c6efa4877a3081d0969aaa89b7864a 1e6d1e7fe4c22e7bf6030f2d12e5c5e0 …` (3939 bytes; the full value is in the source) |

**Vector 16** — [FAEST-EM-128s faest_em_128s/PQCsignKAT_32.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-128s |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d0d059099f9081de485b4505b390bf71e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c6efa4877a3081d0969aaa89b7864a 1e6d1e7fe4c22e7bf6030f2d12e5c5e0 …` (3939 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 17** — [FAEST-EM-192f faest_em_192f/PQCsignKAT_48.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (12380 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-192f |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc7c9935a0b07694aa 0c6d10e4db6b1add2fd81a25ccb14803` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c73b0509d13a467e61441de1bcc808 e63b372080777a45a9d6f083d63c5d43 …` (12413 bytes; the full value is in the source) |

**Vector 18** — [FAEST-EM-192f faest_em_192f/PQCsignKAT_48.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-192f |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc3b85aee1abd39413 1dde28c0c05f679a672d04b1d71dce7c` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c73b0509d13a467e61441de1bcc808 e63b372080777a45a9d6f083d63c5d43 …` (12413 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 19** — [FAEST-EM-192s faest_em_192s/PQCsignKAT_48.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (9340 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-192s |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc7c9935a0b07694aa 0c6d10e4db6b1add2fd81a25ccb14803` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c9022f0e9d8ddcc24e3793ee14388c ae7848566621536c214375d9f042f48d …` (9373 bytes; the full value is in the source) |

**Vector 20** — [FAEST-EM-192s faest_em_192s/PQCsignKAT_48.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-192s |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc3b85aee1abd39413 1dde28c0c05f679a672d04b1d71dce7c` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c9022f0e9d8ddcc24e3793ee14388c ae7848566621536c214375d9f042f48d …` (9373 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 21** — [FAEST-EM-256f faest_em_256f/PQCsignKAT_64.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (23476 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-256f |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c1e8722a6716340711fa1ab60ffe5c bd5762ecf2a928283e79fb635112c2ac …` (23509 bytes; the full value is in the source) |

**Vector 22** — [FAEST-EM-256f faest_em_256f/PQCsignKAT_64.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-256f |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f f6667c05051dee8874abb448bd1a066b fc25d2d8ad816be26cbfda4b238b761c` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8c1e8722a6716340711fa1ab60ffe5c bd5762ecf2a928283e79fb635112c2ac …` (23509 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 23** — [FAEST-EM-256s faest_em_256s/PQCsignKAT_64.rsp count 0: key generation from the harness seed and signing reproduce the published signed message (17984 byte signature)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-256s |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `key` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f 7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8764bc10992594a31c561af8448029f 57b0e2bcf40d852ae24f5bf7d0cf1907 …` (18017 bytes; the full value is in the source) |

**Vector 24** — [FAEST-EM-256s faest_em_256s/PQCsignKAT_64.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-EM-256s |
| `inverse` | Yes |
| `publicKey` | `8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f f6667c05051dee8874abb448bd1a066b fc25d2d8ad816be26cbfda4b238b761c` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8764bc10992594a31c561af8448029f 57b0e2bcf40d852ae24f5bf7d0cf1907 …` (18017 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 25** — [FAEST-128f count 0: the verdict on the published signature is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 26** — [FAEST-128f count 0: the same signature opens when the public key is derived from the published secret key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `key` | `91282214654cb55e7c2cacd53919604d7c9935a0b07694aa0c6d10e4db6b1add` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 27** — [FAEST-128f: a message with one bit flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734ecbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 28** — [FAEST-128f: a signature with one bit of the first VOLE correction c flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e7f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 29** — [FAEST-128f: a signature with one bit of the masked hash u~ flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 30** — [FAEST-128f: a signature with one bit of the masked witness d flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 31** — [FAEST-128f: a signature with one bit of the proof value a1 flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 32** — [FAEST-128f: a signature with one bit of the proof value a2 flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 33** — [FAEST-128f: a signature with one bit of an opened commitment flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 34** — [FAEST-128f: a signature with one bit of a co-path seed flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 35** — [FAEST-128f: a signature with one bit of the challenge flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 36** — [FAEST-128f: a signature with one bit of the IV seed flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 37** — [FAEST-128f: a signature with one bit of the grinding counter flipped must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 38** — [FAEST-128f: count 0's signature must not verify under count 0's public key of FAEST-EM-128f, which has the same length](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d0d059099f9081de485b4505b390bf71e` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 39** — [FAEST-128f: the signature must not verify under a public key with a flipped bit in its OWF output](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128f |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a79540084e7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 40** — [FAEST-128f: the signature must not verify as FAEST-128s, whose signature is shorter, so the message boundary moves](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/faest-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | FAEST-128s |
| `inverse` | Yes |
| `publicKey` | `91282214654cb55e7c2cacd53919604d3a7954008ce7b35dd5e46f2eb6f3f208` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8369e002f56e47960a9c663623772be d760e6f06409266bb8a15c32cde25afd …` (5957 bytes; the full value is in the source) |
| `expected` | `00` |

---

[← All algorithms](../README.md)
