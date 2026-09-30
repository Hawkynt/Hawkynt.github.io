# Skein (DarkCrypt)

> Skein-512-512 as used by the DarkCrypt Total Commander plugin: Skein version 1.1, the SHA-3 round 1 definition, with the original Threefish-512 rotation constants (replaced in version 1.2) and key schedule parity constant 0x5555555555555555 (replaced by C240 in version 1.3). Matches the published version 1.1 test vectors and known-answer tests, not those of the final Skein 1.3.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | DarkCrypt Variant |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker |
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
- [Skein 1.1 Specification (15 Nov 2008)](https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf)
- [Skein NIST Round 3 Tweak Description](https://www.schneier.com/wp-content/uploads/2015/01/skein-1.3-modifications.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt Total Commander plugin](https://github.com/Zdimon/DarkCryptTC)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Skein 1.1 Appendix C.2 - Skein-512-512, 1 byte](https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf)

| Field | Value |
| --- | --- |
| `input` | `ff` |
| `expected` | `8fca8d2705f99a56904308a4004c64ef b668818b58b0895bf7296a2c5a54f930 1483d622c4a5aec855ac30087e1eb0e8 3940906e7b055d70d446c8d285f27f01` |

**Vector 2** — [Skein 1.1 Appendix C.2 - Skein-512-512, 64 bytes](https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf)

| Field | Value |
| --- | --- |
| `input` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0 efeeedecebeae9e8e7e6e5e4e3e2e1e0 dfdedddcdbdad9d8d7d6d5d4d3d2d1d0 cfcecdcccbcac9c8c7c6c5c4c3c2c1c0` |
| `expected` | `0fc42e100b2cd0b0c69f39383f9d2d17 af6cf74e2aa8d4e2d91cbf94a59935a3 123b7f9250f982224bf0c3e190be10ab 41add8c1e35cbec4b1b3c35dbba5869c` |

**Vector 3** — [Skein 1.1 Appendix C.2 - Skein-512-512, 128 bytes](https://github.com/SparkDustJoe/Skein/blob/master/skein1.1.pdf)

| Field | Value |
| --- | --- |
| `input` | `fffefdfcfbfaf9f8f7f6f5f4f3f2f1f0 efeeedecebeae9e8e7e6e5e4e3e2e1e0 dfdedddcdbdad9d8d7d6d5d4d3d2d1d0 cfcecdcccbcac9c8c7c6c5c4c3c2c1c0 bfbebdbcbbbab9b8b7b6b5b4b3b2b1b0 afaeadacabaaa9a8a7a6a5a4a3a2a1a0 9f9e9d9c9b9a99989796959493929190 8f8e8d8c8b8a89888786858483828180` |
| `expected` | `0f019e7c1849167cecb9a0d8f1b00ccd 5b14159c5aaee449dab55a1bc6c85103 e8378454912e46af63067950f863043c cfa3699887a2577337caa66531bdbf9e` |

**Vector 4** — [Skein 1.1 ShortMsgKAT_512 - Len = 0](https://web.archive.org/web/2015/http://www.skein-hash.info/sites/default/files/skein_NIST_CD_121508.zip)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `d3f7263a09837f4ce5c8ef70a5ddffac 7b92d6c2ace5a12265bd5b593260a3ff 20d8b4b4c5494e945448b37abb1fc526 f6b46089208fde938d7f23724c4bdfb7` |

**Vector 5** — [Skein 1.1 ShortMsgKAT_512 - Len = 8](https://web.archive.org/web/2015/http://www.skein-hash.info/sites/default/files/skein_NIST_CD_121508.zip)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `a37fa71a4bff725887fd1e3c087a0d9c 427e475962d4d4abfa45f098ec16a18c 1e2f957c0ec343f7e910ec30e34aecfa 703f6d2a334250e5446cdce71a99c222` |

**Vector 6** — [DarkCrypt Skein "abc"](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `c52438c670f3d580dc4cb8d085141a19 643668f82a6ad5f4ecb9292f04b8f38f 1b9dcc8dc4108f72e6ec81fc6cbcd6ed f1867fc4f0beafa692957a4adc1183e3` |

**Vector 7** — [DarkCrypt Skein incremental 64-byte message](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `df2624902ccc7e042541952126f94750 802b3a1e61fa6e22f8bc981066874095 883455ddd2b0c96a28f1074b4f151829 ffc65415503f504e76f362c312120644` |

---

[← All algorithms](../README.md)
