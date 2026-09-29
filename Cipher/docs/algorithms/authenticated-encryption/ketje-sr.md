# Ketje Sr

> Lightweight authenticated encryption with enhanced security margin. Uses 400-bit Keccak-p permutation with 128-bit key and 32-byte rate.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Variant | sr |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer |
| Year | 2016 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/ketje.js`](../../../algorithms/aead/ketje.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Ketje Official Page](https://keccak.team/ketje.html)
- [Ketje v2 Specification](https://keccak.team/files/Ketjev2-doc2.0.pdf)
- [CAESAR Submission](https://competitions.cr.yp.to/round3/ketjev2.pdf)
- [Keccak Team](https://keccak.team/)

## References

- [Keccak Code Package - Ketje Reference (Ketjev2.h/.c implements Ketje Jr/Sr)](https://github.com/KeccakTeam/KeccakCodePackage/tree/a41913ea276b9033605a36d497df076c0a527640/lib/high/Ketje)
- [KeccakTools - Ketje Reference and Cryptanalysis Code (Keccak team)](https://github.com/KeccakTeam/KeccakTools/blob/master/Sources/Ketjev2.cpp)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Ketje Sr: Empty message](https://keccak.team/ketje.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `101112131415161718191a1b1c1d1e1f` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `a43bd96529a5ec5286ea168d34027c05` |

**Vector 2** — [Ketje Sr: 16-byte plaintext](https://keccak.team/ketje.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `101112131415161718191a1b1c1d1e1f` |
| `aad` | _(empty)_ |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `e8c5f20762f1e6b93a41ab6e32725f5ea6d6e37f7e3dd7f06d02dec9b9f12504` |

**Vector 3** — [Ketje Sr: 15-byte plaintext with 14-byte AAD](https://keccak.team/ketje.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `nonce` | `101112131415161718191a1b1c1d1e1f` |
| `aad` | `6164646974696f6e616c2064617461` |
| `input` | `746865207365637265742074657874` |
| `expected` | `ea4ed1ff4837daadb4092be77c2cbb54a432e8abbe4667f8e11033a512c5df` |

---

[← All algorithms](../README.md)
