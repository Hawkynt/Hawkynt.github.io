# Dragon

> Word-based eSTREAM candidate using two NLFSRs with 32-bit operations for high-speed software. Designed by Chen, Henricksen, et al. but eliminated in Phase 2 due to cryptanalytic vulnerabilities.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | K. Chen, M. Henricksen, A. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee, S. Moon |
| Year | 2005 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/dragon.js`](../../../algorithms/stream/dragon.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 16 bytes |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing Attack | Multiple cryptanalytic attacks discovered during eSTREAM evaluation | — |
| Key Recovery | Practical attacks on the cipher structure | — |

## Documentation

- [eSTREAM Dragon Specification](https://www.ecrypt.eu.org/stream/dragonpf.html)
- [eSTREAM Project](https://www.ecrypt.eu.org/stream/)
- [Cryptanalysis of Dragon](https://eprint.iacr.org/2006/151.pdf)

## References

- [eSTREAM Benchmark Suite (includes official Dragon reference C submission)](https://cr.yp.to/streamciphers/timings.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Dragon Test Vector - All Zeros

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6` |

**Vector 2** — Dragon Test Vector - Simple Key

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f4d08c757452e0d3d56512493f13973b` |

---

[← All algorithms](../README.md)
