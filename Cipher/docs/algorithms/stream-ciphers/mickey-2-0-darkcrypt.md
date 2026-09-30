# MICKEY 2.0 (DarkCrypt)

> MICKEY 2.0 mutual irregular-clocking stream cipher, 128-bit key / 128-bit IV variant with 160-bit R and S registers (DarkCrypt's "Mickey 128 bit"). Both registers clock every step, each choosing between two shift rules via cross-register control bits, matching the published MICKEY 2.0 construction scaled up. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Steve Babbage, Matthew Dodd (Vodafone Group R&D); DarkCrypt build by Alexander Myasnikov |
| Year | 2005 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/darkcrypt-mickey.js`](../../../algorithms/stream/darkcrypt-mickey.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [eSTREAM MICKEY Page](https://www.ecrypt.eu.org/stream/mickeypf.html)
- [The Stream Cipher MICKEY 2.0 (Babbage and Dodd)](https://www.ecrypt.eu.org/stream/p3ciphers/mickey/mickey_p3.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [DarkCrypt / Zarya Total Commander plugin](https://totalcmd.ru/plugring/darkcryptTC.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mickey -- sequential key, zero IV, 128 zero bytes](https://totalcmd.ru/plugring/darkcryptTC.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `ca56d02c4ce8ce73d6d4c006eed71bd4 5e4127655d6436243dffa66725c88d85 a226bce37d9163b0a97359c1363a7208 504d5ece00d6f92865c7abadd32dbb16 11e6f343329cab72c22efef487cfd708 8ca91049c0ebf143ed90bedecb4903f1 bce8be313eb3203a0fbf727de4f01da0 51074a46b3fdae6456d5bdc112cb6ffe` |

**Vector 2** — [DarkCrypt Mickey -- sequential key, zero IV, incrementing 64-byte input (fresh setup)](https://totalcmd.ru/plugring/darkcryptTC.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ca57d22f48edc874deddca0de2da15db 4e5035764971203325e6bc7c39d5939a 82079ec059b44597815a73ea1a175c27 607c6cfd34e3cf1f5dfe9196ef108529` |

**Vector 3** — [DarkCrypt Mickey — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `521c75c6cfb378c51664a3cb60d3a392 dc666b8fb241b05522f5f010667a7439 b805ea0a547682feae328605e979fc43` |

---

[← All algorithms](../README.md)
