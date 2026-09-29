# RSA

> RSA public key cryptosystem based on integer factorization hardness. First practical asymmetric encryption enabling secure communication without shared secrets. Implements the RSAEP and RSADP primitives with EME-PKCS1-v1_5 encoding from RFC 8017 over fixed demonstration key pairs.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Public Key Cryptosystem |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ron Rivest, Adi Shamir, Leonard Adleman |
| Year | 1977 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/asymmetric/rsa.js`](../../../algorithms/asymmetric/rsa.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1024 bytes (8192 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Bleichenbacher's Attack](https://link.springer.com/chapter/10.1007/BFb0055716) | — | EME-PKCS1-v1_5 leaks whether a ciphertext decodes correctly. Use RSAES-OAEP (RFC 8017 Section 7.1) where an attacker can observe decryption failures |
| [Published Demonstration Keys](https://www.rfc-editor.org/rfc/rfc8017) | — | The key pairs in this file are printed in the source and confer no confidentiality. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration |

## Documentation

- [Original RSA Paper (1978)](https://dl.acm.org/doi/10.1145/359340.359342)
- [RFC 8017 - PKCS #1: RSA Cryptography Specifications Version 2.2](https://www.rfc-editor.org/rfc/rfc8017)
- [RFC 3447 - PKCS #1: RSA Cryptography Specifications Version 2.1](https://tools.ietf.org/rfc/rfc3447.txt)
- [NIST SP 800-56B - Key Establishment Using Integer Factorization](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Br2.pdf)
- [Wikipedia - RSA (cryptosystem)](https://en.wikipedia.org/wiki/RSA_(cryptosystem))

## References

- [OpenSSL RSA Implementation](https://github.com/openssl/openssl/blob/master/crypto/rsa/rsa_lib.c)
- [GnuPG RSA Implementation](https://github.com/gpg/gnupg/blob/master/g10/pubkey-enc.c)
- [Python cryptography library RSA](https://github.com/pyca/cryptography/tree/main/src/cryptography/hazmat/primitives/asymmetric)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RSA-1024 RSAES-PKCS1-v1_5 round-trip (RFC 8017 Section 7.2)](https://www.rfc-editor.org/rfc/rfc8017#section-7.2)

| Field | Value |
| --- | --- |
| `key` | `0400` |
| `input` | `48656c6c6f20525341` |
| `expected` | `48656c6c6f20525341` |

**Vector 2** — [RSA-1024 RSAES-PKCS1-v1_5 round-trip with leading zero octets](https://www.rfc-editor.org/rfc/rfc8017#section-7.2)

| Field | Value |
| --- | --- |
| `key` | `0400` |
| `input` | `0000000102030405` |
| `expected` | `0000000102030405` |

---

[← All algorithms](../README.md)
