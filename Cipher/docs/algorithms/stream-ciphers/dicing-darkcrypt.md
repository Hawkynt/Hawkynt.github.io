# DICING (DarkCrypt)

> DICING synchronous stream cipher, 256-bit key / 256-bit IV variant matching DarkCrypt's "Dicing (256 bit)". Two GF(2^m)-based projector pairs form a clock-controlled dice mechanism and a table-driven combiner (four 32x8 S-box tables plus a key-derived mask) that emits 128-bit output blocks. Ported from the tweaked eSTREAM DICING-v2 reference construction.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Li An-Ping; DarkCrypt build by Alexander Myasnikov |
| Year | 2005 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/stream/darkcrypt-dicing.js`](../../../algorithms/stream/darkcrypt-dicing.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Nonce sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [A New Stream Cipher: DICING (Li An-Ping)](https://cr.yp.to/streamciphers/dicing/desc2.pdf)
- [eSTREAM DICING Page](https://www.ecrypt.eu.org/stream/dicingp3.html)

## References

- [DarkCrypt / Zarya Total Commander plugin](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Dicing - 256-bit key, zero IV keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `93fc3b3d41dbbf5ac6f39b58e5cd45fe be7487679dc56971147ddd4a7d9945ed 1a79d36d84a5854b2b5a4149bb18ad31 60656058e648cad582d9122c145ce3f8 a73abff437ac0e8c466561c11bb55dfc 1337bc358a4fa22054a0363ab1f13ab7 df4e599232df73d02ba40d6b5c91dd2a dfdfe562e956b891d39eddaa873b19f6` |

**Vector 2** — [DarkCrypt Dicing - 256-bit key, zero IV, incrementing 64-byte input (fresh setup)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `93fd393e45deb95dcefa9153e9c04bf1 ae65957489d07f660c64c75161845bf2 3a58f14ea080a36c03736b629735831e 5054526bd27dfce2bae028172861ddc7` |

**Vector 3** — [DarkCrypt Dicing — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22578cc1f62b6095caff34699ed3083d72` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `b672c7c05852b2667d40285148291679 08f5950111dacdb21ac7ca0fdb7635fa 3b69bfb8acd9c875cbfea08e1c1a71e3` |

---

[← All algorithms](../README.md)
