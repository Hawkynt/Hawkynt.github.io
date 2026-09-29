# IGE

> Infinite Garble Extension (IGE) mode uses bidirectional chaining where each block is XORed with both the previous ciphertext and the previous plaintext before encryption. This creates infinite error propagation in both directions, making it highly sensitive to transmission errors but providing strong diffusion properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Campbell, Wiener |
| Year | 1995 |
| Origin | 🌐 International |
| Source | [`algorithms/modes/ige.js`](../../../algorithms/modes/ige.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 16 bytes (128 bits) to 64 bytes (512 bits) in steps of 16 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Bidirectional Error Propagation | Errors propagate both forward and backward, making recovery from transmission errors extremely difficult. | — |
| Implementation Complexity | Requires careful handling of two separate IV chains and bidirectional feedback. | — |
| Limited Testing | Rarely used mode with limited cryptanalysis and real-world testing. | — |

## Documentation

- IGE Original Paper — Campbell, Wiener 1995 - Infinite Garble Extension
- [OpenSSL IGE Implementation](https://github.com/openssl/openssl/blob/master/crypto/modes/ige128.c)
- Telegram MTProto — Uses IGE mode for secure messaging

## References

- Applied Cryptography — Block cipher mode variations
- Cryptographic Engineering — Advanced chaining modes

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [OpenSSL igetest.c vector 0 - two zero blocks](https://raw.githubusercontent.com/openssl/openssl/master/test/igetest.c)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv1` | `000102030405060708090a0b0c0d0e0f` |
| `iv2` | `101112131415161718191a1b1c1d1e1f` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `1a8519a6557be652e9da8e43da4ef4453cf456b4ca488aa383c79c98b34797cb` |

**Vector 2** — [OpenSSL igetest.c vector 1 - ASCII key and IV](https://raw.githubusercontent.com/openssl/openssl/master/test/igetest.c)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `5468697320697320616e20696d706c65` |
| `iv1` | `6d656e746174696f6e206f6620494745` |
| `iv2` | `206d6f646520666f72204f70656e5353` |
| `input` | `99706487a1cde613bc6de0b6f24b1c7aa448c8b9c3403e3467a8cad89340f53b` |
| `expected` | `4c2e204c6574277320686f70652042656e20676f74206974207269676874210a` |

**Vector 3** — [IGE with the SP 800-38A sample plaintext - single block](https://raw.githubusercontent.com/openssl/openssl/master/crypto/modes/ige128.c)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv1` | `000102030405060708090a0b0c0d0e0f` |
| `iv2` | `0f0e0d0c0b0a09080706050403020100` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `7947a6a08a13bb4ec9ef8b9f11eb187d` |

**Vector 4** — [IGE with the SP 800-38A sample plaintext - two blocks](https://raw.githubusercontent.com/openssl/openssl/master/crypto/modes/ige128.c)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `iv1` | `000102030405060708090a0b0c0d0e0f` |
| `iv2` | `0f0e0d0c0b0a09080706050403020100` |
| `input` | `6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51` |
| `expected` | `7947a6a08a13bb4ec9ef8b9f11eb187dd5e9638070bbd7bea612ecd68eee2388` |

---

[← All algorithms](../README.md)
