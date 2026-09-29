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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Pypy keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `108a776da56fee73215a9dc9742a6cd0 dfa653ac9c1c238d8912b0a989a7127a 94e25c603d91f10686270d71df2c2a58 8e316124462976c8badb9ed7c1db62b4 59749cecc8a443d61babf2db406e6708 6a0a46342359acca24cea2f9211267a6 9908ffa64ecb791a43393dc42d650491 51a9e03909829c1125558ea68d7c3f9f` |

---

[← All algorithms](../README.md)
