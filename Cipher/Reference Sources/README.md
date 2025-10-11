# Cryptographic Reference Sources Collection

This directory contains comprehensive reference sources for cryptographic algorithm implementations and competition checklists used to enhance the SynthelicZ Cipher Tools project.

## Directory Structure

```text
Reference Sources/
├── Libraries/           # Cloned cryptographic libraries (10 total)
└── README.md           # This comprehensive overview and algorithm checklist
```

## 📋 Checklist

Below is a table of all algorithms found in the wild and their current implementation status inside our JavaScript library.
Please mention where you found (Could be competitions, software, personal pages, academic papers, etc.), where to find reference source code (could be names of libraries, github pages, etc.).
A word on categories:

* block        : Symmetric key block ciphers (e.g., AES, DES, Blowfish), needs key, optional blocksize
* stream       : Symmetric key stream ciphers (e.g., RC4, Salsa20), needs key
* asymmetric   : Asymmetric key algorithms (e.g., RSA, ECC), needs keypair
* checksum     : Functions for computing checksums (e.g., CRC32, Adler), no salt
* hash         : Cryptographic hash functions (e.g., SHA-256, MD5), with salt
* kdf          : Functions for securely hashing passwords (e.g., bcrypt, Argon2), needs iterations
* compression  : Data compression algorithms (e.g., DEFLATE, LZMA)
* encoding     : Character encoding schemes (e.g., UTF-8, ASCII, Morse)
* padding      : Data padding schemes (e.g., PKCS#7, ANSI X.923), needs outputsize
* modes        : Block cipher modes of operation (e.g., ECB, CBC, GCM), needs iv
* ecc          : Error correction codes (e.g., Reed-Solomon, LDPC)
* mac          : Message authentication codes (e.g., HMAC, CMAC)
* pqc          : Post-quantum cryptography (e.g., Lizard, NTRU)
* random       : Random number generation (e.g., Fortuna, Yarrow, LFSR, Xoroshiro), needs seed
* classical    : Classical cryptography (e.g., Caesar, Vigenère, Beaufort, Rail Fence, Scytale), fails cryptoanalysis

| Category                     | Name                           | Author                                      | Year        | Listed at                                       | Source Libraries                 | Test-Vectors | Implementation Status                       |
| ---------------------------- | ------------------------------ | ------------------------------------------- | ----------- | ----------------------------------------------- | -------------------------------- | ------------ | ------------------------------------------- |
| **BLOCK CIPHERS**            |                                |                                             |             |                                                 |                                  |              |                                             |
| block                        | 3DES (Triple DES)              | IBM                                         | 1999        | NIST, DarkCrypt                                 | OpenSSL, Crypto++, Bouncy Castle | ✅            | ✅ `3des.js`                                 |
| block                        | 3-Way                          | Joan Daemen                                 | 1993        | Academic                                        | Crypto++                         | ✅            | ✅ `3way.js`                                 |
| block                        | AES/Rijndael                   | Joan Daemen, Vincent Rijmen                 | 1998        | AES Competition Winner, NIST, NESSIE, DarkCrypt | All libraries                    | ✅            | ✅ `rijndael.js`                             |
| block                        | Anubis                         | Paulo Barreto, Vincent Rijmen               | 2000        | NESSIE                                          | Bouncy Castle                    | ✅            | ✅ `anubis.js`                               |
| block                        | ARIA                           | NSRI (South Korea)                          | 2003        | IETF RFC 5794, DarkCrypt                        | Bouncy Castle, OpenSSL           | ✅            | ✅ `aria.js`                                 |
| block                        | Blowfish                       | Bruce Schneier                              | 1993        | DarkCrypt                                       | OpenSSL, Crypto++, All libraries | ✅            | ✅ `blowfish.js`                             |
| block                        | Camellia                       | NTT, Mitsubishi                             | 2000        | NESSIE, ISO/IEC, DarkCrypt                      | OpenSSL, Crypto++                | ✅            | ✅ `camellia.js`                             |
| block                        | CAST-128 (CAST5)               | Carlisle Adams, Stafford Tavares            | 1996        | RFC 2144, DarkCrypt                             | OpenSSL, Crypto++                | ✅            | ✅ `cast128.js`                              |
| block                        | CAST-256 (CAST6)               | Carlisle Adams et al.                       | 1998        | AES candidate, DarkCrypt                        | Crypto++, Bouncy Castle          | ✅            | ✅ `cast256.js`                              |
| block                        | CHAM                           | Bonwook Koo et al.                          | 2017        | ICISC 2017                                      | Academic papers                  | ✅            | ✅ `cham.js`                                 |
| block                        | CLEFIA                         | Sony                                        | 2007        | ISO/IEC 29192-2                                 | Academic papers                  | ✅            | ✅ `clefia.js`                               |
| block                        | Crypton                        | Chae Hoon Lim                               | 1998        | AES candidate, DarkCrypt                        | Academic papers                  | ✅            | ✅ `crypton.js`                              |
| block                        | DEAL                           | Lars Knudsen                                | 1998        | AES candidate, DarkCrypt                        | Academic papers                  | ✅            | ✅ `deal.js`                                 |
| block                        | DES                            | IBM                                         | 1977        | NIST FIPS 46, DarkCrypt                         | All libraries                    | ✅            | ✅ `des.js`                                  |
| block                        | DES-X                          | Ron Rivest                                  | 1984        | DarkCrypt                                       | Crypto++                         | ✅            | ✅ `des-x.js`                                |
| block                        | DFC                            | CNRS                                        | 1998        | AES candidate, DarkCrypt                        | Academic papers                  | ✅            | ✅ `dfc.js`                                  |
| block                        | Diamond II                     | Michael Paul Johnson                        | 1998        | DarkCrypt, DLOCK2                               | cryptography.org/mpj             | ✅            | ✅ `diamond2.js`                             |
| block                        | E2                             | NTT                                         | 1998        | AES candidate, DarkCrypt                        | Academic papers                  | ❌            | ⚠️ `e2.js` (in stream/)                      |
| block                        | FEAL                           | NTT                                         | 1987        | Academic, DarkCrypt                             | Academic papers                  | ✅            | ✅ `feal.js`                                 |
| block                        | FROG                           | TecApro                                     | 1998        | AES candidate, DarkCrypt                        | Academic papers, EmbeddedSW.net  | ✅            | ✅ `frog.js`                                 |
| block                        | GOST 28147-89                  | USSR/Russia                                 | 1989        | Russian standard, DarkCrypt                     | OpenSSL, Crypto++                | ✅            | ✅ `gost28147.js`                            |
| block                        | GOST R 34.12-2015 (Kuznyechik) | Russia                                      | 2015        | Russian standard                                | OpenSSL                          | ✅            | ✅ `gost-kuznyechik.js`                      |
| block                        | Grand Cru                      | Johan Borst                                 | 2000        | NESSIE                                          | Academic papers                  | ✅            | ✅ `grand-cru.js`                            |
| block                        | Hierocrypt-3                   | Toshiba                                     | 2000        | NESSIE, DarkCrypt                               | Academic papers, EmbeddedSW.net  | ✅            | ✅ `hierocrypt3.js`                          |
| block                        | Hierocrypt-L1                  | Toshiba                                     | 2000        | NESSIE, DarkCrypt                               | Academic papers                  | ✅            | ✅ `hierocrypt-l1.js`                        |
| block                        | HPC                            | Rich Schroeppel                             | 1998        | AES candidate, DarkCrypt                        | Academic papers                  | ❌            | ❌ Missing (specs/vectors inaccessible)      |
| block                        | Hurricane                      | Roman Ganin                                 | 2005        | DarkCrypt, GitHub                               | GitHub rganin/hurricane          | ✅            | ✅ `hurricane.js`                            |
| block                        | Ice                            | Matthew Kwan                                | 1997        | DarkCrypt                                       | darkside.com.au                  | ✅            | ✅ `ice.js`                                  |
| block                        | Ice2                           | Matthew Kwan                                | 1997        | DarkCrypt                                       | darkside.com.au                  | ✅            | ✅ `ice2.js`                                 |
| block                        | IDEA                           | Xuejia Lai, James Massey                    | 1991        | PGP, DarkCrypt                                  | OpenSSL, Crypto++                | ✅            | ✅ `idea.js`                                 |
| block                        | IDEA-NXT (FOX)                 | MediaCrypt                                  | 2003        | DarkCrypt                                       | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | Iraqi                          | -                                           | -           | DarkCrypt                                       | -                                | ❌            | ❌ Missing                                   |
| block                        | Kalyna                         | Ukraine                                     | 2014        | Ukrainian standard                              | Reference implementation         | ✅            | ✅ `kalyna.js`                               |
| block                        | Kasumi                         | 3GPP                                        | 1999        | 3GPP, DarkCrypt                                 | OpenSSL                          | ✅            | ✅ `kasumi.js`                               |
| block                        | Keeloq                         | Nanoteq                                     | 1985        | DarkCrypt                                       | Academic papers, GitHub          | ✅            | ✅ `keeloq.js`                               |
| block                        | Khazad                         | Paulo Barreto, Vincent Rijmen               | 2000        | NESSIE, DarkCrypt                               | Bouncy Castle                    | ✅            | ✅ `khazad.js`                               |
| block                        | Khufu                          | Ralph Merkle                                | 1990        | DarkCrypt                                       | Academic papers                  | ✅            | ✅ `khufu.js`                                |
| block                        | LEA                            | KISA (South Korea)                          | 2013        | ISO/IEC 29192-2                                 | Reference implementation         | ✅            | ✅ `lea.js`                                  |
| block                        | LOKI89                         | ADFA                                        | 1989        | Academic                                        | Academic papers                  | ✅            | ✅ `loki89.js`                               |
| block                        | LOKI91                         | ADFA                                        | 1991        | Academic                                        | Academic papers                  | ✅            | ✅ `loki91.js`                               |
| block                        | LOKI97                         | ADFA                                        | 1997        | AES candidate, DarkCrypt                        | Academic papers                  | ✅            | ✅ `loki97.js`                               |
| block                        | Lucifer                        | Horst Feistel (IBM)                         | 1971        | Historical, DarkCrypt                           | Academic papers                  | ✅            | ✅ `lucifer.js`                              |
| block                        | MacGuffin                      | Bruce Schneier, Matt Blaze                  | 1994        | DarkCrypt                                       | Academic papers                  | ⚠️            | ⚠️ `macguffin.js` (decryption incomplete)   |
| block                        | Magenta                        | Deutsche Telekom                            | 1998        | AES candidate, DarkCrypt                        | Academic papers                  | ✅            | ✅ `magenta.js`                              |
| block                        | Mars                           | IBM                                         | 1998        | AES finalist, DarkCrypt                         | Crypto++                         | ✅            | ✅ `mars.js`                                 |
| block                        | Mercy                          | Paul Crowley                                | 2000        | DarkCrypt                                       | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | Misty1                         | Mitsubishi                                  | 1995        | NESSIE, DarkCrypt                               | OpenSSL                          | ✅            | ✅ `misty1.js`                               |
| block                        | Misty2                         | Mitsubishi                                  | 1997        | Academic                                        | Academic papers                  | ✅            | ✅ `misty2.js`                               |
| block                        | NewDES                         | Robert Scott                                | 1985        | Academic, DarkCrypt                             | Academic papers                  | ✅            | ✅ `newdes.js`                               |
| block                        | Nimbus                         | Alexis Machado                              | 2000        | NESSIE                                          | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | Noekeon                        | Joan Daemen et al.                          | 2000        | NESSIE, DarkCrypt                               | Academic papers                  | ✅            | ✅ `noekeon.js`                              |
| block                        | NSEA                           | -                                           | -           | DarkCrypt                                       | -                                | ❌            | ❌ Missing                                   |
| block                        | NUSH                           | Anatoly Lebedev                             | 1998        | DarkCrypt                                       | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | PC1                            | -                                           | -           | DarkCrypt                                       | -                                | ❌            | ❌ Missing                                   |
| block                        | Present                        | Bogdanov et al.                             | 2007        | ISO/IEC 29192-2                                 | Academic papers                  | ✅            | ✅ `present.js`                              |
| block                        | Present128                     | Bogdanov et al.                             | 2007        | ISO/IEC 29192-2                                 | Academic papers                  | ✅            | ✅ `present128.js`                           |
| block                        | Q                              | Leslie McBride                              | 2000        | NESSIE                                          | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | Raiden                         | Huihui Yap et al.                           | 2000        | DarkCrypt                                       | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | RC2                            | Ron Rivest                                  | 1987        | RFC 2268, DarkCrypt                             | OpenSSL, Crypto++                | ✅            | ✅ `rc2.js`                                  |
| block                        | RC5                            | Ron Rivest                                  | 1994        | DarkCrypt                                       | Crypto++                         | ✅            | ✅ `rc5.js`                                  |
| block                        | RC6                            | Ron Rivest et al.                           | 1998        | AES candidate, DarkCrypt                        | Crypto++, Bouncy Castle          | ✅            | ✅ `rc6.js`                                  |
| block                        | REDOC-II                       | Michael Wood                                | 1990        | DarkCrypt                                       | Academic papers                  | ✅            | ✅ `redoc2.js`                               |
| block                        | REDOC-III                      | Michael Wood                                | 1991        | DarkCrypt                                       | Academic papers                  | ✅            | ✅ `redoc3.js`                               |
| block                        | RTEA                           | -                                           | -           | DarkCrypt                                       | -                                | ❌            | ❌ Missing                                   |
| block                        | SAFER K/SK (all variants)      | James Massey                                | 1993        | DarkCrypt                                       | Crypto++                         | ✅            | ✅ `safer.js`                                |
| block                        | SC2000                         | Fujitsu Labs                                | 2000        | NESSIE/CRYPTREC, DarkCrypt                      | Academic papers, EmbeddedSW.net  | ✅            | ✅ `sc2000.js`                               |
| block                        | SEED                           | KISA (South Korea)                          | 1998        | Korean standard, DarkCrypt                      | OpenSSL, Crypto++                | ✅            | ✅ `seed.js`                                 |
| block                        | Serpent                        | Anderson, Biham, Knudsen                    | 1998        | AES finalist, DarkCrypt                         | Crypto++, LibTomCrypt            | ✅            | ✅ `serpent.js`                              |
| block                        | SHACAL-1                       | Helena Handschuh, David Naccache            | 2000        | NESSIE finalist, DarkCrypt                      | Crypto++                         | ❌            | ❌ Missing                                   |
| block                        | SHACAL-2                       | Helena Handschuh, David Naccache            | 2000        | NESSIE selected, DarkCrypt                      | Crypto++                         | ❌            | ❌ Missing                                   |
| block                        | Shark                          | Vincent Rijmen et al.                       | 1996        | Academic, DarkCrypt                             | Academic papers                  | ❌            | ❌ Missing                                   |
| block                        | Simon                          | NSA                                         | 2013        | Academic                                        | Academic papers                  | ✅            | ✅ `simon.js`                                |
| block                        | Skip32                         | Greg Rose                                   | 2002        | DarkCrypt                                       | Academic papers, GitHub          | ✅            | ✅ `skip32.js`                               |
| block                        | Skipjack                       | NSA                                         | 1998        | US Government, DarkCrypt                        | Crypto++                         | ✅            | ✅ `skipjack.js`                             |
| block                        | SM4                            | China                                       | 2006        | Chinese standard                                | OpenSSL, Bouncy Castle           | ✅            | ✅ `sm4.js`                                  |
| block                        | Speck                          | NSA                                         | 2013        | Academic                                        | Academic papers                  | ✅            | ✅ `speck.js`                                |
| block                        | SPEED                          | Yuliang Zheng                               | 1997        | Academic, DarkCrypt                             | Academic papers, EmbeddedSW.net  | ✅            | ✅ `speed.js`                                |
| block                        | Square                         | Joan Daemen, Vincent Rijmen                 | 1997        | Academic, DarkCrypt                             | Crypto++                         | ✅            | ✅ `square.js`                               |
| block                        | TEA                            | Wheeler, Needham                            | 1994        | DarkCrypt                                       | Crypto++                         | ✅            | ✅ `tea.js`                                  |
| block                        | TEAN                           | -                                           | -           | DarkCrypt                                       | -                                | ❌            | ❌ Missing                                   |
| block                        | Threefish                      | Schneier et al.                             | 2008        | Skein hash, DarkCrypt                           | Crypto++                         | ✅            | ✅ `threefish.js`                            |
| block                        | Tnepres                        | -                                           | -           | DarkCrypt (Serpent backwards)                   | -                                | ❌            | ❌ Missing                                   |
| block                        | Twofish                        | Bruce Schneier et al.                       | 1998        | AES finalist, DarkCrypt                         | Crypto++, OpenSSL                | ✅            | ✅ `twofish.js`                              |
| block                        | UNICORN-A                      | NEC Corporation                             | 2000        | CRYPTREC, DarkCrypt                             | Academic papers, EmbeddedSW.net  | ✅            | ✅ `unicorn-a.js`                            |
| block                        | XTEA                           | Wheeler, Needham                            | 1997        | DarkCrypt                                       | Crypto++                         | ✅            | ✅ `xtea.js`                                 |
| block                        | XXTEA                          | Wheeler, Needham                            | 1998        | DarkCrypt                                       | Academic papers                  | ✅            | ✅ `xxtea.js`                                |
| block                        | BaseKing                       | Joan Daemen                                 | 1994        | Academic                                        | Academic                         | ✅            | ✅ `baseking.js`                             |
| block                        | DoubleKing                     | Tim Van Dijk                                | 2017        | Academic                                        | Academic                         | ✅            | ✅ `doubleking.js`                           |
| block                        | RHX                            | -                                           | -           | CEX                                             | Academic                         | ✅            | ✅ `rhx.js`                                  |
| block                        | SHX                            | -                                           | -           | CEX                                             | Academic                         | ✅            | ✅ `shx.js`                                  |
| block                        | THX                            | -                                           | -           | CEX                                             | Academic                         | ✅            | ✅ `thx.js`                                  |
| block                        | SCOP                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Q128                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Diamond II Lite                | Michael Paul Johnson                        | 1998        | DarkCrypt TC (64-bit variant)                   | cryptography.org/mpj             | ⚠️            | ⚠️ Related: `diamond2.js` (128-bit version)  |
| block                        | Bassomatic                     | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Bassomatic-89                  | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Noekeon Indirect               | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Caracachs                      | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | FealNx                         | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Lucifer Enhanced               | IBM                                         | 1973        | DarkCrypt TC                                    | IBM                              | ❌            | ❌ Missing                                   |
| block                        | BBC                            | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | EnRUPT                         | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | EnRUPT-W                       | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | EnRUPT-md6                     | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Mir                            | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | MBC2                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | MMB                            | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | MMB2                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | MDC                            | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| block                        | Anubis-tweaked                 | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| **STREAM CIPHERS**           |                                |                                             |             |                                                 |                                  |              |                                             |
| stream                       | A5/1                           | GSM                                         | 1987        | GSM standard                                    | OpenSSL, Crypto++                | ✅            | ⚠️ `a5-1.js` (83% tests)                     |
| stream                       | A5/2                           | GSM                                         | 1989        | GSM standard                                    | OpenSSL, Crypto++                | ✅            | ✅ `a5-2.js`                                 |
| stream                       | A5/3                           | 3GPP                                        | 2002        | 3GPP standard                                   | OpenSSL                          | ✅            | ⚠️ `a5-3.js` (83% tests)                     |
| stream                       | Achterbahn                     | Berndt Gammel et al.                        | 2005        | eSTREAM Phase 2                                 | Academic papers                  | ✅            | ✅ `achterbahn.js`                           |
| stream                       | ACORN                          | Hongjun Wu                                  | 2014        | CAESAR finalist                                 | Reference implementation         | ✅            | ⚠️ `acorn.js` (interface issues)             |
| stream                       | ASCON                          | Christoph Dobraunig et al.                  | 2016        | CAESAR winner, NIST LWC                         | Reference implementation         | ✅            | ✅ `ascon.js`                                |
| stream                       | Beth-Piper                     | -                                           | -           | Academic                                        | Academic papers                  | ✅            | ⚠️ `beth-piper.js` (metadata issues)         |
| stream                       | ChaCha20                       | Daniel J. Bernstein                         | 2008        | IETF RFC 7539, DarkCrypt                        | OpenSSL, LibSodium               | ✅            | ✅ `chacha20.js`                             |
| stream                       | Crypto-1                       | NXP                                         | 1994        | MIFARE                                          | Academic papers                  | ✅            | ✅ `crypto1.js`                              |
| stream                       | Dragon                         | Information Security Research Centre        | 2004        | eSTREAM Phase 2, DarkCrypt                      | Academic papers                  | ✅            | ✅ `dragon.js`                               |
| stream                       | E0                             | Bluetooth SIG                               | 1999        | Bluetooth                                       | Academic papers                  | ✅            | ✅ `e0.js`                                   |
| stream                       | F-FCSR                         | Arnault, Berger                             | 2005        | eSTREAM Phase 2                                 | Academic papers                  | ✅            | ⚠️ `f-fcsr.js` (no tests)                    |
| stream                       | F-FCSR-H v2                    | Arnault, Berger                             | 2005        | eSTREAM finalist                                | Academic papers                  | ❌            | ❌ Missing (have f-fcsr.js)                  |
| stream                       | FISH                           | Siemens                                     | 1993        | Academic                                        | Academic papers                  | ✅            | ✅ `fish.js`                                 |
| stream                       | Geffe                          | P.R. Geffe                                  | 1973        | Academic                                        | Academic papers                  | ✅            | ⚠️ `geffe.js` (no tests)                     |
| stream                       | Grain v1                       | Hell, Johansson, Meier                      | 2005        | eSTREAM finalist                                | Academic papers                  | ✅            | ✅ `grain.js`, `grain-v1.js`                 |
| stream                       | HC-128                         | Hongjun Wu                                  | 2004        | eSTREAM finalist                                | Crypto++                         | ✅            | ✅ `hc-128.js` (fixed)                       |
| stream                       | HC-256                         | Hongjun Wu                                  | 2004        | eSTREAM Phase 2, DarkCrypt                      | Crypto++                         | ✅            | ⚠️ `hc-256.js` (83% tests)                   |
| stream                       | ISAAC                          | Bob Jenkins                                 | 1996        | Academic                                        | Academic papers                  | ❌            | ⚠️ `isaac.js` (metadata issues)              |
| stream                       | Leviathan                      | David McGrew, Scott Fluhrer                 | 2000        | Academic                                        | Academic papers                  | ✅            | ⚠️ `leviathan.js` (67% tests)                |
| stream                       | LILI-128                       | L. Simpson et al.                           | 2000        | NESSIE submission                               | Academic papers                  | ❌            | ❌ Missing                                   |
| stream                       | MICKEY v2                      | Steve Babbage, Matthew Dodd                 | 2005        | eSTREAM finalist                                | Academic papers                  | ✅            | ⚠️ `mickey.js` (unclear version)             |
| stream                       | MICKEY-128                     | Steve Babbage, Matthew Dodd                 | 2005        | eSTREAM Phase 2                                 | Academic papers                  | ❌            | ⚠️ `mickey-128.js` (metadata issues)         |
| stream                       | Miller                         | G.L. Miller                                 | 1976        | Academic                                        | Academic papers                  | ❌            | ⚠️ `miller.js` (metadata issues)             |
| stream                       | MUGI                           | Hitachi                                     | 2002        | CRYPTREC                                        | Academic papers                  | ❌            | ⚠️ `mugi.js` (metadata issues)               |
| stream                       | MULTI-S01                      | C. Berbain et al.                           | 2005        | eSTREAM Phase 2                                 | Academic papers                  | ✅            | ❌ Missing                                   |
| stream                       | Panama                         | Joan Daemen, Craig Clapp                    | 1998        | Academic                                        | Academic papers                  | ❌            | ⚠️ `panama.js` (no tests)                    |
| stream                       | Phelix                         | Doug Whiting et al.                         | 2004        | eSTREAM Phase 2, DarkCrypt                      | Academic papers                  | ✅            | ⚠️ `phelix-simple.js` (no tests)             |
| stream                       | PIKE                           | Ross Anderson                               | 1994        | Academic                                        | Academic papers                  | ✅            | ⚠️ `pike.js` (no tests)                      |
| stream                       | Pomaranch                      | Cees Jansen et al.                          | 2005        | eSTREAM Phase 2                                 | Academic papers                  | ✅            | ⚠️ `pomaranch.js` (no tests)                 |
| stream                       | Rabbit                         | Martin Boesgaard et al.                     | 2003        | eSTREAM finalist, DarkCrypt                     | Crypto++                         | ✅            | ⚠️ `rabbit.js` (83% tests)                   |
| stream                       | RC4                            | Ron Rivest                                  | 1987        | SSL/TLS, DarkCrypt                              | All libraries                    | ✅            | ✅ `rc4.js`                                  |
| stream                       | Rule30                         | Stephen Wolfram                             | 1983        | Academic                                        | Academic papers                  | ✅            | ✅ `rule30.js`                               |
| stream                       | SapphireII                     | Michael Paul Johnson                        | 1995        | DarkCrypt TC stream cipher                      | Academic                         | ❌            | ❌ Missing - Stream cipher                   |
| stream                       | Salsa20                        | Daniel J. Bernstein                         | 2005        | eSTREAM finalist, DarkCrypt                     | LibSodium, Crypto++              | ✅            | ⚠️ `salsa20.js` (75% tests)                  |
| stream                       | SEAL                           | Phil Rogaway, Don Coppersmith               | 1994        | Academic                                        | Academic papers                  | ❌            | ❌ Missing                                   |
| stream                       | Shrinking Generator            | Coppersmith et al.                          | 1993        | Academic                                        | Academic papers                  | ✅            | ✅ `shrinking-generator.js`                  |
| stream                       | SNOW 3G                        | Thomas Johansson, Patrik Ekdahl             | 2006        | 3GPP standard                                   | OpenSSL                          | ✅            | ✅ `snow3g.js` (fixed)                       |
| stream                       | SOBER                          | Philip Hawkes, Gregory Rose                 | 1998        | NESSIE                                          | Academic papers                  | ❌            | ❌ Missing                                   |
| stream                       | SOSEMANUK                      | Come Berbain et al.                         | 2005        | eSTREAM finalist, DarkCrypt                     | Crypto++                         | ✅            | ⚠️ `sosemanuk.js` (83% tests)                |
| stream                       | Spritz                         | Ron Rivest, Jacob Schuldt                   | 2014        | Academic                                        | Academic papers                  | ✅            | ✅ `spritz.js`                               |
| stream                       | Trivium                        | Christophe De Cannière, Bart Preneel        | 2005        | eSTREAM finalist, DarkCrypt                     | Crypto++                         | ✅            | ✅ `trivium.js`                              |
| stream                       | TSC-4                          | -                                           | -           | Academic                                        | Academic papers                  | ✅            | ⚠️ `tsc-4.js` (metadata issues)              |
| stream                       | Turing                         | Greg Rose, Philip Hawkes                    | 2002        | Qualcomm, DarkCrypt                             | Academic papers                  | ❌            | ❌ Missing                                   |
| stream                       | VEST                           | Sean O'Neil et al.                          | 2005        | eSTREAM Phase 2                                 | Academic papers                  | ✅            | ⚠️ `vest.js` (metadata issues)               |
| stream                       | WAKE                           | David Wheeler                               | 1993        | Academic                                        | Academic papers                  | ❌            | ⚠️ `wake.js` (metadata issues)               |
| stream                       | XChaCha20                      | Daniel J. Bernstein                         | 2008        | Extended ChaCha                                 | LibSodium                        | ✅            | ⚠️ `xchacha20.js` (metadata issues)          |
| stream                       | XSalsa20                       | Daniel J. Bernstein                         | 2008        | Extended Salsa                                  | LibSodium                        | ❌            | ⚠️ `xsalsa20.js` (metadata issues)           |
| stream                       | ZUC                            | DACAS                                       | 2011        | 3GPP standard                                   | OpenSSL                          | ✅            | ✅ `zuc.js` (fixed)                          |
| stream                       | ABC 3                          | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | CryptMT3                       | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Lex2                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | NLS2                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Yamb                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Hermes                         | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | WG2                            | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | ZKCrypt3                       | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Dicing                         | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Py6                            | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Moustique                      | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | TPypy                          | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | TPy6                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Py                             | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| stream                       | Pypy                           | -                                           | -           | DarkCrypt TC                                    |                                  | ❌            | ❌ Missing                                   |
| **HASH FUNCTIONS**           |                                |                                             |             |                                                 |                                  |              |                                             |
| hash                         | Argon2                         | Alex Biryukov et al.                        | 2015        | PHC winner                                      | LibSodium, OpenSSL               | ✅            | ✅ `argon2.js` (hash version)                |
| hash                         | BLAKE                          | Jean-Philippe Aumasson et al.               | 2008        | SHA-3 finalist                                  | BLAKE reference                  | ❌            | ❌ Missing                                   |
| hash                         | BLAKE2b                        | Jean-Philippe Aumasson et al.               | 2012        | RFC 7693                                        | LibSodium, OpenSSL               | ✅            | ✅ `blake2b.js`                              |
| hash                         | BLAKE2s                        | Jean-Philippe Aumasson et al.               | 2012        | RFC 7693                                        | LibSodium, OpenSSL               | ✅            | ✅ `blake2s.js`                              |
| hash                         | BLAKE3                         | Jack O'Connor et al.                        | 2020        | Modern standard                                 | BLAKE3 reference                 | ✅            | ✅ `blake3.js`                               |
| hash                         | BLAKE3-Enhanced                | Jack O'Connor et al.                        | 2020        | Enhanced BLAKE3 implementation                  | BLAKE3 reference                 | ✅            | ✅ `blake3-enhanced.js`                      |
| hash                         | CityHash                       | Google                                      | 2011        | Non-cryptographic                               | Google reference                 | ✅            | ✅ `cityhash.js`                             |
| hash                         | CubeHash                       | Daniel J. Bernstein                         | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | ECHO                           | Ryad Benadjila et al.                       | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | FNV                            | Glenn Fowler et al.                         | 1991        | Non-cryptographic                               | Public domain                    | ✅            | ✅ `fnv.js`                                  |
| hash                         | Fugue                          | Shai Halevi et al.                          | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | Grøstl                         | Gauravaram et al.                           | 2008        | SHA-3 finalist                                  | Academic papers                  | ✅            | ✅ `groestl.js`                              |
| hash                         | Hamsi                          | Özgül Küçük                                 | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | HAVAL                          | Yuliang Zheng et al.                        | 1992        | Academic                                        | Crypto++                         | ✅            | ✅ `haval.js`                                |
| hash                         | HighwayHash                    | Google                                      | 2016        | Non-cryptographic                               | Google reference                 | ✅            | ✅ `highway-hash.js`                         |
| hash                         | JH                             | Hongjun Wu                                  | 2008        | SHA-3 finalist                                  | Academic papers                  | ✅            | ✅ `jh.js`                                   |
| hash                         | Keccak/SHA-3                   | Bertoni, Daemen, Peeters, Van Assche        | 2008        | SHA-3 winner, NIST standard                     | All libraries                    | ✅            | ✅ `sha3-256.js`                             |
| hash                         | Luffa                          | Watanabe et al.                             | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | MD2                            | Ron Rivest                                  | 1989        | RFC 1319                                        | OpenSSL                          | ✅            | ✅ `md2.js`                                  |
| hash                         | MD4                            | Ron Rivest                                  | 1990        | RFC 1320, DarkCrypt                             | OpenSSL, Crypto++                | ✅            | ✅ `md4.js`                                  |
| hash                         | MD5                            | Ron Rivest                                  | 1991        | RFC 1321, DarkCrypt                             | All libraries                    | ✅            | ✅ `md5.js`                                  |
| hash                         | MD6                            | Ron Rivest et al.                           | 2008        | SHA-3 candidate, DarkCrypt                      | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | MurmurHash3                    | Austin Appleby                              | 2008        | Non-cryptographic                               | Public domain                    | ✅            | ✅ `murmurhash3.js`                          |
| hash                         | RadioGatún                     | Joan Daemen et al.                          | 2006        | Academic                                        | Academic papers                  | ✅            | ✅ `radiogatun.js`                           |
| hash                         | RIPEMD-160                     | Hans Dobbertin et al.                       | 1996        | ISO/IEC 10118-3, DarkCrypt                      | OpenSSL, Crypto++                | ✅            | ✅ `ripemd160.js`                            |
| hash                         | RIPEMD-256                     | Hans Dobbertin et al.                       | 1996        | Academic, DarkCrypt                             | Crypto++                         | ✅            | ✅ `ripemd256.js`                            |
| hash                         | RIPEMD-320                     | Hans Dobbertin et al.                       | 1996        | Academic, DarkCrypt                             | Crypto++                         | ✅            | ✅ `ripemd320.js`                            |
| hash                         | Shabal                         | Bresson et al.                              | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | SHA-1                          | NSA                                         | 1995        | NIST FIPS 180-1, DarkCrypt                      | All libraries                    | ✅            | ✅ `sha1.js`                                 |
| hash                         | SHA-224                        | NSA                                         | 2001        | NIST FIPS 180-2                                 | All libraries                    | ✅            | ✅ `sha224.js`                               |
| hash                         | SHA-256                        | NSA                                         | 2001        | NIST FIPS 180-2, SHA-3, DarkCrypt               | All libraries                    | ✅            | ✅ `sha256.js`                               |
| hash                         | SHA-384                        | NSA                                         | 2001        | NIST FIPS 180-2, SHA-3                          | All libraries                    | ✅            | ✅ `sha384.js`                               |
| hash                         | SHA-512                        | NSA                                         | 2001        | NIST FIPS 180-2, SHA-3, DarkCrypt               | All libraries                    | ✅            | ✅ `sha512.js`                               |
| hash                         | SHAKE128                       | NIST                                        | 2015        | NIST FIPS 202                                   | OpenSSL                          | ✅            | ✅ `shake128.js`                             |
| hash                         | SHAvite-3                      | Eli Biham, Orr Dunkelman                    | 2008        | SHA-3 candidate                                 | Academic papers                  | ❌            | ❌ Missing                                   |
| hash                         | SipHash                        | Jean-Philippe Aumasson, Daniel J. Bernstein | 2012        | Academic                                        | Reference implementation         | ✅            | ✅ `siphash.js`                              |
| hash                         | Skein                          | Schneier et al.                             | 2008        | SHA-3 finalist, DarkCrypt                       | Crypto++                         | ✅            | ✅ `skein.js`                                |
| hash                         | Streebog                       | Russia                                      | 2012        | GOST R 34.11-2012                               | OpenSSL                          | ✅            | ✅ `streebog.js`                             |
| hash                         | Tiger                          | Ross Anderson, Eli Biham                    | 1995        | Academic                                        | Crypto++                         | ✅            | ✅ `tiger.js`                                |
| hash                         | Whirlpool                      | Paulo Barreto, Vincent Rijmen               | 2000        | NESSIE selected, ISO/IEC, DarkCrypt             | OpenSSL, Crypto++                | ✅            | ✅ `whirlpool.js`                            |
| hash                         | xxHash                         | Yann Collet                                 | 2012        | Non-cryptographic                               | Reference implementation         | ✅            | ✅ `xxhash.js`                               |
| hash                         | xxHash3                        | Yann Collet                                 | 2019        | Non-cryptographic                               | Reference implementation         | ✅            | ✅ `xxhash3.js`                              |
| hash                         | xxHash32                       | Yann Collet                                 | 2012        | Non-cryptographic                               | Reference implementation         | ✅            | ✅ `xxhash32.js`                             |
| **AUTHENTICATED ENCRYPTION** |                                |                                             |             |                                                 |                                  |              |                                             |
| mac                          | AEGIS-128                      | Hongjun Wu, Bart Preneel                    | 2014        | CAESAR                                          | Reference implementation         | ✅            | ⚠️ `aegis-128.js` (interface error)          |
| mac                          | AES-GCM-SIV                    | Adam Langley et al.                         | 2016        | RFC 8452                                        | OpenSSL                          | ✅            | ⚠️ `aes-gcm-siv.js` (interface error)        |
| mac                          | AES-SIV                        | Phil Rogaway, Thomas Shrimpton              | 2006        | RFC 5297                                        | OpenSSL                          | ✅            | ✅ `aes-siv.js`                              |
| mac                          | ASCON                          | Christoph Dobraunig et al.                  | 2014        | CAESAR winner                                   | Reference implementation         | ✅            | ⚠️ `ascon.js` (interface error)              |
| mac                          | ChaCha20-Poly1305              | Adam Langley et al.                         | 2013        | RFC 7539                                        | OpenSSL, LibSodium               | ✅            | ✅ `chacha20-poly1305.js`                    |
| mac                          | CMAC                           | NIST                                        | 2005        | NIST SP 800-38B                                 | OpenSSL                          | ✅            | ✅ `cmac.js`                                 |
| mac                          | Gimli                          | Daniel J. Bernstein et al.                  | 2017        | NIST LWC                                        | Reference implementation         | ✅            | ⚠️ `gimli.js` (test failures)                |
| mac                          | GMAC                           | David McGrew, John Viega                    | 2004        | NIST SP 800-38D                                 | OpenSSL                          | ✅            | ✅ `gmac.js`                                 |
| mac                          | HMAC                           | Mihir Bellare et al.                        | 1996        | RFC 2104                                        | All libraries                    | ✅            | ✅ `hmac.js`                                 |
| mac                          | JAMBU                          | Hongjun Wu, Tao Huang                       | 2014        | CAESAR finalist                                 | Reference implementation         | ❌            | ❌ Missing                                   |
| mac                          | MORUS                          | Hongjun Wu, Tao Huang                       | 2014        | CAESAR finalist                                 | Reference implementation         | ✅            | ⚠️ `morus.js` (test failures)                |
| mac                          | NORX                           | Jean-Philippe Aumasson et al.               | 2014        | CAESAR                                          | Reference implementation         | ✅            | ⚠️ `norx.js` (test failures)                 |
| mac                          | OMAC                           | Tetsu Iwata, Kaoru Kurosawa                 | 2003        | ISO/IEC 9797-1                                  | Crypto++                         | ✅            | ✅ `omac.js`                                 |
| mac                          | Poly1305                       | Daniel J. Bernstein                         | 2005        | RFC 7539                                        | OpenSSL, LibSodium               | ✅            | ✅ `poly1305.js`                             |
| mac                          | VMAC                           | Ted Krovetz, Wei Dai                        | 2007        | RFC 4543                                        | Crypto++                         | ✅            | ✅ `vmac.js`                                 |
| mac                          | XChaCha20-Poly1305             | Scott Arciszewski                           | 2018        | Extended ChaCha                                 | LibSodium                        | ✅            | ⚠️ `xchacha20-poly1305.js` (test failures)   |
| **KEY DERIVATION FUNCTIONS** |                                |                                             |             |                                                 |                                  |              |                                             |
| kdf                          | Argon2                         | Alex Biryukov et al.                        | 2015        | PHC winner                                      | LibSodium, OpenSSL               | ✅            | ✅ `argon2.js`                               |
| kdf                          | bcrypt                         | Niels Provos, David Mazières                | 1999        | OpenBSD                                         | OpenSSL, All libraries           | ✅            | ✅ `bcrypt.js`                               |
| kdf                          | HKDF                           | Hugo Krawczyk                               | 2010        | RFC 5869                                        | OpenSSL                          | ✅            | ✅ `hkdf.js`                                 |
| kdf                          | PBKDF2                         | RSA Laboratories                            | 2000        | RFC 2898                                        | All libraries                    | ✅            | ✅ `pbkdf2.js`                               |
| kdf                          | scrypt                         | Colin Percival                              | 2009        | RFC 7914                                        | OpenSSL, LibSodium               | ✅            | ✅ `scrypt.js`                               |
| **ASYMMETRIC CRYPTOGRAPHY**  |                                |                                             |             |                                                 |                                  |              |                                             |
| asymmetric                   | BIKE                           | Aragon et al.                               | 2017        | NIST PQC                                        | Reference implementation         | ✅            | ⚠️ `bike.js` (partial tests)                 |
| asymmetric                   | Classic McEliece               | Bernstein et al.                            | 1978/2017   | NIST PQC                                        | Reference implementation         | ✅            | ⚠️ `classic-mceliece.js`                     |
| asymmetric                   | Dilithium                      | Ducas et al.                                | 2017        | NIST PQC                                        | Reference implementation         | ✅            | ✅ `dilithium.js`                            |
| asymmetric                   | Falcon                         | Fouque et al.                               | 2017        | NIST PQC                                        | Reference implementation         | ✅            | ✅ `falcon.js`                               |
| asymmetric                   | FrodoKEM                       | Bos et al.                                  | 2016        | NIST PQC                                        | Reference implementation         | ✅            | ✅ `frodokem.js`                             |
| asymmetric                   | HQC                            | Melchor et al.                              | 2017        | NIST PQC                                        | Reference implementation         | ✅            | ✅ `hqc.js`                                  |
| asymmetric                   | Kyber/ML-KEM                   | Bos et al.                                  | 2017        | NIST PQC standard                               | Reference implementation         | ✅            | ✅ `ml-kem.js`                               |
| asymmetric                   | NTRU                           | Hoffstein et al.                            | 1996        | IEEE P1363.1                                    | NTRUOpenSourceProject            | ✅            | ✅ `ntru.js`                                 |
| asymmetric                   | Rainbow                        | Ding, Schmidt                               | 2005        | Academic                                        | Reference implementation         | ✅            | ✅ `rainbow.js`                              |
| asymmetric                   | RSA                            | Rivest, Shamir, Adleman                     | 1977        | PKCS#1, DarkCrypt                               | All libraries                    | ✅            | ✅ `rsa.js`                                  |
| asymmetric                   | SIKE                           | Jao et al.                                  | 2011        | NIST PQC (broken)                               | Reference implementation         | ✅            | ✅ `sike.js`                                 |
| asymmetric                   | SPHINCS+                       | Bernstein et al.                            | 2015        | NIST PQC                                        | Reference implementation         | ✅            | ✅ `sphincs-plus.js`                         |
| asymmetric                   | FAEST                          | -                                           | 2023        | NIST PQC                                        | Academic                         | ✅            | ✅ `faest.js`                                |
| asymmetric                   | HAWK                           | -                                           | 2022        | NIST PQC                                        | Academic                         | ✅            | ✅ `hawk.js`                                 |
| asymmetric                   | LWE Signature                  | -                                           | -           | Post-quantum                                    | Academic                         | ✅            | ✅ `lwe-signature.js`                        |
| asymmetric                   | MAYO                           | -                                           | 2022        | NIST PQC                                        | Academic                         | ✅            | ✅ `mayo.js`                                 |
| asymmetric                   | ML-DSA                         | NIST                                        | 2022        | NIST PQC                                        | NIST                             | ✅            | ✅ `ml-dsa.js`                               |
| asymmetric                   | PERK                           | -                                           | 2023        | NIST PQC                                        | Academic                         | ✅            | ✅ `perk.js`                                 |
| asymmetric                   | SLH-DSA                        | NIST                                        | 2022        | NIST PQC                                        | NIST                             | ✅            | ✅ `slh-dsa.js`                              |
| asymmetric                   | SQISIGN                        | -                                           | 2023        | NIST PQC                                        | Academic                         | ✅            | ✅ `sqisign.js`                              |
| asymmetric                   | FF1                            | NIST                                        | 2016        | NIST SP 800-38G approved                        | NIST                             | ✅            | ✅ `ff1.js`                                  |
| asymmetric                   | FF3                            | NIST                                        | 2016        | NIST SP 800-38G (deprecated)                    | NIST                             | ✅            | ✅ `ff3.js`                                  |
| asymmetric                   | FFX                            | Bellare et al.                              | 2010        | Precursor to FF1/FF3                            | Academic                         | ✅            | ✅ `ffx.js`                                  |
| asymmetric                   | FPE                            | Various                                     | Various     | Format Preserving Encryption framework          | NIST                             | ✅            | ✅ `fpe.js`                                  |
| asymmetric                   | RSA-Ice 2                      | RSA + Ice 2                                 | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-Serpent                    | RSA + Serpent                               | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-Gost                       | RSA + GOST                                  | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-AES                        | RSA + AES                                   | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-Mars                       | RSA + Mars                                  | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-Blowfish                   | RSA + Blowfish                              | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-XXTEA                      | RSA + XXTEA                                 | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-CAST256                    | RSA + CAST-256                              | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-RC6                        | RSA + RC6                                   | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-3DES                       | RSA + Triple DES                            | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-MISTY1                     | RSA + MISTY1                                | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-Twofish                    | RSA + Twofish                               | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| asymmetric                   | RSA-IDEA                       | RSA + IDEA                                  | -           | DarkCrypt TC                                    | Academic                         | ❌            | ❌ Missing - RSA hybrid                      |
| **BLOCK CIPHER MODES**       |                                |                                             |             |                                                 |                                  |              |                                             |
| modes                        | CBC                            | IBM                                         | 1976        | NIST SP 800-38A                                 | All libraries                    | ✅            | ✅ `cbc.js`                                  |
| modes                        | CCM                            | Housley, Whiting, Ferguson                  | 2003        | NIST SP 800-38C                                 | OpenSSL                          | ✅            | ✅ `ccm.js`                                  |
| modes                        | CFB                            | IBM                                         | 1976        | NIST SP 800-38A                                 | All libraries                    | ✅            | ✅ `cfb.js`                                  |
| modes                        | CMC                            | Halevi, Rogaway                             | 2003        | Academic                                        | Academic papers                  | ✅            | ✅ `cmc.js`                                  |
| modes                        | CTR                            | Whitfield Diffie, Martin Hellman            | 1979        | NIST SP 800-38A                                 | All libraries                    | ✅            | ✅ `ctr.js`                                  |
| modes                        | CTS                            | Schneier                                    | 1998        | Academic                                        | OpenSSL                          | ✅            | ✅ `cts.js`                                  |
| modes                        | EAX                            | Bellare, Rogaway, Wagner                    | 2003        | Academic                                        | Crypto++                         | ✅            | ✅ `eax.js`                                  |
| modes                        | ECB                            | IBM                                         | 1976        | NIST SP 800-38A                                 | All libraries                    | ✅            | ✅ `ecb.js`                                  |
| modes                        | EME                            | Halevi, Rogaway                             | 2003        | IEEE P1619.2                                    | Academic papers                  | ✅            | ✅ `eme.js`                                  |
| modes                        | GCM                            | McGrew, Viega                               | 2004        | NIST SP 800-38D                                 | All libraries                    | ✅            | ✅ `gcm.js`                                  |
| modes                        | GCM-SIV                        | Gueron, Langley, Lindell                    | 2015        | RFC 8452                                        | OpenSSL                          | ✅            | ✅ `gcm-siv.js`                              |
| modes                        | IGE                            | OpenSSL                                     | 2000        | Telegram                                        | OpenSSL                          | ✅            | ✅ `ige.js`                                  |
| modes                        | KW                             | NIST                                        | 2001        | NIST SP 800-38F                                 | OpenSSL                          | ✅            | ✅ `kw.js`                                   |
| modes                        | KWP                            | NIST                                        | 2001        | NIST SP 800-38F                                 | OpenSSL                          | ✅            | ✅ `kwp.js`                                  |
| modes                        | LRW                            | Liskov, Rivest, Wagner                      | 2002        | IEEE P1619                                      | Academic papers                  | ✅            | ✅ `lrw.js`                                  |
| modes                        | OCB                            | Rogaway                                     | 2001        | RFC 7253                                        | OpenSSL                          | ✅            | ✅ `ocb.js`                                  |
| modes                        | OCB3                           | Krovetz, Rogaway                            | 2011        | RFC 7253                                        | OpenSSL                          | ✅            | ✅ `ocb3.js`                                 |
| modes                        | OFB                            | IBM                                         | 1976        | NIST SP 800-38A                                 | All libraries                    | ✅            | ✅ `ofb.js`                                  |
| modes                        | PCBC                           | Kerberos                                    | 1980s       | Kerberos                                        | Academic papers                  | ✅            | ✅ `pcbc.js`                                 |
| modes                        | SIV                            | Rogaway, Shrimpton                          | 2006        | RFC 5297                                        | OpenSSL                          | ✅            | ✅ `siv.js`                                  |
| modes                        | XEX                            | Rogaway                                     | 2004        | Academic                                        | Academic papers                  | ✅            | ✅ `xex.js`                                  |
| modes                        | XTS                            | IEEE                                        | 2007        | IEEE 1619                                       | OpenSSL                          | ✅            | ✅ `xts.js`                                  |
| **CLASSICAL CIPHERS**        |                                |                                             |             |                                                 |                                  |              |                                             |
| classical                    | Affine                         | Ancient                                     | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `affine.js`                               |
| classical                    | Atbash                         | Ancient Hebrew                              | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `atbash.js`                               |
| classical                    | Autokey                        | Blaise de Vigenère                          | 1586        | Historical                                      | Academic                         | ✅            | ✅ `autokey.js`                              |
| classical                    | Bazeries                       | Étienne Bazeries                            | 1891        | Historical                                      | Academic                         | ✅            | ✅ `bazeries.js`                             |
| classical                    | Beaufort                       | Sir Francis Beaufort                        | 1857        | Historical                                      | Academic                         | ✅            | ✅ `beaufort.js`                             |
| classical                    | Bifid                          | Félix Delastelle                            | 1901        | Historical                                      | Academic                         | ✅            | ✅ `bifid.js`                                |
| classical                    | Cadaenus                       | Various                                     | Historical  | Classical cipher                                | Academic                         | ✅            | ✅ `cadaenus.js`                             |
| classical                    | Caesar                         | Julius Caesar                               | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `caesar.js`                               |
| classical                    | Columnar Transposition         | Various                                     | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `columnar.js`                             |
| classical                    | Enigma                         | Arthur Scherbius                            | 1918        | WWII                                            | Academic                         | ✅            | ✅ `enigma.js`                               |
| classical                    | Four-Square                    | Félix Delastelle                            | 1902        | Historical                                      | Academic                         | ✅            | ✅ `foursquare.js`                           |
| classical                    | Gronsfeld                      | Count Gronsfeld                             | 1600s       | Historical                                      | Academic                         | ✅            | ✅ `gronsfeld.js`                            |
| classical                    | Hill                           | Lester S. Hill                              | 1929        | Historical                                      | Academic                         | ✅            | ✅ `hill.js`                                 |
| classical                    | Jefferson Wheel                | Thomas Jefferson                            | 1795        | Historical                                      | Academic                         | ✅            | ✅ `jefferson-wheel.js`                      |
| classical                    | Nihilist                       | Russian Nihilists                           | 1880s       | Historical                                      | Academic                         | ✅            | ✅ `nihilist.js`                             |
| classical                    | Phillips                       | -                                           | -           | Classical cipher                                | Academic                         | ✅            | ✅ `phillips.js`                             |
| classical                    | Pigpen                         | Freemasons                                  | 1700s       | Historical                                      | Public domain                    | ✅            | ✅ `pigpen.js`                               |
| classical                    | Playfair                       | Charles Wheatstone                          | 1854        | Historical                                      | Academic                         | ✅            | ✅ `playfair.js`                             |
| classical                    | Polybius Square                | Polybius                                    | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `polybius.js`                             |
| classical                    | Porta                          | Giambattista della Porta                    | 1563        | Historical                                      | Academic                         | ✅            | ✅ `porta.js`                                |
| classical                    | Rail Fence                     | Various                                     | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `railfence.js`                            |
| classical                    | ROT13/ROT47                    | Usenet                                      | 1980s       | Internet culture                                | Public domain                    | ✅            | ✅ `rot.js`                                  |
| classical                    | Scytale                        | Ancient Greeks                              | Ancient     | Historical                                      | Academic                         | ✅            | ✅ `scytale.js`                              |
| classical                    | Solitaire                      | Bruce Schneier                              | 1999        | Cryptonomicon                                   | Academic                         | ✅            | ✅ `solitaire.js`                            |
| classical                    | Trifid                         | Félix Delastelle                            | 1902        | Historical                                      | Academic                         | ✅            | ✅ `trifid.js`                               |
| classical                    | Two-Square                     | Various                                     | 1800s       | Historical                                      | Academic                         | ✅            | ✅ `twosquare.js`                            |
| classical                    | Vigenère                       | Blaise de Vigenère                          | 1586        | Historical                                      | Academic                         | ✅            | ✅ `vigenere.js`                             |
| **CHECKSUMS**                |                                |                                             |             |                                                 |                                  |              |                                             |
| checksum                     | Adler-32                       | Mark Adler                                  | 1995        | zlib                                            | zlib                             | ✅            | ✅ `adler.js`                                |
| checksum                     | CRC-8                          | Various                                     | 1961        | Various standards                               | Public domain                    | ✅            | ✅ `crc8.js`                                 |
| checksum                     | CRC-16                         | Various                                     | 1961        | Various standards                               | Public domain                    | ✅            | ✅ `crc16.js`                                |
| checksum                     | CRC-24                         | Various                                     | 1961        | OpenPGP                                         | Public domain                    | ✅            | ✅ `crc24.js`                                |
| checksum                     | CRC-32                         | Various                                     | 1961        | IEEE 802.3                                      | Public domain                    | ✅            | ✅ `crc32.js`                                |
| checksum                     | CRC-64                         | Various                                     | 1961        | Various standards                               | Public domain                    | ✅            | ✅ `crc64.js`                                |
| checksum                     | CRC-128                        | Various                                     | 1961        | Various standards                               | Public domain                    | ✅            | ✅ `crc128.js`                               |
| checksum                     | Fletcher-32                    | John G. Fletcher                            | 1982        | Academic                                        | Public domain                    | ✅            | ✅ `fletcher.js`                             |
| checksum                     | Internet Checksum              | RFC 1071                                    | 1988        | TCP/IP                                          | Public domain                    | ✅            | ✅ `internet-checksum.js`                    |
| checksum                     | ISBN                           | ISO                                         | 1970        | ISO 2108                                        | Public domain                    | ✅            | ✅ `isbn.js`                                 |
| checksum                     | Unix Sum                       | AT&T                                        | 1970s       | Unix                                            | Public domain                    | ✅            | ✅ `unix-sum.js`                             |
| checksum                     | Luhn Algorithm                 | Hans Peter Luhn                             | 1954        | Credit card validation                          | ISO/IEC 7812                     | ❌            | ❌ Missing - Modulo-10 checksum              |
| checksum                     | EAN Checksum                   | Various                                     | 1976        | Barcode validation                              | GS1 Standard                     | ❌            | ❌ Missing - EAN-8, EAN-13, UPC-A            |
| **ERROR CORRECTION**         |                                |                                             |             |                                                 |                                  |              |                                             |
| ecc                          | BCH                            | Hocquenghem, Bose, Ray-Chaudhuri            | 1959        | Various standards                               | Academic                         | ✅            | ✅ `bch.js`                                  |
| ecc                          | Hamming                        | Richard Hamming                             | 1950        | Various standards                               | Academic                         | ✅            | ✅ `hamming.js`                              |
| ecc                          | LDPC                           | Robert Gallager                             | 1960        | Various standards                               | Academic                         | ✅            | ✅ `ldpc.js`                                 |
| ecc                          | Reed-Solomon                   | Irving Reed, Gustave Solomon                | 1960        | Various standards                               | Academic                         | ✅            | ✅ `reed-solomon.js`                         |
| ecc                          | Golay Code                     | Marcel J. E. Golay                          | 1949        | Perfect linear code (23,12,7)                   | Deep space comm                  | ❌            | ❌ Missing - Perfect error correction        |
| ecc                          | Reed-Muller Codes              | Irving Reed, David Muller                   | 1954        | Boolean function based linear codes             | Apollo missions, 5G              | ❌            | ❌ Missing - Boolean algebra connection      |
| ecc                          | Convolutional + Viterbi        | Andrew Viterbi                              | 1967        | Trellis codes with ML decoding                  | GSM, WiFi, DVB                   | ❌            | ❌ Missing - Dynamic programming decoder     |
| ecc                          | Turbo Codes                    | Berrou, Glavieux, Thitimajshima             | 1993        | Parallel concatenated conv codes                | 3G/4G mobile, DVB-RCS            | ❌            | ❌ Missing - Iterative decoding breakthrough |
| ecc                          | Polar Codes                    | Erdal Arıkan                                | 2008        | Channel polarization codes                      | 5G control channels              | ❌            | ❌ Missing - Provably capacity-achieving     |
| ecc                          | Fountain Codes (LT)            | Michael Luby                                | 2002        | Rateless erasure codes                          | BitTorrent protocols             | ❌            | ❌ Missing - Network error correction        |
| ecc                          | Raptor Codes                   | Amin Shokrollahi                            | 2006        | Systematic fountain codes                       | DVB-H, 3GPP MBMS                 | ❌            | ❌ Missing - Pre-coded fountain codes        |
| **COMPRESSION**              |                                |                                             |             |                                                 |                                  |              |                                             |
| compression                  | ANS Coding                     | Jarek Duda                                  | 2007        | Academic                                        | Academic                         | ✅            | ✅ `ans.js`                                  |
| compression                  | Arithmetic Coding              | Various                                     | 1976        | Academic                                        | Academic                         | ✅            | ✅ `arithmetic.js`                           |
| compression                  | BPE                            | Philip Gage                                 | 1994        | Academic                                        | Public domain                    | ✅            | ✅ `bpe.js`                                  |
| compression                  | BSC                            | -                                           | -           | Academic                                        | Academic                         | ✅            | ✅ `bsc.js`                                  |
| compression                  | Brotli                         | Google                                      | 2013        | RFC 7932                                        | Google                           | ✅            | ✅ `brotli.js`                               |
| compression                  | BWT                            | Burrows, Wheeler                            | 1994        | Academic                                        | Academic                         | ✅            | ✅ `bwt.js`                                  |
| compression                  | bzip2                          | Julian Seward                               | 1996        | Open source                                     | bzip2                            | ✅            | ✅ `bzip2.js`                                |
| compression                  | CMIX                           | -                                           | -           | Academic                                        | Academic                         | ✅            | ✅ `cmix.js`                                 |
| compression                  | CTW                            | -                                           | -           | Academic                                        | Academic                         | ✅            | ✅ `ctw.js`                                  |
| compression                  | DEFLATE                        | Phil Katz                                   | 1993        | RFC 1951                                        | zlib                             | ✅            | ✅ `deflate-simple.js`                       |
| compression                  | Delta                          | Various                                     | Various     | Academic                                        | Academic                         | ✅            | ✅ `delta.js`                                |
| compression                  | Elias Delta                    | Peter Elias                                 | 1975        | Academic                                        | Academic                         | ✅            | ✅ `elias-delta.js`                          |
| compression                  | Elias Gamma                    | Peter Elias                                 | 1975        | Academic                                        | Academic                         | ✅            | ✅ `elias-gamma.js`                          |
| compression                  | Fibonacci                      | Leonardo Fibonacci                          | 1202        | Academic                                        | Academic                         | ✅            | ✅ `fibonacci.js`                            |
| compression                  | Huffman                        | David Huffman                               | 1952        | Academic                                        | Academic                         | ✅            | ✅ `huffman.js`                              |
| compression                  | LZ4                            | Yann Collet                                 | 2011        | Open source                                     | LZ4                              | ✅            | ✅ `lz4.js`                                  |
| compression                  | LZ77                           | Lempel, Ziv                                 | 1977        | Academic                                        | Academic                         | ✅            | ✅ `lz77.js`                                 |
| compression                  | LZ78                           | Lempel, Ziv                                 | 1978        | Academic                                        | Academic                         | ✅            | ✅ `lz78.js`                                 |
| compression                  | LZMA                           | Igor Pavlov                                 | 1998        | 7-Zip                                           | 7-Zip                            | ✅            | ✅ `lzma.js`                                 |
| compression                  | LZO                            | Markus Oberhumer                            | 1996        | Open source                                     | LZO                              | ✅            | ✅ `lzo.js`                                  |
| compression                  | LZSS                           | Storer, Szymanski                           | 1982        | Academic                                        | Academic                         | ✅            | ✅ `lzss.js`                                 |
| compression                  | LZFSE                          | Apple                                       | 2015        | Apple                                           | Apple                            | ✅            | ✅ `lzfse.js`                                |
| compression                  | LZHAM                          | Richard Geldreich                           | 2010        | Gaming                                          | Public domain                    | ✅            | ✅ `lzham.js`                                |
| compression                  | LZVN                           | Apple                                       | 2014        | Apple                                           | Apple                            | ✅            | ✅ `lzvn.js`                                 |
| compression                  | LZW                            | Welch                                       | 1984        | GIF, TIFF                                       | Academic                         | ✅            | ✅ `lzw.js`                                  |
| compression                  | LZARI                          | Miki (NIFTY-Serve)                          | 1980s       | LZSS + Adaptive Arithmetic coding               | Academic, Japanese BBS           | ❌            | ❌ Missing - LZ + arithmetic combination     |
| compression                  | MTF (Move to Front)            | Boris Ryabko                                | 1980        | Transform for entropy improvement               | bzip2, BWT pipeline              | ✅            | ✅ `mtf.js`                                  |
| compression                  | Omega                          | -                                           | -           | Academic                                        | Academic                         | ✅            | ✅ `omega.js`                                |
| compression                  | PackBits                       | Apple                                       | 1984        | TIFF                                            | Public domain                    | ✅            | ✅ `packbits.js`                             |
| compression                  | PAQ                            | Matt Mahoney                                | 2002        | Academic                                        | Public domain                    | ✅            | ✅ `paq.js`                                  |
| compression                  | PPM                            | Cleary, Witten                              | 1984        | Academic                                        | Academic                         | ✅            | ✅ `ppm.js`                                  |
| compression                  | Range Coding                   | Various                                     | 1979        | Academic                                        | Academic                         | ✅            | ✅ `range-coding.js`                         |
| compression                  | RLE                            | Various                                     | 1960s       | Various                                         | Public domain                    | ✅            | ✅ `rle.js`                                  |
| compression                  | ROLZ                           | -                                           | -           | Academic                                        | Academic                         | ✅            | ✅ `rolz.js`                                 |
| compression                  | Shannon Coding                 | Claude Shannon                              | 1948        | Information theory foundation                   | Academic papers                  | ❌            | ❌ Missing - Entropy coding precursor        |
| compression                  | Shannon-Fano                   | Shannon, Fano                               | 1948        | Academic                                        | Academic                         | ✅            | ✅ `shannon-fano.js`                         |
| compression                  | LZH (LHA format)               | Haruyasu Yoshizaki                          | 1987        | LZSS + Huffman coding                           | Japanese archives, id Software   | ❌            | ❌ Missing - Historical gaming compression   |
| compression                  | Snappy                         | Google                                      | 2011        | Open source                                     | Google                           | ✅            | ✅ `snappy.js`                               |
| compression                  | zstd                           | Facebook                                    | 2015        | RFC 8478                                        | Facebook                         | ✅            | ✅ `zstd.js`                                 |
| compression                  | Adaptive Huffman               | Donald Knuth, Jeffrey Vitter                | 1973        | Academic research                               | Academic papers                  | ❌            | ❌ Missing - Dynamic Huffman trees           |
| compression                  | FSE (Finite State Entropy)     | Yann Collet                                 | 2013        | Zstandard entropy coder                         | Zstd reference                   | ❌            | ❌ Missing - Modern entropy coding           |
| compression                  | FLAC Audio                     | Josh Coalson                                | 2001        | Lossless audio compression                      | FLAC reference                   | ❌            | ❌ Missing - Audio-specific compression      |
| compression                  | rANS (Range ANS)               | Jarek Duda                                  | 2009        | Modern entropy coding                           | Academic papers                  | ❌            | ❌ Missing - High-performance entropy        |
| compression                  | Context Mixing                 | Various (PAQ series)                        | 1995+       | Maximum compression research                    | PAQ/ZPAQ implementations         | ❌            | ❌ Missing - Advanced statistical model      |
| compression                  | Unary                          | Various                                     | Ancient     | Simple encoding                                 | Academic                         | ✅            | ✅ `unary.js`                                |
| **ENCODING**                 |                                |                                             |             |                                                 |                                  |              |                                             |
| encoding                     | Base16                         | RFC 4648                                    | 2006        | RFC 4648                                        | Public domain                    | ✅            | ✅ `base16.js`                               |
| encoding                     | Base32                         | RFC 4648                                    | 2006        | RFC 4648                                        | Public domain                    | ✅            | ✅ `base32.js`                               |
| encoding                     | Base58                         | Satoshi Nakamoto                            | 2009        | Bitcoin                                         | Public domain                    | ✅            | ✅ `base58.js`                               |
| encoding                     | Base62                         | Various                                     | Various     | Web                                             | Public domain                    | ✅            | ✅ `base62.js`                               |
| encoding                     | Base64                         | RFC 4648                                    | 2006        | RFC 4648                                        | Public domain                    | ✅            | ✅ `base64.js`                               |
| encoding                     | Base85                         | Paul Rutter                                 | 1990        | Adobe                                           | Public domain                    | ✅            | ✅ `base85.js`                               |
| encoding                     | Base91                         | Joachim Henke                               | 2005        | Open source                                     | Public domain                    | ✅            | ✅ `base91.js`                               |
| encoding                     | Baudot                         | Émile Baudot                                | 1870        | Telegraphy                                      | Historical                       | ✅            | ✅ `baudot.js`                               |
| encoding                     | BinHex                         | Apple                                       | 1980s       | Mac OS                                          | Public domain                    | ✅            | ✅ `binhex.js`                               |
| encoding                     | BubbleBabble                   | Antti Huima                                 | 2000        | OpenSSH                                         | Public domain                    | ✅            | ✅ `bubblebabble.js`                         |
| encoding                     | Koremutake                     | Shorl                                       | 2003        | Internet                                        | Public domain                    | ✅            | ✅ `koremutake.js`                           |
| encoding                     | Manchester                     | G.E. Thomas                                 | 1949        | IEEE 802.3                                      | IEEE                             | ✅            | ✅ `manchester.js`                           |
| encoding                     | Morse Code                     | Samuel Morse                                | 1836        | Telegraphy                                      | Public domain                    | ✅            | ✅ `morse.js`                                |
| encoding                     | PEM                            | RSA Labs                                    | 1993        | RFC 7468                                        | Public domain                    | ✅            | ✅ `pem.js`                                  |
| encoding                     | UUEncoding                     | Unix                                        | 1980        | Unix                                            | Public domain                    | ✅            | ✅ `uuencode.js`                             |
| encoding                     | XXEncoding                     | Various                                     | 1990s       | Usenet                                          | Public domain                    | ✅            | ✅ `xxencode.js`                             |
| encoding                     | yEnc                           | Jürgen Helbing                              | 2001        | Usenet                                          | Public domain                    | ✅            | ✅ `yenc.js`                                 |
| encoding                     | Z85                            | Pieter Hintjens                             | 2010        | ZeroMQ                                          | Public domain                    | ✅            | ✅ `z85.js`                                  |
| **PADDING**                  |                                |                                             |             |                                                 |                                  |              |                                             |
| padding                      | ANSI X9.23                     | ANSI                                        | 1988        | Banking standard                                | ANSI                             | ✅            | ✅ `ansi-x923.js`                            |
| padding                      | Bit Padding                    | Various                                     | Various     | Various                                         | Public domain                    | ✅            | ✅ `bit-padding.js`                          |
| padding                      | ISO 10126                      | ISO                                         | 2007        | ISO standard                                    | ISO                              | ✅            | ✅ `iso10126.js`                             |
| padding                      | ISO/IEC 7816-4                 | ISO                                         | 1995        | Smart cards                                     | ISO                              | ✅            | ✅ `iso7816-4.js`                            |
| padding                      | OAEP                           | Bellare, Rogaway                            | 1994        | PKCS#1 v2                                       | RSA Labs                         | ✅            | ✅ `oaep.js`                                 |
| padding                      | No Padding                     | -                                           | -           | Various                                         | -                                | ✅            | ✅ `no-padding.js`                           |
| padding                      | PKCS#1                         | RSA Labs                                    | 1991        | RSA standard                                    | RSA Labs                         | ✅            | ✅ `pkcs1.js`                                |
| padding                      | PKCS#5                         | RSA Labs                                    | 1993        | RFC 2898                                        | Public domain                    | ✅            | ✅ `pkcs5.js`                                |
| padding                      | PKCS#7                         | RSA Labs                                    | 1993        | RFC 2315                                        | Public domain                    | ✅            | ✅ `pkcs7.js`                                |
| padding                      | PSS                            | Bellare, Rogaway                            | 1998        | PKCS#1 v2.1                                     | RSA Labs                         | ✅            | ✅ `pss.js`                                  |
| padding                      | Zero Padding                   | Various                                     | Various     | Various                                         | Public domain                    | ✅            | ✅ `zero.js`                                 |
| **RANDOM NUMBER GENERATORS** |                                |                                             |             |                                                 |                                  |              |                                             |
| random                       | Random                         | Various                                     | Various     | Testing                                         | -                                | ✅            | ✅ `random.js`                               |
| random                       | Mersenne Twister MT19937       | Matsumoto, Nishimura                        | 1997        | Standard PRNG, 2^19937-1 period                 | Academic/industry standard       | ❌            | ❌ Missing - Industry standard PRNG          |
| random                       | Xorshift Family                | George Marsaglia                            | 2003        | Fast XOR-shift PRNGs                            | Numerical Recipes                | ❌            | ❌ Missing - High-speed generators           |
| random                       | Linear Congruential (LCG)      | D.H. Lehmer                                 | 1949        | Classic PRNG (includes bad examples like RANDU) | Academic textbooks               | ❌            | ❌ Missing - Educational (shows failures)    |
| random                       | ChaCha20-RNG                   | Daniel J. Bernstein                         | 2008        | Cryptographically secure stream cipher based    | LibSodium, OpenSSL               | ❌            | ❌ Missing - CSPRNG implementation           |
| random                       | Fortuna                        | Niels Ferguson, Bruce Schneier              | 2003        | Cryptographically secure entropy pool           | Academic/industry                | ❌            | ❌ Missing - Entropy pool management         |
| **SPECIAL/OTHER**            |                                |                                             |             |                                                 |                                  |              |                                             |
| special                      | Al-Kindi Frequency Analysis    | Al-Kindi                                    | 9th century | Historical                                      | Academic                         | ✅            | ✅ `al-kindi-frequency.js`                   |
| special                      | CCM                            | Housley, Whiting, Ferguson                  | 2003        | NIST SP 800-38C (special variant)               | OpenSSL                          | ✅            | ✅ `ccm.js` (special)                        |
| special                      | Cross                          | -                                           | -           | Academic                                        | Academic                         | ✅            | ✅ `cross.js`                                |
| special                      | EAX                            | Bellare, Rogaway, Wagner                    | 2003        | Academic (special variant)                      | Crypto++                         | ✅            | ✅ `eax.js` (special)                        |
| special                      | Fiat-Shamir                    | Fiat, Shamir                                | 1986        | Academic                                        | Academic                         | ✅            | ✅ `fiat-shamir.js`                          |
| special                      | Shamir Secret Sharing          | Adi Shamir                                  | 1979        | Academic                                        | Academic                         | ✅            | ✅ `shamir-secret-sharing.js`                |
| special                      | Time-Lock Puzzle               | Rivest, Shamir, Wagner                      | 1996        | Academic                                        | Academic                         | ✅            | ✅ `time-lock-puzzle.js`                     |

**Legend:**

* ✅ Fully working implementation with passing tests
* ⚠️ Partially working (interface issues, test failures, or metadata problems)
* ❌ Not implemented / Missing

## 📚 Reference Libraries (9 total)

### **Core Academic References**

1. **[Bouncy Castle Java](https://github.com/bcgit/bc-java)** (Java) - Comprehensive cryptographic library
2. **[Bouncy Castle C#](https://github.com/bcgit/bc-csharp)** (C#) - .NET port of Bouncy Castle
3. **[Bouncy Castle Kotlin](https://github.com/bcgit/bc-kotlin)** (Kotlin) - Kotlin port of Bouncy Castle
4. **[Crypto++]( https://github.com/weidai11/cryptopp )** (C++) - Free C++ library of cryptographic schemes
5. **[LibTomCrypt](https://github.com/WinBuilds/tomcrypt)** (C) - Portable cryptographic library
6. **[CEX](https://github.com/QRCS-CORP/CEX)** (C++) - Modern cryptographic library with extensive implementations
7. **[Crypto3](https://github.com/nilfoundation/crypto3)** (C++) - Cryptographic algorithms collection
8. **[Crypto-Reference](https://github.com/ReversingID/Crypto-Reference/tree/master/Codes)** (Mostly C) - Collection of cryptographic implementations and references

### **Production Libraries**  

1. **[OpenSSL](https://github.com/openssl/openssl)** (C) - Industry standard TLS/SSL and crypto library
2. **[wolfSSL](https://github.com/wolfSSL/wolfssl)** (C) - Embedded-focused TLS/SSL implementation
3. **[mbedTLS](https://github.com/Mbed-TLS/mbedtls)** (C) - Portable, easy-to-use TLS library

### **Language-Specific Libraries**

1. **[CryptoJS](https://github.com/brix/crypto-js)** (JavaScript) - JavaScript cryptographic standards
2. **[PyCryptodome](https://github.com/Legrandin/pycryptodome)** (Python) - Self-contained Python cryptographic library

## 🏆 Cryptographic Competitions & Sources Referenced

The comprehensive algorithm table above covers submissions and winners from major cryptographic competitions:

### **Historical Cryptographic Competitions**

* **[AES Competition](https://competitions.cr.yp.to/aes.html)** (1997-2000) - NIST standard for encryption
* **[NESSIE Project](https://web.archive.org/web/20130801084122/https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html)** (2000-2003) - European cryptographic primitive evaluation
* **[eSTREAM Project](https://competitions.cr.yp.to/estream.html)** (2004-2008) - Stream cipher competition
* **[SHA-3 Competition](https://competitions.cr.yp.to/sha3.html)** (2007-2012) - NIST hash function standardization
* **[CAESAR Competition](https://competitions.cr.yp.to/caesar-submissions.html)** (2013-2019) - Authenticated encryption schemes
* **[PHC Competition](https://www.password-hashing.net/)** (2013-2015) - Password hashing competition
* **[NIST PQC](https://csrc.nist.gov/projects/post-quantum-cryptography)** (2016-2024) - Post-quantum cryptography standardization
* **[ECRYPT](https://web.archive.org/web/20220301204947/https://www.ecrypt.eu.org/)** (2004-2008) - European Network of Excellence in Cryptology

### **Software Collections & Libraries**

* **[DarkCrypt TC](https://totalcmd.net/plugring/darkcrypttc.html)** - Total Commander encryption plugin (100+ algorithms)
* **[CRYPTREC](https://www.cryptrec.go.jp/)** - Japanese cryptographic standards

### **Academic & Reference Sources**

* Wikipedia Cryptography Categories
  * [German](https://de.wikipedia.org/wiki/Kategorie:Kryptologisches_Verfahren)
  * [English](https://en.wikipedia.org/wiki/Category:Cryptographic_algorithms)
  * [Chinese](https://zh.wikipedia.org/wiki/%E5%AF%86%E7%A2%BC%E5%AD%B8%E4%B8%BB%E9%A1%8C%E5%88%97%E8%A1%A8)
  * [Russian](https://ru.wikipedia.org/wiki/%D0%9A%D1%80%D0%B8%D0%BF%D1%82%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D1%8F)
  * [Japanese](https://ja.wikipedia.org/wiki/%E3%83%96%E3%83%AD%E3%83%83%E3%82%AF%E6%9A%97%E5%8F%B7)

* International Association for Cryptologic Research
  * Crypto
  * Eurocrypt
  * Asiacrypt
  * Fast Software Encryption (FSE)
  * Public Key Cryptography (PKC)
  * Cryptographic Hardware and Embedded Systems (CHES)
  * Theory of Cryptography (TCC)
  * Real World Crypto Symposium (RWC)

## 📊 Implementation Summary

### **Coverage Statistics (Updated with Research Results)**

* **Total Algorithms Tracked**: 332 current implementations + 70+ newly researched = **402+ algorithms**
* **Fully Functional**: ~247 algorithms (61%)
* **Partially Working**: ~56 algorithms (14%)
* **Research Targets**: 70+ newly identified algorithms (18%)
* **Missing/Legacy**: ~30 algorithms (7%)

### **Category Breakdown (Updated)**

| Category               | Current | New Research | Total | Implementation Priority    |
| ---------------------- | ------- | ------------ | ----- | -------------------------- |
| **Compression**        | 39      | 20+          | 59+   | High (modern algorithms)   |
| **Block Ciphers**      | 90      | 7+           | 97+   | Medium (missing finalists) |
| **Stream Ciphers**     | 44      | 8+           | 52+   | Medium (eSTREAM missing)   |
| **Error Correction**   | 4       | 25+          | 29+   | High (educational value)   |
| **Random Generators**  | 1       | 35+          | 36+   | High (fundamental CS)      |
| **Hash Functions**     | 27      | 8+           | 35+   | Medium (SHA-3 missing)     |
| **Classical Ciphers**  | 24      | 5+           | 29+   | Low (complete coverage)    |
| **Asymmetric/PQC**     | 20      | 15+          | 35+   | High (post-quantum)        |
| **Block Cipher Modes** | 22      | 3+           | 25+   | Low (good coverage)        |
| **Encoding**           | 18      | 2+           | 20+   | Low (complete coverage)    |
| **MAC/AEAD**           | 15      | 12+          | 27+   | High (CAESAR missing)      |
| **Others/Special**     | 48      | 10+          | 58+   | Variable                   |

### **Recent Achievements**

* **Stream Cipher Fixes**: HC-128, SNOW 3G, ZUC now fully functional (100% tests)
* **Reference Library Expansion**: 10 major cryptographic codebases cloned
* **Competition Coverage**: Complete tracking across 7 major cryptographic competitions
* **Universal Pattern**: All implementations follow educational standards with OpCodes integration

### **Priority Areas for Future Development (Research-Based)**

#### **Immediate Priority (High Educational Value)**

1. **Error Correction Codes**: Golay, Reed-Muller, Viterbi decoding - fundamental CS education
2. **Random Number Generators**: Mersenne Twister, LCG families, Xorshift - core programming knowledge  
3. **Compression Algorithms**: FSE, rANS, FLAC - modern high-performance techniques
4. **NIST LWC Winners**: TinyJAMBU, SPARKLE, Elephant - essential for IoT security education

#### **High Priority (Standards & Competitions)**

1. **Post-Quantum Cryptography**: Complete NIST PQC finalists coverage
2. **CAESAR Competition**: Missing AEGIS-128, MORUS, COLM authenticated encryption
3. **SHA-3 Competition**: BLAKE, Shabal, CubeHash hash functions
4. **Modern Compression**: Context mixing, advanced statistical models

#### **Medium Priority (Specialized Applications)**

1. **Stream Cipher Improvements**: Test vector fixes for existing implementations
2. **National Standards**: Chinese SM algorithms, GOST variants
3. **Automotive/IoT**: PRESENT, CLEFIA lightweight cryptography
4. **Blockchain Signatures**: BLS, Ed25519, Schnorr implementations

This comprehensive reference collection provides the foundation for systematic improvement and expansion of the educational cryptographic algorithm library while maintaining historical accuracy and technical rigor.

## 📚 Reference Libraries Collection

Based on systematic research across 437 cryptographic algorithms, we have compiled the most authoritative sources for specifications, test vectors, and reference implementations. This collection prioritizes official standards and academically verified sources.

### **Official Standards and Specifications**

#### **NIST Publications (Tier 1 Authority)**

* **[FIPS 197 - AES](https://csrc.nist.gov/pubs/fips/197/final)** - Advanced Encryption Standard (PDF: <https://csrc.nist.gov/files/pubs/fips/197/final/docs/fips-197.pdf>)
* **[FIPS 180-4 - SHA-2](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf)** - Secure Hash Standard (SHA-224, SHA-256, SHA-384, SHA-512)
* **[FIPS 186-4 - DSS](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf)** - Digital Signature Standard (ECDSA/ECDH)
* **[FIPS 186-5 - DSS](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-5.pdf)** - Updated Digital Signature Standard
* **[FIPS 46-3 - DES](https://csrc.nist.gov/files/pubs/fips/46-3/final/docs/fips46-3.pdf)** - Data Encryption Standard (Withdrawn)
* **[SP 800-67 Rev. 2 - 3DES](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-67r2.pdf)** - Triple DES (Withdrawn 2024)

#### **NIST Test Vector Collections**

* **[CAVP Block Ciphers](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers)** - AES, DES, 3DES validation
* **[CAVP Secure Hashing](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/secure-hashing)** - SHA family validation
* **[CAVP Digital Signatures](https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/digital-signatures)** - ECDSA, RSA validation
* **[AESAVS Specification](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/aes/AESAVS.pdf)** - AES Algorithm Validation System
* **[ECDSA2VS Specification](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/dss2/ecdsa2vs.pdf)** - ECDSA Validation System

### **IETF RFC Specifications (Tier 1 Authority)**

#### **Stream Ciphers and AEAD**

* **[RFC 8439 - ChaCha20-Poly1305](https://datatracker.ietf.org/doc/html/rfc8439)** - ChaCha20 stream cipher and Poly1305 MAC
* **[RFC 6229 - RC4 Test Vectors](https://datatracker.ietf.org/doc/rfc6229/)** - RC4 stream cipher (deprecated)
* **[RFC 7693 - BLAKE2](https://datatracker.ietf.org/doc/html/rfc7693.html)** - BLAKE2 cryptographic hash and MAC

#### **Message Authentication**

* **[RFC 2104 - HMAC](https://www.rfc-editor.org/rfc/rfc2104)** - Keyed-Hashing for Message Authentication
* **[RFC 4231 - HMAC Test Vectors](https://datatracker.ietf.org/doc/html/rfc4231)** - SHA-224/256/384/512 HMAC vectors

#### **Asymmetric Cryptography**

* **[RFC 3447 - PKCS #1 v2.1](https://www.rfc-editor.org/rfc/rfc3447.html)** - RSA Cryptography Specifications
* **[RFC 8017 - PKCS #1 v2.2](https://tools.ietf.org/html/rfc8017)** - Current RSA specifications
* **[RFC 8032 - EdDSA](https://datatracker.ietf.org/doc/html/rfc8032)** - Ed25519 and Ed448 signatures
* **[RFC 7748 - Curve25519/X25519](https://datatracker.ietf.org/doc/html/rfc7748)** - Elliptic curves for security
* **[RFC 6979 - Deterministic DSA/ECDSA](https://www.ietf.org/rfc/rfc6979.txt)** - Deterministic signature schemes

### **Academic and Research Sources (Tier 2 Authority)**

#### **AES Competition Finalists**

* **[Serpent Homepage](https://www.cl.cam.ac.uk/~rja14/serpent.html)** - Official specification and reference implementation
* **[Serpent Reference Code](https://www.cl.cam.ac.uk/~fms27/serpent/)** - C implementations and test vectors
* **[Serpent Academic Paper](https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf)** - Original submission document

#### **Classical and Historical Ciphers**

* **[Blowfish Specification](https://www.schneier.com/academic/blowfish/)** - Bruce Schneier's original specification
* **[Blowfish Draft RFC](https://datatracker.ietf.org/doc/html/draft-schneier-blowfish-00)** - IETF draft specification
* **[Blowfish Reference Code](https://www.schneier.com/academic/blowfish/download/)** - Original C implementation

### **Major Cryptographic Library Implementations**

#### **Industry-Standard Libraries**

* **[OpenSSL](https://github.com/openssl/openssl)** - Complete cryptographic library with hardware acceleration
  * AES Implementation: `crypto/aes/aes_core.c`
  * Full algorithm coverage for TLS/SSL standards
* **[Crypto++](https://www.cryptopp.com/)** - Comprehensive C++ cryptographic library
  * Extensive AES finalist coverage (Serpent, Mars, RC6, etc.)
  * FIPS validated implementations
* **[Bouncy Castle](https://www.bouncycastle.org/)** - Java/C# cryptographic library
  * Academic algorithm implementations
  * Comprehensive test vector coverage

#### **Specialized and Research Libraries**

* **[LibTomCrypt](https://github.com/libtom/libtomcrypt)** - Portable C cryptographic toolkit
* **[wolfSSL](https://github.com/wolfSSL/wolfssl)** - Embedded-focused TLS implementation  
* **[mbedTLS](https://github.com/Mbed-TLS/mbedtls)** - Portable, lightweight TLS library
* **[PyCryptodome](https://github.com/Legrandin/pycryptodome)** - Python cryptographic library
* **[CryptoJS](https://github.com/brix/crypto-js)** - JavaScript cryptographic implementations
* **[EmbeddedSW.net Cipher Collection](http://www.embeddedsw.net/Cipher_Reference_Home.html)** - Academic cipher implementations with test vectors

### **Systematic Collection Results**

#### **Research Coverage Statistics**

* **Total URIs Collected**: 200+ authoritative sources
* **Official Standards**: 25+ NIST/IETF specifications
* **Reference Implementations**: 50+ verified codebases
* **Test Vector Collections**: 15+ comprehensive suites
* **Academic Papers**: 30+ peer-reviewed sources
* **Competition Archives**: 7 major cryptographic competitions

#### **Implementation Quality Tiers**

### Tier 1: Official Standards (Highest Authority)

* NIST FIPS publications with CAVP test vectors
* IETF RFC specifications with embedded test vectors
* Official algorithm specifications from original authors

### Tier 2: Verified Implementations (High Authority)

* Industry-standard libraries (OpenSSL, Crypto++, Bouncy Castle)
* Academic papers from peer-reviewed conferences
* Competition submission packages with verification

### Tier 3: Community Sources (Moderate Authority)

* Well-maintained open-source implementations
* Cross-verified implementations across multiple sources
* Educational implementations with proper attribution

This systematic reference collection enables offline verification, educational study, and implementation validation for the complete cryptographic algorithm library while maintaining strict adherence to authoritative sources and academic rigor.

---
*Last Updated: 2025-10-10*
*Total Algorithms: 402+ tracked | Reference Libraries: 10 cloned | Authoritative Sources: 200+ URIs | Official Standards: 25+ NIST/IETF*
