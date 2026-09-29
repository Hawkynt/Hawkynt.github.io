# Fugue-512

> Fugue-512 is an AES-inspired cryptographic hash function with 512-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses a wide-pipe columnar state (30 or 36 32-bit words) mixed via AES-derived S-box tables (SMIX), with message words injected through TIX/CMIX transforms. It did not advance to the SHA-3 final round.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash Function |
| Variant | 512 |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Shai Halevi, William E. Hall, Charanjit S. Jutla (IBM Research) |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/fugue.js`](../../../algorithms/hash/fugue.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

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

**Vector 1** — [sphlib NIST-style test vector (0-bit / empty message) - Fugue-512](https://github.com/pornin/sphlib/blob/master/c/test_fugue.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `3124f0cbb5a1c2fb3ce747ada63ed2ab 3bcd74795cef2b0e805d5319fcc360b4 617b6a7eb631d66f6d106ed0724b56fa 8c1110f9b8df1c6898e7ca3c2dfccf79` |

**Vector 2** — [sphlib NIST-style test vector (8-bit message 0xCC) - Fugue-512](https://github.com/pornin/sphlib/blob/master/c/test_fugue.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `2ef4115479b060fc64a4d6f6913a39e3 26afc81deb4e39d71c573df5ed132200 e7c784bab1804930cad16847f16cbda5 9a865bbd928ebc17d33689fef233c10b` |

---

[← All algorithms](../README.md)
