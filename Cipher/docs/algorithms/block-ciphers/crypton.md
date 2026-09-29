# Crypton

> Korean AES candidate with 128-bit blocks and 128/192/256-bit keys.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Chae Hoon Lim |
| Year | 1998 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/crypton.js`](../../../algorithms/block/crypton.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST IR 6391 - CRYPTON Block Cipher](https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf)
- [Wikipedia - Crypton (cipher)](https://en.wikipedia.org/wiki/Crypton_(cipher))

## References

- [Brian Gladman Reference Implementation (AES Candidate Suite)](https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt CRYPTON-256 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ec62e539bb6bbc811a60c06faccb7ec8` |

**Vector 2** — [DarkCrypt CRYPTON-256 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `f492525dec52b41aa180a2477d8c3e7b` |

**Vector 3** — [DarkCrypt CRYPTON-256 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `1ed972824b3cc0fce3f2ebc503db4424` |

**Vector 4** — [NIST IR 6391 sample - 128-bit key](https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `b2e3c68c3183e69504d4b90377d126e6` |

**Vector 5** — [NIST IR 6391 sample - 192-bit key](https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `ba1744e85800f7a174326da87eda7e45` |

**Vector 6** — [NIST IR 6391 sample - 256-bit key](https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `17d5fac539eea17b36371838792ea84d` |

---

[← All algorithms](../README.md)
