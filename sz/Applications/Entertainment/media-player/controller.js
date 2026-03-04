;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const SEEK_STEP = 5;
  const VOLUME_STEP = 0.05;
  const VISUALIZER_BARS = 16;
  const STORAGE_KEY = 'sz-media-player-volume';

  // -----------------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------------
  const displayArea = document.getElementById('display-area');
  const placeholderArt = document.getElementById('placeholder-art');
  const canvas = document.getElementById('visualizer');
  const ctx = canvas.getContext('2d');
  const audioEl = document.getElementById('audio-player');
  const videoEl = document.getElementById('video-player');
  const fileInput = document.getElementById('file-input');
  const playlistPanel = document.getElementById('playlist-panel');
  const playlistList = document.getElementById('playlist-list');
  const seekBar = document.getElementById('seek-bar');
  const seekFill = document.getElementById('seek-fill');
  const volumeBar = document.getElementById('volume-bar');
  const volumeFill = document.getElementById('volume-fill');
  const timeCurrentEl = document.getElementById('time-current');
  const timeTotalEl = document.getElementById('time-total');
  const btnPlay = document.getElementById('btn-play');
  const btnStop = document.getElementById('btn-stop');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnMute = document.getElementById('btn-mute');
  const btnAddFiles = document.getElementById('btn-add-files');
  const btnRemoveSelected = document.getElementById('btn-remove-selected');
  const btnClearAll = document.getElementById('btn-clear-all');
  const statusTrack = document.getElementById('status-track');
  const statusState = document.getElementById('status-state');
  const statusInfo = document.getElementById('status-info');
  const menuShuffle = document.getElementById('menu-shuffle');
  const menuRepeat = document.getElementById('menu-repeat');
  const menuPlaylist = document.getElementById('menu-playlist');
  const menuCompact = document.getElementById('menu-compact');

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let playlist = [];
  let currentIndex = -1;
  let selectedIndex = -1;
  let isPlaying = false;
  let isStopped = true;
  let shuffleEnabled = false;
  let repeatMode = 'off'; // 'off' | 'all' | 'one'
  let compactMode = false;
  let volume = 0.8;
  let isMuted = false;
  let volumeBeforeMute = 0.8;
  let activeMediaElement = null; // audioEl or videoEl
  let audioContext = null;
  let analyser = null;
  let sourceNode = null;
  let videoSourceNode = null;
  let animFrameId = null;
  let shuffleOrder = [];
  let isSeeking = false;

  // -----------------------------------------------------------------------
  // Init volume from localStorage
  // -----------------------------------------------------------------------
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (isFinite(parsed) && parsed >= 0 && parsed <= 1)
        volume = parsed;
    }
  } catch (_) { /* localStorage unavailable */ }

  audioEl.volume = volume;
  videoEl.volume = volume;
  updateVolumeUI();

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------
  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0)
      return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function isVideoFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    return ['mp4', 'webm', 'ogv'].includes(ext);
  }

  function isVideoMime(type) {
    return type && type.startsWith('video/');
  }

  function saveVolume() {
    try {
      localStorage.setItem(STORAGE_KEY, String(volume));
    } catch (_) { /* ignore */ }
  }

  // -----------------------------------------------------------------------
  // Menu system
  // -----------------------------------------------------------------------
  new SZ.MenuBar({ onAction: handleAction });

  // -----------------------------------------------------------------------
  // Action handler
  // -----------------------------------------------------------------------
  function handleAction(action) {
    switch (action) {
      case 'open-file':
        fileInput.click();
        break;
      case 'open-url':
        showOpenUrlDialog();
        break;
      case 'exit':
        SZ.Dlls.User32.DestroyWindow();
        break;
      case 'play-pause':
        togglePlayPause();
        break;
      case 'stop':
        stopPlayback();
        break;
      case 'prev':
        playPrevious();
        break;
      case 'next':
        playNext();
        break;
      case 'shuffle':
        shuffleEnabled = !shuffleEnabled;
        menuShuffle.classList.toggle('checked', shuffleEnabled);
        if (shuffleEnabled)
          buildShuffleOrder();
        break;
      case 'repeat':
        cycleRepeatMode();
        break;
      case 'toggle-playlist':
        playlistPanel.classList.toggle('hidden');
        menuPlaylist.classList.toggle('checked');
        break;
      case 'compact-mode':
        compactMode = !compactMode;
        menuCompact.classList.toggle('checked', compactMode);
        displayArea.classList.toggle('compact', compactMode);
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Repeat mode cycling
  // -----------------------------------------------------------------------
  function cycleRepeatMode() {
    if (repeatMode === 'off')
      repeatMode = 'all';
    else if (repeatMode === 'all')
      repeatMode = 'one';
    else
      repeatMode = 'off';

    const labels = { off: 'Repeat: Off', all: 'Repeat: All', one: 'Repeat: One' };
    menuRepeat.textContent = labels[repeatMode];
    menuRepeat.classList.toggle('checked', repeatMode !== 'off');
  }

  // -----------------------------------------------------------------------
  // Shuffle (Fisher-Yates)
  // -----------------------------------------------------------------------
  function buildShuffleOrder() {
    shuffleOrder = [];
    for (let i = 0; i < playlist.length; ++i)
      shuffleOrder.push(i);

    for (let i = shuffleOrder.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffleOrder[i];
      shuffleOrder[i] = shuffleOrder[j];
      shuffleOrder[j] = tmp;
    }
  }

  function getNextIndex() {
    if (playlist.length === 0)
      return -1;

    if (repeatMode === 'one')
      return currentIndex;

    if (shuffleEnabled) {
      if (shuffleOrder.length === 0)
        buildShuffleOrder();
      const pos = shuffleOrder.indexOf(currentIndex);
      const nextPos = pos + 1;
      if (nextPos >= shuffleOrder.length) {
        if (repeatMode === 'all') {
          buildShuffleOrder();
          return shuffleOrder[0];
        }
        return -1;
      }
      return shuffleOrder[nextPos];
    }

    const next = currentIndex + 1;
    if (next >= playlist.length)
      return repeatMode === 'all' ? 0 : -1;
    return next;
  }

  function getPrevIndex() {
    if (playlist.length === 0)
      return -1;

    if (shuffleEnabled) {
      const pos = shuffleOrder.indexOf(currentIndex);
      const prevPos = pos - 1;
      if (prevPos < 0)
        return repeatMode === 'all' ? shuffleOrder[shuffleOrder.length - 1] : -1;
      return shuffleOrder[prevPos];
    }

    const prev = currentIndex - 1;
    if (prev < 0)
      return repeatMode === 'all' ? playlist.length - 1 : -1;
    return prev;
  }

  // -----------------------------------------------------------------------
  // Audio context + analyser (lazy init)
  // -----------------------------------------------------------------------
  function ensureAudioContext() {
    if (audioContext)
      return;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyser.connect(audioContext.destination);
    } catch (_) {
      audioContext = null;
    }
  }

  function connectSource(mediaEl) {
    if (!audioContext || !analyser)
      return;

    if (mediaEl === audioEl) {
      if (!sourceNode) {
        try {
          sourceNode = audioContext.createMediaElementSource(audioEl);
        } catch (_) {
          return;
        }
      }
      sourceNode.connect(analyser);
    } else if (mediaEl === videoEl) {
      if (!videoSourceNode) {
        try {
          videoSourceNode = audioContext.createMediaElementSource(videoEl);
        } catch (_) {
          return;
        }
      }
      videoSourceNode.connect(analyser);
    }
  }

  // -----------------------------------------------------------------------
  // Visualization
  // -----------------------------------------------------------------------
  function resizeCanvas() {
    const rect = displayArea.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
  }

  function drawVisualization() {
    if (!analyser || !isPlaying || activeMediaElement === videoEl) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      return;
    }

    animFrameId = requestAnimationFrame(drawVisualization);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const barCount = Math.min(VISUALIZER_BARS, bufferLength);
    const barWidth = (w / barCount) * 0.7;
    const gap = (w / barCount) * 0.3;

    for (let i = 0; i < barCount; ++i) {
      const value = dataArray[i] / 255;
      const barHeight = value * h * 0.85;
      const x = i * (barWidth + gap) + gap / 2;
      const y = h - barHeight;

      const gradient = ctx.createLinearGradient(0, h, 0, 0);
      gradient.addColorStop(0, '#22c55e');
      gradient.addColorStop(0.5, '#eab308');
      gradient.addColorStop(1, '#ef4444');

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  function startVisualization() {
    if (!analyser || activeMediaElement === videoEl)
      return;

    resizeCanvas();
    if (!animFrameId)
      drawVisualization();
  }

  function stopVisualization() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // -----------------------------------------------------------------------
  // Playback
  // -----------------------------------------------------------------------
  function loadTrack(index) {
    if (index < 0 || index >= playlist.length)
      return;

    stopPlayback();
    currentIndex = index;

    const track = playlist[index];
    const isVideo = track.isVideo;

    if (isVideo) {
      activeMediaElement = videoEl;
      videoEl.src = track.src;
      videoEl.classList.add('active');
      canvas.style.display = 'none';
      placeholderArt.style.display = 'none';
    } else {
      activeMediaElement = audioEl;
      audioEl.src = track.src;
      videoEl.classList.remove('active');
      canvas.style.display = '';
      placeholderArt.style.display = 'none';
    }

    activeMediaElement.volume = isMuted ? 0 : volume;
    updateWindowTitle(track.name);
    updatePlaylistUI();
    updateStatusTrack(track.name);
  }

  function playTrack(index) {
    loadTrack(index);
    if (currentIndex < 0)
      return;

    ensureAudioContext();
    connectSource(activeMediaElement);

    if (audioContext && audioContext.state === 'suspended')
      audioContext.resume();

    activeMediaElement.play().then(() => {
      isPlaying = true;
      isStopped = false;
      updatePlayButton();
      updateStatusState('Playing');
      if (activeMediaElement === audioEl)
        startVisualization();
    }).catch(() => {
      // Autoplay blocked -- wait for user gesture
    });
  }

  function togglePlayPause() {
    if (playlist.length === 0)
      return;

    if (isStopped) {
      const idx = currentIndex >= 0 ? currentIndex : 0;
      playTrack(idx);
      return;
    }

    if (!activeMediaElement)
      return;

    if (isPlaying) {
      activeMediaElement.pause();
      isPlaying = false;
      updatePlayButton();
      updateStatusState('Paused');
      stopVisualization();
    } else {
      ensureAudioContext();
      if (audioContext && audioContext.state === 'suspended')
        audioContext.resume();
      activeMediaElement.play().then(() => {
        isPlaying = true;
        updatePlayButton();
        updateStatusState('Playing');
        if (activeMediaElement === audioEl)
          startVisualization();
      }).catch(() => {});
    }
  }

  function stopPlayback() {
    if (activeMediaElement) {
      activeMediaElement.pause();
      activeMediaElement.currentTime = 0;
    }
    isPlaying = false;
    isStopped = true;
    updatePlayButton();
    updateSeekUI(0, 0);
    updateStatusState('Stopped');
    stopVisualization();
  }

  function playNext() {
    const next = getNextIndex();
    if (next >= 0)
      playTrack(next);
    else
      stopPlayback();
  }

  function playPrevious() {
    if (activeMediaElement && activeMediaElement.currentTime > 3) {
      activeMediaElement.currentTime = 0;
      return;
    }
    const prev = getPrevIndex();
    if (prev >= 0)
      playTrack(prev);
  }

  // -----------------------------------------------------------------------
  // Media element events
  // -----------------------------------------------------------------------
  function setupMediaEvents(el) {
    el.addEventListener('timeupdate', () => {
      if (activeMediaElement !== el || isSeeking)
        return;
      updateSeekUI(el.currentTime, el.duration);
    });

    el.addEventListener('ended', () => {
      if (activeMediaElement !== el)
        return;
      playNext();
    });

    el.addEventListener('loadedmetadata', () => {
      if (activeMediaElement !== el)
        return;
      const dur = el.duration;
      if (isFinite(dur) && currentIndex >= 0 && currentIndex < playlist.length) {
        playlist[currentIndex].duration = dur;
        updatePlaylistUI();
      }
      updateSeekUI(el.currentTime, dur);
    });

    el.addEventListener('error', () => {
      if (activeMediaElement !== el)
        return;
      updateStatusState('Error');
      statusInfo.textContent = 'Failed to load media';
    });
  }

  setupMediaEvents(audioEl);
  setupMediaEvents(videoEl);

  // -----------------------------------------------------------------------
  // Seek bar
  // -----------------------------------------------------------------------
  function updateSeekUI(current, duration) {
    timeCurrentEl.textContent = formatTime(current);
    timeTotalEl.textContent = formatTime(duration);
    const pct = (duration > 0 && isFinite(duration)) ? (current / duration) * 100 : 0;
    seekFill.style.width = pct + '%';
  }

  function seekToPosition(e) {
    if (!activeMediaElement || !isFinite(activeMediaElement.duration))
      return;
    const rect = seekBar.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    activeMediaElement.currentTime = x * activeMediaElement.duration;
    updateSeekUI(activeMediaElement.currentTime, activeMediaElement.duration);
  }

  seekBar.addEventListener('pointerdown', (e) => {
    isSeeking = true;
    seekBar.setPointerCapture(e.pointerId);
    seekToPosition(e);
  });

  seekBar.addEventListener('pointermove', (e) => {
    if (isSeeking)
      seekToPosition(e);
  });

  seekBar.addEventListener('pointerup', () => {
    isSeeking = false;
  });

  seekBar.addEventListener('lostpointercapture', () => {
    isSeeking = false;
  });

  // -----------------------------------------------------------------------
  // Volume
  // -----------------------------------------------------------------------
  function updateVolumeUI() {
    const displayVol = isMuted ? 0 : volume;
    volumeFill.style.width = (displayVol * 100) + '%';
    btnMute.textContent = (isMuted || volume === 0) ? '\u{1F507}' : '\u{1F50A}';
  }

  function setVolume(v) {
    if (v < 0) v = 0;
    if (v > 1) v = 1;
    volume = v;
    isMuted = false;
    if (activeMediaElement)
      activeMediaElement.volume = volume;
    updateVolumeUI();
    saveVolume();
  }

  function toggleMute() {
    if (isMuted) {
      isMuted = false;
      if (activeMediaElement)
        activeMediaElement.volume = volume;
    } else {
      volumeBeforeMute = volume;
      isMuted = true;
      if (activeMediaElement)
        activeMediaElement.volume = 0;
    }
    updateVolumeUI();
  }

  function volumeFromPosition(e) {
    const rect = volumeBar.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    setVolume(x);
  }

  let volumeDragging = false;

  volumeBar.addEventListener('pointerdown', (e) => {
    volumeDragging = true;
    volumeBar.setPointerCapture(e.pointerId);
    volumeFromPosition(e);
  });

  volumeBar.addEventListener('pointermove', (e) => {
    if (volumeDragging)
      volumeFromPosition(e);
  });

  volumeBar.addEventListener('pointerup', () => {
    volumeDragging = false;
  });

  volumeBar.addEventListener('lostpointercapture', () => {
    volumeDragging = false;
  });

  btnMute.addEventListener('click', toggleMute);

  // -----------------------------------------------------------------------
  // Transport buttons
  // -----------------------------------------------------------------------
  btnPlay.addEventListener('click', togglePlayPause);
  btnStop.addEventListener('click', stopPlayback);
  btnPrev.addEventListener('click', playPrevious);
  btnNext.addEventListener('click', playNext);

  function updatePlayButton() {
    btnPlay.innerHTML = isPlaying ? '&#9208;' : '&#9654;';
    btnPlay.title = isPlaying ? 'Pause (Space)' : 'Play (Space)';
  }

  // -----------------------------------------------------------------------
  // Playlist management
  // -----------------------------------------------------------------------
  function addFiles(files) {
    for (let i = 0; i < files.length; ++i) {
      const file = files[i];
      const src = URL.createObjectURL(file);
      const isVideo = isVideoMime(file.type) || isVideoFile(file.name);
      playlist.push({
        name: file.name,
        src: src,
        duration: 0,
        isVideo: isVideo,
        type: file.type || ''
      });
    }

    if (shuffleEnabled)
      buildShuffleOrder();
    updatePlaylistUI();
  }

  function addUrl(url) {
    const name = url.split('/').pop().split('?')[0] || 'Stream';
    const isVideo = isVideoFile(name);
    playlist.push({
      name: name,
      src: url,
      duration: 0,
      isVideo: isVideo,
      type: ''
    });
    if (shuffleEnabled)
      buildShuffleOrder();
    updatePlaylistUI();
  }

  function addVfsTrack(path, content) {
    const parts = path.split('/');
    const name = parts[parts.length - 1] || 'Media';
    const isVideo = isVideoFile(name);
    let src = content;
    if (!src)
      src = path;
    playlist.push({
      name: name,
      src: src,
      duration: 0,
      isVideo: isVideo,
      type: ''
    });
    if (shuffleEnabled)
      buildShuffleOrder();
    updatePlaylistUI();
  }

  function removeTrack(index) {
    if (index < 0 || index >= playlist.length)
      return;

    const track = playlist[index];
    if (track.src.startsWith('blob:'))
      URL.revokeObjectURL(track.src);

    const wasPlaying = index === currentIndex;
    playlist.splice(index, 1);

    if (wasPlaying) {
      stopPlayback();
      activeMediaElement = null;
      videoEl.classList.remove('active');
      canvas.style.display = '';
      placeholderArt.style.display = '';
      currentIndex = -1;
      statusTrack.textContent = 'No media loaded';
      updateWindowTitle('Media Player');
    } else if (currentIndex > index)
      --currentIndex;

    if (selectedIndex >= playlist.length)
      selectedIndex = playlist.length - 1;

    if (shuffleEnabled)
      buildShuffleOrder();
    updatePlaylistUI();
  }

  function clearPlaylist() {
    stopPlayback();
    for (const track of playlist) {
      if (track.src.startsWith('blob:'))
        URL.revokeObjectURL(track.src);
    }
    playlist = [];
    currentIndex = -1;
    selectedIndex = -1;
    activeMediaElement = null;
    videoEl.classList.remove('active');
    canvas.style.display = '';
    placeholderArt.style.display = '';
    statusTrack.textContent = 'No media loaded';
    updateWindowTitle('Media Player');
    updatePlaylistUI();
  }

  function updatePlaylistUI() {
    playlistList.innerHTML = '';
    for (let i = 0; i < playlist.length; ++i) {
      const track = playlist[i];
      const item = document.createElement('div');
      item.className = 'playlist-item';
      if (i === currentIndex)
        item.classList.add('playing');
      if (i === selectedIndex)
        item.classList.add('selected');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'track-name';
      nameSpan.textContent = (i === currentIndex ? '\u25B6 ' : '') + track.name;

      const durSpan = document.createElement('span');
      durSpan.className = 'track-duration';
      durSpan.textContent = track.duration > 0 ? formatTime(track.duration) : '--:--';

      item.appendChild(nameSpan);
      item.appendChild(durSpan);

      item.addEventListener('click', () => {
        selectedIndex = i;
        updatePlaylistUI();
      });

      item.addEventListener('dblclick', () => {
        playTrack(i);
      });

      playlistList.appendChild(item);
    }
  }

  // -----------------------------------------------------------------------
  // File input
  // -----------------------------------------------------------------------
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      addFiles(fileInput.files);
      if (currentIndex < 0 && playlist.length > 0)
        loadTrack(0);
    }
    fileInput.value = '';
  });

  btnAddFiles.addEventListener('click', () => fileInput.click());
  btnRemoveSelected.addEventListener('click', () => {
    if (selectedIndex >= 0)
      removeTrack(selectedIndex);
  });
  btnClearAll.addEventListener('click', clearPlaylist);

  // -----------------------------------------------------------------------
  // Open URL dialog
  // -----------------------------------------------------------------------
  function showOpenUrlDialog() {
    const urlInput = document.getElementById('url-input');
    urlInput.value = '';

    urlInput.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        SZ.Dialog.close('dlg-open-url');
        urlInput.removeEventListener('keydown', onKey);
        const url = urlInput.value.trim();
        if (url) {
          addUrl(url);
          if (playlist.length === 1)
            playTrack(0);
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        SZ.Dialog.close('dlg-open-url');
        urlInput.removeEventListener('keydown', onKey);
      }
    });

    SZ.Dialog.show('dlg-open-url').then((result) => {
      if (result === 'ok') {
        const url = urlInput.value.trim();
        if (url) {
          addUrl(url);
          if (playlist.length === 1)
            playTrack(0);
        }
      }
    });

    urlInput.focus();
  }

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------
  function updateStatusTrack(name) {
    statusTrack.textContent = name || 'No media loaded';
  }

  function updateStatusState(state) {
    statusState.textContent = state;
  }

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateWindowTitle(name) {
    const title = name ? name + ' - Media Player' : 'Media Player';
    document.title = title;
    SZ.Dlls.User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Bitrate estimation (status info updates)
  // -----------------------------------------------------------------------
  let bitrateInterval = null;

  function startBitrateUpdater() {
    stopBitrateUpdater();
    bitrateInterval = setInterval(() => {
      if (!activeMediaElement || !isPlaying)
        return;

      if (activeMediaElement.buffered && activeMediaElement.buffered.length > 0) {
        const duration = activeMediaElement.duration;
        if (isFinite(duration) && duration > 0) {
          const track = currentIndex >= 0 ? playlist[currentIndex] : null;
          if (track)
            statusInfo.textContent = track.type || '';
        }
      }
    }, 2000);
  }

  function stopBitrateUpdater() {
    if (bitrateInterval) {
      clearInterval(bitrateInterval);
      bitrateInterval = null;
    }
  }

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      return;

    const key = e.key;

    switch (key) {
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (activeMediaElement && isFinite(activeMediaElement.duration))
          activeMediaElement.currentTime = Math.max(0, activeMediaElement.currentTime - SEEK_STEP);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (activeMediaElement && isFinite(activeMediaElement.duration))
          activeMediaElement.currentTime = Math.min(activeMediaElement.duration, activeMediaElement.currentTime + SEEK_STEP);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setVolume(volume + VOLUME_STEP);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setVolume(volume - VOLUME_STEP);
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        playNext();
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        playPrevious();
        break;
    }

    if (e.ctrlKey && key.toLowerCase() === 'o') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // -----------------------------------------------------------------------
  // Resize handler for visualization canvas
  // -----------------------------------------------------------------------
  const resizeObserver = new ResizeObserver(() => {
    if (!compactMode)
      resizeCanvas();
  });
  resizeObserver.observe(displayArea);

  // -----------------------------------------------------------------------
  // Drag & drop files
  // -----------------------------------------------------------------------
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
      if (currentIndex < 0 && playlist.length > 0)
        loadTrack(0);
    }
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    updateWindowTitle();
    updatePlayButton();
    resizeCanvas();

    // Check for file path on command line
    const cmd = SZ.Dlls.Kernel32.GetCommandLine();
    if (cmd.path) {
      SZ.Dlls.Kernel32.ReadFile(cmd.path).then((content) => {
        addVfsTrack(cmd.path, content);
        if (playlist.length === 1)
          playTrack(0);
      }).catch(() => {
        // File read failed, ignore
      });
    }
  }

  init();
})();
