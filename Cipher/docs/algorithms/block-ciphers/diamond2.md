# Diamond2

> Royalty-free block cipher by Michael Paul Johnson with variable key length and substitution-permutation network structure. Uses 128-bit blocks with minimum 10 rounds for high security.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Michael Paul Johnson |
| Year | 1995 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/diamond2.js`](../../../algorithms/block/diamond2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 8192 bytes (65536 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Diamond2 Block Cipher Specification](https://cryptography.org/mpj/diamond2.pdf)
- [Original DLOCK2 Implementation](https://archive.org/details/dlock2dos)
- [Standard Cryptographic Algorithm Naming (SCAN)](http://www.users.zetnet.co.uk/hopwood/crypto/scan/cs.html)

## References

- [Reference Implementation (C)](https://archive.org/download/dlock2dos/dlock2.zip)
- [Michael Paul Johnson's Software Page](https://mljohnson.org/software.htm)

## Test vectors

25 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DIAMOND2.DAT record 1 - 15 rounds, 32-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `15` |
| `key` | `e834fdb933c502923d92bc9e14368e70d41c66cbdf36155033a66e07e6cc6d8d` |
| `input` | `5a8d872d31eedde63fc46f6c36456d8e` |
| `expected` | `39b60490aeef791a29015d74494aaa89` |

**Vector 2** — [DIAMOND2.DAT record 2 - 12 rounds, 31-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `12` |
| `key` | `ea9a425efd4115a12de708150404786f02053fd5090c36e93c35ddc086ee23` |
| `input` | `6d4dabaea1ba7ce219fa4d58477ddf04` |
| `expected` | `8e5172d29a01373bd26164fc07b61152` |

**Vector 3** — [DIAMOND2.DAT record 3 - 9 rounds, 30-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `9` |
| `key` | `056c448e9fc16b3ff9016c7225573dff4440817785fd598643d69592b503` |
| `input` | `a5a6631229d0ba0ec35debf856e0912e` |
| `expected` | `6c9b3cee37415139e5d986ef43182788` |

**Vector 4** — [DIAMOND2.DAT record 4 - 6 rounds, 29-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `6` |
| `key` | `5a3b86cf3d3c147a085ea4d0bbd27bcdb7e75268a52ad226bb1d9aed02` |
| `input` | `ddcb0a0aa58c3f9a29250858c0d09bf5` |
| `expected` | `361c79f6aec715c1db7f92e26b51693b` |

**Vector 5** — [DIAMOND2.DAT record 5 - 14 rounds, 28-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `14` |
| `key` | `da7089bafd4b2540aba02f430cf54aed1d880b2d9d56c5a1df864e4d` |
| `input` | `cbbcc0138efeb183971e503da1894aeb` |
| `expected` | `a2394d3de23d7a7d15cf5b77e8c8e82f` |

**Vector 6** — [DIAMOND2.DAT record 6 - 11 rounds, 27-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `11` |
| `key` | `ba5ec82dedba04f1c74d3428a12131dc1466a3d69b1131d201aad9` |
| `input` | `c53be5469b9b5fd9b82df46ad04d44fc` |
| `expected` | `070b9cb9b28a5975d4c6d3bc5b01c7a9` |

**Vector 7** — [DIAMOND2.DAT record 7 - 8 rounds, 26-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `8` |
| `key` | `3cc215d708d03e13260a97b55b290154c6b1b97848c4ab57159d` |
| `input` | `0dce02bef4444712d9a03fec590479b6` |
| `expected` | `da0c70fb54b4cb77b494df2de82e1742` |

**Vector 8** — [DIAMOND2.DAT record 8 - 5 rounds, 25-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `5` |
| `key` | `cb920084ddf7554e6037078cbff7c6b84d40ce318d09f18a39` |
| `input` | `7a0ae292edbdc55f3959a09752719a77` |
| `expected` | `11abf94c14c04cd89da555d5e3938115` |

**Vector 9** — [DIAMOND2.DAT record 9 - 13 rounds, 24-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `13` |
| `key` | `20c4357c5b0d24649c0f240235f8f44ba3554c69cdd3def6` |
| `input` | `b3ca5e53b7bfa9b771be2f5850a47cd6` |
| `expected` | `10db36b67930e8075a65f3fff8f51475` |

**Vector 10** — [DIAMOND2.DAT record 10 - 10 rounds, 23-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `10` |
| `key` | `9e786e7613ddeb65c4198055370e87aca311d8516cbbdc` |
| `input` | `89c2d70c333f565add4f00861cd9aad3` |
| `expected` | `218e81b4516473decd28338295ce2d07` |

**Vector 11** — [DIAMOND2.DAT record 11 - 7 rounds, 22-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `7` |
| `key` | `83c4babf755e1a0262e43e3f1a409c187b98ec81fb50` |
| `input` | `123219a8633b497f61934527fc6b9347` |
| `expected` | `4f83c10a25481432bbb74f74dabdf9ed` |

**Vector 12** — [DIAMOND2.DAT record 12 - 15 rounds, 21-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `15` |
| `key` | `2ddd7997e72b26db904429db1858418a888ab03a69` |
| `input` | `41591c58686f19b97ca408e92d04b78d` |
| `expected` | `727eb9c981a74a3f493ef81496abb269` |

**Vector 13** — [DIAMOND2.DAT record 13 - 12 rounds, 20-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `12` |
| `key` | `853605888bb37d5b36b055bced151e276d84a717` |
| `input` | `3c9904a551965b9bd14c2c0b8751e5a8` |
| `expected` | `cfd8820adc63b431b1b692a9ddeb216a` |

**Vector 14** — [DIAMOND2.DAT record 14 - 9 rounds, 19-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `9` |
| `key` | `93bb32977b845e258b459a088534d34451cb51` |
| `input` | `d8cd5dea26bd945ad0bd6ae78fee018e` |
| `expected` | `da70b8d5d1259d2eb671b3692e86c6ea` |

**Vector 15** — [DIAMOND2.DAT record 15 - 6 rounds, 18-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `6` |
| `key` | `212503aae04100c8db7567b83d3ad4dd02ed` |
| `input` | `352ecdd94a37ab5e2a096d8f3f411026` |
| `expected` | `60d0ec68abd975e07b3d892e4e329847` |

**Vector 16** — [DIAMOND2.DAT record 16 - 14 rounds, 17-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `14` |
| `key` | `599b02fbd0d321a789eb97b388bf77c663` |
| `input` | `56a25a87d40ab25a1dd972a7d154f8a5` |
| `expected` | `081420f230d5a85ab2b55453c43c7967` |

**Vector 17** — [DIAMOND2.DAT record 17 - 11 rounds, 16-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `11` |
| `key` | `3893a60cb8a96b9a931908514dd4ce5b` |
| `input` | `16aa615ac61230933525f7723db0c62f` |
| `expected` | `67b8c9775c1ef3a1a50d67f6b8c0328b` |

**Vector 18** — [DIAMOND2.DAT record 18 - 8 rounds, 15-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `8` |
| `key` | `2080d9f90d41a8b28c10444547f112` |
| `input` | `abb43532dd50a9a6172e44990731f1d3` |
| `expected` | `d07ebb85466cb7a06cd098b6d88fd05a` |

**Vector 19** — [DIAMOND2.DAT record 19 - 5 rounds, 14-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `5` |
| `key` | `78f9d7b638e5d2b3d4bcae8de866` |
| `input` | `513475c4007e45ac0ebe885f48049eaf` |
| `expected` | `8f4e2e74cd7b29f64fbe695bac4c38b1` |

**Vector 20** — [DIAMOND2.DAT record 20 - 13 rounds, 13-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `13` |
| `key` | `9bc7b89cd08d0d65b6751e6b37` |
| `input` | `d17279f426aef920dfc500bdd19030ec` |
| `expected` | `8d038094af38a418bafc90017955d6df` |

**Vector 21** — [DIAMOND2.DAT record 21 - 10 rounds, 12-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `10` |
| `key` | `f1765b73954f7e4d643ed3ca` |
| `input` | `ade31ea61538bf8ff5f9037ffacf6b7a` |
| `expected` | `4fd6830d95aedb3e9cdcb4c4abcefa4c` |

**Vector 22** — [DIAMOND2.DAT record 22 - 7 rounds, 11-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `7` |
| `key` | `365188a69a3aa853f85ded` |
| `input` | `9f5e649f0981b2bd1fb18c9379c7465f` |
| `expected` | `45732adba08d96fc607626afa6bd32f8` |

**Vector 23** — [DIAMOND2.DAT record 23 - 15 rounds, 10-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `15` |
| `key` | `78bb28b4cacd56a48b4d` |
| `input` | `2c680dfae36a7e10bb5732522af3ef63` |
| `expected` | `76f0eccc8aee86aba9a3de405d34377a` |

**Vector 24** — [DIAMOND2.DAT record 24 - 12 rounds, 9-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `12` |
| `key` | `aab680401c069e86f1` |
| `input` | `919881900f2560281c5482c60c917167` |
| `expected` | `9e9130ccd02af6a757aec03fc2efac3f` |

**Vector 25** — [DIAMOND2.DAT record 25 - 9 rounds, 8-byte key](https://archive.org/download/dlock2dos/dlock2.zip)

| Field | Value |
| --- | --- |
| `rounds` | `9` |
| `key` | `3361066b2c297543` |
| `input` | `787699fcb627774fcf0f0d82462d6e7d` |
| `expected` | `ceb8b4f88c02df34addaf431e7a7a07c` |

---

[← All algorithms](../README.md)
