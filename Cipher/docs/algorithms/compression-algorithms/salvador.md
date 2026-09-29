# Salvador

> Emmanuel Marty's high-speed optimal parser for the ZX0 compressed format. Shares ZX0's three-block LZ77 grammar (literal, last-offset match, new-offset match) and bit packing, but XORs the offset-MSB Elias-gamma's data bits with 1.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Emmanuel Marty |
| Year | 2021 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/compression/salvador.js`](../../../algorithms/compression/salvador.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Salvador repository](https://github.com/emmanuel-marty/salvador)
- [ZX0 official repository (shared block grammar)](https://github.com/einar-saukas/ZX0)

## References

- [Reference encoder (shrink.c)](https://raw.githubusercontent.com/emmanuel-marty/salvador/master/src/shrink.c)
- [Reference decoder (expand.c)](https://raw.githubusercontent.com/emmanuel-marty/salvador/master/src/expand.c)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/emmanuel-marty/salvador)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Highly repetitive input (64 'A' bytes)](https://github.com/emmanuel-marty/salvador)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141` |
| `expected` | _(empty)_ |

**Vector 3** — [Text sample](https://github.com/emmanuel-marty/salvador)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 2e` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text beyond a single maximum-length match (90 KB)](https://github.com/emmanuel-marty/salvador)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 …` (90000 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
