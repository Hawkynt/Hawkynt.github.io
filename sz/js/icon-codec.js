;(function(root) {
  'use strict';
  // Thin shim: SZ.System.Drawing.IconCodec is now provided by
  // libs/formats/graphics-ico.js (shared format library).
  // This file exists for backward compatibility with apps that load
  // js/icon-codec.js directly. If graphics-ico.js loaded first,
  // the codec is already available. Otherwise, provide the same API
  // by delegating to SZ.Formats.find('ico').codec when available.

  const SZ = root.SZ = root.SZ || {};
  SZ.System = SZ.System || {};
  SZ.System.Drawing = SZ.System.Drawing || {};

  // If graphics-ico.js already populated the codec, nothing to do
  if (SZ.System.Drawing.IconCodec)
    return;

  // Lazy accessor: resolve on first use (handles load-order flexibility)
  const handler = {
    get(_, prop) {
      const fmt = SZ.Formats && SZ.Formats.find && SZ.Formats.find('ico');
      if (fmt && fmt.codec)
        return fmt.codec[prop];
      return undefined;
    }
  };

  SZ.System.Drawing.IconCodec = typeof Proxy !== 'undefined'
    ? new Proxy({}, handler)
    : {};

  // Also support CommonJS
  if (typeof module !== 'undefined' && module.exports)
    module.exports = SZ.System.Drawing.IconCodec;

})(typeof globalThis !== 'undefined' ? globalThis : window);
