/*
 * VMPC-KSA3 (Variably Modified Permutation Composition with KSA3) Stream Cipher
 * Production implementation compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * VMPC-KSA3 is a variant of VMPC designed by Bartosz Zoltak.
 * It uses a modified Key Scheduling Algorithm (KSA3) with an additional
 * 768-round key mixing phase for enhanced initialization.
 *
 * Key Features:
 * - Variable key size (1-256 bytes)
 * - Variable IV size (1-768 bytes recommended)
 * - 256-byte S-box internal state
 * - Enhanced KSA with three mixing phases (key→IV→key)
 * - Identical PRGA to VMPC: z = P[P[P[s]] + 1]
 *
 * Algorithm Structure:
 * 1. KSA Phase 1: Initialize S-box with key over 768 rounds
 * 2. KSA Phase 2: Further scramble S-box with IV over 768 rounds
 * 3. KSA Phase 3 (NEW): Additional scramble with key over 768 rounds
 * 4. PRGA: Generate keystream using modified indirection: z = P[P[P[s]] + 1]
 *
 * SECURITY STATUS: EXPERIMENTAL - Not widely analyzed
 * USE FOR: Research, specialized applications requiring enhanced VMPC security margin
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class VMPCKSA3Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "VMPC-KSA3";
      this.description = "Enhanced VMPC variant with modified Key Scheduling Algorithm using three 768-round mixing phases (key-IV-key). Provides increased security margin through additional key scrambling after IV initialization.";
      this.inventor = "Bartosz Zoltak";
      this.year = 2006;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.PL;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 256, 0)  // Variable key size: 1-256 bytes
      ];
      this.SupportedNonceSizes = [
        new KeySize(1, 768, 0)  // Variable IV/nonce size: 1-768 bytes recommended
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("BouncyCastle VMPC-KSA3 Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/VMPCKSA3Engine.java"),
        new LinkItem("VMPC Specification", "http://www.vmpcfunction.com/vmpc.pdf"),
        new LinkItem("eSTREAM Project", "https://www.ecrypt.eu.org/stream/")
      ];

      // Security notes
      this.knownVulnerabilities = [
        new Vulnerability(
          "Limited Cryptanalysis",
          "VMPC-KSA3 has received less cryptanalytic attention compared to established stream ciphers",
          "Use only after thorough security review for your specific use case"
        )
      ];

      // Official test vectors from BouncyCastle implementation
      // Reference: bc-lts/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java
      this.tests = [
        {
          text: "BouncyCastle VMPC-KSA3 Test Vector - First 4 keystream bytes",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java",
          input: new Array(4).fill(0),
          key: OpCodes.Hex8ToBytes("9661410AB797D8A9EB767C21172DF6C7"),
          iv: OpCodes.Hex8ToBytes("4B5C2F003E67F39557A8D26F3DA2B155"),
          // Verified against BouncyCastle Java reference: positions 0,1,2,3 = B6,EB,AE,FE
          expected: OpCodes.Hex8ToBytes("B6EBAEFE")
        },
        {
          text: "BouncyCastle VMPC-KSA3 Test Vector - First 256 bytes (positions 252-255)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java",
          input: new Array(256).fill(0),
          key: OpCodes.Hex8ToBytes("9661410AB797D8A9EB767C21172DF6C7"),
          iv: OpCodes.Hex8ToBytes("4B5C2F003E67F39557A8D26F3DA2B155"),
          // Complete first 256 bytes - verified against BouncyCastle Java reference
          // Specific check: positions 252,253,254,255 = 48,17,24,73
          expected: OpCodes.Hex8ToBytes(
            "B6EBAEFEB990F26462D3DF13612699D69852EA06C806BDC238715E73B4AA1BEC" +
            "EFEFA17343A5005B032A1FE8DD05787514008DF74D7D66408C452C696BBA2256" +
            "1D8384E6B2E221CB910BD4994A9B15F7A673B94A2A314C85A56A1BF50C611254" +
            "DFB6D3554EE08E90AA543E396E3CA64C190A2435299F5C6FC8D88EA656A13D89" +
            "6F1735BD2BE91225FF3B85618623A99EE520FD8D5DDBFC5724BCAB3F131D5563" +
            "1CDCE9EF4F5099EE0116E3CCF49874687DFA3D4BB13B1CF4F63AD1E94ABC562C" +
            "1F5A6D5B1BACF9416ADD318B0B3B35921AA101EB4D40772CB4C9EA0D20205B3C" +
            "6154B3B5C7CF48D3C80D9E3501E6EE2BE8D74BB4D6A9388D0E321230" +
            "48172473"
          )
        },
        {
          text: "BouncyCastle VMPC-KSA3 Test Vector - First 1024 bytes (positions 1020-1023)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java",
          input: new Array(1024).fill(0),
          key: OpCodes.Hex8ToBytes("9661410AB797D8A9EB767C21172DF6C7"),
          iv: OpCodes.Hex8ToBytes("4B5C2F003E67F39557A8D26F3DA2B155"),
          // Complete first 1024 bytes - verified against BouncyCastle Java reference
          // Specific check: positions 1020,1021,1022,1023 = 1D,AE,C3,5A
          expected: OpCodes.Hex8ToBytes(
            "B6EBAEFEB990F26462D3DF13612699D69852EA06C806BDC238715E73B4AA1BEC" +
            "EFEFA17343A5005B032A1FE8DD05787514008DF74D7D66408C452C696BBA2256" +
            "1D8384E6B2E221CB910BD4994A9B15F7A673B94A2A314C85A56A1BF50C611254" +
            "DFB6D3554EE08E90AA543E396E3CA64C190A2435299F5C6FC8D88EA656A13D89" +
            "6F1735BD2BE91225FF3B85618623A99EE520FD8D5DDBFC5724BCAB3F131D5563" +
            "1CDCE9EF4F5099EE0116E3CCF49874687DFA3D4BB13B1CF4F63AD1E94ABC562C" +
            "1F5A6D5B1BACF9416ADD318B0B3B35921AA101EB4D40772CB4C9EA0D20205B3C" +
            "6154B3B5C7CF48D3C80D9E3501E6EE2BE8D74BB4D6A9388D0E32123048172473" +
            "CACEED6C6EA91CD286C5CD15D1EE7E707E56BED418F717D72648A221CD6B7DDE" +
            "FBFE4DAE9D8F3BF10C38B4E48BC8DA7CED1085EA785496CD0082AAE77287FEC8" +
            "DA8DC732311530E5FEAF544A48EEE317B2A8B0218DE2AA3EDE7C9F9CEAE3EECC" +
            "909BFF3EC07B7CCD1200E68337EEBDE4EF0C06DCFA25CF9438023DF1CB642509" +
            "910D27EE6B82ED692B11F2D22591634D15D725596F40F859F58C1AB15C32CEAE" +
            "DC89C87756C0D4D56E0BDC3D2427F18A61582988F1E548DFDE723999251409A9" +
            "A1142AB896A35DF2F6430062871DF9283BC8CFB0122EB0BA59462AB243EA0BD3" +
            "3A87E0ECD73601B14328324B7B7D449DFC13C9F6B052DF2F13FEABC80880BCFD" +
            "07A2B1BBA2672AA66075127B6CD59ED0CC58C52A675DEA50D4928788AE4A4702" +
            "B7CCAEE90A41391F35896A898570AD54B95D36358A62599BA5DF411139564B4A" +
            "7A023750AEF822E1AC5C073B64703B670B8839591EE8B775C46F9ABFDBD9AF6F" +
            "25A628FAE181485321917E0302B63106D72BD6DB9955ADCB7F34C4C3712F1911" +
            "1ACEFDFA3F92283D049CE41F5E73C961DF9BFF60B48825858F7FFB43C0E93AA8" +
            "D983E9E68E130D7BF6B75D2FB36392D4EDCCADF632ED5FB6FF22845C09B9EDC8" +
            "9FD8D73C75D6CCB6AF099F960D53AA57A561CBB56FF69AB82396E8147D312777" +
            "2481439699D17842401097FAAB434A34DB6C699880CB83FDB00FB0098CDC11AA" +
            "CF4F75EB2489E322574E18DDADB8B795A85AE9BCD8AC2AFAB286C9B889C93BC9" +
            "201EEBCD4672E1D92567A37D07B89D4D67CC2C31EC02B52821D3D38FAF97D4EF" +
            "2DF226D47444F2696019D1E1F6342A952D926A6FBA8040F9E518718AF4CCBD79" +
            "91926DD46F4A42CEA3B8E0E95728AC2039456F1093BDFB48617169E8CDA408DF" +
            "07AD4975447BF2DE5A31B4FBEE303C4C7A46E95B647A3CFAEF44E29B7E03BB87" +
            "D3397BC1F1898E20E92E2FAF315FC43BFFBF31B8B5E1525A60791CC98D858B78" +
            "C90491155540762EEFA898548254F5DDAD39F5C5E084DDF509A4942F7417AC3B" +
            "6092BDF9CA01C9EA78B429056E797C3DCA87AABE1CF6B7D91114068E1DAEC35A"
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Stream cipher - encryption and decryption are identical
      return new VMPCKSA3Instance(this, isInverse);
    }
  }

  // Instance class implementing VMPC-KSA3 stream cipher
  class VMPCKSA3Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._iv = null;
      this.inputBuffer = [];

      // VMPC state
      this.P = new Array(256);  // S-box permutation (called P in VMPC spec)
      this.n = 0;               // PRGA counter n
      this.s = 0;               // PRGA counter s
      this.initialized = false;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 1 || keyLength > 256) {
        throw new Error(`Invalid VMPC-KSA3 key size: ${keyLength} bytes. Requires 1-256 bytes`);
      }

      this._key = [...keyBytes];

      // Initialize if we also have IV
      if (this._iv) {
        this._initializeVMPCKSA3();
      }
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property setter for IV/nonce
    set iv(ivData) {
      if (!ivData) {
        this._iv = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(ivData)) {
        throw new Error("Invalid IV - must be byte array");
      }

      const ivLength = ivData.length;
      if (ivLength < 1 || ivLength > 768) {
        throw new Error(`Invalid VMPC-KSA3 IV size: ${ivLength} bytes. Requires 1-768 bytes`);
      }

      this._iv = [...ivData];

      // Initialize if we also have key
      if (this._key) {
        this._initializeVMPCKSA3();
      }
    }

    get iv() {
      return this._iv ? [...this._iv] : null;
    }

    set nonce(nonceData) {
      this.iv = nonceData;
    }

    get nonce() {
      return this.iv;
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }

      this.inputBuffer.push(...data);
    }

    // Get the cipher result
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (!this._iv) {
        throw new Error("IV not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("VMPC-KSA3 not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize VMPC-KSA3 with key and IV
    // This is the KEY DIFFERENCE from standard VMPC - three mixing phases instead of two
    _initializeVMPCKSA3() {
      if (!this._key || !this._iv) return;

      // Step 1: Initialize P-box with identity permutation
      for (let i = 0; i < 256; i++) {
        this.P[i] = i;
      }

      // Step 2: KSA Phase 1 - scramble P with key over 768 rounds
      this.s = 0;
      for (let m = 0; m < 768; m++) {
        const i = m & 0xFF;  // m mod 256
        const keyByte = this._key[m % this._key.length];

        // s = P[(s + P[i] + key[m mod keyLen]) mod 256]
        this.s = this.P[(this.s + this.P[i] + keyByte) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Step 3: KSA Phase 2 - further scramble P with IV over 768 rounds
      for (let m = 0; m < 768; m++) {
        const i = m & 0xFF;  // m mod 256
        const ivByte = this._iv[m % this._iv.length];

        // s = P[(s + P[i] + iv[m mod ivLen]) mod 256]
        this.s = this.P[(this.s + this.P[i] + ivByte) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Step 4: KSA Phase 3 (NEW IN KSA3) - additional scramble with key over 768 rounds
      // This is the distinctive feature of VMPC-KSA3
      for (let m = 0; m < 768; m++) {
        const i = m & 0xFF;  // m mod 256
        const keyByte = this._key[m % this._key.length];

        // s = P[(s + P[i] + key[m mod keyLen]) mod 256]
        this.s = this.P[(this.s + this.P[i] + keyByte) & 0xFF];

        // Swap P[i] and P[s]
        const temp = this.P[i];
        this.P[i] = this.P[this.s];
        this.P[this.s] = temp;
      }

      // Reset PRGA counters
      this.n = 0;
      this.initialized = true;
    }

    // Pseudo-Random Generation Algorithm (PRGA) - generate one keystream byte
    // This is IDENTICAL to standard VMPC - only the KSA differs
    _generateKeystreamByte() {
      // Load P[n]
      const pn = this.P[this.n & 0xFF];

      // Update s: s = P[(s + P[n]) mod 256]
      this.s = this.P[(this.s + pn) & 0xFF];

      // Load P[s]
      const ps = this.P[this.s & 0xFF];

      // Triple indirection to generate keystream byte
      // z = P[(P[P[s]] + 1) mod 256]
      // ps already contains P[s], so P[ps] is P[P[s]], and P[(P[ps] + 1)] is P[P[P[s]] + 1]
      const z = this.P[(this.P[ps & 0xFF] + 1) & 0xFF];

      // Swap P[n] and P[s]
      this.P[this.n & 0xFF] = ps;
      this.P[this.s & 0xFF] = pn;

      // Increment n: n = (n + 1) mod 256
      this.n = (this.n + 1) & 0xFF;

      return z;
    }
  }

  // Register the algorithm
  const algorithmInstance = new VMPCKSA3Algorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { VMPCKSA3Algorithm, VMPCKSA3Instance };
}));
