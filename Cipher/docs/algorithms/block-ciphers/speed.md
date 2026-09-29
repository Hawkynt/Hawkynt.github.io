# SPEED

> Unbalanced Feistel network by Yuliang Zheng over a queue of eight words. Each round builds one new word from a nonlinear Boolean combination of the other seven, rotates it by an amount derived from itself, and folds in the discarded tail word and a round key. Block width 64, 128 or 256 bits; key any multiple of 16 bits from 48 to 256; round count any multiple of 4 from 32 up.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Yuliang Zheng |
| Year | 1997 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/speed.js`](../../../algorithms/block/speed.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 6 bytes (48 bits) to 32 bytes (256 bits) in steps of 2 bytes |
| Block sizes | 8 bytes (64 bits); 16 bytes (128 bits); 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Broken by differential and related-key attacks | Hall, Kelsey, Rijmen, Schneier and Wagner broke the cipher at every published parameter set, including a differential attack on the full 48-round 128-bit version. | Use AES or another vetted cipher. |

## Documentation

- [The SPEED Cipher (Financial Cryptography '97, LNCS 1318)](https://ifca.ai/pub/fc97/m6.pdf)

## References

- [Cryptanalysis of SPEED (Hall, Kelsey, Rijmen, Schneier, Wagner; SAC'98)](https://www.schneier.com/wp-content/uploads/2016/02/paper-speed-sac.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Paper certification data — w=64, l=64, r=64](https://ifca.ai/pub/fc97/m6.pdf)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `blockSize` | `8` |
| `rounds` | `64` |
| `input` | `0000000000000000` |
| `expected` | `2e008019bc26856d` |

**Vector 2** — [Paper certification data — w=128, l=128, r=128](https://ifca.ai/pub/fc97/m6.pdf)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `blockSize` | `16` |
| `rounds` | `128` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `6c13e4b9c3171571ab54d816915bc4e8` |

**Vector 3** — [Paper certification data — w=256, l=256, r=256](https://ifca.ai/pub/fc97/m6.pdf)

| Field | Value |
| --- | --- |
| `key` | `605f5e5d5c5b5a595857565554535251504f4e4d4c4b4a494847464544434241` |
| `blockSize` | `32` |
| `rounds` | `256` |
| `input` | `1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100` |
| `expected` | `3de16cfa9a626847434e1574693fec1b3faa558a296b61d708b131ccba311068` |

---

[← All algorithms](../README.md)
