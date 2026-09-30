# Py6 (DarkCrypt)

> Reduced-state variant of Py by Biham and Seberry: a 64-entry (6-bit) rolling permutation P and a 68-entry rolling word array Y, same round structure and two-word output as Py but far cheaper key/IV setup. Ported from the DarkCrypt Total Commander plugin, which hardcodes a 256-bit key and 256-bit IV.

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
| Source | [`algorithms/stream/darkcrypt-py6.js`](../../../algorithms/stream/darkcrypt-py6.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Nonce sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing / key-recovery attacks | Py6 shares Py's broken IV setup and was superseded by the tweaked TPy6. | Use TPy6 or a vetted modern cipher. |

## Documentation

- [eSTREAM Py Phase 2 page](https://www.ecrypt.eu.org/stream/pyp2.html)
- [Py (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Py_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Biham, Seberry - C Code of Py6, eSTREAM submission package](https://www.ecrypt.eu.org/stream/py.html)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Py6 keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `76f4f37ef99618f05f6e37915b5f155b 11baa364135804add08f5993c755c704 b7fdc77ef8f8c05f290c039847874a90 2e043e337ecad27bdee53ecb4a1d9906 f9953c55c6c5847b11e6e8d129d96086 eb78d2980ae6554e3dafff17422681a4 ca95ac40d0fbe93c2263887d87a80d6d 9ff19933f6ca642fa56cbcc42f58269b` |

**Vector 2** — [DarkCrypt Py6 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `6c3b779461499366b8845a1f6ddfe9f9 a349f9213ab91354b10c0bfa63330c42 edfcfdd300a47465bac2538464796484` |

---

[← All algorithms](../README.md)
