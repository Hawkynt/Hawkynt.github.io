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

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

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

---

[← All algorithms](../README.md)
