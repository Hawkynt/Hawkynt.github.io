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

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt ZK-Crypt v3 — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `bb3a598264069344c7a3d1c0d6b6eb4f 7eb4098e7fb2135053c9edde467f33c5 cd2d8364a1f38307ade7a8a365b589fe e90c2d0ee81e790d06875b6c7d6d867a ccaea351d4819026740ebe2e4cd31837 458b48d77fa991823defb988a7602e2b e25815cded92720379bfa7709f80926f f5153a5f8b2c6c05f95c4d1e07fb8ed2` |

---

[← All algorithms](../README.md)
