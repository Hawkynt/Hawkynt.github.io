# KMAC128

> KMAC128 - NIST SP 800-185 Keccak Message Authentication Code with 128-bit security.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Keyed Hash |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | NIST |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/kmac.js`](../../../algorithms/mac/kmac.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
- [KMAC Specification](https://csrc.nist.gov/publications/detail/sp/800-185/final)
- [Noble Hashes Implementation](https://github.com/paulmillr/noble-hashes)

## References

- [Bouncy Castle KMAC Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/KMAC.java)
- [PyCryptodome KMAC128 Implementation](https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Hash/KMAC128.py)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KMAC128 Sample #1 from NIST SP 800-185](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | _(empty)_ |
| `input` | `00010203` |
| `expected` | `e5780b0d3ea6f7d3a429c5706aa43a00fadbd7d49628839e3187243f456ee14e` |

**Vector 2** — [KMAC128 Sample #2 from NIST SP 800-185 (with customization)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | `4d7920546167676564204170706c69636174696f6e` |
| `input` | `00010203` |
| `expected` | `3b1fba963cd8b0b59e8c1a6d71888b7143651af8ba0a7070c0979e2811324aa5` |

**Vector 3** — [KMAC128 Sample #3 from NIST SP 800-185 (200-byte message, with customization)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | `4d7920546167676564204170706c69636174696f6e` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7` |
| `expected` | `1f5b4e6cca02209e0dcb5ca635b89a15e271ecc760071dfd805faa38f9729230` |

**Vector 4** — [KMAC128 rate boundary: 164-byte message merges pad10*1 into the domain separator](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3` |
| `expected` | `5719373e3073956c9b1b54453b95ff62b9d8a787c734c9781e78c4164d10667d` |

---

[← All algorithms](../README.md)
