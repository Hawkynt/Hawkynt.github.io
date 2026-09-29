# Leviathan

> Large-state eSTREAM candidate with 4096-bit internal state. Uses 8 parallel LFSRs with nonlinear S-box filter for high security margin. Designed by David McGrew but eliminated in Phase 2 due to performance concerns.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | David McGrew |
| Year | 2005 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/leviathan.js`](../../../algorithms/stream/leviathan.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Performance Issues | Large state causes poor performance, eliminated from eSTREAM Phase 2 | — |
| Cryptanalytic Concerns | Various cryptanalytic issues identified during evaluation | — |

## Documentation

- [eSTREAM Leviathan Page](https://www.ecrypt.eu.org/stream/leviathan.html)
- [eSTREAM Project](https://www.ecrypt.eu.org/stream/)

## References

- [Leviathan NESSIE Submission Archive (Spec and Reference Source)](https://web.archive.org/web/20110812030110/https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/leviathan.zip)
- [NESSIE Project Archive](https://www.cosic.esat.kuleuven.be/nessie/)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Leviathan Test Vector - Basic

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `input` | `4c617267652073746174652074657374` |
| `expected` | `c66722497fc085671eb4ad666198fc1d` |

**Vector 2** — Leviathan Test Vector - All Zeros

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `4e756c6c206b6579207465737470` |
| `expected` | `2d160f0f4308061a431706101713` |

---

[← All algorithms](../README.md)
