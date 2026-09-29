# KangarooTwelve

> Fast hashing based on Keccak-p[1600,12] with tree structure for parallel processing. NIST Lightweight Cryptography submission offering high performance and variable output length.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Extendable-Output Function (XOF) |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer |
| Year | 2016 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/kangaroo.js`](../../../algorithms/hash/kangaroo.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Digest sizes | 1 byte (8 bits) to 8192 bytes (65536 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 9861: KangarooTwelve and TurboSHAKE](https://www.rfc-editor.org/rfc/rfc9861)
- [Official Website](https://keccak.team/kangarootwelve.html)

## References

- [XKCP (eXtended Keccak Code Package) - Reference Implementation](https://github.com/XKCP/XKCP)

## Test vectors

21 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KangarooTwelve Test Vector #1 - Empty input (32 bytes)](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `1ac2d450fc3b4205d19da7bfca1b37513c0803577ac7167f06fe2ce1f0ef39e5` |

**Vector 2** — [KangarooTwelve Test Vector #2 - Empty input (64 bytes)](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | _(empty)_ |
| `expected` | `1ac2d450fc3b4205d19da7bfca1b3751 3c0803577ac7167f06fe2ce1f0ef39e5 4269c056b8c82e48276038b6d292966c c07a3d4645272e31ff38508139eb0a71` |

**Vector 3** — [KangarooTwelve Test Vector #4 - 1 byte pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `00` |
| `expected` | `2bda92450e8b147f8a7cb629e784a058efca7cf7d8218e02d345dfaa65244a1f` |

**Vector 4** — [KangarooTwelve Test Vector #5 - 17 bytes pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `6bf75fa2239198db4772e36478f8e19b0f371205f6a9a93a273f51df37122888` |

**Vector 5** — [KangarooTwelve Test Vector #6 - 289 bytes pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (289 bytes; the full value is in the source) |
| `expected` | `0c315ebcdedbf61426de7dcf8fb725d1e74675d7f5327a5067f367b108ecb67c` |

**Vector 6** — [KangarooTwelve Test Vector #7 - 4913 bytes pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (4913 bytes; the full value is in the source) |
| `expected` | `cb552e2ec77d9910701d578b457ddf772c12e322e4ee7fe417f92c758f0d59d0` |

**Vector 7** — [KangarooTwelve Test Vector #8 - 83521 bytes pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (83521 bytes; the full value is in the source) |
| `expected` | `8701045e22205345ff4dda05555cbb5c3af1a771c2b89baef37db43d9998b9fe` |

**Vector 8** — [KangarooTwelve Test Vector #9 - 1419857 bytes pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1419857 bytes; the full value is in the source) |
| `expected` | `844d610933b1b9963cbdeb5ae3b6b05cc7cbd67ceedf883eb678a0a8e0371682` |

**Vector 9** — [KangarooTwelve Test Vector #10 - 24137569 bytes pattern](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (24137569 bytes; the full value is in the source) |
| `expected` | `3c390782a8a4e89fa6367f72feaaf13255c8d95878481d3cd8ce85f58e880af8` |

**Vector 10** — [KangarooTwelve Test Vector #11 - Empty input, 1 byte personalization](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `personalization` | `00` |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `fab658db63e94a246188bf7af69a133045f46ee984c56e3c3328caaf1aa1a583` |

**Vector 11** — [KangarooTwelve Test Vector #12 - 1 byte 0xFF, 41 bytes personalization](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `personalization` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728` |
| `outputSize` | `32` |
| `input` | `ff` |
| `expected` | `d848c5068ced736f4462159b9867fd4c20b808acc3d5bc48e0b06ba0a3762ec4` |

**Vector 12** — [KangarooTwelve Test Vector #13 - 3 bytes 0xFF, 1681 bytes personalization](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `personalization` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (1681 bytes; the full value is in the source) |
| `outputSize` | `32` |
| `input` | `ffffff` |
| `expected` | `c389e5009ae57120854c2e8c64670ac01358cf4c1baf89447a724234dc7ced74` |

**Vector 13** — [KangarooTwelve Test Vector #14 - 7 bytes 0xFF, 68921 bytes personalization](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `personalization` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (68921 bytes; the full value is in the source) |
| `outputSize` | `32` |
| `input` | `ffffffffffffff` |
| `expected` | `75d2f86a2e644566726b4fbcfc5657b9dbcf070c7b0dca06450ab291d7443bcf` |

**Vector 14** — [KangarooTwelve: 8192-byte pattern (last single-node length)](https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (8192 bytes; the full value is in the source) |
| `expected` | `48f256f6772f9edfb6a8b661ec92dc93` |

**Vector 15** — [KangarooTwelve: 8193-byte pattern (first tree-hashed length)](https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (8193 bytes; the full value is in the source) |
| `expected` | `bb66fe72eaea5179418d5295ee134485` |

**Vector 16** — [KangarooTwelve: 16384-byte pattern (two full chunks)](https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (16384 bytes; the full value is in the source) |
| `expected` | `82778f7f7234c83352e76837b721fbdb` |

**Vector 17** — [KangarooTwelve: 16385-byte pattern](https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (16385 bytes; the full value is in the source) |
| `expected` | `5f8d2b943922b451842b4e82740d0236` |

**Vector 18** — [KangarooTwelve: 24576-byte pattern (three full chunks)](https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (24576 bytes; the full value is in the source) |
| `expected` | `f4082a8fe7d1635aa042cd1da63bf235` |

**Vector 19** — [KangarooTwelve: 24577-byte pattern](https://github.com/cloudflare/circl/blob/main/xof/k12/k12_test.go)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (24577 bytes; the full value is in the source) |
| `expected` | `38cb940999aca742d69dd79298c6051c` |

**Vector 20** — [KangarooTwelve: 166-byte pattern (domain separator meets pad10*1)](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5` |
| `expected` | `cbbe9dd1e423f20003fba7bb219491c8d1f445fa5c4199d6c6c70c9fdc101964` |

**Vector 21** — [KangarooTwelve: 334-byte pattern (domain separator meets pad10*1, second block)](https://www.rfc-editor.org/rfc/rfc9861)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (334 bytes; the full value is in the source) |
| `expected` | `ff92c42fdbdcb983d402fdc05f7d6edd1ae0a24aadd145cf129c8e7e7c057b3b` |

---

[← All algorithms](../README.md)
