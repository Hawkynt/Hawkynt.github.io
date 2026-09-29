# TLS-PRF

> TLS 1.0/1.1 Pseudorandom Function using MD5 and SHA-1 in parallel. Derives keying material from secrets, labels, and seeds for SSL/TLS protocol handshakes. Uses P_hash construction with XOR combination.

## Properties

| Property | Value |
| --- | --- |
| Category | Key Derivation Functions |
| Sub-category | Key Derivation Function |
| Security status | ⚠️ Deprecated |
| Complexity | Intermediate |
| Inventor | IETF TLS Working Group |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/kdf/tls-prf.js`](../../../algorithms/kdf/tls-prf.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SaltRequired` | Yes |

## Security

**Status:** ⚠️ Deprecated

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak Hash Functions | Uses MD5 and SHA-1 which are cryptographically weak. Use TLS 1.2+ with SHA-256 or better. | — |
| Deprecated Protocol | TLS 1.0/1.1 are deprecated. Modern applications should use TLS 1.2+ (TLS-12-PRF). | — |

## Documentation

- [RFC 2246 - TLS 1.0 Protocol](https://tools.ietf.org/rfc/rfc2246.txt)
- [RFC 4346 - TLS 1.1 Protocol](https://tools.ietf.org/rfc/rfc4346.txt)
- [Botan TLS-PRF Implementation](https://github.com/randombit/botan/blob/master/src/lib/kdf/prf_tls/prf_tls.cpp)

## References

- [OpenSSL TLS1 PRF](https://github.com/openssl/openssl/blob/master/ssl/t1_enc.c)
- [RFC 5246 - TLS 1.2 (supersedes TLS-PRF)](https://tools.ietf.org/rfc/rfc5246.txt)

## Test vectors

14 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan TLS-PRF Vector 1](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `a6d455cb1b2929e43d63cce55ce89d66f252549729c19c1511` |
| `outputSize` | `1` |
| `input` | `6c81af87abd86be83c37ce981f6bfe11bd53a8` |
| `expected` | `a8` |

**Vector 2** — [Botan TLS-PRF Vector 2](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `510194c9c9f90d98452fb914f636d5e5297c` |
| `outputSize` | `2` |
| `input` | `6bb61d34af2bccf45a850850bcde35e55a92ba` |
| `expected` | `5e75` |

**Vector 3** — [Botan TLS-PRF Vector 3](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `7fc24d382379a9cd54d53458947cb28e298a1dcc5eb2556f71acac1b` |
| `outputSize` | `3` |
| `input` | `3cc54f5f3ef82c93ce60eb62dc9df005280dd1` |
| `expected` | `706f52` |

**Vector 4** — [Botan TLS-PRF Vector 4](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `9f6fafed1f241a1e40adeaf2ad80` |
| `outputSize` | `4` |
| `input` | `bd3462dc587dfa992ae48bd7643b62a9971928` |
| `expected` | `841d7339` |

**Vector 5** — [Botan TLS-PRF Vector 5](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `1026b9224fc59706beadae58ebd161fd2eac` |
| `outputSize` | `5` |
| `input` | `1235a061fa3867b8e51511d1e672ce141e2fa6` |
| `expected` | `d856787d41` |

**Vector 6** — [Botan TLS-PRF Vector 6](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `512fbf47d9da2915` |
| `outputSize` | `6` |
| `input` | `63a22c3c7c5651103648f5cfc9764a7bde821f` |
| `expected` | `f13096feed6e` |

**Vector 7** — [Botan TLS-PRF Vector 7](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `519b87db85fbe92fb4070f3bef6e3d97df69b66061eb83b4a334e8eedc0f8e` |
| `outputSize` | `7` |
| `input` | `aa15082f10f25ec4f96dffe9dc3d80bba6361b` |
| `expected` | `b637fcade57896` |

**Vector 8** — [Botan TLS-PRF Vector 8](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `453c2549058b063c83e8b85e5cef3570df51b7d79b486f4f33` |
| `outputSize` | `8` |
| `input` | `775b727ce679b8696171c7be60fc2e3f4de516` |
| `expected` | `3431016193616501` |

**Vector 9** — [Botan TLS-PRF Vector 9](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `5569fc` |
| `outputSize` | `9` |
| `input` | `ab299ad69dc581f13d86562ae2be8b08015ff8` |
| `expected` | `a624cc363499b1ea64` |

**Vector 10** — [Botan TLS-PRF Vector 10](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `7fde51efb4044017c95e3608f8fb6f` |
| `outputSize` | `10` |
| `input` | `ae4947624d877916e5b01eddab8e4cdc817630` |
| `expected` | `5b908eb5b2a7f115cf57` |

**Vector 11** — [Botan TLS-PRF Vector 16](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `859d1ee9a694865ecc1830c361d24485ac1026` |
| `outputSize` | `16` |
| `input` | `77bf131d53997b1fb2ace2137e26992b36bf3e` |
| `expected` | `60d0a09fcfde24ab73f62a7c9f594766` |

**Vector 12** — [Botan TLS-PRF Vector 20](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `255230a341e671bc31b1` |
| `outputSize` | `20` |
| `input` | `bcbd1efda490b9d541ba9df50fe9a451dd0313` |
| `expected` | `2291e19459725562f106f63fe2f81e73ba23f04a` |

**Vector 13** — [Botan TLS-PRF Vector 31 (Empty Salt)](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | _(empty)_ |
| `outputSize` | `31` |
| `input` | `0ae876a7bb96c24cefa6ed53cee7b0a41b8ff7b3` |
| `expected` | `881b99c3e43b1a42f096cf556d3143d5c5dbc4e984d26c5f3075bcb08b73da` |

**Vector 14** — [Botan TLS-PRF Vector 32](https://github.com/randombit/botan/blob/master/src/tests/data/kdf/tls_prf.vec)

| Field | Value |
| --- | --- |
| `salt` | `fcd5c9637a21e43f3cff6ecf65b6e2f97933779f101ad6` |
| `outputSize` | `32` |
| `input` | `2212169d33fadc6ff94a3e5e0020587953cf1964` |
| `expected` | `1e1c646c2bfbdc62fa4c81f1d0781f5f269d3f45e5c33cac8a2640226c8c5d16` |

---

[← All algorithms](../README.md)
