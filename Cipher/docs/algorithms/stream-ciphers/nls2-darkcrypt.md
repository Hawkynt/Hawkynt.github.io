# NLS2 (DarkCrypt)

> NLSv2 stream cipher (SOBER-family eSTREAM candidate) as implemented in the DarkCrypt Total Commander plugin. 17-word register with a rotate-based nonlinear feedback and an S-box-free nonlinear filter. Keystream-only port; the plugin's MAC mode is not exposed.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Philip Hawkes, Michael Paddon, Gregory G. Rose, Miriam Wiggers de Vries (Qualcomm) |
| Year | 2006 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/darkcrypt-nls2.js`](../../../algorithms/stream/darkcrypt-nls2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Specification for NLSv2 (New Stream Cipher Designs, LNCS 4986)](https://link.springer.com/chapter/10.1007/978-3-540-68351-3_6)
- [eSTREAM NLS project page](https://www.ecrypt.eu.org/stream/nls.html)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [eSTREAM NLSv2 reference implementation (nlsref.cpp / nlssbox.h)](https://github.com/crocs-muni/CryptoStreams/tree/master/streams/stream_ciphers/estream/nls)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Nls2lib — sequential key/IV, 128 zero bytes](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `f68ab7b995e75e768cc1b62082ea3117 a78d8d5bd0081ba01daeedd165c22813 ca93b50e5991c57484bd8bc1bff70982 82e68b572c2bfb7ad3803ff2581344f5 c66e2ae44dea01fb7b04b0c1c38f39e1 837c506f8d20a322241af75b7a9ba05e 79c89c8d9a5b21e0b5931fc148178ebe 7c1124908b8cb3121150d4c286a27d9c` |

**Vector 2** — [DarkCrypt Nls2lib — sequential key/IV, incrementing 64-byte input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `f68bb5ba91e2587184c8bc2b8ee73f18 b79c9f48c41d0db705b7f7ca79df360c eab2972d7db4e353ac94a1ea93da27ad b2d7b964181ecd4debb905c9642e7aca` |

**Vector 3** — [DarkCrypt Nls2lib — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `d117766fec9449b87bb8a94f91182173 a2ad79e5405797bffe7d7a8bbc68d3fa 40df73adb3a8b903840eabd1cc68011f` |

---

[← All algorithms](../README.md)
