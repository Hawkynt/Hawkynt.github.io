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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt TPypy keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e1f7caf9269f05a530dd0cd86eea4ec2 5d10deb2e90b6aeb7273d965a72f08e7 15bccad5f79cfdec61dc21b02a6d09b6 2f942987ee09124fdce0d1669ac9c09c 0ad3dabdef6d7d7d3cf36d89b001d20b 1e263b4221934ed48776bf856a3f8440 47b78623e31c6c4c5812379f14307ea7 95d379a005c91c24ddb1eff4a3135bd1` |

---

[← All algorithms](../README.md)
