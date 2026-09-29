# SEED

> Korean block cipher standardized in RFC 4269 and TTAS.KO-12.0004. Features 128-bit blocks and keys with 16-round Feistel structure and complex S-box operations for high security.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Korea Internet and Security Agency (KISA) |
| Year | 1998 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/seed.js`](../../../algorithms/block/seed.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4269 - The SEED Encryption Algorithm](https://tools.ietf.org/rfc/rfc4269.txt)
- [TTAS.KO-12.0004 - Korean Standard](https://www.tta.or.kr/)
- [Wikipedia - SEED cipher](https://en.wikipedia.org/wiki/SEED)

## References

- [Original SEED Specification](https://tools.ietf.org/rfc/rfc4269.txt)
- [KISA SEED Implementation](https://seed.kisa.or.kr/)
- [OpenSSL SEED Implementation](https://github.com/openssl/openssl/tree/master/crypto/seed)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 4269 SEED Test Vector #1](https://tools.ietf.org/rfc/rfc4269.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `5ebac6e0054e166819aff1cc6d346cdb` |

**Vector 2** — [RFC 4269 SEED Test Vector #2](https://tools.ietf.org/rfc/rfc4269.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c11f22f20140505084483597e4370f43` |

**Vector 3** — [RFC 4269 SEED Test Vector #3](https://www.rfc-editor.org/rfc/rfc4269.txt)

| Field | Value |
| --- | --- |
| `key` | `4706480851e61be85d74bfb3fd956185` |
| `input` | `83a2f8a288641fb9a4e9a5cc2f131c7d` |
| `expected` | `ee54d13ebcae706d226bc3142cd40d4a` |

**Vector 4** — [RFC 4269 SEED Test Vector #4](https://www.rfc-editor.org/rfc/rfc4269.txt)

| Field | Value |
| --- | --- |
| `key` | `28dbc3bc49ffd87dcfa509b11d422be7` |
| `input` | `b41e6be2eba84a148e2eed84593c5ec7` |
| `expected` | `9b9b7bfcd1813cb95d0b3618f40f5122` |

**Vector 5** — [RFC 4269 Test Vector #1 applied to two identical blocks](https://www.rfc-editor.org/rfc/rfc4269.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f` |
| `expected` | `5ebac6e0054e166819aff1cc6d346cdb5ebac6e0054e166819aff1cc6d346cdb` |

---

[← All algorithms](../README.md)
