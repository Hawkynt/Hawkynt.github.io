# ChaCha8 (DarkCrypt)

> Reduced-round (8-round) ChaCha variant with the original Bernstein state layout (64-bit block counter + 64-bit nonce, instead of RFC 7539's 32-bit counter + 96-bit nonce). Matches the DarkCrypt Total Commander plugin's ChaCha implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Daniel J. Bernstein (base cipher); DarkCryptTC (parameterization) |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/darkcrypt-chacha8.js`](../../../algorithms/stream/darkcrypt-chacha8.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |
| Nonce sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Bernstein: ChaCha, a variant of Salsa20](https://cr.yp.to/chacha/chacha-20080128.pdf)
- [RFC 7539: ChaCha20 and Poly1305 for IETF Protocols (for comparison)](https://tools.ietf.org/html/rfc7539)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Bernstein's Original ChaCha Reference Implementation (eSTREAM submission)](https://cr.yp.to/streamciphers/timings/estreambench/submissions/salsa20/chacha8/ref/chacha.c)
- [DarkCryptTC](https://sourceforge.net/projects/darkcrypttc/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Chacha - 128-byte keystream (key=00..1F, nonce=0)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `4015b28f6e12ab6ad9e8667b31c51233 f78f172790b2d94f326b2ed7ffbcbecb ff9ead365f89ce3b6f4055bc759d90fd 8f831d27c7b0df93b3b9ed8238a256d6 761a6e0fc8b2b859f5a9f3ae170a7599 b0b023ce79d7659b32ee79373e727289 712ff289f30f641fcd822ff8e656ffd8 725691f839a7b433a5b61053d99baee0` |

**Vector 2** — [DarkCrypt Chacha - enc of 00..3F (key=00..1F, nonce=0)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `nonce` | `0000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `4014b08c6a17ad6dd1e16c703dc81c3c e79e053484a7cf582a7234cce3a1a0d4 dfbf8f157bace81c47697f9759b0bed2 bfb22f14f385e9a48b80d7b9049f68e9` |

---

[← All algorithms](../README.md)
