# CryptMT3 (DarkCrypt)

> CryptMT version 3: an F2-linear (SFMT-family) generator combined with a nonlinear multiplicative filter with memory (Matsumoto, Saito, Nishimura, Hagita). Key and IV are packed into 128-bit blocks, concatenated, duplicated, and whitened with the digits of pi before a multiplicative 'booter' seeds the output filter. The DarkCrypt Total Commander plugin implements the published reference algorithm essentially verbatim for a 512-bit key and 512-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Makoto Matsumoto, Mutsuo Saito, Takuji Nishimura, Mariko Hagita |
| Year | 2007 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/stream/darkcrypt-cryptmt3.js`](../../../algorithms/stream/darkcrypt-cryptmt3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 1 byte (8 bits) to 1248 bytes (9984 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unproven multiplicative filter | CryptMT's security relies on an integer-multiplication-based nonlinear filter whose resistance to algebraic/statistical attack is less well understood than LFSR-only designs; it was not selected for the eSTREAM portfolio. | Use a vetted, portfolio-selected stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [CryptMT Stream Cipher Version 3 (Hiroshima University)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/cryptMT3-book1.pdf)
- [Reference implementation (magurosan/CryptMT)](https://github.com/magurosan/CryptMT)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mt3 — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `16c2831f942a0205bb448977fb9d5ecf 5e94e40a3b4e4bd193c26baafbce05db 6dd9b17d11ecc2ef2e49b6c136638576 7def6b6c2e81cd5f1a4220b61f04d008 919fcfe754964b8da34c45ef41478985 65b1d2906d26c4bda7e3c753478bbc6a 89cb9c30b6b1cd076d69bf1ca45c8343 e8d4aad3fc339c7c7634ff34a9aa6363` |

**Vector 2** — [DarkCrypt Mt3 — incrementing key, zero IV, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `16c3811c902f0402b34d837cf79050c0 4e85f6192f5b5dc68bdb71b1e7d31bc4 4df8935e35c9e4c806609cea1a4eab59 4dde595f1ab4fb68227b1a8d2339ee37` |

**Vector 3** — [DarkCrypt Mt3 — non-zero key and IV, 20-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22 578cc1f62b6095caff34699ed3083d72 a7dc11467bb0e51a4f84b9ee23588dc2 f72c6196cb00356a9fd4093e73a8dd12` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6d3f00d2a` |
| `expected` | `0604d310f087c985351a64aac5eec3520b23e4a0` |

---

[← All algorithms](../README.md)
