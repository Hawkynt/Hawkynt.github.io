;(function() {
  'use strict';
  const PA = window.PresentationsApp || (window.PresentationsApp = {});

  // ── XML Namespaces ───────────────────────────────────────────────
  const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  const NS_CP = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
  const NS_DC = 'http://purl.org/dc/elements/1.1/';
  const NS_DCTERMS = 'http://purl.org/dc/terms/';
  const NS_XSI = 'http://www.w3.org/2001/XMLSchema-instance';
  const NS_EP = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';

  // ── EMU Conversion ───────────────────────────────────────────────
  // 1 inch = 914400 EMU; at 96 DPI, 1 px = 1/96 inch = 9525 EMU
  const EMU_PER_PX = 9525;
  const SLIDE_WIDTH_EMU = 9144000;   // 960px * 9525
  const SLIDE_HEIGHT_EMU = 5143500;  // 540px * 9525 (approx)

  function _emuToPx(emu) {
    return Math.round(emu / EMU_PER_PX);
  }

  function _pxToEmu(px) {
    return Math.round(px * EMU_PER_PX);
  }

  function _xmlEscape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Color Parsing ────────────────────────────────────────────────

  const _schemeColorMap = {
    dk1: '#000000', lt1: '#ffffff', dk2: '#1f3864', lt2: '#e7e6e6',
    accent1: '#4472c4', accent2: '#ed7d31', accent3: '#a5a5a5',
    accent4: '#ffc000', accent5: '#5b9bd5', accent6: '#70ad47',
    hlink: '#0563c1', folHlink: '#954f72',
    tx1: '#000000', tx2: '#333333', bg1: '#ffffff', bg2: '#e7e6e6'
  };

  function _parseColor(colorNode, themeColors) {
    if (!colorNode)
      return null;

    // Direct sRGB color
    const srgb = colorNode.getElementsByTagNameNS(NS_A, 'srgbClr')[0];
    if (srgb) {
      const val = srgb.getAttribute('val');
      return val ? '#' + val : null;
    }

    // Scheme color (theme reference)
    const scheme = colorNode.getElementsByTagNameNS(NS_A, 'schemeClr')[0];
    if (scheme) {
      const val = scheme.getAttribute('val');
      if (themeColors && themeColors[val])
        return themeColors[val];
      return _schemeColorMap[val] || null;
    }

    // System color
    const sys = colorNode.getElementsByTagNameNS(NS_A, 'sysClr')[0];
    if (sys) {
      const lastClr = sys.getAttribute('lastClr');
      return lastClr ? '#' + lastClr : null;
    }

    // Preset color
    const preset = colorNode.getElementsByTagNameNS(NS_A, 'prstClr')[0];
    if (preset) {
      const val = preset.getAttribute('val');
      // Return the name; CSS can handle most preset color names
      return val || null;
    }

    return null;
  }

  // ── Transition Mapping ───────────────────────────────────────────

  const _pptxTransitionMap = {
    fade: 'fade',
    push: 'push',
    wipe: 'wipe',
    split: 'split',
    blinds: 'blinds',
    checker: 'checker',
    circle: 'circle',
    dissolve: 'dissolve',
    comb: 'comb',
    cover: 'cover',
    cut: 'cut',
    diamond: 'diamond',
    newsflash: 'newsflash',
    plus: 'plus',
    random: 'random',
    randomBar: 'randomBar',
    strips: 'strips',
    wedge: 'wedge',
    wheel: 'wheel',
    zoom: 'zoom'
  };

  const _reverseTransitionMap = {};
  for (const [k, v] of Object.entries(_pptxTransitionMap))
    _reverseTransitionMap[v] = k;

  // ═══════════════════════════════════════════════════════════════
  // PPTX Import
  // ═══════════════════════════════════════════════════════════════

  async function loadPptx(arrayBuffer) {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();
    const presentation = {
      slides: [],
      theme: {
        name: 'Office',
        colors: { bg: '#ffffff', title: '#1f3864', body: '#333333', accent1: '#4472c4', accent2: '#ed7d31' },
        fonts: { title: 'Calibri Light', body: 'Calibri' }
      },
      slideWidth: 960,
      slideHeight: 540,
      metadata: { title: '', author: '', created: null, modified: null }
    };

    try {
      // Parse theme
      const themeColors = await _parseTheme(zip, parser, presentation);

      // Parse core properties
      await _parseCoreProps(zip, parser, presentation);

      // Parse presentation.xml for slide list and dimensions
      const presFile = zip.file('ppt/presentation.xml');
      if (!presFile)
        throw new Error('No presentation.xml found');

      const presXml = await presFile.async('string');
      const presDom = parser.parseFromString(presXml, 'text/xml');

      // Extract slide size
      const sldSz = presDom.getElementsByTagNameNS(NS_P, 'sldSz')[0];
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute('cx'), 10);
        const cy = parseInt(sldSz.getAttribute('cy'), 10);
        if (cx && cy) {
          presentation.slideWidth = _emuToPx(cx);
          presentation.slideHeight = _emuToPx(cy);
        }
      }

      // Parse presentation relationships to find slide files
      const presRelsFile = zip.file('ppt/_rels/presentation.xml.rels');
      const presRels = {};
      if (presRelsFile) {
        const relsXml = await presRelsFile.async('string');
        const relsDom = parser.parseFromString(relsXml, 'text/xml');
        for (const rel of relsDom.querySelectorAll('Relationship')) {
          presRels[rel.getAttribute('Id')] = {
            type: rel.getAttribute('Type'),
            target: rel.getAttribute('Target')
          };
        }
      }

      // Collect slide IDs in order
      const sldIdLst = presDom.getElementsByTagNameNS(NS_P, 'sldIdLst')[0];
      const slideEntries = [];
      if (sldIdLst) {
        const sldIds = sldIdLst.getElementsByTagNameNS(NS_P, 'sldId');
        for (let i = 0; i < sldIds.length; ++i) {
          const rId = sldIds[i].getAttributeNS(NS_R, 'id') || sldIds[i].getAttribute('r:id');
          if (rId && presRels[rId])
            slideEntries.push(presRels[rId].target);
        }
      }

      // Parse each slide
      for (let i = 0; i < slideEntries.length; ++i) {
        try {
          const slidePath = slideEntries[i].startsWith('ppt/')
            ? slideEntries[i]
            : 'ppt/' + slideEntries[i];

          const slide = await _parseSlide(zip, parser, slidePath, i, themeColors);
          presentation.slides.push(slide);
        } catch (err) {
          // Partial parse: add empty slide placeholder on error
          presentation.slides.push({
            id: 'slide-' + (i + 1),
            layout: 'blank',
            background: null,
            transition: { type: 'none', duration: 0 },
            elements: [],
            notes: ''
          });
        }
      }
    } catch (err) {
      // Return whatever we managed to parse
      if (presentation.slides.length === 0) {
        presentation.slides.push({
          id: 'slide-1',
          layout: 'blank',
          background: null,
          transition: { type: 'none', duration: 0 },
          elements: [],
          notes: ''
        });
      }
    }

    return presentation;
  }

  // ── Theme Parsing ────────────────────────────────────────────────

  async function _parseTheme(zip, parser, presentation) {
    const themeColors = {};
    const themeFile = zip.file('ppt/theme/theme1.xml');
    if (!themeFile)
      return themeColors;

    try {
      const themeXml = await themeFile.async('string');
      const themeDom = parser.parseFromString(themeXml, 'text/xml');

      // Theme name
      const themeEl = themeDom.getElementsByTagNameNS(NS_A, 'theme')[0];
      if (themeEl) {
        const name = themeEl.getAttribute('name');
        if (name)
          presentation.theme.name = name;
      }

      // Color scheme
      const clrScheme = themeDom.getElementsByTagNameNS(NS_A, 'clrScheme')[0];
      if (clrScheme) {
        const colorNames = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
        for (const name of colorNames) {
          const el = clrScheme.getElementsByTagNameNS(NS_A, name)[0];
          if (el) {
            const srgb = el.getElementsByTagNameNS(NS_A, 'srgbClr')[0];
            const sys = el.getElementsByTagNameNS(NS_A, 'sysClr')[0];
            if (srgb)
              themeColors[name] = '#' + srgb.getAttribute('val');
            else if (sys)
              themeColors[name] = '#' + (sys.getAttribute('lastClr') || '000000');
          }
        }

        presentation.theme.colors.bg = themeColors.lt1 || '#ffffff';
        presentation.theme.colors.title = themeColors.dk2 || '#1f3864';
        presentation.theme.colors.body = themeColors.dk1 || '#333333';
        presentation.theme.colors.accent1 = themeColors.accent1 || '#4472c4';
        presentation.theme.colors.accent2 = themeColors.accent2 || '#ed7d31';
      }

      // Font scheme
      const fontScheme = themeDom.getElementsByTagNameNS(NS_A, 'fontScheme')[0];
      if (fontScheme) {
        const majorFont = fontScheme.getElementsByTagNameNS(NS_A, 'majorFont')[0];
        const minorFont = fontScheme.getElementsByTagNameNS(NS_A, 'minorFont')[0];
        if (majorFont) {
          const latin = majorFont.getElementsByTagNameNS(NS_A, 'latin')[0];
          if (latin)
            presentation.theme.fonts.title = latin.getAttribute('typeface') || 'Calibri Light';
        }
        if (minorFont) {
          const latin = minorFont.getElementsByTagNameNS(NS_A, 'latin')[0];
          if (latin)
            presentation.theme.fonts.body = latin.getAttribute('typeface') || 'Calibri';
        }
      }
    } catch (_) {
      // Continue with defaults
    }

    return themeColors;
  }

  // ── Core Properties Parsing ──────────────────────────────────────

  async function _parseCoreProps(zip, parser, presentation) {
    const coreFile = zip.file('docProps/core.xml');
    if (!coreFile)
      return;

    try {
      const coreXml = await coreFile.async('string');
      const coreDom = parser.parseFromString(coreXml, 'text/xml');

      const title = coreDom.getElementsByTagNameNS(NS_DC, 'title')[0];
      if (title && title.textContent)
        presentation.metadata.title = title.textContent;

      const creator = coreDom.getElementsByTagNameNS(NS_DC, 'creator')[0];
      if (creator && creator.textContent)
        presentation.metadata.author = creator.textContent;

      const created = coreDom.getElementsByTagNameNS(NS_DCTERMS, 'created')[0];
      if (created && created.textContent)
        presentation.metadata.created = new Date(created.textContent);

      const modified = coreDom.getElementsByTagNameNS(NS_DCTERMS, 'modified')[0];
      if (modified && modified.textContent)
        presentation.metadata.modified = new Date(modified.textContent);
    } catch (_) {
      // Continue with defaults
    }
  }

  // ── Individual Slide Parsing ─────────────────────────────────────

  async function _parseSlide(zip, parser, slidePath, index, themeColors) {
    const slide = {
      id: 'slide-' + (index + 1),
      layout: 'blank',
      background: null,
      transition: { type: 'none', duration: 0 },
      elements: [],
      notes: ''
    };

    const slideFile = zip.file(slidePath);
    if (!slideFile)
      return slide;

    const slideXml = await slideFile.async('string');
    const slideDom = parser.parseFromString(slideXml, 'text/xml');

    // Parse slide relationships for images
    const slideRelsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const slideRels = {};
    const slideRelsFile = zip.file(slideRelsPath);
    if (slideRelsFile) {
      const relsXml = await slideRelsFile.async('string');
      const relsDom = parser.parseFromString(relsXml, 'text/xml');
      for (const rel of relsDom.querySelectorAll('Relationship'))
        slideRels[rel.getAttribute('Id')] = {
          type: rel.getAttribute('Type'),
          target: rel.getAttribute('Target')
        };
    }

    // Parse background
    const bg = slideDom.getElementsByTagNameNS(NS_P, 'bg')[0];
    if (bg) {
      const solidFill = bg.getElementsByTagNameNS(NS_A, 'solidFill')[0];
      if (solidFill) {
        const color = _parseColor(solidFill, themeColors);
        if (color)
          slide.background = color;
      }
    }

    // Parse transition
    const transition = slideDom.getElementsByTagNameNS(NS_P, 'transition')[0];
    if (transition) {
      const spd = transition.getAttribute('spd');
      let duration = 0.5;
      if (spd === 'slow')
        duration = 1.0;
      else if (spd === 'fast')
        duration = 0.25;
      else if (spd === 'med')
        duration = 0.5;

      const advTm = transition.getAttribute('advTm');
      if (advTm)
        duration = parseInt(advTm, 10) / 1000;

      // Find the transition type child element
      for (const child of transition.children) {
        const localName = child.localName;
        if (localName && _pptxTransitionMap[localName]) {
          slide.transition = { type: _pptxTransitionMap[localName], duration };
          break;
        }
      }

      if (slide.transition.type === 'none' && transition.children.length > 0)
        slide.transition = { type: 'fade', duration };
    }

    // Parse shapes (p:sp)
    const spTree = slideDom.getElementsByTagNameNS(NS_P, 'spTree')[0];
    if (!spTree)
      return slide;

    let elIndex = 0;

    // Text shapes
    const shapes = spTree.getElementsByTagNameNS(NS_P, 'sp');
    for (let i = 0; i < shapes.length; ++i) {
      try {
        const el = _parseShape(shapes[i], themeColors, ++elIndex);
        if (el)
          slide.elements.push(el);
      } catch (_) {
        // Skip malformed shapes
      }
    }

    // Pictures (p:pic)
    const pics = spTree.getElementsByTagNameNS(NS_P, 'pic');
    for (let i = 0; i < pics.length; ++i) {
      try {
        const el = await _parsePicture(pics[i], zip, slideRels, themeColors, ++elIndex);
        if (el)
          slide.elements.push(el);
      } catch (_) {
        // Skip malformed pictures
      }
    }

    // Tables (p:graphicFrame containing a:tbl)
    const graphicFrames = spTree.getElementsByTagNameNS(NS_P, 'graphicFrame');
    for (let i = 0; i < graphicFrames.length; ++i) {
      try {
        const el = _parseGraphicFrame(graphicFrames[i], themeColors, ++elIndex);
        if (el)
          slide.elements.push(el);
      } catch (_) {
        // Skip malformed graphic frames
      }
    }

    // Connection shapes (p:cxnSp)
    const cxnSps = spTree.getElementsByTagNameNS(NS_P, 'cxnSp');
    for (let i = 0; i < cxnSps.length; ++i) {
      try {
        const el = _parseConnectorShape(cxnSps[i], themeColors, ++elIndex);
        if (el)
          slide.elements.push(el);
      } catch (_) {
        // Skip malformed connectors
      }
    }

    // Detect layout heuristic based on element count and positioning
    slide.layout = _detectLayout(slide.elements);

    // Parse speaker notes
    await _parseNotes(zip, parser, slidePath, slide);

    return slide;
  }

  // ── Shape Parsing ────────────────────────────────────────────────

  function _parseShape(sp, themeColors, elIndex) {
    const spPr = sp.getElementsByTagNameNS(NS_P, 'spPr')[0]
      || sp.getElementsByTagNameNS(NS_A, 'spPr')[0];
    const txBody = sp.getElementsByTagNameNS(NS_P, 'txBody')[0]
      || sp.getElementsByTagNameNS(NS_A, 'txBody')[0];

    // Extract position/size from xfrm
    let x = 0, y = 0, w = 200, h = 100, rotation = 0;
    if (spPr) {
      const xfrm = spPr.getElementsByTagNameNS(NS_A, 'xfrm')[0];
      if (xfrm) {
        const rot = xfrm.getAttribute('rot');
        if (rot)
          rotation = parseInt(rot, 10) / 60000; // rotation in 60000ths of a degree

        const off = xfrm.getElementsByTagNameNS(NS_A, 'off')[0];
        if (off) {
          x = _emuToPx(parseInt(off.getAttribute('x'), 10) || 0);
          y = _emuToPx(parseInt(off.getAttribute('y'), 10) || 0);
        }
        const ext = xfrm.getElementsByTagNameNS(NS_A, 'ext')[0];
        if (ext) {
          w = _emuToPx(parseInt(ext.getAttribute('cx'), 10) || 0);
          h = _emuToPx(parseInt(ext.getAttribute('cy'), 10) || 0);
        }
      }
    }

    // Extract text content
    let content = '';
    const style = {
      fontSize: 18,
      fontFamily: 'Calibri',
      color: '#000000',
      bgColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0
    };

    if (txBody) {
      content = _parseTextBody(txBody, themeColors, style);
    }

    // Skip empty placeholder shapes with no text
    if (!content && !txBody)
      return null;

    // Extract shape fill
    if (spPr) {
      const solidFill = spPr.getElementsByTagNameNS(NS_A, 'solidFill')[0];
      if (solidFill) {
        const fillColor = _parseColor(solidFill, themeColors);
        if (fillColor)
          style.bgColor = fillColor;
      }

      // Extract border (outline)
      const ln = spPr.getElementsByTagNameNS(NS_A, 'ln')[0];
      if (ln) {
        const lnW = ln.getAttribute('w');
        if (lnW)
          style.borderWidth = Math.max(1, Math.round(parseInt(lnW, 10) / EMU_PER_PX));

        const lnFill = ln.getElementsByTagNameNS(NS_A, 'solidFill')[0];
        if (lnFill) {
          const lineColor = _parseColor(lnFill, themeColors);
          if (lineColor)
            style.borderColor = lineColor;
        }
      }
    }

    return {
      id: 'el-' + elIndex,
      type: 'textbox',
      x, y, w, h, rotation,
      content: content || '',
      style
    };
  }

  // ── Text Body Parsing ────────────────────────────────────────────

  function _parseTextBody(txBody, themeColors, outStyle) {
    const paragraphs = txBody.getElementsByTagNameNS(NS_A, 'p');
    const htmlParts = [];
    let firstRunProcessed = false;

    for (let pi = 0; pi < paragraphs.length; ++pi) {
      const p = paragraphs[pi];
      const pPr = p.getElementsByTagNameNS(NS_A, 'pPr')[0];
      let align = '';
      if (pPr) {
        const algn = pPr.getAttribute('algn');
        if (algn === 'ctr') align = 'center';
        else if (algn === 'r') align = 'right';
        else if (algn === 'just') align = 'justify';
      }

      const runs = p.getElementsByTagNameNS(NS_A, 'r');
      let paraHtml = '';

      for (let ri = 0; ri < runs.length; ++ri) {
        const run = runs[ri];
        const rPr = run.getElementsByTagNameNS(NS_A, 'rPr')[0];
        const t = run.getElementsByTagNameNS(NS_A, 't')[0];
        const text = t ? _escapeXml(t.textContent || '') : '';

        if (!text)
          continue;

        let spanStyles = '';
        const spanClasses = [];

        if (rPr) {
          // Capture first run's style as the element default
          if (!firstRunProcessed) {
            const sz = rPr.getAttribute('sz');
            if (sz)
              outStyle.fontSize = Math.round(parseInt(sz, 10) / 100);

            const latin = rPr.getElementsByTagNameNS(NS_A, 'latin')[0];
            if (latin) {
              const typeface = latin.getAttribute('typeface');
              if (typeface)
                outStyle.fontFamily = typeface;
            }

            const solidFill = rPr.getElementsByTagNameNS(NS_A, 'solidFill')[0];
            if (solidFill) {
              const color = _parseColor(solidFill, themeColors);
              if (color)
                outStyle.color = color;
            }

            firstRunProcessed = true;
          }

          const bold = rPr.getAttribute('b');
          const italic = rPr.getAttribute('i');
          const underline = rPr.getAttribute('u');
          const strike = rPr.getAttribute('strike');

          if (bold === '1' || bold === 'true')
            spanClasses.push('b');
          if (italic === '1' || italic === 'true')
            spanClasses.push('i');
          if (underline && underline !== 'none')
            spanClasses.push('u');
          if (strike && strike !== 'noStrike')
            spanClasses.push('s');

          // Per-run font size override
          const sz = rPr.getAttribute('sz');
          if (sz)
            spanStyles += 'font-size:' + Math.round(parseInt(sz, 10) / 100) + 'pt;';

          // Per-run color override
          const solidFill = rPr.getElementsByTagNameNS(NS_A, 'solidFill')[0];
          if (solidFill) {
            const color = _parseColor(solidFill, themeColors);
            if (color)
              spanStyles += 'color:' + color + ';';
          }

          // Per-run font override
          const latin = rPr.getElementsByTagNameNS(NS_A, 'latin')[0];
          if (latin) {
            const typeface = latin.getAttribute('typeface');
            if (typeface)
              spanStyles += 'font-family:' + typeface + ';';
          }
        }

        let runHtml = text;
        for (const cls of spanClasses) {
          if (cls === 'b') runHtml = '<b>' + runHtml + '</b>';
          else if (cls === 'i') runHtml = '<i>' + runHtml + '</i>';
          else if (cls === 'u') runHtml = '<u>' + runHtml + '</u>';
          else if (cls === 's') runHtml = '<s>' + runHtml + '</s>';
        }

        if (spanStyles)
          runHtml = '<span style="' + spanStyles + '">' + runHtml + '</span>';

        paraHtml += runHtml;
      }

      // Handle line breaks (a:br)
      const brs = p.getElementsByTagNameNS(NS_A, 'br');
      if (brs.length > 0 && !paraHtml)
        paraHtml = '<br>';

      const styleAttr = align ? ' style="text-align:' + align + '"' : '';
      htmlParts.push('<p' + styleAttr + '>' + (paraHtml || '&nbsp;') + '</p>');
    }

    return htmlParts.join('');
  }

  // ── Picture Parsing ──────────────────────────────────────────────

  async function _parsePicture(pic, zip, slideRels, themeColors, elIndex) {
    const spPr = pic.getElementsByTagNameNS(NS_P, 'spPr')[0]
      || pic.getElementsByTagNameNS(NS_A, 'spPr')[0];

    let x = 0, y = 0, w = 200, h = 200, rotation = 0;
    if (spPr) {
      const xfrm = spPr.getElementsByTagNameNS(NS_A, 'xfrm')[0];
      if (xfrm) {
        const rot = xfrm.getAttribute('rot');
        if (rot)
          rotation = parseInt(rot, 10) / 60000;

        const off = xfrm.getElementsByTagNameNS(NS_A, 'off')[0];
        if (off) {
          x = _emuToPx(parseInt(off.getAttribute('x'), 10) || 0);
          y = _emuToPx(parseInt(off.getAttribute('y'), 10) || 0);
        }
        const ext = xfrm.getElementsByTagNameNS(NS_A, 'ext')[0];
        if (ext) {
          w = _emuToPx(parseInt(ext.getAttribute('cx'), 10) || 0);
          h = _emuToPx(parseInt(ext.getAttribute('cy'), 10) || 0);
        }
      }
    }

    // Find image relationship
    const blipFill = pic.getElementsByTagNameNS(NS_P, 'blipFill')[0];
    let dataUri = '';
    if (blipFill) {
      const blip = blipFill.getElementsByTagNameNS(NS_A, 'blip')[0];
      if (blip) {
        const embed = blip.getAttributeNS(NS_R, 'embed') || blip.getAttribute('r:embed');
        if (embed && slideRels[embed]) {
          const target = slideRels[embed].target;
          const imgPath = target.startsWith('/')
            ? target.substring(1)
            : target.startsWith('../')
              ? 'ppt/' + target.substring(3)
              : 'ppt/slides/' + target;

          const imgFile = zip.file(imgPath);
          if (imgFile) {
            const data = await imgFile.async('base64');
            const ext = target.split('.').pop().toLowerCase();
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
              : ext === 'gif' ? 'image/gif'
              : ext === 'svg' ? 'image/svg+xml'
              : ext === 'emf' ? 'image/x-emf'
              : ext === 'wmf' ? 'image/x-wmf'
              : 'image/png';
            dataUri = 'data:' + mime + ';base64,' + data;
          }
        }
      }
    }

    // Alt text from cNvPr descr/title attributes
    let altText = null;
    const nvPicPr = pic.getElementsByTagNameNS(NS_P, 'nvPicPr')[0];
    if (nvPicPr) {
      const cNvPr = nvPicPr.getElementsByTagNameNS(NS_P, 'cNvPr')[0];
      if (cNvPr) {
        const descr = cNvPr.getAttribute('descr') || '';
        const title = cNvPr.getAttribute('title') || '';
        if (descr || title)
          altText = { title, description: descr };
      }
    }

    const result = {
      id: 'el-' + elIndex,
      type: 'image',
      x, y, w, h, rotation,
      content: dataUri,
      style: {
        fontSize: 18,
        fontFamily: 'Calibri',
        color: '#000000',
        bgColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0
      }
    };
    if (altText)
      result.altText = altText;
    return result;
  }

  // ── Graphic Frame (Table) Parsing ────────────────────────────────

  function _parseGraphicFrame(gf, themeColors, elIndex) {
    const xfrm = gf.getElementsByTagNameNS(NS_P, 'xfrm')[0]
      || gf.getElementsByTagNameNS(NS_A, 'xfrm')[0];

    let x = 0, y = 0, w = 400, h = 200, rotation = 0;
    if (xfrm) {
      const rot = xfrm.getAttribute('rot');
      if (rot)
        rotation = parseInt(rot, 10) / 60000;

      const off = xfrm.getElementsByTagNameNS(NS_A, 'off')[0];
      if (off) {
        x = _emuToPx(parseInt(off.getAttribute('x'), 10) || 0);
        y = _emuToPx(parseInt(off.getAttribute('y'), 10) || 0);
      }
      const ext = xfrm.getElementsByTagNameNS(NS_A, 'ext')[0];
      if (ext) {
        w = _emuToPx(parseInt(ext.getAttribute('cx'), 10) || 0);
        h = _emuToPx(parseInt(ext.getAttribute('cy'), 10) || 0);
      }
    }

    // Look for table
    const tbl = gf.getElementsByTagNameNS(NS_A, 'tbl')[0];
    if (!tbl)
      return null;

    const rows = tbl.getElementsByTagNameNS(NS_A, 'tr');
    let tableHtml = '<table style="width:100%;border-collapse:collapse">';

    for (let ri = 0; ri < rows.length; ++ri) {
      tableHtml += '<tr>';
      const cells = rows[ri].getElementsByTagNameNS(NS_A, 'tc');
      for (let ci = 0; ci < cells.length; ++ci) {
        const cell = cells[ci];
        const txBody = cell.getElementsByTagNameNS(NS_A, 'txBody')[0];
        let cellText = '';
        if (txBody) {
          const dummyStyle = {
            fontSize: 14, fontFamily: 'Calibri', color: '#000000',
            bgColor: 'transparent', borderColor: 'transparent', borderWidth: 0
          };
          cellText = _parseTextBody(txBody, themeColors, dummyStyle);
        }

        // Check for cell fill
        const tcPr = cell.getElementsByTagNameNS(NS_A, 'tcPr')[0];
        let cellStyle = 'border:1px solid #ccc;padding:4px';
        if (tcPr) {
          const solidFill = tcPr.getElementsByTagNameNS(NS_A, 'solidFill')[0];
          if (solidFill) {
            const bgColor = _parseColor(solidFill, themeColors);
            if (bgColor)
              cellStyle += ';background:' + bgColor;
          }
        }

        // Check for merge attributes
        const gridSpan = cell.getAttribute('gridSpan');
        const rowSpan = cell.getAttribute('rowSpan');
        let attrs = ' style="' + cellStyle + '"';
        if (gridSpan && parseInt(gridSpan, 10) > 1)
          attrs += ' colspan="' + gridSpan + '"';
        if (rowSpan && parseInt(rowSpan, 10) > 1)
          attrs += ' rowspan="' + rowSpan + '"';

        tableHtml += '<td' + attrs + '>' + cellText + '</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</table>';

    return {
      id: 'el-' + elIndex,
      type: 'table',
      x, y, w, h, rotation,
      content: tableHtml,
      style: {
        fontSize: 14,
        fontFamily: 'Calibri',
        color: '#000000',
        bgColor: 'transparent',
        borderColor: 'transparent',
        borderWidth: 0
      }
    };
  }

  // ── Speaker Notes Parsing ────────────────────────────────────────

  async function _parseNotes(zip, parser, slidePath, slide) {
    // Notes are in ppt/notesSlides/notesSlideN.xml
    const slideNum = slidePath.match(/slide(\d+)\.xml/);
    if (!slideNum)
      return;

    const notesPath = 'ppt/notesSlides/notesSlide' + slideNum[1] + '.xml';
    const notesFile = zip.file(notesPath);
    if (!notesFile)
      return;

    try {
      const notesXml = await notesFile.async('string');
      const notesDom = parser.parseFromString(notesXml, 'text/xml');
      const txBodies = notesDom.getElementsByTagNameNS(NS_P, 'txBody');

      // The second txBody typically contains the actual notes (first is slide number placeholder)
      let notesText = '';
      for (let i = 0; i < txBodies.length; ++i) {
        const paragraphs = txBodies[i].getElementsByTagNameNS(NS_A, 'p');
        let bodyText = '';
        for (let pi = 0; pi < paragraphs.length; ++pi) {
          const runs = paragraphs[pi].getElementsByTagNameNS(NS_A, 'r');
          for (let ri = 0; ri < runs.length; ++ri) {
            const t = runs[ri].getElementsByTagNameNS(NS_A, 't')[0];
            if (t)
              bodyText += t.textContent || '';
          }
          if (pi < paragraphs.length - 1)
            bodyText += '\n';
        }
        if (bodyText.trim())
          notesText = bodyText.trim();
      }

      slide.notes = notesText;
    } catch (_) {
      // Notes are optional
    }
  }

  // ── Layout Detection Heuristic ───────────────────────────────────

  function _detectLayout(elements) {
    if (elements.length === 0)
      return 'blank';

    const textboxes = elements.filter(e => e.type === 'textbox');
    if (textboxes.length === 1) {
      const tb = textboxes[0];
      if (tb.y < 100 && tb.h > 80)
        return 'title';
      return 'blank';
    }

    if (textboxes.length === 2) {
      const sorted = textboxes.slice().sort((a, b) => a.y - b.y);
      if (sorted[0].y < 120 && sorted[1].y >= 120)
        return 'titleContent';
    }

    if (textboxes.length >= 3)
      return 'twoContent';

    return 'blank';
  }

  // ═══════════════════════════════════════════════════════════════
  // PPTX Export
  // ═══════════════════════════════════════════════════════════════

  async function savePptx(presentation) {
    const zip = new JSZip();
    const slideCount = presentation.slides.length || 1;

    // Collect all images across all slides
    const allImages = [];
    for (const slide of presentation.slides)
      for (const el of slide.elements)
        if (el.type === 'image' && el.content)
          allImages.push(el);

    // Build package structure
    zip.file('[Content_Types].xml', _buildContentTypes(slideCount));
    zip.file('_rels/.rels', _buildRels());
    zip.file('ppt/presentation.xml', _buildPresentation(presentation, slideCount));
    zip.file('ppt/_rels/presentation.xml.rels', _buildPresentationRels(slideCount));
    zip.file('ppt/theme/theme1.xml', _buildTheme(presentation.theme));
    zip.file('ppt/slideMasters/slideMaster1.xml', _buildSlideMaster());
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', _buildSlideMasterRels());
    zip.file('ppt/slideLayouts/slideLayout1.xml', _buildSlideLayout());
    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', _buildSlideLayoutRels());
    zip.file('docProps/core.xml', _buildCoreProps(presentation.metadata));
    zip.file('docProps/app.xml', _buildAppProps(slideCount));

    // Build each slide
    let mediaIndex = 0;
    for (let i = 0; i < slideCount; ++i) {
      const slide = presentation.slides[i] || {
        id: 'slide-' + (i + 1), layout: 'blank', background: null,
        transition: { type: 'none', duration: 0 }, elements: [], notes: ''
      };

      // Collect images for this slide
      const slideImages = [];
      for (const el of slide.elements) {
        if (el.type === 'image' && el.content) {
          ++mediaIndex;
          const ext = _dataUriExtension(el.content);
          const filename = 'image' + mediaIndex + '.' + ext;

          // Embed image data
          const base64Data = el.content.split(',')[1];
          if (base64Data)
            zip.file('ppt/media/' + filename, base64Data, { base64: true });

          slideImages.push({ element: el, filename, rId: 'rId' + (slideImages.length + 2) });
        }
      }

      zip.file('ppt/slides/slide' + (i + 1) + '.xml', _buildSlide(slide, slideImages, presentation));
      zip.file('ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', _buildSlideRels(slideImages, i + 1));
    }

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
  }

  // ── Data URI Helpers ─────────────────────────────────────────────

  function _dataUriExtension(dataUri) {
    if (!dataUri)
      return 'png';
    if (dataUri.indexOf('image/jpeg') !== -1 || dataUri.indexOf('image/jpg') !== -1)
      return 'jpeg';
    if (dataUri.indexOf('image/gif') !== -1)
      return 'gif';
    if (dataUri.indexOf('image/svg') !== -1)
      return 'svg';
    return 'png';
  }

  function _dataUriMime(ext) {
    if (ext === 'jpeg' || ext === 'jpg')
      return 'image/jpeg';
    if (ext === 'gif')
      return 'image/gif';
    if (ext === 'svg')
      return 'image/svg+xml';
    return 'image/png';
  }

  // ── XML Escape ───────────────────────────────────────────────────

  function _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ── HTML to DrawingML Text Conversion ────────────────────────────

  function _htmlToDrawingML(html, defaultStyle) {
    if (!html)
      return '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>';

    // Simple HTML parser using DOMParser
    const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    const body = doc.body;
    const paragraphs = body.querySelectorAll('p');
    let xml = '';

    if (paragraphs.length === 0) {
      // No <p> tags, treat entire content as one paragraph
      xml += '<a:p>';
      xml += _inlineToRuns(body, defaultStyle);
      xml += '<a:endParaRPr lang="en-US" dirty="0"/>';
      xml += '</a:p>';
      return xml;
    }

    for (const p of paragraphs) {
      xml += '<a:p>';

      // Paragraph alignment
      const align = p.style.textAlign;
      if (align) {
        const algnMap = { center: 'ctr', right: 'r', justify: 'just', left: 'l' };
        xml += '<a:pPr algn="' + (algnMap[align] || 'l') + '"/>';
      }

      xml += _inlineToRuns(p, defaultStyle);
      xml += '<a:endParaRPr lang="en-US" dirty="0"/>';
      xml += '</a:p>';
    }

    return xml || '<a:p><a:endParaRPr lang="en-US" dirty="0"/></a:p>';
  }

  function _inlineToRuns(node, defaultStyle) {
    let xml = '';

    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        // Text node
        const text = child.textContent;
        if (!text)
          continue;

        xml += '<a:r>';
        xml += '<a:rPr lang="en-US" dirty="0"';
        xml += ' sz="' + ((defaultStyle.fontSize || 18) * 100) + '"';
        xml += '/>';
        xml += '<a:t>' + _escapeXml(text) + '</a:t>';
        xml += '</a:r>';
      } else if (child.nodeType === 1) {
        // Element node
        const tag = child.tagName.toLowerCase();
        const bold = tag === 'b' || tag === 'strong';
        const italic = tag === 'i' || tag === 'em';
        const underline = tag === 'u';
        const strike = tag === 's' || tag === 'strike' || tag === 'del';
        const isSpan = tag === 'span';
        const isBr = tag === 'br';

        if (isBr) {
          xml += '<a:br><a:rPr lang="en-US" dirty="0"/></a:br>';
          continue;
        }

        // For formatting tags, recursively process children with accumulated formatting
        const innerText = child.textContent || '';
        if (innerText || child.children.length > 0) {
          // Simple case: direct text content
          if (child.childNodes.length === 1 && child.childNodes[0].nodeType === 3) {
            xml += '<a:r>';
            xml += '<a:rPr lang="en-US" dirty="0"';
            xml += ' sz="' + ((defaultStyle.fontSize || 18) * 100) + '"';
            if (bold) xml += ' b="1"';
            if (italic) xml += ' i="1"';
            if (underline) xml += ' u="sng"';
            if (strike) xml += ' strike="sngStrike"';

            // Inline styles from span
            if (isSpan && child.style) {
              if (child.style.fontSize) {
                const ptMatch = child.style.fontSize.match(/(\d+)/);
                if (ptMatch)
                  xml = xml.replace(/sz="\d+"/, 'sz="' + (parseInt(ptMatch[1], 10) * 100) + '"');
              }
            }

            xml += '>';

            // Color from span
            if (isSpan && child.style && child.style.color) {
              const hex = _cssColorToHex(child.style.color);
              if (hex)
                xml += '<a:solidFill><a:srgbClr val="' + hex.substring(1) + '"/></a:solidFill>';
            }

            // Font from span
            if (isSpan && child.style && child.style.fontFamily)
              xml += '<a:latin typeface="' + _escapeXml(child.style.fontFamily.replace(/['"]/g, '')) + '"/>';

            xml += '</a:rPr>';
            xml += '<a:t>' + _escapeXml(child.childNodes[0].textContent) + '</a:t>';
            xml += '</a:r>';
          } else {
            // Nested formatting: recurse
            xml += _inlineToRuns(child, defaultStyle);
          }
        }
      }
    }

    return xml;
  }

  // ── CSS Color to Hex ─────────────────────────────────────────────

  function _cssColorToHex(color) {
    if (!color)
      return null;
    if (color.startsWith('#'))
      return color.length === 4
        ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
        : color;

    const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgb) {
      const r = parseInt(rgb[1], 10).toString(16).padStart(2, '0');
      const g = parseInt(rgb[2], 10).toString(16).padStart(2, '0');
      const b = parseInt(rgb[3], 10).toString(16).padStart(2, '0');
      return '#' + r + g + b;
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // XML Builders for Export
  // ═══════════════════════════════════════════════════════════════

  function _buildContentTypes(slideCount) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Types xmlns="' + NS_CT + '">';
    xml += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
    xml += '<Default Extension="xml" ContentType="application/xml"/>';
    xml += '<Default Extension="png" ContentType="image/png"/>';
    xml += '<Default Extension="jpeg" ContentType="image/jpeg"/>';
    xml += '<Default Extension="gif" ContentType="image/gif"/>';
    xml += '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>';
    xml += '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>';
    xml += '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>';
    xml += '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>';
    xml += '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
    xml += '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
    for (let i = 1; i <= slideCount; ++i)
      xml += '<Override PartName="/ppt/slides/slide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
    xml += '</Types>';
    return xml;
  }

  function _buildRels() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Relationships xmlns="' + NS_REL + '">';
    xml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>';
    xml += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>';
    xml += '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>';
    xml += '</Relationships>';
    return xml;
  }

  function _buildPresentation(presentation, slideCount) {
    const widthEmu = _pxToEmu(presentation.slideWidth || 960);
    const heightEmu = _pxToEmu(presentation.slideHeight || 540);

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<p:presentation xmlns:a="' + NS_A + '" xmlns:r="' + NS_R + '" xmlns:p="' + NS_P + '"';
    xml += ' saveSubsetFonts="1">';

    // Slide master list
    xml += '<p:sldMasterIdLst>';
    xml += '<p:sldMasterId id="2147483648" r:id="rId' + (slideCount + 1) + '"/>';
    xml += '</p:sldMasterIdLst>';

    // Slide list
    xml += '<p:sldIdLst>';
    for (let i = 0; i < slideCount; ++i)
      xml += '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 1) + '"/>';
    xml += '</p:sldIdLst>';

    // Slide size
    xml += '<p:sldSz cx="' + widthEmu + '" cy="' + heightEmu + '" type="custom"/>';
    xml += '<p:notesSz cx="' + heightEmu + '" cy="' + widthEmu + '"/>';

    xml += '</p:presentation>';
    return xml;
  }

  function _buildPresentationRels(slideCount) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Relationships xmlns="' + NS_REL + '">';

    for (let i = 0; i < slideCount; ++i)
      xml += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>';

    xml += '<Relationship Id="rId' + (slideCount + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>';
    xml += '<Relationship Id="rId' + (slideCount + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>';
    xml += '</Relationships>';
    return xml;
  }

  function _buildSlide(slide, slideImages, presentation) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<p:sld xmlns:a="' + NS_A + '" xmlns:r="' + NS_R + '" xmlns:p="' + NS_P + '">';

    // Common slide data
    xml += '<p:cSld>';

    // Background
    if (slide.background) {
      xml += '<p:bg>';
      xml += '<p:bgPr>';
      xml += '<a:solidFill><a:srgbClr val="' + slide.background.replace('#', '') + '"/></a:solidFill>';
      xml += '<a:effectLst/>';
      xml += '</p:bgPr>';
      xml += '</p:bg>';
    }

    xml += '<p:spTree>';

    // Non-visual group shape properties (required)
    xml += '<p:nvGrpSpPr>';
    xml += '<p:cNvPr id="1" name=""/>';
    xml += '<p:cNvGrpSpPr/>';
    xml += '<p:nvPr/>';
    xml += '</p:nvGrpSpPr>';
    xml += '<p:grpSpPr>';
    xml += '<a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>';
    xml += '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm>';
    xml += '</p:grpSpPr>';

    // Render each element
    let shapeId = 2;
    for (const el of slide.elements) {
      if (el.type === 'textbox' || el.type === 'table')
        xml += _buildShapeXml(el, shapeId++);
      else if (el.type === 'image') {
        const imgInfo = slideImages.find(si => si.element === el);
        if (imgInfo)
          xml += _buildPictureXml(el, shapeId++, imgInfo.rId);
      } else if (el.type === 'connector')
        xml += _buildConnectorXml(el, shapeId++, slide);
      else if (el.type === 'smartart')
        xml += _buildSmartArtGroupXml(el, shapeId);
    }

    xml += '</p:spTree>';
    xml += '</p:cSld>';

    // Color map override
    xml += '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>';

    // Transition
    if (slide.transition && slide.transition.type && slide.transition.type !== 'none') {
      const pptxType = _reverseTransitionMap[slide.transition.type] || 'fade';
      const spd = slide.transition.duration <= 0.3 ? 'fast'
        : slide.transition.duration >= 0.8 ? 'slow'
        : 'med';
      xml += '<p:transition spd="' + spd + '">';
      xml += '<p:' + pptxType + '/>';
      xml += '</p:transition>';
    }

    xml += '</p:sld>';
    return xml;
  }

  function _buildShapeXml(el, shapeId) {
    const xEmu = _pxToEmu(el.x || 0);
    const yEmu = _pxToEmu(el.y || 0);
    const wEmu = _pxToEmu(el.w || 200);
    const hEmu = _pxToEmu(el.h || 100);
    const rotAttr = el.rotation ? ' rot="' + Math.round(el.rotation * 60000) + '"' : '';
    const name = _escapeXml(el.type === 'table' ? 'Table' : 'TextBox') + ' ' + shapeId;

    let xml = '<p:sp>';

    // Non-visual properties
    xml += '<p:nvSpPr>';
    xml += '<p:cNvPr id="' + shapeId + '" name="' + name + '"/>';
    xml += '<p:cNvSpPr txBox="1"/>';
    xml += '<p:nvPr/>';
    xml += '</p:nvSpPr>';

    // Shape properties
    xml += '<p:spPr>';
    xml += '<a:xfrm' + rotAttr + '>';
    xml += '<a:off x="' + xEmu + '" y="' + yEmu + '"/>';
    xml += '<a:ext cx="' + wEmu + '" cy="' + hEmu + '"/>';
    xml += '</a:xfrm>';
    xml += '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';

    // Fill
    if (el.style && el.style.bgColor && el.style.bgColor !== 'transparent')
      xml += '<a:solidFill><a:srgbClr val="' + el.style.bgColor.replace('#', '') + '"/></a:solidFill>';
    else
      xml += '<a:noFill/>';

    // Border
    if (el.style && el.style.borderWidth && el.style.borderColor && el.style.borderColor !== 'transparent') {
      const lnW = _pxToEmu(el.style.borderWidth);
      xml += '<a:ln w="' + lnW + '">';
      xml += '<a:solidFill><a:srgbClr val="' + el.style.borderColor.replace('#', '') + '"/></a:solidFill>';
      xml += '</a:ln>';
    }

    xml += '</p:spPr>';

    // Text body
    xml += '<p:txBody>';
    xml += '<a:bodyPr wrap="square" rtlCol="0"/>';
    xml += '<a:lstStyle/>';
    xml += _htmlToDrawingML(el.content || '', el.style || { fontSize: 18 });
    xml += '</p:txBody>';

    xml += '</p:sp>';
    return xml;
  }

  function _buildPictureXml(el, shapeId, rId) {
    const xEmu = _pxToEmu(el.x || 0);
    const yEmu = _pxToEmu(el.y || 0);
    const wEmu = _pxToEmu(el.w || 200);
    const hEmu = _pxToEmu(el.h || 200);
    const rotAttr = el.rotation ? ' rot="' + Math.round(el.rotation * 60000) + '"' : '';

    let xml = '<p:pic>';

    // Non-visual properties
    xml += '<p:nvPicPr>';
    const altAttrs = [];
    if (el.altText && el.altText.description)
      altAttrs.push(' descr="' + _xmlEscape(el.altText.description) + '"');
    if (el.altText && el.altText.title)
      altAttrs.push(' title="' + _xmlEscape(el.altText.title) + '"');
    xml += '<p:cNvPr id="' + shapeId + '" name="Picture ' + shapeId + '"' + altAttrs.join('') + '/>';
    xml += '<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>';
    xml += '<p:nvPr/>';
    xml += '</p:nvPicPr>';

    // Blip fill (image reference)
    xml += '<p:blipFill>';
    xml += '<a:blip r:embed="' + rId + '"/>';
    xml += '<a:stretch><a:fillRect/></a:stretch>';
    xml += '</p:blipFill>';

    // Shape properties
    xml += '<p:spPr>';
    xml += '<a:xfrm' + rotAttr + '>';
    xml += '<a:off x="' + xEmu + '" y="' + yEmu + '"/>';
    xml += '<a:ext cx="' + wEmu + '" cy="' + hEmu + '"/>';
    xml += '</a:xfrm>';
    xml += '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
    xml += '</p:spPr>';

    xml += '</p:pic>';
    return xml;
  }

  function _buildSlideRels(slideImages, slideNum) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Relationships xmlns="' + NS_REL + '">';
    xml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';

    for (const img of slideImages) {
      const ext = _dataUriExtension(img.element.content);
      xml += '<Relationship Id="' + img.rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + img.filename + '"/>';
    }

    xml += '</Relationships>';
    return xml;
  }

  function _buildTheme(theme) {
    const colors = theme.colors || {};
    const fonts = theme.fonts || {};
    const bg = (colors.bg || '#ffffff').replace('#', '');
    const title = (colors.title || '#1f3864').replace('#', '');
    const body = (colors.body || '#333333').replace('#', '');
    const accent1 = (colors.accent1 || '#4472c4').replace('#', '');
    const accent2 = (colors.accent2 || '#ed7d31').replace('#', '');
    const titleFont = _escapeXml(fonts.title || 'Calibri Light');
    const bodyFont = _escapeXml(fonts.body || 'Calibri');

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<a:theme xmlns:a="' + NS_A + '" name="' + _escapeXml(theme.name || 'Office') + '">';

    xml += '<a:themeElements>';

    // Color scheme
    xml += '<a:clrScheme name="' + _escapeXml(theme.name || 'Office') + '">';
    xml += '<a:dk1><a:srgbClr val="' + body + '"/></a:dk1>';
    xml += '<a:lt1><a:srgbClr val="' + bg + '"/></a:lt1>';
    xml += '<a:dk2><a:srgbClr val="' + title + '"/></a:dk2>';
    xml += '<a:lt2><a:srgbClr val="e7e6e6"/></a:lt2>';
    xml += '<a:accent1><a:srgbClr val="' + accent1 + '"/></a:accent1>';
    xml += '<a:accent2><a:srgbClr val="' + accent2 + '"/></a:accent2>';
    xml += '<a:accent3><a:srgbClr val="a5a5a5"/></a:accent3>';
    xml += '<a:accent4><a:srgbClr val="ffc000"/></a:accent4>';
    xml += '<a:accent5><a:srgbClr val="5b9bd5"/></a:accent5>';
    xml += '<a:accent6><a:srgbClr val="70ad47"/></a:accent6>';
    xml += '<a:hlink><a:srgbClr val="0563c1"/></a:hlink>';
    xml += '<a:folHlink><a:srgbClr val="954f72"/></a:folHlink>';
    xml += '</a:clrScheme>';

    // Font scheme
    xml += '<a:fontScheme name="' + _escapeXml(theme.name || 'Office') + '">';
    xml += '<a:majorFont>';
    xml += '<a:latin typeface="' + titleFont + '"/>';
    xml += '<a:ea typeface=""/>';
    xml += '<a:cs typeface=""/>';
    xml += '</a:majorFont>';
    xml += '<a:minorFont>';
    xml += '<a:latin typeface="' + bodyFont + '"/>';
    xml += '<a:ea typeface=""/>';
    xml += '<a:cs typeface=""/>';
    xml += '</a:minorFont>';
    xml += '</a:fontScheme>';

    // Format scheme (minimal)
    xml += '<a:fmtScheme name="Office">';
    xml += '<a:fillStyleLst>';
    xml += '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    xml += '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    xml += '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    xml += '</a:fillStyleLst>';
    xml += '<a:lnStyleLst>';
    xml += '<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
    xml += '<a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
    xml += '<a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
    xml += '</a:lnStyleLst>';
    xml += '<a:effectStyleLst>';
    xml += '<a:effectStyle><a:effectLst/></a:effectStyle>';
    xml += '<a:effectStyle><a:effectLst/></a:effectStyle>';
    xml += '<a:effectStyle><a:effectLst/></a:effectStyle>';
    xml += '</a:effectStyleLst>';
    xml += '<a:bgFillStyleLst>';
    xml += '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    xml += '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    xml += '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    xml += '</a:bgFillStyleLst>';
    xml += '</a:fmtScheme>';

    xml += '</a:themeElements>';
    xml += '<a:objectDefaults/>';
    xml += '<a:extraClrSchemeLst/>';
    xml += '</a:theme>';
    return xml;
  }

  function _buildSlideMaster() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<p:sldMaster xmlns:a="' + NS_A + '" xmlns:r="' + NS_R + '" xmlns:p="' + NS_P + '">';
    xml += '<p:cSld>';
    xml += '<p:bg>';
    xml += '<p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef>';
    xml += '</p:bg>';
    xml += '<p:spTree>';
    xml += '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>';
    xml += '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>';
    xml += '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
    xml += '</p:spTree>';
    xml += '</p:cSld>';
    xml += '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
    xml += '<p:sldLayoutIdLst>';
    xml += '<p:sldLayoutId id="2147483649" r:id="rId1"/>';
    xml += '</p:sldLayoutIdLst>';
    xml += '</p:sldMaster>';
    return xml;
  }

  function _buildSlideMasterRels() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Relationships xmlns="' + NS_REL + '">';
    xml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';
    xml += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>';
    xml += '</Relationships>';
    return xml;
  }

  function _buildSlideLayout() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<p:sldLayout xmlns:a="' + NS_A + '" xmlns:r="' + NS_R + '" xmlns:p="' + NS_P + '" type="blank" preserve="1">';
    xml += '<p:cSld name="Blank">';
    xml += '<p:spTree>';
    xml += '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>';
    xml += '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>';
    xml += '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
    xml += '</p:spTree>';
    xml += '</p:cSld>';
    xml += '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>';
    xml += '</p:sldLayout>';
    return xml;
  }

  function _buildSlideLayoutRels() {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Relationships xmlns="' + NS_REL + '">';
    xml += '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>';
    xml += '</Relationships>';
    return xml;
  }

  function _buildCoreProps(metadata) {
    const now = new Date().toISOString();
    const title = _escapeXml(metadata.title || '');
    const author = _escapeXml(metadata.author || '');
    const created = metadata.created ? metadata.created.toISOString() : now;
    const modified = metadata.modified ? metadata.modified.toISOString() : now;

    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<cp:coreProperties xmlns:cp="' + NS_CP + '"';
    xml += ' xmlns:dc="' + NS_DC + '"';
    xml += ' xmlns:dcterms="' + NS_DCTERMS + '"';
    xml += ' xmlns:xsi="' + NS_XSI + '">';
    xml += '<dc:title>' + title + '</dc:title>';
    xml += '<dc:creator>' + author + '</dc:creator>';
    xml += '<dcterms:created xsi:type="dcterms:W3CDTF">' + created + '</dcterms:created>';
    xml += '<dcterms:modified xsi:type="dcterms:W3CDTF">' + modified + '</dcterms:modified>';
    xml += '</cp:coreProperties>';
    return xml;
  }

  function _buildAppProps(slideCount) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    xml += '<Properties xmlns="' + NS_EP + '">';
    xml += '<Application>SZ Presentations</Application>';
    xml += '<Slides>' + slideCount + '</Slides>';
    xml += '<ScaleCrop>false</ScaleCrop>';
    xml += '<LinksUpToDate>false</LinksUpToDate>';
    xml += '<SharedDoc>false</SharedDoc>';
    xml += '<HyperlinksChanged>false</HyperlinksChanged>';
    xml += '</Properties>';
    return xml;
  }

  // ── Connector Shape XML ──────────────────────────────────────────

  function _buildConnectorXml(el, shapeId, slide) {
    // Export as p:cxnSp (connection shape)
    let sx = el.startX || 0;
    let sy = el.startY || 0;
    let ex = el.endX || 100;
    let ey = el.endY || 100;

    // Compute bounding box
    const minX = Math.min(sx, ex);
    const minY = Math.min(sy, ey);
    const maxX = Math.max(sx, ex);
    const maxY = Math.max(sy, ey);
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);

    const xEmu = _pxToEmu(minX);
    const yEmu = _pxToEmu(minY);
    const wEmu = _pxToEmu(w);
    const hEmu = _pxToEmu(h);
    const lineColor = (el.lineColor || '#666666').replace('#', '');
    const lineWidth = _pxToEmu(el.lineWidth || 2);

    // Determine geometry preset
    const routeType = el.routeType || 'straight';
    const prstGeom = routeType === 'curved' ? 'curvedConnector3'
      : routeType === 'elbow' ? 'bentConnector3'
      : 'straightConnector1';

    // Flip attributes if needed
    const flipH = ex < sx ? ' flipH="1"' : '';
    const flipV = ey < sy ? ' flipV="1"' : '';

    let xml = '<p:cxnSp>';
    xml += '<p:nvCxnSpPr>';
    xml += '<p:cNvPr id="' + shapeId + '" name="Connector ' + shapeId + '"/>';
    xml += '<p:cNvCxnSpPr/>';
    xml += '<p:nvPr/>';
    xml += '</p:nvCxnSpPr>';
    xml += '<p:spPr>';
    xml += '<a:xfrm' + flipH + flipV + '>';
    xml += '<a:off x="' + xEmu + '" y="' + yEmu + '"/>';
    xml += '<a:ext cx="' + wEmu + '" cy="' + hEmu + '"/>';
    xml += '</a:xfrm>';
    xml += '<a:prstGeom prst="' + prstGeom + '"><a:avLst/></a:prstGeom>';
    xml += '<a:ln w="' + lineWidth + '">';
    xml += '<a:solidFill><a:srgbClr val="' + lineColor + '"/></a:solidFill>';

    // Dash style
    const lineDash = el.lineDash || 'solid';
    if (lineDash === 'dashed')
      xml += '<a:prstDash val="dash"/>';
    else if (lineDash === 'dotted')
      xml += '<a:prstDash val="dot"/>';

    // Arrow heads
    const endArrow = el.endArrow === true ? 'arrow' : el.endArrow === false ? 'none' : (el.endArrow || 'none');
    const startArrow = el.startArrow === true ? 'arrow' : el.startArrow === false ? 'none' : (el.startArrow || 'none');
    if (endArrow === 'arrow')
      xml += '<a:tailEnd type="triangle"/>';
    else if (endArrow === 'diamond')
      xml += '<a:tailEnd type="diamond"/>';
    else if (endArrow === 'circle')
      xml += '<a:tailEnd type="oval"/>';
    if (startArrow === 'arrow')
      xml += '<a:headEnd type="triangle"/>';
    else if (startArrow === 'diamond')
      xml += '<a:headEnd type="diamond"/>';
    else if (startArrow === 'circle')
      xml += '<a:headEnd type="oval"/>';

    xml += '</a:ln>';
    xml += '</p:spPr>';
    xml += '</p:cxnSp>';
    return xml;
  }

  // ── SmartArt Group XML ─────────────────────────────────────────

  function _buildSmartArtGroupXml(el, shapeId) {
    // Export SmartArt as a group of shapes (p:grpSp) since full OOXML SmartArt dgm:* is very complex
    const xEmu = _pxToEmu(el.x || 0);
    const yEmu = _pxToEmu(el.y || 0);
    const wEmu = _pxToEmu(el.w || 400);
    const hEmu = _pxToEmu(el.h || 300);

    let xml = '<p:grpSp>';
    xml += '<p:nvGrpSpPr>';
    xml += '<p:cNvPr id="' + shapeId + '" name="SmartArt ' + shapeId + '"/>';
    xml += '<p:cNvGrpSpPr/>';
    xml += '<p:nvPr/>';
    xml += '</p:nvGrpSpPr>';
    xml += '<p:grpSpPr>';
    xml += '<a:xfrm>';
    xml += '<a:off x="' + xEmu + '" y="' + yEmu + '"/>';
    xml += '<a:ext cx="' + wEmu + '" cy="' + hEmu + '"/>';
    xml += '<a:chOff x="0" y="0"/>';
    xml += '<a:chExt cx="' + wEmu + '" cy="' + hEmu + '"/>';
    xml += '</a:xfrm>';
    xml += '</p:grpSpPr>';

    // Render each node as a child shape
    const engine = PA.SmartArtEngine;
    if (engine) {
      const layout = engine.layoutSmartArt(el);
      let childId = shapeId + 1;
      for (const item of layout) {
        const nx = _pxToEmu(item.x);
        const ny = _pxToEmu(item.y);
        const nw = _pxToEmu(item.w);
        const nh = _pxToEmu(item.h);
        const fill = (item.color || '#4472C4').replace('#', '');
        const text = item.node.text || '';

        xml += '<p:sp>';
        xml += '<p:nvSpPr>';
        xml += '<p:cNvPr id="' + childId + '" name="Node ' + childId + '"/>';
        xml += '<p:cNvSpPr/>';
        xml += '<p:nvPr/>';
        xml += '</p:nvSpPr>';
        xml += '<p:spPr>';
        xml += '<a:xfrm><a:off x="' + nx + '" y="' + ny + '"/><a:ext cx="' + nw + '" cy="' + nh + '"/></a:xfrm>';
        xml += '<a:prstGeom prst="' + (item.shape === 'circle' ? 'ellipse' : 'roundRect') + '"><a:avLst/></a:prstGeom>';
        xml += '<a:solidFill><a:srgbClr val="' + fill + '"/></a:solidFill>';
        xml += '<a:ln w="12700"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill></a:ln>';
        xml += '</p:spPr>';
        xml += '<p:txBody>';
        xml += '<a:bodyPr wrap="square" rtlCol="0" anchor="ctr"/>';
        xml += '<a:lstStyle/>';
        xml += '<a:p><a:pPr algn="ctr"/>';
        xml += '<a:r><a:rPr lang="en-US" sz="1200" b="1" dirty="0"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill></a:rPr>';
        xml += '<a:t>' + _escapeXml(text) + '</a:t></a:r>';
        xml += '<a:endParaRPr lang="en-US" dirty="0"/></a:p>';
        xml += '</p:txBody>';
        xml += '</p:sp>';
        ++childId;
      }
    }

    xml += '</p:grpSp>';
    return xml;
  }

  // ── Connector Import ───────────────────────────────────────────

  function _parseConnectorShape(cxnSp, themeColors, elIndex) {
    const spPr = cxnSp.getElementsByTagNameNS(NS_P, 'spPr')[0]
      || cxnSp.getElementsByTagNameNS(NS_A, 'spPr')[0];

    let x = 0, y = 0, w = 100, h = 0;
    let flipH = false, flipV = false;

    if (spPr) {
      const xfrm = spPr.getElementsByTagNameNS(NS_A, 'xfrm')[0];
      if (xfrm) {
        flipH = xfrm.getAttribute('flipH') === '1';
        flipV = xfrm.getAttribute('flipV') === '1';
        const off = xfrm.getElementsByTagNameNS(NS_A, 'off')[0];
        if (off) {
          x = _emuToPx(parseInt(off.getAttribute('x'), 10) || 0);
          y = _emuToPx(parseInt(off.getAttribute('y'), 10) || 0);
        }
        const ext = xfrm.getElementsByTagNameNS(NS_A, 'ext')[0];
        if (ext) {
          w = _emuToPx(parseInt(ext.getAttribute('cx'), 10) || 0);
          h = _emuToPx(parseInt(ext.getAttribute('cy'), 10) || 0);
        }
      }

      // Detect route type from geometry preset
      let routeType = 'straight';
      const prstGeom = spPr.getElementsByTagNameNS(NS_A, 'prstGeom')[0];
      if (prstGeom) {
        const prst = prstGeom.getAttribute('prst') || '';
        if (prst.includes('curved'))
          routeType = 'curved';
        else if (prst.includes('bent'))
          routeType = 'elbow';
      }

      // Parse line properties
      let lineColor = '#666666';
      let lineWidth = 2;
      let lineDash = 'solid';
      let startArrow = 'none';
      let endArrow = 'none';

      const ln = spPr.getElementsByTagNameNS(NS_A, 'ln')[0];
      if (ln) {
        const lnW = ln.getAttribute('w');
        if (lnW)
          lineWidth = Math.max(1, Math.round(parseInt(lnW, 10) / EMU_PER_PX));

        const lnFill = ln.getElementsByTagNameNS(NS_A, 'solidFill')[0];
        if (lnFill) {
          const c = _parseColor(lnFill, themeColors);
          if (c)
            lineColor = c;
        }

        const prstDash = ln.getElementsByTagNameNS(NS_A, 'prstDash')[0];
        if (prstDash) {
          const val = prstDash.getAttribute('val');
          if (val === 'dash')
            lineDash = 'dashed';
          else if (val === 'dot')
            lineDash = 'dotted';
        }

        const tailEnd = ln.getElementsByTagNameNS(NS_A, 'tailEnd')[0];
        if (tailEnd) {
          const type = tailEnd.getAttribute('type');
          if (type === 'triangle')
            endArrow = 'arrow';
          else if (type === 'diamond')
            endArrow = 'diamond';
          else if (type === 'oval')
            endArrow = 'circle';
        }

        const headEnd = ln.getElementsByTagNameNS(NS_A, 'headEnd')[0];
        if (headEnd) {
          const type = headEnd.getAttribute('type');
          if (type === 'triangle')
            startArrow = 'arrow';
          else if (type === 'diamond')
            startArrow = 'diamond';
          else if (type === 'oval')
            startArrow = 'circle';
        }
      }

      // Compute start and end points
      const sx = flipH ? x + w : x;
      const sy = flipV ? y + h : y;
      const ex = flipH ? x : x + w;
      const ey = flipV ? y : y + h;

      return {
        id: 'el-' + elIndex,
        type: 'connector',
        x: 0, y: 0, w: 960, h: 540,
        startElementId: null,
        endElementId: null,
        startPoint: 'right',
        endPoint: 'left',
        startX: sx,
        startY: sy,
        endX: ex,
        endY: ey,
        routeType,
        lineColor,
        lineWidth,
        lineDash,
        startArrow,
        endArrow,
        rotation: 0,
        opacity: 1
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // Module Export
  // ═══════════════════════════════════════════════════════════════

  PA.PptxEngine = { loadPptx, savePptx };

})();
