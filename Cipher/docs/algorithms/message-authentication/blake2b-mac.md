# BLAKE2b-MAC

> BLAKE2b in keyed hash mode for message authentication. Natively supports keying with variable-length MAC output (1-64 bytes). Faster than HMAC-SHA while providing strong authentication.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Keyed Hash MAC |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein |
| Year | 2012 |
| Origin | Not specified |
| Source | [`algorithms/mac/blake2bmac.js`](../../../algorithms/mac/blake2bmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 64 bytes (512 bits) |
| Output sizes | 1 byte (8 bits) to 64 bytes (512 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [BLAKE2 Specification](https://www.blake2.net/blake2.pdf)
- [RFC 7693 - The BLAKE2 Cryptographic Hash and MAC](https://tools.ietf.org/rfc/rfc7693.txt)
- [BLAKE2 Official Website](https://www.blake2.net/)

## References

- [BLAKE2 Reference Implementation](https://github.com/BLAKE2/BLAKE2)
- [Botan BLAKE2b Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BLAKE2b-MAC Test Vector - 8-bit output (1 byte)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `1` |
| `input` | `53616d706c6520696e70757420666f72 206f75746c656e3c6469676573745f6c 656e677468` |
| `expected` | `2a` |

**Vector 2** — [BLAKE2b-MAC Test Vector - 224-bit output (28 bytes), empty input](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `outputSize` | `28` |
| `input` | _(empty)_ |
| `expected` | `a43d14369294a04b9cd6c6d358c8e663654c4b246c47cfe6373f7788` |

**Vector 3** — [BLAKE2b-MAC Test Vector - 256-bit output (32 bytes), empty input](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `2fa9fbd9be36437de204e139e97d402bce68c828f43391608c891b5faed8a98a` |

**Vector 4** — [BLAKE2b-MAC Test Vector - 256-bit output, 1-byte input](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `outputSize` | `32` |
| `input` | `00` |
| `expected` | `34758b647135628297fb09c7930cd04e9528e5669112f5b1318493e14de77e55` |

**Vector 5** — [BLAKE2b-MAC Test Vector - 256-bit output, single-byte key](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `42` |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `2e84dba25f0ee9527950699ff1fdfc9d8983a9b6a4d5fab5be351a178a2c7f7d` |

**Vector 6** — [BLAKE2b-MAC Test Vector - 512-bit output, 127-byte input (one under a block)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e` |
| `expected` | `76d2d819c92bce55fa8e092ab1bf9b9e ab237a25267986cacf2b8ee14d214d73 0dc9a5aa2d7b596e86a1fd8fa0804c77 402d2fcd45083688b218b1cdfa0dcbcb` |

**Vector 7** — [BLAKE2b-MAC Test Vector - 512-bit output, 128-byte input (exactly one block)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `expected` | `72065ee4dd91c2d8509fa1fc28a37c7f c9fa7d5b3f8ad3d0d7a25626b57b1b44 788d4caf806290425f9890a3a2a35a90 5ab4b37acfd0da6e4517b2525c9651e4` |

**Vector 8** — [BLAKE2b-MAC Test Vector - 512-bit output, 129-byte input (one over a block)](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `outputSize` | `64` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 80` |
| `expected` | `64475dfe7600d7171bea0b394e27c9b0 0d8e74dd1e416a79473682ad3dfdbb70 6631558055cfc8a40e07bd015a4540dc dea15883cbbf31412df1de1cd4152b91` |

**Vector 9** — [BLAKE2b-MAC Test Vector - 384-bit output, 256-byte input, single-byte key](https://github.com/randombit/botan/blob/master/src/tests/data/mac/blake2bmac.vec)

| Field | Value |
| --- | --- |
| `key` | `42` |
| `outputSize` | `48` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `2214f4b04ca8b57da75c04ebd88d0471 c73cc76e8b2036409dd060c6e30b6e50 f5aff5c63be3846a931b12d61827ba36` |

---

[← All algorithms](../README.md)
