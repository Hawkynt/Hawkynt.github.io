# Py (DarkCrypt)

> Py ("Roo") eSTREAM Phase 2 candidate by Biham and Seberry, using two rolling arrays (a 260-word Y array and a 256-byte permutation P) indexed by a continuously advancing round counter. Ported from the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 256-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Rolling-Array Stream Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Eli Biham, Jennifer Seberry |
| Year | 2005 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/stream/darkcrypt-py.js`](../../../algorithms/stream/darkcrypt-py.js) |

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
| Distinguishing / key-recovery attacks | Wu and Preneel, and others, broke Py's IV setup with chosen-IV attacks; superseded by the tweaked TPy. | Use TPy or a vetted modern cipher. |

## Documentation

- [eSTREAM Py Phase 2 page](https://www.ecrypt.eu.org/stream/pyp2.html)
- [Py (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Py_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [eSTREAM reference C source (py.c)](https://github.com/Yawolf/py-cipher)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Py keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `2d92f053176f06e956c924da00218c5a 84f2c9e513def4ea5785c7ee8aea32e1 c190fcecf208b72ae5a2f2b1c8e801fe 1a93785ea5ef503ecd159c0757e40e50 910c8ab04f8116711ce1431f6c2f040a 1b80e3c158689230dcbb6db3d32e53f5 d7f67bea16441e6adbb581e7f0aa4e40 a12f269bddd280ac345fbb0a2cde8628` |

**Vector 2** — [DarkCrypt Py — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `1da910fcbaa0aaa5857718fde48dfb01 4b60be5152ea5a3d906c4e0ae969dc3b 6d220b0450e8899d3fef3c8365e0ad48` |

---

[← All algorithms](../README.md)
