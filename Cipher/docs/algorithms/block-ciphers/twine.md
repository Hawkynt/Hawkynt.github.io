# TWINE

> Lightweight block cipher designed by NEC for resource-constrained environments. 64-bit block size with 80-bit or 128-bit keys using 36-round Type-2 Generalized Feistel structure. Optimized for both hardware and software implementations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Lightweight Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Tomoyasu Suzaki, Kazuhiko Minematsu, Sumio Morioka, Eita Kobayashi (NEC) |
| Year | 2012 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/twine.js`](../../../algorithms/block/twine.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) to 16 bytes (128 bits) in steps of 6 bytes |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [TWINE Official Page (NEC)](https://www.nec.com/en/global/rd/tg/code/symenc/twine.html)
- [TWINE Specification (PDF)](https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf)
- [SAC 2012 Paper](https://link.springer.com/chapter/10.1007/978-3-642-35999-6_22)

## References

- [openluopworld Lightweight Block Ciphers - TWINE (C)](https://github.com/openluopworld/block-ciphers)
- [go-twine Implementation](https://github.com/dgryski/go-twine)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TWINE-80 Test Vector (Table 1, SAC 2012 Paper)](https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899` |
| `input` | `0123456789abcdef` |
| `expected` | `7c1f0f80b1df9c28` |

**Vector 2** — [TWINE-128 Test Vector (Table 1, SAC 2012 Paper)](https://www.nec.com/en/global/rd/tg/code/symenc/pdf/twine_LC11.pdf)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `input` | `0123456789abcdef` |
| `expected` | `979ff9b379b5a9b8` |

---

[← All algorithms](../README.md)
