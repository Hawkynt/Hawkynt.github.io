# MULTI2

> MULTI2 block cipher used in DVB (Digital Video Broadcasting) systems. Features 64-bit blocks with 320-bit keys and variable rounds for security flexibility.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Feistel Network |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Hitachi |
| Year | 1988 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/multi2.js`](../../../algorithms/block/multi2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 40 bytes (320 bits) |
| Block sizes | 8 bytes (64 bits) |
| Rounds | 1 round to 255 rounds |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [DVB Specification](https://www.dvb.org/)
- [MULTI2 Overview](https://en.wikipedia.org/wiki/MULTI2)

## References

- [LibTomCrypt MULTI2](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/multi2.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MULTI2: Test vector 1 (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/multi2.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 0123456789abcdef` |
| `rounds` | `128` |
| `input` | `0000000000000001` |
| `expected` | `f89440845e11cf89` |

**Vector 2** — [MULTI2: Test vector 2 (LibTomCrypt)](https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/multi2.c)

| Field | Value |
| --- | --- |
| `key` | `35919d960702e2ce8d0b583cc9c89d59 a2ae964e878245ed3f2e62d63635d067 b127b906e7562238` |
| `rounds` | `216` |
| `input` | `1fb46060d0b34fa5` |
| `expected` | `ca84a93475c860e5` |

---

[← All algorithms](../README.md)
