/* The built-in songs with their procedurally generated note patterns, plus the
   per-song musical data the background scheduler plays. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});

  /* ── Musical scales (frequencies in Hz) ── */
  NS.songs.NOTE_FREQS = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25
  };

  /* Per-song musical data: root scale notes and bass pattern */
  NS.songs.SONG_SCALES = [
    /* Cosmic Flow   */ { notes: ['C4','E4','G4','C5'],         bass: ['C4','G4'], wave: 'sine' },
    /* Neon Pulse    */ { notes: ['D4','F4','A4','D5'],         bass: ['D4','A4'], wave: 'triangle' },
    /* Cyber Drift   */ { notes: ['E4','G4','B4','E5'],         bass: ['E4','B4'], wave: 'square' },
    /* Star Circuit  */ { notes: ['C4','D4','E4','G4','A4'],    bass: ['C4','E4'], wave: 'triangle' },
    /* Midnight Blaze*/ { notes: ['D4','F4','G4','A4','C5'],    bass: ['D4','G4'], wave: 'sawtooth' },
    /* Thunder Rush  */ { notes: ['E4','G4','A4','B4','D5'],    bass: ['E4','A4'], wave: 'square' }
  ];

  NS.songs.SONGS = [
    {
      name: 'Cosmic Flow',
      bpm: 80,
      difficulty: 1,
      melody: [0,-1,-1,-1, 1,-1,-1,-1, 2,-1,-1,-1, 3,-1,-1,-1, 0,-1,1,-1, -1,-1,2,-1, 3,-1,-1,-1, 0,-1,-1,-1, 1,-1,2,-1, -1,-1,3,-1, 0,-1,-1,-1, 1,-1,-1,-1, 2,-1,3,-1, -1,-1,0,-1, 1,-1,-1,-1, 2,-1,-1,-1]
    },
    {
      name: 'Neon Pulse',
      bpm: 90,
      difficulty: 1,
      melody: [0,-1,1,-1, 2,-1,3,-1, 0,-1,2,-1, 1,-1,3,-1, 0,-1,1,-1, 3,-1,2,-1, 0,-1,-1,-1, 1,-1,3,-1, 2,-1,0,-1, 3,-1,1,-1, 0,-1,2,-1, 1,-1,-1,-1, 3,-1,0,-1, 2,-1,1,-1, 0,-1,3,-1, 2,-1,-1,-1]
    },
    {
      name: 'Cyber Drift',
      bpm: 100,
      difficulty: 2,
      melody: [0,-1,2,-1, 1,-1,3,-1, 2,0,-1,1, 3,-1,2,-1, 0,2,1,-1, 3,1,-1,0, 2,-1,3,1, 0,-1,2,-1, 1,3,-1,0, 2,-1,1,3, 0,-1,2,-1, 1,3,0,-1, 2,-1,3,1, 0,2,-1,1, 3,-1,0,-1, 1,2,3,-1]
    },
    {
      name: 'Star Circuit',
      bpm: 110,
      difficulty: 2,
      melody: [0,1,-1,-1, 2,-1,3,-1, 0,-1,1,-1, 3,2,-1,0, 1,-1,2,3, -1,0,1,-1, 2,3,-1,1, 0,-1,2,-1, 3,1,0,-1, 2,-1,1,3, 0,2,-1,1, 3,-1,0,2, 1,3,-1,0, 2,0,1,-1, 3,-1,2,1, 0,1,2,-1]
    },
    {
      name: 'Midnight Blaze',
      bpm: 120,
      difficulty: 3,
      melody: [0,1,-1,3, 2,-1,1,0, 3,2,1,-1, 0,-1,2,3, 1,0,3,-1, 2,1,0,3, -1,3,2,1, 0,1,-1,2, 3,0,2,1, 1,3,-1,0, 2,1,3,-1, 0,2,1,3, 3,-1,0,2, 1,3,2,0, 0,1,3,2, 2,0,1,-1]
    },
    {
      name: 'Thunder Rush',
      bpm: 130,
      difficulty: 3,
      melody: [0,1,2,-1, 3,2,1,0, 0,-1,2,3, 1,0,3,2, 0,2,1,3, 3,1,0,2, 2,3,0,1, 1,0,2,3, 0,3,1,2, 2,1,3,0, 0,2,3,1, 1,0,2,3, 3,1,0,2, 2,3,1,0, 0,1,2,3, 3,2,1,0]
    }
  ];
})();
