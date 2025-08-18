#!/usr/bin/env node
/*
 * Algorithm Metadata System
 * Comprehensive classification and information system for all 162+ cipher algorithms
 * Supports country flags, categories, security levels, and detailed metadata
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Algorithm Categories with Color Coding
  const Categories = {
    ASYMMETRIC: { 
      name: 'Asymmetric Ciphers', 
      color: '#dc3545', // Red
      icon: '🔐',
      description: 'Public-key cryptography algorithms' 
    },
    SYMMETRIC_BLOCK: { 
      name: 'Symmetric Block Ciphers', 
      color: '#007bff', // Blue
      icon: '🧱',
      description: 'Block-based symmetric encryption' 
    },
    SYMMETRIC_STREAM: { 
      name: 'Symmetric Stream Ciphers', 
      color: '#17a2b8', // Light blue
      icon: '🌊',
      description: 'Stream-based symmetric encryption' 
    },
    HASH: { 
      name: 'Hash Functions', 
      color: '#ffc107', // Yellow
      icon: '#️⃣',
      description: 'Cryptographic hash algorithms' 
    },
    COMPRESSION: { 
      name: 'Compression Algorithms', 
      color: '#28a745', // Green
      icon: '🗜️',
      description: 'Data compression algorithms' 
    },
    ENCODING: { 
      name: 'Encoding Schemes', 
      color: '#6f42c1', // Violet
      icon: '📝',
      description: 'Data encoding and representation' 
    },
    CLASSICAL: { 
      name: 'Classical Ciphers', 
      color: '#fd7e14', // Orange
      icon: '📜',
      description: 'Historical and educational ciphers' 
    },
    MAC: { 
      name: 'Message Authentication', 
      color: '#e83e8c', // Pink
      icon: '✅',
      description: 'Message authentication codes' 
    },
    RANDOM: { 
      name: 'Random Number Generators', 
      color: '#6c757d', // Gray
      icon: '🎲',
      description: 'Pseudo-random number generators' 
    },
    EXPERIMENTAL: { 
      name: 'Experimental/Research', 
      color: '#20c997', // Teal
      icon: '🧪',
      description: 'Research and experimental algorithms' 
    }
  };

  // Security Status Classifications
  const SecurityStatus = {
    SECURE: { name: 'Secure', color: '#28a745', icon: '🛡️' },
    DEPRECATED: { name: 'Deprecated', color: '#ffc107', icon: '⚠️' },
    BROKEN: { name: 'Broken', color: '#dc3545', icon: '❌' },
    OBSOLETE: { name: 'Obsolete', color: '#6c757d', icon: '📰' },
    EXPERIMENTAL: { name: 'Experimental', color: '#17a2b8', icon: '🧪' },
    EDUCATIONAL: { name: 'Educational Only', color: '#fd7e14', icon: '🎓' }
  };

  // Country Flags (Unicode emoji flags)
  const Countries = {
    US: { flag: '🇺🇸', name: 'United States' },
    RU: { flag: '🇷🇺', name: 'Russia' },
    CN: { flag: '🇨🇳', name: 'China' },
    UA: { flag: '🇺🇦', name: 'Ukraine' },
    DE: { flag: '🇩🇪', name: 'Germany' },
    GB: { flag: '🇬🇧', name: 'United Kingdom' },
    FR: { flag: '🇫🇷', name: 'France' },
    JP: { flag: '🇯🇵', name: 'Japan' },
    KR: { flag: '🇰🇷', name: 'South Korea' },
    IL: { flag: '🇮🇱', name: 'Israel' },
    BE: { flag: '🇧🇪', name: 'Belgium' },
    CA: { flag: '🇨🇦', name: 'Canada' },
    AU: { flag: '🇦🇺', name: 'Australia' },
    IT: { flag: '🇮🇹', name: 'Italy' },
    NL: { flag: '🇳🇱', name: 'Netherlands' },
    CH: { flag: '🇨🇭', name: 'Switzerland' },
    SE: { flag: '🇸🇪', name: 'Sweden' },
    NO: { flag: '🇳🇴', name: 'Norway' },
    IN: { flag: '🇮🇳', name: 'India' },
    BR: { flag: '🇧🇷', name: 'Brazil' },
    INTL: { flag: '🌐', name: 'International' },
    ANCIENT: { flag: '🏛️', name: 'Ancient' },
    UNKNOWN: { flag: '❓', name: 'Unknown' }
  };

  // Complexity Levels
  const ComplexityLevels = {
    BEGINNER: { name: 'Beginner', color: '#28a745', level: 1 },
    INTERMEDIATE: { name: 'Intermediate', color: '#ffc107', level: 2 },
    ADVANCED: { name: 'Advanced', color: '#fd7e14', level: 3 },
    EXPERT: { name: 'Expert', color: '#dc3545', level: 4 },
    RESEARCH: { name: 'Research', color: '#6f42c1', level: 5 }
  };

  // Comprehensive Algorithm Database
  const AlgorithmDatabase = {
    // Classical Ciphers
    'Caesar': {
      category: Categories.CLASSICAL,
      country: Countries.ANCIENT,
      security: SecurityStatus.OBSOLETE,
      complexity: ComplexityLevels.BEGINNER,
      year: -50,
      inventor: 'Julius Caesar',
      keySize: 0,
      blockSize: 1,
      description: 'Classical substitution cipher with fixed shift of 3 positions'
    },
    'Atbash': {
      category: Categories.CLASSICAL,
      country: Countries.ANCIENT,
      security: SecurityStatus.OBSOLETE,
      complexity: ComplexityLevels.BEGINNER,
      year: -600,
      inventor: 'Ancient Hebrew',
      keySize: 0,
      blockSize: 1,
      description: 'Ancient Hebrew alphabet reversal cipher'
    },
    'ROT13': {
      category: Categories.CLASSICAL,
      country: Countries.US,
      security: SecurityStatus.OBSOLETE,
      complexity: ComplexityLevels.BEGINNER,
      year: 1980,
      inventor: 'Unix Community',
      keySize: 0,
      blockSize: 1,
      description: 'Simple letter substitution with 13-position rotation'
    },
    'Vigenere': {
      category: Categories.CLASSICAL,
      country: Countries.FR,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1553,
      inventor: 'Blaise de Vigenère',
      keySize: 0,
      blockSize: 1,
      description: 'Polyalphabetic substitution cipher using repeating keyword'
    },
    'Playfair': {
      category: Categories.CLASSICAL,
      country: Countries.GB,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1854,
      inventor: 'Charles Wheatstone & Lord Playfair',
      keySize: 25,
      blockSize: 2,
      description: 'Digraph substitution cipher using 5x5 letter square'
    },
    'Hill': {
      category: Categories.CLASSICAL,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1929,
      inventor: 'Lester S. Hill',
      keySize: 0,
      blockSize: 0,
      description: 'Matrix-based polygraphic substitution cipher'
    },
    'Affine': {
      category: Categories.CLASSICAL,
      country: Countries.INTL,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1900,
      inventor: 'Mathematical Community',
      keySize: 2,
      blockSize: 1,
      description: 'Mathematical substitution using linear function'
    },
    'Foursquare': {
      category: Categories.CLASSICAL,
      country: Countries.FR,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1902,
      inventor: 'Félix Delastelle',
      keySize: 50,
      blockSize: 2,
      description: 'Digraph cipher using four 5x5 squares'
    },

    // Stream Ciphers
    'Salsa20': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2005,
      inventor: 'Daniel J. Bernstein',
      keySize: 32,
      blockSize: 64,
      description: 'ARX-based stream cipher, eSTREAM portfolio finalist'
    },
    'ChaCha20': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2008,
      inventor: 'Daniel J. Bernstein',
      keySize: 32,
      blockSize: 64,
      description: 'Modified Salsa20, used in TLS and other protocols'
    },
    'RC4': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1987,
      inventor: 'Ron Rivest',
      keySize: 32,
      blockSize: 1,
      description: 'Variable-key-size stream cipher, formerly used in TLS/WEP'
    },
    'A5/1': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.DE,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1987,
      inventor: 'ETSI',
      keySize: 8,
      blockSize: 1,
      description: 'GSM encryption algorithm using LFSRs'
    },
    'A5/2': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.DE,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1989,
      inventor: 'ETSI',
      keySize: 8,
      blockSize: 1,
      description: 'Deliberately weakened GSM algorithm for export'
    },
    'E0': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.SE,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1998,
      inventor: 'Bluetooth SIG',
      keySize: 16,
      blockSize: 1,
      description: 'Bluetooth encryption algorithm using LFSRs'
    },
    'Trivium': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2005,
      inventor: 'Christophe De Cannière & Bart Preneel',
      keySize: 10,
      blockSize: 1,
      description: 'Hardware-oriented stream cipher, eSTREAM portfolio'
    },
    'Grain': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.SE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2004,
      inventor: 'Martin Hell, Thomas Johansson, Willi Meier',
      keySize: 10,
      blockSize: 1,
      description: 'Hardware-efficient stream cipher family'
    },
    'Mickey': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.FR,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2005,
      inventor: 'Steve Babbage & Matthew Dodd',
      keySize: 10,
      blockSize: 1,
      description: 'Mutual Irregular Clocking KEYstream generator'
    },
    'Rabbit': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.DK,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2003,
      inventor: 'Martin Boesgaard et al.',
      keySize: 16,
      blockSize: 16,
      description: 'High-speed stream cipher designed for software'
    },
    'HC-128': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.CN,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2004,
      inventor: 'Hongjun Wu',
      keySize: 16,
      blockSize: 4,
      description: 'Software-efficient stream cipher, eSTREAM finalist'
    },
    'Sosemanuk': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.FR,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2005,
      inventor: 'Côme Berbain et al.',
      keySize: 32,
      blockSize: 4,
      description: 'Software-oriented stream cipher combining SNOW and Serpent'
    },
    'ISAAC': {
      category: Categories.RANDOM,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1996,
      inventor: 'Robert J. Jenkins Jr.',
      keySize: 32,
      blockSize: 4,
      description: 'Indirection, Shift, Accumulate, Add, and Count PRNG'
    },
    'Spritz': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.US,
      security: SecurityStatus.EXPERIMENTAL,
      complexity: ComplexityLevels.ADVANCED,
      year: 2014,
      inventor: 'Ron Rivest & Jacob Schuldt',
      keySize: 32,
      blockSize: 1,
      description: 'Sponge-like stream cipher, RC4 successor candidate'
    },
    'F-FCSR': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.FR,
      security: SecurityStatus.EXPERIMENTAL,
      complexity: ComplexityLevels.EXPERT,
      year: 2005,
      inventor: 'François Arnault & Thierry P. Berger',
      keySize: 10,
      blockSize: 1,
      description: 'Feedback with Carry Shift Register stream cipher'
    },
    'Achterbahn': {
      category: Categories.SYMMETRIC_STREAM,
      country: Categories.DE,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 2005,
      inventor: 'Berndt M. Gammel et al.',
      keySize: 10,
      blockSize: 1,
      description: 'Nonlinear filter generator, eSTREAM candidate'
    },
    'Crypto1': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.NL,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1999,
      inventor: 'NXP Semiconductors',
      keySize: 6,
      blockSize: 1,
      description: 'MIFARE Classic RFID encryption, completely broken'
    },

    // Block Ciphers
    'AES': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2001,
      inventor: 'Joan Daemen & Vincent Rijmen',
      keySize: 32,
      blockSize: 16,
      description: 'Advanced Encryption Standard, current US federal standard'
    },
    'DES': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1977,
      inventor: 'IBM & NSA',
      keySize: 8,
      blockSize: 8,
      description: 'Data Encryption Standard, broken by brute force'
    },
    '3DES': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.ADVANCED,
      year: 1998,
      inventor: 'Walter Tuchman',
      keySize: 24,
      blockSize: 8,
      description: 'Triple DES, deprecated due to small block size'
    },
    'Blowfish': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.ADVANCED,
      year: 1993,
      inventor: 'Bruce Schneier',
      keySize: 56,
      blockSize: 8,
      description: 'Fast cipher with variable key length, small block size'
    },
    'Twofish': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 1998,
      inventor: 'Bruce Schneier et al.',
      keySize: 32,
      blockSize: 16,
      description: 'AES finalist with key-dependent S-boxes'
    },
    'Serpent': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.GB,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 1998,
      inventor: 'Ross Anderson, Eli Biham, Lars Knudsen',
      keySize: 32,
      blockSize: 16,
      description: 'AES finalist emphasizing security over speed'
    },
    'MARS': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 1998,
      inventor: 'IBM',
      keySize: 32,
      blockSize: 16,
      description: 'AES finalist with mixed design approach'
    },
    'RC6': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1998,
      inventor: 'Ron Rivest et al.',
      keySize: 32,
      blockSize: 16,
      description: 'AES finalist based on RC5 with quadratic operations'
    },
    'TEA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.GB,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1994,
      inventor: 'David Wheeler & Roger Needham',
      keySize: 16,
      blockSize: 8,
      description: 'Tiny Encryption Algorithm, simple but flawed'
    },
    'XTEA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.GB,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1997,
      inventor: 'David Wheeler & Roger Needham',
      keySize: 16,
      blockSize: 8,
      description: 'Extended TEA, fixes TEA weaknesses but small block'
    },
    'XXTEA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.GB,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1998,
      inventor: 'David Wheeler & Roger Needham',
      keySize: 16,
      blockSize: 0,
      description: 'Corrected Block TEA, variable block size'
    },
    'IDEA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.CH,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1991,
      inventor: 'Xuejia Lai & James Massey',
      keySize: 16,
      blockSize: 8,
      description: 'International Data Encryption Algorithm, PGP legacy'
    },
    'RC2': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1987,
      inventor: 'Ron Rivest',
      keySize: 16,
      blockSize: 8,
      description: 'Variable key-size cipher, broken by related-key attacks'
    },
    'RC5': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.ADVANCED,
      year: 1994,
      inventor: 'Ron Rivest',
      keySize: 32,
      blockSize: 8,
      description: 'Parameterized cipher with data-dependent rotations'
    },
    'CAST-128': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.CA,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1996,
      inventor: 'Carlisle Adams & Stafford Tavares',
      keySize: 16,
      blockSize: 8,
      description: 'RFC 2144 standard, used in PGP'
    },
    'CAST-256': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.CA,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1998,
      inventor: 'Carlisle Adams & Stafford Tavares',
      keySize: 32,
      blockSize: 16,
      description: 'AES candidate, extended CAST-128'
    },
    'Skipjack': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1993,
      inventor: 'NSA',
      keySize: 10,
      blockSize: 8,
      description: 'NSA Clipper chip algorithm, declassified and broken'
    },
    'Anubis': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2000,
      inventor: 'Paulo Barreto & Vincent Rijmen',
      keySize: 40,
      blockSize: 16,
      description: 'NESSIE submission with variable key/block sizes'
    },
    'Khazad': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2000,
      inventor: 'Paulo Barreto & Vincent Rijmen',
      keySize: 16,
      blockSize: 8,
      description: 'NESSIE submission, compact design'
    },
    'NOEKEON': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2000,
      inventor: 'Joan Daemen et al.',
      keySize: 16,
      blockSize: 16,
      description: 'Simple design with good security properties'
    },
    'Square': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1997,
      inventor: 'Joan Daemen & Vincent Rijmen',
      keySize: 16,
      blockSize: 16,
      description: 'Predecessor to Rijndael/AES'
    },
    'Camellia': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.JP,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2000,
      inventor: 'NTT & Mitsubishi',
      keySize: 32,
      blockSize: 16,
      description: 'ISO/IEC 18033-3 standard, similar security to AES'
    },
    'CLEFIA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.JP,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2007,
      inventor: 'Sony Corporation',
      keySize: 32,
      blockSize: 16,
      description: 'Generalized Feistel structure for lightweight apps'
    },
    'MISTY1': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.JP,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1996,
      inventor: 'Mitsuru Matsui',
      keySize: 16,
      blockSize: 8,
      description: 'Provable security against differential/linear attacks'
    },
    'FEAL': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.JP,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1987,
      inventor: 'Akihiro Shimizu & Shoji Miyaguchi',
      keySize: 8,
      blockSize: 8,
      description: 'Fast Data Encipherment Algorithm, broken by DC/LC'
    },
    'GOST 28147-89': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.RU,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.ADVANCED,
      year: 1989,
      inventor: 'Soviet Union',
      keySize: 32,
      blockSize: 8,
      description: 'Russian federal standard, weak S-boxes'
    },
    'Kuznyechik': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.RU,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2015,
      inventor: 'Russian Federation',
      keySize: 32,
      blockSize: 16,
      description: 'GOST R 34.12-2015, modern Russian standard'
    },
    'SM4': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.CN,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2006,
      inventor: 'Chinese Government',
      keySize: 16,
      blockSize: 16,
      description: 'Chinese national standard, similar to AES'
    },
    'ARIA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.KR,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2003,
      inventor: 'Korean Agency for Technology and Standards',
      keySize: 32,
      blockSize: 16,
      description: 'Korean national standard'
    },
    'SEED': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.KR,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1998,
      inventor: 'Korea Internet & Security Agency',
      keySize: 16,
      blockSize: 16,
      description: 'Korean national standard, RFC 4269'
    },
    'LEA': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.KR,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2013,
      inventor: 'Electronics and Telecommunications Research Institute',
      keySize: 32,
      blockSize: 16,
      description: 'Lightweight block cipher for software'
    },
    'CHAM': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.KR,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2017,
      inventor: 'Electronics and Telecommunications Research Institute',
      keySize: 16,
      blockSize: 8,
      description: 'Ultra-lightweight block cipher'
    },
    'PRESENT': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.DE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2007,
      inventor: 'Andrey Bogdanov et al.',
      keySize: 16,
      blockSize: 8,
      description: 'Ultra-lightweight cipher for RFID/IoT'
    },
    'SIMON': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2013,
      inventor: 'NSA',
      keySize: 32,
      blockSize: 16,
      description: 'Lightweight cipher family optimized for hardware'
    },
    'SPECK': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2013,
      inventor: 'NSA',
      keySize: 32,
      blockSize: 16,
      description: 'Lightweight cipher family optimized for software'
    },
    'Threefish': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.EXPERT,
      year: 2008,
      inventor: 'Bruce Schneier et al.',
      keySize: 64,
      blockSize: 64,
      description: 'Tweakable cipher used in Skein hash function'
    },
    'Safer': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.CH,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1993,
      inventor: 'James Massey',
      keySize: 16,
      blockSize: 8,
      description: 'Secure And Fast Encryption Routine'
    },
    'LOKI97': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.AU,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1997,
      inventor: 'Lawrie Brown et al.',
      keySize: 32,
      blockSize: 16,
      description: 'AES candidate from Australia'
    },
    'Magenta': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.DE,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.ADVANCED,
      year: 1998,
      inventor: 'Deutsche Telekom',
      keySize: 16,
      blockSize: 16,
      description: 'AES candidate, broken during competition'
    },
    'DEAL': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1998,
      inventor: 'Lars Knudsen & Richard Outerbridge',
      keySize: 24,
      blockSize: 16,
      description: 'Data Encryption Algorithm with Larger blocks'
    },
    'HPC': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.IL,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1998,
      inventor: 'Eli Biham',
      keySize: 16,
      blockSize: 8,
      description: 'Hasty Pudding Cipher, AES candidate'
    },
    'Lucifer': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.US,
      security: SecurityStatus.OBSOLETE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1971,
      inventor: 'Horst Feistel (IBM)',
      keySize: 16,
      blockSize: 16,
      description: 'DES predecessor, larger block/key sizes'
    },
    '3-Way': {
      category: Categories.SYMMETRIC_BLOCK,
      country: Countries.BE,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1994,
      inventor: 'Joan Daemen',
      keySize: 12,
      blockSize: 12,
      description: 'Symmetric design allowing encryption=decryption'
    },
    'MUGI': {
      category: Categories.SYMMETRIC_STREAM,
      country: Countries.JP,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2002,
      inventor: 'Hitachi',
      keySize: 16,
      blockSize: 1,
      description: '64-bit stream cipher designed for software efficiency'
    },

    // Hash Functions
    'MD2': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1989,
      inventor: 'Ron Rivest',
      keySize: 0,
      blockSize: 16,
      description: '128-bit hash, broken by collision attacks'
    },
    'MD4': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1990,
      inventor: 'Ron Rivest',
      keySize: 0,
      blockSize: 64,
      description: '128-bit hash, severely broken'
    },
    'MD5': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.BROKEN,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1991,
      inventor: 'Ron Rivest',
      keySize: 0,
      blockSize: 64,
      description: '128-bit hash, collision attacks found'
    },
    'SHA1': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.DEPRECATED,
      complexity: ComplexityLevels.ADVANCED,
      year: 1995,
      inventor: 'NSA',
      keySize: 0,
      blockSize: 64,
      description: '160-bit hash, deprecated due to collision attacks'
    },
    'SHA224': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2001,
      inventor: 'NSA',
      keySize: 0,
      blockSize: 64,
      description: '224-bit hash, truncated SHA-256'
    },
    'SHA256': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2001,
      inventor: 'NSA',
      keySize: 0,
      blockSize: 64,
      description: '256-bit hash, current standard for many applications'
    },
    'SHA384': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2001,
      inventor: 'NSA',
      keySize: 0,
      blockSize: 128,
      description: '384-bit hash, truncated SHA-512'
    },
    'SHA512': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2001,
      inventor: 'NSA',
      keySize: 0,
      blockSize: 128,
      description: '512-bit hash for high-security applications'
    },
    'RIPEMD160': {
      category: Categories.HASH,
      country: Countries.BE,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1996,
      inventor: 'Hans Dobbertin et al.',
      keySize: 0,
      blockSize: 64,
      description: '160-bit hash, European alternative to SHA-1'
    },
    'Adler32': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1995,
      inventor: 'Mark Adler',
      keySize: 0,
      blockSize: 1,
      description: 'Fast checksum algorithm, not cryptographically secure'
    },
    'CRC32': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1961,
      inventor: 'W. Wesley Peterson',
      keySize: 0,
      blockSize: 1,
      description: 'Cyclic redundancy check, error detection only'
    },
    'FNV': {
      category: Categories.HASH,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1991,
      inventor: 'Glenn Fowler, Landon Curt Noll, Phong Vo',
      keySize: 0,
      blockSize: 1,
      description: 'Fowler-Noll-Vo hash, non-cryptographic'
    },

    // MAC/Authentication
    'HMAC': {
      category: Categories.MAC,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 1996,
      inventor: 'Mihir Bellare, Ran Canetti, Hugo Krawczyk',
      keySize: 32,
      blockSize: 0,
      description: 'Hash-based Message Authentication Code'
    },
    'Poly1305': {
      category: Categories.MAC,
      country: Countries.US,
      security: SecurityStatus.SECURE,
      complexity: ComplexityLevels.ADVANCED,
      year: 2005,
      inventor: 'Daniel J. Bernstein',
      keySize: 32,
      blockSize: 16,
      description: 'One-time authenticator, used with ChaCha20'
    },

    // Encoding Schemes
    'BASE64': {
      category: Categories.ENCODING,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1987,
      inventor: 'IETF',
      keySize: 0,
      blockSize: 3,
      description: 'Binary-to-text encoding using 64 printable characters'
    },
    'BASE32': {
      category: Categories.ENCODING,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 2006,
      inventor: 'IETF',
      keySize: 0,
      blockSize: 5,
      description: 'Binary-to-text encoding using 32 characters'
    },
    'BASE16': {
      category: Categories.ENCODING,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1969,
      inventor: 'IBM',
      keySize: 0,
      blockSize: 1,
      description: 'Hexadecimal encoding of binary data'
    },
    'BubbleBabble': {
      category: Categories.ENCODING,
      country: Countries.FI,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2001,
      inventor: 'Antti Huima',
      keySize: 0,
      blockSize: 5,
      description: 'Human-readable binary data representation'
    },
    'Koremutake': {
      category: Categories.ENCODING,
      country: Countries.GB,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 2007,
      inventor: 'Shoichiro Murata',
      keySize: 0,
      blockSize: 0,
      description: 'Phonetic encoding of binary data'
    },

    // Compression Algorithms
    'RLE': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1967,
      inventor: 'Various',
      keySize: 0,
      blockSize: 1,
      description: 'Run-Length Encoding for simple compression'
    },
    'Huffman': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1952,
      inventor: 'David A. Huffman',
      keySize: 0,
      blockSize: 0,
      description: 'Variable-length prefix coding for compression'
    },
    'LZ77': {
      category: Categories.COMPRESSION,
      country: Countries.IL,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1977,
      inventor: 'Abraham Lempel & Jacob Ziv',
      keySize: 0,
      blockSize: 0,
      description: 'Dictionary-based compression algorithm'
    },
    'LZ78': {
      category: Categories.COMPRESSION,
      country: Countries.IL,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1978,
      inventor: 'Abraham Lempel & Jacob Ziv',
      keySize: 0,
      blockSize: 0,
      description: 'Improved dictionary-based compression'
    },
    'LZW': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1984,
      inventor: 'Terry Welch',
      keySize: 0,
      blockSize: 0,
      description: 'Lempel-Ziv-Welch compression algorithm'
    },
    'BPE': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1994,
      inventor: 'Philip Gage',
      keySize: 0,
      blockSize: 0,
      description: 'Byte Pair Encoding for text compression'
    },
    'Shannon-Fano': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1948,
      inventor: 'Claude Shannon & Robert Fano',
      keySize: 0,
      blockSize: 0,
      description: 'Prefix coding compression method'
    },
    'Elias-Gamma': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.ADVANCED,
      year: 1975,
      inventor: 'Peter Elias',
      keySize: 0,
      blockSize: 0,
      description: 'Universal code for positive integers'
    },
    'Elias-Delta': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.ADVANCED,
      year: 1975,
      inventor: 'Peter Elias',
      keySize: 0,
      blockSize: 0,
      description: 'More efficient universal code for larger integers'
    },
    'Fibonacci': {
      category: Categories.COMPRESSION,
      country: Countries.INTL,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.INTERMEDIATE,
      year: 1972,
      inventor: 'Various',
      keySize: 0,
      blockSize: 0,
      description: 'Fibonacci-based integer encoding'
    },
    'Unary': {
      category: Categories.COMPRESSION,
      country: Countries.INTL,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1950,
      inventor: 'Various',
      keySize: 0,
      blockSize: 0,
      description: 'Simple unary numeral system encoding'
    },
    'Delta': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.BEGINNER,
      year: 1952,
      inventor: 'Various',
      keySize: 0,
      blockSize: 0,
      description: 'Delta encoding for correlated data'
    },
    'DEFLATE': {
      category: Categories.COMPRESSION,
      country: Countries.US,
      security: SecurityStatus.EDUCATIONAL,
      complexity: ComplexityLevels.ADVANCED,
      year: 1993,
      inventor: 'Phil Katz',
      keySize: 0,
      blockSize: 0,
      description: 'LZ77 + Huffman compression (ZIP/gzip/PNG)'
    }
  };

  // Algorithm metadata class
  class AlgorithmMetadata {
    constructor() {
      this.database = AlgorithmDatabase;
      this.categories = Categories;
      this.countries = Countries;
      this.securityStatus = SecurityStatus;
      this.complexityLevels = ComplexityLevels;
    }

    // Get metadata for specific algorithm
    getMetadata(algorithmName) {
      const normalizedName = this.normalizeAlgorithmName(algorithmName);
      return this.database[normalizedName] || this.createDefaultMetadata(algorithmName);
    }

    // Normalize algorithm names for lookup
    normalizeAlgorithmName(name) {
      // Handle common naming variations
      const nameMap = {
        'Rijndael': 'AES',
        'AES-128': 'AES',
        'AES-192': 'AES',
        'AES-256': 'AES',
        'SHA-1': 'SHA1',
        'SHA-224': 'SHA224',
        'SHA-256': 'SHA256',
        'SHA-384': 'SHA384',
        'SHA-512': 'SHA512',
        'RIPEMD-160': 'RIPEMD160',
        'Triple-DES': '3DES',
        'TripleDES': '3DES',
        'DES-X': 'DES-X',
        'GOST': 'GOST 28147-89',
        'GOST-Kuznyechik': 'Kuznyechik',
        'ChaCha': 'ChaCha20',
        'Salsa': 'Salsa20',
        'Base64': 'BASE64',
        'Base32': 'BASE32',
        'Base16': 'BASE16',
        'ROT-13': 'ROT13'
      };
      
      return nameMap[name] || name;
    }

    // Create default metadata for unknown algorithms
    createDefaultMetadata(algorithmName) {
      return {
        category: Categories.EXPERIMENTAL,
        country: Countries.UNKNOWN,
        security: SecurityStatus.EXPERIMENTAL,
        complexity: ComplexityLevels.INTERMEDIATE,
        year: 2025,
        inventor: 'Unknown',
        keySize: 0,
        blockSize: 0,
        description: `${algorithmName} - No detailed metadata available`
      };
    }

    // Get all algorithms by category
    getAlgorithmsByCategory(category) {
      return Object.entries(this.database)
        .filter(([name, data]) => data.category === category)
        .map(([name, data]) => ({ name, ...data }));
    }

    // Get all algorithms by country
    getAlgorithmsByCountry(countryCode) {
      const country = this.countries[countryCode];
      if (!country) return [];
      
      return Object.entries(this.database)
        .filter(([name, data]) => data.country === country)
        .map(([name, data]) => ({ name, ...data }));
    }

    // Get security status statistics
    getSecurityStatistics() {
      const stats = {};
      Object.values(this.securityStatus).forEach(status => {
        stats[status.name] = 0;
      });
      
      Object.values(this.database).forEach(alg => {
        stats[alg.security.name]++;
      });
      
      return stats;
    }

    // Get category statistics
    getCategoryStatistics() {
      const stats = {};
      Object.values(this.categories).forEach(category => {
        stats[category.name] = 0;
      });
      
      Object.values(this.database).forEach(alg => {
        stats[alg.category.name]++;
      });
      
      return stats;
    }

    // Search algorithms by text
    searchAlgorithms(query) {
      const searchTerm = query.toLowerCase();
      return Object.entries(this.database)
        .filter(([name, data]) => 
          name.toLowerCase().includes(searchTerm) ||
          data.description.toLowerCase().includes(searchTerm) ||
          data.inventor.toLowerCase().includes(searchTerm) ||
          data.category.name.toLowerCase().includes(searchTerm)
        )
        .map(([name, data]) => ({ name, ...data }));
    }

    // Get trending/featured algorithms
    getFeaturedAlgorithms() {
      const featured = [
        'AES', 'ChaCha20', 'SHA256', 'HMAC', 'Poly1305',
        'Salsa20', 'Twofish', 'Serpent', 'BLAKE2b', 'Ed25519'
      ];
      
      return featured.map(name => ({
        name,
        ...this.getMetadata(name)
      })).filter(alg => alg.category); // Only return algorithms we have in database
    }
  }

  // Export to global scope
  global.AlgorithmMetadata = new AlgorithmMetadata();
  global.Categories = Categories;
  global.Countries = Countries;
  global.SecurityStatus = SecurityStatus;
  global.ComplexityLevels = ComplexityLevels;

  // Node.js module export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AlgorithmMetadata: AlgorithmMetadata,
      Categories,
      Countries,
      SecurityStatus,
      ComplexityLevels
    };
  }

})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);