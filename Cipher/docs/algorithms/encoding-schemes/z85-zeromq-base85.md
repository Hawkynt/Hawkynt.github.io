# Z85 (ZeroMQ Base85)

> Variant of Base85 encoding developed for ZeroMQ that provides more efficient binary-to-text encoding than Base64. Uses 85 printable ASCII characters and avoids problematic characters like quotes and backslashes. Educational implementation following ZeroMQ RFC 32. RFC 32 defines Z85 only for byte strings whose length is a multiple of 4 (its reference implementation rejects anything else); this implementation does the same rather than inventing a non-standard padding scheme, so any input whose length is not a multiple of 4 is rejected with a clear error instead of being silently padded.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | ZeroMQ Community |
| Year | 2013 |
| Origin | 🌐 International |
| Restricted input domain | Yes |
| Source | [`algorithms/encoding/z85.js`](../../../algorithms/encoding/z85.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ZeroMQ RFC 32: Z85 Encoding](https://rfc.zeromq.org/spec/32/)
- [Z85 Specification](https://github.com/zeromq/rfc/blob/master/src/spec_32.c)
- [Base85 Encoding Wikipedia](https://en.wikipedia.org/wiki/Ascii85)

## References

- [ZeroMQ Protocol Documentation](https://zeromq.org/)
- [Base85 vs Base64 Comparison](https://tools.ietf.org/html/rfc1924)
- [Binary Encoding Standards](https://www.iana.org/assignments/character-sets/character-sets.xhtml)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Z85 empty data test](https://rfc.zeromq.org/spec/32/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Basic 4-byte encoding test - Z85

Source: ZeroMQ RFC 32

| Field | Value |
| --- | --- |
| `input` | `00000001` |
| `expected` | `3030303031` |

**Vector 3** — High-bit-set leading byte regression test - signed-32-bit packing overflow

Source: ZeroMQ RFC 32

| Field | Value |
| --- | --- |
| `input` | `ff000000` |
| `expected` | `4040723330` |

**Vector 4** — All 256 byte values regression test (64 4-byte blocks) - exercises every packed value including high bit set

Source: ZeroMQ RFC 32

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `3030396336316f21236d324e483f4333 3e69575335645d4a2a3643527831372d 736b68393333377861722e7b4e625142 3d2b635b635240656726466366464c73 …` (320 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
