# Concat KDF (Hash)

> NIST SP 800-56A/C Concatenation Key Derivation Function using hash functions. Official NIST-recommended KDF for key agreement protocols like ECDH. Single-step KDF that concatenates counter, shared secret, and context information.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Single-Step KDF |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2007 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/concat-kdf.js`](../../../algorithms/kdf/concat-kdf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 65535 bytes (524280 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak Hash Function | Use SHA-256 or SHA-512 instead of SHA-1 for modern security requirements | — |
| Insufficient Shared Secret Entropy | Ensure shared secret from key agreement has sufficient entropy for cryptographic security | — |
| Missing Context Information | Include appropriate context in otherinfo parameter to bind derived key to specific usage | — |

## Documentation

- [NIST SP 800-56A Rev. 3 - Key Agreement Schemes](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf)
- [NIST SP 800-56C Rev. 2 - Key Derivation](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf)
- [Python cryptography - ConcatKDFHash](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#cryptography.hazmat.primitives.kdf.concatkdf.ConcatKDFHash)

## References

- [pyca/cryptography - concatkdf.py](https://github.com/pyca/cryptography/blob/main/src/cryptography/hazmat/primitives/kdf/concatkdf.py)
- [OpenSSL EVP_KDF-X963](https://www.openssl.org/docs/man3.0/man7/EVP_KDF-X963.html)
- [ANSI X9.63 KDF (Related Standard)](https://webstore.ansi.org/standards/ascx9/ansix9632011r2017)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ConcatKDFHash SHA-256 Test Vector](https://github.com/pyca/cryptography/blob/main/tests/hazmat/primitives/test_concatkdf.py)

| Field | Value |
| --- | --- |
| `otherinfo` | `a1b2c3d4e53728157e634612c12d6d52 23e204aeea4341565369647bd184bcd2 46f72971f292badaa2fe4124612cba` |
| `outputSize` | `16` |
| `hashFunction` | SHA-256 |
| `input` | `52169af5c485dcc2321eb8d26d5efa21fb9b93c98e38412ee2484cf14f0d0d23` |
| `expected` | `1c3bc9e7c4547c5191c0d478cccaed55` |

**Vector 2** — [NIST SP 800-56A single-step KDF, SHA-256, 33 byte output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec)

| Field | Value |
| --- | --- |
| `otherinfo` | `ea0e5d80a76bb5063148cc997b76da2d895bc3e4dff37c48579cc4e580f1fda3` |
| `outputSize` | `33` |
| `hashFunction` | SHA-256 |
| `input` | `7ce80e8b0480cde01fec587fe7045a8e` |
| `expected` | `9e04ddba94c2c36f8e9b1b6f9b0f4d70 a20cf1122dd94ab5724d192ed1939d92 4d` |

**Vector 3** — [NIST SP 800-56A single-step KDF, SHA-256, 48 byte output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec)

| Field | Value |
| --- | --- |
| `otherinfo` | `2d14c1c1989469a6676196410b62af1a98d05de226b22213fa731a814ade2f5c` |
| `outputSize` | `48` |
| `hashFunction` | SHA-256 |
| `input` | `8d1c9b4d7cc7f6122cb68e43b146bd32 de9f5e09143118b29db51705f25d6c81 890132f81df3dc53a7950d0803107306 289fa88e907c2e53ec13eca20f972b38 b84c5c1847f0bcb2ee4a9b64eb48348b 73256e61ce2a2cfcdb71f7db70bffcc1 01f8a7f1fee5f9d377e81ff9ec79b7fb 25c849d7b9dd125107717ec8fd931057 62b1ac629ff6df99` |
| `expected` | `95352c138eb9b23735bd68cb24288997 0846dccbd9775bcad068528e8008a3ba f1ed2047525eaa29c99cd6e0e634eb30` |

---

[← All algorithms](../README.md)
