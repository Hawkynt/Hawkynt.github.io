# Base85

> Base85 encoding using the RFC 1924 85-character alphabet (digits, then upper/lowercase letters, then symbols) for efficient binary-to-text encoding. Encodes 4 bytes into 5 characters with 25% overhead compared to Base64's 33%. Unlike Adobe's original Ascii85, this alphabet assigns 'z' as an ordinary digit, so it does not use Adobe's all-zero-group 'z' shortcut (that shortcut only works with Adobe's own '!'-'u' alphabet, which excludes 'z'; grafting it onto this alphabet would make a plain digit indistinguishable from the shortcut).

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Paul E. Rutter (Adobe) |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/encoding/base85.js`](../../../algorithms/encoding/base85.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Adobe PostScript Language Reference](https://www.adobe.com/products/postscript/pdfs/PLRM.pdf)
- [RFC 1924 - IPv6 Address Encoding](https://tools.ietf.org/html/rfc1924)
- [Base85 Wikipedia Article](https://en.wikipedia.org/wiki/Ascii85)

## References

- [Base85 Online Encoder/Decoder](https://base85.io/)
- [Adobe Ascii85 Specification](https://www.adobe.com/devnet/postscript.html)
- [RFC 1924 Compact IPv6 Representation](https://datatracker.ietf.org/doc/html/rfc1924)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base85 empty string test](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base85 all-zero group test - no 'z' shortcut (this alphabet uses 'z' as a normal digit)](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `3030303030` |

**Vector 3** — [Base85 high-bit-set leading byte test - regression for signed-32-bit packing overflow](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `ff000000` |
| `expected` | `7b7b523330` |

**Vector 4** — [Base85 all 256 byte values regression test - exercises every leading digit including 'z' as an ordinary character](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `3030394336314f297e4d326e682d6333 3d49777335445e6a2b36637258313723 534b4839333337584152215f6e427162 2625434043727b45473b664346666c53 …` (320 bytes; the full value is in the source) |

**Vector 5** — [Base85 four character test - 'Man '](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `4d616e20` |
| `expected` | `4f3c605e7a` |

**Vector 6** — [Base85 single character test - 'M'](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `4d` |
| `expected` | `4f23` |

**Vector 7** — [Base85 two character test - 'Ma'](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `4d61` |
| `expected` | `4f3c40` |

**Vector 8** — [Base85 three character test - 'Man'](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `4d616e` |
| `expected` | `4f3c605e` |

**Vector 9** — [Base85 five character test - 'sure.'](https://en.wikipedia.org/wiki/Ascii85)

| Field | Value |
| --- | --- |
| `input` | `737572652e` |
| `expected` | `623948694d4526` |

---

[← All algorithms](../README.md)
