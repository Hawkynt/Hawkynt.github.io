;(function () {
'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// Section 1: Constants & Configuration
// ══════════════════════════════════════════════════════════════════════════════

const COLOR_PALETTE = ['#ff335f', '#337dff', '#2eaa63', '#ef8f24', '#8a49df', '#0ca8a8'];

const FUNCTION_METADATA = {
  sin: ['Sine', 'all real x'],
  cos: ['Cosine', 'all real x'],
  tan: ['Tangent', 'x != pi/2 + k*pi'],
  cot: ['Cotangent', 'x != k*pi'],
  csc: ['Cosecant', 'x != k*pi'],
  sec: ['Secant', 'x != pi/2 + k*pi'],
  asin: ['Arc sine', '-1 <= x <= 1'],
  acos: ['Arc cosine', '-1 <= x <= 1'],
  atan: ['Arc tangent', 'all real x'],
  atan2: ['Arc tangent of y/x', 'all real x, y'],
  acot: ['Arc cotangent', 'all real x'],
  acsc: ['Arc cosecant', '|x| >= 1'],
  asec: ['Arc secant', '|x| >= 1'],
  sinh: ['Hyperbolic sine', 'all real x'],
  cosh: ['Hyperbolic cosine', 'all real x'],
  tanh: ['Hyperbolic tangent', 'all real x'],
  coth: ['Hyperbolic cotangent', 'x != 0'],
  csch: ['Hyperbolic cosecant', 'x != 0'],
  sech: ['Hyperbolic secant', 'all real x'],
  asinh: ['Inverse hyperbolic sine', 'all real x'],
  acosh: ['Inverse hyperbolic cosine', 'x >= 1'],
  atanh: ['Inverse hyperbolic tangent', '|x| < 1'],
  acoth: ['Inverse hyperbolic cotangent', '|x| > 1'],
  acsch: ['Inverse hyperbolic cosecant', 'x != 0'],
  asech: ['Inverse hyperbolic secant', '0 < x <= 1'],
  floor: ['Round down', 'all real x'],
  ceil: ['Round up', 'all real x'],
  trunc: ['Truncate', 'all real x'],
  round: ['Round', 'all real x'],
  abs: ['Absolute', 'all real x'],
  sign: ['Sign', 'all real x'],
  pow: ['Power', 'depends'],
  sqrt: ['Square root', 'x >= 0'],
  cbrt: ['Cube root', 'all real x'],
  log: ['Natural log', 'x > 0'],
  log10: ['Base-10 log', 'x > 0'],
  log2: ['Base-2 log', 'x > 0'],
  logn: ['Log base N', 'x > 0, b > 0, b != 1'],
  exp: ['Exponential', 'all real x'],
  hypot: ['Hypotenuse', 'all real x']
};

const FUNCTION_NAMES = Object.keys(FUNCTION_METADATA);
const CONSTANT_NAMES = ['pi', 'e'];

const FUNCTION_ALIASES = {
  ceiling: 'ceil',
  truncate: 'trunc',
  arsinh: 'asinh',
  arcosh: 'acosh',
  artanh: 'atanh',
  arcoth: 'acoth',
  arcsch: 'acsch',
  arsech: 'asech'
};

const DEFAULT_VIEWPORT_SCALE = 50;
const MAX_FAMILY_CURVES = 256;
const ZOOM_LIMITS = { min: 0.001, max: 1e8 };
const EXPORT_SCALE_FACTOR = 2;

// ══════════════════════════════════════════════════════════════════════════════
// Section 2: Math Library
// ══════════════════════════════════════════════════════════════════════════════

const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match]));

function roundWithMode(x, decimals, mode) {
  const d = Number.isFinite(decimals) ? clamp(decimals | 0, 0, 15) : 0;
  const scale = 10 ** d;
  const z = x * scale;
  const whole = Math.trunc(z);
  const frac = Math.abs(z - whole);

  if (mode === 0 && Math.abs(frac - 0.5) < 1e-12)
    return (whole % 2 === 0 ? whole : whole + (z >= 0 ? 1 : -1)) / scale;

  if (mode === 1) {
    const absFloor = Math.floor(Math.abs(z));
    const next = frac >= 0.5 ? absFloor + 1 : absFloor;
    return (z < 0 ? -next : next) / scale;
  }

  return Math.round(z) / scale;
}

const MATH_LIBRARY = Object.freeze({
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: x => 1 / Math.tan(x),
  csc: x => 1 / Math.sin(x),
  sec: x => 1 / Math.cos(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  acot: x => x === 0 ? Math.PI / 2 : Math.atan(1 / x),
  acsc: x => Math.asin(1 / x),
  asec: x => Math.acos(1 / x),
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  coth: x => Math.cosh(x) / Math.sinh(x),
  csch: x => 1 / Math.sinh(x),
  sech: x => 1 / Math.cosh(x),
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: Math.atanh,
  acoth: x => 0.5 * Math.log((x + 1) / (x - 1)),
  acsch: x => Math.asinh(1 / x),
  asech: x => Math.acosh(1 / x),
  floor: Math.floor,
  ceil: Math.ceil,
  trunc: Math.trunc,
  round: (x, n, m) => n === undefined ? Math.round(x) : roundWithMode(x, n, m === undefined ? 2 : Number(m)),
  abs: Math.abs,
  sign: Math.sign,
  pow: Math.pow,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  logn: (x, b) => Math.log(x) / Math.log(b),
  exp: Math.exp,
  hypot: Math.hypot,
  ceiling: Math.ceil,
  truncate: Math.trunc,
  arsinh: Math.asinh,
  arcosh: Math.acosh,
  artanh: Math.atanh,
  arcoth: x => 0.5 * Math.log((x + 1) / (x - 1)),
  arcsch: x => Math.asinh(1 / x),
  arsech: x => Math.acosh(1 / x)
});

// ══════════════════════════════════════════════════════════════════════════════
// Section 3: Tokenizer & Parser
// ══════════════════════════════════════════════════════════════════════════════

function tokenize(expression) {
  const source = String(expression || '');
  let position = 0;
  const tokens = [];

  while (position < source.length) {
    const char = source[position];

    if (/\s/.test(char)) {
      ++position;
      continue;
    }

    if (char === '*' && source[position + 1] === '*') {
      tokens.push({ t: 'op', v: '**', p: position });
      position += 2;
      continue;
    }

    if ('+-*/^(),'.includes(char)) {
      const type = char === '(' ? 'o' : char === ')' ? 'c' : char === ',' ? 'm' : 'op';
      tokens.push({ t: type, v: char, p: position });
      ++position;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const match = source.slice(position).match(/^(?:\d*\.\d+|\d+\.?\d*)/);
      if (!match)
        return { error: `Invalid number at ${position + 1}`, position };
      tokens.push({ t: 'n', v: match[0], p: position });
      position += match[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const match = source.slice(position).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      tokens.push({ t: 'id', v: match[0], p: position });
      position += match[0].length;
      continue;
    }

    return { error: `Unexpected "${char}" at ${position + 1}`, position };
  }

  return { tokens };
}

function needsImplicitMultiply(left, right) {
  if (!left || !right)
    return false;

  const isLeftValue = left.t === 'n' || left.t === 'id' || left.t === 'c';
  const isRightValue = right.t === 'n' || right.t === 'id' || right.t === 'o';

  if (!isLeftValue || !isRightValue)
    return false;

  if (left.t === 'id' && right.t === 'o' && FUNCTION_NAMES.includes(left.v.toLowerCase()))
    return false;

  return true;
}

function normalizeTokens(tokens) {
  const output = [];
  for (let i = 0; i < tokens.length; ++i) {
    const token = tokens[i];
    output.push(token);
    if (needsImplicitMultiply(token, tokens[i + 1]))
      output.push({ t: 'op', v: '*', p: token.p + String(token.v).length });
  }
  return output;
}

function compile(expression) {
  const input = String(expression || '').trim();
  if (!input)
    return { error: 'Expression is empty', position: 0 };

  const tokenResult = tokenize(input);
  if (!tokenResult.tokens)
    return { error: tokenResult.error, position: tokenResult.position };

  const normalized = normalizeTokens(tokenResult.tokens);
  let parenDepth = 0;
  let hasParameter = false;
  const jsParts = [];

  for (const token of normalized) {
    if (token.t === 'o') {
      ++parenDepth;
      jsParts.push('(');
      continue;
    }

    if (token.t === 'c') {
      --parenDepth;
      if (parenDepth < 0)
        return { error: 'Unexpected ")"', position: token.p };
      jsParts.push(')');
      continue;
    }

    if (token.t === 'm') {
      jsParts.push(',');
      continue;
    }

    if (token.t === 'n') {
      jsParts.push(token.v);
      continue;
    }

    if (token.t === 'op') {
      if (token.v === '^')
        jsParts.push('**');
      else if (['+', '-', '*', '/', '**'].includes(token.v))
        jsParts.push(token.v);
      else
        return { error: `Unsupported operator ${token.v}`, position: token.p };
      continue;
    }

    if (token.t === 'id') {
      const rawId = token.v.toLowerCase();
      const resolvedId = FUNCTION_ALIASES[rawId] || rawId;

      if (rawId === 'x') { jsParts.push('x'); continue; }
      if (rawId === 't') { hasParameter = true; jsParts.push('t'); continue; }
      if (rawId === 'pi') { jsParts.push('Math.PI'); continue; }
      if (rawId === 'e') { jsParts.push('Math.E'); continue; }
      if (FUNCTION_NAMES.includes(resolvedId) || FUNCTION_ALIASES[rawId]) { jsParts.push(`MX.${resolvedId}`); continue; }

      return { error: `Unknown symbol "${token.v}"`, position: token.p };
    }
  }

  if (parenDepth !== 0)
    return { error: 'Missing closing parenthesis', position: input.length - 1 };

  const jsCode = jsParts.join(' ');
  try {
    const fn = new Function('x', 't', 'MX', `"use strict";return (${jsCode});`);
    fn(0, 0, MATH_LIBRARY);
    return { ok: 1, jsCode, fn, hasParameter };
  } catch (err) {
    return { error: `Parse error: ${err.message}`, position: 0 };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 4: Polynomial Analysis (Symbolic)
// ══════════════════════════════════════════════════════════════════════════════

function polynomialTrim(coefficients) {
  const result = coefficients.slice();
  while (result.length > 1 && Math.abs(result[result.length - 1]) < 1e-12)
    result.pop();
  return result;
}

function polynomialAdd(a, b, sign = 1) {
  const length = Math.max(a.length, b.length);
  const output = new Array(length).fill(0);
  for (let i = 0; i < length; ++i)
    output[i] = (a[i] || 0) + sign * (b[i] || 0);
  return polynomialTrim(output);
}

function polynomialMultiply(a, b) {
  const output = new Array(Math.max(1, a.length + b.length - 1)).fill(0);
  for (let i = 0; i < a.length; ++i)
    for (let j = 0; j < b.length; ++j)
      output[i + j] += a[i] * b[j];
  return polynomialTrim(output);
}

function polynomialPower(base, exponent) {
  if (exponent < 0 || exponent > 12 || Math.floor(exponent) !== exponent)
    return null;
  let result = [1];
  let current = polynomialTrim(base.slice());
  let remaining = exponent;
  while (remaining > 0) {
    if (remaining & 1)
      result = polynomialMultiply(result, current);
    remaining >>= 1;
    if (remaining)
      current = polynomialMultiply(current, current);
  }
  return polynomialTrim(result);
}

function polynomialDivideByScalar(coefficients, scalar) {
  if (!Number.isFinite(scalar) || Math.abs(scalar) < 1e-12)
    return null;
  return polynomialTrim(coefficients.map(v => v / scalar));
}

function polynomialEvaluate(coefficients, x) {
  let sum = 0;
  let power = 1;
  for (let i = 0; i < coefficients.length; ++i) {
    sum += coefficients[i] * power;
    power *= x;
  }
  return sum;
}

function polynomialDerivative(coefficients) {
  if (coefficients.length <= 1)
    return [0];
  const output = [];
  for (let i = 1; i < coefficients.length; ++i)
    output.push(coefficients[i] * i);
  return polynomialTrim(output);
}

function polynomialToString(coefficients) {
  const terms = [];
  for (let i = coefficients.length - 1; i >= 0; --i) {
    const coeff = coefficients[i] || 0;
    if (Math.abs(coeff) < 1e-12)
      continue;

    const sign = coeff < 0 ? '-' : '+';
    const absCoeff = Math.abs(coeff);
    let part = '';

    if (i === 0)
      part = `${formatNumber(absCoeff)}`;
    else if (i === 1)
      part = `${Math.abs(absCoeff - 1) < 1e-12 ? '' : formatNumber(absCoeff)}x`;
    else
      part = `${Math.abs(absCoeff - 1) < 1e-12 ? '' : formatNumber(absCoeff)}x^${i}`;

    terms.push({ sign, part });
  }

  if (!terms.length)
    return '0';

  let result = (terms[0].sign === '-' ? '-' : '') + terms[0].part;
  for (let i = 1; i < terms.length; ++i)
    result += ` ${terms[i].sign} ${terms[i].part}`;
  return result;
}

function trySymbolicPolynomial(expression) {
  const tokenResult = tokenize(expression);
  if (!tokenResult.tokens)
    return null;

  const tokens = normalizeTokens(tokenResult.tokens);
  let index = 0;

  const peek = () => tokens[index] || null;
  const eat = () => tokens[index++] || null;

  function parsePrimary() {
    const token = peek();
    if (!token)
      return null;

    if (token.t === 'op' && (token.v === '+' || token.v === '-')) {
      eat();
      const operand = parsePrimary();
      if (!operand)
        return null;
      return token.v === '-' ? polynomialMultiply([-1], operand) : operand;
    }

    if (token.t === 'n') { eat(); return [Number(token.v)]; }
    if (token.t === 'id') {
      const id = token.v.toLowerCase();
      if (id === 'x') { eat(); return [0, 1]; }
      if (id === 'pi') { eat(); return [Math.PI]; }
      if (id === 'e') { eat(); return [Math.E]; }
      return null;
    }

    if (token.t === 'o') {
      eat();
      const inner = parseExpression();
      if (!inner)
        return null;
      const closing = peek();
      if (!closing || closing.t !== 'c')
        return null;
      eat();
      return inner;
    }

    return null;
  }

  function parsePower() {
    let left = parsePrimary();
    if (!left)
      return null;
    while (peek() && peek().t === 'op' && peek().v === '^') {
      eat();
      const right = parsePower();
      if (!right || right.length !== 1)
        return null;
      const result = polynomialPower(left, right[0]);
      if (!result)
        return null;
      left = result;
    }
    return left;
  }

  function parseMultiplication() {
    let left = parsePower();
    if (!left)
      return null;
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = eat().v;
      const right = parsePower();
      if (!right)
        return null;
      if (op === '*')
        left = polynomialMultiply(left, right);
      else {
        if (right.length !== 1)
          return null;
        const divided = polynomialDivideByScalar(left, right[0]);
        if (!divided)
          return null;
        left = divided;
      }
    }
    return left;
  }

  function parseExpression() {
    let left = parseMultiplication();
    if (!left)
      return null;
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = eat().v;
      const right = parseMultiplication();
      if (!right)
        return null;
      left = op === '+' ? polynomialAdd(left, right) : polynomialAdd(left, right, -1);
    }
    return left;
  }

  const polynomial = parseExpression();
  if (!polynomial || index !== tokens.length)
    return null;

  const derivative = polynomialDerivative(polynomial);
  const degree = polynomial.length - 1;

  const roots = [];
  if (degree === 1)
    roots.push(-polynomial[0] / polynomial[1]);
  else if (degree === 2) {
    const a = polynomial[2], b = polynomial[1], c = polynomial[0];
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrtDisc = Math.sqrt(discriminant);
      roots.push((-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a));
    }
  }

  return {
    poly: polynomialTrim(polynomial),
    der: polynomialTrim(derivative),
    deg: degree,
    roots: [...new Set(roots.filter(Number.isFinite).map(v => Number(v.toFixed(12))))]
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 5: Color Utilities
// ══════════════════════════════════════════════════════════════════════════════

function hexToRgb(hex) {
  const match = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!match)
    return [255, 0, 0];
  const value = match[1];
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lightness = (max + min) / 2;

  if (max === min)
    return [0, 0, lightness];

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return [hue / 6, saturation, lightness];
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hueToChannel = (p2, q2, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p2 + (q2 - p2) * 6 * t;
    if (t < 1 / 2) return q2;
    if (t < 2 / 3) return p2 + (q2 - p2) * (2 / 3 - t) * 6;
    return p2;
  };
  return [
    Math.round(hueToChannel(p, q, h + 1 / 3) * 255),
    Math.round(hueToChannel(p, q, h) * 255),
    Math.round(hueToChannel(p, q, h - 1 / 3) * 255)
  ];
}

function toHexByte(n) {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}

function generateColorVariation(baseHex, index, total) {
  if (total <= 1)
    return baseHex;
  const rgb = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const offset = (index / (total - 1)) * 0.42 - 0.21;
  const newLightness = clamp(l + offset, 0.2, 0.85);
  const newRgb = hslToRgb(h, clamp(s + 0.05, 0, 1), newLightness);
  return `#${toHexByte(newRgb[0])}${toHexByte(newRgb[1])}${toHexByte(newRgb[2])}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 6: Formatting Helpers
// ══════════════════════════════════════════════════════════════════════════════

function niceGridStep(pixelsPerUnit) {
  const value = 88 / pixelsPerUnit;
  if (!Number.isFinite(value) || value <= 0)
    return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let nice = 1;
  if (fraction < 1.5) nice = 1;
  else if (fraction < 3) nice = 2;
  else if (fraction < 7) nice = 5;
  else nice = 10;
  return nice * 10 ** exponent;
}

function formatNumber(value) {
  if (!Number.isFinite(value))
    return String(value);
  if (Math.abs(value) < 1e-8)
    return '0';
  if (Math.abs(value) >= 1e5 || Math.abs(value) < 1e-4)
    return value.toExponential(4);
  return Number(value.toFixed(6)).toString();
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 7: Syntax Highlighting
// ══════════════════════════════════════════════════════════════════════════════

function syntaxHighlight(expression, errorPosition) {
  const source = String(expression || '');
  const tokenResult = tokenize(source);

  if (!tokenResult.tokens) {
    if (Number.isInteger(errorPosition) && errorPosition >= 0 && errorPosition < source.length)
      return `${escapeHtml(source.slice(0, errorPosition))}<span class="err-token">${escapeHtml(source[errorPosition])}</span>${escapeHtml(source.slice(errorPosition + 1))}`;
    return escapeHtml(source);
  }

  let output = '';
  let cursor = 0;

  for (const token of tokenResult.tokens) {
    if (token.p > cursor)
      output += escapeHtml(source.slice(cursor, token.p));

    const escaped = escapeHtml(token.v);

    if (token.t === 'n')
      output += `<span class="num-token">${escaped}</span>`;
    else if (token.t === 'id') {
      const id = token.v.toLowerCase();
      if (FUNCTION_NAMES.includes(id))
        output += `<span class="fn-token" data-fn="${id}">${escaped}</span>`;
      else if (CONSTANT_NAMES.includes(id))
        output += `<span class="const-token" data-const="${id}">${escaped}</span>`;
      else if (id === 'x' || id === 't')
        output += `<span class="var-token">${escaped}</span>`;
      else
        output += `<span class="err-token">${escaped}</span>`;
    } else
      output += `<span class="op-token">${escaped}</span>`;

    cursor = token.p + String(token.v).length;
  }

  if (cursor < source.length)
    output += escapeHtml(source.slice(cursor));

  return output;
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 8: Web Worker Creation
// ══════════════════════════════════════════════════════════════════════════════

function createAnalysisWorker() {
  const workerCode = `
const MathFunctions = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  cot: x => 1 / Math.tan(x), csc: x => 1 / Math.sin(x), sec: x => 1 / Math.cos(x),
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  acot: x => x === 0 ? Math.PI / 2 : Math.atan(1 / x),
  acsc: x => Math.asin(1 / x), asec: x => Math.acos(1 / x),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  coth: x => Math.cosh(x) / Math.sinh(x), csch: x => 1 / Math.sinh(x), sech: x => 1 / Math.cosh(x),
  asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  acoth: x => 0.5 * Math.log((x + 1) / (x - 1)),
  acsch: x => Math.asinh(1 / x), asech: x => Math.acosh(1 / x),
  floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc,
  round: (x, n, m) => {
    if (n === undefined) return Math.round(x);
    const d = Math.max(0, Math.min(15, n | 0)), sc = 10 ** d, z = x * sc, w = Math.trunc(z), fr = Math.abs(z - w);
    if (m === 0 && Math.abs(fr - 0.5) < 1e-12) return (w % 2 === 0 ? w : w + (z >= 0 ? 1 : -1)) / sc;
    if (m === 1) { const a = Math.floor(Math.abs(z)), nx = fr >= 0.5 ? a + 1 : a; return (z < 0 ? -nx : nx) / sc; }
    return Math.round(z) / sc;
  },
  abs: Math.abs, sign: Math.sign, pow: Math.pow,
  sqrt: Math.sqrt, cbrt: Math.cbrt,
  log: Math.log, log10: Math.log10, log2: Math.log2,
  logn: (x, b) => Math.log(x) / Math.log(b),
  exp: Math.exp, hypot: Math.hypot,
  ceiling: Math.ceil, truncate: Math.trunc,
  arsinh: Math.asinh, arcosh: Math.acosh, artanh: Math.atanh,
  arcoth: x => 0.5 * Math.log((x + 1) / (x - 1)),
  arcsch: x => Math.asinh(1 / x), arsech: x => Math.acosh(1 / x)
};

function uniqueSorted(values, epsilon = 1e-3) {
  const result = [];
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (!result.some(x => Math.abs(x - v) <= epsilon)) result.push(v);
  }
  return result.sort((a, b) => a - b);
}

function bisect(fn, a, b, iterations = 44) {
  let fa = fn(a), fb = fn(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (Math.sign(fa) === Math.sign(fb) && Math.abs(fa) > 1e-8 && Math.abs(fb) > 1e-8) return null;
  let lo = a, hi = b;
  for (let i = 0; i < iterations; ++i) {
    const mid = (lo + hi) / 2, fm = fn(mid);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < 1e-10) return mid;
    if (Math.sign(fa) === Math.sign(fm)) { lo = mid; fa = fm; } else { hi = mid; fb = fm; }
  }
  return (lo + hi) / 2;
}

function nearAny(x, arr, epsilon) {
  return arr.some(v => Math.abs(v - x) <= epsilon);
}

onmessage = (event) => {
  const { id, j, x0, x1, paramT } = event.data;
  let fn;
  try { fn = new Function('x', 't', 'MX', '"use strict";return (' + j + ');'); }
  catch (err) { postMessage({ id, err: err.message }); return; }

  const tValue = typeof paramT === 'number' && Number.isFinite(paramT) ? paramT : 0;
  const evaluate = (x) => { const y = fn(x, tValue, MathFunctions); return Number.isFinite(y) ? y : NaN; };
  const span = Math.max(1e-6, x1 - x0);
  const h = Math.max(span / 6000, 1e-5);
  const derivative = (x) => (evaluate(x + h) - evaluate(x - h)) / (2 * h);
  const secondDerivative = (x) => (evaluate(x + h) - 2 * evaluate(x) + evaluate(x - h)) / (h * h);

  const sampleCount = 1400;
  const xValues = [], yValues = [], rawRoots = [], rawPoles = [];

  for (let i = 0; i <= sampleCount; ++i) {
    const x = x0 + (x1 - x0) * (i / sampleCount);
    xValues.push(x);
    yValues.push(evaluate(x));
  }

  const finiteAbsValues = yValues.filter(Number.isFinite).map(v => Math.abs(v));
  const medianY = finiteAbsValues.length ? finiteAbsValues.sort((a, b) => a - b)[Math.floor(finiteAbsValues.length / 2)] : 1;
  const jumpThreshold = Math.max(60, medianY * 25);

  for (let i = 0; i < sampleCount; ++i) {
    const xa = xValues[i], xb = xValues[i + 1], ya = yValues[i], yb = yValues[i + 1], dx = xb - xa;
    if (!Number.isFinite(ya) || !Number.isFinite(yb)) { rawPoles.push((xa + xb) / 2); continue; }
    const dy = yb - ya, slope = Math.abs(dy / dx), isBig = Math.abs(ya) > jumpThreshold || Math.abs(yb) > jumpThreshold;
    if ((isBig && Math.abs(dy) > Math.max(jumpThreshold, Math.abs(ya) * 0.6, Math.abs(yb) * 0.6)) || slope > Math.max(900, medianY * 110))
      rawPoles.push((xa + xb) / 2);
    if (Math.abs(ya) <= 1e-6) rawRoots.push(xa);
    if (Math.abs(yb) <= 1e-6) rawRoots.push(xb);
    if (Math.sign(ya) !== Math.sign(yb) && !nearAny((xa + xb) / 2, rawPoles, dx * 1.6)) {
      const root = bisect(evaluate, xa, xb);
      if (root !== null) rawRoots.push(root);
    }
  }

  const cleanedPoles = uniqueSorted(rawPoles, Math.max(span / 900, 1e-3));
  const rawCritical = [], rawInflection = [];

  for (let i = 0; i < sampleCount; ++i) {
    const xa = xValues[i], xb = xValues[i + 1], dx = xb - xa;
    const dLeft = derivative(xa), dRight = derivative(xb);
    if (Number.isFinite(dLeft) && Math.abs(dLeft) < 5e-4 && !nearAny(xa, cleanedPoles, dx * 1.4))
      rawCritical.push(xa);
    if (Number.isFinite(dLeft) && Number.isFinite(dRight) && Math.sign(dLeft) !== Math.sign(dRight) && !nearAny((xa + xb) / 2, cleanedPoles, dx * 1.4)) {
      const root = bisect(derivative, xa, xb, 32);
      if (root !== null) rawCritical.push(root);
    }
    const d2Left = secondDerivative(xa), d2Right = secondDerivative(xb);
    if (Number.isFinite(d2Left) && Number.isFinite(d2Right) && Math.sign(d2Left) !== Math.sign(d2Right) && !nearAny((xa + xb) / 2, cleanedPoles, dx * 1.4)) {
      const root = bisect(secondDerivative, xa, xb, 32);
      if (root !== null) rawInflection.push(root);
    }
  }

  const criticalPoints = uniqueSorted(rawCritical, Math.max(span / 1000, 8e-4));
  const extrema = [], saddlePoints = [];

  for (const x of criticalPoints) {
    const y = evaluate(x);
    if (!Number.isFinite(y) || nearAny(x, cleanedPoles, span / 600)) continue;
    const leftSlope = derivative(x - Math.max(h, span / 5000));
    const rightSlope = derivative(x + Math.max(h, span / 5000));
    const curvature = secondDerivative(x);
    if (!Number.isFinite(leftSlope) || !Number.isFinite(rightSlope)) continue;
    if (Math.sign(leftSlope) !== Math.sign(rightSlope)) {
      if (leftSlope > 0 && rightSlope < 0) extrema.push({ type: 'max', x, y });
      else if (leftSlope < 0 && rightSlope > 0) extrema.push({ type: 'min', x, y });
    } else if (Number.isFinite(curvature) && Math.abs(curvature) < 7e-3 && Math.abs(leftSlope) < 1e-3 && Math.abs(rightSlope) < 1e-3)
      saddlePoints.push({ x, y });
  }

  const inflectionTolerance = Math.max(span / 1000, 8e-4);
  const inflectionPoints = uniqueSorted(rawInflection, inflectionTolerance)
    .map(x => ({ x, y: evaluate(x) }))
    .filter(p => Number.isFinite(p.y) && !nearAny(p.x, cleanedPoles, span / 600));

  const splitPoints = uniqueSorted([...criticalPoints, ...cleanedPoles], Math.max(span / 1200, 1e-3));
  const rangePoints = [x0, ...splitPoints, x1];
  const monotonicity = [];
  for (let i = 0; i < rangePoints.length - 1; ++i) {
    const a = rangePoints[i], b = rangePoints[i + 1], mid = (a + b) / 2, slope = derivative(mid);
    if (!Number.isFinite(slope)) continue;
    monotonicity.push({ from: a, to: b, kind: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'flat' });
  }

  const yAtZero = evaluate(0);
  const rootTolerance = Math.max(span / 1200, 1e-3);
  const cleanedRoots = uniqueSorted(rawRoots, rootTolerance).filter(x => !nearAny(x, cleanedPoles, rootTolerance * 1.2));

  postMessage({
    id,
    roots: cleanedRoots,
    y0: Number.isFinite(yAtZero) ? yAtZero : null,
    ext: uniqueSorted(extrema.map(p => p.x), rootTolerance).map(x => extrema.find(p => Math.abs(p.x - x) <= rootTolerance)).filter(Boolean),
    inf: inflectionPoints,
    sad: uniqueSorted(saddlePoints.map(p => p.x), rootTolerance).map(x => saddlePoints.find(p => Math.abs(p.x - x) <= rootTolerance)).filter(Boolean),
    mono: monotonicity,
    poles: cleanedPoles,
    lim: { p: evaluate(1e6), n: evaluate(-1e6) }
  });
};`;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const worker = new Worker(blobUrl);
  URL.revokeObjectURL(blobUrl);
  return worker;
}

// ══════════════════════════════════════════════════════════════════════════════
// Section 9: Main Application
// ══════════════════════════════════════════════════════════════════════════════

// -- Service Worker Registration --

if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('./sw.js').catch(() => {});

// -- DOM References --

const canvas = document.getElementById('plotCanvas');
const canvasHost = document.getElementById('canvasHost');
const functionListEl = document.getElementById('functionList');
const legendBody = document.getElementById('legendBody');
const analysisStatusEl = document.getElementById('analysisStatus');
const analysisBodyEl = document.getElementById('analysisBody');
const traceTooltip = document.getElementById('traceTooltip');
const autocompleteEl = document.getElementById('autocomplete');
const fnTooltip = document.getElementById('fnTooltip');
const btnAddFunction = document.getElementById('btnAddFunction');
const menuBar = document.getElementById('menuBar');
const statusCoords = document.getElementById('statusCoords');
const statusZoom = document.getElementById('statusZoom');
const statusFunctions = document.getElementById('statusFunctions');

const ctx = canvas.getContext('2d');

// -- Application State --

const state = {
  functions: [],
  nextId: 1,
  devicePixelRatio: 1,
  canvasWidth: 1,
  canvasHeight: 1,
  viewport: {
    originX: 0,
    originY: 0,
    scale: DEFAULT_VIEWPORT_SCALE,
    showGrid: true,
    showLabels: true
  },
  pointer: { x: 0, y: 0, startX: 0, startY: 0, isInside: false, isDragging: false, hasMoved: false, pointerId: null },
  activeId: null,
  selectedCurve: null, // { funcId, t } — the curve clicked on the canvas
  autocomplete: { functionId: null, textarea: null, prefixStart: 0, items: [], selectedIndex: 0 },
  worker: null,
  sequenceId: 0,
  pendingId: 0,
  analysisData: null,
  markerPoints: [],
  analysisFunctionId: null
};

// -- Coordinate Transforms --

const mathToScreenX = (x) => state.viewport.originX + x * state.viewport.scale;
const mathToScreenY = (y) => state.viewport.originY - y * state.viewport.scale;
const screenToMathX = (px) => (px - state.viewport.originX) / state.viewport.scale;
const screenToMathY = (py) => (state.viewport.originY - py) / state.viewport.scale;

// -- Canvas Resize --

function resizeCanvas() {
  const rect = canvasHost.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  state.devicePixelRatio = dpr;
  state.canvasWidth = Math.max(1, Math.floor(rect.width));
  state.canvasHeight = Math.max(1, Math.floor(rect.height));

  if (state.canvasWidth < 1 || state.canvasHeight < 1)
    return;

  canvas.width = Math.floor(state.canvasWidth * dpr);
  canvas.height = Math.floor(state.canvasHeight * dpr);
  canvas.style.width = `${state.canvasWidth}px`;
  canvas.style.height = `${state.canvasHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (state.viewport.originX === 0 && state.viewport.originY === 0) {
    state.viewport.originX = state.canvasWidth / 2;
    state.viewport.originY = state.canvasHeight / 2;
  }

  draw();
}

// -- Function Management --

function getParameterValues(func) {
  if (!func.hasParameter)
    return [0];

  if (func.familyMode === 'list') {
    const values = func.listValues.split(',').map(x => Number(x.trim())).filter(Number.isFinite);
    return values.length ? values.slice(0, MAX_FAMILY_CURVES) : [0];
  }

  const min = Number(func.rangeMin);
  const max = Number(func.rangeMax);
  const step = Number(func.rangeStep);

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step === 0)
    return [0];

  const output = [];
  const ascending = max >= min;
  const actualStep = ascending ? Math.abs(step) : -Math.abs(step);
  let value = min;
  let guard = 0;

  while ((ascending ? value <= max + 1e-12 : value >= max - 1e-12) && guard < MAX_FAMILY_CURVES) {
    output.push(Number(value.toFixed(12)));
    value += actualStep;
    ++guard;
  }

  return output.length ? output : [0];
}

function createFunctionEntry(expression) {
  const id = state.nextId++;
  return {
    id,
    enabled: true,
    color: COLOR_PALETTE[(id - 1) % COLOR_PALETTE.length],
    expression,
    error: '',
    errorPosition: -1,
    compiled: null,
    hasParameter: false,
    familyMode: 'range',
    rangeMin: -3,
    rangeMax: 3,
    rangeStep: 1,
    listValues: '-2,-1,0,1,2'
  };
}

function parseFunction(func) {
  const result = compile(func.expression);
  if (result.error) {
    func.error = result.error;
    func.errorPosition = result.position ?? 0;
    func.compiled = null;
    func.hasParameter = /\bt\b/i.test(func.expression);
  } else {
    func.error = '';
    func.errorPosition = -1;
    func.compiled = result;
    func.hasParameter = result.hasParameter;
  }
}

function addFunction(expression = '') {
  const func = createFunctionEntry(expression);
  parseFunction(func);
  state.functions.push(func);
  if (state.activeId === null)
    state.activeId = func.id;
  renderFunctionList();
  analyzeActiveFunction();
  draw();
}

function deleteFunction(id) {
  state.functions = state.functions.filter(f => f.id !== id);
  if (state.activeId === id)
    state.activeId = state.functions.length ? state.functions[0].id : null;
  if (state.selectedCurve && state.selectedCurve.funcId === id)
    state.selectedCurve = null;
  renderFunctionList();
  analyzeActiveFunction();
  draw();
}

const findFunctionById = (id) => state.functions.find(f => f.id === id) || null;

function evaluateFunction(func, x, t) {
  if (!func.compiled)
    return NaN;
  try {
    const y = func.compiled.fn(x, t, MATH_LIBRARY);
    return Number.isFinite(y) ? y : NaN;
  } catch {
    return NaN;
  }
}

// -- Autocomplete --

function hideAutocomplete() {
  autocompleteEl.hidden = true;
  autocompleteEl.innerHTML = '';
  state.autocomplete.items = [];
  state.autocomplete.functionId = null;
  state.autocomplete.textarea = null;
}

function applyAutocomplete(value) {
  const ac = state.autocomplete;
  if (!ac.textarea || !ac.items.length)
    return;

  const text = ac.textarea.value;
  const start = ac.prefixStart;
  const end = ac.textarea.selectionStart;
  const item = value || ac.items[ac.selectedIndex];
  const insertion = FUNCTION_NAMES.includes(item) ? `${item}()` : item;
  const caretPosition = FUNCTION_NAMES.includes(item) ? start + item.length + 1 : start + item.length;

  ac.textarea.value = `${text.slice(0, start)}${insertion}${text.slice(end)}`;
  ac.textarea.selectionStart = caretPosition;
  ac.textarea.selectionEnd = caretPosition;

  const func = findFunctionById(ac.functionId);
  if (func) {
    func.expression = ac.textarea.value;
    parseFunction(func);
    renderFunctionList();
    analyzeActiveFunction();
    draw();
  }

  hideAutocomplete();
  ac.textarea.focus();
}

function updateAutocomplete(func, textarea) {
  const position = textarea.selectionStart;
  const left = textarea.value.slice(0, position);
  const match = left.match(/([A-Za-z_][A-Za-z0-9_]*)$/);

  if (!match) {
    hideAutocomplete();
    return;
  }

  const prefix = match[1].toLowerCase();
  if (!prefix) {
    hideAutocomplete();
    return;
  }

  const allNames = [...FUNCTION_NAMES, ...Object.keys(FUNCTION_ALIASES), ...CONSTANT_NAMES];
  const items = allNames
    .filter(name => name.startsWith(prefix) || name.includes(prefix))
    .sort((a, b) => {
      const aStarts = a.startsWith(prefix) ? 0 : 1;
      const bStarts = b.startsWith(prefix) ? 0 : 1;
      return aStarts - bStarts || a.length - b.length;
    })
    .slice(0, 8);

  if (!items.length) {
    hideAutocomplete();
    return;
  }

  state.autocomplete.functionId = func.id;
  state.autocomplete.textarea = textarea;
  state.autocomplete.prefixStart = position - match[1].length;
  state.autocomplete.items = items;
  state.autocomplete.selectedIndex = 0;

  autocompleteEl.innerHTML = items
    .map((item, i) => {
      const meta = FUNCTION_METADATA[item] || CONSTANT_METADATA[item];
      const desc = meta ? meta[0] : (FUNCTION_ALIASES[item] ? `Alias for ${FUNCTION_ALIASES[item]}` : '');
      return `<div class="ac-item${i === 0 ? ' active' : ''}" data-item="${item}"><span class="ac-name">${item}</span><span class="ac-desc">${escapeHtml(desc)}</span></div>`;
    })
    .join('');

  const textareaRect = textarea.getBoundingClientRect();
  const hostRect = canvasHost.getBoundingClientRect();
  autocompleteEl.style.left = `${textareaRect.left - hostRect.left + 4}px`;
  autocompleteEl.style.top = `${textareaRect.bottom - hostRect.top + 2}px`;
  autocompleteEl.hidden = false;

  autocompleteEl.querySelectorAll('.ac-item').forEach(node => {
    node.addEventListener('mousedown', (e) => {
      e.preventDefault();
      applyAutocomplete(node.dataset.item);
    });
  });
}

function showFunctionInfoFromCaret(textarea) {
  if (!(textarea instanceof HTMLTextAreaElement))
    return;

  const position = textarea.selectionStart | 0;
  const source = textarea.value || '';
  const leftPart = source.slice(0, position);
  const rightPart = source.slice(position);
  const leftMatch = leftPart.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
  const rightMatch = rightPart.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
  const word = (leftMatch ? leftMatch[1] : '') + (rightMatch ? rightMatch[1] : '');
  const id = word.toLowerCase();

  if (!id || !FUNCTION_METADATA[id]) {
    if (autocompleteEl.hidden) fnTooltip.hidden = true;
    return;
  }

  const meta = FUNCTION_METADATA[id];
  const textareaRect = textarea.getBoundingClientRect();
  const hostRect = canvasHost.getBoundingClientRect();
  fnTooltip.textContent = `${id}: ${meta[0]}. Domain: ${meta[1]}.`;
  fnTooltip.style.left = `${textareaRect.left - hostRect.left + 10}px`;
  fnTooltip.style.top = `${textareaRect.bottom - hostRect.top + 6}px`;
  fnTooltip.hidden = false;
}

// -- Menu System --

let openMenu = null;

function closeMenus() {
  for (const item of menuBar.querySelectorAll('.menu-item'))
    item.classList.remove('open');
  openMenu = null;
}

function handleMenuAction(action, entry) {
  switch (action) {
    case 'new':
      state.functions = [];
      state.activeId = null;
      state.selectedCurve = null;
      state.analysisData = null;
      state.analysisFunctionId = null;
      renderFunctionList();
      renderAnalysisPanel(null, null);
      draw();
      break;

    case 'add':
      addFunction('');
      break;

    case 'plot':
      draw();
      analyzeActiveFunction();
      break;

    case 'export':
      exportPng();
      break;

    case 'toggle-grid':
      state.viewport.showGrid = !state.viewport.showGrid;
      entry.classList.toggle('checked', state.viewport.showGrid);
      draw();
      break;

    case 'toggle-labels':
      state.viewport.showLabels = !state.viewport.showLabels;
      entry.classList.toggle('checked', state.viewport.showLabels);
      draw();
      break;

    case 'toggle-dark':
      document.body.classList.toggle('dark');
      entry.classList.toggle('checked', document.body.classList.contains('dark'));
      draw();
      break;

    case 'reset-view':
      resetView();
      break;

    case 'zoom-in':
      zoomBy(1.5);
      break;

    case 'zoom-out':
      zoomBy(1 / 1.5);
      break;

    case 'shortcuts':
      showShortcutsDialog();
      break;

    case 'about':
      showAboutDialog();
      break;
  }
}

function showShortcutsDialog() {
  const existingOverlay = document.querySelector('.dialog-overlay');
  if (existingOverlay)
    existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:2000;display:flex;align-items:center;justify-content:center;';

  const dialog = document.createElement('div');
  dialog.style.cssText = `background:var(--fp-panel,#ece9d8);border:1px solid var(--fp-border,#8d8d8d);padding:16px;max-width:340px;font:12px/1.6 Tahoma,sans-serif;color:var(--fp-text,#1b1b1b);box-shadow:4px 4px 8px rgba(0,0,0,0.3);`;
  dialog.innerHTML = `<b>Keyboard Shortcuts</b><br><br>
    <b>Ctrl+N</b> - New (clear all)<br>
    <b>Ctrl+Shift+N</b> - Add function<br>
    <b>Ctrl+Enter</b> - Plot all<br>
    <b>Ctrl+E</b> - Export PNG<br>
    <b>Ctrl+0</b> - Reset view<br>
    <b>Ctrl++</b> - Zoom in<br>
    <b>Ctrl+-</b> - Zoom out<br>
    <b>Mouse wheel</b> - Zoom at cursor<br>
    <b>Drag</b> - Pan<br><br>
    <button class="btn" style="float:right;">Close</button><div style="clear:both;"></div>`;

  dialog.querySelector('.btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function showAboutDialog() {
  const existingOverlay = document.querySelector('.dialog-overlay');
  if (existingOverlay)
    existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:2000;display:flex;align-items:center;justify-content:center;';

  const dialog = document.createElement('div');
  dialog.style.cssText = `background:var(--fp-panel,#ece9d8);border:1px solid var(--fp-border,#8d8d8d);padding:16px;max-width:320px;font:12px/1.6 Tahoma,sans-serif;color:var(--fp-text,#1b1b1b);box-shadow:4px 4px 8px rgba(0,0,0,0.3);`;
  dialog.innerHTML = `<b>Function Plotter</b><br><br>
    Plot mathematical functions with syntax highlighting, autocomplete, function families (parameter t), and Kurvendiskussion analysis.<br><br>
    Supports 42+ math functions including trigonometric, hyperbolic, logarithmic, and rounding functions.<br><br>
    <button class="btn" style="float:right;">Close</button><div style="clear:both;"></div>`;

  dialog.querySelector('.btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function setupMenuSystem() {
  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator'))
        return;

      if (openMenu === menuItem) {
        closeMenus();
        return;
      }

      closeMenus();
      menuItem.classList.add('open');
      openMenu = menuItem;
    });

    menuItem.addEventListener('pointerenter', () => {
      if (openMenu && openMenu !== menuItem) {
        closeMenus();
        menuItem.classList.add('open');
        openMenu = menuItem;
      }
    });
  }

  document.addEventListener('pointerdown', (e) => {
    if (openMenu && !menuBar.contains(e.target))
      closeMenus();
  });

  for (const entry of menuBar.querySelectorAll('.menu-entry')) {
    entry.addEventListener('click', () => {
      const action = entry.dataset.action;
      if (!action)
        return;
      closeMenus();
      handleMenuAction(action, entry);
    });
  }
}

// -- Reference Popup --

const CONSTANT_METADATA = {
  pi: ['\u03C0', 'Pi \u2248 3.14159', 'Ratio of circumference to diameter'],
  e: ['e', "Euler's number \u2248 2.71828", 'Base of natural logarithm']
};

let activeRefPopup = null;

function closeReferencePopup() {
  if (activeRefPopup) {
    activeRefPopup.remove();
    activeRefPopup = null;
  }
}

function showReferencePopup(kind, textarea, func, anchorBtn) {
  closeReferencePopup();

  const popup = document.createElement('div');
  popup.className = 'ref-popup';
  activeRefPopup = popup;

  const title = document.createElement('div');
  title.className = 'ref-popup-title';
  title.textContent = kind === 'functions' ? 'Functions' : 'Constants';
  popup.appendChild(title);

  const list = document.createElement('div');
  list.className = 'ref-popup-list';

  if (kind === 'functions') {
    for (const name of [...FUNCTION_NAMES].sort()) {
      const meta = FUNCTION_METADATA[name];
      const row = document.createElement('div');
      row.className = 'ref-popup-item';
      row.innerHTML = `<span class="ref-popup-name">${escapeHtml(name)}</span><span class="ref-popup-desc">${escapeHtml(meta[0])}</span>`;
      row.title = `${meta[0]}. Domain: ${meta[1]}`;
      row.addEventListener('click', () => {
        insertAtCaret(textarea, `${name}()`, name.length + 1);
        func.expression = textarea.value;
        parseFunction(func);
        renderFunctionList();
        analyzeActiveFunction();
        draw();
      });
      list.appendChild(row);
    }
  } else {
    for (const name of [...CONSTANT_NAMES].sort()) {
      const meta = CONSTANT_METADATA[name];
      const row = document.createElement('div');
      row.className = 'ref-popup-item';
      row.innerHTML = `<span class="ref-popup-name">${escapeHtml(meta[0])}</span><span class="ref-popup-desc">${escapeHtml(meta[1])}</span>`;
      row.title = meta[2];
      row.addEventListener('click', () => {
        insertAtCaret(textarea, name, name.length);
        func.expression = textarea.value;
        parseFunction(func);
        renderFunctionList();
        analyzeActiveFunction();
        draw();
      });
      list.appendChild(row);
    }
  }

  popup.appendChild(list);

  // Position the popup near the button
  const wrapRect = anchorBtn.closest('.expr-wrap').getBoundingClientRect();
  const sidebarRect = anchorBtn.closest('.sidebar').getBoundingClientRect();
  popup.style.position = 'absolute';
  popup.style.left = `${wrapRect.left - sidebarRect.left}px`;
  popup.style.top = `${wrapRect.bottom - sidebarRect.top + 2}px`;

  anchorBtn.closest('.sidebar').appendChild(popup);

  // Close on click outside
  const onClickOutside = (e) => {
    if (!popup.contains(e.target) && e.target !== anchorBtn) {
      closeReferencePopup();
      document.removeEventListener('pointerdown', onClickOutside);
    }
  };
  setTimeout(() => document.addEventListener('pointerdown', onClickOutside), 0);
}

function insertAtCaret(textarea, text, caretOffset) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const newPos = start + caretOffset;
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
  textarea.focus();
}

// -- UI Rendering --

function renderFunctionList() {
  hideAutocomplete();
  closeReferencePopup();
  functionListEl.innerHTML = '';

  state.functions.forEach(func => {
    const card = document.createElement('div');
    card.className = 'function-card' + (state.selectedCurve && state.selectedCurve.funcId === func.id ? ' selected' : '');

    const head = document.createElement('div');
    head.className = 'function-head';

    const enableCheckbox = document.createElement('input');
    enableCheckbox.type = 'checkbox';
    enableCheckbox.checked = func.enabled;
    enableCheckbox.title = 'Show/hide this curve';
    enableCheckbox.addEventListener('change', () => {
      func.enabled = enableCheckbox.checked;
      analyzeActiveFunction();
      draw();
    });

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'color-input';
    colorInput.value = func.color;
    colorInput.title = 'Change curve color';
    colorInput.addEventListener('input', () => {
      func.color = colorInput.value;
      draw();
    });

    const label = document.createElement('span');
    label.textContent = 'y =';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.title = 'Remove this function';
    deleteBtn.addEventListener('click', () => deleteFunction(func.id));

    head.append(enableCheckbox, colorInput, label, deleteBtn);

    const exprWrap = document.createElement('div');
    exprWrap.className = 'expr-wrap';

    const highlight = document.createElement('pre');
    highlight.className = 'expr-highlight';
    highlight.innerHTML = syntaxHighlight(func.expression, func.errorPosition);

    const textarea = document.createElement('textarea');
    textarea.className = 'expr-input';
    textarea.placeholder = 'e.g. sin(x)';
    if (func.error)
      textarea.classList.add('invalid');
    textarea.spellcheck = false;
    textarea.value = func.expression;

    textarea.addEventListener('scroll', () => {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    });

    textarea.addEventListener('focus', () => {
      state.activeId = func.id;
      if (state.selectedCurve && state.selectedCurve.funcId !== func.id)
        state.selectedCurve = null;
      analyzeActiveFunction();
    });

    const errorText = document.createElement('div');
    errorText.className = 'error-text';
    errorText.textContent = func.error;

    // Family panel for parameter t
    const familyPanel = document.createElement('div');
    familyPanel.className = 'family-panel';
    familyPanel.hidden = !func.hasParameter;

    const familyHeader = document.createElement('div');
    familyHeader.className = 'family-header';
    const familyLabel = document.createElement('span');
    familyLabel.textContent = 'Parameter t';
    const modeSelect = document.createElement('select');
    modeSelect.className = 'mode-select';
    modeSelect.innerHTML = '<option value="range">Range</option><option value="list">List</option>';
    modeSelect.value = func.familyMode;
    familyHeader.append(familyLabel, modeSelect);

    const rangeGrid = document.createElement('div');
    rangeGrid.className = 'family-grid';
    rangeGrid.hidden = func.familyMode !== 'range';

    const minLabel = document.createElement('label');
    minLabel.textContent = 'Min:';
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.step = 'any';
    minInput.value = func.rangeMin;
    minInput.title = 'Minimum value for parameter t';

    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max:';
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.step = 'any';
    maxInput.value = func.rangeMax;
    maxInput.title = 'Maximum value for parameter t';

    const stepLabel = document.createElement('label');
    stepLabel.textContent = 'Step:';
    const stepInput = document.createElement('input');
    stepInput.type = 'number';
    stepInput.step = 'any';
    stepInput.value = func.rangeStep;
    stepInput.title = 'Step size for parameter t';

    [minInput, maxInput, stepInput].forEach((input, i) => {
      input.addEventListener('input', () => {
        if (i === 0) func.rangeMin = Number(minInput.value);
        if (i === 1) func.rangeMax = Number(maxInput.value);
        if (i === 2) func.rangeStep = Number(stepInput.value);
        draw();
      });
    });

    rangeGrid.append(minLabel, maxLabel, stepLabel, minInput, maxInput, stepInput);

    const listInput = document.createElement('input');
    listInput.className = 'family-list-input';
    listInput.hidden = func.familyMode !== 'list';
    listInput.value = func.listValues;
    listInput.placeholder = 'e.g. -2,-1,0,1,2';
    listInput.title = 'Comma-separated values for parameter t';
    listInput.addEventListener('input', () => {
      func.listValues = listInput.value;
      draw();
    });

    modeSelect.addEventListener('change', () => {
      func.familyMode = modeSelect.value;
      rangeGrid.hidden = func.familyMode !== 'range';
      listInput.hidden = func.familyMode !== 'list';
      draw();
    });

    familyPanel.append(familyHeader, rangeGrid, listInput);

    // Expression input event handlers
    textarea.addEventListener('input', () => {
      func.expression = textarea.value;
      parseFunction(func);
      highlight.innerHTML = syntaxHighlight(func.expression, func.errorPosition);
      textarea.classList.toggle('invalid', !!func.error);
      errorText.textContent = func.error;
      familyPanel.hidden = !func.hasParameter;
      updateAutocomplete(func, textarea);
      analyzeActiveFunction();
      draw();
    });

    textarea.addEventListener('keydown', (e) => {
      if (!autocompleteEl.hidden && state.autocomplete.textarea === textarea) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          state.autocomplete.selectedIndex = (state.autocomplete.selectedIndex + 1) % state.autocomplete.items.length;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          state.autocomplete.selectedIndex = (state.autocomplete.selectedIndex + state.autocomplete.items.length - 1) % state.autocomplete.items.length;
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          applyAutocomplete();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          hideAutocomplete();
          return;
        }
        autocompleteEl.querySelectorAll('.ac-item').forEach((node, i) => {
          node.classList.toggle('active', i === state.autocomplete.selectedIndex);
        });
      }
    });

    textarea.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape')
        return;
      updateAutocomplete(func, textarea);
    });
    textarea.addEventListener('click', () => updateAutocomplete(func, textarea));

    // Tooltip on hover: textarea sits on top of highlight, so we temporarily
    // remove pointer-events from the textarea to find the token underneath.
    textarea.addEventListener('mousemove', (e) => {
      textarea.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      textarea.style.pointerEvents = '';

      if (!(el instanceof HTMLElement)) {
        fnTooltip.hidden = true;
        return;
      }

      let tooltipText = null;
      if (el.classList.contains('fn-token')) {
        const meta = FUNCTION_METADATA[el.dataset.fn];
        if (meta)
          tooltipText = `${el.dataset.fn}: ${meta[0]}. Domain: ${meta[1]}.`;
      } else if (el.classList.contains('const-token')) {
        const meta = CONSTANT_METADATA[el.dataset.const];
        if (meta)
          tooltipText = `${meta[0]}: ${meta[1]}. ${meta[2]}.`;
      }

      if (!tooltipText) {
        fnTooltip.hidden = true;
        return;
      }

      fnTooltip.textContent = tooltipText;
      const hostRect = canvasHost.getBoundingClientRect();
      fnTooltip.style.left = `${e.clientX - hostRect.left + 12}px`;
      fnTooltip.style.top = `${e.clientY - hostRect.top + 12}px`;
      fnTooltip.hidden = false;
    });

    textarea.addEventListener('mouseleave', () => { fnTooltip.hidden = true; });

    // Reference insert buttons (functions & constants)
    const refBtnContainer = document.createElement('div');
    refBtnContainer.className = 'expr-ref-buttons';

    const fnRefBtn = document.createElement('button');
    fnRefBtn.className = 'expr-ref-btn';
    fnRefBtn.textContent = 'f\u2093';
    fnRefBtn.title = 'Insert function';
    fnRefBtn.tabIndex = -1;
    fnRefBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showReferencePopup('functions', textarea, func, fnRefBtn);
    });

    const constRefBtn = document.createElement('button');
    constRefBtn.className = 'expr-ref-btn';
    constRefBtn.textContent = '\u03C0';
    constRefBtn.title = 'Insert constant';
    constRefBtn.tabIndex = -1;
    constRefBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showReferencePopup('constants', textarea, func, constRefBtn);
    });

    refBtnContainer.append(fnRefBtn, constRefBtn);

    exprWrap.append(highlight, textarea, refBtnContainer);
    card.append(head, exprWrap, errorText, familyPanel);
    functionListEl.appendChild(card);
  });

  updateStatusBar();
}

function renderLegend() {
  if (!legendBody)
    return;
  legendBody.innerHTML = state.functions.map(func => {
    const paramValues = getParameterValues(func);
    const swatch = generateColorVariation(func.color, 0, Math.max(1, paramValues.length));
    const tag = func.hasParameter ? ` [t:${paramValues.length}]` : '';
    return `<div class="legend-entry${func.enabled ? '' : ' disabled'}"><span class="legend-swatch" style="background:${swatch}"></span><span>${escapeHtml(func.expression || '...')}${tag}</span></div>`;
  }).join('');
}

// -- Canvas Drawing --

function drawGridAndAxes() {
  const width = state.canvasWidth;
  const height = state.canvasHeight;
  const viewport = state.viewport;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--fp-canvas') || '#fff';
  ctx.fillRect(0, 0, width, height);

  if (viewport.showGrid) {
    const majorStep = niceGridStep(viewport.scale);
    const minorStep = majorStep / 5;
    const leftX = screenToMathX(0);
    const rightX = screenToMathX(width);
    const bottomY = screenToMathY(height);
    const topY = screenToMathY(0);

    const minorColor = getComputedStyle(document.body).getPropertyValue('--fp-grid-minor').trim() || 'rgba(0,0,0,.1)';
    const majorColor = getComputedStyle(document.body).getPropertyValue('--fp-grid-major').trim() || 'rgba(0,0,0,.2)';

    const drawVerticalLines = (step, style, lineWidth, limit) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let count = 0;
      let startX = Math.floor(leftX / step) * step;
      for (let x = startX; x <= rightX; x += step) {
        if (++count > limit) break;
        const px = mathToScreenX(x);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
      }
      ctx.stroke();
    };

    const drawHorizontalLines = (step, style, lineWidth, limit) => {
      ctx.strokeStyle = style;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let count = 0;
      let startY = Math.floor(bottomY / step) * step;
      for (let y = startY; y <= topY; y += step) {
        if (++count > limit) break;
        const py = mathToScreenY(y);
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
      }
      ctx.stroke();
    };

    drawVerticalLines(minorStep, minorColor, 1, 500);
    drawHorizontalLines(minorStep, minorColor, 1, 500);
    drawVerticalLines(majorStep, majorColor, 1, 300);
    drawHorizontalLines(majorStep, majorColor, 1, 300);

    if (viewport.showLabels) {
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--fp-text').trim() || '#111';
      ctx.font = '11px Tahoma';
      ctx.textBaseline = 'top';

      const axisY = clamp(mathToScreenY(0) + 2, 0, height - 14);
      const axisX = clamp(mathToScreenX(0) + 3, 0, width - 40);

      let xCount = 0;
      let xStart = Math.floor(leftX / majorStep) * majorStep;
      for (let x = xStart; x <= rightX; x += majorStep) {
        if (++xCount > 200) break;
        ctx.fillText(formatNumber(x), mathToScreenX(x) + 2, axisY);
      }

      let yCount = 0;
      let yStart = Math.floor(bottomY / majorStep) * majorStep;
      for (let y = yStart; y <= topY; y += majorStep) {
        if (++yCount > 200) break;
        ctx.fillText(formatNumber(y), axisX, mathToScreenY(y) + 2);
      }
    }
  }

  // Draw axes
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--fp-axis').trim() || '#222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, mathToScreenY(0));
  ctx.lineTo(width, mathToScreenY(0));
  ctx.moveTo(mathToScreenX(0), 0);
  ctx.lineTo(mathToScreenX(0), height);
  ctx.stroke();
}

function drawSingleCurve(func, t, colorIndex, totalColors, lineWidth) {
  const width = state.canvasWidth;
  const height = state.canvasHeight;

  ctx.strokeStyle = generateColorVariation(func.color, colorIndex, totalColors);
  ctx.lineWidth = lineWidth;
  ctx.beginPath();

  let isDrawing = false;
  let previousScreenY = 0;
  let previousMathY = NaN;

  for (let px = 0; px <= width; ++px) {
    const x = screenToMathX(px);
    const y = evaluateFunction(func, x, t);
    const screenY = mathToScreenY(y);
    const isValid = Number.isFinite(y) && Number.isFinite(screenY) && Math.abs(screenY) <= height * 6 && Math.abs(y) <= 1e9;

    if (!isValid) {
      isDrawing = false;
      previousMathY = NaN;
      continue;
    }

    const jump = Math.abs(screenY - previousScreenY);
    const isSteep = Number.isFinite(previousMathY) && Math.abs(y - previousMathY) > Math.max(15 / state.viewport.scale, Math.abs(previousMathY) * 0.45 + 2 / state.viewport.scale);

    if (!isDrawing || jump > Math.max(90, height * 0.45) || isSteep)
      ctx.moveTo(px, screenY);
    else
      ctx.lineTo(px, screenY);

    isDrawing = true;
    previousScreenY = screenY;
    previousMathY = y;
  }

  ctx.stroke();
}

function isSelectedCurve(func, t) {
  return state.selectedCurve
    && state.selectedCurve.funcId === func.id
    && state.selectedCurve.t === t;
}

function drawCurveLabel(func, t, colorIndex, totalColors) {
  if (!func.hasParameter)
    return;

  const width = state.canvasWidth;
  const height = state.canvasHeight;
  const color = generateColorVariation(func.color, colorIndex, totalColors);
  const labelText = `t=${formatNumber(t)}`;
  const isSelected = isSelectedCurve(func, t);

  ctx.save();
  ctx.font = isSelected ? 'bold 11px Tahoma, sans-serif' : '10px Tahoma, sans-serif';
  const textWidth = ctx.measureText(labelText).width;

  // Find a visible point on the curve to place the label
  // Try several candidate x-positions spread across the canvas, offset by color index to avoid overlap
  const candidateCount = 7;
  const margin = 60;
  const offset = (colorIndex * 37 + colorIndex * colorIndex * 13) % candidateCount;

  for (let attempt = 0; attempt < candidateCount; ++attempt) {
    const slot = (offset + attempt) % candidateCount;
    const px = margin + (width - 2 * margin) * slot / (candidateCount - 1);
    const x = screenToMathX(px);
    const y = evaluateFunction(func, x, t);
    const screenY = mathToScreenY(y);

    if (!Number.isFinite(y) || screenY < 14 || screenY > height - 8)
      continue;

    // Position label above or below the curve
    const labelY = screenY - 8;
    const labelX = px - textWidth / 2;

    // Draw background pill for readability
    const padding = 2;
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--fp-canvas').trim() || '#fff';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(labelX - padding, labelY - 10, textWidth + padding * 2, 13);
    ctx.globalAlpha = 1;

    // Draw text
    ctx.fillStyle = color;
    ctx.textBaseline = 'bottom';
    ctx.fillText(labelText, labelX, labelY + 3);
    break;
  }

  ctx.restore();
}

function drawCurves() {
  const curveMap = [];
  let selectedEntry = null;

  // First pass: draw all non-selected curves
  state.functions.forEach(func => {
    if (!func.enabled || !func.compiled)
      return;

    const paramValues = getParameterValues(func);
    paramValues.forEach((t, i) => {
      if (isSelectedCurve(func, t)) {
        selectedEntry = { func, t, colorIndex: i, totalColors: paramValues.length };
      } else {
        drawSingleCurve(func, t, i, paramValues.length, 2);
      }
      curveMap.push({ func, t });
    });
  });

  // Draw t-value labels for all family curves (non-selected ones first)
  state.functions.forEach(func => {
    if (!func.enabled || !func.compiled || !func.hasParameter)
      return;
    const paramValues = getParameterValues(func);
    paramValues.forEach((t, i) => {
      if (!isSelectedCurve(func, t))
        drawCurveLabel(func, t, i, paramValues.length);
    });
  });

  // Second pass: draw selected curve on top with thicker line
  if (selectedEntry) {
    drawSingleCurve(selectedEntry.func, selectedEntry.t, selectedEntry.colorIndex, selectedEntry.totalColors, 4);
    drawCurveLabel(selectedEntry.func, selectedEntry.t, selectedEntry.colorIndex, selectedEntry.totalColors);
  }

  return curveMap;
}

function drawMarkers() {
  const data = state.analysisData;
  state.markerPoints = [];

  if (!data)
    return;

  const points = [];
  (data.roots || []).forEach(x => points.push({ kind: 'root', x, y: 0 }));
  if (Number.isFinite(data.y0))
    points.push({ kind: 'y', x: 0, y: data.y0 });
  (data.ext || []).forEach(p => points.push({ kind: p.type, x: p.x, y: p.y }));
  (data.inf || []).forEach(p => points.push({ kind: 'inf', x: p.x, y: p.y }));
  (data.sad || []).forEach(p => points.push({ kind: 'sad', x: p.x, y: p.y }));

  points.forEach(point => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
      return;
    const screenX = mathToScreenX(point.x);
    const screenY = mathToScreenY(point.y);
    if (screenX < -20 || screenX > state.canvasWidth + 20 || screenY < -20 || screenY > state.canvasHeight + 20)
      return;

    ctx.save();
    ctx.fillStyle =
      point.kind === 'max' ? '#d53f2a' :
      point.kind === 'min' ? '#2d7f2e' :
      point.kind === 'inf' ? '#ea9b17' :
      point.kind === 'sad' ? '#9d46d6' : '#111';
    ctx.beginPath();
    ctx.arc(screenX, screenY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const label =
      point.kind === 'root' ? 'Root' :
      point.kind === 'y' ? 'Y-Intercept' :
      point.kind === 'max' ? 'Local Max' :
      point.kind === 'min' ? 'Local Min' :
      point.kind === 'inf' ? 'Inflection' :
      point.kind === 'sad' ? 'Saddle' : point.kind;

    state.markerPoints.push({
      x: screenX, y: screenY, label,
      text: `${label}: (${formatNumber(point.x)}, ${formatNumber(point.y)})`
    });
  });

  if (Array.isArray(data.poles)) {
    ctx.save();
    ctx.strokeStyle = '#b22020';
    ctx.setLineDash([5, 4]);
    data.poles.forEach(x => {
      if (!Number.isFinite(x))
        return;
      const px = mathToScreenX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, state.canvasHeight);
      ctx.stroke();
      state.markerPoints.push({
        x: px, y: state.pointer.y || 0, label: 'Pole',
        text: `Pole near x=${formatNumber(x)}`, line: true
      });
    });
    ctx.restore();
  }
}

// -- Trace & Status Bar --

function updateTrace(curveMap) {
  if (!state.pointer.isInside) {
    traceTooltip.hidden = true;
    return;
  }

  let nearestMarker = null;
  let nearestDistance = 1e9;

  state.markerPoints.forEach(marker => {
    if (marker.line) {
      const distance = Math.abs(state.pointer.x - marker.x);
      if (distance < 7 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestMarker = marker;
      }
    } else {
      const distance = Math.hypot(state.pointer.x - marker.x, state.pointer.y - marker.y);
      if (distance < 9 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestMarker = marker;
      }
    }
  });

  if (nearestMarker) {
    traceTooltip.textContent = nearestMarker.text;
    traceTooltip.style.left = `${state.pointer.x + 12}px`;
    traceTooltip.style.top = `${state.pointer.y + 12}px`;
    traceTooltip.hidden = false;
    return;
  }

  const mathX = screenToMathX(state.pointer.x);
  let bestCurve = null;

  curveMap.forEach(curve => {
    const y = evaluateFunction(curve.func, mathX, curve.t);
    if (!Number.isFinite(y))
      return;
    const distance = Math.abs(mathToScreenY(y) - state.pointer.y);
    if (distance > 20)
      return;
    if (!bestCurve || distance < bestCurve.distance)
      bestCurve = { ...curve, x: mathX, y, distance };
  });

  if (!bestCurve) {
    traceTooltip.hidden = true;
    return;
  }

  traceTooltip.textContent = `x=${formatNumber(bestCurve.x)}, y=${formatNumber(bestCurve.y)}${bestCurve.func.hasParameter ? `, t=${formatNumber(bestCurve.t)}` : ''}`;
  traceTooltip.style.left = `${state.pointer.x + 12}px`;
  traceTooltip.style.top = `${state.pointer.y + 12}px`;
  traceTooltip.hidden = false;
}

function updateStatusBar() {
  const mathX = screenToMathX(state.pointer.x);
  const mathY = screenToMathY(state.pointer.y);
  statusCoords.textContent = state.pointer.isInside
    ? `x=${formatNumber(mathX)}  y=${formatNumber(mathY)}`
    : 'x=\u2014 y=\u2014';
  statusZoom.textContent = `Zoom: ${Math.round(state.viewport.scale / DEFAULT_VIEWPORT_SCALE * 100)}%`;
  const activeCount = state.functions.filter(f => f.enabled).length;
  statusFunctions.textContent = `${activeCount} function${activeCount !== 1 ? 's' : ''}`;
}

// -- Curve Selection --

function selectCurveAtPoint(screenX, screenY) {
  const mathX = screenToMathX(screenX);
  let best = null;

  state.functions.forEach(func => {
    if (!func.enabled || !func.compiled)
      return;
    const paramValues = getParameterValues(func);
    paramValues.forEach(t => {
      const y = evaluateFunction(func, mathX, t);
      if (!Number.isFinite(y))
        return;
      const distance = Math.abs(mathToScreenY(y) - screenY);
      if (distance > 20)
        return;
      if (!best || distance < best.distance)
        best = { funcId: func.id, t, distance };
    });
  });

  if (best) {
    state.selectedCurve = { funcId: best.funcId, t: best.t };
    state.activeId = best.funcId;
  } else {
    state.selectedCurve = null;
  }

  renderFunctionList();
  analyzeActiveFunction();
  draw();
}

// -- Main Draw --

function draw() {
  drawGridAndAxes();
  const curveMap = drawCurves();
  drawMarkers();
  updateTrace(curveMap);
  renderLegend();
  updateStatusBar();
}

// -- Analysis --

function getAnalysisTarget() {
  // If a specific curve was selected (clicked on canvas), use that function
  if (state.selectedCurve) {
    const selected = findFunctionById(state.selectedCurve.funcId);
    if (selected && selected.enabled && selected.compiled)
      return selected;
  }

  const active = findFunctionById(state.activeId);
  if (active && active.enabled && active.compiled)
    return active;
  return state.functions.find(f => f.enabled && f.compiled) || null;
}

function renderAnalysisPanel(data, error) {
  if (error) {
    analysisStatusEl.textContent = `Analysis failed: ${error}`;
    analysisBodyEl.innerHTML = '';
    return;
  }

  if (!data) {
    analysisStatusEl.textContent = 'Click a function to analyze';
    analysisBodyEl.innerHTML = '';
    return;
  }

  const row = (title, content) => `<div class="analysis-group"><b>${title}</b>${content}</div>`;

  const rootsStr = (data.roots || []).map(x => `x=${formatNumber(x)}`).join(', ') || 'none';
  const yInterceptStr = data.y0 === null ? 'undefined' : `f(0)=${formatNumber(data.y0)}`;
  const extremaStr = (data.ext || []).map(p => `${p.type} (${formatNumber(p.x)}, ${formatNumber(p.y)})`).join('<br>') || 'none';
  const inflectionStr = (data.inf || []).map(p => `(${formatNumber(p.x)}, ${formatNumber(p.y)})`).join('<br>') || 'none';
  const saddleStr = (data.sad || []).map(p => `(${formatNumber(p.x)}, ${formatNumber(p.y)})`).join('<br>') || 'none';
  const monotonicityStr = (data.mono || []).map(m => `${m.kind}: [${formatNumber(m.from)}, ${formatNumber(m.to)}]`).join('<br>') || 'none';
  const polesStr = (data.poles || []).map(x => `x=${formatNumber(x)}`).join(', ') || 'none';
  const limitPosStr = Number.isFinite(data.lim?.p) ? formatNumber(data.lim.p) : 'undefined';
  const limitNegStr = Number.isFinite(data.lim?.n) ? formatNumber(data.lim.n) : 'undefined';

  let symbolicStr = 'not available for this expression';
  const analysisFunc = findFunctionById(state.analysisFunctionId);
  if (analysisFunc && analysisFunc.expression) {
    const symbolic = trySymbolicPolynomial(analysisFunc.expression);
    if (symbolic) {
      const exactRoots = symbolic.roots.length
        ? symbolic.roots.map(v => formatNumber(v)).join(', ')
        : 'none (or degree > 2 exact form)';
      symbolicStr = `f(x) = ${polynomialToString(symbolic.poly)}<br>f'(x) = ${polynomialToString(symbolic.der)}<br>Exact roots: ${exactRoots}`;
    }
  }

  const analysisFunc2 = findFunctionById(state.analysisFunctionId);
  const tInfo = analysisFunc2 && analysisFunc2.hasParameter && state.selectedCurve && state.selectedCurve.funcId === analysisFunc2.id
    ? ` (t=${formatNumber(state.selectedCurve.t)})`
    : '';
  analysisStatusEl.textContent = `Analysis ready${tInfo}`;
  analysisBodyEl.innerHTML = [
    row('Symbolic (when possible)', symbolicStr),
    row('Roots', rootsStr),
    row('Y-Intercept', yInterceptStr),
    row('Extrema', extremaStr),
    row('Inflection Points', inflectionStr),
    row('Saddle Points', saddleStr),
    row('Monotony', monotonicityStr),
    row('Discontinuities / Poles', polesStr),
    row('Limits', `x->+inf: ${limitPosStr}<br>x->-inf: ${limitNegStr}`)
  ].join('');
}

function analyzeActiveFunction() {
  if (!state.worker)
    return;

  const target = getAnalysisTarget();
  if (!target) {
    state.analysisData = null;
    state.analysisFunctionId = null;
    renderAnalysisPanel(null, null);
    draw();
    return;
  }

  state.analysisFunctionId = target.id;

  if (!target.compiled) {
    state.analysisData = null;
    analysisStatusEl.textContent = 'Function has parse errors.';
    analysisBodyEl.innerHTML = '';
    draw();
    return;
  }

  // Determine the t value to analyze — use selectedCurve if it matches, otherwise default to 0
  const paramT = (state.selectedCurve && state.selectedCurve.funcId === target.id)
    ? state.selectedCurve.t
    : 0;

  const sequenceId = ++state.sequenceId;
  state.pendingId = sequenceId;
  const tLabel = target.hasParameter ? ` (t=${formatNumber(paramT)})` : '';
  analysisStatusEl.textContent = `Analyzing${tLabel}...`;
  state.worker.postMessage({
    id: sequenceId,
    j: target.compiled.jsCode,
    x0: screenToMathX(0) - 2,
    x1: screenToMathX(state.canvasWidth) + 2,
    paramT
  });
}

// -- View Controls --

function resetView() {
  state.viewport.originX = state.canvasWidth / 2;
  state.viewport.originY = state.canvasHeight / 2;
  state.viewport.scale = DEFAULT_VIEWPORT_SCALE;
  draw();
  analyzeActiveFunction();
}

function zoomBy(factor) {
  const centerX = state.canvasWidth / 2;
  const centerY = state.canvasHeight / 2;
  const mathX = screenToMathX(centerX);
  const mathY = screenToMathY(centerY);
  state.viewport.scale = clamp(state.viewport.scale * factor, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
  state.viewport.originX = centerX - mathX * state.viewport.scale;
  state.viewport.originY = centerY + mathY * state.viewport.scale;
  draw();
  analyzeActiveFunction();
}

// -- PNG Export --

function exportPng() {
  const factor = EXPORT_SCALE_FACTOR;
  const outputWidth = state.canvasWidth * factor;
  const outputHeight = state.canvasHeight * factor;
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outCtx = outputCanvas.getContext('2d');

  const outScreenX = (x) => state.viewport.originX * factor + x * state.viewport.scale * factor;
  const outScreenY = (y) => state.viewport.originY * factor - y * state.viewport.scale * factor;
  const outMathX = (px) => (px - state.viewport.originX * factor) / (state.viewport.scale * factor);
  const outMathY = (py) => (state.viewport.originY * factor - py) / (state.viewport.scale * factor);

  outCtx.fillStyle = getComputedStyle(document.body).getPropertyValue('--fp-canvas') || '#fff';
  outCtx.fillRect(0, 0, outputWidth, outputHeight);

  if (state.viewport.showGrid) {
    const majorStep = niceGridStep(state.viewport.scale);
    const minorStep = majorStep / 5;
    const leftX = outMathX(0), rightX = outMathX(outputWidth);
    const bottomY = outMathY(outputHeight), topY = outMathY(0);
    const minorColor = getComputedStyle(document.body).getPropertyValue('--fp-grid-minor').trim() || 'rgba(0,0,0,.1)';
    const majorColor = getComputedStyle(document.body).getPropertyValue('--fp-grid-major').trim() || 'rgba(0,0,0,.2)';

    const drawV = (step, style, lineWidth) => {
      outCtx.strokeStyle = style;
      outCtx.lineWidth = lineWidth;
      outCtx.beginPath();
      for (let x = Math.floor(leftX / step) * step; x <= rightX; x += step) {
        const px = outScreenX(x);
        outCtx.moveTo(px, 0);
        outCtx.lineTo(px, outputHeight);
      }
      outCtx.stroke();
    };

    const drawH = (step, style, lineWidth) => {
      outCtx.strokeStyle = style;
      outCtx.lineWidth = lineWidth;
      outCtx.beginPath();
      for (let y = Math.floor(bottomY / step) * step; y <= topY; y += step) {
        const py = outScreenY(y);
        outCtx.moveTo(0, py);
        outCtx.lineTo(outputWidth, py);
      }
      outCtx.stroke();
    };

    drawV(minorStep, minorColor, 1);
    drawH(minorStep, minorColor, 1);
    drawV(majorStep, majorColor, 1.5);
    drawH(majorStep, majorColor, 1.5);

    if (state.viewport.showLabels) {
      outCtx.fillStyle = getComputedStyle(document.body).getPropertyValue('--fp-text').trim() || '#111';
      outCtx.font = `${11 * factor}px Tahoma`;
      outCtx.textBaseline = 'top';
      const axisY = clamp(outScreenY(0) + 4, 0, outputHeight - 20);
      const axisX = clamp(outScreenX(0) + 5, 0, outputWidth - 80);

      for (let x = Math.floor(leftX / majorStep) * majorStep; x <= rightX; x += majorStep)
        outCtx.fillText(formatNumber(x), outScreenX(x) + 4, axisY);

      for (let y = Math.floor(bottomY / majorStep) * majorStep; y <= topY; y += majorStep)
        outCtx.fillText(formatNumber(y), axisX, outScreenY(y) + 4);
    }
  }

  // Axes
  outCtx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--fp-axis').trim() || '#222';
  outCtx.lineWidth = 2;
  outCtx.beginPath();
  outCtx.moveTo(0, outScreenY(0));
  outCtx.lineTo(outputWidth, outScreenY(0));
  outCtx.moveTo(outScreenX(0), 0);
  outCtx.lineTo(outScreenX(0), outputHeight);
  outCtx.stroke();

  // Curves (non-selected first, selected on top)
  let selectedExport = null;
  state.functions.forEach(func => {
    if (!func.enabled || !func.compiled)
      return;
    const paramValues = getParameterValues(func);
    paramValues.forEach((t, i) => {
      if (isSelectedCurve(func, t)) {
        selectedExport = { func, t, colorIndex: i, totalColors: paramValues.length };
        return;
      }
      outCtx.strokeStyle = generateColorVariation(func.color, i, paramValues.length);
      outCtx.lineWidth = 2.5;
      outCtx.beginPath();
      let isDrawing = false, prevScreenY = 0, prevMathY = NaN;

      for (let px = 0; px <= outputWidth; ++px) {
        const x = outMathX(px);
        const y = evaluateFunction(func, x, t);
        const screenY = outScreenY(y);
        const isValid = Number.isFinite(y) && Number.isFinite(screenY) && Math.abs(screenY) <= outputHeight * 6 && Math.abs(y) <= 1e9;

        if (!isValid) { isDrawing = false; prevMathY = NaN; continue; }

        const jump = Math.abs(screenY - prevScreenY);
        const isSteep = Number.isFinite(prevMathY) && Math.abs(y - prevMathY) > Math.max(15 / (state.viewport.scale * factor), Math.abs(prevMathY) * 0.45 + 2 / (state.viewport.scale * factor));

        if (!isDrawing || jump > Math.max(180, outputHeight * 0.45) || isSteep)
          outCtx.moveTo(px, screenY);
        else
          outCtx.lineTo(px, screenY);

        isDrawing = true;
        prevScreenY = screenY;
        prevMathY = y;
      }
      outCtx.stroke();
    });
  });

  // Draw selected curve on top with thicker line
  if (selectedExport) {
    const { func, t, colorIndex, totalColors } = selectedExport;
    outCtx.strokeStyle = generateColorVariation(func.color, colorIndex, totalColors);
    outCtx.lineWidth = 4;
    outCtx.beginPath();
    let isDrawing = false, prevScreenY = 0, prevMathY = NaN;

    for (let px = 0; px <= outputWidth; ++px) {
      const x = outMathX(px);
      const y = evaluateFunction(func, x, t);
      const screenY = outScreenY(y);
      const isValid = Number.isFinite(y) && Number.isFinite(screenY) && Math.abs(screenY) <= outputHeight * 6 && Math.abs(y) <= 1e9;

      if (!isValid) { isDrawing = false; prevMathY = NaN; continue; }

      const jump = Math.abs(screenY - prevScreenY);
      const isSteep = Number.isFinite(prevMathY) && Math.abs(y - prevMathY) > Math.max(15 / (state.viewport.scale * factor), Math.abs(prevMathY) * 0.45 + 2 / (state.viewport.scale * factor));

      if (!isDrawing || jump > Math.max(180, outputHeight * 0.45) || isSteep)
        outCtx.moveTo(px, screenY);
      else
        outCtx.lineTo(px, screenY);

      isDrawing = true;
      prevScreenY = screenY;
      prevMathY = y;
    }
    outCtx.stroke();
  }

  // Markers
  const data = state.analysisData;
  if (data) {
    const markerPoints = [];
    (data.roots || []).forEach(x => markerPoints.push({ kind: 'root', x, y: 0 }));
    if (Number.isFinite(data.y0))
      markerPoints.push({ kind: 'y', x: 0, y: data.y0 });
    (data.ext || []).forEach(p => markerPoints.push({ kind: p.type, x: p.x, y: p.y }));
    (data.inf || []).forEach(p => markerPoints.push({ kind: 'inf', x: p.x, y: p.y }));
    (data.sad || []).forEach(p => markerPoints.push({ kind: 'sad', x: p.x, y: p.y }));

    markerPoints.forEach(point => {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        return;
      const sx = outScreenX(point.x), sy = outScreenY(point.y);
      if (sx < -20 || sx > outputWidth + 20 || sy < -20 || sy > outputHeight + 20)
        return;
      outCtx.fillStyle =
        point.kind === 'max' ? '#d53f2a' :
        point.kind === 'min' ? '#2d7f2e' :
        point.kind === 'inf' ? '#ea9b17' :
        point.kind === 'sad' ? '#9d46d6' : '#111';
      outCtx.beginPath();
      outCtx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      outCtx.fill();
    });

    if (Array.isArray(data.poles)) {
      outCtx.save();
      outCtx.strokeStyle = '#b22020';
      outCtx.setLineDash([8, 6]);
      data.poles.forEach(x => {
        if (!Number.isFinite(x))
          return;
        const px = outScreenX(x);
        outCtx.beginPath();
        outCtx.moveTo(px, 0);
        outCtx.lineTo(px, outputHeight);
        outCtx.stroke();
      });
      outCtx.restore();
    }
  }

  const link = document.createElement('a');
  link.download = 'function-plotter.png';
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
}

// -- Event Binding --

function bindEvents() {
  btnAddFunction.addEventListener('click', () => addFunction(''));

  // Canvas: zoom with wheel
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const mathX = screenToMathX(px);
    const mathY = screenToMathY(py);
    const factor = Math.exp(-e.deltaY * 0.0015);

    state.viewport.scale = clamp(state.viewport.scale * factor, ZOOM_LIMITS.min, ZOOM_LIMITS.max);
    state.viewport.originX = px - mathX * state.viewport.scale;
    state.viewport.originY = py + mathY * state.viewport.scale;

    draw();
    analyzeActiveFunction();
  }, { passive: false });

  // Canvas: drag to pan, click to select curve
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0)
      return;
    state.pointer.isDragging = true;
    state.pointer.hasMoved = false;
    state.pointer.pointerId = e.pointerId;
    state.pointer.startX = e.offsetX;
    state.pointer.startY = e.offsetY;
    state.pointer.x = e.offsetX;
    state.pointer.y = e.offsetY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    const x = e.offsetX;
    const y = e.offsetY;
    state.pointer.isInside = true;

    if (state.pointer.isDragging && e.pointerId === state.pointer.pointerId) {
      const dx = x - state.pointer.startX;
      const dy = y - state.pointer.startY;
      if (!state.pointer.hasMoved && Math.hypot(dx, dy) > 4)
        state.pointer.hasMoved = true;

      state.viewport.originX += x - state.pointer.x;
      state.viewport.originY += y - state.pointer.y;
      state.pointer.x = x;
      state.pointer.y = y;
      draw();
      return;
    }

    state.pointer.x = x;
    state.pointer.y = y;
    draw();
  });

  const stopDrag = (e) => {
    if (state.pointer.isDragging && e.pointerId === state.pointer.pointerId) {
      const wasClick = !state.pointer.hasMoved;
      state.pointer.isDragging = false;
      state.pointer.pointerId = null;

      if (wasClick)
        selectCurveAtPoint(e.offsetX, e.offsetY);
      else
        analyzeActiveFunction();
    }
  };

  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('pointerleave', () => {
    state.pointer.isInside = false;
    draw();
  });

  window.addEventListener('resize', resizeCanvas);

  // Keyboard shortcuts for expression inputs
  document.addEventListener('keydown', (e) => {
    const target = e.target;

    // Expression-specific shortcuts
    if (target instanceof HTMLTextAreaElement && target.classList.contains('expr-input')) {
      if (!autocompleteEl.hidden && state.autocomplete.textarea === target)
        return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        draw();
        analyzeActiveFunction();
        return;
      }
    }

    // Global keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        handleMenuAction('new');
      } else if (e.key === 'N' || (e.key === 'n' && e.shiftKey)) {
        e.preventDefault();
        handleMenuAction('add');
      } else if (e.key === 'e') {
        e.preventDefault();
        handleMenuAction('export');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleMenuAction('plot');
      } else if (e.key === '0') {
        e.preventDefault();
        handleMenuAction('reset-view');
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleMenuAction('zoom-in');
      } else if (e.key === '-') {
        e.preventDefault();
        handleMenuAction('zoom-out');
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    const target = e.target;
    if (target instanceof HTMLTextAreaElement && target.classList.contains('expr-input'))
      showFunctionInfoFromCaret(target);
  });

  document.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLElement) || !autocompleteEl.contains(e.target))
      hideAutocomplete();

    const target = e.target;
    if (target instanceof HTMLTextAreaElement && target.classList.contains('expr-input'))
      showFunctionInfoFromCaret(target);
    else if (autocompleteEl.hidden)
      fnTooltip.hidden = true;
  });
}

// -- Initialization --

state.worker = createAnalysisWorker();
state.worker.addEventListener('message', (e) => {
  const data = e.data || {};
  if (data.id !== state.pendingId)
    return;
  if (data.err) {
    state.analysisData = null;
    renderAnalysisPanel(null, data.err);
    draw();
    return;
  }
  state.analysisData = data;
  renderAnalysisPanel(data, null);
  draw();
});

setupMenuSystem();
bindEvents();
addFunction('sin(x)');
addFunction('x^2 - 4');
resizeCanvas();

})();
