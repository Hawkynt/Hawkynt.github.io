# MARS

> IBM AES finalist (1998) featuring heterogeneous structure with Type-3 Feistel network, combining S-boxes, multiplication, and data-dependent rotations. Uses 32 rounds with unkeyed mixing and keyed cryptographic core.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | IBM (Don Coppersmith, et al.) |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/mars.js`](../../../algorithms/block/mars.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 56 bytes (448 bits) in steps of 4 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [IBM MARS Specification](https://shaih.github.io/pubs/mars/mars.pdf)
- [NIST AES Process Report](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program)

## References

- [MARS at Wikipedia](https://en.wikipedia.org/wiki/MARS_(cipher))
- [AES Finalist Analysis](https://www.schneier.com/academic/archives/2000/04/the_twofish_encrypti.html)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ MARS/ECB - 128-bit key, single high bit](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b3e2ad5608ac1b6733a7cb4fdf8f9952` |

**Vector 2** — [Crypto++ MARS/ECB - 128-bit zero key, zero plaintext](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `dcc07b8dfb0738d6e30a22dfcf27e886` |

**Vector 3** — [Crypto++ MARS/ECB - 128-bit key, chained plaintext](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `dcc07b8dfb0738d6e30a22dfcf27e886` |
| `expected` | `33caffbddc7f1dda0f9c15fa2f30e2ff` |

**Vector 4** — [Crypto++ MARS/ECB - 128-bit random key](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `cb14a1776abbc1cdafe7243def2cea02` |
| `input` | `f94512a9b42d034ec4792204d708a69b` |
| `expected` | `225da2cb64b73f79069f21a5e3cb8522` |

**Vector 5** — [Crypto++ MARS/ECB - 128-bit random key 2](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `86edf4da31824cabef6a4637c40b0bab` |
| `input` | `4df955ad5b398d66408d620a2b27e1a9` |
| `expected` | `a4b737340ae6d2cafd930ba97d86129f` |

**Vector 6** — [Crypto++ MARS/ECB - 192-bit zero key](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `expected` | `97778747d60e425c2b4202599db856fb` |

**Vector 7** — [Crypto++ MARS/ECB - 192-bit sparse key](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `d158860838874d9500000000000000000000000000000000` |
| `input` | `93a953a82c10411dd158860838874d95` |
| `expected` | `4fa0e5f64893131712f01408d233e9f7` |

**Vector 8** — [Crypto++ MARS/ECB - 192-bit random key](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `791739a58b04581a93a953a82c10411dd158860838874d95` |
| `input` | `6761c42d3e6142d2a84fbfadb383158f` |
| `expected` | `f706bc0fd97e28b6f1af4e17d8755fff` |

**Vector 9** — [Crypto++ MARS/ECB - 256-bit zero key](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `62e45b4cf3477f1dd65063729d9aba8f` |
| `expected` | `0f4b897ea014d21fbc20f1054a42f719` |

**Vector 10** — [Crypto++ MARS/ECB - 256-bit random key](https://raw.githubusercontent.com/weidai11/cryptopp/master/TestVectors/mars.txt)

| Field | Value |
| --- | --- |
| `key` | `fba167983e7aef22317ce28c02aae1a3e8e5cc3cedbea82a99dbc39ad65e7227` |
| `input` | `1344aba4d3c44708a8a72116d4f49384` |
| `expected` | `458335d95ea42a9f4dccd41aecc2390d` |

---

[← All algorithms](../README.md)
