# Enigma Machine

> Simplified 3-rotor Enigma machine simulation for educational purposes. Historical WWII cipher machine with rotating mechanical rotors and electrical pathways. Uses reciprocal substitution through rotor wirings and reflector. Input domain: uppercase A-Z only. The machine is 26 keys, 26 lamps and 26 rotor contacts - it has no key for a digit, a space, a punctuation mark or a lowercase letter, and operators spelled such things out in the plaintext before enciphering. Anything outside A-Z is therefore refused by name and position rather than case-folded or passed through in clear, and A-Z round-trips exactly because the machine is reciprocal.

## Properties

| Property | Value |
| --- | --- |
| Category | Classical Ciphers |
| Sub-category | Classical Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Arthur Scherbius |
| Year | 1918 |
| Origin | 🇩🇪 Germany |
| Restricted input domain | Yes |
| Source | [`algorithms/classical/enigma.js`](../../../algorithms/classical/enigma.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [No Self-Encryption](https://en.wikipedia.org/wiki/Enigma_machine#Reflector) | No letter can encrypt to itself due to reflector design, reducing key space | Historical design flaw - avoid for real cryptography |
| [Rotor Stepping Patterns](https://en.wikipedia.org/wiki/Cryptanalysis_of_the_Enigma) | Predictable rotor advancement patterns enable statistical cryptanalysis | Educational use only - demonstrates importance of proper design |

## Documentation

- [Wikipedia Article](https://en.wikipedia.org/wiki/Enigma_machine)
- [Bletchley Park History](https://www.bletchleypark.org.uk/our-story/enigma)
- [Technical Description](https://en.wikipedia.org/wiki/Enigma_rotor_details)

## References

- [Enigma Simulator](https://www.cryptomuseum.com/crypto/enigma/sim/)
- [Educational Implementation](https://github.com/mikepound/enigma)
- [Historical Analysis](https://www.codesandciphers.org.uk/enigma/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Wikipedia canonical check - rotors I II III left to right, wide B reflector, ring settings A, start AAA, typing AAAAA gives BDZGO](https://en.wikipedia.org/wiki/Enigma_rotor_details)

| Field | Value |
| --- | --- |
| `key` | `414141313233` |
| `input` | `4141414141` |
| `expected` | `42445a474f` |

**Vector 2** — [The same check carried on to 25 letters, which crosses the right rotor's turnover at V and so exercises the middle rotor stepping](https://en.wikipedia.org/wiki/Enigma_rotor_details)

| Field | Value |
| --- | --- |
| `key` | `414141313233` |
| `input` | `41414141414141414141414141414141414141414141414141` |
| `expected` | `42445a474f5743584c544b5342544d43444c50424d55514f46` |

**Vector 3** — [Reciprocity - the machine is its own inverse, so the 25-letter ciphertext returns 25 A's on the same setting](https://en.wikipedia.org/wiki/Enigma_rotor_details)

| Field | Value |
| --- | --- |
| `key` | `414141313233` |
| `input` | `42445a474f5743584c544b5342544d43444c50424d55514f46` |
| `expected` | `41414141414141414141414141414141414141414141414141` |

**Vector 4** — [Start position ABC. No published source carries this value; it is here to cover a non-zero start position](https://en.wikipedia.org/wiki/Enigma_machine)

| Field | Value |
| --- | --- |
| `key` | `414243313233` |
| `input` | `48454c4c4f574f524c44` |
| `expected` | `524f4d554c4c42494242` |

---

[← All algorithms](../README.md)
