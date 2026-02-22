;(function() {
  'use strict';

  const User32 = window.SZ && SZ.Dlls && SZ.Dlls.User32;

  // ===== Presets =====

  const PRESET_CATEGORIES = [
    {
      label: 'Classic',
      presets: [
        { key: 'sunset', label: 'Sunset', stops: [{ color: '#ff512f', position: 0 }, { color: '#f09819', position: 50 }, { color: '#dd2476', position: 100 }] },
        { key: 'ocean', label: 'Ocean', stops: [{ color: '#2193b0', position: 0 }, { color: '#6dd5ed', position: 100 }] },
        { key: 'rainbow', label: 'Rainbow', stops: [{ color: '#ff0000', position: 0 }, { color: '#ff8800', position: 17 }, { color: '#ffff00', position: 33 }, { color: '#00cc00', position: 50 }, { color: '#0066ff', position: 67 }, { color: '#8800ff', position: 83 }, { color: '#ff00ff', position: 100 }] },
        { key: 'fire', label: 'Fire', stops: [{ color: '#f12711', position: 0 }, { color: '#f5af19', position: 100 }] },
        { key: 'forest', label: 'Forest', stops: [{ color: '#0f9b0f', position: 0 }, { color: '#000000', position: 50 }, { color: '#134e5e', position: 100 }] },
        { key: 'pastel', label: 'Pastel', stops: [{ color: '#fbc2eb', position: 0 }, { color: '#a6c1ee', position: 50 }, { color: '#c2e9fb', position: 100 }] },
        { key: 'midnight', label: 'Midnight', stops: [{ color: '#0f0c29', position: 0 }, { color: '#302b63', position: 50 }, { color: '#24243e', position: 100 }] },
        { key: 'gold', label: 'Gold', stops: [{ color: '#f7971e', position: 0 }, { color: '#ffd200', position: 100 }] }
      ]
    },
    {
      label: 'Swatches',
      presets: [
        { key: 'vital-ocean', label: 'Vital Ocean', stops: [{ color: '#1cb5e0', position: 0 }, { color: '#000851', position: 100 }] },
        { key: 'kale-salad', label: 'Kale Salad', stops: [{ color: '#00c9ff', position: 0 }, { color: '#92fe9d', position: 100 }] },
        { key: 'disco-club', label: 'Disco Club', stops: [{ color: '#fc466b', position: 0 }, { color: '#3f5efb', position: 100 }] },
        { key: 'shady-lane', label: 'Shady Lane', stops: [{ color: '#3f2b96', position: 0 }, { color: '#a8c0ff', position: 100 }] },
        { key: 'retro-wagon', label: 'Retro Wagon', stops: [{ color: '#fdbb2d', position: 0 }, { color: '#22c1c3', position: 100 }] },
        { key: 'fresco-crush', label: 'Fresco Crush', stops: [{ color: '#fdbb2d', position: 0 }, { color: '#3a1c71', position: 100 }] },
        { key: 'cucumber-water', label: 'Cucumber Water', stops: [{ color: '#e3ffe7', position: 0 }, { color: '#d9e7ff', position: 100 }] },
        { key: 'sea-salt', label: 'Sea Salt', stops: [{ color: '#4b6cb7', position: 0 }, { color: '#182848', position: 100 }] },
        { key: 'par-four', label: 'Par Four', stops: [{ color: '#9ebd13', position: 0 }, { color: '#008552', position: 100 }] },
        { key: 'ooey-gooey', label: 'Ooey Gooey', stops: [{ color: '#0700b8', position: 0 }, { color: '#00ff88', position: 100 }] },
        { key: 'bloody-mimosa', label: 'Bloody Mimosa', stops: [{ color: '#d53369', position: 0 }, { color: '#daae51', position: 100 }] },
        { key: 'lovely-lilly', label: 'Lovely Lilly', stops: [{ color: '#efd5ff', position: 0 }, { color: '#515ada', position: 100 }] },
        { key: 'aqua-spray', label: 'Aqua Spray', stops: [{ color: '#00d2ff', position: 0 }, { color: '#3a47d5', position: 100 }] },
        { key: 'mello-yellow', label: 'Mello Yellow', stops: [{ color: '#f8ff00', position: 0 }, { color: '#3ad59f', position: 100 }] },
        { key: 'dusty-cactus', label: 'Dusty Cactus', stops: [{ color: '#fcff9e', position: 0 }, { color: '#c67700', position: 100 }] }
      ]
    }
  ];

  // Flat lookup for quick access
  const PRESETS = {};
  for (const cat of PRESET_CATEGORIES)
    for (const p of cat.presets)
      PRESETS[p.key] = p.stops;

  // ===== State =====

  let nextId = 1;
  let colorPickerRequest = null;

  const state = {
    type: 'linear',
    repeating: false,
    angle: 90,
    radialShape: 'ellipse',
    radialSize: 'farthest-corner',
    radialPosition: 'center',
    conicAngle: 0,
    conicPosition: 'center',
    stops: [],
    selectedStopId: null
  };

  function makeStop(color, position) {
    return { id: nextId++, color, position };
  }

  state.stops = [
    makeStop('#ff0000', 0),
    makeStop('#0000ff', 100)
  ];
  state.selectedStopId = state.stops[0].id;

  // ===== DOM refs =====

  const $typeBtns = document.querySelectorAll('.type-btn');
  const $preview = document.getElementById('preview');
  const $stopTrack = document.getElementById('stop-track');
  const $stopHandles = document.getElementById('stop-handles');
  const $btnAddStop = document.getElementById('btn-add-stop');
  const $btnRemoveStop = document.getElementById('btn-remove-stop');

  const $linearControls = document.getElementById('linear-controls');
  const $radialControls = document.getElementById('radial-controls');
  const $conicControls = document.getElementById('conic-controls');

  const $slAngle = document.getElementById('sl-angle');
  const $numAngle = document.getElementById('num-angle');
  const $selRadialShape = document.getElementById('sel-radial-shape');
  const $selRadialSize = document.getElementById('sel-radial-size');
  const $selRadialPos = document.getElementById('sel-radial-pos');
  const $slConicAngle = document.getElementById('sl-conic-angle');
  const $numConicAngle = document.getElementById('num-conic-angle');
  const $selConicPos = document.getElementById('sel-conic-pos');
  const $chkRepeating = document.getElementById('chk-repeating');

  const $stopColorSwatch = document.getElementById('stop-color-swatch');
  const $stopHex = document.getElementById('stop-hex');
  const $slStopPos = document.getElementById('sl-stop-pos');
  const $numStopPos = document.getElementById('num-stop-pos');

  const $cssDisplay = document.getElementById('css-display');
  const $cssImport = document.getElementById('css-import');
  const $btnPresets = document.getElementById('btn-presets');
  const $presetDropdown = document.getElementById('preset-dropdown');
  const $btnCopy = document.getElementById('btn-copy');
  const $btnImport = document.getElementById('btn-import');

  // ===== Helpers =====

  function wireSlider(slider, number, onChange) {
    slider.addEventListener('input', () => {
      number.value = slider.value;
      onChange(+slider.value);
    });
    number.addEventListener('input', () => {
      const v = Math.max(+number.min, Math.min(+number.max, +number.value || 0));
      slider.value = v;
      onChange(v);
    });
  }

  function selectedStop() {
    return state.stops.find(s => s.id === state.selectedStopId) || null;
  }

  function sortedStops() {
    return [...state.stops].sort((a, b) => a.position - b.position);
  }

  function neighborBounds(stop) {
    let lo = 0, hi = 100;
    for (const s of state.stops) {
      if (s.id !== stop.id && s.position <= stop.position && s.position >= lo)
        lo = s.position;
      if (s.id !== stop.id && s.position >= stop.position && s.position <= hi)
        hi = s.position;
    }
    return { lo, hi };
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function interpolateColor(c1, c2, t) {
    const r1 = parseInt(c1.slice(1, 3), 16);
    const g1 = parseInt(c1.slice(3, 5), 16);
    const b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16);
    const g2 = parseInt(c2.slice(3, 5), 16);
    const b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  function colorAtPosition(pos) {
    const sorted = sortedStops();
    if (sorted.length === 0)
      return '#888888';
    if (pos <= sorted[0].position)
      return sorted[0].color;
    if (pos >= sorted[sorted.length - 1].position)
      return sorted[sorted.length - 1].color;

    for (let i = 0; i < sorted.length - 1; ++i)
      if (pos >= sorted[i].position && pos <= sorted[i + 1].position) {
        const range = sorted[i + 1].position - sorted[i].position;
        const t = range === 0 ? 0 : (pos - sorted[i].position) / range;
        return interpolateColor(sorted[i].color, sorted[i + 1].color, t);
      }

    return sorted[sorted.length - 1].color;
  }

  // ===== CSS Generation =====

  function generateCSS() {
    const sorted = sortedStops();
    const stopStr = sorted.map(s => `${s.color} ${s.position}%`).join(', ');
    const rep = state.repeating ? 'repeating-' : '';

    switch (state.type) {
      case 'linear':
        return `${rep}linear-gradient(${state.angle}deg, ${stopStr})`;
      case 'radial':
        return `${rep}radial-gradient(${state.radialShape} ${state.radialSize} at ${state.radialPosition}, ${stopStr})`;
      case 'conic':
        return `${rep}conic-gradient(from ${state.conicAngle}deg at ${state.conicPosition}, ${stopStr})`;
    }
    return '';
  }

  // ===== Syntax Highlighting =====

  function highlightCSS(cssText) {
    // cssText is like: background: linear-gradient(90deg, #ff0000 0%, #0000ff 100%);
    const parts = [];
    let i = 0;
    const src = cssText;

    function pushText(text, cls) {
      if (cls)
        parts.push(`<span class="${cls}">${escHtml(text)}</span>`);
      else
        parts.push(escHtml(text));
    }

    function pushColor(hex) {
      parts.push(
        `<span class="hl-color"><span class="hl-color-swatch" style="background:${escHtml(hex)}"></span>${escHtml(hex)}</span>`
      );
    }

    while (i < src.length) {
      // Whitespace
      if (/\s/.test(src[i])) {
        let j = i;
        while (j < src.length && /\s/.test(src[j])) ++j;
        parts.push(src.slice(i, j));
        i = j;
        continue;
      }

      // Hex color: #rrggbb or #rgb
      if (src[i] === '#' && /^#[0-9a-fA-F]{3,8}\b/.test(src.slice(i))) {
        const m = src.slice(i).match(/^#[0-9a-fA-F]{3,8}/);
        pushColor(m[0]);
        i += m[0].length;
        continue;
      }

      // Number with optional unit: 90deg, 50%, 0
      if (/[0-9]/.test(src[i]) || (src[i] === '.' && i + 1 < src.length && /[0-9]/.test(src[i + 1]))) {
        const m = src.slice(i).match(/^[0-9]*\.?[0-9]+(%|deg|px|em|rem|vw|vh|turn|grad|rad)?/);
        if (m) {
          pushText(m[0], 'hl-num');
          i += m[0].length;
          continue;
        }
      }

      // Punctuation
      if (/[{}();:,]/.test(src[i])) {
        pushText(src[i], 'hl-punc');
        ++i;
        continue;
      }

      // Identifier / keyword
      if (/[a-zA-Z_-]/.test(src[i])) {
        const m = src.slice(i).match(/^[a-zA-Z_][\w-]*/);
        if (m) {
          const word = m[0];
          // Check if followed by ( => function name
          const after = src[i + word.length];
          if (after === '(')
            pushText(word, 'hl-fn');
          // CSS property (before colon) or keyword
          else if (i === 0 || (parts.length > 0 && /;\s*$/.test(cssText.slice(0, i))))
            pushText(word, 'hl-prop');
          else if (['at', 'from', 'to', 'circle', 'ellipse', 'center', 'top', 'bottom', 'left', 'right',
                     'closest-side', 'closest-corner', 'farthest-side', 'farthest-corner'].includes(word))
            pushText(word, 'hl-kw');
          else
            pushText(word, '');
          i += word.length;
          continue;
        }
      }

      // Anything else
      parts.push(escHtml(src[i]));
      ++i;
    }

    return parts.join('');
  }

  // ===== CSS Parsing (import) =====

  const CSS_NAMED_COLORS = {
    red:'#ff0000',orange:'#ffa500',yellow:'#ffff00',green:'#008000',lime:'#00ff00',
    blue:'#0000ff',cyan:'#00ffff',aqua:'#00ffff',magenta:'#ff00ff',fuchsia:'#ff00ff',
    purple:'#800080',white:'#ffffff',black:'#000000',gray:'#808080',grey:'#808080',
    silver:'#c0c0c0',maroon:'#800000',olive:'#808000',navy:'#000080',teal:'#008080',
    pink:'#ffc0cb',coral:'#ff7f50',salmon:'#fa8072',gold:'#ffd700',indigo:'#4b0082',
    violet:'#ee82ee',tan:'#d2b48c',khaki:'#f0e68c',crimson:'#dc143c',tomato:'#ff6347',
    turquoise:'#40e0d0',chocolate:'#d2691e',sienna:'#a0522d',peru:'#cd853f',
    orchid:'#da70d6',plum:'#dda0dd',wheat:'#f5deb3',beige:'#f5f5dc',ivory:'#fffff0',
    lavender:'#e6e6fa',linen:'#faf0e6',snow:'#fffafa',honeydew:'#f0fff0',
    mintcream:'#f5fffa',azure:'#f0ffff',aliceblue:'#f0f8ff',ghostwhite:'#f8f8ff',
    seashell:'#fff5ee',oldlace:'#fdf5e6',cornsilk:'#fff8dc',lemonchiffon:'#fffacd',
    lightyellow:'#ffffe0',lightgoldenrodyellow:'#fafad2',papayawhip:'#ffefd5',
    moccasin:'#ffe4b5',peachpuff:'#ffdab9',palegoldenrod:'#eee8aa',darkkhaki:'#bdb76b',
    cornflowerblue:'#6495ed',royalblue:'#4169e1',dodgerblue:'#1e90ff',deepskyblue:'#00bfff',
    lightskyblue:'#87cefa',skyblue:'#87ceeb',steelblue:'#4682b4',lightsteelblue:'#b0c4de',
    slateblue:'#6a5acd',darkslateblue:'#483d8b',mediumslateblue:'#7b68ee',
    mediumpurple:'#9370db',darkorchid:'#9932cc',darkviolet:'#9400d3',blueviolet:'#8a2be2',
    mediumorchid:'#ba55d3',darkmagenta:'#8b008b',deeppink:'#ff1493',hotpink:'#ff69b4',
    lightpink:'#ffb6c1',palevioletred:'#db7093',mediumvioletred:'#c71585',
    orangered:'#ff4500',darkorange:'#ff8c00',lightsalmon:'#ffa07a',lightcoral:'#f08080',
    indianred:'#cd5c5c',firebrick:'#b22222',darkred:'#8b0000',
    greenyellow:'#adff2f',chartreuse:'#7fff00',lawngreen:'#7cfc00',springgreen:'#00ff7f',
    mediumspringgreen:'#00fa9a',lightgreen:'#90ee90',palegreen:'#98fb98',
    darkseagreen:'#8fbc8f',mediumseagreen:'#3cb371',seagreen:'#2e8b57',forestgreen:'#228b22',
    darkgreen:'#006400',olivedrab:'#6b8e23',darkolivegreen:'#556b2f',yellowgreen:'#9acd32',
    darkslategray:'#2f4f4f',darkslategrey:'#2f4f4f',dimgray:'#696969',dimgrey:'#696969',
    slategray:'#708090',slategrey:'#708090',lightslategray:'#778899',lightslategrey:'#778899',
    lightgray:'#d3d3d3',lightgrey:'#d3d3d3',darkgray:'#a9a9a9',darkgrey:'#a9a9a9',
    gainsboro:'#dcdcdc',whitesmoke:'#f5f5f5',
    mediumaquamarine:'#66cdaa',aquamarine:'#7fffd4',darkturquoise:'#00ced1',
    mediumturquoise:'#48d1cc',lightseagreen:'#20b2aa',darkcyan:'#008b8b',
    cadetblue:'#5f9ea0',powderblue:'#b0e0e6',lightblue:'#add8e6',paleturquoise:'#afeeee',
    lightcyan:'#e0ffff',mediumblue:'#0000cd',darkblue:'#00008b',midnightblue:'#191970',
    sandybrown:'#f4a460',goldenrod:'#daa520',darkgoldenrod:'#b8860b',
    rosybrown:'#bc8f8f',saddlebrown:'#8b4513',burlywood:'#deb887',navajowhite:'#ffdead',
    blanchedalmond:'#ffebcd',bisque:'#ffe4c4',antiquewhite:'#faebd7',floralwhite:'#fffaf0',
    mistyrose:'#ffe4e1'
  };

  function normalizeColor(raw) {
    raw = raw.trim().toLowerCase();
    // #rgb -> #rrggbb
    if (/^#[0-9a-f]{3}$/.test(raw))
      return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
    // #rrggbb
    if (/^#[0-9a-f]{6}$/.test(raw))
      return raw;
    // #rrggbbaa -> #rrggbb (drop alpha)
    if (/^#[0-9a-f]{8}$/.test(raw))
      return raw.slice(0, 7);
    // #rgba -> #rrggbb
    if (/^#[0-9a-f]{4}$/.test(raw))
      return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];

    // rgb(r, g, b) or rgba(r, g, b, a) -- comma syntax
    const rgbM = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbM)
      return '#' + [+rgbM[1], +rgbM[2], +rgbM[3]].map(c => clamp(c, 0, 255).toString(16).padStart(2, '0')).join('');

    // rgb(r g b) or rgb(r g b / a) -- modern space syntax
    const rgbSpM = raw.match(/^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)/);
    if (rgbSpM)
      return '#' + [+rgbSpM[1], +rgbSpM[2], +rgbSpM[3]].map(c => clamp(c, 0, 255).toString(16).padStart(2, '0')).join('');

    // hsl(h, s%, l%) or hsla(h, s%, l%, a) -- comma syntax
    const hslM = raw.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
    if (hslM)
      return hslToHex(+hslM[1], +hslM[2], +hslM[3]);

    // hsl(h s% l%) -- modern space syntax
    const hslSpM = raw.match(/^hsla?\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
    if (hslSpM)
      return hslToHex(+hslSpM[1], +hslSpM[2], +hslSpM[3]);

    // Named color
    if (CSS_NAMED_COLORS[raw])
      return CSS_NAMED_COLORS[raw];
    return null;
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return '#' + [f(0), f(8), f(4)].map(v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
  }

  // Strip CSS comments (/* ... */) and normalize whitespace runs
  function stripComments(src) {
    let out = '', i = 0;
    while (i < src.length) {
      if (src[i] === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) ++i;
        i += 2; // skip */
        out += ' ';
      } else if (src[i] === '/' && src[i + 1] === '/') {
        // Single-line comments (not standard CSS but common in pasted snippets)
        i += 2;
        while (i < src.length && src[i] !== '\n') ++i;
        out += ' ';
      } else if (src[i] === '"' || src[i] === "'") {
        // Preserve string literals
        const q = src[i];
        out += q;
        ++i;
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\' && i + 1 < src.length) { out += src[i] + src[i + 1]; i += 2; }
          else { out += src[i]; ++i; }
        }
        if (i < src.length) { out += src[i]; ++i; }
      } else {
        out += src[i];
        ++i;
      }
    }
    return out;
  }

  // Find the first gradient function call in arbitrary text, handling
  // vendor prefixes, minified CSS, surrounding rules, etc.
  function findGradientCall(src) {
    // Match optional vendor prefix + optional repeating- + gradient type
    const re = /(?:-(?:webkit|moz|o|ms)-)?(repeating-)?(linear|radial|conic)-gradient\s*\(/gi;
    let m;
    while ((m = re.exec(src)) !== null) {
      const fnStart = m.index;
      const openParen = src.indexOf('(', fnStart + m[0].length - 1);
      if (openParen < 0)
        continue;

      // Walk forward to find matching close paren
      let depth = 0, closeIdx = -1;
      for (let i = openParen; i < src.length; ++i) {
        if (src[i] === '(') ++depth;
        else if (src[i] === ')') { --depth; if (depth === 0) { closeIdx = i; break; } }
      }
      if (closeIdx < 0)
        continue;

      return {
        repeating: !!m[1],
        type: m[2].toLowerCase(),
        inner: src.slice(openParen + 1, closeIdx)
      };
    }
    return null;
  }

  // Split string on top-level commas (respects nested parens)
  function splitTopLevel(str) {
    const parts = [];
    let current = '', depth = 0;
    for (const ch of str) {
      if (ch === '(') ++depth;
      else if (ch === ')') --depth;
      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else
        current += ch;
    }
    if (current.trim())
      parts.push(current.trim());
    return parts;
  }

  // Test if a token looks like a color (starts parsing as one)
  function looksLikeColor(token) {
    const t = token.toLowerCase();
    return /^#[0-9a-f]/.test(t) || /^rgba?\s*\(/.test(t) || /^hsla?\s*\(/.test(t) || /^hwb\s*\(/.test(t)
      || /^lab\s*\(/.test(t) || /^lch\s*\(/.test(t) || /^oklch\s*\(/.test(t) || /^oklab\s*\(/.test(t)
      || /^color\s*\(/.test(t) || !!CSS_NAMED_COLORS[t.split(/[\s(]/)[0]];
  }

  // Parse a single color-stop part like "#ff0000 50%" or "rgb(255,0,0) 25%"
  function parseColorStop(part) {
    const p = part.trim();
    if (!p)
      return null;

    let color = null, position = null;

    // Try hex: #rgb, #rrggbb, #rrggbbaa
    const hexM = p.match(/^(#[0-9a-fA-F]{3,8})\s*([\d.]+\s*%?)?\s*$/);
    if (hexM) {
      color = normalizeColor(hexM[1]);
      if (hexM[2]) position = parseFloat(hexM[2]);
      if (color) return { color, position };
    }

    // Try functional color: rgb(...), rgba(...), hsl(...), hsla(...)
    const funcM = p.match(/^((?:rgba?|hsla?|hwb|lab|lch|oklch|oklab|color)\s*\([^)]*\))\s*([\d.]+\s*%?)?\s*$/i);
    if (funcM) {
      color = normalizeColor(funcM[1]);
      if (funcM[2]) position = parseFloat(funcM[2]);
      if (color) return { color, position };
    }

    // Try named color (possibly followed by a position)
    const tokens = p.split(/\s+/);
    const namedHex = normalizeColor(tokens[0]);
    if (namedHex) {
      color = namedHex;
      if (tokens.length > 1) position = parseFloat(tokens[tokens.length - 1]);
      return { color, position };
    }

    return null;
  }

  function parseGradientCSS(input) {
    const cleaned = stripComments(input);
    const found = findGradientCall(cleaned);
    if (!found)
      return null;

    const { type, repeating, inner } = found;
    const parts = splitTopLevel(inner);
    const result = {
      type, repeating, stops: [],
      angle: 90,
      radialShape: 'ellipse', radialSize: 'farthest-corner', radialPosition: 'center',
      conicAngle: 0, conicPosition: 'center'
    };

    // Determine where color stops begin: the first part that starts with a color
    let startIdx = 0;

    if (type === 'linear' && parts.length > 0 && !looksLikeColor(parts[0])) {
      const first = parts[0].trim();
      const degM = first.match(/^\s*(-?\d+(?:\.\d+)?)\s*deg\s*$/i);
      const toM = first.match(/^\s*to\s+(top|bottom|left|right)(?:\s+(top|bottom|left|right))?\s*$/i);
      if (degM) {
        result.angle = ((Math.round(+degM[1]) % 360) + 360) % 360;
        startIdx = 1;
      } else if (toM) {
        const dirs = (toM[1] + (toM[2] ? ' ' + toM[2] : '')).toLowerCase();
        const dirMap = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 };
        result.angle = dirMap[dirs] != null ? dirMap[dirs] : 180;
        startIdx = 1;
      }
    } else if (type === 'radial' && parts.length > 0 && !looksLikeColor(parts[0])) {
      const first = parts[0].trim();
      const atSplit = first.split(/\s+at\s+/i);
      const shapePart = atSplit[0].trim().toLowerCase();
      if (atSplit.length > 1)
        result.radialPosition = atSplit[1].trim().toLowerCase();

      for (const t of shapePart.split(/\s+/)) {
        if (t === 'circle' || t === 'ellipse') result.radialShape = t;
        else if (['closest-side', 'closest-corner', 'farthest-side', 'farthest-corner'].includes(t)) result.radialSize = t;
      }
      startIdx = 1;
    } else if (type === 'conic' && parts.length > 0 && !looksLikeColor(parts[0])) {
      const first = parts[0].trim();
      const fromM = first.match(/from\s+(-?\d+(?:\.\d+)?)\s*deg/i);
      if (fromM)
        result.conicAngle = ((Math.round(+fromM[1]) % 360) + 360) % 360;
      const atM = first.match(/at\s+([\w\s]+)$/i);
      if (atM)
        result.conicPosition = atM[1].trim().toLowerCase();
      startIdx = 1;
    }

    // Parse color stops
    for (let i = startIdx; i < parts.length; ++i) {
      const stop = parseColorStop(parts[i]);
      if (stop)
        result.stops.push(stop);
    }

    // Fill in missing positions: first defaults to 0, last to 100
    if (result.stops.length > 0) {
      if (result.stops[0].position == null) result.stops[0].position = 0;
      if (result.stops.length > 1 && result.stops[result.stops.length - 1].position == null)
        result.stops[result.stops.length - 1].position = 100;

      // Interpolate gaps between known positions
      let lastKnown = 0;
      for (let i = 1; i < result.stops.length; ++i) {
        if (result.stops[i].position != null) {
          const gap = i - lastKnown;
          if (gap > 1) {
            const sp = result.stops[lastKnown].position;
            const ep = result.stops[i].position;
            for (let j = lastKnown + 1; j < i; ++j)
              result.stops[j].position = Math.round(sp + (ep - sp) * (j - lastKnown) / gap);
          }
          lastKnown = i;
        }
      }

      for (const s of result.stops)
        s.position = clamp(Math.round(s.position || 0), 0, 100);
    }

    return result.stops.length >= 2 ? result : null;
  }

  function applyParsed(parsed) {
    state.type = parsed.type;
    state.repeating = parsed.repeating;
    state.angle = parsed.angle;
    state.radialShape = parsed.radialShape;
    state.radialSize = parsed.radialSize;
    state.radialPosition = parsed.radialPosition;
    state.conicAngle = parsed.conicAngle;
    state.conicPosition = parsed.conicPosition;
    state.stops = parsed.stops.map(s => makeStop(s.color, s.position));
    state.selectedStopId = state.stops[0].id;
  }

  // ===== Rendering =====

  let lastRawCSS = '';

  function updateAll() {
    const gradientValue = generateCSS();
    const fullCSS = 'background: ' + gradientValue + ';';
    lastRawCSS = fullCSS;

    // Preview
    $preview.style.background = gradientValue;

    // Stop track
    const sorted = sortedStops();
    const trackStops = sorted.map(s => `${s.color} ${s.position}%`).join(', ');
    $stopTrack.style.background = `linear-gradient(to right, ${trackStops})`;

    // Handles -- update in place to preserve pointer capture during drag
    const existingHandles = $stopHandles.children;
    const wantedIds = state.stops.map(s => String(s.id));
    const currentIds = Array.from(existingHandles).map(el => el.dataset.id);
    const needsRebuild = wantedIds.length !== currentIds.length || wantedIds.some((id, i) => id !== currentIds[i]);

    if (needsRebuild) {
      $stopHandles.innerHTML = '';
      for (const stop of state.stops) {
        const el = document.createElement('div');
        el.className = 'stop-handle' + (stop.id === state.selectedStopId ? ' selected' : '');
        el.style.left = stop.position + '%';
        el.style.setProperty('--handle-color', stop.color);
        el.dataset.id = stop.id;
        $stopHandles.appendChild(el);
      }
    } else
      for (let i = 0; i < state.stops.length; ++i) {
        const stop = state.stops[i];
        const el = existingHandles[i];
        el.className = 'stop-handle' + (stop.id === state.selectedStopId ? ' selected' : '');
        el.style.left = stop.position + '%';
        el.style.setProperty('--handle-color', stop.color);
      }

    // Type tabs
    for (const btn of $typeBtns)
      btn.classList.toggle('active', btn.dataset.type === state.type);

    // Controls visibility
    $linearControls.classList.toggle('hidden', state.type !== 'linear');
    $radialControls.classList.toggle('hidden', state.type !== 'radial');
    $conicControls.classList.toggle('hidden', state.type !== 'conic');

    // Sync control values
    $slAngle.value = state.angle;
    $numAngle.value = state.angle;
    $selRadialShape.value = state.radialShape;
    $selRadialSize.value = state.radialSize;
    $selRadialPos.value = state.radialPosition;
    $slConicAngle.value = state.conicAngle;
    $numConicAngle.value = state.conicAngle;
    $selConicPos.value = state.conicPosition;
    $chkRepeating.checked = state.repeating;

    // Stop editor
    const sel = selectedStop();
    if (sel) {
      $stopColorSwatch.style.background = sel.color;
      $stopHex.value = sel.color;
      const bounds = neighborBounds(sel);
      $slStopPos.min = bounds.lo;
      $slStopPos.max = bounds.hi;
      $numStopPos.min = bounds.lo;
      $numStopPos.max = bounds.hi;
      $slStopPos.value = sel.position;
      $numStopPos.value = sel.position;
    }

    // Remove button state
    $btnRemoveStop.disabled = state.stops.length <= 2;

    // Highlighted CSS output
    $cssDisplay.innerHTML = highlightCSS(fullCSS);
  }

  // ===== Color Picker Integration =====

  function openColorPicker() {
    const sel = selectedStop();
    if (!sel)
      return;

    const hex = sel.color;
    const returnKey = 'sz:gradient-gen:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
    colorPickerRequest = { returnKey, stopId: sel.id };

    try {
      if (User32)
        User32.PostMessage('sz:launchApp', {
          appId: 'color-picker',
          urlParams: { returnKey, hex }
        });
    } catch (_) {
      colorPickerRequest = null;
    }
  }

  window.addEventListener('storage', e => {
    if (!colorPickerRequest || !e || e.key !== colorPickerRequest.returnKey || !e.newValue)
      return;

    let payload = null;
    try { payload = JSON.parse(e.newValue); } catch { return; }
    if (!payload || payload.type !== 'color-picker-result')
      return;

    const r = clamp(payload.r || 0, 0, 255);
    const g = clamp(payload.g || 0, 0, 255);
    const b = clamp(payload.b || 0, 0, 255);
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

    const stop = state.stops.find(s => s.id === colorPickerRequest.stopId);
    if (stop)
      stop.color = hex;

    try { localStorage.removeItem(colorPickerRequest.returnKey); } catch {}
    colorPickerRequest = null;
    updateAll();
  });

  // ===== Event wiring =====

  // Type tabs
  for (const btn of $typeBtns)
    btn.addEventListener('click', () => {
      state.type = btn.dataset.type;
      updateAll();
    });

  // Linear angle
  wireSlider($slAngle, $numAngle, v => {
    state.angle = v;
    updateAll();
  });

  // Radial controls
  $selRadialShape.addEventListener('change', () => { state.radialShape = $selRadialShape.value; updateAll(); });
  $selRadialSize.addEventListener('change', () => { state.radialSize = $selRadialSize.value; updateAll(); });
  $selRadialPos.addEventListener('change', () => { state.radialPosition = $selRadialPos.value; updateAll(); });

  // Conic controls
  wireSlider($slConicAngle, $numConicAngle, v => {
    state.conicAngle = v;
    updateAll();
  });
  $selConicPos.addEventListener('change', () => { state.conicPosition = $selConicPos.value; updateAll(); });

  // Repeating
  $chkRepeating.addEventListener('change', () => { state.repeating = $chkRepeating.checked; updateAll(); });

  // Stop color: click swatch to open Color Picker app
  $stopColorSwatch.addEventListener('click', openColorPicker);

  // Stop hex manual edit
  $stopHex.addEventListener('change', () => {
    const sel = selectedStop();
    if (!sel)
      return;
    let v = $stopHex.value.trim();
    if (!v.startsWith('#'))
      v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      sel.color = v.toLowerCase();
      updateAll();
    } else
      $stopHex.value = sel.color;
  });

  // Stop position (clamped to neighbor bounds)
  wireSlider($slStopPos, $numStopPos, v => {
    const sel = selectedStop();
    if (sel) {
      const bounds = neighborBounds(sel);
      sel.position = clamp(v, bounds.lo, bounds.hi);
      updateAll();
    }
  });

  // Add stop
  $btnAddStop.addEventListener('click', () => {
    const sorted = sortedStops();
    let pos = 50, color = '#888888';
    if (sorted.length >= 2) {
      let maxGap = 0, gapIdx = 0;
      for (let i = 0; i < sorted.length - 1; ++i) {
        const gap = sorted[i + 1].position - sorted[i].position;
        if (gap > maxGap) { maxGap = gap; gapIdx = i; }
      }
      pos = Math.round((sorted[gapIdx].position + sorted[gapIdx + 1].position) / 2);
      color = interpolateColor(sorted[gapIdx].color, sorted[gapIdx + 1].color, 0.5);
    }
    const stop = makeStop(color, pos);
    state.stops.push(stop);
    state.selectedStopId = stop.id;
    updateAll();
  });

  // Remove stop
  $btnRemoveStop.addEventListener('click', () => {
    if (state.stops.length <= 2)
      return;
    const idx = state.stops.findIndex(s => s.id === state.selectedStopId);
    if (idx >= 0) {
      state.stops.splice(idx, 1);
      state.selectedStopId = state.stops[Math.min(idx, state.stops.length - 1)].id;
      updateAll();
    }
  });

  // Handle click to select / drag (clamped between neighboring stops)
  $stopHandles.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.stop-handle');
    if (!handle)
      return;

    const id = +handle.dataset.id;
    state.selectedStopId = id;
    updateAll();

    const stop = state.stops.find(s => s.id === id);
    if (!stop)
      return;

    const { lo, hi } = neighborBounds(stop);
    const trackRect = $stopHandles.getBoundingClientRect();
    handle.setPointerCapture(e.pointerId);

    const onMove = ev => {
      const x = ev.clientX - trackRect.left;
      stop.position = clamp(Math.round(x / trackRect.width * 100), lo, hi);
      updateAll();
    };

    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });

  // Click track to add stop
  document.getElementById('stop-track-wrap').addEventListener('pointerdown', e => {
    if (e.target.closest('.stop-handle'))
      return;
    const trackRect = e.currentTarget.getBoundingClientRect();
    const pct = clamp(Math.round((e.clientX - trackRect.left) / trackRect.width * 100), 0, 100);
    const stop = makeStop(colorAtPosition(pct), pct);
    state.stops.push(stop);
    state.selectedStopId = stop.id;
    updateAll();
  });

  // ===== Preset picker (custom dropdown with gradient previews) =====

  function buildPresetGradientCSS(stops) {
    return 'linear-gradient(90deg, ' + stops.map(s => s.color + ' ' + s.position + '%').join(', ') + ')';
  }

  function buildPresetDropdown() {
    $presetDropdown.innerHTML = '';
    for (const cat of PRESET_CATEGORIES) {
      const header = document.createElement('div');
      header.className = 'preset-cat-header';
      header.textContent = cat.label;
      $presetDropdown.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'preset-grid';
      for (const p of cat.presets) {
        const item = document.createElement('button');
        item.className = 'preset-item';
        item.dataset.key = p.key;
        item.title = p.label;

        const swatch = document.createElement('span');
        swatch.className = 'preset-swatch';
        swatch.style.background = buildPresetGradientCSS(p.stops);

        const label = document.createElement('span');
        label.className = 'preset-label';
        label.textContent = p.label;

        item.appendChild(swatch);
        item.appendChild(label);
        grid.appendChild(item);
      }
      $presetDropdown.appendChild(grid);
    }
  }

  buildPresetDropdown();

  let presetOpen = false;

  function togglePresetDropdown(open) {
    presetOpen = open != null ? open : !presetOpen;
    $presetDropdown.classList.toggle('open', presetOpen);
    $btnPresets.classList.toggle('active', presetOpen);
  }

  $btnPresets.addEventListener('click', e => {
    e.stopPropagation();
    togglePresetDropdown();
  });

  $presetDropdown.addEventListener('click', e => {
    const item = e.target.closest('.preset-item');
    if (!item)
      return;
    const key = item.dataset.key;
    if (!key || !PRESETS[key])
      return;
    state.stops = PRESETS[key].map(p => makeStop(p.color, p.position));
    state.selectedStopId = state.stops[0].id;
    togglePresetDropdown(false);
    updateAll();
  });

  document.addEventListener('pointerdown', e => {
    if (presetOpen && !e.target.closest('#preset-picker'))
      togglePresetDropdown(false);
  });

  // Copy CSS
  $btnCopy.addEventListener('click', () => {
    const text = lastRawCSS;
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(() => {
        $btnCopy.textContent = 'Copied!';
        setTimeout(() => { $btnCopy.textContent = 'Copy CSS'; }, 1200);
      });
    else {
      // Fallback: temporary textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      $btnCopy.textContent = 'Copied!';
      setTimeout(() => { $btnCopy.textContent = 'Copy CSS'; }, 1200);
    }
  });

  // ===== Import / Paste CSS =====

  let importMode = false;

  function enterImportMode() {
    importMode = true;
    $btnImport.classList.add('active');
    $btnImport.textContent = 'Apply';
    $cssDisplay.classList.add('hidden');
    $cssImport.classList.remove('hidden');
    $cssImport.value = '';
    $cssImport.focus();
  }

  function exitImportMode(apply) {
    if (apply) {
      const text = $cssImport.value.trim();
      if (text) {
        const parsed = parseGradientCSS(text);
        if (parsed)
          applyParsed(parsed);
      }
    }
    importMode = false;
    $btnImport.classList.remove('active');
    $btnImport.textContent = 'Paste CSS';
    $cssImport.classList.add('hidden');
    $cssDisplay.classList.remove('hidden');
    updateAll();
  }

  $btnImport.addEventListener('click', () => {
    if (importMode)
      exitImportMode(true);
    else
      enterImportMode();
  });

  $cssImport.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      exitImportMode(true);
    } else if (e.key === 'Escape')
      exitImportMode(false);
  });

  // Also support pasting directly onto the display area
  $cssDisplay.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text) {
      const parsed = parseGradientCSS(text);
      if (parsed) {
        applyParsed(parsed);
        updateAll();
      }
    }
  });

  // Make the display focusable for paste to work
  $cssDisplay.setAttribute('tabindex', '0');

  // ===== Init =====
  updateAll();

  // ===== Menu system =====

  function handleMenuAction(action) {
    if (action === 'about')
      SZ.Dialog.show('dlg-about');
  }

  new SZ.MenuBar({ onAction: handleMenuAction });
  SZ.Dialog.wireAll();

})();
