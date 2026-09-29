# PRIDE

> Block cipher optimized for 8-bit microcontrollers with focus on efficient linear layer. 64-bit block size with 128-bit keys using FX construction with 20 rounds. Designed for resource-constrained IoT devices with emphasis on low latency.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Lightweight Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Martin R. Albrecht, Benedikt Driessen, Elif Bilge Kavun, Gregor Leander, Christof Paar, Tolga Yalçın |
| Year | 2014 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/block/pride.js`](../../../algorithms/block/pride.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Related-key differential attack | Full 20-round PRIDE is breakable under the related-key model using related-key differential characteristics derived from its key schedule | Do not reuse related keys; treat as broken under the related-key model and educational-only |

## Documentation

- [PRIDE Specification (ePrint Archive)](https://eprint.iacr.org/2014/453)
- [CRYPTO 2014 Paper](https://link.springer.com/chapter/10.1007/978-3-662-44371-2_2)
- [pypride Reference Implementation](https://github.com/obfusk/pypride)

## References

- [Differential Analysis on Block Cipher PRIDE](https://eprint.iacr.org/2014/525)
- [Cryptanalysis of Full PRIDE Block Cipher](https://eprint.iacr.org/2014/987)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PRIDE Test Vector #1 - specification Appendix J](https://eprint.iacr.org/2014/453.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `82b4109fcc70bd1f` |

**Vector 2** — [PRIDE Test Vector #2 - specification Appendix J](https://eprint.iacr.org/2014/453.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `ffffffffffffffff` |
| `expected` | `d70e60680a17b956` |

**Vector 3** — [PRIDE Test Vector #3 - specification Appendix J](https://eprint.iacr.org/2014/453.pdf)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffff0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `28f19f97f5e846a9` |

**Vector 4** — [PRIDE Test Vector #4 - specification Appendix J](https://eprint.iacr.org/2014/453.pdf)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000ffffffffffffffff` |
| `input` | `0000000000000000` |
| `expected` | `d123ebaf368fce62` |

**Vector 5** — [PRIDE Test Vector #5 - specification Appendix J](https://eprint.iacr.org/2014/453.pdf)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000fedcba9876543210` |
| `input` | `0123456789abcdef` |
| `expected` | `d1372929712d336e` |

---

[← All algorithms](../README.md)
