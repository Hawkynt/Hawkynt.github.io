# FSE

> Finite State Entropy encoding using tANS (tabled Asymmetric Numeral Systems). Achieves near-optimal compression like arithmetic coding but much faster. Core technology used in Zstandard.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Yann Collet |
| Year | 2013 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/compression/fse.js`](../../../algorithms/compression/fse.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [FSE GitHub Repository](https://github.com/Cyan4973/FiniteStateEntropy)
- [Finite State Entropy Paper](https://arxiv.org/abs/1311.2540)
- [Zstandard Compression (uses FSE)](https://github.com/facebook/zstd)

## References

- [tANS Theory](https://arxiv.org/abs/0902.0271)
- [FSE in Zstd Documentation](https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md)
- [Asymmetric Numeral Systems](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/Cyan4973/FiniteStateEntropy)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single byte

Source: Round-trip test

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — Repeated bytes - high compressibility

Source: Round-trip test

| Field | Value |
| --- | --- |
| `input` | `4141414141414141` |
| `expected` | _(empty)_ |

**Vector 4** — Two different bytes

Source: Round-trip test

| Field | Value |
| --- | --- |
| `input` | `414241424142` |
| `expected` | _(empty)_ |

**Vector 5** — Multiple symbols with varying frequencies

Source: Round-trip test

| Field | Value |
| --- | --- |
| `input` | `414141414242434445` |
| `expected` | _(empty)_ |

**Vector 6** — All different bytes - low compressibility

Source: Round-trip test

| Field | Value |
| --- | --- |
| `input` | `4142434445464748` |
| `expected` | _(empty)_ |

**Vector 7** — Realistic text pattern

Source: Round-trip test

| Field | Value |
| --- | --- |
| `input` | `48454c4c4f20574f524c44212054484953204953204120544553542e` |
| `expected` | _(empty)_ |

**Vector 8** — All byte values 0-255 round-trip test

Source: Regression test for tANS table desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 9** — Pseudo-random data round-trip test

Source: Regression test for tANS table desync

| Field | Value |
| --- | --- |
| `input` | `f3ccbfab9d8fe554efb09bd0b0f5ba94 8035b768414265947a6b83c1414fe53a 321915d231a7468a060cbf21437ca17a 41025ccf252088f87f924ecff37e92df …` (300 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 10** — Alternating pattern round-trip test

Source: Regression test for tANS table desync

| Field | Value |
| --- | --- |
| `input` | `aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
