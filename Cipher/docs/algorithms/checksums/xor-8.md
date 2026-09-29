# XOR-8

> Simple XOR-based checksum used in NMEA GPS sentences and serial communication protocols. XORs all input bytes to produce a single-byte error detection value.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | XOR-based |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (ancient technique) |
| Year | 1960 |
| Origin | Not specified |
| Source | [`algorithms/checksum/xor-checksum.js`](../../../algorithms/checksum/xor-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Very simple: XOR all bytes together
- Used in NMEA GPS sentences (between $ and *)
- Can detect odd number of bit errors
- Cannot detect even number of identical bit errors
- Fast and lightweight for embedded systems
- Often displayed as 2-digit hexadecimal

## Documentation

- [XOR Checksum on Wikipedia](https://en.wikipedia.org/wiki/Checksum)
- [NMEA Checksum Calculation](https://nmeachecksum.eqth.net/)
- [Serial Protocol Checksums](https://en.wikibooks.org/wiki/Algorithm_Implementation/Checksums)

## References

- [pynmea2 XOR checksum implementation](https://github.com/Knio/pynmea2/blob/master/pynmea2/nmea.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NMEA sentence type](https://nmeachecksum.eqth.net/)

| Field | Value |
| --- | --- |
| `input` | `4750524d43` |
| `expected` | `4b` |

**Vector 2** — Simple sequence

Source: XOR checksum calculation

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `04` |

**Vector 3** — ASCII test

Source: XOR checksum test

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | `40` |

---

[← All algorithms](../README.md)
