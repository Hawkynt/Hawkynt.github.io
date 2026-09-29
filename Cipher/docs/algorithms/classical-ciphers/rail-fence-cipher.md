# Rail Fence Cipher

> Classical transposition cipher writing plaintext diagonally on successive rails of imaginary fence, then reading horizontally. Simple zigzag pattern with configurable number of rails. Easily broken by brute force due to limited key space.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unknown (Classical) |
| Year | 1800 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/classical/railfence.js`](../../../algorithms/classical/railfence.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Very limited key space (number of rails), easily brute forced even by hand](https://en.wikipedia.org/wiki/Rail_fence_cipher) | — | None - cipher is fundamentally insecure |
| [Character frequencies preserved, making statistical analysis possible](http://practicalcryptography.com/ciphers/classical-era/rail-fence/) | — | Use only for educational demonstrations |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Rail_fence_cipher)
- [Educational Tutorial](https://www.dcode.fr/rail-fence-cipher)
- [Cryptii Implementation](https://cryptii.com/pipes/rail-fence-cipher)

## References

- [Practical Cryptography](http://practicalcryptography.com/ciphers/classical-era/rail-fence/)
- [GeeksforGeeks Tutorial](https://www.geeksforgeeks.org/rail-fence-cipher-encryption-decryption/)
- [Educational Implementation](https://www.dcode.fr/rail-fence-cipher)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Classic rail fence example with 3 rails](https://en.wikipedia.org/wiki/Rail_fence_cipher)

| Field | Value |
| --- | --- |
| `key` | `33` |
| `input` | `5745415245444953434f5645524544464c454541544f4e4345` |
| `expected` | `574543524c5445455244534f45454645414f4341495644454e` |

**Vector 2** — [Educational example with 4 rails](https://www.geeksforgeeks.org/rail-fence-cipher-encryption-decryption/)

| Field | Value |
| --- | --- |
| `key` | `34` |
| `input` | `41545441434b41544441574e` |
| `expected` | `4141544b544e544344574141` |

**Vector 3** — [Simple 2 rail example](https://www.dcode.fr/rail-fence-cipher)

| Field | Value |
| --- | --- |
| `key` | `32` |
| `input` | `48454c4c4f` |
| `expected` | `484c4f454c` |

**Vector 4** — [Mixed case with spaces](https://cryptii.com/pipes/rail-fence-cipher)

| Field | Value |
| --- | --- |
| `key` | `33` |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `486f72656c206f6c6c5764` |

**Vector 5** — [Long message with 5 rails](http://practicalcryptography.com/ciphers/classical-era/rail-fence/)

| Field | Value |
| --- | --- |
| `key` | `35` |
| `input` | `544845515549434b42524f574e464f58 4a554d50534f5645525448454c415a59 444f47` |
| `expected` | `54424a5244484b5258554554594f4543 4f4f4d56485a4751495746504f454155 4e534c` |

---

[← All algorithms](../README.md)
