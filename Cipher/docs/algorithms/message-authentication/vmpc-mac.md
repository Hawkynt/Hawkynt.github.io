# VMPC-MAC

> Message authentication code based on VMPC stream cipher permutation with enhanced state mixing. Uses 32-byte accumulator and four mixing registers for 20-byte MAC output.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Stream Cipher MAC |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Bartosz Zoltak |
| Year | 2004 |
| Origin | Not specified |
| Source | [`algorithms/mac/vmpcmac.js`](../../../algorithms/mac/vmpcmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 768 bytes (6144 bits) |
| Nonce sizes | 1 byte (8 bits) to 768 bytes (6144 bits) |
| MAC sizes | 20 bytes (160 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Cryptanalysis | VMPC-MAC has received less cryptanalytic attention compared to established MACs | Use only after thorough security review for your specific use case |

## Documentation

- [VMPC-MAC Specification](http://www.vmpcfunction.com/vmpc.pdf)
- [BouncyCastle Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/VMPCMac.java)
- [BouncyCastle Test Vectors](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCMacTest.java)

## References

- [BouncyCastle .NET VmpcMac Implementation](https://github.com/bcgit/bc-csharp/blob/master/crypto/src/crypto/macs/VMPCMac.cs)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle Test Vector - MAC of bytes 0x00 to 0xFF](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `9661410ab797d8a9eb767c21172df6c7` |
| `iv` | `4b5c2f003e67f39557a8d26f3da2b155` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `9bda16e2ad0e284774a3acbc8835a8326c11faad` |

---

[← All algorithms](../README.md)
