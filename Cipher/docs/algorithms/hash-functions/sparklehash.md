# SparkleHash

> NIST Lightweight Cryptography finalist based on the Sparkle permutation. Provides 256-bit hash output (Esch256 variant) with efficient performance on constrained devices.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/hash/sparkle-hash.js`](../../../algorithms/hash/sparkle-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Sparkle Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf)
- [Sparkle Project Website](https://sparkle-lwc.github.io/)

## References

- [Official Sparkle/Esch reference implementation (cryptolu/sparkle)](https://github.com/cryptolu/sparkle)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Esch256: Empty message (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `c0e815d78b875dc768c6c8b3afa51987cd69e5c087d387368628a511cfad5730` |

**Vector 2** — [Esch256: Single byte 0x00 (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `d515fd9c2852d9d6f00c9cf01d858af467eedf21ff68cc14c005b3eff7a6ecd3` |

**Vector 3** — [Esch256: Two bytes 0x0001 (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `fbcad7ab77fd4cc844534d2716d08c092b40b86e00647ecaa429afdfe3b3fc43` |

**Vector 4** — [Esch256: Three bytes 0x000102 (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `f33561ba7dcf690e4e1c519b28712a878028417a3974873f188ae33b289fcab6` |

**Vector 5** — [Esch256: Four bytes 0x00010203 (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `649d3e5258e504ef842a7176108d36a823e751d5e0ee31e3faf111415bb9bbc2` |

**Vector 6** — [Esch256: 16 bytes (full rate) (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `acff841e2a526d83d6e94ab5564d6d64c98f5e8016bb1c2950386ed156c6c174` |

**Vector 7** — [Esch256: 32 bytes (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch256v2/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `78b905b2e2d4110b76ef8afd2495f58ad6ffd6b9727377f3e5dfceebf3031e24` |

---

[← All algorithms](../README.md)
