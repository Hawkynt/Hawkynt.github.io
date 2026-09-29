# SKINNY-tk3-HASH

> Lightweight hash function based on SKINNY-128-384 tweakable block cipher. Uses 48-byte internal state with 16-byte absorption rate for higher throughput in lightweight implementations.

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

**Vector 1** — [SKINNY-tk3-HASH: Empty message (Count=1)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `15c81e6eb26ed692b51cf10a3fe186718c7aa6745cceb7c82ff63f915f91e27b` |

**Vector 2** — [SKINNY-tk3-HASH: Single byte 0x00 (Count=2)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `1efd40a650a042dbefef8fd5552f70f52f5224036bfc5483cf1828a62b4c5d59` |

**Vector 3** — [SKINNY-tk3-HASH: Two bytes (Count=3)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `760bf1c2f83615ff57df00ba05128b124a4dea2cc096601130c534dc7571eacb` |

**Vector 4** — [SKINNY-tk3-HASH: Three bytes (Count=4)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102` |
| `expected` | `3f5ff72381989feed4f8f732dc5414fd9e8712cdd3c4d363a1c9e8a568e33ede` |

**Vector 5** — [SKINNY-tk3-HASH: Four bytes (Count=5)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `92ad1cb242b43f9a00f65feb037aca2dc98958ca0083d132c944c1fa85c36d8f` |

**Vector 6** — [SKINNY-tk3-HASH: Sixteen bytes (Count=17)](https://github.com/rweather/lightweight-crypto/blob/master/test/kat/SKINNY-tk3-HASH.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `a09d8d868adf68957378c500ada9678a362897068d9ab00e9483196c318fd4ff` |

---

[← All algorithms](../README.md)
