# RC4

> Variable-key-size stream cipher using 256-byte internal state with KSA and PRGA algorithms. BROKEN - deprecated by RFC 7465 due to statistical biases and related-key attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | Ron Rivest |
| Year | 1987 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/rc4.js`](../../../algorithms/stream/rc4.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Nonce sizes | 0 bytes (0 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Statistical Biases | RC4 keystream contains detectable statistical biases exploitable in various attack scenarios | DO NOT USE - Use ChaCha20 or AES-GCM instead |
| Related-Key Attacks | Vulnerable to attacks when keys share common prefixes or patterns (WEP vulnerability) | DO NOT USE - Algorithm fundamentally broken |
| Broadcast Attacks | Statistical analysis of multiple ciphertexts can recover plaintext patterns | DO NOT USE - Officially deprecated by RFC 7465 |

## Documentation

- [RFC 6229: Test Vectors for RC4](https://tools.ietf.org/html/rfc6229)
- [RFC 7465: Prohibiting RC4 Cipher Suites](https://tools.ietf.org/html/rfc7465)
- [Applied Cryptography: RC4 Analysis](https://www.schneier.com/academic/paperfiles/paper-rc4.pdf)

## References

- [OpenSSL RC4 Implementation](https://github.com/openssl/openssl/blob/master/crypto/rc4/rc4_enc.c)
- [Crypto++ ARC4 Implementation](https://github.com/weidai11/cryptopp/blob/master/arc4.cpp)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 6229 Test Vector (40-bit key)](https://tools.ietf.org/html/rfc6229#section-2)

| Field | Value |
| --- | --- |
| `key` | `0102030405` |
| `input` | `0000000000000000` |
| `expected` | `b2396305f03dc027` |

**Vector 2** — [RFC 6229 Test Vector (128-bit key)](https://tools.ietf.org/html/rfc6229#section-2)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `0000000000000000` |
| `expected` | `9ac7cc9a609d1ef7` |

**Vector 3** — [RFC 6229 Test Vector (256-bit key)](https://tools.ietf.org/html/rfc6229#section-2)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `0000000000000000` |
| `expected` | `eaa6bd25880bf93d` |

---

[← All algorithms](../README.md)
