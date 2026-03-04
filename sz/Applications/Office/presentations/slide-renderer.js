;(function() {
  'use strict';

  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const CANVAS_W = 960;
  const CANVAS_H = 540;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // -----------------------------------------------------------------------
  // ID generation
  // -----------------------------------------------------------------------
  const _generateId = () => 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

  // -----------------------------------------------------------------------
  // Layout placeholder definitions (x, y, w, h) for 960x540 canvas
  // -----------------------------------------------------------------------
  const LAYOUT_PLACEHOLDERS = {
    'title': [
      { role: 'title', x: 160, y: 180, w: 640, h: 80, placeholder: 'Click to add title' },
      { role: 'subtitle', x: 240, y: 300, w: 480, h: 40, placeholder: 'Click to add subtitle' }
    ],
    'title-content': [
      { role: 'title', x: 50, y: 20, w: 860, h: 60, placeholder: 'Click to add title' },
      { role: 'content', x: 50, y: 100, w: 860, h: 420, placeholder: 'Click to add text' }
    ],
    'section': [
      { role: 'header', x: 100, y: 200, w: 760, h: 60, placeholder: 'Section Header' },
      { role: 'subtext', x: 200, y: 280, w: 560, h: 40, placeholder: 'Description' }
    ],
    'blank': [],
    'two-content': [
      { role: 'title', x: 50, y: 20, w: 860, h: 60, placeholder: 'Click to add title' },
      { role: 'left', x: 50, y: 100, w: 410, h: 420, placeholder: 'Click to add text' },
      { role: 'right', x: 500, y: 100, w: 410, h: 420, placeholder: 'Click to add text' }
    ],
    'comparison': [
      { role: 'title', x: 50, y: 20, w: 860, h: 60, placeholder: 'Click to add title' },
      { role: 'left-header', x: 50, y: 80, w: 410, h: 30, placeholder: 'Heading' },
      { role: 'left-content', x: 50, y: 120, w: 410, h: 400, placeholder: 'Click to add text' },
      { role: 'right-header', x: 500, y: 80, w: 410, h: 30, placeholder: 'Heading' },
      { role: 'right-content', x: 500, y: 120, w: 410, h: 400, placeholder: 'Click to add text' }
    ]
  };

  // -----------------------------------------------------------------------
  // Shape SVG generators -- each returns an SVG element sized to (w, h)
  // -----------------------------------------------------------------------
  const _createSvgRoot = (w, h) => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    return svg;
  };

  const SHAPE_BUILDERS = {
    rect(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', '0');
      r.setAttribute('y', '0');
      r.setAttribute('width', w);
      r.setAttribute('height', h);
      r.setAttribute('fill', fill);
      svg.appendChild(r);
      return svg;
    },

    ellipse(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const e = document.createElementNS(SVG_NS, 'ellipse');
      e.setAttribute('cx', w / 2);
      e.setAttribute('cy', h / 2);
      e.setAttribute('rx', w / 2);
      e.setAttribute('ry', h / 2);
      e.setAttribute('fill', fill);
      svg.appendChild(e);
      return svg;
    },

    'rounded-rect'(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const r = document.createElementNS(SVG_NS, 'rect');
      const radius = Math.min(w, h) * 0.15;
      r.setAttribute('x', '0');
      r.setAttribute('y', '0');
      r.setAttribute('width', w);
      r.setAttribute('height', h);
      r.setAttribute('rx', radius);
      r.setAttribute('ry', radius);
      r.setAttribute('fill', fill);
      svg.appendChild(r);
      return svg;
    },

    triangle(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      p.setAttribute('points', `${w / 2},0 ${w},${h} 0,${h}`);
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    'arrow-right'(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      const shaftTop = h * 0.25;
      const shaftBot = h * 0.75;
      const headStart = w * 0.6;
      p.setAttribute('points', [
        `0,${shaftTop}`,
        `${headStart},${shaftTop}`,
        `${headStart},0`,
        `${w},${h / 2}`,
        `${headStart},${h}`,
        `${headStart},${shaftBot}`,
        `0,${shaftBot}`
      ].join(' '));
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    'arrow-left'(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      const shaftTop = h * 0.25;
      const shaftBot = h * 0.75;
      const headEnd = w * 0.4;
      p.setAttribute('points', [
        `0,${h / 2}`,
        `${headEnd},0`,
        `${headEnd},${shaftTop}`,
        `${w},${shaftTop}`,
        `${w},${shaftBot}`,
        `${headEnd},${shaftBot}`,
        `${headEnd},${h}`
      ].join(' '));
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    star(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      const cx = w / 2;
      const cy = h / 2;
      const outerR = Math.min(cx, cy);
      const innerR = outerR * 0.38;
      const points = [];
      for (let i = 0; i < 10; ++i) {
        const angle = (Math.PI / 2 * -1) + (Math.PI / 5) * i;
        const r = i % 2 === 0 ? outerR : innerR;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      p.setAttribute('points', points.join(' '));
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    diamond(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      p.setAttribute('points', `${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`);
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    pentagon(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const points = [];
      for (let i = 0; i < 5; ++i) {
        const angle = (Math.PI / 2 * -1) + (2 * Math.PI / 5) * i;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      p.setAttribute('points', points.join(' '));
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    hexagon(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const p = document.createElementNS(SVG_NS, 'polygon');
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy);
      const points = [];
      for (let i = 0; i < 6; ++i) {
        const angle = (2 * Math.PI / 6) * i;
        points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      p.setAttribute('points', points.join(' '));
      p.setAttribute('fill', fill);
      svg.appendChild(p);
      return svg;
    },

    callout(w, h, fill) {
      const svg = _createSvgRoot(w, h);
      const bodyH = h * 0.8;
      const tailW = w * 0.1;
      const tailCenterX = w * 0.25;
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', [
        `M 0,0`,
        `L ${w},0`,
        `L ${w},${bodyH}`,
        `L ${tailCenterX + tailW},${bodyH}`,
        `L ${tailCenterX},${h}`,
        `L ${tailCenterX - tailW * 0.2},${bodyH}`,
        `L 0,${bodyH}`,
        `Z`
      ].join(' '));
      path.setAttribute('fill', fill);
      svg.appendChild(path);
      return svg;
    }
  };

  // -----------------------------------------------------------------------
  // Element data constructors
  // -----------------------------------------------------------------------
  const createTextbox = (x, y, w, h, content) => ({
    id: _generateId(),
    type: 'textbox',
    x, y, w, h,
    content: '',
    placeholder: content || '',
    fontSize: 18,
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textAlign: 'left',
    color: '#000000',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    rotation: 0,
    opacity: 1
  });

  const createImageElement = (x, y, w, h, src) => ({
    id: _generateId(),
    type: 'image',
    x, y, w, h,
    src: src || '',
    objectFit: 'contain',
    borderColor: 'transparent',
    borderWidth: 0,
    rotation: 0,
    opacity: 1
  });

  const createShape = (x, y, w, h, shapeType, fillColor) => ({
    id: _generateId(),
    type: 'shape',
    x, y, w, h,
    shapeType: shapeType || 'rect',
    fillColor: fillColor || '#4472C4',
    strokeColor: 'transparent',
    strokeWidth: 0,
    rotation: 0,
    opacity: 1
  });

  const createTable = (x, y, w, h, rows, cols) => {
    const cells = [];
    for (let r = 0; r < rows; ++r) {
      const row = [];
      for (let c = 0; c < cols; ++c)
        row.push('');
      cells.push(row);
    }
    return {
      id: _generateId(),
      type: 'table',
      x, y, w, h,
      rows, cols,
      cells,
      headerRow: true,
      borderColor: '#8FAADC',
      headerBg: '#4472C4',
      headerColor: '#FFFFFF',
      cellBg: '#FFFFFF',
      cellColor: '#000000',
      altRowBg: '#D6E4F0',
      fontSize: 14,
      fontFamily: 'sans-serif',
      borderWidth: 1,
      rotation: 0,
      opacity: 1
    };
  };

  // -----------------------------------------------------------------------
  // Group element constructor (Feature 7)
  // -----------------------------------------------------------------------
  const createGroup = (elements) => {
    if (!elements || !elements.length)
      return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of elements) {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.y + el.h > maxY) maxY = el.y + el.h;
    }

    const children = elements.map(el => {
      const child = JSON.parse(JSON.stringify(el));
      child.x -= minX;
      child.y -= minY;
      return child;
    });

    return {
      id: _generateId(),
      type: 'group',
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      children,
      rotation: 0,
      opacity: 1
    };
  };

  const ungroupElement = (group) => {
    if (!group || group.type !== 'group')
      return [];

    return group.children.map(child => {
      const el = JSON.parse(JSON.stringify(child));
      el.x += group.x;
      el.y += group.y;
      return el;
    });
  };

  // -----------------------------------------------------------------------
  // Apply style properties from element data to a DOM element
  // -----------------------------------------------------------------------
  const applyElementStyle = (domEl, element) => {
    const s = domEl.style;
    s.position = 'absolute';
    s.left = element.x + 'px';
    s.top = element.y + 'px';
    s.width = element.w + 'px';
    s.height = element.h + 'px';
    s.opacity = element.opacity != null ? element.opacity : 1;
    s.overflow = 'hidden';
    s.boxSizing = 'border-box';

    // Build transform string from rotation + 3D effects
    const transforms = [];
    if (element.effects3d) {
      const e3d = element.effects3d;
      if (e3d.perspective)
        transforms.push(`perspective(${e3d.perspective}px)`);
      if (e3d.rotateX)
        transforms.push(`rotateX(${e3d.rotateX}deg)`);
      if (e3d.rotateY)
        transforms.push(`rotateY(${e3d.rotateY}deg)`);
    }
    if (element.rotation)
      transforms.push(`rotate(${element.rotation}deg)`);

    if (transforms.length) {
      s.transform = transforms.join(' ');
      s.transformOrigin = 'center center';
    } else {
      s.transform = '';
      s.transformOrigin = '';
    }

    // Shadow (Feature 24)
    if (element.shadow) {
      const sh = element.shadow;
      const inset = sh.inner ? 'inset ' : '';
      s.boxShadow = `${inset}${sh.offsetX || 2}px ${sh.offsetY || 2}px ${sh.blur || 4}px ${sh.color || 'rgba(0,0,0,0.3)'}`;
    } else {
      s.boxShadow = '';
    }

    if (element.borderWidth && element.borderColor && element.borderColor !== 'transparent')
      s.border = `${element.borderWidth}px solid ${element.borderColor}`;
    else
      s.border = 'none';

    if (element.borderRadius)
      s.borderRadius = element.borderRadius + 'px';
  };

  // -----------------------------------------------------------------------
  // DOM builders for each element type
  // -----------------------------------------------------------------------
  const _buildTextboxDom = (element, editable) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-textbox';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);

    if (element.backgroundColor && element.backgroundColor !== 'transparent')
      wrapper.style.backgroundColor = element.backgroundColor;

    // Hyperlink indicator (Feature 8)
    if (element.hyperlink && element.hyperlink.url)
      wrapper.classList.add('has-hyperlink');

    const inner = document.createElement('div');
    inner.style.width = '100%';
    inner.style.height = '100%';
    inner.style.fontSize = (element.fontSize || 18) + 'px';
    inner.style.fontFamily = element.fontFamily || 'sans-serif';
    inner.style.fontWeight = element.fontWeight || 'normal';
    inner.style.fontStyle = element.fontStyle || 'normal';
    inner.style.textAlign = element.textAlign || 'left';
    inner.style.color = element.color || '#000000';
    inner.style.outline = 'none';
    inner.style.wordWrap = 'break-word';
    inner.style.overflowWrap = 'break-word';
    inner.style.whiteSpace = 'pre-wrap';

    if (editable)
      inner.contentEditable = 'true';

    // Text effects (Feature 26)
    if (element.textShadow)
      inner.style.textShadow = element.textShadow;
    if (element.textGlow)
      inner.style.textShadow = element.textGlow;
    if (element.textReflection) {
      inner.style.position = 'relative';
      inner.style.overflow = 'visible';
    }

    // Show placeholder text when content is empty
    const hasContent = element.content && element.content.replace(/<[^>]*>/g, '').trim().length > 0;
    if (!hasContent && element.placeholder) {
      wrapper.classList.add('placeholder-empty');
      inner.innerHTML = element.placeholder;
      inner.style.color = '#999';
      if (editable) {
        inner.addEventListener('focus', function _onFocus() {
          if (wrapper.classList.contains('placeholder-empty')) {
            wrapper.classList.remove('placeholder-empty');
            inner.innerHTML = '';
            inner.style.color = element.color || '#000000';
          }
        }, { once: true });
      }
    } else {
      inner.innerHTML = element.content || '';
    }

    // Text reflection pseudo-effect via cloned node
    if (element.textReflection) {
      const reflection = document.createElement('div');
      reflection.style.cssText = 'position:absolute;left:0;right:0;top:100%;height:50%;overflow:hidden;pointer-events:none;transform:scaleY(-1);opacity:0.2;mask-image:linear-gradient(transparent,black);-webkit-mask-image:linear-gradient(transparent,black);';
      reflection.innerHTML = inner.innerHTML;
      reflection.style.fontSize = inner.style.fontSize;
      reflection.style.fontFamily = inner.style.fontFamily;
      reflection.style.fontWeight = inner.style.fontWeight;
      reflection.style.fontStyle = inner.style.fontStyle;
      reflection.style.textAlign = inner.style.textAlign;
      reflection.style.color = inner.style.color;
      wrapper.style.overflow = 'visible';
      wrapper.appendChild(reflection);
    }

    wrapper.appendChild(inner);
    return wrapper;
  };

  const _buildImageDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-image';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);

    // Hyperlink indicator (Feature 8)
    if (element.hyperlink && element.hyperlink.url)
      wrapper.classList.add('has-hyperlink');

    const img = document.createElement('img');
    img.src = element.src || '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = element.objectFit || 'contain';
    img.style.display = 'block';
    img.style.pointerEvents = 'none';
    img.draggable = false;

    // Alt text for accessibility
    if (element.altText) {
      img.alt = element.altText.description || element.altText.title || '';
      if (element.altText.title)
        img.title = element.altText.title;
    } else
      img.alt = '';

    wrapper.appendChild(img);
    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Advanced fill helpers (Feature 25)
  // -----------------------------------------------------------------------
  const _applyAdvancedFill = (svg, shapeEls, element) => {
    const fill = element.fill;
    if (!fill || fill.type === 'solid')
      return; // already applied as solid color

    const defs = document.createElementNS(SVG_NS, 'defs');
    const fillId = 'fill-' + element.id;

    if (fill.type === 'gradient') {
      const grad = document.createElementNS(SVG_NS, 'linearGradient');
      grad.setAttribute('id', fillId);
      const angle = fill.angle || 0;
      const rad = angle * Math.PI / 180;
      grad.setAttribute('x1', (50 - 50 * Math.cos(rad)) + '%');
      grad.setAttribute('y1', (50 - 50 * Math.sin(rad)) + '%');
      grad.setAttribute('x2', (50 + 50 * Math.cos(rad)) + '%');
      grad.setAttribute('y2', (50 + 50 * Math.sin(rad)) + '%');

      const stops = fill.stops || [{ offset: 0, color: '#fff' }, { offset: 1, color: '#4472C4' }];
      for (const stop of stops) {
        const s = document.createElementNS(SVG_NS, 'stop');
        s.setAttribute('offset', (stop.offset * 100) + '%');
        s.setAttribute('stop-color', stop.color);
        grad.appendChild(s);
      }
      defs.appendChild(grad);
    } else if (fill.type === 'pattern') {
      const pat = document.createElementNS(SVG_NS, 'pattern');
      pat.setAttribute('id', fillId);
      pat.setAttribute('patternUnits', 'userSpaceOnUse');
      const patSize = 10;
      pat.setAttribute('width', patSize);
      pat.setAttribute('height', patSize);

      const bg = document.createElementNS(SVG_NS, 'rect');
      bg.setAttribute('width', patSize);
      bg.setAttribute('height', patSize);
      bg.setAttribute('fill', fill.backgroundColor || '#fff');
      pat.appendChild(bg);

      const patternType = fill.patternType || 'stripes';
      const fgColor = fill.foregroundColor || '#4472C4';

      if (patternType === 'stripes') {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', 0); line.setAttribute('y1', 0);
        line.setAttribute('x2', patSize); line.setAttribute('y2', patSize);
        line.setAttribute('stroke', fgColor); line.setAttribute('stroke-width', 1.5);
        pat.appendChild(line);
      } else if (patternType === 'dots') {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', patSize / 2); circle.setAttribute('cy', patSize / 2);
        circle.setAttribute('r', 1.5); circle.setAttribute('fill', fgColor);
        pat.appendChild(circle);
      } else if (patternType === 'crosshatch') {
        const l1 = document.createElementNS(SVG_NS, 'line');
        l1.setAttribute('x1', 0); l1.setAttribute('y1', 0);
        l1.setAttribute('x2', patSize); l1.setAttribute('y2', patSize);
        l1.setAttribute('stroke', fgColor); l1.setAttribute('stroke-width', 1);
        pat.appendChild(l1);
        const l2 = document.createElementNS(SVG_NS, 'line');
        l2.setAttribute('x1', patSize); l2.setAttribute('y1', 0);
        l2.setAttribute('x2', 0); l2.setAttribute('y2', patSize);
        l2.setAttribute('stroke', fgColor); l2.setAttribute('stroke-width', 1);
        pat.appendChild(l2);
      }

      defs.appendChild(pat);
    } else if (fill.type === 'picture' && fill.src) {
      const pat = document.createElementNS(SVG_NS, 'pattern');
      pat.setAttribute('id', fillId);
      pat.setAttribute('patternUnits', 'objectBoundingBox');
      pat.setAttribute('width', '1'); pat.setAttribute('height', '1');
      const img = document.createElementNS(SVG_NS, 'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', fill.src);
      img.setAttribute('width', element.w);
      img.setAttribute('height', element.h);
      img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      pat.appendChild(img);
      defs.appendChild(pat);
    }

    svg.insertBefore(defs, svg.firstChild);

    const fillUrl = 'url(#' + fillId + ')';
    for (const el of shapeEls)
      el.setAttribute('fill', fillUrl);
  };

  const _buildShapeDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-shape';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);
    wrapper.style.border = 'none';

    // Hyperlink indicator (Feature 8)
    if (element.hyperlink && element.hyperlink.url)
      wrapper.classList.add('has-hyperlink');

    const builder = SHAPE_BUILDERS[element.shapeType];
    if (builder) {
      const baseFill = element.fill && element.fill.type !== 'solid'
        ? '#ccc' // placeholder, will be replaced by advanced fill
        : (element.fillColor || '#4472C4');
      const svg = builder(element.w, element.h, baseFill);

      if (element.strokeColor && element.strokeColor !== 'transparent' && element.strokeWidth) {
        const shapes = svg.querySelectorAll('rect, ellipse, polygon, path');
        shapes.forEach(s => {
          s.setAttribute('stroke', element.strokeColor);
          s.setAttribute('stroke-width', element.strokeWidth);
        });
      }

      // Advanced fill (Feature 25)
      if (element.fill && element.fill.type !== 'solid') {
        const shapeEls = svg.querySelectorAll('rect, ellipse, polygon, path');
        _applyAdvancedFill(svg, shapeEls, element);
      }

      wrapper.appendChild(svg);
    }

    return wrapper;
  };

  const _buildTableDom = (element, editable) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-table';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.height = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.tableLayout = 'fixed';
    table.style.fontSize = (element.fontSize || 14) + 'px';
    table.style.fontFamily = element.fontFamily || 'sans-serif';

    const rows = element.rows || 0;
    const cols = element.cols || 0;

    for (let r = 0; r < rows; ++r) {
      const tr = document.createElement('tr');
      const isHeader = element.headerRow && r === 0;

      for (let c = 0; c < cols; ++c) {
        const td = document.createElement(isHeader ? 'th' : 'td');
        td.style.border = `${element.borderWidth || 1}px solid ${element.borderColor || '#8FAADC'}`;
        td.style.padding = '4px 6px';
        td.style.verticalAlign = 'middle';
        td.style.overflow = 'hidden';
        td.style.textOverflow = 'ellipsis';
        td.style.outline = 'none';

        if (isHeader) {
          td.style.backgroundColor = element.headerBg || '#4472C4';
          td.style.color = element.headerColor || '#FFFFFF';
          td.style.fontWeight = 'bold';
        } else {
          const useAlt = r % 2 === 0;
          td.style.backgroundColor = useAlt ? (element.altRowBg || '#D6E4F0') : (element.cellBg || '#FFFFFF');
          td.style.color = element.cellColor || '#000000';
        }

        if (editable)
          td.contentEditable = 'true';

        const cellData = element.cells && element.cells[r] ? (element.cells[r][c] || '') : '';
        td.textContent = cellData;
        td.dataset.row = r;
        td.dataset.col = c;
        tr.appendChild(td);
      }

      table.appendChild(tr);
    }

    wrapper.appendChild(table);
    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Video element DOM builder (Feature 21)
  // -----------------------------------------------------------------------
  const _buildVideoDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-video';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);

    const video = document.createElement('video');
    video.src = element.src || '';
    video.controls = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'contain';
    video.style.display = 'block';
    video.style.background = '#000';
    video.preload = 'metadata';
    if (element.autoplay)
      video.autoplay = true;
    if (element.loop)
      video.loop = true;

    wrapper.appendChild(video);
    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Audio element DOM builder (Feature 21)
  // -----------------------------------------------------------------------
  const _buildAudioDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-audio';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);
    wrapper.style.background = '#f0f0f0';
    wrapper.style.borderRadius = '4px';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    // Speaker icon
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:32px;line-height:1;color:#4472c4;pointer-events:none;';
    icon.textContent = '\uD83D\uDD0A'; // speaker emoji
    wrapper.appendChild(icon);

    const label = document.createElement('div');
    label.style.cssText = 'font-size:10px;color:#666;margin-top:4px;pointer-events:none;';
    label.textContent = element.fileName || 'Audio';
    wrapper.appendChild(label);

    const audio = document.createElement('audio');
    audio.src = element.src || '';
    audio.controls = true;
    audio.style.width = '90%';
    audio.style.marginTop = '4px';
    audio.preload = 'metadata';
    wrapper.appendChild(audio);

    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Action Button element DOM builder (Feature 20)
  // -----------------------------------------------------------------------
  const ACTION_BUTTON_LABELS = {
    'next': '\u25B6 Next',
    'prev': '\u25C0 Previous',
    'first': '\u23EE First',
    'last': '\u23ED Last',
    'end': '\u23F9 End Show',
    'url': '\uD83D\uDD17 Link'
  };

  const _buildActionButtonDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-action-button';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    wrapper.style.background = element.fillColor || '#4472c4';
    wrapper.style.color = element.color || '#ffffff';
    wrapper.style.borderRadius = '6px';
    wrapper.style.cursor = 'pointer';
    wrapper.style.fontSize = (element.fontSize || 14) + 'px';
    wrapper.style.fontWeight = 'bold';
    wrapper.style.border = '2px solid ' + (element.strokeColor || '#3a62a8');
    wrapper.style.userSelect = 'none';

    const label = document.createElement('span');
    label.style.pointerEvents = 'none';
    label.textContent = element.label || ACTION_BUTTON_LABELS[element.action] || 'Action';
    wrapper.appendChild(label);

    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Chart element DOM builder (Feature 23)
  // -----------------------------------------------------------------------
  const _buildChartDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-chart';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);
    wrapper.style.background = '#fff';

    if (PresentationsApp.ChartElement)
      PresentationsApp.ChartElement.renderChart(element, wrapper);
    else {
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.color = '#999';
      wrapper.style.fontSize = '14px';
      wrapper.textContent = '[Chart]';
    }

    return wrapper;
  };

  // -----------------------------------------------------------------------
  // SmartArt element DOM builder (Feature 29)
  // -----------------------------------------------------------------------
  const _buildSmartArtDom = (element) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-smartart';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);

    if (PresentationsApp.SmartArtEngine)
      PresentationsApp.SmartArtEngine.renderSmartArt(element, wrapper);
    else {
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.color = '#999';
      wrapper.style.fontSize = '14px';
      wrapper.textContent = '[SmartArt]';
    }

    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Connector element DOM builder (Feature 27)
  // -----------------------------------------------------------------------

  const _MARKER_SIZE = 10;

  const _buildMarker = (type, id, lineColor, atEnd) => {
    if (!type || type === 'none')
      return null;

    const marker = document.createElementNS(SVG_NS, 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');

    if (type === 'arrow') {
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('refX', atEnd ? '10' : '0');
      marker.setAttribute('refY', '3.5');
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', atEnd ? '0 0, 10 3.5, 0 7' : '10 0, 0 3.5, 10 7');
      poly.setAttribute('fill', lineColor);
      marker.appendChild(poly);
    } else if (type === 'diamond') {
      marker.setAttribute('markerWidth', '10');
      marker.setAttribute('markerHeight', '10');
      marker.setAttribute('refX', '5');
      marker.setAttribute('refY', '5');
      const poly = document.createElementNS(SVG_NS, 'polygon');
      poly.setAttribute('points', '5 0, 10 5, 5 10, 0 5');
      poly.setAttribute('fill', lineColor);
      marker.appendChild(poly);
    } else if (type === 'circle') {
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '8');
      marker.setAttribute('refX', '4');
      marker.setAttribute('refY', '4');
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', '4');
      circle.setAttribute('cy', '4');
      circle.setAttribute('r', '3.5');
      circle.setAttribute('fill', lineColor);
      marker.appendChild(circle);
    }

    return marker;
  };

  const _applyLineDash = (pathEl, lineDash) => {
    if (!lineDash || lineDash === 'solid')
      return;
    if (lineDash === 'dashed')
      pathEl.setAttribute('stroke-dasharray', '8 4');
    else if (lineDash === 'dotted')
      pathEl.setAttribute('stroke-dasharray', '2 4');
  };

  const _buildConnectorDom = (element, slide) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-connector';
    wrapper.dataset.elementId = element.id;
    wrapper.style.position = 'absolute';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    wrapper.style.width = CANVAS_W + 'px';
    wrapper.style.height = CANVAS_H + 'px';
    wrapper.style.overflow = 'visible';
    wrapper.style.pointerEvents = 'none';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + CANVAS_W + ' ' + CANVAS_H);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.overflow = 'visible';

    // Find start and end positions
    let sx = element.startX ?? 0;
    let sy = element.startY ?? 0;
    let ex = element.endX ?? 100;
    let ey = element.endY ?? 100;

    // If connected to elements, compute positions from them (auto-update)
    if (slide && element.startElementId) {
      const startEl = (slide.elements || []).find(e => e.id === element.startElementId);
      if (startEl) {
        const anchor = element.startPoint || _autoSelectAnchor(startEl, element, slide, true);
        const sp = _getConnectionPoint(startEl, anchor);
        sx = sp.x;
        sy = sp.y;
        // Persist computed coordinates for freestanding fallback
        element.startX = sx;
        element.startY = sy;
      }
    }
    if (slide && element.endElementId) {
      const endEl = (slide.elements || []).find(e => e.id === element.endElementId);
      if (endEl) {
        const anchor = element.endPoint || _autoSelectAnchor(endEl, element, slide, false);
        const ep = _getConnectionPoint(endEl, anchor);
        ex = ep.x;
        ey = ep.y;
        element.endX = ex;
        element.endY = ey;
      }
    }

    const lineColor = element.lineColor || '#666';
    const lineWidth = element.lineWidth || 2;
    const routeType = element.routeType || 'straight';
    const lineDash = element.lineDash || 'solid';

    // Normalize arrow types (support legacy boolean values)
    const startArrowType = element.startArrow === true ? 'arrow'
      : element.startArrow === false ? 'none'
      : (element.startArrow || 'none');
    const endArrowType = element.endArrow === true ? 'arrow'
      : element.endArrow === false ? 'none'
      : (element.endArrow || 'arrow');

    // Build markers in <defs>
    const defs = document.createElementNS(SVG_NS, 'defs');
    const endMarker = _buildMarker(endArrowType, 'arrow-end-' + element.id, lineColor, true);
    if (endMarker)
      defs.appendChild(endMarker);
    const startMarker = _buildMarker(startArrowType, 'arrow-start-' + element.id, lineColor, false);
    if (startMarker)
      defs.appendChild(startMarker);
    svg.appendChild(defs);

    let pathEl;
    if (routeType === 'elbow') {
      const midX = (sx + ex) / 2;
      pathEl = document.createElementNS(SVG_NS, 'polyline');
      pathEl.setAttribute('points', `${sx},${sy} ${midX},${sy} ${midX},${ey} ${ex},${ey}`);
      pathEl.setAttribute('fill', 'none');
    } else if (routeType === 'curved') {
      pathEl = document.createElementNS(SVG_NS, 'path');
      const cx1 = sx + (ex - sx) * 0.4;
      const cy1 = sy;
      const cx2 = ex - (ex - sx) * 0.4;
      const cy2 = ey;
      pathEl.setAttribute('d', `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`);
      pathEl.setAttribute('fill', 'none');
    } else {
      pathEl = document.createElementNS(SVG_NS, 'line');
      pathEl.setAttribute('x1', sx);
      pathEl.setAttribute('y1', sy);
      pathEl.setAttribute('x2', ex);
      pathEl.setAttribute('y2', ey);
    }

    pathEl.setAttribute('stroke', lineColor);
    pathEl.setAttribute('stroke-width', lineWidth);
    _applyLineDash(pathEl, lineDash);

    if (endMarker)
      pathEl.setAttribute('marker-end', 'url(#arrow-end-' + element.id + ')');
    if (startMarker)
      pathEl.setAttribute('marker-start', 'url(#arrow-start-' + element.id + ')');

    // Make the line clickable with a wider hit area
    pathEl.style.pointerEvents = 'stroke';
    pathEl.style.cursor = 'pointer';

    svg.appendChild(pathEl);
    wrapper.appendChild(svg);
    return wrapper;
  };

  const _autoSelectAnchor = (targetEl, connector, slide, isStart) => {
    // Determine best anchor point by looking at the other endpoint
    const otherElId = isStart ? connector.endElementId : connector.startElementId;
    let otherCx, otherCy;
    if (otherElId && slide) {
      const otherEl = (slide.elements || []).find(e => e.id === otherElId);
      if (otherEl) {
        otherCx = otherEl.x + otherEl.w / 2;
        otherCy = otherEl.y + otherEl.h / 2;
      }
    }
    if (otherCx == null) {
      otherCx = isStart ? (connector.endX ?? CANVAS_W / 2) : (connector.startX ?? CANVAS_W / 2);
      otherCy = isStart ? (connector.endY ?? CANVAS_H / 2) : (connector.startY ?? CANVAS_H / 2);
    }

    const cx = targetEl.x + targetEl.w / 2;
    const cy = targetEl.y + targetEl.h / 2;
    const dx = otherCx - cx;
    const dy = otherCy - cy;

    if (Math.abs(dx) > Math.abs(dy))
      return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'bottom' : 'top';
  };

  const _getConnectionPoint = (el, point) => {
    const cx = el.x + el.w / 2;
    const cy = el.y + el.h / 2;
    switch (point) {
      case 'top': return { x: cx, y: el.y };
      case 'bottom': return { x: cx, y: el.y + el.h };
      case 'left': return { x: el.x, y: cy };
      case 'right': return { x: el.x + el.w, y: cy };
      case 'center': return { x: cx, y: cy };
      default: return { x: cx, y: cy };
    }
  };

  // -----------------------------------------------------------------------
  // Group element DOM builder (Feature 7)
  // -----------------------------------------------------------------------
  const _buildGroupDom = (element, editable) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element el-group';
    wrapper.dataset.elementId = element.id;
    applyElementStyle(wrapper, element);
    wrapper.style.overflow = 'visible';

    const children = element.children || [];
    for (let i = 0; i < children.length; ++i) {
      const child = children[i];
      let childDom = null;

      switch (child.type) {
        case 'textbox':
          childDom = _buildTextboxDom(child, editable);
          break;
        case 'image':
          childDom = _buildImageDom(child);
          break;
        case 'shape':
          childDom = _buildShapeDom(child);
          break;
        case 'table':
          childDom = _buildTableDom(child, editable);
          break;
        case 'group':
          childDom = _buildGroupDom(child, editable);
          break;
        case 'video':
          childDom = _buildVideoDom(child);
          break;
        case 'audio':
          childDom = _buildAudioDom(child);
          break;
        case 'action-button':
          childDom = _buildActionButtonDom(child);
          break;
        case 'chart':
          childDom = _buildChartDom(child);
          break;
        case 'smartart':
          childDom = _buildSmartArtDom(child);
          break;
      }

      if (childDom) {
        childDom.style.zIndex = i + 1;
        // Children use relative coordinates inside the group
        wrapper.appendChild(childDom);
      }
    }

    return wrapper;
  };

  // -----------------------------------------------------------------------
  // Guide lines overlay
  // -----------------------------------------------------------------------
  const _renderGuides = (container) => {
    const guides = document.createElement('div');
    guides.className = 'slide-guides';
    guides.style.position = 'absolute';
    guides.style.inset = '0';
    guides.style.pointerEvents = 'none';
    guides.style.zIndex = '9999';

    const centerV = document.createElement('div');
    centerV.style.cssText = 'position:absolute;left:50%;top:0;width:1px;height:100%;background:rgba(0,120,215,0.3);';
    guides.appendChild(centerV);

    const centerH = document.createElement('div');
    centerH.style.cssText = 'position:absolute;top:50%;left:0;width:100%;height:1px;background:rgba(0,120,215,0.3);';
    guides.appendChild(centerH);

    container.appendChild(guides);
  };

  // -----------------------------------------------------------------------
  // Footer overlay (Feature 9)
  // -----------------------------------------------------------------------
  const _renderFooterOverlay = (canvas, slide, headerFooter, slideIndex) => {
    if (!headerFooter)
      return;

    const isTitleSlide = slide.layout === 'title';
    if (isTitleSlide && headerFooter.dontShowOnTitle)
      return;

    const hasContent = headerFooter.showDate || headerFooter.showSlideNumber || headerFooter.showFooter;
    if (!hasContent)
      return;

    const footer = document.createElement('div');
    footer.className = 'slide-footer-overlay';

    const left = document.createElement('div');
    left.className = 'slide-footer-left';
    if (headerFooter.showDate)
      left.textContent = headerFooter.dateText || new Date().toLocaleDateString();

    const center = document.createElement('div');
    center.className = 'slide-footer-center';
    if (headerFooter.showFooter)
      center.textContent = headerFooter.footerText || '';

    const right = document.createElement('div');
    right.className = 'slide-footer-right';
    if (headerFooter.showSlideNumber)
      right.textContent = String(slideIndex + 1);

    footer.appendChild(left);
    footer.appendChild(center);
    footer.appendChild(right);
    canvas.appendChild(footer);
  };

  // -----------------------------------------------------------------------
  // Render a full slide into a container
  // -----------------------------------------------------------------------
  const renderSlide = (slide, container, options) => {
    const opts = options || {};
    const editable = !!opts.editable;
    const scale = opts.scale || 1;
    const showGuides = !!opts.showGuides;
    const headerFooter = opts.headerFooter || null;
    const slideIndex = opts.slideIndex != null ? opts.slideIndex : 0;

    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = (CANVAS_W * scale) + 'px';
    container.style.height = (CANVAS_H * scale) + 'px';
    container.style.overflow = 'hidden';

    if (scale !== 1) {
      container.style.transformOrigin = '0 0';
      // We size the container at scaled dimensions but the inner canvas at native,
      // then scale the inner wrapper
    }

    const canvas = document.createElement('div');
    canvas.className = 'slide-canvas';
    canvas.style.position = 'relative';
    canvas.style.width = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    canvas.style.transformOrigin = '0 0';

    if (scale !== 1)
      canvas.style.transform = `scale(${scale})`;

    // Background
    if (slide.background) {
      if (slide.background.type === 'image' && slide.background.src)
        canvas.style.background = `url('${slide.background.src}') center/cover no-repeat`;
      else if (slide.background.type === 'gradient' && slide.background.value)
        canvas.style.background = slide.background.value;
      else if (slide.background.type === 'color' && slide.background.value)
        canvas.style.backgroundColor = slide.background.value;
      else
        canvas.style.backgroundColor = '#FFFFFF';
    } else {
      canvas.style.backgroundColor = '#FFFFFF';
    }

    // Elements
    const elements = slide.elements || [];
    for (let i = 0; i < elements.length; ++i) {
      const el = elements[i];
      let dom = null;

      switch (el.type) {
        case 'textbox':
          dom = _buildTextboxDom(el, editable);
          break;
        case 'image':
          dom = _buildImageDom(el);
          break;
        case 'shape':
          dom = _buildShapeDom(el);
          break;
        case 'table':
          dom = _buildTableDom(el, editable);
          break;
        case 'group':
          dom = _buildGroupDom(el, editable);
          break;
        case 'video':
          dom = _buildVideoDom(el);
          break;
        case 'audio':
          dom = _buildAudioDom(el);
          break;
        case 'action-button':
          dom = _buildActionButtonDom(el);
          break;
        case 'chart':
          dom = _buildChartDom(el);
          break;
        case 'smartart':
          dom = _buildSmartArtDom(el);
          break;
        case 'connector':
          dom = _buildConnectorDom(el, slide);
          break;
      }

      if (dom) {
        dom.style.zIndex = i + 1;
        canvas.appendChild(dom);
      }
    }

    // Footer overlay (Feature 9)
    if (headerFooter)
      _renderFooterOverlay(canvas, slide, headerFooter, slideIndex);

    if (showGuides)
      _renderGuides(canvas);

    container.appendChild(canvas);
  };

  // -----------------------------------------------------------------------
  // Render a thumbnail (non-editable, small scale)
  // -----------------------------------------------------------------------
  const renderThumbnail = (slide, container, theme) => {
    const thumbScale = container.offsetWidth ? container.offsetWidth / CANVAS_W : 0.15;
    renderSlide(slide, container, { editable: false, scale: thumbScale, showGuides: false });
  };

  // -----------------------------------------------------------------------
  // Layout placeholders
  // -----------------------------------------------------------------------
  const getLayoutPlaceholders = (layout) => {
    const key = layout || 'blank';
    return (LAYOUT_PLACEHOLDERS[key] || []).map(p => ({ ...p }));
  };

  // -----------------------------------------------------------------------
  // Hit test -- find element index under (x, y) in slide coordinates
  // Iterates in reverse for proper z-order (top-most first)
  // Supports group children (Feature 7)
  // -----------------------------------------------------------------------
  const hitTest = (x, y, slide) => {
    const elements = slide.elements || [];
    for (let i = elements.length - 1; i >= 0; --i) {
      const el = elements[i];
      if (el.type === 'group') {
        // Check group bounds first
        if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) {
          // Check children within group
          const localX = x - el.x;
          const localY = y - el.y;
          const children = el.children || [];
          for (let j = children.length - 1; j >= 0; --j) {
            const child = children[j];
            if (localX >= child.x && localX <= child.x + child.w && localY >= child.y && localY <= child.y + child.h)
              return i;
          }
          // Still inside group bounds
          return i;
        }
      } else {
        if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h)
          return i;
      }
    }
    return -1;
  };

  // -----------------------------------------------------------------------
  // Resize handles overlay -- 8 handles (nw, n, ne, e, se, s, sw, w)
  // Plus rotation handle (Feature 1)
  // -----------------------------------------------------------------------
  const renderResizeHandles = (domEl) => {
    const overlay = document.createElement('div');
    overlay.className = 'resize-handles-overlay';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10000';

    const HANDLE_SIZE = 8;
    const HALF = HANDLE_SIZE / 2;

    const handles = [
      { name: 'nw', left: -HALF + 'px', top: -HALF + 'px', cursor: 'nw-resize' },
      { name: 'n', left: `calc(50% - ${HALF}px)`, top: -HALF + 'px', cursor: 'n-resize' },
      { name: 'ne', right: -HALF + 'px', top: -HALF + 'px', cursor: 'ne-resize' },
      { name: 'e', right: -HALF + 'px', top: `calc(50% - ${HALF}px)`, cursor: 'e-resize' },
      { name: 'se', right: -HALF + 'px', bottom: -HALF + 'px', cursor: 'se-resize' },
      { name: 's', left: `calc(50% - ${HALF}px)`, bottom: -HALF + 'px', cursor: 's-resize' },
      { name: 'sw', left: -HALF + 'px', bottom: -HALF + 'px', cursor: 'sw-resize' },
      { name: 'w', left: -HALF + 'px', top: `calc(50% - ${HALF}px)`, cursor: 'w-resize' }
    ];

    for (let i = 0; i < handles.length; ++i) {
      const hDef = handles[i];
      const h = document.createElement('div');
      h.className = 'resize-handle resize-handle-' + hDef.name;
      h.dataset.handle = hDef.name;
      h.style.position = 'absolute';
      h.style.width = HANDLE_SIZE + 'px';
      h.style.height = HANDLE_SIZE + 'px';
      h.style.backgroundColor = '#FFFFFF';
      h.style.border = '1px solid #0078D7';
      h.style.boxSizing = 'border-box';
      h.style.pointerEvents = 'auto';
      h.style.cursor = hDef.cursor;

      if (hDef.left != null) h.style.left = hDef.left;
      if (hDef.right != null) h.style.right = hDef.right;
      if (hDef.top != null) h.style.top = hDef.top;
      if (hDef.bottom != null) h.style.bottom = hDef.bottom;

      overlay.appendChild(h);
    }

    // Rotation handle (Feature 1) -- green circle above top center
    const rotLine = document.createElement('div');
    rotLine.className = 'rotation-line';
    overlay.appendChild(rotLine);

    const rotHandle = document.createElement('div');
    rotHandle.className = 'rotation-handle';
    rotHandle.dataset.handle = 'rotate';
    overlay.appendChild(rotHandle);

    // Selection border
    const border = document.createElement('div');
    border.style.position = 'absolute';
    border.style.inset = '0';
    border.style.border = '1px solid #0078D7';
    border.style.pointerEvents = 'none';
    overlay.insertBefore(border, overlay.firstChild);

    domEl.style.position = 'relative';
    domEl.appendChild(overlay);
    return overlay;
  };

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // New element data constructors
  // -----------------------------------------------------------------------

  const createVideoElement = (x, y, w, h, src, fileName) => ({
    id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type: 'video',
    x: x || 200, y: y || 100, w: w || 480, h: h || 270,
    src: src || '',
    fileName: fileName || 'video',
    autoplay: false,
    loop: false,
    rotation: 0,
    opacity: 1
  });

  const createAudioElement = (x, y, w, h, src, fileName) => ({
    id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type: 'audio',
    x: x || 350, y: y || 200, w: w || 200, h: h || 100,
    src: src || '',
    fileName: fileName || 'audio',
    rotation: 0,
    opacity: 1
  });

  const createActionButton = (x, y, w, h, action) => ({
    id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type: 'action-button',
    x: x || 400, y: y || 450, w: w || 120, h: h || 40,
    action: action || 'next',
    label: ACTION_BUTTON_LABELS[action] || 'Action',
    fillColor: '#4472c4',
    strokeColor: '#3a62a8',
    color: '#ffffff',
    fontSize: 14,
    rotation: 0,
    opacity: 1
  });

  const createConnector = (startElementId, endElementId, routeType) => ({
    id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    type: 'connector',
    x: 0, y: 0, w: CANVAS_W, h: CANVAS_H,
    startElementId: startElementId || null,
    endElementId: endElementId || null,
    startPoint: 'right',
    endPoint: 'left',
    startX: 100,
    startY: 270,
    endX: 400,
    endY: 270,
    routeType: routeType || 'straight',
    lineColor: '#666',
    lineWidth: 2,
    lineDash: 'solid',
    startArrow: 'none',
    endArrow: 'arrow',
    rotation: 0,
    opacity: 1
  });

  PresentationsApp.SlideRenderer = {
    renderSlide,
    renderThumbnail,
    createTextbox,
    createImageElement,
    createShape,
    createTable,
    createGroup,
    ungroupElement,
    createVideoElement,
    createAudioElement,
    createActionButton,
    createConnector,
    applyElementStyle,
    getLayoutPlaceholders,
    hitTest,
    renderResizeHandles,
    CANVAS_W,
    CANVAS_H
  };

})();
