# xxHash64

> xxHash is an extremely fast non-cryptographic hash algorithm designed by Yann Collet. XXH64 produces a 64-bit hash and is the variant intended for 64-bit platforms. It offers no collision or preimage resistance and must not be used where a cryptographic hash is required.

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
| Source | [`algorithms/hash/xxhash.js`](../../../algorithms/hash/xxhash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 8 bytes (64 bits) |

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
- [LZ4 Compression Usage](https://github.com/lz4/lz4)

## Test vectors

17 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Official sanity check, length 0, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `ef46db3751d8e999` |

**Vector 2** — [Official sanity check, length 1, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `e934a84adb052768` |

**Vector 3** — [Official sanity check, length 4, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `0052929b` |
| `expected` | `9136a0dca57457ee` |

**Vector 4** — [Official sanity check, length 14, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `0052929bb732a3242d00af950eec` |
| `expected` | `8282dcc4994e35c8` |

**Vector 5** — [Official sanity check, length 222, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/cli/xsum_sanity_check.c)

| Field | Value |
| --- | --- |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338` |
| `expected` | `b641ae8cb691c174` |

**Vector 6** — [pierrec/xxHash test: 'a'](https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go)

| Field | Value |
| --- | --- |
| `input` | `61` |
| `expected` | `d24ec4f1a98c6e5b` |

**Vector 7** — [pierrec/xxHash test: 'abc'](https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `44bc2cf5ad770999` |

**Vector 8** — [pierrec/xxHash test: 'abcdefg' (7 bytes, tail shorter than a lane)](https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go)

| Field | Value |
| --- | --- |
| `input` | `61626364656667` |
| `expected` | `1860940e2902822d` |

**Vector 9** — [pierrec/xxHash test: 'abcdefgh' (exactly one 8-byte lane)](https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768` |
| `expected` | `3ad351775b4634b7` |

**Vector 10** — [.NET runtime XxHash64 test: '.NET now has non-crypto hashing' (31 bytes, one under the stripe)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `2e4e4554206e6f7720686173206e6f6e2d63727970746f2068617368696e67` |
| `expected` | `d8444d7806dfde0e` |

**Vector 11** — [pierrec/xxHash test: 'abcdefghijklmnopqrstuvwxyz012345' (exactly one 32-byte stripe)](https://github.com/pierrec/xxHash/blob/master/xxHash64/xxHash64_test.go)

| Field | Value |
| --- | --- |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435` |
| `expected` | `bf2cd639b4143b80` |

**Vector 12** — [.NET runtime XxHash64 test: 'This string has 33 ASCII bytes...' repeated 3 times (99 bytes)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `5468697320737472696e672068617320 33332041534349492062797465732e2e 2e5468697320737472696e6720686173 2033332041534349492062797465732e 2e2e5468697320737472696e67206861 73203333204153434949206279746573 2e2e2e` |
| `expected` | `488df4e623587e10` |

**Vector 13** — [.NET runtime XxHash64 test: 'This string has 32 ASCII bytes..' repeated 3 times (96 bytes, exact multiple of the stripe)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `5468697320737472696e672068617320 33322041534349492062797465732e2e 5468697320737472696e672068617320 33322041534349492062797465732e2e 5468697320737472696e672068617320 33322041534349492062797465732e2e` |
| `expected` | `975e3e6fe7e67fbc` |

**Vector 14** — [.NET runtime XxHash64 test: '0123456789ABCDEF' repeated 3 times (48 bytes)](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `30313233343536373839414243444546 30313233343536373839414243444546 30313233343536373839414243444546` |
| `expected` | `bdd40f0fac166eaa` |

**Vector 15** — [cespare/xxhash test: 63-byte input exercising every code path](https://github.com/cespare/xxhash/blob/main/xxhash_test.go)

| Field | Value |
| --- | --- |
| `input` | `43616c6c206d65204973686d61656c2e 20536f6d652079656172732061676f2d 2d6e65766572206d696e6420686f7720 6c6f6e6720707265636973656c792d` |
| `expected` | `02a2e85470d6fd96` |

**Vector 16** — [.NET runtime XxHash64 test: 'Nobody inspects the spammish repetition'](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `4e6f626f647920696e73706563747320 746865207370616d6d69736820726570 65746974696f6e` |
| `expected` | `fbcea83c8a378bf1` |

**Vector 17** — [.NET runtime XxHash64 test: 'The quick brown fox jumps over the lazy dog'](https://github.com/dotnet/runtime/blob/main/src/libraries/System.IO.Hashing/tests/XxHash64Tests.cs)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `0b242d361fda71bc` |

---

[← All algorithms](../README.md)
