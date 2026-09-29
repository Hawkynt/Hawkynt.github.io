# LZS

> Stac Lempel-Ziv-Stac compression as specified for PPP by RFC 1974. A continuous MSB-first bit stream mixes 8-bit literals with back-references whose offset is coded as either 7 or 11 bits and whose length uses a nested nibble/escape code, terminated by a fixed 9-bit end marker.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Stac Electronics |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzs.js`](../../../algorithms/compression/lzs.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 1974 - PPP Stac LZS Compression Protocol](https://www.rfc-editor.org/rfc/rfc1974)
- [Lempel-Ziv-Stac (Wikipedia)](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Stac)

## References

- [RFC 1974 text](https://www.ietf.org/rfc/rfc1974.txt)
- [RFC Editor info page](https://www.rfc-editor.org/info/rfc1974)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://www.rfc-editor.org/rfc/rfc1974)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Highly repetitive input (40 'A' bytes)](https://www.rfc-editor.org/rfc/rfc1974)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 4141414141414141` |
| `expected` | `280000002090703ff9e000` |

**Vector 3** — [Text sample](https://www.rfc-editor.org/rfc/rfc1974)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 2e` |
| `expected` | `410000003a1a0ca20389d4d26335880c 472379dcdc20331bcf020351d4da7039 880de76329c8419f8d8613d1e4406437 99c5d8ec35bd0bb000` |

---

[← All algorithms](../README.md)
