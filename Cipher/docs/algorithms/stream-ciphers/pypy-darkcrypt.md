# Pypy (DarkCrypt)

> Strengthened variant of Py by Biham and Seberry: same rolling-array key/IV setup as Py, but the round output stage is simplified to a single fixed rotation (18) producing one 32-bit word per round instead of two. Ported from the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 512-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Rolling-Array Stream Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Eli Biham, Jennifer Seberry |
| Year | 2006 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/stream/darkcrypt-pypy.js`](../../../algorithms/stream/darkcrypt-pypy.js) |

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
| Chosen-IV / distinguishing attacks | Pypy inherits Py's flawed IV setup; broken by chosen-IV attacks and superseded by the tweaked TPypy. | Use TPypy or a vetted modern cipher. |

## Documentation

- [eSTREAM Py Phase 2 page](https://www.ecrypt.eu.org/stream/pyp2.html)
- [Py (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Py_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Biham, Seberry - "Pypy: Another Version of Py"](https://www.ecrypt.eu.org/stream/papersdir/2006/038.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Pypy keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `108a776da56fee73215a9dc9742a6cd0 dfa653ac9c1c238d8912b0a989a7127a 94e25c603d91f10686270d71df2c2a58 8e316124462976c8badb9ed7c1db62b4 59749cecc8a443d61babf2db406e6708 6a0a46342359acca24cea2f9211267a6 9908ffa64ecb791a43393dc42d650491 51a9e03909829c1125558ea68d7c3f9f` |

**Vector 2** — [DarkCrypt Pypy — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22 578cc1f62b6095caff34699ed3083d72 a7dc11467bb0e51a4f84b9ee23588dc2 f72c6196cb00356a9fd4093e73a8dd12` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `73377697e55a2666d2af7a41dbd8c31e f749f682826de5ca75e5e59641c426a1 09fb41152626e020f6019375395845a8` |

---

[← All algorithms](../README.md)
