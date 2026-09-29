# LZRW1

> Extremely fast LZ77-based compression algorithm with hash table dictionary matching. Uses control bytes for 16-item groups to indicate literal or copy items. Designed for real-time compression with minimal overhead.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ross N. Williams |
| Year | 1991 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/compression/lzrw1.js`](../../../algorithms/compression/lzrw1.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZRW1 Paper](http://ross.net/compression/lzrw1.html)
- [Data Compression Conference 1991](https://ieeexplore.ieee.org/xpl/conhome/1000160/all-proceedings)
- [LZRW Wikipedia](https://en.wikipedia.org/wiki/LZRW)

## References

- [Ross Williams Compression](http://ross.net/compression/)
- [LZRW Implementation Analysis](https://www.heliontech.com/comp_info.htm)
- [lzbench LZRW Collection](https://github.com/inikep/lzbench)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [No repetition - all literals](https://github.com/Hawkynt/Cipher)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `04000000000041424344` |

**Vector 2** — [High repetition - 16 identical characters](https://github.com/Hawkynt/Cipher)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141` |
| `expected` | `10000000000241c000` |

**Vector 3** — [Pattern repetition - ABC repeated 4 times](https://github.com/Hawkynt/Cipher)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243414243` |
| `expected` | `0c00000000084142436002` |

**Vector 4** — [Real text compression - English phrase](https://github.com/Hawkynt/Cipher)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20666f78` |
| `expected` | `13000000000054686520717569636b2062726f776e200000666f78` |

---

[← All algorithms](../README.md)
