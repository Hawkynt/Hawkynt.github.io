# Panama (DarkCrypt)

> Panama belt-and-mill construction used as a keystream generator (PRNG mode), as implemented in the DarkCrypt Total Commander plugin. Distinct from the Panama hermetic hash/MAC mode. 256-bit key, 256-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Joan Daemen, Craig Clapp |
| Year | 1998 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/stream/darkcrypt-panama.js`](../../../algorithms/stream/darkcrypt-panama.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Cryptanalytic weaknesses | Panama's compression function has known collision/distinguishing attacks; the PRNG mode is unanalyzed for stream-cipher use. | Use a vetted modern stream cipher. |

## Documentation

- [Panama Specification (FSE'98)](http://www.weidai.com/scan-mirror/md.html#Panama)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt keystream, incremental key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `18bfb00205af08bb4e294f897aedd0ab e99a80b203a3e25d53de52929c02c2cf 2b66dee8dd0de55cc17a8877f9bbd02e 4ea046c1997ec0d86cf4cb122fe17e75 4cd8ad9306221c72f772ddce75504016 fa43150b49e7d79e303488a4b2150b45 57da010d74a300375687994f2cae9c87 767d6448a9cf30fba41be0ac39ff2271` |

**Vector 2** — [DarkCrypt incremental plaintext, incremental key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `18beb20101aa0ebc4620458276e0dea4 f98b92a117b6f44a4bc74889801fdcd0 0b47fccbf928c37be953a25cd596fe01 7e9174f2ad4bf6ef54cdf12913dc404a` |

**Vector 3** — [DarkCrypt Panama — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `51696579a2eb522e3f583b213bdba819 ccf024a8385436b4239264ffcaa84301 62a9ac95789b7aaf03d7986fa221c8a8` |

---

[← All algorithms](../README.md)
