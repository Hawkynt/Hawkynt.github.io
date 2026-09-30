# F-FCSR (DarkCrypt)

> Feedback-with-Carry Shift Register (Galois FCSR) filter generator from the DarkCrypt Total Commander plugin. Non-standard 256-bit register variant with a custom feedback polynomial, 128-bit key and 128-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | FCSR Stream Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | François Arnault, Thierry Berger, Cédric Lauradoux (base F-FCSR); DarkCrypt variant by Alexander Myasnikov |
| Year | 2005 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-ffcsr.js`](../../../algorithms/stream/darkcrypt-ffcsr.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Broken family | The F-FCSR family was cryptanalytically broken; this non-standard variant is unanalyzed. | Use a modern vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [F-FCSR Specification (base algorithm)](https://www.ecrypt.eu.org/stream/ciphers/ffcsr/ffcsr.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Ffcsr — keystream (zero input)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `76ca63bf052e9a95075561334c58b548 f7fd37f3d211bcbcdef9179ada8227db 98454d5385979d0c2870dab8060ebfdb e1867588ffccc9103e9eba78e4e25e54 753831b76e78b0b5f80263c43b57efe6 18c838c23176f5cb3e87ecf323fa802a 6b91ccfba84d26d1052ed0c923ae3068 de16643f9934e513c232f6b99ae17363` |

**Vector 2** — [DarkCrypt Ffcsr — encryption of incrementing bytes 00..3f](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `76cb61bc012b9c920f5c6b384055bb47 e7ec25e0c604aaabc6e00d81c69f39c4 b8646f70a1b2bb2b0059f0932a2391f4 d1b747bbcbf9ff2706a78043d8df606b` |

**Vector 3** — [DarkCrypt Ffcsr — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `4751e5ea956a10aa6dcb1f90d60c8402 9a3103debe8b8f4ccb86bbe367609d46 6aa42ad8ca2d59f89d8215a8a680b3d6` |

---

[← All algorithms](../README.md)
