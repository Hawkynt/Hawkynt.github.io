# UUencode

> UUencoding (Unix-to-Unix encoding) binary-to-text encoding developed by Mary Ann Horton at UC Berkeley in 1980. Encodes 3 bytes into 4 characters using printable ASCII characters with space (0x20) offset. Widely used in early email and UUCP systems.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Binary-to-Text |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Mary Ann Horton |
| Year | 1980 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/encoding/uuencode.js`](../../../algorithms/encoding/uuencode.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [POSIX IEEE Std 1003.1-2017](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)
- [UUencoding Wikipedia](https://en.wikipedia.org/wiki/Uuencoding)
- [Original UUCP Documentation](https://www.tuhs.org/Archive/Documentation/UUCP/)

## References

- [Berkeley Unix Manual](https://docs.freebsd.org/44doc/usd/10.uucp/paper.html)
- [UUencode Online Tool](https://www.browserling.com/tools/uuencode)
- [RFC 1341 MIME UUencoding](https://tools.ietf.org/html/rfc1341)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [UUencode empty string test](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [UUencode single zero byte test](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `2020` |

**Vector 3** — [UUencode single character 'M' test](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | `4d` |
| `expected` | `3330` |

**Vector 4** — [UUencode two character 'Ma' test](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | `4d61` |
| `expected` | `333624` |

**Vector 5** — [UUencode three character 'Man' test](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | `4d616e` |
| `expected` | `3336254e` |

**Vector 6** — [UUencode four character 'Test' test - full 3-byte group ('Tes') plus a 1-byte tail group ('t') encoded as its full 2 characters](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | `54657374` |
| `expected` | `352635533d20` |

**Vector 7** — [UUencode 128-byte regression test - final group is a 2-byte tail, not the whole input, so the old data.length-based tail check silently dropped its 3rd character](https://pubs.opengroup.org/onlinepubs/9699919799/utilities/uuencode.html)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 38362541383625413836254138362541 3836254138362541383624` |

---

[← All algorithms](../README.md)
