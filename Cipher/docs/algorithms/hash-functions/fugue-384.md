# Fugue-384

> Fugue-384 is an AES-inspired cryptographic hash function with 384-bit output, submitted to the NIST SHA-3 competition (2008-2012). It uses a wide-pipe columnar state (30 or 36 32-bit words) mixed via AES-derived S-box tables (SMIX), with message words injected through TIX/CMIX transforms. It did not advance to the SHA-3 final round.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash Function |
| Variant | 384 |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Shai Halevi, William E. Hall, Charanjit S. Jutla (IBM Research) |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/fugue.js`](../../../algorithms/hash/fugue.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 48 bytes (384 bits) |

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

**Vector 1** — [sphlib NIST-style test vector (0-bit / empty message) - Fugue-384](https://github.com/pornin/sphlib/blob/master/c/test_fugue.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `466d05f6812b58b8628e53816b2a99d1 73b804a964de971829159c3791ac8b52 4eebbf5fc73ba40ea8eea446d5424a30` |

**Vector 2** — [sphlib NIST-style test vector (8-bit message 0xCC) - Fugue-384](https://github.com/pornin/sphlib/blob/master/c/test_fugue.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `436868cd6804b803dac432ed561bb40f 91f624a10f2a368702359841cfda6909 115628ca4977b3f8063a3b87fc7a0984` |

---

[← All algorithms](../README.md)
