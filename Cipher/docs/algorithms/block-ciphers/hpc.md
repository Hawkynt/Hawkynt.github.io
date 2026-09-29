# HPC

> Hasty Pudding Cipher with variable bit-level block sizes (0-137 billion bits). AES candidate featuring 5 sub-ciphers optimized for different block size ranges and tweakable encryption.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Rich Schroeppel |
| Year | 1998 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/hpc.js`](../../../algorithms/block/hpc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 256 bytes (2048 bits) |
| Block sizes | 1 byte (8 bits) to 8192 bytes (65536 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [HPC Reference Implementation](https://github.com/iscgar/hasty-pudding)
- [AES Submission Package](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program)

## References

- [cryptospecs HPC Reference Source (hpc.c)](https://github.com/stamparm/cryptospecs/blob/master/symmetrical/sources/hpc.c)
- [neilsagarwal HPC Implementation (Python)](https://github.com/neilsagarwal/hpc)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [HPC-Tiny 15-bit with Wagner fix (1999) - Test #0](https://github.com/iscgar/hasty-pudding)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `blockSizeBits` | `15` |
| `input` | `0000` |
| `expected` | `1b41` |

**Vector 2** — [HPC-Tiny 15-bit with Wagner fix (1999) - Test #1](https://github.com/iscgar/hasty-pudding)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `blockSizeBits` | `15` |
| `input` | `0100` |
| `expected` | `5c41` |

**Vector 3** — [HPC-Short 64-bit with Wagner fix (1999) - Test #0](https://github.com/iscgar/hasty-pudding)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0da29b76a1616de1` |

**Vector 4** — [HPC-Short 64-bit with Wagner fix (1999) - Test #1](https://github.com/iscgar/hasty-pudding)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0100000000000000` |
| `expected` | `99ecc89522c69080` |

**Vector 5** — [HPC-Short 64-bit with Wagner fix (1999) - Test #2](https://github.com/iscgar/hasty-pudding)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0200000000000000` |
| `expected` | `92e8afd44c695afd` |

---

[← All algorithms](../README.md)
