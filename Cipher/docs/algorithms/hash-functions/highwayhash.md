# HighwayHash

> Google's keyed hash function designed as a faster, stronger successor to SipHash. Absorbs 32-byte packets into a 256-bit state of multiply/permute/zipper-merge lanes and supports 64-, 128- and 256-bit output. Not a cryptographic hash, but designed to resist key recovery from observed outputs.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Keyed Hash Function |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jyrki Alakuijala, Bill Cox, Jan Wassenberg (Google) |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/highway-hash.js`](../../../algorithms/hash/highway-hash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 8 bytes (64 bits); 16 bytes (128 bits); 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresKey` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not a cryptographic hash | HighwayHash is not collision resistant against an adversary who knows the key, and is not a general-purpose message digest | Use only as a keyed hash/PRF with a secret key; use SHA-2 or SHA-3 where collision resistance is required |

## Documentation

- [Google Research Paper](https://arxiv.org/abs/1612.06257)
- [GitHub Repository](https://github.com/google/highwayhash)
- [HighwayHash Specification](https://github.com/google/highwayhash/blob/master/g3doc/highway_hash.md)

## References

- [Portable reference implementation (c/highwayhash.c)](https://github.com/google/highwayhash/blob/master/c/highwayhash.c)
- [Official test vectors (highwayhash_test.cc)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

## Test vectors

24 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [HighwayHash-64, size 0 (empty)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | _(empty)_ |
| `expected` | `536ec222de567a90` |

**Vector 2** — [HighwayHash-64, size 1](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `00` |
| `expected` | `78ddcdc7aa43ab7e` |

**Vector 3** — [HighwayHash-64, size 2](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `0001` |
| `expected` | `623db5b09a56d0b8` |

**Vector 4** — [HighwayHash-64, size 3](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102` |
| `expected` | `803d468aabef6b5c` |

**Vector 5** — [HighwayHash-64, size 4 (size_mod4 boundary)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `00010203` |
| `expected` | `da7e009368a405f2` |

**Vector 6** — [HighwayHash-64, size 7](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `00010203040506` |
| `expected` | `8294f53817ae024d` |

**Vector 7** — [HighwayHash-64, size 8](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `0001020304050607` |
| `expected` | `71315fe5085120e1` |

**Vector 8** — [HighwayHash-64, size 15](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e` |
| `expected` | `3bf349a4863f7940` |

**Vector 9** — [HighwayHash-64, size 16 (16-byte remainder branch boundary)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `32b87ef98934abcf` |

**Vector 10** — [HighwayHash-64, size 17](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f10` |
| `expected` | `e2c0c5c8d267fe19` |

**Vector 11** — [HighwayHash-64, size 31 (one below a full packet)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e` |
| `expected` | `685a03cf7c00c79f` |

**Vector 12** — [HighwayHash-64, size 32 (exactly one packet, no remainder)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `fc80d5ecd964c9a0` |

**Vector 13** — [HighwayHash-64, size 33 (one over a full packet)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 20` |
| `expected` | `fc8131a03cf7902c` |

**Vector 14** — [HighwayHash-64, size 63](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e` |
| `expected` | `a03921bfe9eb8eab` |

**Vector 15** — [HighwayHash-64, size 64 (exactly two packets)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `8` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ffa6d24c5d2c5475` |

**Vector 16** — [HighwayHash-128, size 0 (empty)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `16` |
| `input` | _(empty)_ |
| `expected` | `c7fe8f9d8f26ed0f6f3e097f765e5633` |

**Vector 17** — [HighwayHash-128, size 1](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `16` |
| `input` | `00` |
| `expected` | `a8e7813689a8b0d6b4dc9cebf91d29dc` |

**Vector 18** — [HighwayHash-128, size 32 (exactly one packet)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `aa4a43c166df8419b9e4b3f95819fc16` |

**Vector 19** — [HighwayHash-128, size 33](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 20` |
| `expected` | `6cc3c6e0af7816119d84a2e59db558f9` |

**Vector 20** — [HighwayHash-128, size 64](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `16` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `f2c4d498711fbb98c88f91de7105bce0` |

**Vector 21** — [HighwayHash-256, size 0 (empty)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `f574c8c22a4844dd1f35c713730146d9ff1487b9ccbeaeb3f41d75453123da41` |

**Vector 22** — [HighwayHash-256, size 1](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `32` |
| `input` | `00` |
| `expected` | `54825fe4bc41b9ed0fc6ca3def440de2474a32cb9b1b657284e475b24c627320` |

**Vector 23** — [HighwayHash-256, size 32 (exactly one packet)](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `fec3a139908ce3bc8912c1a32663d542a9aefc64f79555e3995a47c96b3cb0c9` |

**Vector 24** — [HighwayHash-256, size 64](https://github.com/google/highwayhash/blob/master/highwayhash/highwayhash_test.cc)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `7524c16affe6d890f2c1da6e192a421a02b08e1ffe65379ebecf51c3c4d7bdc1` |

---

[← All algorithms](../README.md)
