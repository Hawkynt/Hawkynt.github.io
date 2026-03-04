;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  const STORAGE_KEY = 'sz-readme-templates';
  const LICENSES = ['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense', 'MPL-2.0', 'Custom'];
  const CODE_LANGS = ['bash', 'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c', 'cpp', 'csharp', 'ruby', 'php', 'shell', 'yaml', 'json', 'sql', 'text'];
  const BADGE_CATEGORIES = [
    { name: 'GitHub', items: [
      { id: 'license', icon: '\u{1F4DC}', label: 'License', tpl: 'https://img.shields.io/github/license/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/blob/main/LICENSE' },
      { id: 'top-language', icon: '\u{1F4AC}', label: 'Top Language', tpl: 'https://img.shields.io/github/languages/top/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}' },
      { id: 'last-commit', icon: '\u{1F552}', label: 'Last Commit', tpl: 'https://img.shields.io/github/last-commit/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/commits' },
      { id: 'commit-activity', icon: '\u{1F4C8}', label: 'Commit Activity', tpl: 'https://img.shields.io/github/commit-activity/m/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/graphs/commit-activity' },
      { id: 'open-issues', icon: '\u{1F41B}', label: 'Open Issues', tpl: 'https://img.shields.io/github/issues/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/issues' },
      { id: 'pull-requests', icon: '\u{1F500}', label: 'Pull Requests', tpl: 'https://img.shields.io/github/issues-pr/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/pulls' },
      { id: 'contributors', icon: '\u{1F465}', label: 'Contributors', tpl: 'https://img.shields.io/github/contributors/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/graphs/contributors' },
      { id: 'latest-release', icon: '\u{1F3F7}', label: 'Latest Release', tpl: 'https://img.shields.io/github/v/release/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/releases/latest' },
    ]},
    { name: 'CI / Build', items: [
      { id: 'build', icon: '\u{2699}', label: 'Build', tpl: 'https://img.shields.io/github/actions/workflow/status/{user}/{repo}/ci.yml', linkTpl: 'https://github.com/{user}/{repo}/actions' },
      { id: 'tests', icon: '\u{2705}', label: 'Tests', tpl: 'https://img.shields.io/github/actions/workflow/status/{user}/{repo}/test.yml?label=tests', linkTpl: 'https://github.com/{user}/{repo}/actions' },
    ]},
    { name: 'Quality', items: [
      { id: 'coverage', icon: '\u{1F4CA}', label: 'Codecov', tpl: 'https://img.shields.io/codecov/c/github/{user}/{repo}', linkTpl: 'https://codecov.io/gh/{user}/{repo}' },
      { id: 'codacy', icon: '\u{1F396}', label: 'Codacy', tpl: 'https://img.shields.io/codacy/grade/{user}/{repo}', linkTpl: 'https://app.codacy.com/gh/{user}/{repo}' },
      { id: 'code-climate', icon: '\u{1F321}', label: 'Code Climate', tpl: 'https://img.shields.io/codeclimate/maintainability/{user}/{repo}', linkTpl: 'https://codeclimate.com/github/{user}/{repo}' },
    ]},
    { name: 'Package Managers', items: [
      { id: 'npm', icon: '\u{1F4E6}', label: 'npm', tpl: 'https://img.shields.io/npm/v/{package}', linkTpl: 'https://www.npmjs.com/package/{package}' },
      { id: 'downloads', icon: '\u{2B07}', label: 'npm Downloads', tpl: 'https://img.shields.io/npm/dm/{package}', linkTpl: 'https://www.npmjs.com/package/{package}' },
      { id: 'pypi', icon: '\u{1F40D}', label: 'PyPI', tpl: 'https://img.shields.io/pypi/v/{package}', linkTpl: 'https://pypi.org/project/{package}' },
      { id: 'nuget', icon: '\u{1F4E5}', label: 'NuGet', tpl: 'https://img.shields.io/nuget/v/{package}', linkTpl: 'https://www.nuget.org/packages/{package}' },
      { id: 'crates-io', icon: '\u{1F980}', label: 'Crates.io', tpl: 'https://img.shields.io/crates/v/{package}', linkTpl: 'https://crates.io/crates/{package}' },
      { id: 'maven-central', icon: '\u{2615}', label: 'Maven Central', tpl: 'https://img.shields.io/maven-central/v/{package}', linkTpl: 'https://search.maven.org/artifact/{package}' },
    ]},
    { name: 'Social', items: [
      { id: 'stars', icon: '\u{2B50}', label: 'Stars', tpl: 'https://img.shields.io/github/stars/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/stargazers' },
      { id: 'forks', icon: '\u{1F500}', label: 'Forks', tpl: 'https://img.shields.io/github/forks/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/network/members' },
      { id: 'watchers', icon: '\u{1F440}', label: 'Watchers', tpl: 'https://img.shields.io/github/watchers/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}/watchers' },
      { id: 'twitter', icon: '\u{1F426}', label: 'Twitter Follow', tpl: 'https://img.shields.io/twitter/follow/{user}?style=social', linkTpl: 'https://twitter.com/{user}' },
    ]},
    { name: 'Size & Stats', items: [
      { id: 'code-size', icon: '\u{1F4C2}', label: 'Code Size', tpl: 'https://img.shields.io/github/languages/code-size/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}' },
      { id: 'repo-size', icon: '\u{1F4BE}', label: 'Repo Size', tpl: 'https://img.shields.io/github/repo-size/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}' },
      { id: 'lines-of-code', icon: '\u{1F4DD}', label: 'Lines of Code', tpl: 'https://img.shields.io/tokei/lines/github/{user}/{repo}', linkTpl: 'https://github.com/{user}/{repo}' },
    ]},
    { name: 'Support', items: [
      { id: 'github-sponsors', icon: '\u{1F496}', label: 'GitHub Sponsors', tpl: 'https://img.shields.io/github/sponsors/{user}?logo=githubsponsors', linkTpl: 'https://github.com/sponsors/{user}' },
      { id: 'buy-me-a-coffee', icon: '\u{2615}', label: 'Buy Me a Coffee', tpl: 'https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?logo=buymeacoffee&logoColor=black', linkTpl: 'https://buymeacoffee.com/{user}' },
      { id: 'kofi', icon: '\u{2764}', label: 'Ko-fi', tpl: 'https://img.shields.io/badge/Ko--fi-FF5E5B?logo=kofi&logoColor=white', linkTpl: 'https://ko-fi.com/{user}' },
      { id: 'paypal', icon: '\u{1F4B3}', label: 'PayPal', tpl: 'https://img.shields.io/badge/PayPal-003087?logo=paypal&logoColor=white', linkTpl: 'https://paypal.me/{user}' },
      { id: 'patreon', icon: '\u{1F3A8}', label: 'Patreon', tpl: 'https://img.shields.io/badge/Patreon-F96854?logo=patreon&logoColor=white', linkTpl: 'https://patreon.com/{user}' },
      { id: 'open-collective', icon: '\u{1F310}', label: 'Open Collective', tpl: 'https://img.shields.io/opencollective/all/{package}?logo=opencollective', linkTpl: 'https://opencollective.com/{package}' },
      { id: 'liberapay', icon: '\u{1F381}', label: 'Liberapay', tpl: 'https://img.shields.io/liberapay/receives/{user}?logo=liberapay', linkTpl: 'https://liberapay.com/{user}' },
      { id: 'issuehunt', icon: '\u{1F50D}', label: 'IssueHunt', tpl: 'https://img.shields.io/badge/IssueHunt-Funded-brightgreen?logo=issuehunt', linkTpl: 'https://issuehunt.io/r/{user}/{repo}' },
    ]},
  ];

  // Flat lookup for backward compatibility
  const BADGE_PRESETS = BADGE_CATEGORIES.flatMap(c => c.items);

  const SHIELDS_COLORS = [
    { name: 'brightgreen', hex: '#4c1' },
    { name: 'green', hex: '#97ca00' },
    { name: 'yellowgreen', hex: '#a4a61d' },
    { name: 'yellow', hex: '#dfb317' },
    { name: 'orange', hex: '#fe7d37' },
    { name: 'red', hex: '#e05d44' },
    { name: 'blue', hex: '#007ec6' },
    { name: 'lightgrey', hex: '#9f9f9f' },
    { name: 'blueviolet', hex: '#8a2be2' },
    { name: 'ff69b4', hex: '#ff69b4' },
    { name: 'success', hex: '#4c1' },
    { name: 'important', hex: '#fe7d37' },
    { name: 'critical', hex: '#e05d44' },
    { name: 'informational', hex: '#007ec6' },
    { name: 'inactive', hex: '#9f9f9f' },
  ];

  const SHIELDS_STYLES = ['flat', 'flat-square', 'plastic', 'for-the-badge', 'social'];

  // Curated fallback for offline / file:// use; replaced at runtime with full Simple Icons list
  const SHIELDS_LOGOS_FALLBACK = [
    'github', 'gitlab', 'bitbucket', 'npm', 'yarn', 'pnpm', 'python', 'rust', 'go', 'java',
    'typescript', 'javascript', 'csharp', 'cplusplus', 'c', 'swift', 'kotlin', 'ruby', 'php',
    'perl', 'haskell', 'elixir', 'dart', 'scala', 'lua', 'r', 'julia', 'zig', 'nim', 'clojure', 'erlang',
    'react', 'vue.js', 'angular', 'svelte', 'next.js', 'nuxt.js', 'node.js', 'deno', 'bun',
    'express', 'django', 'flask', 'spring', 'rails', 'laravel', 'dotnet', 'flutter', 'electron', 'tauri',
    'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'githubactions', 'circleci',
    'travisci', 'amazonaws', 'googlecloud', 'microsoftazure', 'digitalocean', 'heroku',
    'vercel', 'netlify', 'cloudflare',
    'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'elasticsearch', 'firebase',
    'git', 'visualstudiocode', 'neovim', 'intellijidea', 'webpack', 'vite', 'rollup',
    'eslint', 'prettier', 'jest', 'cypress', 'playwright',
    'linux', 'windows', 'macos', 'android', 'ios', 'raspberrypi', 'ubuntu', 'fedora', 'archlinux',
    'discord', 'slack', 'twitter', 'mastodon', 'reddit', 'stackoverflow', 'medium', 'devto', 'hashnode',
    'buymeacoffee', 'kofi', 'paypal', 'patreon', 'githubsponsors', 'opencollective', 'liberapay',
  ];

  let shieldsLogos = SHIELDS_LOGOS_FALLBACK;
  let shieldsLogosFetched = false;

  // Fetch full Simple Icons slug list on first use; ~3 400 icons
  function ensureFullLogoList(callback) {
    if (shieldsLogosFetched) {
      if (typeof callback === 'function')
        callback();
      return;
    }
    shieldsLogosFetched = true; // only attempt once
    fetch('https://unpkg.com/simple-icons/icons.json')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(icons => {
        if (Array.isArray(icons) && icons.length > 0) {
          shieldsLogos = icons.map(i => i.slug).sort();
          if (typeof callback === 'function')
            callback();
        }
      })
      .catch(() => {}); // keep fallback
  }

  const SHIELDS_LOGO_GRID_MAX = 200; // cap rendered tiles for performance

  function encodeShieldsText(text) {
    return text.replace(/-/g, '--').replace(/_/g, '__').replace(/\s/g, '_');
  }

  function buildShieldsUrl(opts) {
    const label = encodeShieldsText(opts.label || '');
    const message = encodeShieldsText(opts.message || '');
    const color = (opts.color || 'blue').replace(/^#/, '');
    let url = 'https://img.shields.io/badge/' + encodeURIComponent(label) + '-' + encodeURIComponent(message) + '-' + encodeURIComponent(color);
    const params = [];
    if (opts.style && opts.style !== 'flat')
      params.push('style=' + encodeURIComponent(opts.style));
    if (opts.logo)
      params.push('logo=' + encodeURIComponent(opts.logo));
    if (opts.logoColor)
      params.push('logoColor=' + encodeURIComponent(opts.logoColor));
    if (opts.labelColor)
      params.push('labelColor=' + encodeURIComponent(opts.labelColor.replace(/^#/, '')));
    if (params.length)
      url += '?' + params.join('&');
    return url;
  }

  let allTemplates = [];
  let customTemplates = [];
  let currentTemplate = null;
  let currentData = {};
  let savedData = {};
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'README.md';

  // View state
  let viewMode = 'wizard'; // 'wizard' | 'form'
  let showPreview = true;
  let showQuality = true;
  let wizardStep = 0; // 0 = template selector

  // Undo/redo
  let undoStack = [];
  let redoStack = [];
  const MAX_UNDO = 50;

  // Color picker integration (module-scoped so it persists across re-renders)
  let colorPickerRequest = null;

  function openSzColorPicker(currentHex, onResult) {
    const returnKey = 'sz:readme-gen:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
    colorPickerRequest = { returnKey, onResult };
    try {
      SZ.Dlls.User32.PostMessage('sz:launchApp', {
        appId: 'color-picker',
        urlParams: { returnKey, hex: (currentHex || '').replace(/^#/, '') }
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

    const r = Math.max(0, Math.min(255, payload.r || 0));
    const g = Math.max(0, Math.min(255, payload.g || 0));
    const b = Math.max(0, Math.min(255, payload.b || 0));
    const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');

    if (typeof colorPickerRequest.onResult === 'function')
      colorPickerRequest.onResult(hex);

    try { localStorage.removeItem(colorPickerRequest.returnKey); } catch {}
    colorPickerRequest = null;
  });

  // DOM references
  const templateSelect = document.getElementById('template-select');
  const wizardPanel = document.getElementById('wizard-panel');
  const formPanel = document.getElementById('form-panel');
  const wizardProgress = document.getElementById('wizard-progress');
  const wizardStepContainer = document.getElementById('wizard-step-container');
  const wizardBack = document.getElementById('wizard-back');
  const wizardSkip = document.getElementById('wizard-skip');
  const wizardNext = document.getElementById('wizard-next');
  const wizardFinish = document.getElementById('wizard-finish');
  const formSections = document.getElementById('form-sections');
  const previewPanel = document.getElementById('preview-panel');
  const previewContent = document.getElementById('preview-content');
  const splitter = document.getElementById('splitter');
  const editorPanel = document.getElementById('editor-panel');
  const mainSplit = document.getElementById('main-split');
  const statusBar = document.getElementById('status-bar');
  const statusQuality = document.getElementById('status-quality');
  const statusWarnings = document.getElementById('status-warnings');
  const statusLines = document.getElementById('status-lines');
  const copyTooltip = document.getElementById('copy-tooltip');
  const btnWizard = document.getElementById('btn-wizard');
  const btnForm = document.getElementById('btn-form');

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function showCopyTooltip(x, y) {
    copyTooltip.style.left = (x + 10) + 'px';
    copyTooltip.style.top = (y - 20) + 'px';
    copyTooltip.classList.add('visible');
    setTimeout(() => copyTooltip.classList.remove('visible'), 800);
  }

  // -----------------------------------------------------------------------
  // Window title
  // -----------------------------------------------------------------------
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const title = prefix + currentFileName + ' - README Generator';
    document.title = title;
    SZ.Dlls.User32.SetWindowText(title);
  }

  // -----------------------------------------------------------------------
  // Undo / Redo
  // -----------------------------------------------------------------------
  function pushUndo() {
    undoStack.push(deepClone(currentData));
    if (undoStack.length > MAX_UNDO)
      undoStack.shift();
    redoStack = [];
  }

  function doUndo() {
    if (undoStack.length === 0)
      return;
    redoStack.push(deepClone(currentData));
    currentData = undoStack.pop();
    dirty = true;
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateQuality();
  }

  function doRedo() {
    if (redoStack.length === 0)
      return;
    undoStack.push(deepClone(currentData));
    currentData = redoStack.pop();
    dirty = true;
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateQuality();
  }

  // -----------------------------------------------------------------------
  // Template management
  // -----------------------------------------------------------------------
  function loadCustomTemplates() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored)
        customTemplates = JSON.parse(stored);
    } catch (_) {
      customTemplates = [];
    }
  }

  function saveCustomTemplates() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
  }

  function rebuildTemplateList() {
    allTemplates = (SZ.ReadmeTemplates || []).concat(customTemplates);

    // Populate toolbar select
    templateSelect.innerHTML = '';
    for (const tpl of allTemplates) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      if (currentTemplate && tpl.id === currentTemplate.id)
        opt.selected = true;
      templateSelect.appendChild(opt);
    }

    // Populate Templates menu
    rebuildTemplatesMenu();
  }

  function rebuildTemplatesMenu() {
    const menu = document.getElementById('templates-menu');
    menu.innerHTML = '';

    for (const tpl of allTemplates) {
      const entry = document.createElement('div');
      entry.className = 'menu-entry radio' + (currentTemplate && tpl.id === currentTemplate.id ? ' checked' : '');
      entry.dataset.action = 'select-template:' + tpl.id;
      entry.textContent = tpl.name;
      menu.appendChild(entry);
    }

    const sep = document.createElement('div');
    sep.className = 'menu-separator';
    menu.appendChild(sep);

    if (customTemplates.length > 0) {
      const sep2 = document.createElement('div');
      sep2.className = 'menu-separator';
      // Custom templates already included in allTemplates above
    }

    const editEntry = document.createElement('div');
    editEntry.className = 'menu-entry';
    editEntry.dataset.action = 'edit-templates';
    editEntry.textContent = 'Edit Templates...';
    menu.appendChild(editEntry);

    const applyEntry = document.createElement('div');
    applyEntry.className = 'menu-entry';
    applyEntry.dataset.action = 'apply-template';
    applyEntry.textContent = 'Apply Different Template...';
    menu.appendChild(applyEntry);
  }

  function selectTemplate(id) {
    const tpl = allTemplates.find(t => t.id === id);
    if (!tpl)
      return;

    pushUndo();
    currentTemplate = tpl;
    templateSelect.value = id;
    wizardStep = 0;

    rebuildTemplatesMenu();
    refreshCurrentView();
    updatePreview();
    updateQuality();
    dirty = true;
    updateTitle();
  }

  function applyDifferentTemplate() {
    // Re-map existing data to the new template (keep matching section IDs)
    wizardStep = 0;
    refreshCurrentView();
  }

  // -----------------------------------------------------------------------
  // Markdown generation
  // -----------------------------------------------------------------------
  function generateMarkdown() {
    if (!currentTemplate)
      return '';

    const lines = [];

    for (const section of currentTemplate.sections) {
      const val = currentData[section.id];

      switch (section.id) {
        case 'title':
          if (val)
            lines.push('# ' + val, '');
          continue;
        case 'badges':
          if (val && Array.isArray(val) && val.length > 0) {
            const badgeLines = val.map(b => {
              if (b.imgUrl && b.linkUrl)
                return '[![' + (b.alt || '') + '](' + b.imgUrl + ')](' + b.linkUrl + ')';
              if (b.imgUrl)
                return '![' + (b.alt || '') + '](' + b.imgUrl + ')';
              return b.raw || '';
            }).filter(Boolean);
            if (badgeLines.length > 0)
              lines.push(badgeLines.join(' '), '');
          }
          continue;
        case 'description':
          if (val)
            lines.push(val, '');
          continue;
      }

      // All other sections get ## heading
      if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'object' && !Array.isArray(val) && Object.values(val).every(v => !v)))
        continue;

      lines.push('## ' + section.label, '');

      switch (section.type) {
        case 'text':
          lines.push(val, '');
          break;

        case 'textarea':
          lines.push(val, '');
          break;

        case 'codeblock':
          if (typeof val === 'object' && val.code) {
            lines.push('```' + (val.lang || 'bash'));
            lines.push(val.code);
            lines.push('```', '');
          } else if (typeof val === 'string' && val) {
            lines.push('```bash');
            lines.push(val);
            lines.push('```', '');
          }
          break;

        case 'list':
          if (Array.isArray(val))
            for (const item of val)
              if (item)
                lines.push('- ' + item);
          lines.push('');
          break;

        case 'checklist':
          if (Array.isArray(val))
            for (const item of val) {
              const check = item.checked ? 'x' : ' ';
              lines.push('- [' + check + '] ' + (item.text || ''));
            }
          lines.push('');
          break;

        case 'table':
          if (val && val.headers && val.headers.length > 0) {
            lines.push('| ' + val.headers.join(' | ') + ' |');
            lines.push('| ' + val.headers.map(() => '---').join(' | ') + ' |');
            if (val.rows)
              for (const row of val.rows)
                lines.push('| ' + row.join(' | ') + ' |');
            lines.push('');
          }
          break;

        case 'tags':
          if (Array.isArray(val) && val.length > 0)
            lines.push(val.map(t => '`' + t + '`').join(', '), '');
          break;

        case 'license':
          if (val)
            lines.push('This project is licensed under the ' + val + ' License.', '');
          break;

        case 'author':
          if (val) {
            if (val.name) lines.push('**' + val.name + '**', '');
            if (val.email) lines.push('- Email: ' + val.email);
            if (val.url) lines.push('- Website: ' + val.url);
            if (val.github) lines.push('- GitHub: [@' + val.github + '](https://github.com/' + val.github + ')');
            lines.push('');
          }
          break;

        case 'images':
          if (Array.isArray(val))
            for (const img of val)
              if (img.url)
                lines.push('![' + (img.alt || '') + '](' + img.url + ')', '');
          break;

        case 'badges':
          if (Array.isArray(val))
            for (const b of val)
              if (b.imgUrl)
                lines.push('[![' + (b.alt || '') + '](' + b.imgUrl + ')](' + (b.linkUrl || '#') + ')');
          lines.push('');
          break;

        default:
          if (typeof val === 'string')
            lines.push(val, '');
          break;
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // -----------------------------------------------------------------------
  // Preview rendering
  // -----------------------------------------------------------------------
  function renderMarkdownToHtml(md) {
    const lines = md.split('\n');
    const out = [];
    let inList = false;
    let inCode = false;
    let codeLang = '';
    let codeLines = [];

    for (const line of lines) {
      // Code blocks
      if (line.startsWith('```')) {
        if (inCode) {
          out.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
          inCode = false;
          codeLines = [];
          continue;
        }
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }

      // Headings
      const hMatch = line.match(/^(#{1,6})\s+(.+)/);
      if (hMatch) {
        if (inList) { out.push('</ul>'); inList = false; }
        const level = hMatch[1].length;
        out.push('<h' + level + '>' + inlineFormat(hMatch[2]) + '</h' + level + '>');
        continue;
      }

      // Table rows
      if (line.includes('|') && line.trim().startsWith('|')) {
        if (line.match(/^\|\s*[-:]+/))
          continue;
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        if (!out.length || !out[out.length - 1].endsWith('</tr>')) {
          // Assume header
          out.push('<table><tr>' + cells.map(c => '<th>' + inlineFormat(c) + '</th>').join('') + '</tr>');
        } else {
          out.push('<tr>' + cells.map(c => '<td>' + inlineFormat(c) + '</td>').join('') + '</tr>');
        }
        continue;
      }
      // Close table
      if (out.length && out[out.length - 1].endsWith('</tr>') && !line.includes('|')) {
        out.push('</table>');
      }

      // Checklist
      const checkMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)/);
      if (checkMatch) {
        if (!inList) { out.push('<ul>'); inList = true; }
        const checked = checkMatch[1] !== ' ' ? ' checked disabled' : ' disabled';
        out.push('<li><input type="checkbox"' + checked + '> ' + inlineFormat(checkMatch[2]) + '</li>');
        continue;
      }

      // List items
      const listMatch = line.match(/^\s*[-*+]\s+(.+)/);
      if (listMatch) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + inlineFormat(listMatch[1]) + '</li>');
        continue;
      }

      if (inList) { out.push('</ul>'); inList = false; }

      // Blockquote
      if (line.startsWith('>')) {
        out.push('<blockquote>' + inlineFormat(line.slice(1).trim()) + '</blockquote>');
        continue;
      }

      // Badge images
      const badgeMatch = line.match(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g);
      if (badgeMatch) {
        let processed = line;
        for (const badge of badgeMatch) {
          const m = badge.match(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/);
          if (m)
            processed = processed.replace(badge, '<span class="badge"><a href="' + escapeHtml(m[3]) + '"><img src="' + escapeHtml(m[2]) + '" alt="' + escapeHtml(m[1]) + '"></a></span>');
        }
        out.push('<p>' + processed + '</p>');
        continue;
      }

      // Blank line
      if (!line.trim())
        continue;

      // Paragraph
      out.push('<p>' + inlineFormat(line) + '</p>');
    }

    if (inList) out.push('</ul>');
    if (inCode) out.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
    // Close dangling table
    if (out.length && out[out.length - 1].endsWith('</tr>'))
      out.push('</table>');

    return out.join('\n');
  }

  function inlineFormat(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function updatePreview() {
    if (!showPreview)
      return;
    const md = generateMarkdown();
    previewContent.innerHTML = renderMarkdownToHtml(md);
    const lineCount = md.split('\n').length;
    statusLines.textContent = 'Ln ' + lineCount;
  }

  // -----------------------------------------------------------------------
  // Quality checker
  // -----------------------------------------------------------------------
  function checkQuality() {
    if (!currentTemplate)
      return { score: 0, warnings: [] };

    const warnings = [];
    let totalChecks = 0;
    let passed = 0;

    // Title check
    ++totalChecks;
    if (currentData.title && currentData.title.trim()) {
      ++passed;
      if (currentData.title.length > 50)
        warnings.push('Title is too long (>50 characters)');
    } else
      warnings.push('Missing project title');

    // Description check
    ++totalChecks;
    if (currentData.description && currentData.description.trim()) {
      ++passed;
      if (currentData.description.length < 20)
        warnings.push('Description is too short (<20 characters)');
    } else
      warnings.push('Missing description');

    // License check
    const hasLicenseSection = currentTemplate.sections.some(s => s.id === 'license');
    if (hasLicenseSection) {
      ++totalChecks;
      if (currentData.license && currentData.license.trim())
        ++passed;
      else
        warnings.push('Missing license');
    }

    // Installation check
    const hasInstall = currentTemplate.sections.some(s => s.id === 'installation');
    if (hasInstall) {
      ++totalChecks;
      const instVal = currentData.installation;
      if (instVal && ((typeof instVal === 'object' && instVal.code) || (typeof instVal === 'string' && instVal.trim())))
        ++passed;
      else
        warnings.push('Missing installation instructions');
    }

    // Badges check
    const hasBadges = currentTemplate.sections.some(s => s.id === 'badges');
    if (hasBadges) {
      ++totalChecks;
      if (currentData.badges && Array.isArray(currentData.badges) && currentData.badges.length > 0)
        ++passed;
      else
        warnings.push('No badges');
    }

    // Usage check
    const hasUsage = currentTemplate.sections.some(s => s.id === 'usage');
    if (hasUsage) {
      ++totalChecks;
      const usageVal = currentData.usage;
      if (usageVal && ((typeof usageVal === 'object' && usageVal.code) || (typeof usageVal === 'string' && usageVal.trim())))
        ++passed;
      else
        warnings.push('No usage examples');
    }

    // Check for empty sections
    for (const section of currentTemplate.sections) {
      if (['title', 'description', 'license', 'badges', 'installation', 'usage'].includes(section.id))
        continue;
      const val = currentData[section.id];
      if (val !== undefined && val !== null && val !== '') {
        if (typeof val === 'string' && val.trim() === '' || (Array.isArray(val) && val.length === 0))
          warnings.push(section.label + ' is an empty placeholder');
      }
    }

    const score = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 0;
    return { score, warnings };
  }

  function updateQuality() {
    const { score, warnings } = checkQuality();
    statusQuality.textContent = 'Quality: ' + score + '%';
    statusQuality.className = 'status-section status-quality ' + (score >= 80 ? 'good' : score >= 50 ? 'ok' : 'poor');
    statusWarnings.textContent = warnings.length + ' warning' + (warnings.length !== 1 ? 's' : '');
    statusWarnings.title = warnings.join('\n');
  }

  // -----------------------------------------------------------------------
  // Field editor rendering
  // -----------------------------------------------------------------------
  function renderFieldEditor(section, container) {
    container.innerHTML = '';
    container.className = 'field-editor';
    const val = currentData[section.id];

    switch (section.type) {
      case 'text': {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = val || '';
        input.placeholder = section.label + '...';
        input.addEventListener('input', () => {
          pushUndo();
          currentData[section.id] = input.value;
          dirty = true;
          updateTitle();
          updatePreview();
          updateQuality();
        });
        container.appendChild(input);
        break;
      }

      case 'textarea': {
        const textarea = document.createElement('textarea');
        textarea.rows = 6;
        textarea.value = val || '';
        textarea.placeholder = section.label + '...';
        textarea.addEventListener('input', () => {
          pushUndo();
          currentData[section.id] = textarea.value;
          dirty = true;
          updateTitle();
          updatePreview();
          updateQuality();
        });
        container.appendChild(textarea);
        break;
      }

      case 'codeblock': {
        const langRow = document.createElement('div');
        langRow.className = 'code-lang-row';
        const langLabel = document.createElement('label');
        langLabel.textContent = 'Language:';
        const langSelect = document.createElement('select');
        for (const lang of CODE_LANGS) {
          const opt = document.createElement('option');
          opt.value = lang;
          opt.textContent = lang;
          langSelect.appendChild(opt);
        }
        langSelect.value = (val && typeof val === 'object') ? (val.lang || 'bash') : 'bash';
        langRow.appendChild(langLabel);
        langRow.appendChild(langSelect);
        container.appendChild(langRow);

        const textarea = document.createElement('textarea');
        textarea.rows = 8;
        textarea.value = (val && typeof val === 'object') ? (val.code || '') : (val || '');
        textarea.placeholder = 'Enter code...';

        const update = () => {
          pushUndo();
          currentData[section.id] = { lang: langSelect.value, code: textarea.value };
          dirty = true;
          updateTitle();
          updatePreview();
          updateQuality();
        };

        langSelect.addEventListener('change', update);
        textarea.addEventListener('input', update);
        container.appendChild(textarea);
        break;
      }

      case 'list': {
        const editor = document.createElement('div');
        editor.className = 'list-editor';
        const items = Array.isArray(val) ? [...val] : [''];

        const renderList = () => {
          editor.innerHTML = '';
          for (let i = 0; i < items.length; ++i) {
            const row = document.createElement('div');
            row.className = 'list-item-row';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = items[i] || '';
            input.placeholder = 'Item ' + (i + 1);
            const idx = i;
            input.addEventListener('input', () => {
              items[idx] = input.value;
              pushUndo();
              currentData[section.id] = items.filter(Boolean);
              dirty = true;
              updateTitle();
              updatePreview();
              updateQuality();
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.title = 'Remove';
            removeBtn.addEventListener('click', () => {
              items.splice(idx, 1);
              if (items.length === 0) items.push('');
              pushUndo();
              currentData[section.id] = items.filter(Boolean);
              dirty = true;
              updateTitle();
              renderList();
              updatePreview();
              updateQuality();
            });
            row.appendChild(input);
            row.appendChild(removeBtn);
            editor.appendChild(row);
          }
          const addBtn = document.createElement('button');
          addBtn.className = 'list-add';
          addBtn.textContent = '+ Add item';
          addBtn.addEventListener('click', () => {
            items.push('');
            renderList();
          });
          editor.appendChild(addBtn);
        };

        renderList();
        container.appendChild(editor);
        break;
      }

      case 'checklist': {
        const editor = document.createElement('div');
        editor.className = 'checklist-editor';
        const items = Array.isArray(val) ? val.map(v => ({ ...v })) : [{ text: '', checked: false }];

        const renderChecklist = () => {
          editor.innerHTML = '';
          for (let i = 0; i < items.length; ++i) {
            const row = document.createElement('div');
            row.className = 'checklist-item-row';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = items[i].checked;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = items[i].text || '';
            input.placeholder = 'Item ' + (i + 1);
            const idx = i;
            cb.addEventListener('change', () => {
              items[idx].checked = cb.checked;
              pushUndo();
              currentData[section.id] = items.filter(v => v.text);
              dirty = true;
              updateTitle();
              updatePreview();
            });
            input.addEventListener('input', () => {
              items[idx].text = input.value;
              pushUndo();
              currentData[section.id] = items.filter(v => v.text);
              dirty = true;
              updateTitle();
              updatePreview();
              updateQuality();
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.addEventListener('click', () => {
              items.splice(idx, 1);
              if (items.length === 0) items.push({ text: '', checked: false });
              pushUndo();
              currentData[section.id] = items.filter(v => v.text);
              dirty = true;
              updateTitle();
              renderChecklist();
              updatePreview();
              updateQuality();
            });
            row.appendChild(cb);
            row.appendChild(input);
            row.appendChild(removeBtn);
            editor.appendChild(row);
          }
          const addBtn = document.createElement('button');
          addBtn.className = 'list-add';
          addBtn.textContent = '+ Add item';
          addBtn.addEventListener('click', () => {
            items.push({ text: '', checked: false });
            renderChecklist();
          });
          editor.appendChild(addBtn);
        };

        renderChecklist();
        container.appendChild(editor);
        break;
      }

      case 'table': {
        const editor = document.createElement('div');
        editor.className = 'table-editor';
        const tableData = (val && val.headers) ? deepClone(val) : { headers: ['Column 1', 'Column 2'], rows: [['', '']] };

        const renderTable = () => {
          editor.innerHTML = '';
          const table = document.createElement('table');
          const thead = document.createElement('tr');
          for (let c = 0; c < tableData.headers.length; ++c) {
            const th = document.createElement('th');
            const input = document.createElement('input');
            input.value = tableData.headers[c] || '';
            input.placeholder = 'Header';
            const ci = c;
            input.addEventListener('input', () => {
              tableData.headers[ci] = input.value;
              pushUndo();
              currentData[section.id] = deepClone(tableData);
              dirty = true;
              updateTitle();
              updatePreview();
            });
            th.appendChild(input);
            thead.appendChild(th);
          }
          table.appendChild(thead);

          for (let r = 0; r < tableData.rows.length; ++r) {
            const tr = document.createElement('tr');
            for (let c = 0; c < tableData.headers.length; ++c) {
              const td = document.createElement('td');
              const input = document.createElement('input');
              input.value = (tableData.rows[r] && tableData.rows[r][c]) || '';
              input.placeholder = '';
              const ri = r, ci = c;
              input.addEventListener('input', () => {
                if (!tableData.rows[ri]) tableData.rows[ri] = [];
                tableData.rows[ri][ci] = input.value;
                pushUndo();
                currentData[section.id] = deepClone(tableData);
                dirty = true;
                updateTitle();
                updatePreview();
              });
              td.appendChild(input);
              tr.appendChild(td);
            }
            table.appendChild(tr);
          }
          editor.appendChild(table);

          const controls = document.createElement('div');
          controls.className = 'table-controls';
          const addRow = document.createElement('button');
          addRow.textContent = '+ Row';
          addRow.addEventListener('click', () => {
            tableData.rows.push(new Array(tableData.headers.length).fill(''));
            pushUndo();
            currentData[section.id] = deepClone(tableData);
            dirty = true;
            updateTitle();
            renderTable();
            updatePreview();
          });
          const addCol = document.createElement('button');
          addCol.textContent = '+ Column';
          addCol.addEventListener('click', () => {
            tableData.headers.push('Column ' + (tableData.headers.length + 1));
            for (const row of tableData.rows) row.push('');
            pushUndo();
            currentData[section.id] = deepClone(tableData);
            dirty = true;
            updateTitle();
            renderTable();
            updatePreview();
          });
          const remRow = document.createElement('button');
          remRow.textContent = '- Row';
          remRow.addEventListener('click', () => {
            if (tableData.rows.length > 1) {
              tableData.rows.pop();
              pushUndo();
              currentData[section.id] = deepClone(tableData);
              dirty = true;
              updateTitle();
              renderTable();
              updatePreview();
            }
          });
          const remCol = document.createElement('button');
          remCol.textContent = '- Column';
          remCol.addEventListener('click', () => {
            if (tableData.headers.length > 1) {
              tableData.headers.pop();
              for (const row of tableData.rows) row.pop();
              pushUndo();
              currentData[section.id] = deepClone(tableData);
              dirty = true;
              updateTitle();
              renderTable();
              updatePreview();
            }
          });
          controls.appendChild(addRow);
          controls.appendChild(addCol);
          controls.appendChild(remRow);
          controls.appendChild(remCol);
          editor.appendChild(controls);
        };

        renderTable();
        container.appendChild(editor);
        break;
      }

      case 'tags': {
        const editor = document.createElement('div');
        editor.className = 'tags-editor';
        const tags = Array.isArray(val) ? [...val] : [];

        const renderTags = () => {
          editor.innerHTML = '';
          const tagsContainer = document.createElement('div');
          tagsContainer.className = 'tags-container';
          for (let i = 0; i < tags.length; ++i) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = tags[i];
            const removeBtn = document.createElement('span');
            removeBtn.className = 'tag-remove';
            removeBtn.textContent = '\u2716';
            const idx = i;
            removeBtn.addEventListener('click', () => {
              tags.splice(idx, 1);
              pushUndo();
              currentData[section.id] = [...tags];
              dirty = true;
              updateTitle();
              renderTags();
              updatePreview();
              updateQuality();
            });
            tag.appendChild(removeBtn);
            tagsContainer.appendChild(tag);
          }
          editor.appendChild(tagsContainer);

          const inputRow = document.createElement('div');
          inputRow.className = 'tag-input-row';
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = 'Type and press Enter...';
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
              e.preventDefault();
              tags.push(input.value.trim());
              input.value = '';
              pushUndo();
              currentData[section.id] = [...tags];
              dirty = true;
              updateTitle();
              renderTags();
              updatePreview();
              updateQuality();
            }
          });
          inputRow.appendChild(input);
          editor.appendChild(inputRow);
        };

        renderTags();
        container.appendChild(editor);
        break;
      }

      case 'license': {
        const editor = document.createElement('div');
        editor.className = 'license-editor';
        const select = document.createElement('select');
        for (const lic of LICENSES) {
          const opt = document.createElement('option');
          opt.value = lic;
          opt.textContent = lic;
          select.appendChild(opt);
        }
        select.value = (val && LICENSES.includes(val)) ? val : 'MIT';

        const customArea = document.createElement('textarea');
        customArea.className = 'license-custom';
        customArea.rows = 3;
        customArea.placeholder = 'Custom license text...';
        customArea.value = (!LICENSES.includes(val) && val) ? val : '';
        if (select.value === 'Custom')
          customArea.classList.add('visible');

        select.addEventListener('change', () => {
          pushUndo();
          customArea.classList.toggle('visible', select.value === 'Custom');
          currentData[section.id] = select.value === 'Custom' ? customArea.value : select.value;
          dirty = true;
          updateTitle();
          updatePreview();
          updateQuality();
        });

        customArea.addEventListener('input', () => {
          pushUndo();
          currentData[section.id] = customArea.value;
          dirty = true;
          updateTitle();
          updatePreview();
        });

        editor.appendChild(select);
        editor.appendChild(customArea);
        container.appendChild(editor);

        if (!val)
          currentData[section.id] = 'MIT';
        break;
      }

      case 'author': {
        const editor = document.createElement('div');
        editor.className = 'author-editor';
        const authorData = (val && typeof val === 'object') ? { ...val } : { name: '', email: '', url: '', github: '' };
        const fields = [
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'url', label: 'Website' },
          { key: 'github', label: 'GitHub' },
        ];

        for (const f of fields) {
          const row = document.createElement('div');
          row.className = 'author-row';
          const label = document.createElement('label');
          label.textContent = f.label + ':';
          const input = document.createElement('input');
          input.type = 'text';
          input.value = authorData[f.key] || '';
          input.placeholder = f.label + '...';
          input.addEventListener('input', () => {
            authorData[f.key] = input.value;
            pushUndo();
            currentData[section.id] = { ...authorData };
            dirty = true;
            updateTitle();
            updatePreview();
            updateQuality();
          });
          row.appendChild(label);
          row.appendChild(input);
          editor.appendChild(row);
        }

        container.appendChild(editor);
        break;
      }

      case 'badges': {
        const editor = document.createElement('div');
        editor.className = 'badges-editor';
        const badges = Array.isArray(val) ? val.map(b => ({ ...b, overrides: b.overrides ? { ...b.overrides } : {} })) : [];

        // Badge builder state
        const builderState = { label: '', message: '', color: 'blue', labelColor: '', style: 'flat', logo: '', logoColor: '' };

        function resolveTemplate(tpl, overrides) {
          const o = overrides || {};
          return tpl
            .replace(/\{user\}/g, o.user || currentData._badgeUser || '{user}')
            .replace(/\{repo\}/g, o.repo || currentData._badgeRepo || '{repo}')
            .replace(/\{package\}/g, o.package || currentData._badgePackage || '{package}');
        }

        function commitBadges() {
          pushUndo();
          currentData[section.id] = [...badges];
          dirty = true;
          updateTitle();
          updatePreview();
          updateQuality();
        }

        // Helper: create a color pick button that opens the SZ color picker
        function createColorPickButton(inputEl, stateKey, extraCallback) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'badge-color-pick-btn';
          btn.textContent = '\u2026';
          btn.title = 'Pick color\u2026';
          btn.addEventListener('click', () => {
            openSzColorPicker(inputEl.value, hex => {
              inputEl.value = hex;
              if (stateKey)
                builderState[stateKey] = hex;
              if (typeof extraCallback === 'function')
                extraCallback(hex);
              updateBuilderPreview();
            });
          });
          return btn;
        }

        // Helper: wrap an input + pick button in a flex row
        function wrapWithPickButton(inputEl, stateKey, extraCallback) {
          const row = document.createElement('div');
          row.className = 'badge-color-input-row';
          row.appendChild(inputEl);
          row.appendChild(createColorPickButton(inputEl, stateKey, extraCallback));
          return row;
        }

        // --- 3a. Repository context row ---
        const ctxSection = document.createElement('div');
        ctxSection.className = 'badge-section';
        const ctxHeader = document.createElement('div');
        ctxHeader.className = 'badge-section-header';
        ctxHeader.textContent = 'Repository Context';
        ctxSection.appendChild(ctxHeader);

        const ctxRow = document.createElement('div');
        ctxRow.className = 'badge-repo-context';
        for (const f of [
          { key: '_badgeUser', placeholder: 'User / Org' },
          { key: '_badgeRepo', placeholder: 'Repository' },
          { key: '_badgePackage', placeholder: 'Package name' },
        ]) {
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = f.placeholder;
          input.value = currentData[f.key] || '';
          input.addEventListener('input', () => {
            currentData[f.key] = input.value;
            // Re-resolve all preset badge URLs respecting per-badge overrides
            for (const b of badges)
              if (b.preset) {
                const preset = BADGE_PRESETS.find(p => p.id === b.preset);
                if (preset) {
                  b.imgUrl = resolveTemplate(preset.tpl, b.overrides);
                  b.linkUrl = preset.linkTpl ? resolveTemplate(preset.linkTpl, b.overrides) : '#';
                }
              }
            commitBadges();
            renderBadgeList();
          });
          ctxRow.appendChild(input);
        }
        ctxSection.appendChild(ctxRow);
        editor.appendChild(ctxSection);

        // --- 3b. Preset toggles by category ---
        const presetsSection = document.createElement('div');
        presetsSection.className = 'badge-section';
        const presetsHeader = document.createElement('div');
        presetsHeader.className = 'badge-section-header';
        presetsHeader.textContent = 'Preset Badges';
        presetsSection.appendChild(presetsHeader);

        for (const category of BADGE_CATEGORIES) {
          const catDiv = document.createElement('div');
          catDiv.className = 'badge-category';
          const catHeader = document.createElement('div');
          catHeader.className = 'badge-category-header';
          catHeader.textContent = category.name;
          catDiv.appendChild(catHeader);

          const itemsDiv = document.createElement('div');
          itemsDiv.className = 'badge-category-items';
          for (const preset of category.items) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'badge-preset-btn';
            btn.dataset.presetId = preset.id;
            if (badges.some(b => b.preset === preset.id))
              btn.classList.add('selected');
            btn.textContent = preset.icon + ' ' + preset.label;
            btn.addEventListener('click', () => {
              const existing = badges.findIndex(b => b.preset === preset.id);
              if (existing >= 0) {
                badges.splice(existing, 1);
                btn.classList.remove('selected');
              } else {
                badges.push({
                  preset: preset.id,
                  alt: preset.label,
                  imgUrl: resolveTemplate(preset.tpl),
                  linkUrl: preset.linkTpl ? resolveTemplate(preset.linkTpl) : '#',
                  overrides: {},
                });
                btn.classList.add('selected');
              }
              commitBadges();
              renderBadgeList();
            });
            itemsDiv.appendChild(btn);
          }
          catDiv.appendChild(itemsDiv);
          presetsSection.appendChild(catDiv);
        }
        editor.appendChild(presetsSection);

        // --- 3c. Custom badge builder ---
        const builderSection = document.createElement('div');
        builderSection.className = 'badge-section';
        const builderHeader = document.createElement('div');
        builderHeader.className = 'badge-section-header';
        builderHeader.textContent = 'Custom Badge Builder';
        builderSection.appendChild(builderHeader);

        const builderPanel = document.createElement('div');
        builderPanel.className = 'badge-builder';

        // Preview
        const previewArea = document.createElement('div');
        previewArea.className = 'badge-builder-preview';
        const previewImg = document.createElement('img');
        previewImg.alt = 'Badge preview';
        previewImg.addEventListener('error', () => { previewImg.style.display = 'none'; });
        previewImg.addEventListener('load', () => { previewImg.style.display = ''; });
        previewArea.appendChild(previewImg);
        builderPanel.appendChild(previewArea);

        function updateBuilderPreview() {
          if (builderState.label || builderState.message)
            previewImg.src = buildShieldsUrl(builderState);
          else
            previewImg.style.display = 'none';
        }

        // Label
        const labelRow = document.createElement('div');
        labelRow.className = 'badge-builder-row';
        const labelLbl = document.createElement('label');
        labelLbl.textContent = 'Label:';
        const labelInp = document.createElement('input');
        labelInp.type = 'text';
        labelInp.placeholder = 'left side text';
        labelInp.addEventListener('input', () => { builderState.label = labelInp.value; updateBuilderPreview(); });
        labelRow.appendChild(labelLbl);
        labelRow.appendChild(labelInp);
        builderPanel.appendChild(labelRow);

        // Message
        const msgRow = document.createElement('div');
        msgRow.className = 'badge-builder-row';
        const msgLbl = document.createElement('label');
        msgLbl.textContent = 'Message:';
        const msgInp = document.createElement('input');
        msgInp.type = 'text';
        msgInp.placeholder = 'right side text';
        msgInp.addEventListener('input', () => { builderState.message = msgInp.value; updateBuilderPreview(); });
        msgRow.appendChild(msgLbl);
        msgRow.appendChild(msgInp);
        builderPanel.appendChild(msgRow);

        // Color (message/right side)
        const colorRow = document.createElement('div');
        colorRow.className = 'badge-builder-row';
        const colorLbl = document.createElement('label');
        colorLbl.textContent = 'Color:';
        const colorContainer = document.createElement('div');
        colorContainer.className = 'badge-builder-color-container';
        const palette = document.createElement('div');
        palette.className = 'color-palette';
        const colorInp = document.createElement('input');
        colorInp.type = 'text';
        colorInp.value = 'blue';
        colorInp.placeholder = 'color name or hex';
        for (const c of SHIELDS_COLORS) {
          const swatch = document.createElement('span');
          swatch.className = 'color-swatch' + (c.name === 'blue' ? ' selected' : '');
          swatch.style.backgroundColor = c.hex;
          swatch.title = c.name;
          swatch.addEventListener('click', () => {
            builderState.color = c.name;
            colorInp.value = c.name;
            for (const s of palette.querySelectorAll('.color-swatch'))
              s.classList.remove('selected');
            swatch.classList.add('selected');
            updateBuilderPreview();
          });
          palette.appendChild(swatch);
        }
        colorInp.addEventListener('input', () => {
          builderState.color = colorInp.value;
          for (const s of palette.querySelectorAll('.color-swatch'))
            s.classList.toggle('selected', s.title === colorInp.value);
          updateBuilderPreview();
        });
        colorContainer.appendChild(palette);
        colorContainer.appendChild(wrapWithPickButton(colorInp, 'color'));
        colorRow.appendChild(colorLbl);
        colorRow.appendChild(colorContainer);
        builderPanel.appendChild(colorRow);

        // Label Color (left side)
        const labelColorRow = document.createElement('div');
        labelColorRow.className = 'badge-builder-row';
        const labelColorLbl = document.createElement('label');
        labelColorLbl.textContent = 'Label Color:';
        const labelColorContainer = document.createElement('div');
        labelColorContainer.className = 'badge-builder-color-container';
        const labelColorPalette = document.createElement('div');
        labelColorPalette.className = 'color-palette';
        const labelColorInp = document.createElement('input');
        labelColorInp.type = 'text';
        labelColorInp.value = '';
        labelColorInp.placeholder = 'left side color (optional)';
        for (const c of SHIELDS_COLORS) {
          const swatch = document.createElement('span');
          swatch.className = 'color-swatch';
          swatch.style.backgroundColor = c.hex;
          swatch.title = c.name;
          swatch.addEventListener('click', () => {
            builderState.labelColor = c.name;
            labelColorInp.value = c.name;
            for (const s of labelColorPalette.querySelectorAll('.color-swatch'))
              s.classList.remove('selected');
            swatch.classList.add('selected');
            updateBuilderPreview();
          });
          labelColorPalette.appendChild(swatch);
        }
        labelColorInp.addEventListener('input', () => {
          builderState.labelColor = labelColorInp.value;
          for (const s of labelColorPalette.querySelectorAll('.color-swatch'))
            s.classList.toggle('selected', s.title === labelColorInp.value);
          updateBuilderPreview();
        });
        labelColorContainer.appendChild(labelColorPalette);
        labelColorContainer.appendChild(wrapWithPickButton(labelColorInp, 'labelColor'));
        labelColorRow.appendChild(labelColorLbl);
        labelColorRow.appendChild(labelColorContainer);
        builderPanel.appendChild(labelColorRow);

        // Style
        const styleRow = document.createElement('div');
        styleRow.className = 'badge-builder-row';
        const styleLbl = document.createElement('label');
        styleLbl.textContent = 'Style:';
        const styleSelect = document.createElement('select');
        for (const s of SHIELDS_STYLES) {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          styleSelect.appendChild(opt);
        }
        styleSelect.addEventListener('change', () => { builderState.style = styleSelect.value; updateBuilderPreview(); });
        styleRow.appendChild(styleLbl);
        styleRow.appendChild(styleSelect);
        builderPanel.appendChild(styleRow);

        // Logo (text input with autocomplete icon grid)
        const logoRow = document.createElement('div');
        logoRow.className = 'badge-builder-row';
        const logoLbl = document.createElement('label');
        logoLbl.textContent = 'Logo:';
        const logoContainer = document.createElement('div');
        logoContainer.className = 'badge-builder-logo-container';

        const logoInp = document.createElement('input');
        logoInp.type = 'text';
        logoInp.className = 'badge-logo-input';
        logoInp.placeholder = 'e.g. github, npm, python';
        logoInp.value = builderState.logo || '';
        logoContainer.appendChild(logoInp);

        const logoGrid = document.createElement('div');
        logoGrid.className = 'badge-logo-grid';

        const logoStatus = document.createElement('div');
        logoStatus.className = 'badge-logo-hover-name';

        function renderLogoGrid() {
          logoGrid.innerHTML = '';
          const filter = (logoInp.value || '').toLowerCase().trim();
          if (!filter) {
            logoGrid.style.display = 'none';
            logoStatus.textContent = '';
            return;
          }
          let matched = 0;
          let rendered = 0;
          for (const slug of shieldsLogos) {
            if (!slug.includes(filter))
              continue;
            ++matched;
            if (rendered >= SHIELDS_LOGO_GRID_MAX)
              continue; // count but don't render
            const tile = document.createElement('span');
            tile.className = 'badge-logo-tile';
            if (builderState.logo === slug)
              tile.classList.add('selected');
            tile.title = slug;
            const img = document.createElement('img');
            img.src = 'https://cdn.simpleicons.org/' + slug;
            img.width = 16;
            img.height = 16;
            img.alt = slug;
            img.addEventListener('error', () => {
              img.style.display = 'none';
              const letter = document.createElement('span');
              letter.className = 'badge-logo-letter';
              letter.textContent = slug.charAt(0).toUpperCase();
              tile.appendChild(letter);
            });
            tile.appendChild(img);
            tile.addEventListener('pointerenter', () => { logoStatus.textContent = slug; });
            tile.addEventListener('pointerleave', () => {
              logoStatus.textContent = matched > rendered
                ? matched + ' matches (showing ' + rendered + ')'
                : matched + ' match' + (matched !== 1 ? 'es' : '');
            });
            tile.addEventListener('click', () => {
              logoInp.value = slug;
              builderState.logo = slug;
              renderLogoGrid();
              updateBuilderPreview();
              logoInp.focus();
            });
            logoGrid.appendChild(tile);
            ++rendered;
          }
          logoGrid.style.display = rendered > 0 ? '' : 'none';
          logoStatus.textContent = matched > rendered
            ? matched + ' matches (showing ' + rendered + ', type more to narrow)'
            : matched > 0 ? matched + ' match' + (matched !== 1 ? 'es' : '') : 'no matches';
        }

        logoInp.addEventListener('input', () => {
          builderState.logo = logoInp.value.trim();
          renderLogoGrid();
          updateBuilderPreview();
        });
        logoInp.addEventListener('focus', () => {
          ensureFullLogoList(renderLogoGrid);
          renderLogoGrid();
        });

        // Hide grid when clicking outside the logo container
        document.addEventListener('pointerdown', e => {
          if (!logoContainer.contains(e.target)) {
            logoGrid.style.display = 'none';
            logoStatus.textContent = '';
          }
        });

        renderLogoGrid();

        logoContainer.appendChild(logoGrid);
        logoContainer.appendChild(logoStatus);
        logoRow.appendChild(logoLbl);
        logoRow.appendChild(logoContainer);
        builderPanel.appendChild(logoRow);

        // Logo color
        const logoColorRow = document.createElement('div');
        logoColorRow.className = 'badge-builder-row';
        const logoColorLbl = document.createElement('label');
        logoColorLbl.textContent = 'Logo Color:';
        const logoColorInp = document.createElement('input');
        logoColorInp.type = 'text';
        logoColorInp.placeholder = 'e.g. white, #fff';
        logoColorInp.addEventListener('input', () => { builderState.logoColor = logoColorInp.value; updateBuilderPreview(); });
        logoColorRow.appendChild(logoColorLbl);
        logoColorRow.appendChild(wrapWithPickButton(logoColorInp, 'logoColor'));
        builderPanel.appendChild(logoColorRow);

        // Add button
        const addBtnRow = document.createElement('div');
        addBtnRow.className = 'badge-builder-row badge-builder-actions';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.textContent = 'Add Badge';
        addBtn.addEventListener('click', () => {
          if (!builderState.label && !builderState.message)
            return;
          const url = buildShieldsUrl(builderState);
          badges.push({ alt: (builderState.label + ' ' + builderState.message).trim(), imgUrl: url, linkUrl: '#', overrides: {} });
          labelInp.value = '';
          msgInp.value = '';
          builderState.label = '';
          builderState.message = '';
          builderState.labelColor = '';
          labelColorInp.value = '';
          for (const s of labelColorPalette.querySelectorAll('.color-swatch'))
            s.classList.remove('selected');
          previewImg.style.display = 'none';
          commitBadges();
          renderBadgeList();
        });
        addBtnRow.appendChild(addBtn);
        builderPanel.appendChild(addBtnRow);

        builderSection.appendChild(builderPanel);
        editor.appendChild(builderSection);

        // --- 3d. Active badges list ---
        const listSection = document.createElement('div');
        listSection.className = 'badge-section';
        const listHeader = document.createElement('div');
        listHeader.className = 'badge-section-header';
        listHeader.textContent = 'Active Badges';
        listSection.appendChild(listHeader);

        const listContainer = document.createElement('div');
        listContainer.className = 'badge-list';
        listSection.appendChild(listContainer);

        function renderBadgeList() {
          listContainer.innerHTML = '';
          if (badges.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'badge-list-empty';
            empty.textContent = 'No badges added yet. Toggle presets above or build a custom badge.';
            listContainer.appendChild(empty);
            return;
          }
          for (let i = 0; i < badges.length; ++i) {
            const b = badges[i];
            const item = document.createElement('div');
            item.className = 'badge-list-item';

            // Main row: thumbnail + label + controls
            const mainRow = document.createElement('div');
            mainRow.className = 'badge-list-main-row';

            const thumb = document.createElement('img');
            thumb.src = b.imgUrl || '';
            thumb.alt = b.alt || '';
            thumb.addEventListener('error', () => { thumb.style.display = 'none'; });
            mainRow.appendChild(thumb);

            const label = document.createElement('span');
            label.className = 'badge-list-label';
            label.textContent = b.alt || b.imgUrl || '';
            label.title = b.imgUrl || '';
            mainRow.appendChild(label);

            const controls = document.createElement('span');
            controls.className = 'badge-list-controls';

            const idx = i;
            if (i > 0) {
              const upBtn = document.createElement('button');
              upBtn.type = 'button';
              upBtn.textContent = '\u25B2';
              upBtn.title = 'Move up';
              upBtn.addEventListener('click', () => {
                [badges[idx - 1], badges[idx]] = [badges[idx], badges[idx - 1]];
                commitBadges();
                renderBadgeList();
              });
              controls.appendChild(upBtn);
            }

            if (i < badges.length - 1) {
              const downBtn = document.createElement('button');
              downBtn.type = 'button';
              downBtn.textContent = '\u25BC';
              downBtn.title = 'Move down';
              downBtn.addEventListener('click', () => {
                [badges[idx], badges[idx + 1]] = [badges[idx + 1], badges[idx]];
                commitBadges();
                renderBadgeList();
              });
              controls.appendChild(downBtn);
            }

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = '\u2716';
            removeBtn.title = 'Remove';
            removeBtn.addEventListener('click', () => {
              const removed = badges.splice(idx, 1)[0];
              if (removed.preset) {
                const btn = presetsSection.querySelector('[data-preset-id="' + removed.preset + '"]');
                if (btn)
                  btn.classList.remove('selected');
              }
              commitBadges();
              renderBadgeList();
            });
            controls.appendChild(removeBtn);

            mainRow.appendChild(controls);
            item.appendChild(mainRow);

            // Overrides row: for preset badges, show editable fields for each placeholder
            if (b.preset) {
              const preset = BADGE_PRESETS.find(p => p.id === b.preset);
              if (preset) {
                const combined = (preset.tpl || '') + ' ' + (preset.linkTpl || '');
                const placeholders = [];
                if (combined.includes('{user}'))
                  placeholders.push('user');
                if (combined.includes('{repo}'))
                  placeholders.push('repo');
                if (combined.includes('{package}'))
                  placeholders.push('package');

                if (placeholders.length > 0) {
                  const overridesRow = document.createElement('div');
                  overridesRow.className = 'badge-list-overrides';

                  for (const key of placeholders) {
                    const field = document.createElement('span');
                    field.className = 'badge-override-field';
                    const fieldLabel = document.createElement('span');
                    fieldLabel.textContent = key + ':';
                    const fieldInput = document.createElement('input');
                    fieldInput.type = 'text';
                    fieldInput.value = (b.overrides && b.overrides[key]) || '';
                    fieldInput.placeholder = key === 'user' ? (currentData._badgeUser || key) : key === 'repo' ? (currentData._badgeRepo || key) : (currentData._badgePackage || key);
                    const bRef = b;
                    const presetRef = preset;
                    fieldInput.addEventListener('input', () => {
                      if (!bRef.overrides)
                        bRef.overrides = {};
                      bRef.overrides[key] = fieldInput.value;
                      bRef.imgUrl = resolveTemplate(presetRef.tpl, bRef.overrides);
                      bRef.linkUrl = presetRef.linkTpl ? resolveTemplate(presetRef.linkTpl, bRef.overrides) : '#';
                      thumb.src = bRef.imgUrl;
                      thumb.style.display = '';
                      commitBadges();
                    });
                    field.appendChild(fieldLabel);
                    field.appendChild(fieldInput);
                    overridesRow.appendChild(field);
                  }
                  item.appendChild(overridesRow);
                }
              }
            }

            listContainer.appendChild(item);
          }
        }

        renderBadgeList();
        editor.appendChild(listSection);

        container.appendChild(editor);
        break;
      }

      case 'images': {
        const editor = document.createElement('div');
        editor.className = 'images-editor';
        const images = Array.isArray(val) ? val.map(v => ({ ...v })) : [{ url: '', alt: '' }];

        const renderImages = () => {
          editor.innerHTML = '';
          for (let i = 0; i < images.length; ++i) {
            const row = document.createElement('div');
            row.className = 'image-row';
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.value = images[i].url || '';
            urlInput.placeholder = 'Image URL';
            const altInput = document.createElement('input');
            altInput.type = 'text';
            altInput.value = images[i].alt || '';
            altInput.placeholder = 'Alt text';
            const idx = i;
            urlInput.addEventListener('input', () => {
              images[idx].url = urlInput.value;
              pushUndo();
              currentData[section.id] = images.filter(v => v.url);
              dirty = true;
              updateTitle();
              updatePreview();
            });
            altInput.addEventListener('input', () => {
              images[idx].alt = altInput.value;
              pushUndo();
              currentData[section.id] = images.filter(v => v.url);
              dirty = true;
              updateTitle();
              updatePreview();
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.addEventListener('click', () => {
              images.splice(idx, 1);
              if (images.length === 0) images.push({ url: '', alt: '' });
              pushUndo();
              currentData[section.id] = images.filter(v => v.url);
              dirty = true;
              updateTitle();
              renderImages();
              updatePreview();
            });
            row.appendChild(urlInput);
            row.appendChild(altInput);
            row.appendChild(removeBtn);
            editor.appendChild(row);
          }
          const addBtn = document.createElement('button');
          addBtn.className = 'list-add';
          addBtn.textContent = '+ Add image';
          addBtn.addEventListener('click', () => {
            images.push({ url: '', alt: '' });
            renderImages();
          });
          editor.appendChild(addBtn);
        };

        renderImages();
        container.appendChild(editor);
        break;
      }

      default: {
        const textarea = document.createElement('textarea');
        textarea.rows = 4;
        textarea.value = val || '';
        textarea.placeholder = section.label + '...';
        textarea.addEventListener('input', () => {
          pushUndo();
          currentData[section.id] = textarea.value;
          dirty = true;
          updateTitle();
          updatePreview();
          updateQuality();
        });
        container.appendChild(textarea);
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Wizard mode
  // -----------------------------------------------------------------------
  function renderWizard() {
    if (!currentTemplate) {
      wizardStepContainer.innerHTML = '<p style="color:var(--sz-color-gray-text);font-style:italic;">Select a template to begin.</p>';
      return;
    }

    const sections = currentTemplate.sections;
    const totalSteps = sections.length + 1; // +1 for template selector

    // Progress dots
    wizardProgress.innerHTML = '';
    for (let i = 0; i < totalSteps; ++i) {
      const dot = document.createElement('span');
      dot.className = 'wizard-dot';
      if (i < wizardStep) dot.classList.add('completed');
      if (i === wizardStep) dot.classList.add('current');
      wizardProgress.appendChild(dot);
    }
    const stepLabel = document.createElement('span');
    stepLabel.className = 'wizard-step-label';
    stepLabel.textContent = 'Step ' + (wizardStep + 1) + ' of ' + totalSteps;
    wizardProgress.appendChild(stepLabel);

    // Step content
    wizardStepContainer.innerHTML = '';

    if (wizardStep === 0) {
      // Template selector
      const title = document.createElement('div');
      title.className = 'wizard-step-title';
      title.textContent = 'Choose a Template';
      wizardStepContainer.appendChild(title);

      const help = document.createElement('div');
      help.className = 'wizard-step-help';
      help.textContent = 'Select a template that matches your project type.';
      wizardStepContainer.appendChild(help);

      const cards = document.createElement('div');
      cards.className = 'template-cards';
      for (const tpl of allTemplates) {
        const card = document.createElement('div');
        card.className = 'template-card';
        if (currentTemplate && tpl.id === currentTemplate.id)
          card.classList.add('selected');
        card.innerHTML =
          '<div class="template-card-name">' + escapeHtml(tpl.name) + '</div>' +
          '<div class="template-card-desc">' + escapeHtml(tpl.description) + '</div>' +
          '<div class="template-card-count">' + tpl.sections.length + ' sections</div>';
        card.addEventListener('click', () => {
          currentTemplate = tpl;
          templateSelect.value = tpl.id;
          rebuildTemplatesMenu();
          renderWizard();
          updatePreview();
          updateQuality();
        });
        cards.appendChild(card);
      }
      wizardStepContainer.appendChild(cards);

      // Nav buttons
      wizardBack.style.display = 'none';
      wizardSkip.style.display = 'none';
      wizardNext.style.display = '';
      wizardFinish.style.display = 'none';
    } else {
      const sectionIdx = wizardStep - 1;
      const section = sections[sectionIdx];

      const title = document.createElement('div');
      title.className = 'wizard-step-title';
      title.textContent = section.label;
      if (section.required) {
        const badge = document.createElement('span');
        badge.style.cssText = 'font-size:10px;color:var(--sz-color-gray-text);margin-left:6px;font-weight:normal;';
        badge.textContent = '(required)';
        title.appendChild(badge);
      }
      wizardStepContainer.appendChild(title);

      const editorDiv = document.createElement('div');
      renderFieldEditor(section, editorDiv);
      wizardStepContainer.appendChild(editorDiv);

      // Nav buttons
      wizardBack.style.display = '';
      wizardSkip.style.display = section.required ? 'none' : '';
      wizardNext.style.display = sectionIdx < sections.length - 1 ? '' : 'none';
      wizardFinish.style.display = sectionIdx === sections.length - 1 ? '' : 'none';
    }
  }

  wizardBack.addEventListener('click', () => {
    if (wizardStep > 0) {
      --wizardStep;
      renderWizard();
    }
  });

  wizardNext.addEventListener('click', () => {
    if (!currentTemplate) return;
    if (wizardStep < currentTemplate.sections.length) {
      ++wizardStep;
      renderWizard();
    }
  });

  wizardSkip.addEventListener('click', () => {
    if (!currentTemplate) return;
    if (wizardStep < currentTemplate.sections.length) {
      ++wizardStep;
      renderWizard();
    }
  });

  wizardFinish.addEventListener('click', () => {
    updatePreview();
    updateQuality();
  });

  // -----------------------------------------------------------------------
  // Form mode
  // -----------------------------------------------------------------------
  function renderForm() {
    formSections.innerHTML = '';
    if (!currentTemplate)
      return;

    for (const section of currentTemplate.sections) {
      const fieldset = document.createElement('div');
      fieldset.className = 'form-fieldset';

      const header = document.createElement('div');
      header.className = 'form-fieldset-header';
      header.innerHTML = '<span class="toggle-arrow">\u25BC</span> ' + escapeHtml(section.label);
      if (section.required) {
        const badge = document.createElement('span');
        badge.className = 'required-badge';
        badge.textContent = 'required';
        header.appendChild(badge);
      }
      header.addEventListener('click', () => {
        fieldset.classList.toggle('collapsed');
      });

      const body = document.createElement('div');
      body.className = 'form-fieldset-body';
      renderFieldEditor(section, body);

      fieldset.appendChild(header);
      fieldset.appendChild(body);
      formSections.appendChild(fieldset);
    }
  }

  // -----------------------------------------------------------------------
  // View switching
  // -----------------------------------------------------------------------
  function setViewMode(mode) {
    viewMode = mode;
    wizardPanel.style.display = mode === 'wizard' ? '' : 'none';
    formPanel.style.display = mode === 'form' ? '' : 'none';
    btnWizard.classList.toggle('active', mode === 'wizard');
    btnForm.classList.toggle('active', mode === 'form');
    document.getElementById('menu-view-wizard').classList.toggle('checked', mode === 'wizard');
    document.getElementById('menu-view-form').classList.toggle('checked', mode === 'form');

    if (mode === 'wizard')
      renderWizard();
    else
      renderForm();
  }

  function togglePreview() {
    showPreview = !showPreview;
    previewPanel.classList.toggle('hidden', !showPreview);
    splitter.style.display = showPreview ? '' : 'none';
    document.getElementById('menu-toggle-preview').classList.toggle('checked', showPreview);
    if (showPreview)
      updatePreview();
  }

  function toggleQuality() {
    showQuality = !showQuality;
    statusBar.classList.toggle('hidden', !showQuality);
    document.getElementById('menu-toggle-quality').classList.toggle('checked', showQuality);
  }

  function refreshCurrentView() {
    if (viewMode === 'wizard')
      renderWizard();
    else
      renderForm();
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function doNew() {
    pushUndo();
    currentData = {};
    currentFilePath = null;
    currentFileName = 'README.md';
    dirty = false;
    wizardStep = 0;
    savedData = {};
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateQuality();
  }

  async function doOpen() {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Markdown Files', ext: ['md', 'markdown'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open README',
    });
    if (!result.cancelled && result.path)
      loadFile(result.path, result.content);
  }

  async function loadFile(path, content) {
    let text = '';
    if (typeof content === 'string')
      text = content;
    else if (content == null) {
      try {
        text = await SZ.Dlls.Kernel32.ReadFile(path);
        if (text == null) text = '';
      } catch (err) {
        await SZ.Dlls.User32.MessageBox('Could not open file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
        return;
      }
    }

    importMarkdown(text);
    currentFilePath = path;
    const parts = path.split('/');
    currentFileName = parts[parts.length - 1] || 'README.md';
    dirty = false;
    savedData = deepClone(currentData);
    updateTitle();
  }

  function importMarkdown(text) {
    if (!currentTemplate)
      currentTemplate = allTemplates[0];

    pushUndo();
    currentData = SZ.ReadmeParser.parseMarkdown(text, currentTemplate.sections);
    wizardStep = 1;
    refreshCurrentView();
    updatePreview();
    updateQuality();
  }

  async function doImport() {
    const result = await SZ.Dlls.ComDlg32.ImportFile({ accept: '.md,.markdown,.txt', readAs: 'text' });
    if (!result.cancelled && result.data) {
      importMarkdown(result.data);
      currentFilePath = null;
      currentFileName = result.name || 'README.md';
      dirty = true;
      updateTitle();
    }
  }

  function doPasteReadme() {
    const textarea = document.getElementById('paste-textarea');
    textarea.value = '';
    SZ.Dialog.show('dlg-paste');
    textarea.focus();
  }

  function doSave() {
    if (!currentFilePath) {
      doSaveAs();
      return;
    }
    saveToPath(currentFilePath);
  }

  async function doSaveAs() {
    const md = generateMarkdown();
    const result = await SZ.Dlls.ComDlg32.GetSaveFileName({
      filters: [
        { name: 'Markdown Files', ext: ['md', 'markdown'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      defaultName: currentFileName || 'README.md',
      title: 'Save As',
      content: md,
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'README.md';
      await saveToPath(result.path);
    }
  }

  async function saveToPath(path) {
    try {
      const md = generateMarkdown();
      await SZ.Dlls.Kernel32.WriteFile(path, md);
      dirty = false;
      savedData = deepClone(currentData);
      updateTitle();
    } catch (err) {
      await SZ.Dlls.User32.MessageBox('Could not save file: ' + err.message, 'Error', MB_OK | MB_ICONERROR);
    }
  }

  function doExport() {
    const md = generateMarkdown();
    SZ.Dlls.ComDlg32.ExportFile(md, currentFileName || 'README.md', 'text/markdown');
  }

  function doCopyMarkdown(e) {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      if (e)
        showCopyTooltip(e.clientX || 100, e.clientY || 100);
    }).catch(() => {});
  }

  function doClearAll() {
    pushUndo();
    currentData = {};
    dirty = true;
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateQuality();
  }

  // -----------------------------------------------------------------------
  // Paste dialog
  // -----------------------------------------------------------------------
  document.getElementById('paste-ok').addEventListener('click', () => {
    const text = document.getElementById('paste-textarea').value;
    SZ.Dialog.close('dlg-paste');
    if (text.trim()) {
      importMarkdown(text);
      currentFilePath = null;
      dirty = true;
      updateTitle();
    }
  });

  document.getElementById('paste-cancel').addEventListener('click', () => {
    SZ.Dialog.close('dlg-paste');
  });

  // -----------------------------------------------------------------------
  // Template editor dialog
  // -----------------------------------------------------------------------
  let editingTemplate = null;
  const SECTION_TYPES = ['text', 'textarea', 'codeblock', 'list', 'checklist', 'table', 'tags', 'license', 'author', 'badges', 'images'];

  function openTemplateEditor() {
    const dlg = document.getElementById('dlg-template-editor');
    const select = document.getElementById('tpl-editor-select');

    select.innerHTML = '';
    for (const tpl of allTemplates) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name + (tpl.builtin ? ' (built-in)' : '');
      select.appendChild(opt);
    }

    editingTemplate = deepClone(allTemplates[0]);
    renderTemplateEditorFields();
    SZ.Dialog.show('dlg-template-editor');
  }

  function renderTemplateEditorFields() {
    if (!editingTemplate) return;
    document.getElementById('tpl-editor-name').value = editingTemplate.name || '';
    document.getElementById('tpl-editor-name').disabled = !!editingTemplate.builtin;
    document.getElementById('tpl-editor-desc').value = editingTemplate.description || '';
    document.getElementById('tpl-editor-desc').disabled = !!editingTemplate.builtin;
    document.getElementById('tpl-editor-del').disabled = !!editingTemplate.builtin;
    document.getElementById('tpl-editor-save').disabled = !!editingTemplate.builtin;

    const list = document.getElementById('tpl-sections-list');
    list.innerHTML = '';

    for (let i = 0; i < editingTemplate.sections.length; ++i) {
      const s = editingTemplate.sections[i];
      const row = document.createElement('div');
      row.className = 'tpl-section-row';

      const handle = document.createElement('span');
      handle.className = 'drag-handle';
      handle.textContent = '\u2630';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.value = s.label;
      labelInput.disabled = !!editingTemplate.builtin;

      const typeSelect = document.createElement('select');
      for (const t of SECTION_TYPES) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
      }
      typeSelect.value = s.type;
      typeSelect.disabled = !!editingTemplate.builtin;

      const reqLabel = document.createElement('label');
      const reqCb = document.createElement('input');
      reqCb.type = 'checkbox';
      reqCb.checked = s.required;
      reqCb.disabled = !!editingTemplate.builtin;
      reqLabel.appendChild(reqCb);
      reqLabel.appendChild(document.createTextNode(' Req'));

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u2716';
      removeBtn.disabled = !!editingTemplate.builtin;

      const idx = i;
      labelInput.addEventListener('input', () => { editingTemplate.sections[idx].label = labelInput.value; });
      typeSelect.addEventListener('change', () => { editingTemplate.sections[idx].type = typeSelect.value; });
      reqCb.addEventListener('change', () => { editingTemplate.sections[idx].required = reqCb.checked; });
      removeBtn.addEventListener('click', () => {
        editingTemplate.sections.splice(idx, 1);
        renderTemplateEditorFields();
      });

      row.appendChild(handle);
      row.appendChild(labelInput);
      row.appendChild(typeSelect);
      row.appendChild(reqLabel);
      row.appendChild(removeBtn);
      list.appendChild(row);
    }
  }

  document.getElementById('tpl-editor-select').addEventListener('change', () => {
    const id = document.getElementById('tpl-editor-select').value;
    const tpl = allTemplates.find(t => t.id === id);
    if (tpl) {
      editingTemplate = deepClone(tpl);
      renderTemplateEditorFields();
    }
  });

  document.getElementById('tpl-editor-dup').addEventListener('click', () => {
    if (!editingTemplate) return;
    const dup = deepClone(editingTemplate);
    dup.id = 'custom-' + Date.now();
    dup.name = editingTemplate.name + ' (Copy)';
    dup.builtin = false;
    customTemplates.push(dup);
    saveCustomTemplates();
    rebuildTemplateList();
    editingTemplate = dup;

    const select = document.getElementById('tpl-editor-select');
    const opt = document.createElement('option');
    opt.value = dup.id;
    opt.textContent = dup.name;
    select.appendChild(opt);
    select.value = dup.id;
    renderTemplateEditorFields();
  });

  document.getElementById('tpl-editor-del').addEventListener('click', () => {
    if (!editingTemplate || editingTemplate.builtin) return;
    const idx = customTemplates.findIndex(t => t.id === editingTemplate.id);
    if (idx >= 0) {
      customTemplates.splice(idx, 1);
      saveCustomTemplates();
      rebuildTemplateList();
      editingTemplate = deepClone(allTemplates[0]);
      document.getElementById('tpl-editor-select').value = allTemplates[0].id;
      renderTemplateEditorFields();
    }
  });

  document.getElementById('tpl-add-section').addEventListener('click', () => {
    if (!editingTemplate || editingTemplate.builtin) return;
    editingTemplate.sections.push({
      id: 'custom-' + Date.now(),
      label: 'New Section',
      required: false,
      type: 'textarea'
    });
    renderTemplateEditorFields();
  });

  document.getElementById('tpl-editor-name').addEventListener('input', (e) => {
    if (editingTemplate && !editingTemplate.builtin)
      editingTemplate.name = e.target.value;
  });

  document.getElementById('tpl-editor-desc').addEventListener('input', (e) => {
    if (editingTemplate && !editingTemplate.builtin)
      editingTemplate.description = e.target.value;
  });

  document.getElementById('tpl-editor-save').addEventListener('click', () => {
    if (!editingTemplate || editingTemplate.builtin) return;
    const idx = customTemplates.findIndex(t => t.id === editingTemplate.id);
    if (idx >= 0) {
      customTemplates[idx] = deepClone(editingTemplate);
    } else {
      customTemplates.push(deepClone(editingTemplate));
    }
    saveCustomTemplates();
    rebuildTemplateList();
  });

  document.getElementById('tpl-editor-close').addEventListener('click', () => {
    SZ.Dialog.close('dlg-template-editor');
  });

  // -----------------------------------------------------------------------
  // About dialog
  // -----------------------------------------------------------------------
  function showAbout() {
    SZ.Dialog.show('dlg-about');
    document.getElementById('about-ok').focus();
  }

  SZ.Dialog.wireAll();

  // -----------------------------------------------------------------------
  // Splitter drag
  // -----------------------------------------------------------------------
  let splitting = false;

  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitting = true;
    splitter.setPointerCapture(e.pointerId);
  });

  splitter.addEventListener('pointermove', (e) => {
    if (!splitting) return;
    const rect = mainSplit.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    const clamped = Math.max(20, Math.min(80, pct));
    editorPanel.style.flex = 'none';
    editorPanel.style.width = clamped + '%';
  });

  splitter.addEventListener('pointerup', () => { splitting = false; });
  splitter.addEventListener('lostpointercapture', () => { splitting = false; });

  // -----------------------------------------------------------------------
  // Action dispatcher
  // -----------------------------------------------------------------------
  function handleAction(action) {
    if (action && action.startsWith('select-template:')) {
      selectTemplate(action.slice('select-template:'.length));
      return;
    }
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'import': doImport(); break;
      case 'paste-readme': doPasteReadme(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'export': doExport(); break;
      case 'exit': SZ.Dlls.User32.DestroyWindow(); break;
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'copy-markdown': doCopyMarkdown(); break;
      case 'clear-all': doClearAll(); break;
      case 'view-wizard': setViewMode('wizard'); break;
      case 'view-form': setViewMode('form'); break;
      case 'toggle-preview': togglePreview(); break;
      case 'toggle-quality': toggleQuality(); break;
      case 'edit-templates': openTemplateEditor(); break;
      case 'apply-template': applyDifferentTemplate(); break;
      case 'about': showAbout(); break;
    }
  }

  new SZ.MenuBar({ onAction: handleAction });

  // Toolbar buttons
  for (const btn of document.querySelectorAll('.toolbar button[data-action]'))
    btn.addEventListener('click', () => handleAction(btn.dataset.action));

  // Template select change
  templateSelect.addEventListener('change', () => {
    selectTemplate(templateSelect.value);
  });

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey) return;

    if (e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      doCopyMarkdown(e);
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'n': e.preventDefault(); doNew(); break;
      case 'o': e.preventDefault(); doOpen(); break;
      case 's': e.preventDefault(); doSave(); break;
      case 'z': e.preventDefault(); doUndo(); break;
      case 'y': e.preventDefault(); doRedo(); break;
    }
  });

  // -----------------------------------------------------------------------
  // Drag and drop
  // -----------------------------------------------------------------------
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      importMarkdown(reader.result);
      currentFilePath = null;
      currentFileName = file.name;
      dirty = true;
      updateTitle();
    };
    reader.readAsText(file);
  });

  // -----------------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------------
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    loadCustomTemplates();
    rebuildTemplateList();

    currentTemplate = allTemplates[0];
    templateSelect.value = currentTemplate.id;

    // Check for file path on command line
    const cmd = SZ.Dlls.Kernel32.GetCommandLine();
    if (cmd.path)
      loadFile(cmd.path, null);
    else {
      wizardStep = 0;
      renderWizard();
    }

    updateTitle();
    updatePreview();
    updateQuality();
  }

  init();
})();
