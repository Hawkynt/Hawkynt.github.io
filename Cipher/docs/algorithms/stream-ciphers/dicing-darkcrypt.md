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

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

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

---

[← All algorithms](../README.md)
