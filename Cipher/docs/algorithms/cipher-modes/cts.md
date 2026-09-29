# CTS

> Ciphertext Stealing (CTS) mode allows block ciphers to handle arbitrary-length plaintexts without padding by 'stealing' ciphertext bits from the penultimate block to pad the final block. This maintains the original plaintext length while providing the security properties of CBC mode. This implementation follows the CBC-CS3 ordering of NIST SP 800-38A Addendum, the variant used by RFC 3962 and Kerberos, in which the last two ciphertext blocks are always exchanged - including when the message length is an exact multiple of the block size.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Block Cipher Mode |
| Security status | 🛡️ Secure |
| Complexity | Intermediate |
| Inventor | Meyer, Matyas |
| Year | 1982 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/modes/cts.js`](../../../algorithms/modes/cts.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| IV sizes | 8 bytes (64 bits) to 32 bytes (256 bits) in steps of 8 bytes |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | Yes |

## Security

**Status:** 🛡️ Secure

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| IV Reuse | Reusing IV with same key reveals patterns. Always use unique IVs. | — |
| Minimum Length | Requires at least one full block. Cannot encrypt data shorter than block size. | — |
| Error Propagation | Like CBC, single-bit errors in ciphertext affect two plaintext blocks. | — |

## Documentation

- [RFC 3962 - AES Encryption for Kerberos 5](https://tools.ietf.org/rfc/rfc3962.txt)
- [NIST SP 800-38A - Addendum](https://csrc.nist.gov/publications/detail/sp/800-38a/addendum/final)
- [IEEE P1363 - CTS Definition](https://standards.ieee.org/standard/1363-2000.html)

## References

- Applied Cryptography — Bruce Schneier - CTS Mode
- Handbook of Applied Cryptography — Chapter 7 - Block Cipher Modes

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 3962 CTS - 17 bytes (one byte past a block boundary)](https://www.rfc-editor.org/rfc/rfc3962.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `636869636b656e207465726979616b69` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `4920776f756c64206c696b652074686520` |
| `expected` | `c6353568f2bf8cb4d8a580362da7ff7f97` |

**Vector 2** — [RFC 3962 CTS - 31 bytes (partial final block)](https://www.rfc-editor.org/rfc/rfc3962.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `636869636b656e207465726979616b69` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `4920776f756c64206c696b65207468652047656e6572616c20476175277320` |
| `expected` | `fc00783e0efdb2c1d445d4c8eff7ed2297687268d6ecccc0c07b25e25ecfe5` |

**Vector 3** — [RFC 3962 CTS - 32 bytes (exact multiple, last two blocks swapped)](https://www.rfc-editor.org/rfc/rfc3962.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `636869636b656e207465726979616b69` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `4920776f756c64206c696b65207468652047656e6572616c2047617527732043` |
| `expected` | `39312523a78662d5be7fcbcc98ebf5a897687268d6ecccc0c07b25e25ecfe584` |

**Vector 4** — [RFC 3962 CTS - 47 bytes (three blocks, partial final)](https://www.rfc-editor.org/rfc/rfc3962.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `636869636b656e207465726979616b69` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `4920776f756c64206c696b6520746865 2047656e6572616c2047617527732043 6869636b656e2c20706c656173652c` |
| `expected` | `97687268d6ecccc0c07b25e25ecfe584 b3fffd940c16a18c1b5549d2f838029e 39312523a78662d5be7fcbcc98ebf5` |

**Vector 5** — [RFC 3962 CTS - 48 bytes (three exact blocks)](https://www.rfc-editor.org/rfc/rfc3962.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `636869636b656e207465726979616b69` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `4920776f756c64206c696b6520746865 2047656e6572616c2047617527732043 6869636b656e2c20706c656173652c20` |
| `expected` | `97687268d6ecccc0c07b25e25ecfe584 9dad8bbb96c4cdc03bc103e1a194bbd8 39312523a78662d5be7fcbcc98ebf5a8` |

**Vector 6** — [RFC 3962 CTS - 64 bytes (four exact blocks)](https://www.rfc-editor.org/rfc/rfc3962.txt)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `636869636b656e207465726979616b69` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `4920776f756c64206c696b6520746865 2047656e6572616c2047617527732043 6869636b656e2c20706c656173652c20 616e6420776f6e746f6e20736f75702e` |
| `expected` | `97687268d6ecccc0c07b25e25ecfe584 39312523a78662d5be7fcbcc98ebf5a8 4807efe836ee89a526730dbc2f7bc840 9dad8bbb96c4cdc03bc103e1a194bbd8` |

---

[← All algorithms](../README.md)
