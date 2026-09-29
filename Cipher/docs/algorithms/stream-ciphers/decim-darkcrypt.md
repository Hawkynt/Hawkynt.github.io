# DECIM (DarkCrypt)

> Non-standard DECIM-derived stream cipher (288-bit byte-per-bit LFSR, 128-bit key, 128-bit IV, 1152-round warm-up, standard 1-bit ABSG decimation with a raw non-ABSG fallback path supplying most output) as implemented in the DarkCrypt Total Commander plugin. Deviates substantially from the published eSTREAM DECIM specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Come Berbain, Olivier Billet, Anne Canteaut, Nicolas Courtois, Henri Gilbert, Louis Goubin, Aline Gouget, Louis Granboulan, Cedric Lauradoux, Marine Minier, Thomas Pornin, Herve Sibert |
| Year | 2005 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/stream/darkcrypt-decim.js`](../../../algorithms/stream/darkcrypt-decim.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard LFSR, filter and mixed decimation path | The 288-bit LFSR, its feedback taps, and its 14-tap nonlinear filter do not correspond to the published 192-bit-LFSR/7-variable-filter DECIM design, and most keystream bits bypass the ABSG decimation mechanism entirely via a raw fallback path in crypt(). This is an unanalyzed, non-standard construction only superficially related to DECIM. | Use a vetted, published stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Decim, a new stream cipher for hardware applications (eSTREAM submission)](https://www.ecrypt.eu.org/stream/p3ciphers/decim/decim_p3.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Decim — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `535799e1c601fbac6025a80feeeed2fe d772c4ff3b48341777ff80737e59cfb5 ebce023453a3d2cfb25c6889931b6cb1 fc4541969c1ff6420617673d47e77b94 fc345b80e5540e094005f1218310d793 ae24a0ae51d0c3347bdda0e82e708754 94555c05451c7f1ee71db7d3f5fd7de7 27bfcd1ff70521a9e132286dc6f8ce42` |

**Vector 2** — [DarkCrypt Decim — incrementing plaintext, incrementing key, zero IV](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `53569be2c204fdab682ca204e2e3dcf1 c763d6ec2f5d22006fe69a686244d1aa cbef20177786f4e89a7542a2bf36429e cc7473a5a82ac0753e2e5d067bda45ab` |

---

[← All algorithms](../README.md)
