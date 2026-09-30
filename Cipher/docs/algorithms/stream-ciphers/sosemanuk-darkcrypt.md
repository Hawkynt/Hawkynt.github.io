# Sosemanuk (DarkCrypt)

> Sosemanuk stream cipher (eSTREAM Profile 1 software portfolio finalist) as implemented in the DarkCrypt Total Commander plugin. Combines a 10-word LFSR over GF(2^32), a finite state machine, and two Serpent-derived primitives (a truncated Serpent24 key schedule and a Serpent S2 output whitening round).

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Come Berbain, Olivier Billet, Anne Canteaut, Nicolas Courtois, Henri Gilbert, Louis Goubin, Aline Gouget, Louis Granboulan, Cedric Lauradoux, Marine Minier, Thomas Pornin, Herve Sibert |
| Year | 2005 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/stream/darkcrypt-sosemanuk.js`](../../../algorithms/stream/darkcrypt-sosemanuk.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Sosemanuk, a fast software-oriented stream cipher (design paper)](https://cr.yp.to/streamciphers/sosemanuk/desc.pdf)
- [eSTREAM Sosemanuk portfolio page](https://www.ecrypt.eu.org/stream/e2-sosemanuk.html)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Sosemanuk reference implementation (X-CRYPT project)](https://github.com/cchcc/SOSEMANUK/blob/master/C/SOSEMANUK.C)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sos — sequential key, zero IV, 128 zero bytes](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `2ad642926b0f1f68435ebfad013b04de fc6d5708210edf21fe5382f04793c68c c604cb9acfd4e93d19820a9030cb0247 52ace97037d7b5553b8742b68e1f4c5b 3846f97de8605a8427c8aac1308508ac f0b643ccd9a915651f55235df5f63b0c e3476cd68ac2a99af78141322edf6522 f55cc605497c608f734a4ebf1d661ef2` |

**Vector 2** — [DarkCrypt Sos — sequential key, zero IV, incrementing 64-byte input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `2ad740916f0a196f4b57b5a60d360ad1 ec7c451b351bc936e64a98eb5b8ed893 e625e9b9ebf1cf1a31ab20bb1ce62c68 629ddb4303e2836203be788db2227264` |

**Vector 3** — [DarkCrypt Sos — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `944975b1e56dc3b2438cbfa214d5da50 09c36224b79615892746a992316cbfc0 974f013d1232ba1d181a611102537ba6` |

---

[← All algorithms](../README.md)
