# CARACACHS (PC3)

> Variable-key stream cipher using PRNG-based keystream generation. Created by Alexandre Pukall in 2000, later used by Lazarus Group (North Korean hackers) in cyber operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexandre Pukall (pseudonym: Caracachs) |
| Year | 2000 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/stream/caracachs.js`](../../../algorithms/stream/caracachs.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Nonce sizes | 0 bytes (0 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| No Formal Cryptanalysis | Cipher has not undergone formal security review or peer analysis | Use only for historical research or compatibility with legacy systems |
| State-Sponsored Usage | Used by Lazarus Group APT, potentially indicating exploitable weaknesses known to nation-state actors | Do not assume security - treat as potentially compromised |

## Documentation

- [Original CARACACHS Implementation](https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c)
- [Historical Archive (Internet Archive)](https://web.archive.org/web/*/http://membres.lycos.fr/caracachs)
- [Lazarus Group Analysis](https://www.kaspersky.com/about/press-releases/2017_lazarus-under-the-hood)

## References

- [PC Cipher Family (PC1-PC4)](https://gist.github.com/newsoft/)
- [Lazarus Group Malware Analysis](https://securelist.com/lazarus-under-the-hood/77908/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PC3 Reference Vector: 32-byte ASCII key](https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435` |
| `input` | `4142434445464748` |
| `expected` | `f592ad2e34ad59f9` |

**Vector 2** — [PC3 Reference Vector: Zero pattern with 32-byte key](https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c)

| Field | Value |
| --- | --- |
| `key` | `6162636465666768696a6b6c6d6e6f707172737475767778797a303132333435` |
| `input` | `3030303030303030` |
| `expected` | `848639d82ac3d7d6` |

**Vector 3** — [PC3 Short Key Test](https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c)

| Field | Value |
| --- | --- |
| `key` | `4b4559` |
| `input` | `54455354` |
| `expected` | `2bb0e377` |

**Vector 4** — [DarkCrypt Caracachs: keystream from 128 zero bytes, 32-byte incrementing key](https://totalcmd.net/plugring/darkcryptTC.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `dff1188b8eb116c923c9ef6207d49e1b 830697daf9feaff1b7a2c2371a603fe4 43932d7dd18728c632ab9c93e7fb242d b329afff9fb0c08fcda7b420f9da6aa9 a1c1c4cbf751b2f598e8f8ffcc9994ad 6feccfa9fce199958e0d9a1740e81a55 67bdf9e896d152ff64ebeac2c2d34472 e3f37f8890001667fe8e595fc3e1409b` |

**Vector 5** — [DarkCrypt Caracachs: encryption of 64 incrementing bytes, 32-byte incrementing key](https://totalcmd.net/plugring/darkcryptTC.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `dff0f9d6f3fd6ac6f16505a9014715ef 09ee717696ae6c1ea602ffd327fee2a0 dbe25d5086cf84a4685f0b3cf24ed0de 9e82f7844c52eacba7c7aec58afea1fc` |

---

[← All algorithms](../README.md)
