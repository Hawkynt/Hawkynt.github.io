# PPM (Prediction by Partial Matching)

> Order-3 finite-context model with escape method C and full exclusion, driving a Witten-Neal-Cleary arithmetic coder. Each byte is coded from the longest context that predicts it, escaping down to shorter contexts and finally to a uniform order -1 model, so predictable bytes cost a fraction of a bit each.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | John Cleary, Ian Witten |
| Year | 1984 |
| Origin | 🌐 International |
| Source | [`algorithms/compression/ppm.js`](../../../algorithms/compression/ppm.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Cleary and Witten, Data Compression Using Adaptive Coding and Partial String Matching (IEEE Trans. Comm. 32, 1984)](https://ieeexplore.ieee.org/document/1096090)
- [Moffat, Implementing the PPM Data Compression Scheme (IEEE Trans. Comm. 38, 1990)](https://ieeexplore.ieee.org/document/61469)
- [Witten, Neal and Cleary, Arithmetic Coding for Data Compression (CACM 30, 1987)](https://dl.acm.org/doi/10.1145/214762.214771)

## References

- [Text Compression - Bell, Cleary, Witten](https://www.amazon.com/Text-Compression-Timothy-C-Bell/dp/0133616900)
- [PPM - Wikipedia](https://en.wikipedia.org/wiki/Prediction_by_partial_matching)
- [Canterbury Corpus](https://corpus.canterbury.ac.nz/)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - only the 5-byte header (order 3, zero length)](https://ieeexplore.ieee.org/document/1096090)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0300000000` |

**Vector 2** — [Single byte 0x41 - no context exists, so it is coded in the uniform order -1 model](https://dl.acm.org/doi/10.1145/214762.214771)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `03010000004140` |

**Vector 3** — [Two identical bytes - the second escapes the order-1 and order-0 contexts, then costs one bit at order -1](https://ieeexplore.ieee.org/document/61469)

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | `03020000004120` |

**Vector 4** — [Alternating two-byte pattern - the order-2 contexts turn deterministic almost immediately](https://ieeexplore.ieee.org/document/1096090)

| Field | Value |
| --- | --- |
| `input` | `41424142414241424142414241424142` |
| `expected` | `031000000041a0a090` |

**Vector 5** — [Long repetitive run - 64 copies of 0x61 cost a fraction of a bit each](https://ieeexplore.ieee.org/document/1096090)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0340000000610040` |

**Vector 6** — [English text with a repeated sentence - the second copy is nearly free](https://corpus.canterbury.ac.nz/)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20` |
| `expected` | `035a00000074b48df0b3d1cb7eedfab1 dd59c3cd5e412caa40daae22b0623d85 62a01614b461adf95dcdc03520b79753 80000071d0` |

**Vector 7** — [Pseudo-random binary sample - every byte escapes down to the order -1 model](https://ieeexplore.ieee.org/document/61469)

| Field | Value |
| --- | --- |
| `input` | `f3ccbfab9d8fe554efb09bd0b0f5ba948035b768414265947a6b83c1414fe53a` |
| `expected` | `0320000000f3e6d6c69214c6b021d228 a4cca116071313901bfcd274ad71170d f0e246cdbae06a18` |

**Vector 8** — [All 256 byte values 0x00..0xFF - every byte is new, so each costs the full order -1 price](https://ieeexplore.ieee.org/document/1096090)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `03000100000080406050484432251890 4aa6d42a8582e98ad2703c205169752a d58edc7a4426156c16d3e23946bc6d3f a555ecf7b49ac1a9009c5fbae4568e08 c5837e396ae89560bf295b31ebe7f55b 9e75ad26cb8d62c530e298b1acb936bc f3a6b6058524deaa8365cf3e30e6df18 f4306d6b0927a66d6c9ff76af6984a07 cfa179583c251100f367ded7d2cecccc cdd0d4dae2edfb0b1f375477a1d4105a b525b05d3647a163a69a779e87d485dd ffeff456e6bbf9d8b113e6afcb78c340 137df245fff98902ae3b4a64ca371685 4b444d368ceec1ee87b48247dbea55ba 542abd3d9e08219758cd98082cf1c78d 2d6ee4f666d89800` |

---

[← All algorithms](../README.md)
