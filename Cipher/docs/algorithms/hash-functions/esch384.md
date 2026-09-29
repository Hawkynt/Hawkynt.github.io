# Esch384

> NIST Lightweight Cryptography finalist based on SPARKLE-512 permutation. Optimized for constrained devices with 384-bit security.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Lightweight Hash |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer |
| Year | 2019 |
| Origin | 🌐 International |
| Source | [`algorithms/hash/esch384.js`](../../../algorithms/hash/esch384.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 48 bytes (384 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST LWC Sparkle Specification](https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/sparkle-spec-final.pdf)
- [Sparkle Project Website](https://sparkle-lwc.github.io/)
- [GitHub Reference Implementation](https://github.com/cryptolu/sparkle)

## References

- [Official SPARKLE/Esch reference implementation (cryptolu team)](https://github.com/cryptolu/sparkle)

## Test vectors

10 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Esch384: Empty message (NIST LWC KAT Count=1)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `2981715e2263ebd0cb6e5c2c99d0776d 5e691ee737fde05247895e75d02e7447 fd6ab707e2ec8385a539777965e472ee` |

**Vector 2** — [Esch384: Single byte 0x00 (NIST LWC KAT Count=2)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `ca78366c86e82726c19ebd1dbbb1375c ef93c570f856ce2ff5da0ca87140dacd 65f3e1c5af5f84b3f6390b9ac1a2fa4d` |

**Vector 3** — [Esch384: Two bytes 0x0001 (NIST LWC KAT Count=3)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `76a4f5b45a6062de68f974824fcc7de8 ce4bd9ce64ce9a8958a3409151b2481d 13b5d9c1bdca1a658d31110088c54922` |

**Vector 4** — [Esch384: Four bytes 0x00010203 (NIST LWC KAT Count=5)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `00010203` |
| `expected` | `900c76a75ad5fec6924934e8eadc78bc b3951e241a2ac9301e6d35895689ba7c 93411a5b6def5a2f87248aff1bdd240e` |

**Vector 5** — [Esch384: 8 bytes (NIST LWC KAT Count=9)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `0001020304050607` |
| `expected` | `571560322d28dc5f8039794b4a3290a1 7ccdd60fa6c36ee78dcf9c05ce592d64 021ef324af69fcac6829fd84aa69f35b` |

**Vector 6** — [Esch384: 16 bytes (full rate) (NIST LWC KAT Count=17)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0008f97d6bbb701d5e33fcc178efe3e3 d5e77915d4a4daf6e1ae34cd28edb895 a053e19d930b50f72837e1a8f5b1f450` |

**Vector 7** — [Esch384: 20 bytes (NIST LWC KAT Count=21)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f10111213` |
| `expected` | `7e04b13784f319c59936c2555b3ee347 d7e3fbed51138f5fcd79482a1f5be9d9 f9dea8f598d5b01f4916f3be6fd0a24d` |

**Vector 8** — [Esch384: 32 bytes (NIST LWC KAT Count=33)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `55ba6e68b5ef92458c75e4888b25b31d c6212933b138c9623217af9aaff2a469 1b81331de422387d12f170ef088e0ea1` |

**Vector 9** — [Esch384: 48 bytes (NIST LWC KAT Count=49)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `expected` | `e938cdfe53d40963908d7f3ffa0671d8 0ab95925964bbbb3efe97676e94fc21b d6b836482ec13840999473fc7b148ef1` |

**Vector 10** — [Esch384: 64 bytes (NIST LWC KAT Count=65)](https://github.com/usnistgov/Lightweight-Cryptography-Benchmarking/blob/main/implementations/sparkle/crypto_hash/esch384v2/LWC_HASH_KAT_384.txt)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `580d48b4dcead117350855547063a629 fd200cd623681eeb4c3c16fa2222614a 94ce8a8bb69343a621227debd018f0ad` |

---

[← All algorithms](../README.md)
