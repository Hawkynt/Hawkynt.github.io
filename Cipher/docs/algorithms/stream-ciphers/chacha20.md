# ChaCha20

> Modern stream cipher designed by Daniel J. Bernstein as a variant of Salsa20 with improved diffusion. Uses 20 rounds of quarter-round operations with 256-bit keys and 96-bit nonces. Widely adopted in TLS 1.3, SSH, and other modern protocols.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Daniel J. Bernstein |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/chacha20.js`](../../../algorithms/stream/chacha20.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 7539: ChaCha20 and Poly1305 for IETF Protocols](https://tools.ietf.org/html/rfc7539)
- [Bernstein: ChaCha, a variant of Salsa20](https://cr.yp.to/chacha/chacha-20080128.pdf)

## References

- [Bernstein's Original ChaCha20 Reference Implementation (eSTREAM submission)](https://cr.yp.to/streamciphers/timings/estreambench/submissions/salsa20/chacha20/ref/chacha.c)
- [libsodium ChaCha20 Reference Implementation](https://github.com/jedisct1/libsodium/blob/master/src/libsodium/crypto_stream/chacha20/ref/chacha20_ref.c)
- [OpenSSL ChaCha20 Implementation](https://github.com/openssl/openssl/blob/master/crypto/chacha/chacha_enc.c)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 7539 ChaCha20 Test Vector 1 - Block 0](https://tools.ietf.org/rfc/rfc7539.txt#section-2.3.2)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000000090000004a00000000` |
| `counter` | `1` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `10f1e7e4d13b5915500fdd1fa32071c4 c7d1f4c733c068030422aa9ac3d46c4e d2826446079faa0914c2d705d98b02a2 b5129cd1de164eb9cbd083e8a2503c4e` |

**Vector 2** — [RFC 7539 ChaCha20 Encryption Test](https://tools.ietf.org/rfc/rfc7539.txt#section-2.4.2)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `000000000000004a00000000` |
| `counter` | `1` |
| `input` | `4c616469657320616e642047656e746c 656d656e206f662074686520636c6173 73206f66202739393a20496620492063 6f756c64206f6666657220796f75206f 6e6c79206f6e652074697020666f7220 746865206675747572652c2073756e73 637265656e20776f756c642062652069 742e` |
| `expected` | `6e2e359a2568f98041ba0728dd0d6981 e97e7aec1d4360c20a27afccfd9fae0b f91b65c5524733ab8f593dabcd62b357 1639d624e65152ab8f530c359f0861d8 07ca0dbf500d6a6156a38e088a22b65e 52bc514d16ccf806818ce91ab7793736 5af90bbf74a35be6b40b8eedf2785e42 874d` |

---

[← All algorithms](../README.md)
