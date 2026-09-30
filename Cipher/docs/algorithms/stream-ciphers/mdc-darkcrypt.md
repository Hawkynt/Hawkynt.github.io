# MDC (DarkCrypt)

> Self-keying CFB stream cipher built on the standard MD5 compression function, with a 100-round self-referential key schedule that scrambles both the chaining state and MD5's own round-constant table from the 512-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-mdc.js`](../../../algorithms/stream/darkcrypt-mdc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |
| IV sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed construction | Ad-hoc self-keying MD5-based CFB with a mutable round-constant table; no public design rationale or cryptanalysis; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mdc — keystream from incrementing key, zero IV, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `d8723082565e48ae1ba2f1c65dc9eec7 6653665ec3b4baaa7e6e2f715c5b7cbd 350d6b46727bac680a5d7b4057f7a994 36c287dc4ea8e7ea3e92a788cb83bb36 638ac1c7f59bfa4ffcf2670c9cf35aa1 65deec679a6634e7177dfb362a2918dd d574757fdff6d6a8af3007e0880fa164 ada591fcfa93d703eda08d46e37625ef` |

**Vector 2** — [DarkCrypt Mdc — incrementing key, zero IV, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `0000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `d8733281525b4ea913abfbcd51c4e0c8 af56081da8ca49a9c4ddf02943cb2d5c e6a6614297a26457b330575f96b463e5 0eb5e014e1d7f0b163e66b92d1a7b61e` |

**Vector 3** — [DarkCrypt Mdc — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457a` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `2e2a484944b2d56b05f06612af14366e c204d3aafb9589503bc220568a31d7a0 308d6fdc092ea54491472ba728129680` |

---

[← All algorithms](../README.md)
