/* The procedural audio engine: the lazily created Web Audio graph, one-shot tones
   for hit and miss judgements, and the background music scheduler that plays the
   selected song's scale over a bass, hi-hat and kick pattern. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const { SONGS, SONG_SCALES, NOTE_FREQS } = NS.songs;

  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let bgSchedulerId = null;

  function ensureAudioCtx() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = SZ.GameAudio.muted ? 0 : 0.5;
    masterGain.connect(audioCtx.destination);

    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.25;
    musicGain.connect(masterGain);

    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);
  }

  function resumeAudioCtx() {
    if (audioCtx && audioCtx.state === 'suspended')
      audioCtx.resume();
  }

  /* ── Short one-shot oscillator helper ── */
  function playTone(freq, duration, waveform, dest, volume) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = waveform || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(dest || sfxGain);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  }

  /* ── Hit sounds — pitched differently by judgment ── */
  function playHitSound(rank) {
    if (!audioCtx) return;
    if (rank === 'PERFECT')
      playTone(880, 0.12, 'sine', sfxGain, 0.2);
    else if (rank === 'GREAT')
      playTone(660, 0.12, 'sine', sfxGain, 0.18);
    else
      playTone(523.25, 0.10, 'triangle', sfxGain, 0.15);
  }

  /* ── Miss sound — low buzz ── */
  function playMissSound() {
    if (!audioCtx) return;
    playTone(120, 0.18, 'sawtooth', sfxGain, 0.12);
  }

  /* ── Background music scheduler ── */
  let bgNextBeatTime = 0;
  let bgBeatIndex = 0;

  function startMusic(songIndex) {
    ensureAudioCtx();
    resumeAudioCtx();
    stopMusic();

    const song = SONGS[songIndex];
    const scale = SONG_SCALES[songIndex] || SONG_SCALES[0];
    const beatInterval = 60 / song.bpm;

    bgNextBeatTime = audioCtx.currentTime + 0.1;
    bgBeatIndex = 0;

    function scheduleBeat() {
      const now = audioCtx.currentTime;
      // Schedule beats up to 200ms ahead for smooth playback
      while (bgNextBeatTime < now + 0.2) {
        const noteNames = scale.notes;
        const bassNames = scale.bass;

        // Melody: pick note from scale based on beat index
        const melodyFreq = NOTE_FREQS[noteNames[bgBeatIndex % noteNames.length]];

        // Vary octave every other bar for movement
        const octaveShift = (bgBeatIndex % 16 < 8) ? 1 : 2;
        const finalFreq = melodyFreq * (octaveShift === 2 ? 0.5 : 1);

        // Schedule melody note
        const melOsc = audioCtx.createOscillator();
        const melGain = audioCtx.createGain();
        melOsc.type = scale.wave || 'triangle';
        melOsc.frequency.value = finalFreq;
        const dur = beatInterval * 0.4;
        melGain.gain.setValueAtTime(0.1, bgNextBeatTime);
        melGain.gain.exponentialRampToValueAtTime(0.001, bgNextBeatTime + dur);
        melOsc.connect(melGain);
        melGain.connect(musicGain);
        melOsc.start(bgNextBeatTime);
        melOsc.stop(bgNextBeatTime + dur + 0.01);

        // Bass on every other beat
        if (bgBeatIndex % 2 === 0) {
          const bassFreq = NOTE_FREQS[bassNames[(bgBeatIndex >> 1) % bassNames.length]] * 0.5;
          const bassOsc = audioCtx.createOscillator();
          const bassGain = audioCtx.createGain();
          bassOsc.type = 'sine';
          bassOsc.frequency.value = bassFreq;
          const bassDur = beatInterval * 0.8;
          bassGain.gain.setValueAtTime(0.12, bgNextBeatTime);
          bassGain.gain.exponentialRampToValueAtTime(0.001, bgNextBeatTime + bassDur);
          bassOsc.connect(bassGain);
          bassGain.connect(musicGain);
          bassOsc.start(bgNextBeatTime);
          bassOsc.stop(bgNextBeatTime + bassDur + 0.01);
        }

        // Hi-hat click for rhythm on every beat
        const bufferSize = audioCtx.sampleRate * 0.03;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; ++i)
          data[i] = Math.random() * 2 - 1;
        const noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        const hihatGain = audioCtx.createGain();
        const hihatFilter = audioCtx.createBiquadFilter();
        hihatFilter.type = 'highpass';
        hihatFilter.frequency.value = 8000;
        hihatGain.gain.setValueAtTime(0.04, bgNextBeatTime);
        hihatGain.gain.exponentialRampToValueAtTime(0.001, bgNextBeatTime + 0.04);
        noiseSrc.connect(hihatFilter);
        hihatFilter.connect(hihatGain);
        hihatGain.connect(musicGain);
        noiseSrc.start(bgNextBeatTime);
        noiseSrc.stop(bgNextBeatTime + 0.05);

        // Kick on beats 0, 4, 8, 12 of a 16-beat loop
        if (bgBeatIndex % 4 === 0) {
          const kickOsc = audioCtx.createOscillator();
          const kickGain = audioCtx.createGain();
          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(150, bgNextBeatTime);
          kickOsc.frequency.exponentialRampToValueAtTime(40, bgNextBeatTime + 0.12);
          kickGain.gain.setValueAtTime(0.18, bgNextBeatTime);
          kickGain.gain.exponentialRampToValueAtTime(0.001, bgNextBeatTime + 0.15);
          kickOsc.connect(kickGain);
          kickGain.connect(musicGain);
          kickOsc.start(bgNextBeatTime);
          kickOsc.stop(bgNextBeatTime + 0.2);
        }

        ++bgBeatIndex;
        bgNextBeatTime += beatInterval * 0.5;
      }
    }

    bgSchedulerId = setInterval(scheduleBeat, 80);
    scheduleBeat();
  }

  function stopMusic() {
    if (bgSchedulerId !== null) {
      clearInterval(bgSchedulerId);
      bgSchedulerId = null;
    }
  }

  function pauseMusic() {
    if (audioCtx && audioCtx.state === 'running')
      audioCtx.suspend();
  }

  function resumeMusic() {
    if (audioCtx && audioCtx.state === 'suspended')
      audioCtx.resume();
  }

  /* Keep the master gain in sync with the desktop mute button */
  function wireMuteSync() {
    SZ.GameAudio.onMuteChange((muted) => {
      if (masterGain)
        masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, audioCtx.currentTime, 0.02);
    });
  }

  Object.assign(NS.audio, {
    ensureAudioCtx, resumeAudioCtx, playTone, playHitSound, playMissSound,
    startMusic, stopMusic, pauseMusic, resumeMusic, wireMuteSync
  });
})();
