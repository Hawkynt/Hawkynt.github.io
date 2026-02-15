;(function(){window.__visionMd=`# Media Player

An audio and video player with playlist management, audio visualization, transport controls, shuffle and repeat modes, and streaming URL support -- the all-in-one media hub for »SynthelicZ«.

## Product Requirements

### Purpose
Media Player serves as the central audio and video playback application within the »SynthelicZ« desktop environment. It allows users to play local media files and streaming URLs, manage playlists, and enjoy audio visualizations -- providing the essential multimedia experience expected of any full-featured desktop operating system.

### Key Capabilities
- Audio and video playback with full transport controls (play, pause, stop, seek, skip)
- Volume control with mute toggle and persistent volume settings
- Playlist management with add, remove, clear, and track selection
- Shuffle and repeat modes (off, repeat all, repeat one)
- Support for multiple audio formats (MP3, WAV, OGG, FLAC, M4A) and video formats (MP4, WebM)
- Real-time audio frequency visualization via canvas
- Compact and full view modes with toggleable playlist panel
- Keyboard shortcuts for hands-free playback control

### Design Reference
Modeled after the classic Windows Media Player and Winamp -- combining a visual display area with transport controls, a playlist sidebar, and audio visualization, all in a compact window that stays out of the way while playing music.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Playback
- [x] As a user, I can play and pause audio and video files
- [x] As a user, I can stop playback completely
- [x] As a user, I can skip to the next or previous track in the playlist
- [x] As a user, I can seek to any position in the current track
- [x] As a user, I can see the elapsed and total time of the current track
- [ ] As a user, I can adjust playback speed (0.5x, 1x, 1.5x, 2x)
- [ ] As a user, I can set A-B loop points to repeat a section

### Volume
- [x] As a user, I can adjust the volume with a slider
- [x] As a user, I can mute and unmute playback
- [x] As a user, I can have my volume setting persisted across sessions
- [ ] As a user, I can use a volume normalization option to equalize loudness across tracks

### Playlist
- [x] As a user, I can add files to the playlist
- [x] As a user, I can remove individual tracks from the playlist
- [x] As a user, I can clear the entire playlist
- [x] As a user, I can click a playlist item to play it
- [x] As a user, I can see the currently playing track highlighted in the playlist
- [x] As a user, I can toggle the playlist panel on and off
- [ ] As a user, I can reorder tracks in the playlist by dragging
- [ ] As a user, I can save and load playlists (M3U, PLS)
- [ ] As a user, I can sort the playlist by name, duration, or date

### Shuffle and Repeat
- [x] As a user, I can enable shuffle mode for random playback order
- [x] As a user, I can cycle through repeat modes (off, repeat all, repeat one)
- [ ] As a user, I can see a shuffle indicator in the status bar

### File Support
- [x] As a user, I can open audio files (MP3, WAV, OGG, FLAC, M4A)
- [x] As a user, I can open video files (MP4, WebM)
- [x] As a user, I can open a streaming URL for network playback
- [x] As a user, I can drag and drop files onto the player to add them
- [x] As a user, I can open files from the virtual file system
- [ ] As a user, I can open audio CDs or disc images
- [ ] As a user, I can read and display embedded metadata (artist, album, track number)

### Visualization
- [x] As a user, I can see an audio frequency visualization while music plays
- [x] As a user, I can see video playback when playing video files
- [x] As a user, I can see a placeholder when no media is loaded
- [ ] As a user, I can choose from multiple visualization styles (bars, waveform, spectrum)
- [ ] As a user, I can see album art when available

### View Modes
- [x] As a user, I can switch to a compact mode that hides the display area
- [x] As a user, I can toggle the playlist panel visibility
- [ ] As a user, I can enter full-screen video mode
- [ ] As a user, I can use a mini-player mode that floats on top of other windows

### Keyboard Shortcuts
- [x] As a user, I can use Space to toggle play/pause
- [x] As a user, I can use arrow keys to seek forward and backward
- [x] As a user, I can use M to mute, N for next, P for previous
- [ ] As a user, I can use keyboard shortcuts to adjust volume (up/down arrows with modifier)

### Status
- [x] As a user, I can see the current track name in the status bar
- [x] As a user, I can see the playback state (Playing, Paused, Stopped) in the status bar
- [ ] As a user, I can see the bitrate and format of the current file in the status bar
`})();
