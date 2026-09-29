# KNOT-HASH-256-256

> Lightweight hash function based on bit-sliced PRESENT-like permutations, finalist in NIST Lightweight Cryptography competition. Uses KNOT-256 permutation in sponge construction with 256-bit output.

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
| Output sizes | 32 bytes (256 bits) |

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

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KNOT-HASH-256-256: Empty message (NIST KAT Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-256.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `cf1ac5b7aa08d36d544e2d2049d0d0a5f1f6ff7b553d18035e69323d8e4118b1` |

**Vector 2** — [KNOT-HASH-256-256: Single zero byte (NIST KAT Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-256.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `1b8f1c5978adce6c4bac3715e304a0f3026f873820ca4a6386cbfd0a3709949c` |

**Vector 3** — [KNOT-HASH-256-256: Two bytes (NIST KAT Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `3cff1e8cd8cac2feeb696969251f828aa2288d8ccbbecbaf422634577fced63b` |

**Vector 4** — [KNOT-HASH-256-256: Four bytes (NIST KAT Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-256.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `8410c4bbd8828e9d9a2183f23918b5f45182735560a2e1d142884d10b66327a8` |

**Vector 5** — [KNOT-HASH-256-256: Eight bytes (NIST KAT Count=9)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-256.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `6b8ccc0a32775c876b63e8e146e103172188287cdf7ed236cd5d6276c16c6b76` |

**Vector 6** — [KNOT-HASH-256-256: 16 bytes (NIST KAT Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/KNOT-HASH-256-256.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `3d1bb21c5b2fdb385db2231896467cc987e9eb5ccc622f88e9fa45afef66b6ab` |

---

[← All algorithms](../README.md)
