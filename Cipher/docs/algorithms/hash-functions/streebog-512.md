# Streebog-512

> Russian Federal standard hash function GOST R 34.11-2012, republished as RFC 6986. A 512-bit state is mixed by twelve rounds of an AES-like substitution-permutation network, with a block counter and a running checksum folded in at the end. This is the 512-bit variant.

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
| Output sizes | 64 bytes (512 bits) |
| Hash sizes | 64 bytes (512 bits) |

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
| `expected` | `1b54d01a4af5b9d5cc3d86d68d285462 b19abc2475222f35c085122be4ba1ffa 00ad30f8767b3a82384c6574f024c311 e2a481332b08ef7f41797891c1646f48` |

**Vector 2** — [RFC 6986 example 2 - M2, 72 bytes spanning two blocks](https://www.rfc-editor.org/rfc/rfc6986.txt)

| Field | Value |
| --- | --- |
| `input` | `d1e520e2e5f2f0e82c20d1f2f0e8e1ee e6e820e2edf3f6e82c20e2e5fef2fa20 f120eceef0ff20f1f2f0e5ebe0ece820 ede020f5f0e0e1f0fbff20efebfaeafb 20c8e3eef0e5e2fb` |
| `expected` | `1e88e62226bfca6f9994f1f2d51569e0 daf8475a3b0fe61a5300eee46d961376 035fe83549ada2b8620fcd7c496ce5b3 3f0cb9dddc2b6460143b03dabac9fb28` |

**Vector 3** — [Botan streebog.vec - empty message](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `8e945da209aa869f0455928529bcae46 79e9873ab707b55315f56ceb98bef0a7 362f715528356ee83cda5f2aac4c6ad2 ba3a715c1bcd81cb8e9f90bf4c1c1a8a` |

**Vector 4** — [Botan streebog.vec - one byte](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `3b` |
| `expected` | `18ff357b3d82838113a6f34d5bedd966 990959e215d6793bcaf09a007dcbcc40 b141b268ec3356117914ce9da1278f82 4d6192ff497f7394592f5c01ec64907a` |

**Vector 5** — [Botan streebog.vec - 64 bytes, exactly the block size, forcing an all-padding block](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `6277ed0cbcd95d4f45f94ac9525effda 8b823da886942c662eaa25ac8cfefbc8 26046c5d017d96d0cbc3fa28e5f46c46 6432ad3b7e204eb181cba531f4f289c2` |
| `expected` | `04a8f7eb4feccf00281bca12576779aa a0fd81307679a76366b6ad726f4cbf0a 9e16f03d435b561a25338c931750ab81 2cac1bfc4716de0a408fe132a7d5c9cf` |

**Vector 6** — [Botan streebog.vec - 65 bytes, one over the block size](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `44d2459c2ed212173625fc921fdd05a0 f2d6593515944bfc5ca37ef9b75ae3e6 6234d124722ba75feb698ffe11c319e5 3726456d9417e396928d8519a3e68981 95` |
| `expected` | `0cbfeaf77ca3c157be6a367b0fda771b a5aa465f27c4a446fa5e23356006aa43 cf2a0d1aa8803a2b85a34298ecb99936 d8e4e986dce6fd698dbb097b7e3ed8ab` |

**Vector 7** — [Botan streebog.vec - 127 bytes, one under two blocks](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `0079ce89a3bb7209563a1fab751a5b80 e6c424b2996d241d601e255d601b8194 3eb05b44523f1c1b0cde018fe08dca19 9ab809c05b03ed281d7f4cfb16b97804 7695a98e7a01ff35c498c7214b9f6c40 1342d356fd2818036f786236d85211ac deeb7bbe7d669f168737f437d004d978 3d4203213c52d178f1787efeb2ee3c` |
| `expected` | `a7bcd688131c97b57dedc7aebd845e00 42ea9f8d3a425f11f57ddfef8eaec040 e93d9219b68ab919ac4c5c5c1522ed9c bb50951bace6499e2cd0db13ff57e136` |

**Vector 8** — [Botan streebog.vec - 128 bytes, an exact multiple of the block size](https://github.com/randombit/botan/blob/master/src/tests/data/hash/streebog.vec)

| Field | Value |
| --- | --- |
| `input` | `25894e39aef06148d682f48a34f100ea 694e446bbf79caa7806c7c6f3f8a60a9 4b9c8b2877c617fead17ac576d8dafd3 f8514e49825d54dc9a8916330dc56020 4bd795d0ce00a49ba3c25c7921381c05 7bc6a1abb362db79497c878321c2a717 93f2bfb7ad211700fecd486241cc6197 a50075560147b20b9cbe2f992f516c61` |
| `expected` | `b4ce87a416b83be3417ccbd7000d658a cce2a5c3b57c92aa8ca3d912f2058074 8c2534a157b4ead16059499b9b11ae8f f07cca94a2a5a314b4ac4faaddcb0162` |

---

[← All algorithms](../README.md)
