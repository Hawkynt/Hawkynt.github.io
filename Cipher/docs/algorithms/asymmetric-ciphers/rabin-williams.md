# Rabin-Williams

> Rabin-Williams signature scheme with message recovery, following IEEE P1363 and Bernstein's treatment of the e and f tweaks. Signing extracts a square root modulo n = p*q with p congruent 3 and q congruent 7 modulo 8; verification squares the root and applies the transmitted tweak. Security is equivalent to integer factorization.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Digital Signature Scheme |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Michael O. Rabin, Hugh C. Williams |
| Year | 1979 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/asymmetric/rabin-williams.js`](../../../algorithms/asymmetric/rabin-williams.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1024 bytes (8192 bits); 2048 bytes (16384 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Message Recovery Without Hashing](http://cr.yp.to/sigs/rwsota-20080131.pdf) | — | This variant recovers the message itself rather than a hash of it, so an attacker who can pick the representative can pick the message. Sign a hash of the message under a collision resistant function for any use beyond demonstration |
| [Published Demonstration Keys](https://github.com/weidai11/cryptopp/blob/master/rw.cpp) | — | The key pairs in this file are printed in the source, so anyone can forge under them. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration |

## Documentation

- [Bernstein's RW Paper (2008)](http://cr.yp.to/sigs/rwsota-20080131.pdf)
- [IEEE P1363](https://standards.ieee.org/standard/1363-2000.html)
- [Crypto++ RW Implementation](https://github.com/weidai11/cryptopp/blob/master/rw.cpp)
- [Wikipedia - Rabin Signature](https://en.wikipedia.org/wiki/Rabin_signature_algorithm)

## References

- [Crypto++ rw.h](https://github.com/weidai11/cryptopp/blob/master/rw.h)
- [Crypto++ rw.cpp](https://github.com/weidai11/cryptopp/blob/master/rw.cpp)
- [Williams, A modification of the RSA public-key encryption procedure (1980)](https://ieeexplore.ieee.org/document/1056264)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rabin-Williams Round-trip Test - IEEE P1363 Compliance](http://cr.yp.to/sigs/rwsota-20080131.pdf)

| Field | Value |
| --- | --- |
| `key` | `0400` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `48656c6c6f20576f726c64` |

**Vector 2** — [Rabin-Williams-2048 recovery of a message with leading zero octets](https://github.com/weidai11/cryptopp/blob/master/rw.cpp)

| Field | Value |
| --- | --- |
| `key` | `0800` |
| `input` | `0000000102030405` |
| `expected` | `0000000102030405` |

---

[← All algorithms](../README.md)
