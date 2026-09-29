# SPHINCS+

> Stateless hash-based signature scheme, the round-3 NIST post-quantum submission that was standardised as FIPS 205 SLH-DSA. Signs with a hypertree of WOTS+ one-time keys over a FORS few-time signature, so security reduces to the hash function alone. The twelve simple parameter sets over SHA-256 and SHAKE-256 are implemented and verified against the submission's own Known Answer Test files.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Signature |
| Security status | ⚠️ Deprecated |
| Complexity | Expert |
| Inventor | Daniel J. Bernstein, Andreas Hülsing, Stefan Kölbl, Ruben Niederhagen, Joost Rijneveld, Peter Schwabe |
| Year | 2020 |
| Origin | Not specified |
| Source | [`algorithms/asymmetric/sphincs-plus.js`](../../../algorithms/asymmetric/sphincs-plus.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits); 96 bytes (768 bits); 128 bytes (1024 bits) |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Long-message second preimage](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf) | In this round-3 version the SHA-2 message hash seeds MGF1 with SHA-256(R \| PK.seed \| PK.root \| M) alone. Binding R and PK.seed into the seed as well was added afterwards, and FIPS 205 section 11.2 requires it. | Use SLH-DSA, which is this scheme with that countermeasure and four other changes. |

## Documentation

- [SPHINCS+ project site](https://sphincs.org/)
- [SPHINCS+ round-3 specification](https://sphincs.org/data/sphincs+-round3-specification.pdf)
- [FIPS 205, the standardised successor](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.pdf)

## References

- [Round-3 submission package with the KAT files](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)
- [NIST PQC round-3 submissions](https://csrc.nist.gov/Projects/post-quantum-cryptography/post-quantum-cryptography-standardization/round-3-submissions)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SPHINCS+-SHA-256-128f-simple key generation, PQCsignKAT count 0](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128f-simple |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47` |
| `expected` | `b505d7cfad1b497499323c8686325e474fdfa42840c84b1ddd0ea5ce46482020` |

**Vector 2** — [SPHINCS+-SHA-256-128s-simple key generation, PQCsignKAT count 0](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128s-simple |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47` |
| `expected` | `b505d7cfad1b497499323c8686325e474aa09ab5967ee5c05cd7af24e95db737` |

**Vector 3** — [SPHINCS+-SHAKE-256-128f-simple key generation, PQCsignKAT count 0](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHAKE-256-128f-simple |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47` |
| `expected` | `b505d7cfad1b497499323c8686325e4766ba69d8560a9f84846ad8b765390c84` |

**Vector 4** — [SPHINCS+-SHA-256-192f-simple key generation, PQCsignKAT count 0](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-192f-simple |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 92f267aafa3f87ca60d01cb54f29202a 3e784ccb7ebcdcfd` |
| `expected` | `92f267aafa3f87ca60d01cb54f29202a 3e784ccb7ebcdcfd1396fa01acff7b0b c42b85767db44482a447d82a11254749` |

**Vector 5** — [SPHINCS+-SHA-256-256f-simple key generation, PQCsignKAT count 0](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-256f-simple |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 92f267aafa3f87ca60d01cb54f29202a 3e784ccb7ebcdcfd45542b7f6af77874 2e0f4479175084aa488b3b74340678aa` |
| `expected` | `3e784ccb7ebcdcfd45542b7f6af77874 2e0f4479175084aa488b3b74340678aa c3eedb1becf37fc508c07cc79be53afb 6fe2f0dd8396c54db7e368fae83261ef` |

**Vector 6** — [SPHINCS+-SHA-256-128f-simple signature, PQCsignKAT count 0](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128f-simple |
| `key` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 4fdfa42840c84b1ddd0ea5ce46482020` |
| `optRand` | `33b3c07507e4201748494d832b6ee2a6` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `b77b5397031e67eb585dba86b10b710b 8c9f8091d1a1edbb6a8a041343c6e5c0 90d9d26cf0068d14f2125ffa16dce594 3af75452a07b7bc67344a77fba2bc51f …` (17088 bytes; the full value is in the source) |

**Vector 7** — [SPHINCS+-SHA-256-128s-simple verifies the PQCsignKAT count 0 signature](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128s-simple |
| `publicKey` | `b505d7cfad1b497499323c8686325e474aa09ab5967ee5c05cd7af24e95db737` |
| `signature` | `b77b5397031e67eb585dba86b10b710b ddd33e306d6a6a1c6195e70c1c18cc9f 796bf9087d14efb03d720afb26940f57 d3e768272e5774c2b3d5c6c2cdc261fe …` (7856 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `01` |

**Vector 8** — [SPHINCS+-SHA-256-128s-simple rejects it against a message with one bit flipped](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128s-simple |
| `publicKey` | `b505d7cfad1b497499323c8686325e474aa09ab5967ee5c05cd7af24e95db737` |
| `signature` | `b77b5397031e67eb585dba86b10b710b ddd33e306d6a6a1c6195e70c1c18cc9f 796bf9087d14efb03d720afb26940f57 d3e768272e5774c2b3d5c6c2cdc261fe …` (7856 bytes; the full value is in the source) |
| `input` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

**Vector 9** — [SPHINCS+-SHA-256-128s-simple rejects it with one bit of the FORS part flipped](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128s-simple |
| `publicKey` | `b505d7cfad1b497499323c8686325e474aa09ab5967ee5c05cd7af24e95db737` |
| `signature` | `b77b5397031e67eb585dba86b10b710b ddd33e306d6a6a1c6195e70c1c18cc9f 796bf9087d14efb03d720afb26940f57 d3e768272e5774c2b3d5c6c2cdc261fe …` (7856 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

**Vector 10** — [SPHINCS+-SHA-256-128s-simple rejects it under a different public key](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHA-256-128s-simple |
| `publicKey` | `b505d7cfad1b497499323c8686325e474aa09ab5967ee5c05cd7af24e95db736` |
| `signature` | `b77b5397031e67eb585dba86b10b710b ddd33e306d6a6a1c6195e70c1c18cc9f 796bf9087d14efb03d720afb26940f57 d3e768272e5774c2b3d5c6c2cdc261fe …` (7856 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

**Vector 11** — [SPHINCS+-SHAKE-256-128s-simple verifies the PQCsignKAT count 0 signature](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHAKE-256-128s-simple |
| `publicKey` | `b505d7cfad1b497499323c8686325e47fd65cbb2867a44c3d67acc840acf609f` |
| `signature` | `07eb19e7d838d71ef66b8263b5d1f8ec 91cef2a5b8d0013f45c0385af2a8c010 7f8381ab488827994646238f4d02da62 401895ed6c509bf5ac28a40863950d60 …` (7856 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `01` |

**Vector 12** — [SPHINCS+-SHAKE-256-128s-simple rejects it with one bit of the hypertree part flipped](https://sphincs.org/data/sphincs+-round3-submission-nist.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | SPHINCS+-SHAKE-256-128s-simple |
| `publicKey` | `b505d7cfad1b497499323c8686325e47fd65cbb2867a44c3d67acc840acf609f` |
| `signature` | `07eb19e7d838d71ef66b8263b5d1f8ec 91cef2a5b8d0013f45c0385af2a8c010 7f8381ab488827994646238f4d02da62 401895ed6c509bf5ac28a40863950d60 …` (7856 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
