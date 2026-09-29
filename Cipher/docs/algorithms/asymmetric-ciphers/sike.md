# SIKE

> Supersingular Isogeny Key Encapsulation, the NIST post-quantum round 3 KEM built on isogenies between supersingular elliptic curves over GF(p^2). Broken: the Castryck-Decru attack recovers the secret key from the torsion-point images published with it, so the submission was withdrawn. The four uncompressed parameter sets are implemented and verified against the submission Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Key Encapsulation |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | David Jao, Luca De Feo, Jerome Plut, Craig Costello, Patrick Longa, Michael Naehrig, Reza Azarderakhsh, Matthew Campagna, Basil Hess, Amir Jalali, Brian Koziel, Joost Renes, Vladimir Soukharev, David Urbanik |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/sike.js`](../../../algorithms/asymmetric/sike.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 374 bytes (2992 bits); 434 bytes (3472 bits); 524 bytes (4192 bits); 644 bytes (5152 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Key recovery in polynomial time (Castryck-Decru)](https://eprint.iacr.org/2022/975) | The public key publishes the images of a known torsion basis under the secret isogeny. Glue-and-split on a product of elliptic curves turns those images into a sequence of decisions that recover the isogeny itself, so the secret key follows from the public key alone. SIKEp434 fell in about an hour on one core in the original paper and in minutes after the follow-up work. | None. The scheme is broken for every parameter set and was withdrawn from standardisation; use a KEM whose security does not rest on the isogeny problem with torsion-point hints. |

## Documentation

- [SIKE round 3 specification](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)
- [NIST PQC round 3 submissions](https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions)
- [Towards quantum-resistant cryptosystems from supersingular elliptic curve isogenies](https://eprint.iacr.org/2011/506)

## References

- [SIKE reference and optimised implementations](https://github.com/microsoft/PQCrypto-SIDH)
- [Efficient compression of SIDH public keys](https://eprint.iacr.org/2016/963)

## Test vectors

18 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SIKE PQCkemKAT_374.rsp record 0: drawn randomness to public key (SIKEp434)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | SIKEp434 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e7d` |
| `expected` | `4484d7aadb44b40cc180dc568b2c142a 60e6e2863f5988614a6215254b2f5f6f 79b48f329ad1a2ded20b7abab10f7dbf 59c3e20b59a700093060d2a44acdc008 …` (330 bytes; the full value is in the source) |

**Vector 2** — [SIKE PQCkemKAT_374.rsp record 0: drawn randomness to secret key (SIKEp434)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | SIKEp434 |
| `keyGenerationOutput` | privateKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e7d` |
| `expected` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e014484d7aa db44b40cc180dc568b2c142a60e6e286 …` (374 bytes; the full value is in the source) |

**Vector 3** — [SIKE PQCkemKAT_374.rsp record 0: encapsulation ciphertext (SIKEp434)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `publicKey` | `4484d7aadb44b40cc180dc568b2c142a 60e6e2863f5988614a6215254b2f5f6f 79b48f329ad1a2ded20b7abab10f7dbf 59c3e20b59a700093060d2a44acdc008 …` (330 bytes; the full value is in the source) |
| `encapsulationOutput` | ciphertext |
| `input` | `cf9297d43c3e763a1b96d658428ec356` |
| `expected` | `0fdeb26dbd96e0cd272283ca5bdd1435 bc9a7f9ab7fc24f83ca926deed038ae4 e47f39f9886e0bd7eebeaacd12ab435c c92aa3383b2c01e6b9e02bc3bef9c6c2 …` (346 bytes; the full value is in the source) |

**Vector 4** — [SIKE PQCkemKAT_374.rsp record 0: encapsulated shared secret (SIKEp434)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `publicKey` | `4484d7aadb44b40cc180dc568b2c142a 60e6e2863f5988614a6215254b2f5f6f 79b48f329ad1a2ded20b7abab10f7dbf 59c3e20b59a700093060d2a44acdc008 …` (330 bytes; the full value is in the source) |
| `encapsulationOutput` | sharedSecret |
| `input` | `cf9297d43c3e763a1b96d658428ec356` |
| `expected` | `35f7f8ff388714dedc41f139078cedc9` |

**Vector 5** — [SIKE PQCkemKAT_374.rsp record 0: decapsulation recovers the shared secret (SIKEp434)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e014484d7aa db44b40cc180dc568b2c142a60e6e286 …` (374 bytes; the full value is in the source) |
| `input` | `0fdeb26dbd96e0cd272283ca5bdd1435 bc9a7f9ab7fc24f83ca926deed038ae4 e47f39f9886e0bd7eebeaacd12ab435c c92aa3383b2c01e6b9e02bc3bef9c6c2 …` (346 bytes; the full value is in the source) |
| `expected` | `35f7f8ff388714dedc41f139078cedc9` |

**Vector 6** — [SIKE PQCkemKAT_374.rsp record 0: the recovered secret is the published one (SIKEp434)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e014484d7aa db44b40cc180dc568b2c142a60e6e286 …` (374 bytes; the full value is in the source) |
| `sharedSecret` | `35f7f8ff388714dedc41f139078cedc9` |
| `input` | `0fdeb26dbd96e0cd272283ca5bdd1435 bc9a7f9ab7fc24f83ca926deed038ae4 e47f39f9886e0bd7eebeaacd12ab435c c92aa3383b2c01e6b9e02bc3bef9c6c2 …` (346 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 7** — [SIKE PQCkemKAT_374.rsp record 0: a modified ciphertext must not decapsulate to the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e014484d7aa db44b40cc180dc568b2c142a60e6e286 …` (374 bytes; the full value is in the source) |
| `sharedSecret` | `35f7f8ff388714dedc41f139078cedc9` |
| `input` | `0fdeb26dbd96e0cc272283ca5bdd1435 bc9a7f9ab7fc24f83ca926deed038ae4 e47f39f9886e0bd7eebeaacd12ab435c c92aa3383b2c01e6b9e02bc3bef9c6c2 …` (346 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 8** — [SIKE PQCkemKAT_374.rsp record 0: the message half of the ciphertext must be bound too](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 91282214654cb55e7c2cacd53919604d 5bac7b23eef4b315feef5e014484d7aa db44b40cc180dc568b2c142a60e6e286 …` (374 bytes; the full value is in the source) |
| `sharedSecret` | `35f7f8ff388714dedc41f139078cedc9` |
| `input` | `0fdeb26dbd96e0cd272283ca5bdd1435 bc9a7f9ab7fc24f83ca926deed038ae4 e47f39f9886e0bd7eebeaacd12ab435c c92aa3383b2c01e6b9e02bc3bef9c6c2 …` (346 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 9** — [SIKE PQCkemKAT_374.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `d60b93492a1d8c1c7ba6fc0b733137f3 e37bfe55b43b32448f375903d8d226ec 94adbfea1d2b3536eb987001c9f73e44 97aaa3fdf9eb688135866a8a83934ba1 …` (374 bytes; the full value is in the source) |
| `sharedSecret` | `35f7f8ff388714dedc41f139078cedc9` |
| `input` | `0fdeb26dbd96e0cd272283ca5bdd1435 bc9a7f9ab7fc24f83ca926deed038ae4 e47f39f9886e0bd7eebeaacd12ab435c c92aa3383b2c01e6b9e02bc3bef9c6c2 …` (346 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 10** — [SIKE PQCkemKAT_434.rsp record 0: drawn randomness to public key (SIKEp503)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | SIKEp503 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc 90fa9e8b872bfb8f` |
| `expected` | `05279d27ff7e3a38abb05dcfe23b5831 c030d832d3eae35fe06a6538597532d2 2a0f4012fb2263e160495f8291b58d9d f8a8947c7cf3e6735520bb2d09491240 …` (378 bytes; the full value is in the source) |

**Vector 11** — [SIKE PQCkemKAT_434.rsp record 0: encapsulation ciphertext (SIKEp503)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `publicKey` | `05279d27ff7e3a38abb05dcfe23b5831 c030d832d3eae35fe06a6538597532d2 2a0f4012fb2263e160495f8291b58d9d f8a8947c7cf3e6735520bb2d09491240 …` (378 bytes; the full value is in the source) |
| `encapsulationOutput` | ciphertext |
| `input` | `147c03f7a5bebba406c8fae1874d7f13c80efe79a3a9a874` |
| `expected` | `100692a8bd30f01be8ac6b1af8d93a06 0d3821b2587f4038d64b72426a194bed e63ca60b75a5c3c15532ce307115aa9d 77ac232e14d99c1e1afef1eb2d6321ae …` (402 bytes; the full value is in the source) |

**Vector 12** — [SIKE PQCkemKAT_434.rsp record 0: decapsulation recovers the shared secret (SIKEp503)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc 90fa9e8b872bfb0f05279d27ff7e3a38 …` (434 bytes; the full value is in the source) |
| `input` | `100692a8bd30f01be8ac6b1af8d93a06 0d3821b2587f4038d64b72426a194bed e63ca60b75a5c3c15532ce307115aa9d 77ac232e14d99c1e1afef1eb2d6321ae …` (402 bytes; the full value is in the source) |
| `expected` | `af1280151c2c59b4d4150b18ba7f71590523cea83c9bddda` |

**Vector 13** — [SIKE PQCkemKAT_524.rsp record 0: drawn randomness to public key (SIKEp610)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | SIKEp610 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc 90fa9e8b872bfb8fab0a72898521` |
| `expected` | `671b24769304dd18c97af0c5de741c53 e0b45a9e18c7a13a15c1758125e41605 587e450f8452a2bf98b51c2af6b0503c b8e01f8553c36079ebfadf4948ffa063 …` (462 bytes; the full value is in the source) |

**Vector 14** — [SIKE PQCkemKAT_524.rsp record 0: encapsulation ciphertext (SIKEp610)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `publicKey` | `671b24769304dd18c97af0c5de741c53 e0b45a9e18c7a13a15c1758125e41605 587e450f8452a2bf98b51c2af6b0503c b8e01f8553c36079ebfadf4948ffa063 …` (462 bytes; the full value is in the source) |
| `encapsulationOutput` | ciphertext |
| `input` | `6255563ba961772146ca0867678d56787cad77ab4fc8fcfe` |
| `expected` | `fb75e7d835313132ac0b29d8732f1f62 e6dd10bbf30375b4a50c7b153431bae6 259e1c5526c07164e87edc70e4f0d833 1d73285661d1f639d216372d05b4583c …` (486 bytes; the full value is in the source) |

**Vector 15** — [SIKE PQCkemKAT_524.rsp record 0: decapsulation recovers the shared secret (SIKEp610)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148038626ed79d4511408 00e03b59b956f8210e556067407d13dc 90fa9e8b872bfb8fab0a72898521671b …` (524 bytes; the full value is in the source) |
| `input` | `fb75e7d835313132ac0b29d8732f1f62 e6dd10bbf30375b4a50c7b153431bae6 259e1c5526c07164e87edc70e4f0d833 1d73285661d1f639d216372d05b4583c …` (486 bytes; the full value is in the source) |
| `expected` | `0a5cfc45865775d0cc10f89efad9ffd33a6c8a7ab868309d` |

**Vector 16** — [SIKE PQCkemKAT_644.rsp record 0: drawn randomness to public key (SIKEp751)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | SIKEp751 |
| `keyGenerationOutput` | publicKey |
| `input` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f ab0a7289852106e40538d3575c50028d` |
| `expected` | `e1a758ec0d418bfe86d8077b5bb16913 3c06c1f2a067d8b202d9d058ffc51f63 fd26155a6577c74ba7f1a27e7ba51982 517b923615deb00be408920a07831df5 …` (564 bytes; the full value is in the source) |

**Vector 17** — [SIKE PQCkemKAT_644.rsp record 0: encapsulation ciphertext (SIKEp751)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `publicKey` | `e1a758ec0d418bfe86d8077b5bb16913 3c06c1f2a067d8b202d9d058ffc51f63 fd26155a6577c74ba7f1a27e7ba51982 517b923615deb00be408920a07831df5 …` (564 bytes; the full value is in the source) |
| `encapsulationOutput` | ciphertext |
| `input` | `6255563ba961772146ca0867678d56787cad77ab4fc8fcfe9e02df839c99424d` |
| `expected` | `66d24bc4630b2ee312f01b26ec1d3ec1 f583795ec93b90fd9b5453e0beda2a70 fb6181c9b9ea86a9866f1468e62ce853 c6c65aa5d0e4535828b3a97e2d1d31dc …` (596 bytes; the full value is in the source) |

**Vector 18** — [SIKE PQCkemKAT_644.rsp record 0: decapsulation recovers the shared secret (SIKEp751)](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `7c9935a0b07694aa0c6d10e4db6b1add 2fd81a25ccb148032dcd739936737f2d 8626ed79d451140800e03b59b956f821 0e556067407d13dc90fa9e8b872bfb8f …` (644 bytes; the full value is in the source) |
| `input` | `66d24bc4630b2ee312f01b26ec1d3ec1 f583795ec93b90fd9b5453e0beda2a70 fb6181c9b9ea86a9866f1468e62ce853 c6c65aa5d0e4535828b3a97e2d1d31dc …` (596 bytes; the full value is in the source) |
| `expected` | `fee94595e8a05c50113c044d4d8558da101035ebbf604aa41d0aaa75b8a7f786` |

---

[← All algorithms](../README.md)
