# ARIA

> Korean national encryption standard (KS X 1213:2004) with 128-bit block size. Supports 128/192/256-bit keys using Substitution-Permutation Network structure.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Korean Agency for Technology and Standards |
| Year | 2004 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/aria.js`](../../../algorithms/block/aria.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 5794 - ARIA Encryption Algorithm](https://tools.ietf.org/rfc/rfc5794.txt)
- [KS X 1213:2004 - Korean Standard](https://www.kats.go.kr/)
- [Wikipedia - ARIA cipher](https://en.wikipedia.org/wiki/ARIA_(cipher))

## References

- [Original ARIA Specification](https://tools.ietf.org/rfc/rfc5794.txt)
- [OpenSSL ARIA Implementation](https://github.com/openssl/openssl/blob/master/crypto/aria/)
- [Crypto++ ARIA Implementation](https://github.com/weidai11/cryptopp/blob/master/aria.cpp)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt ARIA vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c20857dd9106ddde286ec59fa98d77cc` |

**Vector 2** — [DarkCrypt ARIA vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `7a859561ff6f42df04a242bfea4fe9dc` |

**Vector 3** — [DarkCrypt ARIA vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `7570fa11eef8439511faeeaed33d511d` |

**Vector 4** — [RFC 5794 ARIA-128 Test Vector](https://tools.ietf.org/rfc/rfc5794.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `d718fbd6ab644c739da95f3be6451778` |

**Vector 5** — [RFC 5794 ARIA-192 Test Vector](https://tools.ietf.org/rfc/rfc5794.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `26449c1805dbe7aa25a468ce263a9e79` |

**Vector 6** — [RFC 5794 ARIA-256 Test Vector](https://tools.ietf.org/rfc/rfc5794.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `f92bd7c79fb72e2f2b8f80c1972d24fc` |

---

[← All algorithms](../README.md)
