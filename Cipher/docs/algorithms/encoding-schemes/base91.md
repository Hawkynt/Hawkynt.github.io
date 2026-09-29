# Base91

> Base91 (basE91) encoding using 91-character alphabet for efficient binary-to-text encoding. Achieves only 23% overhead compared to Base64's 33% by using variable-length bit packing. Developed by Joachim Henke for maximum efficiency.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Joachim Henke |
| Year | 2000 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/encoding/base91.js`](../../../algorithms/encoding/base91.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Base91 Official Site](http://base91.sourceforge.net/)
- [Base91 Algorithm Description](http://base91.sourceforge.net/base91.html)
- [Base91 Wikipedia Article](https://en.wikipedia.org/wiki/Base91)

## References

- [Base91 Source Code](http://base91.sourceforge.net/base91.c)
- [Base91 Online Encoder](https://base91.io/)
- [Binary-to-Text Encoding Comparison](https://en.wikipedia.org/wiki/Binary-to-text_encoding)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base91 empty string test](https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base91 single character test - 'a'](https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `4742` |

**Vector 3** — [Base91 word test - 'test'](https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java)

| Field | Value |
| --- | --- |
| `input` | `74657374` |
| `expected` | `66504e4b64` |

**Vector 4** — [Base91 palindrome test with newline](https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java)

| Field | Value |
| --- | --- |
| `input` | `4e65766572206f6464206f72206576656e0a` |
| `expected` | `5f4f5e6770404a6037527a746a626c4c41235f31654841` |

**Vector 5** — [Base91 sentence test with newline](https://github.com/bwaldvogel/base91/blob/main/src/test/java/de/bwaldvogel/base91/Base91Test.java)

| Field | Value |
| --- | --- |
| `input` | `4d61792061206d6f6f6479206261627920646f6f6d20612079616d3f0a` |
| `expected` | `3844394b63293d2f3224577a65467569 2347394b6d2b3c7b56543275394d5a69 6c7d5b41` |

**Vector 6** — [Base91 all 256 byte values regression test - exercises the 91st alphabet symbol (double quote)](https://github.com/bwaldvogel/base91/blob/main/src/main/java/de/bwaldvogel/base91/Base91OutputStream.java)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `3a4323283a433f685642244d53695645 776e6442414d5a527877466642423b49 573c7d59515621415f7624595f63257a 723463595150466c302c4068654d414a …` (315 bytes; the full value is in the source) |

**Vector 7** — [Base91 pseudo-random 128-byte regression test - exercises the decode bit-queue-length branch for a decode value above the 13-bit mask (8191)](https://github.com/bwaldvogel/base91/blob/main/src/main/java/de/bwaldvogel/base91/Base91.java)

| Field | Value |
| --- | --- |
| `input` | `614d13f8a060bea6b2892cc12663c843 464cbfe81f5efd2e7d762e4fec2fbd48 b7e7d8d5ebb86871547f1c5a7dd75f8a b41e5cbd036e007136a4f6e0db5bac07 3cf14ca26680c32c25e5bde205bba5c0 5160a88216eeb2a420426f61faf74ab6 f26a705f12b8cdd726ba0d5bbc0f9be7 1e11a43759de14c7394f97d24a039955` |
| `expected` | `366c234252585b406364364e544e354e 32587d79363154783346647b64363870 2471617d43727e6f286f2665684b3b6b 7535524c69234d713d515d2f67753126 6d6e7857616d686c7a5f516e667b4a56 6c6b5a3762225d6a2b5a77724b685b3d 5f222e42336438667d675e357e466167 477b243945676c38245e7047326d7e23 5b6f52214c3e466d233d424775263d30 394f423360364e61456c2f316041` |

---

[← All algorithms](../README.md)
