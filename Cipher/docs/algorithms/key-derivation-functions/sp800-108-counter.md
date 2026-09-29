# SP800-108-Counter

> NIST SP 800-108 Key Derivation Function in Counter Mode. Uses HMAC with counter-based PRF expansion for deriving cryptographic keys from input key material, following the NIST standardized specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | NIST SP 800-108 Counter Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/sp800-108-counter.js`](../../../algorithms/kdf/sp800-108-counter.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key derivation sizes | 16 bytes (128 bits) to 65535 bytes (524280 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-108 Revision 1 - Recommendation for Key Derivation Using Pseudorandom Functions](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf)
- [RFC 6803 - KBKDF with HMAC](https://tools.ietf.org/rfc/rfc6803.txt)
- [OpenSSL EVP_KDF-KB Documentation](https://www.openssl.org/docs/manmaster/man7/EVP_KDF-KB.html)

## References

- [Botan SP800_108_Counter Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp)
- [PyCryptodome NIST SP 800-108 Test Vectors](https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/SelfTest/Protocol/test_KDF.py)
- [OpenSSL KBKDF Implementation](https://github.com/openssl/openssl/blob/master/crypto/kdf/kbkdf.c)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SP800-108-Counter(HMAC(SHA-1)) - 20 bytes, exactly one PRF block](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `eb5a279f6ac4522804faf25e` |
| `context` | `13e3ea2cf37566a55321c8e6386faac9 3421d614948ebf5bba07649d77a27e16 1021346bac19b3ade49d4250ddeacad9 0e3643389c320305541b5c3cce41dea5 586caceb3d43c43b256da060cb336610 8ab7895c7afda46c68c09d63d49e74ad 74b05d94` |
| `outputLength` | `20` |
| `counterBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `17182760595f697f27e4e64a8e66102ac83a4b11` |
| `expected` | `afa3f9dabb5be44c4d25dd83eb1c0983d89961ca` |

**Vector 2** — [SP800-108-Counter(HMAC(SHA-256)) - 12 bytes, truncated below one PRF block](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `036e2c420a6053e7441595745da71384` |
| `context` | `7ca576af452eb08eccd0bf5a9ce6e5bd` |
| `outputLength` | `12` |
| `counterBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `8a90e91cf6e25ae0f733a0eb186415af49cd7a0d78e1b6d01626b711aab4f12b` |
| `expected` | `69283d6572c9eba192b68279` |

**Vector 3** — [SP800-108-Counter(HMAC(SHA-256)) - 36 bytes, one byte group past the first block](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `a16cc203753424e8b08633fe43d9b0c4` |
| `context` | `54eeac24933ff6829bc37e7b1ed932b9 f050899bb7d0c32615a708ee213d9085 585fb010544fe4d29a8021b39fbb267d` |
| `outputLength` | `36` |
| `counterBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `304932533feea6cc93b9a5b01e362b416f6cf1c3eb8019191cd9f607814b6b71` |
| `expected` | `719a8ae5eb4b1ac325d6e3598080e05c c15aede16f0547de0646e7639c1bf605 ca557969` |

**Vector 4** — [SP800-108-Counter(HMAC(SHA-256)) - 48 bytes, two PRF blocks](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `be7baa20a4fd50eb81d30ce04aa8fbfb` |
| `context` | `ec72d16625fa2404052a5cd44ea924e3 76b53ad759442803809bb2b09e1189d1 6950f654fccf806519aa7113c8a64a4a 89f470d92a9b0477fe0b0b5549294060` |
| `outputLength` | `48` |
| `counterBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `4b7ef2ca535af6b75b9cbf60a0d61a92af7edad9d568688fd9cde1c0c95f3e33` |
| `expected` | `caebdad694080005aff424e983bad862 f4f7efec50102381cd25509fabc487a3 6509dabc6760088a7d33e7a37be94791` |

**Vector 5** — [SP800-108-Counter(HMAC(SHA-512)) - 20 bytes, heavy truncation of a 64 byte block](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `196636113098b35c35406bb4` |
| `context` | `17e42893512c6df7747906508ad41396 096a13b7d9aa87c4f7fabcbd97951658 23a1b54819eb190691c96bad55ad233a 85f3c554c3e9b2d9b588a9f0da09df0d 83d6141b83f5a62190fd16aa20b15552 c3417c96b931e7eb55e06cd57406d5ab 79fe12a7` |
| `outputLength` | `20` |
| `counterBits` | `32` |
| `hashAlgorithm` | SHA-512 |
| `input` | `bffa0f4267d5f24f219151cb38c581c0 d1cff8efe475d7c38a47726b226df36e 47e1a579993b4bef9e3197330610ed57 350bde57ec6edf231bceff1532017c0d` |
| `expected` | `40595aeef8c541a9c453e27d38f6f04463331a8a` |

**Vector 6** — [SP800-108-Counter(HMAC(SHA-256),8,32) - 8 bit counter, 24 bytes](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `d17a21b0e89b371149ee89d4c9239b8a` |
| `context` | `6baf3ba16f03e5b10fe439a307b16f208ab54cb1a2a564d40644f27ad298f515` |
| `outputLength` | `24` |
| `counterBits` | `8` |
| `hashAlgorithm` | SHA-256 |
| `input` | `b1fefddae964b5becda2ac39309eed39ba1fff819425ec48e0ce2efa5eee2e13` |
| `expected` | `ba1dea3338a92eeeb3ae0046ac214ba56beb939b7054efe3` |

**Vector 7** — [SP800-108-Counter(HMAC(SHA-256),16,32) - 16 bit counter, 36 bytes over two blocks](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec)

| Field | Value |
| --- | --- |
| `label` | `2523abf2d9bd9ee7e06faf7c62999705` |
| `context` | `6bf53bfb235ae2edce466761860f7470 b5fae6d51cd7ce250f984062994dfdf5 fead470abb43fe434817564c5dee6f30` |
| `outputLength` | `36` |
| `counterBits` | `16` |
| `hashAlgorithm` | SHA-256 |
| `input` | `c342730ce2412fcdeb94cdf6b9f23d656f44c9cd0acfa9c6ca6904aaafe19d2a` |
| `expected` | `99cbbccf79545b8a341637395b034995 5077ef3b3901e06f6507962b4f08b8d5 154b03ad` |

---

[← All algorithms](../README.md)
