# Tiaoxin-346

> High-performance authenticated encryption from CAESAR competition third round using AES round functions. Designed for exceptional software speed with 6 AES rounds per 32-byte message block.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Ivica Nikolić |
| Year | 2014 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/tiaoxin.js`](../../../algorithms/aead/tiaoxin.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [CAESAR Round 3 Submission (v2.1)](https://competitions.cr.yp.to/round3/tiaoxinv21.pdf)
- [CAESAR Round 2 Submission (v2)](https://competitions.cr.yp.to/round2/tiaoxinv2.pdf)
- [CAESAR Competition](https://competitions.cr.yp.to/caesar.html)
- [SUPERCOP Reference Implementation](https://github.com/floodyberry/supercop/tree/master/crypto_aead/tiaoxinv2)

## References

- [Tiaoxin-346 Specification (PDF)](https://competitions.cr.yp.to/round3/tiaoxinv21.pdf)
- [GMU CAESAR Hardware API Implementation and KAT](https://cryptography.gmu.edu/athena/index.php?id=CAESAR_source_codes)
- [Weak Keys in Reduced AEGIS and Tiaoxin](https://eprint.iacr.org/2021/187)
- [Differential Fault Analysis on Tiaoxin](https://link.springer.com/chapter/10.1007/978-981-10-2738-3_7)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GMU CAESAR-HW KAT Msg 1 (empty message, empty associated data)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `545b6287d143acbf33daaa2d5ccb873e` |

**Vector 2** — [GMU CAESAR-HW KAT Msg 3 (empty message, 1-byte associated data)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | `a0` |
| `input` | _(empty)_ |
| `expected` | `4bc1849c85e902f65224933cd6125fc1` |

**Vector 3** — [GMU CAESAR-HW KAT Msg 5 (1-byte message, empty associated data)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | _(empty)_ |
| `input` | `ff` |
| `expected` | `d7b9f3b2a47b6742c58c5f5f26ef7cd03f` |

**Vector 4** — [GMU CAESAR-HW KAT Msg 7 (1-byte message, 1-byte associated data)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | `a0` |
| `input` | `ff` |
| `expected` | `6d8a5dc084aaedaaa02a9e1ac1b01358f0` |

**Vector 5** — [GMU CAESAR-HW KAT Msg 9 (32-byte message and associated data, one full block each)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | `a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `input` | `ff000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `expected` | `0c5b778e763aca8126ff3d98b7ccb94f 7769171a48987fb3fb99b92078dbbef6 a210f4c82b0447ef3658af76ab95cbe4` |

**Vector 6** — [GMU CAESAR-HW KAT Msg 11 (31-byte message and associated data, short final block)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | `a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbe` |
| `input` | `ff000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d` |
| `expected` | `386f2be6763aca8126ff3d98b7ccb94f 7769171a48987fb3fb99b92078dbbef1 67fc2f34eff54580c613a9bc4c713a` |

**Vector 7** — [GMU CAESAR-HW KAT Msg 13 (33-byte message and associated data, one byte into a second block)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `55565758595a5b5c5d5e5f6061626364` |
| `nonce` | `b0b1b2b3b4b5b6b7b8b9babbbcbdbebf` |
| `associatedData` | `a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0` |
| `input` | `ff000102030405060708090a0b0c0d0e 0f101112131415161718191a1b1c1d1e 1f` |
| `expected` | `2f585296ff34d59a11d1198c26e79155 50ab52448079c91d46cccfe447cbec7b 7843737fba1ae66d79a9e3fcc191ffb8 0b` |

**Vector 8** — [GMU CAESAR-HW KAT Msg 21 (128-byte message, 52-byte associated data)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `51fcc64d3726f9f74ab70e62cd59c740` |
| `nonce` | `a2cd65e40ed8fb93daff1dc45a12a945` |
| `associatedData` | `11cf345b2643021b701ceac02bce1ea1 21325b8798dc017094387b764b82e67c d32a98554289f0bd30f6a6a87edb7ba4 b11db2f5` |
| `input` | `ce576f8a005cb3367d831209ffc6905e 816bf94a589189fb7d0cee78efd815a2 b03b0179d0d4bdc6881bda1bc22fa580 ad78c25a2404a381d43a1ba2a8d70bbc 3f582404fe4082638de999b8f665a538 573eacd1856c1d1e598ada322fbd9bdb 590baf23223e0ed17d08e62098f78fd9` |
| `expected` | `66fc0642a34e76e2a70f4a3d3ea4a52c 9a3d97124579a577924f8cc12d1859eb 01e035c018b5d8ace80fdd7d061727cb b8addf9c98a10ad5f19398c5eb43393f d31a8bdcc912ab7916187be381191da5 da1677209af50e878141b699ab618df3 a89b24fb9e9ab8beb33368a88917f30c 852a22ddb263859456968b1822ca4996` |

**Vector 9** — [GMU CAESAR-HW KAT Msg 24 (1-byte message, 111-byte associated data)](https://cryptography.gmu.edu/athena/sources/2017_08_08/Tiaoxin_GMU_v1.1.zip)

| Field | Value |
| --- | --- |
| `key` | `0a673f78117ba9397650acced8b5907b` |
| `nonce` | `cb7977680d4cc7236ecf52f29a987ff1` |
| `associatedData` | `814d6a9274d508db708000a961a391ff eb25d9c65507084bc383cc4b81429d08 532769c8c6bf2c84e7c7040679119d8f 1dd1257c8604712c51b28b9fe6d3a426 f4a938b3e474bc7817b56af98e180432 fa835e5f469112220910487262b57572 9744b11fa2d823ffa2fe0f17e08a95` |
| `input` | `9d` |
| `expected` | `b57b2e6bd87b95aec1d3d8277c9d69cb06` |

---

[← All algorithms](../README.md)
