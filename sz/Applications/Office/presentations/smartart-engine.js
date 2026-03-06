;(function() {
  'use strict';

  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});

  const SVG_NS = 'http://www.w3.org/2000/svg';

  const SMARTART_COLORS = [
    '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000',
    '#5B9BD5', '#70AD47', '#264478', '#9B57A0'
  ];

  const DIAGRAM_TYPES = {
    process: { label: 'Process', description: 'Left-to-right flow' },
    hierarchy: { label: 'Hierarchy', description: 'Tree structure' },
    cycle: { label: 'Cycle', description: 'Circular flow' },
    relationship: { label: 'Relationship', description: 'Venn diagram' },
    matrix: { label: 'Matrix', description: '2x2 grid' },
    pyramid: { label: 'Pyramid', description: 'Layered triangle' }
  };

  // -----------------------------------------------------------------------
  // SmartArt element data constructor
  // -----------------------------------------------------------------------

  function createSmartArtElement(x, y, w, h, diagramType, nodes) {
    const defaultNodes = nodes || _getDefaultNodes(diagramType);
    return {
      id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'smartart',
      x: x || 150,
      y: y || 100,
      w: w || 660,
      h: h || 340,
      diagramType: diagramType || 'process',
      nodes: defaultNodes,
      rotation: 0,
      opacity: 1
    };
  }

  function _getDefaultNodes(type) {
    switch (type) {
      case 'process':
        return [
          { id: 'n1', text: 'Step 1' },
          { id: 'n2', text: 'Step 2' },
          { id: 'n3', text: 'Step 3' }
        ];
      case 'hierarchy':
        return [
          { id: 'n1', text: 'Root', children: [
            { id: 'n2', text: 'Branch A', children: [
              { id: 'n4', text: 'Leaf 1' },
              { id: 'n5', text: 'Leaf 2' }
            ]},
            { id: 'n3', text: 'Branch B', children: [
              { id: 'n6', text: 'Leaf 3' }
            ]}
          ]}
        ];
      case 'cycle':
        return [
          { id: 'n1', text: 'Phase 1' },
          { id: 'n2', text: 'Phase 2' },
          { id: 'n3', text: 'Phase 3' },
          { id: 'n4', text: 'Phase 4' }
        ];
      case 'relationship':
        return [
          { id: 'n1', text: 'Group A' },
          { id: 'n2', text: 'Group B' },
          { id: 'n3', text: 'Group C' }
        ];
      case 'matrix':
        return [
          { id: 'n1', text: 'High Priority\nHigh Effort' },
          { id: 'n2', text: 'High Priority\nLow Effort' },
          { id: 'n3', text: 'Low Priority\nHigh Effort' },
          { id: 'n4', text: 'Low Priority\nLow Effort' }
        ];
      case 'pyramid':
        return [
          { id: 'n1', text: 'Top' },
          { id: 'n2', text: 'Middle' },
          { id: 'n3', text: 'Base' }
        ];
      default:
        return [{ id: 'n1', text: 'Item 1' }, { id: 'n2', text: 'Item 2' }, { id: 'n3', text: 'Item 3' }];
    }
  }

  // -----------------------------------------------------------------------
  // Layout algorithms
  // -----------------------------------------------------------------------

  function layoutSmartArt(element) {
    switch (element.diagramType) {
      case 'process': return _layoutProcess(element);
      case 'hierarchy': return _layoutHierarchy(element);
      case 'cycle': return _layoutCycle(element);
      case 'relationship': return _layoutRelationship(element);
      case 'matrix': return _layoutMatrix(element);
      case 'pyramid': return _layoutPyramid(element);
      default: return _layoutProcess(element);
    }
  }

  function _layoutProcess(element) {
    const nodes = element.nodes || [];
    if (!nodes.length)
      return [];

    const w = element.w;
    const h = element.h;
    const padding = 10;
    const arrowSpace = 30;
    const totalArrowSpace = (nodes.length - 1) * arrowSpace;
    const nodeW = (w - 2 * padding - totalArrowSpace) / nodes.length;
    const nodeH = h - 2 * padding;

    const layout = [];
    for (let i = 0; i < nodes.length; ++i) {
      const x = padding + i * (nodeW + arrowSpace);
      layout.push({
        node: nodes[i],
        x: x,
        y: padding,
        w: nodeW,
        h: nodeH,
        color: SMARTART_COLORS[i % SMARTART_COLORS.length]
      });
    }
    return layout;
  }

  function _layoutHierarchy(element) {
    const nodes = element.nodes || [];
    if (!nodes.length)
      return [];

    const layout = [];
    const w = element.w;
    const h = element.h;

    // Flatten hierarchy with levels
    const levels = [];
    const _flatten = (nodeList, level) => {
      if (!levels[level])
        levels[level] = [];
      for (const node of nodeList) {
        levels[level].push(node);
        if (node.children && node.children.length)
          _flatten(node.children, level + 1);
      }
    };
    _flatten(nodes, 0);

    const levelH = h / levels.length - 10;
    const nodeH = Math.min(levelH - 10, 50);

    let colorIdx = 0;
    for (let lvl = 0; lvl < levels.length; ++lvl) {
      const count = levels[lvl].length;
      const nodeW = Math.min((w - 20) / count - 10, 120);
      const totalW = count * nodeW + (count - 1) * 10;
      const startX = (w - totalW) / 2;

      for (let i = 0; i < count; ++i) {
        layout.push({
          node: levels[lvl][i],
          x: startX + i * (nodeW + 10),
          y: lvl * (levelH + 5) + 5,
          w: nodeW,
          h: nodeH,
          color: SMARTART_COLORS[colorIdx++ % SMARTART_COLORS.length]
        });
      }
    }
    return layout;
  }

  function _layoutCycle(element) {
    const nodes = element.nodes || [];
    if (!nodes.length)
      return [];

    const cx = element.w / 2;
    const cy = element.h / 2;
    const radius = Math.min(cx, cy) - 50;
    const nodeSize = Math.min(80, radius * 0.6);
    const layout = [];

    for (let i = 0; i < nodes.length; ++i) {
      const angle = -Math.PI / 2 + (2 * Math.PI / nodes.length) * i;
      const x = cx + radius * Math.cos(angle) - nodeSize / 2;
      const y = cy + radius * Math.sin(angle) - nodeSize / 2;
      layout.push({
        node: nodes[i],
        x: x,
        y: y,
        w: nodeSize,
        h: nodeSize,
        color: SMARTART_COLORS[i % SMARTART_COLORS.length],
        shape: 'circle'
      });
    }
    return layout;
  }

  function _layoutRelationship(element) {
    const nodes = element.nodes || [];
    if (!nodes.length)
      return [];

    const w = element.w;
    const h = element.h;
    const cx = w / 2;
    const cy = h / 2;
    const circleR = Math.min(w, h) * 0.3;

    const layout = [];
    if (nodes.length === 1) {
      layout.push({
        node: nodes[0], x: cx - circleR, y: cy - circleR,
        w: circleR * 2, h: circleR * 2, color: SMARTART_COLORS[0], shape: 'circle'
      });
    } else if (nodes.length === 2) {
      const offset = circleR * 0.4;
      layout.push({
        node: nodes[0], x: cx - circleR - offset, y: cy - circleR,
        w: circleR * 2, h: circleR * 2, color: SMARTART_COLORS[0], shape: 'circle'
      });
      layout.push({
        node: nodes[1], x: cx - circleR + offset, y: cy - circleR,
        w: circleR * 2, h: circleR * 2, color: SMARTART_COLORS[1], shape: 'circle'
      });
    } else {
      // 3 overlapping circles (Venn)
      const offset = circleR * 0.35;
      const positions = [
        { x: cx - offset, y: cy - offset },
        { x: cx + offset, y: cy - offset },
        { x: cx, y: cy + offset * 0.5 }
      ];
      for (let i = 0; i < Math.min(nodes.length, 3); ++i) {
        layout.push({
          node: nodes[i],
          x: positions[i].x - circleR,
          y: positions[i].y - circleR,
          w: circleR * 2,
          h: circleR * 2,
          color: SMARTART_COLORS[i % SMARTART_COLORS.length],
          shape: 'circle'
        });
      }
    }
    return layout;
  }

  function _layoutMatrix(element) {
    const nodes = element.nodes || [];
    const w = element.w;
    const h = element.h;
    const gap = 8;
    const cellW = (w - gap) / 2;
    const cellH = (h - gap) / 2;

    const positions = [
      { x: 0, y: 0 },
      { x: cellW + gap, y: 0 },
      { x: 0, y: cellH + gap },
      { x: cellW + gap, y: cellH + gap }
    ];

    const layout = [];
    for (let i = 0; i < Math.min(nodes.length, 4); ++i) {
      layout.push({
        node: nodes[i],
        x: positions[i].x,
        y: positions[i].y,
        w: cellW,
        h: cellH,
        color: SMARTART_COLORS[i % SMARTART_COLORS.length]
      });
    }
    return layout;
  }

  function _layoutPyramid(element) {
    const nodes = element.nodes || [];
    if (!nodes.length)
      return [];

    const w = element.w;
    const h = element.h;
    const gap = 4;
    const totalGap = (nodes.length - 1) * gap;
    const layerH = (h - totalGap) / nodes.length;

    const layout = [];
    for (let i = 0; i < nodes.length; ++i) {
      // Each layer gets wider toward the bottom
      const fraction = (i + 1) / nodes.length;
      const layerW = w * 0.3 + (w * 0.7) * fraction;
      const x = (w - layerW) / 2;
      const y = i * (layerH + gap);
      layout.push({
        node: nodes[i],
        x: x,
        y: y,
        w: layerW,
        h: layerH,
        color: SMARTART_COLORS[i % SMARTART_COLORS.length],
        shape: 'trapezoid'
      });
    }
    return layout;
  }

  // -----------------------------------------------------------------------
  // SVG Rendering
  // -----------------------------------------------------------------------

  function renderSmartArt(element, containerEl) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + element.w + ' ' + element.h);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    svg.style.pointerEvents = 'none';

    const layout = layoutSmartArt(element);
    const diagramType = element.diagramType;

    // Render connectors first (behind nodes)
    if (diagramType === 'process') {
      for (let i = 0; i < layout.length - 1; ++i) {
        const from = layout[i];
        const to = layout[i + 1];
        _renderArrow(svg, from.x + from.w, from.y + from.h / 2, to.x, to.y + to.h / 2, '#666');
      }
    } else if (diagramType === 'cycle' && layout.length > 1) {
      for (let i = 0; i < layout.length; ++i) {
        const from = layout[i];
        const to = layout[(i + 1) % layout.length];
        const fx = from.x + from.w / 2;
        const fy = from.y + from.h / 2;
        const tx = to.x + to.w / 2;
        const ty = to.y + to.h / 2;
        _renderArrow(svg, fx, fy, tx, ty, '#999');
      }
    } else if (diagramType === 'hierarchy') {
      // Connect parent nodes to children
      const flatNodes = element.nodes || [];
      _renderHierarchyConnectors(svg, flatNodes, layout, element);
    }

    // Render nodes
    for (const item of layout) {
      const shape = item.shape || 'rect';
      const alpha = diagramType === 'relationship' ? 0.5 : 1;

      if (shape === 'circle') {
        const circle = document.createElementNS(SVG_NS, 'ellipse');
        circle.setAttribute('cx', item.x + item.w / 2);
        circle.setAttribute('cy', item.y + item.h / 2);
        circle.setAttribute('rx', item.w / 2);
        circle.setAttribute('ry', item.h / 2);
        circle.setAttribute('fill', item.color);
        circle.setAttribute('fill-opacity', alpha);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
      } else if (shape === 'trapezoid') {
        // For pyramid layers
        const path = document.createElementNS(SVG_NS, 'path');
        const indent = item.w * 0.05;
        path.setAttribute('d', 'M ' + (item.x + indent) + ' ' + item.y +
          ' L ' + (item.x + item.w - indent) + ' ' + item.y +
          ' L ' + (item.x + item.w) + ' ' + (item.y + item.h) +
          ' L ' + item.x + ' ' + (item.y + item.h) + ' Z');
        path.setAttribute('fill', item.color);
        path.setAttribute('stroke', '#fff');
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);
      } else {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', item.x);
        rect.setAttribute('y', item.y);
        rect.setAttribute('width', item.w);
        rect.setAttribute('height', item.h);
        rect.setAttribute('rx', 6);
        rect.setAttribute('ry', 6);
        rect.setAttribute('fill', item.color);
        rect.setAttribute('stroke', '#fff');
        rect.setAttribute('stroke-width', '2');
        svg.appendChild(rect);
      }

      // Text
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', item.x + item.w / 2);
      text.setAttribute('y', item.y + item.h / 2);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('fill', '#fff');
      text.setAttribute('font-size', Math.min(14, item.h / 3));
      text.setAttribute('font-family', 'sans-serif');
      text.setAttribute('font-weight', 'bold');

      const lines = (item.node.text || '').split('\n');
      if (lines.length === 1) {
        text.textContent = lines[0];
      } else {
        const lineH = Math.min(14, item.h / 3) * 1.2;
        const startY = item.y + item.h / 2 - (lines.length - 1) * lineH / 2;
        for (let li = 0; li < lines.length; ++li) {
          const tspan = document.createElementNS(SVG_NS, 'tspan');
          tspan.setAttribute('x', item.x + item.w / 2);
          tspan.setAttribute('y', startY + li * lineH);
          tspan.textContent = lines[li];
          text.appendChild(tspan);
        }
      }
      svg.appendChild(text);
    }

    containerEl.appendChild(svg);
  }

  function _renderArrow(svg, x1, y1, x2, y2, color) {
    // Shorten the line slightly so it doesn't overlap nodes
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10)
      return;

    const ux = dx / len;
    const uy = dy / len;
    const shorten = 15;
    const sx = x1 + ux * shorten;
    const sy = y1 + uy * shorten;
    const ex = x2 - ux * shorten;
    const ey = y2 - uy * shorten;

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', sx);
    line.setAttribute('y1', sy);
    line.setAttribute('x2', ex);
    line.setAttribute('y2', ey);
    line.setAttribute('stroke', color || '#666');
    line.setAttribute('stroke-width', '2');
    svg.appendChild(line);

    // Arrow head
    const headLen = 8;
    const angle = Math.atan2(ey - sy, ex - sx);
    const head = document.createElementNS(SVG_NS, 'polygon');
    const p1x = ex;
    const p1y = ey;
    const p2x = ex - headLen * Math.cos(angle - 0.4);
    const p2y = ey - headLen * Math.sin(angle - 0.4);
    const p3x = ex - headLen * Math.cos(angle + 0.4);
    const p3y = ey - headLen * Math.sin(angle + 0.4);
    head.setAttribute('points', p1x + ',' + p1y + ' ' + p2x + ',' + p2y + ' ' + p3x + ',' + p3y);
    head.setAttribute('fill', color || '#666');
    svg.appendChild(head);
  }

  function _renderHierarchyConnectors(svg, nodeList, layout, element) {
    // Find layout positions by node id
    const posMap = {};
    for (const item of layout)
      posMap[item.node.id] = item;

    const _connect = (parentNode) => {
      if (!parentNode.children)
        return;
      const parentPos = posMap[parentNode.id];
      if (!parentPos)
        return;

      for (const child of parentNode.children) {
        const childPos = posMap[child.id];
        if (childPos) {
          const line = document.createElementNS(SVG_NS, 'line');
          line.setAttribute('x1', parentPos.x + parentPos.w / 2);
          line.setAttribute('y1', parentPos.y + parentPos.h);
          line.setAttribute('x2', childPos.x + childPos.w / 2);
          line.setAttribute('y2', childPos.y);
          line.setAttribute('stroke', '#999');
          line.setAttribute('stroke-width', '2');
          svg.appendChild(line);
        }
        _connect(child);
      }
    };

    for (const node of nodeList)
      _connect(node);
  }

  // -----------------------------------------------------------------------
  // Thumbnail SVG builder for gallery preview
  // -----------------------------------------------------------------------

  function _buildThumbnailSvg(diagramType) {
    const W = 120;
    const H = 80;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';

    const mockElement = {
      diagramType: diagramType,
      w: W,
      h: H,
      nodes: _getDefaultNodes(diagramType)
    };
    const layout = layoutSmartArt(mockElement);

    // Draw connectors behind nodes
    if (diagramType === 'process') {
      for (let i = 0; i < layout.length - 1; ++i) {
        const from = layout[i];
        const to = layout[i + 1];
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', from.x + from.w);
        line.setAttribute('y1', from.y + from.h / 2);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y + to.h / 2);
        line.setAttribute('stroke', '#999');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }
    } else if (diagramType === 'cycle' && layout.length > 1) {
      for (let i = 0; i < layout.length; ++i) {
        const from = layout[i];
        const to = layout[(i + 1) % layout.length];
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', from.x + from.w / 2);
        line.setAttribute('y1', from.y + from.h / 2);
        line.setAttribute('x2', to.x + to.w / 2);
        line.setAttribute('y2', to.y + to.h / 2);
        line.setAttribute('stroke', '#bbb');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }
    } else if (diagramType === 'hierarchy') {
      const posMap = {};
      for (const item of layout)
        posMap[item.node.id] = item;
      const _drawLines = (nodeList) => {
        for (const node of nodeList) {
          if (!node.children)
            continue;
          const parent = posMap[node.id];
          if (!parent)
            continue;
          for (const child of node.children) {
            const childPos = posMap[child.id];
            if (childPos) {
              const line = document.createElementNS(SVG_NS, 'line');
              line.setAttribute('x1', parent.x + parent.w / 2);
              line.setAttribute('y1', parent.y + parent.h);
              line.setAttribute('x2', childPos.x + childPos.w / 2);
              line.setAttribute('y2', childPos.y);
              line.setAttribute('stroke', '#bbb');
              line.setAttribute('stroke-width', '1');
              svg.appendChild(line);
            }
            _drawLines([child]);
          }
        }
      };
      _drawLines(mockElement.nodes);
    }

    // Draw nodes
    for (const item of layout) {
      const shape = item.shape || 'rect';
      const alpha = diagramType === 'relationship' ? 0.5 : 1;

      if (shape === 'circle') {
        const circle = document.createElementNS(SVG_NS, 'ellipse');
        circle.setAttribute('cx', item.x + item.w / 2);
        circle.setAttribute('cy', item.y + item.h / 2);
        circle.setAttribute('rx', item.w / 2);
        circle.setAttribute('ry', item.h / 2);
        circle.setAttribute('fill', item.color);
        circle.setAttribute('fill-opacity', alpha);
        svg.appendChild(circle);
      } else if (shape === 'trapezoid') {
        const indent = item.w * 0.05;
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', 'M ' + (item.x + indent) + ' ' + item.y +
          ' L ' + (item.x + item.w - indent) + ' ' + item.y +
          ' L ' + (item.x + item.w) + ' ' + (item.y + item.h) +
          ' L ' + item.x + ' ' + (item.y + item.h) + ' Z');
        path.setAttribute('fill', item.color);
        svg.appendChild(path);
      } else {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', item.x);
        rect.setAttribute('y', item.y);
        rect.setAttribute('width', item.w);
        rect.setAttribute('height', item.h);
        rect.setAttribute('rx', 3);
        rect.setAttribute('ry', 3);
        rect.setAttribute('fill', item.color);
        svg.appendChild(rect);
      }
    }

    return svg;
  }

  // -----------------------------------------------------------------------
  // Type Picker Dialog
  // -----------------------------------------------------------------------

  function showTypePickerDialog(callback) {
    const overlay = document.createElement('div');
    overlay.className = 'pp-dialog-overlay';
    overlay.style.display = 'flex';

    const dlg = document.createElement('div');
    dlg.className = 'pp-dialog';
    dlg.style.width = '480px';

    const title = document.createElement('h3');
    title.textContent = 'Insert SmartArt';
    dlg.appendChild(title);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0;';

    for (const [key, info] of Object.entries(DIAGRAM_TYPES)) {
      const tile = document.createElement('div');
      tile.style.cssText = 'border:1px solid #ccc;border-radius:4px;padding:8px;cursor:pointer;text-align:center;background:#f9f9f9;';

      // SVG thumbnail preview
      const previewWrap = document.createElement('div');
      previewWrap.style.cssText = 'width:100%;height:60px;margin-bottom:6px;background:#fff;border-radius:3px;overflow:hidden;';
      const thumbSvg = _buildThumbnailSvg(key);
      previewWrap.appendChild(thumbSvg);
      tile.appendChild(previewWrap);

      const label = document.createElement('div');
      label.style.cssText = 'font-size:12px;font-weight:bold;margin-bottom:2px;';
      label.textContent = info.label;
      tile.appendChild(label);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:10px;color:#666;';
      desc.textContent = info.description;
      tile.appendChild(desc);

      tile.addEventListener('mouseenter', () => {
        tile.style.borderColor = '#4472c4';
        tile.style.background = '#e8f0fa';
      });
      tile.addEventListener('mouseleave', () => {
        tile.style.borderColor = '#ccc';
        tile.style.background = '#f9f9f9';
      });
      tile.addEventListener('click', () => {
        overlay.parentNode.removeChild(overlay);
        if (callback)
          callback(key);
      });

      grid.appendChild(tile);
    }

    dlg.appendChild(grid);

    const buttons = document.createElement('div');
    buttons.className = 'dlg-buttons';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:3px;background:#f0f0f0;cursor:pointer;';
    cancelBtn.addEventListener('click', () => {
      overlay.parentNode.removeChild(overlay);
    });
    buttons.appendChild(cancelBtn);
    dlg.appendChild(buttons);

    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
  }

  // -----------------------------------------------------------------------
  // Node Editor Dialog
  // -----------------------------------------------------------------------

  function _flattenNodes(nodes, result) {
    result = result || [];
    for (const node of nodes) {
      result.push(node);
      if (node.children)
        _flattenNodes(node.children, result);
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Text Pane <-> Node Tree conversion
  // -----------------------------------------------------------------------

  function nodesToTextPane(nodes, level) {
    level = level || 0;
    let text = '';
    for (const node of nodes) {
      text += '  '.repeat(level) + (node.text || '') + '\n';
      if (node.children && node.children.length)
        text += nodesToTextPane(node.children, level + 1);
    }
    return text;
  }

  function parseTextPaneToNodes(text) {
    const lines = text.split('\n');
    const root = [];
    const stack = [{ children: root, level: -1 }];
    let idCounter = 0;

    for (const line of lines) {
      if (line.trim() === '')
        continue;
      const stripped = line.replace(/\t/g, '  ');
      const leadingSpaces = stripped.match(/^( *)/)[1].length;
      const level = Math.floor(leadingSpaces / 2);
      const nodeText = line.trim();

      const node = {
        id: 'n-' + Date.now() + '-' + (++idCounter) + '-' + Math.random().toString(36).substr(2, 4),
        text: nodeText
      };

      // Pop stack until we find the correct parent level
      while (stack.length > 1 && stack[stack.length - 1].level >= level)
        stack.pop();

      const parent = stack[stack.length - 1];
      if (!parent.children)
        parent.children = [];
      parent.children.push(node);

      stack.push({ children: null, level, node });
      // Set children ref so future children can attach
      stack[stack.length - 1].children = node.children = [];
    }

    // Clean up empty children arrays
    const _cleanEmpty = (nodes) => {
      for (const n of nodes) {
        if (n.children && n.children.length === 0)
          delete n.children;
        else if (n.children)
          _cleanEmpty(n.children);
      }
    };
    _cleanEmpty(root);
    return root;
  }

  // -----------------------------------------------------------------------
  // Node Editor Dialog (Text Pane style)
  // -----------------------------------------------------------------------

  function showNodeEditorDialog(element, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'pp-dialog-overlay';
    overlay.style.display = 'flex';

    const dlg = document.createElement('div');
    dlg.className = 'pp-dialog';
    dlg.style.width = '520px';
    dlg.style.maxHeight = '85vh';
    dlg.style.overflowY = 'auto';

    const title = document.createElement('h3');
    title.textContent = 'Edit SmartArt \u2014 ' + (DIAGRAM_TYPES[element.diagramType]?.label || element.diagramType);
    title.style.marginBottom = '12px';
    dlg.appendChild(title);

    // Instruction
    const helpText = document.createElement('div');
    helpText.style.cssText = 'font-size:11px;color:#666;margin-bottom:8px;';
    helpText.textContent = 'Each line is a node. Use indentation (2 spaces) for hierarchy. Tab to indent, Shift+Tab to outdent.';
    dlg.appendChild(helpText);

    // Text Pane
    const textPane = document.createElement('textarea');
    textPane.className = 'smartart-text-pane';
    textPane.value = nodesToTextPane(element.nodes || []);
    textPane.spellcheck = false;
    dlg.appendChild(textPane);

    // Tab/Shift+Tab handling
    textPane.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textPane.selectionStart;
        const end = textPane.selectionEnd;
        const val = textPane.value;

        // Find line boundaries for the selection
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = val.indexOf('\n', end);
        const endPos = lineEnd === -1 ? val.length : lineEnd;
        const selectedLines = val.substring(lineStart, endPos);
        const lines = selectedLines.split('\n');

        let newLines;
        if (e.shiftKey) {
          // Outdent: remove up to 2 leading spaces from each line
          newLines = lines.map(l => l.startsWith('  ') ? l.substring(2) : l);
        } else {
          // Indent: add 2 spaces to each line
          newLines = lines.map(l => '  ' + l);
        }

        const newText = newLines.join('\n');
        textPane.value = val.substring(0, lineStart) + newText + val.substring(endPos);

        // Restore selection
        textPane.selectionStart = lineStart;
        textPane.selectionEnd = lineStart + newText.length;

        // Trigger live preview update
        updatePreview();
      }
    });

    // SVG Preview
    const previewLabel = document.createElement('div');
    previewLabel.style.cssText = 'font-size:11px;font-weight:bold;margin:10px 0 4px;';
    previewLabel.textContent = 'Preview:';
    dlg.appendChild(previewLabel);

    const previewContainer = document.createElement('div');
    previewContainer.style.cssText = 'border:1px solid #ddd;background:#fff;padding:8px;min-height:80px;text-align:center;';
    dlg.appendChild(previewContainer);

    const updatePreview = () => {
      const parsedNodes = parseTextPaneToNodes(textPane.value);
      const tempElement = {
        id: element.id,
        type: 'smartart',
        diagramType: typeSel.value,
        nodes: parsedNodes,
        x: 0, y: 0,
        w: element.w || 480,
        h: element.h || 200
      };
      previewContainer.innerHTML = '';
      try {
        const svg = renderSmartArt(tempElement);
        if (svg) {
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
          previewContainer.appendChild(svg);
        }
      } catch {
        previewContainer.textContent = '(Preview unavailable)';
      }
    };

    textPane.addEventListener('input', updatePreview);

    // Diagram type changer
    const typeRow = document.createElement('div');
    typeRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:10px 0;padding-top:8px;border-top:1px solid #ddd;';
    typeRow.innerHTML = '<label style="font-size:12px;min-width:80px;">Diagram Type:</label>';
    const typeSel = document.createElement('select');
    typeSel.style.cssText = 'flex:1;font-size:12px;padding:3px;';
    for (const [key, info] of Object.entries(DIAGRAM_TYPES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = info.label;
      if (key === element.diagramType)
        opt.selected = true;
      typeSel.appendChild(opt);
    }
    typeSel.addEventListener('change', updatePreview);
    typeRow.appendChild(typeSel);
    dlg.appendChild(typeRow);

    // Initial preview
    setTimeout(updatePreview, 0);

    // Buttons
    const buttons = document.createElement('div');
    buttons.className = 'dlg-buttons';
    buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:12px;';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:3px;background:#f0f0f0;cursor:pointer;';
    cancelBtn.addEventListener('click', () => overlay.parentNode.removeChild(overlay));

    const okBtn = document.createElement('button');
    okBtn.textContent = 'Apply';
    okBtn.className = 'primary';
    okBtn.style.cssText = 'padding:6px 16px;border:1px solid #0078D7;border-radius:3px;background:#0078D7;color:#fff;cursor:pointer;';
    okBtn.addEventListener('click', () => {
      // Parse text pane back to nodes
      const parsedNodes = parseTextPaneToNodes(textPane.value);
      element.nodes = parsedNodes;

      // Apply type change
      const newType = typeSel.value;
      if (newType !== element.diagramType) {
        element.diagramType = newType;
        // If switching to a non-hierarchy type, flatten all hierarchy children
        if (newType !== 'hierarchy') {
          const allNodes = _flattenNodes(element.nodes);
          element.nodes = allNodes.map(n => ({ id: n.id, text: n.text }));
        }
      }

      overlay.parentNode.removeChild(overlay);
      if (typeof onSave === 'function')
        onSave();
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dlg.appendChild(buttons);

    overlay.appendChild(dlg);
    document.body.appendChild(overlay);

    // Focus text pane
    setTimeout(() => textPane.focus(), 50);
  }

  function _removeNodeById(nodes, nodeId) {
    for (let i = 0; i < nodes.length; ++i) {
      if (nodes[i].id === nodeId) {
        nodes.splice(i, 1);
        return true;
      }
      if (nodes[i].children) {
        if (_removeNodeById(nodes[i].children, nodeId))
          return true;
      }
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  PresentationsApp.SmartArtEngine = Object.freeze({
    createSmartArtElement,
    layoutSmartArt,
    renderSmartArt,
    showTypePickerDialog,
    showNodeEditorDialog,
    DIAGRAM_TYPES
  });

})();
