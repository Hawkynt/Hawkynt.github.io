# SSS (DarkCrypt)

> SSS ("Self-Synchronizing SOBER") stream cipher as implemented in the DarkCrypt Total Commander plugin. A 17-word, 16-bit register is fed with actual ciphertext (making the cipher self-synchronizing), combined with a key-dependent nonlinear S-box built from the fixed Skipjack F-table and Qbox. Keystream-only port; the CRC/MAC mode is not exposed by the DarkCrypt plugin's interface.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Philip Hawkes, Michael Paddon, Gregory G. Rose, Miriam Wiggers de Vries (Qualcomm) |
| Year | 2005 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/darkcrypt-sss.js`](../../../algorithms/stream/darkcrypt-sss.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Primitive Specification for SSS (eSTREAM, 2005)](https://www.ecrypt.eu.org/stream/ciphers/sss/sss.pdf)
- [eSTREAM SSS project page](https://www.ecrypt.eu.org/stream/sss.html)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [SSS (cipher) overview](https://handwiki.org/wiki/SSS_(cipher))

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sss — sequential key, zero IV, 128 zero bytes](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `f79aa3d05adf1648a68b96e4d34b186a 4bd71b7133b3df6a06dc6df395546109 4d0a0867c0c4f74dd10aefa99606e2a0 fdcbad30308babefbd489e586dd599c7 61f09e61b1b2feb0832b60bd4073df9b 9368fef4d28dec2e2308e64a1c17555e 697ca390d3f987e02850c73d00b26f17 256cfd52d37145d4823df98a20612c1a` |

**Vector 2** — [DarkCrypt Sss — sequential key, zero IV, incrementing 64-byte input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `f79bc79ce3274a75a16c8bcac8f27ed8 e9625a7bfd3b84c018bd1620f8c3f4e2 4b7ec42b1882645e4821495d0b116d68 2f910bcdb5cbb9d099a3b26aa0ba0d9d` |

**Vector 3** — [DarkCrypt Sss — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `9711b6b8c9584dac8499c6252ed6c76b 5f98eab18fa0529a9e8b5ca09a2020df 53ba54d7ab5e3d80edc4b280ed4dec50` |

---

[← All algorithms](../README.md)
