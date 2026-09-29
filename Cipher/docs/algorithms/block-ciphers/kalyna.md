# Kalyna

> Ukrainian national encryption standard (DSTU 7624:2014) - exact Crypto++ port with bit-perfect test vector validation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Roman Oliynykov, Ivan Gorbenko, et al. |
| Year | 2014 |
| Origin | 🇺🇦 Ukraine |
| Source | [`algorithms/block/kalyna.js`](../../../algorithms/block/kalyna.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Educational Implementation | This is an educational implementation and should not be used in production systems. | Use certified cryptographic libraries for production applications. |

## Documentation

- [DSTU 7624:2014 Official Paper](https://eprint.iacr.org/2015/650.pdf)
- [Official Reference Implementation](https://github.com/Roman-Oliynykov/Kalyna-reference)
- [Crypto++ Implementation](https://www.cryptopp.com/wiki/Kalyna)

## References

- [Ukrainian Standard DSTU 7624:2014](https://eprint.iacr.org/2015/650)
- [Crypto++ kalynatab.cpp](https://github.com/weidai11/cryptopp/blob/master/kalynatab.cpp)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DSTU 7624:2014 Kalyna-128/128 (ECB Mode)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/kalyna.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `81bf1c7d779bac20e1c9ea39b4d2ad06` |

**Vector 2** — [DSTU 7624:2014 Kalyna-128/256 (ECB Mode)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/kalyna.txt)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `202122232425262728292a2b2c2d2e2f` |
| `expected` | `58ec3e091000158a1148f7166f334f14` |

---

[← All algorithms](../README.md)
