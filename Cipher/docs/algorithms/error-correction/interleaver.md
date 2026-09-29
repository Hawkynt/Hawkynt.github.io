# Interleaver

> Block interleaver that rearranges data to distribute burst errors across multiple codewords. Uses matrix transposition to convert burst errors into random errors. Note: Interleaving is a technique used WITH error correction codes, not a standalone correction algorithm.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Interleaving |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (Data Reorganization Concept) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/ecc/interleaver.js`](../../../algorithms/ecc/interleaver.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| No Error Correction | Interleaving only redistributes errors. Must be combined with error correction codes for actual correction capability. | — |
| Latency Introduction | Block interleaving introduces delay as entire blocks must be buffered before transmission/processing. | — |

## Documentation

- [Wikipedia - Interleaving](https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving)
- [Error Control Coding](https://www.sciencedirect.com/topics/engineering/interleaver)
- [Digital Communications Tutorial](https://www.tutorialspoint.com/digital_communication/digital_communication_interleaving.htm)

## References

- [Convolutional Interleaving](https://en.wikipedia.org/wiki/Convolutional_interleaver)
- [Turbo Code Interleaving](https://ieeexplore.ieee.org/document/539815)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [4x4 block interleaving test](https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving)

| Field | Value |
| --- | --- |
| `rows` | `4` |
| `cols` | `4` |
| `input` | `0102030405060708090a0b0c0d0e0f10` |
| `expected` | `0105090d02060a0e03070b0f04080c10` |

**Vector 2** — [Sequential interleaving pattern](https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving)

| Field | Value |
| --- | --- |
| `rows` | `4` |
| `cols` | `4` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0004080c0105090d02060a0e03070b0f` |

**Vector 3** — [3x3 interleaving test](https://en.wikipedia.org/wiki/Burst_error-correcting_code#Interleaving)

| Field | Value |
| --- | --- |
| `rows` | `3` |
| `cols` | `3` |
| `input` | `010203040506070809` |
| `expected` | `010407020508030609` |

---

[← All algorithms](../README.md)
