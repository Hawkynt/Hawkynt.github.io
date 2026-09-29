# CTR

> Counter mode converts a block cipher into a stream cipher by encrypting successive counter values to generate a keystream. Allows parallel processing and random access. The counter typically combines a nonce (number used once) with an incrementing counter value. Both encryption and decryption use the block cipher in encryption mode only.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Stream Cipher Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Whitfield Diffie, Martin Hellman |
| Year | 1979 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/ctr.js`](../../../algorithms/modes/ctr.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 8 bytes (64 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Nonce Reuse | Reusing nonce/counter combination reveals XOR of plaintexts. Ensure unique nonces and proper counter management. | — |
| Counter Overflow | If counter overflows and wraps around, keystream may repeat. Use sufficiently large counter space. | — |
| No Authentication | CTR provides no integrity protection. Use AEAD modes or combine with MAC for authentication. | — |

## Documentation

- [NIST SP 800-38A](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)
- [RFC 3686 - AES-CTR](https://tools.ietf.org/rfc/rfc3686.txt)
- Applied Cryptography — Bruce Schneier - Chapter 9

## References

- [OpenSSL CTR Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/ctr128.c)
- [Crypto++ CTR Mode](https://github.com/weidai11/cryptopp/blob/master/modes.cpp)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST SP 800-38A CTR test vector](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `874d6191b620e3261bef6864990db6ce` |

**Vector 2** — [NIST SP 800-38A CTR multi-block](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv` | `f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `6bc1bee22e409f96e93d7e117393172a ae2d8a571e03ac9c9eb76fac45af8e51 30c81c46a35ce411e5fbc1191a0a52ef f69f2445df4f9b17ad2b417be66c3710` |
| `expected` | `874d6191b620e3261bef6864990db6ce 9806f66b7970fdff8617187bb9fffdff 5ae4df3edbd5d35e5b4f09020db03eab 1e031dda2fbe03d1792170a0f3009cee` |

---

[← All algorithms](../README.md)
