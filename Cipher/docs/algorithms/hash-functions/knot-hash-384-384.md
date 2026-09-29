# KNOT-HASH-384-384

> Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-384 permutation in sponge construction with 384-bit output.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Zheng Gong, Guohong Liao, Ling Song, Keting Jia, Lei Hu |
| Year | 2019 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/hash/knot-hash.js`](../../../algorithms/hash/knot-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 48 bytes (384 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [KNOT Specification (NIST LWC)](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/knot-spec-final.pdf)
- [NIST Lightweight Cryptography](https://csrc.nist.gov/projects/lightweight-cryptography)
- [KNOT Official Website](https://www.knotcipher.com/)

## References

- [rweather/lightweight-crypto (KNOT reference implementation)](https://github.com/rweather/lightweight-crypto)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KNOT-HASH-384-384: Empty message (NIST KAT Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `4f3d463251831d3689692aa1b4e02dda d79abfcbe075a2cd2805e95c099db75b f11c3c5ec917b6c5b3b76f8bb8d6db2c` |

**Vector 2** — [KNOT-HASH-384-384: Single zero byte (NIST KAT Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `2fece6f7fb33ca6f455e3a09c31b58ba 9a4edf0b04f4eab7f1001a3ea23c6ad7 27fc1a15928e090eaabd0596c69b07aa` |

**Vector 3** — [KNOT-HASH-384-384: Two bytes (NIST KAT Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `07ef998b299615edb5afab4d78a15a1c 2076089be8faeeb427ff85be69b71a99 d591124f7965e5b72b0bc13e1a2a0a7c` |

**Vector 4** — [KNOT-HASH-384-384: Three bytes (NIST KAT Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `750664415d55a3ba35e4a63cba99d79f f1ee85c4b6cdd5d6a40952b27dea031e 83df8d4499035a32f94533044b6c8b2c` |

**Vector 5** — [KNOT-HASH-384-384: Four bytes (NIST KAT Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `878d0f1348618cca9dba50520ffd5e1d 540ff485940cfa3cf4a9bbe25ac2055a dac5b110f208126526c9d16abe4d27f4` |

**Vector 6** — [KNOT-HASH-384-384: Eight bytes (NIST KAT Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `b1e3a6b7e420fb6678b27c79270bafe8 6fe6f91d8625ed60d586cbe4903cca1e 2e9585b721731b8ee97b1883325854d7` |

**Vector 7** — [KNOT-HASH-384-384: 16 bytes (NIST KAT Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `8019206bac3d6a99998bb49063204805 541c4b406c2ce651aef67b6833a0b43d fcfe110f4ee9604d8a68295db90067cd` |

**Vector 8** — [KNOT-HASH-384-384: 32 bytes (NIST KAT Count=33)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `d0dc496ab1d681a63cbcc2156c361ba7 0f7924da17d8f606f1ad8214114f09d4 4d35ba33547d512b198a77aec5b09ade` |

**Vector 9** — [KNOT-HASH-384-384: 48 bytes (NIST KAT Count=49)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `expected` | `268397bff02cc2ee39b32644875b3b22 7b54b194e86f69dd1c2277299daeb826 55742de0bbf1121a116d61e563fa10ff` |

**Vector 10** — [KNOT-HASH-384-384: 64 bytes (NIST KAT Count=65)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-384-384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `3aec65fca168df0a8bc4fe1852861097 978ccc770ce135c5110681e7aec8e662 ac5ad3d764bc03cdec2d09aff2197587` |

---

[← All algorithms](../README.md)
