# BLAKE2xs

> BLAKE2xs is an eXtendable Output Function (XOF) based on BLAKE2s. It supports variable-length output from 1 byte to 2^32 blocks of 32 bytes.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | BLAKE Family |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein |
| Year | 2016 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/hash/blake2.js`](../../../algorithms/hash/blake2.js) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [BLAKE2X Specification](https://blake2.net/blake2x.pdf)
- [BLAKE2 Official Specification](https://blake2.net/blake2.pdf)
- [BLAKE2 Reference Implementation](https://github.com/BLAKE2/BLAKE2)

## References

- [BouncyCastle BLAKE2xs Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/Blake2xsDigest.java)
- [BLAKE2 Test Vectors](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BLAKE2xs XOF - 256 byte input, 1 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `1` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `99` |

**Vector 2** — [BLAKE2xs XOF - 256 byte input, 2 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `2` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `57d5` |

**Vector 3** — [BLAKE2xs XOF - 256 byte input, 3 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `3` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `72d07f` |

**Vector 4** — [BLAKE2xs XOF - 256 byte input, 4 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `4` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `bdf28396` |

**Vector 5** — [BLAKE2xs XOF - 256 byte input, 5 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `5` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `20e81fc0f3` |

**Vector 6** — [BLAKE2xs XOF - 256 byte input, 16 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `541e57a4988909ea2f81953f6ca1cb75` |

**Vector 7** — [BLAKE2xs XOF - 256 byte input, 32 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `91cab802b466092897c7639a02acf529ca61864e5e8c8e422b3a9381a95154d1` |

**Vector 8** — [BLAKE2xs XOF - 256 byte input, 64 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `57aa5c761e7cfa573c48785109ad7644 5441de0ee0f9fe9dd4abb920b7cb5f60 8fc9a029f85ec478a130f194372b6112 f5f2d10408e0d23f696cc9e313b7f1d3` |

**Vector 9** — [BLAKE2xs XOF - 256 byte input, 128 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `128` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `4d1f33edc0d969128edb16e0756c5b1e f45caa7c23a2f3724dab70c8d068cfbf c4ee15ca2fa799b1eb286c2298036fae c73d3cac41b950083e17ef20ddff9d55 aa8b4d0365c6dd38d5ddea19ebfa2cb0 09dd5961320c547af20f96044f7a82a0 919126466bad6f88f49b0342fd40f5c7 b85206e77d26256c8b7ff4fedf36119b` |

**Vector 10** — [BLAKE2xs XOF - 256 byte input, 256 byte output](https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json)

| Field | Value |
| --- | --- |
| `outputSize` | `256` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `d4a23a17b657fa3ddc2df61eefce362f 048b9dd156809062997ab9d5b1fb26b8 542b1a638f517fcbad72a6fb23de0754 db7bb488b75c12ac826dcced9806d787 3e6b31922097ef7b42506275ccc54caf 86918f9d1c6cdb9bad2bacf123c0380b 2e5dc3e98de83a159ee9e10a8444832c 371e5b72039b31c38621261aa04d8271 598b17dba0d28c20d1858d879038485a b069bdb58733b5495f934889658ae81b 7536bcf601cfcc572060863c1ff2202d 2ea84c800482dbe777335002204b7c1f 70133e4d8a6b7516c66bb433ad31030a 7a9a9a6b9ea69890aa40662d908a5acf e8328802595f0284c51a000ce274a985 823de9ee74250063a879a3787fca23a6` |

---

[← All algorithms](../README.md)
