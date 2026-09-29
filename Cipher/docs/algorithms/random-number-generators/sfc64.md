# SFC64

> Small Fast Counting (SFC64) is a high-quality 64-bit PRNG by Chris Doty-Humphrey designed for the PractRand test suite. It combines a chaotic invertible mapping with a counter to guarantee no small cycles and passes rigorous statistical tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Chris Doty-Humphrey |
| Year | 2010 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/sfc64.js`](../../../algorithms/random/sfc64.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 24 bytes (192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [PractRand: Chris Doty-Humphrey's PRNG Test Suite](http://pracrand.sourceforge.net/)
- [PractRand RNG Engines Documentation](http://pracrand.sourceforge.net/RNG_engines.txt)
- [NumPy SFC64 Implementation](https://github.com/numpy/numpy/blob/main/numpy/random/src/sfc64/sfc64.h)
- [NumPy SFC64 Documentation](https://numpy.org/doc/stable/reference/random/bit_generators/sfc64.html)

## References

- [NumPy Random BitGenerators](https://numpy.org/doc/stable/reference/random/bit_generators/sfc64.html)
- [PractRand Statistical Test Suite](http://pracrand.sourceforge.net/)
- [Zig Standard Library SFC64](https://github.com/ziglang/zig/blob/master/lib/std/rand/Sfc64.zig)
- [TestU01 Statistical Testing](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (0,0,0,1) after 12-iteration warmup: outputs 13-28 (128 bytes) - verified against Zig stdlib](https://github.com/ziglang/zig/blob/master/lib/std/rand/Sfc64.zig)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000000000000000000000000000000000000000000001` |
| `skip` | `12` |
| `outputSize` | `128` |
| `input` | `null` |
| `expected` | `3acfa029e3cc6041f5b6515bf2ee419c 1259635894a29b610b6ae75395f8ebd6 225622285ce302e2520d28611395cb21 db909c818901599d8ffd195365216f57 e8c4ad5e258ac04a8f8ef2c89fdb63ca f9865b01d98d8e2f46555871a65d08ba 66868677c6298fcd2ce15a7e6329f57d 0b2f1833ca91ca794b0890ac9bf453ca` |

**Vector 2** — [Seed (1,0,0,1): Minimal seed with a=1 - raw outputs 1-10 without warmup (80 bytes)](https://numpy.org/doc/stable/reference/random/bit_generators/sfc64.html)

| Field | Value |
| --- | --- |
| `seed` | `000000000000000100000000000000000000000000000000000000000001` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `00000000000000020000000000000002 00000000000000150000000012000028 00120000240240d4002402417102542b 021302560b404ce517f168db1b98d28a cf0ac2a06233f8978d741151c5de2e2d` |

**Vector 3** — [Seed (0x123456789abcdef0, 0xfedcba9876543210, 0x1111111111111111, 1): Mixed values - raw outputs 1-8](https://github.com/numpy/numpy/blob/main/numpy/random/src/sfc64/sfc64.c)

| Field | Value |
| --- | --- |
| `seed` | `123456789abcdef0fedcba98765432101111111111111111000000000001` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `1111111111111101985cfaa8bef49231 ccbddddddddddd4fc1ad5876af21abb3 e2706544fc42af2946e2915c8ab00489 54ac4021de481ea65c9f963e576504a5` |

**Vector 4** — [Seed (0xffffffffffffffff, 0xffffffffffffffff, 0xffffffffffffffff, 1): Maximum values - raw outputs 1-6](http://pracrand.sourceforge.net/)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffffffffffffffffffffffffffffffffffff00000001` |
| `outputSize` | `48` |
| `input` | `null` |
| `expected` | `ffffffffffffffffffdffffffffffff9 ffdffffffffffff9febffffff6ffffcd fd9723ffca000004f34a23ffaf059595` |

**Vector 5** — [Seed (12345, 67890, 11111, 1) after 12-iteration warmup: outputs 13-24 - production-ready sequence](http://pracrand.sourceforge.net/RNG_engines.txt)

| Field | Value |
| --- | --- |
| `seed` | `000000000000303900000000000109320000000000002b6700000001` |
| `skip` | `12` |
| `outputSize` | `96` |
| `input` | `null` |
| `expected` | `69550d9d4d386db6eca597ffdc9a4c92 c6eed53dd7b6aec759500586198793fd c856e96e59e62425b285cba09b53e356 393f3e0474f39ebaa1bceb9afa2369a5 ca966f721b7991440018b8868727b44e b946eeae735ae30f83cfabf75c47a394` |

**Vector 6** — [Seed (0,0,0,1): Raw outputs 1-8 without warmup - demonstrates initial state evolution](https://github.com/ziglang/zig/blob/master/lib/std/rand/Sfc64.zig)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000000000000000000000000000000000000000000001` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `00000000000000010000000000000002 000000000000000c000000000900001f 000900001b012083001b0120cf024a89 0120024bc721e0b80d0b3628ed8124b6` |

---

[← All algorithms](../README.md)
