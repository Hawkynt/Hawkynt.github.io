# Cortex Code

> Hierarchical sparse code inspired by neural network connectivity patterns. Uses multi-layer structure with sparse connections between layers to achieve capacity with polynomial complexity via successive cancellation. Applicable to distributed storage and neural network communication. Combines benefits of polar codes and LDPC codes with brain-inspired sparse activation patterns.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Hierarchical Sparse Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Conceptual Implementation |
| Year | 2018 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/cortex-code.js`](../../../algorithms/ecc/cortex-code.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Conceptual Implementation | WARNING: This is a conceptual implementation without verified test vectors from official sources. Use only for educational exploration of hierarchical sparse coding principles. | — |
| Decoding Complexity | Belief propagation decoder requires iterative message passing which may not converge for all error patterns | — |
| Sparse Connectivity Limitations | Sparse connections between layers may leave some error patterns undetectable | — |

## Documentation

- [Error Correction Zoo - LDPC Codes](https://errorcorrectionzoo.org/c/ldpc)
- [Error Correction Zoo - Polar Codes](https://errorcorrectionzoo.org/c/polar)
- [Error Correction Zoo - SC-LDPC Codes](https://errorcorrectionzoo.org/c/sc_ldpc)
- [Sparse Coding - Scholarpedia](http://www.scholarpedia.org/article/Sparse_coding)

## References

- [Spatially Coupled LDPC Codes](https://arxiv.org/abs/2004.06875)
- [Hierarchical Sparse Coding](https://arxiv.org/abs/1009.2139)
- [Polar Codes with SC Decoding](https://arxiv.org/abs/0807.3917)
- [Neural Sparse Representations](https://www.nature.com/articles/nn.3834)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Cortex (16,8) all-zero input (conceptual)](https://errorcorrectionzoo.org/c/ldpc)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 2** — [Cortex (16,8) single bit pattern (conceptual)](https://errorcorrectionzoo.org/c/ldpc)

| Field | Value |
| --- | --- |
| `input` | `0100000000000000` |
| `expected` | `00010100010100010001000000010001` |

**Vector 3** — [Cortex (16,8) alternating pattern (conceptual)](https://errorcorrectionzoo.org/c/ldpc)

| Field | Value |
| --- | --- |
| `input` | `0100010001000100` |
| `expected` | `00000101000001000000000101010100` |

---

[← All algorithms](../README.md)
