# KISS

> KISS (Keep It Simple Stupid) combines four simple generators (two MWC, one congruential, one shift-register) using XOR and addition to create a high-quality PRNG with period approximately 2^123. Despite its simplicity, it passes rigorous statistical tests and is widely used in simulations.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Combined PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | George Marsaglia |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/kiss.js`](../../../algorithms/random/kiss.js) |

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

- [Marsaglia's Original Post: Random Numbers for C (1999)](https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ)
- [Programming Praxis: George Marsaglia's Random Number Generators](https://programmingpraxis.com/2010/10/05/george-marsaglias-random-number-generators/)
- [Wikipedia: KISS (algorithm)](https://en.wikipedia.org/wiki/KISS_(algorithm))
- [Reference Implementation (GitHub - librandom)](https://github.com/cgwrench/librandom/blob/master/src/kiss.h)

## References

- [Marsaglia RNG Collection](http://school.anhb.uwa.edu.au/personalpages/kwessen/shared/Marsaglia99.html)
- [Note: KISS - A bit too simple (2011 critique)](https://www.researchgate.net/publication/220336186_KISS_A_bit_too_simple)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Standard seed (z=362436069, w=521288629, jsr=123456789, jcong=380116160): First 5 outputs - Marsaglia default initialization](https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ)

| Field | Value |
| --- | --- |
| `seed` | `159a55e51f123bb5075bcd1516a81cc0` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `2ddccfe02c3a35a87e6ee31aa73a60cebf9847a7` |

**Vector 2** — [Standard seed: After 1,000,000 iterations - Official Marsaglia test vector](https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ)

| Field | Value |
| --- | --- |
| `seed` | `159a55e51f123bb5075bcd1516a81cc0` |
| `outputSize` | `4` |
| `skip` | `1000000` |
| `input` | `null` |
| `expected` | `6e00c98c` |

**Vector 3** — [Seed (1,1,1,1): First 8 outputs - minimal seed values](https://programmingpraxis.com/2010/10/05/george-marsaglias-random-number-generators/)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000010000000100000001` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `90bca43528b06ddc9daed79ce6ccb3023aa7bd7087761af55cf255bb8d103532` |

**Vector 4** — [Seed (12345,65435,34221,12345): First 10 outputs - Marsaglia settable() test initialization](https://groups.google.com/g/sci.math.num-analysis/c/yoaCpGWKEk0/m/UXCxgufdTesJ)

| Field | Value |
| --- | --- |
| `seed` | `000030390000ff9b000085ad00003039` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `8f714bb5eb2b61b7bfc72cbd4d222ed8 647480f7700e80db151bfa19454f142d 9e422d270d7dedd0` |

**Vector 5** — [Standard seed: Outputs 1000-1004 - verifies long-term state progression](https://programmingpraxis.com/2010/10/05/george-marsaglias-random-number-generators/)

| Field | Value |
| --- | --- |
| `seed` | `159a55e51f123bb5075bcd1516a81cc0` |
| `outputSize` | `20` |
| `skip` | `999` |
| `input` | `null` |
| `expected` | `0cf9f508c9dce4be94a7e42a0d2dcc5e6c0ee0c0` |

---

[← All algorithms](../README.md)
