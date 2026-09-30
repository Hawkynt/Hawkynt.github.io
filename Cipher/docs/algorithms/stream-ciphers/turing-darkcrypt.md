# Turing (DarkCrypt)

> Turing stream cipher (Rose and Hawkes, Qualcomm), 256-bit key / 128-bit IV variant. LFSR + keyed S-box mixing, algorithm matches the published reference exactly; DarkCrypt build reads key/IV words little-endian but emits round output big-endian.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Gregory G. Rose, Philip Hawkes (Qualcomm); DarkCrypt build by Alexander Myasnikov |
| Year | 2003 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/darkcrypt-turing.js`](../../../algorithms/stream/darkcrypt-turing.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Guess-and-determine attacks | Published cryptanalysis identified weaknesses in the key/IV setup; not recommended for new designs. | Use a modern vetted stream cipher such as ChaCha20. |

## Documentation

- [Turing: A Fast Stream Cipher (FSE 2003)](https://eprint.iacr.org/2002/185)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Qualcomm reference Turing implementation (Java port)](https://github.com/fflewddur/quick-turing)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Turing — incrementing key, zero IV, 128-byte zero keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `4d7493826d9fcab9f64219393d36668a d588f7903198a26d1a0a4f5cad0c372a 5321107cfb703201800ca37ae5124dde f478511972ef7a6580d57f43b4d18b5b 5c728162844f8e8919635f9f8a132516 58d92f3d0712b1d883fff75ee78e10a2 691bc5fd2be82d9f91d8f442fae56deb 9367fa1fa057decc0da0357b7b44d04e` |

**Vector 2** — [DarkCrypt Turing — incrementing key/plaintext, zero IV](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `4d759181699accbefe4b1332313b6885 c599e583258db47a02135547b1112935 7300325fdf551426a8258951c93f63f1 c449632a46da4c52b8ec457888ecb564` |

**Vector 3** — [DarkCrypt Turing — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `d2f6007498f39094312c27237ee6c07b 8482b6bb86d854f051b537ad96290970 a18022bb349fe7b60da41e58a37cde3c` |

---

[← All algorithms](../README.md)
