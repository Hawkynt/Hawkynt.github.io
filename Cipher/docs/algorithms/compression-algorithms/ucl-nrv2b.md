# UCL (NRV2B)

> Universal Compression Library implementing NRV2B algorithm. LZ77-based compression with a bit-packed 32-bit little-endian stream, offering better compression than LZO while maintaining fast decompression speed. Used extensively in UPX executable packer.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Markus F.X.J. Oberhumer |
| Year | 2004 |
| Origin | Not specified |
| Source | [`algorithms/compression/ucl.js`](../../../algorithms/compression/ucl.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official UCL Homepage](http://www.oberhumer.com/opensource/ucl/)
- [UCL Wikipedia](https://en.wikipedia.org/wiki/UCL_(data_compression_software))
- [UPX Homepage](https://upx.github.io/)

## References

- [UCL Source Code Repository](https://github.com/korczis/ucl)
- [NRV2B Decompression Implementation](https://github.com/korczis/ucl/blob/master/src/n2b_d.c)
- [UPX Source Code](https://github.com/upx/upx)
- [Educational NRV Implementation](https://github.com/pts/pts-decompress-nrv)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/korczis/ucl)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 'A'](https://github.com/korczis/ucl/blob/master/src/n2b_d.c)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Hello World](http://www.oberhumer.com/opensource/ucl/)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | _(empty)_ |

**Vector 4** — [Repeated pattern AAABBBCCC](https://github.com/korczis/ucl)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `414141424242434343` |
| `expected` | _(empty)_ |

**Vector 5** — [Lorem ipsum text](http://www.oberhumer.com/opensource/ucl/)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `4c6f72656d20697073756d20646f6c6f722073697420616d6574` |
| `expected` | _(empty)_ |

**Vector 6** — [Large repetitive block (1200x 'A') - regression for match-length overflow](https://github.com/korczis/ucl)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 …` (1200 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
