# xxHash3

> Ultra-fast non-cryptographic hash function optimized for speed and quality. Latest generation of xxHash family with improved performance on small data and better distribution properties.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Fast Hash |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Yann Collet |
| Year | 2019 |
| Origin | Not specified |
| Source | [`algorithms/hash/xxhash3.js`](../../../algorithms/hash/xxhash3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 8 bytes (64 bits); 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cryptographic Weakness | Not designed for cryptographic use - vulnerable to deliberate collision attacks | Use only for non-cryptographic applications like hash tables and checksums |

## Documentation

- [xxHash Official Website](https://xxhash.com/)
- [GitHub Repository](https://github.com/Cyan4973/xxHash)
- [Algorithm Documentation](https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md)

## References

- [Reference Implementation](https://github.com/Cyan4973/xxHash/blob/dev/xxhash.h)
- [Official sanity test vectors](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)
- [SMHasher Test Results](https://github.com/rurban/smhasher)

## Test vectors

30 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [XXH3-64 len=0, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | _(empty)_ |
| `expected` | `2d06800538d394c2` |

**Vector 2** — [XXH3-64 len=1, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `00` |
| `expected` | `c44bdff4074eecdb` |

**Vector 3** — [XXH3-64 len=3, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `005292` |
| `expected` | `54247382a8d6b94d` |

**Vector 4** — [XXH3-64 len=4, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929b` |
| `expected` | `e5dc74bc51848a51` |

**Vector 5** — [XXH3-64 len=8, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a324` |
| `expected` | `24ccc9acaa9f65e4` |

**Vector 6** — [XXH3-64 len=9, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d` |
| `expected` | `14d5001c15dd3f2b` |

**Vector 7** — [XXH3-64 len=16, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893` |
| `expected` | `981b17d36c7498c9` |

**Vector 8** — [XXH3-64 len=17, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893e3` |
| `expected` | `796f5acd3a60f862` |

**Vector 9** — [XXH3-64 len=128, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096` |
| `expected` | `fcff24126754d861` |

**Vector 10** — [XXH3-64 len=129, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f3` |
| `expected` | `98f1b0a679a2ca29` |

**Vector 11** — [XXH3-64 len=240, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338069a 4c3c0def6489f8a361eee3c51c9368c8` |
| `expected` | `81c3c2b67f568ccf` |

**Vector 12** — [XXH3-64 len=241, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338069a 4c3c0def6489f8a361eee3c51c9368c8 e5` |
| `expected` | `c5a639ecd2030e5e` |

**Vector 13** — [XXH3-64 len=1024, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 …` (1024 bytes; the full value is in the source) |
| `expected` | `dd85c9b5c1109c5c` |

**Vector 14** — [XXH3-64 len=2048, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 …` (2048 bytes; the full value is in the source) |
| `expected` | `dd59e2c3a5f038e0` |

**Vector 15** — [XXH3-64 len=0, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `8` |
| `input` | _(empty)_ |
| `expected` | `a8a6b918b2f0364a` |

**Vector 16** — [XXH3-64 len=1, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `8` |
| `input` | `00` |
| `expected` | `032be332dd766ef8` |

**Vector 17** — [XXH3-64 len=17, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893e3` |
| `expected` | `f3ec5067f4306db3` |

**Vector 18** — [XXH3-64 len=129, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f3` |
| `expected` | `21fffdbca099c844` |

**Vector 19** — [XXH3-64 len=241, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338069a 4c3c0def6489f8a361eee3c51c9368c8 e5` |
| `expected` | `dda9b0a161d4829a` |

**Vector 20** — [XXH3-64 len=2048, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `8` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 …` (2048 bytes; the full value is in the source) |
| `expected` | `66f81670669ababc` |

**Vector 21** — [XXH3-128 len=0, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | _(empty)_ |
| `expected` | `99aa06d3014798d86001c324468d497f` |

**Vector 22** — [XXH3-128 len=1, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `00` |
| `expected` | `a6cd5e9392000f6ac44bdff4074eecdb` |

**Vector 23** — [XXH3-128 len=16, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893` |
| `expected` | `c68c368ecf8a9c05562980258a998629` |

**Vector 24** — [XXH3-128 len=17, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893e3` |
| `expected` | `955fa78643ed3669abbc12d11973d7db` |

**Vector 25** — [XXH3-128 len=128, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096` |
| `expected` | `39992220e045260aebb15e34a7fb5ab1` |

**Vector 26** — [XXH3-128 len=240, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338069a 4c3c0def6489f8a361eee3c51c9368c8` |
| `expected` | `aa4202daa2769dc85c9aae94c8ebe5a0` |

**Vector 27** — [XXH3-128 len=241, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338069a 4c3c0def6489f8a361eee3c51c9368c8 e5` |
| `expected` | `99a80ecf0ecfc647c5a639ecd2030e5e` |

**Vector 28** — [XXH3-128 len=1024, seed 0](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 …` (1024 bytes; the full value is in the source) |
| `expected` | `0d30d24071c64c57dd85c9b5c1109c5c` |

**Vector 29** — [XXH3-128 len=1, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `16` |
| `input` | `00` |
| `expected` | `20e49abcc53b3842032be332dd766ef8` |

**Vector 30** — [XXH3-128 len=241, seed 0x9E3779B185EBCA8D](https://github.com/Cyan4973/xxHash/blob/dev/tests/sanity_test_vectors.h)

| Field | Value |
| --- | --- |
| `seed` | 9E3779B185EBCA8D |
| `outputSize` | `16` |
| `input` | `0052929bb732a3242d00af950eecb893 e3dfef93aad6cd2a538b5c3f545a6fd5 59c0fffc8f85b9331dab74f7b6059327 b07084b3677c9f76480072ed7b9817e8 dd485e0c0ccbd0653fadb28f11b06ce8 8db0f186086159566c8e4e781363bdab 9d327309ea712fd97a9d55f0ca8ad0e9 5e1a36b36b0fca51ef8ba2c462ed0096 f33449eb0fd13b92a1a963dbaaed3dcf f10942cdf9b321a2ebf2c8f4e42f48d1 4b10f4c2efecf84ab53874c3a4a6620e bffd633741e386981aeb4cba56036687 ed004559c18544b6c368f941a9eaf987 e09f12d0d51454485d444051e338069a 4c3c0def6489f8a361eee3c51c9368c8 e5` |
| `expected` | `ec64afae6a137582dda9b0a161d4829a` |

---

[← All algorithms](../README.md)
