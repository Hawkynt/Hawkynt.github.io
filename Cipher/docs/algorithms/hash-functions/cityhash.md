# CityHash

> Fast non-cryptographic hash function developed by Google. Optimized for short strings with excellent speed and distribution.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Fast Hash |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Geoff Pike, Jyrki Alakuijala |
| Year | 2011 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/cityhash.js`](../../../algorithms/hash/cityhash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CityHash Official Repository](https://github.com/google/cityhash)
- [Hash Function Performance Analysis](https://github.com/aappleby/smhasher)
- [Wikipedia CityHash](https://en.wikipedia.org/wiki/CityHash)

## References

- [Google CityHash Implementation](https://github.com/google/cityhash)
- [Abseil C++ Libraries](https://github.com/abseil/abseil-cpp)

## Test vectors

13 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CityHash64 - empty string (city-test.cc row 0)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `9ae16a3b2f90404f` |

**Vector 2** — [CityHash64 - 1 byte (city-test.cc row 1)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `e4` |
| `expected` | `541150e87f415e96` |

**Vector 3** — [CityHash64 - 4 bytes, 32-bit fetch branch (city-test.cc row 4)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `3b30a72c` |
| `expected` | `11df592596f41d88` |

**Vector 4** — [CityHash64 - 8 bytes, 64-bit fetch branch (city-test.cc row 8)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `1f412460c1cdf8a0` |
| `expected` | `a0f10149a0e538d6` |

**Vector 5** — [CityHash64 - 16 bytes, upper bound of HashLen0to16 (city-test.cc row 16)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `08fe8b0699b1481fcdd211877e37ae7a` |
| `expected` | `03ead5f21d344056` |

**Vector 6** — [CityHash64 - 17 bytes, first length using HashLen17to32 (city-test.cc row 17)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `4fcbab25b38771771b3737436f4de89322` |
| `expected` | `6abbfde37ee03b5b` |

**Vector 7** — [CityHash64 - 32 bytes, upper bound of HashLen17to32 (city-test.cc row 32)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `687cb7cc8039f4f635371953a976f2fd44a295e949c026bc1b2bfc4fe987f3ca` |
| `expected` | `0782fa1b08b475e7` |

**Vector 8** — [CityHash64 - 33 bytes, first length using HashLen33to64 (city-test.cc row 33)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `1a8d3c9b2722df26ed606175cb22f3c1 2d161a28216d540848b58c817ebd3a6c dd` |
| `expected` | `c5dc19b876d37a80` |

**Vector 9** — [CityHash64 - 64 bytes, upper bound of HashLen33to64 (city-test.cc row 64)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `3e04258f937d4e2ab1380ca11c95fa0f 16d0a650807eef9ccd32db4680dbe246 aeb73ff35f483a5fddf78b44d3f695af 314b9f7e9a8a8fa8ad9ccd596420fa33` |
| `expected` | `e88419922b87176f` |

**Vector 10** — [CityHash64 - 65 bytes, first length using the 64-byte chunk loop (city-test.cc row 65)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `5ad402a5a42187df5c0c6c4db1a8663c dc2c55b7dbf8c410c109bec2f0847b64 95fc6a14cc9be158d204aeefc4cf97fb 8b2d3b9e0f30319a9adba14575370065 d0` |
| `expected` | `105191e0ec8f7f60` |

**Vector 11** — [CityHash64 - 96 bytes, exact multiple of the 64-byte chunk size (city-test.cc row 96)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `14598623ad0fc80367503fb23d694cb6 42523739ba5d4adbe96f1786aa7a16ff 5ecd0f89c450be61c49e3accc979e9bc 2242042c4d74727d1e00be8c51acd78e f76ed08a3c4b2174e0d520c84a7c4687 c1034c4b49f4326b9c1e235b6078f38f` |
| `expected` | `930380a3741e862a` |

**Vector 12** — [CityHash64 - 128 bytes, two full chunks (city-test.cc row 128)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `e3ea15658192c1a40203b56a1a805429 d2a2e5dd7dbf4c771e0ba3f898040149 0cdf0b621499796fd023370d621a6d99 ee178bc250e00d773888f32300208cf7 6af1462e4a3ea8d6bf36b2edb1505830 e75c0bdc0305d7114213e1fe730be727 9941acdd9c50d130fccd92d715119e34 299ff378c1e534ef899157d55f8a742b` |
| `expected` | `b2e23e8116c2ba9f` |

**Vector 13** — [CityHash64 - 200 bytes, multi-chunk with remainder (city-test.cc row 200)](https://github.com/google/cityhash/blob/master/src/city-test.cc)

| Field | Value |
| --- | --- |
| `input` | `e7084a778ece35a266602c33468c9d19 26860cec599b58fa95c4183e4a9126fa b3412bcea7079d759dbf197c3cfb400a 42df4df3dc95963957081e92d9c4ae25 80b3831d68c75ecbf386d73065630ed4 a001be18c9495676e2d933ae0862c773 9c7fee6296587f5edf1426307733c064 8d58b576e9a7fcbffae08098b492b8c9 47f101e91c2e28b5df9c0924456249fa 92cfaa0bd846e95abeec2640b21fc82e e521d1d05278a2802e3e7d585111d9f6 5b19e3c526a07c197450e869a9609e81 f0431a85541cae2f` |
| `expected` | `07fc98006e25cac9` |

---

[← All algorithms](../README.md)
