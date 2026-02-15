;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------
  const SZ = window.SZ || (window.SZ = {});
  const STORAGE_KEY = 'sz-resume-templates';
  const PROFICIENCY_LEVELS = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'];
  const SECTION_TYPES = [
    'text', 'textarea', 'list', 'tags',
    'personal-info', 'experience-list', 'education-list',
    'skills-grouped', 'certifications-list', 'projects-list',
    'languages-list', 'references-list'
  ];
  const MB_OK = 0;
  const MB_OKCANCEL = 1;
  const MB_ICONERROR = 0x10;
  const MB_ICONQUESTION = 0x20;

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let allTemplates = [];
  let customTemplates = [];
  let currentTemplate = null;
  let currentData = {};
  let savedData = {};
  let dirty = false;
  let currentFilePath = null;
  let currentFileName = 'Resume.md';

  let viewMode = 'wizard';
  let showPreview = true;
  let showCompleteness = true;
  let wizardStep = 0;

  let undoStack = [];
  let redoStack = [];
  const MAX_UNDO = 50;

  let openMenu = null;

  // -----------------------------------------------------------------------
  // DOM references
  // -----------------------------------------------------------------------
  const menuBar = document.getElementById('menu-bar');
  const templateSelect = document.getElementById('template-select');
  const exportFormat = document.getElementById('export-format');
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
  const statusCompleteness = document.getElementById('status-completeness');
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
    const title = prefix + currentFileName + ' - Resume Builder';
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
    if (undoStack.length === 0) return;
    redoStack.push(deepClone(currentData));
    currentData = undoStack.pop();
    dirty = true;
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateCompleteness();
  }

  function doRedo() {
    if (redoStack.length === 0) return;
    undoStack.push(deepClone(currentData));
    currentData = redoStack.pop();
    dirty = true;
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateCompleteness();
  }

  // -----------------------------------------------------------------------
  // Template management
  // -----------------------------------------------------------------------
  function loadCustomTemplates() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) customTemplates = JSON.parse(stored);
    } catch (_) {
      customTemplates = [];
    }
  }

  function saveCustomTemplates() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
  }

  function rebuildTemplateList() {
    allTemplates = (SZ.ResumeTemplates || []).concat(customTemplates);

    templateSelect.innerHTML = '';
    for (const tpl of allTemplates) {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      if (currentTemplate && tpl.id === currentTemplate.id)
        opt.selected = true;
      templateSelect.appendChild(opt);
    }

    rebuildTemplatesMenu();
  }

  function rebuildTemplatesMenu() {
    const menu = document.getElementById('templates-menu');
    menu.innerHTML = '';

    for (const tpl of allTemplates) {
      const entry = document.createElement('div');
      entry.className = 'menu-entry radio' + (currentTemplate && tpl.id === currentTemplate.id ? ' checked' : '');
      entry.dataset.action = 'select-template';
      entry.dataset.templateId = tpl.id;
      entry.textContent = tpl.name;
      menu.appendChild(entry);
    }

    const sep = document.createElement('div');
    sep.className = 'menu-separator';
    menu.appendChild(sep);

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
    if (!tpl) return;

    pushUndo();
    currentTemplate = tpl;
    templateSelect.value = id;
    wizardStep = 0;

    rebuildTemplatesMenu();
    refreshCurrentView();
    updatePreview();
    updateCompleteness();
    dirty = true;
    updateTitle();
  }

  function applyDifferentTemplate() {
    wizardStep = 0;
    refreshCurrentView();
  }

  // -----------------------------------------------------------------------
  // Markdown generation
  // -----------------------------------------------------------------------
  function generateMarkdown() {
    if (!currentTemplate) return '';
    const lines = [];

    for (const section of currentTemplate.sections) {
      const val = currentData[section.id];

      if (section.type === 'personal-info') {
        if (!val) continue;
        if (val.name) lines.push('# ' + val.name);
        if (val.title) lines.push('**' + val.title + '**');
        lines.push('');
        if (val.email) lines.push('- Email: ' + val.email);
        if (val.phone) lines.push('- Phone: ' + val.phone);
        if (val.location) lines.push('- Location: ' + val.location);
        if (val.website) lines.push('- Website: ' + val.website);
        if (val.linkedin) lines.push('- LinkedIn: ' + val.linkedin);
        if (val.github) lines.push('- GitHub: ' + val.github);
        lines.push('');
        continue;
      }

      if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim()))
        continue;

      lines.push('## ' + section.label, '');

      switch (section.type) {
        case 'text':
        case 'textarea':
          lines.push(val, '');
          break;

        case 'experience-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.title) lines.push('### ' + entry.title);
              if (entry.company) lines.push('- Company: ' + entry.company);
              if (entry.location) lines.push('- Location: ' + entry.location);
              if (entry.startDate || entry.endDate) {
                const end = entry.current ? 'Present' : (entry.endDate || '');
                lines.push('- Dates: ' + (entry.startDate || '') + ' - ' + end);
              }
              if (entry.bullets && entry.bullets.length > 0) {
                lines.push('');
                for (const b of entry.bullets)
                  if (b) lines.push('- ' + b);
              }
              lines.push('');
            }
          break;

        case 'education-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.institution) lines.push('### ' + entry.institution);
              if (entry.degree) lines.push('- Degree: ' + entry.degree);
              if (entry.field) lines.push('- Field of Study: ' + entry.field);
              if (entry.startDate || entry.endDate)
                lines.push('- Dates: ' + (entry.startDate || '') + ' - ' + (entry.endDate || 'Present'));
              if (entry.gpa) lines.push('- GPA: ' + entry.gpa);
              if (entry.honors) lines.push('- Honors: ' + entry.honors);
              lines.push('');
            }
          break;

        case 'skills-grouped':
          if (Array.isArray(val))
            for (const group of val)
              if (group.category || group.skills)
                lines.push('- **' + (group.category || 'General') + ':** ' + (group.skills || ''));
          lines.push('');
          break;

        case 'certifications-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) lines.push('### ' + entry.name);
              if (entry.issuer) lines.push('- Issuer: ' + entry.issuer);
              if (entry.date) lines.push('- Date: ' + entry.date);
              if (entry.credentialId) lines.push('- Credential ID: ' + entry.credentialId);
              if (entry.credentialUrl) lines.push('- URL: ' + entry.credentialUrl);
              lines.push('');
            }
          break;

        case 'projects-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) lines.push('### ' + entry.name);
              if (entry.description) lines.push(entry.description);
              if (entry.technologies) lines.push('- Technologies: ' + entry.technologies);
              if (entry.url) lines.push('- URL: ' + entry.url);
              lines.push('');
            }
          break;

        case 'languages-list':
          if (Array.isArray(val))
            for (const entry of val)
              if (entry.language) lines.push('- ' + entry.language + ': ' + (entry.proficiency || 'Professional'));
          lines.push('');
          break;

        case 'references-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) lines.push('### ' + entry.name);
              if (entry.title) lines.push('- Title: ' + entry.title);
              if (entry.company) lines.push('- Company: ' + entry.company);
              if (entry.email) lines.push('- Email: ' + entry.email);
              if (entry.phone) lines.push('- Phone: ' + entry.phone);
              lines.push('');
            }
          break;

        case 'list':
          if (Array.isArray(val))
            for (const item of val)
              if (item) lines.push('- ' + item);
          lines.push('');
          break;

        case 'tags':
          if (Array.isArray(val) && val.length > 0)
            lines.push(val.join(', '), '');
          break;

        default:
          if (typeof val === 'string') lines.push(val, '');
          break;
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // -----------------------------------------------------------------------
  // Plain text generation
  // -----------------------------------------------------------------------
  function generatePlainText() {
    if (!currentTemplate) return '';
    const lines = [];

    for (const section of currentTemplate.sections) {
      const val = currentData[section.id];

      if (section.type === 'personal-info') {
        if (!val) continue;
        if (val.name) lines.push(val.name.toUpperCase(), '='.repeat(val.name.length));
        if (val.title) lines.push(val.title);
        lines.push('');
        if (val.email) lines.push('  Email:    ' + val.email);
        if (val.phone) lines.push('  Phone:    ' + val.phone);
        if (val.location) lines.push('  Location: ' + val.location);
        if (val.website) lines.push('  Website:  ' + val.website);
        if (val.linkedin) lines.push('  LinkedIn: ' + val.linkedin);
        if (val.github) lines.push('  GitHub:   ' + val.github);
        lines.push('');
        continue;
      }

      if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim()))
        continue;

      const heading = section.label.toUpperCase();
      lines.push(heading, '-'.repeat(heading.length), '');

      switch (section.type) {
        case 'text':
        case 'textarea':
          lines.push(val, '');
          break;

        case 'experience-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.title) lines.push(entry.title);
              if (entry.company) lines.push('  Company:  ' + entry.company);
              if (entry.location) lines.push('  Location: ' + entry.location);
              if (entry.startDate || entry.endDate) {
                const end = entry.current ? 'Present' : (entry.endDate || '');
                lines.push('  Dates:    ' + (entry.startDate || '') + ' - ' + end);
              }
              if (entry.bullets)
                for (const b of entry.bullets)
                  if (b) lines.push('  * ' + b);
              lines.push('');
            }
          break;

        case 'education-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.institution) lines.push(entry.institution);
              if (entry.degree) lines.push('  Degree:         ' + entry.degree);
              if (entry.field) lines.push('  Field of Study: ' + entry.field);
              if (entry.startDate || entry.endDate) lines.push('  Dates:          ' + (entry.startDate || '') + ' - ' + (entry.endDate || 'Present'));
              if (entry.gpa) lines.push('  GPA:            ' + entry.gpa);
              if (entry.honors) lines.push('  Honors:         ' + entry.honors);
              lines.push('');
            }
          break;

        case 'skills-grouped':
          if (Array.isArray(val))
            for (const group of val)
              if (group.category || group.skills)
                lines.push('  ' + (group.category || 'General') + ': ' + (group.skills || ''));
          lines.push('');
          break;

        case 'certifications-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) lines.push(entry.name);
              if (entry.issuer) lines.push('  Issuer:        ' + entry.issuer);
              if (entry.date) lines.push('  Date:          ' + entry.date);
              if (entry.credentialId) lines.push('  Credential ID: ' + entry.credentialId);
              if (entry.credentialUrl) lines.push('  URL:           ' + entry.credentialUrl);
              lines.push('');
            }
          break;

        case 'projects-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) lines.push(entry.name);
              if (entry.description) lines.push('  ' + entry.description);
              if (entry.technologies) lines.push('  Technologies: ' + entry.technologies);
              if (entry.url) lines.push('  URL:          ' + entry.url);
              lines.push('');
            }
          break;

        case 'languages-list':
          if (Array.isArray(val))
            for (const entry of val)
              if (entry.language) lines.push('  ' + entry.language + ': ' + (entry.proficiency || 'Professional'));
          lines.push('');
          break;

        case 'references-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) lines.push(entry.name);
              if (entry.title) lines.push('  Title:   ' + entry.title);
              if (entry.company) lines.push('  Company: ' + entry.company);
              if (entry.email) lines.push('  Email:   ' + entry.email);
              if (entry.phone) lines.push('  Phone:   ' + entry.phone);
              lines.push('');
            }
          break;

        case 'list':
          if (Array.isArray(val))
            for (const item of val)
              if (item) lines.push('  * ' + item);
          lines.push('');
          break;

        case 'tags':
          if (Array.isArray(val) && val.length > 0)
            lines.push('  ' + val.join(', '), '');
          break;

        default:
          if (typeof val === 'string') lines.push(val, '');
          break;
      }
    }

    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // -----------------------------------------------------------------------
  // DOCX (Flat OPC XML) generation
  // -----------------------------------------------------------------------
  function generateDocx() {
    if (!currentTemplate) return '';
    const parts = [];

    parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    parts.push('<?mso-application progid="Word.Document"?>');
    parts.push('<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml" xmlns:wx="http://schemas.microsoft.com/office/word/2003/auxHint">');
    parts.push('<w:body>');

    function p(text, style) {
      const escaped = escapeHtml(text);
      if (style)
        return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/></w:pPr><w:r><w:t>' + escaped + '</w:t></w:r></w:p>';
      return '<w:p><w:r><w:t>' + escaped + '</w:t></w:r></w:p>';
    }

    function pBold(text) {
      return '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>' + escapeHtml(text) + '</w:t></w:r></w:p>';
    }

    function bullet(text) {
      return '<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>' + escapeHtml(text) + '</w:t></w:r></w:p>';
    }

    for (const section of currentTemplate.sections) {
      const val = currentData[section.id];

      if (section.type === 'personal-info') {
        if (!val) continue;
        if (val.name) parts.push(p(val.name, 'Heading1'));
        if (val.title) parts.push(pBold(val.title));
        if (val.email) parts.push(p('Email: ' + val.email));
        if (val.phone) parts.push(p('Phone: ' + val.phone));
        if (val.location) parts.push(p('Location: ' + val.location));
        if (val.website) parts.push(p('Website: ' + val.website));
        if (val.linkedin) parts.push(p('LinkedIn: ' + val.linkedin));
        if (val.github) parts.push(p('GitHub: ' + val.github));
        continue;
      }

      if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim()))
        continue;

      parts.push(p(section.label, 'Heading2'));

      switch (section.type) {
        case 'text':
        case 'textarea':
          parts.push(p(val));
          break;

        case 'experience-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.title) parts.push(p(entry.title, 'Heading3'));
              if (entry.company) parts.push(p('Company: ' + entry.company));
              if (entry.location) parts.push(p('Location: ' + entry.location));
              if (entry.startDate || entry.endDate) {
                const end = entry.current ? 'Present' : (entry.endDate || '');
                parts.push(p('Dates: ' + (entry.startDate || '') + ' - ' + end));
              }
              if (entry.bullets)
                for (const b of entry.bullets)
                  if (b) parts.push(bullet(b));
            }
          break;

        case 'education-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.institution) parts.push(p(entry.institution, 'Heading3'));
              if (entry.degree) parts.push(p('Degree: ' + entry.degree));
              if (entry.field) parts.push(p('Field of Study: ' + entry.field));
              if (entry.startDate || entry.endDate) parts.push(p('Dates: ' + (entry.startDate || '') + ' - ' + (entry.endDate || 'Present')));
              if (entry.gpa) parts.push(p('GPA: ' + entry.gpa));
              if (entry.honors) parts.push(p('Honors: ' + entry.honors));
            }
          break;

        case 'skills-grouped':
          if (Array.isArray(val))
            for (const group of val)
              if (group.category || group.skills)
                parts.push(bullet((group.category || 'General') + ': ' + (group.skills || '')));
          break;

        case 'certifications-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) parts.push(p(entry.name, 'Heading3'));
              if (entry.issuer) parts.push(p('Issuer: ' + entry.issuer));
              if (entry.date) parts.push(p('Date: ' + entry.date));
              if (entry.credentialId) parts.push(p('Credential ID: ' + entry.credentialId));
              if (entry.credentialUrl) parts.push(p('URL: ' + entry.credentialUrl));
            }
          break;

        case 'projects-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) parts.push(p(entry.name, 'Heading3'));
              if (entry.description) parts.push(p(entry.description));
              if (entry.technologies) parts.push(p('Technologies: ' + entry.technologies));
              if (entry.url) parts.push(p('URL: ' + entry.url));
            }
          break;

        case 'languages-list':
          if (Array.isArray(val))
            for (const entry of val)
              if (entry.language) parts.push(bullet(entry.language + ': ' + (entry.proficiency || 'Professional')));
          break;

        case 'references-list':
          if (Array.isArray(val))
            for (const entry of val) {
              if (entry.name) parts.push(p(entry.name, 'Heading3'));
              if (entry.title) parts.push(p('Title: ' + entry.title));
              if (entry.company) parts.push(p('Company: ' + entry.company));
              if (entry.email) parts.push(p('Email: ' + entry.email));
              if (entry.phone) parts.push(p('Phone: ' + entry.phone));
            }
          break;

        case 'list':
          if (Array.isArray(val))
            for (const item of val)
              if (item) parts.push(bullet(item));
          break;

        case 'tags':
          if (Array.isArray(val) && val.length > 0)
            parts.push(p(val.join(', ')));
          break;

        default:
          if (typeof val === 'string') parts.push(p(val));
          break;
      }
    }

    parts.push('</w:body>');
    parts.push('</w:wordDocument>');
    return parts.join('\n');
  }

  // -----------------------------------------------------------------------
  // Preview rendering
  // -----------------------------------------------------------------------
  function renderPreviewHtml() {
    if (!currentTemplate) return '';
    const layout = currentTemplate.previewLayout || 'single-column';
    const data = currentData;
    const parts = [];
    const sidebarIds = ['skills', 'languages', 'certifications'];

    parts.push('<div class="resume-preview ' + layout + '">');

    // Header (personal info)
    const pi = data.personalInfo || {};
    parts.push('<div class="resume-header">');
    if (pi.name) parts.push('<h1>' + escapeHtml(pi.name) + '</h1>');
    if (pi.title) parts.push('<p style="font-size:13px;margin-bottom:4px;"><strong>' + escapeHtml(pi.title) + '</strong></p>');
    const contactItems = [];
    if (pi.email) contactItems.push('<a href="mailto:' + escapeHtml(pi.email) + '">' + escapeHtml(pi.email) + '</a>');
    if (pi.phone) contactItems.push(escapeHtml(pi.phone));
    if (pi.location) contactItems.push(escapeHtml(pi.location));
    if (pi.website) contactItems.push('<a href="' + escapeHtml(pi.website) + '">' + escapeHtml(pi.website) + '</a>');
    if (pi.linkedin) contactItems.push('<a href="' + escapeHtml(pi.linkedin) + '">LinkedIn</a>');
    if (pi.github) contactItems.push('<a href="' + escapeHtml(pi.github) + '">GitHub</a>');
    if (contactItems.length > 0) parts.push('<p class="contact-line">' + contactItems.join(' &bull; ') + '</p>');
    parts.push('</div>');

    if (layout === 'sidebar-left') {
      const sidebarSections = currentTemplate.sections.filter(s => sidebarIds.includes(s.id) && data[s.id]);
      const mainSections = currentTemplate.sections.filter(s => s.type !== 'personal-info' && !sidebarIds.includes(s.id));

      parts.push('<div class="resume-sidebar">');
      for (const section of sidebarSections)
        parts.push(renderSectionPreview(section, data[section.id]));
      parts.push('</div>');

      parts.push('<div class="resume-main">');
      for (const section of mainSections)
        if (data[section.id]) parts.push(renderSectionPreview(section, data[section.id]));
      parts.push('</div>');
    } else {
      for (const section of currentTemplate.sections) {
        if (section.type === 'personal-info') continue;
        const val = data[section.id];
        if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim()))
          continue;
        parts.push(renderSectionPreview(section, val));
      }
    }

    parts.push('</div>');
    return parts.join('\n');
  }

  function renderSectionPreview(section, val) {
    const parts = [];
    parts.push('<h2>' + escapeHtml(section.label) + '</h2>');
    parts.push('<hr class="section-divider">');

    switch (section.type) {
      case 'text':
      case 'textarea':
        parts.push('<p>' + escapeHtml(val).replace(/\n/g, '<br>') + '</p>');
        break;

      case 'experience-list':
        if (Array.isArray(val))
          for (const entry of val) {
            parts.push('<div class="entry-header">');
            const title = [entry.title, entry.company].filter(Boolean).join(', ');
            if (title) parts.push('<h3>' + escapeHtml(title) + '</h3>');
            if (entry.startDate || entry.endDate) {
              const end = entry.current ? 'Present' : (entry.endDate || '');
              parts.push('<span class="dates">' + escapeHtml(entry.startDate || '') + ' - ' + escapeHtml(end) + '</span>');
            }
            parts.push('</div>');
            if (entry.location) parts.push('<p class="entry-sub">' + escapeHtml(entry.location) + '</p>');
            if (entry.bullets && entry.bullets.some(Boolean)) {
              parts.push('<ul>');
              for (const b of entry.bullets)
                if (b) parts.push('<li>' + escapeHtml(b) + '</li>');
              parts.push('</ul>');
            }
          }
        break;

      case 'education-list':
        if (Array.isArray(val))
          for (const entry of val) {
            parts.push('<div class="entry-header">');
            const title = [entry.degree, entry.institution].filter(Boolean).join(', ');
            if (title) parts.push('<h3>' + escapeHtml(title) + '</h3>');
            if (entry.startDate || entry.endDate)
              parts.push('<span class="dates">' + escapeHtml(entry.startDate || '') + ' - ' + escapeHtml(entry.endDate || 'Present') + '</span>');
            parts.push('</div>');
            if (entry.field) parts.push('<p class="entry-sub">' + escapeHtml(entry.field) + '</p>');
            if (entry.gpa) parts.push('<p class="entry-sub">GPA: ' + escapeHtml(entry.gpa) + '</p>');
            if (entry.honors) parts.push('<p class="entry-sub">' + escapeHtml(entry.honors) + '</p>');
          }
        break;

      case 'skills-grouped':
        if (Array.isArray(val))
          for (const group of val) {
            if (!group.category && !group.skills) continue;
            parts.push('<div class="skills-group"><strong>' + escapeHtml(group.category || 'General') + ':</strong> <span>' + escapeHtml(group.skills || '') + '</span></div>');
          }
        break;

      case 'certifications-list':
        if (Array.isArray(val))
          for (const entry of val) {
            if (!entry.name) continue;
            parts.push('<div class="entry-header"><h3>' + escapeHtml(entry.name) + '</h3>');
            if (entry.date) parts.push('<span class="dates">' + escapeHtml(entry.date) + '</span>');
            parts.push('</div>');
            if (entry.issuer) parts.push('<p class="entry-sub">' + escapeHtml(entry.issuer) + '</p>');
          }
        break;

      case 'projects-list':
        if (Array.isArray(val))
          for (const entry of val) {
            if (!entry.name) continue;
            parts.push('<h3>' + escapeHtml(entry.name) + '</h3>');
            if (entry.description) parts.push('<p>' + escapeHtml(entry.description) + '</p>');
            if (entry.technologies) parts.push('<p class="entry-sub">Technologies: ' + escapeHtml(entry.technologies) + '</p>');
            if (entry.url) parts.push('<p class="entry-sub"><a href="' + escapeHtml(entry.url) + '">' + escapeHtml(entry.url) + '</a></p>');
          }
        break;

      case 'languages-list':
        if (Array.isArray(val)) {
          parts.push('<ul>');
          for (const entry of val)
            if (entry.language) parts.push('<li>' + escapeHtml(entry.language) + ' - ' + escapeHtml(entry.proficiency || 'Professional') + '</li>');
          parts.push('</ul>');
        }
        break;

      case 'references-list':
        if (Array.isArray(val))
          for (const entry of val) {
            if (!entry.name) continue;
            parts.push('<h3>' + escapeHtml(entry.name) + '</h3>');
            const meta = [entry.title, entry.company].filter(Boolean);
            if (meta.length > 0) parts.push('<p class="entry-sub">' + escapeHtml(meta.join(', ')) + '</p>');
            if (entry.email) parts.push('<p class="entry-sub">' + escapeHtml(entry.email) + '</p>');
          }
        break;

      case 'list':
        if (Array.isArray(val) && val.some(Boolean)) {
          parts.push('<ul>');
          for (const item of val)
            if (item) parts.push('<li>' + escapeHtml(item) + '</li>');
          parts.push('</ul>');
        }
        break;

      case 'tags':
        if (Array.isArray(val) && val.length > 0) {
          const layout = currentTemplate.previewLayout;
          if (layout === 'accent-bar')
            parts.push('<p>' + val.map(t => '<span class="skill-tag">' + escapeHtml(t) + '</span>').join(' ') + '</p>');
          else
            parts.push('<p>' + val.map(t => escapeHtml(t)).join(', ') + '</p>');
        }
        break;

      default:
        if (typeof val === 'string')
          parts.push('<p>' + escapeHtml(val).replace(/\n/g, '<br>') + '</p>');
        break;
    }

    return parts.join('\n');
  }

  function updatePreview() {
    if (!showPreview) return;
    previewContent.innerHTML = renderPreviewHtml();
    const md = generateMarkdown();
    statusLines.textContent = 'Ln ' + md.split('\n').length;
  }

  // -----------------------------------------------------------------------
  // Completeness checker
  // -----------------------------------------------------------------------
  function checkCompleteness() {
    if (!currentTemplate)
      return { score: 0, warnings: [] };

    const warnings = [];
    let totalChecks = 0;
    let passed = 0;

    const pi = currentData.personalInfo || {};

    ++totalChecks;
    if (pi.name && pi.name.trim()) ++passed;
    else warnings.push('Missing name');

    ++totalChecks;
    if (pi.email && pi.email.trim()) ++passed;
    else warnings.push('Missing email address');

    ++totalChecks;
    if (pi.phone && pi.phone.trim()) ++passed;
    else warnings.push('Missing phone number');

    const hasSummary = currentTemplate.sections.some(s => s.id === 'summary' || s.id === 'objective');
    if (hasSummary) {
      ++totalChecks;
      const summaryVal = currentData.summary || currentData.objective || '';
      const wordCount = summaryVal.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount >= 10 && wordCount <= 200) ++passed;
      else if (wordCount > 0 && wordCount < 10) warnings.push('Summary is too short (less than 10 words)');
      else if (wordCount > 200) warnings.push('Summary is too long (more than 200 words)');
      else warnings.push('Missing summary/objective');
    }

    const hasExp = currentTemplate.sections.some(s => s.id === 'experience');
    const hasProj = currentTemplate.sections.some(s => s.id === 'projects');
    if (hasExp || hasProj) {
      ++totalChecks;
      const expEntries = Array.isArray(currentData.experience) ? currentData.experience.filter(e => e.title || e.company) : [];
      const projEntries = Array.isArray(currentData.projects) ? currentData.projects.filter(e => e.name) : [];
      if (expEntries.length > 0 || projEntries.length > 0) ++passed;
      else warnings.push('Add at least one experience or project entry');
    }

    const hasEdu = currentTemplate.sections.some(s => s.id === 'education');
    if (hasEdu) {
      ++totalChecks;
      const eduEntries = Array.isArray(currentData.education) ? currentData.education.filter(e => e.institution || e.degree) : [];
      if (eduEntries.length > 0) ++passed;
      else warnings.push('Missing education');
    }

    const hasSkills = currentTemplate.sections.some(s => s.id === 'skills');
    if (hasSkills) {
      ++totalChecks;
      const skillGroups = Array.isArray(currentData.skills) ? currentData.skills.filter(g => g.skills) : [];
      const skillTags = Array.isArray(currentData.skills) && currentData.skills.length > 0 && typeof currentData.skills[0] === 'string';
      if (skillGroups.length > 0 || skillTags) ++passed;
      else warnings.push('Missing skills');
    }

    // Check for incomplete experience dates
    if (Array.isArray(currentData.experience))
      for (const entry of currentData.experience)
        if ((entry.title || entry.company) && !entry.startDate)
          warnings.push('Experience "' + (entry.title || entry.company) + '" missing start date');

    // Check for empty bullets
    if (Array.isArray(currentData.experience))
      for (const entry of currentData.experience)
        if (entry.bullets)
          for (const b of entry.bullets)
            if (b !== undefined && b !== null && b.trim() === '')
              warnings.push('Empty bullet point in "' + (entry.title || entry.company || 'experience') + '"');

    const score = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 0;
    return { score, warnings };
  }

  function updateCompleteness() {
    const { score, warnings } = checkCompleteness();
    statusCompleteness.textContent = 'Completeness: ' + score + '%';
    statusCompleteness.className = 'status-section status-completeness ' + (score >= 80 ? 'good' : score >= 50 ? 'ok' : 'poor');
    statusWarnings.textContent = warnings.length + ' warning' + (warnings.length !== 1 ? 's' : '');
    statusWarnings.title = warnings.join('\n');
  }

  // -----------------------------------------------------------------------
  // Field editor rendering
  // -----------------------------------------------------------------------
  function onFieldChange() {
    dirty = true;
    updateTitle();
    updatePreview();
    updateCompleteness();
  }

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
          onFieldChange();
        });
        container.appendChild(input);
        break;
      }

      case 'textarea': {
        const textarea = document.createElement('textarea');
        textarea.rows = 5;
        textarea.value = val || '';
        textarea.placeholder = section.label + '...';
        textarea.addEventListener('input', () => {
          pushUndo();
          currentData[section.id] = textarea.value;
          onFieldChange();
        });
        container.appendChild(textarea);
        break;
      }

      case 'personal-info': {
        const editor = document.createElement('div');
        editor.className = 'personal-info-editor';
        const info = val || { name: '', title: '', email: '', phone: '', website: '', linkedin: '', github: '', location: '' };
        if (!currentData[section.id]) currentData[section.id] = info;

        const fields = [
          { key: 'name', label: 'Name' },
          { key: 'title', label: 'Title' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'location', label: 'Location' },
          { key: 'website', label: 'Website' },
          { key: 'linkedin', label: 'LinkedIn' },
          { key: 'github', label: 'GitHub' }
        ];

        for (const f of fields) {
          const row = document.createElement('div');
          row.className = 'info-row';
          const label = document.createElement('label');
          label.textContent = f.label + ':';
          const input = document.createElement('input');
          input.type = 'text';
          input.value = info[f.key] || '';
          input.placeholder = f.label;
          input.addEventListener('input', () => {
            pushUndo();
            currentData[section.id][f.key] = input.value;
            onFieldChange();
          });
          row.appendChild(label);
          row.appendChild(input);
          editor.appendChild(row);
        }

        container.appendChild(editor);
        break;
      }

      case 'experience-list': {
        const editor = document.createElement('div');
        editor.className = 'card-list-editor';
        const entries = Array.isArray(val) ? val.map(v => deepClone(v)) : [];
        if (!currentData[section.id]) currentData[section.id] = entries;

        const renderCards = () => {
          editor.innerHTML = '';
          for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i];
            const card = document.createElement('div');
            card.className = 'card-item';

            const header = document.createElement('div');
            header.className = 'card-header';
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = '\u25BC';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'card-title';
            titleSpan.textContent = (entry.title || entry.company || 'Experience ' + (i + 1));
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.title = 'Remove';
            const idx = i;
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              entries.splice(idx, 1);
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
              renderCards();
            });
            header.addEventListener('click', () => card.classList.toggle('collapsed'));
            header.appendChild(arrow);
            header.appendChild(titleSpan);
            header.appendChild(removeBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'card-body';

            const makeRow = (label, key, type) => {
              const row = document.createElement('div');
              row.className = 'card-row';
              const lbl = document.createElement('label');
              lbl.textContent = label + ':';
              const input = document.createElement('input');
              input.type = type || 'text';
              input.value = entry[key] || '';
              input.placeholder = label;
              input.addEventListener('input', () => {
                entry[key] = input.value;
                pushUndo();
                currentData[section.id] = entries;
                onFieldChange();
                titleSpan.textContent = (entry.title || entry.company || 'Experience ' + (idx + 1));
              });
              row.appendChild(lbl);
              row.appendChild(input);
              return row;
            };

            body.appendChild(makeRow('Job Title', 'title'));
            body.appendChild(makeRow('Company', 'company'));
            body.appendChild(makeRow('Location', 'location'));

            // Date row
            const dateRow = document.createElement('div');
            dateRow.className = 'card-row';
            const dateLbl = document.createElement('label');
            dateLbl.textContent = 'Dates:';
            const datePair = document.createElement('div');
            datePair.className = 'date-pair';
            const startInput = document.createElement('input');
            startInput.type = 'text';
            startInput.value = entry.startDate || '';
            startInput.placeholder = 'Start (e.g. Jan 2020)';
            const endInput = document.createElement('input');
            endInput.type = 'text';
            endInput.value = entry.endDate || '';
            endInput.placeholder = 'End';
            endInput.disabled = !!entry.current;
            const currentLabel = document.createElement('label');
            const currentCb = document.createElement('input');
            currentCb.type = 'checkbox';
            currentCb.checked = !!entry.current;
            currentLabel.appendChild(currentCb);
            currentLabel.appendChild(document.createTextNode(' Current'));
            currentCb.addEventListener('change', () => {
              entry.current = currentCb.checked;
              endInput.disabled = currentCb.checked;
              if (currentCb.checked) endInput.value = '';
              entry.endDate = endInput.value;
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
            });
            startInput.addEventListener('input', () => {
              entry.startDate = startInput.value;
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
            });
            endInput.addEventListener('input', () => {
              entry.endDate = endInput.value;
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
            });
            datePair.appendChild(startInput);
            datePair.appendChild(document.createTextNode(' \u2013 '));
            datePair.appendChild(endInput);
            datePair.appendChild(currentLabel);
            dateRow.appendChild(dateLbl);
            dateRow.appendChild(datePair);
            body.appendChild(dateRow);

            // Bullets
            const bullets = entry.bullets || [];
            if (!entry.bullets) entry.bullets = bullets;
            const bulletDiv = document.createElement('div');
            bulletDiv.className = 'bullet-list';
            const bulletLabel = document.createElement('label');
            bulletLabel.textContent = 'Key achievements:';
            bulletLabel.style.cssText = 'font-size:10px;color:var(--sz-color-gray-text);display:block;margin:4px 0 2px;';
            bulletDiv.appendChild(bulletLabel);

            const renderBullets = () => {
              const existing = bulletDiv.querySelectorAll('.bullet-row, .bullet-add');
              existing.forEach(el => el.remove());

              for (let j = 0; j < bullets.length; ++j) {
                const bRow = document.createElement('div');
                bRow.className = 'bullet-row';
                const bInput = document.createElement('input');
                bInput.type = 'text';
                bInput.value = bullets[j] || '';
                bInput.placeholder = 'Achievement ' + (j + 1);
                const bi = j;
                bInput.addEventListener('input', () => {
                  bullets[bi] = bInput.value;
                  pushUndo();
                  currentData[section.id] = entries;
                  onFieldChange();
                });
                const bRemove = document.createElement('button');
                bRemove.textContent = '\u2716';
                bRemove.addEventListener('click', () => {
                  bullets.splice(bi, 1);
                  pushUndo();
                  currentData[section.id] = entries;
                  onFieldChange();
                  renderBullets();
                });
                bRow.appendChild(bInput);
                bRow.appendChild(bRemove);
                bulletDiv.appendChild(bRow);
              }

              const addBullet = document.createElement('button');
              addBullet.className = 'bullet-add';
              addBullet.textContent = '+ Add bullet';
              addBullet.addEventListener('click', () => {
                bullets.push('');
                renderBullets();
              });
              bulletDiv.appendChild(addBullet);
            };

            renderBullets();
            body.appendChild(bulletDiv);
            card.appendChild(body);
            editor.appendChild(card);
          }

          const addBtn = document.createElement('button');
          addBtn.className = 'card-add';
          addBtn.textContent = '+ Add experience';
          addBtn.addEventListener('click', () => {
            entries.push({ company: '', title: '', location: '', startDate: '', endDate: '', current: false, bullets: [''] });
            pushUndo();
            currentData[section.id] = entries;
            onFieldChange();
            renderCards();
          });
          editor.appendChild(addBtn);
        };

        renderCards();
        container.appendChild(editor);
        break;
      }

      case 'education-list': {
        const editor = document.createElement('div');
        editor.className = 'card-list-editor';
        const entries = Array.isArray(val) ? val.map(v => deepClone(v)) : [];
        if (!currentData[section.id]) currentData[section.id] = entries;

        const renderCards = () => {
          editor.innerHTML = '';
          for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i];
            const card = document.createElement('div');
            card.className = 'card-item';

            const header = document.createElement('div');
            header.className = 'card-header';
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = '\u25BC';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'card-title';
            titleSpan.textContent = (entry.degree || entry.institution || 'Education ' + (i + 1));
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            const idx = i;
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              entries.splice(idx, 1);
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
              renderCards();
            });
            header.addEventListener('click', () => card.classList.toggle('collapsed'));
            header.appendChild(arrow);
            header.appendChild(titleSpan);
            header.appendChild(removeBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'card-body';

            const makeRow = (label, key) => {
              const row = document.createElement('div');
              row.className = 'card-row';
              const lbl = document.createElement('label');
              lbl.textContent = label + ':';
              const input = document.createElement('input');
              input.type = 'text';
              input.value = entry[key] || '';
              input.placeholder = label;
              input.addEventListener('input', () => {
                entry[key] = input.value;
                pushUndo();
                currentData[section.id] = entries;
                onFieldChange();
                titleSpan.textContent = (entry.degree || entry.institution || 'Education ' + (idx + 1));
              });
              row.appendChild(lbl);
              row.appendChild(input);
              return row;
            };

            body.appendChild(makeRow('Institution', 'institution'));
            body.appendChild(makeRow('Degree', 'degree'));
            body.appendChild(makeRow('Field', 'field'));

            const dateRow = document.createElement('div');
            dateRow.className = 'card-row';
            const dateLbl = document.createElement('label');
            dateLbl.textContent = 'Dates:';
            const datePair = document.createElement('div');
            datePair.className = 'date-pair';
            const startInput = document.createElement('input');
            startInput.type = 'text';
            startInput.value = entry.startDate || '';
            startInput.placeholder = 'Start';
            const endInput = document.createElement('input');
            endInput.type = 'text';
            endInput.value = entry.endDate || '';
            endInput.placeholder = 'End';
            startInput.addEventListener('input', () => { entry.startDate = startInput.value; pushUndo(); currentData[section.id] = entries; onFieldChange(); });
            endInput.addEventListener('input', () => { entry.endDate = endInput.value; pushUndo(); currentData[section.id] = entries; onFieldChange(); });
            datePair.appendChild(startInput);
            datePair.appendChild(document.createTextNode(' \u2013 '));
            datePair.appendChild(endInput);
            dateRow.appendChild(dateLbl);
            dateRow.appendChild(datePair);
            body.appendChild(dateRow);

            body.appendChild(makeRow('GPA', 'gpa'));
            body.appendChild(makeRow('Honors', 'honors'));

            card.appendChild(body);
            editor.appendChild(card);
          }

          const addBtn = document.createElement('button');
          addBtn.className = 'card-add';
          addBtn.textContent = '+ Add education';
          addBtn.addEventListener('click', () => {
            entries.push({ institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', honors: '' });
            pushUndo();
            currentData[section.id] = entries;
            onFieldChange();
            renderCards();
          });
          editor.appendChild(addBtn);
        };

        renderCards();
        container.appendChild(editor);
        break;
      }

      case 'skills-grouped': {
        const editor = document.createElement('div');
        editor.className = 'skills-grouped-editor';
        const groups = Array.isArray(val) ? val.map(v => ({ ...v })) : [{ category: '', skills: '' }];
        if (!currentData[section.id]) currentData[section.id] = groups;

        const renderGroups = () => {
          editor.innerHTML = '';
          for (let i = 0; i < groups.length; ++i) {
            const row = document.createElement('div');
            row.className = 'skill-group-row';
            const catInput = document.createElement('input');
            catInput.type = 'text';
            catInput.value = groups[i].category || '';
            catInput.placeholder = 'Category';
            const skillsInput = document.createElement('input');
            skillsInput.type = 'text';
            skillsInput.value = groups[i].skills || '';
            skillsInput.placeholder = 'Skills (comma-separated)';
            const idx = i;
            catInput.addEventListener('input', () => {
              groups[idx].category = catInput.value;
              pushUndo();
              currentData[section.id] = groups;
              onFieldChange();
            });
            skillsInput.addEventListener('input', () => {
              groups[idx].skills = skillsInput.value;
              pushUndo();
              currentData[section.id] = groups;
              onFieldChange();
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.addEventListener('click', () => {
              groups.splice(idx, 1);
              if (groups.length === 0) groups.push({ category: '', skills: '' });
              pushUndo();
              currentData[section.id] = groups;
              onFieldChange();
              renderGroups();
            });
            row.appendChild(catInput);
            row.appendChild(skillsInput);
            row.appendChild(removeBtn);
            editor.appendChild(row);
          }
          const addBtn = document.createElement('button');
          addBtn.className = 'skill-add';
          addBtn.textContent = '+ Add category';
          addBtn.addEventListener('click', () => {
            groups.push({ category: '', skills: '' });
            renderGroups();
          });
          editor.appendChild(addBtn);
        };

        renderGroups();
        container.appendChild(editor);
        break;
      }

      case 'certifications-list': {
        const editor = document.createElement('div');
        editor.className = 'card-list-editor';
        const entries = Array.isArray(val) ? val.map(v => deepClone(v)) : [];
        if (!currentData[section.id]) currentData[section.id] = entries;

        const renderCards = () => {
          editor.innerHTML = '';
          for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i];
            const card = document.createElement('div');
            card.className = 'card-item';

            const header = document.createElement('div');
            header.className = 'card-header';
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = '\u25BC';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'card-title';
            titleSpan.textContent = entry.name || 'Certification ' + (i + 1);
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            const idx = i;
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              entries.splice(idx, 1);
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
              renderCards();
            });
            header.addEventListener('click', () => card.classList.toggle('collapsed'));
            header.appendChild(arrow);
            header.appendChild(titleSpan);
            header.appendChild(removeBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'card-body';

            const fields = [
              { key: 'name', label: 'Name' },
              { key: 'issuer', label: 'Issuer' },
              { key: 'date', label: 'Date' },
              { key: 'credentialId', label: 'Credential ID' },
              { key: 'credentialUrl', label: 'URL' }
            ];

            for (const f of fields) {
              const row = document.createElement('div');
              row.className = 'card-row';
              const lbl = document.createElement('label');
              lbl.textContent = f.label + ':';
              const input = document.createElement('input');
              input.type = 'text';
              input.value = entry[f.key] || '';
              input.placeholder = f.label;
              input.addEventListener('input', () => {
                entry[f.key] = input.value;
                pushUndo();
                currentData[section.id] = entries;
                onFieldChange();
                if (f.key === 'name') titleSpan.textContent = entry.name || 'Certification ' + (idx + 1);
              });
              row.appendChild(lbl);
              row.appendChild(input);
              body.appendChild(row);
            }

            card.appendChild(body);
            editor.appendChild(card);
          }

          const addBtn = document.createElement('button');
          addBtn.className = 'card-add';
          addBtn.textContent = '+ Add certification';
          addBtn.addEventListener('click', () => {
            entries.push({ name: '', issuer: '', date: '', credentialId: '', credentialUrl: '' });
            pushUndo();
            currentData[section.id] = entries;
            onFieldChange();
            renderCards();
          });
          editor.appendChild(addBtn);
        };

        renderCards();
        container.appendChild(editor);
        break;
      }

      case 'projects-list': {
        const editor = document.createElement('div');
        editor.className = 'card-list-editor';
        const entries = Array.isArray(val) ? val.map(v => deepClone(v)) : [];
        if (!currentData[section.id]) currentData[section.id] = entries;

        const renderCards = () => {
          editor.innerHTML = '';
          for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i];
            const card = document.createElement('div');
            card.className = 'card-item';

            const header = document.createElement('div');
            header.className = 'card-header';
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = '\u25BC';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'card-title';
            titleSpan.textContent = entry.name || 'Project ' + (i + 1);
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            const idx = i;
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              entries.splice(idx, 1);
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
              renderCards();
            });
            header.addEventListener('click', () => card.classList.toggle('collapsed'));
            header.appendChild(arrow);
            header.appendChild(titleSpan);
            header.appendChild(removeBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'card-body';

            const fields = [
              { key: 'name', label: 'Name' },
              { key: 'description', label: 'Description' },
              { key: 'technologies', label: 'Technologies' },
              { key: 'url', label: 'URL' }
            ];

            for (const f of fields) {
              const row = document.createElement('div');
              row.className = 'card-row';
              const lbl = document.createElement('label');
              lbl.textContent = f.label + ':';
              const input = document.createElement('input');
              input.type = 'text';
              input.value = entry[f.key] || '';
              input.placeholder = f.label;
              input.addEventListener('input', () => {
                entry[f.key] = input.value;
                pushUndo();
                currentData[section.id] = entries;
                onFieldChange();
                if (f.key === 'name') titleSpan.textContent = entry.name || 'Project ' + (idx + 1);
              });
              row.appendChild(lbl);
              row.appendChild(input);
              body.appendChild(row);
            }

            card.appendChild(body);
            editor.appendChild(card);
          }

          const addBtn = document.createElement('button');
          addBtn.className = 'card-add';
          addBtn.textContent = '+ Add project';
          addBtn.addEventListener('click', () => {
            entries.push({ name: '', description: '', technologies: '', url: '' });
            pushUndo();
            currentData[section.id] = entries;
            onFieldChange();
            renderCards();
          });
          editor.appendChild(addBtn);
        };

        renderCards();
        container.appendChild(editor);
        break;
      }

      case 'languages-list': {
        const editor = document.createElement('div');
        editor.className = 'languages-editor';
        const entries = Array.isArray(val) ? val.map(v => ({ ...v })) : [{ language: '', proficiency: 'Professional' }];
        if (!currentData[section.id]) currentData[section.id] = entries;

        const renderLangs = () => {
          editor.innerHTML = '';
          for (let i = 0; i < entries.length; ++i) {
            const row = document.createElement('div');
            row.className = 'lang-row';
            const langInput = document.createElement('input');
            langInput.type = 'text';
            langInput.value = entries[i].language || '';
            langInput.placeholder = 'Language';
            const profSelect = document.createElement('select');
            for (const p of PROFICIENCY_LEVELS) {
              const opt = document.createElement('option');
              opt.value = p;
              opt.textContent = p;
              profSelect.appendChild(opt);
            }
            profSelect.value = entries[i].proficiency || 'Professional';
            const idx = i;
            langInput.addEventListener('input', () => {
              entries[idx].language = langInput.value;
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
            });
            profSelect.addEventListener('change', () => {
              entries[idx].proficiency = profSelect.value;
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.addEventListener('click', () => {
              entries.splice(idx, 1);
              if (entries.length === 0) entries.push({ language: '', proficiency: 'Professional' });
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
              renderLangs();
            });
            row.appendChild(langInput);
            row.appendChild(profSelect);
            row.appendChild(removeBtn);
            editor.appendChild(row);
          }
          const addBtn = document.createElement('button');
          addBtn.className = 'lang-add';
          addBtn.textContent = '+ Add language';
          addBtn.addEventListener('click', () => {
            entries.push({ language: '', proficiency: 'Professional' });
            renderLangs();
          });
          editor.appendChild(addBtn);
        };

        renderLangs();
        container.appendChild(editor);
        break;
      }

      case 'references-list': {
        const editor = document.createElement('div');
        editor.className = 'card-list-editor';
        const entries = Array.isArray(val) ? val.map(v => deepClone(v)) : [];
        if (!currentData[section.id]) currentData[section.id] = entries;

        const renderCards = () => {
          editor.innerHTML = '';
          for (let i = 0; i < entries.length; ++i) {
            const entry = entries[i];
            const card = document.createElement('div');
            card.className = 'card-item';

            const header = document.createElement('div');
            header.className = 'card-header';
            const arrow = document.createElement('span');
            arrow.className = 'toggle-arrow';
            arrow.textContent = '\u25BC';
            const titleSpan = document.createElement('span');
            titleSpan.className = 'card-title';
            titleSpan.textContent = entry.name || 'Reference ' + (i + 1);
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            const idx = i;
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              entries.splice(idx, 1);
              pushUndo();
              currentData[section.id] = entries;
              onFieldChange();
              renderCards();
            });
            header.addEventListener('click', () => card.classList.toggle('collapsed'));
            header.appendChild(arrow);
            header.appendChild(titleSpan);
            header.appendChild(removeBtn);
            card.appendChild(header);

            const body = document.createElement('div');
            body.className = 'card-body';

            const fields = [
              { key: 'name', label: 'Name' },
              { key: 'title', label: 'Title' },
              { key: 'company', label: 'Company' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' }
            ];

            for (const f of fields) {
              const row = document.createElement('div');
              row.className = 'card-row';
              const lbl = document.createElement('label');
              lbl.textContent = f.label + ':';
              const input = document.createElement('input');
              input.type = 'text';
              input.value = entry[f.key] || '';
              input.placeholder = f.label;
              input.addEventListener('input', () => {
                entry[f.key] = input.value;
                pushUndo();
                currentData[section.id] = entries;
                onFieldChange();
                if (f.key === 'name') titleSpan.textContent = entry.name || 'Reference ' + (idx + 1);
              });
              row.appendChild(lbl);
              row.appendChild(input);
              body.appendChild(row);
            }

            card.appendChild(body);
            editor.appendChild(card);
          }

          const addBtn = document.createElement('button');
          addBtn.className = 'card-add';
          addBtn.textContent = '+ Add reference';
          addBtn.addEventListener('click', () => {
            entries.push({ name: '', title: '', company: '', email: '', phone: '' });
            pushUndo();
            currentData[section.id] = entries;
            onFieldChange();
            renderCards();
          });
          editor.appendChild(addBtn);
        };

        renderCards();
        container.appendChild(editor);
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
              onFieldChange();
            });
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '\u2716';
            removeBtn.addEventListener('click', () => {
              items.splice(idx, 1);
              if (items.length === 0) items.push('');
              pushUndo();
              currentData[section.id] = items.filter(Boolean);
              onFieldChange();
              renderList();
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

      case 'tags': {
        const editor = document.createElement('div');
        editor.className = 'tags-editor';
        const tags = Array.isArray(val) ? [...val] : [];
        if (!currentData[section.id]) currentData[section.id] = tags;

        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';

        const renderTags = () => {
          tagsContainer.innerHTML = '';
          for (let i = 0; i < tags.length; ++i) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = tags[i];
            const removeSpan = document.createElement('span');
            removeSpan.className = 'tag-remove';
            removeSpan.textContent = '\u2716';
            const idx = i;
            removeSpan.addEventListener('click', () => {
              tags.splice(idx, 1);
              pushUndo();
              currentData[section.id] = [...tags];
              onFieldChange();
              renderTags();
            });
            tag.appendChild(removeSpan);
            tagsContainer.appendChild(tag);
          }
        };

        renderTags();
        editor.appendChild(tagsContainer);

        const inputRow = document.createElement('div');
        inputRow.className = 'tag-input-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type a skill and press Enter';
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        const addTag = () => {
          const val = input.value.trim();
          if (val && !tags.includes(val)) {
            tags.push(val);
            input.value = '';
            pushUndo();
            currentData[section.id] = [...tags];
            onFieldChange();
            renderTags();
          }
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); addTag(); }
        });
        addBtn.addEventListener('click', addTag);
        inputRow.appendChild(input);
        inputRow.appendChild(addBtn);
        editor.appendChild(inputRow);

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
          onFieldChange();
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
    const totalSteps = sections.length + 1;

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

    wizardStepContainer.innerHTML = '';

    if (wizardStep === 0) {
      const title = document.createElement('div');
      title.className = 'wizard-step-title';
      title.textContent = 'Choose a Template';
      wizardStepContainer.appendChild(title);

      const help = document.createElement('div');
      help.className = 'wizard-step-help';
      help.textContent = 'Select a resume template that matches your background and target role.';
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
          updateCompleteness();
        });
        cards.appendChild(card);
      }
      wizardStepContainer.appendChild(cards);

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

      wizardBack.style.display = '';
      wizardSkip.style.display = section.required ? 'none' : '';
      wizardNext.style.display = sectionIdx < sections.length - 1 ? '' : 'none';
      wizardFinish.style.display = sectionIdx === sections.length - 1 ? '' : 'none';
    }
  }

  wizardBack.addEventListener('click', () => {
    if (wizardStep > 0) { --wizardStep; renderWizard(); }
  });

  wizardNext.addEventListener('click', () => {
    if (!currentTemplate) return;
    if (wizardStep < currentTemplate.sections.length) { ++wizardStep; renderWizard(); }
  });

  wizardSkip.addEventListener('click', () => {
    if (!currentTemplate) return;
    if (wizardStep < currentTemplate.sections.length) { ++wizardStep; renderWizard(); }
  });

  wizardFinish.addEventListener('click', () => {
    setViewMode('form');
    updatePreview();
    updateCompleteness();
  });

  // -----------------------------------------------------------------------
  // Form mode
  // -----------------------------------------------------------------------
  function renderForm() {
    formSections.innerHTML = '';
    if (!currentTemplate) return;

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
      header.addEventListener('click', () => fieldset.classList.toggle('collapsed'));

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

    if (mode === 'wizard') renderWizard();
    else renderForm();
  }

  function togglePreview() {
    showPreview = !showPreview;
    previewPanel.classList.toggle('hidden', !showPreview);
    splitter.style.display = showPreview ? '' : 'none';
    document.getElementById('menu-toggle-preview').classList.toggle('checked', showPreview);
    if (showPreview) updatePreview();
  }

  function toggleCompleteness() {
    showCompleteness = !showCompleteness;
    statusBar.classList.toggle('hidden', !showCompleteness);
    document.getElementById('menu-toggle-completeness').classList.toggle('checked', showCompleteness);
  }

  function refreshCurrentView() {
    if (viewMode === 'wizard') renderWizard();
    else renderForm();
  }

  // -----------------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------------
  function doNew() {
    pushUndo();
    currentData = {};
    currentFilePath = null;
    currentFileName = 'Resume.md';
    dirty = false;
    wizardStep = 0;
    savedData = {};
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateCompleteness();
  }

  async function doOpen() {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      filters: [
        { name: 'Markdown Files', ext: ['md', 'markdown'] },
        { name: 'All Files', ext: ['*'] }
      ],
      initialDir: '/user/documents',
      title: 'Open Resume'
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
    currentFileName = parts[parts.length - 1] || 'Resume.md';
    dirty = false;
    savedData = deepClone(currentData);
    updateTitle();
  }

  function importMarkdown(text) {
    if (!currentTemplate) currentTemplate = allTemplates[0];

    pushUndo();
    currentData = SZ.ResumeParser.parseMarkdown(text, currentTemplate.sections);
    wizardStep = 1;
    refreshCurrentView();
    updatePreview();
    updateCompleteness();
  }

  async function doImport() {
    const result = await SZ.Dlls.ComDlg32.ImportFile({ accept: '.md,.markdown,.txt', readAs: 'text' });
    if (!result.cancelled && result.data) {
      importMarkdown(result.data);
      currentFilePath = null;
      currentFileName = result.name || 'Resume.md';
      dirty = true;
      updateTitle();
    }
  }

  function doPasteResume() {
    const dlg = document.getElementById('dlg-paste');
    const textarea = document.getElementById('paste-textarea');
    textarea.value = '';
    dlg.classList.add('visible');
    textarea.focus();
  }

  function doSave() {
    if (!currentFilePath) { doSaveAs(); return; }
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
      defaultName: currentFileName || 'Resume.md',
      title: 'Save As',
      content: md
    });
    if (!result.cancelled && result.path) {
      currentFilePath = result.path;
      const parts = result.path.split('/');
      currentFileName = parts[parts.length - 1] || 'Resume.md';
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

  // -----------------------------------------------------------------------
  // Export operations
  // -----------------------------------------------------------------------
  function doExportByFormat(format) {
    switch (format || exportFormat.value) {
      case 'md': {
        const md = generateMarkdown();
        SZ.Dlls.ComDlg32.ExportFile(md, currentFileName.replace(/\.\w+$/, '') + '.md', 'text/markdown');
        break;
      }
      case 'txt': {
        const txt = generatePlainText();
        SZ.Dlls.ComDlg32.ExportFile(txt, currentFileName.replace(/\.\w+$/, '') + '.txt', 'text/plain');
        break;
      }
      case 'pdf':
        window.print();
        break;
      case 'docx': {
        const xml = generateDocx();
        SZ.Dlls.ComDlg32.ExportFile(xml, currentFileName.replace(/\.\w+$/, '') + '.xml', 'application/xml');
        break;
      }
    }
  }

  function doCopyMarkdown(e) {
    const md = generateMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      if (e) showCopyTooltip(e.clientX || 100, e.clientY || 100);
    }).catch(() => {});
  }

  function doClearAll() {
    pushUndo();
    currentData = {};
    dirty = true;
    updateTitle();
    refreshCurrentView();
    updatePreview();
    updateCompleteness();
  }

  // -----------------------------------------------------------------------
  // Paste dialog
  // -----------------------------------------------------------------------
  document.getElementById('paste-ok').addEventListener('click', () => {
    const text = document.getElementById('paste-textarea').value;
    document.getElementById('dlg-paste').classList.remove('visible');
    if (text.trim()) {
      importMarkdown(text);
      currentFilePath = null;
      dirty = true;
      updateTitle();
    }
  });

  document.getElementById('paste-cancel').addEventListener('click', () => {
    document.getElementById('dlg-paste').classList.remove('visible');
  });

  // -----------------------------------------------------------------------
  // Template editor dialog
  // -----------------------------------------------------------------------
  let editingTemplate = null;

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
    dlg.classList.add('visible');
  }

  function renderTemplateEditorFields() {
    if (!editingTemplate) return;
    document.getElementById('tpl-editor-name').value = editingTemplate.name || '';
    document.getElementById('tpl-editor-name').disabled = !!editingTemplate.builtin;
    document.getElementById('tpl-editor-desc').value = editingTemplate.description || '';
    document.getElementById('tpl-editor-desc').disabled = !!editingTemplate.builtin;
    document.getElementById('tpl-editor-layout').value = editingTemplate.previewLayout || 'single-column';
    document.getElementById('tpl-editor-layout').disabled = !!editingTemplate.builtin;
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
      removeBtn.addEventListener('click', () => { editingTemplate.sections.splice(idx, 1); renderTemplateEditorFields(); });

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
    if (tpl) { editingTemplate = deepClone(tpl); renderTemplateEditorFields(); }
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
    if (editingTemplate && !editingTemplate.builtin) editingTemplate.name = e.target.value;
  });

  document.getElementById('tpl-editor-desc').addEventListener('input', (e) => {
    if (editingTemplate && !editingTemplate.builtin) editingTemplate.description = e.target.value;
  });

  document.getElementById('tpl-editor-layout').addEventListener('change', (e) => {
    if (editingTemplate && !editingTemplate.builtin) editingTemplate.previewLayout = e.target.value;
  });

  document.getElementById('tpl-editor-save').addEventListener('click', () => {
    if (!editingTemplate || editingTemplate.builtin) return;
    const idx = customTemplates.findIndex(t => t.id === editingTemplate.id);
    if (idx >= 0)
      customTemplates[idx] = deepClone(editingTemplate);
    else
      customTemplates.push(deepClone(editingTemplate));
    saveCustomTemplates();
    rebuildTemplateList();
  });

  document.getElementById('tpl-editor-close').addEventListener('click', () => {
    document.getElementById('dlg-template-editor').classList.remove('visible');
  });

  // Template I/O buttons
  document.getElementById('tpl-upload').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const tpl = JSON.parse(reader.result);
          tpl.builtin = false;
          if (!tpl.id) tpl.id = 'custom-' + Date.now();
          customTemplates.push(tpl);
          saveCustomTemplates();
          rebuildTemplateList();
          editingTemplate = deepClone(tpl);
          const select = document.getElementById('tpl-editor-select');
          const opt = document.createElement('option');
          opt.value = tpl.id;
          opt.textContent = tpl.name;
          select.appendChild(opt);
          select.value = tpl.id;
          renderTemplateEditorFields();
        } catch (_) {}
      };
      reader.readAsText(file);
    });
    input.click();
  });

  document.getElementById('tpl-download').addEventListener('click', () => {
    if (!editingTemplate) return;
    const json = JSON.stringify(editingTemplate, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (editingTemplate.name || 'template').replace(/\s+/g, '-').toLowerCase() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('tpl-vfs-load').addEventListener('click', async () => {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      filters: [{ name: 'JSON Files', ext: ['json'] }],
      initialDir: '/user/documents',
      title: 'Load Template'
    });
    if (!result.cancelled && (result.content || result.path)) {
      try {
        let text = result.content;
        if (!text) text = await SZ.Dlls.Kernel32.ReadFile(result.path);
        const tpl = JSON.parse(text);
        tpl.builtin = false;
        if (!tpl.id) tpl.id = 'custom-' + Date.now();
        customTemplates.push(tpl);
        saveCustomTemplates();
        rebuildTemplateList();
        editingTemplate = deepClone(tpl);
        renderTemplateEditorFields();
      } catch (_) {}
    }
  });

  document.getElementById('tpl-vfs-save').addEventListener('click', async () => {
    if (!editingTemplate) return;
    const json = JSON.stringify(editingTemplate, null, 2);
    await SZ.Dlls.ComDlg32.GetSaveFileName({
      filters: [{ name: 'JSON Files', ext: ['json'] }],
      initialDir: '/user/documents',
      defaultName: (editingTemplate.name || 'template').replace(/\s+/g, '-').toLowerCase() + '.json',
      title: 'Save Template',
      content: json
    });
  });

  // -----------------------------------------------------------------------
  // About dialog
  // -----------------------------------------------------------------------
  function showAbout() {
    const dlg = document.getElementById('dlg-about');
    dlg.classList.add('visible');
    const okBtn = document.getElementById('about-ok');
    okBtn.focus();
    function handler() { dlg.classList.remove('visible'); okBtn.removeEventListener('click', handler); }
    okBtn.addEventListener('click', handler);
  }

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
  // Menu system
  // -----------------------------------------------------------------------
  function closeMenus() {
    for (const item of menuBar.querySelectorAll('.menu-item'))
      item.classList.remove('open');
    openMenu = null;
  }

  for (const menuItem of menuBar.querySelectorAll('.menu-item')) {
    menuItem.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.menu-entry') || e.target.closest('.menu-separator')) return;
      if (openMenu === menuItem) { closeMenus(); return; }
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
    if (openMenu && !menuBar.contains(e.target)) closeMenus();
  });

  // -----------------------------------------------------------------------
  // Action dispatcher
  // -----------------------------------------------------------------------
  function handleAction(action, target) {
    switch (action) {
      case 'new': doNew(); break;
      case 'open': doOpen(); break;
      case 'import': doImport(); break;
      case 'paste-resume': doPasteResume(); break;
      case 'save': doSave(); break;
      case 'save-as': doSaveAs(); break;
      case 'export': doExportByFormat(); break;
      case 'export-md': doExportByFormat('md'); break;
      case 'export-txt': doExportByFormat('txt'); break;
      case 'export-pdf': doExportByFormat('pdf'); break;
      case 'export-docx': doExportByFormat('docx'); break;
      case 'exit': SZ.Dlls.User32.DestroyWindow(); break;
      case 'undo': doUndo(); break;
      case 'redo': doRedo(); break;
      case 'copy-markdown': doCopyMarkdown(); break;
      case 'clear-all': doClearAll(); break;
      case 'view-wizard': setViewMode('wizard'); break;
      case 'view-form': setViewMode('form'); break;
      case 'toggle-preview': togglePreview(); break;
      case 'toggle-completeness': toggleCompleteness(); break;
      case 'edit-templates': openTemplateEditor(); break;
      case 'apply-template': applyDifferentTemplate(); break;
      case 'about': showAbout(); break;
      case 'select-template':
        if (target && target.dataset.templateId)
          selectTemplate(target.dataset.templateId);
        break;
    }
  }

  menuBar.addEventListener('click', (e) => {
    const entry = e.target.closest('.menu-entry');
    if (!entry) return;
    const action = entry.dataset.action;
    closeMenus();
    handleAction(action, entry);
  });

  for (const btn of document.querySelectorAll('.toolbar button[data-action]'))
    btn.addEventListener('click', () => handleAction(btn.dataset.action));

  templateSelect.addEventListener('change', () => selectTemplate(templateSelect.value));

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

    const cmd = SZ.Dlls.Kernel32.GetCommandLine();
    if (cmd.path)
      loadFile(cmd.path, null);
    else {
      wizardStep = 0;
      renderWizard();
    }

    updateTitle();
    updatePreview();
    updateCompleteness();
  }

  init();
})();
