;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const TEMPLATES = [
    {
      id: 'standard',
      name: 'Standard Project',
      description: 'Full-featured README for open-source projects',
      builtin: true,
      sections: [
        { id: 'title', label: 'Project Title', required: true, type: 'text' },
        { id: 'badges', label: 'Badges', required: false, type: 'badges' },
        { id: 'description', label: 'Description', required: true, type: 'textarea' },
        { id: 'screenshot', label: 'Screenshots', required: false, type: 'images' },
        { id: 'features', label: 'Features', required: false, type: 'list' },
        { id: 'installation', label: 'Installation', required: false, type: 'codeblock' },
        { id: 'usage', label: 'Usage', required: false, type: 'codeblock' },
        { id: 'configuration', label: 'Configuration', required: false, type: 'table' },
        { id: 'api', label: 'API Reference', required: false, type: 'textarea' },
        { id: 'techstack', label: 'Tech Stack', required: false, type: 'tags' },
        { id: 'contributing', label: 'Contributing', required: false, type: 'textarea' },
        { id: 'testing', label: 'Testing', required: false, type: 'codeblock' },
        { id: 'roadmap', label: 'Roadmap', required: false, type: 'checklist' },
        { id: 'changelog', label: 'Changelog', required: false, type: 'textarea' },
        { id: 'license', label: 'License', required: true, type: 'license' },
        { id: 'author', label: 'Author', required: false, type: 'author' },
        { id: 'acknowledgments', label: 'Acknowledgments', required: false, type: 'textarea' }
      ]
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Bare essentials for quick documentation',
      builtin: true,
      sections: [
        { id: 'title', label: 'Project Title', required: true, type: 'text' },
        { id: 'description', label: 'Description', required: true, type: 'textarea' },
        { id: 'installation', label: 'Installation', required: false, type: 'codeblock' },
        { id: 'usage', label: 'Usage', required: false, type: 'codeblock' },
        { id: 'license', label: 'License', required: true, type: 'license' }
      ]
    },
    {
      id: 'library',
      name: 'Library / Package',
      description: 'README for published libraries and npm/pip packages',
      builtin: true,
      sections: [
        { id: 'title', label: 'Package Name', required: true, type: 'text' },
        { id: 'badges', label: 'Badges', required: false, type: 'badges' },
        { id: 'description', label: 'Description', required: true, type: 'textarea' },
        { id: 'installation', label: 'Installation', required: true, type: 'codeblock' },
        { id: 'api', label: 'API Reference', required: false, type: 'textarea' },
        { id: 'usage', label: 'Examples', required: false, type: 'codeblock' },
        { id: 'configuration', label: 'Configuration', required: false, type: 'table' },
        { id: 'contributing', label: 'Contributing', required: false, type: 'textarea' },
        { id: 'license', label: 'License', required: true, type: 'license' }
      ]
    },
    {
      id: 'cli',
      name: 'CLI Tool',
      description: 'README for command-line tools and utilities',
      builtin: true,
      sections: [
        { id: 'title', label: 'Tool Name', required: true, type: 'text' },
        { id: 'description', label: 'Description', required: true, type: 'textarea' },
        { id: 'installation', label: 'Installation', required: true, type: 'codeblock' },
        { id: 'usage', label: 'Usage / Commands', required: false, type: 'codeblock' },
        { id: 'configuration', label: 'Options & Flags', required: false, type: 'table' },
        { id: 'features', label: 'Features', required: false, type: 'list' },
        { id: 'license', label: 'License', required: true, type: 'license' }
      ]
    },
    {
      id: 'profile',
      name: 'GitHub Profile',
      description: 'Personal GitHub profile README',
      builtin: true,
      sections: [
        { id: 'title', label: 'Display Name', required: true, type: 'text' },
        { id: 'description', label: 'About Me', required: true, type: 'textarea' },
        { id: 'techstack', label: 'Skills & Technologies', required: false, type: 'tags' },
        { id: 'features', label: 'Projects', required: false, type: 'list' },
        { id: 'badges', label: 'Stats & Badges', required: false, type: 'badges' },
        { id: 'author', label: 'Contact', required: false, type: 'author' }
      ]
    }
  ];

  SZ.ReadmeTemplates = TEMPLATES;
})();
