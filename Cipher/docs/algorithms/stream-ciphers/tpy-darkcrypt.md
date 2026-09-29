# TPy (DarkCrypt)

> Tweaked-IV-setup variant of Py by Biham and Seberry (2007), fixing the equivalent-IV weakness of the original Py while keeping its key setup and round function unchanged. As implemented in the DarkCrypt Total Commander plugin, which hardcodes a 512-bit key and 512-bit IV.

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
| Source | [`algorithms/stream/darkcrypt-tpy.js`](../../../algorithms/stream/darkcrypt-tpy.js) |

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
| Distinguishing attacks | Crowley and Paul/Preneel/Sekar published distinguishing attacks on TPy independent of the key schedule fix. | Use a vetted modern cipher. |

## Documentation

- [eSTREAM Py Phase 2 page](https://www.ecrypt.eu.org/stream/pyp2.html)
- [Py (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Py_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Biham, Seberry - "Tweaking the IV Setup of the Py Family of Stream Ciphers"](https://www.ecrypt.eu.org/stream/papersdir/2007/038.ps)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt TPy keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `9757dfc4e1f7caf9c04013c7269f05a5 5886a19930dd0cd81ca74a2f6eea4ec2 dffb3ed25d10deb24387a064e90b6aeb 5e95f9017273d9653fa9cc28a72f08e7 83f2647815bccad5caa41423f79cfdec 6c1f8f7461dc21b01c80d8152a6d09b6 5fd1f0ed2f942987dab01aacee09124f 5593ecebdce0d166eb8d33d19ac9c09c` |

---

[← All algorithms](../README.md)
