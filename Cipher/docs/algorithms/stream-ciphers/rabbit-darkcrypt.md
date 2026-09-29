# Rabbit (DarkCrypt)

> DarkCrypt port of the Rabbit stream cipher. Identical state machine to RFC 4503, but the keystream words are serialized in little-endian order instead of RFC 4503's byte-swapped output format.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Martin Boesgaard, Mette Vesterager, Thomas Pedersen, Jesper Christiansen, Ove Scavenius |
| Year | 2003 |
| Origin | Not specified |
| Source | [`algorithms/stream/darkcrypt-rabbit.js`](../../../algorithms/stream/darkcrypt-rabbit.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4503 Specification](https://tools.ietf.org/html/rfc4503)
- [eSTREAM Portfolio](https://www.ecrypt.eu.org/stream/)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Cryptico Rabbit Reference Source (eSTREAM archive)](https://web.archive.org/web/20240708120501/https://www.ecrypt.eu.org/stream/p3ciphers/rabbit/rabbit_p3source.zip)
- [DarkCrypt / Zarya Total Commander plugin](https://totalcmd.ru/plugring/darkcryptTC.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Rablib -- sequential key/IV, 128 zero bytes](https://totalcmd.ru/plugring/darkcryptTC.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `a8f7e69b6940a78d136a5c154a157952 a6e4235859e30220ea686436bb38ef53 9c2940556b09ecd7fea2b0ac8307f169 6265a3d644281c39c9cd5e1e2f9be4d0 0d482cb85a874aa55197d99f877c9d91 a1489eac8571e85bb7cd2a2d8ff4c183 b91f57377310fde711b6ecd2a8e98887 e1b3bcfbc0c29134e109c3b92dac44cd` |

**Vector 2** — [DarkCrypt Rablib -- sequential key/IV, incrementing 64-byte input](https://totalcmd.ru/plugring/darkcryptTC.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `a8f6e4986d45a18a1b63561e4618775d b6f5314b4df61437f2717e2da725f14c bc0862764f2ccaf0d68b9a87af2adf46 525491e5701d2a0ef1f4642513a6daef` |

**Vector 3** — [eSTREAM Rabbit Set 6, vector#3 - stream[0..63], exercises IV setup](https://raw.githubusercontent.com/cantora/avr-crypto-lib/master/testvectors/rabbit-verified.test-vectors)

| Field | Value |
| --- | --- |
| `key` | `0f62b5085bae0154a7fa4da0f34699ec` |
| `iv` | `288ff65dc42b92f9` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `613cb0ba96aff6cacf2a459a102a7f78 ca985cf8fdd1474018758e36ae9923f5 19d13d718daf8d7c0c109b79d5749439 b7efa4c4c9c8d29dc5b3888314a6816f` |

**Vector 4** — [Crypto++ / eSTREAM reference rabbit.txt - all-zero key, no IV setup](https://github.com/weidai11/cryptopp/blob/master/TestVectors/rabbit.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `02f74a1c26456bf5ecd6a536f05457b1a78ac689476c697b390c9cc515d8e888` |

---

[← All algorithms](../README.md)
