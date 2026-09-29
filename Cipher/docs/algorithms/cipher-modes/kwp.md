# KWP

> KWP (Key Wrap with Padding) extends the standard Key Wrap algorithm to handle arbitrary-length key material by adding padding. It includes the original key length in the IV to enable proper padding removal during unwrapping. This allows secure wrapping of keys that are not multiples of 64 bits.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Key Wrapping Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2012 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/kwp.js`](../../../algorithms/modes/kwp.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Length Information Leakage | KWP includes the original key length in the IV, which may leak information about the wrapped key size. | — |
| Padding Oracle Potential | Improper error handling during unwrapping could potentially leak information about padding validity. | — |

## Documentation

- [RFC 5649 - AES Key Wrap with Padding](https://tools.ietf.org/rfc/rfc5649.txt)
- [NIST SP 800-38F](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38F.pdf)
- [Key Wrap Extensions](https://csrc.nist.gov/publications/detail/sp/800-38f/final)

## References

- [OpenSSL KWP Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/wrap128.c)
- [Crypto++ Key Wrap Padding](https://github.com/weidai11/cryptopp/blob/master/keywrap.cpp)
- [Python Cryptography KWP](https://github.com/pyca/cryptography/blob/main/src/cryptography/hazmat/primitives/keywrap.py)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 5649 6 - wrap 20 octets of key data with a 192-bit KEK](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8` |
| `input` | `c37b7e6492584340bed12207808941155068f738` |
| `expected` | `138bdeaa9b8fa7fc61f97742e72248ee5ae6ae5360d1ae6a5f54f373fa543b6a` |

**Vector 2** — [RFC 5649 6 - wrap 7 octets of key data with a 192-bit KEK](https://www.rfc-editor.org/rfc/rfc5649.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `kek` | `5840df6e29b02af1ab493b705bf16ea1ae8338f4dcc176a8` |
| `input` | `466f7250617369` |
| `expected` | `afbeb0f07dfbf5419200f2ccb50bb24f` |

---

[← All algorithms](../README.md)
