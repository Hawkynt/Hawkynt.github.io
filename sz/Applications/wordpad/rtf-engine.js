;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _escapeHtml, _rgbToHex, _User32, _ComDlg32;

  function init(ctx) {
    _escapeHtml = ctx.escapeHtml;
    _rgbToHex = ctx.rgbToHex;
    _User32 = ctx.User32;
    _ComDlg32 = ctx.ComDlg32;
  }

  // ═══════════════════════════════════════════════════════════════
  // RTF Import (custom parser)
  // ═══════════════════════════════════════════════════════════════

  function rtfToHtml(rtf) {
    const fonts = [];
    const colors = [null]; // index 0 = auto/default

    // Extract font table
    const fontTblMatch = rtf.match(/\{\\fonttbl([^}]*(?:\{[^}]*\}[^}]*)*)\}/);
    if (fontTblMatch) {
      const ftbl = fontTblMatch[1];
      const fontEntries = ftbl.match(/\{\\f(\d+)[^}]*\s([^;{}]+);?\}/g);
      if (fontEntries)
        for (const entry of fontEntries) {
          const m = entry.match(/\\f(\d+).*?\\fcharset\d*\s*([^;{}]+)/);
          if (m)
            fonts[parseInt(m[1], 10)] = m[2].trim().replace(/;$/, '');
          else {
            const m2 = entry.match(/\\f(\d+)[^}]*\s+([^;{}]+);?\}/);
            if (m2) fonts[parseInt(m2[1], 10)] = m2[2].trim().replace(/;$/, '');
          }
        }
    }

    // Extract color table
    const colorTblMatch = rtf.match(/\{\\colortbl\s*;?([^}]*)\}/);
    if (colorTblMatch) {
      const entries = colorTblMatch[1].split(';');
      for (const entry of entries) {
        const rm = entry.match(/\\red(\d+)/);
        const gm = entry.match(/\\green(\d+)/);
        const bm = entry.match(/\\blue(\d+)/);
        if (rm && gm && bm)
          colors.push('rgb(' + rm[1] + ',' + gm[1] + ',' + bm[1] + ')');
        else if (entry.trim() === '')
          colors.push(null);
      }
    }

    // Tokenize and process
    let html = '';
    let bold = false, italic = false, underline = false, strike = false;
    let fontSize = 24; // half-points (12pt default)
    let fontIdx = 0;
    let colorIdx = 0;
    let depth = 0;
    let inFontTbl = false, inColorTbl = false, inHeader = false;
    let align = '';
    let pendingPar = false;
    let firstPar = true;

    function openSpan() {
      let style = '';
      if (bold) style += 'font-weight:bold;';
      if (italic) style += 'font-style:italic;';
      if (underline) style += 'text-decoration:underline;';
      if (strike) style += 'text-decoration:line-through;';
      if (fontSize !== 24) style += 'font-size:' + (fontSize / 2) + 'pt;';
      if (fonts[fontIdx]) style += 'font-family:' + fonts[fontIdx] + ';';
      if (colorIdx > 0 && colors[colorIdx]) style += 'color:' + colors[colorIdx] + ';';
      return style ? '<span style="' + style + '">' : '<span>';
    }

    // Simple tokenizer
    let i = 0;
    const len = rtf.length;

    function readControlWord() {
      let word = '';
      while (i < len && /[a-zA-Z]/.test(rtf[i])) word += rtf[i++];
      let param = '';
      if (i < len && (rtf[i] === '-' || /\d/.test(rtf[i]))) {
        if (rtf[i] === '-') { param += '-'; ++i; }
        while (i < len && /\d/.test(rtf[i])) param += rtf[i++];
      }
      if (i < len && rtf[i] === ' ') ++i; // consume delimiter space
      return { word, param: param !== '' ? parseInt(param, 10) : null };
    }

    while (i < len) {
      const ch = rtf[i];

      if (ch === '{') {
        ++depth; ++i;
        // Check for special groups
        if (rtf.substring(i, i + 8) === '\\fonttbl') { inFontTbl = true; }
        if (rtf.substring(i, i + 9) === '\\colortbl') { inColorTbl = true; }
        if (rtf.substring(i, i + 5) === '\\info') { inHeader = true; }
        if (rtf.substring(i, i + 9) === '\\*\\') { inHeader = true; }
        continue;
      }

      if (ch === '}') {
        if (inFontTbl) inFontTbl = false;
        if (inColorTbl) inColorTbl = false;
        if (inHeader) inHeader = false;
        --depth; ++i;
        continue;
      }

      if (inFontTbl || inColorTbl || inHeader) { ++i; continue; }

      if (ch === '\\') {
        ++i;
        if (i >= len) break;

        // Escaped characters
        if (rtf[i] === '\\' || rtf[i] === '{' || rtf[i] === '}') {
          if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
          html += _escapeHtml(rtf[i]); ++i; continue;
        }

        if (rtf[i] === "'") {
          // Hex char
          ++i;
          const hex = rtf.substring(i, i + 2);
          i += 2;
          if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
          html += _escapeHtml(String.fromCharCode(parseInt(hex, 16)));
          continue;
        }

        if (rtf[i] === '~') { html += '&nbsp;'; ++i; continue; }

        const ctrl = readControlWord();
        switch (ctrl.word) {
          case 'par': case 'line': pendingPar = true; break;
          case 'pard': bold = false; italic = false; underline = false; strike = false; fontSize = 24; fontIdx = 0; colorIdx = 0; align = ''; break;
          case 'b': bold = ctrl.param !== 0; break;
          case 'i': italic = ctrl.param !== 0; break;
          case 'ul': case 'ulnone': underline = ctrl.word === 'ul' && ctrl.param !== 0; break;
          case 'strike': strike = ctrl.param !== 0; break;
          case 'fs': if (ctrl.param != null) fontSize = ctrl.param; break;
          case 'f': if (ctrl.param != null) fontIdx = ctrl.param; break;
          case 'cf': if (ctrl.param != null) colorIdx = ctrl.param; break;
          case 'ql': align = 'left'; break;
          case 'qc': align = 'center'; break;
          case 'qr': align = 'right'; break;
          case 'qj': align = 'justify'; break;
          case 'u': {
            // Unicode: \uN? -- skip the fallback char
            if (ctrl.param != null) {
              const cp = ctrl.param < 0 ? ctrl.param + 65536 : ctrl.param;
              if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
              html += _escapeHtml(String.fromCodePoint(cp));
              // Skip fallback character
              if (i < len && rtf[i] !== '\\' && rtf[i] !== '{' && rtf[i] !== '}') ++i;
            }
            break;
          }
          case 'tab': html += '&emsp;'; break;
          // Ignore other control words
        }
        continue;
      }

      // Plain text
      if (ch === '\r' || ch === '\n') { ++i; continue; }
      if (pendingPar) { html += firstPar ? '' : '</p>'; html += '<p' + (align ? ' style="text-align:' + align + '"' : '') + '>'; pendingPar = false; firstPar = false; }
      if (firstPar) { html += '<p>'; firstPar = false; }
      html += openSpan() + _escapeHtml(ch) + '</span>';
      ++i;
    }

    if (!firstPar) html += '</p>';
    return html || '<p><br></p>';
  }

  function htmlToRtf(htmlContent) {
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlContent;
    tmp.style.position = 'absolute';
    tmp.style.left = '-9999px';
    document.body.appendChild(tmp);

    const usedFonts = ['Calibri'];
    const usedColors = [[0, 0, 0]];

    function getFontIndex(family) {
      const clean = family.split(',')[0].replace(/['"]/g, '').trim();
      if (!clean) return 0;
      let idx = usedFonts.indexOf(clean);
      if (idx < 0) { idx = usedFonts.length; usedFonts.push(clean); }
      return idx;
    }

    function getColorIndex(cssColor) {
      const hex = _rgbToHex(cssColor);
      if (!hex) return 0;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      for (let i = 0; i < usedColors.length; ++i)
        if (usedColors[i][0] === r && usedColors[i][1] === g && usedColors[i][2] === b) return i;
      usedColors.push([r, g, b]);
      return usedColors.length - 1;
    }

    let rtf = '';

    function processNode(node) {
      if (node.nodeType === 3) {
        const text = node.textContent;
        for (const ch of text) {
          const code = ch.charCodeAt(0);
          if (code === 92) rtf += '\\\\';
          else if (code === 123) rtf += '\\{';
          else if (code === 125) rtf += '\\}';
          else if (code > 127) rtf += '\\u' + code + '?';
          else rtf += ch;
        }
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      const cs = window.getComputedStyle(node);

      if (/^h[1-6]$/.test(tag) || tag === 'p' || tag === 'div' || tag === 'li') {
        const isBold = parseInt(cs.fontWeight, 10) >= 700;
        const isItalic = cs.fontStyle === 'italic';
        const isUl = cs.textDecorationLine && cs.textDecorationLine.includes('underline');
        const fontI = getFontIndex(cs.fontFamily);
        const sizeHp = Math.round(parseFloat(cs.fontSize) * 1.5);
        const colorI = getColorIndex(cs.color);
        const align = cs.textAlign;

        rtf += '\\pard';
        if (align === 'center') rtf += '\\qc';
        else if (align === 'right') rtf += '\\qr';
        else if (align === 'justify') rtf += '\\qj';

        rtf += '\\f' + fontI + '\\fs' + sizeHp;
        if (colorI > 0) rtf += '\\cf' + colorI;
        if (isBold) rtf += '\\b';
        if (isItalic) rtf += '\\i';
        if (isUl) rtf += '\\ul';
        rtf += ' ';

        for (const child of node.childNodes)
          processNode(child);

        rtf += '\\par\n';
        return;
      }

      if (tag === 'br') { rtf += '\\line '; return; }
      if (tag === 'hr') { rtf += '\\pard\\brdrb\\brdrs\\brdrw10 \\par\n'; return; }

      if (tag === 'table') {
        for (const tr of node.querySelectorAll('tr')) {
          const cells = tr.querySelectorAll('td, th');
          const cellWidth = 9000 / (cells.length || 1);
          let pos = 0;
          for (const cell of cells) {
            pos += cellWidth;
            rtf += '\\cellx' + Math.round(pos);
          }
          rtf += '\n';
          for (const cell of cells) {
            for (const child of cell.childNodes)
              processNode(child);
            rtf += '\\cell ';
          }
          rtf += '\\row\n';
        }
        return;
      }

      // Inline elements -- apply formatting
      if (['b', 'strong', 'i', 'em', 'u', 's', 'span', 'font', 'a', 'sub', 'sup'].includes(tag)) {
        const wasBold = parseInt(cs.fontWeight, 10) >= 700;
        const wasItalic = cs.fontStyle === 'italic';
        const wasUl = cs.textDecorationLine && cs.textDecorationLine.includes('underline');
        const wasStrike = cs.textDecorationLine && cs.textDecorationLine.includes('line-through');

        rtf += '{';
        if (wasBold) rtf += '\\b';
        if (wasItalic) rtf += '\\i';
        if (wasUl) rtf += '\\ul';
        if (wasStrike) rtf += '\\strike';
        const fi = getFontIndex(cs.fontFamily);
        const si = Math.round(parseFloat(cs.fontSize) * 1.5);
        const ci = getColorIndex(cs.color);
        rtf += '\\f' + fi + '\\fs' + si;
        if (ci > 0) rtf += '\\cf' + ci;
        rtf += ' ';
        for (const child of node.childNodes)
          processNode(child);
        rtf += '}';
        return;
      }

      // Fallback: recurse children
      for (const child of node.childNodes)
        processNode(child);
    }

    // First pass to collect fonts/colors
    for (const child of tmp.childNodes)
      processNode(child);

    document.body.removeChild(tmp);

    // Build header
    let fontTbl = '{\\fonttbl';
    for (let i = 0; i < usedFonts.length; ++i)
      fontTbl += '{\\f' + i + '\\fswiss\\fcharset0 ' + usedFonts[i] + ';}';
    fontTbl += '}';

    let colorTbl = '{\\colortbl ;';
    for (let i = 0; i < usedColors.length; ++i)
      colorTbl += '\\red' + usedColors[i][0] + '\\green' + usedColors[i][1] + '\\blue' + usedColors[i][2] + ';';
    colorTbl += '}';

    return '{\\rtf1\\ansi\\deff0\n' + fontTbl + '\n' + colorTbl + '\n' + rtf + '}';
  }

  async function doImportRtf(setEditorContent, setCurrentFile) {
    const result = await _ComDlg32.ImportFile({ accept: '.rtf', readAs: 'text' });
    if (result.cancelled) return;
    try {
      setEditorContent(rtfToHtml(result.data));
      setCurrentFile(result.name.replace(/\.rtf$/i, ''), null);
    } catch (err) {
      await _User32.MessageBox('Could not import RTF: ' + err.message, 'WordPad', MB_OK);
    }
  }

  async function doExportRtf(getEditorContent, currentFileName) {
    const html = getEditorContent();
    const rtfText = htmlToRtf(html);
    const name = (currentFileName.replace(/\.[^.]+$/, '') || 'Untitled') + '.rtf';
    _ComDlg32.ExportFile(new Blob([rtfText], { type: 'application/rtf' }), name);
  }

  WP.RtfEngine = { init, rtfToHtml, htmlToRtf, doImportRtf, doExportRtf };
})();
