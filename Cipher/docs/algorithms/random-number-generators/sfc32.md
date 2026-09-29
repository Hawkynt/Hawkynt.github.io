# SFC32

> Small Fast Counting (SFC32) is a high-quality PRNG by Chris Doty-Humphrey designed for the PractRand test suite. It combines a chaotic invertible mapping with a counter to guarantee no small cycles and passes rigorous statistical tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Chris Doty-Humphrey |
| Year | 2010 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/sfc.js`](../../../algorithms/random/sfc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [PractRand: Chris Doty-Humphrey's PRNG Test Suite](http://pracrand.sourceforge.net/)
- [PractRand RNG Engines Documentation](http://pracrand.sourceforge.net/RNG_engines.txt)
- [Apache Commons RNG Implementation](https://commons.apache.org/proper/commons-rng/commons-rng-core/javadocs/api-1.3/org/apache/commons/rng/core/source32/DotyHumphreySmallFastCounting32.html)
- [JavaScript PRNG Implementations (bryc/code)](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)

## References

- [NumPy SFC64 Implementation](https://numpy.org/doc/stable/reference/random/bit_generators/sfc64.html)
- [PractRand Statistical Test Suite](http://pracrand.sourceforge.net/)
- [TestU01 Statistical Testing](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (1,2,3,4): First 5 outputs (20 bytes) - verified against SFC32 reference implementation](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000020000000300000004` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0000000700000022036000600b421d78cc849c75` |

**Vector 2** — [Seed (0,0,0,1): First 10 outputs - minimal seed with counter=1](http://pracrand.sourceforge.net/RNG_engines.txt)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000000000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `00000001000000020000000c0120001f 0360b48399e14d9bd9c4e5de3f6d95a6 59390fb3004b9efb` |

**Vector 3** — [Seed (0x9E3779B9, 0x243F6A88, 0xB7E15162, 12): Standard test seed - first 8 outputs](https://commons.apache.org/proper/commons-rng/)

| Field | Value |
| --- | --- |
| `seed` | `9e3779b9243f6a88b7e151620000000c` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c276e44d9b1951bcdc0d8dd95fdf01a49ee74639d956e0048959f5a3a65a8e9d` |

**Vector 4** — [Seed (12345, 67890, 11111, 1): Common test values - first 12 outputs (discard first 12 per PractRand)](http://pracrand.sourceforge.net/)

| Field | Value |
| --- | --- |
| `seed` | `000030390001093200002b670000000001` |
| `outputSize` | `48` |
| `input` | `null` |
| `expected` | `0001396c00029057d3ec8b58733481ed 214324f016ed3820ff9157416940350b db7782ec49733921410d3859a992c3af` |

**Vector 5** — [Seed (1,1,1,1): Identical seed values - first 6 outputs](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000010000000100000001` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `000000030000000c012000270480b48b9b0201e26ce50a5b` |

---

[← All algorithms](../README.md)
