# Nihilist Cipher

> Russian revolutionary cipher combining Polybius square with additive key encryption for historical cryptography study.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Additive Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Russian Revolutionaries |
| Year | 1880 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/classical/nihilist.js`](../../../algorithms/classical/nihilist.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Nihilist Cipher Wikipedia](https://en.wikipedia.org/wiki/Nihilist_cipher)
- [Classical Cryptography Guide](http://practicalcryptography.com/ciphers/classical-era/nihilist/)

## References

- [Historical Cryptography](https://en.wikipedia.org/wiki/Nihilist_cipher)
- [Russian Revolutionary Ciphers](http://www.cryptomuseum.com/crypto/nihilist.htm)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Wikipedia worked example - square keyed ZEBRAS, additive key RUSSIAN, plaintext DYNAMITE WINTER PALACE](https://en.wikipedia.org/wiki/Nihilist_cipher)

| Field | Value |
| --- | --- |
| `key` | `5a45425241532c5255535349414e` |
| `input` | `44594e414d49544557494e54455250414c414345` |
| `expected` | `33372031303620363220333620363720 34372038362032362031303420353320 36322037372032372035352035372036 36203535203336203534203237` |

**Vector 2** — [Plain A-Z square, key NIHILIST. No published source carries this value; it covers the unkeyed square](https://en.wikipedia.org/wiki/Nihilist_cipher)

| Field | Value |
| --- | --- |
| `key` | `4e4948494c495354` |
| `input` | `41545441434b41544441574e` |
| `expected` | `34342036382036372033352034342034 39203534203838203437203335203735 203537` |

**Vector 3** — [Plain A-Z square, key RUSSIAN. No published source carries this value; it covers a key shorter than the message](https://en.wikipedia.org/wiki/Nihilist_cipher)

| Field | Value |
| --- | --- |
| `key` | `5255535349414e` |
| `input` | `5245564f4c5554494f4e` |
| `expected` | `3834203630203934203737203535203536203737203636203739203736` |

**Vector 4** — [Plain A-Z square, key CZAR. No published source carries this value; it covers a key longer than half the message](https://en.wikipedia.org/wiki/Nihilist_cipher)

| Field | Value |
| --- | --- |
| `key` | `435a4152` |
| `input` | `534543524554` |
| `expected` | `3536203730203234203834203238203939` |

---

[← All algorithms](../README.md)
