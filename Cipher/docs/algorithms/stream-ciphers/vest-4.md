# VEST-4

> VEST-4 root cipher (eSTREAM Phase 2): 16 nonlinear RNS counters drive an 83-bit nonlinear accumulator through a linear diffusor; 4 output bits per round, 80-bit security rating. Keys of 1 to 64 bytes, optional IV of up to 64 bytes. BROKEN - chosen-IV collision attacks exist.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | NLFSR Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Sean O'Neil, Benjamin Gittins, Howard Landman |
| Year | 2006 |
| Origin | 🌐 International |
| Source | [`algorithms/stream/vest.js`](../../../algorithms/stream/vest.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 64 bytes (512 bits) |
| Nonce sizes | 0 bytes (0 bits) to 64 bytes (512 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Chosen-IV Inner Collisions](https://www.ecrypt.eu.org/stream/papersdir/2007/021.pdf) | Joux and Reinhard, "Overtaking VEST" (FSE 2007): counter collisions during IV setup combined with a collision in the linear counter diffusor recover 53 bits of the keyed state with about 2^22 to 2^29 IV setups, cutting exhaustive key search by 53 bits; the same collisions forge VEST MACs | DO NOT USE - the designers' later fix is not part of this specification |

## Documentation

- [eSTREAM VEST page (Phase 2)](https://www.ecrypt.eu.org/stream/vestp2.html)
- [VEST ciphers, Phase 2 specification](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2.pdf)
- [VEST ciphers, Phase 1 specification](https://www.ecrypt.eu.org/stream/ciphers/vest/vest.pdf)
- [Wikipedia: VEST](https://en.wikipedia.org/wiki/VEST)

## References

- [VEST Phase 2 submission source and test vectors](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)
- [ProVEST eSTREAM API sources and test vectors (eSTREAM SVN)](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/vest/)
- [Archived copy of the eSTREAM VEST page](https://web.archive.org/web/2022/https://www.ecrypt.eu.org/stream/vestp2.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [VEST-4 root cipher, 128-bit key 01000000000000000000000000000000, no IV: first 128 keystream bits](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)

| Field | Value |
| --- | --- |
| `key` | `01000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `bda8528d861661692ad6e8e969ab9c8c` |

**Vector 2** — [VEST-4 root cipher, 128-bit key 00000000000000000000000000000080, no IV: first 128 keystream bits](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000080` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `0f87786dec8d07b146b887a93b117ee9` |

**Vector 3** — [VEST-4 root cipher, 128-bit key ffffffffffffffffffffffffffffffff, no IV: first 128 keystream bits](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `8a7b5332c7e856830c2f9d57736ac6b5` |

**Vector 4** — [VEST-4 root cipher, all-zero 128-bit key, IV 01000000000000000000000000000000: first 128 keystream bits](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `01000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `be316f44840e3bd759862a9a26810b2b` |

**Vector 5** — [VEST-4 root cipher, all-zero 128-bit key, IV aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: first 128 keystream bits](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `65858bec962b64325ea149ec11f53867` |

---

[← All algorithms](../README.md)
