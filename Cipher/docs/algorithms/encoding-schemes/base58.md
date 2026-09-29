# Base58

> Base58 encoding scheme using 58-character alphabet that excludes visually similar characters (0, O, I, l). Created by Satoshi Nakamoto for Bitcoin addresses to reduce transcription errors. Educational implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Satoshi Nakamoto |
| Year | 2009 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/base58.js`](../../../algorithms/encoding/base58.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Base58 Internet Draft](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)
- [Bitcoin Wiki - Base58Check](https://en.bitcoin.it/wiki/Base58Check_encoding)
- [Base58 Alphabet](https://github.com/bitcoin/bitcoin/blob/master/src/base58.cpp)

## References

- [Bitcoin Source Code](https://github.com/bitcoin/bitcoin)
- [Cryptocurrency Address Formats](https://en.bitcoin.it/wiki/List_of_address_prefixes)
- [Base58 Online Converter](https://www.appdevtools.com/base58-encoder-decoder)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base58 empty string test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base58 single character test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | `66` |
| `expected` | `326d` |

**Vector 3** — [Base58 two character test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | `666f` |
| `expected` | `386f38` |

**Vector 4** — [Base58 three character test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | `666f6f` |
| `expected` | `62516270` |

**Vector 5** — [Base58 four character test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | `666f6f62` |
| `expected` | `336373416739` |

**Vector 6** — [Base58 five character test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | `666f6f6261` |
| `expected` | `435a4a52686d7a` |

**Vector 7** — [Base58 six character test](https://datatracker.ietf.org/doc/html/draft-msporny-base58-03)

| Field | Value |
| --- | --- |
| `input` | `666f6f626172` |
| `expected` | `74315a763279615a` |

---

[← All algorithms](../README.md)
