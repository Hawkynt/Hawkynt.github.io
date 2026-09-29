# OAEP

> OAEP (Optimal Asymmetric Encryption Padding) is a secure padding scheme for RSA encryption that provides strong security guarantees under the random oracle model. It uses a mask generation function and hash function to create randomized padding that prevents various attacks against plain RSA.

## Properties

| Property | Value |
| --- | --- |
| Category | Padding Schemes |
| Sub-category | Asymmetric Padding |
| Security status | 🛡️ Secure |
| Complexity | Research |
| Inventor | Mihir Bellare, Phillip Rogaway |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/padding/oaep.js`](../../../algorithms/padding/oaep.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsLengthIncluded` | No |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Implementation Complexity | OAEP requires careful implementation of mask generation functions and hash operations to avoid side-channel attacks. | — |
| Random Oracle Assumption | Security proofs rely on the random oracle model, which doesn't exist in practice. | — |
| Timing Attacks | Improper implementation can be vulnerable to timing attacks during padding verification. | — |

## Documentation

- [RFC 8017 - PKCS #1 v2.2](https://tools.ietf.org/rfc/rfc8017.txt)
- [Original OAEP Paper](https://cseweb.ucsd.edu/~mihir/papers/oaep.pdf)
- [Random Oracle Model](https://en.wikipedia.org/wiki/Random_oracle)

## References

- [RSA-OAEP Security](https://eprint.iacr.org/2001/117.pdf)
- [OpenSSL OAEP Implementation](https://github.com/openssl/openssl/blob/master/crypto/rsa/rsa_oaep.c)
- [Practical Cryptography](https://cryptopals.com/sets/6/challenges/42)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — OAEP padding with 15-byte message (deterministic seed)

Source: Educational implementation

| Field | Value |
| --- | --- |
| `keySize` | `128` |
| `hashFunction` | SHA-1 |
| `mgfFunction` | MGF1 |
| `label` | _(empty)_ |
| `input` | `6bc1bee22e409f96e93d7e11739317` |
| `expected` | `006f74a71a747b4cf4793ce3ed2d2c48 955d83635e6b6b6b6b6b6b6b6b6b6b6b 6b6b6b6b6b6b6b6b6b435225340716f9 c8dbaabd8c9f6e714053223504455423 320110ffceddacbb8a99687746552433 02475621300312fdccdfaeb9889b6a75 445726310049582f3e0d1cf3c2d1a0b7 87fea5c5a87768a098a267532d7c8de6` |

---

[← All algorithms](../README.md)
