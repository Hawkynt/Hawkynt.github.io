;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // Paint saves a picture in the format its file name asks for. A canvas
  // writes PNG, JPEG and WebP itself; BMP and GIF come from SZ.Formats.

  function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp', gif: 'image/gif' };

  function mimeForPath(path) {
    const m = /\.([a-z0-9]+)$/i.exec(path || '');
    return (m && MIME_BY_EXT[m[1].toLowerCase()]) || 'image/png';
  }

  // the picture on white, for formats without transparency
  function onWhite(canvas) {
    const flat = document.createElement('canvas');
    flat.width = canvas.width;
    flat.height = canvas.height;
    const ctx = flat.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(canvas, 0, 0);
    return flat;
  }

  function canvasToDataUrl(canvas, path) {
    const mime = mimeForPath(path);
    const formats = SZ.Formats;
    if (mime === 'image/bmp' || mime === 'image/gif') {
      const codec = formats && formats.find(mime === 'image/bmp' ? 'bmp' : 'gif');
      if (codec && codec.codec && codec.codec.encode) {
        const source = mime === 'image/bmp' ? onWhite(canvas) : canvas;
        const pixels = source.getContext('2d').getImageData(0, 0, source.width, source.height);
        return 'data:' + mime + ';base64,' + bytesToBase64(codec.codec.encode(pixels));
      }
      return canvas.toDataURL('image/png');
    }
    if (mime === 'image/jpeg')
      return onWhite(canvas).toDataURL(mime, 0.92);
    const url = canvas.toDataURL(mime);
    // a browser without a WebP encoder hands back PNG
    return url.startsWith('data:' + mime) ? url : canvas.toDataURL('image/png');
  }

  SZ.PaintEncoders = Object.freeze({ mimeForPath, canvasToDataUrl });
})();
