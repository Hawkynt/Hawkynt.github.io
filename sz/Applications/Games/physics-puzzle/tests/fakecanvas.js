'use strict';

/* A recording 2D context and canvas for the art tests: every drawing call is
   counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, patterns: 0, globalAlpha: 1, globalCompositeOperation: 'source-over',
    font: '16px sans-serif', lineWidth: 1, fillStyle: '#000', strokeStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic' };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'save', 'restore',
    'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'setLineDash',
    'quadraticCurveTo', 'bezierCurveTo'];
  for (const name of plain)
    c[name] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; ++c.patterns; return {}; };
  c.getTransform = function() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };
  c.getLineDash = function() { return []; };
  c.measureText = function(t) {
    const m = /(\d+(?:\.\d+)?)px/.exec(c.font);
    return { width: String(t).length * (m ? parseFloat(m[1]) : 16) * 0.55 };
  };
  return c;
}

let canvasCount = 0;
function install() {
  global.window = global.window || {};
  global.document = { createElement: () => { ++canvasCount; const cv = { width: 0, height: 0 }; cv.getContext = () => { const g = fakeCtx(); g.canvas = cv; return g; }; return cv; } };
}

module.exports = { fakeCtx, install, get canvasCount() { return canvasCount; } };
