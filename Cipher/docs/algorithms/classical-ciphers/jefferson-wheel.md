# Jefferson Wheel

> Polyalphabetic substitution cipher using rotating wheels with randomly arranged alphabets. Invented by Thomas Jefferson around 1795 as a mechanical encryption device.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Thomas Jefferson |
| Year | 1795 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/classical/jefferson-wheel.js`](../../../algorithms/classical/jefferson-wheel.js) |

## Security

**Status:** 🎓 Educational Only

Historical educational cipher. Vulnerable to frequency analysis with sufficient ciphertext. Demonstrates early mechanical cryptographic engineering.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Vulnerable to frequency analysis attacks when sufficient ciphertext is available | — | — |
| With enough plaintext-ciphertext pairs, wheel alphabets can be recovered | — | — |

## Documentation

- [Jefferson Papers at Library of Congress](https://www.loc.gov/collections/thomas-jefferson-papers/)
- [Cryptographic History](https://en.wikipedia.org/wiki/Jefferson_disk)
- [NSA Cryptologic History](https://www.nsa.gov/about/cryptologic-heritage/)

## References

- [Thomas Jefferson Foundation](https://www.monticello.org/)
- [Cipher Machines History](https://www.cryptomuseum.com/)
- [American Cryptology Museum](https://www.nsa.gov/about/cryptologic-heritage/museum/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [dCode worked example - JEFFERSON on the 25 standard wheels, read one row below](https://www.dcode.fr/jefferson-wheel-cipher)

| Field | Value |
| --- | --- |
| `key` | `32357c31` |
| `input` | `4a4546464552534f4e` |
| `expected` | `464859474d4e59424c` |

**Vector 2** — [Offset zero is the identity row - the plaintext row is the ciphertext row](https://en.wikipedia.org/wiki/Jefferson_disk)

| Field | Value |
| --- | --- |
| `key` | `32357c30` |
| `input` | `41545441434b41544441574e` |
| `expected` | `41545441434b41544441574e` |

---

[← All algorithms](../README.md)
