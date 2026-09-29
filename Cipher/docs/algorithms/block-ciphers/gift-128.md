# GIFT-128

> Lightweight block cipher designed for efficient hardware and software implementation. Uses 128-bit blocks with 128-bit keys and 40 rounds. Selected for NIST Lightweight Cryptography standardization in GIFT-COFB.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Subhadeep Banik, Sumit Kumar Pandey, Thomas Peyrin, et al. |
| Year | 2017 |
| Origin | Not specified |
| Source | [`algorithms/block/gift128.js`](../../../algorithms/block/gift128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [GIFT Specification (ePrint 2017/622)](https://eprint.iacr.org/2017/622.pdf)
- [GIFT-COFB NIST LWC Finalist](https://csrc.nist.gov/Projects/lightweight-cryptography/finalists)
- [Official GIFT Website](https://giftcipher.github.io/gift/)

## References

- [Original GIFT Paper (CHES 2017)](https://eprint.iacr.org/2017/622.pdf)
- [GIFT-COFB Specification](https://eprint.iacr.org/2020/412.pdf)
- [NIST LWC GIFT-COFB](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/gift-cofb-spec-final.pdf)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GIFT-128b Test Vector #1 - GIFT-COFB round-2 specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/gift-cofb-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `a94af7f9ba181df9b2b00eb7dbfa93df` |

**Vector 2** — [GIFT-128b Test Vector #2 - GIFT-COFB round-2 specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/round-2/spec-doc-rnd2/gift-cofb-spec-round2.pdf)

| Field | Value |
| --- | --- |
| `key` | `e0841f8fb90783136aa8b7f192f5c474` |
| `input` | `e491c665522031cf033bf71b9989ecb3` |
| `expected` | `3331efc3a6604f9599ed42b7dbc02a38` |

**Vector 3** — [GIFT-128b Test Vector #3 (all zeros) - fixslicing reference code](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-gift128.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `5e8e3a2e1697a77dcc0b89dcd97a64ee` |

**Vector 4** — [GIFT-128b Test Vector #4 - fixslicing reference code](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-gift128.c)

| Field | Value |
| --- | --- |
| `key` | `fedcba9876543210fedcba9876543210` |
| `input` | `fedcba9876543210fedcba9876543210` |
| `expected` | `22581437e5e961ef6d125046c5f20788` |

**Vector 5** — [GIFT-128b Test Vector #5 - fixslicing reference code](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-gift128.c)

| Field | Value |
| --- | --- |
| `key` | `d0f5c59a7700d3e799028fa9f90ad837` |
| `input` | `e39c141fa57dba43f08a85b6a91f86c1` |
| `expected` | `da1dc8873823e325c4b4a77c1a73330e` |

---

[← All algorithms](../README.md)
