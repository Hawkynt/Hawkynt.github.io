# Shannon (DarkCrypt)

> Shannon stream cipher (Hawkes, McDonald, Paddon, Rose, Wiggers de Vries), 256-bit key / 128-bit nonce, keystream-only path (MAC unused). Unmodified port of the published Qualcomm reference algorithm, as implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Philip Hawkes, Cameron McDonald, Michael Paddon, Gregory Rose, Miriam Wiggers de Vries |
| Year | 2007 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/darkcrypt-shannon.js`](../../../algorithms/stream/darkcrypt-shannon.js) |

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
| Limited public cryptanalysis | Shannon has received comparatively little independent cryptanalysis; not recommended for new designs. | Use a modern vetted stream cipher such as ChaCha20. |

## Documentation

- [Design and Primitive Specification for Shannon](https://eprint.iacr.org/2007/044)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Reference implementation of the Shannon cipher](https://github.com/timniederhausen/shannon)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Shannon — incrementing key, zero nonce, 128-byte zero keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `0ee2138f44128488c2420f73e456e8c6 9b882661cdbad4599ff1450cf3c404fe 51e404ad44d6b91e033baa73b68e02a4 19e4890205125a4db883de138ba9941f 84cebab0ea8b1aeb5b24dfe7ffd03039 9494cbbec37498d04d4f8b3b3563b241 0319d85c8fa845960d798127ff5431e4 b93ecca5ff8946213aeb27046ce8d6fc` |

**Vector 2** — [DarkCrypt Shannon — incrementing key/plaintext, zero nonce](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `0ee3118c4017828fca4b0578e85be6c9 8b993472d9afc24e87e85f17efd91ae1 71c5268e60f39f392b1280589aa32c8b 29d5bb3131276c7a80bae428b794aa20` |

**Vector 3** — [DarkCrypt Shannon — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec11365b80a5caef14395e83a8cdf2173c6186` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `54f4cf98a4d8edaef4456c73136a5e59 c9a6bac3ccbe8e2ad28f1331b2bed69c 4ba38bfb36b1b3906727dd0d4597eb14` |

---

[← All algorithms](../README.md)
