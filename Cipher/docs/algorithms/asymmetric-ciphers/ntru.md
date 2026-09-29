# NTRU

> NTRU, the truncated polynomial ring lattice scheme, in the key encapsulation form submitted to round 3 of the NIST post-quantum process. Works over Z[x]/(x^n - 1): the public key is g/f for a short f and a fixed-weight g, and decapsulation recovers the message by multiplying by f and reducing modulo 3. The three NTRU-HPS parameter sets are implemented; NTRU-HRSS is not.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Key Encapsulation |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Jeffrey Hoffstein, Jill Pipher, Joseph Silverman |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/asymmetric/ntru.js`](../../../algorithms/asymmetric/ntru.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 509 bytes (4072 bits); 677 bytes (5416 bits); 821 bytes (6568 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NTRU Round 3 Specification](https://ntru.org/f/ntru-20190330.pdf)
- [NTRU Original Paper](https://www.ntru.com/resources/NTRUTech014.pdf)
- [IEEE P1363.1 NTRU Standard](https://standards.ieee.org/ieee/1363.1/3028/)
- [Post-Quantum Cryptography](https://en.wikipedia.org/wiki/Post-quantum_cryptography)

## References

- [NTRU Submission Package and Known Answer Tests](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)
- [NIST PQC Round 3 Submissions](https://csrc.nist.gov/Projects/post-quantum-cryptography/post-quantum-cryptography-standardization/round-3-submissions)
- [Schanck, Improving NTRU](https://eprint.iacr.org/2018/1174)

## Test vectors

12 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NTRU PQCkemKAT_935.rsp record 0: expanded seed to public key (ntruhps2048509)](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ntruhps2048509 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 92f267aafa3f87ca60d01cb54f29202a …` (2413 bytes; the full value is in the source) |
| `expected` | `ead4d1aff780d5aeaf590d73b44b01c8 e45bc3b9eec0b90290c7bceed33849f3 fdd6ba3d2c34ef5652fcab9f76930ee4 9b448ac494dfbc182a78f10dd70014ef …` (699 bytes; the full value is in the source) |

**Vector 2** — [NTRU PQCkemKAT_935.rsp record 0: expanded seed and rejection key to secret key](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ntruhps2048509 |
| `keyGenerationOutput` | privateKey |
| `rejectionKey` | `1dab0317f0ce5a41ce7672953d301cffd710f80beac3f19c0e96e68cf8fdab81` |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 92f267aafa3f87ca60d01cb54f29202a …` (2413 bytes; the full value is in the source) |
| `expected` | `d067d98f0055e2c3deef1076bbb755af d065112c85c46e6c350655d9625073e9 4e4528c053e720206cdb780a61ad5120 c498a4cd3e60c334d8702f0f79d81418 …` (935 bytes; the full value is in the source) |

**Vector 3** — [NTRU PQCkemKAT_935.rsp record 0: encapsulation ciphertext](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `publicKey` | `ead4d1aff780d5aeaf590d73b44b01c8 e45bc3b9eec0b90290c7bceed33849f3 fdd6ba3d2c34ef5652fcab9f76930ee4 9b448ac494dfbc182a78f10dd70014ef …` (699 bytes; the full value is in the source) |
| `encapsulationOutput` | ciphertext |
| `input` | `1b70b064d09425d8431417974c8c02f7 8a4f61b3b475837c51a6aa1ec4850ac3 5c4445d03bbe358399bacae1b776ae48 6181755d2675c5e64222e63fa342b1de …` (2413 bytes; the full value is in the source) |
| `expected` | `b934872b0469349cc3c88ae57af98d6e 2330e666ce889e3707523224891c0685 933f0314b28e1d6e1c3559c8695ef26a b6ba3af701f63fe2b0642e896d17f71e …` (699 bytes; the full value is in the source) |

**Vector 4** — [NTRU PQCkemKAT_935.rsp record 0: encapsulated shared secret](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `publicKey` | `ead4d1aff780d5aeaf590d73b44b01c8 e45bc3b9eec0b90290c7bceed33849f3 fdd6ba3d2c34ef5652fcab9f76930ee4 9b448ac494dfbc182a78f10dd70014ef …` (699 bytes; the full value is in the source) |
| `encapsulationOutput` | sharedSecret |
| `input` | `1b70b064d09425d8431417974c8c02f7 8a4f61b3b475837c51a6aa1ec4850ac3 5c4445d03bbe358399bacae1b776ae48 6181755d2675c5e64222e63fa342b1de …` (2413 bytes; the full value is in the source) |
| `expected` | `176fdbb009dd3f848b365ab7f18d9c0c91721931c8594c2c6f043c8600791a6c` |

**Vector 5** — [NTRU PQCkemKAT_935.rsp record 0: decapsulation recovers the shared secret](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `d067d98f0055e2c3deef1076bbb755af d065112c85c46e6c350655d9625073e9 4e4528c053e720206cdb780a61ad5120 c498a4cd3e60c334d8702f0f79d81418 …` (935 bytes; the full value is in the source) |
| `input` | `b934872b0469349cc3c88ae57af98d6e 2330e666ce889e3707523224891c0685 933f0314b28e1d6e1c3559c8695ef26a b6ba3af701f63fe2b0642e896d17f71e …` (699 bytes; the full value is in the source) |
| `expected` | `176fdbb009dd3f848b365ab7f18d9c0c91721931c8594c2c6f043c8600791a6c` |

**Vector 6** — [NTRU PQCkemKAT_935.rsp record 0: the recovered secret is the published one](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `d067d98f0055e2c3deef1076bbb755af d065112c85c46e6c350655d9625073e9 4e4528c053e720206cdb780a61ad5120 c498a4cd3e60c334d8702f0f79d81418 …` (935 bytes; the full value is in the source) |
| `sharedSecret` | `176fdbb009dd3f848b365ab7f18d9c0c91721931c8594c2c6f043c8600791a6c` |
| `input` | `b934872b0469349cc3c88ae57af98d6e 2330e666ce889e3707523224891c0685 933f0314b28e1d6e1c3559c8695ef26a b6ba3af701f63fe2b0642e896d17f71e …` (699 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 7** — [NTRU PQCkemKAT_935.rsp record 0: a modified ciphertext must not decapsulate to the published secret](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `d067d98f0055e2c3deef1076bbb755af d065112c85c46e6c350655d9625073e9 4e4528c053e720206cdb780a61ad5120 c498a4cd3e60c334d8702f0f79d81418 …` (935 bytes; the full value is in the source) |
| `sharedSecret` | `176fdbb009dd3f848b365ab7f18d9c0c91721931c8594c2c6f043c8600791a6c` |
| `input` | `b934872b0469349cc3c88ae57af98d6e 2331e666ce889e3707523224891c0685 933f0314b28e1d6e1c3559c8695ef26a b6ba3af701f63fe2b0642e896d17f71e …` (699 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 8** — [NTRU PQCkemKAT_935.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `22627b1edc147ac45554273783748c64 731652db85d80c6fd5223f06d733d038 b0075b54052c7342624d879b3bd998a7 e2b51682acdd0b81c876e91bd14c9697 …` (935 bytes; the full value is in the source) |
| `sharedSecret` | `176fdbb009dd3f848b365ab7f18d9c0c91721931c8594c2c6f043c8600791a6c` |
| `input` | `b934872b0469349cc3c88ae57af98d6e 2330e666ce889e3707523224891c0685 933f0314b28e1d6e1c3559c8695ef26a b6ba3af701f63fe2b0642e896d17f71e …` (699 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 9** — [NTRU PQCkemKAT_1234.rsp record 0: expanded seed to public key (ntruhps2048677)](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ntruhps2048677 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 92f267aafa3f87ca60d01cb54f29202a …` (3211 bytes; the full value is in the source) |
| `expected` | `57eee113d3506f111ca9f253d1035c2a ccf68212488724fa9eb144f5d3532e69 14dfde79861d843a26f0a8d43371ee27 3d53b90879fd8c2f985f53c59b338784 …` (930 bytes; the full value is in the source) |

**Vector 10** — [NTRU PQCkemKAT_1234.rsp record 0: decapsulation recovers the shared secret (ntruhps2048677)](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `d067d98f0055e2c3deef1076bbb755af d065112c85c46e6c350655d9625073e9 4e4528c053e720206cdb780a61ad5120 c498a4cd3e60c334d8702f0f79d81418 …` (1234 bytes; the full value is in the source) |
| `input` | `a1d9ce5958daca0f9799c9ae5d4395cb 6368371bb9f93f906dae552f529b1ca5 dfef9bfcbced6c74f3f189f1a165ee30 a90b246dc729fa08d14dc82647e2eddc …` (930 bytes; the full value is in the source) |
| `expected` | `49ac4d5d1634c6affa5a08c2b228ec806d7870b1517990728663d2d8bbc184f2` |

**Vector 11** — [NTRU PQCkemKAT_1590.rsp record 0: expanded seed to public key (ntruhps4096821)](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ntruhps4096821 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d b505d7cfad1b497499323c8686325e47 92f267aafa3f87ca60d01cb54f29202a …` (3895 bytes; the full value is in the source) |
| `expected` | `5c613a66185d153995ed00f800682f17 cb11d38146a07081bceb403b42de8bea 93af382e8402e7b68a9dd46a1a208a05 79f650a589452b78890d0e0be79929e8 …` (1230 bytes; the full value is in the source) |

**Vector 12** — [NTRU PQCkemKAT_1590.rsp record 0: decapsulation recovers the shared secret (ntruhps4096821)](https://ntru.org/release/NIST-PQ-Submission-NTRU-20201016.tar.gz)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `d067d98f0055e2c3deef1076bbb755af d065112c85c46e6c350655d9625073e9 4e4528c053e720206cdb780a61ad5120 c498a4cd3e60c334d8702f0f79d81418 …` (1590 bytes; the full value is in the source) |
| `input` | `c31a29034aeef0469718549dff4f8380 23a19aba55bfb249b4059d37f879219b 0a22f17dab3ff16ba05b3dfd44e9fd43 118a41d4317ea35407aae247e31e90cd …` (1230 bytes; the full value is in the source) |
| `expected` | `293992000dc288e8152f9451f06dd835c75ea008662bace0fb97a97b3afb54e4` |

---

[← All algorithms](../README.md)
