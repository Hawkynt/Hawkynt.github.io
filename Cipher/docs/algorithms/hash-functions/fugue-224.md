# Fugue-224

> Fugue-224 is an AES-inspired cryptographic hash function with 224-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses a wide-pipe columnar state (30 or 36 32-bit words) mixed via AES-derived S-box tables (SMIX), with message words injected through TIX/CMIX transforms. It did not advance to the SHA-3 final round.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash Function |
| Variant | 224 |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Shai Halevi, William E. Hall, Charanjit S. Jutla (IBM Research) |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/fugue.js`](../../../algorithms/hash/fugue.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 28 bytes (224 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [sphlib Reference Implementation (fugue.c)](https://github.com/pornin/sphlib/blob/master/c/fugue.c)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Fugue 2.0 Paper (IBM Research)](https://researcher.watson.ibm.com/researcher/files/us-shalevi/fugue.pdf)

## References

- [sphlib by Thomas Pornin (reference C implementation)](https://github.com/pornin/sphlib)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [sphlib NIST-style test vector (0-bit / empty message) - Fugue-224](https://github.com/pornin/sphlib/blob/master/c/test_fugue.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `e2cd30d51a913c4ed2388a141f90caa4914de43010849e7b8a7a9ccd` |

**Vector 2** — [sphlib NIST-style test vector (8-bit message 0xCC) - Fugue-224](https://github.com/pornin/sphlib/blob/master/c/test_fugue.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `34602ea95b2b9936b9a04ba14b5dc463988df90b1a46f90dd716b60f` |

---

[← All algorithms](../README.md)
