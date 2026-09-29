# ChaCha20-Poly1305

> Modern AEAD construction combining ChaCha20 stream cipher with Poly1305 authenticator. Provides confidentiality and authenticity with 256-bit keys and 96-bit nonces. Widely deployed in TLS 1.3, WireGuard, and SSH.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Daniel J. Bernstein |
| Year | 2014 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/aead/chacha20-poly1305.js`](../../../algorithms/aead/chacha20-poly1305.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | Yes |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse Attack | CRITICAL: Reusing a nonce with the same key completely breaks confidentiality and authenticity. Each nonce must be unique for the lifetime of a key. | — |
| Length Extension | Poly1305 is vulnerable to length extension if not used correctly. This implementation follows RFC 8439 to prevent this. | — |

## Documentation

- [RFC 8439 - ChaCha20-Poly1305 AEAD](https://tools.ietf.org/html/rfc8439)
- [RFC 7539 - Original ChaCha20-Poly1305 Spec](https://tools.ietf.org/html/rfc7539)
- [ChaCha20 Paper by D.J. Bernstein](https://cr.yp.to/chacha/chacha-20080128.pdf)
- [Poly1305 Paper by D.J. Bernstein](https://cr.yp.to/mac/poly1305-20050329.pdf)

## References

- [TLS 1.3 Usage (RFC 8446)](https://tools.ietf.org/html/rfc8446)
- [WireGuard Protocol](https://www.wireguard.com/papers/wireguard.pdf)
- [libsodium Reference Implementation](https://github.com/jedisct1/libsodium)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 8439 Section 2.8.2 - ChaCha20-Poly1305 AEAD Encryption](https://tools.ietf.org/html/rfc8439#section-2.8.2)

| Field | Value |
| --- | --- |
| `key` | `808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f` |
| `nonce` | `070000004041424344454647` |
| `associatedData` | `50515253c0c1c2c3c4c5c6c7` |
| `input` | `4c616469657320616e642047656e746c 656d656e206f662074686520636c6173 73206f66202739393a20496620492063 6f756c64206f6666657220796f75206f 6e6c79206f6e652074697020666f7220 746865206675747572652c2073756e73 637265656e20776f756c642062652069 742e` |
| `expected` | `d31a8d34648e60db7b86afbc53ef7ec2 a4aded51296e08fea9e2b5a736ee62d6 3dbea45e8ca9671282fafb69da92728b 1a71de0a9e060b2905d6a5b67ecd3b36 92ddbd7f2d778b8c9803aee328091b58 fab324e4fad675945585808b4831d7bc 3ff4def08e4b7a9de576d26586cec64b 61161ae10b594f09e26a7e902ecbd060 0691` |

**Vector 2** — [Crypto++ Test Vector - Empty Plaintext with AAD](https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha20poly1305.txt)

| Field | Value |
| --- | --- |
| `key` | `dba2f48661bd70602fde23f98a587224d955c9b97657b624fe366ea473c9ac12` |
| `nonce` | `dc528938373b4440d5eac33d` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `0e500b992193f9b002bf02b0b293c6f7` |

**Vector 3** — [Crypto++ Test Vector - Empty Plaintext with 1-byte AAD](https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha20poly1305.txt)

| Field | Value |
| --- | --- |
| `key` | `4ab9ae9d538d74ba03eb61625e023102287ef897aa108ea19ad35005c1d40a30` |
| `nonce` | `a3ddd97f558b7e408451a1e6` |
| `associatedData` | `05` |
| `input` | _(empty)_ |
| `expected` | `bca86ed1dbbdf0693867adb0438b83de` |

---

[← All algorithms](../README.md)
