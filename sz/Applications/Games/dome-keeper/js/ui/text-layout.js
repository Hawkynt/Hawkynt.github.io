;(function() {
  'use strict';

  // Text measuring and fitting: every label is measured against the box it lives in.
  // Owns: NS.textLayout
  // Reads: dom, sprites

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const { ctx } = NS.dom;
  const { splitIconText, measureIconText, fillIconText } = NS.sprites;

  /* ======================================================================
     TEXT LAYOUT -- every label is measured against the box it lives in
     ====================================================================== */

  const UI_FONT = "'Segoe UI', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

  function uiFont(px, weight) {
    return (weight ? weight + ' ' : '') + px + 'px ' + UI_FONT;
  }

  // Layout results are cached per (text, box, font) because the same labels
  // are laid out every frame
  const textFitCache = new Map();
  function cachedLayout(key, build) {
    let v = textFitCache.get(key);
    if (v === undefined) {
      if (textFitCache.size > 3000)
        textFitCache.clear();
      v = build();
      textFitCache.set(key, v);
    }
    return v;
  }

  // Split icon text into indivisible units (characters and [[sprite]] tokens)
  function textUnits(text) {
    const parts = splitIconText(text);
    const units = [];
    for (let i = 0; i < parts.length; ++i)
      if (i % 2)
        units.push('[[' + parts[i] + ']]');
      else
        for (const ch of parts[i])
          units.push(ch);
    return units;
  }

  // Shorten text with an ellipsis until it fits maxW in the current font
  function ellipsize(text, maxW) {
    text = String(text);
    if (measureIconText(text) <= maxW)
      return text;
    const units = textUnits(text);
    let lo = 0, hi = units.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measureIconText(units.slice(0, mid).join('').trimEnd() + '…') <= maxW)
        lo = mid;
      else
        hi = mid - 1;
    }
    return lo > 0 ? units.slice(0, lo).join('').trimEnd() + '…' : '';
  }

  // Largest font size in [minPx, px] that fits; ellipsizes if minPx is still too wide
  function layoutLine(text, maxW, px, minPx, weight) {
    text = String(text);
    return cachedLayout('L' + text + '|' + Math.round(maxW) + '|' + px + '|' + minPx + '|' + (weight || ''), () => {
      let size = px;
      ctx.font = uiFont(size, weight);
      let w = measureIconText(text);
      if (w > maxW && size > minPx) {
        size = Math.max(minPx, Math.floor(px * maxW / w));
        ctx.font = uiFont(size, weight);
        w = measureIconText(text);
        while (w > maxW && size > minPx) {
          --size;
          ctx.font = uiFont(size, weight);
          w = measureIconText(text);
        }
      }
      const out = w > maxW ? ellipsize(text, maxW) : text;
      return { size, text: out, width: Math.min(w, maxW) };
    });
  }

  // Draw one line of (icon) text that never exceeds maxW; returns the drawn width.
  // Honours the current textAlign / textBaseline; sets ctx.font.
  function fitText(text, x, y, maxW, px, opts) {
    opts = opts || {};
    const l = layoutLine(text, maxW, px, opts.minPx || Math.max(9, Math.round(px * 0.6)), opts.weight);
    ctx.font = uiFont(l.size, opts.weight);
    if (opts.color)
      ctx.fillStyle = opts.color;
    if (opts.outline) {
      ctx.save();
      ctx.strokeStyle = opts.outline;
      ctx.lineWidth = Math.max(2, l.size / 6);
      ctx.lineJoin = 'round';
      if (l.text.indexOf('[[') < 0)
        ctx.strokeText(l.text, x, y);
      ctx.restore();
    }
    fillIconText(l.text, x, y);
    return l.width;
  }

  // Greedy word wrap in the current font; overlong words are ellipsized
  function wrapText(text, maxW) {
    const lines = [];
    for (const para of String(text).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const word of words) {
        const trial = line ? line + ' ' + word : word;
        if (!line || measureIconText(trial) <= maxW)
          line = trial;
        else {
          lines.push(line);
          line = word;
        }
        if (measureIconText(line) > maxW && line === word)
          line = ellipsize(word, maxW);
      }
      lines.push(line);
    }
    return lines;
  }

  // Wrap text into a w x h box, shrinking the font until all lines fit
  function layoutBlock(text, w, h, px, minPx, weight, lineGap) {
    return cachedLayout('B' + text + '|' + Math.round(w) + '|' + Math.round(h) + '|' + px + '|' + minPx + '|' + (weight || '') + '|' + lineGap, () => {
      let size = px, lines;
      for (;;) {
        ctx.font = uiFont(size, weight);
        lines = wrapText(text, w);
        if (lines.length * size * lineGap <= h || size <= minPx)
          break;
        --size;
      }
      const maxLines = Math.max(1, Math.floor(h / (size * lineGap)));
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        lines[maxLines - 1] = ellipsize(lines[maxLines - 1] + '…', w);
      }
      return { size, lines, lineH: size * lineGap };
    });
  }

  // Draw wrapped text inside a box. align: 'left' | 'center'; valign: 'top' | 'middle'
  function drawTextBlock(text, x, y, w, h, px, opts) {
    opts = opts || {};
    const b = layoutBlock(text, w, h, px, opts.minPx || Math.max(9, Math.round(px * 0.6)), opts.weight, opts.lineGap || 1.3);
    ctx.font = uiFont(b.size, opts.weight);
    if (opts.color)
      ctx.fillStyle = opts.color;
    const align = opts.align || 'left';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const tx = align === 'center' ? x + w / 2 : x;
    let ty = y + b.lineH / 2;
    if (opts.valign === 'middle')
      ty += (h - b.lines.length * b.lineH) / 2;
    for (const line of b.lines) {
      fillIconText(line, tx, ty);
      ty += b.lineH;
    }
    return b.lines.length * b.lineH;
  }

  NS.textLayout = { UI_FONT, uiFont, layoutLine, fitText, wrapText, drawTextBlock };
})();
