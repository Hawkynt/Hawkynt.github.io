# Sfinks (DarkCrypt)

> eSTREAM Phase-2 Sfinks nonlinear filter generator (256-bit LFSR, GF(2^16) inversion filter, 80-bit key, 80-bit IV, 128-round resynchronization, 7-stage pipelined output combiner) as implemented in the DarkCrypt Total Commander plugin. Cross-validated against the authors' published ECRYPT reference implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | An Braeken, Joseph Lano, Nele Mentens, Bart Preneel, Ingrid Verbauwhede |
| Year | 2005 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/stream/darkcrypt-sfinks.js`](../../../algorithms/stream/darkcrypt-sfinks.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 10 bytes (80 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Algebraic attack margin | The authors' own security analysis places the algebraic attack complexity at approximately 2^108, which the paper itself describes as "quite close to the edge" for an 80-bit-security design; a weight-17 feedback polynomial and 16-bit inversion filter of algebraic immunity 6 leave limited security margin against fast algebraic attacks. | Use a vetted modern stream cipher (e.g. ChaCha20) for real-world confidentiality needs. |
| Fixed 80-bit key/IV, no authentication in this port | This port implements only the keystream generator; the paper's associated 64-bit LFSR-hash MAC construction is not reproduced. Reused (key, IV) pairs, as with any synchronous stream cipher, catastrophically break confidentiality. | Never reuse a (key, IV) pair; use an AEAD construction if integrity protection is required. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SFINKS: A Synchronous Stream Cipher for Restricted Hardware Environments (eSTREAM Phase 2)](https://www.ecrypt.eu.org/stream/p2ciphers/sfinks/sfinks_p2.pdf)
- [eSTREAM: Sfinks reference implementation and test vectors](https://www.ecrypt.eu.org/stream/e2-sfinks.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sfinks — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `iv` | `00000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `46abc6a2d7d2274c636a99ae3b093b9c a2cb1f269e4c791d7d32a5fd0fef52b1 524a3d21bff9d679a535bef58224720a b2542a300dd38de025c6c512d5a42a36 2166054304ce4335a200d74a367ce047 a0be15da8a0190d722e2fe2340ebc7ca 41a9931f28e84f46618adad93c3e7a5c 748a0167b2d3ed1eab61443ca3d33a65` |

**Vector 2** — [DarkCrypt Sfinks — incrementing key/plaintext, zero IV](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809` |
| `iv` | `00000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `46aac4a1d3d7214b6b6393a537043593 b2da0d358a596f0a652bbfe613f24cae 726b1f029bdcf05e8d1c94deae095c25 8265180339e6bbd71dffff29e9991409` |

**Vector 3** — [DarkCrypt Sfinks — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e3358` |
| `iv` | `073c71a6db10457aafe4` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `a2edc639a765c3aef0e1d119dddaa469 13c0369c6511247017a16f405bdfee53 a942fd6889309f14ba261965975d0838` |

---

[← All algorithms](../README.md)
