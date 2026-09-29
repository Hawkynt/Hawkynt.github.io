# SP800-108-Pipeline

> NIST SP 800-108 Key Derivation Function in Pipeline Mode. Uses HMAC with pipelined PRF expansion where each iteration computes an intermediate value, following the NIST standardized specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | NIST SP 800-108 Pipeline Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/sp800-108-pipeline.js`](../../../algorithms/kdf/sp800-108-pipeline.js) |

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

- [Botan SP800_108_Pipeline Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp)
- [BouncyCastle KBKDF Pipeline](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/generators/KDFCounterBytesGenerator.java)
- [rust-kbkdf Implementation](https://github.com/RustCrypto/KDFs)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 1 (2 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec)

| Field | Value |
| --- | --- |
| `label` | `fd7dbfdd60fed4cada6db78a` |
| `context` | `b65a30885b0849c7099b` |
| `outputLength` | `2` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `63cb90f9cd34b95007277ae6fc17fb45a9248725` |
| `expected` | `4b0d` |

**Vector 2** — [SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 2 (2 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec)

| Field | Value |
| --- | --- |
| `label` | `f441ebb9d176afc02ca826c6` |
| `context` | `644e398df79d9477a706` |
| `outputLength` | `2` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `954418fcd0ea5b6800d99b5502afc98ff7e9302d` |
| `expected` | `17f5` |

**Vector 3** — [SP 800-108 Pipeline Mode - HMAC-SHA1 Test Vector 3 (2 bytes)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec)

| Field | Value |
| --- | --- |
| `label` | `1e1a50a04838fd3d15de70ed` |
| `context` | `6303ad8d6f85b06a8133` |
| `outputLength` | `2` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `486dee7bf8590ad8146f4419131a8ed35fb67407` |
| `expected` | `096f` |

**Vector 4** — [SP 800-108 Pipeline Mode - HMAC-SHA1, 20 bytes (exactly one PRF block)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec)

| Field | Value |
| --- | --- |
| `label` | `2894f522fc3244125e79fda2` |
| `context` | `e97ff4ecbe1af9b60f178b36c82a9da1 3ece72b4eaa7cbe6dae081b51b6e5a07 76ddd88252cd2ee81503a10d2679d97b 3a647d885bdf529f22dc8db7fcfd013f 7a11a4feb91a6f1611262bb4ee0f17c5 26cd606b2eb6bc2fcef15e1d585ccbae 5807285a` |
| `outputLength` | `20` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-1 |
| `input` | `e46a6b8aa59e92e64f066319962564f87aff921a` |
| `expected` | `9334c17d345653ed331e714a17184ac75d9b9908` |

**Vector 5** — [SP 800-108 Pipeline Mode - HMAC-SHA256, 36 bytes (one group past the first block)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec)

| Field | Value |
| --- | --- |
| `label` | `ba99b90163142fa41257855bf43d865d` |
| `context` | `06849bae8a99c78d89ca12ec321c74b0 f14282ea26f120e837374138aada472c d397f163ec138b36a3a0501ffecccd3a` |
| `outputLength` | `36` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `5f55c3256b553dc14191bb6bf7a2683d5fb23175674a989f4039979b88afb41a` |
| `expected` | `c526b989ccc815bfaabe89f9a88b1ff9 786b95d09ca03fd9235df54edf89ac7b 95d4e0ae` |

**Vector 6** — [SP 800-108 Pipeline Mode - HMAC-SHA256, 48 bytes (two PRF blocks)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_pipe.vec)

| Field | Value |
| --- | --- |
| `label` | `76088a05cc92d29510c998144c95b9bc` |
| `context` | `d8037597ab1b305806983009732e64ac 9ed3a3bdbc6208d6439b2b57138585fb 408619fd882e1253b81055d4025d7831 087f68442d0d88b3b428b5b0b04abb54` |
| `outputLength` | `48` |
| `counterBits` | `32` |
| `outputLengthBits` | `32` |
| `hashAlgorithm` | SHA-256 |
| `input` | `5b5a55801cbf928335b51b03fa90e663d8f15ec10d1ff37e13d4cae60cc7c4c9` |
| `expected` | `f255ffa7fb16595048ea36da923c358d b664f6ff3f36f76203de596f352f1feb 87084379051f511dd2a58bfaa5ec7ac8` |

---

[← All algorithms](../README.md)
