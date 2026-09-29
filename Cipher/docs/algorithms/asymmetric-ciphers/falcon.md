# FALCON

> Lattice signature scheme over NTRU, a NIST post-quantum round 3 finalist and now a draft standard as FN-DSA. A signature is a short vector of the ring Z[x]/(x^n + 1) whose image under the public key is the hashed message, which makes it the most compact post-quantum signature of the finalists. This file verifies signatures and does not produce them: signing needs Gaussian sampling over the lattice's LDL tree in the fast Fourier domain, where an error yields a signature that still verifies everywhere while leaking the private key, so it is left out rather than approximated. Verification is implemented for both parameter sets and checked against all 200 published Known Answer Test signatures.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Digital Signature |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Pierre-Alain Fouque, Jeffrey Hoffstein, Paul Kirchner, Vadim Lyubashevsky, Thomas Pornin, Thomas Prest, Thomas Ricosset, Gregor Seiler, William Whyte, Zhenfei Zhang |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/falcon.js`](../../../algorithms/asymmetric/falcon.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 897 bytes (7176 bits); 1793 bytes (14344 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Signing is not implemented here | This file verifies signatures and cannot produce them. Anything that expects to sign with it will fail rather than emit a weak signature: CreateInstance(false) returns null. | Use a reference implementation to sign. This one checks the result. |
| The sampler is the whole security argument | In a complete FALCON, a signature leaks nothing only because it is drawn from a discrete Gaussian of exactly the right width over the lattice. A sampler that is merely close still produces signatures that verify, and recovering the private key from a few thousand of them is known to be practical. | Never accept a FALCON signing implementation that has not reproduced the published Known Answer Test signatures exactly. |
| Verification here is not constant time | Decoding rejects malformed input by returning early and the norm is accumulated with a short circuit, so timing reveals how a bad signature is bad. Verification handles public data only, so this matters less than it would when signing. | Treat this as a reference implementation of verification rather than a hardened one. |

## Documentation

- [FALCON specification (round 3)](https://falcon-sign.info/falcon.pdf)
- [FALCON project page](https://falcon-sign.info/)
- [NIST PQC round 3 submissions](https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions)
- [Fast Fourier orthogonalization](https://eprint.iacr.org/2017/690)

## References

- [Round 3 submission package and Known Answer Tests](https://falcon-sign.info/falcon-round3.zip)
- [FN-DSA, the NIST draft standard](https://csrc.nist.gov/pubs/fips/206/ipd)
- [NTRU lattices](https://en.wikipedia.org/wiki/NTRU)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [FALCON-512 falcon512-KAT.rsp record 0: the published signature verifies and yields its message](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `096ba86cb658a8f445c9a5e4c28374be c879c8655f68526923240918074d0147 c03162e4a49200648c652803c6fd7509 ae9aa799d6310d0bd42724e063592018 …` (897 bytes; the full value is in the source) |
| `input` | `026833b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (691 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 2** — [FALCON-512 falcon512-KAT.rsp record 0: the verdict on the published signature is acceptance](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `096ba86cb658a8f445c9a5e4c28374be c879c8655f68526923240918074d0147 c03162e4a49200648c652803c6fd7509 ae9aa799d6310d0bd42724e063592018 …` (897 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `026833b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (691 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 3** — [FALCON-512 falcon512-KAT.rsp record 1: the published signature verifies and yields its message](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `09baccc8d6c916c9ad12e3e49881f732 b84870ce5976921d197a00d226ab8825 430da78f19b0e7a12129ecb739d4a05c 5ebb0019f0c610e14556a0b4c7a48e2e …` (897 bytes; the full value is in the source) |
| `input` | `026908e25538484cd7f1613248fe6c9f 6b4ec14be684c6defdd1e41333b6e905 2ac4340e314eea2c99f7225d5ce2ceac 61930a07503fb59f7c2f936a3e075481 …` (725 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 4** — [FALCON-1024 falcon1024-KAT.rsp record 0: the published signature verifies and yields its message](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `0a0441a9b73f494d16556680b12b0f44 6a652700e4304151bc310683c43f20ab 28492ff580708068fa064275c1b0d084 52fc7c324154929ca850d4e6f3425b0f …` (1793 bytes; the full value is in the source) |
| `input` | `04ce33b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (1305 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 5** — [FALCON-1024 falcon1024-KAT.rsp record 0: the verdict on the published signature is acceptance](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `0a0441a9b73f494d16556680b12b0f44 6a652700e4304151bc310683c43f20ab 28492ff580708068fa064275c1b0d084 52fc7c324154929ca850d4e6f3425b0f …` (1793 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `04ce33b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (1305 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 6** — [FALCON-512: a modified message must not verify under its own signature](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `096ba86cb658a8f445c9a5e4c28374be c879c8655f68526923240918074d0147 c03162e4a49200648c652803c6fd7509 ae9aa799d6310d0bd42724e063592018 …` (897 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `026833b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d91c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (691 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 7** — [FALCON-512: a modified signature must not verify](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `096ba86cb658a8f445c9a5e4c28374be c879c8655f68526923240918074d0147 c03162e4a49200648c652803c6fd7509 ae9aa799d6310d0bd42724e063592018 …` (897 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `026833b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (691 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 8** — [FALCON-512: record 0's signature must not verify under record 1's public key](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `09baccc8d6c916c9ad12e3e49881f732 b84870ce5976921d197a00d226ab8825 430da78f19b0e7a12129ecb739d4a05c 5ebb0019f0c610e14556a0b4c7a48e2e …` (897 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `026833b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (691 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 9** — [FALCON-1024: a FALCON-512 signature must not verify under a FALCON-1024 public key](https://falcon-sign.info/falcon-round3.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `0a0441a9b73f494d16556680b12b0f44 6a652700e4304151bc310683c43f20ab 28492ff580708068fa064275c1b0d084 52fc7c324154929ca850d4e6f3425b0f …` (1793 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `026833b3c07507e4201748494d832b6e e2a6c93bff9b0ee343b550d1f85a3d0d e0d704c6d17842951309d81c4d8d734f cbfbeade3d3f8a039faa2a2c9957e835 …` (691 bytes; the full value is in the source) |
| `expected` | `00` |

---

[← All algorithms](../README.md)
