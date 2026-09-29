# PEM (Privacy-Enhanced Mail)

> Text encoding format for cryptographic objects like certificates and keys. Uses Base64 encoding wrapped with header and footer lines for email transmission. Educational implementation following RFC 7468 textual encodings of PKIX, PKCS, and CMS structures.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Cryptographic Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Privacy-Enhanced Mail Working Group |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/encoding/pem.js`](../../../algorithms/encoding/pem.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 7468 - Textual Encodings of PKIX, PKCS, and CMS Structures](https://tools.ietf.org/html/rfc7468)
- [RFC 1421 - Privacy Enhancement for Internet Electronic Mail](https://tools.ietf.org/html/rfc1421)
- [PEM Format Wikipedia](https://en.wikipedia.org/wiki/Privacy-Enhanced_Mail)

## References

- [OpenSSL PEM Format](https://www.openssl.org/docs/man1.1.1/man5/pem.html)
- [X.509 Certificate Format](https://tools.ietf.org/html/rfc5280)
- [PKCS Standards](https://www.rsa.com/en-us/company/standards/pkcs)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — PEM empty certificate test

Source: RFC 7468 standard

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `2d2d2d2d2d424547494e204345525449 4649434154452d2d2d2d2d0a0a2d2d2d 2d2d454e442043455254494649434154 452d2d2d2d2d0a` |

**Vector 2** — Basic PEM encoding test

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `2d2d2d2d2d424547494e204345525449 4649434154452d2d2d2d2d0a53475673 6247383d0a2d2d2d2d2d454e44204345 5254494649434154452d2d2d2d2d0a` |

---

[← All algorithms](../README.md)
