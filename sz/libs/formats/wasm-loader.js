;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // Lazy WASM engine initialization
  // =========================================================================

  let _ffmpegInstance = null;
  let _ffmpegLoading = null;
  let _magickInstance = null;
  let _magickLoading = null;

  function _isFileProtocol() {
    return typeof location !== 'undefined' && location.protocol === 'file:';
  }

  function _resolveBase() {
    if (typeof document === 'undefined') return '';
    const scripts = document.querySelectorAll('script[src*="wasm-loader"]');
    if (scripts.length > 0) {
      const src = scripts[scripts.length - 1].src;
      return src.substring(0, src.lastIndexOf('/') + 1) + '../wasm/';
    }
    return '';
  }

  async function ffmpeg() {
    if (_ffmpegInstance)
      return _ffmpegInstance;
    if (_ffmpegLoading)
      return _ffmpegLoading;
    if (_isFileProtocol())
      return null;

    _ffmpegLoading = (async () => {
      try {
        const base = _resolveBase() + 'ffmpeg/';
        const { FFmpeg } = await import(base + 'ffmpeg.js');
        const ff = new FFmpeg();
        await ff.load({
          coreURL: base + 'ffmpeg-core.js',
          wasmURL: base + 'ffmpeg-core.wasm',
        });
        _ffmpegInstance = ff;
        return ff;
      } catch (e) {
        console.warn('SZ.Formats.Wasm: ffmpeg init failed:', e);
        return null;
      } finally {
        _ffmpegLoading = null;
      }
    })();

    return _ffmpegLoading;
  }

  async function magick() {
    if (_magickInstance)
      return _magickInstance;
    if (_magickLoading)
      return _magickLoading;
    if (_isFileProtocol())
      return null;

    _magickLoading = (async () => {
      try {
        const base = _resolveBase() + 'magick/';
        const script = document.createElement('script');
        script.src = base + 'magick.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        if (typeof globalThis.magick !== 'undefined') {
          _magickInstance = globalThis.magick;
          return _magickInstance;
        }
        return null;
      } catch (e) {
        console.warn('SZ.Formats.Wasm: magick init failed:', e);
        return null;
      } finally {
        _magickLoading = null;
      }
    })();

    return _magickLoading;
  }

  // =========================================================================
  // Export
  // =========================================================================

  F.Wasm = { ffmpeg, magick };

})();
