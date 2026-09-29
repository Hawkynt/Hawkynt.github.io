# xxHash32

> xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. XXH32 produces a 32-bit hash and is optimized for speed on 32-bit platforms. It offers no collision or preimage resistance and must not be used where a cryptographic hash is required.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Fast Hash |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Yann Collet |
| Year | 2012 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/hash/xxhash32.js`](../../../algorithms/hash/xxhash32.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 4 bytes (32 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | xxHash is a checksum, not a cryptographic hash: collisions are easy to construct and it is not preimage resistant. | Use only for hash tables, checksums and corruption detection. Use SHA-2, SHA-3 or BLAKE2 where security is required. |

## Documentation

- [xxHash Specification](https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md)
- [xxHash Website](https://xxhash.com/)

## References

- [xxHash Reference Implementation](https://github.com/Cyan4973/xxHash)
- [Official Sanity Check Vectors](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)
- [SMHasher Quality Results](https://github.com/rurban/smhasher)

## Test vectors

16 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Official sanity check, length 0, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `02cc5d05` |

**Vector 2** — [Official sanity check, length 1, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `cf65b03e` |

**Vector 3** — [Official sanity check, length 14, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `0052929bb732a3242d00af950eec` |
| `expected` | `1208e7e2` |

**Vector 4** — [Official sanity check, length 222, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338` |
| `expected` | `5bd11dbd` |

**Vector 5** — [.NET runtime XxHash32 test: 'abc'](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `32d153ff` |

**Vector 6** — [.NET runtime XxHash32 test: '123456' (6 bytes)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `313233343536` |
| `expected` | `b7014066` |

**Vector 7** — [pierrec/xxHash test: 'abcdefghijklmnop' (exactly one 16-byte stripe)](https://github.com/pierrec/xxHash/blob/master/xxHash32/xxHash32_test.go)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f70` |
| `expected` | `9d2d8b62` |

**Vector 8** — [.NET runtime XxHash32 test: 'Hashing!' repeated 3 times (24 bytes)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `48617368696e672148617368696e672148617368696e6721` |
| `expected` | `5df7d6c0` |

**Vector 9** — [.NET runtime XxHash32 test: 20 bytes](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `3132333435363738393031323334353637383930` |
| `expected` | `2d0c3d1b` |

**Vector 10** — [.NET runtime XxHash32 test: 21 bytes, tail not a whole number of lanes](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839303132333435363738393031` |
| `expected` | `8ed1b04e` |

**Vector 11** — [.NET runtime XxHash32 test: '.NET Hashes This' repeated 3 times (48 bytes, exact multiple of the stripe)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `2e4e4554204861736865732054686973 2e4e4554204861736865732054686973 2e4e4554204861736865732054686973` |
| `expected` | `29da7472` |

**Vector 12** — [.NET runtime XxHash32 test: '.NET Hashes This!' repeated 3 times (51 bytes)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `2e4e4554204861736865732054686973 212e4e45542048617368657320546869 73212e4e455420486173686573205468 697321` |
| `expected` | `1fe08a04` |

**Vector 13** — [.NET runtime XxHash32 test: '.NET now has non-crypto hashing' repeated 3 times (93 bytes)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `2e4e4554206e6f7720686173206e6f6e 2d63727970746f2068617368696e672e 4e4554206e6f7720686173206e6f6e2d 63727970746f2068617368696e672e4e 4554206e6f7720686173206e6f6e2d63 727970746f2068617368696e67` |
| `expected` | `65242024` |

**Vector 14** — [.NET runtime XxHash32 test: 'Nobody inspects the spammish repetition'](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `4e6f626f647920696e73706563747320 746865207370616d6d69736820726570 65746974696f6e` |
| `expected` | `e2293b2f` |

**Vector 15** — [.NET runtime XxHash32 test: 'The quick brown fox jumps over the lazy dog'](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash32Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `e85ea4de` |

**Vector 16** — [pierrec/xxHash test: 'abcdefghijklmnopqrstuvwxyz0123456789' (36 bytes)](https://github.com/pierrec/xxHash/blob/master/xxHash32/xxHash32_test.go)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f70 7172737475767778797a303132333435 36373839` |
| `expected` | `42ae804d` |

---

[← All algorithms](../README.md)
