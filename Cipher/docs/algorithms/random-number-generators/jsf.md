# JSF

> JSF (Jenkins Small Fast) is a compact, high-speed pseudo-random number generator by Bob Jenkins with 128-bit state. It uses simple operations (rotate, add, XOR) to achieve good statistical properties and passes PractRand testing. Widely used as a baseline for evaluating small fast RNGs.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Bob Jenkins |
| Year | 2007 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/jsf.js`](../../../algorithms/random/jsf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Specification: A small noncryptographic PRNG](http://burtleburtle.net/bob/rand/smallprng.html)
- [PractRand Analysis: Bob Jenkins's Small PRNG](https://www.pcg-random.org/posts/bob-jenkins-small-prng-passes-practrand.html)
- [C++ Implementation by Melissa O'Neill](https://gist.github.com/imneme/85cff47d4bad8de6bdeb671f9c76c814)
- [Wikipedia: Jenkins hash function](https://en.wikipedia.org/wiki/Jenkins_hash_function)

## References

- [PractRand Statistical Testing Suite](https://pracrand.sourceforge.net/)
- [Bob Jenkins' Website: Hash and PRNG algorithms](http://burtleburtle.net/bob/hash/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0x00000000: First 10 outputs (40 bytes) - verified against reference C implementation](http://burtleburtle.net/bob/rand/smallprng.html)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `1a9b6c079a550895f12be8760902ba19 20f1a244832bc5d20bfdb9a17384175a 96a0f7e5470ad8f6` |

**Vector 2** — [Seed 0x00000001: First 10 outputs (40 bytes) - reference implementation](http://burtleburtle.net/bob/rand/smallprng.html)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `a25132f41efa0761332b56b3d1aedb87 4c4d7156b663157a9b0a0c8a973762fe dde060ec17e08dec` |

**Vector 3** — [Seed 0xDEADBEEF: First 10 outputs - test with common debug value](http://burtleburtle.net/bob/rand/smallprng.html)

| Field | Value |
| --- | --- |
| `seed` | `deadbeef` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `fa65a416addcc8e093bc44ac7abd07e5 19cbdd754b2dc24764721eef1216e1bf fdcaec4e4dd17fb7` |

**Vector 4** — [Seed 0x12345678: First 10 outputs - test with sequential byte pattern](http://burtleburtle.net/bob/rand/smallprng.html)

| Field | Value |
| --- | --- |
| `seed` | `12345678` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `4324435b28203161e6d195a631e53a77 7c50cdfb1849d8708acf3d19b11c67e4 22bac8877c58e3e7` |

**Vector 5** — [Seed 0xCAFEBABE: First 8 outputs (32 bytes) - test with another common value](http://burtleburtle.net/bob/rand/smallprng.html)

| Field | Value |
| --- | --- |
| `seed` | `cafebabe` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c722b02e94af7b4bad16571e1f2632d3faa708acc7a955c6227b814437a4f519` |

---

[← All algorithms](../README.md)
