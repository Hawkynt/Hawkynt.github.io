# CAST-128

> Feistel network block cipher with variable key size and three different F-function types. Uses 16 rounds with four 8x32-bit S-boxes. Standardized in RFC 2144.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Carlisle Adams, Stafford Tavares |
| Year | 1996 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/block/cast.js`](../../../algorithms/block/cast.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 5 bytes (40 bits) to 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 2144 - The CAST-128 Encryption Algorithm](https://www.rfc-editor.org/rfc/rfc2144.txt)
- [CAST-128 Security Analysis](https://www.schneier.com/academic/archives/1998/09/cryptanalysis_of_cas.html)

## References

- [Bouncy Castle CAST5 Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)
- [LibGCrypt CAST5 Implementation](https://github.com/gpg/libgcrypt/blob/master/cipher/cast5.c)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 2144 official test vector - 128-bit key](https://www.rfc-editor.org/rfc/rfc2144.txt)

| Field | Value |
| --- | --- |
| `key` | `0123456712345678234567893456789a` |
| `input` | `0123456789abcdef` |
| `expected` | `238b4fe5847e44b2` |

**Vector 2** — [RFC 2144 official test vector - 80-bit key](https://www.rfc-editor.org/rfc/rfc2144.txt)

| Field | Value |
| --- | --- |
| `key` | `01234567123456782345` |
| `input` | `0123456789abcdef` |
| `expected` | `eb6a711a2c02271b` |

**Vector 3** — [RFC 2144 official test vector - 40-bit key](https://www.rfc-editor.org/rfc/rfc2144.txt)

| Field | Value |
| --- | --- |
| `key` | `0123456712` |
| `input` | `0123456789abcdef` |
| `expected` | `7ac816d16e9b302e` |

**Vector 4** — [DarkCrypt Cast128 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `13c502b354d53871` |

**Vector 5** — [DarkCrypt Cast128 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `20b42d77a79ebae5` |

**Vector 6** — [DarkCrypt Cast128 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `06613472ef700f8e` |

---

[← All algorithms](../README.md)
