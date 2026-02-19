;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // SVG metadata parser
  // =========================================================================

  function parse(bytes) {
    let text;
    try {
      text = new TextDecoder('utf-8').decode(bytes);
    } catch (_) {
      return null;
    }

    const widthMatch = text.match(/\bwidth\s*=\s*["']([^"']+)["']/);
    const heightMatch = text.match(/\bheight\s*=\s*["']([^"']+)["']/);
    const viewBoxMatch = text.match(/\bviewBox\s*=\s*["']([^"']+)["']/);

    return {
      width: widthMatch ? widthMatch[1] : null,
      height: heightMatch ? heightMatch[1] : null,
      viewBox: viewBoxMatch ? viewBoxMatch[1] : null,
      size: bytes.length,
    };
  }

  // =========================================================================
  // Decode via browser Image
  // =========================================================================

  async function decode(bytes) {
    const blob = new Blob([bytes], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 150;
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : (() => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; })();
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, w, h);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('svg', {
    name: 'SVG Image',
    category: 'graphics',
    extensions: ['svg', 'svgz'],
    mimeTypes: ['image/svg+xml'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 4) return false;
      for (let i = 0; i < Math.min(256, bytes.length - 3); ++i) {
        if (bytes[i] === 0x3C) {
          const snippet = String.fromCharCode(...bytes.slice(i, Math.min(i + 16, bytes.length)));
          if (snippet.startsWith('<svg') || snippet.startsWith('<?xml'))
            return true;
        }
      }
      return false;
    },
    codec: { decode },
    parse,
  });

})();
