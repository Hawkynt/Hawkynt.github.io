# Rijndael (AES)

> Educational AES implementation with 128-bit blocks and 128/192/256-bit keys, aligned with NIST FIPS 197.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen, Vincent Rijmen |
| Year | 1998 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/rijndael.js`](../../../algorithms/block/rijndael.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 24 bytes (192 bits); 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Side-channel leakage | Table-based AES leaks key-dependent timing information on shared hardware. | Use constant-time primitives or dedicated CPU instructions when side-channels matter. |
| Mode misuse | Reusing IVs or operating without authentication enables practical attacks despite strong core primitive. | Pair AES with authenticated modes (GCM, CCM) and fresh IVs for each message. |

## Documentation

- [FIPS 197: Advanced Encryption Standard (AES)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf)
- [NIST SP 800-38A: Recommendation for Block Cipher Modes](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)
- [AES overview (Wikipedia)](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)

## References

- [Rijndael submission to the AES competition](https://csrc.nist.gov/projects/block-cipher-techniques/aes-development)
- [Crypto++ AES reference](https://github.com/weidai11/cryptopp/blob/master/cpp/rijndael.cpp)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Rijndael-128/256 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `dc95c078a2408989ad48a21492842087` |

**Vector 2** — [DarkCrypt Rijndael-128/256 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `5a6e045708fb7196f02e553d02c3a692` |

**Vector 3** — [DarkCrypt Rijndael-128/256 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `08e0f42a19819e93d8788c5efe8c1b95` |

**Vector 4** — [DarkCrypt AES-256 vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `dc95c078a2408989ad48a21492842087` |

**Vector 5** — [DarkCrypt AES-256 vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `5a6e045708fb7196f02e553d02c3a692` |

**Vector 6** — [DarkCrypt AES-256 vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `08e0f42a19819e93d8788c5efe8c1b95` |

**Vector 7** — [FIPS 197 C.1 AES-128 ECB](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.197.pdf)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `69c4e0d86a7b0430d8cdb78070b4c55a` |

**Vector 8** — [NIST SP 800-38A F.2 AES-192 ECB #1](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `key` | `8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `bd334f1d6e45f25ff712a214571fa5cc` |

**Vector 9** — [NIST SP 800-38A F.2 AES-256 ECB #1](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38a.pdf)

| Field | Value |
| --- | --- |
| `key` | `603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4` |
| `input` | `6bc1bee22e409f96e93d7e117393172a` |
| `expected` | `f3eed1bdb5d2a03c064b5a7e3db181f8` |

---

[← All algorithms](../README.md)
