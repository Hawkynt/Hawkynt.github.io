# ElGamal

> ElGamal public key cryptosystem based on the discrete logarithm problem in finite fields. Provides semantic security through randomized encryption: every message is encrypted under a fresh ephemeral exponent. Uses the published MODP groups of RFC 3526 with EME-PKCS1-v1_5 message encoding.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Public Key Cryptosystem |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Taher ElGamal |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/asymmetric/elgamal.js`](../../../algorithms/asymmetric/elgamal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1536 bytes (12288 bits); 2048 bytes (16384 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Small Subgroup Attack](https://link.springer.com/chapter/10.1007/3-540-68339-9_3) | — | Ensure prime p is a safe prime (p = 2q + 1 where q is prime) to prevent small subgroup attacks. The RFC 3526 groups used here are safe primes |
| [Chosen Ciphertext Attack](https://link.springer.com/chapter/10.1007/BFb0053428) | — | Basic ElGamal is malleable and not CCA-secure: multiplying c2 by a constant multiplies the plaintext by it. Use a CCA-secure construction for production |
| [Published Demonstration Key](https://www.rfc-editor.org/rfc/rfc3526) | — | The private exponent in this file is printed in the source and confers no confidentiality. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration |

## Documentation

- [Original ElGamal Paper (1985)](https://link.springer.com/chapter/10.1007/3-540-39568-7_2)
- [Handbook of Applied Cryptography - Chapter 8 (Algorithm 8.18)](http://cacr.uwaterloo.ca/hac/about/chap8.pdf)
- [RFC 3526 - More MODP Diffie-Hellman groups](https://www.rfc-editor.org/rfc/rfc3526)
- [RFC 8017 - PKCS #1 v2.2, EME-PKCS1-v1_5](https://www.rfc-editor.org/rfc/rfc8017#section-7.2)
- [Wikipedia - ElGamal encryption](https://en.wikipedia.org/wiki/ElGamal_encryption)

## References

- [Crypto++ Source - elgamal.h](https://github.com/weidai11/cryptopp/blob/master/elgamal.h)
- [Crypto++ Source - elgamal.cpp](https://github.com/weidai11/cryptopp/blob/master/elgamal.cpp)
- [OpenSSL DH Implementation](https://github.com/openssl/openssl/tree/master/crypto/dh)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ElGamal over RFC 3526 group 5 - round-trip](http://cacr.uwaterloo.ca/hac/about/chap8.pdf)

| Field | Value |
| --- | --- |
| `key` | `0600` |
| `input` | `456c47616d616c2054657374` |
| `expected` | `456c47616d616c2054657374` |

**Vector 2** — [ElGamal over RFC 3526 group 14 - round-trip with leading zero octets](https://www.rfc-editor.org/rfc/rfc3526#section-3)

| Field | Value |
| --- | --- |
| `key` | `0800` |
| `input` | `0000000102030405` |
| `expected` | `0000000102030405` |

**Vector 3** — [ElGamal over RFC 3526 group 14 - round-trip of an all-zero message](https://www.rfc-editor.org/rfc/rfc3526#section-3)

| Field | Value |
| --- | --- |
| `key` | `0800` |
| `input` | `0000000000000000` |
| `expected` | `0000000000000000` |

---

[← All algorithms](../README.md)
