;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let _S, _cellKey, _parseKey, _colName, _colIndex, _getCellValue, _getSelectionRect, _showDialog, _rebuildGrid;
  let _setFormat, _getFormat, _setDirty, _getActiveCell, _gridScroll;

  function init(ctx) {
    _S = ctx.S;
    _cellKey = ctx.cellKey;
    _parseKey = ctx.parseKey;
    _colName = ctx.colName;
    _colIndex = ctx.colIndex;
    _getCellValue = ctx.getCellValue;
    _getSelectionRect = ctx.getSelectionRect;
    _showDialog = ctx.showDialog;
    _rebuildGrid = ctx.rebuildGrid;
    _setFormat = ctx.setFormat;
    _getFormat = ctx.getFormat;
    _setDirty = ctx.setDirty;
    _getActiveCell = ctx.getActiveCell;
    _gridScroll = ctx.gridScroll;
  }

  // ── Charts (Extended) ──────────────────────────────────────────────

  function drawChartOnCanvas(ctx, W, H, type, data, labels, options) {
    const padding = { top: 40, right: 20, bottom: 60, left: 60 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;
    const colors = options.colors || ['#4472c4', '#ed7d31', '#70ad47', '#ffc000', '#5b9bd5', '#c00000', '#7030a0', '#00b0f0'];

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    if (options.title) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(options.title, W / 2, 20);
    }

    const flatData = data.flat().filter(v => !isNaN(v));
    const maxVal = Math.max(...flatData, 1);
    const minVal = Math.min(...flatData, 0);
    const range = maxVal - minVal || 1;

    switch (type) {
      case 'bar':
      case 'column': {
        const seriesCount = Array.isArray(data[0]) ? data.length : 1;
        const series = seriesCount === 1 && !Array.isArray(data[0]) ? [data] : data;
        const catCount = series[0].length;
        const groupWidth = chartW / catCount;
        const barWidth = (groupWidth * 0.7) / seriesCount;

        for (let s = 0; s < seriesCount; ++s) {
          ctx.fillStyle = colors[s % colors.length];
          for (let i = 0; i < catCount; ++i) {
            const val = series[s][i] || 0;
            const barH = ((val - minVal) / range) * chartH;
            const x = padding.left + i * groupWidth + (groupWidth * 0.15) + s * barWidth;
            const y = padding.top + chartH - barH;
            ctx.fillRect(x, y, barWidth - 1, barH);
          }
        }

        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < catCount; ++i) {
          const x = padding.left + i * groupWidth + groupWidth / 2;
          ctx.fillText(labels[i] || '', x, H - padding.bottom + 14);
        }
        break;
      }

      case 'stacked-bar': {
        const series = Array.isArray(data[0]) ? data : [data];
        const catCount = series[0].length;
        const groupWidth = chartW / catCount;
        const barWidth = groupWidth * 0.7;

        for (let i = 0; i < catCount; ++i) {
          let stackY = 0;
          const total = series.reduce((s, ser) => s + (ser[i] || 0), 0);
          for (let s = 0; s < series.length; ++s) {
            const val = series[s][i] || 0;
            const barH = (val / (total || 1)) * chartH;
            ctx.fillStyle = colors[s % colors.length];
            const x = padding.left + i * groupWidth + (groupWidth * 0.15);
            ctx.fillRect(x, padding.top + chartH - stackY - barH, barWidth, barH);
            stackY += barH;
          }
        }

        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < catCount; ++i)
          ctx.fillText(labels[i] || '', padding.left + i * groupWidth + groupWidth / 2, H - padding.bottom + 14);
        break;
      }

      case 'line': {
        const series = Array.isArray(data[0]) ? data : [data];
        const catCount = series[0].length;
        const stepX = chartW / Math.max(catCount - 1, 1);

        for (let s = 0; s < series.length; ++s) {
          ctx.strokeStyle = colors[s % colors.length];
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < catCount; ++i) {
            const val = series[s][i] || 0;
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((val - minVal) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.fillStyle = colors[s % colors.length];
          for (let i = 0; i < catCount; ++i) {
            const val = series[s][i] || 0;
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((val - minVal) / range) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < catCount; ++i)
          ctx.fillText(labels[i] || '', padding.left + i * stepX, H - padding.bottom + 14);
        break;
      }

      case 'area':
      case 'stacked-area': {
        const series = Array.isArray(data[0]) ? data : [data];
        const catCount = series[0].length;
        const stepX = chartW / Math.max(catCount - 1, 1);

        for (let s = series.length - 1; s >= 0; --s) {
          ctx.fillStyle = colors[s % colors.length] + '80';
          ctx.strokeStyle = colors[s % colors.length];
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padding.left, padding.top + chartH);
          for (let i = 0; i < catCount; ++i) {
            const val = series[s][i] || 0;
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((val - minVal) / range) * chartH;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(padding.left + (catCount - 1) * stepX, padding.top + chartH);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      case 'pie':
      case 'doughnut': {
        const vals = Array.isArray(data[0]) ? data[0] : data;
        const total = vals.reduce((s, v) => s + Math.abs(v || 0), 0) || 1;
        const cx = W / 2;
        const cy = padding.top + chartH / 2;
        const outerR = Math.min(chartW, chartH) / 2 - 10;
        const innerR = type === 'doughnut' ? outerR * 0.5 : 0;
        let angle = -Math.PI / 2;

        for (let i = 0; i < vals.length; ++i) {
          const slice = (Math.abs(vals[i] || 0) / total) * Math.PI * 2;
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.arc(cx, cy, outerR, angle, angle + slice);
          if (innerR > 0)
            ctx.arc(cx, cy, innerR, angle + slice, angle, true);
          else
            ctx.lineTo(cx, cy);
          ctx.closePath();
          ctx.fill();
          angle += slice;
        }

        angle = -Math.PI / 2;
        ctx.fillStyle = '#333';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < vals.length; ++i) {
          const slice = (Math.abs(vals[i] || 0) / total) * Math.PI * 2;
          const midAngle = angle + slice / 2;
          const lx = cx + Math.cos(midAngle) * (outerR + 15);
          const ly = cy + Math.sin(midAngle) * (outerR + 15);
          ctx.fillText(labels[i] || '', lx, ly);
          angle += slice;
        }
        break;
      }

      case 'scatter': {
        const vals = Array.isArray(data[0]) ? data[0] : data;
        const catCount = vals.length;
        for (let i = 0; i < catCount; ++i) {
          const x = padding.left + (i / Math.max(catCount - 1, 1)) * chartW;
          const y = padding.top + chartH - ((vals[i] - minVal) / range) * chartH;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fillStyle = colors[i % colors.length];
          ctx.fill();
        }

        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < catCount; ++i)
          ctx.fillText(labels[i] || '', padding.left + (i / Math.max(catCount - 1, 1)) * chartW, H - padding.bottom + 14);
        break;
      }

      case 'radar': {
        const vals = Array.isArray(data[0]) ? data[0] : data;
        const count = vals.length;
        const cx = W / 2;
        const cy = padding.top + chartH / 2;
        const radius = Math.min(chartW, chartH) / 2 - 20;

        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;
        for (let ring = 1; ring <= 4; ++ring) {
          ctx.beginPath();
          for (let i = 0; i <= count; ++i) {
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            const r = radius * ring / 4;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }

        ctx.strokeStyle = '#ccc';
        for (let i = 0; i < count; ++i) {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
          ctx.stroke();
        }

        ctx.fillStyle = colors[0] + '40';
        ctx.strokeStyle = colors[0];
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= count; ++i) {
          const idx = i % count;
          const val = (vals[idx] || 0) / maxVal;
          const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius * val;
          const y = cy + Math.sin(angle) * radius * val;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < count; ++i) {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (radius + 15);
          const ly = cy + Math.sin(angle) * (radius + 15);
          ctx.fillText(labels[i] || '', lx, ly);
        }
        break;
      }

      case 'histogram': {
        const vals = Array.isArray(data[0]) ? data[0] : data;
        const binCount = options.bins || 10;
        const hMin = Math.min(...vals);
        const hMax = Math.max(...vals);
        const binWidth = (hMax - hMin) / binCount || 1;
        const bins = new Array(binCount).fill(0);
        for (const v of vals) {
          const idx = Math.min(Math.floor((v - hMin) / binWidth), binCount - 1);
          bins[idx]++;
        }
        const maxBin = Math.max(...bins, 1);
        const barW = chartW / binCount;

        ctx.fillStyle = colors[0];
        for (let i = 0; i < binCount; ++i) {
          const barH = (bins[i] / maxBin) * chartH;
          ctx.fillRect(padding.left + i * barW, padding.top + chartH - barH, barW - 1, barH);
        }

        ctx.fillStyle = '#666';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i <= binCount; i += Math.ceil(binCount / 5)) {
          const val = hMin + i * binWidth;
          ctx.fillText(val.toFixed(1), padding.left + i * barW, H - padding.bottom + 14);
        }
        break;
      }

      case 'combo': {
        const series = Array.isArray(data[0]) ? data : [data];
        const catCount = series[0].length;
        const groupWidth = chartW / catCount;
        const barWidth = groupWidth * 0.6;

        ctx.fillStyle = colors[0];
        for (let i = 0; i < catCount; ++i) {
          const val = series[0][i] || 0;
          const barH = ((val - minVal) / range) * chartH;
          const x = padding.left + i * groupWidth + (groupWidth - barWidth) / 2;
          ctx.fillRect(x, padding.top + chartH - barH, barWidth, barH);
        }

        if (series.length > 1) {
          const stepX = chartW / Math.max(catCount - 1, 1);
          ctx.strokeStyle = colors[1];
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let i = 0; i < catCount; ++i) {
            const val = series[1][i] || 0;
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((val - minVal) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.fillStyle = colors[1];
          for (let i = 0; i < catCount; ++i) {
            const val = series[1][i] || 0;
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((val - minVal) / range) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (let i = 0; i < catCount; ++i)
          ctx.fillText(labels[i] || '', padding.left + i * groupWidth + groupWidth / 2, H - padding.bottom + 14);
        break;
      }
    }

    // Y axis labels (skip for pie/doughnut/radar)
    if (type !== 'pie' && type !== 'doughnut' && type !== 'radar') {
      ctx.fillStyle = '#666';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      const ySteps = 5;
      for (let i = 0; i <= ySteps; ++i) {
        const val = minVal + (range * i) / ySteps;
        const y = padding.top + chartH - (chartH * i) / ySteps;
        ctx.fillText(val.toFixed(val % 1 === 0 ? 0 : 1), padding.left - 6, y + 4);
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
      }
    }

    if (options.xLabel) {
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(options.xLabel, W / 2, H - 5);
    }
    if (options.yLabel) {
      ctx.save();
      ctx.translate(12, H / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(options.yLabel, 0, 0);
      ctx.restore();
    }

    // ── Trendlines ─────────────────────────────────────────────────
    if (options.trendline && (type === 'scatter' || type === 'line' || type === 'bar' || type === 'column' || type === 'combo')) {
      const trendType = options.trendline.type || 'linear';
      const trendSeries = Array.isArray(data[0]) ? data[0] : data;
      const n = trendSeries.length;
      if (n >= 2) {
        const xs = [], ys = [];
        for (let i = 0; i < n; ++i) { xs.push(i); ys.push(trendSeries[i] || 0); }

        let trendFn;
        if (trendType === 'linear') {
          let sx = 0, sy = 0, sxy = 0, sx2 = 0;
          for (let i = 0; i < n; ++i) { sx += xs[i]; sy += ys[i]; sxy += xs[i] * ys[i]; sx2 += xs[i] * xs[i]; }
          const m = (n * sxy - sx * sy) / (n * sx2 - sx * sx || 1);
          const b = (sy - m * sx) / n;
          trendFn = (x) => m * x + b;
        } else if (trendType === 'exponential') {
          const lnys = ys.map(y => Math.log(Math.max(y, 0.001)));
          let sx = 0, sy = 0, sxy = 0, sx2 = 0;
          for (let i = 0; i < n; ++i) { sx += xs[i]; sy += lnys[i]; sxy += xs[i] * lnys[i]; sx2 += xs[i] * xs[i]; }
          const bExp = (n * sxy - sx * sy) / (n * sx2 - sx * sx || 1);
          const aExp = Math.exp((sy - bExp * sx) / n);
          trendFn = (x) => aExp * Math.exp(bExp * x);
        } else if (trendType === 'polynomial') {
          const degree = Math.min(options.trendline.degree || 2, 3);
          const cols = degree + 1;
          const mat = Array.from({ length: cols }, () => new Array(cols + 1).fill(0));
          for (let r = 0; r < cols; ++r)
            for (let c = 0; c <= cols; ++c)
              for (let i = 0; i < n; ++i)
                mat[r][c] += c < cols ? Math.pow(xs[i], r + c) : ys[i] * Math.pow(xs[i], r);
          for (let p = 0; p < cols; ++p) {
            let maxR = p;
            for (let r = p + 1; r < cols; ++r) if (Math.abs(mat[r][p]) > Math.abs(mat[maxR][p])) maxR = r;
            [mat[p], mat[maxR]] = [mat[maxR], mat[p]];
            const pivot = mat[p][p] || 1;
            for (let c = p; c <= cols; ++c) mat[p][c] /= pivot;
            for (let r = 0; r < cols; ++r) {
              if (r === p) continue;
              const f = mat[r][p];
              for (let c = p; c <= cols; ++c) mat[r][c] -= f * mat[p][c];
            }
          }
          const coeffs = mat.map(r => r[cols]);
          trendFn = (x) => { let v = 0; for (let d = 0; d < coeffs.length; ++d) v += coeffs[d] * Math.pow(x, d); return v; };
        }

        if (trendFn) {
          ctx.save();
          ctx.setLineDash([6, 3]);
          ctx.strokeStyle = options.trendline.color || '#333';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const steps = 60;
          for (let s = 0; s <= steps; ++s) {
            const t = (s / steps) * (n - 1);
            const x = padding.left + (t / Math.max(n - 1, 1)) * chartW;
            const y = padding.top + chartH - ((trendFn(t) - minVal) / range) * chartH;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // ── Data Labels ──────────────────────────────────────────────────
    if (options.dataLabels) {
      const dl = options.dataLabels;
      ctx.save();
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';

      const contrastColor = (bgColor) => {
        const c = bgColor || '#4472c4';
        const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) > 128 ? '#333' : '#fff';
      };

      if ((type === 'bar' || type === 'column') && dl.showValue) {
        const seriesCount = Array.isArray(data[0]) ? data.length : 1;
        const series = seriesCount === 1 && !Array.isArray(data[0]) ? [data] : data;
        const catCount = series[0].length;
        const groupWidth = chartW / catCount;
        const barWidth = (groupWidth * 0.7) / seriesCount;
        for (let s = 0; s < seriesCount; ++s) {
          ctx.fillStyle = contrastColor(colors[s % colors.length]);
          for (let i = 0; i < catCount; ++i) {
            const val = series[s][i] || 0;
            const barH = ((val - minVal) / range) * chartH;
            const x = padding.left + i * groupWidth + (groupWidth * 0.15) + s * barWidth + (barWidth - 1) / 2;
            const y = padding.top + chartH - barH - 4;
            ctx.fillText(String(val), x, y);
          }
        }
      }

      if ((type === 'line' || type === 'scatter') && dl.showValue) {
        const series = type === 'line' ? (Array.isArray(data[0]) ? data : [data]) : [Array.isArray(data[0]) ? data[0] : data];
        const catCount = series[0].length;
        const stepX = chartW / Math.max(catCount - 1, 1);
        for (let s = 0; s < series.length; ++s) {
          ctx.fillStyle = '#333';
          for (let i = 0; i < catCount; ++i) {
            const val = series[s][i] || 0;
            const x = padding.left + i * stepX;
            const y = padding.top + chartH - ((val - minVal) / range) * chartH - 8;
            ctx.fillText(String(val), x, y);
          }
        }
      }

      if ((type === 'pie' || type === 'doughnut') && (dl.showValue || dl.showPercent || dl.showCategory)) {
        const vals = Array.isArray(data[0]) ? data[0] : data;
        const total = vals.reduce((s, v) => s + Math.abs(v || 0), 0) || 1;
        const cx = W / 2;
        const cy = padding.top + chartH / 2;
        const outerR = Math.min(chartW, chartH) / 2 - 10;
        const innerR = type === 'doughnut' ? outerR * 0.5 : 0;
        const labelR = (outerR + innerR) / 2 + (type === 'doughnut' ? 0 : outerR * 0.15);
        let angle = -Math.PI / 2;
        for (let i = 0; i < vals.length; ++i) {
          const slice = (Math.abs(vals[i] || 0) / total) * Math.PI * 2;
          const midAngle = angle + slice / 2;
          const lx = cx + Math.cos(midAngle) * labelR;
          const ly = cy + Math.sin(midAngle) * labelR;
          const parts = [];
          if (dl.showCategory && labels[i]) parts.push(labels[i]);
          if (dl.showValue) parts.push(String(vals[i]));
          if (dl.showPercent) parts.push(((Math.abs(vals[i] || 0) / total) * 100).toFixed(1) + '%');
          ctx.fillStyle = contrastColor(colors[i % colors.length]);
          ctx.fillText(parts.join(' '), lx, ly);
          angle += slice;
        }
      }
      ctx.restore();
    }

    if (options.legend && options.seriesNames) {
      const lx = options.legendPos === 'right' ? W - padding.right - 80 : padding.left;
      let ly = options.legendPos === 'right' ? padding.top : H - 16;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      for (let i = 0; i < options.seriesNames.length; ++i) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(lx, ly - 8, 10, 10);
        ctx.fillStyle = '#333';
        ctx.fillText(options.seriesNames[i], lx + 14, ly);
        ly += 14;
      }
    }
  }

  // ── Inline Charts ──────────────────────────────────────────────────

  function getChartDataFromRange(rangeStr) {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return { data: [], labels: [] };
    const start = _parseKey(parts[0]);
    const end = _parseKey(parts[1]);
    if (!start || !end) return { data: [], labels: [] };

    const labels = [];
    const data = [];

    if (start.col === end.col) {
      for (let r = start.row; r <= end.row; ++r) {
        const val = _getCellValue(start.col, r);
        data.push(typeof val === 'number' ? val : parseFloat(val) || 0);
        labels.push(_cellKey(start.col, r));
      }
      return { data, labels };
    }

    for (let r = start.row + 1; r <= end.row; ++r) {
      const labelVal = _getCellValue(start.col, r);
      labels.push(String(labelVal));
    }

    for (let c = start.col + 1; c <= end.col; ++c) {
      const series = [];
      for (let r = start.row + 1; r <= end.row; ++r) {
        const val = _getCellValue(c, r);
        series.push(typeof val === 'number' ? val : parseFloat(val) || 0);
      }
      data.push(series);
    }

    if (data.length === 1) return { data: data[0], labels };
    return { data, labels };
  }

  function createInlineChart(type, sourceRange, options) {
    const ac = _getActiveCell();
    const chart = {
      id: Date.now(),
      type,
      sourceRange,
      options: options || {},
      position: { x: 10, y: 10, width: 400, height: 300 },
      anchorCell: { col: ac.col, row: ac.row },
    };
    _S().inlineCharts.push(chart);
    renderInlineChart(chart);
    _setDirty();
  }

  function renderInlineChart(chart) {
    const existing = document.querySelector('.inline-chart[data-chart-id="' + chart.id + '"]');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'inline-chart';
    container.dataset.chartId = chart.id;
    container.style.position = 'absolute';
    container.style.left = chart.position.x + 'px';
    container.style.top = chart.position.y + 'px';
    container.style.width = chart.position.width + 'px';
    container.style.height = chart.position.height + 'px';
    container.style.zIndex = '100';
    container.style.border = '1px solid var(--sz-color-button-shadow)';
    container.style.background = '#fff';
    container.style.boxShadow = '1px 1px 4px rgba(0,0,0,0.15)';
    container.style.cursor = 'move';

    const canvas = document.createElement('canvas');
    canvas.width = chart.position.width;
    canvas.height = chart.position.height;
    container.appendChild(canvas);

    const resizeHandle = document.createElement('div');
    resizeHandle.style.cssText = 'position:absolute;bottom:0;right:0;width:12px;height:12px;cursor:se-resize;background:var(--sz-color-button-shadow);opacity:0.5;';
    container.appendChild(resizeHandle);

    _gridScroll.appendChild(container);

    const { data, labels } = getChartDataFromRange(chart.sourceRange);
    const ctx = canvas.getContext('2d');
    drawChartOnCanvas(ctx, canvas.width, canvas.height, chart.type, data, labels, chart.options);

    let dragStartX, dragStartY, dragOrigX, dragOrigY;
    container.addEventListener('pointerdown', (e) => {
      if (e.target === resizeHandle) return;
      e.preventDefault();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragOrigX = chart.position.x;
      dragOrigY = chart.position.y;
      container.setPointerCapture(e.pointerId);
    });

    container.addEventListener('pointermove', (e) => {
      if (!container.hasPointerCapture(e.pointerId) || e.target === resizeHandle) return;
      chart.position.x = dragOrigX + (e.clientX - dragStartX);
      chart.position.y = dragOrigY + (e.clientY - dragStartY);
      container.style.left = chart.position.x + 'px';
      container.style.top = chart.position.y + 'px';
    });

    container.addEventListener('pointerup', (e) => {
      if (container.hasPointerCapture(e.pointerId))
        container.releasePointerCapture(e.pointerId);
    });

    resizeHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = chart.position.width;
      const startH = chart.position.height;
      resizeHandle.setPointerCapture(e.pointerId);

      const onMove = (ev) => {
        chart.position.width = Math.max(200, startW + (ev.clientX - startX));
        chart.position.height = Math.max(150, startH + (ev.clientY - startY));
        container.style.width = chart.position.width + 'px';
        container.style.height = chart.position.height + 'px';
        canvas.width = chart.position.width;
        canvas.height = chart.position.height;
        const fresh = getChartDataFromRange(chart.sourceRange);
        drawChartOnCanvas(ctx, canvas.width, canvas.height, chart.type, fresh.data, fresh.labels, chart.options);
      };

      const onUp = (ev) => {
        resizeHandle.releasePointerCapture(ev.pointerId);
        resizeHandle.removeEventListener('pointermove', onMove);
        resizeHandle.removeEventListener('pointerup', onUp);
      };

      resizeHandle.addEventListener('pointermove', onMove);
      resizeHandle.addEventListener('pointerup', onUp);
    });

    container.addEventListener('dblclick', () => {
      _showChartOptionsDialog(chart);
    });

    container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const old = document.querySelector('.chart-context-menu');
      if (old) old.remove();

      const menu = document.createElement('div');
      menu.className = 'sheet-context-menu chart-context-menu';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';

      const items = [
        { label: 'Edit Chart\u2026', action: 'edit' },
        { label: 'Change Data Range\u2026', action: 'range' },
        { label: 'Change Chart Type\u2026', action: 'type' },
        { sep: true },
        { label: 'Format Colors\u2026', action: 'colors' },
        { label: 'Toggle Legend', action: 'legend' },
        { label: 'Toggle Data Labels', action: 'labels' },
        { sep: true },
        { label: 'Delete Chart', action: 'delete' },
      ];

      for (const item of items) {
        if (item.sep) {
          const sep = document.createElement('div');
          sep.className = 'sheet-ctx-sep';
          menu.appendChild(sep);
          continue;
        }
        const btn = document.createElement('div');
        btn.className = 'sheet-ctx-item';
        btn.textContent = item.label;
        btn.addEventListener('click', () => {
          menu.remove();
          _handleChartContextAction(chart, item.action);
        });
        menu.appendChild(btn);
      }

      document.body.appendChild(menu);
      const close = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('pointerdown', close, true);
        }
      };
      setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
    });
  }

  function renderAllInlineCharts() {
    for (const el of document.querySelectorAll('.inline-chart')) el.remove();
    for (const chart of _S().inlineCharts) renderInlineChart(chart);
  }

  function _handleChartContextAction(chart, action) {
    switch (action) {
      case 'edit':
        _showChartOptionsDialog(chart);
        break;
      case 'range': {
        const r = prompt('Data range (e.g. A1:C5):', chart.sourceRange);
        if (r) {
          chart.sourceRange = r.trim();
          renderInlineChart(chart);
          _setDirty();
        }
        break;
      }
      case 'type': {
        const types = ['bar', 'column', 'line', 'pie', 'doughnut', 'scatter', 'area', 'radar', 'histogram', 'combo'];
        const t = prompt('Chart type (' + types.join(', ') + '):', chart.type);
        if (t && types.includes(t.trim().toLowerCase())) {
          chart.type = t.trim().toLowerCase();
          renderInlineChart(chart);
          _setDirty();
        }
        break;
      }
      case 'colors': {
        const current = (chart.options.colors || ['#4472c4', '#ed7d31', '#70ad47', '#ffc000']).join(', ');
        const c = prompt('Series colors (comma-separated hex):', current);
        if (c) {
          chart.options.colors = c.split(',').map(s => s.trim());
          renderInlineChart(chart);
          _setDirty();
        }
        break;
      }
      case 'legend':
        chart.options.legend = !chart.options.legend;
        if (chart.options.legend && !chart.options.seriesNames) {
          const fresh = getChartDataFromRange(chart.sourceRange);
          const cnt = Array.isArray(fresh.data[0]) ? fresh.data.length : 1;
          chart.options.seriesNames = Array.from({ length: cnt }, (_, i) => 'Series ' + (i + 1));
        }
        renderInlineChart(chart);
        _setDirty();
        break;
      case 'labels':
        if (chart.options.dataLabels)
          delete chart.options.dataLabels;
        else
          chart.options.dataLabels = { showValue: true, showPercent: true, showCategory: false };
        renderInlineChart(chart);
        _setDirty();
        break;
      case 'delete': {
        const charts = _S().inlineCharts;
        const idx = charts.indexOf(chart);
        if (idx >= 0) charts.splice(idx, 1);
        const el = document.querySelector('.inline-chart[data-chart-id="' + chart.id + '"]');
        if (el) el.remove();
        _setDirty();
        break;
      }
    }
  }

  function _showChartOptionsDialog(chart) {
    const dlg = document.createElement('div');
    dlg.className = 'dialog';
    dlg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border:1px solid #999;box-shadow:4px 4px 12px rgba(0,0,0,0.3);padding:16px;z-index:6000;min-width:320px;font-size:12px;';

    dlg.innerHTML = '<div style="font-weight:bold;margin-bottom:12px;font-size:13px;">Chart Options</div>'
      + '<label style="display:block;margin-bottom:8px;">Title: <input type="text" id="co-title" value="' + (chart.options.title || '').replace(/"/g, '&quot;') + '" style="width:200px;"></label>'
      + '<label style="display:block;margin-bottom:8px;">X-Axis Label: <input type="text" id="co-xlabel" value="' + (chart.options.xLabel || '').replace(/"/g, '&quot;') + '" style="width:160px;"></label>'
      + '<label style="display:block;margin-bottom:8px;">Y-Axis Label: <input type="text" id="co-ylabel" value="' + (chart.options.yLabel || '').replace(/"/g, '&quot;') + '" style="width:160px;"></label>'
      + '<hr style="margin:8px 0;">'
      + '<label style="display:block;margin-bottom:4px;"><input type="checkbox" id="co-trend" ' + (chart.options.trendline ? 'checked' : '') + '> Trendline</label>'
      + '<label style="display:block;margin-bottom:4px;margin-left:20px;">Type: <select id="co-trend-type"><option value="linear">Linear</option><option value="exponential">Exponential</option><option value="polynomial">Polynomial</option></select></label>'
      + '<hr style="margin:8px 0;">'
      + '<label style="display:block;margin-bottom:4px;"><input type="checkbox" id="co-dl-val" ' + (chart.options.dataLabels?.showValue ? 'checked' : '') + '> Show Values</label>'
      + '<label style="display:block;margin-bottom:4px;"><input type="checkbox" id="co-dl-pct" ' + (chart.options.dataLabels?.showPercent ? 'checked' : '') + '> Show Percentages</label>'
      + '<label style="display:block;margin-bottom:4px;"><input type="checkbox" id="co-dl-cat" ' + (chart.options.dataLabels?.showCategory ? 'checked' : '') + '> Show Categories</label>'
      + '<hr style="margin:8px 0;">'
      + '<label style="display:block;margin-bottom:4px;"><input type="checkbox" id="co-legend" ' + (chart.options.legend ? 'checked' : '') + '> Show Legend</label>'
      + '<label style="display:block;margin-bottom:8px;">Legend Position: <select id="co-legend-pos"><option value="bottom">Bottom</option><option value="right">Right</option></select></label>'
      + '<div style="text-align:right;margin-top:12px;"><button id="co-ok" style="padding:4px 16px;margin-right:8px;">OK</button><button id="co-cancel" style="padding:4px 16px;">Cancel</button></div>';

    document.body.appendChild(dlg);

    if (chart.options.trendline)
      dlg.querySelector('#co-trend-type').value = chart.options.trendline.type || 'linear';
    if (chart.options.legendPos)
      dlg.querySelector('#co-legend-pos').value = chart.options.legendPos;

    dlg.querySelector('#co-ok').addEventListener('click', () => {
      chart.options.title = dlg.querySelector('#co-title').value;
      chart.options.xLabel = dlg.querySelector('#co-xlabel').value || undefined;
      chart.options.yLabel = dlg.querySelector('#co-ylabel').value || undefined;

      if (dlg.querySelector('#co-trend').checked) {
        const tType = dlg.querySelector('#co-trend-type').value;
        chart.options.trendline = { type: tType };
        if (tType === 'polynomial') chart.options.trendline.degree = 2;
      } else
        delete chart.options.trendline;

      const showVal = dlg.querySelector('#co-dl-val').checked;
      const showPct = dlg.querySelector('#co-dl-pct').checked;
      const showCat = dlg.querySelector('#co-dl-cat').checked;
      if (showVal || showPct || showCat)
        chart.options.dataLabels = { showValue: showVal, showPercent: showPct, showCategory: showCat };
      else
        delete chart.options.dataLabels;

      chart.options.legend = dlg.querySelector('#co-legend').checked;
      chart.options.legendPos = dlg.querySelector('#co-legend-pos').value;
      if (chart.options.legend && !chart.options.seriesNames) {
        const fresh = getChartDataFromRange(chart.sourceRange);
        const cnt = Array.isArray(fresh.data[0]) ? fresh.data.length : 1;
        chart.options.seriesNames = Array.from({ length: cnt }, (_, i) => 'Series ' + (i + 1));
      }

      dlg.remove();
      renderInlineChart(chart);
      _setDirty();
    });

    dlg.querySelector('#co-cancel').addEventListener('click', () => dlg.remove());
  }

  // ── Sparklines ─────────────────────────────────────────────────────

  function getSparklineValues(rangeStr) {
    const parts = rangeStr.split(':');
    if (parts.length !== 2) return [];
    const start = _parseKey(parts[0]);
    const end = _parseKey(parts[1]);
    if (!start || !end) return [];

    const values = [];
    for (let r = start.row; r <= end.row; ++r)
      for (let c = start.col; c <= end.col; ++c) {
        const val = _getCellValue(c, r);
        const n = typeof val === 'number' ? val : parseFloat(val);
        if (!isNaN(n)) values.push(n);
      }
    return values;
  }

  function renderSparkline(td, col, row) {
    const fmt = _getFormat(col, row);
    if (!fmt.sparkline) return;
    const sp = fmt.sparkline;

    let canvas = td.querySelector('.sparkline-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'sparkline-canvas';
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
      td.style.position = 'relative';
      td.appendChild(canvas);
    }

    const rect = td.getBoundingClientRect();
    canvas.width = Math.max(rect.width, 40);
    canvas.height = Math.max(rect.height, 16);

    const rangeData = getSparklineValues(sp.range);
    if (!rangeData.length) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width;
    const H = canvas.height;
    const pad = 2;

    const vals = rangeData;
    const dataMax = Math.max(...vals);
    const dataMin = Math.min(...vals);
    // Support custom min/max axis bounds
    const spMin = sp.axisMin !== undefined ? sp.axisMin : dataMin;
    const spMax = sp.axisMax !== undefined ? sp.axisMax : dataMax;
    const spRange = spMax - spMin || 1;
    const colorLine = sp.colorLine || '#4472c4';
    const colorHigh = sp.colorHigh || '#22863a';
    const colorLow = sp.colorLow || '#cb2431';
    const colorNegative = sp.colorNegative || '#c00000';
    const colorFirst = sp.colorFirst || '#ffc000';
    const colorLast = sp.colorLast || '#70ad47';
    const colorMarker = sp.colorMarker || colorLine;

    // Determine marker visibility
    const markers = sp.markers || 'none'; // 'none', 'all', 'first', 'last', 'high', 'low', 'negative', 'firstlast', 'highlow'
    const showMarkers = sp.showMarkers || markers !== 'none';

    function shouldShowMarker(i, val) {
      if (markers === 'all') return true;
      if (markers === 'first' && i === 0) return true;
      if (markers === 'last' && i === vals.length - 1) return true;
      if (markers === 'high' && val === dataMax) return true;
      if (markers === 'low' && val === dataMin) return true;
      if (markers === 'negative' && val < 0) return true;
      if (markers === 'firstlast' && (i === 0 || i === vals.length - 1)) return true;
      if (markers === 'highlow' && (val === dataMax || val === dataMin)) return true;
      return false;
    }

    function markerColor(i, val) {
      if (val === dataMax) return colorHigh;
      if (val === dataMin) return colorLow;
      if (val < 0) return colorNegative;
      if (i === 0) return colorFirst;
      if (i === vals.length - 1) return colorLast;
      return colorMarker;
    }

    // Draw axis line at zero if enabled and zero is in visible range
    if (sp.showAxis && spMin < 0 && spMax > 0) {
      const zeroY = pad + (H - pad * 2) * (1 - (0 - spMin) / spRange);
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, zeroY);
      ctx.lineTo(W, zeroY);
      ctx.stroke();
    }

    switch (sp.type) {
      case 'line': {
        const stepX = (W - pad * 2) / Math.max(vals.length - 1, 1);
        const mSize = sp.markerSize || 2;

        // Fill area under line if colorFill is set
        if (sp.colorFill) {
          ctx.fillStyle = sp.colorFill + '40';
          ctx.beginPath();
          ctx.moveTo(pad, pad + (H - pad * 2));
          for (let i = 0; i < vals.length; ++i) {
            const x = pad + i * stepX;
            const y = pad + (H - pad * 2) * (1 - (vals[i] - spMin) / spRange);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(pad + (vals.length - 1) * stepX, pad + (H - pad * 2));
          ctx.closePath();
          ctx.fill();
        }

        ctx.strokeStyle = colorLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < vals.length; ++i) {
          const x = pad + i * stepX;
          const y = pad + (H - pad * 2) * (1 - (vals[i] - spMin) / spRange);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        if (showMarkers) {
          for (let i = 0; i < vals.length; ++i) {
            if (!shouldShowMarker(i, vals[i]) && markers !== 'none') continue;
            if (markers === 'none' && !sp.showMarkers) continue;
            const x = pad + i * stepX;
            const y = pad + (H - pad * 2) * (1 - (vals[i] - spMin) / spRange);
            ctx.fillStyle = markerColor(i, vals[i]);
            ctx.beginPath();
            ctx.arc(x, y, mSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case 'column': {
        const barW = (W - pad * 2) / vals.length;
        for (let i = 0; i < vals.length; ++i) {
          const barH = Math.abs((vals[i] - Math.max(spMin, 0)) / spRange) * (H - pad * 2);
          const x = pad + i * barW;
          if (vals[i] >= 0) {
            const y = pad + (H - pad * 2) - barH;
            ctx.fillStyle = vals[i] === dataMax ? colorHigh : vals[i] === dataMin ? colorLow : colorLine;
            ctx.fillRect(x, y, barW - 1, barH);
          } else {
            const zeroY = pad + (H - pad * 2) * (1 - (0 - spMin) / spRange);
            const negH = Math.abs(vals[i] / spRange) * (H - pad * 2);
            ctx.fillStyle = colorNegative;
            ctx.fillRect(x, zeroY, barW - 1, negH);
          }
        }
        break;
      }

      case 'win-loss': {
        const barW = (W - pad * 2) / vals.length;
        const midY = H / 2;
        const halfH = (H - pad * 2) / 2;
        for (let i = 0; i < vals.length; ++i) {
          const x = pad + i * barW;
          if (vals[i] > 0) {
            ctx.fillStyle = colorHigh;
            ctx.fillRect(x, midY - halfH * 0.8, barW - 1, halfH * 0.8);
          } else if (vals[i] < 0) {
            ctx.fillStyle = colorLow;
            ctx.fillRect(x, midY, barW - 1, halfH * 0.8);
          }
        }
        break;
      }
    }
  }

  function insertSparkline(type) {
    const rangeStr = prompt('Data range for sparkline (e.g. A1:A10):');
    if (!rangeStr) return;
    const ac = _getActiveCell();
    _setFormat(ac.col, ac.row, {
      sparkline: {
        type,
        range: rangeStr.toUpperCase(),
        colorLine: '#4472c4',
        colorHigh: '#22863a',
        colorLow: '#cb2431',
        showMarkers: type === 'line',
      }
    });
    _rebuildGrid();
    _setDirty();
  }

  // ── Render Pivot Chart ───────────────────────────────────────

  function renderPivotChart(chartData) {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return;

    const titleEl = document.getElementById('chart-title');
    if (titleEl) titleEl.textContent = 'Pivot Chart';

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const type = chartData.type || 'bar';
    const labels = chartData.labels || [];

    const data = chartData.datasets.length === 1
      ? chartData.datasets[0].data
      : chartData.datasets.map(ds => ds.data);

    const options = {
      title: 'Pivot Chart',
      legend: chartData.datasets.length > 1,
      seriesNames: chartData.datasets.map(ds => ds.label),
    };

    drawChartOnCanvas(ctx, W, H, type, data, labels, options);
    _showDialog('dlg-chart');
  }

  // ── Sparkline Options Dialog ──────────────────────────────────

  function showSparklineOptions(col, row) {
    const fmt = _getFormat(col, row);
    if (!fmt.sparkline) return;
    const sp = fmt.sparkline;

    // Populate dialog fields
    const dlg = document.getElementById('dlg-sparkline-options');
    if (!dlg) {
      _showSparklineOptionsFallback(col, row, sp);
      return;
    }

    document.getElementById('sp-color-line').value = sp.colorLine || '#4472c4';
    document.getElementById('sp-color-fill').value = sp.colorFill || '#4472c4';
    document.getElementById('sp-color-high').value = sp.colorHigh || '#22863a';
    document.getElementById('sp-color-low').value = sp.colorLow || '#cb2431';
    document.getElementById('sp-color-first').value = sp.colorFirst || '#ffc000';
    document.getElementById('sp-color-last').value = sp.colorLast || '#70ad47';
    document.getElementById('sp-color-negative').value = sp.colorNegative || '#c00000';
    document.getElementById('sp-color-marker').value = sp.colorMarker || sp.colorLine || '#4472c4';

    document.getElementById('sp-axis-min').value = sp.axisMin !== undefined ? sp.axisMin : '';
    document.getElementById('sp-axis-max').value = sp.axisMax !== undefined ? sp.axisMax : '';
    document.getElementById('sp-axis-line').checked = !!sp.showAxis;
    document.getElementById('sp-axis-same-scale').checked = !!sp.sameScale;

    document.getElementById('sp-markers-show').checked = !!sp.showMarkers;
    document.getElementById('sp-markers-type').value = sp.markers || 'none';
    document.getElementById('sp-markers-size').value = sp.markerSize || 2;
    document.getElementById('sp-markers-highlight-high').checked = sp.markers === 'high' || sp.markers === 'highlow' || sp.markers === 'all';
    document.getElementById('sp-markers-highlight-low').checked = sp.markers === 'low' || sp.markers === 'highlow' || sp.markers === 'all';
    document.getElementById('sp-markers-highlight-first').checked = sp.markers === 'first' || sp.markers === 'firstlast' || sp.markers === 'all';
    document.getElementById('sp-markers-highlight-last').checked = sp.markers === 'last' || sp.markers === 'firstlast' || sp.markers === 'all';
    document.getElementById('sp-markers-highlight-neg').checked = sp.markers === 'negative' || sp.markers === 'all';

    // Wire tab switching
    const tabs = dlg.querySelectorAll('.sp-tab');
    const panels = dlg.querySelectorAll('.sp-panel');
    for (const tab of tabs) {
      tab.onclick = () => {
        for (const t of tabs) t.classList.remove('active');
        for (const p of panels) p.classList.remove('active');
        tab.classList.add('active');
        dlg.querySelector('.sp-panel[data-panel="' + tab.dataset.tab + '"]').classList.add('active');
      };
    }
    // Reset to first tab
    tabs[0].click();

    _showDialog(dlg.id).then((result) => {
      if (result !== 'ok') return;

      sp.colorLine = document.getElementById('sp-color-line').value;
      sp.colorFill = document.getElementById('sp-color-fill').value;
      sp.colorHigh = document.getElementById('sp-color-high').value;
      sp.colorLow = document.getElementById('sp-color-low').value;
      sp.colorFirst = document.getElementById('sp-color-first').value;
      sp.colorLast = document.getElementById('sp-color-last').value;
      sp.colorNegative = document.getElementById('sp-color-negative').value;
      sp.colorMarker = document.getElementById('sp-color-marker').value;

      const axisMinVal = document.getElementById('sp-axis-min').value.trim();
      sp.axisMin = axisMinVal === '' ? undefined : parseFloat(axisMinVal);
      const axisMaxVal = document.getElementById('sp-axis-max').value.trim();
      sp.axisMax = axisMaxVal === '' ? undefined : parseFloat(axisMaxVal);
      sp.showAxis = document.getElementById('sp-axis-line').checked;
      sp.sameScale = document.getElementById('sp-axis-same-scale').checked;

      sp.showMarkers = document.getElementById('sp-markers-show').checked;
      sp.markers = document.getElementById('sp-markers-type').value;
      sp.markerSize = parseInt(document.getElementById('sp-markers-size').value, 10) || 2;

      _setFormat(col, row, { sparkline: sp });
      _rebuildGrid();
      _setDirty();
    });
  }

  function _showSparklineOptionsFallback(col, row, sp) {
    const newColor = prompt('Line/bar color (hex):', sp.colorLine || '#4472c4');
    if (newColor !== null && newColor.trim()) sp.colorLine = newColor.trim();

    const markersOpt = prompt('Markers (none/all/first/last/high/low/negative/firstlast/highlow):', sp.markers || 'none');
    if (markersOpt !== null) sp.markers = markersOpt.trim();

    const axisOpt = prompt('Show axis line at zero? (yes/no):', sp.showAxis ? 'yes' : 'no');
    if (axisOpt !== null) sp.showAxis = axisOpt.trim().toLowerCase() === 'yes';

    _setFormat(col, row, { sparkline: sp });
    _rebuildGrid();
    _setDirty();
  }

  SS.ChartEngine = {
    init,
    drawChartOnCanvas,
    createInlineChart,
    renderInlineChart,
    renderAllInlineCharts,
    getChartDataFromRange,
    renderSparkline,
    insertSparkline,
    renderPivotChart,
    showSparklineOptions,
  };
})();
