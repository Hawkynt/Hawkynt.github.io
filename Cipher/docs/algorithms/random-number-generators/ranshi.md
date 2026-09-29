# Ranshi

> Ranshi is a hardware-inspired shift register PRNG proposed by F. Gutbrod in 1995. It uses simple shift and XOR operations making it suitable for hardware simulation and FPGA implementations. The algorithm predates Mersenne Twister and offers fast generation with modest randomness quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Shift Register PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | F. Gutbrod |
| Year | 1995 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/random/ranshi.js`](../../../algorithms/random/ranshi.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Academic Reference (Database Systems Thesis, 2020)](http://wwwlgis.informatik.uni-kl.de/cms/fileadmin/publications/2020/thesis.pdf)
- [RetroComputing Discussion: Early Randomness Generation](https://retrocomputing.stackexchange.com/questions/2244/how-was-early-randomness-generated)
- [Related: XorShift Family](https://en.wikipedia.org/wiki/Xorshift)

## References

- [Hardware PRNG Techniques](https://www.nesdev.org/wiki/Random_number_generator)
- [Linear Feedback Shift Registers](https://en.wikipedia.org/wiki/Linear-feedback_shift_register)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-computed regression vector - seed 1, first 20 bytes (implementation consistency test)](https://en.wikipedia.org/wiki/Xorshift)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `00042021040806019dcca8c51255994f8ef917d1` |

**Vector 2** — [Self-computed regression vector - seed 0x12345678, first 32 bytes (deterministic output verification)](https://en.wikipedia.org/wiki/Xorshift)

| Field | Value |
| --- | --- |
| `seed` | `12345678` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `87985aa5155b24a34820f4c481b3ac98703a078829a8e24d89ca4f1dc5186e29` |

**Vector 3** — [Self-computed regression vector - seed 0xAAAAAAAA, first 24 bytes (pattern detection test)](https://en.wikipedia.org/wiki/Xorshift)

| Field | Value |
| --- | --- |
| `seed` | `aaaaaaaa` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `000d3ff5598a4d8c174377b14f18060bb4f17d07f16bc54f` |

**Vector 4** — [Self-computed regression vector - seed 0xFFFFFFFF, first 16 bytes (all-ones seed test)](https://en.wikipedia.org/wiki/Xorshift)

| Field | Value |
| --- | --- |
| `seed` | `ffffffff` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `0003e01ffc07fdff74bb9843f1cc88da` |

**Vector 5** — [Self-computed regression vector - seed 1 with skip, outputs 11-15 (long-term state verification)](https://en.wikipedia.org/wiki/Xorshift)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `20` |
| `skip` | `10` |
| `input` | `null` |
| `expected` | `9e6002cb591c9737b4b84b8a04e3f8ae0536aff5` |

---

[← All algorithms](../README.md)
