# BLAKE3-MAC

> BLAKE3 in keyed hash mode for message authentication. Uses 256-bit key to produce variable-length MAC output. Combines speed of BLAKE3 with keyed authentication.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Keyed Hash MAC |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn |
| Year | 2020 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/blake3mac.js`](../../../algorithms/mac/blake3mac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Output sizes | 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [BLAKE3 Specification](https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf)
- [BLAKE3 Official Website](https://blake3.io/)
- [BouncyCastle BLAKE3Mac Reference](https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/Blake3Mac.java)

## References

- [BLAKE3 Reference Implementation](https://github.com/BLAKE3-team/BLAKE3)
- [BLAKE3 Test Vectors](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BLAKE3 Official Keyed Test Vector - 0 bytes](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | _(empty)_ |
| `expected` | `92b2b75604ed3c761f9d6f62392c8a9227ad0ea3f09573e783f1498a4ed60d26` |

**Vector 2** — [BLAKE3 Official Keyed Test Vector - 1 byte](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `00` |
| `expected` | `6d7878dfff2f485635d39013278ae14f1454b8c0a3a2d34bc1ab38228a80c95b` |

**Vector 3** — [BLAKE3 Official Keyed Test Vector - 3 bytes](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `000102` |
| `expected` | `39e67b76b5a007d4921969779fe666da67b5213b096084ab674742f0d5ec62b9` |

**Vector 4** — [BLAKE3 Official Keyed Test Vector - 7 bytes](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `00010203040506` |
| `expected` | `af0a7ec382aedc0cfd626e49e7628bc7a353a4cb108855541a5651bf64fbb28a` |

**Vector 5** — [BLAKE3 Official Keyed Test Vector - 64 bytes, exactly one block](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ba8ced36f327700d213f120b1a207a3b8c04330528586f414d09f2f7d9ccb7e6` |

**Vector 6** — [BLAKE3 Official Keyed Test Vector - 1024 bytes, exactly one chunk](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1024 bytes; the full value is in the source) |
| `expected` | `75c46f6f3d9eb4f55ecaaee480db732e6c2105546f1e675003687c31719c7ba4` |

**Vector 7** — [BLAKE3 Official Keyed Test Vector - 1025 bytes, first two-chunk tree](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1025 bytes; the full value is in the source) |
| `expected` | `357dc55de0c7e382c900fd6e320acc04146be01db6a8ce7210b7189bd664ea69` |

**Vector 8** — [BLAKE3 Official Keyed Test Vector - 2049 bytes, unbalanced three-chunk tree](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (2049 bytes; the full value is in the source) |
| `expected` | `9f29700902f7c86e514ddc4df1e3049f258b2472b6dd5267f61bf13983b78dd5` |

**Vector 9** — [BLAKE3 Official Keyed Test Vector - 1025 bytes, 131 byte extended output](https://github.com/BLAKE3-team/BLAKE3/blob/master/test_vectors/test_vectors.json)

| Field | Value |
| --- | --- |
| `key` | `77686174732074686520456c7669736820776f726420666f7220667269656e64` |
| `outputSize` | `131` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1025 bytes; the full value is in the source) |
| `expected` | `357dc55de0c7e382c900fd6e320acc04 146be01db6a8ce7210b7189bd664ea69 362396b77fdc0d2634a5529708437220 66c3c15902ae5097e00ff53f1e116f1c d5352720113a837ab2452cafbde4d540 85d9cf5d21ca613071551b25d52e69d6 c81123872b6f19cd3bc1333edf0c52b9 4de23ba772cf82636cff4542540a7738 d5b930` |

---

[← All algorithms](../README.md)
