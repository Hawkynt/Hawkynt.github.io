# TPypy (DarkCrypt)

> Tweaked-IV-setup variant of Pypy by Biham and Seberry (2007), the strongest published member of the Py family: Pypy's single-word-per-round output function combined with the fixed equivalent-IV setup. As implemented in the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 512-bit IV.

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
| Source | [`algorithms/stream/darkcrypt-tpypy.js`](../../../algorithms/stream/darkcrypt-tpypy.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Nonce sizes | 64 bytes (512 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing attacks | Sekar, Paul and Preneel, and Rose/Crowley/Paul, published distinguishing attacks on TPypy's pseudorandom bit generation. | Use a vetted modern cipher. |

## Documentation

- [eSTREAM Py Phase 2 page](https://www.ecrypt.eu.org/stream/pyp2.html)
- [Py (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Py_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Biham, Seberry - "Tweaking the IV Setup of the Py Family of Stream Ciphers"](https://www.ecrypt.eu.org/stream/papersdir/2007/038.ps)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt TPypy keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e1f7caf9269f05a530dd0cd86eea4ec2 5d10deb2e90b6aeb7273d965a72f08e7 15bccad5f79cfdec61dc21b02a6d09b6 2f942987ee09124fdce0d1669ac9c09c 0ad3dabdef6d7d7d3cf36d89b001d20b 1e263b4221934ed48776bf856a3f8440 47b78623e31c6c4c5812379f14307ea7 95d379a005c91c24ddb1eff4a3135bd1` |

**Vector 2** — [DarkCrypt TPypy — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22 578cc1f62b6095caff34699ed3083d72 a7dc11467bb0e51a4f84b9ee23588dc2 f72c6196cb00356a9fd4093e73a8dd12` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `eb533b9a291df9740c50cbbe23156162 a48149f7344e207bc31ab0dc264d1f5a d48fff46a3237df8a4c56f8d08b8eee9` |

---

[← All algorithms](../README.md)
