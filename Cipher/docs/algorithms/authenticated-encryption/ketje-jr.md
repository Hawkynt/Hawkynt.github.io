# Ketje Jr

> Lightweight authenticated encryption for extremely constrained devices. Uses 200-bit Keccak-p permutation with 96-bit key and 16-byte rate.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Variant | jr |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer |
| Year | 2016 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/ketje.js`](../../../algorithms/aead/ketje.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 12 bytes (96 bits) |
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

**Vector 1** — [Ketje Jr: Empty message](https://keccak.team/ketje.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b` |
| `nonce` | `101112131415161718191a` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `8863d23f545aa267efed5d57a0ff001c` |

**Vector 2** — [Ketje Jr: 16-byte plaintext](https://keccak.team/ketje.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b` |
| `nonce` | `101112131415161718191a` |
| `aad` | _(empty)_ |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `876139e1b2ac4db54db9393bcecd08c1995151a728881be914bad2d245e93c0f` |

**Vector 3** — [Ketje Jr: 15-byte plaintext with 14-byte AAD](https://keccak.team/ketje.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b` |
| `nonce` | `101112131415161718191a` |
| `aad` | `6164646974696f6e616c2064617461` |
| `input` | `746865207365637265742074657874` |
| `expected` | `72199bac3edf79c25394dfc3e2dbb3c4c382d6e6c5f2ca57c3c4cc32b31e3e` |

---

[← All algorithms](../README.md)
