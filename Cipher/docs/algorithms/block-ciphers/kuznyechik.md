# Kuznyechik

> Russian Federal block cipher standard GOST R 34.12-2015 with 128-bit blocks and 256-bit keys. Designed to replace GOST 28147-89, featuring an SP-network structure with 10 rounds. Standardized in RFC 7801.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Russian Federal Security Service |
| Year | 2015 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/kuznyechik.js`](../../../algorithms/block/kuznyechik.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 7801 - GOST R 34.12-2015 Kuznyechik Specification](https://datatracker.ietf.org/doc/html/rfc7801)
- [GOST R 34.12-2015 Standard](https://tc26.ru/en/standards/)
- [Wikipedia - Kuznyechik](https://en.wikipedia.org/wiki/Kuznyechik)

## References

- [Botan Kuznyechik Implementation](https://github.com/randombit/botan/blob/master/src/lib/block/kuznyechik/kuznyechik.cpp)
- [gost-engine Reference Implementation (OpenSSL)](https://github.com/gost-engine/engine)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 7801 Section 5.5 - Encryption Test Vector](https://datatracker.ietf.org/doc/html/rfc7801#section-5.5)

| Field | Value |
| --- | --- |
| `key` | `8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef` |
| `input` | `1122334455667700ffeeddccbbaa9988` |
| `expected` | `7f679d90bebc24305a468d42b9d4edcd` |

**Vector 2** — [RFC 7801 Section 5.6 - Decryption Test Vector](https://datatracker.ietf.org/doc/html/rfc7801#section-5.6)

| Field | Value |
| --- | --- |
| `key` | `8899aabbccddeeff0011223344556677fedcba98765432100123456789abcdef` |
| `inverse` | Yes |
| `input` | `7f679d90bebc24305a468d42b9d4edcd` |
| `expected` | `1122334455667700ffeeddccbbaa9988` |

---

[← All algorithms](../README.md)
