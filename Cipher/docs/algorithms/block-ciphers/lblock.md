# LBlock

> Lightweight 64-bit block cipher with 80-bit keys designed for resource-constrained environments. Uses 32-round Feistel network with 10 different 4-bit S-boxes. Optimized for both hardware and software implementations with low power consumption.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Lightweight Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Wenling Wu, Lei Zhang |
| Year | 2011 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/block/lblock.js`](../../../algorithms/block/lblock.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [LBlock Specification (ePrint Archive)](https://eprint.iacr.org/2011/345)
- [ACNS 2011 Paper (Springer)](https://link.springer.com/chapter/10.1007/978-3-642-21554-4_19)

## References

- [openluopworld Lightweight Block Ciphers - LBlock (C)](https://github.com/openluopworld/block-ciphers)
- [kmarquet/bloc LBlock Implementation (C)](https://github.com/kmarquet/bloc/blob/master/LBlock/LBlock.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LBlock-80 Test Vector #1 (all zeros) - specification Appendix I](https://eprint.iacr.org/2011/345.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `c218185308e75bcd` |

**Vector 2** — [LBlock-80 Test Vector #2 - specification Appendix I](https://eprint.iacr.org/2011/345.pdf)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedc` |
| `input` | `0123456789abcdef` |
| `expected` | `4b7179d8ebee0c26` |

---

[← All algorithms](../README.md)
