# Yarrow-256

> Yarrow-256 is a cryptographically secure pseudo-random number generator (CSPRNG) designed by Kelsey, Schneier, and Ferguson. Features dual entropy pools and periodic reseeding for forward security.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | CSPRNG |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | John Kelsey, Bruce Schneier, Niels Ferguson |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/yarrow.js`](../../../algorithms/random/yarrow.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 1048576 bytes (8388608 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | No |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Entropy estimation | Like all PRNGs, security depends on quality entropy sources. Poor entropy estimation can lead to predictable output. | Use high-quality system entropy sources and conservative entropy estimates. |
| State compromise extension | If internal state is compromised, past outputs remain vulnerable without explicit state clearing. | Use forward-secure variants or periodic state regeneration for high-security applications. |

## Documentation

- [Yarrow-160 Paper](https://www.schneier.com/academic/paperfiles/paper-yarrow.pdf)
- [GNU Nettle Implementation](https://git.lysator.liu.se/nettle/nettle/-/blob/master/yarrow256.c)
- [Yarrow Overview](https://en.wikipedia.org/wiki/Yarrow_algorithm)

## References

- [LibTomCrypt Implementation](https://github.com/libtom/libtomcrypt/blob/develop/src/prngs/yarrow.c)
- [Fortuna (Yarrow successor)](https://www.schneier.com/academic/fortuna/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Yarrow-256 Deterministic Output Test](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/yarrow-test.c)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `ad94861b10b192dda1193169830a30e23bff2bb109ccdf30ce2f84b8c65cdc10` |

---

[← All algorithms](../README.md)
