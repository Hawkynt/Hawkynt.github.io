# LZFX

> Improved LZF variant with better compression ratios while maintaining high speed. Uses hash-based LZ77 matching with 13-bit offset encoding and simple token format. Designed for applications requiring fast compression with minimal memory overhead.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Andrew Collette |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzfx.js`](../../../algorithms/compression/lzfx.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZFX Original Project](https://code.google.com/archive/p/lzfx/)
- [LZFX GitHub Repository](https://github.com/berkedel/lzfx)
- [LZF Compression Filter for HDF5](http://www.h5py.org/lzf/)
- [pcompress LZFX Implementation](https://github.com/moinakg/pcompress/blob/master/lzfx/lzfx.c)

## References

- [Original LZF by Marc Lehmann](http://oldhome.schmorp.de/marc/liblzf.html)
- [LZ77 Algorithm](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [LZFX Format Specification](https://code.google.com/archive/p/lzfx/wikis/CompressedFormat.wiki)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [All literals - no compression](https://github.com/berkedel/lzfx)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000000341424344` |

**Vector 2** — [Repetition - AAAA](https://github.com/berkedel/lzfx)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `0400000000412000` |

**Vector 3** — [Long repetition - 10 A's](https://github.com/berkedel/lzfx)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `0a0000000041e00000` |

**Vector 4** — [Pattern repetition - ABCABCABC](https://github.com/berkedel/lzfx)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | `09000000024142438002` |

**Vector 5** — [Long text compression](https://github.com/berkedel/lzfx)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64212048656c6c6f20576f726c6421` |
| `expected` | `190000000c48656c6c6f20576f726c642120e0030c` |

**Vector 6** — [Highly repetitive data](https://github.com/berkedel/lzfx)

| Field | Value |
| --- | --- |
| `input` | `42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242` |
| `expected` | `640000000042e05a00` |

---

[← All algorithms](../README.md)
