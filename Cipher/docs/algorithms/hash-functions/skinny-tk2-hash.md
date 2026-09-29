# SKINNY-tk2-HASH

> Lightweight hash function based on SKINNY-128-256 tweakable block cipher. Uses 32-byte internal state with 4-byte absorption rate for efficient lightweight implementations.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim |
| Year | 2016 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/skinny-hash.js`](../../../algorithms/hash/skinny-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [SKINNY-AEAD and SKINNY-Hash Specification (NIST LWC Round 2)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/SKINNY-spec-round2.pdf)
- [The SKINNY Family of Block Ciphers and its Low-Latency Variant MANTIS (Beierle et al., CRYPTO 2016)](https://eprint.iacr.org/2016/660.pdf)
- [SKINNY Family Homepage](https://sites.google.com/site/skinnycipher/home)

## References

- [Reference Implementation (Southern Storm lightweight-crypto)](https://github.com/rweather/lightweight-crypto)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SKINNY-tk2-HASH: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `5dc460677eba0df3b48c60e949097a6c5d58e1c9ecf97c6fe89212b4b91f246f` |

**Vector 2** — [SKINNY-tk2-HASH: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `49bc2538dec23cd247989de36f83bb730d307c758405ef15f7e97fcb7f7674d9` |

**Vector 3** — [SKINNY-tk2-HASH: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `a5cdcf914b9b8368cb4bc005b36f475e514ed3441799d0e8c022fd50bed8e206` |

**Vector 4** — [SKINNY-tk2-HASH: Three bytes (Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `28fb54a33d65032430af9b45c3417d52d600d22904c8c4ab3675ef29dff999b7` |

**Vector 5** — [SKINNY-tk2-HASH: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `5557caa3489858bbf119d7fcf55cdaa1e9817fd647cf68094432a2487d20d377` |

**Vector 6** — [SKINNY-tk2-HASH: Sixteen bytes (Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk2-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `8e110634307103b6aa92851b083058814f2a64da807b0824eb8d2865cc6a1447` |

---

[← All algorithms](../README.md)
