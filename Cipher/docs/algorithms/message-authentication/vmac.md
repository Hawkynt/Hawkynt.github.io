# VMAC

> Very high-speed message authentication code using universal hashing and AES-based key derivation. Designed for high performance with formal security proofs.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Universal Hashing MAC |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Ted Krovetz, Wei Dai |
| Year | 2007 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/vmac.js`](../../../algorithms/mac/vmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| MAC sizes | 8 bytes (64 bits) to 16 bytes (128 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse | Using the same nonce with the same key completely breaks security | — |
| Side-Channel Attacks | Implementation must use constant-time operations to prevent timing attacks | — |

## Documentation

- [VMAC Draft Specification](https://tools.ietf.org/html/draft-krovetz-vmac-01)
- [Fastcrypto VMAC Page](https://www.fastcrypto.org/vmac/)
- [Message Authentication on 64-bit Architectures (Krovetz, FSE 2006)](http://krovetz.net/csus/papers/vmac.pdf)

## References

- [Crypto++ VMAC Implementation](https://github.com/weidai11/cryptopp/blob/master/vmac.cpp)
- [Ted Krovetz's Reference Code](https://www.fastcrypto.org/vmac/vmac.c)
- [VMAC Test Vectors](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

## Test vectors

16 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [VMAC(AES)-64: Empty message](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | _(empty)_ |
| `expected` | `2576be1c56d8b81b` |

**Vector 2** — [VMAC(AES)-64: 'abc'](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `616263` |
| `expected` | `2d376cf5b1813ce5` |

**Vector 3** — [VMAC(AES)-64: 16 x 'abc'](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263` |
| `expected` | `e8421f61d573d298` |

**Vector 4** — [VMAC(AES)-128: Empty message](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | _(empty)_ |
| `expected` | `472766c70f74ed23481d6d7de4e80dac` |

**Vector 5** — [VMAC(AES)-128: 'abc'](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `616263` |
| `expected` | `4ee815a06a1d71edd36fc75d51188a42` |

**Vector 6** — [VMAC(AES)-128: 16 x 'abc'](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263` |
| `expected` | `09f2c80c8e1007a0c12fae19fe4504ae` |

**Vector 7** — [VMAC(AES)-64: 42 x 'abc' + 'ab' (128 bytes, exactly one L1 segment)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162` |
| `expected` | `d638b73921f184de` |

**Vector 8** — [VMAC(AES)-128: 42 x 'abc' + 'ab' (128 bytes, exactly one L1 segment)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162` |
| `expected` | `f7e95fe3da8db9e6bb973e65d0b4cea5` |

**Vector 9** — [VMAC(AES)-64: 129 x 'a' (one byte past the L1 segment)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61` |
| `expected` | `86348387d13d8233` |

**Vector 10** — [VMAC(AES)-128: 129 x 'a' (one byte past the L1 segment)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61` |
| `expected` | `a7e52c3289d9b73b53576f059585ee79` |

**Vector 11** — [VMAC(AES)-64: 65 x 'abc' (195 bytes, two L1 segments)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 616263` |
| `expected` | `e86a86ec77a8bf61` |

**Vector 12** — [VMAC(AES)-128: 65 x 'abc' (195 bytes, two L1 segments)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 616263` |
| `expected` | `0a1b2f973044f469f405917e45010334` |

**Vector 13** — [VMAC(AES)-64: 100 x 'abc' (300 bytes, three L1 segments)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 …` (300 bytes; the full value is in the source) |
| `expected` | `4492df6c5cac1bbe` |

**Vector 14** — [VMAC(AES)-128: 100 x 'abc' (300 bytes, three L1 segments)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 …` (300 bytes; the full value is in the source) |
| `expected` | `66438817154850c61d8a412164803bcb` |

**Vector 15** — [VMAC(AES)-64: 170 x 'abc' + 'ab' (512 bytes, exactly four L1 segments)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `8` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 …` (512 bytes; the full value is in the source) |
| `expected` | `9da310281e6fd0a0` |

**Vector 16** — [VMAC(AES)-128: 170 x 'abc' + 'ab' (512 bytes, exactly four L1 segments)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/vmac.txt)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f70` |
| `nonce` | `6263646566676869` |
| `outputSize` | `16` |
| `input` | `61626361626361626361626361626361 62636162636162636162636162636162 63616263616263616263616263616263 61626361626361626361626361626361 …` (512 bytes; the full value is in the source) |
| `expected` | `bf53b8d2d70c05a85880c2e21caf1299` |

---

[← All algorithms](../README.md)
