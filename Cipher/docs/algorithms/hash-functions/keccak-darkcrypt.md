# Keccak (DarkCrypt)

> Keccak-512 as used by the DarkCrypt Total Commander plugin: the original SHA-3 round 1 submission (Keccak version 1, 2008), Keccak[r=512, c=1088, d=64] with 18 rounds of Keccak-f[1600] and the version 1 padding that encodes the diversifier and rate. Differs from later Keccak-512 and SHA3-512, which use 24 rounds, a 576-bit rate and pad10*1; matches the published round 1 known-answer tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | DarkCrypt Variant |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche |
| Year | 2008 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/hash/darkcrypt-keccak.js`](../../../algorithms/hash/darkcrypt-keccak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Keccak Team](https://keccak.team/keccak.html)
- [Keccak specifications, round 1 (obsolete documents)](https://keccak.team/archives.html)
- [Simplifying Keccak's padding rule for round 3](https://keccak.team/2011/version_3.0.html)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt Total Commander plugin](https://github.com/Zdimon/DarkCryptTC)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Keccak round 1 ShortMsgKAT_512 - Len = 0](https://keccak.team/obsolete/KeccakKAT.zip)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `8596f8df2e856ec888823da8ccc91413 9f31baee6aa5c37dbe30bddbfd75c63c dc205f15f30faa348e27b5f90495b339 a606e3c84bfcdcd55e88b0e178b56feb` |

**Vector 2** — [Keccak round 1 ShortMsgKAT_512 - Len = 8](https://keccak.team/obsolete/KeccakKAT.zip)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `84be36543acdabb7d4e097e8bd23ecbf 231ec672f771d8bdb807b8ad98976120 f361212493564addce36077cc1def7c4 83cd4bbd8946563a127883b3593945a6` |

**Vector 3** — [Keccak round 1 ShortMsgKAT_512 - Len = 1016 (two blocks)](https://keccak.team/obsolete/KeccakKAT.zip)

| Field | Value |
| --- | --- |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `8e20c08e35cd59e0c21dc36edc596471 25af8c0597ed64a87db634ae54f1ce15 64b9400eab7d12e847189c363acbd1b6 b8a17437f0d1959ce48de980e93143c2` |

**Vector 4** — [Keccak round 1 LongMsgKAT_512 - Len = 2048](https://keccak.team/obsolete/KeccakKAT.zip)

| Field | Value |
| --- | --- |
| `input` | `724627916c50338643e6996f07877eaf d96bdf01da7e991d4155b9be1295ea7d 21c9391f4c4a41c75f77e5d273892533 93725f1427f57914b273ab862b9e31da bce506e558720520d33352d119f699e7 84f9e548ff91bc35ca14704212870982 0d69a8287ea3257857615eb0321270e9 4b84f446942765ce882b191faee7e1c8 7e0f0bd4e0cd8a927703524b559b769c a4ece1f6dbf313fdcf67c572ec4185c1 a88e86ec11b6454b371980020f19633b 6b95bd280e4fbcb0161e1a82470320ce c6ecfa25ac73d09f1536f286d3f9daca fb2cd1d0ce72d64d197f5c7520b3ccb2 fd74eb72664ba93853ef41eabf52f015 dd591500d018dd162815cc993595b195` |
| `expected` | `f28d27e97389800e972cb2202365a4f3 44ec1db0d8a58f5fcd08ac80fb2cf1a7 e8cfaa81b7d9b2a9344b08a98d2e3433 f7edd30a5d63dfb41d2b3463e77e17fc` |

**Vector 5** — [DarkCrypt Keccak - "abc"](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `4a2e21878d2785dffb751bb0c635e1f5 780152922ffe7ef5342f7442d877754a 3f866cd5b2d9f2711b02b24f64e437e4 484a8d24b7878d288e9c550729ff954e` |

**Vector 6** — [DarkCrypt Keccak - 64 incrementing bytes](https://github.com/Zdimon/DarkCryptTC)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ef3d380fac452a2adddfc2efe065378e 82184adbd7cf9cf5ee69a1ad7c49f24b 29013b010490715a98b32956df679d20 27c68a54626bdca21a969c2d74d2c71e` |

---

[← All algorithms](../README.md)
