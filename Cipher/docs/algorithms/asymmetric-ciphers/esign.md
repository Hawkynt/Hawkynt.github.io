# ESIGN

> Okamoto's signature scheme over a modulus n = p²q, in the derandomised ESIGN-D form of the NESSIE submission. A signature is a value whose e-th power modulo n begins with the message representative, which the holder of p and q solves for directly because the square of any multiple of pq vanishes modulo p²q. Signing costs one exponentiation with a small exponent and no inversion modulo n, which is what made the scheme fast enough to be proposed for smart cards.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Digital Signature |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Tatsuaki Okamoto, Jacques Stern, Serge Vaudenay |
| Year | 1990 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/asymmetric/esign.js`](../../../algorithms/asymmetric/esign.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1536 bytes (12288 bits); 3072 bytes (24576 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Broken for small exponents](https://www.iacr.org/archive/crypto2002/24420001/24420001.pdf) | — | ESIGN with e = 3 was broken outright and the original argument for small e does not hold. The published keys here carry e = 65537; do not reduce it. The specification requires e to be at least 3*pLen/2 |
| [Security proof withdrawn](https://eprint.iacr.org/2001/077) | — | The reduction originally claimed for ESIGN was shown not to establish what it claimed, so the scheme rests on the unbroken-in-practice status of the approximate e-th root problem rather than on a proof. Prefer a scheme with a standing reduction |
| [Published demonstration keys](https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip) | — | The key pairs in this file, including their ESIGN-D seeds, are printed in the source and confer no confidentiality. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration |

## Documentation

- [NESSIE ESIGN-D specification (NTT, 2002)](https://web.archive.org/web/2016id_/http://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/esignd-spec.pdf)
- [IEEE P1363a - Additional Public-Key Techniques (ESIGN, EMSA5)](https://grouper.ieee.org/groups/1363/P1363a/)
- [Okamoto - A Fast Signature Scheme Based on Congruential Polynomial Operations](https://ieeexplore.ieee.org/document/44624)
- [RFC 8017 Appendix B.2.1 - MGF1](https://www.rfc-editor.org/rfc/rfc8017#appendix-B.2.1)

## References

- [NESSIE ESIGN-D test vectors](https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip)
- [NTT MCL IEEE P1363a ESIGN/EMSA5 test vectors](https://web.archive.org/web/20050907111319id_/http://www.nttmcl.com/sec/Esign/esign_emsa5_data_ntt.txt)
- [Crypto++ ESIGN implementation and test vectors](https://github.com/weidai11/cryptopp/blob/master/esign.cpp)
- [Granboulan - How to repair ESIGN](https://www.di.ens.fr/~granboul/recherche/publications/data/esignupdate-pub.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ESIGN-D 1536-bit, NESSIE test vector key block 0 (first attempt counter accepted)](https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip)

| Field | Value |
| --- | --- |
| `key` | `0600` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `2e83553dc834d60e5d7d76b7a1ddf61c 243791a029bd6d528392706c58dd5e15 bccd89400311a8692e67415056b45685 4cbe348835af7189768f92fe65bbcaaf 91814b01d06a59e09244d36614c4a43e aae8906ff5e9bef25fe1cc17cb536106 5c38abe407d6b72dd3f0e5fbfeff7eb2 24d90ec2b81dddd8d3cabcf8bc3476b1 7b33e17101cc5df98614150684070905 b07f69ddca7655dee2e11867631bb93f 45948e172821398352e522c1ef6a5097 db442b6e4de3c17a1b67b965f983f1ea 00000000000000000000000000000000` |

**Vector 2** — [ESIGN-D 1536-bit, NESSIE test vector key block 4 (three attempt counters rejected by the w1 bound)](https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip)

| Field | Value |
| --- | --- |
| `key` | `0604` |
| `input` | `55555555555555555555555555555555` |
| `expected` | `32541abb879bc26dc5ffee0d9ad6079d a1ae44b559d015ed41de51366480f55f c74b8b94aebd4c1a0a5fd469c77a755a 7e770fa306f6b2dd37e9a49374d4fc78 0d724dbbff7550de7f3eb6a38ecfef0b c7b59ed0269bdb85d63ec065aaa76d91 c0778a28333b3912153daa1f945e6052 16a331fddd28ce24c29a4736483f0d10 ac8a4743b1239b481fb37219f5c305fa 3aac655ca4c88966b0be2253a26f70e7 904981254280fda91a3ce0a651adf5e8 9211e37747b5fb9e6023ab7a8b22dccb 55555555555555555555555555555555` |

**Vector 3** — [ESIGN-D 3072-bit, NESSIE test vector key block 10 (first attempt counter accepted)](https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip)

| Field | Value |
| --- | --- |
| `key` | `0c0a` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `432eb5256ff762e565b578d650b0ea6c 4487739916a55a9cbb0aab8676c6fa4b c2abc3280507665df8f9c1e7138e1bf3 845687468c9bf6a5f630d525a2e5e701 …` (400 bytes; the full value is in the source) |

**Vector 4** — [ESIGN-D 3072-bit, NESSIE test vector key block 12 (three attempt counters rejected by the w1 bound)](https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip)

| Field | Value |
| --- | --- |
| `key` | `0c0c` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `5cf1e3078f51be24433c0c991df43000 d4cceb7154b7e9cadb78d343d2ed67c2 48aefe254172c270d4ba2ada0ad03387 773b1deebccc931267be0deaf03d19ad …` (400 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
