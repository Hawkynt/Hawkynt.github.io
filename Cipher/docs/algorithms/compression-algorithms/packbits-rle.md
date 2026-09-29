# PackBits RLE

> Classic run-length encoding algorithm used in TIFF images, PostScript, and early Apple computer systems. Simple but effective for data with runs of identical bytes.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Run-Length Encoding |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Apple Computer |
| Year | 1984 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/packbits.js`](../../../algorithms/compression/packbits.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [PackBits Wikipedia](https://en.wikipedia.org/wiki/PackBits)
- [TIFF Specification](https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf)

## References

- [Apple Technical Note TN1023](http://developer.apple.com/technotes/tn/tn1023.html)
- [PostScript Language Reference](https://www.adobe.com/products/postscript/pdfs/PLRM.pdf)
- [TIFF 6.0 Specification](https://partners.adobe.com/public/developer/en/tiff/TIFF6.pdf)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/PackBits)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single byte literal](https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0041` |

**Vector 3** — [Simple run of 3 identical bytes](http://developer.apple.com/technotes/tn/tn1023.html)

| Field | Value |
| --- | --- |
| `input` | `414141` |
| `expected` | `fe41` |

**Vector 4** — [Three different literals](https://www.adobe.com/products/postscript/pdfs/PLRM.pdf)

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | `02414243` |

**Vector 5** — [Run followed by literals](https://partners.adobe.com/public/developer/en/tiff/TIFF6.pdf)

| Field | Value |
| --- | --- |
| `input` | `41414141424344` |
| `expected` | `fd4102424344` |

**Vector 6** — [Literals followed by run](https://en.wikipedia.org/wiki/PackBits)

| Field | Value |
| --- | --- |
| `input` | `41424344444444` |
| `expected` | `02414243fd44` |

**Vector 7** — [Maximum run length (128 bytes)](https://www.itu.int/itudoc/itu-t/com16/tiff-fx/docs/tiff6.pdf)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141` |
| `expected` | `8141` |

**Vector 8** — [Maximum literal sequence (128 bytes)](http://developer.apple.com/technotes/tn/tn1023.html)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `expected` | `7f000102030405060708090a0b0c0d0e 0f101112131415161718191a1b1c1d1e 1f202122232425262728292a2b2c2d2e 2f303132333435363738393a3b3c3d3e 3f404142434445464748494a4b4c4d4e 4f505152535455565758595a5b5c5d5e 5f606162636465666768696a6b6c6d6e 6f707172737475767778797a7b7c7d7e 7f` |

---

[← All algorithms](../README.md)
