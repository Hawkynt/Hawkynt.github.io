# CryptoPro Key Wrap

> Russian GOST 28147-89 based key wrapping with RFC 4357 key diversification. Uses CryptoPro S-box and optional MAC for integrity.

## Properties

| Property | Value |
| --- | --- |
| Category | Special Algorithms |
| Sub-category | Key Wrapping |
| Security status | ⚠️ Deprecated |
| Complexity | Advanced |
| Inventor | CryptoPro (Russian cryptographic standard) |
| Year | 2006 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/crypto/cryptoprowrap.js`](../../../algorithms/crypto/cryptoprowrap.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 32 bytes (256 bits) |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Deprecated standard | GOST 28147-89 has been superseded by newer Russian cryptographic standards. | Use modern key wrap algorithms like AES Key Wrap (RFC 3394) for new applications. |
| S-box dependency | Security depends on the CryptoPro S-box parameter set. | Always use the standardized CryptoPro S-box (E-A). |

## Documentation

- [RFC 4357 - Additional Cryptographic Algorithms for GOST 28147-89](https://www.rfc-editor.org/rfc/rfc4357)
- [GOST 28147-89 Standard (TC26)](https://www.tc26.ru/en/standard/gost/)

## References

- [Bouncy Castle CryptoProWrapEngine.java](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CryptoProWrapEngine.java)
- [RFC 4357 Section 6.5 - KEK Diversification](https://www.rfc-editor.org/rfc/rfc4357#section-6.5)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CryptoPro Wrap Test (Bouncy Castle compatible)](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/CryptoProWrapEngine.java)

| Field | Value |
| --- | --- |
| `key` | `546d203368656c326973652073736e62206167796967747473656865202c3d73` |
| `ukm` | `1234567890abcdef` |
| `input` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `expected` | `0b45e8051b41a19ae67354da4e6249dc 477444e855ce81375361fad40dbf6593 75d073f5` |

---

[← All algorithms](../README.md)
