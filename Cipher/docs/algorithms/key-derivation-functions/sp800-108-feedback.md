# SP800-108-Feedback

> NIST SP 800-108 Key Derivation Function in Feedback Mode. Uses HMAC with feedback-based PRF expansion where each iteration feeds the previous output back as input, following the NIST standardized specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | NIST SP 800-108 Feedback Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/sp800-108-feedback.js`](../../../algorithms/kdf/sp800-108-feedback.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key derivation sizes | 1 byte (8 bits) to 65535 bytes (524280 bits) |

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

- [Botan SP800_108_Feedback Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp)
- [BouncyCastle KBKDF Feedback](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/generators/KDFCounterBytesGenerator.java)
- [rust-kbkdf Implementation](https://github.com/RustCrypto/KDFs)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SP 800-108 Feedback Mode - HMAC-SHA1 Test Vector 1 (2 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec)

| Field | Value |
| --- | --- |
| `label` | `37935cbae5f5b003398f8e3f` |
| `context` | `0976fdec7817d94d60c4e0c9091d82e38bcfc58d7fff0829a13d1b4455b8` |
| `outputLength` | `2` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `e6ea4e4f7178a81230a01da05705b9c8b902121b` |
| `expected` | `1092` |

**Vector 2** — [SP 800-108 Feedback Mode - HMAC-SHA1 Test Vector 2 (2 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec)

| Field | Value |
| --- | --- |
| `label` | `6ee961f615859ca0aae6ace0` |
| `context` | `614e4b95faa64cbe30ce47d9c426536a54f62e51d5909f8216204075516f` |
| `outputLength` | `2` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `5b5e2c32e98f06aa4868eec0ec18d53904dc0c05` |
| `expected` | `419a` |

**Vector 3** — [SP 800-108 Feedback Mode - HMAC-SHA1 Test Vector 3 (2 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec)

| Field | Value |
| --- | --- |
| `label` | `c1e9241ee2203b12ce1147be` |
| `context` | `46402d8c205c356e9a09755adc2bf243b55b14424b64db419e0ceb22c211` |
| `outputLength` | `2` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `6611cf92c30689b302b190a7b720359a6f79af93` |
| `expected` | `5e6f` |

**Vector 4** — [SP 800-108 Feedback Mode - HMAC-SHA1, 20 bytes (exactly one PRF block)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec)

| Field | Value |
| --- | --- |
| `label` | `fa9877411df9bba2b96706ea` |
| `context` | `314f85d1e8bfa91f2419b25cca0eaeb5 8a6e77244b20fedcf458b6656cd0e67d a2e417151dcfaad5946efc97924c89c9 be7fea6ac66e7af8d165df9c252bfa0f 0d00f8850ca49177a0ccbeac1f0818ed 8d1d7aea7455c608b22771a18f1a7a99 74fd4b1bcc7641c404ce650a737ddc75 9232b662e2af403a` |
| `outputLength` | `20` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `3b674a2db34ddffba29091a0ad3077c9dd4cc245` |
| `expected` | `4371d87e4a58f982afdfb70dc632ed620d76f14d` |

**Vector 5** — [SP 800-108 Feedback Mode - HMAC-SHA256, 36 bytes (one group past the first block)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec)

| Field | Value |
| --- | --- |
| `label` | `07d8f46f432b585c9c35aad27d3b34bf` |
| `context` | `acdea99ad3d17295e1dc11935595aadb 2c95d06fcf9ea5cb89e9f5d42b1ee042 60a4b706555e5524a900f5162da44f51` |
| `outputLength` | `36` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `abbef1c4c15ba0660f118f4e3078193d104d286f7aab95b88d71cc00ccd4f38a` |
| `expected` | `773ad91cc0e639a067cb586f246157f9 992874cb933f62c8b7383a5aa7198dc1 e11c5ab7` |

**Vector 6** — [SP 800-108 Feedback Mode - HMAC-SHA256, 48 bytes (two PRF blocks)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_fb.vec)

| Field | Value |
| --- | --- |
| `label` | `6b5b22df64669ecd796545637ba48f55` |
| `context` | `61312d1cf43b42197348acb6fb89f720 70be9b7e633545eb5f563dea9a45405c 573229fcd8450a50f3671228e3e7ae39 213a7c8982643b6992661aa0e950fefe` |
| `outputLength` | `48` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `ba9a647c679326716cf4b98700199fc4f8592e9fc68f794d80da1e974c89d52d` |
| `expected` | `bf6ec210daddb2b977e22fa5e15497fa dcd692428ec54561ce502966a8e89a86 e812c8421b1ff843a06a46b7ab43d112` |

---

[← All algorithms](../README.md)
