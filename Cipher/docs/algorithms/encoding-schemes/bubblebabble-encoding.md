# BubbleBabble Encoding

> Binary-to-text encoding scheme that produces pronounceable words, commonly used for SSH fingerprints. Creates human-readable representations of binary data using consonant-vowel patterns and an embedded checksum, per Antti Huima's draft-huima-01 specification. Encodes any byte sequence of any length - there is no restricted input domain.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Fingerprint Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Antti Huima |
| Year | 2000 |
| Origin | Not specified |
| Source | [`algorithms/encoding/bubblebabble.js`](../../../algorithms/encoding/bubblebabble.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [BubbleBabble Specification](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)
- [SSH Fingerprint Format](https://en.wikipedia.org/wiki/Public_key_fingerprint)
- [OpenSSH BubbleBabble Implementation](https://github.com/openssh/openssh-portable)

## References

- [SSH Protocol Documentation](https://www.openssh.com/specs.html)
- [Fingerprint Verification Methods](https://tools.ietf.org/html/rfc4716)
- [BubbleBabble in Practice](https://www.ssh.com/ssh/keygen/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BubbleBabble empty data test (spec section 5)](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `7865786178` |

**Vector 2** — [BubbleBabble '1234567890' test (spec section 5)](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930` |
| `expected` | `78657365662d6469736f662d67797475 662d6b61746f662d6d6f7669662d6261 787578` |

**Vector 3** — [BubbleBabble 'Pineapple' test (spec section 5)](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)

| Field | Value |
| --- | --- |
| `input` | `50696e656170706c65` |
| `expected` | `786967616b2d6e7972796b2d68756d696c2d626f73656b2d736f6e6178` |

**Vector 4** — [Single byte encoding test - BubbleBabble](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `7869626578` |

**Vector 5** — [Even-length two-byte test with 0x00/0xFF - exercises the even-K capstone-tuple path](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)

| Field | Value |
| --- | --- |
| `input` | `00ff` |
| `expected` | `786562617a2d7a69786578` |

**Vector 6** — [All 256 byte values regression test (128 full tuples) - exercises the checksum chain and every consonant/vowel index](https://web.mit.edu/kenta/www/one/bubblebabble/spec/jrtrjwzi/draft-huima-01.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `78656261622d6361626f622d66796365 622d68756375622d6c6f646f622d6e69 6461622d72656679622d74616669622d 7a796761632d6375676f632d666f6869 …` (773 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
