# Golay

> Binary Golay code [23,12,7] is a perfect error-correcting code capable of correcting up to 3 bit errors or detecting up to 7 errors. Achieves the Hamming bound with 12 data bits encoded into 23-bit codewords. Used in NASA Voyager deep space missions and military communications (MIL-STD-188).

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Perfect Codes |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Marcel J. E. Golay |
| Year | 1949 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/golay.js`](../../../algorithms/ecc/golay.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 12 bytes (96 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsErrorDetection` | Yes |
| `supportsErrorCorrection` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [Binary Golay Code - Wikipedia](https://en.wikipedia.org/wiki/Binary_Golay_code)
- [Golay Code - MathWorld](https://mathworld.wolfram.com/GolayCode.html)
- [Reference Implementation](https://github.com/crorvick/outguess/blob/master/golay.c)
- [Voyager Implementation](https://sourceforge.isae.fr/projects/simplified-communications-schemes-of-voyager-i-probe/wiki/Golay_Code_Implementation_%E2%80%93_Encoding)

## References

- [Wireshark Golay Decoder Implementation](https://github.com/wireshark/wireshark/blob/master/epan/golay.c)
- [ArduPilot SiK Radio Golay Implementation](https://github.com/ArduPilot/SiK/blob/master/Firmware/radio/golay.c)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [All zeros test](https://en.wikipedia.org/wiki/Binary_Golay_code)

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `000000` |

**Vector 2** — Single bit pattern

Source: Systematic encoding with generator polynomial 0xC75

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `000c75` |

**Vector 3** — [All data bits set](https://github.com/crorvick/outguess/blob/master/golay.c)

| Field | Value |
| --- | --- |
| `input` | `0fff` |
| `expected` | `7fffff` |

**Vector 4** — Alternating bit pattern

Source: Systematic encoding test

| Field | Value |
| --- | --- |
| `input` | `0aaa` |
| `expected` | `555179` |

---

[← All algorithms](../README.md)
