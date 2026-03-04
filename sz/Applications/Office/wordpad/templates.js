;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  const STORAGE_KEY = 'sz-wordpad-templates';

  const BUILT_IN = {
    letter: {
      name: 'Letter',
      html: '<p style="text-align:right;margin-bottom:24pt;">[Your Name]<br>[Your Address]<br>[City, State ZIP]<br>[Date]</p>'
        + '<p style="margin-bottom:12pt;">[Recipient Name]<br>[Recipient Address]<br>[City, State ZIP]</p>'
        + '<p style="margin-bottom:12pt;">Dear [Recipient],</p>'
        + '<p style="margin-bottom:12pt;">I am writing to you regarding [subject]. [Body of the letter goes here.]</p>'
        + '<p style="margin-bottom:12pt;">[Additional paragraphs as needed.]</p>'
        + '<p style="margin-bottom:24pt;">Sincerely,</p>'
        + '<p>[Your Name]<br>[Your Title]</p>'
    },
    report: {
      name: 'Report',
      html: '<h1 style="text-align:center;margin-bottom:6pt;">[Report Title]</h1>'
        + '<p style="text-align:center;color:#666;margin-bottom:24pt;">[Author Name] &mdash; [Date]</p>'
        + '<h2>1. Executive Summary</h2>'
        + '<p>[Provide a brief overview of the report\'s purpose and key findings.]</p>'
        + '<h2>2. Introduction</h2>'
        + '<p>[Background information and objectives of the report.]</p>'
        + '<h2>3. Methodology</h2>'
        + '<p>[Describe the methods used for research or analysis.]</p>'
        + '<h2>4. Findings</h2>'
        + '<p>[Present the main findings and data.]</p>'
        + '<h2>5. Conclusions</h2>'
        + '<p>[Summarize the conclusions drawn from the findings.]</p>'
        + '<h2>6. Recommendations</h2>'
        + '<p>[List actionable recommendations based on the conclusions.]</p>'
    },
    resume: {
      name: 'Resume',
      html: '<h1 style="text-align:center;margin-bottom:2pt;">[Your Full Name]</h1>'
        + '<p style="text-align:center;font-size:10pt;color:#666;margin-bottom:16pt;">[Email] &bull; [Phone] &bull; [City, State]</p>'
        + '<h2 style="border-bottom:2px solid #333;padding-bottom:2pt;">Professional Summary</h2>'
        + '<p>[A brief 2-3 sentence summary of your professional background and key strengths.]</p>'
        + '<h2 style="border-bottom:2px solid #333;padding-bottom:2pt;">Experience</h2>'
        + '<p><b>[Job Title]</b> &mdash; [Company Name]<br><i>[Start Date] &ndash; [End Date]</i></p>'
        + '<ul><li>[Key responsibility or achievement]</li><li>[Key responsibility or achievement]</li></ul>'
        + '<p><b>[Job Title]</b> &mdash; [Company Name]<br><i>[Start Date] &ndash; [End Date]</i></p>'
        + '<ul><li>[Key responsibility or achievement]</li><li>[Key responsibility or achievement]</li></ul>'
        + '<h2 style="border-bottom:2px solid #333;padding-bottom:2pt;">Education</h2>'
        + '<p><b>[Degree]</b> &mdash; [University Name], [Year]</p>'
        + '<h2 style="border-bottom:2px solid #333;padding-bottom:2pt;">Skills</h2>'
        + '<p>[Skill 1], [Skill 2], [Skill 3], [Skill 4], [Skill 5]</p>'
    }
  };

  function getCustomTemplates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomTemplate(id, name, html) {
    const custom = getCustomTemplates();
    custom[id] = { name, html };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }

  function deleteCustomTemplate(id) {
    const custom = getCustomTemplates();
    delete custom[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
  }

  function getAllTemplates() {
    const all = {};
    for (const [k, v] of Object.entries(BUILT_IN))
      all[k] = { ...v, builtIn: true };
    for (const [k, v] of Object.entries(getCustomTemplates()))
      all[k] = { ...v, builtIn: false };
    return all;
  }

  WP.Templates = {
    getAllTemplates,
    saveCustomTemplate,
    deleteCustomTemplate,
    getCustomTemplates,
    BUILT_IN
  };
})();
