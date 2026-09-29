# KMAC256

> KMAC256 - NIST SP 800-185 Keccak Message Authentication Code with 256-bit security.

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
- [PyCryptodome KMAC256 Implementation](https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Hash/KMAC256.py)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [KMAC256 Sample #4 from NIST SP 800-185](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | `4d7920546167676564204170706c69636174696f6e` |
| `input` | `00010203` |
| `expected` | `20c570c31346f703c9ac36c61c03cb64 c3970d0cfc787e9b79599d273a68d2f7 f69d4cc3de9d104a351689f27cf6f595 1f0103f33f4f24871024d9c27773a8dd` |

**Vector 2** — [KMAC256 Sample #5 from NIST SP 800-185 (no customization)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7` |
| `expected` | `75358cf39e41494e949707927cee0af2 0a3ff553904c86b08f21cc414bcfd691 589d27cf5e15369cbbff8b9a4c2eb178 00855d0235ff635da82533ec6b759b69` |

**Vector 3** — [KMAC256 Sample #6 from NIST SP 800-185 (200-byte message, with customization)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | `4d7920546167676564204170706c69636174696f6e` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7` |
| `expected` | `b58618f71f92e1d56c1b8c55ddd7cd18 8b97b4ca4d99831eb2699a837da2e4d9 70fbacfde50033aea585f1a2708510c3 2d07880801bd182898fe476876fc8965` |

**Vector 4** — [KMAC256 rate boundary: 132-byte message merges pad10*1 into the domain separator](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)

| Field | Value |
| --- | --- |
| `key` | `404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f` |
| `customization` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 80818283` |
| `expected` | `10b07e27533954705aee9771c4325a30 28d97e9c5ff731d30ebc94c7249bad3f 8203f4d5ff61e4a762a4a4ceadc65234 f2a8cca7650977899f34e296b3cfa268` |

---

[← All algorithms](../README.md)
