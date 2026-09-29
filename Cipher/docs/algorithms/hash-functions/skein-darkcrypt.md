# Skein (DarkCrypt)

> Skein-512-512 variant used by the DarkCrypt Total Commander plugin. Uses the deprecated pre-tweak (October 2008, NIST round 1) Threefish-512 rotation constants from Skein spec v1.3 Appendix D Table 29 combined with a non-standard key-schedule parity constant (0x5555555555555555 instead of the standard C_240); matches no published Skein test vector.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | DarkCrypt Variant |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker (Skein); DarkCrypt plugin author (variant constant substitution) |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/darkcrypt-skein.js`](../../../algorithms/hash/darkcrypt-skein.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Skein 1.3 Specification](https://www.schneier.com/academic/skein/skein1.3.pdf)
- [Threefish Cipher](https://www.schneier.com/academic/threefish/)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt Total Commander plugin](https://github.com/Zdimon/DarkCryptTC)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Skein empty string](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `d3f7263a09837f4ce5c8ef70a5ddffac 7b92d6c2ace5a12265bd5b593260a3ff 20d8b4b4c5494e945448b37abb1fc526 f6b46089208fde938d7f23724c4bdfb7` |

**Vector 2** — [DarkCrypt Skein "abc"](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `c52438c670f3d580dc4cb8d085141a19 643668f82a6ad5f4ecb9292f04b8f38f 1b9dcc8dc4108f72e6ec81fc6cbcd6ed f1867fc4f0beafa692957a4adc1183e3` |

**Vector 3** — [DarkCrypt Skein incremental 64-byte message](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `df2624902ccc7e042541952126f94750 802b3a1e61fa6e22f8bc981066874095 883455ddd2b0c96a28f1074b4f151829 ffc65415503f504e76f362c312120644` |

---

[← All algorithms](../README.md)
