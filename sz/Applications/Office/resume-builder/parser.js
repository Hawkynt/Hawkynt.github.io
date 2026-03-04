;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const HEADING_MAP = {
    'summary': 'summary',
    'professional summary': 'summary',
    'profile': 'summary',
    'about': 'summary',
    'about me': 'summary',
    'overview': 'summary',
    'objective': 'objective',
    'career objective': 'objective',
    'professional objective': 'objective',
    'experience': 'experience',
    'work experience': 'experience',
    'professional experience': 'experience',
    'employment history': 'experience',
    'employment': 'experience',
    'work history': 'experience',
    'education': 'education',
    'academic background': 'education',
    'academic history': 'education',
    'qualifications': 'education',
    'skills': 'skills',
    'technical skills': 'skills',
    'core competencies': 'skills',
    'competencies': 'skills',
    'proficiencies': 'skills',
    'areas of expertise': 'skills',
    'certifications': 'certifications',
    'certificates': 'certifications',
    'professional certifications': 'certifications',
    'licenses & certifications': 'certifications',
    'licenses and certifications': 'certifications',
    'projects': 'projects',
    'portfolio': 'projects',
    'selected projects': 'projects',
    'key projects': 'projects',
    'personal projects': 'projects',
    'portfolio / projects': 'projects',
    'languages': 'languages',
    'language skills': 'languages',
    'references': 'references',
    'professional references': 'references',
    'research interests': 'researchInterests',
    'research': 'researchInterests',
    'publications': 'publications',
    'selected publications': 'publications',
    'papers': 'publications',
    'teaching': 'teaching',
    'teaching experience': 'teaching',
    'awards': 'awards',
    'awards & honors': 'awards',
    'awards and honors': 'awards',
    'honors': 'awards',
    'achievements': 'awards',
    'volunteer': 'volunteer',
    'volunteer work': 'volunteer',
    'volunteer experience': 'volunteer',
    'community service': 'volunteer',
    'activities': 'activities',
    'activities & interests': 'activities',
    'extracurricular': 'activities',
    'interests': 'activities',
    'hobbies': 'activities'
  };

  function normHeading(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s&/]/g, '').trim();
  }

  function matchSectionId(heading) {
    const norm = normHeading(heading);
    if (HEADING_MAP[norm])
      return HEADING_MAP[norm];

    for (const [key, id] of Object.entries(HEADING_MAP))
      if (norm.includes(key) || key.includes(norm))
        return id;

    return null;
  }

  function extractContactLine(text) {
    const info = {};
    const emailM = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailM) info.email = emailM[0];
    const phoneM = text.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
    if (phoneM) info.phone = phoneM[0].trim();
    const linkedinM = text.match(/linkedin\.com\/in\/([^\s|,)]+)/i);
    if (linkedinM) info.linkedin = 'https://linkedin.com/in/' + linkedinM[1];
    const githubM = text.match(/github\.com\/([^\s|,)]+)/i);
    if (githubM) info.github = 'https://github.com/' + githubM[1];
    const websiteM = text.match(/https?:\/\/(?!(?:linkedin|github)\.com)[^\s|,)]+/i);
    if (websiteM) info.website = websiteM[0];
    return info;
  }

  function parsePersonalInfo(lines) {
    const info = { name: '', title: '', email: '', phone: '', website: '', linkedin: '', github: '', location: '' };

    for (let i = 0; i < Math.min(lines.length, 20); ++i) {
      const line = lines[i].trim();
      if (!line) continue;

      const h1 = line.match(/^#\s+(.+)/);
      if (h1) {
        info.name = h1[1].trim();
        continue;
      }

      if (line.match(/^##\s+/)) break;

      const boldTitle = line.match(/^\*\*(.+?)\*\*$/);
      if (boldTitle && !info.title) {
        info.title = boldTitle[1];
        continue;
      }

      // Labeled field format: "- Email: value" or "- Phone: value"
      const labeledM = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)/);
      if (labeledM) {
        const key = labeledM[1].toLowerCase().trim();
        const value = labeledM[2].trim();
        if (key === 'email') { info.email = value; continue; }
        if (key === 'phone') { info.phone = value; continue; }
        if (key === 'location') { info.location = value; continue; }
        if (key === 'website') { info.website = value; continue; }
        if (key === 'linkedin') { info.linkedin = value; continue; }
        if (key === 'github') { info.github = value; continue; }
      }

      // Legacy pipe-delimited format fallback
      const contact = extractContactLine(line);
      if (contact.email) info.email = contact.email;
      if (contact.phone) info.phone = contact.phone;
      if (contact.linkedin) info.linkedin = contact.linkedin;
      if (contact.github) info.github = contact.github;
      if (contact.website) info.website = contact.website;

      const locationM = line.match(/(?:^|\|)\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2}(?:\s+\d{5})?)\s*(?:\||$)/);
      if (locationM) info.location = locationM[1].trim();

      if (!info.title && !h1 && !contact.email && !contact.phone && !locationM && !labeledM && i < 3) {
        const plain = line.replace(/\*\*/g, '').replace(/\|/g, '').trim();
        if (plain && plain.length < 60 && !plain.includes('@') && !plain.includes('http'))
          info.title = plain;
      }
    }

    return info;
  }

  function parseExperienceList(body) {
    const entries = [];
    const chunks = body.split(/^###\s+/m).filter(Boolean);

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      const headerLine = lines[0].trim();
      const entry = { company: '', title: '', location: '', startDate: '', endDate: '', current: false, bullets: [] };

      // New labeled format: ### Title (just the job title)
      // Legacy format: ### Title, Company
      const parts = headerLine.split(/\s*[|,]\s*/);
      if (parts.length >= 2) {
        entry.title = parts[0].replace(/\*\*/g, '').trim();
        entry.company = parts[1].replace(/\*\*/g, '').trim();
      } else
        entry.title = headerLine.replace(/\*\*/g, '').trim();

      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i].trim();

        // Labeled fields: "- Company: ...", "- Location: ...", "- Dates: ..."
        const labeledM = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)/);
        if (labeledM) {
          const key = labeledM[1].toLowerCase().trim();
          const value = labeledM[2].trim();
          if (key === 'company') { entry.company = value; continue; }
          if (key === 'location') { entry.location = value; continue; }
          if (key === 'dates' || key === 'date') {
            const dM = value.match(/(.+?)\s*[-\u2013]\s*(.*)/);
            if (dM) {
              entry.startDate = dM[1].trim();
              if (/present/i.test(dM[2])) { entry.current = true; entry.endDate = ''; }
              else entry.endDate = dM[2].trim();
            }
            continue;
          }
        }

        // Legacy date format: *Jan 2020 - Present*
        const dateM = line.match(/\*?(\w+\s+\d{4})\s*[-\u2013]\s*((?:Present|\w+\s+\d{4}))\*?/i);
        if (dateM) {
          entry.startDate = dateM[1];
          if (/present/i.test(dateM[2])) {
            entry.current = true;
            entry.endDate = '';
          } else
            entry.endDate = dateM[2];
          continue;
        }

        // Legacy location format: pipe-delimited
        const locM = line.match(/(?:^|\|)\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/);
        if (locM && !entry.location) {
          entry.location = locM[1].trim();
          continue;
        }

        const bulletM = line.match(/^\s*[-*+]\s+(.+)/);
        if (bulletM)
          entry.bullets.push(bulletM[1].trim());
      }

      if (entry.title || entry.company)
        entries.push(entry);
    }

    if (entries.length === 0) {
      const bullets = [];
      for (const line of body.split('\n')) {
        const m = line.match(/^\s*[-*+]\s+(.+)/);
        if (m) bullets.push(m[1].trim());
      }
      if (bullets.length > 0)
        entries.push({ company: '', title: '', location: '', startDate: '', endDate: '', current: false, bullets });
    }

    return entries;
  }

  function parseEducationList(body) {
    const entries = [];
    const chunks = body.split(/^###\s+/m).filter(Boolean);

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      const headerLine = lines[0].trim();
      const entry = { institution: '', degree: '', field: '', startDate: '', endDate: '', gpa: '', honors: '' };

      // New format: ### Institution (just the name)
      // Legacy format: ### Degree, Institution
      const parts = headerLine.split(/\s*[|,]\s*/);
      if (parts.length >= 2) {
        entry.degree = parts[0].replace(/\*\*/g, '').trim();
        entry.institution = parts[1].replace(/\*\*/g, '').trim();
      } else
        entry.institution = headerLine.replace(/\*\*/g, '').trim();

      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i].trim();

        // Labeled fields: "- Degree: ...", "- Field of Study: ...", "- Dates: ...", "- GPA: ...", "- Honors: ..."
        const labeledM = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)/);
        if (labeledM) {
          const key = labeledM[1].toLowerCase().trim();
          const value = labeledM[2].trim();
          if (key === 'degree') { entry.degree = value; continue; }
          if (key === 'field of study' || key === 'field' || key === 'major') { entry.field = value; continue; }
          if (key === 'dates' || key === 'date') {
            const dM = value.match(/(.+?)\s*[-\u2013]\s*(.*)/);
            if (dM) {
              entry.startDate = dM[1].trim();
              entry.endDate = /present/i.test(dM[2]) ? '' : dM[2].trim();
            }
            continue;
          }
          if (key === 'gpa') { entry.gpa = value; continue; }
          if (key === 'honors') { entry.honors = value; continue; }
        }

        // Legacy date format
        const dateM = line.match(/(\d{4})\s*[-\u2013]\s*(\d{4}|Present)/i);
        if (dateM) {
          entry.startDate = dateM[1];
          entry.endDate = /present/i.test(dateM[2]) ? '' : dateM[2];
          continue;
        }

        const fieldM = line.match(/(?:field|major|concentration|focus)[:\s]+(.+)/i);
        if (fieldM) { entry.field = fieldM[1].trim(); continue; }

        const gpaM = line.match(/GPA[:\s]+([0-9.]+)/i);
        if (gpaM) { entry.gpa = gpaM[1]; continue; }

        const honorsM = line.match(/(?:honors?|cum laude|magna|summa)[:\s]*(.*)/i);
        if (honorsM) { entry.honors = (honorsM[1] || honorsM[0]).trim(); continue; }

        if (!entry.field && line && !line.startsWith('-') && !line.startsWith('*'))
          entry.field = line.replace(/\*\*/g, '').trim();
      }

      if (entry.institution || entry.degree)
        entries.push(entry);
    }

    return entries;
  }

  function parseSkillsGrouped(body) {
    const groups = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const m = line.match(/^\s*[-*+]?\s*\*?\*?([^:*]+?)\*?\*?\s*:\s*(.+)/);
      if (m)
        groups.push({ category: m[1].trim(), skills: m[2].trim() });
    }

    if (groups.length === 0) {
      const items = [];
      for (const line of lines) {
        const m = line.match(/^\s*[-*+]\s+(.+)/);
        if (m) items.push(m[1].trim());
      }
      if (items.length > 0)
        groups.push({ category: 'General', skills: items.join(', ') });
    }

    return groups;
  }

  function parseCertificationsList(body) {
    const entries = [];
    const chunks = body.split(/^###\s+/m).filter(Boolean);

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      const entry = { name: lines[0].trim().replace(/\*\*/g, ''), issuer: '', date: '', credentialId: '', credentialUrl: '' };

      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i].trim();

        // Labeled fields: "- Issuer: ...", "- Date: ...", "- Credential ID: ...", "- URL: ..."
        const labeledM = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)/);
        if (labeledM) {
          const key = labeledM[1].toLowerCase().trim();
          const value = labeledM[2].trim();
          if (key === 'issuer' || key === 'issued by') { entry.issuer = value; continue; }
          if (key === 'date') { entry.date = value; continue; }
          if (key === 'credential id') { entry.credentialId = value; continue; }
          if (key === 'url') { entry.credentialUrl = value; continue; }
        }

        // Legacy fallback
        const issuerM = line.match(/(?:issuer|issued by|by)[:\s]+(.+)/i);
        if (issuerM) { entry.issuer = issuerM[1].trim(); continue; }
        const dateM = line.match(/(\w+\s+\d{4}|\d{4})/);
        if (dateM && !entry.date) { entry.date = dateM[1]; continue; }
        const idM = line.match(/(?:credential|id)[:\s#]+(\S+)/i);
        if (idM) { entry.credentialId = idM[1]; continue; }
        const urlM = line.match(/https?:\/\/[^\s]+/);
        if (urlM) { entry.credentialUrl = urlM[0]; continue; }
      }

      if (entry.name) entries.push(entry);
    }

    if (entries.length === 0) {
      for (const line of body.split('\n')) {
        const m = line.match(/^\s*[-*+]\s+(.+)/);
        if (m)
          entries.push({ name: m[1].trim(), issuer: '', date: '', credentialId: '', credentialUrl: '' });
      }
    }

    return entries;
  }

  function parseProjectsList(body) {
    const entries = [];
    const chunks = body.split(/^###\s+/m).filter(Boolean);

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      const entry = { name: lines[0].trim().replace(/\*\*/g, ''), description: '', technologies: '', url: '' };

      const bodyLines = [];
      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i].trim();

        // Labeled fields: "- Technologies: ...", "- URL: ..."
        const labeledM = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)/);
        if (labeledM) {
          const key = labeledM[1].toLowerCase().trim();
          const value = labeledM[2].trim();
          if (key === 'technologies' || key === 'tech' || key === 'stack' || key === 'built with') { entry.technologies = value; continue; }
          if (key === 'url') { entry.url = value; continue; }
        }

        // Legacy fallback
        const techM = line.match(/(?:technologies?|tech|stack|built with)[:\s]+(.+)/i);
        if (techM) { entry.technologies = techM[1].trim(); continue; }
        const urlM = line.match(/https?:\/\/[^\s]+/);
        if (urlM && !entry.url) { entry.url = urlM[0]; continue; }
        if (line) bodyLines.push(line.replace(/^\s*[-*+]\s+/, ''));
      }
      entry.description = bodyLines.join(' ').trim();

      if (entry.name) entries.push(entry);
    }

    if (entries.length === 0) {
      for (const line of body.split('\n')) {
        const m = line.match(/^\s*[-*+]\s+(.+)/);
        if (m)
          entries.push({ name: m[1].trim(), description: '', technologies: '', url: '' });
      }
    }

    return entries;
  }

  function parseLanguagesList(body) {
    const profMap = { 'c2': 'Native', 'c1': 'Fluent', 'b2': 'Professional', 'b1': 'Intermediate', 'a2': 'Basic', 'a1': 'Basic', 'advanced': 'Fluent', 'beginner': 'Basic', 'elementary': 'Basic' };
    const profValues = 'Native|Fluent|Professional|Intermediate|Basic|Advanced|Beginner|Elementary|C2|C1|B2|B1|A2|A1';
    const entries = [];
    for (const line of body.split('\n')) {
      // New format: "- Language: Proficiency" (e.g., "- English: Native")
      const labeledM = line.match(new RegExp('^\\s*[-*+]\\s+([^:]+?):\\s+(' + profValues + ')\\s*$', 'i'));
      if (labeledM) {
        let prof = labeledM[2].trim();
        prof = profMap[prof.toLowerCase()] || prof;
        entries.push({ language: labeledM[1].trim(), proficiency: prof });
        continue;
      }

      // Legacy format: "Language (Proficiency)" or "Language: Proficiency"
      const m = line.match(/^\s*[-*+]?\s*([^:(\-]+?)\s*[:(]\s*(Native|Fluent|Professional|Intermediate|Basic|Advanced|Beginner|Elementary|C2|C1|B2|B1|A2|A1)[):]?/i);
      if (m) {
        let prof = m[2].trim();
        prof = profMap[prof.toLowerCase()] || prof;
        entries.push({ language: m[1].trim(), proficiency: prof });
      }
    }
    return entries;
  }

  function parseReferencesList(body) {
    const entries = [];
    const chunks = body.split(/^###\s+/m).filter(Boolean);

    for (const chunk of chunks) {
      const lines = chunk.split('\n');
      const entry = { name: lines[0].trim().replace(/\*\*/g, ''), title: '', company: '', email: '', phone: '' };

      for (let i = 1; i < lines.length; ++i) {
        const line = lines[i].trim();

        // Labeled fields: "- Title: ...", "- Company: ...", "- Email: ...", "- Phone: ..."
        const labeledM = line.match(/^-\s+(\w[\w\s]*?):\s+(.+)/);
        if (labeledM) {
          const key = labeledM[1].toLowerCase().trim();
          const value = labeledM[2].trim();
          if (key === 'title' || key === 'position') { entry.title = value; continue; }
          if (key === 'company' || key === 'organization') { entry.company = value; continue; }
          if (key === 'email') { entry.email = value; continue; }
          if (key === 'phone') { entry.phone = value; continue; }
        }

        // Legacy fallback
        const emailM = line.match(/[\w.+-]+@[\w.-]+\.\w+/);
        if (emailM) { entry.email = emailM[0]; continue; }
        const phoneM = line.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
        if (phoneM) { entry.phone = phoneM[0].trim(); continue; }
        const titleM = line.match(/(?:title|position)[:\s]+(.+)/i);
        if (titleM) { entry.title = titleM[1].trim(); continue; }
        const compM = line.match(/(?:company|organization|org)[:\s]+(.+)/i);
        if (compM) { entry.company = compM[1].trim(); continue; }

        if (!entry.title && line && !line.startsWith('-'))
          entry.title = line;
      }

      if (entry.name) entries.push(entry);
    }

    return entries;
  }

  function extractList(text) {
    const items = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*[-*+]\s+(.+)/);
      if (m) items.push(m[1].trim());
    }
    return items;
  }

  function extractTags(text) {
    const listItems = extractList(text);
    if (listItems.length > 0) return listItems;

    const parts = text.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;

    const tags = [];
    const re = /`([^`]+)`/g;
    let m;
    while ((m = re.exec(text)) !== null) tags.push(m[1]);
    if (tags.length > 0) return tags;

    return text.trim() ? [text.trim()] : [];
  }

  function parseMarkdown(md, sections) {
    const lines = md.split('\n');
    const data = {};

    data.personalInfo = parsePersonalInfo(lines);

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

    const sectionMap = new Map();
    if (sections)
      for (const s of sections) sectionMap.set(s.id, s);

    for (const raw of rawSections) {
      const sectionId = matchSectionId(raw.heading);
      if (!sectionId) continue;

      const sectionDef = sectionMap.get(sectionId);
      const type = sectionDef ? sectionDef.type : null;

      switch (type || sectionId) {
        case 'experience-list':
          data[sectionId] = parseExperienceList(raw.body);
          break;
        case 'education-list':
          data[sectionId] = parseEducationList(raw.body);
          break;
        case 'skills-grouped':
          data[sectionId] = parseSkillsGrouped(raw.body);
          break;
        case 'certifications-list':
          data[sectionId] = parseCertificationsList(raw.body);
          break;
        case 'projects-list':
          data[sectionId] = parseProjectsList(raw.body);
          break;
        case 'languages-list':
          data[sectionId] = parseLanguagesList(raw.body);
          break;
        case 'references-list':
          data[sectionId] = parseReferencesList(raw.body);
          break;
        case 'tags':
          data[sectionId] = extractTags(raw.body);
          break;
        case 'list':
          data[sectionId] = extractList(raw.body);
          break;
        case 'textarea':
        case 'text':
          data[sectionId] = raw.body;
          break;
        default:
          if (sectionId === 'experience') data[sectionId] = parseExperienceList(raw.body);
          else if (sectionId === 'education') data[sectionId] = parseEducationList(raw.body);
          else if (sectionId === 'skills') data[sectionId] = parseSkillsGrouped(raw.body);
          else if (sectionId === 'certifications') data[sectionId] = parseCertificationsList(raw.body);
          else if (sectionId === 'projects') data[sectionId] = parseProjectsList(raw.body);
          else if (sectionId === 'languages') data[sectionId] = parseLanguagesList(raw.body);
          else if (sectionId === 'references') data[sectionId] = parseReferencesList(raw.body);
          else data[sectionId] = raw.body;
          break;
      }
    }

    return data;
  }

  SZ.ResumeParser = { parseMarkdown };
})();
