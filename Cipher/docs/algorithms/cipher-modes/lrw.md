# LRW

> LRW (Liskov-Rivest-Wagner) is a tweakable block cipher mode designed for disk encryption. It combines a block cipher with Galois field multiplication to create a tweakable cipher that's suitable for random-access storage. LRW was later superseded by XTS mode due to security improvements.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Disk Encryption Mode |
| Security status | ⚠️ Deprecated |
| Complexity | Research |
| Inventor | Moses Liskov, Ronald Rivest, David Wagner |
| Year | 2002 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/lrw.js`](../../../algorithms/modes/lrw.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Superseded by XTS | LRW has been replaced by XTS mode which provides better security properties and addresses potential weaknesses in LRW. | — |
| Galois Field Implementation | Requires careful implementation of GF(2^128) multiplication to avoid timing attacks and ensure correctness. | — |
| Tweak Management | Improper tweak handling in disk encryption can lead to security vulnerabilities. | — |

## Documentation

- [LRW Original Paper](https://web.cs.ucdavis.edu/~rogaway/papers/lrw.pdf)
- [IEEE P1619 Draft](https://standards.ieee.org/ieee/1619/3618/)
- [Tweakable Block Ciphers](https://web.cs.ucdavis.edu/~rogaway/papers/tweakable.pdf)

## References

- [XTS Mode (LRW successor)](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38e.pdf)
- [dm-crypt LRW Implementation](https://gitlab.com/cryptsetup/cryptsetup/-/blob/main/lib/crypto_backend/crypto_kernel.c)
- [Linux Kernel Crypto](https://github.com/torvalds/linux/tree/master/crypto)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LRW-32-AES-1 (AES-128, index 1)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `4562ac25f828176d4c268414b5680185` |
| `tweakKey` | `258e2a05e73e9d03ee5a830ccc094c87` |
| `tweak` | `00000000000000000000000000000001` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `f1b273cd65a3df5fe95d489254634eb8` |

**Vector 2** — [LRW-32-AES-2 (AES-128, index 2)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `59704714f557478cd779e80f54887944` |
| `tweakKey` | `0d48f0b7b15a53ea1caa6b29c2cafbaf` |
| `tweak` | `00000000000000000000000000000002` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `00c82bae95bbcde5274f0769b260e136` |

**Vector 3** — [LRW-32-AES-3 (AES-128, large index)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `d82a9134b26a565030fe69e2377f9847` |
| `tweakKey` | `cdf90b160c648fb6b00d0d1bae85871f` |
| `tweak` | `00000000000000000000000200000000` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `76322183ed8ff182f9596203690e5e01` |

**Vector 4** — [LRW-32-AES-4 (AES-192, index 1)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `0f6aeff8d3d2bb152583f73c1f012874cac6bc354d4a6554` |
| `tweakKey` | `90ae61cf7baebdccade494c54a29ae70` |
| `tweak` | `00000000000000000000000000000001` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `9c0f152f55a2d8f0d67b8f9e2822bc41` |

**Vector 5** — [LRW-32-AES-5 (AES-192, large index)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `8ad4ee102fbd81fff886ceac93c5adc6a01907c09df7bbdd` |
| `tweakKey` | `5213b2b7f0ff11d8d608d0cd2eb1176f` |
| `tweak` | `00000000000000000000000200000000` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `d4276a7f14913d65c860480287e33406` |

**Vector 6** — [LRW-32-AES-6 (AES-256, index 1)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `f8d476ffd646ee6c2384cb1c77d6195dfef1a9f37bbc8d21a79c21f8cb900289` |
| `tweakKey` | `a845348ec8c5b5f126f50e76fefd1b1e` |
| `tweak` | `00000000000000000000000000000001` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `bd06b8e1db98899ec498e491cf1c702b` |

**Vector 7** — [LRW-32-AES-7 (AES-256, large index)](https://raw.githubusercontent.com/torvalds/linux/master/crypto/testmgr.h)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `fb7615b23d80891dd470980bc79584c8b2fb64ce6097878d17fce45a49e830b7` |
| `tweakKey` | `6e7817e72d5e12d46064047af12f9e0c` |
| `tweak` | `00000000000000000000000200000000` |
| `input` | `30313233343536373839414243444546` |
| `expected` | `5b908ec1abdd675f3d698a9553c89ce5` |

---

[← All algorithms](../README.md)
