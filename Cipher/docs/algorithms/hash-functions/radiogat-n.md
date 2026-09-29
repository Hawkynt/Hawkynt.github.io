# RadioGatún

> RadioGatún is a belt-and-mill hash function that served as a predecessor to Keccak/SHA-3 design. Uses 19-word mill and 39-word belt with 32-bit words.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Belt-and-Mill Hash |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2006 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/radiogatun.js`](../../../algorithms/hash/radiogatun.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RadioGatún Official Specification](https://radiogatun.noekeon.org/radiogatun.pdf)
- [RadioGatún Homepage](https://keccak.team/radiogatun.html)

## References

- [RadioGatún official reference code and test vectors](https://radiogatun.noekeon.org/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RadioGatún[32] - Empty string test vector](https://radiogatun.noekeon.org/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `f30028b54afab6b3e55355d277711109a19beda7091067e9a492fb5ed9f20117` |

**Vector 2** — [RadioGatún[32] - Single character "0"](https://github.com/coruus/sphlib/blob/master/src/c/test_radiogatun.c)

| Field | Value |
| --- | --- |
| `input` | `30` |
| `expected` | `af0d3f51b98e90eeebae86dd0b304a4003ac5f755fa2cac2b6866a0a91c5c752` |

**Vector 3** — [RadioGatún[32] - "The quick brown fox jumps over the lazy dog"](https://en.wikipedia.org/wiki/RadioGatún)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `191589005fec1f2a248f96a16e9553bf38d0aee1648ffa036655ce29c2e229ae` |

---

[← All algorithms](../README.md)
