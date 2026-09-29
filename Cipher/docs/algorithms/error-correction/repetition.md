# Repetition

> Repetition codes use triple modular redundancy (TMR) or N-modular redundancy to correct errors. Each bit is repeated N times, and majority voting recovers the original data. Can correct up to (N-1)/2 bit errors per N-bit group. Simple but inefficient, widely used in critical systems like spacecraft.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Codes |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | John von Neumann |
| Year | 1956 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/repetition.js`](../../../algorithms/ecc/repetition.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 1048576 bytes (8388608 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsErrorDetection` | Yes |
| `supportsErrorCorrection` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Triple Modular Redundancy - Wikipedia](https://en.wikipedia.org/wiki/Triple_modular_redundancy)
- [Repetition Code - Wikipedia](https://en.wikipedia.org/wiki/Repetition_code)
- [Error Correction Tutorial](https://www.electronicshub.org/error-correction-and-detection-codes/)

## References

- [liquid-dsp rep3 Repetition Code Implementation](https://github.com/jgaeddert/liquid-dsp/blob/master/src/fec/src/fec_rep3.c)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Triple repetition: bit 0](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `repetitionCount` | `3` |
| `input` | `00` |
| `expected` | `000000` |

**Vector 2** — [Triple repetition: bit 1](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `repetitionCount` | `3` |
| `input` | `01` |
| `expected` | `010101` |

**Vector 3** — [Triple repetition: 1011 pattern](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `repetitionCount` | `3` |
| `input` | `01000101` |
| `expected` | `010101000000010101010101` |

**Vector 4** — [Triple repetition: byte pattern](https://en.wikipedia.org/wiki/Triple_modular_redundancy)

| Field | Value |
| --- | --- |
| `repetitionCount` | `3` |
| `input` | `0100000101000100` |
| `expected` | `010101000000000000010101010101000000010101000000` |

---

[← All algorithms](../README.md)
