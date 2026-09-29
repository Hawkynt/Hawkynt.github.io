# 3DES (Triple DES)

> Triple Data Encryption Standard applies DES encryption three times in EDE mode. Supports both EDE2 (112-bit effective security) and EDE3 (168-bit key) modes. Deprecated by NIST in 2019.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | IBM (based on DES) |
| Year | 1978 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/3des.js`](../../../algorithms/block/3des.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 24 bytes (192 bits) in steps of 8 bytes |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Meet-in-the-middle attack | Effective security reduced to 112 bits instead of theoretical 168 bits | Use AES-128 or higher for new applications |
| Small block size | 64-bit block size vulnerable to birthday attacks | Avoid encrypting large amounts of data with single key |

## Documentation

- [NIST SP 800-67 Rev 2 - Triple DES Guidelines](https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final)
- [FIPS 46-3 - Data Encryption Standard](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)
- [Wikipedia - Triple DES](https://en.wikipedia.org/wiki/Triple_DES)

## References

- [OpenSSL 3DES Implementation](https://github.com/openssl/openssl/blob/master/crypto/des/)
- [NIST CAVP 3DES Test Vectors](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers)
- [Crypto++ 3DES Implementation](https://github.com/weidai11/cryptopp/blob/master/3des.cpp)
- [libgcrypt 3DES Implementation](https://github.com/gpg/libgcrypt/blob/master/cipher/des.c)
- [Bouncy Castle 3DES Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)
- [Microsoft .NET 3DES Implementation](https://docs.microsoft.com/en-us/dotnet/api/system.security.cryptography.tripledes)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt DES-EDE vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `8ca64de9c1b123a7` |

**Vector 2** — [DarkCrypt DES-EDE vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `0001020304050607` |
| `expected` | `58ed248f77f6b19e` |

**Vector 3** — [DarkCrypt DES-EDE vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718` |
| `input` | `1011121314151617` |
| `expected` | `bcbdf997a68ca618` |

**Vector 4** — [3DES EDE2 mode - educational test vector](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef23456789abcdef01` |
| `input` | `0123456789abcdef` |
| `expected` | `a6bb373e196b375e` |

**Vector 5** — [3DES EDE3 mode - educational test vector](https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef23456789abcdef01456789abcdef0123` |
| `input` | `0123456789abcdef` |
| `expected` | `f2afd84ee809e2b5` |

**Vector 6** — [3DES EDE2 mode - all zeros plaintext](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers)

| Field | Value |
| --- | --- |
| `key` | `01010101010101010101010101010101` |
| `input` | `0000000000000000` |
| `expected` | `8ca64de9c1b123a7` |

**Vector 7** — [3DES EDE2 mode - FIPS 46-3 test vector](https://csrc.nist.gov/publications/detail/fips/46/3/archive/1999-10-25)

| Field | Value |
| --- | --- |
| `KeySize` | `16` |
| `key` | `0123456789abcdef23456789abcdef01` |
| `input` | `0123456789abcdef` |
| `expected` | `a6bb373e196b375e` |

**Vector 8** — [3DES EDE3 mode - three distinct keys](https://csrc.nist.gov/publications/detail/sp/800-67/rev-2/final)

| Field | Value |
| --- | --- |
| `KeySize` | `24` |
| `key` | `0123456789abcdef23456789abcdef01456789abcdef0123` |
| `input` | `0123456789abcdef` |
| `expected` | `f2afd84ee809e2b5` |

---

[← All algorithms](../README.md)
