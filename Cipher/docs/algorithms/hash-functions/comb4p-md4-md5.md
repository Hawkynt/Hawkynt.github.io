# COMB4P(MD4,MD5)

> COMB4P hash combiner using MD4 and MD5. Combines two hash functions with a Feistel-like construction to provide security even if one component hash is broken.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Function Combiner |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Anja Lehmann |
| Year | 2004 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/hash/comb4p.js`](../../../algorithms/hash/comb4p.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Paper: On the Security of Hash Function Combiners](https://eprint.iacr.org/2004/175)
- [Botan Implementation](https://botan.randombit.net/)

## References

- [Botan Comb4P hash combiner implementation](https://github.com/randombit/botan/blob/master/src/lib/hash/comb4p/comb4p.cpp)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan Test Vector: 'comb4_input'](https://github.com/randombit/botan/blob/master/src/tests/data/hash/comp4p.vec)

| Field | Value |
| --- | --- |
| `input` | `636f6d62345f696e707574` |
| `expected` | `fd1a64f7bc61608fd054303afa2e31608aa3f3788e3034821d63a0288a70b573` |

---

[← All algorithms](../README.md)
