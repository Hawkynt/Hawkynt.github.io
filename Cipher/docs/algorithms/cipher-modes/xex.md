# XEX

> XEX (XOR-Encrypt-XOR) is a tweakable block cipher construction that forms the foundation of the XTS disk encryption mode. It uses a simple but effective approach: XOR the plaintext with a tweak-derived mask, encrypt with a standard block cipher, then XOR again with the same mask. This provides strong tweakable encryption suitable for disk encryption.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Tweakable Block Cipher |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Phillip Rogaway |
| Year | 2004 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/xex.js`](../../../algorithms/modes/xex.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Superseded by XTS | XEX is now primarily used as the foundation for XTS mode rather than directly. XTS provides additional security improvements. | — |
| Single-Key Weakness | Pure XEX with a single key has some theoretical weaknesses that XTS addresses by using two independent keys. | — |

## Documentation

- [XEX Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/offsets.pdf)
- [IEEE 1619-2007 XTS](https://standards.ieee.org/ieee/1619/3618/)
- [NIST SP 800-38E](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf)

## References

- [XTS Implementation (XEX successor)](https://github.com/freebsd/freebsd-src/blob/main/sys/opencrypto/xts.c)
- [Linux dm-crypt](https://gitlab.com/cryptsetup/cryptsetup/-/blob/main/lib/crypto_backend/crypto_kernel.c)
- [OpenSSL XTS](https://github.com/openssl/openssl/blob/master/crypto/modes/xts128.c)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [XEX round-trip test - single block](https://web.cs.ucdavis.edu/~rogaway/papers/offsets.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweakKey` | `603deb1015ca71be2b73aef0857d7781` |
| `tweak` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
