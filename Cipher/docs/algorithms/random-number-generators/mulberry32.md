# Mulberry32

> Mulberry32 is an extremely simple and fast 32-bit PRNG with single 32-bit state, designed by Tommy Ettinger. It uses a Weyl sequence combined with MurmurHash3-style mixing to produce high-quality output despite minimal state. Very fast but not equidistributed.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Tommy Ettinger |
| Year | 2017 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/mulberry32.js`](../../../algorithms/random/mulberry32.js) |

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

- [Original Discussion: Mulberry32 PRNG (Tommy Ettinger, 2017)](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c)
- [JavaScript PRNGs Collection (bryc)](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
- [Mulberry32 Implementation (cprosche)](https://github.com/cprosche/mulberry32)
- [StackOverflow: Looking for 32-bit PRNG](https://stackoverflow.com/questions/17035441/looking-for-decent-quality-prng-with-only-32-bits-of-state)

## References

- [Author's Note: Not Equidistributed](https://github.com/bryc/code/discussions/21)
- [gjrand Statistical Testing](http://gjrand.sourceforge.net/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First 5 outputs (20 bytes) - verified against reference implementation](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `4434b46200159c3739285b08256d810477a2cbd4` |

**Vector 2** — [Seed 1: First 5 outputs (20 bytes) - single-bit seed difference](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `a087eaf300b349c98706c4ebfb2627fdf7e79d2b` |

**Vector 3** — [Seed 42: First 8 outputs (32 bytes) - commonly used test seed](https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript)

| Field | Value |
| --- | --- |
| `seed` | `0000002a` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `99e1ef7c72c32b8ada3b32c0ab73b0ad2cc09a8a86cec4d345f245149fef4401` |

**Vector 4** — [Seed 12345: First 5 outputs (20 bytes) - larger seed value](https://github.com/cprosche/mulberry32)

| Field | Value |
| --- | --- |
| `seed` | `00003039` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `facf78c54e8751007bf4e2f2d16426508269e5ca` |

**Vector 5** — [Seed 0xFFFFFFFF (max 32-bit): First 5 outputs (20 bytes) - edge case](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c)

| Field | Value |
| --- | --- |
| `seed` | `ffffffff` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `e57bf3d33081a5a4b7350390f1ade904d8616a2f` |

---

[← All algorithms](../README.md)
