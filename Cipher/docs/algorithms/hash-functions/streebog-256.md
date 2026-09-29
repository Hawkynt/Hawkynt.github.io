# Streebog-256

> Russian Federal standard hash function GOST R 34.11-2012, republished as RFC 6986. A 512-bit state is mixed by twelve rounds of an AES-like substitution-permutation network, with a block counter and a running checksum folded in at the end. This is the 256-bit variant.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | GOST |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Center for Information Protection and Special Communications of the FSB of Russia, InfoTeCS JSC |
| Year | 2012 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/hash/streebog.js`](../../../algorithms/hash/streebog.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |
| Hash sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unexplained S-box | The origin of the substitution Pi has never been published, which has drawn academic criticism even though no attack on the full function is known. | — |

## Documentation

- [RFC 6986 - GOST R 34.11-2012: Hash Function](https://www.rfc-editor.org/rfc/rfc6986.txt)
- [GOST R 34.11-2012 (TC26, English)](https://www.tc26.ru/en/standard/gost/GOST_R_3411-2012_eng.pdf)

## References

- [Botan test vectors](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)
- [Wikipedia: Streebog](https://en.wikipedia.org/wiki/Streebog)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 6986 example 1 - M1, 63 bytes](https://www.rfc-editor.org/rfc/rfc6986.txt)

| Field | Value |
| --- | --- |
| `input` | `30313233343536373839303132333435 36373839303132333435363738393031 32333435363738393031323334353637 383930313233343536373839303132` |
| `expected` | `9d151eefd8590b89daa6ba6cb74af9275dd051026bb149a452fd84e5e57b5500` |

**Vector 2** — [RFC 6986 example 2 - M2, 72 bytes spanning two blocks](https://www.rfc-editor.org/rfc/rfc6986.txt)

| Field | Value |
| --- | --- |
| `input` | `d1e520e2e5f2f0e82c20d1f2f0e8e1ee e6e820e2edf3f6e82c20e2e5fef2fa20 f120eceef0ff20f1f2f0e5ebe0ece820 ede020f5f0e0e1f0fbff20efebfaeafb 20c8e3eef0e5e2fb` |
| `expected` | `9dd2fe4e90409e5da87f53976d7405b0c0cac628fc669a741d50063c557e8f50` |

**Vector 3** — [Botan streebog.vec - empty message](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `3f539a213e97c802cc229d474c6aa32a825a360b2a933a949fd925208d9ce1bb` |

**Vector 4** — [Botan streebog.vec - one byte](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `c6` |
| `expected` | `d907b672d09f48d27ad06c26647921c9e25d063c038eaaefac81e749dc1d98b5` |

**Vector 5** — [Botan streebog.vec - 64 bytes, exactly the block size, forcing an all-padding block](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `00b7d1c42da82cc055affead5924db66 2e5a080081697f8287c687fe91d32b42 54fbb961725559a32c43c3f8114e05c2 991108228ed83edc476fb9a62874fab1` |
| `expected` | `68367c34ad8441a48ac7fc65657ac73aa51e1a36c5346c0bf011945bcb9ef773` |

**Vector 6** — [Botan streebog.vec - 65 bytes, one over the block size](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `89e8a4ccd6285add12b0c46506e91c09 a3c2dd30951eb72818b58187f1a608ed ebf569fa81254970ad7f04ae9a25827f a6482829fdc0797a5cff6f7446d14576 d2` |
| `expected` | `64f56da108ea18571aacb6852b5be57999ec5de82a7d1f719fcddfc7ec1b0ad1` |

**Vector 7** — [Botan streebog.vec - 127 bytes, one under two blocks](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `c1c065c63b1b848430326ded0cd23cff c644296813df0f968275492026737fd8 d26f8690f19512e5a7c936050fc6b011 d0538a6d5c1e75f839af3b0237d4a1ac cb497de6733f9717326260401a77a564 e7bca93ae9fe7d257060e44ea08c350c 9f64a78ce095fe29a7d1fc23de9350a4 7b71eda31514d134d84b5180930e29` |
| `expected` | `1ef768f7ae820c2966b7c60b0cf208ab89c1f7b60f9b2cab61253c38d1f2c987` |

**Vector 8** — [Botan streebog.vec - 128 bytes, an exact multiple of the block size](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `290f597702e009d86f49d5362346309e 26919eacbcb86165be4906056d43f95a 1e181b2b0c12785c929f17a3d25943f5 313641c915bf5dd38882d587da1da65d 6658f89764e28ee13a24ac9349e68035 79baa17d6ca571793c13f7a0fe46043d eeed08922fb2e2353d8718c5f1c7f1fb a2df54e9cbbad54a750da656863d2843` |
| `expected` | `c9c82e740ccc34fc0c14c61ab4eb037542d77ffda00d484aff97c1144346704f` |

---

[← All algorithms](../README.md)
