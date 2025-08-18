#!/usr/bin/env node
/*
 * Reference Links System
 * Provides links to proven libraries and original author implementations
 * Replaces local Reference folder with authoritative external sources
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  const ReferenceLinks = {
    
    // Authoritative implementation sources
    algorithmSources: {
      // === NIST/FIPS Standards ===
      'aes': {
        name: 'AES (Advanced Encryption Standard)',
        standard: 'FIPS 197',
        sources: {
          official: 'https://csrc.nist.gov/publications/detail/fips/197/final',
          nistReference: 'https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program/block-ciphers',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/aes/',
          mbedtls: 'https://github.com/Mbed-TLS/mbedtls/tree/development/library/aes.c',
          libgcrypt: 'https://github.com/gpg/libgcrypt/blob/master/cipher/rijndael.c'
        }
      },
      'sha256': {
        name: 'SHA-256',
        standard: 'FIPS 180-4',
        sources: {
          official: 'https://csrc.nist.gov/publications/detail/fips/180/4/final',
          rfc: 'https://tools.ietf.org/rfc/rfc6234.txt',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/sha/',
          mbedtls: 'https://github.com/Mbed-TLS/mbedtls/blob/development/library/sha256.c'
        }
      },
      'des': {
        name: 'DES (Data Encryption Standard)',
        standard: 'FIPS 46-3 (Withdrawn)',
        sources: {
          official: 'https://csrc.nist.gov/publications/detail/fips/46/3/final',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/des/',
          libgcrypt: 'https://github.com/gpg/libgcrypt/blob/master/cipher/des.c'
        }
      },
      
      // === RFC Standards ===
      'chacha20': {
        name: 'ChaCha20',
        standard: 'RFC 7539',
        sources: {
          rfc: 'https://tools.ietf.org/rfc/rfc7539.txt',
          originalPaper: 'https://cr.yp.to/chacha/chacha-20080128.pdf',
          djbCode: 'https://cr.yp.to/chacha.html',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/chacha/',
          libsodium: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_stream_chacha20'
        }
      },
      'salsa20': {
        name: 'Salsa20',
        standard: 'eSTREAM Portfolio',
        sources: {
          originalPaper: 'https://cr.yp.to/snuffle/spec.pdf',
          djbCode: 'https://cr.yp.to/salsa20.html',
          libsodium: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_stream_salsa20'
        }
      },
      'poly1305': {
        name: 'Poly1305',
        standard: 'RFC 7539',
        sources: {
          rfc: 'https://tools.ietf.org/rfc/rfc7539.txt',
          originalPaper: 'https://cr.yp.to/mac/poly1305-20050329.pdf',
          djbCode: 'https://cr.yp.to/mac.html',
          libsodium: 'https://github.com/jedisct1/libsodium/tree/master/src/libsodium/crypto_onetimeauth_poly1305'
        }
      },
      
      // === ISO Standards ===
      'camellia': {
        name: 'Camellia',
        standard: 'ISO/IEC 18033-3',
        sources: {
          iso: 'https://www.iso.org/standard/54531.html',
          nttPaper: 'https://info.isl.ntt.co.jp/crypt/camellia/specifications.html',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/camellia/',
          rfc: 'https://tools.ietf.org/rfc/rfc3713.txt'
        }
      },
      'aria': {
        name: 'ARIA',
        standard: 'RFC 5794',
        sources: {
          rfc: 'https://tools.ietf.org/rfc/rfc5794.txt',
          koreanStandard: 'https://seed.kisa.or.kr/kisa/kcmvp/EgovReferenceList.do',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/aria/'
        }
      },
      
      // === Original Author Implementations ===
      'blowfish': {
        name: 'Blowfish',
        standard: 'Schneier 1993',
        sources: {
          originalPaper: 'https://www.schneier.com/academic/archives/1994/09/description_of_a_new.html',
          schneierCode: 'https://www.schneier.com/academic/blowfish/',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/bf/'
        }
      },
      'twofish': {
        name: 'Twofish',
        standard: 'AES Candidate',
        sources: {
          originalSite: 'https://www.schneier.com/academic/twofish/',
          paper: 'https://www.schneier.com/academic/paperfiles/paper-twofish-paper.pdf',
          reference: 'https://www.schneier.com/code/twofish.zip'
        }
      },
      'serpent': {
        name: 'Serpent',
        standard: 'AES Candidate',
        sources: {
          originalSite: 'https://www.cl.cam.ac.uk/~rja14/serpent.html',
          paper: 'https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf',
          reference: 'https://www.cl.cam.ac.uk/~rja14/serpent.tar.gz'
        }
      },
      'rc4': {
        name: 'RC4',
        standard: 'Rivest 1987',
        sources: {
          rfc: 'https://tools.ietf.org/rfc/rfc7465.txt',
          openssl: 'https://github.com/openssl/openssl/blob/master/crypto/rc4/',
          note: 'RFC 7465 prohibits RC4 in TLS - for educational use only'
        }
      },
      
      // === Post-Quantum Cryptography ===
      'dilithium': {
        name: 'CRYSTALS-Dilithium',
        standard: 'NIST PQC Selected',
        sources: {
          nistPqc: 'https://csrc.nist.gov/projects/post-quantum-cryptography/selected-algorithms-2022',
          official: 'https://pq-crystals.org/dilithium/',
          github: 'https://github.com/pq-crystals/dilithium',
          nistSubmission: 'https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions'
        }
      },
      'kyber': {
        name: 'CRYSTALS-Kyber (ML-KEM)',
        standard: 'NIST PQC Selected',
        sources: {
          nistPqc: 'https://csrc.nist.gov/projects/post-quantum-cryptography/selected-algorithms-2022',
          official: 'https://pq-crystals.org/kyber/',
          github: 'https://github.com/pq-crystals/kyber',
          mlkem: 'https://csrc.nist.gov/publications/detail/fips/203/draft'
        }
      },
      'sphincs': {
        name: 'SPHINCS+',
        standard: 'NIST PQC Selected',
        sources: {
          nistPqc: 'https://csrc.nist.gov/projects/post-quantum-cryptography/selected-algorithms-2022',
          official: 'https://sphincs.org/',
          github: 'https://github.com/sphincs/sphincsplus'
        }
      },
      
      // === Modern Algorithms ===
      'blake3': {
        name: 'BLAKE3',
        standard: 'Modern Cryptographic Hash',
        sources: {
          official: 'https://blake3.io/',
          paper: 'https://github.com/BLAKE3-team/BLAKE3-specs/blob/master/blake3.pdf',
          github: 'https://github.com/BLAKE3-team/BLAKE3',
          rust: 'https://github.com/BLAKE3-team/BLAKE3/tree/master/rust'
        }
      },
      'argon2': {
        name: 'Argon2',
        standard: 'Password Hashing Competition Winner',
        sources: {
          rfc: 'https://tools.ietf.org/rfc/rfc9106.txt',
          official: 'https://github.com/P-H-C/phc-winner-argon2',
          paper: 'https://password-hashing.net/argon2-specs.pdf'
        }
      }
    },
    
    // Cryptographic libraries by language
    libraries: {
      javascript: {
        'crypto-js': 'https://github.com/brix/crypto-js',
        'node-forge': 'https://github.com/digitalbazaar/forge',
        'libsodium-wrappers': 'https://github.com/jedisct1/libsodium.js',
        'web-crypto-api': 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API'
      },
      python: {
        'cryptography': 'https://github.com/pyca/cryptography',
        'pycryptodome': 'https://github.com/Legrandin/pycryptodome',
        'hashlib': 'https://docs.python.org/3/library/hashlib.html',
        'secrets': 'https://docs.python.org/3/library/secrets.html'
      },
      cpp: {
        'openssl': 'https://github.com/openssl/openssl',
        'mbedtls': 'https://github.com/Mbed-TLS/mbedtls',
        'libgcrypt': 'https://github.com/gpg/libgcrypt',
        'cryptopp': 'https://github.com/weidai11/cryptopp',
        'libsodium': 'https://github.com/jedisct1/libsodium'
      },
      java: {
        'jca': 'https://docs.oracle.com/en/java/javase/11/security/java-cryptography-architecture-jca-reference-guide.html',
        'bouncycastle': 'https://github.com/bcgit/bc-java',
        'conscrypt': 'https://github.com/google/conscrypt'
      },
      rust: {
        'rustcrypto': 'https://github.com/RustCrypto',
        'ring': 'https://github.com/briansmith/ring',
        'sodiumoxide': 'https://github.com/sodiumoxide/sodiumoxide'
      },
      csharp: {
        'dotnet-crypto': 'https://docs.microsoft.com/en-us/dotnet/api/system.security.cryptography',
        'bouncycastle-csharp': 'https://github.com/bcgit/bc-csharp'
      }
    },
    
    /**
     * Initialize the reference links system
     */
    init: function() {
      this.createReferenceUI();
      console.log('Reference Links System initialized');
    },
    
    /**
     * Create reference links UI
     */
    createReferenceUI: function() {
      const container = document.getElementById('reference-container') || document.createElement('div');
      container.id = 'reference-container';
      
      container.innerHTML = `
        <div class="reference-links-panel">
          <h3>📚 Reference Implementations & Standards</h3>
          
          <div class="reference-selector">
            <label for="reference-algorithm">Select Algorithm:</label>
            <select id="reference-algorithm" onchange="ReferenceLinks.showAlgorithmReferences(this.value)">
              <option value="">Choose an algorithm...</option>
              ${Object.keys(this.algorithmSources).map(alg => `
                <option value="${alg}">${this.algorithmSources[alg].name}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="reference-content" id="reference-content">
            <div class="reference-intro">
              <p>Select an algorithm above to view authoritative implementation sources, standards documents, and proven library implementations.</p>
              <p><strong>Educational Notice:</strong> Always use established cryptographic libraries for production systems.</p>
            </div>
          </div>
          
          <div class="library-links">
            <h4>🔗 Proven Cryptographic Libraries</h4>
            <div class="library-grid">
              ${Object.entries(this.libraries).map(([lang, libs]) => `
                <div class="library-category">
                  <h5>${this.capitalizeFirst(lang)}</h5>
                  ${Object.entries(libs).map(([name, url]) => `
                    <a href="${url}" target="_blank" rel="noopener" class="library-link">
                      ${name}
                    </a>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <style>
        .reference-links-panel {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 20px 0;
          color: white;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        .reference-selector {
          margin-bottom: 20px;
        }
        
        .reference-selector label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .reference-selector select {
          width: 100%;
          padding: 8px;
          border-radius: 5px;
          border: none;
          font-size: 14px;
        }
        
        .reference-content {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
          backdrop-filter: blur(10px);
        }
        
        .reference-intro {
          text-align: center;
          opacity: 0.9;
        }
        
        .algorithm-references {
          margin-top: 15px;
        }
        
        .algorithm-references h4 {
          margin-bottom: 10px;
          color: #FFD700;
        }
        
        .source-category {
          margin-bottom: 15px;
        }
        
        .source-category h5 {
          margin-bottom: 8px;
          color: #87CEEB;
        }
        
        .source-links {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .source-link {
          background: rgba(255,255,255,0.2);
          color: white;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 13px;
          border: 1px solid rgba(255,255,255,0.3);
          transition: all 0.2s;
        }
        
        .source-link:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-1px);
        }
        
        .library-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }
        
        .library-category {
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 15px;
        }
        
        .library-category h5 {
          margin-top: 0;
          margin-bottom: 10px;
          color: #FFD700;
          text-align: center;
        }
        
        .library-link {
          display: block;
          color: white;
          text-decoration: none;
          padding: 5px 10px;
          margin: 3px 0;
          border-radius: 3px;
          background: rgba(255,255,255,0.1);
          font-size: 13px;
          transition: background 0.2s;
        }
        
        .library-link:hover {
          background: rgba(255,255,255,0.2);
        }
        
        .standard-badge {
          display: inline-block;
          background: #FF6B6B;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          margin-left: 10px;
        }
        </style>
      `;
      
      // Add to page if not already there
      if (!document.getElementById('reference-container')) {
        const mainContent = document.querySelector('#content') || document.body;
        mainContent.appendChild(container);
      }
    },
    
    /**
     * Show references for a specific algorithm
     */
    showAlgorithmReferences: function(algorithmKey) {
      const contentDiv = document.getElementById('reference-content');
      if (!contentDiv || !this.algorithmSources[algorithmKey]) return;
      
      const algorithm = this.algorithmSources[algorithmKey];
      
      contentDiv.innerHTML = `
        <div class="algorithm-references">
          <h4>${algorithm.name} <span class="standard-badge">${algorithm.standard}</span></h4>
          
          <div class="source-category">
            <h5>📋 Official Standards & Documentation</h5>
            <div class="source-links">
              ${algorithm.sources.official ? `<a href="${algorithm.sources.official}" target="_blank" rel="noopener" class="source-link">Official Standard</a>` : ''}
              ${algorithm.sources.rfc ? `<a href="${algorithm.sources.rfc}" target="_blank" rel="noopener" class="source-link">RFC Document</a>` : ''}
              ${algorithm.sources.nistPqc ? `<a href="${algorithm.sources.nistPqc}" target="_blank" rel="noopener" class="source-link">NIST PQC</a>` : ''}
              ${algorithm.sources.iso ? `<a href="${algorithm.sources.iso}" target="_blank" rel="noopener" class="source-link">ISO Standard</a>` : ''}
            </div>
          </div>
          
          <div class="source-category">
            <h5>👨‍💻 Original Author Implementations</h5>
            <div class="source-links">
              ${algorithm.sources.originalPaper ? `<a href="${algorithm.sources.originalPaper}" target="_blank" rel="noopener" class="source-link">Original Paper</a>` : ''}
              ${algorithm.sources.originalSite ? `<a href="${algorithm.sources.originalSite}" target="_blank" rel="noopener" class="source-link">Author's Site</a>` : ''}
              ${algorithm.sources.djbCode ? `<a href="${algorithm.sources.djbCode}" target="_blank" rel="noopener" class="source-link">DJB Implementation</a>` : ''}
              ${algorithm.sources.schneierCode ? `<a href="${algorithm.sources.schneierCode}" target="_blank" rel="noopener" class="source-link">Schneier Code</a>` : ''}
              ${algorithm.sources.reference ? `<a href="${algorithm.sources.reference}" target="_blank" rel="noopener" class="source-link">Reference Code</a>` : ''}
            </div>
          </div>
          
          <div class="source-category">
            <h5>🏛️ Production Library Implementations</h5>
            <div class="source-links">
              ${algorithm.sources.openssl ? `<a href="${algorithm.sources.openssl}" target="_blank" rel="noopener" class="source-link">OpenSSL</a>` : ''}
              ${algorithm.sources.mbedtls ? `<a href="${algorithm.sources.mbedtls}" target="_blank" rel="noopener" class="source-link">Mbed TLS</a>` : ''}
              ${algorithm.sources.libgcrypt ? `<a href="${algorithm.sources.libgcrypt}" target="_blank" rel="noopener" class="source-link">libgcrypt</a>` : ''}
              ${algorithm.sources.libsodium ? `<a href="${algorithm.sources.libsodium}" target="_blank" rel="noopener" class="source-link">libsodium</a>` : ''}
              ${algorithm.sources.github ? `<a href="${algorithm.sources.github}" target="_blank" rel="noopener" class="source-link">GitHub Official</a>` : ''}
            </div>
          </div>
          
          ${algorithm.sources.note ? `
            <div class="source-category">
              <h5>⚠️ Important Note</h5>
              <p style="background: rgba(255,193,7,0.2); padding: 10px; border-radius: 5px; margin: 10px 0;">
                ${algorithm.sources.note}
              </p>
            </div>
          ` : ''}
        </div>
      `;
    },
    
    /**
     * Get reference links for a specific algorithm
     */
    getAlgorithmReferences: function(algorithmKey) {
      return this.algorithmSources[algorithmKey] || null;
    },
    
    /**
     * Get library recommendations for a language
     */
    getLibrariesForLanguage: function(language) {
      return this.libraries[language] || {};
    },
    
    /**
     * Utility function to capitalize first letter
     */
    capitalizeFirst: function(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
  };
  
  // Export to global scope
  global.ReferenceLinks = ReferenceLinks;
  
  // Auto-initialize when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        ReferenceLinks.init();
      });
    } else {
      ReferenceLinks.init();
    }
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReferenceLinks;
  }
  
})(typeof global !== 'undefined' ? global : window);