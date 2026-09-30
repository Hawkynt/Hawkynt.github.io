# Moustique

> Self-synchronizing stream cipher built around a 96-bit conjugated cellular shift register whose feedback rule is driven by the produced ciphertext bit, followed by a 7-stage compression pipeline that reduces 128 register bits to one keystream bit. Uses a 96-bit key and a 104-bit starting value consumed as a 105-clock warm-up.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Joan Daemen, Paris Kitsos |
| Year | 2005 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/stream/darkcrypt-moustique.js`](../../../algorithms/stream/darkcrypt-moustique.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 12 bytes (96 bits) |
| Nonce sizes | 13 bytes (104 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Cryptanalysis of the Self-Synchronizing Stream Cipher Moustique (Käsper, Rijmen, Bjørstad, Rechberger, Robshaw, Sekar)](https://www.iacr.org/archive/asiacrypt2008/53500204/53500204.pdf) | — | — |

## Documentation

- [The Self-Synchronizing Stream Cipher Moustique (Daemen and Kitsos)](https://www.ecrypt.eu.org/stream/p3ciphers/moustique/moustique_p3.pdf)
- [eSTREAM Moustique Page](https://www.ecrypt.eu.org/stream/moustiquep3.html)

## References

- [DarkCrypt / Zarya Total Commander plugin](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [eSTREAM Moustique testvalues.txt - zero key, zero starting value, zero plaintext](https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000` |
| `iv` | `00000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ffc02501a57e0bf7840e8b8fe2edef46` |

**Vector 2** — [eSTREAM Moustique testvalues.txt - zero key, zero starting value, all-ones plaintext](https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000` |
| `iv` | `00000000000000000000000000` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `00000000000000000000000000000000` |

**Vector 3** — [eSTREAM Moustique testvalues.txt - zero key, zero starting value, counting plaintext](https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000` |
| `iv` | `00000000000000000000000000` |
| `input` | `0123456789abcdef0123456789abcdef` |
| `expected` | `fee35ee5484164a0fee95934fd771361` |

**Vector 4** — [eSTREAM Moustique testvalues.txt - zero key, zero starting value, descending plaintext](https://web.archive.org/web/20070326181649if_/http://www.ecrypt.eu.org:80/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/mosquito/moustique.tar.gz?view=tar)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000` |
| `iv` | `00000000000000000000000000` |
| `input` | `fedcba9876543210fedcba9876543210` |
| `expected` | `0123172a369bce1d035f3447ccb75001` |

**Vector 5** — [DarkCrypt Moustique - 96-bit key, zero starting value, incrementing 64-byte input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b` |
| `iv` | `00000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `0001021c69bbf834446db204fe215faa 5c9dcebd7d420f1b95b50687eb641265 064b1664db647d5976dd3d4ebd7542a1 1fff0fb491ca8ff9686f5d094d72fb33` |

**Vector 6** — [DarkCrypt Moustique — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2` |
| `iv` | `073c71a6db10457aafe4194e83` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `81632d46f6435a5c08e47baaae51d874 e2d49eeedde551c6bcce0155d033e763 60bd7aa1b8ae485fadcb6267aa5fe928` |

---

[← All algorithms](../README.md)
