# Fubuki (DarkCrypt)

> Fubuki stream/block cipher built on an untempered Mersenne Twister (MT19937) generator: the key and initial value seed MT19937, whose raw output words pseudorandomly select and parameterize nine primitive encryption functions (four word-wise, four inter-word, one vertical-rotate) applied over four rounds per 128-bit block. DarkCrypt's "Fubuki (512 bit)" build fixes both the key and the initial value at 512 bits.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Makoto Matsumoto, Takuji Nishimura, Mariko Hagita, Mutsuo Saito; DarkCrypt build by Alexander Myasnikov |
| Year | 2005 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/stream/darkcrypt-fubuki.js`](../../../algorithms/stream/darkcrypt-fubuki.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Nonce sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Mersenne Twister and Fubuki Stream/Block Cipher (original eSTREAM submission)](https://cr.yp.to/streamciphers/fubuki/desc.pdf)
- [Cryptographic Mersenne Twister and Fubuki Stream/Block Cipher (extended version, IACR ePrint 2005/165)](https://eprint.iacr.org/2005/165.pdf)
- [eSTREAM CryptMT/Fubuki submission page](https://www.ecrypt.eu.org/stream/cryptmtfubuki.html)

## References

- [DarkCrypt / Zarya Total Commander plugin](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Fubuki - 512-bit key, zero initial value, 128 zero bytes](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e7a824ba3c50c8a7d88a534fae0aeacf 32a9e53a484b1ffd549ad8c24a1538e4 4ca2fcbc3d3d07d4f66238ec0786188a d559f1865b4d15937667934eef3dd1e2 83597c6c1792b3c0ac235173e4099100 617534faf737aa1bcdbe8c3e2cdcf6dd 8491da13d6b8da73868d5398f794d5ea c3df453d348b4efcec187694bbd13882` |

**Vector 2** — [DarkCrypt Fubuki - 512-bit key, zero initial value, incrementing 64-byte input (fresh setup)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `f8876dc89d3331a7bef5e9dcf2860402 b6a9a38864cbf13d65df3c30e312a643 c33516aa4d26eb44a44680d36582da86 de579aea2e88eeb788343c2991b9f07f` |

**Vector 3** — [DarkCrypt Fubuki — non-zero key and IV, 64-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22 578cc1f62b6095caff34699ed3083d72 a7dc11467bb0e51a4f84b9ee23588dc2 f72c6196cb00356a9fd4093e73a8dd12` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956 7390adcae704213e5b7895b2cfec0926` |
| `expected` | `d3cda9608ed731af6eb1d3c809849e73 a5cd5896a51fbb815cd7ae1cd8ec3b4a ad5df84cdb8758fc87a88ff4d87ddb5e ee4f8e41c85046547be14bca2abf4ff8` |

---

[← All algorithms](../README.md)
