# BIKE

> Bit Flipping Key Encapsulation, the QC-MDPC code-based KEM submitted to round 4 of the NIST post-quantum process. The secret is a pair of sparse circulants over GF(2)[x]/(x^r - 1) and the public key is their quotient, so a ciphertext is the syndrome of a low weight error vector that only the sparse parity checks make decodable. Decapsulation runs the Black-Gray-Flip bit flipping decoder. All three round 4 parameter sets are implemented and verified against the submission's own Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Key Encapsulation |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Nicolas Aragon, Paulo Barreto, Slim Bettaieb, Loic Bidoux, Olivier Blazy, Jean-Christophe Deneuville, Philippe Gaborit, Shay Gueron, Tim Gueneysu, Carlos Aguilar Melchor, Rafael Misoczki, Edoardo Persichetti, Nicolas Sendrier, Jean-Pierre Tillich, Valentin Vasseur, Gilles Zemor |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/bike.js`](../../../algorithms/asymmetric/bike.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 128 bytes (1024 bits); 192 bytes (1536 bits); 256 bytes (2048 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Decoding failure attacks | The decoder can fail, and which ciphertexts it fails on leaks information about the secret circulants, which recovers the key over many queries (Guo, Johansson and Stankovski, GJS). | Use the parameter sets as published, whose decoding failure rate is below 2^-128, and never reuse a key pair across a ciphertext that failed to decode. |
| Timing side channels | This implementation is written for clarity: the decoder branches on syndrome bits and the sampler on collisions, so its running time depends on secret data. | Not for use where an attacker can measure execution time. |

## Documentation

- [BIKE Official Site](https://bikesuite.org/)
- [BIKE Round 4 Specification](https://bikesuite.org/files/v5.0/BIKE_Spec.2022.10.10.1.pdf)
- [QC-MDPC McEliece](https://eprint.iacr.org/2012/409)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)

## References

- [BIKE Round 4 Submission Package and Known Answer Tests](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)
- [BIKE Additional Implementation](https://github.com/awslabs/bike-kem)
- [Drucker, Gueron and Kostic, QC-MDPC Decoders with Several Shades of Gray](https://eprint.iacr.org/2019/1423)

## Test vectors

15 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to public key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l1 |
| `keyGenerationOutput` | publicKey |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `07d0317a8bdb2d2438ab54042832af07 d8a980f84e10debecba8226aab7b8e6c b3d6e75df2dfb6e140a7c8ebe14b9758 803564a9a6e83fe495b1108ec3f015b5 …` (1541 bytes; the full value is in the source) |

**Vector 2** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to secret key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l1 |
| `keyGenerationOutput` | privateKey |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `00000000000000000000000000020000 00000000000000000000000000000000 00000002000001000000000000000000 00000000000000004000000000000000 …` (3114 bytes; the full value is in the source) |

**Vector 3** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to ciphertext](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l1 |
| `keyGenerationOutput` | ciphertext |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `2c360eb591f5f30d64df178dc8f56252 cf203ce20589b6fb295ce47188fc692b 6b8d2f0b60f8594f9ec37c82c1c090bc d224740bffda9cef0d69a17005b50e57 …` (1573 bytes; the full value is in the source) |

**Vector 4** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: seed to encapsulated shared secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l1 |
| `keyGenerationOutput` | sharedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `c748cc2121532efeeba47f446e8393b7202400463bebde6e45882acab8ddeec6` |

**Vector 5** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: decapsulating its own ciphertext returns the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l1 |
| `keyGenerationOutput` | decapsulatedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `c748cc2121532efeeba47f446e8393b7202400463bebde6e45882acab8ddeec6` |

**Vector 6** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: decapsulation of the published ciphertext under the published secret key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `00000000000000000000000000020000 00000000000000000000000000000000 00000002000001000000000000000000 00000000000000004000000000000000 …` (3114 bytes; the full value is in the source) |
| `input` | `2c360eb591f5f30d64df178dc8f56252 cf203ce20589b6fb295ce47188fc692b 6b8d2f0b60f8594f9ec37c82c1c090bc d224740bffda9cef0d69a17005b50e57 …` (1573 bytes; the full value is in the source) |
| `expected` | `c748cc2121532efeeba47f446e8393b7202400463bebde6e45882acab8ddeec6` |

**Vector 7** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: the recovered secret is the published one](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `00000000000000000000000000020000 00000000000000000000000000000000 00000002000001000000000000000000 00000000000000004000000000000000 …` (3114 bytes; the full value is in the source) |
| `sharedSecret` | `c748cc2121532efeeba47f446e8393b7202400463bebde6e45882acab8ddeec6` |
| `input` | `2c360eb591f5f30d64df178dc8f56252 cf203ce20589b6fb295ce47188fc692b 6b8d2f0b60f8594f9ec37c82c1c090bc d224740bffda9cef0d69a17005b50e57 …` (1573 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 8** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp record 0: a modified ciphertext must not decapsulate to the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `00000000000000000000000000020000 00000000000000000000000000000000 00000002000001000000000000000000 00000000000000004000000000000000 …` (3114 bytes; the full value is in the source) |
| `sharedSecret` | `c748cc2121532efeeba47f446e8393b7202400463bebde6e45882acab8ddeec6` |
| `input` | `2d360eb591f5f30d64df178dc8f56252 cf203ce20589b6fb295ce47188fc692b 6b8d2f0b60f8594f9ec37c82c1c090bc d224740bffda9cef0d69a17005b50e57 …` (1573 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 9** — [BIKE-L1 PQCkemKAT_BIKE_3114.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `00000000000000000000000000010000 00000000000000000000000000001000 00000000000000000000002000000001 00000000000000000004000000000000 …` (3114 bytes; the full value is in the source) |
| `sharedSecret` | `c748cc2121532efeeba47f446e8393b7202400463bebde6e45882acab8ddeec6` |
| `input` | `2c360eb591f5f30d64df178dc8f56252 cf203ce20589b6fb295ce47188fc692b 6b8d2f0b60f8594f9ec37c82c1c090bc d224740bffda9cef0d69a17005b50e57 …` (1573 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 10** — [BIKE-L3 PQCkemKAT_BIKE_6198.rsp record 0: seed to public key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l3 |
| `keyGenerationOutput` | publicKey |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `544f1c33a27d5f9b3d9fdcc275e9121b 178c63b483ce1ed1d6f89641dfd9e623 48fe91c29d0cac7bf40bc6537e994051 5455845b9546601fc38d68bfe8374ddf …` (3083 bytes; the full value is in the source) |

**Vector 11** — [BIKE-L3 PQCkemKAT_BIKE_6198.rsp record 0: seed to encapsulated shared secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l3 |
| `keyGenerationOutput` | sharedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `fee9450f15a1a26b6d9a4ef711075b25d8561077995923726ec6e848ccf0f10c` |

**Vector 12** — [BIKE-L3 PQCkemKAT_BIKE_6198.rsp record 0: decapsulating its own ciphertext returns the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l3 |
| `keyGenerationOutput` | decapsulatedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `fee9450f15a1a26b6d9a4ef711075b25d8561077995923726ec6e848ccf0f10c` |

**Vector 13** — [BIKE-L5 PQCkemKAT_BIKE_10276.rsp record 0: seed to public key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l5 |
| `keyGenerationOutput` | publicKey |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `afb9cb19bbf20a9c8c25338c6d231c4e 15c808f5e2e0dfc98c5939a1301997fd 951cca0f5144e71b771b97d682be8c16 2b3dec0595a266ef9b71ba8d8b4d1935 …` (5122 bytes; the full value is in the source) |

**Vector 14** — [BIKE-L5 PQCkemKAT_BIKE_10276.rsp record 0: seed to encapsulated shared secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l5 |
| `keyGenerationOutput` | sharedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `e1e29c8d115dcbe54eb4416e012f74ab61d9c7d63e8c3188cc97c27e39518e0b` |

**Vector 15** — [BIKE-L5 PQCkemKAT_BIKE_10276.rsp record 0: decapsulating its own ciphertext returns the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/BIKE-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | bike-l5 |
| `keyGenerationOutput` | decapsulatedSecret |
| `input` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `expected` | `e1e29c8d115dcbe54eb4416e012f74ab61d9c7d63e8c3188cc97c27e39518e0b` |

---

[← All algorithms](../README.md)
