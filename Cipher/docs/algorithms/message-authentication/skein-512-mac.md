# Skein-512-MAC

> Skein-512 in keyed mode for message authentication. Uses Skein's native UBI framework with KEY block processing for secure MAC generation. Supports variable-length keys and output.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Hash-based MAC |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/skeinmac512.js`](../../../algorithms/mac/skeinmac512.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Output sizes | 64 bytes (512 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [The Skein Hash Function Family, Version 1.3](https://www.schneier.com/wp-content/uploads/2015/01/skein.pdf)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Skein (hash function) Overview](https://en.wikipedia.org/wiki/Skein_(hash_function))

## References

- [Bouncy Castle SkeinMac](https://github.com/bcgit/bc-lts-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/SkeinMac.java)
- [Skein3Fish Reference Implementation (C/Java/Go)](https://github.com/wernerd/Skein3Fish)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Skein-512-MAC Official Test Vector - empty message](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1 935df3061ff06e9f204192ba11e5bb2c ac0430c1c370cb3d113fea5ec1021eb8 75e5946d7a96ac69a1626c6206b72527 36f24253c9ee9b85eb852dfc81463134 6c` |
| `input` | _(empty)_ |
| `expected` | `9bd43d2a2fcfa92becb9f69faab39369 78f1b865b7e44338fc9c8f16aba949ba 340291082834a1fc5aa81649e13d50cd 98641a1d0883062bfe2c16d1faa7e3aa` |

**Vector 2** — [Skein-512-MAC Official Test Vector - 1 byte (0xd3)](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1` |
| `input` | `d3` |
| `expected` | `f0c0a10f031c8fc69cfabcd54154c318 b5d6cd95d06b12cf20264402492211ee 010d5cecc2dc37fd772afac0596b2bf7 1e6020ef2dee7c860628b6e643ed9ff6` |

**Vector 3** — [Skein-512-MAC Official Test Vector - 8 bytes](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e` |
| `input` | `d3090c72167517f7` |
| `expected` | `0c1f1921253dd8e5c2d4c5f4099f8510 42d91147892705829161f5fc64d89785 226eb6e187068493ee4c78a4b7c0f55a 8cbbb1a5982c2daf638fc6a74b16b0d7` |

**Vector 4** — [Skein-512-MAC Official Test Vector - 16 bytes](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1` |
| `input` | `d3090c72167517f7c7ad82a70c2fd3f6` |
| `expected` | `478d7b6c0cc6e35d9ebbdedf39128e5a 36585db6222891692d1747d401de34ce 3db6fcbab6c968b7f2620f4a844a2903 b547775579993736d2493a75ff6752a1` |

**Vector 5** — [Skein-512-MAC Official Test Vector - 24 bytes](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1 93` |
| `input` | `d3090c72167517f7c7ad82a70c2fd3f6443f608301591e59` |
| `expected` | `13c170bac1de35e5fb843f65fabecf21 4a54a6e0458a4ff6ea5df91915468f4e fcd371effa8965a9e82c5388d8473049 0dcf3976af157b8baf550655a5a6ab78` |

**Vector 6** — [Skein-512-MAC Official Test Vector - 48 bytes](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1` |
| `input` | `d3090c72167517f7c7ad82a70c2fd3f6 443f608301591e598eadb195e8357135 ba26fede2ee187417f816048d00fc235` |
| `expected` | `a947812529a72fd3b8967ec391b298be e891babc8487a1ec4ea3d88f6b2b5be0 9ac6a780f30f8e8c3bbb4f18bc302a28 f3e87d170ba0f858a8fefe3487478cca` |

**Vector 7** — [Skein-512-MAC Official Test Vector - 64 bytes](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1 935df3061ff06e9f204192ba11e5bb2c ac0430c1c370cb3d113fea5ec1021eb8 75e5946d7a96ac69a1626c6206b72527 36f24253c9ee9b85eb852dfc81463134 6c` |
| `input` | `d3090c72167517f7c7ad82a70c2fd3f6 443f608301591e598eadb195e8357135 ba26fede2ee187417f816048d00fc235 12737a2113709a77e4170c49a94b7fdf` |
| `expected` | `7690ba61f10e0bba312980b0212e6a9a 51b0e9aadfde7ca535754a706e042335 b29172aae29d8bad18efaf92d43e6406 f3098e253f41f2931eda5911dc740352` |

**Vector 8** — [Skein-512-MAC Official Test Vector - 96 bytes](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf847a0d315cb2e53ff8bac41da0002672e` |
| `input` | `d3090c72167517f7c7ad82a70c2fd3f6 443f608301591e598eadb195e8357135 ba26fede2ee187417f816048d00fc235 12737a2113709a77e4170c49a94b7fdf f45ff579a72287743102e7766c35ca5a bc5dfe2f63a1e726ce5fbd2926db03a2` |
| `expected` | `d10e3ba81855ac087fbf5a3bc1f99b27 d05f98ba22441138026225d34a418b93 fd9e8dfaf5120757451adabe050d0eb5 9d271b0fe1bbf04badbcf9ba25a8791b` |

**Vector 9** — [Skein-512-MAC Official Test Vector - 128 bytes, exactly two blocks](https://github.com/bcgit/bc-lts-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinMacTest.java)

| Field | Value |
| --- | --- |
| `key` | `cb41f1706cde09651203c2d0efbaddf8 47a0d315cb2e53ff8bac41da0002672e 920244c66e02d5f0dad3e94c42bb65f0 d14157decf4105ef5609d5b0984457c1` |
| `input` | `d3090c72167517f7c7ad82a70c2fd3f6 443f608301591e598eadb195e8357135 ba26fede2ee187417f816048d00fc235 12737a2113709a77e4170c49a94b7fdf f45ff579a72287743102e7766c35ca5a bc5dfe2f63a1e726ce5fbd2926db03a2 dd18b03fc1508a9aac45eb362440203a 323e09edee6324ee2e37b4432c1867ed` |
| `expected` | `04d8cddb0ad931d54d195899a0946843 44e902286037272890bce98a41813edc 37a3cee190a693fcca613ee30049ce7e c2bdff9613f56778a13f8c28a21d167a` |

---

[← All algorithms](../README.md)
