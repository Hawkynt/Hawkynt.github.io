# KNOT-HASH-512-512

> Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-512 permutation (8-bit round constants, 140 rounds) with 512-bit state and 512-bit output.

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
| Output sizes | 64 bytes (512 bits) |

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

**Vector 1** — [KNOT-HASH-512-512: Empty message (NIST KAT Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `729f0dc105a78582b78cd25d3b41cdee f87d99c6c974d5d1df4e96410add3b23 ccff5a3c69eb2061fd1bacfc8aaac4e4 25ed2cc1407f2bee0fb66fef17fcec91` |

**Vector 2** — [KNOT-HASH-512-512: Single zero byte (NIST KAT Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `c52cd4b2c4ba2d8434e92b9b282f01be 053b8de3cff0657716de40442995da4a f61347c7c431af2d1b35799e7c19f811 3bb5a69102cd0903d43d1c87c4b159bd` |

**Vector 3** — [KNOT-HASH-512-512: Two bytes (NIST KAT Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `cee96a707a416cb1d9aa4f42e9e72686 41b53e613b77f337b56af3cb7426f411 714a9abd52fe83df5509676d2713b250 eeaa998cbe26d374a94002c93c54a618` |

**Vector 4** — [KNOT-HASH-512-512: Three bytes (NIST KAT Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `cd2b323e45f1ed5c96e5a3fa90557580 077b297b76eeb2ee9b6a95505db4798e 90c579f69c623b0213cd0aa386387736 18887eb11a8b0fe70594dde14da99af2` |

**Vector 5** — [KNOT-HASH-512-512: Four bytes (NIST KAT Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `9f6ef40003f292dcafcc6fea2e4f0c37 5a527c30190632d2f1fda172623a11f2 5ba2c524580a80ceec9d4c9297d2929f f19ed9767095a9dc4af5d36b4b99b995` |

**Vector 6** — [KNOT-HASH-512-512: Five bytes (NIST KAT Count=6)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304` |
| `expected` | `f0508b66ff661ab94a82c154db81bb83 be42c238c15b4de266701d02a5cedbaf ea5c87be26efc9e132fa05fc93e6fa62 1b18fe457876440b61a81604a2161531` |

**Vector 7** — [KNOT-HASH-512-512: Eight bytes (NIST KAT Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `39eac539c10ec0384e7fb96b0df99b5a 7669c55e5151580c6ae6769f9f031528 036e3e65664f67b8312975e19aaa9b1b e4a20e51f2dd82981cf6340ea108a4c8` |

**Vector 8** — [KNOT-HASH-512-512: Nine bytes (NIST KAT Count=10)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708` |
| `expected` | `e44b1fc05e514245944d1e1df6a2b6d9 b8c9c2d304c1b346fff24cb0a77e3eea 13a72ee29ab99991c515ba0c4c02fd40 47866d42b033b6996caa88b8ff85a4c2` |

**Vector 9** — [KNOT-HASH-512-512: 16 bytes (NIST KAT Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `c544924be5549a4694540271c191bf12 8b6b636d930a8c9aef26ea0d0d8f12f8 01a2cb4bd39042a1b71483954445dfa8 d1bc83d94f151a3e9254d599b1a0649d` |

**Vector 10** — [KNOT-HASH-512-512: 24 bytes (NIST KAT Count=25)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-512-512.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `expected` | `7a1cbc00f4f13ed3c21bd406992bbe0c 71539a88cfd3d870602800842ad3c456 c1564ba47252b14ef77f088650e83f25 78d6c4b9bc84e6be9951265e44a94f3a` |

---

[← All algorithms](../README.md)
