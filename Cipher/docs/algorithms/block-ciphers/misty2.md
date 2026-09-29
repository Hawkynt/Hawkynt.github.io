# MISTY2

> Enhanced theoretical successor to MISTY1 with 12-round structure. Features enhanced FL/FO functions and additional diffusion. Academic design for educational purposes only.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Theoretical enhancement of Mitsuru Matsui design |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/misty.js`](../../../algorithms/block/misty.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [MISTY1 RFC 2994 (Base Design)](https://tools.ietf.org/rfc/rfc2994.txt)
- [MISTY Family Information](https://en.wikipedia.org/wiki/MISTY1)

## References

- [Educational Cipher Design](https://www.cryptrec.go.jp/english/)
- [Feistel Network Theory](https://en.wikipedia.org/wiki/Feistel_cipher)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MISTY2 regression vector (no published KAT exists for MISTY2)](https://en.wikipedia.org/wiki/MISTY1)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `0123456789abcdef` |
| `expected` | `1232eb29d12cf745` |

---

[← All algorithms](../README.md)
