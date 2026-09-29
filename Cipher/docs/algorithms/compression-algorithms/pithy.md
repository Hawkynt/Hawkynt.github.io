# Pithy

> Fast LZ77-based compression library by John Engelhart, inspired by Google's Snappy but with incompatible format. Uses hash-based match finding with 4-byte minimum matches. Achieves compression speeds of 100-700 MB/s and decompression speeds over 1 GB/s.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | LZ77 Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | John Engelhart |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/pithy.js`](../../../algorithms/compression/pithy.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Pithy GitHub Repository](https://github.com/johnezang/pithy)
- [Pithy Source Code](https://github.com/johnezang/pithy/blob/master/pithy.c)
- [Pithy Header File](https://github.com/johnezang/pithy/blob/master/pithy.h)

## References

- [Squash Compression Benchmark - Pithy](https://quixdb.github.io/squash/api/c/md_plugins_pithy_pithy.html)
- [lzbench - Fast Compression Benchmark](https://github.com/inikep/lzbench)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - edge case](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00` |

**Vector 2** — [Single byte 'A' - literal tag with length 1](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010041` |

**Vector 3** — [Three bytes 'abc' - literal tag with length 3](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `0308616263` |

**Vector 4** — [Short text 'Hello' - all literals](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `051048656c6c6f` |

**Vector 5** — [Repeated data 'AAAAAAAAAA' (10 A's) - tests match finding](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | _(empty)_ |

**Vector 6** — [Pattern 'abcdefabcdef' - tests longer matches](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `616263646566616263646566` |
| `expected` | _(empty)_ |

**Vector 7** — [Mixed data with repetition - real-world test](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20546865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e` |
| `expected` | _(empty)_ |

**Vector 8** — [Long literal sequence (65 bytes) - extended length encoding](https://github.com/johnezang/pithy/blob/master/pithy.c)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 40` |
| `expected` | `41f040000102030405060708090a0b0c 0d0e0f101112131415161718191a1b1c 1d1e1f202122232425262728292a2b2c 2d2e2f303132333435363738393a3b3c 3d3e3f40` |

---

[← All algorithms](../README.md)
