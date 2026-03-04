;(function() {
  'use strict';

  const PresentationsApp = window.PresentationsApp || (window.PresentationsApp = {});

  // -----------------------------------------------------------------------
  // Default chart data
  // -----------------------------------------------------------------------

  const DEFAULT_CHART_DATA = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [
      { name: 'Series 1', values: [30, 50, 40, 70] },
      { name: 'Series 2', values: [20, 35, 55, 45] }
    ]
  };

  const CHART_COLORS = [
    '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000',
    '#5B9BD5', '#70AD47', '#264478', '#9B57A0'
  ];

  // -----------------------------------------------------------------------
  // Chart element data constructor
  // -----------------------------------------------------------------------

  function createChartElement(x, y, w, h, chartType) {
    return {
      id: 'el-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      type: 'chart',
      x: x || 200,
      y: y || 100,
      w: w || 500,
      h: h || 350,
      chartType: chartType || 'bar',
      data: JSON.parse(JSON.stringify(DEFAULT_CHART_DATA)),
      options: {
        title: '',
        showLegend: true,
        showGrid: true,
        showValues: false,
        backgroundColor: 'transparent'
      },
      rotation: 0,
      opacity: 1
    };
  }

  // -----------------------------------------------------------------------
  // Canvas-based chart rendering
  // -----------------------------------------------------------------------

  function renderChart(element, containerEl) {
    const canvas = document.createElement('canvas');
    canvas.width = element.w;
    canvas.height = element.h;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      containerEl.appendChild(canvas);
      return;
    }

    // Clear
    if (element.options.backgroundColor && element.options.backgroundColor !== 'transparent') {
      ctx.fillStyle = element.options.backgroundColor;
      ctx.fillRect(0, 0, element.w, element.h);
    } else {
      ctx.clearRect(0, 0, element.w, element.h);
    }

    const data = element.data || DEFAULT_CHART_DATA;
    const chartType = element.chartType || 'bar';
    const padding = { top: 30, right: 20, bottom: 40, left: 50 };

    // Title
    if (element.options.title) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(element.options.title, element.w / 2, 18);
      padding.top = 40;
    }

    const chartW = element.w - padding.left - padding.right;
    const chartH = element.h - padding.top - padding.bottom;

    switch (chartType) {
      case 'bar':
        _renderBarChart(ctx, data, padding, chartW, chartH, element);
        break;
      case 'line':
        _renderLineChart(ctx, data, padding, chartW, chartH, element);
        break;
      case 'pie':
        _renderPieChart(ctx, data, padding, chartW, chartH, element);
        break;
      case 'scatter':
        _renderScatterChart(ctx, data, padding, chartW, chartH, element);
        break;
      default:
        _renderBarChart(ctx, data, padding, chartW, chartH, element);
    }

    // Legend
    if (element.options.showLegend && data.series && data.series.length > 0)
      _renderLegend(ctx, data, element);

    containerEl.appendChild(canvas);
  }

  // -----------------------------------------------------------------------
  // Bar Chart
  // -----------------------------------------------------------------------

  function _renderBarChart(ctx, data, padding, chartW, chartH, element) {
    const labels = data.labels || [];
    const series = data.series || [];
    if (!labels.length || !series.length)
      return;

    // Calculate max value
    let maxVal = 0;
    for (const s of series)
      for (const v of s.values)
        if (v > maxVal) maxVal = v;
    if (maxVal === 0) maxVal = 1;

    const groupWidth = chartW / labels.length;
    const barWidth = groupWidth / (series.length + 1);
    const barGap = barWidth / (series.length + 1);

    // Grid
    if (element.options.showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 5; ++i) {
        const y = padding.top + chartH - (chartH * i / 5);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
      }
    }

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; ++i) {
      const val = Math.round(maxVal * i / 5);
      const y = padding.top + chartH - (chartH * i / 5);
      ctx.fillText(String(val), padding.left - 4, y + 3);
    }

    // Bars
    for (let si = 0; si < series.length; ++si) {
      ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
      const vals = series[si].values || [];
      for (let li = 0; li < labels.length; ++li) {
        const val = vals[li] || 0;
        const barH = (val / maxVal) * chartH;
        const x = padding.left + li * groupWidth + barGap + si * barWidth;
        const y = padding.top + chartH - barH;
        ctx.fillRect(x, y, barWidth - 1, barH);

        if (element.options.showValues) {
          ctx.fillStyle = '#333';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(val), x + (barWidth - 1) / 2, y - 3);
          ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
        }
      }
    }

    // X-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; ++i) {
      const x = padding.left + i * groupWidth + groupWidth / 2;
      ctx.fillText(labels[i], x, padding.top + chartH + 16);
    }
  }

  // -----------------------------------------------------------------------
  // Line Chart
  // -----------------------------------------------------------------------

  function _renderLineChart(ctx, data, padding, chartW, chartH, element) {
    const labels = data.labels || [];
    const series = data.series || [];
    if (!labels.length || !series.length)
      return;

    let maxVal = 0;
    for (const s of series)
      for (const v of s.values)
        if (v > maxVal) maxVal = v;
    if (maxVal === 0) maxVal = 1;

    // Grid
    if (element.options.showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 5; ++i) {
        const y = padding.top + chartH - (chartH * i / 5);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
      }
    }

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; ++i) {
      const val = Math.round(maxVal * i / 5);
      const y = padding.top + chartH - (chartH * i / 5);
      ctx.fillText(String(val), padding.left - 4, y + 3);
    }

    const stepX = labels.length > 1 ? chartW / (labels.length - 1) : chartW;

    // Lines
    for (let si = 0; si < series.length; ++si) {
      const color = CHART_COLORS[si % CHART_COLORS.length];
      const vals = series[si].values || [];

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let li = 0; li < labels.length; ++li) {
        const val = vals[li] || 0;
        const x = padding.left + li * stepX;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        if (li === 0)
          ctx.moveTo(x, y);
        else
          ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Points
      ctx.fillStyle = color;
      for (let li = 0; li < labels.length; ++li) {
        const val = vals[li] || 0;
        const x = padding.left + li * stepX;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        if (element.options.showValues) {
          ctx.fillStyle = '#333';
          ctx.font = '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(val), x, y - 8);
          ctx.fillStyle = color;
        }
      }
    }

    // X-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; ++i) {
      const x = padding.left + i * stepX;
      ctx.fillText(labels[i], x, padding.top + chartH + 16);
    }
  }

  // -----------------------------------------------------------------------
  // Pie Chart
  // -----------------------------------------------------------------------

  function _renderPieChart(ctx, data, padding, chartW, chartH, element) {
    const labels = data.labels || [];
    const series = data.series || [];
    if (!labels.length || !series.length)
      return;

    // Use first series values for pie slices
    const vals = series[0].values || [];
    const total = vals.reduce((sum, v) => sum + (v || 0), 0);
    if (total === 0)
      return;

    const cx = padding.left + chartW / 2;
    const cy = padding.top + chartH / 2;
    const radius = Math.min(chartW, chartH) / 2 - 10;

    let startAngle = -Math.PI / 2;

    for (let i = 0; i < vals.length; ++i) {
      const val = vals[i] || 0;
      const sliceAngle = (val / total) * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();

      // Stroke between slices
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      if (labels[i]) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = radius * 0.7;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[i], lx, ly);

        if (element.options.showValues) {
          const pct = Math.round(val / total * 100) + '%';
          ctx.fillText(pct, lx, ly + 12);
        }
      }

      startAngle = endAngle;
    }
  }

  // -----------------------------------------------------------------------
  // Scatter Chart
  // -----------------------------------------------------------------------

  function _renderScatterChart(ctx, data, padding, chartW, chartH, element) {
    const series = data.series || [];
    if (!series.length)
      return;

    // For scatter, use labels as X values if numeric, otherwise index
    const labels = data.labels || [];
    let maxX = labels.length - 1;
    let maxY = 0;
    let minX = 0;

    const numLabels = labels.map(Number);
    const isNumericLabels = numLabels.every(n => !isNaN(n));
    if (isNumericLabels && numLabels.length) {
      maxX = Math.max(...numLabels);
      minX = Math.min(...numLabels);
    }

    for (const s of series)
      for (const v of s.values)
        if (v > maxY) maxY = v;
    if (maxY === 0) maxY = 1;
    if (maxX === minX) maxX = minX + 1;

    // Grid
    if (element.options.showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 5; ++i) {
        const y = padding.top + chartH - (chartH * i / 5);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartW, y);
        ctx.stroke();
      }
    }

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.stroke();

    // Points
    for (let si = 0; si < series.length; ++si) {
      const color = CHART_COLORS[si % CHART_COLORS.length];
      const vals = series[si].values || [];

      ctx.fillStyle = color;
      for (let li = 0; li < vals.length; ++li) {
        const xVal = isNumericLabels ? numLabels[li] : li;
        const yVal = vals[li] || 0;
        const x = padding.left + ((xVal - minX) / (maxX - minX)) * chartW;
        const y = padding.top + chartH - (yVal / maxY) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; ++i) {
      const val = Math.round(maxY * i / 5);
      const y = padding.top + chartH - (chartH * i / 5);
      ctx.fillText(String(val), padding.left - 4, y + 3);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    for (let i = 0; i < labels.length; ++i) {
      const xVal = isNumericLabels ? numLabels[i] : i;
      const x = padding.left + ((xVal - minX) / (maxX - minX)) * chartW;
      ctx.fillText(labels[i], x, padding.top + chartH + 16);
    }
  }

  // -----------------------------------------------------------------------
  // Legend
  // -----------------------------------------------------------------------

  function _renderLegend(ctx, data, element) {
    const series = data.series || [];
    const legendY = element.h - 14;
    let legendX = element.w / 2 - (series.length * 60) / 2;

    ctx.font = '10px sans-serif';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < series.length; ++i) {
      ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
      ctx.fillRect(legendX, legendY - 4, 10, 10);
      ctx.fillStyle = '#666';
      ctx.textAlign = 'left';
      ctx.fillText(series[i].name || 'Series ' + (i + 1), legendX + 14, legendY + 1);
      legendX += 70;
    }
  }

  // -----------------------------------------------------------------------
  // Chart data editor dialog
  // -----------------------------------------------------------------------

  function showChartDataEditor(element, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'pp-dialog-overlay';
    overlay.style.display = 'flex';

    const dlg = document.createElement('div');
    dlg.className = 'pp-dialog';
    dlg.style.width = '500px';
    dlg.style.maxHeight = '80vh';
    dlg.style.overflow = 'auto';

    const title = document.createElement('h3');
    title.textContent = 'Edit Chart Data';
    dlg.appendChild(title);

    // Chart type selector
    const typeRow = document.createElement('div');
    typeRow.style.marginBottom = '8px';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Chart Type:';
    typeLabel.style.display = 'block';
    typeLabel.style.marginBottom = '4px';
    typeLabel.style.fontSize = '12px';
    typeRow.appendChild(typeLabel);

    const typeSelect = document.createElement('select');
    typeSelect.style.cssText = 'width:100%;padding:4px;border:1px solid #ccc;border-radius:3px;';
    for (const t of ['bar', 'line', 'pie', 'scatter']) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === element.chartType)
        opt.selected = true;
      typeSelect.appendChild(opt);
    }
    typeRow.appendChild(typeSelect);
    dlg.appendChild(typeRow);

    // Title input
    const titleRow = document.createElement('div');
    titleRow.style.marginBottom = '8px';
    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Title:';
    titleLabel.style.display = 'block';
    titleLabel.style.marginBottom = '4px';
    titleLabel.style.fontSize = '12px';
    titleRow.appendChild(titleLabel);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.value = element.options.title || '';
    titleInput.style.cssText = 'width:100%;padding:4px;border:1px solid #ccc;border-radius:3px;box-sizing:border-box;';
    titleRow.appendChild(titleInput);
    dlg.appendChild(titleRow);

    // Data table (textarea for simplicity)
    const dataLabel = document.createElement('label');
    dataLabel.textContent = 'Data (CSV format - first row: labels, subsequent rows: series_name, values):';
    dataLabel.style.display = 'block';
    dataLabel.style.marginBottom = '4px';
    dataLabel.style.fontSize = '12px';
    dlg.appendChild(dataLabel);

    const textarea = document.createElement('textarea');
    textarea.style.cssText = 'width:100%;height:120px;padding:4px;border:1px solid #ccc;border-radius:3px;font-family:Consolas,monospace;font-size:11px;box-sizing:border-box;';

    // Convert data to CSV
    const data = element.data || DEFAULT_CHART_DATA;
    let csv = ',' + (data.labels || []).join(',') + '\n';
    for (const s of (data.series || []))
      csv += (s.name || 'Series') + ',' + (s.values || []).join(',') + '\n';
    textarea.value = csv.trim();
    dlg.appendChild(textarea);

    // Buttons
    const buttons = document.createElement('div');
    buttons.className = 'dlg-buttons';
    buttons.style.marginTop = '16px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:6px 16px;border:1px solid #ccc;border-radius:3px;background:#f0f0f0;cursor:pointer;';
    cancelBtn.addEventListener('click', () => {
      overlay.parentNode.removeChild(overlay);
    });
    buttons.appendChild(cancelBtn);

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.style.cssText = 'padding:6px 16px;border:1px solid #3a62a8;border-radius:3px;background:#4472c4;color:#fff;cursor:pointer;';
    okBtn.addEventListener('click', () => {
      // Parse CSV back to data
      const lines = textarea.value.trim().split('\n');
      if (lines.length >= 2) {
        const headerCells = lines[0].split(',');
        const labels = headerCells.slice(1).map(s => s.trim());
        const series = [];
        for (let i = 1; i < lines.length; ++i) {
          const cells = lines[i].split(',');
          const name = cells[0].trim();
          const values = cells.slice(1).map(v => parseFloat(v.trim()) || 0);
          series.push({ name, values });
        }
        element.data = { labels, series };
      }
      element.chartType = typeSelect.value;
      element.options.title = titleInput.value;
      overlay.parentNode.removeChild(overlay);
      if (onSave)
        onSave();
    });
    buttons.appendChild(okBtn);
    dlg.appendChild(buttons);

    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
  }

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  PresentationsApp.ChartElement = Object.freeze({
    createChartElement,
    renderChart,
    showChartDataEditor,
    DEFAULT_CHART_DATA,
    CHART_COLORS
  });

})();
