# BATS

> Batched Sparse (BATS) Codes combine network coding with batching for efficient multicast in lossy networks. Inner code applies random linear combinations within batches; outer code organizes batches. Supports recoding at intermediate nodes. Achieves multicast capacity with low-complexity operations, ideal for wireless multihop networks.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Network Code |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Raymond Yeung, Shenghao Yang |
| Year | 2012 |
| Origin | 🌐 International |
| Source | [`algorithms/ecc/batched-sparse-code.js`](../../../algorithms/ecc/batched-sparse-code.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `supportsContinuousEncoding` | Yes |
| `supportsRecoding` | Yes |
| `supportsBatching` | Yes |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Batch Size Selection | Incorrect batch size affects coding efficiency. Too small: inefficient batching. Too large: complex linear algebra. | Select batch size b such that 2 &lt;= b &lt;= sqrt(k). Default b=2 works for most scenarios. |
| Field Size Requirements | Field size must be large enough to avoid singular matrices in generation matrices. GF(256) minimum recommended. | Use field size >= 256. Increase if encountering singular matrix errors during batch encoding. |
| Decoding Matrix Rank | Generation matrices must maintain full rank for successful decoding. Low-rank matrices cause recovery failure. | Monitor generation matrix rank during encoding. Discard and regenerate if rank deficiency detected. |

## Documentation

- [Batched Sparse Codes (Yang, Yeung, IEEE Trans. Inf. Theory 2014)](https://arxiv.org/abs/1206.5365)
- [Network Coding Research](https://en.wikipedia.org/wiki/Network_coding)
- [Fountain Codes Overview](https://zoo.cs.yale.edu/classes/cs434/cs434-2018-spring/readings/fountain-codes.pdf)

## References

- [simbats Reference Implementation (Shenghao Yang)](https://github.com/shhyang/simbats)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Single batch encoding test

Source: Self-computed: deterministic seeded RNG (seed=42), single batch encoding

| Field | Value |
| --- | --- |
| `k` | `8` |
| `batchSize` | `2` |
| `numBatches` | `4` |
| `seed` | `42` |
| `input` | `0102030405060708` |
| `expected` | `0102030405060708173a682a30a13159` |

**Vector 2** — Multi-batch with recoding test

Source: Self-computed: deterministic seeded RNG (seed=1042), multi-batch recoding

| Field | Value |
| --- | --- |
| `k` | `8` |
| `batchSize` | `2` |
| `numBatches` | `4` |
| `seed` | `1042` |
| `input` | `1011121314151617` |
| `expected` | `1011121314151617dffc11a04563f571` |

**Vector 3** — Recovery from mixed batches test

Source: Self-computed: deterministic seeded RNG (seed=2042), mixed-batch recovery

| Field | Value |
| --- | --- |
| `k` | `8` |
| `batchSize` | `2` |
| `numBatches` | `4` |
| `seed` | `2042` |
| `input` | `aabbccddeeff0011` |
| `expected` | `aabbccddeeff0011d1a311c3895fdb1b` |

**Vector 4** — Round-trip encoding/decoding test

Source: Self-computed: deterministic seeded RNG (seed=3042), full round-trip cycle

| Field | Value |
| --- | --- |
| `k` | `8` |
| `batchSize` | `2` |
| `numBatches` | `4` |
| `seed` | `3042` |
| `input` | `fffefdfcfbfaf9f8` |
| `expected` | `fffefdfcfbfaf9f8df4bdbde9be055a7` |

---

[← All algorithms](../README.md)
