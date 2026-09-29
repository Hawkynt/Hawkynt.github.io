# Midori128

> Lightweight block cipher optimized for low energy consumption. 128-bit block size with 128-bit keys using 20 rounds. Based on AES-like structure with 4×4 byte state and binary MixColumns operation in GF(2).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Lightweight Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Subhadeep Banik, Andrey Bogdanov, Takanori Isobe, et al. |
| Year | 2015 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/midori.js`](../../../algorithms/block/midori.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Midori Specification (ePrint Archive)](https://eprint.iacr.org/2015/1142)
- [ASIACRYPT 2015 Paper](https://link.springer.com/chapter/10.1007/978-3-662-48800-3_17)

## References

- [tomirio619 Midori Reference Implementation (Python/VHDL)](https://github.com/tomirio619/Midori)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Midori128 Test Vector #1 (all zeros) - specification Appendix A](https://eprint.iacr.org/2015/1142.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c055cbb95996d14902b60574d5e728d6` |

**Vector 2** — [Midori128 Test Vector #2 - specification Appendix A](https://eprint.iacr.org/2015/1142.pdf)

| Field | Value |
| --- | --- |
| `key` | `687ded3b3c85b3f35b1009863e2a8cbf` |
| `input` | `51084ce6e73a5ca2ec87d7babc297543` |
| `expected` | `1e0ac4fddff71b4c1801b73ee4afc83d` |

---

[← All algorithms](../README.md)
