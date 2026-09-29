# MD5

> 128-bit cryptographic hash function designed by Ronald Rivest. Fast but cryptographically broken with practical collision attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | MD Family |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | Ronald Rivest |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/md.js`](../../../algorithms/hash/md.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 16 bytes (128 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Collision Attack](https://eprint.iacr.org/2004/199.pdf) | — | Practical collision attacks demonstrated by Wang et al. in 2004. Can generate two different messages with same MD5 hash. |
| [Chosen-prefix Collision](https://www.win.tue.nl/hashclash/rogue-ca/) | — | Attackers can create collisions with chosen prefixes, enabling sophisticated attacks. |
| Rainbow Table Attack | Common passwords vulnerable to precomputed rainbow table attacks. | — |

## Documentation

- [RFC 1321 - The MD5 Message-Digest Algorithm](https://tools.ietf.org/html/rfc1321)
- [NIST SP 800-107 - Recommendation for Applications Using Approved Hash Algorithms](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf)
- [Wikipedia - MD5](https://en.wikipedia.org/wiki/MD5)

## References

- [OpenSSL MD5 Implementation](https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c)
- [MD5 Collision Research](https://www.win.tue.nl/hashclash/rogue-ca/)
- [RFC 6151 - Updated Security Considerations for MD5](https://tools.ietf.org/html/rfc6151)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 1321 Test Vector - Empty string](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `d41d8cd98f00b204e9800998ecf8427e` |

**Vector 2** — [RFC 1321 Test Vector - 'a'](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `0cc175b9c0f1b6a831c399e269772661` |

**Vector 3** — [RFC 1321 Test Vector - 'abc'](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `900150983cd24fb0d6963f7d28e17f72` |

**Vector 4** — [RFC 1321 Test Vector - 'message digest'](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | `6d65737361676520646967657374` |
| `expected` | `f96b697d7cb7938d525a2f31aaf161d0` |

**Vector 5** — [RFC 1321 Test Vector - alphabet](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `c3fcd3d76192e4007dfb496cca67e13b` |

**Vector 6** — [RFC 1321 Test Vector - alphanumeric](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | `4142434445464748494a4b4c4d4e4f50 5152535455565758595a616263646566 6768696a6b6c6d6e6f70717273747576 7778797a30313233343536373839` |
| `expected` | `d174ab98d277d9f5a5611c2c9f419d9f` |

**Vector 7** — [RFC 1321 Test Vector - numeric sequence](https://tools.ietf.org/html/rfc1321)

| Field | Value |
| --- | --- |
| `input` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334 35363738393031323334353637383930` |
| `expected` | `57edf4a22be3c955ac49da2e2107b67a` |

---

[← All algorithms](../README.md)
