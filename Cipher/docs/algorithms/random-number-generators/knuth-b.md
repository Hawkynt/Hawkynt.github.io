# Knuth-B

> Algorithm B from Knuth's The Art of Computer Programming, Volume 2. Implements a shuffle algorithm that wraps the minstd_rand0 linear congruential generator with a 256-entry table to improve randomness by breaking sequential correlations. Used in C++ standard library as shuffle_order_engine&lt;minstd_rand0, 256>.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Shuffle Algorithm |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Donald Knuth |
| Year | 1969 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/knuth-b.js`](../../../algorithms/random/knuth-b.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Knuth: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms), Section 3.2.2](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [C++ Reference: std::shuffle_order_engine](https://en.cppreference.com/w/cpp/numeric/random/shuffle_order_engine)
- [C++ Reference: std::knuth_b](https://en.cppreference.com/w/cpp/numeric/random/knuth_b)

## References

- [The Art of Computer Programming, Volume 2 (3rd Edition, 1997)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [C++ Standard Library Implementation (libstdc++)](https://gcc.gnu.org/onlinedocs/libstdc++/manual/numerics.html#std.numerics.random)
- [Park and Miller: Random Number Generators: Good Ones Are Hard to Find](https://doi.org/10.1145/63039.63042)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [C++ std::knuth_b with seed=1, first 10 values](https://en.cppreference.com/w/cpp/numeric/random/knuth_b)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `09189c643113c3982278fd06795056c4 3bd814d710b1d72c061351336a5d128c 38532fd146fc9a81` |

**Vector 2** — [C++ std::knuth_b canonical test: 10,000th value from seed=1 = 1112339016](https://en.cppreference.com/w/cpp/numeric/random/knuth_b)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `count` | `10000` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `424cf248` |

**Vector 3** — [C++ std::knuth_b with seed=123456789, first 5 values](https://en.cppreference.com/w/cpp/numeric/random/knuth_b)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `704f3a22744474f72de9c635557bd4a46c9e4484` |

---

[← All algorithms](../README.md)
