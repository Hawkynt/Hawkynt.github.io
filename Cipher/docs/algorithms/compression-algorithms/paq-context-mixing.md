# PAQ (Context Mixing)

> Reduced lpaq-style context-mixing primitive: six hashed bit models over byte orders 0, 1, 2, 3, 4 and 6, blended by a single logistic-domain mixer trained by online gradient descent, refined by one adaptive probability map (SSE) keyed on the previous byte, and entropy-coded with a 30-bit binary arithmetic coder. Byte-for-byte identical to CompressionWorkbench's BB_ContextMixing reference block. This is deliberately NOT the full PAQ ensemble - the real PAQ8/cmix model sets add word, sparse, indirect, record and media-specific models behind a much larger mixing network, none of which is implemented here.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Matt Mahoney (context mixing / PAQ family) |
| Year | 2002 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/paq.js`](../../../algorithms/compression/paq.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [PAQ - Wikipedia](https://en.wikipedia.org/wiki/PAQ)
- [Data Compression Explained (context mixing, SSE)](http://mattmahoney.net/dc/dce.html)
- [PAQ Data Compression Programs](https://www.mattmahoney.net/dc/paq.html)

## References

- [Context Mixing - Wikipedia](https://en.wikipedia.org/wiki/Context_mixing)
- [Hutter Prize Competition](http://prize.hutter1.net/)
- [Adaptive Weighing of Context Models (Mahoney, 2005)](https://www.cs.fit.edu/~mmahoney/compression/cs200516.pdf)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header only](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000004180` |

**Vector 3** — [Repeated English pangram (4x)](https://en.wikipedia.org/wiki/Context_mixing)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000746fba2ff6bc8eb814ab0b9e 20c6ccb67bbd62993cf549b066f53fca 1066c11768c6804aeec60b4a3c62` |

**Vector 4** — [256 identical bytes](https://www.mattmahoney.net/dc/paq.html)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000061a9bdf4` |

**Vector 5** — [All 256 byte values in order](https://www.mattmahoney.net/dc/paq.html)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `000100000023548f83aafcd049612c23 52f8e7db2066137c77b4546afe35df5f 629eb0a8b5ab0a6c7f8e874c25e1ffec cbcd7859900afdd89194ab15ee00192d cee052025bbc2a78214b6749aa37ba25 6066e0170d57fb42043e1637a519b8de f70a0268833b6b0662f34d81e2822b1b d4da4e171da20ae235dfe18d7c833f33 a54022db5be2dc44ed5e1f9564a10527 dd6aed4ee432d5351a558e47b92f9452 ba1fd41943348b4d58e538923f8329bd d55ae0735d0f823c967fa26abec72ad0 842d21ab95090142e9a5105d4b4394ea 425f56d5993bafc236d69426f52da539 5c9925f9541f03711b604299cb70792d 6a3bd08c` |

---

[← All algorithms](../README.md)
