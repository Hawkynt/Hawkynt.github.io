# CCM

> Counter with CBC-MAC provides authenticated encryption by combining CTR mode encryption with CBC-MAC authentication. Used in IEEE 802.11i, IPsec, and TLS. Requires pre-specifying the message length and supports variable nonce sizes. More restrictive than GCM but simpler to implement securely.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Authenticated Encryption |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Doug Whiting, Russ Housley, Niels Ferguson |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/ccm.js`](../../../algorithms/modes/ccm.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Tag sizes | 4 bytes (32 bits) to 16 bytes (128 bits) in steps of 2 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse | Reusing nonce with same key breaks confidentiality and authenticity. Always use unique nonces. | — |
| Length Extension | If message length is not properly validated, attacks may be possible | — |
| Implementation Complexity | Proper parameter validation critical - incorrect L or M values can break security | — |

## Documentation

- [NIST SP 800-38C](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38c.pdf)
- [RFC 3610](https://tools.ietf.org/rfc/rfc3610.txt)
- IEEE 802.11i Standard — CCM usage in WiFi security

## References

- [OpenSSL CCM Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/ccm128.c)
- [RFC 5116 - AEAD Interface](https://tools.ietf.org/rfc/rfc5116.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3610 Vector #1 (M=8, L=2)](https://www.rfc-editor.org/rfc/rfc3610.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `c0c1c2c3c4c5c6c7c8c9cacbcccdcecf` |
| `iv` | `00000003020100a0a1a2a3a4a5` |
| `aad` | `0001020304050607` |
| `tagSize` | `8` |
| `input` | `08090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `expected` | `588c979a61c663d2f066d0c2c0f989806d5f6b61dac38417e8d12cfdf926e0` |

**Vector 2** — [RFC 3610 Vector #7 (M=10, L=2)](https://www.rfc-editor.org/rfc/rfc3610.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `c0c1c2c3c4c5c6c7c8c9cacbcccdcecf` |
| `iv` | `00000009080706a0a1a2a3a4a5` |
| `aad` | `0001020304050607` |
| `tagSize` | `10` |
| `input` | `08090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `expected` | `0135d1b2c95f41d5d1d4fec185d166b8 094e999dfed96c048c56602c97acbb74 90` |

**Vector 3** — [RFC 3610 Vector #13 (M=8, L=2)](https://www.rfc-editor.org/rfc/rfc3610.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `d7828d13b2b0bdc325a76236df93cc6b` |
| `iv` | `00412b4ea9cdbe3c9696766cfa` |
| `aad` | `0be1a88bace018b1` |
| `tagSize` | `8` |
| `input` | `08e8cf97d820ea258460e96ad9cf5289054d895ceac47c` |
| `expected` | `4cb97f86a2a4689a877947ab8091ef5386a6ffbdd080f8e78cf7cb0cddd7b3` |

---

[← All algorithms](../README.md)
