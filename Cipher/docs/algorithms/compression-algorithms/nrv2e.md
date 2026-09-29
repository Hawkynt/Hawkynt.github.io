# NRV2E

> UCL library "Not Really Vanished" LZ77 variant 2E. Bit-tagged literal/match stream with an exponential-Golomb offset (with single-symbol repeat-offset shortcut) whose match-length code is cheapest when the offset repeats the previous match, used inside the UPX executable packer.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Markus F.X.J. Oberhumer |
| Year | 1999 |
| Origin | Not specified |
| Source | [`algorithms/compression/nrv2e.js`](../../../algorithms/compression/nrv2e.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official UCL Homepage](http://www.oberhumer.com/opensource/ucl/)
- [UCL Wikipedia](https://en.wikipedia.org/wiki/UCL_(data_compression_software))

## References

- [UCL Source Code Repository](https://github.com/korczis/ucl)
- [NRV2E Decompressor (structure reference only)](https://github.com/korczis/ucl/blob/master/src/n2e_d.c)
- [UPX Homepage](https://upx.github.io/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](http://www.oberhumer.com/opensource/ucl/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Highly repetitive input (64 'A' bytes)](http://www.oberhumer.com/opensource/ucl/)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141` |
| `expected` | `40000000000016b54101` |

**Vector 3** — [Text sample](http://www.oberhumer.com/opensource/ucl/)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 2e` |
| `expected` | `41000000feffffff7468652071756963 6b2062726f776e20666f78206a756d70 73206f76657220b8d8fbef3d6c617a79 20646f672e1b592e` |

---

[← All algorithms](../README.md)
