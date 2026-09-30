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

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

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

**Vector 9** — [NIST SHA-3 Round 2 KAT, ShortMsgKAT_256 Len = 1392 (174 bytes, extra padding block) - ECHO-256](https://web.archive.org/web/2017/http://csrc.nist.gov/groups/ST/hash/sha-3/Round2/documents/ECHO_Round2.zip)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `bebd4f1a84fc8b15e4452a54bd02d69e 304b7f32616aadd90537937106ae4e28 de9d8aab02d19bc3e2fde1d651559e29 6453e4dba94370a14dbbb2d1d4e20223 02ee90e208321efcd8528ad89e46dc83 9ea9df618ea8394a6bff308e7726bae0 c19bcd4be52da6258e2ef4e96aa21244 429f49ef5cb486d7ff35cac1bacb7e95 711944bccb2ab34700d42d1eb38b5d53 6b947348a458ede3dc6bd6ec547b1b0c ae5b257be36a7124e1060c170ffa` |
| `expected` | `45e8685857b7abffa9cf6c0379ffa563bb3b39a6b049f949adf10ecea718be77` |

**Vector 10** — [NIST SHA-3 Round 2 KAT, ShortMsgKAT_512 Len = 880 (110 bytes, extra padding block) - ECHO-512](https://web.archive.org/web/2017/http://csrc.nist.gov/groups/ST/hash/sha-3/Round2/documents/ECHO_Round2.zip)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `47c6e0c2b74948465921868804f0f7bd 50dd323583dc784f998a93cd1ca4c6ef 84d41dc81c2c40f34b5bee6a93867b3b dba0052c5f59e6f3657918c382e771d3 3109122cc8bb0e1e53c4e3d13b43ce44 970f5e0c079d2ad7d7a3549cd75760c2 1bb15b447589e86e8d76b1e9ced2` |
| `expected` | `9067514f1d82ddbae543c634013e613c 558d9ff5d26e4c47ea124088a2c5a32f a58b3592a5b71c48b6bf36e2b8ab6ec6 815f5b17dfc204fe3be1f91cda1257e6` |

---

[← All algorithms](../README.md)
