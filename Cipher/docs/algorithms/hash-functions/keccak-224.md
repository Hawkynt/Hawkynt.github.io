# Keccak-224

> Original Keccak-224 hash function (pre-SHA3). Uses 0x01 padding instead of SHA-3's 0x06. Produces 224-bit digests.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Keccak Family |
| Variant | 224 |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2012 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/keccak.js`](../../../algorithms/hash/keccak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 28 bytes (224 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Keccak Team](https://keccak.team/)
- [Original Keccak](http://keccak.noekeon.org/)

## References

- [Crypto++ Keccak](https://github.com/weidai11/cryptopp/blob/master/keccak.cpp)
- [Keccak Test Vectors](http://keccak.noekeon.org/KeccakKAT-3.zip)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Keccak-224: Empty (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `f71837502ba8e10837bdd8d365adb85591895602fc552b48b7390abd` |

**Vector 2** — [Keccak-224: 'abc' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `c30411768506ebe1c2871b1ee2e87d38df342317300a9b97a95ec6a8` |

**Vector 3** — [Keccak-224: 'The quick brown fox...' (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `310aee6b30c47350576ac2873fa89fd190cdc488442f3ef654cf23fe` |

**Vector 4** — [Keccak-224: Long message (Crypto++)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/keccak.txt)

| Field | Value |
| --- | --- |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `e51faa2b4655150b931ee8d700dc202f763ca5f962c529eae55012b6` |

---

[← All algorithms](../README.md)
