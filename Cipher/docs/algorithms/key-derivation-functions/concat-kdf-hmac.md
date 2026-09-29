# Concat KDF (HMAC)

> NIST SP 800-56A/C Concatenation Key Derivation Function using HMAC. HMAC-based variant of the single-step KDF for enhanced security in key agreement protocols. Uses salt parameter for additional randomization.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Single-Step KDF |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
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
| Predictable Salt | Use random salt when possible instead of default zero-filled salt | — |

## Documentation

- [NIST SP 800-56A Rev. 3 - Key Agreement Schemes](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf)
- [NIST SP 800-56C Rev. 2 - Key Derivation](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Cr2.pdf)
- [Python cryptography - ConcatKDFHMAC](https://cryptography.io/en/latest/hazmat/primitives/key-derivation-functions/#cryptography.hazmat.primitives.kdf.concatkdf.ConcatKDFHMAC)

## References

- [pyca/cryptography - concatkdf.py](https://github.com/pyca/cryptography/blob/main/src/cryptography/hazmat/primitives/kdf/concatkdf.py)
- [RFC 2104 - HMAC](https://tools.ietf.org/html/rfc2104)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ConcatKDFHMAC SHA-512 Test Vector](https://github.com/pyca/cryptography/blob/main/tests/hazmat/primitives/test_concatkdf.py)

| Field | Value |
| --- | --- |
| `salt` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `otherinfo` | `a1b2c3d4e55e600be5f367e0e8a465f4 bf2704db00c9325c9fbd216d12b49160 b2ae5157650f43415653696421e68e` |
| `outputSize` | `32` |
| `hashFunction` | SHA-512 |
| `input` | `013951627c1dea63ea2d7702dd24e963 eef5faac6b4af7e4b831cde499dff1ce 45f6179f741c728aa733583b02409208 8f0af7fce1d045edbc5790931e8d5ca7 9c73` |
| `expected` | `64ce901db10d558661f10b6836a122a7605323ce2f39bf27eaaac8b34cf89f2f` |

**Vector 2** — [NIST SP 800-56A single-step KDF, HMAC-SHA-512, 33 byte output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec)

| Field | Value |
| --- | --- |
| `salt` | `c767f6d57c1f68860197e6634b7d82c4` |
| `otherinfo` | `5f5194b32f19c2800fba4b056f2f55b7eb0687520d38ecb7d42951f8ffd769b7` |
| `outputSize` | `33` |
| `hashFunction` | SHA-512 |
| `input` | `e74ea408acd848ab616e9891f3505053 3002c16915bce2e84749e24ffbfb175d 0ad4e8d10a093faaacaf5a37f3985c53 8b38fd3765cc106d58147fb9f896758d` |
| `expected` | `2cafccdfe04660b80fde08cfb5e80a7c ef9e0b4c5d0bc34551cca98c4e85c9fc 60` |

**Vector 3** — [NIST SP 800-56A single-step KDF, HMAC-SHA-512, 50 byte output](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_56a.vec)

| Field | Value |
| --- | --- |
| `salt` | `c767f6d57c1f68860197e6634b7d82c4` |
| `otherinfo` | `e0bc94fac3f6b34ef8002f0ea7ec0b6aacd17fbda64c92c34dd1e2703b6b3742` |
| `outputSize` | `50` |
| `hashFunction` | SHA-512 |
| `input` | `3f4d4ca74c46aea4fcbd8b5bb752a86d 3651a82efd76d17078fcea9ff258264c 0b65cb14637317f99b977b6e97f9298c 686a7c983020f608d6f0d6d17950b339 f522979d4c19547dd62b9bc20da97a4b 0a5d7c4f51eac08ba978f0243ae92401 b6eb4a83519431bdd7e9c3147ff2a76b fcf252ba13465c8467b1dc4f52c253b7 affab32d389ce01c801cc1662a9bd59c b710334676475ea2613d95f289f243d0 d195a96b49f94e4b5380742b6496d8b7 d062d6246bb616ba779f213fc1d87ace b5b0e385a50565db` |
| `expected` | `d105b8e5d103fa30a5666863ffcf335e 1150722ae34fddcb133395b94e4815f3 2e1a6b3e8d65166346667fab04f9f43e 92cb` |

---

[← All algorithms](../README.md)
