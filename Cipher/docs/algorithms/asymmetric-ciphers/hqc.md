# HQC

> Hamming Quasi-Cyclic, the code-based key encapsulation mechanism NIST selected in March 2025 as its backup to ML-KEM. The public key is a random quasi-cyclic h with the syndrome x + h y of a low weight secret; a message is carried by a concatenated Reed-Solomon and duplicated Reed-Muller codeword masked by that syndrome, so decryption is a decoding problem only the secret makes tractable. All three round 4 parameter sets are implemented and verified against the submission's own Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Key Encapsulation |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Carlos Aguilar Melchor, Nicolas Aragon, Slim Bettaieb, Loic Bidoux, Olivier Blazy, Jean-Christophe Deneuville, Philippe Gaborit, Edoardo Persichetti, Gilles Zemor |
| Year | 2017 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/asymmetric/hqc.js`](../../../algorithms/asymmetric/hqc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 128 bytes (1024 bits); 192 bytes (1536 bits); 256 bytes (2048 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [HQC Official Site](https://pqc-hqc.org/)
- [HQC Specification](https://pqc-hqc.org/doc/hqc_specifications_2025_08_22.pdf)
- [NIST Selects HQC](https://csrc.nist.gov/pubs/ir/8545/final)
- [Efficient Encryption from Random Quasi-Cyclic Codes](https://arxiv.org/abs/1612.05572)

## References

- [HQC Round 4 Submission Package and Known Answer Tests](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)
- [HQC Reference Implementation](https://gitlab.com/pqc-hqc/hqc)
- [Sampling Fixed Weight Vectors](https://eprint.iacr.org/2021/1631)

## Test vectors

15 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [HQC-128 hqc-128_kat.rsp record 0: seed to public key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-128 |
| `keyGenerationOutput` | publicKey |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `5009c2e5c95aa03dcbf09f69c9529da9 7f496712e083181f51f06aa7e7f73314 9cce4bd1a190a9b5cd376f2400ea478b 9416b4969034f791bb2aa09eaa62b828 …` (2249 bytes; the full value is in the source) |

**Vector 2** — [HQC-128 hqc-128_kat.rsp record 0: seed to secret key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-128 |
| `keyGenerationOutput` | privateKey |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `9ede2a61c7f15adc29dda6cb30e086e2 d67b86fec8172369f3953548d3bd1474 94c86c53da5ab23a5009c2e5c95aa03d cbf09f69c9529da97f496712e083181f …` (2289 bytes; the full value is in the source) |

**Vector 3** — [HQC-128 hqc-128_kat.rsp record 0: seed to ciphertext](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-128 |
| `keyGenerationOutput` | ciphertext |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `d02633bd49ce27afe750e0582f8152ee 484e1a2787c0277ed436244616c9a0d5 71e94b107db13da59528960e2b2c469b 735a6c20f60bb2e7c1b2046ebddf82ba …` (4497 bytes; the full value is in the source) |

**Vector 4** — [HQC-128 hqc-128_kat.rsp record 0: seed to encapsulated shared secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-128 |
| `keyGenerationOutput` | sharedSecret |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `dab185fe3faf252eff8f563ee157c709 43fadbf11dd493fb561e70f22d4dc0e7 0a207e084109d96f1a7da36ea4e661ce 2ae9907632d74a8f45dfb6971c4124f6` |

**Vector 5** — [HQC-128 hqc-128_kat.rsp record 0: decapsulating its own ciphertext returns the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-128 |
| `keyGenerationOutput` | decapsulatedSecret |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `dab185fe3faf252eff8f563ee157c709 43fadbf11dd493fb561e70f22d4dc0e7 0a207e084109d96f1a7da36ea4e661ce 2ae9907632d74a8f45dfb6971c4124f6` |

**Vector 6** — [HQC-128 hqc-128_kat.rsp record 0: decapsulation of the published ciphertext under the published secret key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `9ede2a61c7f15adc29dda6cb30e086e2 d67b86fec8172369f3953548d3bd1474 94c86c53da5ab23a5009c2e5c95aa03d cbf09f69c9529da97f496712e083181f …` (2289 bytes; the full value is in the source) |
| `input` | `d02633bd49ce27afe750e0582f8152ee 484e1a2787c0277ed436244616c9a0d5 71e94b107db13da59528960e2b2c469b 735a6c20f60bb2e7c1b2046ebddf82ba …` (4497 bytes; the full value is in the source) |
| `expected` | `dab185fe3faf252eff8f563ee157c709 43fadbf11dd493fb561e70f22d4dc0e7 0a207e084109d96f1a7da36ea4e661ce 2ae9907632d74a8f45dfb6971c4124f6` |

**Vector 7** — [HQC-128 hqc-128_kat.rsp record 0: the recovered secret is the published one](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `9ede2a61c7f15adc29dda6cb30e086e2 d67b86fec8172369f3953548d3bd1474 94c86c53da5ab23a5009c2e5c95aa03d cbf09f69c9529da97f496712e083181f …` (2289 bytes; the full value is in the source) |
| `sharedSecret` | `dab185fe3faf252eff8f563ee157c709 43fadbf11dd493fb561e70f22d4dc0e7 0a207e084109d96f1a7da36ea4e661ce 2ae9907632d74a8f45dfb6971c4124f6` |
| `input` | `d02633bd49ce27afe750e0582f8152ee 484e1a2787c0277ed436244616c9a0d5 71e94b107db13da59528960e2b2c469b 735a6c20f60bb2e7c1b2046ebddf82ba …` (4497 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 8** — [HQC-128 hqc-128_kat.rsp record 0: a modified ciphertext must not decapsulate to the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `9ede2a61c7f15adc29dda6cb30e086e2 d67b86fec8172369f3953548d3bd1474 94c86c53da5ab23a5009c2e5c95aa03d cbf09f69c9529da97f496712e083181f …` (2289 bytes; the full value is in the source) |
| `sharedSecret` | `dab185fe3faf252eff8f563ee157c709 43fadbf11dd493fb561e70f22d4dc0e7 0a207e084109d96f1a7da36ea4e661ce 2ae9907632d74a8f45dfb6971c4124f6` |
| `input` | `d12633bd49ce27afe750e0582f8152ee 484e1a2787c0277ed436244616c9a0d5 71e94b107db13da59528960e2b2c469b 735a6c20f60bb2e7c1b2046ebddf82ba …` (4497 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 9** — [HQC-128 hqc-128_kat.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `privateKey` | `35e7ff98c3905928348699356538d3da 488ad91c0c81bfd72bb3de8e91b1b478 e39c57579d11f20b2237fa9ed7968133 4bcd1d0faf36cf1d8b00ed17cccd8fd1 …` (2289 bytes; the full value is in the source) |
| `sharedSecret` | `dab185fe3faf252eff8f563ee157c709 43fadbf11dd493fb561e70f22d4dc0e7 0a207e084109d96f1a7da36ea4e661ce 2ae9907632d74a8f45dfb6971c4124f6` |
| `input` | `d02633bd49ce27afe750e0582f8152ee 484e1a2787c0277ed436244616c9a0d5 71e94b107db13da59528960e2b2c469b 735a6c20f60bb2e7c1b2046ebddf82ba …` (4497 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 10** — [HQC-192 hqc-192_kat.rsp record 0: seed to public key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-192 |
| `keyGenerationOutput` | publicKey |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `5009c2e5c95aa03dcbf09f69c9529da9 7f496712e083181f51f06aa7e7f73314 9cce4bd1a190a9b5b42558a7328aa100 87044e5c9017402c8af07ffaaace70a7 …` (4522 bytes; the full value is in the source) |

**Vector 11** — [HQC-192 hqc-192_kat.rsp record 0: seed to encapsulated shared secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-192 |
| `keyGenerationOutput` | sharedSecret |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `857169e8d11add62b7072ee33c4a4a6a 229e2477598cc6c534bf61523d7a5b5e 04ea03760c3527de11baa9e31da2bf38 2ddc9d3ec5c5e6ba938f7f8ea0d6af7f` |

**Vector 12** — [HQC-192 hqc-192_kat.rsp record 0: decapsulating its own ciphertext returns the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-192 |
| `keyGenerationOutput` | decapsulatedSecret |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `857169e8d11add62b7072ee33c4a4a6a 229e2477598cc6c534bf61523d7a5b5e 04ea03760c3527de11baa9e31da2bf38 2ddc9d3ec5c5e6ba938f7f8ea0d6af7f` |

**Vector 13** — [HQC-256 hqc-256_kat.rsp record 0: seed to public key](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-256 |
| `keyGenerationOutput` | publicKey |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `5009c2e5c95aa03dcbf09f69c9529da9 7f496712e083181f51f06aa7e7f73314 9cce4bd1a190a9b53ff761db49c50bb1 a8231631e4946eec090707fd6cb8a5ad …` (7245 bytes; the full value is in the source) |

**Vector 14** — [HQC-256 hqc-256_kat.rsp record 0: seed to encapsulated shared secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-256 |
| `keyGenerationOutput` | sharedSecret |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `8bdd2446f939f77a5e6075b0244a804a 33d3ed5978f8055f29f4431629cb3311 25fb1cf05b45f0d6723a915ecd9bee2e f7b0f362093a20464f8bdd56282ac9be` |

**Vector 15** — [HQC-256 hqc-256_kat.rsp record 0: decapsulating its own ciphertext returns the published secret](https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-4/submissions/HQC-Round4.zip)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | hqc-256 |
| `keyGenerationOutput` | decapsulatedSecret |
| `input` | `42c667a186390f26c8f024d31d5fe3d2 0145bc2fccf26c865e20df7626cef09e 4d9eadd263d95ede934a74b3721eaab0` |
| `expected` | `8bdd2446f939f77a5e6075b0244a804a 33d3ed5978f8055f29f4431629cb3311 25fb1cf05b45f0d6723a915ecd9bee2e f7b0f362093a20464f8bdd56282ac9be` |

---

[← All algorithms](../README.md)
