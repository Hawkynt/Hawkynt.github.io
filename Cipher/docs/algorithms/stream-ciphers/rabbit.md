# Rabbit

> High-speed stream cipher with 513-bit internal state using 8 state variables, 8 counter variables, and 1 carry bit. Designed for software implementations with 128-bit keys and optional 64-bit IV.

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
| Source | [`algorithms/stream/rabbit.js`](../../../algorithms/stream/rabbit.js) |

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

## References

- [Cryptico Rabbit Reference Source (eSTREAM archive)](https://web.archive.org/web/20240708120501/https://www.ecrypt.eu.org/stream/p3ciphers/rabbit/rabbit_p3source.zip)
- [Crypto++ Rabbit Implementation](https://github.com/weidai11/cryptopp/blob/master/rabbit.cpp)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 4503 Appendix A.1 - keystream without IV, key 1 (all zero), S[0]..S[2]](https://datatracker.ietf.org/doc/html/rfc4503#appendix-A.1)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `b15754f036a5d6ecf56b45261c4af702 88e8d815c59c0c397b696c4789c68aa7 f416a1c3700cd451da68d1881673d696` |

**Vector 2** — [RFC 4503 Appendix A.1 - keystream without IV, key 2, S[0]..S[2]](https://datatracker.ietf.org/doc/html/rfc4503#appendix-A.1)

| Field | Value |
| --- | --- |
| `key` | `912813292e3d36fe3bfc62f1dc51c3ac` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `3d2df3c83ef627a1e97fc38487e2519c f576cd61f4405b8896bf53aa8554fc19 e5547473fbdb43508ae53b20204d4c5e` |

**Vector 3** — [RFC 4503 Appendix A.1 - keystream without IV, key 3, S[0]..S[2]](https://datatracker.ietf.org/doc/html/rfc4503#appendix-A.1)

| Field | Value |
| --- | --- |
| `key` | `8395741587e0c733e9e9ab01c09b0043` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `0cb10dcda041cdac32eb5cfd02d0609b 95fc9fca0f17015a7b7092114cff3ead 9649e5de8bfc7f3f924147ad3a947428` |

**Vector 4** — [RFC 4503 Appendix A.2 - keystream with IV setup, IV 1 (all zero), S[0]..S[2]](https://datatracker.ietf.org/doc/html/rfc4503#appendix-A.2)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `c6a7275ef85495d87ccd5d376705b7ed 5f29a6ac04f5efd47b8f293270dc4a8d 2ade822b29de6c1ee52bdb8a47bf8f66` |

**Vector 5** — [RFC 4503 Appendix A.2 - keystream with IV setup, IV 2, S[0]..S[2]](https://datatracker.ietf.org/doc/html/rfc4503#appendix-A.2)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `c373f575c1267e59` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `1fcd4eb9580012e2e0dccc9222017d6d a75f4e10d12125017b2499ffed936f2e ebc112c393e738392356bdd012029ba7` |

**Vector 6** — [RFC 4503 Appendix A.2 - keystream with IV setup, IV 3, S[0]..S[2]](https://datatracker.ietf.org/doc/html/rfc4503#appendix-A.2)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `a6eb561ad2f41727` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `445ad8c805858dbf70b6af23a151104d 96c8f27947f42c5baeae67c6acc35b03 9fcbfc895fa71c17313df034f01551cb` |

---

[← All algorithms](../README.md)
