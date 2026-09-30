# ZK-Crypt v3 (DarkCrypt)

> eSTREAM Profile II (hardware) 'Variable Clocking Mechanism' stream cipher: three irregularly-clocked nLFSR data banks with independent small nLFSR clock generators, a pseudo-random long/short clock, dual substitution hash matrices and a cipher/MAC feedback network, as implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Carmi Gressel, Orr Dunkelman, Gabi Vago, Ran Granot, Aviad Kipnis, Michael Rimon, Yaakov Belenky (FortressGB); DarkCrypt port by Alexander Myasnikov |
| Year | 2006 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/stream/darkcrypt-zkcrypt3.js`](../../../algorithms/stream/darkcrypt-zkcrypt3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Reduced configuration | This build of the engine has the reference algorithm's optional 'Super tier' nLFSR bank compiled out, and several literal C expressions in the reference source evaluate to a constant rather than their apparent intent. The resulting keystream is bit-exact to the DarkCrypt implementation but is a specific, non-configurable instance of the general ZK-Crypt v3 design. | Use a vetted, actively analyzed stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [eSTREAM: ZK-Crypt (base algorithm)](https://www.ecrypt.eu.org/stream/zkcrypt.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt ZK-Crypt v3 — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `bb3a598264069344c7a3d1c0d6b6eb4f 7eb4098e7fb2135053c9edde467f33c5 cd2d8364a1f38307ade7a8a365b589fe e90c2d0ee81e790d06875b6c7d6d867a ccaea351d4819026740ebe2e4cd31837 458b48d77fa991823defb988a7602e2b e25815cded92720379bfa7709f80926f f5153a5f8b2c6c05f95c4d1e07fb8ed2` |

**Vector 2** — [DarkCrypt ZK-Crypt v3 — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5ca` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22578cc1f6` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `4404bd80ff85e990ecb75ea0007e84ab ac45c680890392bf5fcacfb60cf478c0 5a22e3e5845f33ce30f44ba9fc31f2ca` |

---

[← All algorithms](../README.md)
