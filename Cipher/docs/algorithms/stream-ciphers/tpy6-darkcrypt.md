# TPy6 (DarkCrypt)

> Tweaked-IV-setup variant of Py6 by Biham and Seberry (2007): same reduced-state key setup and round function as Py6, but the IV mixing derives a doubled-width feedback buffer and folds mixed bytes back into later rounds, removing the equivalent-IV weakness. As implemented in the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 256-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Rolling-Array Stream Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Eli Biham, Jennifer Seberry |
| Year | 2007 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/stream/darkcrypt-tpy6.js`](../../../algorithms/stream/darkcrypt-tpy6.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Nonce sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing / key-recovery attacks | Sekar, Paul and Preneel published attacks on TPy6's keystream generation and proposed further redesigns (TPy6-A/B). | Use a vetted modern cipher. |

## Documentation

- [eSTREAM Py Phase 2 page](https://www.ecrypt.eu.org/stream/pyp2.html)
- [Py (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Py_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Biham, Seberry - "Tweaking the IV Setup of the Py Family of Stream Ciphers"](https://www.ecrypt.eu.org/stream/papersdir/2007/038.ps)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt TPy6 keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `4ec12f0c0295bff2542946bafbcd0698 bfce5781b6e730547a0bd653c438f778 fa4150ff5a815d08d88e54a4d9158412 1ec60123ee8708f2fcafd257c677541e 1fa9fa5182aeda7d0fe0ae338b4933f0 8ba020d559a5a0650e283efdfaff8bf2 b3ed532b9882bc53749e1580469221cd c73489d2e9182ff380cda6b231e3eb66` |

**Vector 2** — [DarkCrypt TPy6 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `7679d9f05c072ee6d9bbb6ab8292ac4f 908f6553b0aa8641c922d20bb3af6fbd 1ca1c17e4fc4da6c5539d079a59252a0` |

---

[← All algorithms](../README.md)
