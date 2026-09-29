# SAFER+

> SAFER+ (SAFER Plus) block cipher with enhanced security. Features 128-bit blocks, PHT transform for diffusion, and Armenian shuffle permutation. Supports 128/192/256-bit keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | SP Network |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | James Massey, Gurgen Khachatrian |
| Year | 1998 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/saferp.js`](../../../algorithms/block/saferp.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |
| Rounds | 8 rounds to 16 rounds in steps of 4 |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [SAFER Specification](https://en.wikipedia.org/wiki/SAFER)
- [NESSIE Portfolio](https://www.cosic.esat.kuleuven.be/nessie/)

## References

- [NIST AES round 1 SAFER+ known-answer tests (Cylink)](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round 1 SAFER+ ecb_int.txt - 128-bit key](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `78ae8da840f61247136ec75a68a71cae` |
| `input` | `45d77c9a652c7eaaaf3b87bcfd794825` |
| `expected` | `388e5d6b3c64c75299b494cb9f933299` |

**Vector 2** — [NIST AES round 1 SAFER+ ecb_int.txt - 192-bit key](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `89786756453423bc78ae8da840f61247136ec75a68a71cae` |
| `input` | `45d77c9a652c7eaaaf3b87bcfd794825` |
| `expected` | `5344adcc26adaf7c1e90aa9d90eae140` |

**Vector 3** — [NIST AES round 1 SAFER+ ecb_int.txt - 256-bit key](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `2312efdecdbcab9089786756453423bc78ae8da840f61247136ec75a68a71cae` |
| `input` | `45d77c9a652c7eaaaf3b87bcfd794825` |
| `expected` | `9375a16f58a4c0a702f65b37e03aa46e` |

**Vector 4** — [NIST AES round 1 SAFER+ ecb_vk.txt I=1 - 128-bit key](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `aa9d022ed60e43a3f359265217775b5b` |

**Vector 5** — [NIST AES round 1 SAFER+ ecb_vk.txt I=1 - 192-bit key](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `800000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c5e13fff9751c82f5bbea00cb7e2929a` |

**Vector 6** — [NIST AES round 1 SAFER+ ecb_vt.txt I=1 - 256-bit key](https://web.archive.org/web/20070109105229if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/saferpls-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `80000000000000000000000000000000` |
| `expected` | `c183c03087415dfcda4d425a06ee8523` |

---

[← All algorithms](../README.md)
