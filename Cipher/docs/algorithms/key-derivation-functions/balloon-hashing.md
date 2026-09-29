# Balloon Hashing

> Memory-hard password hashing function with provable protection against sequential attacks. Simpler design than Argon2 with similar security properties. Requires configurable space cost (s_cost), time cost (t_cost), and mixing parameter (delta).

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Password Hashing |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Dan Boneh, Henry Corrigan-Gibbs, Stuart Schechter |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/balloon.js`](../../../algorithms/kdf/balloon.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 20 bytes (160 bits) to 64 bytes (512 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Parameter Selection | Use adequate s_cost (≥1024) and t_cost (≥3) for production. Insufficient parameters weaken memory-hardness. | — |
| Timing Attacks | Use constant-time comparison for password verification to prevent timing side-channel attacks. | — |

## Documentation

- [Balloon Hashing Paper (ePrint Archive)](https://eprint.iacr.org/2016/027.pdf)
- [GNU Nettle Implementation](https://git.lysator.liu.se/nettle/nettle/-/blob/master/balloon.c)
- [Wikipedia - Balloon Hashing](https://en.wikipedia.org/wiki/Balloon_hashing)

## References

- [GitHub Reference - nachonavarro/balloon-hashing](https://github.com/nachonavarro/balloon-hashing)
- [RustCrypto Balloon Hash Implementation](https://github.com/RustCrypto/password-hashes/tree/master/balloon-hash)
- [CRYPTO 2016 Paper Presentation](https://www.iacr.org/conferences/crypto2016/)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GNU Nettle Test Vector 1: SHA-256, hunter42/examplesalt, s_cost=1024, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `6578616d706c6573616c74` |
| `hashAlgorithm` | SHA-256 |
| `sCost` | `1024` |
| `tCost` | `3` |
| `outputSize` | `32` |
| `input` | `68756e7465723432` |
| `expected` | `716043dff777b44aa7b88dcbab12c078abecfac9d289c5b5195967aa63440dfb` |

**Vector 2** — [GNU Nettle Test Vector 2: SHA-256, empty password/salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashAlgorithm` | SHA-256 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `32` |
| `input` | _(empty)_ |
| `expected` | `5f02f8206f9cd212485c6bdf85527b698956701ad0852106f94b94ee94577378` |

**Vector 3** — [GNU Nettle Test Vector 3: SHA-256, password/empty salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `hashAlgorithm` | SHA-256 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `32` |
| `input` | `70617373776f7264` |
| `expected` | `20aa99d7fe3f4df4bd98c655c5480ec98b143107a331fd491deda885c4d6a6cc` |

**Vector 4** — [GNU Nettle Test Vector 4: SHA-256, single char password/salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `00` |
| `hashAlgorithm` | SHA-256 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `32` |
| `input` | `00` |
| `expected` | `4fc7e302ffa29ae0eac31166cee7a552d1d71135f4e0da66486fb68a749b73a4` |

**Vector 5** — [GNU Nettle Test Vector 5: SHA-256, password/salt, s_cost=1, t_cost=1 (minimal)](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashAlgorithm` | SHA-256 |
| `sCost` | `1` |
| `tCost` | `1` |
| `outputSize` | `32` |
| `input` | `70617373776f7264` |
| `expected` | `eefda4a8a75b461fa389c1dcfaf3e9dfacbc26f81f22e6f280d15cc18c417545` |

**Vector 6** — [GNU Nettle Test Vector 6: SHA-1, password/salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashAlgorithm` | SHA-1 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `20` |
| `input` | `70617373776f7264` |
| `expected` | `99393c091fdd3136f85864099ec49a439dcacc21` |

**Vector 7** — [GNU Nettle Test Vector 7: SHA-256, password/salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashAlgorithm` | SHA-256 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `32` |
| `input` | `70617373776f7264` |
| `expected` | `a4df347f5a312e8b2b14c32164f61a81758c807f1bdcda44f4930e2b80ab2154` |

**Vector 8** — [GNU Nettle Test Vector 8: SHA-384, password/salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashAlgorithm` | SHA-384 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `48` |
| `input` | `70617373776f7264` |
| `expected` | `78da235f7d0f84aba98b50a432fa6c8f 7f3ecb7ea0858cfb316c7e5356aae6c8 d7e7b3924c54c4ed71a3d0d68cb0ad68` |

**Vector 9** — [GNU Nettle Test Vector 9: SHA-512, password/salt, s_cost=3, t_cost=3](https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/balloon-test.c)

| Field | Value |
| --- | --- |
| `salt` | `73616c74` |
| `hashAlgorithm` | SHA-512 |
| `sCost` | `3` |
| `tCost` | `3` |
| `outputSize` | `64` |
| `input` | `70617373776f7264` |
| `expected` | `9baf289dfa42990f4b189d96d4ede0f2 610ba71fb644169427829d696f6866d8 7af41eb68f9e14fd4b1f1a7ce4832f1e d6117c16e8eae753f9e1d054a7c0a7eb` |

---

[← All algorithms](../README.md)
