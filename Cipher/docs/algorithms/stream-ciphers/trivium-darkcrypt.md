# Trivium (DarkCrypt)

> Standard eSTREAM Trivium NLFSR (93+84+111 bit state, 80-bit key, 80-bit IV, 1152-round warm-up) as implemented in the DarkCrypt Total Commander plugin, with one deviation: the 32-bit-word keystream generator emits each 32-bit group of output bits in reversed order before packing into bytes.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Christophe De Canniere, Bart Preneel (base Trivium design); DarkCrypt port by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-trivium.js`](../../../algorithms/stream/darkcrypt-trivium.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard output packing | Reverses the bit order within each 32-bit keystream word before use; produces a different (but equally structured) keystream than standard Trivium. Unanalyzed variant, not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [eSTREAM: Trivium (base algorithm)](https://www.ecrypt.eu.org/stream/e2-trivium.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Trivium — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `iv` | `00000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `4e96d199fe4c6ae13b3b616dcbfa0b2d f36df09d38ef2951a0df7c5214c07e66 611200d0b88baf0032e18d3f67449869 c942445af2ec268bcf8e1861e9940ea8 df0792f8f02e9fa9403fff520ce3f762 f756e59a1038071f294511c05330383d b49cb83d3f205c81d406fa193494f743 6842aa1735f0a05887dc730834530eac` |

**Vector 2** — [DarkCrypt Trivium — incrementing key/plaintext, zero IV](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `iv` | `00000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `4e97d39afa496ce633326b66c7f70522 e37ce28e2cfa3f46b8c6664908dd6079 413322f39cae89271ac8a7144b69b646 f9737669c6d910bcf7b7225ad5a93097` |

**Vector 3** — [DarkCrypt Trivium — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e3358` |
| `iv` | `073c71a6db10457aafe4` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `8aaf51f506c4a9f661bd704454646957 f12b5268bd2eeaca9714081fe2788b03 af48b40438aed09f06c24747a4131b62` |

---

[← All algorithms](../README.md)
