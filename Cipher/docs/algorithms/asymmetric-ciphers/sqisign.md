# SQIsign

> Short Quaternion and Isogeny Signature, the NIST additional-signatures round 2 candidate with the smallest combined public key and signature of any post-quantum scheme: 65 and 148 bytes at the first level. A signature is an isogeny between supersingular curves that only the holder of the public curve's endomorphism ring can find; verification rebuilds it as a chain of 4-isogenies and a two-dimensional isogeny in the theta model. This file verifies signatures for all three levels and does not produce them.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Digital Signature |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Marius A. Aardal, Gora Adj, Diego F. Aranha, Andrea Basso, Isaac Andrés Canales Martínez, Jorge Chávez-Saab, Maria Corte-Real Santos, Pierrick Dartois, Luca De Feo, Max Duparc, Jonathan Komada Eriksen, Tako Boris Fouotsa, Décio Luiz Gazzoni Filho, Basil Hess, David Kohel, Antonin Leroux, Patrick Longa, Luciano Maino, Michael Meyer, Kohei Nakagawa, Hiroshi Onuki, Lorenz Panny, Sikhar Patranabis, Christophe Petit, Giacomo Pope, Krijn Reijnders, Damien Robert, Francisco Rodríguez-Henríquez, Sina Schaeffler, Benjamin Wesolowski |
| Year | 2020 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/sqisign.js`](../../../algorithms/asymmetric/sqisign.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 65 bytes (520 bits); 97 bytes (776 bits); 129 bytes (1032 bits) |

## Parameter sets

- SQIsign-I
- SQIsign-III
- SQIsign-V

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Signing is not implemented here](https://sqisign.org/) | This file verifies signatures and cannot produce them: CreateInstance(false) returns null. Signing needs ideal-to-isogeny translation in a quaternion algebra, which is not carried. | Use the reference implementation to sign. This one checks the result. |
| [Under evaluation, not standardised](https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures) | SQIsign is a round 2 candidate of the NIST additional-signatures process and its verification changed completely between rounds, from a one-dimensional to a two-dimensional isogeny. Its security rests on the hardness of computing the endomorphism ring of a supersingular curve, which is younger than the assumptions behind the standardised schemes. | Treat it as experimental. Round 1 signatures do not verify here. |
| [Verification here is not constant time](https://sqisign.org/) | The BigInt arithmetic and the early exits make the running time depend on the signature. Verification handles public data only. | Treat this as a reference for the verification algorithm rather than a hardened implementation. |

## Documentation

- [SQIsign round 2 specification](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/sqisign-spec-round2-web.pdf)
- [SQIsign project site](https://sqisign.org/)
- [NIST PQC additional digital signature schemes, round 2](https://csrc.nist.gov/projects/pqc-dig-sig/round-2-additional-signatures)
- [SQIsign: compact post-quantum signatures from quaternions and isogenies (2020)](https://eprint.iacr.org/2020/1240)
- [SQIsign2D-West: the two-dimensional verification (2024)](https://eprint.iacr.org/2024/760)

## References

- [Round 2 submission package and Known Answer Tests](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)
- [SQIsign reference implementation](https://github.com/SQISign/the-sqisign)
- [Optimized one-dimensional SQIsign verification (the square root used here)](https://eprint.iacr.org/2024/1563)

## Test vectors

26 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SQIsign-I PQCsignKAT_353_SQIsign_lvl1.rsp count 1 (backtracking and a 2^2 response isogeny on P): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 2** — [SQIsign-I PQCsignKAT_353_SQIsign_lvl1.rsp count 7 (no backtracking and no response isogeny): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `bb1ed0183d5192fd52fcf31315cc9263 2e443acd6a4377010310498419b9f401 2d924db8d9847862cbd0a6f920da91ac 258d2b11f09c08b699e16cfadbc1f604 02` |
| `input` | `25750d798e050ed506b37fd67a1d5cc7 4b3b84239acc1fac04c4165156d8e501 03be1240850cade72f97bc9ca9a56987 b19ad960e65c4989fa4ae77dec52eb01 …` (412 bytes; the full value is in the source) |
| `expected` | `a1586245d81f96bd8ee81aa30f10c0ad b343d74cf72c4dff71550c12873af89f a1874d4731c996243c3749af3f6188ff e9fa45430549045134eb29ef3cec37e7 …` (264 bytes; the full value is in the source) |

**Vector 3** — [SQIsign-I PQCsignKAT_353_SQIsign_lvl1.rsp count 14 (backtracking and a response isogeny on Q): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `2ffc0e8fed091ae82c2fb18a662772de 22fddfa4bae6e6ad4b17cec22c69d802 54e447611a108a126de83acf74dedeab aea4d4b84073915ae7e9570a1ebdd101 0b` |
| `input` | `1acbe3fbb26b8c020dd11dab10262f63 1ef20863480a8582b2f3adffa01c4b02 a86d4e6ac0f239fb42d59fdfc5dd867a 5e477657e9bec19cecf987e97e9aed00 …` (643 bytes; the full value is in the source) |
| `expected` | `8cb18850e27d8416b88a9a71f4a66bdf 447814db6c82098c371b53f61600ef5d fd88e4fb34200207c3f6f55166af4878 d38fca7e2dc18fe662e3ea491b58a862 …` (495 bytes; the full value is in the source) |

**Vector 4** — [SQIsign-III PQCsignKAT_529_SQIsign_lvl3.rsp count 2 (backtracking and a 2^1 response isogeny on Q): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `eb728ce5e8a421f40bfe8880ecab2a24 0ee04f7a225e59b71c4f7fd7a454958e 3b0bd76b85f77ff8105b9af50c4c0d19 da1da62884f73f7f594dc20f645ebd98 ee6dfdb697e78725c1bd9db18b1cfe38 00390f5d36e0daeb99b294695c23202b 08` |
| `input` | `da3af5395ad7bbb673824e96917ea1c1 9b670f7d0739b34631cc9dc5eb02f5b1 128f8c53af12527b9cc4e117bca0af20 172cb6628c16ea99d3e142307a5b7bb7 …` (323 bytes; the full value is in the source) |
| `expected` | `2b8c4b0f29363eaee469a7e33524538a a066ae98980eaa19d1f10593203da214 3b9e9e1973f7ff0e6c6aaa3c0b900e50 d003412efe96deece3046d8c46bc7709 228789775abdf56aed6416c90033780c b7a4984815da1b14660dcf34aa34bf82 cebbcf` |

**Vector 5** — [SQIsign-III PQCsignKAT_529_SQIsign_lvl3.rsp count 4 (no backtracking and no response isogeny): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `f5e50cb53363976ceb633e49c7efab26 ad1bab13e2b678aade4f20692c9d3707 5e3cd3ed463949811257ab4dd36beb3d a475dac1d2bd235dbf8253719600b769 b7b0c54f7fcdde8c7218f082cf5430f9 e782629973e4ba480a2291d629131102 08` |
| `input` | `6285d7bf636914656ac4e9ccb92b0af1 97c87f97b29e92ac08030970b13c86bb daef9fe677b22b3072768ecc99d24902 32ce57e3c229dde967e241dd53d6f69d …` (389 bytes; the full value is in the source) |
| `expected` | `1cdf0ae1124780a8ff00318f779a3b86 b3504d059ca7ab3fe4d6eae9fd46428d 1dabb704c0735a8fe8708f409741017b 723d9a304e54fdc5789a7b0748c2464b 7308ac9665115644c569ae253d520575 1342574c03346dddc1950a6273546616 b96d0c5ece0a044af0edefbe445f9ae3 7da5afb8d22a56d9fd1801425a0a276f 48431d7af039521e549551481391fe5f 4ebfb7644d9f9782d83a95137e84ea3a eb3c2f8099` |

**Vector 6** — [SQIsign-III PQCsignKAT_529_SQIsign_lvl3.rsp count 8 (backtracking and a 2^3 response isogeny on P): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `cf617023c07fe87c73f88a258f218cb1 c7a661fef55788eb28cbc2da0226ffca b1a6dceb73011455b9f6f2053227dd40 64836dd9b1dd0561d75cb143d683beab c113114b7714658fc0492806c38d56c3 65e5ed06b71d4b84a8f269467e0f2b25 0d` |
| `input` | `e10e935cbbc3b7b548b565f207f95daa a655959a95f630360c17e6d56a61c291 01da728b6893c73d08791bf6afadc433 7bfbc64c52961cbc4ce4aee971bf66f6 …` (521 bytes; the full value is in the source) |
| `expected` | `9366ed7b3b623c411448b634446f1a3f aabdd163a6cc1e2bcae4a98703cd8cee 441405892fba051be2a586a6950a5ef7 3a255e5f86b0d7212e0c51c3bc79be4b …` (297 bytes; the full value is in the source) |

**Vector 7** — [SQIsign-V PQCsignKAT_701_SQIsign_lvl5.rsp count 1 (backtracking and a 2^1 response isogeny on P): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `ddbf05b82d61dd94c4d04534d013c668 524642505f0d674e0c10006bf6b45c87 dc49b2e3055d9c1ee4c277598a60c295 e174d52f6c4a938bb67730c50d409c01 5bd74fba5c590e0b9eda468865b3eeba 914ac1ff5cbd1e68502dbc7f72b9e5fe c5a593538f641215473cc5441a2fc377 0723b7380bb6664967bbec6a94b64a01 08` |
| `input` | `2fe69d4c312452982e2b0911544d65ee 17554adbecb2a03860a180af5b896404 4f1bae37d60ebef295f7334574007b99 09e8b9d5976a54801394ae59c762a300 …` (358 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 8** — [SQIsign-V PQCsignKAT_701_SQIsign_lvl5.rsp count 2 (no backtracking and no response isogeny): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `4703985adea9f41a6cbcc98227e66269 0352617bbb05d5406297b8a12bebdb1b baaff7c9b69bf5fc5351bdcb3664ad4f 5160c188a390a41b2f36eaefc2c63e01 475746aabc99cd5a8fe6fd0d12c94a75 85fe0b8551d82f83c6c7089a4fa9b057 35ba15f77bc05d9eebcb7628c2491a58 f0768cea699c19603a23e5eb75ceaf00 04` |
| `input` | `f0de30a68ffc1d912bec7a314d61ba53 d6f31db502cda21ec8bda753478d14f6 d43d18474faa819616390823177287bf 7a1c847925b6cda81e69fdcf61571900 …` (391 bytes; the full value is in the source) |
| `expected` | `2b8c4b0f29363eaee469a7e33524538a a066ae98980eaa19d1f10593203da214 3b9e9e1973f7ff0e6c6aaa3c0b900e50 d003412efe96deece3046d8c46bc7709 228789775abdf56aed6416c90033780c b7a4984815da1b14660dcf34aa34bf82 cebbcf` |

**Vector 9** — [SQIsign-V PQCsignKAT_701_SQIsign_lvl5.rsp count 13 (backtracking and a response isogeny on Q): the published signed message opens and yields its message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `37018d6d0c3c5e4d9471f7bfaa0ccfad ff5c2b308522e6135abb974443069af6 9e0f0500cc9e0cce1ea3065b5ce89687 1306fe288e0e54fc86fb73b4822c4001 9ba3daa475b1e71ba878a7580d069d26 b58814ab982354df25b350f2540360d6 21a5d1c693ef36154f62f8978da2cc92 3b6ad80e43e5fd5bfe3b18cfbcff9100 0b` |
| `input` | `435430153ecd491b58c7afbea99b501b 05c0733e71bfaa7036a4af523d97761a 07f727aeecadb01d26cf084bc48851f9 cfabd3b60fd70f115d7b480500342f01 …` (754 bytes; the full value is in the source) |
| `expected` | `439529df1864297e33956afee00a6009 9b658a67830a6a6abddc329e87831d9f 9b647917fedf1ae182a4040214328551 6fcab83f447354c72fae81ac26e7005c …` (462 bytes; the full value is in the source) |

**Vector 10** — [SQIsign-I PQCsignKAT_353_SQIsign_lvl1.rsp count 7: the verdict on the published signature is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `bb1ed0183d5192fd52fcf31315cc9263 2e443acd6a4377010310498419b9f401 2d924db8d9847862cbd0a6f920da91ac 258d2b11f09c08b699e16cfadbc1f604 02` |
| `message` | `a1586245d81f96bd8ee81aa30f10c0ad b343d74cf72c4dff71550c12873af89f a1874d4731c996243c3749af3f6188ff e9fa45430549045134eb29ef3cec37e7 …` (264 bytes; the full value is in the source) |
| `input` | `25750d798e050ed506b37fd67a1d5cc7 4b3b84239acc1fac04c4165156d8e501 03be1240850cade72f97bc9ca9a56987 b19ad960e65c4989fa4ae77dec52eb01 …` (412 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 11** — [SQIsign-III PQCsignKAT_529_SQIsign_lvl3.rsp count 4: the verdict on the published signature is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `f5e50cb53363976ceb633e49c7efab26 ad1bab13e2b678aade4f20692c9d3707 5e3cd3ed463949811257ab4dd36beb3d a475dac1d2bd235dbf8253719600b769 b7b0c54f7fcdde8c7218f082cf5430f9 e782629973e4ba480a2291d629131102 08` |
| `message` | `1cdf0ae1124780a8ff00318f779a3b86 b3504d059ca7ab3fe4d6eae9fd46428d 1dabb704c0735a8fe8708f409741017b 723d9a304e54fdc5789a7b0748c2464b 7308ac9665115644c569ae253d520575 1342574c03346dddc1950a6273546616 b96d0c5ece0a044af0edefbe445f9ae3 7da5afb8d22a56d9fd1801425a0a276f 48431d7af039521e549551481391fe5f 4ebfb7644d9f9782d83a95137e84ea3a eb3c2f8099` |
| `input` | `6285d7bf636914656ac4e9ccb92b0af1 97c87f97b29e92ac08030970b13c86bb daef9fe677b22b3072768ecc99d24902 32ce57e3c229dde967e241dd53d6f69d …` (389 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 12** — [SQIsign-V PQCsignKAT_701_SQIsign_lvl5.rsp count 2: the verdict on the published signature is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `4703985adea9f41a6cbcc98227e66269 0352617bbb05d5406297b8a12bebdb1b baaff7c9b69bf5fc5351bdcb3664ad4f 5160c188a390a41b2f36eaefc2c63e01 475746aabc99cd5a8fe6fd0d12c94a75 85fe0b8551d82f83c6c7089a4fa9b057 35ba15f77bc05d9eebcb7628c2491a58 f0768cea699c19603a23e5eb75ceaf00 04` |
| `message` | `2b8c4b0f29363eaee469a7e33524538a a066ae98980eaa19d1f10593203da214 3b9e9e1973f7ff0e6c6aaa3c0b900e50 d003412efe96deece3046d8c46bc7709 228789775abdf56aed6416c90033780c b7a4984815da1b14660dcf34aa34bf82 cebbcf` |
| `input` | `f0de30a68ffc1d912bec7a314d61ba53 d6f31db502cda21ec8bda753478d14f6 d43d18474faa819616390823177287bf 7a1c847925b6cda81e69fdcf61571900 …` (391 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 13** — [SQIsign-I count 1: a modified message must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd48` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd48` |
| `expected` | `00` |

**Vector 14** — [SQIsign-I count 1: a modified auxiliary curve must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `400e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 15** — [SQIsign-I count 1: a modified backtracking length must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0002e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 16** — [SQIsign-I count 1: a modified response isogeny length must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0103e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 17** — [SQIsign-I count 1: a modified basis-change matrix must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f03f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 18** — [SQIsign-I count 1: a modified challenge must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa49abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 19** — [SQIsign-I count 1: a modified auxiliary basis hint must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030004225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 20** — [SQIsign-I count 1: a modified challenge basis hint must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030206225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 21** — [SQIsign-I count 1: the signature must not verify under count 7's public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `bb1ed0183d5192fd52fcf31315cc9263 2e443acd6a4377010310498419b9f401 2d924db8d9847862cbd0a6f920da91ac 258d2b11f09c08b699e16cfadbc1f604 02` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 22** — [SQIsign-I count 1: the signature must not verify under a modified public curve](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8ee148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 0b` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 23** — [SQIsign-I count 1: the signature must not verify under a modified public key hint](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8fe148717389e48c123c9aa09fb17c5c 6f0cef7e3471ef400296e3ec18e59901 e7bfbd3aaab48cb49e7198d5543ae786 727d904425f343a64bc03513b0947201 09` |
| `message` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 24** — [SQIsign-I count 1: a SQIsign-I signature must not verify under a SQIsign-III public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `eb728ce5e8a421f40bfe8880ecab2a24 0ee04f7a225e59b71c4f7fd7a454958e 3b0bd76b85f77ff8105b9af50c4c0d19 da1da62884f73f7f594dc20f645ebd98 ee6dfdb697e78725c1bd9db18b1cfe38 00390f5d36e0daeb99b294695c23202b 08` |
| `message` | _(empty)_ |
| `input` | `410e68d74d44a5ce60ec0c05232c9e08 a12afbc5c4584f3cf9dbf3e235774d01 d420a17eba5c5b2ba8b853f5bc66670d b2e3bbf8b11944e1d82b22896e76ca04 0102e9356a08d41768e8b250b54c33de 5a3f07f5a5f1667bbfb84e8b68e10b07 077fddc9268b4267e5ce42c8c04f1741 2e200f7b59038d18600d95c2a7c84e54 312fa59abf9342169f4a4d7faceab486 6b030204225d5ce2ceac61930a07503f b59f7c2f936a3e075481da3ca299a80f 8c5df9223a073e7b90e02ebf98ca2227 eba38c1ab2568209e46dba961869c6f8 3983b17dcd49` |
| `expected` | `00` |

**Vector 25** — [SQIsign-III count 8: a modified basis-change matrix must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `cf617023c07fe87c73f88a258f218cb1 c7a661fef55788eb28cbc2da0226ffca b1a6dceb73011455b9f6f2053227dd40 64836dd9b1dd0561d75cb143d683beab c113114b7714658fc0492806c38d56c3 65e5ed06b71d4b84a8f269467e0f2b25 0d` |
| `message` | `9366ed7b3b623c411448b634446f1a3f aabdd163a6cc1e2bcae4a98703cd8cee 441405892fba051be2a586a6950a5ef7 3a255e5f86b0d7212e0c51c3bc79be4b …` (297 bytes; the full value is in the source) |
| `input` | `e10e935cbbc3b7b548b565f207f95daa a655959a95f630360c17e6d56a61c291 01da728b6893c73d08791bf6afadc433 7bfbc64c52961cbc4ce4aee971bf66f6 …` (521 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 26** — [SQIsign-V count 13: a modified message must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/sqisign-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `37018d6d0c3c5e4d9471f7bfaa0ccfad ff5c2b308522e6135abb974443069af6 9e0f0500cc9e0cce1ea3065b5ce89687 1306fe288e0e54fc86fb73b4822c4001 9ba3daa475b1e71ba878a7580d069d26 b58814ab982354df25b350f2540360d6 21a5d1c693ef36154f62f8978da2cc92 3b6ad80e43e5fd5bfe3b18cfbcff9100 0b` |
| `message` | `c39529df1864297e33956afee00a6009 9b658a67830a6a6abddc329e87831d9f 9b647917fedf1ae182a4040214328551 6fcab83f447354c72fae81ac26e7005c …` (462 bytes; the full value is in the source) |
| `input` | `435430153ecd491b58c7afbea99b501b 05c0733e71bfaa7036a4af523d97761a 07f727aeecadb01d26cf084bc48851f9 cfabd3b60fd70f115d7b480500342f01 …` (754 bytes; the full value is in the source) |
| `expected` | `00` |

---

[← All algorithms](../README.md)
