# DPCM

> Differential Pulse-Code Modulation, an order-1 predictive transform that stores each sample as its difference (modulo 256) from the immediately preceding sample, with the first sample stored verbatim. Effective for correlated signal data such as audio samples or slowly varying sensor readings, where residuals cluster near zero and compress well with an entropy coder.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Beginner |
| Inventor | C. Chapin Cutler |
| Year | 1950 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/dpcm.js`](../../../algorithms/compression/dpcm.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [US Patent 2,605,361 - Differential Quantization of Communication Signals](https://patents.google.com/patent/US2605361A)
- [ITU-T G.726 - 40, 32, 24, 16 kbit/s Adaptive Differential PCM](https://www.itu.int/rec/T-REC-G.726)
- [Differential pulse-code modulation - Wikipedia](https://en.wikipedia.org/wiki/Differential_pulse-code_modulation)

## References

- [Jayant and Noll, Digital Coding of Waveforms](https://en.wikipedia.org/wiki/Differential_pulse-code_modulation)
- [PNG Delta Filters (related order-1 predictive transform)](http://libpng.org/pub/png/spec/1.2/PNG-Filters.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data test

Source: Edge case test

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single sample test

Source: Minimal DPCM test

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `41` |

**Vector 3** — [Incrementing sequence, ideal for DPCM](https://en.wikipedia.org/wiki/Differential_pulse-code_modulation)

| Field | Value |
| --- | --- |
| `input` | `0a0c0e10` |
| `expected` | `0a020202` |

**Vector 4** — [Wraparound across the 0/255 boundary (modulo-256 residual)](https://patents.google.com/patent/US2605361A)

| Field | Value |
| --- | --- |
| `input` | `fa0a05` |
| `expected` | `fa10fb` |

---

[← All algorithms](../README.md)
