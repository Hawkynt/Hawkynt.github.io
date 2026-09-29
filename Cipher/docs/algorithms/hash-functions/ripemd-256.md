# RIPEMD-256

> RIPEMD-256 is an extension of RIPEMD-128 with 256-bit output. Uses two parallel computation lines with different initial values and no final combination. Part of the RIPEMD family designed as European alternatives to SHA algorithms.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | RIPEMD Family |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Hans Dobbertin, Antoon Bosselaers, Bart Preneel |
| Year | 1996 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/ripemd.js`](../../../algorithms/hash/ripemd.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RIPEMD Family Specification](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)
- [Wikipedia Article](https://en.wikipedia.org/wiki/RIPEMD)

## References

- [Bouncy Castle Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/RIPEMD256Digest.java)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `02ba4c4e5f8ecd1877fc52d64d30e37a2d9774fb1e5d026380ae0168e3c5522d` |

**Vector 2** — [Single character 'a' test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `f9333e45d857f5d90a91bab70a1eba0cfb1be4b0783c9acfcd883a9134692925` |

**Vector 3** — [String 'abc' test vector](https://homes.esat.kuleuven.be/~bosselae/ripemd160.html)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `afbd6e228b9d8cbbcef5ca2d03e6dba10ac0bc7dcbe4680e1e42d2e975459b65` |

---

[← All algorithms](../README.md)
