# SOBER-128

> Word-based stream cipher with 17-stage LFSR and non-linear filter, designed by Greg Rose of QUALCOMM. Features key-dependent KONST generation and stuttering mechanism.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Greg Rose (QUALCOMM) |
| Year | 1998 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/sober128.js`](../../../algorithms/stream/sober128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 4 bytes (32 bits) to 256 bytes (2048 bits) in steps of 4 bytes |
| Nonce sizes | 4 bytes (32 bits) to 256 bytes (2048 bits) in steps of 4 bytes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [SOBER-128 Specification](https://www.ecrypt.eu.org/stream/sobere.html)
- [eSTREAM Portfolio](https://www.ecrypt.eu.org/stream/)

## References

- [LibTomCrypt Reference Implementation (based on Qualcomm's s128fast.c)](https://github.com/libtom/libtomcrypt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LibTomCrypt Test Vector - 128-bit key, 4-byte IV](https://github.com/libtom/libtomcrypt/blob/develop/src/stream/sober128/sober128_test.c)

| Field | Value |
| --- | --- |
| `key` | `74657374206b65792031323862697473` |
| `iv` | `00000000` |
| `input` | `0000000000000000000000000000000000000000` |
| `expected` | `43500ccf89919f1daa377495f4b458c240378bbb` |

**Vector 2** — [DarkCrypt keystream, incremental key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `f0348280f75f4051b97a4ba5c6535204 a344e639110df57ff515c3af11776f87 e9fc8e9a661ef4e9272c0e71d891b997 ba63ba2392a1da420a336f54733e0197 c280386ee9b035c9d78ca0c1884025e9 649047b791d74de0557abefabd7eaf1c 722acf3bc83600023531bee7aa750779 f4405a3b9ab14ed2e732d71a476a729f` |

**Vector 3** — [DarkCrypt incremental plaintext, incremental key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `f0358083f35a4656b17341aeca5e5c0b b355f42a0518e368ed0cd9b40d6a7198 c9ddacb9423bd2ce0f05245af4bc97b8 8a528810a694ec75320a556f4f033fa8` |

---

[← All algorithms](../README.md)
