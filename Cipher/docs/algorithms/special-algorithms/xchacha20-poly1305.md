# XChaCha20-Poly1305

> Extended ChaCha20-Poly1305 authenticated encryption with 192-bit nonces. Provides the security and performance of ChaCha20-Poly1305 while eliminating nonce size limitations.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | AEAD Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Scott Arciszewski (libsodium team) |
| Year | 2018 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/special/xchacha20-poly1305.js`](../../../algorithms/special/xchacha20-poly1305.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Key Reuse | Extended nonces reduce but don't eliminate nonce reuse risks | Still ensure nonces are not reused, though collision probability is negligible |

## Documentation

- [XChaCha20 Specification](https://tools.ietf.org/html/draft-irtf-cfrg-xchacha-03)
- [libsodium Documentation](https://doc.libsodium.org/secret-key_cryptography/aead/chacha20-poly1305/xchacha20-poly1305_construction)

## References

- [libsodium Implementation](https://github.com/jedisct1/libsodium)
- [Extended Nonce Paper](https://cr.yp.to/snuffle/xsalsa-20110204.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [XChaCha20-Poly1305 RFC draft-irtf-cfrg-xchacha-03 Appendix A](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03)

| Field | Value |
| --- | --- |
| `key` | `808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f` |
| `nonce` | `404142434445464748494a4b4c4d4e4f5051525354555657` |
| `aad` | `50515253c0c1c2c3c4c5c6c7` |
| `input` | `4c616469657320616e642047656e746c 656d656e206f662074686520636c6173 73206f66202739393a20496620492063 6f756c64206f6666657220796f75206f 6e6c79206f6e652074697020666f7220 746865206675747572652c2073756e73 637265656e20776f756c642062652069 742e` |
| `expected` | `bd6d179d3e83d43b9576579493c0e939 572a1700252bfaccbed2902c21396cbb 731c7f1b0b4aa6440bf3a82f4eda7e39 ae64c6708c54c216cb96b72e1213b452 2f8c9ba40db5d945b11b69b982c1bb9e 3f3fac2bc369488f76b2383565d3fff9 21f9664c97637da9768812f615c68b13 b52ec0875924c1c7987947deafd8780a cf49` |

**Vector 2** — [XChaCha20-Poly1305 Empty Input Test (Corrected)](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `nonce` | `000000000000000000000000000000000000000000000000` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `8f3b945a51906dc8600de9f8962d00e6` |

---

[← All algorithms](../README.md)
