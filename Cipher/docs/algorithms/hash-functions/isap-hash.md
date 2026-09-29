# ISAP Hash

> Ascon-based hash function used in the ISAP authenticated encryption scheme. Uses Ascon-p permutation in sponge mode to produce 256-bit hashes with resistance to side-channel attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Stefan Mangard, Florian Mendel, Robert Primas |
| Year | 2017 |
| Origin | Not specified |
| Source | [`algorithms/hash/isap-hash.js`](../../../algorithms/hash/isap-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISAP Specification](https://isap.isec.tugraz.at/)
- [NIST LWC Finalist](https://csrc.nist.gov/projects/lightweight-cryptography)
- [ISAP v2.0 Paper](https://tosc.iacr.org/index.php/ToSC/article/view/8625)
- [BouncyCastle Reference](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/ISAPDigest.java)

## References

- [ISAP Code Package (official reference implementation)](https://github.com/isap-lwc/isap-code-package)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ISAP Hash: Empty message (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/isap/crypto_aead_hash/isapa128ahv20/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `7346bc14f036e87ae03d0997913088f5f68411434b3cf8b54fa796a80d251f91` |

**Vector 2** — [ISAP Hash: Single zero byte (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/isap/crypto_aead_hash/isapa128ahv20/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `8dd446ada58a7740ecf56eb638ef775f7d5c0fd5f0c2bbbdfdec29609d3c43a2` |

**Vector 3** — [ISAP Hash: Two bytes (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/isap/crypto_aead_hash/isapa128ahv20/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `f77ca13bf89146d3254f1cfb7eddba8fa1bf162284bb29e7f645545cf9e08424` |

**Vector 4** — [ISAP Hash: Four bytes (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/isap/crypto_aead_hash/isapa128ahv20/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `8013eaaa1951580a7bef7d29bac323377e64f279ea73e6881b8aed69855ef764` |

**Vector 5** — [ISAP Hash: Eight bytes (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/isap/crypto_aead_hash/isapa128ahv20/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `f4c6a44b29915d3d57cf928a18ec6226bb8dd6c1136acd24965f7e7780cd69cf` |

**Vector 6** — [ISAP Hash: Sixteen bytes (NIST LWC KAT)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/isap/crypto_aead_hash/isapa128ahv20/LWC_HASH_KAT_256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `d4e56c4841e2a0069d4f07e61b2dca94fd6d3f9c0df78393e6e8292921bc841d` |

---

[← All algorithms](../README.md)
