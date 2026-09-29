# LZJB

> Fast lossless compression algorithm designed for ZFS filesystem. Simple LZ77 variant with fixed 1024-byte sliding window and 3-byte minimum match. Optimized for speed over compression ratio.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Jeff Bonwick |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzjb.js`](../../../algorithms/compression/lzjb.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [ZFS Documentation](https://docs.oracle.com/cd/E19253-01/819-5461/gbchx/index.html)
- [LZJB Wikipedia](https://en.wikipedia.org/wiki/LZJB)
- [ZFS Compression Overview](https://www.brendangregg.com/blog/2008-11-19/zfs-compression.html)

## References

- [FreeBSD LZJB Implementation](https://people.freebsd.org/~gibbs/zfs_doxygenation/html/df/d48/lzjb_8c.html)
- [Portable LZJB (nemequ)](https://github.com/nemequ/lzjb)
- [illumos-gate Repository](https://github.com/illumos/illumos-gate)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [All literals - no compression (ABCD)](https://github.com/nemequ/lzjb/blob/master/lzjb.c)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000000041424344` |

**Vector 2** — [Simple repetition - AAAA (4 A's)](https://github.com/nemequ/lzjb/blob/master/lzjb.c)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `0400000002414000` |

**Vector 3** — [Pattern ABCABC (6 bytes with match)](https://github.com/nemequ/lzjb/blob/master/lzjb.c)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `0600000008414243c000` |

**Vector 4** — [Long repetition - AAAAAAAA (8 A's)](https://github.com/nemequ/lzjb/blob/master/lzjb.c)

| Field | Value |
| --- | --- |
| `input` | `4141414141414141` |
| `expected` | `0800000002414400` |

**Vector 5** — [Mixed pattern - Hello](https://github.com/nemequ/lzjb/blob/master/lzjb.c)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `050000000048656c6c6f` |

**Vector 6** — [Repetitive data showing compression (ABABABABAB)](https://github.com/nemequ/lzjb/blob/master/lzjb.c)

| Field | Value |
| --- | --- |
| `input` | `41424142414241424142` |
| `expected` | `0a0000000441428500` |

---

[← All algorithms](../README.md)
