;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _escapeHtml, _rgbToHex, _User32, _Kernel32, _ComDlg32;

  function init(ctx) {
    _escapeHtml = ctx.escapeHtml;
    _rgbToHex = ctx.rgbToHex;
    _User32 = ctx.User32;
    _Kernel32 = ctx.Kernel32;
    _ComDlg32 = ctx.ComDlg32;
  }

  // ═══════════════════════════════════════════════════════════════
  // DOCX Import (custom parser with mammoth.js fallback)
  // ═══════════════════════════════════════════════════════════════

  async function parseDocxDirect(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();

    // Parse relationships
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const rels = {};
    if (relsFile) {
      const relsXml = await relsFile.async('string');
      const relsDom = parser.parseFromString(relsXml, 'text/xml');
      for (const rel of relsDom.querySelectorAll('Relationship')) {
        rels[rel.getAttribute('Id')] = {
          type: rel.getAttribute('Type'),
          target: rel.getAttribute('Target'),
          mode: rel.getAttribute('TargetMode'),
        };
      }
    }

    // Extract images to data URIs
    const imageMap = {};
    for (const [rId, rel] of Object.entries(rels)) {
      if (rel.type && rel.type.includes('/image')) {
        const imgPath = 'word/' + rel.target;
        const imgFile = zip.file(imgPath);
        if (imgFile) {
          const data = await imgFile.async('base64');
          const ext = rel.target.split('.').pop().toLowerCase();
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
          imageMap[rId] = 'data:' + mime + ';base64,' + data;
        }
      }
    }

    // Parse styles
    const styleMap = {};
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      const stylesXml = await stylesFile.async('string');
      const stylesDom = parser.parseFromString(stylesXml, 'text/xml');
      for (const style of stylesDom.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'style')) {
        const id = style.getAttribute('w:styleId');
        const name = style.getElementsByTagNameNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'name')[0];
        if (id && name) styleMap[id] = name.getAttribute('w:val');
      }
    }

    // Parse numbering definitions
    const numberingFile = zip.file('word/numbering.xml');
    const numFormats = {};
    if (numberingFile) {
      const numXml = await numberingFile.async('string');
      const numDom = parser.parseFromString(numXml, 'text/xml');
      const WN = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
      for (const num of numDom.getElementsByTagNameNS(WN, 'num')) {
        const numId = num.getAttribute('w:numId');
        const absRef = num.getElementsByTagNameNS(WN, 'abstractNumId')[0];
        if (absRef) {
          const absId = absRef.getAttribute('w:val');
          const absNum = numDom.querySelector('w\\:abstractNum[w\\:abstractNumId="' + absId + '"], abstractNum[abstractNumId="' + absId + '"]');
          if (absNum) {
            const lvl0 = absNum.querySelector('w\\:lvl[w\\:ilvl="0"], lvl[ilvl="0"]');
            if (lvl0) {
              const fmt = lvl0.getElementsByTagNameNS(WN, 'numFmt')[0];
              numFormats[numId] = fmt ? fmt.getAttribute('w:val') : 'decimal';
            }
          }
        }
      }
    }

    // Parse document.xml
    const docFile = zip.file('word/document.xml');
    if (!docFile) throw new Error('No document.xml found');
    const docXml = await docFile.async('string');
    const docDom = parser.parseFromString(docXml, 'text/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    function getW(el, localName) {
      return el.getElementsByTagNameNS(W, localName);
    }

    function getWFirst(el, localName) {
      const list = el.getElementsByTagNameNS(W, localName);
      return list.length > 0 ? list[0] : null;
    }

    function wAttr(el, attr) {
      return el ? el.getAttribute('w:' + attr) : null;
    }

    function parseRunProperties(rPr) {
      const style = {};
      if (!rPr) return style;
      if (getWFirst(rPr, 'b')) style.bold = true;
      if (getWFirst(rPr, 'i')) style.italic = true;
      const u = getWFirst(rPr, 'u');
      if (u && wAttr(u, 'val') !== 'none') style.underline = true;
      if (getWFirst(rPr, 'strike')) style.strikethrough = true;
      const sz = getWFirst(rPr, 'sz');
      if (sz) style.fontSize = Math.round(parseInt(wAttr(sz, 'val'), 10) / 2);
      const color = getWFirst(rPr, 'color');
      if (color) style.color = '#' + wAttr(color, 'val');
      const fonts = getWFirst(rPr, 'rFonts');
      if (fonts) style.fontFamily = wAttr(fonts, 'ascii') || wAttr(fonts, 'hAnsi');
      const vAlign = getWFirst(rPr, 'vertAlign');
      if (vAlign) style.vertAlign = wAttr(vAlign, 'val');
      const highlight = getWFirst(rPr, 'highlight');
      if (highlight) style.highlight = wAttr(highlight, 'val');
      return style;
    }

    function styleToCSS(style) {
      let css = '';
      if (style.bold) css += 'font-weight:bold;';
      if (style.italic) css += 'font-style:italic;';
      if (style.underline) css += 'text-decoration:underline;';
      if (style.strikethrough) css += 'text-decoration:line-through;';
      if (style.fontSize) css += 'font-size:' + style.fontSize + 'pt;';
      if (style.color && style.color !== '#000000') css += 'color:' + style.color + ';';
      if (style.fontFamily) css += 'font-family:' + style.fontFamily + ';';
      if (style.highlight) css += 'background-color:yellow;';
      return css;
    }

    function convertRun(run) {
      const rPr = getWFirst(run, 'rPr');
      const style = parseRunProperties(rPr);
      let html = '';

      for (const child of run.childNodes) {
        if (child.localName === 't' && child.namespaceURI === W)
          html += _escapeHtml(child.textContent || '');
        else if (child.localName === 'br' && child.namespaceURI === W) {
          const type = child.getAttribute('w:type');
          if (type === 'page') html += '<div class="wp-page-break"></div>';
          else html += '<br>';
        } else if (child.localName === 'tab' && child.namespaceURI === W)
          html += '&emsp;';
        else if (child.localName === 'drawing') {
          // Extract image from drawing
          const blip = child.querySelector('blip');
          if (blip) {
            const embedId = blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
            if (embedId && imageMap[embedId]) {
              const extent = child.querySelector('extent');
              let w = 200, h = 200;
              if (extent) {
                w = Math.round(parseInt(extent.getAttribute('cx'), 10) / 9525) || 200;
                h = Math.round(parseInt(extent.getAttribute('cy'), 10) / 9525) || 200;
              }
              html += '<img src="' + imageMap[embedId] + '" width="' + w + '" height="' + h + '">';
            }
          }
        }
      }

      const css = styleToCSS(style);
      if (style.vertAlign === 'subscript')
        return '<sub' + (css ? ' style="' + css + '"' : '') + '>' + html + '</sub>';
      if (style.vertAlign === 'superscript')
        return '<sup' + (css ? ' style="' + css + '"' : '') + '>' + html + '</sup>';
      if (css)
        return '<span style="' + css + '">' + html + '</span>';
      return html;
    }

    function convertParagraph(p) {
      const pPr = getWFirst(p, 'pPr');
      let tag = 'p';
      let listInfo = null;

      if (pPr) {
        const pStyleEl = getWFirst(pPr, 'pStyle');
        if (pStyleEl) {
          const styleId = wAttr(pStyleEl, 'val');
          if (/^Heading(\d)$/i.test(styleId)) {
            const level = parseInt(RegExp.$1, 10);
            tag = 'h' + Math.min(level, 6);
          }
        }

        // List detection
        const numPr = getWFirst(pPr, 'numPr');
        if (numPr) {
          const ilvl = getWFirst(numPr, 'ilvl');
          const numId = getWFirst(numPr, 'numId');
          listInfo = {
            level: ilvl ? parseInt(wAttr(ilvl, 'val'), 10) : 0,
            numId: numId ? wAttr(numId, 'val') : '1',
          };
        }
      }

      // Build inline content
      let content = '';
      let inField = false;
      let fieldInstr = '';
      let fieldContent = '';
      for (const child of p.childNodes) {
        if (child.localName === 'r' && child.namespaceURI === W) {
          // Check for fldChar
          const fldChar = getWFirst(child, 'fldChar');
          if (fldChar) {
            const fldType = wAttr(fldChar, 'fldCharType');
            if (fldType === 'begin') {
              inField = true;
              fieldInstr = '';
              fieldContent = '';
            } else if (fldType === 'separate') {
              // Content follows
            } else if (fldType === 'end') {
              // Build field span
              const parts = fieldInstr.trim().split(/\s+/);
              const fieldType = parts[0] || 'UNKNOWN';
              const fieldParam = parts.slice(1).join(' ');
              content += '<span class="wp-field" data-field-type="' + _escapeHtml(fieldType) + '"'
                + (fieldParam ? ' data-field-param="' + _escapeHtml(fieldParam) + '"' : '')
                + ' contenteditable="false">' + (fieldContent || _escapeHtml(fieldInstr.trim())) + '</span>';
              inField = false;
            }
            continue;
          }

          // Check for instrText
          const instrText = getWFirst(child, 'instrText');
          if (instrText && inField) {
            fieldInstr += instrText.textContent || '';
            continue;
          }

          if (inField) {
            // This is the display content of a field
            const t = getWFirst(child, 't');
            if (t) fieldContent += t.textContent || '';
            continue;
          }

          content += convertRun(child);
        } else if (child.localName === 'fldSimple') {
          // Simple field
          const instr = child.getAttribute('w:instr') || '';
          const parts = instr.trim().split(/\s+/);
          const fieldType = parts[0] || 'UNKNOWN';
          const fieldParam = parts.slice(1).join(' ');
          let fieldText = '';
          for (const r of child.childNodes)
            if (r.localName === 'r' && r.namespaceURI === W) fieldText += convertRun(r);
          content += '<span class="wp-field" data-field-type="' + _escapeHtml(fieldType) + '"'
            + (fieldParam ? ' data-field-param="' + _escapeHtml(fieldParam) + '"' : '')
            + ' contenteditable="false">' + (fieldText || _escapeHtml(instr.trim())) + '</span>';
        } else if (child.localName === 'hyperlink') {
          const rId = child.getAttribute('r:id') || child.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
          const rel = rId ? rels[rId] : null;
          const href = rel ? rel.target : '#';
          let linkContent = '';
          for (const r of child.childNodes)
            if (r.localName === 'r' && r.namespaceURI === W) linkContent += convertRun(r);
          content += '<a href="' + _escapeHtml(href) + '">' + (linkContent || _escapeHtml(href)) + '</a>';
        }
      }

      // Build alignment style and data attributes
      let alignStyle = '';
      let extraAttrs = '';
      let extraStyles = '';
      if (pPr) {
        const jc = getWFirst(pPr, 'jc');
        if (jc) {
          const val = wAttr(jc, 'val');
          if (val === 'center') alignStyle = 'text-align:center;';
          else if (val === 'right') alignStyle = 'text-align:right;';
          else if (val === 'both') alignStyle = 'text-align:justify;';
        }

        // Paragraph flow controls
        if (getWFirst(pPr, 'keepNext')) {
          extraAttrs += ' data-keep-with-next="true"';
          extraStyles += 'break-after:avoid;';
        }
        if (getWFirst(pPr, 'keepLines')) {
          extraAttrs += ' data-keep-together="true"';
          extraStyles += 'break-inside:avoid;';
        }
        if (getWFirst(pPr, 'pageBreakBefore')) {
          extraAttrs += ' data-page-break-before="true"';
          extraStyles += 'break-before:page;';
        }
        if (getWFirst(pPr, 'widowControl')) {
          extraAttrs += ' data-widow-orphan="true"';
          extraStyles += 'orphans:2;widows:2;';
        }

        // Tab stops
        const tabs = getWFirst(pPr, 'tabs');
        if (tabs) {
          const tabEls = getW(tabs, 'tab');
          if (tabEls.length) {
            const tabStops = [];
            for (const tabEl of tabEls) {
              const pos = parseInt(wAttr(tabEl, 'pos'), 10) || 0;
              const tabType = wAttr(tabEl, 'val') || 'left';
              const leader = wAttr(tabEl, 'leader') || 'none';
              // Convert twips to percentage of page width (9360 twips = 100%)
              const posPercent = Math.round((pos / 9360) * 1000) / 10;
              const leaderMap = { dot: 'dots', hyphen: 'dashes', underscore: 'underline' };
              const leaderValue = leaderMap[leader] || 'none';
              tabStops.push({ position: posPercent, type: tabType, leader: leaderValue });
            }
            extraAttrs += ' data-tab-stops=\'' + JSON.stringify(tabStops).replace(/'/g, '&#39;') + '\'';
          }
        }
      }

      const combinedStyle = alignStyle + extraStyles;

      if (listInfo) {
        const isOrdered = numFormats[listInfo.numId] !== 'bullet';
        const listTag = isOrdered ? 'ol' : 'ul';
        return { type: 'list', tag: listTag, level: listInfo.level, content: '<li' + (combinedStyle ? ' style="' + combinedStyle + '"' : '') + extraAttrs + '>' + (content || '<br>') + '</li>' };
      }

      return { type: 'block', html: '<' + tag + (combinedStyle ? ' style="' + combinedStyle + '"' : '') + extraAttrs + '>' + (content || '<br>') + '</' + tag + '>' };
    }

    function convertTable(tbl) {
      let tableClasses = '';
      const tblPr = getWFirst(tbl, 'tblPr');
      if (tblPr) {
        const tblStyle = getWFirst(tblPr, 'tblStyle');
        if (tblStyle) {
          const styleName = wAttr(tblStyle, 'val') || '';
          if (styleName.toLowerCase().includes('banded'))
            tableClasses += ' wp-table-banded';
        }
        const tblLook = getWFirst(tblPr, 'tblLook');
        if (tblLook && wAttr(tblLook, 'firstRow') === '1')
          tableClasses += ' wp-table-header-row';
      }
      let html = '<table' + (tableClasses ? ' class="' + tableClasses.trim() + '"' : '') + '>';
      for (const tr of getW(tbl, 'tr')) {
        const trPr = getWFirst(tr, 'trPr');
        let trAttrs = '';
        if (trPr && getWFirst(trPr, 'tblHeader'))
          trAttrs += ' data-repeat-header="true"';
        html += '<tr' + trAttrs + '>';
        for (const tc of getW(tr, 'tc')) {
          const tcPr = getWFirst(tc, 'tcPr');
          let tdAttrs = '';
          let tdStyle = '';
          if (tcPr) {
            const gridSpan = getWFirst(tcPr, 'gridSpan');
            if (gridSpan) tdAttrs += ' colspan="' + wAttr(gridSpan, 'val') + '"';
            const vMerge = getWFirst(tcPr, 'vMerge');
            if (vMerge && wAttr(vMerge, 'val') === 'restart') tdAttrs += ' rowspan="2"';
            const shd = getWFirst(tcPr, 'shd');
            if (shd) {
              const fill = wAttr(shd, 'fill');
              if (fill && fill !== 'auto') tdStyle += 'background-color:#' + fill + ';';
            }
          }
          html += '<td' + tdAttrs + (tdStyle ? ' style="' + tdStyle + '"' : '') + '>';
          for (const p of getW(tc, 'p')) {
            const result = convertParagraph(p);
            html += result.type === 'list' ? result.content : result.html;
          }
          html += '</td>';
        }
        html += '</tr>';
      }
      html += '</table>';
      return html;
    }

    // Process body
    const body = docDom.getElementsByTagNameNS(W, 'body')[0];
    if (!body) return '<p><br></p>';

    let html = '';
    let currentList = null;

    for (const child of body.childNodes) {
      if (child.localName === 'p' && child.namespaceURI === W) {
        const result = convertParagraph(child);
        if (result.type === 'list') {
          if (!currentList || currentList.tag !== result.tag) {
            if (currentList) html += '</' + currentList.tag + '>';
            html += '<' + result.tag + '>';
            currentList = { tag: result.tag };
          }
          html += result.content;
        } else {
          if (currentList) {
            html += '</' + currentList.tag + '>';
            currentList = null;
          }
          html += result.html;
        }
      } else if (child.localName === 'tbl' && child.namespaceURI === W) {
        if (currentList) {
          html += '</' + currentList.tag + '>';
          currentList = null;
        }
        html += convertTable(child);
      }
    }

    if (currentList) html += '</' + currentList.tag + '>';

    // Parse header
    for (const [rId, rel] of Object.entries(rels)) {
      if (rel.type && rel.type.includes('/header')) {
        const hdrFile = zip.file('word/' + rel.target);
        if (hdrFile) {
          const hdrXml = await hdrFile.async('string');
          const hdrDom = parser.parseFromString(hdrXml, 'text/xml');
          let headerText = '';
          for (const p of hdrDom.getElementsByTagNameNS(W, 'p'))
            for (const r of p.getElementsByTagNameNS(W, 'r'))
              for (const t of r.getElementsByTagNameNS(W, 't'))
                headerText += t.textContent;
          if (headerText)
            html = '<div class="wp-header" contenteditable="true">' + _escapeHtml(headerText) + '</div>' + html;
        }
      }
    }

    // Parse footer
    for (const [rId, rel] of Object.entries(rels)) {
      if (rel.type && rel.type.includes('/footer')) {
        const ftrFile = zip.file('word/' + rel.target);
        if (ftrFile) {
          const ftrXml = await ftrFile.async('string');
          const ftrDom = parser.parseFromString(ftrXml, 'text/xml');
          let footerText = '';
          for (const p of ftrDom.getElementsByTagNameNS(W, 'p'))
            for (const r of p.getElementsByTagNameNS(W, 'r'))
              for (const t of r.getElementsByTagNameNS(W, 't'))
                footerText += t.textContent;
          if (footerText)
            html += '<div class="wp-footer" contenteditable="true">' + _escapeHtml(footerText) + '</div>';
        }
      }
    }

    // Parse endnotes
    const endnotesFile = zip.file('word/endnotes.xml');
    if (endnotesFile) {
      const enXml = await endnotesFile.async('string');
      const enDom = parser.parseFromString(enXml, 'text/xml');
      const endnotes = enDom.getElementsByTagNameNS(W, 'endnote');
      let hasEndnotes = false;
      let endnotesHtml = '<div class="wp-endnotes-section" contenteditable="true">';
      let enNum = 0;
      for (const en of endnotes) {
        const enType = en.getAttribute('w:type');
        if (enType === 'separator' || enType === 'continuationSeparator')
          continue;
        ++enNum;
        hasEndnotes = true;
        const enId = en.getAttribute('w:id') || enNum;
        let enText = '';
        for (const p of en.getElementsByTagNameNS(W, 'p'))
          for (const r of p.getElementsByTagNameNS(W, 'r'))
            for (const t of r.getElementsByTagNameNS(W, 't'))
              enText += t.textContent;
        endnotesHtml += '<div class="wp-endnote" id="wp-en-' + enId + '">'
          + '<span class="wp-endnote-num">' + enNum + '.</span>'
          + '<span class="wp-endnote-text" contenteditable="true">' + _escapeHtml(enText.trim()) + '</span></div>';
      }
      endnotesHtml += '</div>';
      if (hasEndnotes) html += endnotesHtml;
    }

    return html || '<p><br></p>';
  }

  // ═══════════════════════════════════════════════════════════════
  // DOCX Export (via JSZip -- enhanced OOXML)
  // ═══════════════════════════════════════════════════════════════

  function buildDocxPackage(html) {
    const zip = new JSZip();
    const images = [];
    const hyperlinks = [];
    let rIdCounter = 2; // rId1 is styles.xml
    let imageCounter = 0;

    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.style.position = 'absolute';
    tmp.style.left = '-9999px';
    document.body.appendChild(tmp);

    function escXml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function buildRunProperties(el) {
      let rPr = '';
      if (!el || el.nodeType !== 1) return rPr;
      const cs = window.getComputedStyle(el);
      if (parseInt(cs.fontWeight, 10) >= 700 || cs.fontWeight === 'bold') rPr += '<w:b/>';
      if (cs.fontStyle === 'italic') rPr += '<w:i/>';
      if (cs.textDecorationLine && cs.textDecorationLine.includes('underline')) rPr += '<w:u w:val="single"/>';
      if (cs.textDecorationLine && cs.textDecorationLine.includes('line-through')) rPr += '<w:strike/>';
      if (cs.verticalAlign === 'sub') rPr += '<w:vertAlign w:val="subscript"/>';
      if (cs.verticalAlign === 'super') rPr += '<w:vertAlign w:val="superscript"/>';
      const ff = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (ff) rPr += '<w:rFonts w:ascii="' + escXml(ff) + '" w:hAnsi="' + escXml(ff) + '"/>';
      const px = parseFloat(cs.fontSize);
      if (px) rPr += '<w:sz w:val="' + Math.round(px * 1.5) + '"/>';
      const color = _rgbToHex(cs.color);
      if (color && color !== '#000000') rPr += '<w:color w:val="' + color.slice(1) + '"/>';
      const bgColor = _rgbToHex(cs.backgroundColor);
      if (bgColor && bgColor !== '#ffffff' && cs.backgroundColor !== 'transparent' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)')
        rPr += '<w:highlight w:val="yellow"/>';
      return rPr;
    }

    function buildParagraphProperties(el) {
      let pPr = '';
      if (!el || el.nodeType !== 1) return pPr;
      const cs = window.getComputedStyle(el);
      const tag = el.tagName.toLowerCase();

      // Heading style
      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1], 10);
        pPr += '<w:pStyle w:val="Heading' + Math.min(level, 6) + '"/>';
      }

      // Alignment
      const align = cs.textAlign;
      if (align === 'center') pPr += '<w:jc w:val="center"/>';
      else if (align === 'right') pPr += '<w:jc w:val="right"/>';
      else if (align === 'justify') pPr += '<w:jc w:val="both"/>';

      // Spacing
      const marginTop = parseFloat(cs.marginTop) || 0;
      const marginBottom = parseFloat(cs.marginBottom) || 0;
      if (marginTop > 0 || marginBottom > 0) {
        const before = Math.round(marginTop * 15); // px to twips approx
        const after = Math.round(marginBottom * 15);
        pPr += '<w:spacing w:before="' + before + '" w:after="' + after + '"/>';
      }

      // Line height
      const lineHeight = parseFloat(cs.lineHeight);
      const fontSize = parseFloat(cs.fontSize);
      if (lineHeight && fontSize && lineHeight / fontSize > 1.2) {
        const spacing = Math.round((lineHeight / fontSize) * 240);
        pPr += '<w:spacing w:line="' + spacing + '" w:lineRule="auto"/>';
      }

      // Text indent
      const textIndent = parseFloat(cs.textIndent) || 0;
      if (textIndent > 0)
        pPr += '<w:ind w:firstLine="' + Math.round(textIndent * 15) + '"/>';

      // Paragraph flow controls
      if (el.hasAttribute('data-keep-with-next'))
        pPr += '<w:keepNext/>';
      if (el.hasAttribute('data-keep-together'))
        pPr += '<w:keepLines/>';
      if (el.hasAttribute('data-page-break-before'))
        pPr += '<w:pageBreakBefore/>';
      if (el.hasAttribute('data-widow-orphan'))
        pPr += '<w:widowControl/>';

      // Tab stops
      const tabStopsAttr = el.getAttribute('data-tab-stops');
      if (tabStopsAttr) {
        try {
          const tabStops = JSON.parse(tabStopsAttr);
          if (tabStops.length) {
            pPr += '<w:tabs>';
            for (const ts of tabStops) {
              const positionTwips = Math.round((ts.position / 100) * 9360); // percentage of page width to twips
              const tabType = ts.type === 'center' ? 'center' : ts.type === 'right' ? 'right' : ts.type === 'decimal' ? 'decimal' : 'left';
              let leaderAttr = '';
              if (ts.leader && ts.leader !== 'none') {
                const leaderMap = { dots: 'dot', dashes: 'hyphen', underline: 'underscore' };
                leaderAttr = ' w:leader="' + (leaderMap[ts.leader] || 'none') + '"';
              }
              pPr += '<w:tab w:val="' + tabType + '" w:pos="' + positionTwips + '"' + leaderAttr + '/>';
            }
            pPr += '</w:tabs>';
          }
        } catch (ex) { /* ignore */ }
      }

      return pPr;
    }

    function processInlineElement(node) {
      if (node.nodeType === 3) {
        const text = node.textContent;
        if (!text) return '';
        return '<w:r><w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r>';
      }
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();

      if (tag === 'br') return '<w:r><w:br/></w:r>';

      // Images
      if (tag === 'img') return processImage(node);

      // Hyperlinks
      if (tag === 'a' && node.href) return processHyperlink(node);

      // Bookmarks
      if (tag === 'a' && node.id && !node.href) return processBookmark(node);

      // Field codes
      if (node.classList.contains('wp-field')) {
        const fieldType = node.getAttribute('data-field-type') || '';
        const fieldParam = node.getAttribute('data-field-param') || '';
        let instrText = fieldType;
        if (fieldParam) instrText += ' ' + fieldParam;
        return '<w:r><w:rPr><w:noProof/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>'
          + '<w:r><w:instrText xml:space="preserve"> ' + escXml(instrText) + ' </w:instrText></w:r>'
          + '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
          + '<w:r><w:t>' + escXml(node.textContent || '') + '</w:t></w:r>'
          + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
      }

      // Endnote references
      if (node.classList.contains('wp-endnote-ref')) {
        const enId = parseInt(node.dataset.endnoteId, 10) || 1;
        return '<w:r><w:rPr><w:rStyle w:val="EndnoteReference"/></w:rPr><w:endnoteReference w:id="' + enId + '"/></w:r>';
      }

      const rPr = buildRunProperties(node);
      let runs = '';
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          const text = child.textContent;
          if (text)
            runs += '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r>';
        } else
          runs += processInlineElement(child);
      }
      return runs;
    }

    function processImage(img) {
      const src = img.getAttribute('src') || '';
      const width = img.width || img.naturalWidth || 200;
      const height = img.height || img.naturalHeight || 200;
      const emuW = width * 9525;
      const emuH = height * 9525;
      const rId = 'rId' + (++rIdCounter);
      ++imageCounter;
      const imgName = 'image' + imageCounter;
      let ext = 'png';
      let imgData = null;

      if (src.startsWith('data:')) {
        const match = src.match(/^data:image\/([^;]+);base64,(.+)$/);
        if (match) {
          ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          imgData = match[2];
        }
      }

      if (imgData) {
        const fileName = imgName + '.' + ext;
        zip.file('word/media/' + fileName, imgData, { base64: true });
        images.push({ rId, target: 'media/' + fileName, ext });
      }

      const wrapAttr = img.getAttribute('data-wrap') || 'inline';

      if (wrapAttr === 'inline' || !imgData) {
        return '<w:r><w:drawing>'
          + '<wp:inline distT="0" distB="0" distL="0" distR="0">'
          + '<wp:extent cx="' + emuW + '" cy="' + emuH + '"/>'
          + '<wp:docPr id="' + imageCounter + '" name="' + escXml(imgName) + '"/>'
          + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
          + '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
          + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
          + '<pic:nvPicPr><pic:cNvPr id="' + imageCounter + '" name="' + escXml(imgName) + '"/><pic:cNvPicPr/></pic:nvPicPr>'
          + '<pic:blipFill><a:blip r:embed="' + rId + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
          + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + emuW + '" cy="' + emuH + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
          + '</pic:pic>'
          + '</a:graphicData></a:graphic>'
          + '</wp:inline>'
          + '</w:drawing></w:r>';
      }

      // Anchored image for text wrapping
      let wrapElement = '<wp:wrapSquare wrapText="bothSides"/>';
      if (wrapAttr === 'tight') wrapElement = '<wp:wrapTight wrapText="bothSides"/>';
      else if (wrapAttr === 'behind' || wrapAttr === 'front') wrapElement = '<wp:wrapNone/>';

      return '<w:r><w:drawing>'
        + '<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="' + (wrapAttr === 'behind' ? '0' : '251658240') + '" behindDoc="' + (wrapAttr === 'behind' ? '1' : '0') + '" locked="0" layoutInCell="1" allowOverlap="1">'
        + '<wp:simplePos x="0" y="0"/>'
        + '<wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>'
        + '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>'
        + '<wp:extent cx="' + emuW + '" cy="' + emuH + '"/>'
        + '<wp:effectExtent l="0" t="0" r="0" b="0"/>'
        + wrapElement
        + '<wp:docPr id="' + imageCounter + '" name="' + escXml(imgName) + '"/>'
        + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        + '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        + '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'
        + '<pic:nvPicPr><pic:cNvPr id="' + imageCounter + '" name="' + escXml(imgName) + '"/><pic:cNvPicPr/></pic:nvPicPr>'
        + '<pic:blipFill><a:blip r:embed="' + rId + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
        + '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + emuW + '" cy="' + emuH + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>'
        + '</pic:pic>'
        + '</a:graphicData></a:graphic>'
        + '</wp:anchor>'
        + '</w:drawing></w:r>';
    }

    function processHyperlink(a) {
      const rId = 'rId' + (++rIdCounter);
      hyperlinks.push({ rId, target: a.href });
      let runs = '';
      for (const child of a.childNodes)
        runs += processInlineElement(child);
      if (!runs) {
        const text = a.textContent || a.href;
        runs = '<w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>' + escXml(text) + '</w:t></w:r>';
      }
      return '<w:hyperlink r:id="' + rId + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + runs + '</w:hyperlink>';
    }

    function processBookmark(a) {
      const id = images.length + hyperlinks.length + 1;
      const name = a.id || a.name || '';
      return '<w:bookmarkStart w:id="' + id + '" w:name="' + escXml(name) + '"/><w:bookmarkEnd w:id="' + id + '"/>';
    }

    function processTable(table) {
      let tblPrExtra = '';
      if (table.classList.contains('wp-table-banded'))
        tblPrExtra += '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>';

      // Table width
      const tableWidth = parseInt(table.style.width, 10);
      const tblW = tableWidth && tableWidth < 100
        ? '<w:tblW w:w="' + Math.round(tableWidth * 50) + '" w:type="pct"/>'
        : '<w:tblW w:w="0" w:type="auto"/>';

      let xml = '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>' + tblW + '<w:tblBorders>'
        + '<w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        + '<w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        + '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        + '<w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        + '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        + '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>'
        + '</w:tblBorders>' + tblPrExtra + '</w:tblPr>';

      // Calculate grid columns
      const firstRow = table.querySelector('tr');
      if (firstRow) {
        const cellCount = firstRow.cells.length;
        xml += '<w:tblGrid>';
        for (let i = 0; i < cellCount; ++i)
          xml += '<w:gridCol w:w="' + Math.round(9000 / cellCount) + '"/>';
        xml += '</w:tblGrid>';
      }

      for (const tr of table.querySelectorAll('tr')) {
        let trPr = '';
        if (tr.hasAttribute('data-repeat-header'))
          trPr += '<w:tblHeader/>';
        xml += '<w:tr>' + (trPr ? '<w:trPr>' + trPr + '</w:trPr>' : '');
        for (const cell of tr.querySelectorAll('td, th')) {
          let tcPr = '';
          const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
          if (colspan > 1) tcPr += '<w:gridSpan w:val="' + colspan + '"/>';
          const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
          if (rowspan > 1) tcPr += '<w:vMerge w:val="restart"/>';
          const bg = cell.style.backgroundColor;
          if (bg && bg !== 'transparent') {
            const hex = _rgbToHex(bg);
            if (hex) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + hex.slice(1) + '"/>';
          }
          xml += '<w:tc>' + (tcPr ? '<w:tcPr>' + tcPr + '</w:tcPr>' : '');
          // Process cell content as paragraphs
          const blocks = cell.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
          if (blocks.length > 0) {
            for (const block of blocks) {
              const pPr = buildParagraphProperties(block);
              xml += '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '');
              for (const child of block.childNodes)
                xml += processInlineElement(child);
              xml += '</w:p>';
            }
          } else {
            xml += '<w:p>';
            for (const child of cell.childNodes)
              xml += processInlineElement(child);
            xml += '</w:p>';
          }
          xml += '</w:tc>';
        }
        xml += '</w:tr>';
      }
      xml += '</w:tbl>';
      return xml;
    }

    function getListNumId(list, isOrdered) {
      if (!isOrdered) return 1; // bullet
      // Check for multilevel outline numbering
      if (list && list.classList.contains('wp-multilevel')) return 3;
      // Check for custom list-style-type
      const styleType = list ? list.style.listStyleType : '';
      if (styleType === 'upper-alpha') return 4;
      if (styleType === 'lower-alpha') return 5;
      if (styleType === 'upper-roman') return 6;
      if (styleType === 'lower-roman') return 7;
      return 2; // default ordered (decimal)
    }

    function processListItem(li, isOrdered, level) {
      const list = li.closest('ol, ul');
      const numId = getListNumId(list, isOrdered);
      const pPr = '<w:numPr><w:ilvl w:val="' + level + '"/><w:numId w:val="' + numId + '"/></w:numPr>';
      let xml = '<w:p><w:pPr>' + pPr + '</w:pPr>';
      for (const child of li.childNodes) {
        if (child.nodeType === 1 && (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol'))
          continue;
        xml += processInlineElement(child);
      }
      xml += '</w:p>';
      // Process nested lists
      for (const child of li.children) {
        const childTag = child.tagName.toLowerCase();
        if (childTag === 'ul' || childTag === 'ol') {
          for (const subLi of child.children) {
            if (subLi.tagName.toLowerCase() === 'li')
              xml += processListItem(subLi, childTag === 'ol', level + 1);
          }
        }
      }
      return xml;
    }

    function processPageBreak() {
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }

    function processBlockElement(node) {
      if (node.nodeType === 3) {
        const text = node.textContent.trim();
        if (!text) return '';
        return '<w:p><w:r><w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r></w:p>';
      }
      if (node.nodeType !== 1) return '';
      const tag = node.tagName.toLowerCase();

      // Skip non-content elements
      if (node.classList.contains('watermark')) return '';

      // Page break
      if (node.classList.contains('wp-page-break')) return processPageBreak();

      // Header/footer handled separately
      if (node.classList.contains('wp-header') || node.classList.contains('wp-footer')) return '';

      // Headings
      if (/^h[1-6]$/.test(tag)) {
        const pPr = buildParagraphProperties(node);
        return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + processInlineElement(node) + '</w:p>';
      }

      // Paragraphs
      if (tag === 'p' || tag === 'div') {
        const pPr = buildParagraphProperties(node);
        let content = '';
        for (const child of node.childNodes)
          content += processInlineElement(child);
        return '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + content + '</w:p>';
      }

      // Lists
      if (tag === 'ul' || tag === 'ol') {
        let xml = '';
        for (const li of node.children) {
          if (li.tagName && li.tagName.toLowerCase() === 'li')
            xml += processListItem(li, tag === 'ol', 0);
        }
        return xml;
      }

      // Tables
      if (tag === 'table') return processTable(node);

      // Horizontal rule
      if (tag === 'hr')
        return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';

      // Blockquote
      if (tag === 'blockquote') {
        let xml = '';
        for (const child of node.childNodes) {
          if (child.nodeType === 1 && (child.tagName.toLowerCase() === 'p' || child.tagName.toLowerCase() === 'div')) {
            const pPr = buildParagraphProperties(child);
            xml += '<w:p><w:pPr><w:ind w:left="720"/>' + pPr + '</w:pPr>';
            for (const c of child.childNodes)
              xml += processInlineElement(c);
            xml += '</w:p>';
          } else {
            xml += '<w:p><w:pPr><w:ind w:left="720"/></w:pPr>';
            xml += processInlineElement(child);
            xml += '</w:p>';
          }
        }
        return xml;
      }

      // Pre/code
      if (tag === 'pre') {
        const pPr = '<w:pStyle w:val="Code"/>';
        const text = node.textContent || '';
        const lines = text.split('\n');
        let xml = '';
        for (const line of lines)
          xml += '<w:p><w:pPr>' + pPr + '</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">' + escXml(line) + '</w:t></w:r></w:p>';
        return xml;
      }

      // Fallback: recurse children
      let xml = '';
      for (const child of node.childNodes)
        xml += processBlockElement(child);
      return xml;
    }

    // --- Build document body ---
    let body = '';
    for (const child of tmp.childNodes)
      body += processBlockElement(child);

    document.body.removeChild(tmp);

    if (!body) body = '<w:p/>';

    // --- Build header/footer XML if present ---
    const headerEl = document.querySelector('#editor .wp-header');
    const footerEl = document.querySelector('#editor .wp-footer');
    let headerXml = '';
    let footerXml = '';
    let headerRId = '';
    let footerRId = '';

    if (headerEl) {
      headerRId = 'rId' + (++rIdCounter);
      headerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + '<w:p><w:r><w:t>' + escXml(headerEl.textContent || '') + '</w:t></w:r></w:p>'
        + '</w:hdr>';
      zip.file('word/header1.xml', headerXml);
    }

    if (footerEl) {
      footerRId = 'rId' + (++rIdCounter);
      footerXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + '<w:p><w:r><w:t>' + escXml(footerEl.textContent || '') + '</w:t></w:r></w:p>'
        + '</w:ftr>';
      zip.file('word/footer1.xml', footerXml);
    }

    // --- Build endnotes.xml if present ---
    const endnoteEls = document.querySelectorAll('#editor .wp-endnotes-section .wp-endnote');
    let endnotesXml = '';
    let endnotesRId = '';
    if (endnoteEls.length) {
      endnotesRId = 'rId' + (++rIdCounter);
      let enBody = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        + '<w:endnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:endnote>'
        + '<w:endnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:endnote>';

      let enId = 1;
      for (const en of endnoteEls) {
        const textEl = en.querySelector('.wp-endnote-text');
        const text = textEl ? textEl.textContent : '';
        enBody += '<w:endnote w:id="' + enId + '"><w:p><w:pPr><w:pStyle w:val="EndnoteText"/></w:pPr>'
          + '<w:r><w:rPr><w:rStyle w:val="EndnoteReference"/></w:rPr><w:endnoteRef/></w:r>'
          + '<w:r><w:t xml:space="preserve"> ' + escXml(text) + '</w:t></w:r></w:p></w:endnote>';
        ++enId;
      }
      enBody += '</w:endnotes>';
      endnotesXml = enBody;
      zip.file('word/endnotes.xml', endnotesXml);
    }

    // --- Build comments.xml if comments exist ---
    const commentSpans = document.querySelectorAll('#editor .wp-comment-range');
    let commentsXml = '';
    let commentsRId = '';
    if (commentSpans.length) {
      commentsRId = 'rId' + (++rIdCounter);
      let cmBody = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">';
      // Gather comment data from the CommentsTracking module if available
      const commentStore = (WP.CommentsTracking && WP.CommentsTracking._getCommentStore)
        ? WP.CommentsTracking._getCommentStore()
        : null;
      if (commentStore) {
        for (const comment of commentStore.comments) {
          const initials = comment.author ? comment.author.slice(0, 2).toUpperCase() : 'US';
          let parentAttr = '';
          if (comment.parentId)
            parentAttr = ' w15:paraIdParent="' + comment.parentId + '"';
          cmBody += '<w:comment w:id="' + comment.id + '" w:author="' + escXml(comment.author || 'User') + '"'
            + ' w:date="' + escXml(comment.timestamp || new Date().toISOString()) + '"'
            + ' w:initials="' + escXml(initials) + '"' + parentAttr + '>'
            + '<w:p><w:r><w:t>' + escXml(comment.text || '') + '</w:t></w:r></w:p>'
            + '</w:comment>';
        }
      } else {
        // Fallback: export from DOM only
        let cmId = 1;
        for (const span of commentSpans) {
          cmBody += '<w:comment w:id="' + cmId + '" w:author="User" w:date="' + new Date().toISOString() + '">'
            + '<w:p><w:r><w:t>' + escXml(span.textContent || '') + '</w:t></w:r></w:p>'
            + '</w:comment>';
          ++cmId;
        }
      }
      cmBody += '</w:comments>';
      commentsXml = cmBody;
      zip.file('word/comments.xml', commentsXml);
    }

    // --- Build docProps/core.xml ---
    const now = new Date().toISOString();
    const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
      + ' xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"'
      + ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + now + '</dcterms:modified>'
      + '<dc:creator>WordPad</dc:creator>'
      + '</cp:coreProperties>';
    zip.file('docProps/core.xml', coreXml);

    // --- Build numbering.xml for lists ---
    const numberingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      // abstractNum 0 = Bullet list (3 levels)
      + '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#61623;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#61607;"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      // abstractNum 1 = Ordered list (decimal/alpha/roman, 3 levels)
      + '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%3."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      // abstractNum 2 = Outline numbering (1, 1.1, 1.1.1)
      + '<w:abstractNum w:abstractNumId="2">'
      + '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="792" w:hanging="432"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2.%3"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1224" w:hanging="504"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="3"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2.%3.%4"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="1728" w:hanging="648"/></w:pPr></w:lvl>'
      + '<w:lvl w:ilvl="4"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2.%3.%4.%5"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="2232" w:hanging="792"/></w:pPr></w:lvl>'
      + '</w:abstractNum>'
      // abstractNum 3 = Upper Alpha (A, B, C)
      + '<w:abstractNum w:abstractNumId="3"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      // abstractNum 4 = Lower Alpha (a, b, c)
      + '<w:abstractNum w:abstractNumId="4"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      // abstractNum 5 = Upper Roman (I, II, III)
      + '<w:abstractNum w:abstractNumId="5"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperRoman"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      // abstractNum 6 = Lower Roman (i, ii, iii)
      + '<w:abstractNum w:abstractNumId="6"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>'
      + '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>'
      + '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>'
      + '<w:num w:numId="3"><w:abstractNumId w:val="2"/></w:num>'
      + '<w:num w:numId="4"><w:abstractNumId w:val="3"/></w:num>'
      + '<w:num w:numId="5"><w:abstractNumId w:val="4"/></w:num>'
      + '<w:num w:numId="6"><w:abstractNumId w:val="5"/></w:num>'
      + '<w:num w:numId="7"><w:abstractNumId w:val="6"/></w:num>'
      + '</w:numbering>';

    const numberingRId = 'rId' + (++rIdCounter);

    // --- Build document.xml ---
    const WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const WPNS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';

    let sectPr = '<w:sectPr>';
    if (headerRId) sectPr += '<w:headerReference w:type="default" r:id="' + headerRId + '"/>';
    if (footerRId) sectPr += '<w:footerReference w:type="default" r:id="' + footerRId + '"/>';
    sectPr += '<w:pgSz w:w="12240" w:h="15840"/>';
    sectPr += '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>';
    sectPr += '</w:sectPr>';

    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="' + WNS + '" xmlns:r="' + RNS + '" xmlns:wp="' + WPNS + '">'
      + '<w:body>' + body + sectPr + '</w:body>'
      + '</w:document>';

    // --- Build [Content_Types].xml ---
    let contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>';

    // Add image content types
    const imageExts = new Set(images.map(i => i.ext));
    for (const ext of imageExts) {
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
      contentTypes += '<Default Extension="' + ext + '" ContentType="' + mime + '"/>';
    }

    contentTypes += '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
      + '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>';
    if (headerXml) contentTypes += '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>';
    if (footerXml) contentTypes += '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>';
    if (endnotesXml) contentTypes += '<Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/>';
    if (commentsXml) contentTypes += '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>';
    contentTypes += '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
    contentTypes += '</Types>';

    // --- Build relationships ---
    const coreRId = 'rIdCore';
    const relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '<Relationship Id="' + coreRId + '" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '</Relationships>';

    let docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '<Relationship Id="' + numberingRId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>';

    for (const img of images)
      docRels += '<Relationship Id="' + img.rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="' + img.target + '"/>';
    for (const link of hyperlinks)
      docRels += '<Relationship Id="' + link.rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + escXml(link.target) + '" TargetMode="External"/>';
    if (headerRId)
      docRels += '<Relationship Id="' + headerRId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>';
    if (footerRId)
      docRels += '<Relationship Id="' + footerRId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>';
    if (endnotesRId)
      docRels += '<Relationship Id="' + endnotesRId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>';
    if (commentsRId)
      docRels += '<Relationship Id="' + commentsRId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>';
    docRels += '</Relationships>';

    // --- Enhanced styles.xml ---
    const stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>'
      + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:pPr><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:pPr><w:outlineLvl w:val="4"/></w:pPr><w:rPr><w:sz w:val="22"/><w:color w:val="1F4D78"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:pPr><w:outlineLvl w:val="5"/></w:pPr><w:rPr><w:i/><w:sz w:val="22"/><w:color w:val="1F4D78"/></w:rPr></w:style>'
      + '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>'
      + '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>'
      + '</w:styles>';

    // --- Write all files to zip ---
    zip.file('[Content_Types].xml', contentTypes);
    zip.file('_rels/.rels', relsXml);
    zip.file('word/_rels/document.xml.rels', docRels);
    zip.file('word/document.xml', documentXml);
    zip.file('word/styles.xml', stylesXml);
    zip.file('word/numbering.xml', numberingXml);

    return zip;
  }

  async function saveAsDocx(path, callback, getEditorContent, currentFileName) {
    try {
      const html = getEditorContent();
      const zip = buildDocxPackage(html);
      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      await _Kernel32.WriteFile(path, blob);
    } catch (err) {
      await _User32.MessageBox('Could not save DOCX: ' + err.message, 'WordPad', MB_OK);
      return false;
    }
    if (typeof callback === 'function')
      callback();
    return true;
  }

  WP.DocxEngine = { init, parseDocxDirect, buildDocxPackage, saveAsDocx };
})();
