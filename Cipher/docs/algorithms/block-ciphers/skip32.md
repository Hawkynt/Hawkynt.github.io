# Skip32

> 32-bit block cipher based on Skipjack's F-table. Uses 24-round Feistel structure with 80-bit key. Designed for obfuscating small integers.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Greg Rose (QUALCOMM) |
| Year | 1999 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/skip32.js`](../../../algorithms/block/skip32.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Block sizes | 4 bytes (32 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Implementation](https://github.com/dverite/cryptint/blob/master/skip32.c)

## References

- [Skipjack F-Table Reference](https://github.com/weidai11/cryptopp/blob/master/skipjack.cpp)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt SKIP32 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000` |
| `input` | `00000000` |
| `expected` | `b8e4fea5` |

**Vector 2** — [DarkCrypt SKIP32 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `input` | `00010203` |
| `expected` | `0af04ffa` |

**Vector 3** — [DarkCrypt SKIP32 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a` |
| `input` | `10111213` |
| `expected` | `a4b9eea6` |

**Vector 4** — [node-skip32 test vector](https://github.com/femto113/node-skip32)

| Field | Value |
| --- | --- |
| `key` | `9b21960e1acf245f1493` |
| `input` | `00000001` |
| `expected` | `22e9ffa6` |

---

[← All algorithms](../README.md)
