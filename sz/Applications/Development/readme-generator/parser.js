;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // Fuzzy mapping from heading text to section IDs
  const HEADING_MAP = {
    'description': 'description',
    'about': 'description',
    'about me': 'description',
    'overview': 'description',
    'summary': 'description',
    'introduction': 'description',
    'intro': 'description',
    'features': 'features',
    'highlights': 'features',
    'key features': 'features',
    'what it does': 'features',
    'projects': 'features',
    'installation': 'installation',
    'install': 'installation',
    'getting started': 'installation',
    'setup': 'installation',
    'quick start': 'installation',
    'prerequisites': 'installation',
    'requirements': 'installation',
    'usage': 'usage',
    'how to use': 'usage',
    'examples': 'usage',
    'example': 'usage',
    'commands': 'usage',
    'usage / commands': 'usage',
    'configuration': 'configuration',
    'config': 'configuration',
    'options': 'configuration',
    'options & flags': 'configuration',
    'settings': 'configuration',
    'environment variables': 'configuration',
    'api reference': 'api',
    'api': 'api',
    'api docs': 'api',
    'documentation': 'api',
    'contributing': 'contributing',
    'contribute': 'contributing',
    'how to contribute': 'contributing',
    'development': 'contributing',
    'testing': 'testing',
    'tests': 'testing',
    'running tests': 'testing',
    'test': 'testing',
    'roadmap': 'roadmap',
    'planned features': 'roadmap',
    'todo': 'roadmap',
    'future': 'roadmap',
    'changelog': 'changelog',
    'change log': 'changelog',
    'history': 'changelog',
    'release notes': 'changelog',
    'releases': 'changelog',
    'license': 'license',
    'licence': 'license',
    'licensing': 'license',
    'author': 'author',
    'authors': 'author',
    'maintainers': 'author',
    'credits': 'author',
    'contact': 'author',
    'acknowledgments': 'acknowledgments',
    'acknowledgements': 'acknowledgments',
    'thanks': 'acknowledgments',
    'special thanks': 'acknowledgments',
    'screenshots': 'screenshot',
    'screenshot': 'screenshot',
    'demo': 'screenshot',
    'tech stack': 'techstack',
    'technology': 'techstack',
    'technologies': 'techstack',
    'built with': 'techstack',
    'skills': 'techstack',
    'skills & technologies': 'techstack',
    'badges': 'badges',
    'stats': 'badges',
    'stats & badges': 'badges',
  };

  function normHeading(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s&/]/g, '').trim();
  }

  function matchSectionId(heading) {
    const norm = normHeading(heading);
    if (HEADING_MAP[norm])
      return HEADING_MAP[norm];

    // Partial match
    for (const [key, id] of Object.entries(HEADING_MAP))
      if (norm.includes(key) || key.includes(norm))
        return id;

    return null;
  }

  // Extract badges from [![ patterns
  function extractBadges(text) {
    const badges = [];
    const re = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(text)) !== null)
      badges.push({ alt: m[1], imgUrl: m[2], linkUrl: m[3] });
    return badges;
  }

  // Extract list items
  function extractList(text) {
    const items = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*[-*+]\s+(.+)/);
      if (m)
        items.push(m[1].trim());
    }
    return items;
  }

  // Extract checklist items
  function extractChecklist(text) {
    const items = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const m = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.+)/);
      if (m)
        items.push({ text: m[2].trim(), checked: m[1] !== ' ' });
    }
    return items;
  }

  // Extract code block content
  function extractCodeBlock(text) {
    const m = text.match(/```(\w*)\n([\s\S]*?)```/);
    if (m)
      return { lang: m[1] || 'bash', code: m[2].trim() };

    // Fallback: if there's indented code
    const lines = text.split('\n');
    const codeLines = [];
    for (const line of lines)
      if (line.startsWith('    ') || line.startsWith('\t'))
        codeLines.push(line.replace(/^    |\t/, ''));
    if (codeLines.length > 0)
      return { lang: 'bash', code: codeLines.join('\n') };

    return { lang: 'bash', code: text.trim() };
  }

  // Extract simple table
  function extractTable(text) {
    const lines = text.split('\n').filter(l => l.includes('|'));
    if (lines.length < 2)
      return { headers: [], rows: [] };

    const parse = (line) => line.split('|').map(c => c.trim()).filter(c => c && !c.match(/^[-:]+$/));
    const headers = parse(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; ++i) {
      if (lines[i].match(/^\s*\|?\s*[-:]+/))
        continue;
      const cells = parse(lines[i]);
      if (cells.length > 0)
        rows.push(cells);
    }
    return { headers, rows };
  }

  // Extract images
  function extractImages(text) {
    const images = [];
    const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(text)) !== null)
      images.push({ alt: m[1], url: m[2] });
    return images;
  }

  // Extract tags from comma-separated or list
  function extractTags(text) {
    const tags = [];
    // Try list items first
    const listItems = extractList(text);
    if (listItems.length > 0)
      return listItems;

    // Try comma-separated
    const parts = text.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1)
      return parts;

    // Try backtick-wrapped items
    const re = /`([^`]+)`/g;
    let m;
    while ((m = re.exec(text)) !== null)
      tags.push(m[1]);
    if (tags.length > 0)
      return tags;

    return text.trim() ? [text.trim()] : [];
  }

  // Main parse function
  function parseMarkdown(md, sections) {
    const lines = md.split('\n');
    const data = {};
    let title = '';

    // Extract title from first # heading
    for (let i = 0; i < lines.length; ++i) {
      const m = lines[i].match(/^#\s+(.+)/);
      if (m) {
        title = m[1].trim();
        break;
      }
    }
    data.title = title;

    // Check for badges at the top (before first ## or after title)
    let topBadges = [];
    let pastTitle = false;
    for (let i = 0; i < lines.length; ++i) {
      if (lines[i].match(/^#\s+/)) {
        pastTitle = true;
        continue;
      }
      if (lines[i].match(/^##\s+/))
        break;
      if (pastTitle) {
        const badges = extractBadges(lines[i]);
        topBadges = topBadges.concat(badges);
      }
    }
    if (topBadges.length > 0)
      data.badges = topBadges;

    // Split into sections by ## headings
    const rawSections = [];
    let currentHeading = null;
    let currentLines = [];

    for (const line of lines) {
      const headMatch = line.match(/^##\s+(.+)/);
      if (headMatch) {
        if (currentHeading !== null)
          rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim() });
        currentHeading = headMatch[1].trim();
        currentLines = [];
      } else if (currentHeading !== null)
        currentLines.push(line);
    }
    if (currentHeading !== null)
      rawSections.push({ heading: currentHeading, body: currentLines.join('\n').trim() });

    // Extract description: text between title and first ## heading (excluding badges)
    let descLines = [];
    let inDesc = false;
    for (const line of lines) {
      if (line.match(/^#\s+/)) {
        inDesc = true;
        continue;
      }
      if (line.match(/^##\s+/))
        break;
      if (inDesc && !extractBadges(line).length)
        descLines.push(line);
    }
    const descText = descLines.join('\n').trim();
    if (descText)
      data.description = descText;

    // Map raw sections to template section IDs
    const sectionMap = new Map();
    if (sections)
      for (const s of sections)
        sectionMap.set(s.id, s);

    for (const raw of rawSections) {
      const sectionId = matchSectionId(raw.heading);
      if (!sectionId)
        continue;

      const sectionDef = sectionMap.get(sectionId);
      const type = sectionDef ? sectionDef.type : 'textarea';

      switch (type) {
        case 'list':
          data[sectionId] = extractList(raw.body);
          break;
        case 'checklist':
          data[sectionId] = extractChecklist(raw.body);
          break;
        case 'codeblock':
          data[sectionId] = extractCodeBlock(raw.body);
          break;
        case 'table':
          data[sectionId] = extractTable(raw.body);
          break;
        case 'tags':
          data[sectionId] = extractTags(raw.body);
          break;
        case 'images':
          data[sectionId] = extractImages(raw.body);
          break;
        case 'badges':
          data[sectionId] = extractBadges(raw.body);
          break;
        case 'license': {
          const lMatch = raw.body.match(/\b(MIT|Apache[- ]2\.0|GPL[- ]3\.0|BSD[- ]2[- ]Clause|BSD[- ]3[- ]Clause|ISC|Unlicense|MPL[- ]2\.0)\b/i);
          data[sectionId] = lMatch ? lMatch[1] : raw.body.trim();
          break;
        }
        case 'author': {
          const authorData = { name: '', email: '', url: '', github: '' };
          const emailM = raw.body.match(/[\w.+-]+@[\w.-]+\.\w+/);
          if (emailM) authorData.email = emailM[0];
          const urlM = raw.body.match(/https?:\/\/[^\s)]+/);
          if (urlM) authorData.url = urlM[0];
          const ghM = raw.body.match(/github\.com\/([^\s/)]+)/);
          if (ghM) authorData.github = ghM[1];
          // Name is everything that isn't an email or URL
          const nameText = raw.body.replace(/[\w.+-]+@[\w.-]+\.\w+/g, '').replace(/https?:\/\/[^\s)]+/g, '').replace(/[[\]()]/g, '').trim();
          if (nameText) authorData.name = nameText.split('\n')[0].trim();
          data[sectionId] = authorData;
          break;
        }
        default:
          data[sectionId] = raw.body;
          break;
      }
    }

    return data;
  }

  SZ.ReadmeParser = { parseMarkdown };
})();
