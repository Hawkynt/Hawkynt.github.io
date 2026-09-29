# ICE-2

> Information Concealment Engine with level 2 (32 rounds, 128-bit key). 64-bit Feistel block cipher with key-dependent S-boxes designed by Matthew Kwan.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Matthew Kwan |
| Year | 1997 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/ice.js`](../../../algorithms/block/ice.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ICE Algorithm Specification](https://darkside.com.au/ice/description.html)
- [ICE Home Page](https://darkside.com.au/ice/)
- [Fast Software Encryption 1997 Paper](https://link.springer.com/chapter/10.1007/BFb0052335)

## References

- [Original C Implementation](https://darkside.com.au/ice/ice-doc-C.html)
- [ICE Algorithm Overview](https://darkside.com.au/ice/overview.html)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ICE-2 Official Test Vector](https://darkside.com.au/ice/overview.html)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `fedcba9876543210` |
| `expected` | `f94840d86972f21c` |

---

[← All algorithms](../README.md)
