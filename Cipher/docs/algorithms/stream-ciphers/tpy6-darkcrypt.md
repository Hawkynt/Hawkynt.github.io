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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt TPy6 keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `4ec12f0c0295bff2542946bafbcd0698 bfce5781b6e730547a0bd653c438f778 fa4150ff5a815d08d88e54a4d9158412 1ec60123ee8708f2fcafd257c677541e 1fa9fa5182aeda7d0fe0ae338b4933f0 8ba020d559a5a0650e283efdfaff8bf2 b3ed532b9882bc53749e1580469221cd c73489d2e9182ff380cda6b231e3eb66` |

---

[← All algorithms](../README.md)
