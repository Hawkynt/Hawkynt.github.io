# Snappy

> Fast LZ77-based compression algorithm developed by Google in 2011. Optimizes for speed over compression ratio with typical compression speeds of 250-500 MB/s and decompression speeds over 1 GB/s. Uses byte-oriented encoding without entropy coding.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | LZ77 Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Google (Jeff Dean, Steinar H. Gunderson) |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/snappy.js`](../../../algorithms/compression/snappy.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Snappy GitHub Repository](https://github.com/google/snappy)
- [Snappy Format Description](https://github.com/google/snappy/blob/main/format_description.txt)
- [Snappy Framing Format](https://github.com/google/snappy/blob/main/framing_format.txt)

## References

- [Wikipedia - Snappy](https://en.wikipedia.org/wiki/Snappy_(compression))
- [Google Official Page](http://google.github.io/snappy/)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - edge case](https://github.com/google/snappy/blob/main/format_description.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00` |

**Vector 2** — [Single byte 'A' - literal tag 0x00, length 1](https://github.com/google/snappy/blob/main/format_description.txt)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010041` |

**Vector 3** — [Two bytes 'AB' - literal tag, length 2](https://github.com/google/snappy/blob/main/format_description.txt)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `02044142` |

**Vector 4** — [Three bytes 'abc' - literal tag, length 3](https://github.com/google/snappy/blob/main/format_description.txt)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `0308616263` |

**Vector 5** — [Repeated pattern 'AAAAAAAA' - literal + copy1 encoding](https://github.com/google/snappy/blob/main/snappy_unittest.cc)

| Field | Value |
| --- | --- |
| `input` | `4141414141414141` |
| `expected` | `0800410d01` |

**Vector 6** — [Pattern 'abcabcabc' - literal + copy1 with offset 3](https://github.com/golang/snappy/blob/master/snappy_test.go)

| Field | Value |
| --- | --- |
| `input` | `616263616263616263` |
| `expected` | `09086162630903` |

**Vector 7** — [Short text 'blah blah blah' - copy1 encoding](https://github.com/google/snappy/blob/main/format_description.txt)

| Field | Value |
| --- | --- |
| `input` | `626c616820626c616820626c6168` |
| `expected` | `0e10626c6168201505` |

**Vector 8** — [Text sample with real copy matches - 'the quick brown fox...' x4](https://github.com/google/snappy/blob/main/format_description.txt)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4017874686520717569636b2062726f 776e20666f78206a756d7073206f7665 7220011f206c617a7920646f672e050e fe2d00fe2d0008672e20` |

---

[← All algorithms](../README.md)
