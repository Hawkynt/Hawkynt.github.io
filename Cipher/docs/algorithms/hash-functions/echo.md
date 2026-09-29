# ECHO

> ECHO is an AES-based cryptographic hash function submitted to the NIST SHA-3 competition (Round 2). It processes a 512-bit (small variants) or 1024-bit (large variants) state through 8 or 10 double-AES-round permutations, with a counter mixed into the AES round keys. It did not advance to the SHA-3 final round.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Ryad Benadjila, Olivier Billet, Henri Gilbert, Gilles Macario-Rat, Thomas Peyrin, Matt Robshaw, Yannick Seurin |
| Year | 2008 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/hash/echo.js`](../../../algorithms/hash/echo.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 28 bytes (224 bits); 32 bytes (256 bits); 48 bytes (384 bits); 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ECHO Specification v2.0 (SHA-3 Round 2 submission)](https://crypto.orange-labs.fr/ECHO/)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [sphlib Reference Implementation (echo.c)](https://github.com/pornin/sphlib/blob/master/c/echo.c)

## References

- [sphlib by Thomas Pornin (reference C implementation)](https://github.com/pornin/sphlib)
- [ECHO: A Low-Latency AEAD Mode](https://eprint.iacr.org/2010/003)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [sphlib NIST-style test vector (0-bit / empty message) - ECHO-224](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `28` |
| `input` | _(empty)_ |
| `expected` | `17da087595166f733fff7cdb0bca6438f303d0e00c48b5e7a3075905` |

**Vector 2** — [sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-224](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `28` |
| `input` | `cc` |
| `expected` | `34d81c434b63c8fbcf023b6417af87d906942ebd7b56c1d7b08baddc` |

**Vector 3** — [sphlib NIST-style test vector (0-bit / empty message) - ECHO-256](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `4496cd09d425999aefa75189ee7fd3c97362aa9e4ca898328002d20a4b519788` |

**Vector 4** — [sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-256](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `cc` |
| `expected` | `01c382b5b9d7d10ec36c98785c27eaccfb2f772a7e58b6b97bf62212b8584ae5` |

**Vector 5** — [sphlib NIST-style test vector (0-bit / empty message) - ECHO-384](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `48` |
| `input` | _(empty)_ |
| `expected` | `134040763f840559b84b7a1ae5d6d64f c3659821a789cc64a7f1444c09ee7f81 a54d72beee8273bae5ef18ec43aa5f34` |

**Vector 6** — [sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-384](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `48` |
| `input` | `cc` |
| `expected` | `90875a2649cab90018ff8aecd334482c 92b15d76b378574eeaacd3b7598020db 11e2c7480614eea8793de3daf2093f73` |

**Vector 7** — [sphlib NIST-style test vector (0-bit / empty message) - ECHO-512](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | _(empty)_ |
| `expected` | `158f58cc79d300a9aa292515049275d0 51a28ab931726d0ec44bdd9faef4a702 c36db9e7922fff077402236465833c5c c76af4efc352b4b44c7fa15aa0ef234e` |

**Vector 8** — [sphlib NIST-style test vector (8-bit message 0xCC) - ECHO-512](https://github.com/pornin/sphlib/blob/master/c/test_echo.c)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `cc` |
| `expected` | `dfce37ca6f32ba4c3a72e77bca20e511 a39b31a6075815f083db2ecfd5c32cfd 6a4e0dd9bd51921199758edd2fe8ed0f a31e06aa821c7030653d15408e8728dd` |

---

[← All algorithms](../README.md)
