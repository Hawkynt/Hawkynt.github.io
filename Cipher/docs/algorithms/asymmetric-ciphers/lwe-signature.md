# LWE-Signature

> Lyubashevsky's Fiat-Shamir-with-aborts signature over unstructured LWE. The public key is T = A·S for a plain matrix A over Z_q and a ternary secret S; a signature is a sparse challenge c together with z = y + S·c, and the verifier recomputes A·z − T·c, which equals the commitment A·y exactly. The abort is the point of the construction: a z outside a box smaller than the one y was drawn from is discarded and the signer retries, which makes the accepted z uniform on that box and independent of the secret. Dilithium is this scheme over a polynomial ring.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Lattice-Based Digital Signature |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Vadim Lyubashevsky |
| Year | 2009 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/lwe-signature.js`](../../../algorithms/asymmetric/lwe-signature.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Parameters are not a published set](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf) | — | No standard fixes a parameter set for this construction, and the one here was chosen for correctness rather than from a lattice-attack analysis. Use ML-DSA (FIPS 204), which is this scheme over a ring with parameters that have been analysed |
| [Omitting the abort leaks the secret](https://eprint.iacr.org/2011/537) | — | Returning a z that falls outside the acceptance box, rather than retrying, makes the signature distribution depend on S and leaks it over many signatures. The bound is enforced on both sides here and must not be relaxed |
| [Published demonstration seed](https://eprint.iacr.org/2011/537) | — | The seed in the test vectors is printed in the source and confers no confidentiality. Supply a secret seed of SEED_LENGTH random octets for any use beyond demonstration |

## Documentation

- [Lyubashevsky - Fiat-Shamir With Aborts (Asiacrypt 2009)](https://www.iacr.org/archive/asiacrypt2009/59120596/59120596.pdf)
- [Lyubashevsky - Lattice Signatures Without Trapdoors (Eurocrypt 2012)](https://eprint.iacr.org/2011/537)
- [Regev - On Lattices, Learning with Errors, Random Linear Codes, and Cryptography](https://cims.nyu.edu/~regev/papers/qcrypto.pdf)
- [Peikert - A Decade of Lattice Cryptography](https://eprint.iacr.org/2015/939)

## References

- [FIPS 204 - ML-DSA, the standardised ring version of this construction](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf)
- [FIPS 202 - SHA-3 and the SHAKE extendable-output functions](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LWE-Signature round trip, 3-octet message](https://eprint.iacr.org/2011/537)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `616263` |
| `expected` | `616263` |

**Vector 2** — [LWE-Signature round trip, message of zero octets only](https://eprint.iacr.org/2011/537)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `00000000000000000000000000000000` |

**Vector 3** — [LWE-Signature round trip under a second seed](https://eprint.iacr.org/2011/537)

| Field | Value |
| --- | --- |
| `key` | `f0e0d0c0b0a090807060504030201000ffeeddccbbaa99887766554433221100` |
| `input` | `4c57452d5369676e6174757265207465737420766563746f72` |
| `expected` | `4c57452d5369676e6174757265207465737420766563746f72` |

---

[← All algorithms](../README.md)
