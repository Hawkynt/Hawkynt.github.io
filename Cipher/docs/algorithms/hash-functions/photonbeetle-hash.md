# PhotonBeetle Hash

> Lightweight hash function based on the PHOTON permutation, finalist in NIST Lightweight Cryptography competition. Optimized for constrained environments with 256-bit output.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Zhenzhen Bao, Avik Chakraborti, Nilanjan Datta, Jian Guo, Mridul Nandi, Thomas Peyrin, Kan Yasuda |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/photon-beetle-hash.js`](../../../algorithms/hash/photon-beetle-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [PhotonBeetle Specification](https://www.isical.ac.in/~lightweight/beetle/)
- [NIST LWC Project](https://csrc.nist.gov/Projects/lightweight-cryptography)
- [PhotonBeetle Specification (NIST)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/photon-beetle-spec-final.pdf)

## References

- [PHOTON-Beetle/Software (official reference implementation)](https://github.com/PHOTON-Beetle/Software)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty message (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `44a99882fea033566856a27e7f0c94dc84fac7e411b08b890a4a574e3db75d4a` |

**Vector 2** — [Single byte 0x00 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `f165ccd18640b9703e96f1bd9a4a4ee32dd4031e4680a1b9890891dcc63468a7` |

**Vector 3** — [Two bytes 0x0001 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `2ef2d38f71e77928df37fba337872b639f7748556c1a081821b9b8460ac68fac` |

**Vector 4** — [Three bytes 0x000102 (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `f9a8c467209e7b5f32db28bde50d5210a81a9c6aa9c1686a05c3619cbf44061d` |

**Vector 5** — [16 bytes sequential (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ab0d1eb0315df8af7f7ae0ac42eaf2f52fb0fdf0904e182dcc796b6cb8d7981a` |

**Vector 6** — [17 bytes sequential (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `5a281ad7eb81fb083d05ccd21b78c4bca938af26f20869da29c8f13b7389bc5f` |

**Vector 7** — [24 bytes sequential (NIST LWC)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/photon-beetle/crypto_hash/photonbeetlehash256rate32v1/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `expected` | `c65d15e64477d0ca123e85d632e8444c343e00ec08934ef3a8b4e22c871badf8` |

---

[← All algorithms](../README.md)
